import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, where, updateDoc, getDoc, addDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Eye, Pencil, Trash2, Search, X, Calendar, CheckCircle, XCircle, Clock, AlertTriangle, Plus, User, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { Team } from '../../types';

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
  const [teamFilter, setTeamFilter] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
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
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [clientSearchText, setClientSearchText] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showPendencyModal, setShowPendencyModal] = useState(false);
  const [pendencyText, setPendencyText] = useState('');
  const [proposalForPendency, setProposalForPendency] = useState<string | null>(null);
  
  // Estado para armazenar os bancos parceiros
  const [banks, setBanks] = useState<any[]>([]);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    canViewPage,
    canPerformAction,
    getDataScope
  } = useRolePermissions();
  
  // Armazenar os resultados das funções do hook useRolePermissions em variáveis
  const canViewProposals = canViewPage('proposals');
  const canCreateProposals = canPerformAction('proposals', 'create');
  const canEditProposals = canPerformAction('proposals', 'edit');
  const canDeleteProposals = canPerformAction('proposals', 'delete');
  const proposalsScope = getDataScope('proposals');
  const clientsScope = getDataScope('clients');
  
  // Log para verificar as permissões do parceiro
  console.log('==== PERMISSÕES DO USUÁRIO ====');
  console.log('canViewProposals:', canViewProposals);
  console.log('proposalsScope:', proposalsScope);
  console.log('==============================');

  useEffect(() => {
    console.log('[Ciclo de Vida] Verificando proposalsScope:', proposalsScope);
    if (!proposalsScope) {
      console.log('[Ciclo de Vida] Redirecionando para unauthorized - proposalsScope não definido');
      navigate('/unauthorized');
    } else {
      console.log('[Ciclo de Vida] proposalsScope definido:', proposalsScope);
    }
  }, [proposalsScope, navigate]);

  useEffect(() => {
    console.log('[Ciclo de Vida] useEffect de carregamento de dados - proposalsScope:', proposalsScope);
    
    // Forçar carregamento para parceiros, independentemente das permissões
    if (user?.roleKey === 'partner') {
      console.log('[SOLUCAO EMERGENCIAL] Forçando carregamento para parceiro, ignorando proposalsScope');
      fetchProposals();
      fetchTeams();
      fetchBanks();
      return;
    }
    
    // Fluxo normal para outros usuários
    if (!proposalsScope) {
      console.log('[Ciclo de Vida] Ignorando carregamento - proposalsScope não definido');
      return;
    }
    console.log('[Ciclo de Vida] Iniciando carregamento de dados...');
    fetchProposals();
    fetchTeams();
    fetchBanks();
  }, [proposalsScope, user?.roleKey]);

  useEffect(() => {
    applyFilters();
  }, [proposals, clientNameFilter, statusFilter, pipelineStatusFilter, dateFilter, teamFilter]);

  const fetchTeams = async () => {
    try {
      const teamsCollection = collection(db, 'teams');
      const teamsSnapshot = await getDocs(teamsCollection);

      const teamsData = teamsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Team[];

      setTeams(teamsData);
    } catch (err) {
      console.error('Erro ao buscar equipes:', err);
    }
  };

  const fetchProposals = async () => {
    try {
      console.log('INICIANDO fetchProposals');
      setLoading(true);
      
      // Adicionar logs detalhados para debug
      console.log('=== DIAGNÓSTICO DE PROPOSTAS ===');
      console.log('Usuário atual:', user);
      console.log('Role do usuário:', user?.roleKey);
      console.log('Permissão para ver propostas:', canViewProposals);
      console.log('Escopo de propostas:', proposalsScope);
      console.log('==============================');
      
      // Verificar se o usuário está autenticado
      if (!user || !user.email) {
        console.error('Usuário não autenticado ou sem email');
        setLoading(false);
        return;
      }
      
      // SOLUCAO EMERGENCIAL: Tratar parceiros, clientes e gerentes de forma especial, independente das permissões
      if (user.roleKey === 'partner' || user.roleKey === 'client' || user.roleKey === 'manager') {
        console.log(`TRATAMENTO ESPECIAL PARA ${user.roleKey.toUpperCase()}`);
        console.log('ID do usuário:', user.id);
        console.log('Email do usuário:', user.email);
        
        // Se for parceiro, buscar primeiro os clientes onde ele é o inviterUserId
        let clientIdsFromInviter = [];
        if (user.roleKey === 'partner') {
          console.log('Buscando clientes onde o parceiro é o inviterUserId...');
          try {
            const clientsQuery = query(collection(db, 'registrations'), where('inviterUserId', '==', user.id));
            const clientsSnapshot = await getDocs(clientsQuery);
            console.log(`Encontrados ${clientsSnapshot.size} clientes onde o parceiro é o inviterUserId`);
            
            // Extrair IDs dos clientes
            clientIdsFromInviter = clientsSnapshot.docs.map(doc => doc.id);
            console.log('IDs dos clientes encontrados:', clientIdsFromInviter);
          } catch (err) {
            console.error('Erro ao buscar clientes do parceiro:', err);
          }
        }
        
        // Buscar TODAS as propostas
        console.log('Buscando todas as propostas para filtrar manualmente...');
        const allProposalsRef = collection(db, 'proposals');
        const allProposalsSnapshot = await getDocs(allProposalsRef);
        console.log(`Total de propostas no banco: ${allProposalsSnapshot.size}`);
        
        // Mostrar todas as propostas encontradas para debug
        console.log('=== TODAS AS PROPOSTAS ENCONTRADAS ===');
        allProposalsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`Proposta ID: ${doc.id}`);
          console.log(`- userId: ${data.userId || 'N/A'}`);
          console.log(`- createdBy: ${data.createdBy || 'N/A'}`);
          console.log(`- partnerEmail: ${data.partnerEmail || 'N/A'}`);
          console.log(`- inviterUserId: ${data.inviterUserId || 'N/A'}`);
          console.log(`- clientId: ${data.clientId || 'N/A'}`);
          console.log(`- clientName: ${data.clientName || 'N/A'}`);
        });
        console.log('===================================');
        
        // Filtrar propostas do usuário (parceiro, cliente ou gerente)
        const userProposals = [];
        
        // Se for gerente, buscar primeiro os usuários da equipe
        let teamUserIds = [];
        let teamUserEmails = [];
        let teamData = null;
        
        if (user.roleKey === 'manager' && user.team) {
          console.log(`Buscando usuários da equipe do gerente: ${user.team}`);
          const usersCollection = collection(db, 'users');
          // Verificar se o campo no banco de dados é 'team' ou 'teamId'
          const teamField = 'team'; // Ajuste conforme a estrutura do seu banco de dados
          const teamUsersQuery = query(usersCollection, where(teamField, '==', user.team));
          const teamUsersSnapshot = await getDocs(teamUsersQuery);
          
          // Buscar informações da equipe
          try {
            const teamDoc = await getDoc(doc(db, 'teams', user.team));
            if (teamDoc.exists()) {
              teamData = teamDoc.data();
              console.log('Dados da equipe encontrados:', teamData);
            }
          } catch (error) {
            console.error('Erro ao buscar dados da equipe:', error);
          }
          
          teamUserIds = teamUsersSnapshot.docs.map(doc => doc.id);
          teamUserEmails = teamUsersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
          
          console.log(`Usuários encontrados na equipe: ${teamUserIds.length}`);
          console.log('IDs dos usuários da equipe:', teamUserIds);
          console.log('Emails dos usuários da equipe:', teamUserEmails);
        }
        
        allProposalsSnapshot.forEach(doc => {
          const data = doc.data();
          console.log('Estrutura completa da proposta:', doc.id, data);
          let isMatch = false;
          
          // Verificar se a proposta pertence ao usuário
          if (user.roleKey === 'partner') {
            // Critérios para parceiros
            // Parceiro ve tudo que ele criar e todos os que forem como ele "inviterUserId"
            console.log('Verificando proposta:', doc.id);
            console.log('- userId na proposta:', data.userId);
            console.log('- createdBy na proposta:', data.createdBy);
            console.log('- partnerEmail na proposta:', data.partnerEmail);
            console.log('- inviterUserId na proposta:', data.inviterUserId);
            console.log('- clientId na proposta:', data.clientId);
            console.log('- ID do parceiro:', user.id);
            console.log('- Email do parceiro:', user.email);
            
            // Verificar se o clientId da proposta está na lista de clientes do parceiro
            const isClientFromPartner = clientIdsFromInviter.includes(data.clientId);
            console.log('Cliente é do parceiro?', isClientFromPartner);
            
            isMatch = data.userId === user.id || 
                     data.createdBy === user.email || 
                     data.partnerEmail === user.email ||
                     data.inviterUserId === user.id || // Adicionado para atender ao requisito
                     isClientFromPartner; // Adicionado para incluir propostas de clientes do parceiro
                     
            console.log('Proposta corresponde aos critérios?', isMatch);
          } else if (user.roleKey === 'client') {
            // Critérios para clientes
            isMatch = data.userId === user.id || 
                     data.createdBy === user.email || 
                     data.clientId === user.id || 
                     data.clientEmail === user.email;
          } else if (user.roleKey === 'manager') {
            // Critérios para gerentes - propostas dele, propostas onde ele é o inviterUserId,
            // ou propostas vinculadas à equipe dele
            isMatch = data.userId === user.id || 
                     data.createdBy === user.email || 
                     data.inviterUserId === user.id || 
                     teamUserIds.includes(data.userId) || 
                     teamUserEmails.includes(data.createdBy) || 
                     teamUserEmails.includes(data.partnerEmail) || 
                     teamUserEmails.includes(data.clientEmail) ||
                     data.teamName === teamData?.name ||
                     data.teamId === user.team;
          }
          
          if (isMatch) {
            console.log(`Proposta encontrada para ${user.roleKey}: ${doc.id}`);
            userProposals.push({
              id: doc.id,
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
        
        console.log(`Propostas filtradas para o ${user.roleKey}: ${userProposals.length}`);
        console.log('Propostas encontradas:', userProposals);
        
        setProposals(userProposals);
        setFilteredProposals(userProposals);
        setLoading(false);
        return;
      }
      
      // Fluxo normal para outros usuários
      if (canViewProposals) {
        let proposalsQuery;

        if (proposalsScope === 'all') {
          // Administrador vê todas as propostas
          proposalsQuery = query(collection(db, 'proposals'));
        } else if (proposalsScope === 'team' && user?.teamId) {
          // Gerente vê propostas da sua equipe
          // Primeiro, buscar os usuários da equipe
          const usersCollection = collection(db, 'users');
          // Verificar se o campo no banco de dados é 'team' ou 'teamId'
          const teamField = 'team'; // Ajuste conforme a estrutura do seu banco de dados
          const teamUsersQuery = query(usersCollection, where(teamField, '==', user.teamId));
          const teamUsersSnapshot = await getDocs(teamUsersQuery);
          const teamUserIds = teamUsersSnapshot.docs.map(doc => doc.id);

          // Depois, buscar as propostas desses usuários
          proposalsQuery = query(collection(db, 'proposals'), where('userId', 'in', teamUserIds));
        } else {
          // Cliente vê apenas suas próprias propostas
          console.log('Buscando apenas propostas próprias (cliente/parceiro)');
          
          // ABORDAGEM SIMPLIFICADA PARA PARCEIROS
          if (user?.roleKey === 'partner' && user?.email) {
            console.log('=== ABORDAGEM SIMPLIFICADA PARA PARCEIROS ===');
            console.log(`Parceiro: ${user.email}, ID: ${user.id}`);
            
            // Buscar TODAS as propostas primeiro
            const allProposalsQuery = query(collection(db, 'proposals'));
            const allProposalsSnapshot = await getDocs(allProposalsQuery);
            console.log(`Total de propostas no sistema: ${allProposalsSnapshot.docs.length}`);
            
            // Filtrar manualmente as propostas que pertencem ao parceiro
            const partnerProposals = allProposalsSnapshot.docs.filter(doc => {
              const data = doc.data();
              const matchesUserId = data.userId === user.id;
              const matchesCreatedBy = data.createdBy === user.email;
              const matchesPartnerEmail = data.partnerEmail === user.email;
              
              return matchesUserId || matchesCreatedBy || matchesPartnerEmail;
            });
            
            console.log(`Propostas filtradas para o parceiro: ${partnerProposals.length}`);
            
            // Logar cada proposta encontrada
            partnerProposals.forEach((doc, index) => {
              const data = doc.data();
              console.log(`Proposta ${index + 1}:`, {
                id: doc.id,
                proposalNumber: data.proposalNumber || 'Sem número',
                clientName: data.clientName || 'Sem nome',
                createdBy: data.createdBy || 'N/A',
                userId: data.userId || 'N/A',
                partnerEmail: data.partnerEmail || 'N/A'
              });
            });
            
            // Processar as propostas encontradas
            const proposalsData = await Promise.all(
              partnerProposals.map(async (doc) => {
                const data = doc.data();
                
                // Processar dados da proposta
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
                  bankName: data.bankName || '',
                  bankTradingName: data.bankTradingName || '',
                  teamId: data.teamId || '',
                  teamName: data.teamName || '',
                  teamCode: data.teamCode || '',
                  observationsTimeline: data.observationsTimeline || [],
                  pendencies: data.pendencies || [],
                  lastPendency: data.pendencies && data.pendencies.length > 0
                    ? data.pendencies[data.pendencies.length - 1]
                    : null
                } as Proposal;
              })
            );
            
            console.log(`Processamento concluído. Total de propostas processadas: ${proposalsData.length}`);
            console.log('Atualizando estado com as propostas processadas...');
            
            setProposals(proposalsData);
            setFilteredProposals(proposalsData);
            console.log('Estado atualizado com sucesso!');
            setLoading(false);
            return;
          } else {
            // Usar uma consulta composta para verificar tanto userId quanto clientId
            console.log(`Buscando propostas para usuário regular: ${user?.id}`);
            
            // Consulta principal por userId
            const userIdQuery = query(collection(db, 'proposals'), where('userId', '==', user.id));
            
            // Consulta alternativa por createdBy (email)
            const createdByQuery = query(collection(db, 'proposals'), where('createdBy', '==', user.email));
            
            // Consulta para clientes
            const clientIdQuery = query(collection(db, 'proposals'), where('clientId', '==', user.id));
            
            // Executar todas as consultas e combinar os resultados
            const userIdSnapshot = await getDocs(userIdQuery);
            const createdBySnapshot = await getDocs(createdByQuery);
            const clientIdSnapshot = await getDocs(clientIdQuery);
            
            // Combinar os resultados (removendo duplicatas)
            const proposalDocs = [...userIdSnapshot.docs];
            
            // Adicionar documentos da consulta createdBy
            createdBySnapshot.docs.forEach(doc => {
              if (!proposalDocs.some(existingDoc => existingDoc.id === doc.id)) {
                proposalDocs.push(doc);
              }
            });
            
            // Adicionar documentos da consulta clientId
            clientIdSnapshot.docs.forEach(doc => {
              if (!proposalDocs.some(existingDoc => existingDoc.id === doc.id)) {
                proposalDocs.push(doc);
              }
            });
          }
          
          // Criar um snapshot personalizado com os documentos combinados
          const proposalsSnapshot = {
            docs: proposalDocs,
            size: proposalDocs.length,
            empty: proposalDocs.length === 0,
            forEach: (callback: (doc: any) => void) => proposalDocs.forEach(callback)
          };
          
          // Retornar imediatamente com os resultados combinados
          const proposalsData = await Promise.all(
            proposalsSnapshot.docs.map(async (docSnapshot) => {
              const data = docSnapshot.data();

              // Buscar informações do usuário para obter a equipe
              let teamId = '';
              let teamName = '';
              let teamCode = '';

              try {
                // Verificar se a proposta já tem código e nome da equipe diretamente
                if (data.teamCode && data.teamName) {
                  teamCode = data.teamCode;
                  teamName = data.teamName;
                } else if (data && data.userId) {
                  const userDoc = await getDoc(doc(db, 'users', data.userId));
                  if (userDoc.exists() && userDoc.data().teamId) {
                    teamId = userDoc.data().teamId;

                    // Buscar nome da equipe
                    const teamDoc = await getDoc(doc(db, 'teams', teamId));
                    if (teamDoc.exists()) {
                      teamName = teamDoc.data().name;
                      teamCode = teamDoc.data().teamCode || '';
                    }
                  }
                }

                // Buscar informações do banco se bankId existir
                let bankName = data.bankName || '';
                let bankTradingName = data.bankTradingName || '';
                
                if (data && data.bankId) {
                  const bankDoc = await getDoc(doc(db, 'banks', data.bankId));
                  if (bankDoc.exists()) {
                    const bankData = bankDoc.data();
                    bankName = bankData.companyName || data.bankName || '';
                    bankTradingName = bankData.tradingName || data.bankTradingName || '';
                  }
                }

                return {
                  id: docSnapshot.id,
                  ...data,
                  teamId,
                  teamName,
                  teamCode,
                  bankName,
                  bankTradingName,
                  createdAt: data.createdAt,
                  observationsTimeline: data.observationsTimeline || [],
                  pendencies: data.pendencies || [],
                  lastPendency: data.pendencies && data.pendencies.length > 0
                    ? data.pendencies[data.pendencies.length - 0]
                    : null
                } as Proposal & { teamId: string; teamName: string; teamCode: string };
              } catch (error) {
                console.error('Erro ao processar proposta:', error);
                return {
                  id: docSnapshot.id,
                  ...data,
                  teamId: '',
                  teamName: '',
                  teamCode: '',
                  createdAt: data.createdAt,
                  observationsTimeline: data.observationsTimeline || [],
                  pendencies: data.pendencies || []
                } as Proposal & { teamId: string; teamName: string; teamCode: string };
              }
            })
          );

          setProposals(proposalsData);
          setLoading(false);
          return;
        }

        const proposalsSnapshot = await getDocs(proposalsQuery);

        const proposalsData = await Promise.all(
          proposalsSnapshot.docs.map(async (docSnapshot) => {
            const data = docSnapshot.data();

            // Buscar informações do usuário para obter a equipe
            let teamId = '';
            let teamName = '';
            let teamCode = '';

            try {
              // Verificar se userId existe antes de tentar acessá-lo
              if (data && data.userId) {
                const userDoc = await getDoc(doc(db, 'users', data.userId));
                if (userDoc.exists() && userDoc.data().teamId) {
                  teamId = userDoc.data().teamId;

                  // Buscar nome da equipe
                  const teamDoc = await getDoc(doc(db, 'teams', teamId));
                  if (teamDoc.exists()) {
                    teamName = teamDoc.data().name;
                    teamCode = teamDoc.data().teamCode || '';
                  }
                }
              }

              // Verificar se a proposta já tem código e nome da equipe diretamente
              if (data.teamCode && data.teamName) {
                teamCode = data.teamCode;
                teamName = data.teamName;
              }

              // Buscar informações do banco se bankId existir
              let bankName = data.bankName || '';
              let bankTradingName = data.bankTradingName || '';
              
              if (data && data.bankId) {
                const bankDoc = await getDoc(doc(db, 'banks', data.bankId));
                if (bankDoc.exists()) {
                  const bankData = bankDoc.data();
                  bankName = bankData.companyName || data.bankName || '';
                  bankTradingName = bankData.tradingName || data.bankTradingName || '';
                }
              }

              return {
                id: docSnapshot.id,
                ...data,
                teamId,
                teamName,
                teamCode,
                bankName,
                bankTradingName,
                createdAt: data.createdAt,
                observationsTimeline: data.observationsTimeline || [],
                pendencies: data.pendencies || [],
                lastPendency: data.pendencies && data.pendencies.length > 0
                  ? data.pendencies[data.pendencies.length - 1]
                  : null
              } as Proposal & { teamId: string; teamName: string; teamCode: string };
            } catch (err) {
              console.error('Erro ao buscar equipe para usuário:', err);
              return {
                id: docSnapshot.id,
                ...data,
                teamId: '',
                teamName: '',
                teamCode: '',
                bankName: data.bankName || '',
                bankTradingName: data.bankTradingName || '',
                createdAt: data.createdAt,
                observationsTimeline: data.observationsTimeline || [],
                pendencies: data.pendencies || [],
                lastPendency: data.pendencies && data.pendencies.length > 0
                  ? data.pendencies[data.pendencies.length - 1]
                  : null
              } as Proposal & { teamId: string; teamName: string; teamCode: string };
            }
          })
        );

        setProposals(proposalsData);
        setFilteredProposals(proposalsData);
      }
    } catch (err) {
      console.error('Erro ao buscar propostas:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...proposals];

    // Filtro por nome do cliente
    if (clientNameFilter) {
      const searchTerm = clientNameFilter.toLowerCase();
      result = result.filter(proposal =>
        proposal.clientName.toLowerCase().includes(searchTerm)
      );
    }

    // Filtro por status
    if (statusFilter !== 'all') {
      result = result.filter(proposal => proposal.status === statusFilter);
    }

    // Filtro por status do pipeline
    if (pipelineStatusFilter !== 'all') {
      result = result.filter(proposal => proposal.pipelineStatus === pipelineStatusFilter);
    }

    // Filtro por data
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      result = result.filter(proposal => {
        const proposalDate = proposal.createdAt instanceof Date
          ? proposal.createdAt
          : new Date(proposal.createdAt);
        return proposalDate.toDateString() === filterDate.toDateString();
      });
    }

    // Filtro por equipe
    if (teamFilter) {
      result = result.filter(proposal => (proposal as any).teamId === teamFilter);
    }

    setFilteredProposals(result);
  };

  const resetFilters = () => {
    setClientNameFilter('');
    setStatusFilter('all');
    setPipelineStatusFilter('all');
    setDateFilter('');
    setTeamFilter('');
  };

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

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função para formatar datas de forma segura
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return 'Data não disponível';
    
    try {
      // Se já for uma instância de Date, use-a diretamente
      if (dateValue instanceof Date) {
        return format(dateValue, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
      
      // Se for um objeto do Firestore com método toDate()
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue && typeof dateValue.toDate === 'function') {
        return format(dateValue.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
      
      // Se for uma string ISO ou timestamp
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
      }
      
      return 'Data inválida';
    } catch (error) {
      console.error('Erro ao formatar data:', error, dateValue);
      return 'Erro na data';
    }
  };

  const handleCreateNewProposal = () => {
    setShowNewProposalModal(true);
    setClientSearchText('');
    setSelectedClient(null);
  };

  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
  };

  const handleConfirmNewProposal = () => {
    if (selectedClient) {
      setShowNewProposalModal(false);
      navigate(`/proposals/new/${selectedClient.id}`);
    }
  };

  const fetchClients = async () => {
    try {
      console.log('Iniciando busca de clientes...');
      setFilteredClients([]); // Limpa a lista enquanto carrega
      
      let q;
      
      // Se for parceiro, buscar apenas clientes que ele criou ou onde ele é o inviterUserId
      if (user?.roleKey === 'partner') {
        console.log('Usuário é parceiro, buscando apenas clientes relacionados...');
        q = query(collection(db, 'registrations'), 
          where('inviterUserId', '==', user.id));
      } else if (user?.roleKey === 'manager') {
        // Para gerentes, buscar apenas clientes que ele criou ou onde ele é o inviterUserId
        console.log('Usuário é gerente, buscando apenas clientes relacionados...');
        q = query(collection(db, 'registrations'), 
          where('inviterUserId', '==', user.id));
      } else {
        // Para outros usuários, buscar todos os clientes
        q = query(collection(db, 'registrations'));
      }
      
      const querySnapshot = await getDocs(q);
      console.log(`Encontrados ${querySnapshot.docs.length} registros de clientes.`);
      
      // Buscar clientes adicionais com base no papel do usuário
      let allDocs = [...querySnapshot.docs];
      
      if (user?.roleKey === 'partner' && user?.email) {
        console.log('Buscando clientes criados pelo parceiro...');
        const createdByQuery = query(collection(db, 'registrations'), 
          where('createdBy', '==', user.email));
        const createdBySnapshot = await getDocs(createdByQuery);
        
        // Adicionar documentos sem duplicatas
        createdBySnapshot.docs.forEach(doc => {
          if (!allDocs.some(existingDoc => existingDoc.id === doc.id)) {
            allDocs.push(doc);
          }
        });
        
        console.log(`Total de clientes após incluir criados pelo parceiro: ${allDocs.length}`);
      } else if (user?.roleKey === 'manager') {
        // Para gerentes, buscar também clientes criados por ele
        console.log('Buscando clientes criados pelo gerente...');
        const createdByQuery = query(collection(db, 'registrations'), 
          where('createdBy', '==', user.email));
        const createdBySnapshot = await getDocs(createdByQuery);
        
        // Adicionar documentos sem duplicatas
        createdBySnapshot.docs.forEach(doc => {
          if (!allDocs.some(existingDoc => existingDoc.id === doc.id)) {
            allDocs.push(doc);
          }
        });
        
        console.log(`Total de clientes após incluir criados pelo gerente: ${allDocs.length}`);
        
        // Se o gerente tem uma equipe, buscar clientes vinculados à equipe dele
        if (user.team) {
          try {
            console.log(`Buscando informações da equipe do gerente: ${user.team}`);
            const teamDoc = await getDoc(doc(db, 'teams', user.team));
            
            if (teamDoc.exists()) {
              const teamData = teamDoc.data();
              console.log('Dados da equipe encontrados:', teamData);
              
              // Buscar clientes vinculados à equipe pelo teamName
              if (teamData.name) {
                console.log(`Buscando clientes vinculados à equipe ${teamData.name}...`);
                const teamClientsQuery = query(collection(db, 'registrations'), 
                  where('teamName', '==', teamData.name));
                const teamClientsSnapshot = await getDocs(teamClientsQuery);
                
                // Adicionar documentos sem duplicatas
                teamClientsSnapshot.docs.forEach(doc => {
                  if (!allDocs.some(existingDoc => existingDoc.id === doc.id)) {
                    allDocs.push(doc);
                  }
                });
              }
              
              // Buscar clientes vinculados à equipe pelo teamId
              console.log(`Buscando clientes vinculados ao teamId ${user.team}...`);
              const teamIdClientsQuery = query(collection(db, 'registrations'), 
                where('teamId', '==', user.team));
              const teamIdClientsSnapshot = await getDocs(teamIdClientsQuery);
              
              // Adicionar documentos sem duplicatas
              teamIdClientsSnapshot.docs.forEach(doc => {
                if (!allDocs.some(existingDoc => existingDoc.id === doc.id)) {
                  allDocs.push(doc);
                }
              });
              
              // Buscar membros da equipe
              const teamMembers = teamData.members || [];
              if (teamMembers.length > 0) {
                console.log(`Buscando clientes criados pelos membros da equipe...`);
                
                // Para cada membro da equipe, buscar clientes criados por ele
                for (const memberId of teamMembers) {
                  // Buscar informações do membro para obter o email
                  const memberDoc = await getDoc(doc(db, 'users', memberId));
                  if (memberDoc.exists()) {
                    const memberEmail = memberDoc.data().email;
                    if (memberEmail) {
                      // Buscar clientes criados pelo membro
                      const memberClientsQuery = query(collection(db, 'registrations'), 
                        where('createdBy', '==', memberEmail));
                      const memberClientsSnapshot = await getDocs(memberClientsQuery);
                      
                      // Adicionar documentos sem duplicatas
                      memberClientsSnapshot.docs.forEach(doc => {
                        if (!allDocs.some(existingDoc => existingDoc.id === doc.id)) {
                          allDocs.push(doc);
                        }
                      });
                    }
                  }
                }
              }
              
              console.log(`Total de clientes após incluir da equipe: ${allDocs.length}`);
            }
          } catch (error) {
            console.error('Erro ao buscar clientes da equipe do gerente:', error);
          }
        }
      }
      
      const clientsData = allDocs.map(doc => {
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
          inviterUserId: data.inviterUserId,
          createdBy: data.createdBy
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

  useEffect(() => {
    if (showNewProposalModal) {
      fetchClients();
    }
  }, [showNewProposalModal]);

  useEffect(() => {
    if (clientSearchText) {
      const filtered = clients.filter(client => 
        client.name.toLowerCase().includes(clientSearchText.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [clientSearchText, clients]);

  const handleViewProposal = (proposalId: string) => {
    navigate(`/proposals/detail/${proposalId}`);
  };

  const handleEditProposal = (proposalId: string) => {
    navigate(`/proposals/edit/${proposalId}`);
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
        let clientStatus = 'pending';
        
        // Determinar o status do cliente com base no status da proposta
        if (status === 'with_pendencies') {
          clientStatus = 'documents_pending';
        } else if (status === 'approved') {
          clientStatus = 'complete';
        }
        
        await updateDoc(clientRef, {
          status: clientStatus,
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

  const handleSubmitPendency = async () => {
    if (!proposalForPendency || !pendencyText.trim()) return;

    try {
      setLoading(true);
      
      // Encontrar a proposta que está sendo atualizada
      const proposalToUpdate = proposals.find(p => p.id === proposalForPendency);
      
      if (!proposalToUpdate) return;
      
      // Criar objeto de pendência
      const pendency = {
        text: pendencyText.trim(),
        createdAt: new Date().toISOString(),
        createdBy: user?.id || '',
        createdByName: user?.name || ''
      };
      
      // Atualizar a proposta no Firestore
      const proposalRef = doc(db, 'proposals', proposalForPendency);
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
          proposal.id === proposalForPendency 
            ? updatedProposal
            : proposal
        )
      );
      
      // Atualizar a lista filtrada
      setFilteredProposals(prev => 
        prev.map(proposal => 
          proposal.id === proposalForPendency 
            ? updatedProposal
            : proposal
        )
      );
      
      // Limpar e fechar modais
      setPendencyText('');
      setShowPendencyModal(false);
      setProposalForPendency(null);
    } catch (error) {
      console.error('Erro ao adicionar pendência à proposta:', error);
    } finally {
      setLoading(false);
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
            author: user?.name || 'Sistema',
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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
        <h2 className="text-xl md:text-2xl font-semibold text-white">Controle de Propostas</h2>
        {canCreateProposals && (
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
        {showFilters ? (
          <X className="h-4 w-4 mr-1" />
        ) : (
          <Search className="h-4 w-4 mr-1" />
        )}
        <span>{showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}</span>
      </button>

      {/* Filtros */}
      {showFilters && (
        <div className="bg-black border border-gray-700 rounded-lg p-4 space-y-4 w-full overflow-hidden">
          <h3 className="text-lg font-medium text-white mb-2">Filtros</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {/* Filtro por nome do cliente */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por cliente"
                value={clientNameFilter}
                onChange={(e) => setClientNameFilter(e.target.value)}
                className="bg-black border border-gray-600 text-white rounded-md w-full pl-10 pr-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {clientNameFilter && (
                <button
                  onClick={() => setClientNameFilter('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Filtro por status */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Todos os status</option>
                <option value="pending">Cadastro Enviado</option>
                <option value="in_analysis">Em Análise</option>
                <option value="with_pendencies">Pendências</option>
                <option value="approved">Aprovada</option>
                <option value="rejected">Recusada</option>
              </select>
            </div>

            {/* Filtro por status do pipeline */}
            <div>
              <select
                value={pipelineStatusFilter}
                onChange={(e) => setPipelineStatusFilter(e.target.value as any)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">Todos os estágios</option>
                <option value="submitted">Cadastro Enviado</option>
                <option value="pre_analysis">Pré-Análise</option>
                <option value="credit">Crédito</option>
                <option value="legal">Jurídico/Imóvel</option>
                <option value="contract">Em Contrato</option>
              </select>
            </div>

            {/* Filtro por data */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-black border border-gray-600 text-white rounded-md w-full pl-10 pr-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-white" />
                </button>
              )}
            </div>

            {/* Filtro por equipe */}
            {(proposalsScope === 'all' || proposalsScope === 'team') && (
              <div>
                <select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Todas as equipes</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Botão para limpar filtros */}
          {(clientNameFilter || statusFilter !== 'all' || pipelineStatusFilter !== 'all' || dateFilter || teamFilter) && (
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
                      Status do Pipeline
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                      Status da Proposta
                    </th>
                    {(proposalsScope === 'all' || proposalsScope === 'team') && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider bg-[#A4A4A4]">
                        Equipe
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
                          title={formatDate(proposal.createdAt)}
                        >
                          {formatDate(proposal.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">
                          {proposal.proposalNumber || `PROP-${formatDate(proposal.createdAt).substring(6, 10)}-${proposal.id.substring(0, 4).toUpperCase()}`}
                        </div>
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
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pipelineStatusColors[proposal.pipelineStatus] || pipelineStatusColors.submitted}`}>
                          {pipelineStatusLabels[proposal.pipelineStatus] || pipelineStatusLabels.submitted}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proposalStatusColors[proposal.status] || proposalStatusColors.pending}`}>
                          {proposalStatusLabels[proposal.status] || proposalStatusLabels.pending}
                        </span>
                      </td>
                      {(proposalsScope === 'all' || proposalsScope === 'team') && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(proposal as any).teamCode ? (
                            <span 
                              className="px-2 py-1 text-xs font-medium rounded-md bg-blue-900 text-blue-200 cursor-help inline-block"
                              title={`Equipe: ${(proposal as any).teamName}`}
                            >
                              {(proposal as any).teamCode}
                            </span>
                          ) : (
                            <span className="text-gray-500">Sem equipe</span>
                          )}
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

                          <button
                            onClick={() => handleEditProposal(proposal.id)}
                            className="text-amber-400 hover:text-amber-300 hover:drop-shadow-[0_0_4px_rgba(251,191,36,0.6)] transition-all"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          
                          {canEditProposals && user?.roleKey !== 'partner' && (
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
                                className="text-blue-400 hover:text-blue-300 hover:drop-shadow-[0_0_4px_rgba(59,130,246,0.6)] transition-all"
                                title="Alterar Status"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setProposalForPendency(proposal.id);
                                  setShowPendencyModal(true);
                                }}
                                className="text-orange-400 hover:text-orange-300 hover:drop-shadow-[0_0_4px_rgba(249,115,22,0.6)] transition-all"
                                title="Adicionar Pendência"
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setProposalToDelete(proposal.id);
                                  setShowDeleteModal(true);
                                }}
                                className="text-red-400 hover:text-red-300 hover:drop-shadow-[0_0_4px_rgba(248,113,113,0.6)] transition-all"
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
                        <div className="text-sm font-medium text-white mb-1">{proposal.proposalNumber || `PROP-${formatDate(proposal.createdAt).substring(6, 10)}-${proposal.id.substring(0, 4).toUpperCase()}`}</div>
                        <div className="text-xs text-gray-400">
                          {formatDate(proposal.createdAt)}
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

                        {canEditProposals && user?.roleKey !== 'partner' && (
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
                        <div className="text-xs text-gray-400 mb-1">Status do Pipeline</div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pipelineStatusColors[proposal.pipelineStatus] || pipelineStatusColors.submitted}`}>
                          {pipelineStatusLabels[proposal.pipelineStatus] || pipelineStatusLabels.submitted}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-gray-400 mb-1">Status da Proposta</div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proposalStatusColors[proposal.status] || proposalStatusColors.pending}`}>
                        {proposalStatusLabels[proposal.status] || proposalStatusLabels.pending}
                      </span>
                    </div>

                    {(proposalsScope === 'all' || proposalsScope === 'team') && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-400 mb-1">Equipe</div>
                        {(proposal as any).teamCode ? (
                          <span 
                            className="px-2 py-1 text-xs font-medium rounded-md bg-blue-900 text-blue-200 cursor-help inline-block"
                            title={`Equipe: ${(proposal as any).teamName}`}
                          >
                            {(proposal as any).teamCode}
                          </span>
                        ) : (
                          <span className="text-gray-500">Sem equipe</span>
                        )}
                      </div>
                    )}

                    {canEditProposals && (
                      <div className="mt-3 pt-3 border-t border-gray-800 flex justify-end space-x-3">
                        <button
                          onClick={() => {
                            setProposalToChangeStatus(proposal.id);
                            setShowStatusModal(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 transition-all"
                          title="Alterar Status"
                        >
                          <Clock className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            setProposalForPendency(proposal.id);
                            setShowPendencyModal(true);
                          }}
                          className="text-orange-400 hover:text-orange-300 transition-all"
                          title="Adicionar Pendência"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            setProposalToDelete(proposal.id);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-400 hover:text-red-300 transition-all"
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
                  value={clientSearchText}
                  onChange={(e) => setClientSearchText(e.target.value)}
                  placeholder="Buscar cliente por nome..."
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
                {clientSearchText && (
                  <button
                    onClick={() => setClientSearchText('')}
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
                      className={`p-3 cursor-pointer ${
                        selectedClient?.id === client.id
                          ? 'bg-blue-900/30 border-l-4 border-blue-500'
                          : 'hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-center">
                        {client.type === 'PF' ? (
                          <User className="h-5 w-5 text-gray-400 mr-2" />
                        ) : (
                          <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">
                            {client.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            {client.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-400">
                  {clientSearchText
                    ? 'Nenhum cliente encontrado com esse nome'
                    : 'Carregando clientes...'}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center mt-2 mb-4">
              <div className="text-xs text-gray-400">
                {filteredClients.length > 0 ? `${filteredClients.length} cliente${filteredClients.length !== 1 ? 's' : ''} encontrado${filteredClients.length !== 1 ? 's' : ''}` : ''}
              </div>
              <button
                onClick={fetchClients}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Atualizar lista
              </button>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNewProposalModal(false);
                  setSelectedClient(null);
                }}
                className="px-4 py-2 bg-transparent border border-gray-700 text-white rounded-md hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmNewProposal}
                disabled={!selectedClient}
                className={`px-4 py-2 ${
                  selectedClient
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-blue-600/50 cursor-not-allowed'
                } text-white rounded-md`}
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
                className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed`}
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
                    : 'bg-[#D8B25A] text-black hover:bg-[#00e090]'
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
      {canCreateProposals && (
        <button
          onClick={handleCreateNewProposal}
          className="fixed bottom-8 right-8 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}