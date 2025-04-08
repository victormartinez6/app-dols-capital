import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputMask from 'react-input-mask';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { searchCNPJ } from '../../../services/cnpj';

const schema = z.object({
  cnpj: z.string().min(14, 'CNPJ é obrigatório').transform(val => val.replace(/\D/g, '')),
  companyName: z.string().min(3, 'Razão Social é obrigatória'),
  simples: z.boolean(),
  constitutionDate: z.string().min(1, 'Data de Constituição é obrigatória'),
  revenue: z.string().min(1, 'Faixa de Faturamento é obrigatória'),
});

const revenueRanges = [
  '1 a 10 milhões',
  '11 a 30 milhões',
  '31 a 100 milhões',
  'Acima de 100 milhões',
];

interface CompanyDataProps {
  onNext: () => void;
}

export default function CompanyData({ onNext }: CompanyDataProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  useEffect(() => {
    const loadSavedData = async () => {
      if (!user) return;
      
      try {
        const docRef = doc(db, 'registrations', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          reset(data);
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, [user, reset]);

  const handleCNPJSearch = async (cnpj: string) => {
    try {
      setLoading(true);
      const data = await searchCNPJ(cnpj);
      if (data) {
        setValue('companyName', data.razao_social);
        setValue('constitutionDate', data.data_abertura);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Save to Firestore
      await setDoc(doc(db, 'registrations', user.uid), {
        ...data,
        step: 'company',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Proceed to next step
      onNext();
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                {...register('cnpj')}
                onBlur={(e) => handleCNPJSearch(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
              />
              {loading && (
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
                className="rounded border-gray-700 bg-gray-900 text-white focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        >
          Próximo
        </button>
      </div>
    </form>
  );
}