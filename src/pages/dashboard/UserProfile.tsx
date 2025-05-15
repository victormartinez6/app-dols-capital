import { useState } from 'react';
import { User, Lock, Save, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRolePermissions } from '../../hooks/useRolePermissions';

export default function UserProfile() {
  const { user, updateUserPassword } = useAuth();
  const { canPerformAction } = useRolePermissions();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para controlar a visibilidade das senhas
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Verificar se o usuário tem permissão para visualizar o perfil
  if (!canPerformAction('myRegistration', 'view')) {
    return (
      <div className="p-6 bg-black rounded-lg shadow">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
          Acesso Restrito
        </h2>
        <p className="mt-2">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    // Resetar mensagens
    setError(null);
    setSuccess(null);

    // Validações
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Todos os campos são obrigatórios');
      return;
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não corresponde à nova senha');
      return;
    }

    try {
      setLoading(true);
      await updateUserPassword(currentPassword, newPassword);
      setSuccess('Senha alterada com sucesso!');

      // Limpar campos
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Erro ao alterar senha:', error);

      // Tratar mensagens de erro específicas do Firebase
      if (error.code === 'auth/wrong-password') {
        setError('Senha atual incorreta');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde');
      } else {
        setError('Erro ao alterar senha. Verifique suas credenciais e tente novamente');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-black text-white rounded-lg shadow">
      <div className="flex items-center p-6 border-b border-gray-800">
        <User className="h-6 w-6 mr-3" />
        <h2 className="text-2xl font-semibold">Meu Perfil</h2>
      </div>

      <div className="p-6">
        {/* Informações do usuário */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Informações da Conta</h3>
          <div className="bg-black border border-gray-800 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-400 text-sm mb-1">Nome</p>
                <p className="text-white font-medium">{user?.name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">E-mail</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Função</p>
                <p className="text-white font-medium capitalize">
                  {user?.roleKey === 'admin' ? 'Administrador' : 
                   user?.roleKey === 'manager' ? 'Gerente' : 
                   user?.roleKey === 'client' ? 'Cliente' : user?.roleName}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Conta criada em</p>
                <p className="text-white font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alteração de senha */}
        <div>
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <Lock className="h-5 w-5 mr-2" />
            Alterar Senha
          </h3>

          <div className="bg-black border border-gray-800 rounded-lg p-6">
            {error && (
              <div className="mb-4 p-3 bg-rose-900/50 border border-rose-800 rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 text-rose-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-rose-200 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-emerald-900/50 border border-emerald-800 rounded-md">
                <p className="text-emerald-200 text-sm">{success}</p>
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-1">
                    Senha Atual
                  </label>
                  <div className="relative">
                    <input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-black border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite sua senha atual"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-1">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-black border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite sua nova senha"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-black border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Confirme sua nova senha"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center w-full px-4 py-2 bg-[#A4A4A4] text-white rounded-md hover:bg-[#8a8a8a] focus:outline-none focus:ring-2 focus:ring-[#A4A4A4] focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                        Processando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Nova Senha
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
