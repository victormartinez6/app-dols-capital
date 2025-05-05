import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { Building2, User, ArrowRight, Phone, MapPin, CreditCard, AlertCircle, FileText, Edit } from 'lucide-react';

interface DocumentItem {
  name: string;
  url: string;
  type: string;
  path: string;
}

interface Registration {
  id: string;
  type: 'PF' | 'PJ';
  // Common fields
  createdAt: Date;
  status: 'pending' | 'complete' | 'documents_pending';
  pipelineStatus: 'submitted' | 'pre_analysis' | 'credit' | 'legal' | 'contract';
  // Address fields
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  // Contact fields
  ddi: string;
  phone: string;
  // PF specific fields
  name?: string;
  email?: string;
  cpf?: string;
  hasProperty?: boolean;
  propertyValue?: number;
  desiredCredit?: number;
  // PJ specific fields
  cnpj?: string;
  companyName?: string;
  simples?: boolean;
  constitutionDate?: string;
  revenue?: string;
  legalRepresentative?: string;
  partnerCpf?: string;
  partnerEmail?: string;
  creditLine?: string;
  creditReason?: string;
  hasRestriction?: boolean;
  companyDescription?: string;
  // Documents
  documents?: {
    [key: string]: DocumentItem;
  };
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
  pending: 'Cadastro Incompleto',
  complete: 'Cadastro Completo',
  documents_pending: 'Pendência de Documentos',
};

const registrationStatusColors = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  complete: 'text-green-400 bg-green-400/10',
  documents_pending: 'text-red-400 bg-red-400/10',
};

const DataItem = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) => (
  <div>
    <h3 className="text-sm font-medium text-gray-400 mb-1 flex items-center">
      {Icon && <Icon className="h-4 w-4 mr-1" />}
      {label}
    </h3>
    <div className="text-white">{value}</div>
  </div>
);

export default function MyRegistration() {
  const { user } = useAuth();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRegistration = async () => {
      if (!user) return;

      try {
        const docRef = doc(db, 'registrations', user.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setRegistration({
            id: docSnap.id,
            ...docSnap.data(),
            createdAt: docSnap.data().createdAt?.toDate() || new Date(),
          } as Registration);
        }
      } catch (error) {
        console.error('Error fetching registration:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRegistration();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!registration) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-gray-400">Você ainda não possui um cadastro.</p>
        <Link
          to="/register/type"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        >
          Fazer Cadastro
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    );
  }

  const formatCurrency = (value?: number) => {
    if (!value) return 'Não informado';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDocument = (doc?: string) => {
    if (!doc) return 'Não informado';
    if (doc.length === 11) {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const getDocumentLabel = (key: string): string => {
    const labels: Record<string, string> = {
      identity_document: 'Documento de Identidade',
      address_proof: 'Comprovante de Endereço',
      income_tax_declaration: 'Declaração de Imposto de Renda',
      income_tax_receipt: 'Recibo de Entrega do Imposto de Renda',
      marital_status_certificate: 'Certidão de Estado Civil',
      social_contract: 'Contrato Social',
      revenue_last_12_months: 'Faturamento dos últimos 12 meses',
      balance_sheet: 'Balanço Patrimonial',
      partner_document: 'Documento do Sócio'
    };
    
    return labels[key] || key;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Meu Cadastro</h1>
        <Link
          to={`/register/${registration.type === 'PF' ? 'individual' : 'company'}/${user?.id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar Cadastro
        </Link>
      </div>

      <div className="space-y-6">
        {/* Status Card */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DataItem
              label="Tipo de Cadastro"
              value={
                <div className="flex items-center">
                  {registration.type === 'PJ' ? (
                    <Building2 className="h-5 w-5 text-blue-400 mr-2" />
                  ) : (
                    <User className="h-5 w-5 text-green-400 mr-2" />
                  )}
                  <span className={registration.type === 'PJ' ? 'text-blue-400' : 'text-green-400'}>
                    {registration.type === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                  </span>
                </div>
              }
            />

            <DataItem
              label="Status do Cadastro"
              value={
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  registrationStatusColors[registration.status]
                }`}>
                  {registrationStatusLabels[registration.status]}
                </span>
              }
            />

            <DataItem
              label="Status do Pipeline"
              value={
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  pipelineStatusColors[registration.pipelineStatus]
                }`}>
                  {pipelineStatusLabels[registration.pipelineStatus]}
                </span>
              }
            />
          </div>
        </div>

        {/* Main Data Card */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">
            {registration.type === 'PJ' ? 'Dados da Empresa' : 'Dados Pessoais'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {registration.type === 'PJ' && (
              <>
                <DataItem icon={Building2} label="CNPJ" value={formatDocument(registration.cnpj)} />
                <DataItem label="Razão Social" value={registration.companyName} />
                <DataItem label="Representante Legal" value={registration.legalRepresentative || 'Não informado'} />
                <DataItem label="CPF do Representante" value={formatDocument(registration.partnerCpf)} />
                <DataItem label="Email do Representante" value={registration.partnerEmail || 'Não informado'} />
              </>
            )}
            
            {registration.type === 'PF' && (
              <>
                <DataItem icon={User} label="Nome" value={registration.name} />
                <DataItem label="CPF" value={formatDocument(registration.cpf)} />
                <DataItem label="Email" value={registration.email} />
                <DataItem 
                  label="Possui Imóvel" 
                  value={registration.hasProperty ? 'Sim' : 'Não'} 
                />
                {registration.hasProperty && (
                  <DataItem 
                    label="Valor do Imóvel" 
                    value={formatCurrency(registration.propertyValue)} 
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Contact Card */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Contato</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataItem 
              icon={Phone}
              label="Telefone" 
              value={`${registration.ddi} ${registration.phone}`} 
            />
            <DataItem 
              label="Email" 
              value={registration.type === 'PF' ? registration.email : registration.partnerEmail} 
            />
          </div>
        </div>

        {/* Address Card */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Endereço</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataItem icon={MapPin} label="CEP" value={registration.cep} />
            <DataItem label="Logradouro" value={registration.street} />
            <DataItem label="Número" value={registration.number} />
            <DataItem 
              label="Complemento" 
              value={registration.complement || 'Não informado'} 
            />
            <DataItem label="Bairro" value={registration.neighborhood} />
            <DataItem label="Cidade" value={registration.city} />
            <DataItem label="Estado" value={registration.state} />
          </div>
        </div>

        {/* Credit Info Card */}
        <div className="bg-black border border-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Informações de Crédito</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DataItem 
              icon={CreditCard}
              label="Valor do Crédito Pretendido" 
              value={formatCurrency(registration.desiredCredit)} 
            />
            
            {/* Mostrar linha de crédito e finalidade para ambos PF e PJ */}
            <DataItem label="Linha de Crédito" value={registration.creditLine || 'Não informado'} />
            <DataItem label="Finalidade do Crédito" value={registration.creditReason || 'Não informado'} />
            
            {registration.type === 'PF' && (
              <>
                <DataItem 
                  icon={AlertCircle}
                  label="Possui Restrição" 
                  value={registration.hasRestriction ? 'Sim' : 'Não'} 
                />
              </>
            )}
            
            {registration.type === 'PJ' && (
              <>
                <DataItem 
                  icon={AlertCircle}
                  label="Possui Restrição" 
                  value={registration.hasRestriction ? 'Sim' : 'Não'} 
                />
                <DataItem 
                  label="Descrição da Empresa" 
                  value={registration.companyDescription || 'Não informado'} 
                />
                <DataItem 
                  label="Faturamento" 
                  value={registration.revenue || 'Não informado'} 
                />
                <DataItem 
                  label="Data de Constituição" 
                  value={registration.constitutionDate || 'Não informado'} 
                />
                <DataItem 
                  label="Optante pelo Simples" 
                  value={registration.simples ? 'Sim' : 'Não'} 
                />
              </>
            )}
          </div>
        </div>

        {/* Documents Card */}
        {registration.documents && Object.keys(registration.documents).length > 0 && (
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Documentos</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(registration.documents).map(([key, doc]) => (
                <div key={key} className="flex items-center space-x-2">
                  <FileText size={16} className="text-gray-400" />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 truncate"
                  >
                    {getDocumentLabel(key)}: {doc.name}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}