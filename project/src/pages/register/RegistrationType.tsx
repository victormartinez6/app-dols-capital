import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Building2 } from 'lucide-react';

export default function RegistrationType() {
  const navigate = useNavigate();

  const handleTypeSelection = (type: 'individual' | 'company') => {
    navigate(`/register/${type}`);
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col justify-center">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-semibold text-white mb-12 text-center">
          Selecione o tipo de cadastro
        </h1>
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          <div
            onClick={() => handleTypeSelection('individual')}
            className="bg-black border border-gray-800 rounded-lg p-8 hover:border-gray-700 transition-colors cursor-pointer hover:bg-gray-900"
          >
            <div className="flex flex-col items-center text-center">
              <User className="h-16 w-16 text-white mb-6" />
              <h2 className="text-xl font-semibold text-white mb-4">
                Pessoa Física
              </h2>
              <p className="text-gray-400">
                Cadastro para pessoas físicas que buscam crédito pessoal ou financiamento.
              </p>
            </div>
          </div>

          <div
            onClick={() => handleTypeSelection('company')}
            className="bg-black border border-gray-800 rounded-lg p-8 hover:border-gray-700 transition-colors cursor-pointer hover:bg-gray-900"
          >
            <div className="flex flex-col items-center text-center">
              <Building2 className="h-16 w-16 text-white mb-6" />
              <h2 className="text-xl font-semibold text-white mb-4">
                Pessoa Jurídica
              </h2>
              <p className="text-gray-400">
                Cadastro para empresas que buscam crédito empresarial, capital de giro ou financiamento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}