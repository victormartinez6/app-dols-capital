import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, where, updateDoc, getDoc, addDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Eye, Pencil, Trash2, Search, X, Calendar, CheckCircle, XCircle, Clock, AlertTriangle, Plus, User, MessageSquarePlus, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Proposal {
  id: string;
  proposalNumber: string;
  clientName: string;
  clientId: string;
  desiredCredit: number;
  hasProperty: boolean;
  propertyValue: number;
  status: 'pending' | 'approved' | 'rejected' | 'in_analysis' | 'with_pendencies';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract';
  createdAt: Date;
  userId: string;
  creditLine?: string;
  creditReason?: string;
  bankId?: string;
  bankName?: string;
  bankTradingName?: string;
  observationsTimeline?: {
    id: string;
    text: string;
    createdAt: Date | string;
    createdBy: string;
    createdByName: string;
  }[];
  pendencies?: {
    text: string;
    createdAt: Date | string;
    createdBy: string;
    createdByName: string;
  }[];
  lastPendency?: {
    text: string;
    createdAt: Date | string;
    createdBy: string;
    createdByName: string;
  };
}

const proposalStatusLabels = {
  pending: 'Cadastro Enviado',
  in_analysis: 'Em Análise',
  with_pendencies: 'Pendências',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

const proposalStatusColors = {
  pending: 'text-blue-400 bg-blue-400/10',
  in_analysis: 'text-yellow-400 bg-yellow-400/10',
  with_pendencies: 'text-orange-400 bg-orange-400/10',
  approved: 'text-green-400 bg-green-400/10',
  rejected: 'text-red-400 bg-red-400/10',
};

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

export default function Proposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientNameFilter, setClientNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'in_analysis' | 'with_pendencies'>('all');
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState<'all' | 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [proposalToChangeStatus, setProposalToChangeStatus] = useState<string | null>(null);
  const [showNewProposalModal, setShowNewProposalModal] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [proposalToAddObservation, setProposalToAddObservation] = useState<string | null>(null);
  const [observationText, setObservationText] = useState('');
  const [duplicatingProposal, setDuplicatingProposal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [proposalToDuplicate, setProposalToDuplicate] = useState<string | null>(null);
  const [proposalToDuplicateNumber, setProposalToDuplicateNumber] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string; type: 'PF' | 'PJ' }[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [filteredClients, setFilteredClients] = useState<{ id: string; name: string; type: 'PF' | 'PJ' }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string; type: 'PF' | 'PJ' } | null>(null);
  const [banks, setBanks] = useState<{ id: string; companyName: string; tradingName: string; commission: string }[]>([]);
  
  // Estado para controlar se o acordeon de filtros está aberto ou fechado
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Estado para o modal de pendências
  const [showPendencyModal, setShowPendencyModal] = useState(false);
  const [pendencyText, setPendencyText] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    fetchBanks();
  }, [user]);

  useEffect(() => {
    fetchProposals();
  }, [user, banks]);

  useEffect(() => {
    applyFilters();
  }, [proposals, clientNameFilter, statusFilter, pipelineStatusFilter, dateFilter]);

  useEffect(() => {
    if (showNewProposalModal) {
      fetchClients();
    }
  }, [showNewProposalModal]);

  useEffect(() => {
    if (clientSearchTerm.trim() === '') {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(client => 
        client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [clientSearchTerm, clients]);

  const fetchBanks = async () => {
    try {
      const banksCollection = collection(db, 'banks');
      const banksSnapshot = await getDocs(banksCollection);
      const banksList = banksSnapshot.docs.map(doc => ({
        id: doc.id,
        companyName: doc.data().companyName || '',
        tradingName: doc.data().tradingName || '',
        commission: doc.data().commission || ''
      }));
      setBanks(banksList);
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoading(true);
      
      // Buscar todos os bancos primeiro para ter os dados completos
      const banksCollection = collection(db, 'banks');
      const banksSnapshot = await getDocs(banksCollection);
      const banksMap = new Map();
      
      banksSnapshot.docs.forEach(doc => {
        const bankData = doc.data();
        banksMap.set(doc.id, {
          id: doc.id,
          companyName: bankData.companyName || '',
          tradingName: bankData.tradingName || bankData.companyName || '',
          commission: bankData.commission || ''
        });
      });
      
      console.log('Bancos carregados:', banksMap.size);
      
      // Se o usuário for cliente, mostrar apenas suas propostas
      if (user?.role === 'client') {
        const q = query(collection(db, 'proposals'), where('userId', '==', user.id));
        const querySnapshot = await getDocs(q);
        const proposalsData = await Promise.all(querySnapshot.docs.map(async doc => {
          const data = doc.data();
          
          // Buscar dados do banco se houver bankId
          let bankName = data.bankName || '';
          let bankTradingName = data.bankTradingName || '';
          
          if (data.bankId && banksMap.has(data.bankId)) {
            const bankData = banksMap.get(data.bankId);
            bankName = bankData.companyName;
            bankTradingName = bankData.tradingName;
          }
          
          return {
            id: doc.id,
            proposalNumber: data.proposalNumber || `PROP-${doc.id.substring(0, 6).toUpperCase()}`,
            clientName: data.clientName || 'Nome não disponível',
            clientId: data.clientId || '',
            desiredCredit: data.desiredCredit || 0,
            hasProperty: data.hasProperty || false,
            propertyValue: data.propertyValue || 0,
            status: data.status || 'pending',
            pipelineStatus: data.pipelineStatus || 'submitted',
            createdAt: data.createdAt?.toDate() || new Date(),
            userId: data.userId || '',
            creditLine: data.creditLine || '',
            creditReason: data.creditReason || '',
            bankId: data.bankId || '',
            bankName: bankName,
            bankTradingName: bankTradingName,
            observationsTimeline: data.observationsTimeline || [],
            pendencies: data.pendencies || [],
            lastPendency: data.lastPendency || null
          };
        })) as Proposal[];
        setProposals(proposalsData);
        setFilteredProposals(proposalsData);
      } else {
        // Se for gerente ou admin, mostrar todas as propostas
        const q = query(collection(db, 'proposals'));
        const querySnapshot = await getDocs(q);
        const proposalsData = await Promise.all(querySnapshot.docs.map(async doc => {
          const data = doc.data();
          
          // Buscar dados do banco se houver bankId
          let bankName = data.bankName || '';
          let bankTradingName = data.bankTradingName || '';
          
          if (data.bankId && banksMap.has(data.bankId)) {
            const bankData = banksMap.get(data.bankId);
            bankName = bankData.companyName;
            bankTradingName = bankData.tradingName;
          }
          
          return {
            id: doc.id,
            proposalNumber: data.proposalNumber || `PROP-${doc.id.substring(0, 6).toUpperCase()}`,
            clientName: data.clientName || 'Nome não disponível',
            clientId: data.clientId || '',
            desiredCredit: data.desiredCredit || 0,
            hasProperty: data.hasProperty || false,
            propertyValue: data.propertyValue || 0,
            status: data.status || 'pending',
            pipelineStatus: data.pipelineStatus || 'submitted',
            createdAt: data.createdAt?.toDate() || new Date(),
            userId: data.userId || '',
            creditLine: data.creditLine || '',
            creditReason: data.creditReason || '',
            bankId: data.bankId || '',
            bankName: bankName,
            bankTradingName: bankTradingName,
            observationsTimeline: data.observationsTimeline || [],
            pendencies: data.pendencies || [],
            lastPendency: data.lastPendency || null
          };
        })) as Proposal[];
        setProposals(proposalsData);
        setFilteredProposals(proposalsData);
      }
    } catch (error) {
      console.error('Erro ao buscar propostas:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...proposals];
    
    // Filtro por nome do cliente
    if (clientNameFilter) {
      result = result.filter(prop => 
        prop.clientName.toLowerCase().includes(clientNameFilter.toLowerCase())
      );
    }
    
    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(prop => prop.status === statusFilter);
    }
    
    // Filtro por status do pipeline
    if (pipelineStatusFilter !== 'all') {
      result = result.filter(prop => prop.pipelineStatus === pipelineStatusFilter);
    }
    
    // Filtro por data
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      result = result.filter(prop => {
        const propDate = new Date(prop.createdAt);
        return propDate.toDateString() === filterDate.toDateString();
      });
    }
    
    setFilteredProposals(result);
  };

  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  const handleDeleteProposal = async () => {
    if (!proposalToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'proposals', proposalToDelete));
      setProposals(prev => prev.filter(prop => prop.id !== proposalToDelete));
      setShowDeleteModal(false);
      setProposalToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir proposta:', error);
    }
  };

  const handleViewProposal = (proposalId: string) => {
    navigate(`/proposals/detail/${proposalId}`);
  };

  const handleEditProposal = (proposalId: string) => {
    navigate(`/proposals/edit/${proposalId}`);
  };

  const updateProposalStatus = async (status: Proposal['status']) => {
    if (!proposalToChangeStatus) return;

    // Se o status for "with_pendencies", mostrar o modal de pendências
    if (status === 'with_pendencies') {
      setShowPendencyModal(true);
      return;
    }

    try {
      setLoading(true);
      
      // Encontrar a proposta que está sendo atualizada
      const proposalToUpdate = proposals.find(p => p.id === proposalToChangeStatus);
      
      if (!proposalToUpdate) return;
      
      // Atualizar a proposta no Firestore
      const proposalRef = doc(db, 'proposals', proposalToChangeStatus);
      await updateDoc(proposalRef, {
        status: status,
        updatedAt: new Date(),
      });
      
      // Atualizar também o status do cliente no Firestore, se necessário
      if (proposalToUpdate.clientId) {
        const clientRef = doc(db, 'registrations', proposalToUpdate.clientId);
        await updateDoc(clientRef, {
          status: status === 'with_pendencies' ? 'documents_pending' : 
                 status === 'approved' ? 'complete' : 'pending',
          updatedAt: new Date(),
        });
      }
      
      // Atualizar localmente
      const updatedProposal: Proposal = {
        ...proposalToUpdate,
        status: status,
        pendencies: [...(proposalToUpdate.pendencies || [])],
        lastPendency: proposalToUpdate.lastPendency
      };
      
      setProposals(prev => 
        prev.map(proposal => 
          proposal.id === proposalToChangeStatus 
            ? updatedProposal
            : proposal
        )
      );
      
      // Atualizar a lista filtrada
      setFilteredProposals(prev => 
        prev.map(proposal => 
          proposal.id === proposalToChangeStatus 
            ? updatedProposal
            : proposal
        )
      );
      
      setShowStatusModal(false);
      setProposalToChangeStatus(null);
    } catch (error) {
      console.error('Erro ao atualizar status da proposta:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função para lidar com o envio de pendências
  const handleSubmitPendency = async () => {
    if (!proposalToChangeStatus || !pendencyText.trim()) return;

    try {
      setLoading(true);
      
      // Encontrar a proposta que está sendo atualizada
      const proposalToUpdate = proposals.find(p => p.id === proposalToChangeStatus);
      
      if (!proposalToUpdate) return;
      
      // Criar objeto de pendência
      const pendency = {
        text: pendencyText.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.id || '',
        createdByName: user?.name || ''
      };
      
      // Atualizar a proposta no Firestore
      const proposalRef = doc(db, 'proposals', proposalToChangeStatus);
      await updateDoc(proposalRef, {
        status: 'with_pendencies',
        updatedAt: new Date(),
        pendencies: arrayUnion(pendency),
        lastPendency: pendency
      });
      
      // Atualizar também o status do cliente no Firestore
      if (proposalToUpdate.clientId) {
        const clientRef = doc(db, 'registrations', proposalToUpdate.clientId);
        await updateDoc(clientRef, {
          status: 'documents_pending',
          updatedAt: new Date(),
        });
      }
      
      // Atualizar localmente
      const updatedProposal: Proposal = {
        ...proposalToUpdate,
        status: 'with_pendencies',
        pendencies: [...(proposalToUpdate.pendencies || []), pendency],
        lastPendency: pendency
      };
      
      setProposals(prev => 
        prev.map(proposal => 
          proposal.id === proposalToChangeStatus 
            ? updatedProposal
            : proposal
        )
      );
      
      // Atualizar a lista filtrada
      setFilteredProposals(prev => 
        prev.map(proposal => 
          proposal.id === proposalToChangeStatus 
            ? updatedProposal
            : proposal
        )
      );
      
      // Limpar e fechar modais
      setPendencyText('');
      setShowPendencyModal(false);
      setShowStatusModal(false);
      setProposalToChangeStatus(null);
    } catch (error) {
      console.error('Erro ao adicionar pendência à proposta:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      console.log('Iniciando busca de clientes...');
      setFilteredClients([]); // Limpa a lista enquanto carrega
      
      // Buscar todos os registros completos, sem filtro de status para garantir que encontremos todos os clientes
      const q = query(collection(db, 'registrations'));
      const querySnapshot = await getDocs(q);
      
      console.log(`Encontrados ${querySnapshot.docs.length} registros de clientes.`);
      
      const clientsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Dados do cliente:', doc.id, data);
        
        // Determinar o nome do cliente com base no tipo (PF ou PJ)
        let clientName = 'Nome não disponível';
        let clientType: 'PF' | 'PJ' = data.type || 'PF';
        
        if (clientType === 'PF') {
          clientName = data.name || 'Cliente PF';
        } else if (clientType === 'PJ') {
          clientName = data.companyName || data.name || 'Cliente PJ';
        }
        
        console.log(`Cliente processado: ${clientName} (${clientType}) - ID: ${doc.id}`);
        
        return {
          id: doc.id,
          name: clientName,
          type: clientType,
        };
      }).filter(client => client.name !== 'Nome não disponível');

      console.log('Total de clientes válidos encontrados:', clientsData.length);
      
      // Ordenar por nome para facilitar a busca
      const sortedClients = clientsData.sort((a, b) => a.name.localeCompare(b.name));
      
      setClients(sortedClients);
      setFilteredClients(sortedClients);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      // Mostrar lista vazia em caso de erro
      setClients([]);
      setFilteredClients([]);
    }
  };

  const handleDuplicateProposal = async (proposalId: string) => {
    try {
      setDuplicatingProposal(true);
      
      // Buscar a proposta original
      const proposalRef = doc(db, 'proposals', proposalId);
      const proposalSnap = await getDoc(proposalRef);
      
      if (!proposalSnap.exists()) {
        console.error('Proposta não encontrada');
        return;
      }
      
      const originalProposal = proposalSnap.data();
      
      // Se a proposta tem um bankId, buscar os dados atualizados do banco
      if (originalProposal.bankId) {
        try {
          const bankRef = doc(db, 'banks', originalProposal.bankId);
          const bankSnap = await getDoc(bankRef);
          
          if (bankSnap.exists()) {
            const bankData = bankSnap.data();
            originalProposal.bankName = bankData.companyName;
            originalProposal.bankTradingName = bankData.tradingName;
            console.log('Dados do banco atualizados para duplicação:', originalProposal.bankName);
          }
        } catch (error) {
          console.error('Erro ao buscar dados do banco para duplicação:', error);
        }
      }
      
      // Gerar um novo número de proposta
      // Buscar todas as propostas para determinar o próximo número
      const proposalsRef = collection(db, 'proposals');
      const proposalsSnap = await getDocs(proposalsRef);
      
      // Encontrar o maior número de proposta atual
      let maxProposalNumber = 0;
      proposalsSnap.forEach((doc) => {
        const proposalData = doc.data();
        const proposalNumber = proposalData.proposalNumber;
        
        // Extrair o número da proposta (assumindo formato "PROP-XXXX")
        if (proposalNumber && typeof proposalNumber === 'string') {
          const match = proposalNumber.match(/PROP-(\d+)/);
          if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxProposalNumber) {
              maxProposalNumber = num;
            }
          }
        }
      });
      
      // Criar o próximo número de proposta
      const nextProposalNumber = maxProposalNumber + 1;
      const newProposalNumber = `PROP-${nextProposalNumber.toString().padStart(4, '0')}`;
      
      // Criar uma cópia da proposta com um novo ID
      const newProposalData = {
        ...originalProposal,
        proposalNumber: newProposalNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
        observationsTimeline: [
          ...originalProposal.observationsTimeline || [],
          {
            message: `Proposta duplicada a partir da proposta ${originalProposal.proposalNumber || 'anterior'}`,
            date: new Date(),
            author: user?.name || user?.email || 'Sistema',
          }
        ]
      };
      
      // Adicionar a nova proposta ao Firestore
      const proposalsCollectionRef = collection(db, 'proposals');
      await addDoc(proposalsCollectionRef, newProposalData);
      
      // Atualizar a lista de propostas
      fetchProposals();
      
      // Fechar o modal de duplicação
      setShowDuplicateModal(false);
      setProposalToDuplicate(null);
      setProposalToDuplicateNumber(null);
      
      // Mostrar mensagem de sucesso temporária
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-md shadow-lg z-50 animate-fade-in-out';
      successMessage.textContent = `Proposta duplicada com sucesso! Novo número: ${newProposalNumber}`;
      document.body.appendChild(successMessage);
      
      // Remover a mensagem após 5 segundos
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 5000);
    } catch (error) {
      console.error('Erro ao duplicar proposta:', error);
      
      // Mostrar mensagem de erro temporária
      const errorMessage = document.createElement('div');
      errorMessage.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-md shadow-lg z-50 animate-fade-in-out';
      errorMessage.textContent = 'Erro ao duplicar proposta. Por favor, tente novamente.';
      document.body.appendChild(errorMessage);
      
      // Remover a mensagem após 5 segundos
      setTimeout(() => {
        if (document.body.contains(errorMessage)) {
          document.body.removeChild(errorMessage);
        }
      }, 5000);
    } finally {
      setDuplicatingProposal(false);
    }
  };

  const resetFilters = () => {
    setClientNameFilter('');
    setStatusFilter('all');
    setPipelineStatusFilter('all');
    setDateFilter('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleCreateNewProposal = () => {
    setShowNewProposalModal(true);
    setClientSearchTerm('');
    setSelectedClient(null);
  };

  const handleSelectClient = (client: { id: string; name: string; type: 'PF' | 'PJ' }) => {
    setSelectedClient(client);
  };

  const handleConfirmNewProposal = () => {
    if (selectedClient) {
      setShowNewProposalModal(false);
      navigate(`/proposals/new/${selectedClient.id}`);
    }
  };

  const handleAddObservation = (proposalId: string) => {
    setProposalToAddObservation(proposalId);
    setObservationText('');
    setShowObservationModal(true);
  };

  const handleSaveObservation = async () => {
    if (!proposalToAddObservation || !observationText.trim()) return;

    try {
      const proposalRef = doc(db, 'proposals', proposalToAddObservation);
      const proposalDoc = await getDoc(proposalRef);
      
      if (!proposalDoc.exists()) {
        console.error('Proposta não encontrada');
        return;
      }

      const proposalData = proposalDoc.data();
      const observationsTimeline = proposalData.observationsTimeline || [];
      
      // Gerar um ID único usando timestamp e um número aleatório
      const uniqueId = `obs_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      const newObservation = {
        id: uniqueId,
        text: observationText.trim(),
        createdAt: new Date().toISOString(), 
        createdBy: user?.id || 'unknown',
        createdByName: user?.name || 'Usuário',
      };
      
      await updateDoc(proposalRef, {
        observationsTimeline: [...observationsTimeline, newObservation],
      });
      
      // Atualizar a lista de propostas
      fetchProposals();
      
      // Fechar o modal
      setShowObservationModal(false);
      setProposalToAddObservation(null);
      setObservationText('');
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
    }
  };

  const getClientType = async (clientId: string): Promise<'PF' | 'PJ'> => {
    if (!clientId) return 'PF'; // Valor padrão se não houver ID
    
    try {
      const clientRef = doc(db, 'registrations', clientId);
      const clientSnap = await getDoc(clientRef);
      
      if (clientSnap.exists()) {
        const clientData = clientSnap.data();
        return clientData.type === 'PJ' ? 'PJ' : 'PF';
      }
    } catch (error) {
      console.error('Erro ao obter tipo do cliente:', error);
    }
    
    return 'PF'; // Valor padrão em caso de erro
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-semibold text-white">Controle de Propostas</h2>
        {isAdmin && (
          <button
            onClick={handleCreateNewProposal}
            className="flex items-center px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 w-full sm:w-auto justify-center sm:justify-start"
          >
            <Plus size={16} className="mr-2" />
            Nova Proposta
          </button>
        )}
      </div>

      {/* Botão para abrir/fechar o acordeon de filtros */}
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
      
      {/* Filtros */}
      {filtersOpen && (
        <div className="bg-black border border-gray-700 rounded-lg p-4 space-y-4 w-full overflow-hidden">
          <h3 className="text-lg font-medium text-white mb-2">Filtros</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {/* Filtro por data */}
            <div>
              <label htmlFor="dateFilter" className="block text-sm font-medium text-white mb-1">
                Data da Proposta
              </label>
              <div className="relative">
                <input
                  type="date"
                  id="dateFilter"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            {/* Filtro por nome do cliente */}
            <div>
              <label htmlFor="clientNameFilter" className="block text-sm font-medium text-white mb-1">
                Nome do Cliente
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="clientNameFilter"
                  value={clientNameFilter}
                  onChange={(e) => setClientNameFilter(e.target.value)}
                  className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Buscar por nome..."
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            {/* Filtro por status da proposta */}
            <div>
              <label htmlFor="statusFilter" className="block text-sm font-medium text-white mb-1">
                Status da Proposta
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="pending">Cadastro Enviado</option>
                <option value="in_analysis">Em Análise</option>
                <option value="with_pendencies">Pendências</option>
                <option value="approved">Aprovada</option>
                <option value="rejected">Recusada</option>
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
          {(dateFilter || clientNameFilter || statusFilter !== 'all' || pipelineStatusFilter !== 'all') && (
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
      
      {/* Tabela de Propostas */}
      <div className="bg-black border border-gray-700 rounded-lg overflow-hidden w-full">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : filteredProposals.length > 0 ? (
          <>
            {/* Versão para Desktop - Tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-800">
                <thead className="bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Data
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Proposta
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Cliente
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Valor
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Banco
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Status
                    </th>
                    {isAdmin && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        Status do Pipeline
                      </th>
                    )}
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-black divide-y divide-gray-800">
                  {filteredProposals.map((proposal) => (
                    <tr key={proposal.id} className="hover:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div 
                          className="text-sm text-gray-300 cursor-help"
                          title={format(new Date(proposal.createdAt), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                        >
                          {format(new Date(proposal.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{proposal.proposalNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {proposal.clientId ? (
                            <button 
                              onClick={() => navigate(`/clients/detail/${proposal.clientId}`)}
                              className="hover:underline hover:text-blue-300 text-left"
                            >
                              {proposal.clientName}
                            </button>
                          ) : (
                            proposal.clientName
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{formatCurrency(proposal.desiredCredit)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-white">{proposal.bankTradingName || proposal.bankName || "Não informado"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proposalStatusColors[proposal.status]}`}>
                          {proposalStatusLabels[proposal.status]}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pipelineStatusColors[proposal.pipelineStatus]}`}>
                            {pipelineStatusLabels[proposal.pipelineStatus]}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div className="flex justify-start space-x-4">
                          <button
                            onClick={() => handleViewProposal(proposal.id)}
                            className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_4px_rgba(34,211,238,0.6)] transition-all"
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleEditProposal(proposal.id)}
                                className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  setProposalToChangeStatus(proposal.id);
                                  setShowStatusModal(true);
                                }}
                                className="text-green-400 hover:text-green-300 hover:drop-shadow-[0_0_4px_rgba(74,222,128,0.6)] transition-all"
                                title="Alterar Status"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  setProposalToDuplicate(proposal.id);
                                  setProposalToDuplicateNumber(proposal.proposalNumber);
                                  setShowDuplicateModal(true);
                                }}
                                className="text-indigo-400 hover:text-indigo-300 hover:drop-shadow-[0_0_4px_rgba(129,140,248,0.6)] transition-all"
                                title="Duplicar Proposta"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => handleAddObservation(proposal.id)}
                                className="text-purple-400 hover:text-purple-300 hover:drop-shadow-[0_0_4px_rgba(167,139,250,0.6)] transition-all"
                                title="Adicionar Observação"
                              >
                                <MessageSquarePlus className="h-4 w-4" />
                              </button>
                              
                              <button
                                onClick={() => {
                                  setProposalToDelete(proposal.id);
                                  setShowDeleteModal(true);
                                }}
                                className="text-rose-400 hover:text-rose-300 hover:drop-shadow-[0_0_4px_rgba(251,113,133,0.6)] transition-all"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Versão para Mobile - Cards */}
            <div className="block md:hidden">
              <div className="divide-y divide-gray-700">
                {filteredProposals.map((proposal) => (
                  <div key={proposal.id} className="p-4 hover:bg-gray-900">
                    <div className="flex justify-between items-start mb-3">
                      <div className="max-w-[70%]">
                        <div className="text-sm font-medium text-white mb-1">{proposal.proposalNumber}</div>
                        <div className="text-xs text-gray-400">
                          {format(new Date(proposal.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewProposal(proposal.id)}
                          className="text-cyan-400 hover:text-cyan-300 hover:drop-shadow-[0_0_4px_rgba(34,211,238,0.6)] transition-all"
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleEditProposal(proposal.id)}
                              className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Cliente</div>
                        <div className="text-sm text-white truncate max-w-full block">
                          {proposal.clientId ? (
                            <button 
                              onClick={() => navigate(`/clients/detail/${proposal.clientId}`)}
                              className="hover:underline hover:text-blue-300 text-left truncate max-w-full block"
                            >
                              {proposal.clientName}
                            </button>
                          ) : (
                            proposal.clientName
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Valor</div>
                        <div className="text-sm text-white">{formatCurrency(proposal.desiredCredit)}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Banco</div>
                        <div className="text-sm text-white truncate max-w-full">{proposal.bankTradingName || proposal.bankName || "Não informado"}</div>
                      </div>
                      
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Status</div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proposalStatusColors[proposal.status]}`}>
                          {proposalStatusLabels[proposal.status]}
                        </span>
                      </div>
                    </div>
                    
                    {isAdmin && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 mb-1">Status do Pipeline</div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pipelineStatusColors[proposal.pipelineStatus]}`}>
                          {pipelineStatusLabels[proposal.pipelineStatus]}
                        </span>
                      </div>
                    )}
                    
                    {isAdmin && (
                      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end space-x-3">
                        <button
                          onClick={() => {
                            setProposalToChangeStatus(proposal.id);
                            setShowStatusModal(true);
                          }}
                          className="text-green-400 hover:text-green-300 transition-all"
                          title="Alterar Status"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => {
                            setProposalToDuplicate(proposal.id);
                            setProposalToDuplicateNumber(proposal.proposalNumber);
                            setShowDuplicateModal(true);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 transition-all"
                          title="Duplicar Proposta"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleAddObservation(proposal.id)}
                          className="text-purple-400 hover:text-purple-300 transition-all"
                          title="Adicionar Observação"
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => {
                            setProposalToDelete(proposal.id);
                            setShowDeleteModal(true);
                          }}
                          className="text-rose-400 hover:text-rose-300 transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </> 
        ) : (
          <div className="py-8 text-center text-white">
            <p>Nenhuma proposta encontrada com os filtros aplicados.</p>
          </div>
        )}
      </div>
      
      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir esta proposta? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProposalToDelete(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProposal}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Alteração de Status */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Alterar Status da Proposta</h3>
            <p className="text-gray-300 mb-6">
              Selecione o novo status para esta proposta:
            </p>
            <div className="grid grid-cols-1 gap-3 mb-6">
              <button
                onClick={() => updateProposalStatus('pending')}
                className="flex items-center justify-between px-4 py-3 bg-blue-400/10 border border-blue-400 rounded-md hover:bg-blue-400/20"
              >
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-400 mr-3" />
                  <span className="text-white">Cadastro Enviado</span>
                </div>
              </button>
              <button
                onClick={() => updateProposalStatus('in_analysis')}
                className="flex items-center justify-between px-4 py-3 bg-yellow-400/10 border border-yellow-400 rounded-md hover:bg-yellow-400/20"
              >
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
                  <span className="text-white">Em Análise</span>
                </div>
              </button>
              <button
                onClick={() => updateProposalStatus('with_pendencies')}
                className="flex items-center justify-between px-4 py-3 bg-orange-400/10 border border-orange-400 rounded-md hover:bg-orange-400/20"
              >
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-orange-400 mr-3" />
                  <span className="text-white">Pendências</span>
                </div>
              </button>
              <button
                onClick={() => updateProposalStatus('approved')}
                className="flex items-center justify-between px-4 py-3 bg-green-400/10 border border-green-400 rounded-md hover:bg-green-400/20"
              >
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="text-white">Aprovada</span>
                </div>
              </button>
              <button
                onClick={() => updateProposalStatus('rejected')}
                className="flex items-center justify-between px-4 py-3 bg-red-400/10 border border-red-400 rounded-md hover:bg-red-400/20"
              >
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-400 mr-3" />
                  <span className="text-white">Recusada</span>
                </div>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setProposalToChangeStatus(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Proposta */}
      {showNewProposalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Criar Nova Proposta</h3>
            <p className="text-gray-300 mb-4">
              Selecione um cliente para criar uma nova proposta:
            </p>
            
            <div className="mb-4">
              <div className="relative">
                <input
                  type="text"
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  placeholder="Buscar cliente por nome..."
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2.5 h-10 pl-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                {clientSearchTerm && (
                  <button 
                    onClick={() => setClientSearchTerm('')}
                    className="absolute right-3 top-3"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-white" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto mb-6 border border-gray-800 rounded-md">
              {filteredClients.length > 0 ? (
                <div className="divide-y divide-gray-800">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                      className={`p-3 cursor-pointer hover:bg-gray-800 flex items-center justify-between ${
                        selectedClient?.id === client.id ? 'bg-gray-800' : ''
                      }`}
                    >
                      <div className="flex items-center">
                        <User className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm text-white">{client.name}</p>
                          <p className="text-xs text-gray-400">{client.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</p>
                        </div>
                      </div>
                      {selectedClient?.id === client.id && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400">
                  {clients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mb-2"></div>
                      <p>Carregando clientes...</p>
                    </div>
                  ) : clientSearchTerm ? (
                    'Nenhum cliente encontrado com este nome'
                  ) : (
                    'Nenhum cliente cadastrado'
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-between items-center mt-2 mb-4">
              <div className="text-xs text-gray-400">
                {filteredClients.length > 0 ? 
                  `${filteredClients.length} cliente${filteredClients.length !== 1 ? 's' : ''} encontrado${filteredClients.length !== 1 ? 's' : ''}` : 
                  ''}
              </div>
              <button
                onClick={fetchClients}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar lista
              </button>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNewProposalModal(false);
                  setSelectedClient(null);
                  setClientSearchTerm('');
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmNewProposal}
                disabled={!selectedClient}
                className={`px-4 py-2 text-white rounded-md ${
                  selectedClient
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-600/50 cursor-not-allowed'
                }`}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Duplicar Proposta */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Duplicar Proposta</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja duplicar a proposta <span className="font-medium text-indigo-400">{proposalToDuplicateNumber}</span>? Uma nova proposta será criada com os mesmos dados.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setProposalToDuplicate(null);
                  setProposalToDuplicateNumber(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
                disabled={duplicatingProposal}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (proposalToDuplicate) {
                    handleDuplicateProposal(proposalToDuplicate);
                  }
                }}
                disabled={duplicatingProposal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {duplicatingProposal ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Duplicando...
                  </div>
                ) : (
                  'Duplicar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Observação */}
      {showObservationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Adicionar Observação</h3>
            <p className="text-gray-300 mb-4">
              Adicione uma observação sobre esta proposta:
            </p>
            
            <div className="mb-4">
              <textarea
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                placeholder="Digite sua observação aqui..."
                className="bg-gray-900 border border-gray-700 text-white rounded-md w-full px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[100px]"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowObservationModal(false);
                  setProposalToAddObservation(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveObservation}
                disabled={!observationText.trim()}
                className={`px-4 py-2 text-white rounded-md ${
                  observationText.trim()
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-600/50 cursor-not-allowed'
                }`}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pendências */}
      {showPendencyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-semibold text-white mb-4">
              Adicionar Pendência
            </h3>
            <p className="text-gray-300 mb-4">
              Descreva a pendência que precisa ser resolvida para esta proposta:
            </p>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-md p-3 text-white mb-4 h-32"
              placeholder="Descreva a pendência aqui..."
              value={pendencyText}
              onChange={(e) => setPendencyText(e.target.value)}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPendencyModal(false);
                  setPendencyText('');
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitPendency}
                disabled={!pendencyText.trim() || loading}
                className={`px-4 py-2 rounded-md ${
                  !pendencyText.trim() || loading
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-[#01FBA1] text-black hover:bg-[#00e090]'
                }`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Salvando...
                  </span>
                ) : (
                  'Salvar Pendência'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão para criar nova proposta */}
      {isAdmin && (
        <button
          onClick={() => setShowNewProposalModal(true)}
          className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}