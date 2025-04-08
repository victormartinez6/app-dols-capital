import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputMask from 'react-input-mask';
import axios from 'axios';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

// Definir o tipo para o formulário
type AddressFormData = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
};

const schema = z.object({
  cep: z.string().min(8, 'CEP é obrigatório').transform(val => val.replace(/\D/g, '')),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(3, 'Bairro é obrigatório'),
  city: z.string().min(3, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado é obrigatório'),
});

interface AddressDataProps {
  onNext: () => void;
  onBack: () => void;
}

export default function AddressData({ onNext, onBack }: AddressDataProps) {
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<AddressFormData>({
    resolver: zodResolver(schema),
    defaultValues: {},
  });

  useEffect(() => {
    const loadSavedData = async () => {
      if (!user) return;
      
      try {
        const docRef = doc(db, 'registrations', user.uid || user.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as AddressFormData;
          reset(data);
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, [user, reset]);

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

  const onSubmit = async (data: AddressFormData) => {
    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Save to Firestore
      await setDoc(doc(db, 'registrations', user.uid || user.id), {
        ...data,
        step: 'address',
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
          Endereço
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              CEP
            </label>
            <InputMask
              mask="99999-999"
              {...register('cep')}
              onBlur={(e) => searchCep(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Bairro
            </label>
            <input
              type="text"
              {...register('neighborhood')}
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
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
              className="mt-1 block w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-white focus:border-gray-400 focus:ring-gray-400"
            />
            {errors.state && (
              <p className="mt-1 text-sm text-red-400">{errors.state.message}</p>
            )}
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