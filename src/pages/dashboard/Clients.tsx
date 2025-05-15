import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { Eye, Pencil, AlertCircle, CheckCircle2, Trash2, Building2, User, Search, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Registration {
  id: string;
  type: 'PF' | 'PJ';
  name?: string;
  companyName?: string;
  email?: string;
  partnerEmail?: string;
  createdAt: Date;
  status: 'complete' | 'documents_pending';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract';
  userId: string;
  createdBy?: string;
  inviterUserId?: string;
  teamName?: string;
  teamId?: string;
  documents?: Record<string, any>;
  pendencies?: Array<{
    message: string;
    createdAt: Date;
    resolved?: boolean;
    resolvedAt?: Date;
  }>;
}

const pipelineStatusLabels = {
  submitted: 'Cadastro Enviado',
  pre_analysis: 'Pré-Análise',
  credit: 'Crédito',
  legal: 'Jurídico/Imóvel',
  contract: 'Em Contrato',
};

const pipelineStatusColors = {
  submitted: 'text-blue-400 bg-blue-400/10',
  pre_analysis: 'text-yellow-400 bg-yellow-400/10',
  credit: 'text-green-400 bg-green-400/10',
  legal: 'text-purple-400 bg-purple-400/10',
  contract: 'text-orange-400 bg-orange-400/10',
};

const registrationStatusLabels = {
  complete: 'Cadastro Completo',
  documents_pending: 'Cadastro com Pendência',
};

const registrationStatusColors = {
  complete: 'text-green-400 bg-green-400/10',
  documents_pending: 'text-red-400 bg-red-400/10',
};

// Função auxiliar para formatar datas do Firestore de forma segura
const formatFirestoreDate = (date: any): string => {
  if (date instanceof Date) {
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  }
  
  if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
    return format(date.toDate(), 'dd/MM/yyyy', { locale: ptBR });
  }
  
  return 'Data desconhecida';
};

export default function Clients() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameFilter, setNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'PF' | 'PJ'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'documents_pending'>('all');
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState<'all' | 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [registrationToDelete, setRegistrationToDelete] = useState<string | null>(null);
  const [showPendencyModal, setShowPendencyModal] = useState(false);
  const [registrationForPendency, setRegistrationForPendency] = useState<string | null>(null);
  const [pendencyMessage, setPendencyMessage] = useState('');
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [clientToChangeStatus, setClientToChangeStatus] = useState<string | null>(null);
  const [pipelineCarouselIndexes, setPipelineCarouselIndexes] = useState<Record<string, number>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchRegistrations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [registrations, nameFilter, typeFilter, statusFilter, pipelineStatusFilter]);

  useEffect(() => {
    if (registrations.length > 0) {
      const initialIndexes: Record<string, number> = {};
      registrations.forEach(reg => {
        // Define o índice inicial com base no status do pipeline
        const pipelineStages = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract'];
        const currentStageIndex = pipelineStages.indexOf(reg.pipelineStatus);
        initialIndexes[reg.id] = currentStageIndex >= 0 ? currentStageIndex : 0;
      });
      setPipelineCarouselIndexes(initialIndexes);
    }
  }, [registrations]);

  const navigateCarousel = (registrationId: string, direction: 'prev' | 'next') => {
    setPipelineCarouselIndexes(prev => {
      const currentIndex = prev[registrationId] || 0;
      const newIndex = direction === 'next' 
        ? (currentIndex + 1) % 5 
        : (currentIndex - 1 + 5) % 5;
      return { ...prev, [registrationId]: newIndex };
    });
  };

  const pipelineStages = [
    { key: 'submitted', label: 'Cadastro', color: 'text-blue-400', bgColor: 'bg-blue-400' },
    { key: 'pre_analysis', label: 'Pré-Análise', color: 'text-yellow-400', bgColor: 'bg-yellow-400' },
    { key: 'credit', label: 'Crédito', color: 'text-green-400', bgColor: 'bg-green-400' },
    { key: 'legal', label: 'Jurídico', color: 'text-purple-400', bgColor: 'bg-purple-400' },
    { key: 'contract', label: 'Contrato', color: 'text-pink-400', bgColor: 'bg-pink-400' }
  ];

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'registrations'));
      const querySnapshot = await getDocs(q);
      
      // Buscar todas as propostas para determinar o status do pipeline correto
      const proposalsRef = collection(db, 'proposals');
      const proposalsSnap = await getDocs(proposalsRef);
      const proposals = proposalsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        clientId: doc.data().clientId || doc.data().userId,
        pipelineStatus: doc.data().pipelineStatus
      }));
      
      // Criar um mapa de clientId -> pipelineStatus mais avançado
      const clientPipelineStatus: Record<string, string> = {};
      proposals.forEach(proposal => {
        if (!proposal.clientId || !proposal.pipelineStatus) return;
        
        // Se o cliente já tem um status e este é mais avançado, não atualizar
        const currentStatus = clientPipelineStatus[proposal.clientId];
        const statusOrder = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract'];
        
        if (!currentStatus || 
            statusOrder.indexOf(proposal.pipelineStatus) > statusOrder.indexOf(currentStatus)) {
          clientPipelineStatus[proposal.clientId] = proposal.pipelineStatus;
        }
      });
      
      let registrationsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Verificar se tem documentos anexados
        const hasDocuments = data.documents && Object.keys(data.documents).length > 0;
        // Atualizar o status com base na presença de documentos
        const status = hasDocuments ? 'complete' : 'documents_pending';
        
        // Determinar o status do pipeline correto
        let pipelineStatus = data.pipelineStatus;
        
        // Se houver um status mais avançado nas propostas, usar esse
        if (clientPipelineStatus[doc.id] || clientPipelineStatus[data.userId]) {
          pipelineStatus = clientPipelineStatus[doc.id] || 
                           clientPipelineStatus[data.userId];
        }
        
        // Se não houver status definido, usar 'submitted' como padrão
        if (!pipelineStatus) {
          pipelineStatus = 'submitted';
        }
        
        return {
          id: doc.id,
          ...data,
          status,
          pipelineStatus,
          createdAt: data.createdAt?.toDate() || new Date(),
          pendencies: data.pendencies ? data.pendencies.map((p: any) => ({
            ...p,
            createdAt: p.createdAt?.toDate() || new Date(),
            resolvedAt: p.resolvedAt?.toDate() || undefined,
          })) : [],
        };
      }) as Registration[];
      
      // Filtrar registros com base no papel do usuário
      if (user?.roleKey === 'partner') {
        // Para parceiros, mostrar apenas os clientes criados pelo usuário e os que têm o inviterUserId
        registrationsData = registrationsData.filter(reg => 
          reg.userId === user.id || 
          reg.createdBy === user.id || 
          reg.createdBy === user.email || 
          reg.partnerEmail === user.email ||
          reg.inviterUserId === user.id
        );
      } else if (user?.roleKey === 'manager') {
        // Para gerentes, mostrar apenas os clientes criados pelo gerente
        // e os clientes vinculados à equipe dele
        const teamId = user?.team;
        
        // Primeiro, filtramos os clientes criados pelo gerente
        const managerClients = registrationsData.filter(reg => 
          reg.userId === user.id || 
          reg.createdBy === user.id || 
          reg.createdBy === user.email ||
          reg.inviterUserId === user.id
        );
        
        // Se o gerente tem uma equipe, vamos buscar os clientes dos membros da equipe
        if (teamId) {
          // Buscar informações da equipe para obter os membros
          const fetchTeamMembers = async () => {
            try {
              const teamDoc = await getDoc(doc(db, 'teams', teamId));
              if (teamDoc.exists()) {
                const teamData = teamDoc.data();
                const teamMembers = teamData.members || [];
                
                // Buscar os usuários que são membros da equipe
                const teamMemberClients = registrationsData.filter(reg => {
                  // Verificar se o cliente foi criado por algum membro da equipe
                  // ou se o cliente está vinculado à equipe pelo teamName
                  return teamMembers.includes(reg.userId) || 
                         teamMembers.includes(reg.createdBy) || 
                         reg.teamName === teamData.name || 
                         reg.teamId === teamId;
                });
                
                // Combinar os clientes do gerente com os clientes da equipe
                const uniqueClients = [...new Set([...managerClients, ...teamMemberClients])];
                setRegistrations(uniqueClients);
                setFilteredRegistrations(uniqueClients);
                return;
              }
            } catch (error) {
              console.error('Erro ao buscar membros da equipe:', error);
            }
            
            // Se não conseguir buscar a equipe ou não houver membros, mostrar apenas os clientes do gerente
            setRegistrations(managerClients);
            setFilteredRegistrations(managerClients);
          };
          
          fetchTeamMembers();
          return; // Retornar aqui porque o setRegistrations será chamado dentro da função fetchTeamMembers
        }
        
        // Se o gerente não tem equipe, mostrar apenas os clientes criados por ele
        registrationsData = managerClients;
      }

      setRegistrations(registrationsData);
      setFilteredRegistrations(registrationsData);
    } catch (error) {
      console.error('Erro ao buscar registros:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...registrations];
    
    // Filtro por nome
    if (nameFilter) {
      result = result.filter(reg => {
        const clientName = reg.type === 'PJ' ? reg.companyName : reg.name;
        return clientName?.toLowerCase().includes(nameFilter.toLowerCase());
      });
    }
    
    // Filtro por tipo
    if (typeFilter !== 'all') {
      result = result.filter(reg => reg.type === typeFilter);
    }
    
    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(reg => reg.status === statusFilter);
    }
    
    // Filtro por status do pipeline
    if (pipelineStatusFilter !== 'all') {
      result = result.filter(reg => reg.pipelineStatus === pipelineStatusFilter);
    }
    
    setFilteredRegistrations(result);
  };

  const handleDeleteRegistration = async () => {
    if (!registrationToDelete) return;
    
    try {
      // Excluir o documento de registro
      await deleteDoc(doc(db, 'registrations', registrationToDelete));
      
      // Verificar se o documento de usuário existe antes de tentar atualizá-lo
      const userDocRef = doc(db, 'users', registrationToDelete);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        // Atualizar o usuário para remover a flag de registro apenas se o documento existir
        await updateDoc(userDocRef, {
          hasRegistration: false,
          registrationType: null
        });
      }
      
      // Atualizar a lista local
      setRegistrations(prev => prev.filter(reg => reg.id !== registrationToDelete));
      setShowDeleteModal(false);
      setRegistrationToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
    }
  };

  const handleViewRegistration = (registrationId: string) => {
    navigate(`/clients/detail/${registrationId}`);
  };

  const handleEditRegistration = (registration: Registration) => {
    console.log('Editando cliente:', registration.id, 'Tipo:', registration.type);
    
    // Verificar o tipo de cliente e redirecionar para o formulário correto
    let path;
    if (registration.type === 'PF') {
      path = `/register/individual/${registration.id}`;
      console.log('Redirecionando para formulário individual:', path);
    } else if (registration.type === 'PJ') {
      path = `/register/company/${registration.id}`;
      console.log('Redirecionando para formulário de empresa:', path);
    } else {
      console.error('Tipo de cliente desconhecido:', registration.type);
      return;
    }
    
    navigate(path);
  };

  const handleGeneratePendency = (registrationId: string) => {
    setRegistrationForPendency(registrationId);
    setPendencyMessage('');
    setShowPendencyModal(true);
  };

  const handleResolvePendency = async (registrationId: string) => {
    try {
      const registration = registrations.find(r => r.id === registrationId);
      if (!registration) return;
      
      // Encontrar a pendência mais recente não resolvida
      const pendencies = registration.pendencies || [];
      const pendencyIndex = pendencies.findIndex(p => !p.resolved);
      
      if (pendencyIndex === -1) return;
      
      // Criar uma cópia atualizada das pendências
      const updatedPendencies = [...pendencies];
      updatedPendencies[pendencyIndex] = {
        ...updatedPendencies[pendencyIndex],
        resolved: true,
        resolvedAt: new Date()
      };
      
      // Atualizar no Firestore
      const registrationRef = doc(db, 'registrations', registrationId);
      
      // Obter o status anterior para o webhook
      const clientDoc = await getDoc(registrationRef);
      const previousStatus = clientDoc.exists() ? clientDoc.data().status : null;
      
      await updateDoc(registrationRef, {
        pendencies: updatedPendencies,
        status: 'complete'
      });
      
      // Obter os dados atualizados do cliente para o webhook
      const updatedClientDoc = await getDoc(registrationRef);
      
      if (updatedClientDoc.exists()) {
        const clientData = {
          id: registrationId,
          ...updatedClientDoc.data()
        };
        
        // Enviar webhook de alteração de status
        if (previousStatus && previousStatus !== 'complete') {
          // Importar o serviço de webhook
          const { webhookService } = await import('../../services/WebhookService');
          await webhookService.sendClientStatusChanged(clientData, previousStatus);
        }
      }
      
      // Atualizar a lista local
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { 
                ...reg, 
                status: 'complete',
                pendencies: updatedPendencies
              } 
            : reg
        )
      );
    } catch (error) {
      console.error('Erro ao resolver pendência:', error);
    }
  };

  const handleSubmitPendency = async () => {
    if (!registrationForPendency || !pendencyMessage.trim()) return;
    
    try {
      const newPendency = {
        message: pendencyMessage.trim(),
        createdAt: new Date(),
        resolved: false
      };
      
      const registrationRef = doc(db, 'registrations', registrationForPendency);
      
      // Obter o status anterior para o webhook
      const clientDoc = await getDoc(registrationRef);
      const previousStatus = clientDoc.exists() ? clientDoc.data().status : null;
      
      // Adicionar a nova pendência ao array
      await updateDoc(registrationRef, {
        pendencies: arrayUnion(newPendency),
        status: 'documents_pending'
      });
      
      // Obter os dados atualizados do cliente para o webhook
      const updatedClientDoc = await getDoc(registrationRef);
      
      if (updatedClientDoc.exists()) {
        const clientData = {
          id: registrationForPendency,
          ...updatedClientDoc.data()
        };
        
        // Enviar webhook de alteração de status
        if (previousStatus && previousStatus !== 'documents_pending') {
          // Importar o serviço de webhook
          const { webhookService } = await import('../../services/WebhookService');
          await webhookService.sendClientStatusChanged(clientData, previousStatus);
        }
      }
      
      // Atualizar a lista local
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationForPendency 
            ? { 
                ...reg, 
                status: 'documents_pending',
                pendencies: [...(reg.pendencies || []), newPendency]
              } 
            : reg
        )
      );
      
      setShowPendencyModal(false);
      setRegistrationForPendency(null);
      setPendencyMessage('');
    } catch (error) {
      console.error('Erro ao gerar pendência:', error);
    }
  };

  const resetFilters = () => {
    setNameFilter('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPipelineStatusFilter('all');
  };

  const handleCreateNewClient = (type: 'PF' | 'PJ') => {
    setShowNewClientModal(false);
    navigate(`/register/${type === 'PF' ? 'individual' : 'company'}`);
  };

  const updateClientStatus = async (status: Registration['status']) => {
    if (!clientToChangeStatus) return;
    
    try {
      const clientRef = doc(db, 'registrations', clientToChangeStatus);
      
      // Obter o status anterior para o webhook
      const clientDoc = await getDoc(clientRef);
      const previousStatus = clientDoc.exists() ? clientDoc.data().status : null;
      
      // Atualizar o status no banco de dados
      await updateDoc(clientRef, {
        status: status
      });
      
      // Obter os dados atualizados do cliente para o webhook
      const updatedClientDoc = await getDoc(clientRef);
      
      if (updatedClientDoc.exists()) {
        const clientData = {
          id: clientToChangeStatus,
          ...updatedClientDoc.data()
        };
        
        // Enviar webhook de alteração de status
        if (previousStatus && previousStatus !== status) {
          // Importar o serviço de webhook
          const { webhookService } = await import('../../services/WebhookService');
          await webhookService.sendClientStatusChanged(clientData, previousStatus);
        }
      }
      
      // Atualizar a lista de clientes
      fetchRegistrations();
      
      // Fechar o modal
      setShowStatusModal(false);
      setClientToChangeStatus(null);
    } catch (error) {
      console.error('Erro ao atualizar status do cliente:', error);
    }
  };

  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-semibold text-white">Clientes</h2>
        <button
          onClick={() => setShowNewClientModal(true)}
          className="flex items-center px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 w-full sm:w-auto justify-center sm:justify-start"
        >
          <Plus size={16} className="mr-2" />
          Novo Cliente
        </button>
      </div>

      {/* Filtros */}
      <button
        onClick={toggleFilters}
        className="flex items-center justify-center w-full py-2 bg-black border border-gray-600 text-white rounded-lg mb-6"
      >
        {filtersOpen ? (
          <X className="h-4 w-4 mr-1" />
        ) : (
          <Search className="h-4 w-4 mr-1" />
        )}
        <span>{filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
      </button>

      {filtersOpen && (
        <div className="bg-black border border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-lg font-medium text-white mb-2">Filtros</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro por nome */}
            <div>
              <label htmlFor="nameFilter" className="block text-sm font-medium text-white mb-1">
                Nome
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="nameFilter"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Buscar por nome..."
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            {/* Filtro por tipo */}
            <div>
              <label htmlFor="typeFilter" className="block text-sm font-medium text-white mb-1">
                Tipo
              </label>
              <select
                id="typeFilter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
            
            {/* Filtro por status */}
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-white mb-1">
                Status
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="complete">Cadastro Completo</option>
                <option value="documents_pending">Cadastro com Pendência</option>
              </select>
            </div>
            
            {/* Filtro por status do pipeline */}
            <div>
              <label htmlFor="pipelineStatusFilter" className="block text-sm font-medium text-white mb-1">
                Status do Pipeline
              </label>
              <select
                id="pipelineStatusFilter"
                value={pipelineStatusFilter}
                onChange={(e) => setPipelineStatusFilter(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="submitted">Cadastro Enviado</option>
                <option value="pre_analysis">Pré-Análise</option>
                <option value="credit">Crédito</option>
                <option value="legal">Jurídico/Imóvel</option>
                <option value="contract">Em Contrato</option>
              </select>
            </div>
          </div>
          
          {/* Botão para limpar filtros */}
          {(nameFilter || typeFilter !== 'all' || statusFilter !== 'all' || pipelineStatusFilter !== 'all') && (
            <button
              onClick={resetFilters}
              className="flex items-center text-sm text-white hover:text-blue-300"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </button>
          )}
        </div>
      )}

      <div className="bg-black border border-gray-700 rounded-lg overflow-hidden">
        {/* Versão para Desktop - Tabela */}
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-700">
            <thead>
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Data do Cadastro
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Nome do Cliente
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Tipo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Status do Cliente
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Status do Pipeline
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-black divide-y divide-gray-700">
              {filteredRegistrations.length > 0 ? (
                filteredRegistrations.map((registration) => (
                  <tr key={registration.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatFirestoreDate(registration.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {registration.type === 'PJ' ? registration.companyName : registration.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {registration.type === 'PJ' ? registration.partnerEmail : registration.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center">
                        {registration.type === 'PJ' ? (
                          <Building2 className="h-4 w-4 text-blue-400 mr-2" />
                        ) : (
                          <User className="h-4 w-4 text-green-400 mr-2" />
                        )}
                        <span className={`${
                          registration.type === 'PJ' ? 'text-blue-400' : 'text-green-400'
                        }`}>
                          {registration.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        registrationStatusColors[registration.status]
                      }`}>
                        {registrationStatusLabels[registration.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        pipelineStatusColors[registration.pipelineStatus]
                      }`}>
                        {pipelineStatusLabels[registration.pipelineStatus]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      <div className="flex space-x-4">
                        <button
                          onClick={() => handleViewRegistration(registration.id)}
                          className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_4px_rgba(34,211,238,0.6)] transition-all"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditRegistration(registration)}
                          className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {user?.roleKey !== 'partner' && (
                          <>
                            <button
                              onClick={() => handleEditRegistration(registration)}
                              className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleGeneratePendency(registration.id)}
                              className="text-purple-400 hover:text-purple-300 hover:drop-shadow-[0_0_4px_rgba(167,139,250,0.6)] transition-all"
                              title="Gerar Pendência"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleResolvePendency(registration.id)}
                              title="Resolver Pendência"
                              disabled={!registration.pendencies?.some(p => !p.resolved)}
                              className={`${!registration.pendencies?.some(p => !p.resolved) ? 'opacity-50 cursor-not-allowed' : 'hover:text-green-300 hover:drop-shadow-[0_0_4px_rgba(134,239,172,0.6)]'} text-green-400 transition-all`}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setRegistrationToDelete(registration.id);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-400 hover:text-red-300 hover:drop-shadow-[0_0_4px_rgba(248,113,113,0.6)] transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {user?.roleKey !== 'partner' && (
                          <button
                            onClick={() => {
                              setClientToChangeStatus(registration.id);
                              setShowStatusModal(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:drop-shadow-[0_0_4px_rgba(59,130,246,0.6)] transition-all"
                            title="Alterar Status"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-white">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Versão para Mobile - Cards */}
        <div className="block md:hidden space-y-4">
          {filteredRegistrations.length > 0 ? (
            filteredRegistrations.map((registration) => (
              <div key={registration.id} className="bg-black border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-medium text-white truncate max-w-[200px]">
                      {registration.type === 'PJ' ? registration.companyName : registration.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {registration.email || registration.partnerEmail || 'Sem e-mail'}
                    </p>
                  </div>
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    registration.type === 'PJ' ? 'bg-blue-400/10 text-blue-400' : 'bg-green-400/10 text-green-400'
                  }`}>
                    {registration.type === 'PJ' ? 'PJ' : 'PF'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-white">Data de Cadastro:</span>
                    <span className="text-sm text-white">
                      {formatFirestoreDate(registration.createdAt)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-sm text-white">Status do Cliente:</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      registrationStatusColors[registration.status]
                    }`}>
                      {registrationStatusLabels[registration.status]}
                    </span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <span className="text-sm text-white">Status do Pipeline:</span>
                  <div className="mt-1 bg-gray-900 rounded-md p-2">
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => navigateCarousel(registration.id, 'prev')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      
                      <div className="flex-1 mx-2">
                        {pipelineStages.map((stage, index) => {
                          const isCurrentStage = registration.pipelineStatus === stage.key;
                          const isActiveInCarousel = (pipelineCarouselIndexes[registration.id] || 0) === index;
                          
                          return isActiveInCarousel && (
                            <div key={stage.key} className="text-center">
                              <div className={`h-1.5 ${isCurrentStage ? stage.bgColor : 'bg-gray-600'} rounded-full mb-2 mx-auto w-3/4`}></div>
                              <span className={`text-sm font-medium ${isCurrentStage ? stage.color : 'text-gray-500'}`}>{stage.label}</span>
                              {isCurrentStage && (
                                <div className={`mt-1 mx-auto w-2 h-2 rounded-full ${stage.bgColor}`}></div>
                              )}
                              <div className="flex justify-center mt-2 space-x-1">
                                {pipelineStages.map((_, dotIndex) => (
                                  <div 
                                    key={dotIndex} 
                                    className={`w-1.5 h-1.5 rounded-full ${dotIndex === index ? 'bg-white' : 'bg-gray-600'}`}
                                  ></div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <button 
                        onClick={() => navigateCarousel(registration.id, 'next')}
                        className="text-gray-400 hover:text-white transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400">
                    {registration.pendencies && registration.pendencies.length > 0 
                      ? `${registration.pendencies.length} pendência(s)` 
                      : 'Nenhuma pendência'}
                  </div>
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleViewRegistration(registration.id)}
                      className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_4px_rgba(34,211,238,0.6)] transition-all"
                      title="Visualizar"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    {/* Mostrar os outros botões apenas se o usuário não for parceiro */}
                    {user?.roleKey !== 'partner' && (
                      <>
                        <button
                          onClick={() => handleEditRegistration(registration)}
                          className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                          title="Editar"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        {registration.status === 'complete' && (
                          <button
                            onClick={() => {
                              setRegistrationForPendency(registration.id);
                              setShowPendencyModal(true);
                            }}
                            className="text-red-400 hover:text-red-300 hover:drop-shadow-[0_0_4px_rgba(248,113,113,0.6)] transition-all"
                            title="Gerar Pendência"
                          >
                            <AlertCircle className="h-5 w-5" />
                          </button>
                        )}
                        
                        {registration.status === 'documents_pending' && (
                          <button
                            onClick={() => {
                              setClientToChangeStatus(registration.id);
                              updateClientStatus('complete');
                            }}
                            className="text-green-400 hover:text-green-300 hover:drop-shadow-[0_0_4px_rgba(74,222,128,0.6)] transition-all"
                            title="Marcar como Completo"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            setRegistrationToDelete(registration.id);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-400 hover:text-red-300 hover:drop-shadow-[0_0_4px_rgba(248,113,113,0.6)] transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-white p-4 bg-black border border-gray-700 rounded-lg">
              Nenhum cliente encontrado com os filtros selecionados.
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Confirmar exclusão</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteRegistration}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de geração de pendência */}
      {showPendencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Gerar pendência</h3>
            
            <div className="mb-4">
              <label htmlFor="pendencyMessage" className="block text-sm font-medium text-white mb-1">
                Descrição da pendência
              </label>
              <textarea
                id="pendencyMessage"
                value={pendencyMessage}
                onChange={(e) => setPendencyMessage(e.target.value)}
                className="bg-gray-900 border border-gray-600 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 h-32"
                placeholder="Descreva a pendência que precisa ser resolvida pelo cliente..."
              />
            </div>
            
            {/* Timeline de pendências anteriores */}
            {registrationForPendency && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-white mb-2">Histórico de pendências</h4>
                <div className="max-h-48 overflow-y-auto pr-2 space-y-4">
                  {registrations.find(r => r.id === registrationForPendency)?.pendencies?.length ? (
                    registrations.find(r => r.id === registrationForPendency)?.pendencies?.map((pendency, index) => (
                      <div key={index} className="relative pl-6 pb-4">
                        {/* Linha vertical conectando os itens */}
                        {index < (registrations.find(r => r.id === registrationForPendency)?.pendencies?.length || 0) - 1 && (
                          <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-700"></div>
                        )}
                        
                        {/* Círculo marcador */}
                        <div className={`absolute left-0 top-1 h-4 w-4 rounded-full ${
                          pendency.resolved 
                            ? 'bg-green-400/20 border border-green-400' 
                            : 'bg-red-400/20 border border-red-400'
                        }`}>
                          <div className={`h-1.5 w-1.5 rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${
                            pendency.resolved ? 'bg-green-400' : 'bg-red-400'
                          }`}></div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-white">
                              {formatFirestoreDate(pendency.createdAt)}
                            </p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                              pendency.resolved 
                                ? 'text-green-400 bg-green-400/10' 
                                : 'text-red-400 bg-red-400/10'
                            }`}>
                              {pendency.resolved ? 'Resolvida' : 'Pendente'}
                            </span>
                          </div>
                          <p className="text-sm text-white">{pendency.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-white">Nenhuma pendência anterior</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPendencyModal(false);
                  setRegistrationForPendency(null);
                  setPendencyMessage('');
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitPendency}
                disabled={!pendencyMessage.trim()}
                className={`px-4 py-2 ${!pendencyMessage.trim() ? 'bg-yellow-600/50 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'} text-white rounded-md`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para alterar status */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Alterar Status</h3>
            
            <div className="mb-4">
              <label htmlFor="status" className="block text-sm font-medium text-white mb-1">
                Selecione o novo status
              </label>
              <select
                id="status"
                value={registrations.find(r => r.id === clientToChangeStatus)?.status}
                onChange={(e) => updateClientStatus(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="complete">Cadastro Completo</option>
                <option value="documents_pending">Cadastro com Pendência</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setClientToChangeStatus(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-900"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para escolher tipo de cliente */}
      {showNewClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">Selecione o tipo de cliente</h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleCreateNewClient('PF')}
                className="flex flex-col items-center justify-center p-6 border border-gray-700 rounded-lg hover:bg-gray-800"
              >
                <User size={32} className="text-white mb-2" />
                <span className="text-white font-medium">Pessoa Física</span>
              </button>
              <button
                onClick={() => handleCreateNewClient('PJ')}
                className="flex flex-col items-center justify-center p-6 border border-gray-700 rounded-lg hover:bg-gray-800"
              >
                <Building2 size={32} className="text-white mb-2" />
                <span className="text-white font-medium">Pessoa Jurídica</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewClientModal(false)}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}