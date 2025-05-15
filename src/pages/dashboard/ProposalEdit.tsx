import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import CurrencyInput from '../../components/CurrencyInput';

const schema = z.object({
  clientName: z.string().min(1, 'Nome do cliente é obrigatório'),
  desiredCredit: z.coerce.number().min(0, 'Valor do crédito deve ser maior que zero'),
  hasProperty: z.boolean(),
  propertyValue: z.coerce.number().nullable().optional(),
  status: z.string(),
  pipelineStatus: z.string(),
  creditLine: z.string().min(1, 'Linha de crédito é obrigatória'),
  creditReason: z.string().min(1, 'Finalidade do crédito é obrigatória'),
  companyDescription: z.string().optional(),
  hasRestriction: z.boolean(),
  observations: z.string().optional(),
  clientId: z.string(),
  bankId: z.string().optional(),
  bankCommission: z.string().optional(),
  teamCode: z.string().optional(),
  teamName: z.string().optional(),
});

const proposalStatusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in_analysis', label: 'Em Análise' },
  { value: 'with_pendencies', label: 'Pendências' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
];

const pipelineStatusOptions = [
  { value: 'submitted', label: 'Cadastro Enviado' },
  { value: 'pre_analysis', label: 'Pré-Análise' },
  { value: 'credit', label: 'Crédito' },
  { value: 'legal', label: 'Jurídico/Imóvel' },
  { value: 'contract', label: 'Em Contrato' },
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

export default function ProposalEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [banks, setBanks] = useState<Array<{id: string, companyName: string, commission: string, tradingName?: string}>>([]);
  const [originalCreditValue, setOriginalCreditValue] = useState<number | null>(null);
  const [observationsTimeline, setObservationsTimeline] = useState<Array<{text: string, date: Date}>>([]);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, getValues, trigger, control } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: '',
      desiredCredit: 0,
      hasProperty: false,
      propertyValue: 0, // Usar 0 em vez de null para evitar erros de tipagem
      status: 'pending',
      pipelineStatus: 'submitted',
      creditLine: '',
      creditReason: '',
      companyDescription: '',
      hasRestriction: false,
      observations: '',
      clientId: '',
      bankId: '',
      bankCommission: '',
      teamCode: '',
      teamName: '',
    }
  });

  const hasProperty = watch('hasProperty');
  const desiredCreditValue = watch('desiredCredit');

  useEffect(() => {
    if (originalCreditValue === null && desiredCreditValue) {
      setOriginalCreditValue(desiredCreditValue);
    }
  }, [desiredCreditValue, originalCreditValue]);

  const formatCurrency = (value: number): string => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  useEffect(() => {
    fetchProposal();
    
    // Buscar bancos
    const fetchBanksData = async () => {
      try {
        const banksCollection = collection(db, 'banks');
        const banksSnapshot = await getDocs(banksCollection);
        const banksData = banksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Array<{id: string, companyName: string, commission: string, tradingName?: string}>;
        
        setBanks(banksData);
        console.log('Bancos carregados:', banksData);
      } catch (error) {
        console.error('Erro ao buscar bancos:', error);
      }
    };
    
    fetchBanksData();
  }, [id]);

  useEffect(() => {
    const creditValue = watch('desiredCredit');
    const propertyValue = watch('propertyValue');
    
    console.log('Valor atual do crédito:', creditValue);
    console.log('Valor atual do imóvel:', propertyValue);
  }, [watch]);

  useEffect(() => {
    const bankId = watch('bankId');
    console.log('Banco selecionado alterado para:', bankId);
    
    if (bankId) {
      // Encontrar o banco selecionado
      const selectedBank = banks.find(bank => bank.id === bankId);
      if (selectedBank) {
        console.log('Banco encontrado:', selectedBank);
        
        // Obter os valores atuais
        const currentDesiredCredit = getValues('desiredCredit');
        const currentPropertyValue = getValues('propertyValue');
        const hasProperty = getValues('hasProperty');
        
        // Atualizar a comissão do banco
        setValue('bankCommission', selectedBank.commission, { shouldDirty: true });
        
        // Manter os valores atuais
        setValue('desiredCredit', currentDesiredCredit, { shouldDirty: true });
        
        if (hasProperty) {
          setValue('propertyValue', currentPropertyValue, { shouldDirty: true });
        }
        
        // Forçar a revalidação dos campos
        trigger(['desiredCredit', 'propertyValue', 'bankCommission']);
      }
    }
  }, [watch('bankId'), banks, setValue, getValues, trigger]);

  useEffect(() => {
    if (banks.length > 0 && !loading) {
      // Se os bancos já foram carregados e não estamos mais carregando a proposta,
      // verificar se precisamos definir o banco selecionado
      const currentBankId = getValues('bankId');
      if (currentBankId) {
        console.log('Verificando banco após carregamento completo:', currentBankId);
        const bankExists = banks.some(bank => bank.id === currentBankId);
        console.log('O banco existe na lista após carregamento completo?', bankExists);
        
        if (!bankExists && banks.length > 0) {
          console.warn('O banco não foi encontrado na lista de bancos disponíveis');
        }
      }
    }
  }, [banks, loading, getValues]);

  const fetchProposal = async () => {
    if (!id) {
      console.error('ID da proposta não encontrado nos parâmetros da URL');
      setError('ID da proposta não encontrado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Buscando proposta com ID:', id);
      const docRef = doc(db, 'proposals', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('Dados da proposta encontrados:', data);

        // Converter datas
        const createdAt = data.createdAt?.toDate() || new Date();
        const updatedAt = data.updatedAt?.toDate() || new Date();

        // Tratar a timeline de observações
        const safeObservationsTimeline = Array.isArray(data.observationsTimeline) 
          ? data.observationsTimeline.map((obs: any) => ({
              ...obs,
              date: obs.date?.toDate() || new Date()
            }))
          : [];
        
        setObservationsTimeline(safeObservationsTimeline);

        // Definir os valores do formulário
        const desiredCredit = typeof data.desiredCredit === 'number' ? data.desiredCredit : 0;
        const propertyValue = typeof data.propertyValue === 'number' ? data.propertyValue : 0;
        const bankId = data.bankId || '';
        
        console.log('Valor do Crédito extraído:', desiredCredit);
        console.log('Valor do Imóvel extraído:', propertyValue);
        console.log('ID do Banco extraído:', bankId);
        
        // Armazenar o valor original do crédito
        setOriginalCreditValue(desiredCredit);
        
        // Limpar o formulário primeiro para evitar conflitos
        reset();
        
        // Definir os valores um por um usando setValue
        setValue('clientName', data.clientName || '');
        setValue('desiredCredit', desiredCredit);
        setValue('hasProperty', Boolean(data.hasProperty));
        setValue('propertyValue', propertyValue);
        setValue('status', data.status || 'pending');
        setValue('pipelineStatus', data.pipelineStatus || 'submitted');
        
        // Melhorar o carregamento dos campos de crédito com logs
        console.log('Linha de Crédito encontrada:', data.creditLine);
        console.log('Finalidade do Crédito encontrada:', data.creditReason);
        
        // Verificar se os valores existem e não são vazios
        const creditLine = data.creditLine && data.creditLine.trim() !== '' ? data.creditLine : '';
        const creditReason = data.creditReason && data.creditReason.trim() !== '' ? data.creditReason : '';
        
        setValue('creditLine', creditLine);
        setValue('creditReason', creditReason);
        
        setValue('companyDescription', data.companyDescription || '');
        setValue('hasRestriction', Boolean(data.hasRestriction));
        setValue('observations', data.observations || '');
        setValue('clientId', data.clientId || '');
        
        // Definir o banco e a comissão do banco
        if (bankId) {
          console.log('Definindo o banco selecionado:', bankId);
          setValue('bankId', bankId);
          setValue('bankCommission', data.bankCommission || '');
          
          // Verificar se o banco existe na lista de bancos
          setTimeout(() => {
            const bankExists = banks.some(bank => bank.id === bankId);
            console.log('O banco existe na lista?', bankExists);
            
            if (!bankExists && banks.length > 0) {
              console.warn('O banco não foi encontrado na lista de bancos disponíveis');
            }
          }, 500);
        }
        
        // Definir o código e nome da equipe
        setValue('teamCode', data.teamCode || '');
        setValue('teamName', data.teamName || '');
        
        // Forçar a revalidação dos campos após um pequeno atraso
        // para garantir que os componentes tenham tempo de renderizar
        setTimeout(() => {
          trigger();
          
          // Verificar se os valores foram definidos corretamente
          const currentValues = getValues();
          console.log('Valores atuais do formulário após carregamento:', currentValues);
        }, 300);
      } else {
        setError('Proposta não encontrada');
      }
    } catch (error) {
      console.error('Erro ao buscar proposta:', error);
      setError('Erro ao carregar os dados da proposta');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    if (!id) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Obter os valores atuais do formulário
      const formValues = getValues();
      console.log('Valores do formulário a serem salvos:', formValues);

      // Converter valores para os tipos corretos
      const desiredCredit = Number(data.desiredCredit);
      const propertyValue = data.hasProperty ? Number(data.propertyValue) : 0;

      // Verificar se os valores são números válidos
      if (isNaN(desiredCredit)) {
        setError('O valor do crédito deve ser um número válido');
        setSaving(false);
        return;
      }

      if (data.hasProperty && isNaN(propertyValue)) {
        setError('O valor do imóvel deve ser um número válido');
        setSaving(false);
        return;
      }

      // Criar uma cópia da timeline atual
      const updatedObservationsTimeline = [...observationsTimeline];
      
      // Adicionar registro de alteração do valor do crédito à timeline, não às observações
      if (originalCreditValue !== null && desiredCredit !== originalCreditValue) {
        const now = new Date();
        
        const newObservation = {
          text: `Valor do crédito alterado de ${formatCurrency(originalCreditValue)} para ${formatCurrency(desiredCredit)}`,
          date: now,
          type: 'credit_change'
        };
        
        updatedObservationsTimeline.push(newObservation);
      }

      // Verificar se o banco foi selecionado
      if (!data.bankId) {
        console.warn('Nenhum banco selecionado para a proposta');
      } else {
        console.log('Banco selecionado:', data.bankId);
        // Encontrar o banco selecionado para obter o nome
        const selectedBank = banks.find(bank => bank.id === data.bankId);
        console.log('Dados do banco selecionado:', selectedBank);
      }

      // Preparar os dados para atualização
      const updateData = {
        clientName: data.clientName,
        desiredCredit: desiredCredit,
        hasProperty: Boolean(data.hasProperty),
        propertyValue: propertyValue,
        status: data.status,
        pipelineStatus: data.pipelineStatus,
        creditLine: data.creditLine || '',
        creditReason: data.creditReason || '',
        companyDescription: data.companyDescription || '',
        hasRestriction: Boolean(data.hasRestriction),
        observations: data.observations || '',  // Não adicionar mais o registro de alteração aqui
        clientId: data.clientId || '',
        bankId: data.bankId || '',
        bankCommission: data.bankCommission || '',
        teamCode: data.teamCode || '',
        teamName: data.teamName || '',
        updatedAt: new Date(),
        observationsTimeline: updatedObservationsTimeline,  // Adicionar a timeline atualizada
      };

      console.log('Dados a serem salvos no Firestore:', updateData);
      console.log('Linha de Crédito a ser salva:', data.creditLine);
      console.log('Finalidade do Crédito a ser salva:', data.creditReason);

      const docRef = doc(db, 'proposals', id);
      await updateDoc(docRef, updateData);

      // Atualizar o valor original do crédito e a timeline após salvar
      setOriginalCreditValue(desiredCredit);
      setObservationsTimeline(updatedObservationsTimeline);

      setSuccessMessage('Proposta atualizada com sucesso!');
      setTimeout(() => {
        navigate('/proposals');
      }, 2000);
    } catch (error) {
      console.error('Erro ao atualizar proposta:', error);
      setError('Erro ao salvar as alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="dark-card rounded-lg p-6">
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-card rounded-lg p-6">
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="mr-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h2 className="text-xl font-semibold text-white">Editar Proposta</h2>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg">
          <p className="text-sm text-green-500">{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Informações do Cliente</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  {...register('clientName')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
                {errors.clientName && (
                  <p className="mt-1 text-sm text-red-500">{errors.clientName.message}</p>
                )}
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('hasRestriction')}
                    className="rounded border-gray-700 bg-gray-900 text-white focus:ring-gray-400"
                  />
                  <span className="ml-2 text-gray-300">
                    Cliente possui restrição financeira
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Descrição da Empresa
                </label>
                <textarea
                  {...register('companyDescription')}
                  rows={4}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Informações de Crédito</h4>
            <div className="space-y-4">
              <CurrencyInput
                name="desiredCredit"
                register={register}
                label="Valor do Crédito"
                error={errors.desiredCredit?.message}
                setValue={setValue}
                disabled={false}
                control={control}
              />

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Linha de Crédito
                </label>
                <select
                  {...register('creditLine')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  <option value="">Selecione uma linha de crédito</option>
                  {creditLines.map((line) => (
                    <option key={line} value={line}>{line}</option>
                  ))}
                </select>
                {errors.creditLine && (
                  <p className="mt-1 text-sm text-red-500">{errors.creditLine.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Finalidade do Crédito
                </label>
                <select
                  {...register('creditReason')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  <option value="">Selecione a finalidade</option>
                  {creditReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
                {errors.creditReason && (
                  <p className="mt-1 text-sm text-red-500">{errors.creditReason.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Banco
                  </label>
                  <select
                    {...register('bankId')}
                    className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    onChange={(e) => {
                      const bankId = e.target.value;
                      console.log('Banco selecionado manualmente:', bankId);
                      setValue('bankId', bankId, { shouldDirty: true });
                      
                      // Encontrar o banco selecionado
                      if (bankId) {
                        const selectedBank = banks.find(bank => bank.id === bankId);
                        if (selectedBank) {
                          console.log('Definindo comissão do banco:', selectedBank.commission);
                          setValue('bankCommission', selectedBank.commission, { shouldDirty: true });
                        }
                      }
                    }}
                  >
                    <option value="">Selecione um banco</option>
                    {banks.map((bank) => {
                      const isSelected = bank.id === watch('bankId');
                      console.log(`Banco ${bank.companyName} (${bank.id}) é selecionado? ${isSelected}`);
                      return (
                        <option 
                          key={bank.id} 
                          value={bank.id}
                          selected={isSelected}
                        >
                          {bank.tradingName || bank.companyName}
                        </option>
                      );
                    })}
                  </select>
                  {errors.bankId && (
                    <p className="mt-1 text-sm text-red-500">{errors.bankId.message}</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Comissão do Banco (%)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      {...register('bankCommission')}
                      className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                      placeholder="0,00"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-400">%</span>
                    </div>
                  </div>
                  {errors.bankCommission && (
                    <p className="mt-1 text-sm text-red-500">{errors.bankCommission.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Informações do Imóvel</h4>
            <div className="space-y-4">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('hasProperty')}
                    className="rounded border-gray-700 bg-gray-900 text-white focus:ring-gray-400"
                  />
                  <span className="ml-2 text-gray-300">
                    Cliente possui imóvel
                  </span>
                </label>
              </div>

              {hasProperty && (
                <CurrencyInput
                  name="propertyValue"
                  register={register}
                  label="Valor do Imóvel"
                  error={errors.propertyValue?.message}
                  setValue={setValue}
                  disabled={false}
                  control={control}
                />
              )}
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Equipe</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Código da Equipe
                </label>
                <div className="flex items-center">
                  {watch('teamCode') ? (
                    <span 
                      className="px-2 py-1 text-xs font-medium rounded-md bg-blue-900 text-blue-200 cursor-help inline-block"
                      title={`Equipe: ${watch('teamName')}`}
                    >
                      {watch('teamCode')}
                    </span>
                  ) : (
                    <span className="text-gray-500">Sem equipe</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  A equipe é definida no cadastro do cliente. Para alterar, edite o cadastro do cliente.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Status Geral</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Status da Proposta
                </label>
                <select
                  {...register('status')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  {proposalStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Status do Pipeline
                </label>
                <select
                  {...register('pipelineStatus')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  {pipelineStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Observações
                </label>
                <textarea
                  {...register('observations')}
                  rows={4}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Adicione observações sobre a proposta..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>
    </div>
  );
}
