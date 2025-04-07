import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc, collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import CurrencyInput from '../../../components/CurrencyInput';
import SuccessModal from '../../../components/SuccessModal';
import DocumentsSection from '../../../components/DocumentsSection';

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
}

const schema = z.object({
  creditLine: z.string().min(1, 'Linha de Crédito é obrigatória'),
  creditReason: z.string().min(1, 'Motivo do Crédito é obrigatório'),
  desiredCredit: z.number().min(1, 'Valor do crédito é obrigatório').nullable(),
  hasRestriction: z.boolean(),
  companyDescription: z.string().min(10, 'Descrição da empresa é obrigatória'),
});

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

export default function CreditData() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [documents, setDocuments] = useState<Record<string, Document>>({});
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...JSON.parse(sessionStorage.getItem('creditData') || '{}'),
      desiredCredit: undefined,
    },
  });

  useEffect(() => {
    const loadSavedData = async () => {
      if (!user) return;
      
      try {
        const docRef = doc(db, 'registrations', user.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          reset(data);
          if (data.documents) {
            setDocuments(data.documents);
          }
          sessionStorage.setItem('creditData', JSON.stringify(data));
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, [user, reset]);

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

  const onSubmit = async (data: any) => {
    try {
      setLoading(true);
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const companyData = JSON.parse(sessionStorage.getItem('companyData') || '{}');
      const representativeData = JSON.parse(sessionStorage.getItem('representativeData') || '{}');
      const addressData = JSON.parse(sessionStorage.getItem('addressData') || '{}');

      // Dados completos do cadastro
      const registrationData = {
        ...companyData,
        ...representativeData,
        ...addressData,
        ...data,
        documents,
        type: 'PJ',
        userId: user.id,
        status: 'pending',
        step: 'completed',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Salvar dados de cadastro no Firestore
      await setDoc(doc(db, 'registrations', user.id), registrationData);

      // Atualizar perfil do usuário com o tipo de cadastro
      await setDoc(doc(db, 'users', user.id), {
        registrationType: 'PJ',
      }, { merge: true });

      // Criar automaticamente uma proposta com os dados do cadastro
      const proposalData = {
        clientName: companyData.companyName || 'Nome não disponível',
        clientId: user.id,
        desiredCredit: data.desiredCredit || 0,
        hasProperty: false, // Valor padrão, pode ser atualizado posteriormente
        propertyValue: 0, // Valor padrão, pode ser atualizado posteriormente
        status: 'pending',
        pipelineStatus: 'submitted',
        creditLine: data.creditLine,
        creditReason: data.creditReason,
        companyDescription: data.companyDescription,
        hasRestriction: data.hasRestriction,
        userId: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Adicionar a proposta à coleção 'proposals'
      await addDoc(collection(db, 'proposals'), proposalData);

      // Limpar dados de cadastro do sessionStorage
      sessionStorage.removeItem('companyData');
      sessionStorage.removeItem('representativeData');
      sessionStorage.removeItem('addressData');
      sessionStorage.removeItem('creditData');
      
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving data:', error);
      setError('Erro ao salvar os dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onBack = () => {
    sessionStorage.setItem('creditData', JSON.stringify({
      creditLine: '',
      creditReason: '',
      desiredCredit: 0,
      hasRestriction: false,
      companyDescription: '',
    }));
    navigate('/register/company/address');
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate('/', { replace: true });
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-gray-900/50 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">Dados de Crédito</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Linha de Crédito
              </label>
              <select
                {...register('creditLine')}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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

            <CurrencyInput
              name="desiredCredit"
              register={register}
              label="Valor do Crédito Pretendido"
              error={errors.desiredCredit?.message}
            />

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  {...register('hasRestriction')}
                  className="rounded border-gray-700 bg-gray-900 text-white focus:ring-gray-400"
                />
                <span className="ml-2 text-gray-300">
                  Empresa possui restrição financeira
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Breve Relato sobre a Empresa
              </label>
              <textarea
                {...register('companyDescription')}
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
              />
              {errors.companyDescription && (
                <p className="mt-1 text-sm text-red-400">{errors.companyDescription.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Document Upload Section */}
        {user && (
          <DocumentsSection
            type="PJ"
            userId={user.id}
            documents={documents}
            onDocumentChange={handleDocumentChange}
            onError={handleDocumentError}
          />
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          >
            {loading ? 'Salvando...' : 'Finalizar Cadastro'}
          </button>
        </div>
      </form>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        message="Cadastro realizado com sucesso! Uma proposta foi criada automaticamente. Você será redirecionado para o dashboard."
      />
    </>
  );
}