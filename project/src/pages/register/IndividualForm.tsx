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

interface IndividualFormProps {
  isEditing?: boolean;
}

const schema = z.object({
  cpf: z.string().min(11, 'CPF é obrigatório').transform(val => val.replace(/\D/g, '')),
  name: z.string().min(3, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  ddi: z.string().min(2, 'DDI é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório').transform(val => val.replace(/\D/g, '')),
  cep: z.string().min(8, 'CEP é obrigatório').transform(val => val.replace(/\D/g, '')),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(3, 'Bairro é obrigatório'),
  city: z.string().min(3, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado é obrigatório'),
  hasProperty: z.boolean(),
  propertyValue: z.number().optional().nullable(),
  desiredCredit: z.number().min(1, 'Valor do crédito é obrigatório').nullable(),
});

type FormData = z.infer<typeof schema>;

export default function IndividualForm({ isEditing = false }: IndividualFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isAdmin = new URLSearchParams(location.search).get('admin') === 'true';
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing || !!id);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [documents, setDocuments] = useState<{
    identity_document?: Document;
    address_proof?: Document;
    income_tax_declaration?: Document;
    income_tax_receipt?: Document;
    marital_status_certificate?: Document;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    defaultValues: {
      ddi: '+55',
      desiredCredit: undefined,
      propertyValue: undefined,
    },
    resolver: zodResolver(schema),
  });

  const hasProperty = watch('hasProperty');

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
          setValue('cpf', data.cpf || '');
          setValue('name', data.name || '');
          setValue('email', data.email || '');
          setValue('ddi', data.ddi || '');
          setValue('phone', data.phone || '');
          setValue('cep', data.cep || '');
          setValue('street', data.street || '');
          setValue('number', data.number || '');
          setValue('complement', data.complement || '');
          setValue('neighborhood', data.neighborhood || '');
          setValue('city', data.city || '');
          setValue('state', data.state || '');
          setValue('hasProperty', data.hasProperty || false);
          
          // Converter para número ou definir como null
          if (data.propertyValue) {
            setValue('propertyValue', Number(data.propertyValue));
          } else {
            setValue('propertyValue', null);
          }
          
          // Converter para número ou definir como null
          if (data.desiredCredit) {
            setValue('desiredCredit', Number(data.desiredCredit));
          } else {
            setValue('desiredCredit', null);
          }
          
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
  }, [isEditing, id, user, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Gerar um ID único para o cliente se estiver sendo criado por um admin
      const userId = isAdmin ? `client_${Date.now()}` : (id || user.id);
      setClientId(userId);
      
      // Usar o ID do usuário como ID do documento
      const registrationRef = doc(db, 'registrations', userId);
      
      // Verificar se há documentos anexados
      const hasDocuments = documents && Object.keys(documents).length > 0;
      const status = hasDocuments ? 'complete' : 'documents_pending';
      
      // Dados completos do cadastro
      const registrationData = {
        ...data,
        type: 'PF',
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
          registrationType: 'PF'
        }, { merge: true });
      }

      // Criar proposta APENAS se for um novo cadastro (não edição)
      if (!isEditing) {
        const proposalData = {
          clientName: data.name || 'Nome não disponível',
          clientId: userId,
          desiredCredit: data.desiredCredit || 0,
          hasProperty: data.hasProperty || false,
          propertyValue: data.propertyValue || 0,
          status: 'pending',
          pipelineStatus: 'submitted',
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
            Cadastro de Pessoa Física
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Existing form sections */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Dados Pessoais
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <InputMask
                    mask="999.999.999-99"
                    {...register('cpf')}
                    disabled={isEditing || initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="000.000.000-00"
                  />
                  {errors.cpf && (
                    <p className="mt-1 text-sm text-red-400">{errors.cpf.message}</p>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    {...register('name')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="Nome completo"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="email"
                    {...register('email')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="exemplo@email.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <div className="w-1/4 relative">
                    <InputMask
                      mask="+99"
                      {...register('ddi')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                      placeholder="+55"
                    />
                    {errors.ddi && (
                      <p className="mt-1 text-sm text-red-400">{errors.ddi.message}</p>
                    )}
                  </div>
                  <div className="w-3/4 relative">
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
                <div className="relative">
                  <InputMask
                    mask="99999-999"
                    {...register('cep')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                    placeholder="00000-000"
                    onBlur={(e) => searchCep(e.target.value)}
                  />
                  {errors.cep && (
                    <p className="mt-1 text-sm text-red-400">{errors.cep.message}</p>
                  )}
                </div>

                <div className="relative">
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

                <div className="flex space-x-2">
                  <div className="w-1/3 relative">
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
                  <div className="w-2/3 relative">
                    <input
                      type="text"
                      {...register('complement')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm"
                      placeholder="Complemento (opcional)"
                    />
                  </div>
                </div>

                <div className="relative">
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

                <div className="flex space-x-2">
                  <div className="w-2/3 relative">
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
                  <div className="w-1/3 relative">
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
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Informações Financeiras
              </h2>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasProperty"
                    {...register('hasProperty')}
                    disabled={initialLoading}
                    className="h-4 w-4 text-[#01FBA1] focus:ring-[#01FBA1] border-gray-300 rounded bg-black"
                  />
                  <label className="text-gray-300" htmlFor="hasProperty">Possui Imóvel?</label>
                </div>

                {hasProperty && (
                  <div className="relative">
                    <CurrencyInput
                      name="propertyValue"
                      disabled={!hasProperty || initialLoading}
                      register={register}
                      setValue={setValue}
                      className={`appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#01FBA1] focus:border-[#01FBA1] focus:z-10 shadow-sm ${!hasProperty ? 'opacity-50' : ''}`}
                      placeholder="Valor do imóvel"
                    />
                  </div>
                )}

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
                    label="Documento de Identidade (RG)"
                    type="identity_document"
                    userId={user.id}
                    document={documents.identity_document}
                    onChange={(doc) => handleDocumentChange('identity_document', doc)}
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
                  
                  <LocalDocumentUpload
                    label="Declaração de Imposto de Renda"
                    type="income_tax_declaration"
                    userId={user.id}
                    document={documents.income_tax_declaration}
                    onChange={(doc) => handleDocumentChange('income_tax_declaration', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Recibo de Entrega do Imposto de Renda"
                    type="income_tax_receipt"
                    userId={user.id}
                    document={documents.income_tax_receipt}
                    onChange={(doc) => handleDocumentChange('income_tax_receipt', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Certidão de Estado Civil"
                    type="marital_status_certificate"
                    userId={user.id}
                    document={documents.marital_status_certificate}
                    onChange={(doc) => handleDocumentChange('marital_status_certificate', doc)}
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