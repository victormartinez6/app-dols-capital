import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface InvitePayload {
  userId: string;
  email: string;
  roleKey: string;
  team: string;
  timestamp: number;
}

export default function RegisterInvite() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processInvite = async () => {
      try {
        // Extrair o hash da URL
        const searchParams = new URLSearchParams(location.search);
        // Verificar tanto o parâmetro 'hash' quanto o 'invite'
        const hash = searchParams.get('hash') || searchParams.get('invite');
        
        console.log('Parâmetros da URL:', Object.fromEntries(searchParams.entries()));
        console.log('Hash/Invite encontrado:', hash);
        
        if (!hash) {
          setError('Link de convite inválido. Nenhum código de convite encontrado.');
          setLoading(false);
          return;
        }
        
        // Decodificar o hash
        const decodedHash = atob(hash);
        const inviteData = JSON.parse(decodedHash);
        
        // Verificar se o convite contém os campos necessários
        if (!inviteData.userId || !inviteData.email || !inviteData.roleKey || !inviteData.timestamp) {
          setError('Link de convite inválido. Dados incompletos.');
          setLoading(false);
          return;
        }
        
        // Verificar se o convite não expirou (7 dias)
        const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7 dias em milissegundos
        const currentTime = Date.now();
        
        if (currentTime - inviteData.timestamp > expirationTime) {
          setError('Link de convite expirado. Por favor, solicite um novo link.');
          setLoading(false);
          return;
        }
        
        // Determinar o tipo de convite (cliente ou parceiro)
        const inviteType = inviteData.inviteType || 'client';
        
        // Armazenar os dados do convite no localStorage para uso posterior
        const inviteInfo = {
          inviteData,
          inviterUserId: inviteData.userId,
          inviterEmail: inviteData.email,
          inviterName: inviteData.name || '',
          team: inviteData.team,
          inviteType
        };
        
        localStorage.setItem('dolsCapitalInvite', JSON.stringify(inviteInfo));
        
        // Redirecionar para o fluxo normal de registro
        navigate('/register');
        
      } catch (error) {
        console.error('Erro ao processar o convite:', error);
        setError('Erro ao processar o link de convite. Por favor, tente novamente.');
        setLoading(false);
      }
    };
    
    processInvite();
  }, [navigate, location.search]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <Loader2 className="h-12 w-12 text-white animate-spin mb-4" />
        <p className="text-white text-lg">Processando seu convite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <div className="bg-red-900/30 border border-red-500 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-semibold text-white mb-4">Erro no Convite</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/register/type')}
            className="w-full bg-white text-black py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Ir para o Cadastro Normal
          </button>
        </div>
      </div>
    );
  }

  return null; // Não deve chegar aqui, pois sempre redirecionamos ou mostramos erro/loading
}
