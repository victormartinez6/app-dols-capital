import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Eye, Pencil, X, Search } from 'lucide-react';

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
  submitted: 'bg-blue-600 border-blue-600',
  pre_analysis: 'bg-indigo-600 border-indigo-600',
  credit: 'bg-teal-600 border-teal-600',
  legal: 'bg-purple-600 border-purple-600',
  contract: 'bg-orange-600 border-orange-600',
  closed: 'bg-emerald-600 border-emerald-600',
  lost: 'bg-red-600 border-red-600',
};

const pipelineStatusHeaderColors = {
  submitted: 'bg-blue-600 text-white',
  pre_analysis: 'bg-indigo-600 text-white',
  credit: 'bg-teal-600 text-white',
  legal: 'bg-purple-600 text-white',
  contract: 'bg-orange-600 text-white',
  closed: 'bg-emerald-600 text-white',
  lost: 'bg-red-600 text-white',
};

const pipelineStatusOrder = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract', 'closed', 'lost'];

export default function Pipeline() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedProposal, setDraggedProposal] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showObservationsModal, setShowObservationsModal] = useState(false);
  const [selectedObservations, setSelectedObservations] = useState<Proposal['observationsTimeline']>([]);
  const [selectedProposalNumber, setSelectedProposalNumber] = useState('');

  // Filtros
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Proposal['pipelineStatus']>('all');
  const [bankFilter, setbankFilter] = useState<string>('all');
  const [banksList, setBanksList] = useState<{id: string, name: string}[]>([]);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchProposals();
    fetchBanks();
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
      let q;

      if (user?.role === 'client') {
        q = query(collection(db, 'proposals'), where('userId', '==', user.id));
      } else {
        q = query(collection(db, 'proposals'));
      }

      const querySnapshot = await getDocs(q);

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
    setDraggedProposal(proposalId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStatus: Proposal['pipelineStatus']) => {
    e.preventDefault();

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

      await updateDoc(proposalRef, {
        pipelineStatus: targetStatus,
        observationsTimeline: [...(proposal.observationsTimeline || []), newObservation],
      });

      setProposals(prevProposals =>
        prevProposals.map(p =>
          p.id === draggedProposal
            ? {
                ...p,
                pipelineStatus: targetStatus,
                observationsTimeline: [...(p.observationsTimeline || []), newObservation],
              }
            : p
        )
      );
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

  return (
    <div className="dark-card rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-6">Pipeline</h2>

      {/* Filtros */}
      <div className="bg-black border border-gray-700 rounded-lg p-4 space-y-4 mb-6">
        <h3 className="text-lg font-medium text-white mb-2">Filtros</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filtro por texto */}
          <div>
            <label htmlFor="searchFilter" className="block text-sm font-medium text-white mb-1">
              Nome do Cliente
            </label>
            <div className="relative">
              <input
                type="text"
                id="searchFilter"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-black border border-gray-600 text-white rounded-md w-full px-3 py-2.5 h-10 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Buscar por cliente ou número..."
              />
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
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
          
          {/* Filtro por banco */}
          <div>
            <label htmlFor="bankFilter" className="block text-sm font-medium text-white mb-1">
              Banco
            </label>
            <select
              id="bankFilter"
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
            className="flex items-center text-sm text-white hover:text-blue-300"
          >
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid grid-flow-col auto-cols-[280px] gap-4 min-w-full">
            {pipelineStatusOrder.map((status) => (
              <div 
                key={status}
                className="flex flex-col h-full"
              >
                <div className={`rounded-t-lg px-3 py-3 flex items-center justify-between ${pipelineStatusHeaderColors[status as keyof typeof pipelineStatusHeaderColors]}`}>
                  <h3 className="text-md font-medium">
                    {pipelineStatusLabels[status as keyof typeof pipelineStatusLabels]}
                  </h3>
                  <span className="text-xs bg-black/30 rounded-full px-2 py-1">
                    {getProposalsByStatus(status as Proposal['pipelineStatus']).length}
                  </span>
                </div>

                <div 
                  className={`flex-1 bg-gray-800 rounded-b-lg p-3 min-h-[500px] max-h-[70vh] overflow-y-auto border-x border-b ${
                    draggedProposal ? 'border-2 border-dashed' : 'border-gray-700'
                  }`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, status as Proposal['pipelineStatus'])}
                >
                  {getProposalsByStatus(status as Proposal['pipelineStatus']).length > 0 ? (
                    <div className="space-y-3">
                      {getProposalsByStatus(status as Proposal['pipelineStatus']).map((proposal) => (
                        <div 
                          key={proposal.id}
                          className={`bg-gray-900 rounded-lg shadow-md overflow-hidden cursor-move border-l-4 ${
                            pipelineStatusColors[proposal.pipelineStatus].split(' ')[1]
                          }`}
                          draggable
                          onDragStart={() => handleDragStart(proposal.id)}
                        >
                          <div className="p-3">
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-xs font-medium px-2 py-1 rounded bg-black/30 text-white">
                                {proposal.proposalNumber}
                              </span>
                              <div className="relative">
                                <button
                                  onClick={() => setShowDropdown(showDropdown === proposal.id ? null : proposal.id)}
                                  className="p-1 rounded-full hover:bg-gray-700"
                                >
                                  <MoreHorizontal className="h-4 w-4 text-gray-300" />
                                </button>

                                {showDropdown === proposal.id && (
                                  <div className="absolute right-0 mt-1 w-36 bg-black rounded-md shadow-lg z-10 border border-gray-700">
                                    <div className="py-1">
                                      <button
                                        onClick={() => {
                                          navigate(`/proposals/detail/${proposal.id}`);
                                          setShowDropdown(null);
                                        }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-gray-700/70 transition-all"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver Proposta
                                      </button>

                                      <button
                                        onClick={() => {
                                          navigate(`/proposals/edit/${proposal.id}`);
                                          setShowDropdown(null);
                                        }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-yellow-400 hover:text-yellow-300 hover:bg-gray-700/70 transition-all"
                                      >
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Editar
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedObservations(proposal.observationsTimeline || []);
                                          setSelectedProposalNumber(proposal.proposalNumber);
                                          setShowObservationsModal(true);
                                          setShowDropdown(null);
                                        }}
                                        className="flex items-center w-full px-4 py-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-gray-700/70 transition-all"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Observações
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <h4 className="font-semibold text-white mb-2">
                              <button 
                                onClick={() => navigate(`/clients/detail/${proposal.clientId}`)}
                                className="hover:text-blue-400 transition-colors text-left"
                              >
                                {proposal.clientName}
                              </button>
                            </h4>
                            
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Data:</span>
                                <span className="text-white">
                                  {(() => {
                                    try {
                                      if (proposal.createdAt && typeof proposal.createdAt === 'object' && 'toDate' in proposal.createdAt) {
                                        const date = proposal.createdAt.toDate();
                                        return format(date, 'dd/MM/yyyy', { locale: ptBR });
                                      }
                                      return 'Data não disponível';
                                    } catch (error) {
                                      console.error('Erro ao formatar data:', error);
                                      return 'Data não disponível';
                                    }
                                  })()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Crédito:</span>
                                <span className="text-white">{formatCurrency(proposal.desiredCredit)}</span>
                              </div>
                              {proposal.bankName && (
                                <div className="flex justify-between">
                                  <span className="text-gray-400">Banco:</span>
                                  <span className="text-white">{proposal.bankName}</span>
                                </div>
                              )}
                            </div>
                            
                            {proposal.observationsTimeline && proposal.observationsTimeline.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-gray-700">
                                <button
                                  onClick={() => {
                                    setSelectedObservations(proposal.observationsTimeline || []);
                                    setSelectedProposalNumber(proposal.proposalNumber);
                                    setShowObservationsModal(true);
                                  }}
                                  className="text-xs text-purple-400 hover:text-purple-300"
                                >
                                  {proposal.observationsTimeline.length} observação(ões)
                                </button>
                              </div>
                            )}
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