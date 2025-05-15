import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

// Tipo para permissões
export type Permission = string;

// Interface para o contexto de permissões
interface PermissionContextType {
  userPermissions: Permission[];
  loading: boolean;
  hasPermission: (permission: Permission) => boolean;
  refreshPermissions: () => Promise<void>;
}

// Criar o contexto
const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  // Função para buscar as permissões do usuário
  const fetchUserPermissions = async () => {
    try {
      setLoading(true);
      console.log('PermissionContext - Iniciando fetchUserPermissions');
      
      // Verificar se é o email do administrador
      if (user?.email === 'victor@cambiohoje.com.br') {
        console.log('PermissionContext - Usuário é o administrador principal (victor@cambiohoje.com.br)');
        // Definir todas as permissões possíveis para o administrador
        const allPermissions = [
          'view:dashboard', 'edit:dashboard', 'view:own_dashboard', 'view:team_dashboard', 'view:all_dashboard',
          'view:clients', 'edit:clients', 'delete:clients', 'view:own_clients', 'view:team_clients', 'view:all_clients',
          'view:proposals', 'edit:proposals', 'delete:proposals', 'view:own_proposals', 'view:team_proposals', 'view:all_proposals',
          'approve:proposals', 'reject:proposals',
          'view:teams', 'edit:teams', 'delete:teams',
          'view:users', 'edit:users', 'delete:users',
          'view:roles', 'edit:roles', 'delete:roles',
          'view:webhooks', 'edit:webhooks',
          'view:settings', 'edit:settings',
          'view:pipeline', 'edit:pipeline',
          'view:my_registration'
        ];
        setUserPermissions(allPermissions);
        console.log('PermissionContext - Permissões definidas para admin:', allPermissions);
        setLoading(false);
        return;
      }
      
      if (!user) {
        console.log('PermissionContext - Nenhum usuário autenticado');
        setUserPermissions([]);
        setLoading(false);
        return;
      }
      
      // Verificar se o usuário tem roleId ou roleKey definido
      if (!user.roleId && !user.roleKey) {
        console.warn('PermissionContext - Usuário sem roleId e roleKey definidos, usando permissões vazias');
        setUserPermissions([]);
        setLoading(false);
        return;
      }
      
      let querySnapshot;
      
      // Tentar buscar pelo roleId primeiro (prioridade)
      if (user.roleId) {
        console.log(`PermissionContext - Buscando permissões para roleId: ${user.roleId}`);
        try {
          const roleDoc = await getDoc(doc(db, 'roles', user.roleId));
          if (roleDoc.exists()) {
            const roleData = roleDoc.data();
            const permissions = roleData.permissions || [];
            
            console.log(`PermissionContext - Permissões carregadas para o perfil com ID ${user.roleId}:`, permissions);
            setUserPermissions(permissions);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error(`PermissionContext - Erro ao buscar perfil pelo roleId: ${user.roleId}`, error);
        }
      }
      
      // Se não encontrou pelo roleId, tentar pelo roleKey
      console.log(`PermissionContext - Buscando permissões para roleKey: ${user.roleKey}`);
      const rolesCollection = collection(db, 'roles');
      const q = query(rolesCollection, where('key', '==', user.roleKey));
      querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('PermissionContext - Perfil não encontrado para a chave:', user.roleKey);
        setUserPermissions([]);
        setLoading(false);
        return;
      }
      
      // Obter as permissões do primeiro perfil encontrado
      const roleDoc = querySnapshot.docs[0];
      const roleData = roleDoc.data();
      const permissions = roleData.permissions || [];
      
      console.log(`PermissionContext - Permissões carregadas para o perfil ${user.roleKey}:`, permissions);
      setUserPermissions(permissions);
    } catch (error) {
      console.error('PermissionContext - Erro ao buscar permissões do usuário:', error);
      setUserPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar permissões quando o usuário mudar
  useEffect(() => {
    fetchUserPermissions();
  }, [user]);

  // Função para verificar se o usuário tem uma permissão específica
  const hasPermission = (permission: Permission): boolean => {
    // Verificar se é o email do administrador
    if (user?.email === 'victor@cambiohoje.com.br') {
      console.log(`PermissionContext - Usuário é o administrador principal, concedendo permissão: ${permission}`);
      return true;
    }
    
    // Verificar permissões granulares para dashboard, clientes e propostas
    if (permission === 'view:dashboard') {
      const has = userPermissions.includes(permission) || 
                  userPermissions.includes('view:own_dashboard') || 
                  userPermissions.includes('view:team_dashboard') || 
                  userPermissions.includes('view:all_dashboard');
      console.log(`PermissionContext - hasPermission("${permission}") => ${has} (verificando permissões granulares)`);
      return has;
    }
    
    if (permission === 'view:clients') {
      const has = userPermissions.includes(permission) || 
                  userPermissions.includes('view:own_clients') || 
                  userPermissions.includes('view:team_clients') || 
                  userPermissions.includes('view:all_clients');
      console.log(`PermissionContext - hasPermission("${permission}") => ${has} (verificando permissões granulares)`);
      return has;
    }
    
    if (permission === 'view:proposals') {
      const has = userPermissions.includes(permission) || 
                  userPermissions.includes('view:own_proposals') || 
                  userPermissions.includes('view:team_proposals') || 
                  userPermissions.includes('view:all_proposals');
      console.log(`PermissionContext - hasPermission("${permission}") => ${has} (verificando permissões granulares)`);
      return has;
    }
    
    const has = userPermissions.includes(permission);
    console.log(`PermissionContext - hasPermission("${permission}") => ${has}`);
    return has;
  };

  // Função para atualizar as permissões
  const refreshPermissions = async () => {
    console.log('PermissionContext - Atualizando permissões');
    await fetchUserPermissions();
  };

  return (
    <PermissionContext.Provider value={{ 
      userPermissions, 
      loading, 
      hasPermission,
      refreshPermissions
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

// Hook para usar o contexto de permissões
export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};
