import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Eye, Pencil } from 'lucide-react';

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
  createdAt: Date;
  userId: string;
  creditLine?: string;
  creditReason?: string;
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
};

const pipelineStatusColors = {
  submitted: 'bg-blue-400/10 border-blue-400',
  pre_analysis: 'bg-yellow-400/10 border-yellow-400',
  credit: 'bg-green-400/10 border-green-400',
  legal: 'bg-purple-400/10 border-purple-400',
  contract: 'bg-orange-400/10 border-orange-400',
};

const pipelineStatusOrder = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract'];

export default function Pipeline() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedProposal, setDraggedProposal] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showObservationsModal, setShowObservationsModal] = useState(false);
  const [selectedObservations, setSelectedObservations] = useState<Proposal['observationsTimeline']>([]);
  const [selectedProposalNumber, setSelectedProposalNumber] = useState('');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchProposals();
  }, [user]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
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
          createdAt: data.createdAt?.toDate() || new Date(),
          userId: data.userId || '',
          creditLine: data.creditLine || '',
          creditReason: data.creditReason || '',
          observationsTimeline: data.observationsTimeline || [],
        };
      }) as Proposal[];

      setProposals(proposalsData);
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
    
    try {
      // Encontrar a proposta que está sendo arrastada
      const proposalToUpdate = proposals.find(p => p.id === draggedProposal);
      
      if (!proposalToUpdate) return;
      
      // Atualizar a proposta no Firestore
      const proposalRef = doc(db, 'proposals', draggedProposal);
      await updateDoc(proposalRef, {
        pipelineStatus: targetStatus,
      });
      
      // Atualizar o estado local
      setProposals(proposals.map(p => 
        p.id === draggedProposal 
          ? { ...p, pipelineStatus: targetStatus } 
          : p
      ));
      
      // Limpar o estado de arrastar
      setDraggedProposal(null);
    } catch (error) {
      console.error('Erro ao atualizar status da proposta:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getProposalsByStatus = (status: Proposal['pipelineStatus']) => {
    return proposals.filter(proposal => proposal.pipelineStatus === status);
  };

  return (
    <div className="dark-card rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-6">Pipeline</h2>
      
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {pipelineStatusOrder.map((status) => (
            <div 
              key={status}
              className="flex flex-col h-full"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-medium text-white">
                  {pipelineStatusLabels[status as keyof typeof pipelineStatusLabels]}
                </h3>
                <span className="text-xs text-white bg-gray-800 rounded-full px-2 py-0.5">
                  {getProposalsByStatus(status as Proposal['pipelineStatus']).length}
                </span>
              </div>
              
              <div 
                className={`flex-1 bg-gray-900 rounded-lg p-3 min-h-[500px] overflow-y-auto ${
                  draggedProposal ? 'border-2 border-dashed' : 'border border-gray-700'
                }`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status as Proposal['pipelineStatus'])}
              >
                {getProposalsByStatus(status as Proposal['pipelineStatus']).length > 0 ? (
                  <div className="space-y-3">
                    {getProposalsByStatus(status as Proposal['pipelineStatus']).map((proposal) => (
                      <div 
                        key={proposal.id}
                        className={`bg-black rounded-lg p-3 cursor-move shadow-md border ${
                          pipelineStatusColors[proposal.pipelineStatus]
                        }`}
                        draggable
                        onDragStart={() => handleDragStart(proposal.id)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-white font-medium">
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
                                    className="flex items-center w-full px-4 py-2 text-sm text-amber-400 hover:text-amber-300 hover:bg-gray-700/70 transition-all"
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <h4 className="text-sm font-medium text-white mb-2">
                          <a 
                            href={`/clients/detail/${proposal.clientId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clients/detail/${proposal.clientId}`);
                            }}
                            className="hover:underline hover:text-blue-300"
                          >
                            {proposal.clientName}
                          </a>
                        </h4>
                        
                        <div className="space-y-1">
                          <p className="text-xs text-white">
                            Data: {format(proposal.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                          {proposal.creditLine && (
                            <p className="text-xs text-white">
                              Linha: {proposal.creditLine}
                            </p>
                          )}
                          {proposal.creditReason && (
                            <p className="text-xs text-white">
                              Motivo: {proposal.creditReason}
                            </p>
                          )}
                          <p className="text-xs text-white">
                            Crédito: {formatCurrency(proposal.desiredCredit)}
                          </p>
                          {proposal.observationsTimeline && proposal.observationsTimeline.length > 0 && (
                            <div 
                              className="mt-1 flex items-center text-xs text-blue-400 cursor-pointer hover:text-blue-300 hover:drop-shadow-[0_0_4px_rgba(96,165,250,0.6)] transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedObservations(proposal.observationsTimeline || []);
                                setSelectedProposalNumber(proposal.proposalNumber);
                                setShowObservationsModal(true);
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                              </svg>
                              {proposal.observationsTimeline.length} observação(ões)
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-white">Nenhuma proposta</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal de Observações */}
      {showObservationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-black border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Observações - {selectedProposalNumber}</h3>
              <button 
                onClick={() => setShowObservationsModal(false)}
                className="text-gray-300 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedObservations && selectedObservations.length > 0 ? (
                selectedObservations.map((observation, index) => (
                  <div key={observation.id} className="relative pl-6 pb-4">
                    {/* Linha vertical da timeline */}
                    {index < selectedObservations.length - 1 && (
                      <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-700"></div>
                    )}
                    
                    {/* Círculo da timeline */}
                    <div className="absolute left-0 top-2 h-4 w-4 rounded-full bg-blue-500"></div>
                    
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2">
                        <span className="text-sm font-medium text-white">{observation.createdByName}</span>
                        <span className="text-xs text-white">
                          {(() => {
                            try {
                              // Usar type assertion para informar ao TypeScript que o objeto tem o método toDate()
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
                      <p className="text-sm text-white whitespace-pre-wrap">{observation.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white">Nenhuma observação registrada.</p>
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowObservationsModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
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