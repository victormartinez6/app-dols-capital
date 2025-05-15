import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, addDoc, updateDoc, getDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Pencil, Trash2, Plus, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { Team, User } from '../../types';

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<Partial<Team>>({
    name: '',
    managerId: '',
    members: [],
    teamCode: ''
  });
  const [managers, setManagers] = useState<User[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [teamForMembers, setTeamForMembers] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const { canPerformAction } = useRolePermissions();

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const teamsCollection = collection(db, 'teams');
      const querySnapshot = await getDocs(teamsCollection);
      
      const teamsData = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        
        // Buscar informações do gerente
        let managerName = 'Não atribuído';
        if (data.managerId) {
          const managerDoc = await getDoc(doc(db, 'users', data.managerId));
          if (managerDoc.exists()) {
            managerName = managerDoc.data().name || 'Não atribuído';
          }
        }
        
        // Buscar informações dos membros
        const membersCount = data.members?.length || 0;
        
        return {
          id: docSnapshot.id,
          name: data.name || '',
          managerId: data.managerId || '',
          managerName,
          members: data.members || [],
          membersCount,
          createdAt: data.createdAt?.toDate() || new Date(),
          teamCode: data.teamCode || ''
        } as Team & { managerName: string, membersCount: number };
      }));
      
      setTeams(teamsData);
    } catch (error) {
      console.error('Erro ao buscar equipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Buscar todos os usuários
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as User[];
      
      // Buscar perfis para verificar permissões
      const rolesCollection = collection(db, 'roles');
      const rolesSnapshot = await getDocs(rolesCollection);
      const rolesData = rolesSnapshot.docs.reduce((acc, doc) => {
        const roleData = doc.data();
        acc[roleData.key] = {
          id: doc.id,
          ...roleData
        };
        return acc;
      }, {} as Record<string, any>);
      
      console.log('Perfis carregados:', rolesData);
      
      // Filtrar gerentes e clientes com base nas permissões dinâmicas
      const managersData = usersData.filter(user => {
        // Verificar se o usuário tem permissões de gerente
        const userRole = user.roleKey;
        if (!userRole) return false;
        
        // Verificar se o email é do administrador principal
        if (user.email === 'victor@cambiohoje.com.br') return true;
        
        // Verificar se o perfil existe
        const roleInfo = rolesData[userRole];
        if (!roleInfo) return false;
        
        // Verificar se o perfil tem permissões de gerente
        const permissions = roleInfo.permissions || [];
        return permissions.some((p: string) => 
          p === 'view:team_clients' || 
          p === 'view:team_proposals' || 
          p === 'menu:clients'
        );
      });
      
      const clientsData = usersData.filter(user => {
        // Verificar se o usuário tem permissões de cliente
        const userRole = user.roleKey;
        if (!userRole) return false;
        
        // Verificar se o perfil existe
        const roleInfo = rolesData[userRole];
        if (!roleInfo) return userRole === 'client'; // Fallback para roleKey 'client' se o perfil não for encontrado
        
        // Verificar se o perfil tem permissões de cliente
        const permissions = roleInfo.permissions || [];
        return permissions.some((p: string) => 
          p === 'view:own_dashboard' || 
          p === 'view:own_proposals' || 
          p === 'menu:my_registration'
        ) && !permissions.some((p: string) => 
          p === 'view:team_clients' || 
          p === 'view:all_clients'
        );
      });
      
      console.log('Gerentes filtrados por permissões:', managersData);
      console.log('Clientes filtrados por permissões:', clientsData);
      
      setManagers(managersData);
      setMembers(clientsData);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleCreateTeam = () => {
    setIsEditMode(false);
    setCurrentTeam({
      name: '',
      managerId: '',
      members: [],
      teamCode: ''
    });
    setSelectedMembers([]);
    setShowTeamModal(true);
  };

  const handleEditTeam = async (teamId: string) => {
    try {
      const teamDoc = await getDoc(doc(db, 'teams', teamId));
      if (teamDoc.exists()) {
        const teamData = teamDoc.data() as Team;
        setCurrentTeam({
          id: teamId,
          name: teamData.name,
          managerId: teamData.managerId,
          members: teamData.members || [],
          teamCode: teamData.teamCode || ''
        });
        setSelectedMembers(teamData.members || []);
        setIsEditMode(true);
        setShowTeamModal(true);
      }
    } catch (error) {
      console.error('Erro ao buscar equipe para edição:', error);
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'teams', teamToDelete));
      
      // Remover a equipe dos usuários associados
      const usersToUpdate = [...managers, ...members].filter(user => user.team === teamToDelete);
      
      for (const user of usersToUpdate) {
        await updateDoc(doc(db, 'users', user.id), {
          team: null
        });
      }
      
      setTeams(teams.filter(team => team.id !== teamToDelete));
      setShowDeleteModal(false);
      setTeamToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir equipe:', error);
    }
  };

  const handleSaveTeam = async () => {
    if (!currentTeam.name) {
      alert('Por favor, informe o nome da equipe.');
      return;
    }

    try {
      // Buscar o nome do gerente se temos um managerId
      let managerName = '';
      if (currentTeam.managerId) {
        try {
          const managerDoc = await getDoc(doc(db, 'users', currentTeam.managerId));
          if (managerDoc.exists()) {
            managerName = managerDoc.data().name || managerDoc.data().displayName || '';
          }
        } catch (error) {
          console.error('Erro ao buscar informações do gerente:', error);
        }
      }
      
      if (isEditMode && currentTeam.id) {
        // Atualizar equipe existente
        await updateDoc(doc(db, 'teams', currentTeam.id), {
          name: currentTeam.name,
          managerId: currentTeam.managerId,
          managerName: managerName, // Salvar o nome do gerente
          members: selectedMembers,
          teamCode: currentTeam.teamCode
        });
        
        // Atualizar o campo team dos usuários
        // 1. Adicionar a equipe para novos membros
        for (const memberId of selectedMembers) {
          await updateDoc(doc(db, 'users', memberId), {
            team: currentTeam.id
          });
        }
        
        // 2. Remover a equipe de membros que foram removidos
        const removedMembers = (currentTeam.members || []).filter(
          memberId => !selectedMembers.includes(memberId)
        );
        
        for (const memberId of removedMembers) {
          await updateDoc(doc(db, 'users', memberId), {
            team: null
          });
        }
        
        // 3. Atualizar o gerente
        if (currentTeam.managerId) {
          await updateDoc(doc(db, 'users', currentTeam.managerId), {
            team: currentTeam.id
          });
        }
      } else {
        // Criar nova equipe
        const newTeamRef = await addDoc(collection(db, 'teams'), {
          name: currentTeam.name,
          managerId: currentTeam.managerId,
          managerName: managerName, // Salvar o nome do gerente
          members: selectedMembers,
          teamCode: currentTeam.teamCode,
          createdAt: serverTimestamp()
        });
        
        // Atualizar o campo team dos usuários
        for (const memberId of selectedMembers) {
          await updateDoc(doc(db, 'users', memberId), {
            team: newTeamRef.id
          });
        }
        
        // Atualizar o gerente
        if (currentTeam.managerId) {
          await updateDoc(doc(db, 'users', currentTeam.managerId), {
            team: newTeamRef.id
          });
        }
      }
      
      setShowTeamModal(false);
      fetchTeams(); // Recarregar a lista de equipes
    } catch (error) {
      console.error('Erro ao salvar equipe:', error);
    }
  };

  const handleManageMembers = (teamId: string) => {
    setTeamForMembers(teamId);
    const team = teams.find(t => t.id === teamId);
    if (team) {
      setSelectedMembers(team.members || []);
    }
    setShowMembersModal(true);
  };

  const handleSaveMembers = async () => {
    if (!teamForMembers) return;
    
    try {
      const currentTeam = teams.find(t => t.id === teamForMembers);
      if (!currentTeam) return;
      
      // Verificar se temos o nome do gerente, se não, buscar do banco de dados
      let managerName = currentTeam.managerName || '';
      if (currentTeam.managerId && !managerName) {
        try {
          const managerDoc = await getDoc(doc(db, 'users', currentTeam.managerId));
          if (managerDoc.exists()) {
            managerName = managerDoc.data().name || managerDoc.data().displayName || '';
          }
        } catch (error) {
          console.error('Erro ao buscar informações do gerente:', error);
        }
      }
      
      // Atualizar a equipe com os novos membros e garantir que o nome do gerente seja mantido
      await updateDoc(doc(db, 'teams', teamForMembers), {
        members: selectedMembers,
        managerName: managerName // Garantir que o nome do gerente seja mantido
      });
      
      // Atualizar o campo team dos usuários
      // 1. Adicionar a equipe para novos membros
      for (const memberId of selectedMembers) {
        await updateDoc(doc(db, 'users', memberId), {
          team: teamForMembers
        });
      }
      
      // 2. Remover a equipe de membros que foram removidos
      const removedMembers = (currentTeam.members || []).filter(
        (memberId: string) => !selectedMembers.includes(memberId)
      );
      
      for (const memberId of removedMembers) {
        await updateDoc(doc(db, 'users', memberId), {
          team: null
        });
      }
      
      setShowMembersModal(false);
      setTeamForMembers(null);
      fetchTeams(); // Recarregar a lista de equipes
    } catch (error) {
      console.error('Erro ao salvar membros:', error);
    }
  };

  const formatDate = (date: Date) => {
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  // Adicionar verificação para garantir que as propriedades existam
  const filteredMembers = members.filter(member => 
    (member.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (member.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const generateTeamCode = async () => {
    setIsGeneratingCode(true);
    try {
      // Gerar um código aleatório de 4 dígitos
      const newCode = Math.floor(1000 + Math.random() * 9000).toString();
      
      // Verificar se o código já existe
      const teamsRef = collection(db, 'teams');
      const q = query(teamsRef, where('teamCode', '==', newCode));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Código é único, pode usar
        setCurrentTeam({ ...currentTeam, teamCode: newCode });
      } else {
        // Código já existe, gerar outro
        generateTeamCode();
      }
    } catch (error) {
      console.error('Erro ao gerar código da equipe:', error);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-semibold text-white">Gerenciamento de Equipes</h2>
        {canPerformAction('teams', 'edit') && (
          <button
            onClick={handleCreateTeam}
            className="flex items-center px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 w-full sm:w-auto justify-center sm:justify-start"
          >
            <Plus size={16} className="mr-2" />
            Nova Equipe
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-black border border-gray-700 rounded-lg">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Nome da Equipe
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Gerente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Código da Equipe
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Membros
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Data de Criação
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-white">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                </td>
              </tr>
            ) : teams.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-white">
                  Nenhuma equipe encontrada
                </td>
              </tr>
            ) : (
              teams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-900">
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {team.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {team.managerName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    <span 
                      className="px-2 py-1 text-xs font-medium rounded-md bg-blue-900 text-blue-200 cursor-help"
                      title={`Equipe: ${team.name}`}
                    >
                      {team.teamCode || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    <div className="flex items-center">
                      <span className="mr-2">{team.membersCount}</span>
                      {canPerformAction('teams', 'edit') && (
                        <button
                          onClick={() => handleManageMembers(team.id)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Gerenciar Membros"
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {formatDate(team.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2">
                      {canPerformAction('teams', 'edit') && (
                        <button
                          onClick={() => handleEditTeam(team.id)}
                          className="text-yellow-400 hover:text-yellow-300"
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      {canPerformAction('teams', 'delete') && (
                        <button
                          onClick={() => {
                            setTeamToDelete(team.id);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-400 hover:text-red-300"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir esta equipe? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTeamToDelete(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTeam}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação/Edição de Equipe */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              {isEditMode ? 'Editar Equipe' : 'Nova Equipe'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="teamName" className="block text-sm font-medium text-white mb-1">
                  Nome da Equipe
                </label>
                <input
                  type="text"
                  id="teamName"
                  value={currentTeam.name}
                  onChange={(e) => setCurrentTeam({ ...currentTeam, name: e.target.value })}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Digite o nome da equipe"
                />
              </div>
              
              <div>
                <label htmlFor="teamManager" className="block text-sm font-medium text-white mb-1">
                  Gerente Responsável
                </label>
                <select
                  id="teamManager"
                  value={currentTeam.managerId || ''}
                  onChange={(e) => setCurrentTeam({ ...currentTeam, managerId: e.target.value })}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Selecione um gerente</option>
                  {managers.map(manager => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Código da Equipe (4 dígitos)
                </label>
                <div className="flex space-x-2">
                  <input
                    id="teamCode"
                    type="text"
                    value={currentTeam.teamCode || ''}
                    onChange={(e) => {
                      // Permitir apenas números e limitar a 4 dígitos
                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setCurrentTeam({ ...currentTeam, teamCode: value });
                    }}
                    className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Código de 4 dígitos"
                    maxLength={4}
                  />
                  <button
                    type="button"
                    onClick={generateTeamCode}
                    disabled={isGeneratingCode}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    title="Gerar novo código"
                  >
                    {isGeneratingCode ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      "Gerar"
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Este código será usado pelos clientes para se vincularem à equipe durante o cadastro.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Membros da Equipe
                </label>
                <div className="bg-black border border-gray-700 rounded-md p-3 max-h-60 overflow-y-auto">
                  <div className="mb-3">
                    <input
                      type="text"
                      placeholder="Buscar membros..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-gray-800 border border-gray-600 text-white rounded-md w-full px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  {filteredMembers.length === 0 ? (
                    <p className="text-gray-400 text-sm">Nenhum membro encontrado</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredMembers.map(member => (
                        <div key={member.id} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`member-${member.id}`}
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => toggleMemberSelection(member.id)}
                            className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 bg-gray-700 border-gray-600"
                          />
                          <label htmlFor={`member-${member.id}`} className="text-white text-sm">
                            {member.name} ({member.email})
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {selectedMembers.length} membro(s) selecionado(s)
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowTeamModal(false);
                  setCurrentTeam({ name: '', managerId: '', members: [], teamCode: '' });
                  setSelectedMembers([]);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTeam}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Membros */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">
              Gerenciar Membros da Equipe
            </h3>
            
            <div className="mb-3">
              <input
                type="text"
                placeholder="Buscar membros..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="bg-black border border-gray-700 rounded-md p-3 max-h-60 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <p className="text-gray-400">Nenhum membro encontrado</p>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map(member => (
                    <div key={member.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`member-modal-${member.id}`}
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMemberSelection(member.id)}
                        className="mr-2 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 bg-gray-700 border-gray-600"
                      />
                      <label htmlFor={`member-modal-${member.id}`} className="text-white">
                        {member.name} ({member.email})
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <p className="text-sm text-gray-400 mt-1">
              {selectedMembers.length} membro(s) selecionado(s)
            </p>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowMembersModal(false);
                  setTeamForMembers(null);
                  setSelectedMembers([]);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMembers}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
