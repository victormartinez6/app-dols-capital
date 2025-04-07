import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputMask from 'react-input-mask';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import CurrencyInput from '../../components/CurrencyInput';
import SuccessModal from '../../components/SuccessModal';
import LocalDocumentUpload from '../../components/LocalDocumentUpload';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
}

interface CompanyFormProps {
  isEditing?: boolean;
}

const schema = z.object({
  cnpj: z.string().min(14, 'CNPJ é obrigatório').transform(val => val.replace(/\D/g, '')),
  companyName: z.string().min(3, 'Razão Social é obrigatória'),
  simples: z.boolean(),
  constitutionDate: z.string().min(1, 'Data de Constituição é obrigatória'),
  revenue: z.string().min(1, 'Faixa de Faturamento é obrigatória'),
  legalRepresentative: z.string().min(3, 'Nome do Representante Legal é obrigatório'),
  partnerCpf: z.string().min(11, 'CPF do Sócio é obrigatório').transform(val => val.replace(/\D/g, '')),
  partnerEmail: z.string().email('E-mail do Sócio inválido'),
  ddi: z.string().min(2, 'DDI é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório').transform(val => val.replace(/\D/g, '')),
  cep: z.string().min(8, 'CEP é obrigatório').transform(val => val.replace(/\D/g, '')),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(3, 'Bairro é obrigatório'),
  city: z.string().min(3, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado é obrigatório'),
  creditLine: z.string().min(1, 'Linha de Crédito é obrigatória'),
  creditReason: z.string().min(1, 'Motivo do Crédito é obrigatório'),
  desiredCredit: z.number().min(1, 'Valor do crédito é obrigatório').nullable(),
  hasRestriction: z.boolean(),
  companyDescription: z.string().min(10, 'Descrição da empresa é obrigatória'),
});

type FormData = z.infer<typeof schema>;

const revenueRanges = [
  '1 a 10 milhões',
  '11 a 30 milhões',
  '31 a 100 milhões',
  'Acima de 100 milhões',
];

const creditLines = [
  'Antecipação de Recebíveis',
  'Antecipação de Licitação',
  'Crédito com garantia de imóvel',
  'Crédito para Importação',
  'Capital de Giro',
  'Outros',
];

const creditReasons = [
  'Expandir a empresa',
  'Comprar maquinário ou equipamentos',
  'Investir em marketing',
  'Contratar novos funcionários',
  'Outros',
];

export default function CompanyForm({ isEditing = false }: CompanyFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAdmin = new URLSearchParams(location.search).get('admin') === 'true';
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing || !!id);
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [documents, setDocuments] = useState<{
    social_contract?: Document;
    revenue_last_12_months?: Document;
    balance_sheet?: Document;
    partner_document?: Document;
    address_proof?: Document;
  }>({});
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    defaultValues: {
      ddi: '+55',
      desiredCredit: undefined,
    },
    resolver: zodResolver(schema),
  });

  const handleDocumentChange = (type: string, doc: Document | undefined) => {
    setDocuments(prev => ({
      ...prev,
      [type]: doc,
    }));
  };

  const handleDocumentError = (error: string) => {
    setError(error);
    setTimeout(() => setError(null), 3000);
  };

  const searchCep = async (cep: string) => {
    try {
      const formattedCep = cep.replace(/\D/g, '');
      if (formattedCep.length === 8) {
        const response = await axios.get(`https://viacep.com.br/ws/${formattedCep}/json/`);
        if (!response.data.erro) {
          setValue('street', response.data.logradouro);
          setValue('neighborhood', response.data.bairro);
          setValue('city', response.data.localidade);
          setValue('state', response.data.uf);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleCNPJSearch = async (cnpj: string) => {
    try {
      setSearchingCNPJ(true);
      const formattedCnpj = cnpj.replace(/\D/g, '');
      
      if (formattedCnpj.length === 14) {
        const response = await axios.get(`https://publica.cnpj.ws/cnpj/${formattedCnpj}`);
        
        if (response.data) {
          const estabelecimento = response.data.estabelecimento || {};
          
          setValue('companyName', response.data.razao_social || '');
          setValue('constitutionDate', estabelecimento.data_inicio_atividade || '');
          
          setValue('cep', estabelecimento.cep || '');
          setValue('street', estabelecimento.logradouro || '');
          setValue('number', estabelecimento.numero || '');
          setValue('complement', estabelecimento.complemento || '');
          setValue('neighborhood', estabelecimento.bairro || '');
          setValue('city', estabelecimento.cidade?.nome || '');
          setValue('state', estabelecimento.estado?.sigla || '');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
    } finally {
      setSearchingCNPJ(false);
    }
  };

  useEffect(() => {
    const fetchExistingData = async () => {
      if ((!isEditing && !id) || !user) return;
      
      try {
        setInitialLoading(true);
        const docRef = doc(db, 'registrations', id || user.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Preencher os campos do formulário
          setValue('cnpj', data.cnpj || '');
          setValue('companyName', data.companyName || '');
          setValue('simples', data.simples || false);
          setValue('constitutionDate', data.constitutionDate || '');
          setValue('revenue', data.revenue || '');
          setValue('legalRepresentative', data.legalRepresentative || '');
          setValue('partnerCpf', data.partnerCpf || '');
          setValue('partnerEmail', data.partnerEmail || '');
          setValue('ddi', data.ddi || '');
          setValue('phone', data.phone || '');
          setValue('cep', data.cep || '');
          setValue('street', data.street || '');
          setValue('number', data.number || '');
          setValue('complement', data.complement || '');
          setValue('neighborhood', data.neighborhood || '');
          setValue('city', data.city || '');
          setValue('state', data.state || '');
          
          // Converter para número
          if (data.desiredCredit) {
            setValue('desiredCredit', Number(data.desiredCredit));
          }
          
          setValue('creditLine', data.creditLine || '');
          setValue('creditReason', data.creditReason || '');
          setValue('hasRestriction', data.hasRestriction || false);
          setValue('companyDescription', data.companyDescription || '');
          
          // Carregar documentos
          if (data.documents) {
            setDocuments(data.documents);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados do cadastro:', error);
        setError('Ocorreu um erro ao carregar os dados do cadastro.');
      } finally {
        setInitialLoading(false);
      }
    };
    
    fetchExistingData();
  }, [isEditing, user, setValue, id]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Gerar um ID único para o cliente se estiver sendo criado por um admin
      const userId = isAdmin ? `client_${Date.now()}` : (id || user.id);
      
      // Usar o ID do usuário como ID do documento
      const registrationRef = doc(db, 'registrations', userId);
      
      // Verificar se há documentos anexados
      const hasDocuments = documents && Object.keys(documents).length > 0;
      const status = hasDocuments ? 'complete' : 'documents_pending';
      
      // Dados completos do cadastro
      const registrationData = {
        ...data,
        type: 'PJ',
        userId: isAdmin ? userId : user.id, // Se for admin, usa o ID gerado
        status,
        documents: documents || {},
        updatedAt: serverTimestamp(),
        ...(isEditing ? {} : { createdAt: serverTimestamp(), pipelineStatus: 'submitted' }),
      };
      
      // Salvar dados de cadastro no Firestore
      await setDoc(registrationRef, registrationData, { merge: true });

      // Se não for admin, atualizar o status do usuário
      if (!isAdmin) {
        const userRef = doc(db, 'users', user.id);
        await setDoc(userRef, {
          hasRegistration: true,
          registrationType: 'PJ'
        }, { merge: true });
      }

      // Criar proposta APENAS se for um novo cadastro (não edição)
      if (!isEditing) {
        const proposalData = {
          clientName: data.companyName || 'Nome não disponível',
          clientId: userId,
          desiredCredit: data.desiredCredit || 0,
          hasProperty: false, // Valor padrão para PJ
          propertyValue: 0, // Valor padrão para PJ
          status: 'pending',
          pipelineStatus: 'submitted',
          creditLine: data.creditLine,
          creditReason: data.creditReason,
          companyDescription: data.companyDescription,
          hasRestriction: data.hasRestriction,
          userId: isAdmin ? userId : user.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: isAdmin ? user.id : null, // Registrar quem criou (se foi admin)
          isAdminCreated: isAdmin, // Marcar que foi criado por admin
        };

        // Adicionar a proposta à coleção 'proposals'
        await addDoc(collection(db, 'proposals'), proposalData);
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Erro ao salvar formulário:', error);
      setError('Ocorreu um erro ao salvar o formulário. Por favor, tente novamente.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (isAdmin) {
      navigate('/dashboard/clients');
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-semibold text-white mb-8">
            Cadastro de Pessoa Jurídica
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Existing form sections */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Dados da Empresa
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    CNPJ
                  </label>
                  <div className="relative">
                    <InputMask
                      mask="99.999.999/9999-99"
                      maskChar=""
                      {...register('cnpj')}
                      onBlur={(e) => handleCNPJSearch(e.target.value)}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                      placeholder="00.000.000/0000-00"
                    />
                    {searchingCNPJ && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                  {errors.cnpj && (
                    <p className="mt-1 text-sm text-red-400">{errors.cnpj.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    {...register('companyName')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Razão Social"
                  />
                  {errors.companyName && (
                    <p className="mt-1 text-sm text-red-400">{errors.companyName.message}</p>
                  )}
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('simples')}
                      disabled={initialLoading}
                      className="h-4 w-4 text-[#01FBA1] focus:ring-[#01FBA1] border-gray-300 rounded bg-black"
                    />
                    <span className="ml-2 text-gray-300">
                      Optante pelo Simples Nacional
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Data de Constituição
                  </label>
                  <input
                    type="date"
                    {...register('constitutionDate')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                  />
                  {errors.constitutionDate && (
                    <p className="mt-1 text-sm text-red-400">{errors.constitutionDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Faixa de Faturamento
                  </label>
                  <select
                    {...register('revenue')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                  >
                    <option value="">Selecione uma faixa</option>
                    {revenueRanges.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                  {errors.revenue && (
                    <p className="mt-1 text-sm text-red-400">{errors.revenue.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Dados do Representante Legal
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Nome do Representante Legal
                  </label>
                  <input
                    type="text"
                    {...register('legalRepresentative')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Nome do Representante Legal"
                  />
                  {errors.legalRepresentative && (
                    <p className="mt-1 text-sm text-red-400">{errors.legalRepresentative.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    CPF do Sócio
                  </label>
                  <InputMask
                    mask="999.999.999-99"
                    {...register('partnerCpf')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="000.000.000-00"
                  />
                  {errors.partnerCpf && (
                    <p className="mt-1 text-sm text-red-400">{errors.partnerCpf.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    E-mail do Sócio
                  </label>
                  <input
                    type="email"
                    {...register('partnerEmail')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="exemplo@email.com"
                  />
                  {errors.partnerEmail && (
                    <p className="mt-1 text-sm text-red-400">{errors.partnerEmail.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      DDI
                    </label>
                    <input
                      type="text"
                      {...register('ddi')}
                      disabled={initialLoading}
                      defaultValue="+55"
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    />
                    {errors.ddi && (
                      <p className="mt-1 text-sm text-red-400">{errors.ddi.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Telefone
                    </label>
                    <InputMask
                      mask="(99) 99999-9999"
                      {...register('phone')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                      placeholder="(00) 00000-0000"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-400">{errors.phone.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Endereço
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    CEP
                  </label>
                  <InputMask
                    mask="99999-999"
                    maskChar=""
                    {...register('cep')}
                    disabled={initialLoading}
                    onBlur={(e) => searchCep(e.target.value)}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="00000-000"
                  />
                  {errors.cep && (
                    <p className="mt-1 text-sm text-red-400">{errors.cep.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Logradouro
                  </label>
                  <input
                    type="text"
                    {...register('street')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Logradouro"
                  />
                  {errors.street && (
                    <p className="mt-1 text-sm text-red-400">{errors.street.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Número
                  </label>
                  <input
                    type="text"
                    {...register('number')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Número"
                  />
                  {errors.number && (
                    <p className="mt-1 text-sm text-red-400">{errors.number.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Complemento
                  </label>
                  <input
                    type="text"
                    {...register('complement')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Complemento (opcional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Bairro
                  </label>
                  <input
                    type="text"
                    {...register('neighborhood')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Bairro"
                  />
                  {errors.neighborhood && (
                    <p className="mt-1 text-sm text-red-400">{errors.neighborhood.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Cidade
                  </label>
                  <input
                    type="text"
                    {...register('city')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Cidade"
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-400">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Estado
                  </label>
                  <input
                    type="text"
                    {...register('state')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="UF"
                    maxLength={2}
                  />
                  {errors.state && (
                    <p className="mt-1 text-sm text-red-400">{errors.state.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Informações de Crédito
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Linha de Crédito
                  </label>
                  <select
                    {...register('creditLine')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                  >
                    <option value="">Selecione uma linha de crédito</option>
                    {creditLines.map((line) => (
                      <option key={line} value={line}>{line}</option>
                    ))}
                  </select>
                  {errors.creditLine && (
                    <p className="mt-1 text-sm text-red-400">{errors.creditLine.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Motivo do Crédito
                  </label>
                  <select
                    {...register('creditReason')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                  >
                    <option value="">Selecione um motivo</option>
                    {creditReasons.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                  {errors.creditReason && (
                    <p className="mt-1 text-sm text-red-400">{errors.creditReason.message}</p>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Valor do Crédito Pretendido
                  </label>
                  <CurrencyInput
                    name="desiredCredit"
                    disabled={initialLoading}
                    register={register}
                    setValue={setValue}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Valor desejado"
                    error={errors.desiredCredit?.message}
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      id="hasRestriction"
                      {...register('hasRestriction')}
                      disabled={initialLoading}
                      className="h-4 w-4 text-[#01FBA1] focus:ring-[#01FBA1] border-gray-300 rounded bg-black"
                    />
                    <span className="ml-2 text-gray-300">
                      Empresa possui restrição financeira?
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Breve Relato sobre a Empresa
                  </label>
                  <textarea
                    {...register('companyDescription')}
                    disabled={initialLoading}
                    rows={4}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Descreva brevemente a empresa, seu ramo de atuação e principais produtos/serviços"
                  />
                  {errors.companyDescription && (
                    <p className="mt-1 text-sm text-red-400">{errors.companyDescription.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            {user && (
              <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-semibold text-white">
                  Documentos
                </h2>

                <div className="space-y-4">
                  <LocalDocumentUpload
                    label="Contrato Social"
                    type="social_contract"
                    userId={user.id}
                    document={documents.social_contract}
                    onChange={(doc) => handleDocumentChange('social_contract', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />

                  <LocalDocumentUpload
                    label="Faturamento dos últimos 12 meses"
                    type="revenue_last_12_months"
                    userId={user.id}
                    document={documents.revenue_last_12_months}
                    onChange={(doc) => handleDocumentChange('revenue_last_12_months', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Balanço Patrimonial"
                    type="balance_sheet"
                    userId={user.id}
                    document={documents.balance_sheet}
                    onChange={(doc) => handleDocumentChange('balance_sheet', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Documento do Sócio"
                    type="partner_document"
                    userId={user.id}
                    document={documents.partner_document}
                    onChange={(doc) => handleDocumentChange('partner_document', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Comprovante de Endereço"
                    type="address_proof"
                    userId={user.id}
                    document={documents.address_proof}
                    onChange={(doc) => handleDocumentChange('address_proof', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 flex items-center"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 flex items-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Cadastro
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        message={isEditing 
          ? "Cadastro atualizado com sucesso! Você será redirecionado para a página inicial." 
          : isAdmin
            ? "Cliente cadastrado com sucesso! Uma proposta foi criada automaticamente. Você será redirecionado para a página de clientes."
            : "Seu cadastro foi realizado com sucesso! Uma proposta foi criada automaticamente. Você será redirecionado para a página inicial."}
        buttonText={isAdmin ? "Ir para lista de clientes" : "Ir para a página inicial"}
      />
    </>
  );
}