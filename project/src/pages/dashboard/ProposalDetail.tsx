import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

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
  companyDescription?: string;
  hasRestriction?: boolean;
  observations?: string;
  observationsTimeline?: {
    id: string;
    text: string;
    createdAt: Date | string;
    createdBy: string;
    createdByName: string;
  }[];
}

const proposalStatusLabels = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  in_analysis: 'Em Análise',
};

const proposalStatusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  approved: 'text-green-400 bg-green-400/10',
  rejected: 'text-red-400 bg-red-400/10',
  in_analysis: 'text-blue-400 bg-blue-400/10',
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

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [observationText, setObservationText] = useState('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
    const fetchProposal = async () => {
      if (!id) {
        console.log('ID não fornecido');
        setError('ID da proposta não fornecido');
        setLoading(false);
        return;
      }

      try {
        console.log('Iniciando busca da proposta:', id);
        setLoading(true);
        setError(null);
        
        const docRef = doc(db, 'proposals', id);
        const docSnap = await getDoc(docRef);

        console.log('Documento existe?', docSnap.exists());
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Dados da proposta:', data);
          
          // Verificação de permissão apenas para clientes
          // Clientes só podem ver suas próprias propostas
          if (user?.role === 'client' && data.userId !== user?.id) {
            console.log('Permissão negada. User ID:', user?.id, 'Proposta User ID:', data.userId);
            setError('Você não tem permissão para visualizar esta proposta');
            setLoading(false);
            return;
          }
          
          // Tratamento seguro para a data
          let createdAtDate;
          try {
            createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
            console.log('Data convertida:', createdAtDate);
          } catch (e) {
            console.error('Erro ao converter data:', e, data.createdAt);
            createdAtDate = new Date();
          }
          
          // Tratamento seguro para o timeline de observações
          const safeObservationsTimeline = Array.isArray(data.observationsTimeline) 
            ? data.observationsTimeline 
            : [];
          
          console.log('Timeline segura:', safeObservationsTimeline);
            
          const proposalData = {
            id: docSnap.id,
            proposalNumber: data.proposalNumber || `PROP-${docSnap.id.substring(0, 6).toUpperCase()}`,
            clientName: data.clientName || 'Nome não disponível',
            clientId: data.clientId || '',
            desiredCredit: data.desiredCredit || 0,
            hasProperty: data.hasProperty || false,
            propertyValue: data.propertyValue || 0,
            status: data.status || 'pending',
            pipelineStatus: data.pipelineStatus || 'submitted',
            createdAt: createdAtDate,
            userId: data.userId || '',
            creditLine: data.creditLine || '',
            creditReason: data.creditReason || '',
            companyDescription: data.companyDescription || '',
            hasRestriction: data.hasRestriction || false,
            observations: data.observations || '',
            observationsTimeline: safeObservationsTimeline,
          };
          
          console.log('Proposta formatada:', proposalData);
          setProposal(proposalData);
        } else {
          console.log('Documento não encontrado');
          setError('Proposta não encontrada');
        }
      } catch (error) {
        console.error('Erro ao buscar proposta:', error);
        setError('Erro ao carregar os dados da proposta. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [id, user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleBack = () => {
    console.log('Navegando de volta para a lista de propostas');
    try {
      navigate('/proposals');
    } catch (error) {
      console.error('Erro ao navegar:', error);
      // Fallback para a página inicial do dashboard se houver erro
      navigate('/dashboard');
    }
  };

  const handleAddObservation = () => {
    setShowObservationModal(true);
    setObservationText('');
  };

  const handleSaveObservation = async () => {
    if (!id || !observationText.trim()) return;

    try {
      const proposalRef = doc(db, 'proposals', id);
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
      
      // Atualizar a proposta
      const updatedProposal = {
        ...proposal!,
        observationsTimeline: [...(proposal?.observationsTimeline || []), newObservation],
      };
      setProposal(updatedProposal);
      
      // Fechar o modal
      setShowObservationModal(false);
      setObservationText('');
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
    }
  };

  if (loading) {
    console.log('Renderizando estado de carregamento');
    return (
      <div className="dark-card rounded-lg p-6">
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    console.log('Renderizando estado de erro:', error, 'Proposta:', proposal);
    return (
      <div className="dark-card rounded-lg p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-red-400 text-lg">{error || 'Proposta não encontrada'}</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            Voltar para Propostas
          </button>
        </div>
      </div>
    );
  }

  console.log('Renderizando proposta completa');
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="mr-4 p-2 hover:bg-gray-800 rounded-full"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h2 className="text-xl font-semibold text-white">Detalhes da Proposta</h2>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <h3 className="text-lg font-medium text-white">
            {proposal.proposalNumber}
          </h3>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${proposalStatusColors[proposal.status]}`}>
            {proposalStatusLabels[proposal.status]}
          </span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pipelineStatusColors[proposal.pipelineStatus]}`}>
            {pipelineStatusLabels[proposal.pipelineStatus]}
          </span>
        </div>
        <p className="text-sm text-gray-400">
          Criada em {format(proposal.createdAt, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-900/50 rounded-lg p-5">
          <h4 className="text-md font-medium text-white mb-4">Informações do Cliente</h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">Nome do Cliente</p>
              <p className="text-sm text-white">{proposal.clientName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Possui Restrição Financeira</p>
              <p className="text-sm text-white">{proposal.hasRestriction ? 'Sim' : 'Não'}</p>
            </div>
            {proposal.companyDescription && (
              <div>
                <p className="text-xs text-gray-400">Descrição da Empresa</p>
                <p className="text-sm text-white">{proposal.companyDescription}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-5">
          <h4 className="text-md font-medium text-white mb-4">Informações do Crédito</h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">Crédito Pretendido</p>
              <p className="text-sm text-white">{formatCurrency(proposal.desiredCredit)}</p>
            </div>
            {proposal.creditLine && (
              <div>
                <p className="text-xs text-gray-400">Linha de Crédito</p>
                <p className="text-sm text-white">{proposal.creditLine}</p>
              </div>
            )}
            {proposal.creditReason && (
              <div>
                <p className="text-xs text-gray-400">Motivo do Crédito</p>
                <p className="text-sm text-white">{proposal.creditReason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-5">
          <h4 className="text-md font-medium text-white mb-4">Informações do Imóvel</h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">Possui Imóvel</p>
              <p className="text-sm text-white">{proposal.hasProperty ? 'Sim' : 'Não'}</p>
            </div>
            {proposal.hasProperty && (
              <div>
                <p className="text-xs text-gray-400">Valor do Imóvel</p>
                <p className="text-sm text-white">{formatCurrency(proposal.propertyValue)}</p>
              </div>
            )}
          </div>
        </div>

        {proposal.observations && (
          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Observações</h4>
            <p className="text-sm text-white">{proposal.observations}</p>
          </div>
        )}
      </div>

      {isAdmin && proposal && (
        <div id="observations" className="bg-gray-900/50 rounded-lg p-5 md:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-medium text-white">Observações</h4>
            <button
              onClick={handleAddObservation}
              className="flex items-center text-sm text-blue-400 hover:text-blue-300"
            >
              <MessageSquarePlus className="h-4 w-4 mr-1" />
              Nova Observação
            </button>
          </div>
          
          {proposal.observationsTimeline && proposal.observationsTimeline.length > 0 ? (
            <div className="space-y-4">
              {proposal.observationsTimeline.map((observation, index) => (
                <div key={observation.id} className="relative pl-6 pb-4">
                  {/* Linha vertical da timeline */}
                  {index < proposal.observationsTimeline!.length - 1 && (
                    <div className="absolute left-2 top-3 bottom-0 w-0.5 bg-gray-700"></div>
                  )}
                  
                  {/* Círculo da timeline */}
                  <div className="absolute left-0 top-2 h-4 w-4 rounded-full bg-blue-500"></div>
                  
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2">
                      <span className="text-sm font-medium text-white">{observation.createdByName}</span>
                      <span className="text-xs text-gray-400">
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
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{observation.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma observação registrada.</p>
          )}
        </div>
      )}

      {isAdmin && proposal && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate(`/proposals/edit/${proposal.id}`)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            Editar Proposta
          </button>
        </div>
      )}

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
                className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500 min-h-[100px]"
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowObservationModal(false)}
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
    </div>
  );
}
