import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Role, RoleMenus, RolePages, DataScope } from '../types/roles';

// Constantes para facilitar o debug
const DEBUG = true;
const log = (message: string, ...args: any[]) => {
  if (DEBUG) {
    console.log(`[PermissionsSystem] ${message}`, ...args);
  }
};

// Função para debug - mostrar o conteúdo completo de um objeto
const debugObject = (label: string, obj: any) => {
  if (DEBUG) {
    console.log(`[PermissionsSystem-DEBUG] ${label}:`, JSON.stringify(obj, null, 2));
  }
};

// Função para criar menus padrão (todos false)
export function createDefaultMenus(): RoleMenus {
  return {
    dashboard: false,
    clients: false,
    proposals: false,
    pipeline: false,
    teams: false,
    roles: false,
    users: false,
    settings: false,
    webhooks: false,
    myRegistration: false,
    marketing: false
  };
}

// Função para criar páginas padrão (sem permissões)
export function createDefaultPages(): RolePages {
  return {
    dashboard: {
      view: false,
      scope: 'own'
    },
    clients: {
      view: false,
      create: false,
      edit: false,
      delete: false,
      scope: 'own'
    },
    proposals: {
      view: false,
      create: false,
      edit: false,
      delete: false,
      approve: false,
      reject: false,
      changeStatus: false,
      addObservation: false,
      scope: 'own'
    },
    pipeline: {
      view: false,
      edit: false,
      scope: 'own'
    },
    teams: {
      view: false,
      create: false,
      edit: false,
      delete: false
    },
    roles: {
      view: false,
      create: false,
      edit: false,
      delete: false
    },
    users: {
      view: false,
      create: false,
      edit: false,
      delete: false
    },
    settings: {
      view: false,
      edit: false
    },
    webhooks: {
      view: false,
      edit: false
    },
    myRegistration: {
      view: false,
      edit: false
    },
    marketing: {
      view: false,
      upload: false,
      delete: false,
      download: false,
      scope: 'own'
    }
  };
}

export function useRolePermissions() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [rawRoleData, setRawRoleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar o perfil do usuário quando ele for autenticado
  useEffect(() => {
    const fetchUserRole = async () => {
      // Se não houver usuário, não há perfil para buscar
      if (!user) {
        log('Nenhum usuário autenticado');
        setRole(null);
        setRawRoleData(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Obter a roleKey do usuário
        const roleKey = user.roleKey || '';
        log(`Verificando perfil para usuário: ${user.email}, roleKey: ${roleKey}`);
        
        // SISTEMA SIMPLIFICADO: Perfis fixos para cada tipo de usuário
        let userRole: Role | null = null;
        
        // 1. ADMIN - Acesso completo a tudo
        if (roleKey === 'admin' || user.email === 'victor@cambiohoje.com.br') {
          log('Definindo perfil de ADMINISTRADOR');
          userRole = {
            id: 'admin',
            name: 'Administrador',
            key: 'admin',
            menus: {
              dashboard: true,
              clients: true,
              proposals: true,
              pipeline: true,
              teams: true,
              roles: true,
              users: true,
              settings: true,
              webhooks: true,
              myRegistration: true,
              marketing: true
            },
            pages: {
              dashboard: { view: true, scope: 'all' },
              clients: { view: true, create: true, edit: true, delete: true, scope: 'all' },
              proposals: { view: true, create: true, edit: true, delete: true, scope: 'all' },
              pipeline: { view: true, edit: true, scope: 'all' },
              teams: { view: true, create: true, edit: true, delete: true },
              roles: { view: true, create: true, edit: true, delete: true },
              users: { view: true, create: true, edit: true, delete: true },
              settings: { view: true, edit: true },
              webhooks: { view: true, create: true, edit: true, delete: true },
              myRegistration: { view: true, edit: true },
              marketing: { view: true, upload: true, delete: true, download: true, scope: 'all' }
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        
        // 2. GERENTE - Vê o que ele criou e os da equipe dele
        else if (roleKey === 'manager') {
          log('Definindo perfil de GERENTE');
          userRole = {
            id: 'manager',
            name: 'Gerente',
            key: 'manager',
            menus: {
              // Menus visíveis para gerentes
              dashboard: true,
              clients: true,
              proposals: true,
              pipeline: true,
              marketing: true,
              // Menus não visíveis para gerentes
              myRegistration: false,
              teams: false,
              roles: false,
              users: false,
              settings: false,
              webhooks: false
            },
            pages: {
              dashboard: { view: true, scope: 'team' },
              clients: { view: true, create: true, edit: true, delete: false, scope: 'team' },
              proposals: { view: true, create: true, edit: true, delete: false, scope: 'team' },
              pipeline: { view: true, edit: true, scope: 'team' },
              teams: { view: true, create: false, edit: false, delete: false },
              marketing: { view: true, upload: false, delete: false, download: true, scope: 'all' },
              myRegistration: { view: true, edit: true }
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        
        // 3. PARCEIRO - Vê somente o que ele criou
        else if (roleKey === 'partner') {
          log('Definindo perfil de PARCEIRO');
          userRole = {
            id: 'partner',
            name: 'Parceiro',
            key: 'partner',
            menus: {
              dashboard: true,
              clients: true,
              proposals: true,
              pipeline: true,
              myRegistration: true,
              marketing: true,
              // Menus não visíveis para parceiros
              teams: false,
              roles: false,
              users: false,
              settings: false,
              webhooks: false
            },
            pages: {
              dashboard: { view: true, scope: 'own' },
              clients: { view: true, create: true, edit: true, delete: false, scope: 'own' },
              proposals: { view: true, create: true, edit: true, delete: false, scope: 'own' },
              pipeline: { view: true, edit: false, scope: 'own' },
              marketing: { view: true, upload: false, delete: false, download: true, scope: 'all' },
              myRegistration: { view: true, edit: true }
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        
        // 4. CLIENTE - Vê somente os dele próprio
        else if (roleKey === 'client') {
          log('Definindo perfil de CLIENTE');
          userRole = {
            id: 'client',
            name: 'Cliente',
            key: 'client',
            menus: {
              // Menus visíveis para clientes
              dashboard: true,
              proposals: true,
              myRegistration: true,
              // Menus não visíveis para clientes
              marketing: false,
              clients: false,
              pipeline: false,
              teams: false,
              roles: false,
              users: false,
              settings: false,
              webhooks: false
            },
            pages: {
              dashboard: { view: true, scope: 'own' },
              proposals: { view: true, create: false, edit: false, delete: false, scope: 'own' },
              myRegistration: { view: true, edit: true }
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        
        // 5. PERFIL DESCONHECIDO - Permissões mínimas
        else {
          log(`Perfil desconhecido: ${roleKey}. Definindo permissões mínimas.`);
          userRole = {
            id: roleKey,
            name: roleKey.charAt(0).toUpperCase() + roleKey.slice(1),
            key: roleKey,
            menus: {
              myRegistration: true,
              dashboard: false,
              clients: false,
              proposals: false,
              pipeline: false,
              marketing: true,
              teams: false,
              roles: false,
              users: false,
              settings: false,
              webhooks: false
            },
            pages: {
              myRegistration: { view: true, edit: true },
              dashboard: { view: false, scope: 'own' },
              clients: { view: false, create: false, edit: false, delete: false, scope: 'own' },
              proposals: { view: false, create: false, edit: false, delete: false, scope: 'own' },
              pipeline: { view: false, edit: false, scope: 'own' },
              teams: { view: false, create: false, edit: false, delete: false },
              roles: { view: false, create: false, edit: false, delete: false },
              users: { view: false, create: false, edit: false, delete: false },
              settings: { view: false, edit: false },
              webhooks: { view: false, create: false, edit: false, delete: false },
              marketing: { view: false, upload: false, delete: false, download: false, scope: 'own' }
            },
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        
        // Definir o perfil e os dados brutos
        setRole(userRole);
        setRawRoleData(userRole);
        log(`Perfil ${userRole.key} definido com sucesso`);
        debugObject('Perfil completo', userRole);
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro desconhecido';
        console.error('Erro ao definir perfil do usuário:', error);
        log(`ERRO: ${errorMessage}`);
        setRole(null);
        setRawRoleData(null);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  // Método para verificar se o usuário pode acessar uma página
  const canViewPage = (pageKey: string): boolean => {
    // Admin especial (victor@cambiohoje.com.br) sempre pode ver todas as páginas
    if (user?.email === 'victor@cambiohoje.com.br') {
      log(`Admin especial: Permitindo acesso à página ${pageKey}`);
      return true;
    }
    
    // Verificar permissões do role carregado
    if (!role || !role.pages) {
      log(`Sem perfil ou permissões carregadas para verificar acesso à página ${pageKey}`);
      return false;
    }
    
    // Mapeamento de chaves para facilitar a busca
    const keyMappings: Record<string, string[]> = {
      'dashboard': ['dashboard', 'painel', 'home', 'inicio', 'início'],
      'clients': ['clients', 'clientes', 'cliente'],
      'proposals': ['proposals', 'propostas', 'proposta'],
      'pipeline': ['pipeline'],
      'teams': ['teams', 'equipes', 'equipe', 'team'],
      'roles': ['roles', 'perfis', 'perfil', 'role'],
      'users': ['users', 'usuários', 'usuário', 'user'],
      'settings': ['settings', 'configurações', 'configuração', 'setting'],
      'webhooks': ['webhooks', 'webhook'],
      'myRegistration': ['myRegistration', 'meu_cadastro', 'meu cadastro', 'cadastro']
    };
    
    // Verificar permissões usando o mapeamento
    const pages = role.pages as Record<string, any>;
    
    // 1. Tentar com a chave exata
    if (pages[pageKey] && pages[pageKey].view === true) {
      log(`Página encontrada diretamente: ${pageKey}`);
      return true;
    }
    
    // 2. Tentar com as variações mapeadas
    const possibleKeys = keyMappings[pageKey] || [];
    for (const key of possibleKeys) {
      if (pages[key] && pages[key].view === true) {
        log(`Página encontrada com chave alternativa: ${key}`);
        return true;
      }
    }
    
    // Nenhuma permissão encontrada
    log(`Acesso à página ${pageKey} negado`);
    return false;
  };

  // Método para verificar se o usuário pode realizar uma ação em uma página
  const canPerformAction = (pageKey: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    // Admin especial (victor@cambiohoje.com.br) sempre pode tudo
    if (user?.email === 'victor@cambiohoje.com.br') {
      log(`Admin especial: Permitindo ação ${action} na página ${pageKey}`);
      return true;
    }
    
    // Verificar permissões do role carregado
    if (!role || !role.pages) {
      log(`Sem perfil ou permissões carregadas para verificar ação ${action} na página ${pageKey}`);
      return false;
    }
    
    // Mapeamento de chaves para facilitar a busca
    const keyMappings: Record<string, string[]> = {
      'dashboard': ['dashboard', 'painel', 'home', 'inicio', 'início'],
      'clients': ['clients', 'clientes', 'cliente'],
      'proposals': ['proposals', 'propostas', 'proposta'],
      'pipeline': ['pipeline'],
      'teams': ['teams', 'equipes', 'equipe', 'team'],
      'roles': ['roles', 'perfis', 'perfil', 'role'],
      'users': ['users', 'usuários', 'usuário', 'user'],
      'settings': ['settings', 'configurações', 'configuração', 'setting'],
      'webhooks': ['webhooks', 'webhook'],
      'myRegistration': ['myRegistration', 'meu_cadastro', 'meu cadastro', 'cadastro']
    };
    
    // Verificar permissões usando o mapeamento
    const pages = role.pages as Record<string, any>;
    
    // 1. Tentar com a chave exata
    if (pages[pageKey] && pages[pageKey][action] === true) {
      log(`Ação ${action} permitida diretamente para ${pageKey}`);
      return true;
    }
    
    // 2. Tentar com as variações mapeadas
    const possibleKeys = keyMappings[pageKey] || [];
    for (const key of possibleKeys) {
      if (pages[key] && pages[key][action] === true) {
        log(`Ação ${action} permitida com chave alternativa ${key} para ${pageKey}`);
        return true;
      }
    }
    
    // Nenhuma permissão encontrada
    log(`Ação ${action} negada para ${pageKey}`);
    return false;
  };

  // Método para obter o escopo de dados
  const getDataScope = (resource: string): 'own' | 'team' | 'all' => {
    // Admin especial (victor@cambiohoje.com.br) sempre pode ver tudo
    if (user?.email === 'victor@cambiohoje.com.br') {
      log(`Admin especial: Escopo de dados 'all' para ${resource}`);
      return 'all';
    }
    
    // SOLUCAO EMERGENCIAL: Forçar escopo específico para cada tipo de usuário
    // independente das configurações no perfil
    if (user?.roleKey) {
      const roleKey = user.roleKey.toLowerCase();
      
      // Verificar se é um recurso que precisa de escopo específico
      if (resource === 'clients' || resource === 'proposals' || resource === 'dashboard' || resource === 'pipeline') {
        if (roleKey === 'admin') {
          log(`SOLUCAO EMERGENCIAL: Forçando escopo 'all' para admin em ${resource}`);
          return 'all';
        } else if (roleKey === 'manager') {
          log(`SOLUCAO EMERGENCIAL: Forçando escopo 'team' para gerente em ${resource}`);
          return 'team';
        } else if (roleKey === 'partner') {
          log(`SOLUCAO EMERGENCIAL: Forçando escopo 'own' para parceiro em ${resource}`);
          return 'own';
        } else if (roleKey === 'client') {
          log(`SOLUCAO EMERGENCIAL: Forçando escopo 'own' para cliente em ${resource}`);
          return 'own';
        }
      }
    }
    
    // Para outros usuários, verificar o escopo configurado no perfil
    if (!role || !role.pages) {
      log(`Sem perfil ou permissões carregadas para verificar escopo de dados para ${resource}`);
      return 'own';
    }
    
    // Mapeamento de chaves para facilitar a busca
    const keyMappings: Record<string, string[]> = {
      'dashboard': ['dashboard', 'painel', 'home', 'inicio', 'início'],
      'clients': ['clients', 'clientes', 'cliente'],
      'proposals': ['proposals', 'propostas', 'proposta'],
      'pipeline': ['pipeline'],
      'teams': ['teams', 'equipes', 'equipe', 'team'],
      'roles': ['roles', 'perfis', 'perfil', 'role'],
      'users': ['users', 'usuários', 'usuário', 'user'],
      'settings': ['settings', 'configurações', 'configuração', 'setting'],
      'webhooks': ['webhooks', 'webhook'],
      'myRegistration': ['myRegistration', 'meu_cadastro', 'meu cadastro', 'cadastro']
    };
    
    // Verificar permissões usando o mapeamento
    const pages = role.pages as Record<string, any>;
    let scope: DataScope | undefined;
    
    // 1. Tentar com a chave exata
    if (pages[resource] && pages[resource].scope) {
      scope = pages[resource].scope as DataScope;
      log(`Escopo encontrado diretamente para ${resource}: ${scope}`);
      return scope;
    }
    
    // 2. Tentar com as variações mapeadas
    const possibleKeys = keyMappings[resource] || [];
    for (const key of possibleKeys) {
      if (pages[key] && pages[key].scope) {
        scope = pages[key].scope as DataScope;
        log(`Escopo encontrado com chave alternativa ${key} para ${resource}: ${scope}`);
        return scope;
      }
    }
    
    // 3. Determinar escopo baseado no perfil do usuário
    const roleKey = role.key.toLowerCase();
    if (roleKey.includes('admin')) {
      log(`Escopo padrão 'all' baseado no perfil de administrador`);
      return 'all';
    } else if (roleKey.includes('manager')) {
      log(`Escopo padrão 'team' baseado no perfil de gerente`);
      return 'team';
    } else {
      log(`Escopo padrão 'own' baseado no perfil de usuário comum`);
      return 'own';
    }
  };

  // Método para verificar se o usuário pode acessar um menu
  const canAccessMenu = (menuKey: string): boolean => {
    // Admin especial (victor@cambiohoje.com.br) sempre pode acessar todos os menus
    if (user?.email === 'victor@cambiohoje.com.br') {
      log(`Admin especial: Permitindo acesso ao menu ${menuKey}`);
      return true;
    }
    
    // Verificar permissões do role carregado
    if (!role || !role.menus) {
      log(`Sem perfil ou menus carregados para verificar acesso ao menu ${menuKey}`);
      return false;
    }
    
    // Mapeamento de chaves para facilitar a busca
    const keyMappings: Record<string, string[]> = {
      'dashboard': ['dashboard', 'painel', 'home', 'inicio', 'início', 'Menu: Dashboard'],
      'clients': ['clients', 'clientes', 'cliente', 'Menu: Clientes'],
      'proposals': ['proposals', 'propostas', 'proposta', 'Menu: Propostas'],
      'pipeline': ['pipeline', 'Menu: Pipeline'],
      'teams': ['teams', 'equipes', 'equipe', 'team', 'Menu: Equipes'],
      'roles': ['roles', 'perfis', 'perfil', 'role', 'Menu: Perfis'],
      'users': ['users', 'usuários', 'usuário', 'user', 'Menu: Usuários'],
      'settings': ['settings', 'configurações', 'configuração', 'setting', 'Menu: Configurações'],
      'webhooks': ['webhooks', 'webhook', 'Menu: Webhooks'],
      'myRegistration': ['myRegistration', 'meu_cadastro', 'meu cadastro', 'cadastro', 'Menu: Meu Cadastro']
    };
    
    // Verificar permissões usando o mapeamento
    const menus = role.menus as Record<string, any>;
    
    // 1. Tentar com a chave exata
    if (menus[menuKey] === true) {
      log(`Menu encontrado diretamente: ${menuKey}`);
      return true;
    }
    
    // 2. Tentar com as variações mapeadas
    const possibleKeys = keyMappings[menuKey] || [];
    for (const key of possibleKeys) {
      if (menus[key] === true) {
        log(`Menu encontrado com chave alternativa: ${key}`);
        return true;
      }
    }
    
    // Nenhuma permissão encontrada
    log(`Acesso ao menu ${menuKey} negado`);
    return false;
  };

  // Retornar os métodos e estados do hook
  return {
    role,
    loading,
    error,
    rawRoleData,
    canViewPage,
    canPerformAction,
    getDataScope,
    canAccessMenu
  };
}
