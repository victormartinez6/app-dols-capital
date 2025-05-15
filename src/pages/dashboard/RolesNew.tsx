import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { RoleMenus, RolePages } from '../../types/roles';
import { createDefaultMenus, createDefaultPages } from '../../hooks/useRolePermissions';

// Interface para o formato de perfis
interface Role {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  isSystem?: boolean;
  createdAt: Date | null;
  updatedAt?: Date | null;
  // Campos para o novo formato de permissões
  menus: RoleMenus;
  pages: RolePages;
}

// Interface para permissões disponíveis
interface PermissionOption {
  key: string;
  description: string;
  category: string;
}

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<Role>>({
    name: '',
    key: '',
    permissions: [],
    menus: createDefaultMenus(),
    pages: createDefaultPages()
  });
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [availablePermissions, setAvailablePermissions] = useState<PermissionOption[]>([]);
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  const { canPerformAction } = useRolePermissions();

  useEffect(() => {
    fetchRoles();
    setAvailablePermissions(getDefaultPermissions());
  }, []);

  const getDefaultPermissions = (): PermissionOption[] => {
    return [
      // Permissões de Menu
      { key: 'menu:dashboard' as Permission, description: 'Menu: Dashboard', category: 'Menus' },
      { key: 'menu:clients' as Permission, description: 'Menu: Clientes', category: 'Menus' },
      { key: 'menu:proposals' as Permission, description: 'Menu: Propostas', category: 'Menus' },
      { key: 'menu:pipeline' as Permission, description: 'Menu: Pipeline', category: 'Menus' },
      { key: 'menu:teams' as Permission, description: 'Menu: Equipes', category: 'Menus' },
      { key: 'menu:roles' as Permission, description: 'Menu: Perfis', category: 'Menus' },
      { key: 'menu:users' as Permission, description: 'Menu: Usuários', category: 'Menus' },
      { key: 'menu:settings' as Permission, description: 'Menu: Configurações', category: 'Menus' },
      { key: 'menu:webhooks' as Permission, description: 'Menu: Webhooks', category: 'Menus' },
      { key: 'menu:my_registration' as Permission, description: 'Menu: Meu Cadastro', category: 'Menus' },
      
      // Dashboard com granularidade
      { key: 'view:own_dashboard' as Permission, description: 'Visualizar próprio dashboard', category: 'Dashboard' },
      { key: 'view:team_dashboard' as Permission, description: 'Visualizar dashboard da equipe', category: 'Dashboard' },
      { key: 'view:all_dashboard' as Permission, description: 'Visualizar todos os dashboards', category: 'Dashboard' },
      
      // Clientes
      { key: 'view:own_clients' as Permission, description: 'Visualizar próprios clientes', category: 'Clientes' },
      { key: 'view:team_clients' as Permission, description: 'Visualizar clientes da equipe', category: 'Clientes' },
      { key: 'view:all_clients' as Permission, description: 'Visualizar todos os clientes', category: 'Clientes' },
      { key: 'edit:clients' as Permission, description: 'Editar clientes', category: 'Clientes' },
      { key: 'delete:clients' as Permission, description: 'Excluir clientes', category: 'Clientes' },
      
      // Propostas
      { key: 'view:own_proposals' as Permission, description: 'Visualizar próprias propostas', category: 'Propostas' },
      { key: 'view:team_proposals' as Permission, description: 'Visualizar propostas da equipe', category: 'Propostas' },
      { key: 'view:all_proposals' as Permission, description: 'Visualizar todas as propostas', category: 'Propostas' },
      { key: 'edit:proposals' as Permission, description: 'Editar propostas', category: 'Propostas' },
      { key: 'delete:proposals' as Permission, description: 'Excluir propostas', category: 'Propostas' },
      { key: 'approve:proposals' as Permission, description: 'Aprovar propostas', category: 'Propostas' },
      { key: 'reject:proposals' as Permission, description: 'Rejeitar propostas', category: 'Propostas' },
      
      // Pipeline
      { key: 'view:own_pipeline' as Permission, description: 'Visualizar próprio pipeline', category: 'Pipeline' },
      { key: 'view:team_pipeline' as Permission, description: 'Visualizar pipeline da equipe', category: 'Pipeline' },
      { key: 'view:all_pipeline' as Permission, description: 'Visualizar todos os pipelines', category: 'Pipeline' },
      { key: 'edit:pipeline' as Permission, description: 'Editar pipeline', category: 'Pipeline' },
      
      // Usuários
      { key: 'view:users' as Permission, description: 'Visualizar usuários', category: 'Usuários' },
      { key: 'edit:users' as Permission, description: 'Editar usuários', category: 'Usuários' },
      { key: 'delete:users' as Permission, description: 'Excluir usuários', category: 'Usuários' },
      
      // Equipes
      { key: 'view:teams' as Permission, description: 'Visualizar equipes', category: 'Equipes' },
      { key: 'edit:teams' as Permission, description: 'Editar equipes', category: 'Equipes' },
      { key: 'delete:teams' as Permission, description: 'Excluir equipes', category: 'Equipes' },
      
      // Perfis
      { key: 'view:roles' as Permission, description: 'Visualizar perfis', category: 'Perfis' },
      { key: 'edit:roles' as Permission, description: 'Editar perfis', category: 'Perfis' },
      { key: 'delete:roles' as Permission, description: 'Excluir perfis', category: 'Perfis' },
      
      // Configurações
      { key: 'view:settings' as Permission, description: 'Visualizar configurações', category: 'Configurações' },
      { key: 'edit:settings' as Permission, description: 'Editar configurações', category: 'Configurações' },
      
      // Webhooks
      { key: 'view:webhooks' as Permission, description: 'Visualizar webhooks', category: 'Webhooks' },
      { key: 'edit:webhooks' as Permission, description: 'Editar webhooks', category: 'Webhooks' },
      
      // Meu Cadastro
      { key: 'view:profile' as Permission, description: 'Visualizar perfil', category: 'Meu Cadastro' },
      { key: 'edit:profile' as Permission, description: 'Editar perfil', category: 'Meu Cadastro' }
    ];
  };

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const rolesCollection = collection(db, 'roles');
      const querySnapshot = await getDocs(rolesCollection);
      
      const rolesData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          key: data.key || '',
          permissions: data.permissions || [],
          menus: data.menus || createDefaultMenus(),
          pages: data.pages || createDefaultPages(),
          isSystem: data.isSystem || false,
          createdAt: data.createdAt ? new Date(data.createdAt.seconds * 1000) : null,
          updatedAt: data.updatedAt ? new Date(data.updatedAt.seconds * 1000) : null
        } as Role;
      });
      
      setRoles(rolesData);
    } catch (error) {
      console.error('Erro ao carregar perfis:', error);
      alert('Erro ao carregar perfis. Verifique o console para mais detalhes.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = () => {
    setCurrentRole({
      name: '',
      key: '',
      permissions: [],
      menus: createDefaultMenus(),
      pages: createDefaultPages()
    });
    setIsEditMode(false);
    setShowRoleModal(true);
  };

  const handleEditRole = async (roleId: string) => {
    try {
      const roleDoc = await getDoc(doc(db, 'roles', roleId));
      if (roleDoc.exists()) {
        const roleData = roleDoc.data();
        setCurrentRole({
          id: roleId,
          name: roleData.name,
          key: roleData.key,
          permissions: roleData.permissions || [],
          menus: roleData.menus || createDefaultMenus(),
          pages: roleData.pages || createDefaultPages(),
          isSystem: roleData.isSystem || false,
          createdAt: roleData.createdAt ? new Date(roleData.createdAt.seconds * 1000) : null,
          updatedAt: roleData.updatedAt ? new Date(roleData.updatedAt.seconds * 1000) : null
        });
        setIsEditMode(true);
        setShowRoleModal(true);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil para edição:', error);
      alert('Erro ao carregar perfil para edição. Verifique o console para mais detalhes.');
    }
  };

  const handleDeleteRole = (roleId: string) => {
    setRoleToDelete(roleId);
    setShowDeleteModal(true);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    
    try {
      // Verificar se o perfil existe
      const roleDoc = await getDoc(doc(db, 'roles', roleToDelete));
      
      if (!roleDoc.exists()) {
        alert('Este perfil não existe mais no banco de dados.');
        setShowDeleteModal(false);
        setRoleToDelete(null);
        fetchRoles(); // Atualizar a lista
        return;
      }
      
      const roleData = roleDoc.data();
      
      // Não permitir excluir perfis do sistema
      if (roleData.isSystem) {
        alert('Não é possível excluir perfis do sistema.');
        setShowDeleteModal(false);
        setRoleToDelete(null);
        return;
      }
      
      // Verificar se há usuários com este perfil
      const usersCollection = collection(db, 'users');
      const q = query(usersCollection, where('roleId', '==', roleToDelete));
      const usersSnapshot = await getDocs(q);
      
      if (!usersSnapshot.empty) {
        alert(`Este perfil está sendo usado por ${usersSnapshot.size} usuário(s). Altere o perfil desses usuários antes de excluir este perfil.`);
        setShowDeleteModal(false);
        setRoleToDelete(null);
        return;
      }
      
      await deleteDoc(doc(db, 'roles', roleToDelete));
      
      setRoles(prev => prev.filter(role => role.id !== roleToDelete));
      setShowDeleteModal(false);
      setRoleToDelete(null);
      
      // Mostrar notificação de sucesso
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
    } catch (error) {
      console.error('Erro ao excluir perfil:', error);
      alert('Erro ao excluir perfil. Verifique o console para mais detalhes.');
    }
  };

  const handleSaveRole = async () => {
    // Validar campos obrigatórios
    if (!currentRole.name || !currentRole.key) {
      alert('Nome e chave do perfil são obrigatórios.');
      return;
    }
    
    try {
      setIsSavingRole(true);
      
      // Converter permissões antigas para o novo formato
      const menus = currentRole.menus || createDefaultMenus();
      const pages = currentRole.pages || createDefaultPages();
      
      // Atualizar menus e pages com base nas permissões selecionadas
      if (currentRole.permissions) {
        currentRole.permissions.forEach(permission => {
          updatePermissionInNewFormat(permission, true, menus, pages);
        });
      }
      
      if (currentRole.id) {
        // Atualizar perfil existente
        await updateDoc(doc(db, 'roles', currentRole.id), {
          name: currentRole.name,
          key: currentRole.isSystem ? currentRole.key : currentRole.key, // Não alterar a chave de perfis do sistema
          permissions: currentRole.permissions || [],
          menus: menus,
          pages: pages,
          updatedAt: new Date()
        });
        
        // Atualizar usuários que têm este perfil
        const usersCollection = collection(db, 'users');
        const q = query(usersCollection, where('roleId', '==', currentRole.id));
        const usersSnapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let updateCount = 0;
        
        usersSnapshot.docs.forEach(userDoc => {
          // Atualizar o roleKey e roleName do usuário
          batch.update(doc(db, 'users', userDoc.id), {
            roleKey: currentRole.key,
            roleName: currentRole.name
          });
          updateCount++;
        });
        
        if (updateCount > 0) {
          await batch.commit();
          console.log(`Atualizados ${updateCount} usuários com o perfil atualizado.`);
        }
      } else {
        // Verificar se a chave já existe (para novos perfis)
        const rolesCollection = collection(db, 'roles');
        const querySnapshot = await getDocs(rolesCollection);
        const existingRole = querySnapshot.docs.find(doc => {
          const data = doc.data();
          return data.key === currentRole.key;
        });
        
        if (existingRole) {
          alert(`A chave "${currentRole.key}" já está em uso por outro perfil.`);
          setIsSavingRole(false);
          return;
        }
        
        // Criar novo perfil
        await addDoc(collection(db, 'roles'), {
          name: currentRole.name,
          key: currentRole.key,
          permissions: currentRole.permissions || [],
          menus: menus,
          pages: pages,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Recarregar os perfis
      await fetchRoles();
      
      // Fechar modal e limpar estado
      setShowRoleModal(false);
      setCurrentRole({
        name: '',
        key: '',
        permissions: [],
        menus: createDefaultMenus(),
        pages: createDefaultPages()
      });
      
      // Mostrar notificação de sucesso
      setShowSuccessNotification(true);
      setTimeout(() => setShowSuccessNotification(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert('Erro ao salvar perfil. Verifique o console para mais detalhes.');
    } finally {
      setIsSavingRole(false);
    }
  };
  
  const togglePermission = (permission: Permission) => {
    const currentPermissions = currentRole.permissions || [];
    
    // Atualizar as permissões no formato antigo (array de strings)
    if (currentPermissions.includes(permission)) {
      // Remover permissão
      setCurrentRole({
        ...currentRole,
        permissions: currentPermissions.filter(p => p !== permission)
      });
      
      // Também atualizar o novo formato
      const menus = { ...(currentRole.menus || createDefaultMenus()) };
      const pages = { ...(currentRole.pages || createDefaultPages()) };
      updatePermissionInNewFormat(permission, false, menus, pages);
      
      setCurrentRole(prev => ({
        ...prev,
        menus,
        pages
      }));
    } else {
      // Adicionar permissão
      setCurrentRole({
        ...currentRole,
        permissions: [...currentPermissions, permission]
      });
      
      // Também atualizar o novo formato
      const menus = { ...(currentRole.menus || createDefaultMenus()) };
      const pages = { ...(currentRole.pages || createDefaultPages()) };
      updatePermissionInNewFormat(permission, true, menus, pages);
      
      setCurrentRole(prev => ({
        ...prev,
        menus,
        pages
      }));
    }
  };
  
  // Função auxiliar para atualizar permissões no novo formato
  const updatePermissionInNewFormat = (permission: Permission, value: boolean, menus: RoleMenus, pages: RolePages) => {
    // Permissões de menu
    if (permission.startsWith('menu:')) {
      const menuKey = permission.replace('menu:', '');
      if (menuKey === 'dashboard') menus.dashboard = value;
      else if (menuKey === 'clients') menus.clients = value;
      else if (menuKey === 'proposals') menus.proposals = value;
      else if (menuKey === 'pipeline') menus.pipeline = value;
      else if (menuKey === 'teams') menus.teams = value;
      else if (menuKey === 'roles') menus.roles = value;
      else if (menuKey === 'users') menus.users = value;
      else if (menuKey === 'settings') menus.settings = value;
      else if (menuKey === 'webhooks') menus.webhooks = value;
      else if (menuKey === 'my_registration') menus.myRegistration = value;
    }
    
    // Dashboard
    else if (permission === 'view:own_dashboard' && value) {
      pages.dashboard.view = true;
      pages.dashboard.scope = 'own';
    } else if (permission === 'view:team_dashboard' && value) {
      pages.dashboard.view = true;
      pages.dashboard.scope = 'team';
    } else if (permission === 'view:all_dashboard' && value) {
      pages.dashboard.view = true;
      pages.dashboard.scope = 'all';
    }
    
    // Clientes
    else if (permission === 'view:own_clients' && value) {
      pages.clients.view = true;
      pages.clients.scope = 'own';
    } else if (permission === 'view:team_clients' && value) {
      pages.clients.view = true;
      pages.clients.scope = 'team';
    } else if (permission === 'view:all_clients' && value) {
      pages.clients.view = true;
      pages.clients.scope = 'all';
    } else if (permission === 'edit:clients') pages.clients.edit = value;
    else if (permission === 'delete:clients') pages.clients.delete = value;
    
    // Propostas
    else if (permission === 'view:own_proposals' && value) {
      pages.proposals.view = true;
      pages.proposals.scope = 'own';
    } else if (permission === 'view:team_proposals' && value) {
      pages.proposals.view = true;
      pages.proposals.scope = 'team';
    } else if (permission === 'view:all_proposals' && value) {
      pages.proposals.view = true;
      pages.proposals.scope = 'all';
    } else if (permission === 'edit:proposals') pages.proposals.edit = value;
    else if (permission === 'delete:proposals') pages.proposals.delete = value;
    else if (permission === 'approve:proposals') pages.proposals.approve = value;
    else if (permission === 'reject:proposals') pages.proposals.reject = value;
    
    // Pipeline
    else if (permission === 'view:own_pipeline' && value) {
      pages.pipeline.view = true;
      pages.pipeline.scope = 'own';
    } else if (permission === 'view:team_pipeline' && value) {
      pages.pipeline.view = true;
      pages.pipeline.scope = 'team';
    } else if (permission === 'view:all_pipeline' && value) {
      pages.pipeline.view = true;
      pages.pipeline.scope = 'all';
    } else if (permission === 'edit:pipeline') pages.pipeline.dragDrop = value;
    
    // Usuários
    else if (permission === 'view:users') pages.users.view = value;
    else if (permission === 'edit:users') pages.users.edit = value;
    else if (permission === 'delete:users') pages.users.delete = value;
    
    // Configurações
    else if (permission === 'view:settings') pages.settings.view = value;
    else if (permission === 'edit:settings') pages.settings.edit = value;
    
    // Webhooks
    else if (permission === 'view:webhooks') pages.webhooks.view = value;
    else if (permission === 'edit:webhooks') pages.webhooks.edit = value;
    
    // Meu Cadastro
    else if (permission === 'view:profile') pages.myRegistration.view = value;
    else if (permission === 'edit:profile') pages.myRegistration.edit = value;
    
    // Equipes
    else if (permission === 'view:teams') pages.teams.view = value;
    else if (permission === 'edit:teams') pages.teams.edit = value;
    else if (permission === 'delete:teams') pages.teams.delete = value;
    
    // Perfis
    else if (permission === 'view:roles') pages.roles.view = value;
    else if (permission === 'edit:roles') pages.roles.edit = value;
    else if (permission === 'delete:roles') pages.roles.delete = value;
  };
  
  // Agrupar permissões por categoria para exibição na interface
  const permissionsByCategory = availablePermissions.reduce<Record<string, PermissionOption[]>>((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-8 bg-black text-white">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-md">
        <h1 className="text-2xl font-bold text-white">Gerenciamento de Perfis</h1>
        {hasPermission('edit:roles') && (
          <button
            onClick={handleCreateRole}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <UserPlus className="mr-2" size={16} />
            Novo Perfil
          </button>
        )}
      </div>

      {/* Notificação de sucesso */}
      {showSuccessNotification && (
        <div className="bg-green-900 border-l-4 border-green-500 text-green-100 p-4 mb-4 rounded">
          <p>Operação realizada com sucesso!</p>
        </div>
      )}

      {/* Lista de perfis */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-gray-900 shadow-md rounded-lg overflow-hidden border border-gray-700">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Chave
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Permissões
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Última Atualização
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">{role.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-300">{role.key}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.isSystem ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-900 text-blue-100">
                        Sistema
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-100">
                        Personalizado
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-300">{role.permissions?.length || 0} permissões</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-300">
                      {role.updatedAt ? new Date(role.updatedAt).toLocaleDateString() : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {hasPermission('edit:roles') && (
                      <button
                        onClick={() => handleEditRole(role.id)}
                        className="text-blue-400 hover:text-blue-300 mr-3"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {hasPermission('delete:roles') && !role.isSystem && (
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Edição/Criação de Perfil */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-auto border border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-white">
                {isEditMode ? 'Editar Perfil' : 'Novo Perfil'}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nome do Perfil
                  </label>
                  <input
                    type="text"
                    value={currentRole.name}
                    onChange={(e) => setCurrentRole({ ...currentRole, name: e.target.value })}
                    className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                    disabled={currentRole.isSystem}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Chave do Perfil
                  </label>
                  <input
                    type="text"
                    value={currentRole.key}
                    onChange={(e) => setCurrentRole({ ...currentRole, key: e.target.value })}
                    className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                    disabled={currentRole.isSystem || isEditMode}
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold mb-2 text-white">Permissões</h3>
              
              <div className="mb-6 bg-gray-800 p-4 rounded-md border border-gray-700">
                {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-md font-medium mb-2 text-gray-300 border-b border-gray-700 pb-1">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {permissions.map((permission) => (
                        <div key={permission.key} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`permission-${permission.key}`}
                            checked={currentRole.permissions?.includes(permission.key) || false}
                            onChange={() => togglePermission(permission.key)}
                            className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 bg-gray-700 border-gray-600"
                          />
                          <label htmlFor={`permission-${permission.key}`} className="text-sm text-white">
                            {permission.description}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={isSavingRole}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-800 disabled:text-gray-300"
                >
                  {isSavingRole ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg w-full max-w-md border border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-white">Confirmar Exclusão</h2>
              <p className="mb-6 text-gray-300">Tem certeza que deseja excluir este perfil? Esta ação não pode ser desfeita.</p>
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-600 rounded-md text-gray-300 hover:bg-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteRole}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
