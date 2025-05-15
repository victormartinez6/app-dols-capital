import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, where, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Eye, Pencil, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import '../../styles/pipeline.css';
import { getClientContactInfo } from '../../services/getClientContactInfo';
import { useRolePermissions } from '../../hooks/useRolePermissions';

interface Proposal {
  id: string;
  proposalNumber: string;
  clientName: string;
  clientId: string;
  desiredCredit: number;
  hasProperty: boolean;
  propertyValue: number;
  status: 'pending' | 'approved' | 'rejected' | 'in_analysis';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract' | 'closed' | 'lost';
  createdAt: Date;
  userId: string;
  creditLine?: string;
  creditReason?: string;
  bankId?: string;
  bankName?: string;
  bankCommission?: string;
  observationsTimeline?: {
    id: string;
    text: string;
    createdAt: Date | string;
    createdBy: string;
    createdByName: string;
  }[];
  previousPipelineStatus?: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract' | 'closed' | 'lost';
  clientEmail?: string;
  clientPhone?: string;
  clientDDI?: string;
  clientType?: string;
  partnerEmail?: string;
}

const pipelineStatusLabels = {
  submitted: 'Cadastro Enviado',
  pre_analysis: 'Pré-Análise',
  credit: 'Crédito',
  legal: 'Jurídico/Imóvel',
  contract: 'Em Contrato',
  closed: 'Negócio Fechado',
  lost: 'Perdido',
};

const pipelineStatusColors = {
  submitted: 'bg-blue-500 border-blue-500',
  pre_analysis: 'bg-indigo-500 border-indigo-500',
  credit: 'bg-green-500 border-green-500',
  legal: 'bg-purple-500 border-purple-500',
  contract: 'bg-orange-500 border-orange-500',
  closed: 'bg-emerald-500 border-emerald-500',
  lost: 'bg-red-500 border-red-500',
};

// Cores para os badges de observações
const pipelineStatusBadgeColors = {
  submitted: 'bg-blue-500',
  pre_analysis: 'bg-indigo-500',
  credit: 'bg-green-500',
  legal: 'bg-purple-500',
  contract: 'bg-orange-500',
  closed: 'bg-emerald-500',
  lost: 'bg-red-500',
};

const pipelineStatusHeaderColors = {
  submitted: 'bg-gray-800 text-white border-t-4 border-t-blue-500',
  pre_analysis: 'bg-gray-800 text-white border-t-4 border-t-indigo-500',
  credit: 'bg-gray-800 text-white border-t-4 border-t-green-500',
  legal: 'bg-gray-800 text-white border-t-4 border-t-purple-500',
  contract: 'bg-gray-800 text-white border-t-4 border-t-orange-500',
  closed: 'bg-gray-800 text-white border-t-4 border-t-emerald-500',
  lost: 'bg-gray-800 text-white border-t-4 border-t-red-500',
};

const pipelineStatusOrder = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract', 'closed', 'lost'];

// Função auxiliar para processar documentos de propostas
const processProposalDocs = async (docs: any[]) => {
  const proposalsData = docs.map(doc => {
    const data = doc.data();
    // Verificar se o clientId existe e não está vazio
    if (!data.clientId || data.clientId.trim() === '') {
      console.error(`Proposta ${doc.id} com clientId inválido:`, data.clientId);
    }

    // Obter o nome do banco se o bankId existir
    let bankName = '';
    if (data.bankId) {
      bankName = data.bankName || 'Banco sem nome';
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
      bankCommission: data.bankCommission || '',
      observationsTimeline: data.observationsTimeline || [],
      previousPipelineStatus: data.previousPipelineStatus,
      clientEmail: data.clientEmail || '',
      clientPhone: data.clientPhone || '',
      clientDDI: data.clientDDI || '+55',
      clientType: data.clientType || '',
      partnerEmail: data.partnerEmail || '',
    };
  }) as Proposal[];

  return proposalsData;
};

export default function Pipeline() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bankFilter, setbankFilter] = useState('all');
  const [draggedProposal, setDraggedProposal] = useState<string | null>(null);
  const [banksList, setBanksList] = useState<{id: string, name: string}[]>([]);
  const [showObservationsModal, setShowObservationsModal] = useState(false);
  const [selectedObservations, setSelectedObservations] = useState<Proposal['observationsTimeline']>([]);
  const [selectedProposalNumber, setSelectedProposalNumber] = useState('');
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { getDataScope } = useRolePermissions();
  const proposalsScope = getDataScope('proposals'); // Pode ser 'all', 'team' ou 'own'

  // Estado para controlar se o acordeon de filtros está aberto ou fechado
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Função para alternar o estado do acordeon
  const toggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  useEffect(() => {
    fetchProposals();
    fetchBanks();
    
    // Adiciona uma classe específica para a página de Pipeline
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.classList.add('pipeline-page');
    }
    
    // Limpa ao desmontar o componente
    return () => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.classList.remove('pipeline-page');
      }
    };
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [proposals, searchFilter, statusFilter, bankFilter]);

  const fetchBanks = async () => {
    try {
      const banksSnapshot = await getDocs(collection(db, 'banks'));
      const banksData = banksSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().tradingName || doc.data().companyName || 'Banco sem nome'
      }));
      setBanksList(banksData);
    } catch (error) {
      console.error('Erro ao buscar bancos:', error);
    }
  };

  const applyFilters = () => {
    let result = [...proposals];
    
    // Filtro por texto (nome do cliente ou número da proposta)
    if (searchFilter) {
      result = result.filter(proposal => {
        const lowerSearch = searchFilter.toLowerCase();
        return (
          proposal.clientName?.toLowerCase().includes(lowerSearch) ||
          proposal.proposalNumber?.toLowerCase().includes(lowerSearch)
        );
      });
    }
    
    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(proposal => proposal.pipelineStatus === statusFilter);
    }
    
    // Filtro por banco
    if (bankFilter !== 'all') {
      result = result.filter(proposal => proposal.bankId === bankFilter);
    }
    
    setFilteredProposals(result);
  };

  const resetFilters = () => {
    setSearchFilter('');
    setStatusFilter('all');
    setbankFilter('all');
  };

  const fetchProposals = async () => {
    try {
      setLoading(true);
      
      // Adicionar logs para depuração
      console.log('Verificando permissões do usuário para Pipeline:', {
        roleKey: user?.roleKey,
        proposalsScope,
        hasTeam: !!user?.team,
        userId: user?.id
      });
      
      let q;

      if (proposalsScope === 'all') {
        console.log('Buscando todas as propostas (admin)');
        q = query(collection(db, 'proposals'));
      } else if (proposalsScope === 'team' && user?.team && user?.roleKey === 'manager') {
        console.log('Buscando propostas da equipe (gerente)');
        
        // Para gerentes, buscar todas as propostas e filtrar manualmente
        // para incluir as criadas pelo gerente e as da equipe dele
        try {
          console.log(`Gerente com equipe: ${user.team}`);
          
          // Buscar usuários da equipe
          const usersCollection = collection(db, 'users');
          const teamField = 'team'; // Ajuste conforme a estrutura do seu banco de dados
          const teamUsersQuery = query(usersCollection, where(teamField, '==', user.team));
          const teamUsersSnapshot = await getDocs(teamUsersQuery);
          
          // Buscar informações da equipe
          const teamDoc = await getDoc(doc(db, 'teams', user.team));
          if (teamDoc.exists()) {
            const teamData = teamDoc.data();
            const teamUserIds = teamUsersSnapshot.docs.map(doc => doc.id);
            const teamUserEmails = teamUsersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
            
            console.log(`Usuários encontrados na equipe: ${teamUserIds.length}`);
            console.log('IDs dos usuários da equipe:', teamUserIds);
            console.log('Emails dos usuários da equipe:', teamUserEmails);
            
            // Buscar todas as propostas
            const allProposalsRef = collection(db, 'proposals');
            const allProposalsSnapshot = await getDocs(allProposalsRef);
            console.log(`Total de propostas no banco: ${allProposalsSnapshot.size}`);
            
            // Filtrar propostas do gerente e da equipe
            const managerProposals: any[] = [];
            
            allProposalsSnapshot.forEach(doc => {
              const data = doc.data();
              let isMatch = false;
              
              // Verificar se a proposta pertence ao gerente ou a alguém da equipe
              // ou se o cliente está vinculado à equipe pelo teamName
              isMatch = data.userId === user.id || 
                       data.createdBy === user.email || 
                       data.inviterUserId === user.id || 
                       teamUserIds.includes(data.userId) || 
                       teamUserEmails.includes(data.createdBy) || 
                       teamUserEmails.includes(data.partnerEmail) || 
                       teamUserEmails.includes(data.clientEmail) ||
                       data.teamName === teamData.name ||
                       data.teamId === user.team;
              
              if (isMatch) {
                managerProposals.push({
                  id: doc.id,
                  proposalNumber: data.proposalNumber || `PROP-${doc.id.substring(0, 6).toUpperCase()}`,
                  ...data,
                  createdAt: data.createdAt?.toDate() || new Date(),
                  observationsTimeline: data.observationsTimeline || [],
                  pendencies: data.pendencies || [],
                  lastPendency: data.pendencies && data.pendencies.length > 0
                    ? data.pendencies[data.pendencies.length - 1]
                    : null
                });
              }
            });
            
            console.log(`Propostas filtradas para o gerente: ${managerProposals.length}`);
            setProposals(managerProposals);
            setFilteredProposals(managerProposals);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.error('Erro ao buscar propostas do gerente:', error);
          // Em caso de erro, continuar com a busca padrão
        }
        
        // Fallback: usar a query padrão
        q = query(collection(db, 'proposals'), where('team', '==', user.team));
      } else if (proposalsScope === 'team') {
        // Caso o usuário tenha permissão de visualizar propostas da equipe, 
        // mas não tenha um ID de equipe definido
        console.log('Usuário tem permissão para ver propostas da equipe, mas não tem equipe definida');
        // Buscar propostas criadas por este usuário
        // NOTA: createdBy armazena o email do usuário, não o ID
        q = query(collection(db, 'proposals'), where('createdBy', '==', user?.email));
        console.log(`Buscando propostas por createdBy (email): ${user?.email}`);
      } else if (proposalsScope === 'own') {
        console.log('Buscando apenas propostas próprias (cliente/parceiro)');
        // Verificar se o usuário é um parceiro para buscar também por partnerEmail
        if (user?.roleKey === 'partner' && user?.email) {
          console.log(`Usuário é parceiro, buscando propostas para: ${user.email} (ID: ${user.id})`);
          
          try {
            // Se for parceiro, buscar primeiro os clientes onde ele é o inviterUserId
            let clientIdsFromInviter: string[] = [];
            console.log('Buscando clientes onde o parceiro é o inviterUserId...');
            
            const clientsQuery = query(collection(db, 'registrations'), where('inviterUserId', '==', user.id));
            const clientsSnapshot = await getDocs(clientsQuery);
            console.log(`Encontrados ${clientsSnapshot.size} clientes onde o parceiro é o inviterUserId`);
            
            // Extrair IDs dos clientes
            clientIdsFromInviter = clientsSnapshot.docs.map(doc => doc.id);
            console.log('IDs dos clientes encontrados:', clientIdsFromInviter);
            
            // Buscar TODAS as propostas
            console.log('Buscando todas as propostas para filtrar manualmente...');
            const allProposalsRef = collection(db, 'proposals');
            const allProposalsSnapshot = await getDocs(allProposalsRef);
            console.log(`Total de propostas no banco: ${allProposalsSnapshot.size}`);
            
            // Filtrar propostas do parceiro
            const partnerProposals: any[] = [];
            
            allProposalsSnapshot.forEach(doc => {
              const data = doc.data();
              let isMatch = false;
              
              // Verificar se o clientId da proposta está na lista de clientes do parceiro
              const isClientFromPartner = clientIdsFromInviter.includes(data.clientId);
              console.log(`Proposta ${doc.id} - Cliente ${data.clientId} - É do parceiro? ${isClientFromPartner}`);
              
              isMatch = data.userId === user.id || 
                       data.createdBy === user.email || 
                       data.partnerEmail === user.email ||
                       data.inviterUserId === user.id || 
                       isClientFromPartner;
                       
              if (isMatch) {
                partnerProposals.push({
                  id: doc.id,
                  proposalNumber: data.proposalNumber || `PROP-${doc.id.substring(0, 6).toUpperCase()}`,
                  ...data,
                  createdAt: data.createdAt?.toDate() || new Date(),
                  observationsTimeline: data.observationsTimeline || [],
                  pendencies: data.pendencies || [],
                  lastPendency: data.pendencies && data.pendencies.length > 0
                    ? data.pendencies[data.pendencies.length - 1]
                    : null
                });
              }
            });
            
            console.log(`Propostas filtradas para o parceiro: ${partnerProposals.length}`);
            setProposals(partnerProposals);
            setFilteredProposals(partnerProposals);
            setLoading(false);
            return;
          } catch (error) {
            console.error('Erro ao buscar propostas do parceiro:', error);
            // Em caso de erro, continuar com a busca padrão
          }
        } else {
          // Para usuários normais, buscar por userId e createdBy
          console.log(`Buscando propostas por userId: ${user?.id} e createdBy: ${user?.email}`);
          q = query(collection(db, 'proposals'), where('userId', '==', user?.id));
        }
      } else {
        console.log('Usuário sem permissões para visualizar propostas');
        setProposals([]);
        setFilteredProposals([]);
        setLoading(false);
        return;
      }

      console.log('Executando consulta ao Firestore para buscar propostas');
      const querySnapshot = await getDocs(q);
      console.log(`Encontradas ${querySnapshot.size} propostas`);

      // Buscar todos os bancos para mapear IDs para nomes
      const banksSnapshot = await getDocs(collection(db, 'banks'));
      const banksMap = new Map();
      banksSnapshot.docs.forEach(doc => {
        const bankData = doc.data();
        // Preferir o Nome Fantasia, mas usar a Razão Social como fallback
        banksMap.set(doc.id, bankData.tradingName || bankData.companyName || 'Banco sem nome');
      });

      console.log('Mapa de bancos carregado:', Array.from(banksMap.entries()));

      const proposalsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Verificar se o clientId existe e não está vazio
        if (!data.clientId || data.clientId.trim() === '') {
          console.error(`Proposta ${doc.id} com clientId inválido:`, data.clientId);
        }

        // Obter o nome do banco se o bankId existir
        let bankName = '';
        if (data.bankId && banksMap.has(data.bankId)) {
          bankName = banksMap.get(data.bankId);
        }

        console.log('Proposta completa:', {
          id: doc.id,
          ...data,
          clientId: data.clientId || '',
          clientName: data.clientName || 'Nome não disponível',
          bankId: data.bankId || '',
          bankName: bankName
        });

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
          bankCommission: data.bankCommission || '',
          observationsTimeline: data.observationsTimeline || [],
          previousPipelineStatus: data.previousPipelineStatus,
          clientEmail: data.clientEmail || '',
          clientPhone: data.clientPhone || '',
          clientDDI: data.clientDDI || '+55',
          clientType: data.clientType || '',
          partnerEmail: data.partnerEmail || '',
        };
      }) as Proposal[];

      setProposals(proposalsData);
      setFilteredProposals(proposalsData);
    } catch (error) {
      console.error('Erro ao buscar propostas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (proposalId: string) => {
    // Parceiros não podem mover cards
    if (user?.roleKey === 'partner') return;
    
    setDraggedProposal(proposalId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Parceiros não podem mover cards
    if (user?.roleKey === 'partner') return;
    
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStatus: Proposal['pipelineStatus']) => {
    e.preventDefault();

    // Parceiros não podem mover cards
    if (user?.roleKey === 'partner') return;
    
    if (!draggedProposal) return;

    const proposal = proposals.find(p => p.id === draggedProposal);
    if (!proposal) return;

    if (proposal.pipelineStatus === targetStatus) {
      setDraggedProposal(null);
      return;
    }

    try {
      const proposalRef = doc(db, 'proposals', draggedProposal);

      const newObservation = {
        id: `obs_${Date.now()}`,
        text: `Proposta movida para ${pipelineStatusLabels[targetStatus]}${targetStatus === 'lost' ? ' (Negócio perdido)' : targetStatus === 'closed' ? ' (Negócio fechado com sucesso)' : ''}`,
        createdAt: new Date(),
        createdBy: user?.id || 'sistema',
        createdByName: user?.name || user?.email || 'Sistema',
      };

      // Salvar o status anterior para o webhook
      const previousPipelineStatus = proposal.pipelineStatus;

      // Importar o serviço de webhook
      const { webhookService } = await import('../../services/WebhookService');

      // Buscar os dados do cliente de forma centralizada
      let clientData: any = {};
      console.log('Tipo de cliente:', proposal.clientType);
      console.log('ID do cliente:', proposal.clientId);
      if (proposal.clientId && (proposal.clientType === 'PF' || proposal.clientType === 'PJ')) {
        const forcedType = proposal.clientType === 'PF' ? 'PF' : 'PJ';
        clientData = await getClientContactInfo(proposal.clientId, forcedType);
        console.log('DEBUG - getClientContactInfo chamada com:', proposal.clientId, forcedType);
      }
      console.log('Dados retornados pela função getClientContactInfo:', clientData);

      // Atualizar o documento no Firestore
      await updateDoc(proposalRef, {
        pipelineStatus: targetStatus,
        observationsTimeline: [...(proposal.observationsTimeline || []), newObservation],
      });

      // Atualizar o estado local
      const updatedProposal = {
        ...proposal,
        pipelineStatus: targetStatus,
        observationsTimeline: [...(proposal.observationsTimeline || []), newObservation],
      };

      // Atualizar o estado das propostas
      setProposals(prevProposals =>
        prevProposals.map(p =>
          p.id === draggedProposal
            ? updatedProposal
            : p
        )
      );

      // Enviar o webhook com as informações básicas necessárias e os dados do cliente
      // Adicionar a última pendência (observação) ao webhook
      let latestObservation = null;
      if (updatedProposal.observationsTimeline && updatedProposal.observationsTimeline.length > 0) {
        latestObservation = updatedProposal.observationsTimeline[updatedProposal.observationsTimeline.length - 1];
      }
      const webhookData = {
        id: proposal.id,
        proposalId: proposal.id,
        previousStatus: previousPipelineStatus,
        newStatus: targetStatus,
        pipelineStatus: targetStatus,
        status: proposal.status,
        clientName: proposal.clientName,
        clientType: proposal.clientType || '',
        userEmail: 'victor@cambiohoje.com.br',
        ...clientData, // Incluir todos os dados do cliente
        latestPending: latestObservation ? latestObservation.text : '' // Enviar apenas o texto da última pendência
      };
      console.log('Payload final do webhook:', webhookData);
      webhookService.sendPipelineStatusChanged(webhookData);
    } catch (error) {
      console.error('Erro ao atualizar status da proposta:', error);
    } finally {
      setDraggedProposal(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getProposalsByStatus = (status: Proposal['pipelineStatus']) => {
    return filteredProposals.filter(proposal => proposal.pipelineStatus === status);
  };

  // Função para mudar de coluna
  const handleColumnChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentColumnIndex > 0) {
      setCurrentColumnIndex(currentColumnIndex - 1);
    } else if (direction === 'next' && currentColumnIndex < pipelineStatusOrder.length - 1) {
      setCurrentColumnIndex(currentColumnIndex + 1);
    }
  };

  // Estado para controlar se estamos no cliente ou no servidor
  const [isMobile, setIsMobile] = useState(false);

  // Efeito para verificar o tamanho da tela e aplicar a transformação
  useEffect(() => {
    // Verificar se estamos no cliente
    setIsMobile(window.innerWidth <= 768);
    
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      const columnsElement = document.querySelector('.pipeline-columns');
      if (columnsElement && window.innerWidth <= 768) {
        (columnsElement as HTMLElement).style.transform = `translateX(-${currentColumnIndex * 100}%)`;
      } else if (columnsElement) {
        (columnsElement as HTMLElement).style.transform = '';
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Aplicar ao montar o componente

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [currentColumnIndex]);

  // Efeito para atualizar a transformação quando o índice da coluna muda
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const columnsElement = document.querySelector('.pipeline-columns');
      if (columnsElement && isMobile) {
        (columnsElement as HTMLElement).style.transform = `translateX(-${currentColumnIndex * 100}%)`;
      }
    }
  }, [currentColumnIndex, isMobile]);

  // Resetar o índice da coluna quando os filtros são aplicados
  useEffect(() => {
    setCurrentColumnIndex(0);
  }, [filteredProposals]);

  return (
    <div className="w-full box-border">
      <h2 className="text-2xl font-semibold text-white mb-6">Pipeline</h2>

      {/* Filtros */}
      <div className={`bg-black rounded-lg p-4 mb-6 w-full overflow-hidden border border-gray-800 box-border ${filtersOpen ? 'block' : 'hidden'}`}>
        <h3 className="text-lg font-medium text-white mb-4">Filtros</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
          {/* Filtro por data */}
          <div>
            <label htmlFor="dateFilter" className="block text-sm font-medium text-white mb-1">
              Data da Proposta
            </label>
            <input
              type="text"
              id="dateFilter"
              placeholder="dd/mm/aaaa"
              className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled
            />
          </div>
          
          {/* Filtro por texto */}
          <div>
            <label htmlFor="searchFilter" className="block text-sm font-medium text-white mb-1">
              Nome do Cliente
            </label>
            <input
              type="text"
              id="searchFilter"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar por nome..."
              className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          {/* Filtro por status */}
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
              {pipelineStatusOrder.map(status => (
                <option key={status} value={status}>
                  {pipelineStatusLabels[status as keyof typeof pipelineStatusLabels]}
                </option>
              ))}
            </select>
          </div>
          
          {/* Filtro por pipeline */}
          <div>
            <label htmlFor="pipelineFilter" className="block text-sm font-medium text-white mb-1">
              Status do Pipeline
            </label>
            <select
              id="pipelineFilter"
              value={bankFilter}
              onChange={(e) => setbankFilter(e.target.value)}
              className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              {banksList.map(bank => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Botão para limpar filtros */}
        {(searchFilter || statusFilter !== 'all' || bankFilter !== 'all') && (
          <button
            onClick={resetFilters}
            className="flex items-center mt-3 text-sm text-white hover:text-blue-300"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </button>
        )}
      </div>

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

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="relative">
          {/* Título e navegação mobile */}
          {isMobile && (
            <div className="flex justify-between items-center mb-4 px-4">
              <h3 className="text-lg font-medium text-white text-left">
                {pipelineStatusLabels[pipelineStatusOrder[currentColumnIndex] as keyof typeof pipelineStatusLabels]}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleColumnChange('prev')}
                  disabled={currentColumnIndex === 0}
                  className={`p-1 rounded-full ${
                    currentColumnIndex === 0 ? 'text-gray-600' : 'text-white hover:bg-gray-700'
                  }`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex space-x-1">
                  {pipelineStatusOrder.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentColumnIndex(index)}
                      className={`h-2 w-2 rounded-full ${
                        currentColumnIndex === index ? 'bg-blue-500' : 'bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => handleColumnChange('next')}
                  disabled={currentColumnIndex === pipelineStatusOrder.length - 1}
                  className={`p-1 rounded-full ${
                    currentColumnIndex === pipelineStatusOrder.length - 1
                      ? 'text-gray-600'
                      : 'text-white hover:bg-gray-700'
                  }`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
          
          {/* Container do Pipeline */}
          <div className="pipeline-container">
            <div className="pipeline-scroll">
              <div className="pipeline-columns">
                {pipelineStatusOrder.map((status) => (
                  <div 
                    key={status}
                    className="pipeline-column"
                  >
                    {/* Título da coluna - Visível apenas em desktop */}
                    <div className={`md:block hidden rounded-t-lg px-4 py-3 flex items-center justify-between ${pipelineStatusHeaderColors[status as keyof typeof pipelineStatusHeaderColors]}`}>
                      <h3 className="text-md font-medium flex items-center">
                        {pipelineStatusLabels[status as keyof typeof pipelineStatusLabels]}
                        <span className="ml-2 text-xs bg-black/30 rounded-full px-2 py-1">
                          {getProposalsByStatus(status as Proposal['pipelineStatus']).length}
                        </span>
                      </h3>
                    </div>

                    <div 
                      className={`flex-1 bg-gray-800/30 rounded-lg md:rounded-b-lg p-4 min-h-[calc(100vh-550px)] max-h-[calc(100vh-550px)] overflow-y-auto ${
                        draggedProposal ? 'border-2 border-dashed border-blue-400' : ''
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, status as Proposal['pipelineStatus'])}
                    >
                      {getProposalsByStatus(status as Proposal['pipelineStatus']).length > 0 ? (
                        <div className="space-y-4">
                          {getProposalsByStatus(status as Proposal['pipelineStatus']).map((proposal) => (
                            <div 
                              key={proposal.id} 
                              className={`bg-gray-900 rounded-lg shadow-md overflow-hidden ${user?.roleKey !== 'partner' ? 'cursor-move' : 'cursor-default'} mb-4 w-full box-border border border-gray-800 hover:shadow-lg transition-all`}
                              draggable={user?.roleKey !== 'partner'}
                              onDragStart={() => handleDragStart(proposal.id)}
                            >
                              {/* Indicador de status no topo do cartão */}
                              <div className={`h-1.5 w-full ${pipelineStatusColors[proposal.pipelineStatus].split(' ')[0]}`}></div>
                              
                              <div className="p-4 w-full box-border mobile-card-content">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-xs font-medium px-2 py-1 rounded bg-gray-800 text-white border border-gray-700 truncate max-w-[60%] proposal-number">
                                    {proposal.proposalNumber}
                                  </span>
                                  <div className="flex space-x-2 card-actions">
                                    <button
                                      onClick={() => navigate(`/proposals/detail/${proposal.id}`)}
                                      className="p-1.5 rounded-full hover:bg-gray-700 text-white"
                                      title="Editar proposta"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    
                                    {proposal.observationsTimeline && proposal.observationsTimeline.length > 0 && (
                                      <button
                                        onClick={() => {
                                          setSelectedObservations(proposal.observationsTimeline || []);
                                          setSelectedProposalNumber(proposal.proposalNumber);
                                          setShowObservationsModal(true);
                                        }}
                                        className="p-1.5 rounded-full hover:bg-gray-700 text-white relative"
                                        title="Ver observações"
                                      >
                                        <Eye className="h-4 w-4" />
                                        <span className={`absolute -top-1 -right-1 ${pipelineStatusBadgeColors[proposal.pipelineStatus]} text-white text-xs rounded-full h-4 w-4 flex items-center justify-center`}>
                                          {proposal.observationsTimeline.length}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                <h4 className="font-semibold text-white mb-2 truncate">
                                  <button 
                                    onClick={() => navigate(`/clients/detail/${proposal.clientId}`)}
                                    className="hover:text-blue-400 transition-colors text-left"
                                  >
                                    {proposal.clientName}
                                  </button>
                                </h4>
                                
                                {proposal.bankName && (
                                  <div className="mb-2">
                                    <span className="bg-gray-800 px-2 py-1 rounded text-xs text-gray-300 inline-block truncate max-w-full">
                                      {proposal.bankName}
                                    </span>
                                  </div>
                                )}
                                
                                <div className="flex justify-between items-center">
                                  <span className="text-blue-400 font-medium truncate">
                                    {formatCurrency(proposal.desiredCredit)}
                                  </span>
                                  <div className="text-xs text-gray-400">
                                    {(() => {
                                      try {
                                        // Verificar se é um objeto com método toDate()
                                        if (proposal.createdAt && typeof proposal.createdAt === 'object' && 'toDate' in proposal.createdAt) {
                                          const firestoreTimestamp = proposal.createdAt as { toDate(): Date };
                                          return format(firestoreTimestamp.toDate(), 'dd/MM/yyyy', { locale: ptBR });
                                        }
                                        // Verificar se é um objeto Date
                                        else if (proposal.createdAt instanceof Date) {
                                          return format(proposal.createdAt, 'dd/MM/yyyy', { locale: ptBR });
                                        }
                                        // Verificar se é um timestamp numérico
                                        else if (typeof proposal.createdAt === 'number') {
                                          return format(new Date(proposal.createdAt), 'dd/MM/yyyy', { locale: ptBR });
                                        }
                                        // Verificar se é uma string ISO
                                        else if (typeof proposal.createdAt === 'string') {
                                          return format(new Date(proposal.createdAt), 'dd/MM/yyyy', { locale: ptBR });
                                        }
                                        return 'Data não disponível';
                                      } catch (error) {
                                        console.error('Erro ao formatar data:', error, proposal.createdAt);
                                        return 'Data não disponível';
                                      }
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-500 text-sm">Nenhuma proposta</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Observações */}
      {showObservationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-medium text-white">
                Observações - {selectedProposalNumber}
              </h3>
              <button
                onClick={() => setShowObservationsModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {selectedObservations && selectedObservations.length > 0 ? (
                <div className="space-y-4">
                  {selectedObservations.map((observation) => (
                    <div key={observation.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                      <p className="text-sm text-white mb-2">{observation.text}</p>
                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>{observation.createdByName}</span>
                        <span>
                          {(() => {
                            try {
                              // Verificar se é um objeto com método toDate()
                              if (observation.createdAt && typeof observation.createdAt === 'object' && 'toDate' in observation.createdAt) {
                                const firestoreTimestamp = observation.createdAt as { toDate(): Date };
                                return format(firestoreTimestamp.toDate(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
                              }
                              // Verificar se é um objeto Date
                              else if (observation.createdAt instanceof Date) {
                                return format(observation.createdAt, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
                              }
                              // Verificar se é um timestamp numérico
                              else if (typeof observation.createdAt === 'number') {
                                return format(new Date(observation.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
                              }
                              // Verificar se é uma string ISO
                              else if (typeof observation.createdAt === 'string') {
                                return format(new Date(observation.createdAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
                              }
                              // Fallback para data atual
                              return format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
                            } catch (error) {
                              console.error('Erro ao formatar data:', error, observation.createdAt);
                              return 'Data não disponível';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-400">Nenhuma observação encontrada.</p>
              )}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowObservationsModal(false)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}