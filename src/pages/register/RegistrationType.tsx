
import { useNavigate } from 'react-router-dom';
import { User, Building2, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

interface InviteInfo {
  inviteData: {
    userId: string;
    email: string;
    roleKey: string;
    team: string;
    timestamp: number;
  };
  inviterUserId: string;
  inviterEmail: string;
  team: string;
  inviteType: string;
}

export default function RegistrationType() {
  const navigate = useNavigate();
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [isFromInvite, setIsFromInvite] = useState(false);

  // Verificar se existe um convite armazenado no localStorage
  useEffect(() => {
    const storedInvite = localStorage.getItem('dolsCapitalInvite');
    if (storedInvite) {
      try {
        const parsedInvite = JSON.parse(storedInvite);
        setInviteInfo(parsedInvite);
        setIsFromInvite(true);
      } catch (error) {
        console.error('Erro ao processar convite armazenado:', error);
        localStorage.removeItem('dolsCapitalInvite');
      }
    }
  }, []);

  const handleTypeSelection = (type: 'individual' | 'company') => {
    // Se temos dados de convite, passamos para a próxima página
    if (isFromInvite && inviteInfo) {
      navigate(`/register/${type}`, { 
        state: { 
          inviteData: inviteInfo.inviteData,
          inviterUserId: inviteInfo.inviterUserId,
          inviterEmail: inviteInfo.inviterEmail,
          team: inviteInfo.team
        } 
      });
    } else {
      navigate(`/register/${type}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-6rem)] flex flex-col justify-center">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-semibold text-white mb-6 text-center">
          Selecione o tipo de cadastro
        </h1>
        
        {isFromInvite && inviteInfo && (
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-8 max-w-3xl mx-auto">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
              <div>
                <p className="text-white text-center">
                  Você está se cadastrando através de um convite de{' '}
                  <span className="font-semibold">
                    {inviteInfo.inviteData.roleKey === 'admin' ? 'um administrador' : 
                     inviteInfo.inviteData.roleKey === 'manager' ? 'um gerente' : 
                     inviteInfo.inviteData.roleKey === 'partner' ? 'um parceiro' : 'um usuário'}
                  </span>
                </p>
                {inviteInfo.team && (
                  <p className="text-white text-center mt-1">
                    Você será vinculado à equipe <span className="font-semibold">{inviteInfo.team}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
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