import { useEffect, useState } from 'react';
import { TrendingUp, Users, FileText, AlertTriangle, DollarSign, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Interface para propostas
interface Proposal {
  id: string;
  proposalNumber: string;
  clientName: string;
  clientId: string;
  desiredCredit: number;
  hasProperty: boolean;
  propertyValue: number;
  status: 'pending' | 'approved' | 'rejected' | 'in_analysis';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract';
  createdAt: any;
  userId: string;
}

// Interface para clientes
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'PF' | 'PJ';
  status: 'complete' | 'incomplete' | 'pending';
  createdAt: any;
}

const pipelineStatusLabels = {
  submitted: 'Cadastro Enviado',
  pre_analysis: 'Pré-Análise',
  credit: 'Crédito',
  legal: 'Jurídico/Imóvel',
  contract: 'Em Contrato',
};

const pipelineStatusColors = {
  submitted: '#3B82F6',
  pre_analysis: '#F59E0B',
  credit: '#10B981',
  legal: '#8B5CF6',
  contract: '#F97316',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black p-3 rounded-lg shadow-lg border border-gray-700">
        <p className="text-white">{`${label}`}</p>
        <p className="text-white font-semibold">
          {payload[0].dataKey === 'value' || payload[0].dataKey === 'desiredCredit'
            ? `R$ ${payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : payload[0].value}
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardHome() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProposals: 0,
    totalClients: 0,
    totalCreditRequested: 0,
    averageCredit: 0,
    approvalRate: 0,
    pendingProposals: 0,
    newClientsThisMonth: 0,
    pfClients: 0,
    pjClients: 0,
    incompleteClients: 0,
  });
  const [pipelineData, setPipelineData] = useState<any>({});
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [recentProposals, setRecentProposals] = useState<Proposal[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("Iniciando busca de dados...");
        await Promise.all([
          fetchProposals(),
          fetchClients(),
          fetchRecentProposals(),
          fetchRecentClients()
        ]);
        console.log("Dados carregados com sucesso!");
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (proposals.length > 0) {
      calculateStats();
      generatePipelineData();
      generateMonthlyData();
    }
  }, [proposals, clients]);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const isMobile = windowWidth < 768;

  const fetchProposals = async () => {
    try {
      let q;
      
      // Se o usuário for cliente, mostrar apenas suas propostas
      if (user?.role === 'client') {
        q = query(collection(db, 'proposals'), where('userId', '==', user.id));
      } else {
        // Se for gerente ou admin, mostrar todas as propostas
        q = query(collection(db, 'proposals'));
      }
      
      const querySnapshot = await getDocs(q);
      
      const proposalsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
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
          createdAt: data.createdAt,
          userId: data.userId || '',
        };
      }) as Proposal[];

      setProposals(proposalsData);
    } catch (error) {
      console.error('Erro ao buscar propostas:', error);
    }
  };

  const fetchClients = async () => {
    try {
      let clientsData: Client[] = [];
      
      // Se o usuário for cliente, não mostrar outros clientes
      if (user?.role === 'client') {
        const q = query(collection(db, 'registrations'), where('userId', '==', user.id));
        const querySnapshot = await getDocs(q);
        
        clientsData = processClientData(querySnapshot);
      } else {
        // Buscar na coleção 'registrations'
        const registrationsQuery = query(collection(db, 'registrations'));
        const registrationsSnapshot = await getDocs(registrationsQuery);
        console.log(`Encontrados ${registrationsSnapshot.docs.length} clientes na coleção 'registrations'`);
        
        clientsData = processClientData(registrationsSnapshot);
      }
      
      console.log(`Total de clientes encontrados: ${clientsData.length}`);
      setClients(clientsData);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  // Função auxiliar para processar dados de clientes
  const processClientData = (snapshot: any) => {
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      console.log('Dados do cliente:', data);
      
      // Determinar o tipo de cliente com base nos campos disponíveis
      let clientType = 'PF';
      if (data.type) {
        clientType = data.type;
      } else if (data.cnpj || data.companyName || data.tradingName) {
        clientType = 'PJ';
      }
      
      // Determinar o status do cliente
      let clientStatus = 'incomplete';
      if (data.status) {
        clientStatus = data.status;
      } else if (
        (clientType === 'PF' && data.cpf && data.name && data.email) ||
        (clientType === 'PJ' && data.cnpj && data.companyName && data.legalRepresentative)
      ) {
        clientStatus = 'complete';
      }
      
      return {
        id: doc.id,
        name: data.name || data.companyName || data.legalRepresentative || 'Nome não disponível',
        email: data.email || data.partnerEmail || '',
        phone: data.phone || '',
        type: clientType,
        status: clientStatus,
        createdAt: data.createdAt || new Date(),
      };
    });
  };

  const fetchRecentProposals = async () => {
    try {
      let q;
      
      if (user?.role === 'client') {
        // Para clientes, não usamos ordenação por createdAt para evitar o erro de índice
        q = query(
          collection(db, 'proposals'), 
          where('userId', '==', user.id),
          limit(5)
        );
      } else {
        q = query(
          collection(db, 'proposals'),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const proposalsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
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
          createdAt: data.createdAt,
          userId: data.userId || '',
        };
      }) as Proposal[];

      // Ordenar manualmente por data para clientes
      if (user?.role === 'client') {
        proposalsData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return dateB - dateA; // Ordem decrescente
        });
      }

      setRecentProposals(proposalsData);
    } catch (error) {
      console.error('Erro ao buscar propostas recentes:', error);
    }
  };

  const fetchRecentClients = async () => {
    try {
      let recentClientsData: Client[] = [];
      
      if (user?.role === 'client') {
        // Clientes não veem outros clientes
        setRecentClients([]);
        return;
      }
      
      // Buscar na coleção 'registrations'
      const registrationsQuery = query(
        collection(db, 'registrations'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const registrationsSnapshot = await getDocs(registrationsQuery);
      console.log(`Encontrados ${registrationsSnapshot.docs.length} clientes recentes na coleção 'registrations'`);
      
      recentClientsData = processClientData(registrationsSnapshot);
      
      console.log(`Total de clientes recentes encontrados: ${recentClientsData.length}`);
      setRecentClients(recentClientsData);
    } catch (error) {
      console.error('Erro ao buscar clientes recentes:', error);
    }
  };

  const calculateStats = () => {
    // Total de propostas
    const totalProposals = proposals.length;
    
    // Total de crédito solicitado
    const totalCreditRequested = proposals.reduce((sum, proposal) => sum + proposal.desiredCredit, 0);
    
    // Média de crédito por proposta
    const averageCredit = totalProposals > 0 ? totalCreditRequested / totalProposals : 0;
    
    // Taxa de aprovação
    const approvedProposals = proposals.filter(p => p.status === 'approved').length;
    const approvalRate = totalProposals > 0 ? (approvedProposals / totalProposals) * 100 : 0;
    
    // Propostas pendentes
    const pendingProposals = proposals.filter(p => p.status === 'pending').length;
    
    // Total de clientes
    const totalClients = clients.length;
    
    // Novos clientes este mês
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const newClientsThisMonth = clients.filter(client => {
      const clientDate = client.createdAt?.toDate ? client.createdAt.toDate() : new Date(client.createdAt);
      return clientDate >= firstDayOfMonth;
    }).length;
    
    // Clientes PF vs PJ
    const pfClients = clients.filter(client => client.type === 'PF').length;
    const pjClients = clients.filter(client => client.type === 'PJ').length;
    
    // Clientes com cadastro incompleto
    const incompleteClients = clients.filter(client => client.status === 'incomplete').length;
    
    setStats({
      totalProposals,
      totalClients,
      totalCreditRequested,
      averageCredit,
      approvalRate,
      pendingProposals,
      newClientsThisMonth,
      pfClients,
      pjClients,
      incompleteClients
    });
  };

  const generatePipelineData = () => {
    const pipelineStatuses = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract'];
    
    // Criar dados para o gráfico (apenas itens com valor > 0)
    const chartData = pipelineStatuses.map(status => {
      const count = proposals.filter(p => p.pipelineStatus === status).length;
      return {
        name: pipelineStatusLabels[status as keyof typeof pipelineStatusLabels],
        value: count,
        color: pipelineStatusColors[status as keyof typeof pipelineStatusLabels]
      };
    }).filter(item => item.value > 0); // Filtrar apenas itens com valor maior que zero para o gráfico
    
    // Criar dados completos para a legenda (todos os status)
    const legendData = pipelineStatuses.map(status => {
      const count = proposals.filter(p => p.pipelineStatus === status).length;
      return {
        name: pipelineStatusLabels[status as keyof typeof pipelineStatusLabels],
        value: count,
        color: pipelineStatusColors[status as keyof typeof pipelineStatusLabels]
      };
    });
    
    setPipelineData({
      chartData: chartData,
      legendData: legendData
    });
  };

  const generateMonthlyData = () => {
    // Agrupar propostas por mês
    const monthlyProposals: { [key: string]: number } = {};
    const monthlyCredit: { [key: string]: number } = {};
    
    proposals.forEach(proposal => {
      if (proposal.createdAt) {
        const date = proposal.createdAt?.toDate ? proposal.createdAt.toDate() : new Date(proposal.createdAt);
        const monthYear = format(date, 'MMM yyyy', { locale: ptBR });
        
        if (!monthlyProposals[monthYear]) {
          monthlyProposals[monthYear] = 0;
          monthlyCredit[monthYear] = 0;
        }
        
        monthlyProposals[monthYear]++;
        monthlyCredit[monthYear] += proposal.desiredCredit;
      }
    });
    
    // Converter para array para o gráfico
    const data = Object.keys(monthlyProposals).map(month => ({
      name: month,
      propostas: monthlyProposals[month],
      desiredCredit: monthlyCredit[month]
    }));
    
    // Ordenar por data usando um método mais seguro
    const getMonthIndex = (monthName: string): number => {
      const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      return months.findIndex(m => monthName.toLowerCase().startsWith(m));
    };
    
    data.sort((a, b) => {
      const [monthA, yearA] = a.name.split(' ');
      const [monthB, yearB] = b.name.split(' ');
      
      const yearDiff = parseInt(yearA) - parseInt(yearB);
      if (yearDiff !== 0) return yearDiff;
      
      return getMonthIndex(monthA) - getMonthIndex(monthB);
    });
    
    setMonthlyData(data.slice(-6)); // Últimos 6 meses
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Data não disponível';
    
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Data não disponível';
    }
  };

  const statCards = [
    {
      label: 'Total de Propostas',
      value: stats.totalProposals.toString(),
      change: '+12%',
      trend: 'up',
      icon: FileText,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Crédito Solicitado',
      value: formatCurrency(stats.totalCreditRequested),
      change: '+8%',
      trend: 'up',
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Média por Proposta',
      value: formatCurrency(stats.averageCredit),
      change: '+5%',
      trend: 'up',
      icon: BarChart2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Taxa de Aprovação',
      value: `${stats.approvalRate.toFixed(1)}%`,
      change: '+2%',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Total de Clientes',
      value: stats.totalClients.toString(),
      change: `+${stats.newClientsThisMonth}`,
      trend: 'up',
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Pendências',
      value: stats.pendingProposals.toString(),
      change: stats.pendingProposals > 5 ? 'Alto' : 'Baixo',
      trend: stats.pendingProposals > 5 ? 'down' : 'up',
      icon: AlertTriangle,
      color: stats.pendingProposals > 5 ? 'text-red-500' : 'text-emerald-500',
      bgColor: stats.pendingProposals > 5 ? 'bg-red-500/10' : 'bg-emerald-500/10',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-black border border-gray-700 rounded-lg p-5 shadow-md">
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${stat.bgColor} mr-4`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400">{stat.label}</h3>
                <div className="flex items-baseline">
                  <p className="text-xl font-semibold text-white">{stat.value}</p>
                  <p className={`ml-2 flex items-baseline text-sm font-semibold ${
                    stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {stat.change}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Distribution */}
        <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Distribuição no Pipeline</h3>
            <div className="p-2 bg-gray-800 rounded-full">
              <PieChartIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="flex flex-col h-auto md:h-[450px]">
            <div className="h-[320px] md:h-[370px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Pie
                    data={pipelineData.chartData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={isMobile ? 50 : 75}
                    outerRadius={isMobile ? 75 : 125}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(pipelineData.chartData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 px-2 pb-2">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
                {(pipelineData.legendData || []).map((item: any, index: number) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-1" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-xs md:text-sm text-gray-300">{item.name} ({item.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trends */}
        <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Tendência Mensal</h3>
            <div className="p-2 bg-gray-800 rounded-full">
              <BarChart2 className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="flex flex-col h-auto md:h-[450px]">
            <div className="h-[320px] md:h-[370px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={isMobile ? 10 : 12} tickMargin={5} />
                  <YAxis stroke="#9CA3AF" fontSize={isMobile ? 10 : 12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="propostas" name="Propostas" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="desiredCredit" name="Crédito (R$)" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 px-2 pb-2">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1 bg-[#3B82F6]"></div>
                  <span className="text-xs md:text-sm text-gray-300">Propostas</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-1 bg-[#10B981]"></div>
                  <span className="text-xs md:text-sm text-gray-300">Crédito (R$)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid - Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Proposals */}
        <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Propostas Recentes</h3>
            <div className="p-2 bg-gray-800 rounded-full">
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-2">Nº</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Valor</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentProposals.length > 0 ? (
                  recentProposals.map((proposal) => (
                    <tr key={proposal.id} className="text-white">
                      <td className="px-4 py-3 text-sm">{proposal.proposalNumber}</td>
                      <td className="px-4 py-3 text-sm">{proposal.clientName}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(proposal.desiredCredit)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          proposal.pipelineStatus === 'submitted' ? 'bg-blue-500/20 text-blue-400' :
                          proposal.pipelineStatus === 'pre_analysis' ? 'bg-yellow-500/20 text-yellow-400' :
                          proposal.pipelineStatus === 'credit' ? 'bg-green-500/20 text-green-400' :
                          proposal.pipelineStatus === 'legal' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-orange-500/20 text-orange-400'
                        }`}>
                          {pipelineStatusLabels[proposal.pipelineStatus as keyof typeof pipelineStatusLabels]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(proposal.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm text-center text-gray-400">
                      Nenhuma proposta encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Clients */}
        <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Clientes Recentes</h3>
            <div className="p-2 bg-gray-800 rounded-full">
              <Users className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          {user?.role !== 'client' ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {recentClients.length > 0 ? (
                    recentClients.map((client) => (
                      <tr key={client.id} className="text-white">
                        <td className="px-4 py-3 text-sm">{client.name}</td>
                        <td className="px-4 py-3 text-sm">{client.type}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            client.status === 'complete' ? 'bg-green-500/20 text-green-400' :
                            client.status === 'incomplete' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {client.status === 'complete' ? 'Completo' : 
                             client.status === 'incomplete' ? 'Incompleto' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDate(client.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm text-center text-gray-400">
                        Nenhum cliente encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Informações de outros clientes não disponíveis para usuários do tipo cliente.</p>
            </div>
          )}
        </div>
      </div>

      {/* Client Type Distribution */}
      {user?.role !== 'client' && (
        <div className="bg-black border border-gray-700 rounded-lg p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Distribuição de Clientes</h3>
            <div className="p-2 bg-gray-800 rounded-full">
              <PieChartIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-500 mb-2">{stats.pfClients}</div>
              <div className="text-sm text-gray-400">Pessoa Física</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-500 mb-2">{stats.pjClients}</div>
              <div className="text-sm text-gray-400">Pessoa Jurídica</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-500 mb-2">{stats.incompleteClients}</div>
              <div className="text-sm text-gray-400">Cadastros Incompletos</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}