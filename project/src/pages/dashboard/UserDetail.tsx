import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'manager' | 'admin';
  createdAt: any;
  createdBy: string;
  hasRegistration?: boolean;
  registrationType?: 'PF' | 'PJ';
  lastAccess?: any;
  blocked?: boolean;
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) {
        console.error('ID do usuário não fornecido');
        setError('ID do usuário não fornecido');
        setLoading(false);
        return;
      }

      console.log('Buscando usuário com ID:', id);
      
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', id));
        
        if (!userDoc.exists()) {
          console.error('Usuário não encontrado no Firestore');
          setError('Usuário não encontrado');
          setLoading(false);
          return;
        }

        console.log('Dados do usuário obtidos:', userDoc.data());

        const userData = {
          id: userDoc.id,
          ...userDoc.data()
        } as User;

        setUserData(userData);
      } catch (err) {
        console.error('Erro ao buscar usuário:', err);
        setError('Falha ao carregar dados do usuário');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Não disponível';

    try {
      if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
        return format(timestamp.toDate(), 'dd/MM/yyyy', { locale: ptBR });
      }
      return 'Não disponível';
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return 'Não disponível';
    }
  };

  const getRoleLabel = (role: string) => {
    const roles = {
      client: 'Cliente',
      manager: 'Gerente',
      admin: 'Administrador'
    };
    return roles[role as keyof typeof roles] || role;
  };

  const getRoleColor = (role: string) => {
    const colors = {
      client: 'text-blue-400 bg-blue-400/10',
      manager: 'text-green-400 bg-green-400/10',
      admin: 'text-purple-400 bg-purple-400/10'
    };
    return colors[role as keyof typeof colors] || 'text-gray-400 bg-gray-400/10';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg">
        <p>{error}</p>
        <button 
          onClick={() => navigate('/users')} 
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
        >
          Voltar para lista de usuários
        </button>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 p-4 rounded-lg">
        <p>Usuário não encontrado</p>
        <button 
          onClick={() => navigate('/users')} 
          className="mt-4 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
        >
          Voltar para lista de usuários
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => navigate('/users')} 
            className="p-2 rounded-full hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-white">Detalhes do Usuário</h1>
        </div>
        
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => navigate(`/users/edit/${userData.id}`)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </button>
        )}
      </div>

      <div className="bg-black border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">{userData.name}</h2>
              <p className="text-gray-400">{userData.email}</p>
            </div>
            <div className="mt-2 md:mt-0">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userData.role)}`}>
                {getRoleLabel(userData.role)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Status</h3>
                <p className="text-white">
                  {userData.blocked ? (
                    <span className="text-red-400">Bloqueado</span>
                  ) : (
                    <span className="text-green-400">Ativo</span>
                  )}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Criado em</h3>
                <p className="text-white">{formatDate(userData.createdAt)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Cadastro</h3>
                <p className="text-white">
                  {userData.hasRegistration ? (
                    <span className="text-green-400">
                      Sim ({userData.registrationType === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'})
                    </span>
                  ) : (
                    <span className="text-gray-500">Não</span>
                  )}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">Último acesso</h3>
                <p className="text-white">
                  {userData.lastAccess ? formatDate(userData.lastAccess) : 'Não disponível'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
