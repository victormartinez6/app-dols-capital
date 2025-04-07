import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft, Building2, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentViewUrl, setDocumentViewUrl] = useState<string | null>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  useEffect(() => {
    const fetchRegistration = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const docRef = doc(db, 'registrations', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setRegistration({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            pendencies: data.pendencies ? data.pendencies.map((p: any) => ({
              ...p,
              createdAt: p.createdAt?.toDate() || new Date(),
              resolvedAt: p.resolvedAt?.toDate() || undefined,
            })) : [],
          } as Registration);
        } else {
          setError('Cadastro não encontrado');
        }
      } catch (error) {
        console.error('Erro ao buscar cadastro:', error);
        setError('Erro ao carregar os dados do cadastro');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [id]);

  const handleEditClick = () => {
    if (!registration) return;
    
    const path = registration.type === 'PF' 
      ? `/register/individual/${registration.id}` 
      : `/register/company/${registration.id}`;
    
    navigate(path);
  };

  const handleDocumentView = (url: string) => {
    setDocumentViewUrl(url);
    setShowDocumentModal(true);
  };

  const handleCloseDocumentModal = () => {
    setShowDocumentModal(false);
    setDocumentViewUrl(null);
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
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 text-white bg-gray-800 rounded-full hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-2xl font-bold text-white">Detalhes do Cliente</h2>
        
        <div className="flex-1 flex justify-end">
          <button
            onClick={handleEditClick}
            className="px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100"
          >
            Editar Cadastro
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Informações Básicas */}
        <div className="md:col-span-2 bg-black border border-gray-800 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Informações do Cliente</h3>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold text-white">Status</h3>

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
              <h4 className="text-sm font-medium text-gray-400">Status do Pipeline</h4>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                pipelineStatusColors[registration.pipelineStatus]
              }`}>
                {pipelineStatusLabels[registration.pipelineStatus]}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Documentos */}
      <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white">Documentos</h3>

        {registration.documents && Object.keys(registration.documents).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(registration.documents)
              .filter(([_, doc]) => doc && doc.url) // Filtra apenas documentos válidos com URL
              .map(([key, doc]) => (
                <div key={key} className="border border-gray-800 rounded-lg p-4 flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-white">{documentLabels[key] || key}</h4>
                    <a 
                      href="#"
                      className="text-xs text-blue-400 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDocumentView(doc.url);
                      }}
                    >
                      Visualizar documento
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
      <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
        <h3 className="text-xl font-semibold text-white">Histórico de Pendências</h3>

        {registration.pendencies && registration.pendencies.length > 0 ? (
          <div className="space-y-6">
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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

      {/* Modal de visualização de documentos */}
      {showDocumentModal && documentViewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-4 max-w-4xl max-h-[90vh] w-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Visualização de Documento</h3>
              <button 
                onClick={handleCloseDocumentModal}
                className="text-gray-400 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-800 rounded-lg flex items-center justify-center">
              {documentViewUrl.startsWith('data:image') ? (
                <img 
                  src={documentViewUrl} 
                  alt="Documento" 
                  className="max-w-full max-h-[70vh] object-contain" 
                />
              ) : (
                <iframe 
                  src={documentViewUrl} 
                  className="w-full h-[70vh]" 
                  title="Visualização de documento"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
