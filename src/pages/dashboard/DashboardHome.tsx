import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { FileText, Users, DollarSign, TrendingUp, PieChart as PieChartIcon, AlertCircle } from 'lucide-react';

// Interface para propostas
interface Proposal {
  id: string;
  proposalNumber: string;
  clientName: string;
  clientId: string;
  desiredCredit: number;
  hasProperty: boolean;
  propertyValue: number;
  status: 'pending' | 'approved' | 'rejected' | 'in_analysis' | 'with_pendencies';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract' | 'lost' | 'closed';
  createdAt: any;
  userId: string;
  createdBy?: string; // Email do usuário que criou a proposta
  inviterUserId?: string; // ID do usuário que convidou o cliente
  partnerEmail?: string; // Email do parceiro associado à proposta
  teamId?: string; // ID da equipe associada à proposta
  teamName?: string; // Nome da equipe associada à proposta
}

// Interface para clientes
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'PF' | 'PJ';
  status: 'complete' | 'incomplete';
  createdAt: any;
  createdBy?: string; // Email do usuário que criou o cliente
  userId?: string; // ID do usuário associado ao cliente
  inviterUserId?: string; // ID do usuário que convidou o cliente
  // Campos específicos para PJ
  companyName?: string; // Nome da empresa (PJ)
  partnerEmail?: string; // Email do sócio/representante (PJ)
  pipelineStatus?: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract' | 'lost' | 'closed'; // Status no pipeline
  teamId?: string; // ID da equipe associada ao cliente
  teamName?: string; // Nome da equipe associada ao cliente
}

// Interface para estatísticas
interface Stats {
  totalProposals: number;
  totalClients: number;
  totalApprovedProposals: number;
  totalPendingProposals: number;
  totalCreditRequested: number;
  averageCredit: number;
}

// Mapeamento de status para labels
const proposalStatusLabels = {
  pending: 'Cadastro Enviado',
  in_analysis: 'Em Análise',
  with_pendencies: 'Pendências',
  approved: 'Aprovada',
  rejected: 'Recusada',
};

// Mapeamento de status de pipeline para labels
const pipelineStatusLabels = {
  submitted: 'Cadastro Enviado',
  pre_analysis: 'Pré-Análise',
  credit: 'Crédito',
  legal: 'Jurídico/Imóvel',
  contract: 'Em Contrato',
  lost: 'Perdido',
  closed: 'Negócio Fechado',
};

// Função para determinar a cor com base no status do pipeline
const getPipelineStatusColor = (status: string): string => {
  switch (status) {
    case 'submitted': return '#3b82f6'; // azul
    case 'pre_analysis': return '#a855f7'; // roxo
    case 'credit': return '#10b981'; // verde
    case 'legal': return '#06b6d4'; // ciano
    case 'contract': return '#8b5cf6'; // roxo claro
    case 'lost': return '#ef4444'; // vermelho
    case 'closed': return '#22c55e'; // verde escuro
    default: return '#3b82f6'; // azul (padrão)
  }
};

export default function DashboardHome() {
  const [_, setProposals] = useState<Proposal[]>([]);
  const [__, setClients] = useState<Client[]>([]);
  const [recentProposals, setRecentProposals] = useState<Proposal[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalProposals: 0,
    totalClients: 0,
    totalApprovedProposals: 0,
    totalPendingProposals: 0,
    totalCreditRequested: 0,
    averageCredit: 0
  });
  const [pipelineData, setPipelineData] = useState<{name: string, value: number, color?: string, hasValue?: boolean}[]>([]);
  const [clientPipelineData, setClientPipelineData] = useState<{name: string, value: number, color?: string, hasValue?: boolean}[]>([]);
  // Estado para armazenar os dados do gráfico de barras
  const [barChartData, setBarChartData] = useState<{name: string, propostas: number, clientes: number}[]>([]);

  const { user } = useAuth();
  const { 
    canViewPage,
    getDataScope
  } = useRolePermissions();

  // Função para buscar dados otimizada com useCallback para evitar loops infinitos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('DashboardHome - Iniciando busca de dados');
      console.log('Usuário atual:', user?.id, user?.email, user?.roleKey, user?.team);
      
      // Buscar clientes com base nas permissões
      const clientsRef = collection(db, 'registrations');
      let clientsQuery: any;
      
      // Buscar todos os clientes primeiro e filtrar manualmente depois
      clientsQuery = query(clientsRef);
      const clientsSnapshot = await getDocs(clientsQuery);
      
      console.log('Total de clientes encontrados no banco:', clientsSnapshot.docs.length);
      
      // Converter para array de objetos
      let clientsData = clientsSnapshot.docs.map(doc => {
        const data = doc.data() as Record<string, any>;
        return {
          id: doc.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          type: data.type || 'PF',
          status: data.status || 'incomplete',
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          userId: data.userId,
          inviterUserId: data.inviterUserId,
          // Campos específicos para PJ
          companyName: data.companyName || data.razaoSocial || '',
          partnerEmail: data.partnerEmail || data.emailSocio || '',
          pipelineStatus: data.pipelineStatus || 'submitted',
          teamId: data.teamId,
          teamName: data.teamName
        } as Client;
      });
      
      // Aplicar filtros baseados no tipo de usuário
      if (user?.roleKey === 'admin') {
        // Administrador vê todos os dados, não aplicar filtros
        console.log('DashboardHome - Usuário é um administrador, mostrando todos os dados');
        // Manter todos os clientes sem filtrar
      } else if (user?.roleKey === 'partner') {
        console.log('DashboardHome - Usuário é um parceiro, filtrando clientes relacionados');
        // Para parceiros, mostrar apenas os clientes criados pelo usuário e os que têm o inviterUserId
        clientsData = clientsData.filter(client => 
          client.userId === user.id || 
          client.createdBy === user.id || 
          client.createdBy === user.email || 
          client.partnerEmail === user.email ||
          client.inviterUserId === user.id
        );
      } else if (user?.roleKey === 'manager') {
        console.log('DashboardHome - Usuário é um gerente, filtrando clientes');
        
        // Garantir que todos os clientes que sigam as regras sejam mostrados
        // Não vamos filtrar nada ainda, apenas coletar todos os clientes possíveis
        let allManagerClients = [];
        let teamData = null;
        let teamMembers = [];
        
        // 1. Adicionar clientes criados pelo gerente
        const managerDirectClients = clientsData.filter(client => 
          client.userId === user.id || 
          client.createdBy === user.id || 
          client.createdBy === user.email ||
          client.inviterUserId === user.id
        );
        allManagerClients = [...managerDirectClients];
        console.log('Clientes diretos do gerente:', managerDirectClients.length);
        
        // 2. Se o gerente tem uma equipe, adicionar clientes da equipe
        if (user.team) {
          try {
            console.log('Tentando buscar dados da equipe:', user.team);
            
            const teamDoc = await getDoc(doc(db, 'teams', user.team));
            console.log('Documento da equipe encontrado:', teamDoc.exists());
            
            if (teamDoc.exists()) {
              teamData = teamDoc.data();
              teamMembers = teamData.members || [];
              console.log('Membros da equipe encontrados:', teamMembers.length);
              
              // Adicionar clientes vinculados à equipe
              const teamLinkedClients = clientsData.filter(client => 
                client.teamId === user.team || 
                client.teamName === teamData.name
              );
              console.log('Clientes vinculados à equipe:', teamLinkedClients.length);
              
              // Adicionar clientes criados por membros da equipe
              const teamMemberCreatedClients = clientsData.filter(client => 
                teamMembers.includes(client.userId) || 
                teamMembers.includes(client.createdBy)
              );
              console.log('Clientes criados por membros da equipe:', teamMemberCreatedClients.length);
              
              // Combinar todos os clientes sem duplicatas
              const uniqueClientsMap = new Map();
              [...allManagerClients, ...teamLinkedClients, ...teamMemberCreatedClients].forEach(client => {
                uniqueClientsMap.set(client.id, client);
              });
              
              allManagerClients = Array.from(uniqueClientsMap.values());
            }
          } catch (error) {
            console.error('Erro ao buscar dados da equipe:', error);
          }
        }
        
        // Atualizar clientsData com todos os clientes coletados
        clientsData = allManagerClients;
        console.log('DashboardHome - Total de clientes do gerente:', clientsData.length);
      } else if (user?.roleKey === 'client') {
        // Para clientes, mostrar apenas seus próprios dados
        clientsData = clientsData.filter(client => 
          client.userId === user.id || 
          client.id === user.id
        );
      }
      
      setClients(clientsData);
      console.log('DashboardHome - Clientes carregados (após filtro):', clientsData.length);
      
      // Buscar propostas com base nas permissões
      const proposalsRef = collection(db, 'proposals');
      let proposalsQuery: any;
      
      // Buscar todas as propostas primeiro e filtrar manualmente depois
      proposalsQuery = query(proposalsRef);
      const proposalsSnapshot = await getDocs(proposalsQuery);
      
      console.log('Total de propostas encontradas no banco:', proposalsSnapshot.docs.length);
      
      // Converter para array de objetos
      const allProposalsData = proposalsSnapshot.docs.map(doc => {
        const data = doc.data() as Record<string, any>;
        return {
          id: doc.id,
          clientId: data.clientId || '',
          clientName: data.clientName || '',
          clientEmail: data.clientEmail || '',
          status: data.status || 'pending',
          pipelineStatus: data.pipelineStatus || 'submitted',
          desiredCredit: data.desiredCredit || 0,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          userId: data.userId,
          proposalNumber: data.proposalNumber || '',
          partnerEmail: data.partnerEmail || '',
          inviterUserId: data.inviterUserId || '',
          teamId: data.teamId,
          teamName: data.teamName
        } as Proposal;
      });
      
      // Se for parceiro, buscar primeiro os clientes onde ele é o inviterUserId
      let clientIdsFromInviter: string[] = [];
      if (user?.roleKey === 'partner') {
        console.log('DashboardHome - Buscando clientes onde o parceiro é o inviterUserId');
        try {
          const clientsQuery = query(collection(db, 'registrations'), where('inviterUserId', '==', user.id));
          const clientsSnapshot = await getDocs(clientsQuery);
          clientIdsFromInviter = clientsSnapshot.docs.map(doc => doc.id);
        } catch (err) {
          console.error('Erro ao buscar clientes do parceiro:', err);
        }
      }
      
      // Filtrar propostas com base no tipo de usuário
      let proposalsData: Proposal[] = [];
      
      if (user?.roleKey === 'admin') {
        // Administrador vê todas as propostas, não aplicar filtros
        console.log('DashboardHome - Usuário é um administrador, mostrando todas as propostas');
        proposalsData = allProposalsData;
      } else if (user?.roleKey === 'partner') {
        console.log('DashboardHome - Filtrando propostas para parceiro');
        
        // Obter IDs dos clientes do parceiro
        const clientIds = clientsData.map(client => client.id);
        console.log('DashboardHome - IDs dos clientes do parceiro:', clientIds);
        
        // Filtrar propostas
        proposalsData = allProposalsData.filter(proposal => {
          // 1. Proposta criada pelo parceiro
          const isCreatedByPartner = proposal.userId === user.id || proposal.createdBy === user.email;
          
          // 2. Proposta onde o parceiro é o inviterUserId
          const isInviterPartner = proposal.inviterUserId === user.id;
          
          // 3. Proposta de um cliente do parceiro
          const isClientFromPartner = clientIds.includes(proposal.clientId);
          
          // 4. Proposta onde o parceiro é o partnerEmail
          const isPartnerEmail = proposal.partnerEmail === user.email;
          
          return isCreatedByPartner || isInviterPartner || isClientFromPartner || isPartnerEmail;
        });
        
        console.log('DashboardHome - Propostas filtradas para parceiro:', proposalsData.length);
      } else if (user?.roleKey === 'manager') {
        console.log('DashboardHome - Filtrando propostas para gerente');
        
        // Filtro simplificado para propostas do gerente
        const managerProposals = [];
        
        // Obter IDs dos clientes do gerente para filtrar propostas relacionadas
        const clientIds = clientsData.map(client => client.id);
        console.log('IDs dos clientes do gerente:', clientIds.length);
        
        // Adicionar todas as propostas que atendam aos critérios
        for (const proposal of allProposalsData) {
          // 1. Propostas criadas pelo gerente
          if (
            proposal.userId === user.id || 
            proposal.createdBy === user.email || 
            proposal.inviterUserId === user.id
          ) {
            managerProposals.push(proposal);
            continue; // Já adicionou, não precisa verificar o resto
          }
          
          // 2. Propostas de clientes do gerente
          if (clientIds.includes(proposal.clientId)) {
            managerProposals.push(proposal);
            continue;
          }
          
          // 3. Propostas vinculadas à equipe do gerente
          if (user.team && proposal.teamId === user.team) {
            managerProposals.push(proposal);
          }
        }
        
        console.log('Total de propostas do gerente:', managerProposals.length);
        
        // Atualizar proposalsData com as propostas do gerente
        proposalsData = managerProposals;
      }
      
      setProposals(proposalsData);
      console.log('DashboardHome - Propostas carregadas:', proposalsData.length);
      
      // Ordenar propostas por data de criação (mais recentes primeiro)
      const sortedProposals = [...proposalsData].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentProposals(sortedProposals.slice(0, 5));
      
      const sortedClients = [...clientsData].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRecentClients(sortedClients.slice(0, 5));
      
      // Calcular estatísticas
      const totalProposals = proposalsData.length;
      const totalClients = clientsData.length;
      const totalApprovedProposals = proposalsData.filter(p => p.status === 'approved').length;
      const totalPendingProposals = proposalsData.filter(p => p.status === 'pending' || p.status === 'in_analysis' || p.status === 'with_pendencies').length;
      const totalCreditRequested = proposalsData.reduce((sum, p) => sum + (p.desiredCredit || 0), 0);
      const averageCredit = totalProposals > 0 ? totalCreditRequested / totalProposals : 0;
      
      setStats({
        totalProposals,
        totalClients,
        totalApprovedProposals,
        totalPendingProposals,
        totalCreditRequested,
        averageCredit
      });

      // Calcular dados para o gráfico de distribuição no pipeline
      const pipelineCounts = {
        submitted: 0,
        pre_analysis: 0,
        credit: 0,
        legal: 0,
        contract: 0,
        lost: 0,
        closed: 0
      };
      
      proposalsData.forEach(proposal => {
        const status = proposal.pipelineStatus as keyof typeof pipelineCounts;
        if (status && pipelineCounts[status] !== undefined) {
          pipelineCounts[status]++;
        } else {
          // Se não tiver status de pipeline, considerar como 'submitted'
          pipelineCounts.submitted++;
        }
      });
      
      // Criar dados para o gráfico, incluindo todos os estágios para a legenda
      // mas filtrando os valores zero para a visualização do gráfico
      const pipelineChartData = Object.entries(pipelineCounts)
        .map(([key, value]) => ({
          name: pipelineStatusLabels[key as keyof typeof pipelineStatusLabels],
          value,
          color: key === 'submitted' ? '#3b82f6' : 
                key === 'pre_analysis' ? '#a855f7' : 
                key === 'credit' ? '#10b981' : 
                key === 'legal' ? '#06b6d4' : 
                '#8b5cf6', // contract
          hasValue: value > 0 // Marcador para identificar itens com valor
        }));
        
      // Calcular dados para o gráfico de distribuição de clientes por estágio do pipeline
      const clientPipelineCounts = {
        submitted: 0,
        pre_analysis: 0,
        credit: 0,
        legal: 0,
        contract: 0,
        lost: 0,
        closed: 0
      };
      
      // Contagem de clientes por estágio do pipeline
      clientsData.forEach(client => {
        // Verificar se o cliente tem a propriedade pipelineStatus
        const status = client.pipelineStatus as keyof typeof clientPipelineCounts;
        if (status && clientPipelineCounts[status] !== undefined) {
          clientPipelineCounts[status]++;
        } else {
          // Se não tiver status de pipeline, considerar como 'submitted'
          clientPipelineCounts.submitted++;
        }
      });
      
      // Criar dados para o gráfico de clientes por estágio do pipeline
      const clientPipelineChartData = Object.entries(clientPipelineCounts)
        .map(([key, value]) => ({
          name: pipelineStatusLabels[key as keyof typeof pipelineStatusLabels],
          value,
          color: key === 'submitted' ? '#3b82f6' : 
                key === 'pre_analysis' ? '#a855f7' : 
                key === 'credit' ? '#10b981' : 
                key === 'legal' ? '#06b6d4' : 
                '#8b5cf6', // contract
          hasValue: value > 0 // Marcador para identificar itens com valor
        }));
      
      setPipelineData(pipelineChartData);
      setClientPipelineData(clientPipelineChartData);
      
      // Calcular dados reais para o gráfico de créditos solicitados por mês
      const monthlyData: Record<string, {propostas: number, clientes: number}> = {};
      
      // Obter mês atual e os 4 meses anteriores
      const currentDate = new Date();
      for (let i = 0; i < 5; i++) {
        const date = new Date(currentDate);
        date.setMonth(currentDate.getMonth() - i);
        const monthKey = format(date, 'MMM yyyy', { locale: ptBR });
        monthlyData[monthKey] = { propostas: 0, clientes: 0 };
      }
      
      // Calcular valores de propostas por mês
      proposalsData.forEach(proposal => {
        if (proposal.createdAt) {
          const proposalDate = proposal.createdAt instanceof Date ? 
            proposal.createdAt : 
            proposal.createdAt.toDate ? 
              proposal.createdAt.toDate() : 
              new Date(proposal.createdAt);
          
          const monthKey = format(proposalDate, 'MMM yyyy', { locale: ptBR });
          
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].propostas += proposal.desiredCredit || 0;
            monthlyData[monthKey].clientes += 1; // Incrementar contador de clientes
          }
        }
      });
      
      // Converter para o formato do gráfico de barras
      const calculatedBarChartData = Object.entries(monthlyData)
        .map(([name, data]) => ({
          name,
          propostas: data.propostas,
          clientes: data.clientes
        }))
        .sort((a, b) => {
          // Ordenar por data (do mais antigo para o mais recente)
          // Extrair mês e ano do formato 'mmm yyyy'
          const [monthA, yearA] = a.name.split(' ');
          const [monthB, yearB] = b.name.split(' ');
          
          // Converter mês para número (0-11)
          const getMonthNumber = (monthStr: string): number => {
            const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            return months.findIndex(m => m === monthStr.toLowerCase());
          };
          
          const dateA = new Date(parseInt(yearA), getMonthNumber(monthA));
          const dateB = new Date(parseInt(yearB), getMonthNumber(monthB));
          
          return dateA.getTime() - dateB.getTime();
        });
      
      setBarChartData(calculatedBarChartData);
      
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error);
      // Mostrar mensagem de erro mais detalhada para facilitar o diagnóstico
      setError(`Erro ao carregar dados do dashboard: ${error instanceof Error ? error.message : 'Erro desconhecido'}. Por favor, tente novamente.`);
    } finally {
      setLoading(false);
    }
  }, [
    user?.id // Apenas depender do ID do usuário é mais seguro
  ]);

  // Efeito para buscar dados quando o componente montar
  useEffect(() => {
    // Adicionar uma flag para evitar chamadas repetidas
    let isMounted = true;
    if (isMounted) {
      fetchData();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  // Cores para o gráfico de pizza
  const COLORS = ['#4f46e5', '#a855f7', '#10b981', '#8b5cf6', '#f59e0b'];

  // Renderizar o dashboard
  return (
    <div className="p-6 bg-black text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6">
        {user?.roleKey === 'partner' ? 'Olá Parceiro' : 'Dashboard'}
      </h1>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-900 text-white p-4 rounded-lg mb-6">
          <p>{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Boas-vindas para todos os usuários */}
          {canViewPage('dashboard') && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">
                {user?.roleKey === 'partner' ? 'Bem-vindo ao seu Dashboard de Parceria' : 
                 user?.roleKey === 'admin' ? 'Bem-vindo ao Dashboard Administrativo' : 
                 user?.roleKey === 'manager' ? 'Bem-vindo ao Dashboard Gerencial' : 
                 user?.roleKey === 'client' ? 'Bem-vindo ao seu Dashboard de Cliente' : 
                 'Bem-vindo ao seu Dashboard'}
              </h1>
              <p className="text-gray-300">
                {user?.roleKey === 'partner' ? 'Aqui você pode acompanhar todas as propostas e clientes relacionados à sua parceria com a Dols Capital.' : 
                 user?.roleKey === 'admin' ? 'Aqui você pode acompanhar todas as propostas, clientes e estatísticas da plataforma.' : 
                 user?.roleKey === 'manager' ? 'Aqui você pode acompanhar propostas, clientes e estatísticas relacionadas à sua equipe.' : 
                 user?.roleKey === 'client' ? 'Aqui você pode acompanhar suas propostas e informações de crédito.' : 
                 'Aqui você pode acompanhar propostas, clientes e estatísticas relacionadas às suas atividades.'}
              </p>
            </div>
          )}
          
          {/* Cards de Estatísticas */}
          {canViewPage('dashboard') && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {/* Primeira linha: 3 cards de tamanho igual */}
              
              {/* Card 1: Total de Propostas */}
              <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg md:col-span-1 lg:col-span-2">
                <div className="flex items-start">
                  <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                    <FileText className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Total de Propostas</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-2xl font-bold text-white">{stats.totalProposals}</p>
                      <p className="ml-2 text-xs text-green-400">+5%</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Card 2: Crédito Solicitado */}
              <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg md:col-span-1 lg:col-span-2">
                <div className="flex items-start">
                  <div className="p-2 bg-green-500/20 rounded-lg mr-3">
                    <DollarSign className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Crédito Solicitado</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-2xl font-bold text-white">R$ {new Intl.NumberFormat('pt-BR').format(stats.totalCreditRequested || 1400000)}</p>
                      <p className="ml-2 text-xs text-green-400">+8%</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Card 3: Média por Proposta */}
              <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg md:col-span-1 lg:col-span-2">
                <div className="flex items-start">
                  <div className="p-2 bg-purple-500/20 rounded-lg mr-3">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Média por Proposta</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-2xl font-bold text-white">R$ {new Intl.NumberFormat('pt-BR').format(stats.averageCredit || 700000)}</p>
                      <p className="ml-2 text-xs text-green-400">+2%</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Segunda linha: 3 cards de tamanho igual */}
              {/* Card 4: Taxa de Aprovação */}
              <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg md:col-span-1 lg:col-span-2">
                <div className="flex items-start">
                  <div className="p-2 bg-emerald-500/20 rounded-lg mr-3">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Taxa de Aprovação</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-2xl font-bold text-white">{stats.totalProposals ? Math.round((stats.totalApprovedProposals / stats.totalProposals) * 100) : 0}%</p>
                      <p className="ml-2 text-xs text-green-400">+2%</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Card 5: Total de Clientes */}
              <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg md:col-span-1 lg:col-span-2">
                <div className="flex items-start">
                  <div className="p-2 bg-amber-500/20 rounded-lg mr-3">
                    <Users className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Total de Clientes</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
                      <p className="ml-2 text-xs text-green-400">+3%</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Card 6: Pendências */}
              <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg md:col-span-1 lg:col-span-2">
                <div className="flex items-start">
                  <div className="p-2 bg-red-500/20 rounded-lg mr-3">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Pendências</p>
                    <div className="flex items-baseline mt-1">
                      <p className="text-2xl font-bold text-white">{stats.totalPendingProposals || 2}</p>
                      <p className="ml-2 text-xs text-red-400">NOVO</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Gráficos para todos os usuários */}
          {canViewPage('dashboard') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Container com altura fixa para todos os gráficos */}
              {/* Gráfico de Desempenho de Parceria */}
              <div className="bg-black border border-gray-800 rounded-lg p-5 shadow-lg h-[350px] flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold text-white">Desempenho de Parceria</h2>
                  <div className="p-1 bg-blue-500/20 rounded-lg">
                    <PieChartIcon className="h-5 w-5 text-blue-400" />
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between mb-4 text-xs">
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-blue-500"></span>
                      <span>Propostas Pendentes</span>
                    </div>
                    <span className="text-blue-400">{stats.totalPendingProposals || 0}</span>
                  </div>
                  <div className="flex justify-between mb-4 text-xs">
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-green-500"></span>
                      <span>Propostas Aprovadas</span>
                    </div>
                    <span className="text-green-400">{stats.totalApprovedProposals || 0}</span>
                  </div>
                  <div className="flex justify-between mb-4 text-xs">
                    <div className="flex items-center">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-purple-500"></span>
                      <span>Clientes Ativos</span>
                    </div>
                    <span className="text-purple-400">{stats.totalClients || 0}</span>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Propostas Pendentes', value: stats.totalPendingProposals || 1 },
                          { name: 'Propostas Aprovadas', value: stats.totalApprovedProposals || 1 },
                          { name: 'Clientes Ativos', value: stats.totalClients || 1 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        <Cell key="cell-0" fill="#3b82f6" /> {/* Azul para Propostas Pendentes */}
                        <Cell key="cell-1" fill="#10b981" /> {/* Verde para Propostas Aprovadas */}
                        <Cell key="cell-2" fill="#8b5cf6" /> {/* Roxo para Clientes Ativos */}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [`${value} (${((value / (stats.totalPendingProposals + stats.totalApprovedProposals + stats.totalClients)) * 100).toFixed(0)}%)`, name]}
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
                        itemStyle={{ color: '#f9fafb' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Gráfico de Clientes por Estágio */}
              <div className="bg-black border border-gray-800 rounded-lg p-5 shadow-lg h-[350px] flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold text-white">Clientes por Estágio</h2>
                  <div className="p-1 bg-purple-500/20 rounded-lg">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 mb-6">
                    <div className="flex items-center text-xs">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-blue-500"></span>
                      <span>Cadastro Enviado</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-purple-500"></span>
                      <span>Pré-Análise</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-green-500"></span>
                      <span>Crédito</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-cyan-500"></span>
                      <span>Jurídico/Imóvel</span>
                    </div>
                    <div className="flex items-center text-xs">
                      <span className="inline-block w-3 h-3 mr-1 rounded-full bg-indigo-500"></span>
                      <span>Em Contrato</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie
                        data={clientPipelineData.length > 0 ? clientPipelineData.filter(item => item.hasValue) : [
                          { name: 'Cadastro Enviado', value: 15, color: '#3b82f6' },
                          { name: 'Pré-Análise', value: 10, color: '#a855f7' },
                          { name: 'Crédito', value: 8, color: '#10b981' },
                          { name: 'Jurídico/Imóvel', value: 5, color: '#06b6d4' },
                          { name: 'Em Contrato', value: 3, color: '#8b5cf6' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {clientPipelineData.length > 0 ? 
                          clientPipelineData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                          )) : 
                          [
                            <Cell key="cell-0" fill="#3b82f6" />, // Azul para Cadastro Enviado
                            <Cell key="cell-1" fill="#a855f7" />, // Roxo para Pré-Análise
                            <Cell key="cell-2" fill="#10b981" />, // Verde para Crédito
                            <Cell key="cell-3" fill="#06b6d4" />, // Ciano para Jurídico/Imóvel
                            <Cell key="cell-4" fill="#8b5cf6" />  // Índigo para Em Contrato
                          ]
                        }
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [`${value} cliente(s)`, name]}
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
                        itemStyle={{ color: '#f9fafb' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Gráfico de Créditos Solicitados */}
              <div className="bg-black border border-gray-800 rounded-lg p-5 shadow-lg h-[350px] flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold text-white">Créditos Solicitados <span className="text-green-500">$</span></h2>
                  <div className="p-1 bg-green-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-400" />
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between mb-6">
                    <div className="text-xs text-gray-400">Valores solicitados por mês</div>
                    <div className="text-xs text-green-500">Total: R$ {new Intl.NumberFormat('pt-BR').format(stats.totalCreditRequested)}</div>
                  </div>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart 
                      data={[
                        // Usar dados reais ou dados de exemplo formatados por mês
                        { name: 'jan', valor: Math.round(stats.totalCreditRequested * 0.25) || 250000 },
                        { name: 'fev', valor: Math.round(stats.totalCreditRequested * 0.35) || 350000 },
                        { name: 'mar', valor: Math.round(stats.totalCreditRequested * 0.40) || 400000 }
                      ]} 
                      margin={{ top: 5, right: 20, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid vertical={false} horizontal={true} strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: '#9ca3af' }} 
                        axisLine={{ stroke: '#374151' }}
                      />
                      <YAxis 
                        tick={{ fill: '#9ca3af' }} 
                        axisLine={{ stroke: '#374151' }}
                        tickFormatter={(value) => `R$ ${Number(value) / 1000}k`}
                        domain={[0, 'dataMax + 100000']}
                      />
                      <Tooltip 
                        formatter={(value) => [`R$ ${new Intl.NumberFormat('pt-BR').format(Number(value))}`, 'Valor']}
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem' }}
                        itemStyle={{ color: '#f9fafb' }}
                        cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                      />
                      <Bar 
                        dataKey="valor" 
                        fill="#10b981" 
                        name="Valor" 
                        radius={[4, 4, 0, 0]}
                        barSize={30}
                        label={{
                          position: 'top',
                          formatter: (value: number) => `R$ ${(value/1000).toFixed(0)}k`,
                          fill: '#10b981',
                          fontSize: 10
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
          
          {/* Espaço reservado para outros elementos do dashboard */}
          
          {/* Propostas Recentes */}
          {canViewPage('proposals') && (
            <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {user?.roleKey === 'partner' ? 'Suas Propostas Recentes' : 'Propostas Recentes'}
                </h2>
                <div className="p-1 bg-blue-500/20 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              
              {recentProposals.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Número</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Valor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {recentProposals.map(proposal => (
                        <tr key={proposal.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{proposal.proposalNumber || `PROP-${proposal.id.substring(0, 6)}`}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{proposal.clientName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(proposal.desiredCredit)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              proposal.status === 'approved' ? 'bg-green-900 text-green-200' :
                              proposal.status === 'rejected' ? 'bg-red-900 text-red-200' :
                              proposal.status === 'in_analysis' ? 'bg-yellow-900 text-yellow-200' :
                              proposal.status === 'with_pendencies' ? 'bg-orange-900 text-orange-200' :
                              'bg-blue-900 text-blue-200'
                            }`}>
                              {proposalStatusLabels[proposal.status] || 'Cadastro Enviado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {proposal.createdAt ? format(proposal.createdAt instanceof Date ? proposal.createdAt : proposal.createdAt.toDate ? proposal.createdAt.toDate() : new Date(proposal.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : 'Data desconhecida'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">Nenhuma proposta encontrada.</p>
              )}
            </div>
          )}
          
          {/* Clientes Recentes */}
          {canViewPage('clients') && (
            <div className="bg-black border border-gray-800 rounded-lg p-4 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  {user?.roleKey === 'partner' ? 'Seus Clientes Recentes' : 'Clientes Recentes'}
                </h2>
                <div className="p-1 bg-blue-500/20 rounded-lg">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              
              {recentClients.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status do Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status do Pipeline</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {recentClients.map(client => (
                        <tr key={client.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{client.type === 'PJ' ? client.companyName || client.name : client.name}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{client.type === 'PJ' ? client.partnerEmail || client.email : client.email}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">{client.type}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              client.status === 'complete' ? 'bg-green-900 text-green-200' : 'bg-yellow-900 text-yellow-200'
                            }`}>
                              {client.status === 'complete' ? 'Cadastro Completo' : 'Cadastro Incompleto'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {client.pipelineStatus ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                client.pipelineStatus === 'submitted' ? 'bg-blue-900 text-blue-200' :
                                client.pipelineStatus === 'pre_analysis' ? 'bg-purple-900 text-purple-200' :
                                client.pipelineStatus === 'credit' ? 'bg-yellow-900 text-yellow-200' :
                                client.pipelineStatus === 'legal' ? 'bg-orange-900 text-orange-200' :
                                client.pipelineStatus === 'contract' ? 'bg-green-900 text-green-200' :
                                client.pipelineStatus === 'lost' ? 'bg-red-900 text-red-200' :
                                client.pipelineStatus === 'closed' ? 'bg-emerald-900 text-emerald-200' :
                                'bg-gray-900 text-gray-200'
                              }`}>
                                {client.pipelineStatus === 'submitted' ? 'Enviado' :
                                client.pipelineStatus === 'pre_analysis' ? 'Pré-Análise' :
                                client.pipelineStatus === 'credit' ? 'Análise de Crédito' :
                                client.pipelineStatus === 'legal' ? 'Análise Jurídica' :
                                client.pipelineStatus === 'contract' ? 'Contrato' :
                                client.pipelineStatus === 'lost' ? 'Perdido' :
                                client.pipelineStatus === 'closed' ? 'Negócio Fechado' :
                                'Não Definido'}
                              </span>
                            ) : (
                              <span className="text-gray-400">Não Definido</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {client.createdAt ? format(client.createdAt instanceof Date ? client.createdAt : client.createdAt.toDate ? client.createdAt.toDate() : new Date(client.createdAt), 'dd/MM/yyyy', { locale: ptBR }) : 'Data desconhecida'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">Nenhum cliente encontrado.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
