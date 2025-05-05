import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

// Interface para as notificações
export interface Notification {
  id: string;
  type: 'new_registration' | 'new_proposal' | 'status_change';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  targetId?: string; // ID do cliente ou proposta relacionada
  targetType?: 'client' | 'proposal';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Calcular o número de notificações não lidas
  const unreadCount = notifications.filter(notification => !notification.read).length;

  useEffect(() => {
    if (!user || user.role === 'client') {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Apenas administradores e gerentes recebem notificações de novos cadastros
    setLoading(true);

    // Consulta simplificada para evitar a necessidade de índices compostos
    const q = query(
      collection(db, 'notifications'),
      where('recipientRoles', 'array-contains', user.role)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const notificationsList: Notification[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notificationsList.push({
          id: doc.id,
          type: data.type,
          title: data.title,
          message: data.message,
          read: data.read || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          targetId: data.targetId,
          targetType: data.targetType,
        });
      });
      
      // Ordenar localmente por data (mais recentes primeiro)
      notificationsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      // Remover notificações duplicadas (mesmo cliente)
      const uniqueNotifications = removeDuplicateClientNotifications(notificationsList);
      
      // Limitar a quantidade de notificações exibidas
      const limitedNotifications = uniqueNotifications.slice(0, 50);
      
      setNotifications(limitedNotifications);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar notificações:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Função para remover notificações duplicadas do mesmo cliente
  const removeDuplicateClientNotifications = (notifications: Notification[]): Notification[] => {
    // Mapa para rastrear clientes já notificados
    const clientNameMap = new Map<string, Notification>();
    
    // Lista de notificações sem duplicatas
    const uniqueNotifications: Notification[] = [];
    
    // Para cada notificação, verificar se é uma duplicata
    notifications.forEach(notification => {
      // Se não for uma notificação de novo cadastro, manter sempre
      if (notification.type !== 'new_registration') {
        uniqueNotifications.push(notification);
        return;
      }
      
      // Extrair o nome do cliente da mensagem
      // Formato típico: "Cliente/Empresa NOME acabou de se cadastrar"
      const message = notification.message;
      const clientNameMatch = message.match(/(?:Cliente|Empresa)\s+(.+?)\s+acabou/i);
      
      if (!clientNameMatch) {
        // Se não conseguir extrair o nome, manter a notificação
        uniqueNotifications.push(notification);
        return;
      }
      
      const clientName = clientNameMatch[1].trim().toLowerCase();
      
      // Verificar se já temos uma notificação para este cliente
      if (!clientNameMap.has(clientName)) {
        // Se não temos, adicionar esta notificação
        clientNameMap.set(clientName, notification);
        uniqueNotifications.push(notification);
      } else {
        // Se já temos, verificar qual é mais recente
        const existingNotification = clientNameMap.get(clientName)!;
        
        // Se a notificação atual é mais recente, substituir a existente
        if (notification.createdAt > existingNotification.createdAt) {
          // Remover a notificação antiga
          const index = uniqueNotifications.findIndex(n => n.id === existingNotification.id);
          if (index !== -1) {
            uniqueNotifications.splice(index, 1);
          }
          
          // Adicionar a nova notificação
          clientNameMap.set(clientName, notification);
          uniqueNotifications.push(notification);
        }
      }
    });
    
    // Reordenar por data (mais recentes primeiro)
    return uniqueNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  // Marcar uma notificação como lida
  const markAsRead = async (id: string) => {
    try {
      // Atualizar localmente primeiro para UI responsiva
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === id ? { ...notification, read: true } : notification
        )
      );
      
      // Atualizar no Firestore
      const notificationRef = doc(db, 'notifications', id);
      await updateDoc(notificationRef, {
        read: true
      });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  // Marcar todas as notificações como lidas
  const markAllAsRead = async () => {
    try {
      // Atualizar localmente primeiro
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      
      // Atualizar no Firestore - cada notificação não lida
      const promises = notifications
        .filter(notification => !notification.read)
        .map(notification => {
          const notificationRef = doc(db, 'notifications', notification.id);
          return updateDoc(notificationRef, { read: true });
        });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      loading 
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications deve ser usado dentro de um NotificationProvider');
  }
  return context;
};
