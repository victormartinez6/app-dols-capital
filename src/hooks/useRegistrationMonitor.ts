import { useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit, where, Timestamp, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useRegistrationMonitor() {
  const { user } = useAuth();

  useEffect(() => {
    // Apenas administradores e gerentes devem monitorar novos registros
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return;
    }

    // Obter a data atual menos 5 minutos para verificar apenas registros recentes
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    // Configurar a consulta para monitorar novos registros
    const q = query(
      collection(db, 'registrations'),
      where('createdAt', '>', Timestamp.fromDate(fiveMinutesAgo)),
      orderBy('createdAt', 'desc')
    );

    // Iniciar o listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        // Apenas notificar sobre novos documentos
        if (change.type === 'added') {
          const data = change.doc.data();
          const registrationId = change.doc.id;
          const registrationType = data.type as 'PF' | 'PJ';
          const clientName = registrationType === 'PF' ? data.name : data.companyName;
          
          // Verificar se já existe uma notificação para este registro
          const notificationsQuery = query(
            collection(db, 'notifications'),
            where('targetId', '==', registrationId),
            where('type', '==', 'new_registration')
          );
          
          try {
            const notificationsSnapshot = await getDocs(notificationsQuery);
            
            // Se não existir notificação, criar uma nova
            if (notificationsSnapshot.empty) {
              await addDoc(collection(db, 'notifications'), {
                type: 'new_registration',
                title: 'Novo cadastro de cliente',
                message: `${registrationType === 'PF' ? 'Cliente' : 'Empresa'} ${clientName} acabou de se cadastrar.`,
                read: false,
                recipientRoles: ['admin', 'manager'],
                targetId: registrationId,
                targetType: 'client',
                createdAt: serverTimestamp()
              });
            }
          } catch (error) {
            console.error('Erro ao verificar/criar notificação:', error);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);
}
