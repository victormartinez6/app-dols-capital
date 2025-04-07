import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import CurrencyInput from '../../components/CurrencyInput';
import { useAuth } from '../../contexts/AuthContext';

const schema = z.object({
  desiredCredit: z.number().min(1, 'Valor do crédito é obrigatório'),
  hasProperty: z.boolean(),
  propertyValue: z.number().nullable().optional(),
  creditLine: z.string().optional(),
  creditReason: z.string().optional(),
  companyDescription: z.string().optional(),
  hasRestriction: z.boolean().optional(),
  observations: z.string().optional(),
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
  const [client, setClient] = useState<{
    id: string;
    name: string;
    type: 'PF' | 'PJ';
  } | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      desiredCredit: 0,
      hasProperty: false,
      propertyValue: null,
      creditLine: '',
      creditReason: '',
      companyDescription: '',
      hasRestriction: false,
      observations: '',
    },
  });

  const hasProperty = watch('hasProperty');

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
        
        setClient({
          id: docSnap.id,
          name: data.fullName || data.companyName || 'Nome não disponível',
          type: data.documentType === 'cpf' ? 'PF' : 'PJ',
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
      
      // Gerar número da proposta
      const proposalNumber = `PROP-${Date.now().toString().substring(7, 13)}`;
      
      // Converter valores para o formato correto
      const proposalData = {
        clientId,
        clientName: client.name,
        proposalNumber,
        desiredCredit: Number(data.desiredCredit),
        hasProperty: data.hasProperty,
        propertyValue: data.hasProperty && data.propertyValue ? Number(data.propertyValue) : 0,
        status: 'pending',
        pipelineStatus: 'submitted',
        creditLine: data.creditLine || '',
        creditReason: data.creditReason || '',
        companyDescription: data.companyDescription || '',
        hasRestriction: data.hasRestriction || false,
        observations: data.observations || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: user?.id || '',
      };
      
      // Adicionar proposta ao Firestore
      const docRef = await addDoc(collection(db, 'proposals'), proposalData);
      
      setSuccessMessage('Proposta criada com sucesso!');
      
      // Aguardar um pouco para mostrar a mensagem de sucesso antes de redirecionar
      setTimeout(() => {
        navigate(`/proposals/detail/${docRef.id}`);
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

      <div className="mb-6 bg-blue-900/20 border border-blue-800 rounded-md p-4">
        <h3 className="text-md font-medium text-white mb-2">Informações do Cliente</h3>
        <p className="text-blue-300">
          <strong>Cliente:</strong> {client?.name}
        </p>
        <p className="text-blue-300">
          <strong>Tipo:</strong> {client?.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
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
                  <option value="">Selecione uma opção</option>
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
                  <option value="">Selecione uma opção</option>
                  {creditReasons.map((reason) => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
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
                  error={errors.propertyValue?.message}
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
