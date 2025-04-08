import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputMask from 'react-input-mask';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

const schema = z.object({
  legalRepresentative: z.string().min(3, 'Nome do Representante Legal é obrigatório'),
  partnerCpf: z.string().min(11, 'CPF do Sócio é obrigatório').transform(val => val.replace(/\D/g, '')),
  partnerEmail: z.string().email('E-mail do Sócio inválido'),
  ddi: z.string().min(2, 'DDI é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório').transform(val => val.replace(/\D/g, '')),
});

interface RepresentativeDataProps {
  onNext: () => void;
  onBack: () => void;
}

export default function RepresentativeData({ onNext, onBack }: RepresentativeDataProps) {
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ddi: '+55',
    },
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

  const onSubmit = async (data: any) => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Save to Firestore
      await setDoc(doc(db, 'registrations', user.uid), {
        ...data,
        step: 'representative',
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
                defaultValue="+55"
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
                className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-400">{errors.phone.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

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
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        >
          Próximo
        </button>
      </div>
    </form>
  );
}