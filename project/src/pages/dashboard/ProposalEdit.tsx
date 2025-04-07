import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import CurrencyInput from '../../components/CurrencyInput';

const schema = z.object({
  clientName: z.string().min(1, 'Nome do cliente é obrigatório'),
  desiredCredit: z.number().min(1, 'Valor do crédito é obrigatório'),
  hasProperty: z.boolean(),
  propertyValue: z.number().nullable().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'in_analysis', 'with_pendencies']),
  pipelineStatus: z.enum(['submitted', 'pre_analysis', 'credit', 'legal', 'contract']),
  creditLine: z.string().optional(),
  creditReason: z.string().optional(),
  companyDescription: z.string().optional(),
  hasRestriction: z.boolean().optional(),
  observations: z.string().optional(),
  clientId: z.string().optional(),
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

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientName: '',
      desiredCredit: 0,
      hasProperty: false,
      propertyValue: null,
      status: 'pending' as const,
      pipelineStatus: 'submitted' as const,
      creditLine: '',
      creditReason: '',
      companyDescription: '',
      hasRestriction: false,
      observations: '',
      clientId: '',
    },
  });

  const hasProperty = watch('hasProperty');

  useEffect(() => {
    const fetchProposal = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const docRef = doc(db, 'proposals', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          
          reset({
            clientName: data.clientName || '',
            desiredCredit: data.desiredCredit || 0,
            hasProperty: data.hasProperty || false,
            propertyValue: data.propertyValue || null,
            status: data.status || 'pending',
            pipelineStatus: data.pipelineStatus || 'submitted',
            creditLine: data.creditLine || '',
            creditReason: data.creditReason || '',
            companyDescription: data.companyDescription || '',
            hasRestriction: data.hasRestriction || false,
            observations: data.observations || '',
            clientId: data.clientId || '',
          });
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

    fetchProposal();
  }, [id, reset]);

  const onSubmit = async (data: any) => {
    if (!id) return;

    try {
      setSaving(true);
      
      // Converter valores para o formato correto
      const updatedData = {
        ...data,
        desiredCredit: Number(data.desiredCredit),
        propertyValue: data.hasProperty && data.propertyValue ? Number(data.propertyValue) : null,
        updatedAt: new Date(),
      };
      
      // Atualizar a proposta no Firestore
      const docRef = doc(db, 'proposals', id);
      await updateDoc(docRef, updatedData);
      
      // Se a proposta tiver um clientId, atualizar também o status do cliente
      if (data.clientId) {
        const clientRef = doc(db, 'registrations', data.clientId);
        await updateDoc(clientRef, {
          status: data.status === 'with_pendencies' ? 'documents_pending' : 
                 data.status === 'approved' ? 'complete' : 'pending',
          updatedAt: new Date(),
        });
      }

      setSuccessMessage('Proposta atualizada com sucesso!');
      
      // Aguardar um pouco para mostrar a mensagem de sucesso antes de redirecionar
      setTimeout(() => {
        navigate(`/proposals/detail/${id}`);
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar proposta:', error);
      setError('Erro ao salvar as alterações');
      setTimeout(() => {
        setError(null);
      }, 3000);
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
                  <p className="mt-1 text-sm text-red-400">{errors.clientName.message}</p>
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
            <h4 className="text-md font-medium text-white mb-4">Informações do Crédito</h4>
            <div className="space-y-4">
              <CurrencyInput
                name="desiredCredit"
                register={register}
                label="Valor do Crédito Pretendido"
                error={errors.desiredCredit?.message}
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Motivo do Crédito
                </label>
                <select
                  {...register('creditReason')}
                  className="bg-black border border-gray-700 text-white rounded-md w-full px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  <option value="">Selecione um motivo</option>
                  {creditReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
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
                />
              )}
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-5">
            <h4 className="text-md font-medium text-white mb-4">Status da Proposta</h4>
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
