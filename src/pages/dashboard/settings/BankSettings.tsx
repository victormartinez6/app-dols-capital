import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Save, Loader2, Search } from 'lucide-react';
import InputMask from 'react-input-mask';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// Esquema de validação com Zod
const bankSchema = z.object({
  companyName: z.string().min(3, 'Razão social é obrigatória'),
  tradingName: z.string().min(3, 'Nome fantasia é obrigatório'),
  cnpj: z.string().min(14, 'CNPJ é obrigatório').transform(val => val.replace(/\D/g, '')),
  commission: z.string().min(1, 'Comissão é obrigatória').transform(val => val.replace(/[^\d.,]/g, '')),
  contactName: z.string().min(3, 'Nome do contato é obrigatório'),
  contactPhone: z.string().min(10, 'Telefone é obrigatório').transform(val => val.replace(/\D/g, '')),
  contactEmail: z.string().email('E-mail inválido'),
  cep: z.string().min(8, 'CEP é obrigatório').transform(val => val.replace(/\D/g, '')),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(3, 'Bairro é obrigatório'),
  city: z.string().min(3, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado é obrigatório'),
  // E-mails operacionais
  registrationEmails: z.array(z.string().email('E-mail inválido').or(z.string().length(0))).optional(),
  contractEmails: z.array(z.string().email('E-mail inválido').or(z.string().length(0))).optional(),
  financialEmails: z.array(z.string().email('E-mail inválido').or(z.string().length(0))).optional(),
});

type BankFormData = z.infer<typeof bankSchema>;

interface BankSettingsProps {
  bankId: string | null;
  onSaved?: () => void;
}

// Componente principal
export default function BankSettings({ bankId, onSaved }: BankSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors }, watch, reset } = useForm<BankFormData>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      registrationEmails: ['', '', ''],
      contractEmails: ['', '', ''],
      financialEmails: ['', '', ''],
    }
  });

  const cnpj = watch('cnpj');
  const cep = watch('cep');

  // Carregar dados do banco se estiver editando
  useEffect(() => {
    const loadBankData = async () => {
      if (!bankId) return;
      
      try {
        setLoading(true);
        const bankDoc = await getDoc(doc(db, 'banks', bankId));
        
        if (bankDoc.exists()) {
          const bankData = bankDoc.data() as BankFormData;
          
          // Preencher o formulário com os dados do banco
          reset({
            ...bankData,
            // Garantir que os arrays de emails estejam preenchidos
            registrationEmails: bankData.registrationEmails || ['', '', ''],
            contractEmails: bankData.contractEmails || ['', '', ''],
            financialEmails: bankData.financialEmails || ['', '', ''],
          });
        }
      } catch (err) {
        console.error('Erro ao carregar dados do banco:', err);
        setError('Não foi possível carregar os dados do banco');
      } finally {
        setLoading(false);
      }
    };
    
    loadBankData();
  }, [bankId, reset]);

  // Função para buscar dados da empresa pelo CNPJ
  const searchCompanyByCNPJ = async () => {
    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) {
      setError('CNPJ inválido');
      return;
    }

    try {
      setCnpjLoading(true);
      setError(null);
      
      // Formatar CNPJ para a consulta (apenas números)
      const formattedCnpj = cnpj.replace(/\D/g, '');
      console.log('Buscando dados para o CNPJ:', formattedCnpj);
      
      // Consultar API do CNPJ.ws
      const response = await fetch(`https://publica.cnpj.ws/cnpj/${formattedCnpj}`);
      
      if (!response.ok) {
        throw new Error(`Erro na consulta: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Dados retornados pela API:', data);
      
      // Preencher os campos com os dados retornados
      setValue('companyName', data.razao_social || '');
      setValue('tradingName', data.nome_fantasia || '');
      
      // Preencher endereço se disponível
      if (data.estabelecimento && data.estabelecimento.tipo_logradouro && data.estabelecimento.logradouro) {
        setValue('street', `${data.estabelecimento.tipo_logradouro} ${data.estabelecimento.logradouro}`);
        setValue('number', data.estabelecimento.numero || '');
        setValue('complement', data.estabelecimento.complemento || '');
        setValue('neighborhood', data.estabelecimento.bairro || '');
        setValue('city', data.estabelecimento.cidade?.nome || '');
        setValue('state', data.estabelecimento.estado?.sigla || '');
        setValue('cep', data.estabelecimento.cep || '');
      }
      
      console.log('Dados do CNPJ carregados com sucesso');
    } catch (err) {
      console.error('Erro ao buscar dados do CNPJ:', err);
      
      // Tentar API alternativa em caso de falha
      try {
        console.log('Tentando API alternativa...');
        const formattedCnpj = cnpj.replace(/\D/g, '');
        
        // API alternativa: ReceitaWS
        const response = await fetch(`https://receitaws.com.br/v1/cnpj/${formattedCnpj}`);
        const data = await response.json();
        
        if (data.status === 'ERROR') {
          throw new Error(data.message);
        }
        
        console.log('Dados retornados pela API alternativa:', data);
        
        // Preencher os campos com os dados retornados
        setValue('companyName', data.nome || '');
        setValue('tradingName', data.fantasia || '');
        setValue('street', data.logradouro || '');
        setValue('number', data.numero || '');
        setValue('complement', data.complemento || '');
        setValue('neighborhood', data.bairro || '');
        setValue('city', data.municipio || '');
        setValue('state', data.uf || '');
        setValue('cep', data.cep?.replace(/\D/g, '') || '');
        
        console.log('Dados do CNPJ carregados com sucesso (API alternativa)');
      } catch (altErr) {
        console.error('Erro também na API alternativa:', altErr);
        setError('Não foi possível consultar o CNPJ. Verifique se o número está correto ou preencha os dados manualmente.');
      }
    } finally {
      setCnpjLoading(false);
    }
  };

  // Função para buscar endereço pelo CEP
  const searchAddressByCEP = async () => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) {
      setError('CEP inválido');
      return;
    }

    try {
      setCepLoading(true);
      setError(null);
      
      // Chamada à API de CEP
      const response = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        setError('CEP não encontrado');
        return;
      }
      
      // Preencher os campos com os dados retornados
      setValue('street', data.logradouro);
      setValue('neighborhood', data.bairro);
      setValue('city', data.localidade);
      setValue('state', data.uf);
      
      console.log('Dados do CEP carregados com sucesso');
    } catch (err) {
      console.error('Erro ao buscar dados do CEP:', err);
      setError('Erro ao buscar dados do CEP. Tente novamente.');
    } finally {
      setCepLoading(false);
    }
  };

  // Função para salvar os dados do banco
  const onSubmit = async (data: BankFormData) => {
    try {
      setLoading(true);
      setError(null);
      
      // Filtrar emails vazios
      const filteredData = {
        ...data,
        registrationEmails: data.registrationEmails?.filter(email => email.trim() !== '') || [],
        contractEmails: data.contractEmails?.filter(email => email.trim() !== '') || [],
        financialEmails: data.financialEmails?.filter(email => email.trim() !== '') || [],
      };
      
      // Gerar ID para novo banco ou usar ID existente
      const bankDocId = bankId || `bank_${Date.now()}`;
      
      // Salvar no Firestore
      await setDoc(doc(db, 'banks', bankDocId), {
        ...filteredData,
        updatedAt: serverTimestamp(),
        ...(bankId ? {} : { createdAt: serverTimestamp() }),
      }, { merge: true });
      
      setSuccess(true);
      
      // Chamar callback se fornecido
      if (onSaved) {
        setTimeout(() => {
          onSaved();
        }, 1500);
      }
    } catch (err) {
      console.error('Erro ao salvar banco:', err);
      setError('Ocorreu um erro ao salvar os dados do banco');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Renderizar campos de e-mail para cada categoria
  const renderEmailFields = (fieldName: 'registrationEmails' | 'contractEmails' | 'financialEmails', label: string) => {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-300">{label}</h4>
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="relative">
              <input
                type="email"
                {...register(`${fieldName}.${index}` as any)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder={`E-mail ${index + 1}`}
              />
              {errors[fieldName] && errors[fieldName]?.[index] && (
                <p className="mt-1 text-sm text-red-400">{errors[fieldName]?.[index]?.message}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <h3 className="text-xl font-semibold mb-4 md:mb-6">Configurações de Bancos</h3>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
        {/* Dados do Banco */}
        <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
          <h4 className="text-lg font-medium text-white">Dados do Banco</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* CNPJ */}
            <div className="relative md:col-span-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                CNPJ
              </label>
              <div className="flex">
                <InputMask
                  mask="99.999.999/9999-99"
                  {...register('cnpj')}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                  placeholder="00.000.000/0000-00"
                />
                <button
                  type="button"
                  onClick={searchCompanyByCNPJ}
                  disabled={cnpjLoading}
                  className="ml-2 inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-[#D8B25A] hover:bg-[#00e090] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A]"
                >
                  {cnpjLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.cnpj && (
                <p className="mt-1 text-sm text-red-400">{errors.cnpj.message}</p>
              )}
            </div>

            {/* Razão Social */}
            <div className="relative md:col-span-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Razão Social
              </label>
              <input
                type="text"
                {...register('companyName')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Razão Social do Banco"
              />
              {errors.companyName && (
                <p className="mt-1 text-sm text-red-400">{errors.companyName.message}</p>
              )}
            </div>

            {/* Nome Fantasia */}
            <div className="relative md:col-span-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nome Fantasia
              </label>
              <input
                type="text"
                {...register('tradingName')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Nome Fantasia do Banco"
              />
              {errors.tradingName && (
                <p className="mt-1 text-sm text-red-400">{errors.tradingName.message}</p>
              )}
            </div>
            
            {/* Comissão do Banco */}
            <div className="relative md:col-span-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Comissão do Banco (%)
              </label>
              <div className="relative">
                <input
                  type="text"
                  {...register('commission')}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                  placeholder="0,00"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-gray-400">%</span>
                </div>
              </div>
              {errors.commission && (
                <p className="mt-1 text-sm text-red-400">{errors.commission.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Dados de Contato */}
        <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
          <h4 className="text-lg font-medium text-white">Dados de Contato</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nome do Contato */}
            <div className="relative">
              <input
                type="text"
                {...register('contactName')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Nome do Contato"
              />
              {errors.contactName && (
                <p className="mt-1 text-sm text-red-400">{errors.contactName.message}</p>
              )}
            </div>
            
            {/* Telefone do Contato */}
            <div className="relative">
              <InputMask
                mask="(99) 99999-9999"
                {...register('contactPhone')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Telefone do Contato"
              />
              {errors.contactPhone && (
                <p className="mt-1 text-sm text-red-400">{errors.contactPhone.message}</p>
              )}
            </div>
            
            {/* E-mail do Contato */}
            <div className="relative">
              <input
                type="email"
                {...register('contactEmail')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="E-mail do Contato"
              />
              {errors.contactEmail && (
                <p className="mt-1 text-sm text-red-400">{errors.contactEmail.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Endereço */}
        <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
          <h4 className="text-lg font-medium text-white">Endereço</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* CEP com botão de busca */}
            <div className="relative md:col-span-3">
              <div className="flex">
                <InputMask
                  mask="99999-999"
                  {...register('cep')}
                  className="appearance-none rounded-l-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                  placeholder="CEP"
                />
                <button
                  type="button"
                  onClick={searchAddressByCEP}
                  disabled={cepLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-black bg-[#D8B25A] hover:bg-[#00e090] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A]"
                >
                  {cepLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.cep && (
                <p className="mt-1 text-sm text-red-400">{errors.cep.message}</p>
              )}
            </div>
            
            {/* Logradouro */}
            <div className="relative md:col-span-5">
              <input
                type="text"
                {...register('street')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Logradouro"
              />
              {errors.street && (
                <p className="mt-1 text-sm text-red-400">{errors.street.message}</p>
              )}
            </div>
            
            {/* Número */}
            <div className="relative md:col-span-2">
              <input
                type="text"
                {...register('number')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Número"
              />
              {errors.number && (
                <p className="mt-1 text-sm text-red-400">{errors.number.message}</p>
              )}
            </div>
            
            {/* Complemento */}
            <div className="relative md:col-span-2">
              <input
                type="text"
                {...register('complement')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Complemento"
              />
              {errors.complement && (
                <p className="mt-1 text-sm text-red-400">{errors.complement.message}</p>
              )}
            </div>
            
            {/* Bairro */}
            <div className="relative md:col-span-4">
              <input
                type="text"
                {...register('neighborhood')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Bairro"
              />
              {errors.neighborhood && (
                <p className="mt-1 text-sm text-red-400">{errors.neighborhood.message}</p>
              )}
            </div>
            
            {/* Cidade */}
            <div className="relative md:col-span-6">
              <input
                type="text"
                {...register('city')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="Cidade"
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-400">{errors.city.message}</p>
              )}
            </div>
            
            {/* Estado */}
            <div className="relative md:col-span-2">
              <input
                type="text"
                {...register('state')}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                placeholder="UF"
                maxLength={2}
              />
              {errors.state && (
                <p className="mt-1 text-sm text-red-400">{errors.state.message}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* E-mails Operacionais */}
        <div className="bg-black border border-gray-800 rounded-lg p-4 md:p-6 space-y-4 md:space-y-6">
          <h4 className="text-lg font-medium text-white">E-mails Operacionais</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* E-mails de Cadastro */}
            <div className="space-y-4">
              {renderEmailFields('registrationEmails', 'E-mails de Cadastro')}
            </div>
            
            {/* E-mails de Contratos */}
            <div className="space-y-4">
              {renderEmailFields('contractEmails', 'E-mails de Contratos')}
            </div>
            
            {/* E-mails de Financeiro */}
            <div className="space-y-4">
              {renderEmailFields('financialEmails', 'E-mails de Financeiro')}
            </div>
          </div>
        </div>
        
        {/* Botão de Salvar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-black bg-[#D8B25A] hover:bg-[#00e090] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A]"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5 mr-2" />
                Salvar
              </>
            )}
          </button>
        </div>
      </form>
      
      {/* Mensagens de erro e sucesso */}
      {error && (
        <div className="mt-4 bg-red-500/10 border border-red-500 rounded-lg p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mt-4 bg-green-500/10 border border-green-500 rounded-lg p-4">
          <p className="text-sm text-green-500">Configurações salvas com sucesso!</p>
        </div>
      )}
    </div>
  );
}
