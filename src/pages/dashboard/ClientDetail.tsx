import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft, Building2, User, FileText, MessageSquarePlus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';

interface Registration {
  id: string;
  type: 'PF' | 'PJ';
  name?: string;
  companyName?: string;
  email?: string;
  partnerEmail?: string;
  cpf?: string;
  cnpj?: string;
  phone?: string;
  ddi?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  hasProperty?: boolean;
  propertyValue?: number;
  desiredCredit?: number;
  createdAt: Date;
  status: 'complete' | 'documents_pending';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract';
  userId: string;
  documents?: Record<string, any>;
  pendencies?: Array<{
    message: string;
    createdAt: Date;
    resolved?: boolean;
    resolvedAt?: Date;
  }>;
  observationsTimeline?: Array<{
    id: string;
    text: string;
    createdAt: Date | string;
    createdBy: string;
    createdByName: string;
  }>;
  teamName?: string;
  teamCode?: string;
  team?: string;
  partnerId?: string;
  partnerName?: string;
  managerId?: string;
  managerName?: string;
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

const documentLabels: Record<string, string> = {
  identity_document: 'Documento de Identidade (RG)',
  address_proof: 'Comprovante de Endereço',
  income_tax_declaration: 'Declaração de Imposto de Renda',
  income_tax_receipt: 'Recibo de Entrega do Imposto de Renda',
  marital_status_certificate: 'Certidão de Estado Civil',
  cnpj_card: 'Cartão CNPJ',
  social_contract: 'Contrato Social',
  company_tax_certificate: 'Certidão Negativa de Débitos',
  balance_sheet: 'Balanço Patrimonial',
  profit_loss_statement: 'Demonstração de Resultados',
};

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showObservationModal, setShowObservationModal] = useState(false);
  const [observationText, setObservationText] = useState('');
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<{ url: string; name: string; type?: string }>({ url: '', name: '' });

  useEffect(() => {
    const fetchRegistration = async () => {
      if (!id) {
        console.error('ID do cliente não encontrado nos parâmetros da URL');
        setError('ID do cliente não encontrado');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Buscando cliente com ID:', id);
        const docRef = doc(db, 'registrations', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log('Dados do cliente encontrados:', data);
          
          // Inicializar variáveis
          let teamName = '';
          let teamCode = '';
          let managerName = '';
          let partnerName = '';
          
          // Obter o parceiro vinculado diretamente do campo inviterName na coleção registrations
          partnerName = data.inviterName || '';
          console.log('Parceiro vinculado (inviterName):', partnerName);
          
          // Buscar informações da equipe e do gerente na coleção teams
          if (data.team) {
            try {
              const teamDoc = await getDoc(doc(db, 'teams', data.team));
              if (teamDoc.exists()) {
                const teamData = teamDoc.data();
                teamName = teamData.name || '';
                teamCode = teamData.teamCode || '';
                
                // Obter o gerente de equipe diretamente do campo managerName na coleção teams
                managerName = teamData.managerName || '';
                console.log('Gerente de equipe (managerName da equipe):', managerName);
              }
            } catch (err) {
              console.error('Erro ao buscar informações da equipe:', err);
            }
          } else {
            // Se não tiver equipe, usar os campos teamCode e teamName diretamente do documento
            teamName = data.teamName || '';
            teamCode = data.teamCode || '';
          }
          
          console.log('Dados processados:', {
            teamName,
            teamCode,
            managerName,
            partnerName
          });
          
          // Tratamento seguro para o timeline de observações
          const safeObservationsTimeline = Array.isArray(data.observationsTimeline) 
            ? data.observationsTimeline.map((obs: any) => ({
                ...obs,
                createdAt: obs.createdAt?.toDate ? obs.createdAt.toDate() : new Date(obs.createdAt)
              }))
            : [];
          
          // Processar documentos para adicionar URLs
          const processedDocuments: Record<string, any> = {};
          
          if (data.documents) {
            console.log('Estrutura original dos documentos:', JSON.stringify(data.documents, null, 2));
            
            // Função para buscar documento da coleção document_files
            const fetchDocumentFile = async (docId: string) => {
              try {
                const docFileRef = doc(db, 'document_files', docId);
                const docFileSnap = await getDoc(docFileRef);
                
                if (docFileSnap.exists()) {
                  return docFileSnap.data();
                }
                return null;
              } catch (error) {
                console.error(`Erro ao buscar documento ${docId}:`, error);
                return null;
              }
            };
            
            // Processar cada documento
            const documentPromises = [];
            
            for (const [key, doc] of Object.entries(data.documents)) {
              if (typeof doc === 'object' && doc !== null) {
                const docData = doc as Record<string, any>;
                console.log(`Documento ${key}:`, docData);
                
                // Se o documento tiver um ID, buscar da coleção document_files
                if (docData.id) {
                  // Adicionar uma promessa para buscar o documento
                  documentPromises.push(
                    fetchDocumentFile(docData.id).then(docFileData => {
                      if (docFileData) {
                        console.log(`Documento ${key} encontrado na coleção document_files:`, docFileData);
                        processedDocuments[key] = {
                          ...docData,
                          ...docFileData,
                          // Garantir que temos uma URL válida
                          url: docFileData.downloadURL || docFileData.url || docData.url || `/api/documents/${docData.id}`
                        };
                      } else {
                        console.log(`Documento ${key} não encontrado na coleção document_files, usando dados do cliente`);
                        processedDocuments[key] = {
                          ...docData,
                          // Usar o URL direto do Storage se disponível
                          url: docData.url || docData.downloadURL || `/api/documents/${docData.id}`
                        };
                      }
                    })
                  );
                } else {
                  processedDocuments[key] = docData;
                }
              }
            }
            
            // Aguardar todas as promessas de busca de documentos
            await Promise.all(documentPromises);
          }
          
          console.log('Documentos processados:', processedDocuments);
          
          // Buscar o status do pipeline mais recente das propostas
          const proposalsRef = collection(db, 'proposals');
          const proposalsSnap = await getDocs(proposalsRef);
          const proposals = proposalsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            clientId: doc.data().clientId || doc.data().userId,
            pipelineStatus: doc.data().pipelineStatus
          }));
          
          // Filtrar propostas para este cliente
          const clientProposals = proposals.filter(proposal => 
            proposal.clientId === id || 
            proposal.clientId === data.userId
          );
          
          // Determinar o status do pipeline
          let pipelineStatus = data.pipelineStatus;
          
          if (clientProposals.length > 0) {
            // Encontrar o status mais avançado no pipeline
            const statusOrder = ['submitted', 'pre_analysis', 'credit', 'legal', 'contract'];
            let mostAdvancedIndex = statusOrder.indexOf(pipelineStatus);
            
            clientProposals.forEach(proposal => {
              if (proposal.pipelineStatus) {
                const proposalStatusIndex = statusOrder.indexOf(proposal.pipelineStatus);
                if (proposalStatusIndex > mostAdvancedIndex) {
                  mostAdvancedIndex = proposalStatusIndex;
                  pipelineStatus = proposal.pipelineStatus;
                }
              }
            });
          }
          
          if (!pipelineStatus) {
            pipelineStatus = 'submitted';
          }
          
          console.log('Status do Pipeline final:', pipelineStatus);
          
          // Atualizar o estado com os dados do cliente e o status do pipeline correto
          // Definir o registro com os dados processados
          const registrationData: Registration = {
            id,
            ...data,
            type: data.type || 'PF',
            status: data.status || 'complete',
            pipelineStatus: pipelineStatus,
            userId: data.userId || '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
            documents: processedDocuments,
            observationsTimeline: safeObservationsTimeline,
            teamName,
            teamCode,
            managerName,
            partnerName,
          };
          
          setRegistration(registrationData);
          setLoading(false);
        } else {
          console.error('Cliente não encontrado');
          setError('Cliente não encontrado');
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        setError('Erro ao buscar cliente');
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [id]);

  const handleEditClick = () => {
    if (!registration) return;
    
    // Verificar o tipo de cliente e redirecionar para o formulário correto
    const clientType = registration.type;
    console.log('Tipo de cliente detectado:', clientType);
    
    let path;
    if (clientType === 'PF') {
      path = `/register/individual/${registration.id}`;
    } else if (clientType === 'PJ') {
      path = `/register/company/${registration.id}`;
    } else {
      console.error('Tipo de cliente desconhecido:', clientType);
      return;
    }
    
    console.log('Redirecionando para:', path);
    navigate(path);
  };

  const handleDocumentView = (docData: any) => {
    console.log('Dados completos do documento:', docData);
    
    // Se a URL for relativa, converter para URL absoluta
    let fullUrl = docData.url || '';
    let docType = docData.contentType || docData.type || '';
    
    // Verificar se temos uma URL direta do Storage
    if (docData.downloadURL) {
      fullUrl = docData.downloadURL;
      console.log('Usando downloadURL do documento:', fullUrl);
    } else if (docData.url) {
      fullUrl = docData.url;
      console.log('Usando url do documento:', fullUrl);
    } else if (docData.fileURL) {
      fullUrl = docData.fileURL;
      console.log('Usando fileURL do documento:', fullUrl);
    }
    
    // Converter URL relativa para absoluta se necessário
    if (fullUrl && fullUrl.startsWith('/')) {
      fullUrl = `${window.location.origin}${fullUrl}`;
      console.log('URL relativa convertida para absoluta:', fullUrl);
    }
    
    // Se não temos URL, não podemos mostrar o documento
    if (!fullUrl) {
      console.error('Documento sem URL válida:', docData);
      alert('Não foi possível encontrar uma URL válida para este documento.');
      return;
    }
    
    console.log('Visualizando documento:', docData.name, fullUrl);
    
    // Tentar determinar o tipo do documento pela extensão se não tivermos o tipo
    if (!docType) {
      const extension = fullUrl.split('.').pop()?.toLowerCase();
      if (extension === 'pdf') {
        docType = 'application/pdf';
      } else if (['jpg', 'jpeg', 'png', 'gif'].includes(extension || '')) {
        docType = `image/${extension}`;
      }
    }
    
    // Definir o documento atual e abrir o modal
    setCurrentDocument({ 
      url: fullUrl, 
      name: docData.name || 'Documento', 
      type: docType
    });
    setShowDocumentModal(true);
  };

  const handleAddObservation = () => {
    setShowObservationModal(true);
  };
  
  const handleSaveObservation = async () => {
    if (!id || !observationText.trim()) return;

    try {
      const registrationRef = doc(db, 'registrations', id);
      const registrationDoc = await getDoc(registrationRef);
      
      if (!registrationDoc.exists()) {
        console.error('Cliente não encontrado');
        return;
      }

      const registrationData = registrationDoc.data();
      const observationsTimeline = registrationData.observationsTimeline || [];
      
      // Gerar um ID único usando timestamp e um número aleatório
      const uniqueId = `obs_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
      
      const newObservation = {
        id: uniqueId,
        text: observationText.trim(),
        createdAt: new Date(),
        createdBy: user?.id || 'unknown',
        createdByName: user?.name || 'Usuário',
      };
      
      await updateDoc(registrationRef, {
        observationsTimeline: [...observationsTimeline, newObservation],
      });
      
      // Atualizar o registro local
      const updatedRegistration = {
        ...registration!,
        observationsTimeline: [...(registration?.observationsTimeline || []), newObservation],
      };
      setRegistration(updatedRegistration);
      
      // Fechar o modal
      setShowObservationModal(false);
      setObservationText('');
    } catch (error) {
      console.error('Erro ao adicionar observação:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error || !registration) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
        <p className="text-sm text-red-500">{error || 'Erro ao carregar os dados do cliente'}</p>
        <button
          onClick={() => navigate('/clients')}
          className="mt-4 px-4 py-2 bg-black border border-gray-700 text-white rounded-md hover:bg-gray-900"
        >
          Voltar para a lista de clientes
        </button>
      </div>
    );
  }

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-0">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-white bg-gray-800 rounded-full hover:bg-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl md:text-2xl font-bold text-white">Detalhes do Cliente</h2>
        </div>
        
        <div className="w-full sm:flex-1 sm:flex sm:justify-end">
          <button
            onClick={handleEditClick}
            className="w-full sm:w-auto px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100"
          >
            Editar Cadastro
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Informações Básicas */}
        <div className="md:col-span-2 bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-semibold text-white">Informações do Cliente</h3>
            <div className="flex items-center space-x-2">
              {registration.type === 'PJ' ? (
                <Building2 className="h-5 w-5 text-blue-400" />
              ) : (
                <User className="h-5 w-5 text-green-400" />
              )}
              <span className={`${
                registration.type === 'PJ' ? 'text-blue-400' : 'text-green-400'
              }`}>
                {registration.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400">
                  {registration.type === 'PJ' ? 'Razão Social' : 'Nome Completo'}
                </h4>
                <p className="text-white">
                  {registration.type === 'PJ' ? registration.companyName : registration.name}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400">
                  {registration.type === 'PJ' ? 'CNPJ' : 'CPF'}
                </h4>
                <p className="text-white">
                  {registration.type === 'PJ' 
                    ? registration.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') 
                    : registration.cpf?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400">Email</h4>
                <p className="text-white">
                  {registration.type === 'PJ' ? registration.partnerEmail : registration.email}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400">Telefone</h4>
                <p className="text-white">
                  {registration.ddi} {registration.phone?.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400">Equipe</h4>
                <p className="text-white">
                  {registration.teamCode ? (
                    <span 
                      className="px-2 py-1 text-xs font-medium rounded-md bg-blue-900 text-blue-200 cursor-help inline-block"
                      title={`Equipe: ${registration.teamName}`}
                    >
                      {registration.teamCode}
                    </span>
                  ) : (
                    <span className="text-gray-500">Sem equipe</span>
                  )}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-400">Gerente de Equipe</h4>
                <p className="text-white">
                  {registration.managerName ? (
                    <span className="text-blue-400">{registration.managerName}</span>
                  ) : (
                    <span className="text-gray-500">Não vinculado</span>
                  )}
                </p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-400">Parceiro Vinculado</h4>
                <p className="text-white">
                  {registration.partnerName ? (
                    <span className="text-green-400">{registration.partnerName}</span>
                  ) : (
                    <span className="text-gray-500">Não vinculado</span>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400">Endereço</h4>
                <p className="text-white">
                  {registration.street}, {registration.number}
                  {registration.complement ? `, ${registration.complement}` : ''}
                </p>
                <p className="text-white">
                  {registration.neighborhood}, {registration.city} - {registration.state}
                </p>
                <p className="text-white">
                  CEP: {registration.cep?.replace(/^(\d{5})(\d{3})$/, '$1-$2')}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-400">Possui Imóvel?</h4>
                <p className="text-white">
                  {registration.hasProperty ? 'Sim' : 'Não'}
                </p>
              </div>

              {registration.hasProperty && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400">Valor do Imóvel</h4>
                  <p className="text-white">
                    {formatCurrency(registration.propertyValue)}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-400">Crédito Pretendido</h4>
                <p className="text-white">
                  {formatCurrency(registration.desiredCredit)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status e Informações Adicionais */}
        <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
          <h3 className="text-lg md:text-xl font-semibold text-white">Status</h3>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-400">Data de Cadastro</h4>
              <p className="text-white">
                {format(registration.createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-400">Status do Cliente</h4>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                registrationStatusColors[registration.status]
              }`}>
                {registrationStatusLabels[registration.status]}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-400">Status do Pipeline:</h4>
              <div className="mt-2">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${pipelineStatusColors[registration.pipelineStatus as keyof typeof pipelineStatusColors]}`}>
                  {pipelineStatusLabels[registration.pipelineStatus as keyof typeof pipelineStatusLabels]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documentos */}
      <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg md:text-xl font-semibold text-white">Documentos</h3>
          {registration.documents && Object.keys(registration.documents).length > 0 && (
            <span className="text-sm text-blue-400">
              {Object.keys(registration.documents).filter(key => registration.documents![key] && registration.documents![key].url).length} documento(s)
            </span>
          )}
        </div>

        {registration.documents && Object.keys(registration.documents).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(registration.documents)
              .filter(([_, doc]) => doc && doc.url) // Filtra apenas documentos válidos com URL
              .map(([key, doc]) => (
                <div key={key} className="border border-gray-800 rounded-lg p-4 flex items-start space-x-3 hover:bg-gray-900 transition-colors">
                  <FileText className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-medium text-white truncate">{documentLabels[key] || key}</h4>
                    <p className="text-xs text-gray-400 mb-2 truncate">
                      {doc.name || 'Documento anexado'}
                    </p>
                    <a 
                      href="#"
                      className="text-xs text-blue-400 hover:text-blue-300"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDocumentView(doc);
                      }}
                    >
                      <span>Visualizar documento</span>
                    </a>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-400">Nenhum documento anexado</p>
        )}
      </div>

      {/* Histórico de Pendências */}
      <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
        <h3 className="text-lg md:text-xl font-semibold text-white">Histórico de Pendências</h3>

        {registration.pendencies && registration.pendencies.length > 0 ? (
          <div className="space-y-4">
            {registration.pendencies.map((pendency, index) => (
              <div key={index} className="relative pl-8 pb-6">
                {/* Linha vertical conectando os itens */}
                {index < registration.pendencies!.length - 1 && (
                  <div className="absolute left-3 top-3 bottom-0 w-0.5 bg-gray-700"></div>
                )}
                
                {/* Círculo marcador */}
                <div className={`absolute left-0 top-1 h-6 w-6 rounded-full flex items-center justify-center ${
                  pendency.resolved 
                    ? 'bg-green-400/20 border border-green-400' 
                    : 'bg-red-400/20 border border-red-400'
                }`}>
                  <div className={`h-2 w-2 rounded-full ${
                    pendency.resolved ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-400">
                      {format(pendency.createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                      pendency.resolved 
                        ? 'text-green-400 bg-green-400/10' 
                        : 'text-red-400 bg-red-400/10'
                    }`}>
                      {pendency.resolved ? 'Resolvida' : 'Pendente'}
                    </span>
                  </div>
                  <p className="text-white">{pendency.message}</p>
                  
                  {pendency.resolved && pendency.resolvedAt && (
                    <p className="text-xs text-gray-400">
                      Resolvida em: {format(pendency.resolvedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">Nenhuma pendência registrada</p>
        )}
      </div>
      
      {/* Timeline de Observações */}
      <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg md:text-xl font-semibold text-white">Observações</h3>
          <button
            onClick={handleAddObservation}
            className="flex items-center text-sm text-blue-400 hover:text-blue-300"
          >
            <MessageSquarePlus className="h-4 w-4 mr-1" />
            Adicionar
          </button>
        </div>
        
        {registration.observationsTimeline && registration.observationsTimeline.length > 0 ? (
          <div className="space-y-4">
            {registration.observationsTimeline.map((observation) => (
              <div key={observation.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                  <div className="font-medium text-white mb-1 sm:mb-0">{observation.createdByName}</div>
                  <div className="text-xs text-gray-400">
                    <span>
                      {(() => {
                        try {
                          if (typeof observation.createdAt === 'string') {
                            return format(new Date(observation.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                          }
                          return format(observation.createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                        } catch (error) {
                          console.error('Erro ao formatar data:', error, observation.createdAt);
                          return 'Data não disponível';
                        }
                      })()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{observation.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nenhuma observação registrada.</p>
        )}
      </div>

      {/* Modal de Adicionar Observação */}
      {showObservationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Adicionar Observação</h3>
            <p className="text-gray-300 mb-4">
              Adicione uma observação sobre este cliente:
            </p>
            
            <textarea
              value={observationText}
              onChange={(e) => setObservationText(e.target.value)}
              rows={4}
              className="bg-gray-900 border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-4"
              placeholder="Digite sua observação aqui..."
            />
            
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setShowObservationModal(false)}
                className="px-4 py-2 border border-gray-700 rounded-md text-sm font-medium text-white bg-transparent hover:bg-gray-800 order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveObservation}
                disabled={!observationText.trim()}
                className={`px-4 py-2 rounded-md text-sm font-medium order-1 sm:order-2 ${
                  observationText.trim() 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-blue-600/50 text-white/70 cursor-not-allowed'
                }`}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de Visualizar Documento */}
      {showDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">{currentDocument.name}</h3>
              <button 
                onClick={() => setShowDocumentModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto min-h-[500px] bg-gray-900 rounded-md">
              {(() => {
                // Verificar a extensão do arquivo
                const fileExtension = currentDocument.name.split('.').pop()?.toLowerCase();
                const isPdf = fileExtension === 'pdf' || currentDocument.type?.includes('pdf');
                const isImage = ['jpg', 'jpeg', 'png'].includes(fileExtension || '') || 
                               currentDocument.type?.includes('image/');
                
                console.log('Tipo de arquivo:', fileExtension, 'isPdf:', isPdf, 'isImage:', isImage);
                
                if (isImage) {
                  // Renderizar imagem diretamente
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <img 
                        src={currentDocument.url} 
                        alt={currentDocument.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  );
                } else if (isPdf) {
                  // Para PDFs, tentar exibir diretamente com iframe
                  return (
                    <div className="h-full flex flex-col">
                      <iframe
                        src={currentDocument.url}
                        frameBorder="0"
                        width="100%"
                        height="100%"
                        className="min-h-[500px] w-full"
                        style={{ backgroundColor: 'white' }}
                        allow="fullscreen"
                      />
                    </div>
                  );
                } else {
                  // Para outros tipos, tentar com iframe
                  return (
                    <iframe
                      src={currentDocument.url}
                      frameBorder="0"
                      width="100%"
                      height="100%"
                      className="min-h-[500px] w-full"
                      style={{ backgroundColor: 'white' }}
                      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        console.error('Erro ao carregar iframe:', e);
                      }}
                    />
                  );
                }
              })()}
            </div>
            
            <div className="flex justify-end mt-4">
              <a 
                href={currentDocument.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                download={currentDocument.name}
              >
                Baixar
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
