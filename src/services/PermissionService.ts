import { UserRole } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Define permissões específicas do sistema
export type Permission = 
  // Dashboard com granularidade
  | 'view:own_dashboard'
  | 'view:team_dashboard'
  | 'view:all_dashboard'
  | 'view:dashboard'
  
  // Clientes com granularidade
  | 'view:own_clients'
  | 'view:team_clients'
  | 'view:all_clients'
  | 'view:clients'
  | 'edit:clients'
  | 'delete:clients'
  
  // Propostas com granularidade
  | 'view:own_proposals'
  | 'view:team_proposals'
  | 'view:all_proposals'
  | 'view:proposals'
  | 'edit:proposals'
  | 'approve:proposals'
  | 'reject:proposals'
  | 'delete:proposals'
  
  // Pipeline com granularidade
  | 'view:own_pipeline'
  | 'view:team_pipeline'
  | 'view:all_pipeline'
  | 'view:pipeline'
  | 'edit:pipeline'
  
  // Usuários
  | 'view:users'
  | 'edit:users'
  | 'delete:users'
  
  // Configurações
  | 'view:settings'
  | 'edit:settings'
  
  // Webhooks
  | 'view:webhooks'
  | 'edit:webhooks'
  
  // Meu cadastro
  | 'view:my_registration'
  | 'view:profile'
  | 'edit:profile'
  
  // Equipes
  | 'view:teams'
  | 'edit:teams'
  | 'delete:teams'
  
  // Perfis
  | 'view:roles'
  | 'edit:roles'
  | 'delete:roles'
  
  // Itens de menu
  | 'menu:dashboard'
  | 'menu:clients'
  | 'menu:proposals'
  | 'menu:pipeline'
  | 'menu:teams'
  | 'menu:roles'
  | 'menu:users'
  | 'menu:settings'
  | 'menu:webhooks'
  | 'menu:my_registration';

// Mapeamento de itens de menu para permissões necessárias
export const menuPermissions: Record<string, Permission> = {
  '/': 'menu:dashboard',
  '/dashboard': 'menu:dashboard',
  '/clients': 'menu:clients',
  '/proposals': 'menu:proposals',
  '/pipeline': 'menu:pipeline',
  '/users': 'menu:users',
  '/settings': 'menu:settings',
  '/webhooks': 'menu:webhooks',
  '/my-registration': 'menu:my_registration',
  '/profile': 'view:profile',
  '/teams': 'menu:teams',
  '/roles': 'menu:roles'
};

class PermissionService {
  // Cache de permissões por perfil
  private rolePermissionsCache: Record<string, Permission[]> = {};
  private lastCacheUpdate: number = 0;
  private cacheExpirationMs: number = 5 * 60 * 1000; // 5 minutos
  
  constructor() {
    // Inicializar o cache vazio
    this.rolePermissionsCache = {};
  }
  
  /**
   * Carrega as permissões de um perfil do Firestore
   */
  private async loadRolePermissionsFromFirestore(roleKey: string): Promise<Permission[]> {
    try {
      // Buscar o documento do perfil no Firestore
      const rolesQuery = await getDocs(
        query(collection(db, 'roles'), where('key', '==', roleKey))
      );
      
      if (rolesQuery.empty) {
        console.warn(`Perfil ${roleKey} não encontrado no Firestore`);
        return [];
      }
      
      const roleDoc = rolesQuery.docs[0];
      const roleData = roleDoc.data();
      
      // Verificar se o documento tem um campo 'permissions'
      if (roleData && roleData.permissions && Array.isArray(roleData.permissions)) {
        console.log(`Permissões carregadas do Firestore para ${roleKey}:`, roleData.permissions);
        return roleData.permissions as Permission[];
      }
      
      // Se não tiver permissões definidas, retornar array vazio
      console.warn(`Perfil ${roleKey} não tem permissões definidas no Firestore`);
      return [];
    } catch (error) {
      console.error(`Erro ao carregar permissões do perfil ${roleKey}:`, error);
      // Em caso de erro, retornar array vazio
      return [];
    }
  }
  
  /**
   * Atualiza o cache de permissões para um perfil específico
   */
  private async updatePermissionsCache(roleKey: string): Promise<void> {
    const now = Date.now();
    
    // Se o cache estiver expirado ou não existir para este perfil, atualizar
    if (!this.rolePermissionsCache[roleKey] || now - this.lastCacheUpdate > this.cacheExpirationMs) {
      const permissions = await this.loadRolePermissionsFromFirestore(roleKey);
      this.rolePermissionsCache[roleKey] = permissions;
      this.lastCacheUpdate = now;
    }
  }

  /**
   * Verifica se um usuário tem uma permissão específica
   */
  async hasPermissionAsync(userRole: string | undefined, permission: Permission): Promise<boolean> {
    // Log para depuração
    console.log(`PermissionService.hasPermissionAsync - Verificando permissão: ${permission} para userRole: ${userRole}`);
    
    if (!userRole) {
      console.warn('PermissionService.hasPermissionAsync - userRole não definido, negando acesso');
      return false;
    }
    
    // Atualizar o cache de permissões para este perfil
    await this.updatePermissionsCache(userRole);
    
    // Verificar se a permissão existe para o perfil
    const hasPermission = this.rolePermissionsCache[userRole]?.includes(permission) || false;
    console.log(`PermissionService.hasPermissionAsync - ${userRole} tem permissão ${permission}? ${hasPermission}`);
    
    return hasPermission;
  }
  
  /**
   * Verifica se um usuário tem uma permissão específica (versão síncrona)
   * Usa o cache atual, pode não refletir alterações recentes no Firestore
   */
  hasPermission(userRole: string | undefined, permission: Permission): boolean {
    if (!userRole) return false;
    
    // Verificar se o perfil existe no cache
    if (!this.rolePermissionsCache[userRole]) {
      console.warn(`Perfil ${userRole} não encontrado no cache de permissões`);
      return false;
    }
    
    return this.rolePermissionsCache[userRole]?.includes(permission) || false;
  }

  /**
   * Obtém a permissão necessária para uma rota específica
   */
  getRequiredPermissionForRoute(route: string): Permission | undefined {
    console.log(`PermissionService.getRequiredPermissionForRoute - Rota: ${route}`);
    const requiredPermission = menuPermissions[route];
    console.log(`PermissionService.getRequiredPermissionForRoute - Permissão necessária: ${requiredPermission || 'nenhuma'}`);
    return requiredPermission;
  }

  /**
   * Verifica se um usuário tem acesso a uma rota específica
   */
  canAccessRoute(userRole: string | undefined, route: string): boolean {
    // Log para depuração
    console.log(`PermissionService.canAccessRoute - Verificando acesso à rota: ${route} para userRole: ${userRole}`);
    
    // Extrair a rota base (sem parâmetros)
    const baseRoute = route.split('/').slice(0, 2).join('/') || '/';
    console.log(`PermissionService.canAccessRoute - Rota base: ${baseRoute}`);
    
    // Obter a permissão necessária para a rota
    const requiredPermission = this.getRequiredPermissionForRoute(baseRoute);
    console.log(`PermissionService.canAccessRoute - Permissão necessária: ${requiredPermission || 'nenhuma'}`);
    
    if (!requiredPermission) {
      console.log(`PermissionService.canAccessRoute - Nenhuma permissão necessária para a rota ${baseRoute}, concedendo acesso`);
      return true;
    }
    
    // Verificar se o usuário tem a permissão necessária
    const hasPermission = this.hasPermission(userRole, requiredPermission);
    console.log(`PermissionService.canAccessRoute - ${userRole} tem permissão ${requiredPermission}? ${hasPermission}`);
    
    return hasPermission;
  }

  /**
   * Verifica se um usuário pode visualizar todos os clientes
   */
  canViewAllClients(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:all_clients');
  }
  
  /**
   * Verifica se um usuário pode visualizar clientes da equipe
   */
  canViewTeamClients(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:team_clients');
  }
  
  /**
   * Verifica se um usuário pode visualizar apenas seus próprios clientes
   */
  canViewOwnClients(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:own_clients');
  }

  /**
   * Verifica se um usuário pode visualizar todas as propostas
   */
  canViewAllProposals(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:all_proposals');
  }
  
  /**
   * Verifica se um usuário pode visualizar propostas da equipe
   */
  canViewTeamProposals(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:team_proposals');
  }
  
  /**
   * Verifica se um usuário pode visualizar apenas suas próprias propostas
   */
  canViewOwnProposals(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:own_proposals');
  }
  
  /**
   * Verifica se um usuário pode visualizar o dashboard completo
   */
  canViewAllDashboard(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:all_dashboard');
  }
  
  /**
   * Verifica se um usuário pode visualizar o dashboard da equipe
   */
  canViewTeamDashboard(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:team_dashboard');
  }
  
  /**
   * Verifica se um usuário pode visualizar apenas seu próprio dashboard
   */
  canViewOwnDashboard(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:own_dashboard');
  }

  /**
   * Verifica se um usuário pode visualizar o pipeline completo
   */
  canViewAllPipeline(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:all_pipeline');
  }
  
  /**
   * Verifica se um usuário pode visualizar o pipeline da equipe
   */
  canViewTeamPipeline(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:team_pipeline');
  }
  
  /**
   * Verifica se um usuário pode visualizar apenas seu próprio pipeline
   */
  canViewOwnPipeline(userRole: string | undefined): boolean {
    return this.hasPermission(userRole, 'view:own_pipeline');
  }

  /**
   * Obtém todas as permissões de um usuário
   */
  getUserPermissions(userRole: string | undefined): Permission[] {
    if (!userRole) return [];
    return this.rolePermissionsCache[userRole] || [];
  }
}

// Exportar uma instância única do serviço
export default new PermissionService();
