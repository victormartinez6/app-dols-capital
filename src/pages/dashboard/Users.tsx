import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, Search, X, Eye, Lock, Unlock } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { createUserWithRole, deleteUserDocument, updateUserBlockStatus, deleteAuthUser, disableAuthUser } from '../../services/UserService';

const userSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['client', 'manager', 'admin'], {
    required_error: 'Selecione um perfil',
  }),
});

type UserFormData = z.infer<typeof userSchema>;

interface User {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'manager' | 'admin';
  createdAt: any;
  createdBy: string;
  hasRegistration?: boolean;
  registrationType?: 'PF' | 'PJ';
  lastAccess?: any;
  blocked?: boolean;
}

const roleLabels = {
  client: 'Cliente',
  manager: 'Gerente',
  admin: 'Administrador',
};

const roleColors = {
  client: 'text-blue-400 bg-blue-400/10',
  manager: 'text-green-400 bg-green-400/10',
  admin: 'text-purple-400 bg-purple-400/10',
};

export default function Users() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToDeleteName, setUserToDeleteName] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [userToBlock, setUserToBlock] = useState<string | null>(null);
  const [userToBlockName, setUserToBlockName] = useState<string | null>(null);
  const [userBlockStatus, setUserBlockStatus] = useState(false);

  // Filtros
  const [nameFilter, setNameFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'manager' | 'admin'>('all');
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'yes' | 'no'>('all');
  
  // Estado para controlar se o acordeon de filtros está aberto ou fechado
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Função para alternar o estado do acordeon
  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, nameFilter, roleFilter, registrationFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(query(usersCollection));

      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        blocked: doc.data().blocked || false,
        lastAccess: doc.data().lastAccess || null
      })) as User[];

      setUsers(usersData);
      setFilteredUsers(usersData);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setError('Falha ao carregar usuários. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...users];

    // Filtro por nome
    if (nameFilter) {
      result = result.filter(user =>
        user.name?.toLowerCase().includes(nameFilter.toLowerCase()) ||
        user.email?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Filtro por perfil
    if (roleFilter !== 'all') {
      result = result.filter(user => user.role === roleFilter);
    }

    // Filtro por cadastro
    if (registrationFilter !== 'all') {
      if (registrationFilter === 'yes') {
        result = result.filter(user => user.hasRegistration === true);
      } else {
        result = result.filter(user => !user.hasRegistration);
      }
    }

    setFilteredUsers(result);
  };

  const resetFilters = () => {
    setNameFilter('');
    setRoleFilter('all');
    setRegistrationFilter('all');
  };

  const onSubmit = async (data: UserFormData) => {
    try {
      setError(null);
      setIsCreatingUser(true);

      // Verificar se o usuário atual é um administrador
      if (!currentUser || currentUser.role !== 'admin') {
        setError('Você não tem permissão para criar novos usuários.');
        setIsCreatingUser(false);
        return;
      }

      // Verificar se o e-mail já está em uso
      const usersRef = collection(db, 'users');
      const emailQuery = query(usersRef, where('email', '==', data.email));
      const emailSnapshot = await getDocs(emailQuery);

      if (!emailSnapshot.empty) {
        setError('Este e-mail já está em uso.');
        setIsCreatingUser(false);
        return;
      }

      try {
        // Criar usuário no Firebase Authentication e no Firestore
        await createUserWithRole({
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role
        }, currentUser.id);

        // Fechar o modal e limpar o formulário
        setIsModalOpen(false);
        reset();

        // Atualizar a lista de usuários
        fetchUsers();

        alert('Usuário criado com sucesso!');
      } catch (authError: any) {
        console.error('Erro ao criar usuário:', authError);
        if (authError.code === 'auth/email-already-in-use') {
          setError('Este e-mail já está em uso no Firebase Authentication.');
        } else {
          setError(`Erro ao criar usuário: ${authError.message}`);
        }
      }
    } catch (err: any) {
      console.error('Erro ao criar usuário:', err);
      setError('Erro ao criar usuário. Por favor, tente novamente.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    setUserToDelete(userId);
    setUserToDeleteName(userName);
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      // Excluir o documento do usuário no Firestore
      await deleteUserDocument(userToDelete);
      
      // Tentar excluir o usuário no Firebase Authentication (se existir)
      try {
        await deleteAuthUser(userToDelete);
        console.log('Usuário excluído do Firebase Authentication com sucesso');
      } catch (authError) {
        console.warn('Não foi possível excluir o usuário do Firebase Authentication:', authError);
        // Não interromper o fluxo se falhar no Firebase Authentication
      }
      
      // Atualizar a interface
      setUsers(prev => prev.filter(user => user.id !== userToDelete));
      setShowDeleteModal(false);
      setUserToDelete(null);
      setUserToDeleteName(null);
      
      alert('Usuário excluído com sucesso!');
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      setError('Falha ao excluir usuário. Por favor, tente novamente.');
    }
  };

  const handleViewUser = (userId: string) => {
    console.log('Visualizando usuário:', userId);
    navigate(`/users/detail/${userId}`);
  };

  const handleEditUser = (userId: string) => {
    console.log('Editando usuário:', userId);
    navigate(`/users/edit/${userId}`);
  };

  const handleBlockUser = (userId: string, userName: string, currentBlockStatus: boolean) => {
    setUserToBlock(userId);
    setUserToBlockName(userName);
    setUserBlockStatus(currentBlockStatus);
    setShowBlockModal(true);
  };

  const confirmBlockUser = async () => {
    if (!userToBlock) return;

    try {
      // Inverter o status de bloqueio
      const newBlockStatus = !userBlockStatus;

      // Atualizar o status de bloqueio no Firestore
      await updateUserBlockStatus(userToBlock, newBlockStatus);
      
      // Tentar desativar o usuário no Firebase Authentication (se existir)
      try {
        await disableAuthUser(userToBlock, newBlockStatus);
        console.log(`Usuário ${newBlockStatus ? 'bloqueado' : 'desbloqueado'} no Firebase Authentication com sucesso`);
      } catch (authError) {
        console.warn(`Não foi possível ${newBlockStatus ? 'bloquear' : 'desbloquear'} o usuário no Firebase Authentication:`, authError);
        // Não interromper o fluxo se falhar no Firebase Authentication
      }
      
      // Atualizar a interface
      setUsers(prev => prev.map(user =>
        user.id === userToBlock
          ? { ...user, blocked: newBlockStatus }
          : user
      ));

      setShowBlockModal(false);
      setUserToBlock(null);
      setUserToBlockName(null);
      
      alert(`Usuário ${newBlockStatus ? 'bloqueado' : 'desbloqueado'} com sucesso!`);
    } catch (err) {
      console.error('Erro ao alterar status de bloqueio do usuário:', err);
      setError('Falha ao alterar status de bloqueio. Por favor, tente novamente.');
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Não disponível';

    try {
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return format(timestamp.toDate(), 'dd/MM/yyyy', { locale: ptBR });
      }
      return 'Não disponível';
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Não disponível';
    }
  };

  return (
    <div className="dark-card rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Usuários</h2>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </button>
        )}
      </div>

      {/* Botão de Filtros */}
      <button
        onClick={toggleFilters}
        className="flex items-center justify-center w-full py-2 bg-black border border-gray-600 text-white rounded-lg mb-6"
      >
        {filtersOpen ? (
          <>
            <X className="h-4 w-4 mr-2" />
            Fechar Filtros
          </>
        ) : (
          <>
            <Search className="h-4 w-4 mr-2" />
            Abrir Filtros
          </>
        )}
      </button>

      {/* Filtros */}
      <div className={`bg-black border border-gray-700 rounded-lg p-4 space-y-4 mb-6 ${filtersOpen ? 'block' : 'hidden'}`}>
        <h3 className="text-lg font-medium text-white mb-2">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro por nome/email */}
          <div>
            <label htmlFor="nameFilter" className="block text-sm font-medium text-white mb-1">
              Nome do Usuário
            </label>
            <div className="relative">
              <input
                type="text"
                id="nameFilter"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Buscar por nome ou email..."
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Filtro por perfil */}
          <div>
            <label htmlFor="roleFilter" className="block text-sm font-medium text-white mb-1">
              Perfil
            </label>
            <select
              id="roleFilter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="client">Cliente</option>
              <option value="manager">Gerente</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {/* Filtro por cadastro */}
          <div>
            <label htmlFor="registrationFilter" className="block text-sm font-medium text-white mb-1">
              Cadastro
            </label>
            <select
              id="registrationFilter"
              value={registrationFilter}
              onChange={(e) => setRegistrationFilter(e.target.value as any)}
              className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="yes">Com Cadastro</option>
              <option value="no">Sem Cadastro</option>
            </select>
          </div>
        </div>

        {/* Botão para limpar filtros */}
        {(nameFilter || roleFilter !== 'all' || registrationFilter !== 'all') && (
          <button
            onClick={resetFilters}
            className="flex items-center text-sm text-white hover:text-blue-300"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-md mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-black border border-gray-700 rounded-lg p-8 text-center text-gray-400">
          Nenhum usuário encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Versão Desktop */}
          <div className="hidden md:block">
            <div className="bg-black border border-gray-700 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      E-mail
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Perfil
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Cadastro
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Criado em
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-black divide-y divide-gray-800">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{user.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                          {roleLabels[user.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {user.hasRegistration ? (
                            <span className="text-green-400">Sim ({user.registrationType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'})</span>
                          ) : (
                            <span className="text-gray-500">Não</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-300">{formatDate(user.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.blocked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
                            <Lock className="h-3 w-3 mr-1" />
                            Bloqueado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
                            <Unlock className="h-3 w-3 mr-1" />
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div className="flex justify-start space-x-4">
                          <button
                            onClick={() => handleViewUser(user.id)}
                            className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_4px_rgba(34,211,238,0.6)] transition-all"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditUser(user.id)}
                            className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleBlockUser(user.id, user.name, user.blocked || false)}
                            className={`${user.blocked ? 'text-green-400 hover:text-green-300 hover:drop-shadow-[0_0_4px_rgba(74,222,128,0.6)]' : 'text-orange-400 hover:text-orange-300 hover:drop-shadow-[0_0_4px_rgba(251,146,60,0.6)]'} transition-all`}
                            title={user.blocked ? "Desbloquear" : "Bloquear"}
                          >
                            {user.blocked ? (
                              <Unlock className="h-4 w-4" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            className="text-red-400 hover:text-red-300 hover:drop-shadow-[0_0_4px_rgba(248,113,113,0.6)] transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Versão Mobile - Cards */}
          <div className="md:hidden">
            <div className="divide-y divide-gray-800">
              {filteredUsers.map(user => (
                <div key={user.id} className="p-4 bg-black">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-medium text-white mb-1">{user.name}</div>
                      <div className="text-xs text-gray-400">
                        {user.email}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewUser(user.id)}
                        className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_4px_rgba(34,211,238,0.6)] transition-all"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user.id)}
                        className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Perfil</div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Cadastro</div>
                      <div className="text-sm">
                        {user.hasRegistration ? (
                          <span className="text-green-400">Sim ({user.registrationType === 'PF' ? 'PF' : 'PJ'})</span>
                        ) : (
                          <span className="text-gray-500">Não</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Criado em</div>
                      <div className="text-sm text-white">{formatDate(user.createdAt)}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Status</div>
                      {user.blocked ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-400/10 text-red-400">
                          <Lock className="h-3 w-3 mr-1" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-400/10 text-green-400">
                          <Unlock className="h-3 w-3 mr-1" />
                          Ativo
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-2 pt-2 border-t border-gray-800">
                    <button
                      onClick={() => handleBlockUser(user.id, user.name, user.blocked || false)}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        user.blocked 
                          ? 'bg-green-400/10 text-green-400 hover:bg-green-400/20' 
                          : 'bg-orange-400/10 text-orange-400 hover:bg-orange-400/20'
                      }`}
                    >
                      {user.blocked ? (
                        <span className="flex items-center">
                          <Unlock className="h-3 w-3 mr-1" />
                          Desbloquear
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Lock className="h-3 w-3 mr-1" />
                          Bloquear
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id, user.name)}
                      className="px-3 py-1 rounded-md bg-red-400/10 text-red-400 hover:bg-red-400/20 text-xs font-medium"
                    >
                      <span className="flex items-center">
                        <Trash2 className="h-3 w-3 mr-1" />
                        Excluir
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {/* Modal de Novo Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-medium text-white">
                Novo Usuário
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-md text-red-500 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    {...register('password')}
                    className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-white mb-1">
                    Perfil
                  </label>
                  <select
                    {...register('role')}
                    className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Selecione um perfil</option>
                    <option value="client">Cliente</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Administrador</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-500">{errors.role.message}</p>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingUser}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingUser ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Criando...
                      </div>
                    ) : 'Criar Usuário'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-medium text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir o usuário <span className="font-medium text-white">{userToDeleteName}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                  setUserToDeleteName(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Bloqueio/Desbloqueio */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-md p-6">
            <h3 className="text-lg font-medium text-white mb-4">
              {userBlockStatus ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
            </h3>
            <p className="text-gray-300 mb-6">
              {userBlockStatus
                ? `Tem certeza que deseja desbloquear o usuário ${userToBlockName}? Ele poderá acessar o sistema novamente.`
                : `Tem certeza que deseja bloquear o usuário ${userToBlockName}? Ele não poderá mais acessar o sistema.`}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setUserToBlock(null);
                  setUserToBlockName(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmBlockUser}
                className={`px-4 py-2 ${userBlockStatus ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-md`}
              >
                {userBlockStatus ? 'Desbloquear' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}