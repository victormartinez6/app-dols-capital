import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, X } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  roleKey: 'client' | 'manager' | 'admin';
  createdAt: any;
  createdBy: string;
  hasRegistration?: boolean;
  registrationType?: 'PF' | 'PJ';
  lastAccess?: any;
  blocked?: boolean;
}

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roleKey: ''
  });

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
        setFormData({
          name: userData.name || '',
          email: userData.email || '',
          roleKey: userData.roleKey || 'client'
        });
      } catch (err) {
        console.error('Erro ao buscar usuário:', err);
        setError('Falha ao carregar dados do usuário');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id || !user) return;

    // Verificar se o usuário atual é um administrador
    if (user.roleKey !== 'admin') {
      setError('Você não tem permissão para editar usuários');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const userRef = doc(db, 'users', id);
      
      await updateDoc(userRef, {
        name: formData.name,
        roleKey: formData.roleKey,
        // Não atualizamos o e-mail aqui pois isso exigiria atualizar também no Firebase Auth
      });

      alert('Usuário atualizado com sucesso!');
      navigate('/users');
    } catch (err) {
      console.error('Erro ao atualizar usuário:', err);
      setError('Falha ao atualizar usuário. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl font-bold text-white">Editar Usuário</h1>
        </div>
      </div>

      <div className="bg-black border border-gray-700 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                Nome
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                E-mail
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                disabled
                className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-400">
                O e-mail não pode ser alterado por questões de segurança.
              </p>
            </div>

            <div>
              <label htmlFor="roleKey" className="block text-sm font-medium text-white mb-1">
                Perfil
              </label>
              <select
                id="roleKey"
                name="roleKey"
                value={formData.roleKey}
                onChange={handleChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 px-3 text-white"
                required
              >
                <option value="client">Cliente</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 flex items-center"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
