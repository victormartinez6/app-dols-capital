import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import CurrencyInput from '../../components/CurrencyInput';
import { useAuth } from '../../contexts/AuthContext';

const schema = z.object({
  desiredCredit: z.coerce.number().min(1, 'Valor do crédito é obrigatório'),
  hasProperty: z.boolean(),
  propertyValue: z.coerce.number().nullable().optional(),
  creditLine: z.string().optional(),
  creditReason: z.string().optional(),
  companyDescription: z.string().optional(),
  hasRestriction: z.boolean().optional(),
  observations: z.string().optional(),
  bankId: z.string().optional(),
  bankCommission: z.string().optional(),
  bankName: z.string().optional(),
  bankTradingName: z.string().optional(),
});

const proposalStatusOptions = [
  { value: 'pending', label: 'Cadastro Enviado' },
  { value: 'in_analysis', label: 'Em Análise' },
  { value: 'with_pendencies', label: 'Pendências' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Recusada' },
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

export default function ProposalNew() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [banks, setBanks] = useState<Array<{id: string, companyName: string, tradingName: string, commission: string}>>([]);
  const [client, setClient] = useState<{
    id: string;
    name: string;
    type: 'PF' | 'PJ';
    teamCode: string;
    teamName: string;
    inviterUserId?: string; // ID do parceiro que convidou o cliente
  } | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, control } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      desiredCredit: undefined,
      hasProperty: false,
      propertyValue: undefined,
      creditLine: '',
      creditReason: '',
      companyDescription: '',
      hasRestriction: false,
      observations: '',
      bankId: '',
      bankCommission: '',
      bankName: '',
      bankTradingName: '',
    },
  });

  const hasProperty = watch('hasProperty');
  const selectedBankId = watch('bankId');

  // Efeito para carregar a lista de bancos cadastrados
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const banksCollection = collection(db, 'banks');
        const banksSnapshot = await getDocs(banksCollection);
        const banksList = banksSnapshot.docs.map(doc => ({
          id: doc.id,
          companyName: doc.data().companyName,
          tradingName: doc.data().tradingName || doc.data().companyName,
          commission: doc.data().commission || '',
        }));
        setBanks(banksList);
      } catch (error) {
        console.error('Erro ao carregar bancos:', error);
      }
    };

    fetchBanks();
  }, []);

  // Efeito para atualizar a comissão quando um banco for selecionado
  useEffect(() => {
    if (selectedBankId) {
      const selectedBank = banks.find(bank => bank.id === selectedBankId);
      if (selectedBank) {
        setValue('bankCommission', selectedBank.commission);
        setValue('bankName', selectedBank.companyName);
        setValue('bankTradingName', selectedBank.tradingName);
      }
    }
  }, [selectedBankId, banks, setValue]);

  useEffect(() => {
    console.log("ProposalNew - clientId recebido:", clientId);
    fetchClient();
  }, [clientId]);

  const fetchClient = async () => {
    if (!clientId) {
      console.error("ClientId não encontrado nos parâmetros da URL");
      setError("ID do cliente não encontrado");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("Buscando cliente com ID:", clientId);
      const docRef = doc(db, 'registrations', clientId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Dados do cliente encontrados:", data);
        
        // Determinar o nome do cliente com base no tipo (PF ou PJ)
        let clientName = 'Nome não disponível';
        let clientType: 'PF' | 'PJ' = data.type || 'PF';
        
        if (clientType === 'PF') {
          clientName = data.name || 'Cliente PF';
        } else if (clientType === 'PJ') {
          clientName = data.companyName || data.name || 'Cliente PJ';
        }
        
        // Buscar informações da equipe do cliente
        let teamCode = '';
        let teamName = 'Sem equipe';
        
        // Verificar se o cliente tem equipe diretamente nos dados
        if (data.teamCode && data.teamName) {
          teamCode = data.teamCode;
          teamName = data.teamName;
          console.log(`Equipe encontrada nos dados do cliente: ${teamName} (${teamCode})`);
        } 
        // Verificar se o cliente tem referência para uma equipe
        else if (data.team) {
          try {
            const teamRef = doc(db, 'teams', data.team);
            const teamSnap = await getDoc(teamRef);
            
            if (teamSnap.exists()) {
              const teamData = teamSnap.data();
              teamCode = teamData.teamCode || '';
              teamName = teamData.name || 'Equipe sem nome';
              console.log(`Equipe encontrada por referência: ${teamName} (${teamCode})`);
            }
          } catch (err) {
            console.error('Erro ao buscar dados da equipe:', err);
          }
        }
        
        console.log(`Cliente processado: ${clientName} (${clientType}) - ID: ${docSnap.id} - Equipe: ${teamName} (${teamCode})`);
        
        // Capturar o inviterUserId do cliente, se existir
        const inviterUserId = data.inviterUserId || null;
        console.log(`InviterUserId encontrado: ${inviterUserId || 'Não encontrado'}`);
        
        setClient({
          id: docSnap.id,
          name: clientName,
          type: clientType,
          teamCode,
          teamName,
          inviterUserId
        });
      } else {
        console.error("Cliente não encontrado no Firestore");
        setError('Cliente não encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      setError('Erro ao carregar os dados do cliente');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    if (!clientId || !client) return;

    try {
      setSaving(true);
      
      // Garantir que os valores numéricos sejam tratados corretamente
      const desiredCredit = typeof data.desiredCredit === 'string' 
        ? parseFloat(data.desiredCredit.replace(/[^\d.,]/g, '').replace(',', '.')) 
        : data.desiredCredit;
      
      const propertyValue = data.hasProperty && data.propertyValue
        ? (typeof data.propertyValue === 'string' 
            ? parseFloat(data.propertyValue.replace(/[^\d.,]/g, '').replace(',', '.'))
            : data.propertyValue)
        : null;
      
      // Gerar número da proposta
      const proposalNumber = `PROP-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
      
      console.log('Dados a serem salvos:', {
        ...data,
        desiredCredit,
        propertyValue,
        teamCode: client.teamCode,
        teamName: client.teamName
      });
      
      // Criar a proposta no Firestore
      const proposalData = {
        proposalNumber,
        clientId,
        clientName: client.name,
        clientType: client.type,
        // Incluir informações da equipe do cliente
        teamCode: client.teamCode,
        teamName: client.teamName,
        // Incluir informações do parceiro que convidou o cliente
        inviterUserId: client.inviterUserId || user?.id, // Usar o ID do parceiro que convidou ou o usuário atual
        desiredCredit: desiredCredit,
        hasProperty: data.hasProperty,
        propertyValue: propertyValue,
        status: 'pending',
        pipelineStatus: 'submitted',
        creditLine: data.creditLine,
        creditReason: data.creditReason,
        companyDescription: data.companyDescription,
        hasRestriction: data.hasRestriction,
        observations: data.observations,
        bankId: data.bankId,
        bankCommission: data.bankCommission,
        bankName: data.bankName,
        bankTradingName: data.bankTradingName,
        createdBy: user?.email || 'sistema',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'proposals'), proposalData);
      
      setSuccessMessage('Proposta criada com sucesso!');
      
      // Aguardar um pouco para mostrar a mensagem de sucesso antes de redirecionar
      setTimeout(() => {
        navigate('/proposals');
      }, 1500);
    } catch (error) {
      console.error('Erro ao criar proposta:', error);
      setError('Erro ao salvar a proposta');
      setTimeout(() => {
        setError(null);
      }, 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/proposals');
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

  if (error && !client) {
    return (
      <div className="dark-card rounded-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBack}
            className="mr-4 p-2 rounded-full hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          <h2 className="text-xl font-semibold text-white">Nova Proposta</h2>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-md p-4 text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="dark-card rounded-lg p-6">
      <div className="flex items-center mb-6">
        <button
          onClick={handleBack}
          className="mr-4 p-2 rounded-full hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5 text-gray-400" />
        </button>
        <h2 className="text-xl font-semibold text-white">Nova Proposta</h2>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-900/20 border border-green-800 rounded-md p-4 text-green-300">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-800 rounded-md p-4 text-red-300">
          {error}
        </div>
      )}

      <div className="bg-gray-900 p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Dados do Cliente</h2>
        <p className="text-blue-300">
          <strong>Nome:</strong> {client?.name}
        </p>
        <p className="text-blue-300">
          <strong>Tipo:</strong> {client?.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
        </p>
        <p className="text-blue-300">
          <strong>Equipe:</strong> {client?.teamCode ? `${client?.teamName} (${client?.teamCode})` : 'Sem equipe'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Informações do Crédito</h4>
            <div className="space-y-4">
              <CurrencyInput
                name="desiredCredit"
                register={register}
                label="Valor do Crédito Pretendido"
                error={errors.desiredCredit?.message as string}
                setValue={setValue}
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
                  <option value="">Selecione uma opção</option>
                  {creditLines.map((line) => (
                    <option key={line} value={line}>{line}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Finalidade do Crédito
                </label>
                <select
                  {...register('creditReason')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  <option value="">Selecione uma opção</option>
                  {creditReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Banco
                  </label>
                  <select
                    {...register('bankId')}
                    className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  >
                    <option value="">Selecione um banco</option>
                    {banks.map((bank) => (
                      <option key={bank.id} value={bank.id}>{bank.companyName}</option>
                    ))}
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
            <h4 className="text-md font-medium text-white mb-4">Informações Adicionais</h4>
            <div className="space-y-4">
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

              {client?.type === 'PJ' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Descrição da Empresa
                  </label>
                  <textarea
                    {...register('companyDescription')}
                    rows={3}
                    className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                    placeholder="Descreva a empresa brevemente..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Observações
                </label>
                <textarea
                  {...register('observations')}
                  rows={3}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Adicione observações sobre a proposta..."
                />
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
                  error={errors.propertyValue?.message as string}
                  setValue={setValue}
                  control={control}
                />
              )}
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
            {saving ? 'Criando...' : 'Criar Proposta'}
          </button>
        </div>
      </form>
    </div>
  );
}
