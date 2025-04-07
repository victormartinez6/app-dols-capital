import { useNavigate } from 'react-router-dom';
import { User, Building2 } from 'lucide-react';
import iconeCadastro from '../assets/icone_tela_cadastro_app.svg';

export default function RegistrationType() {
  const navigate = useNavigate();

  const handleTypeSelection = (type: 'individual' | 'company') => {
    sessionStorage.setItem('registrationType', type);
    sessionStorage.setItem('currentStep', 'company');
    navigate(`/register/${type}`);
  };

  return (
    <div className="h-screen bg-black">
      <div className="h-full flex px-1">
        {/* Área da logo (metade da largura) */}
        <div className="w-1/2 h-full flex items-center justify-center">
          <img 
            src={iconeCadastro}
            alt="Dols Capital" 
            className="w-[110%] h-[110%] object-contain"
          />
        </div>
        
        {/* Blocos de cadastro (metade da largura) */}
        <div className="w-3/2 flex flex-col justify-center pl-12 pr-6">
          <h1 className="text-3xl font-bold text-white mb-10">
            Selecione o tipo de Cadastro
          </h1>
          
          <div className="space-y-6 max-w-md">
            <div
              onClick={() => handleTypeSelection('individual')}
              className="bg-black border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors cursor-pointer"
            >
              <User className="h-10 w-10 text-white mb-3" />
              <h2 className="text-lg font-semibold text-white mb-1">
                Pessoa Física
              </h2>
              <p className="text-gray-400 text-xs">
                Cadastro para pessoas físicas que buscam crédito pessoal ou financiamento.
              </p>
            </div>

            <div
              onClick={() => handleTypeSelection('company')}
              className="bg-black border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors cursor-pointer"
            >
              <Building2 className="h-10 w-10 text-white mb-3" />
              <h2 className="text-lg font-semibold text-white mb-1">
                Pessoa Jurídica
              </h2>
              <p className="text-gray-400 text-xs">
                Cadastro para empresas que buscam crédito empresarial, capital de giro ou financiamento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}