import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { Eye, EyeOff, Mail, Lock, KeyRound, UserPlus, ArrowLeft, LogIn, UserCircle, RefreshCw, Loader2 } from 'lucide-react';
import loginBg from '../assets/login_ny.jpg';

const schema = z.object({
  email: z.string().email('Endereço de e-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres').optional(),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, setFocus } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      setIsLoading(true);
      
      if (forgotPassword) {
        // Implementar lógica de recuperação de senha
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simular delay para mostrar o loading
        alert(`Um e-mail de recuperação de senha será enviado para ${data.email}`);
        setForgotPassword(false);
        setIsLoading(false);
        return;
      }
      
      if (isRegistering && data.name) {
        await signUp(data.email, data.password, data.name);
      } else {
        await signIn(data.email, data.password);
      }
      
      // Adicionar um pequeno delay antes de navegar para mostrar o efeito de loading
      await new Promise(resolve => setTimeout(resolve, 800));
      navigate('/');
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos. Por favor, verifique suas credenciais e tente novamente.');
      } else if (error.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso. Tente fazer login ou use outro e-mail.');
      } else if (error.code === 'auth/network-request-failed') {
        setError('Erro de conexão. Verifique sua internet e tente novamente.');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Aguarde um momento antes de tentar novamente.');
      } else if (error.message === 'User document not found') {
        setError('Usuário não encontrado no sistema. Entre em contato com o administrador.');
      } else {
        setError('Ocorreu um erro durante a autenticação. Tente novamente.');
      }
      console.error('Auth error:', error);
      setIsLoading(false);
    }
  };

  const toggleForgotPassword = () => {
    setForgotPassword(!forgotPassword);
    setIsRegistering(false);
    setTimeout(() => {
      setFocus('email');
    }, 100);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative font-['Montserrat'] overflow-hidden">
      {/* Background image with blur */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" 
        style={{
          backgroundImage: `url(${loginBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px)',
          transform: 'scale(1.1)'
        }}
      ></div>
      
      {/* Overlay for better contrast */}
      <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>
      
      {/* Content */}
      <div className="max-w-md w-full space-y-8 p-8 bg-black bg-opacity-70 rounded-xl shadow-2xl backdrop-blur-sm z-20 m-4">
        <div className="flex flex-col items-center">
          <Logo className="h-32 w-auto" variant="white" />
        </div>
        
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-md text-sm font-medium shadow-lg">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="rounded-md shadow-sm space-y-4">
            {isRegistering && (
              <div>
                <label htmlFor="name" className="text-white text-sm mb-1 block font-medium">Nome completo</label>
                <div className="relative">
                  <input
                    {...register('name')}
                    type="text"
                    className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Nome completo"
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center z-20">
                    <UserPlus className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                )}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="text-white text-sm mb-1 block font-medium">E-mail</label>
              <div className="relative">
                <input
                  {...register('email')}
                  type="email"
                  className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                  placeholder="Seu e-mail"
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center z-20">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
              )}
            </div>
            
            {!forgotPassword && (
              <div>
                <label htmlFor="password" className="text-white text-sm mb-1 block font-medium">Senha</label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPassword ? "text" : "password"}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 pl-10 pr-10 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Sua senha"
                    disabled={isLoading}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center z-20">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white z-20"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>
            )}
          </div>

          {!forgotPassword && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={toggleForgotPassword}
                className="text-[#D8B25A] hover:text-[#FFEEA8] text-sm font-medium flex items-center"
                disabled={isLoading}
              >
                <KeyRound className="h-4 w-4 mr-1" />
                Esqueci minha senha
              </button>
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md ${
                isLoading ? 'bg-gray-300 text-gray-600' : 'text-black bg-white hover:bg-gray-100'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A] shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]`}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="h-5 w-5 mr-2 animate-spin text-gray-600" />
                  <span>Processando...</span>
                </div>
              ) : forgotPassword ? (
                <span className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recuperar Senha
                </span>
              ) : isRegistering ? (
                <span className="flex items-center">
                  <UserCircle className="h-4 w-4 mr-2" />
                  Criar conta
                </span>
              ) : (
                <span className="flex items-center">
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </span>
              )}
            </button>
            
            {!forgotPassword && (
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className={`group relative w-full flex justify-center py-3 px-4 border border-[#D8B25A] text-sm font-medium rounded-md text-[#D8B25A] bg-transparent ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black hover:bg-opacity-50'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A] transition-all duration-300 hover:shadow-[0_0_15px_rgba(216,178,90,0.4)] hover:-translate-y-1 hover:scale-[1.02]`}
                disabled={isLoading}
              >
                {isRegistering ? (
                  <span className="flex items-center">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Já tem uma conta? Entre
                  </span>
                ) : (
                  <span className="flex items-center">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Quero me Cadastrar!
                  </span>
                )}
              </button>
            )}
            
            {forgotPassword && (
              <button
                type="button"
                onClick={toggleForgotPassword}
                className={`group relative w-full flex justify-center py-3 px-4 border border-gray-700 text-sm font-medium rounded-md text-gray-400 bg-transparent ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-black hover:bg-opacity-50'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02]`}
                disabled={isLoading}
              >
                <span className="flex items-center">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar para o login
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-black bg-opacity-80 p-8 rounded-lg shadow-2xl flex flex-col items-center">
            <div className="relative w-24 h-24 mb-4">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-[#D8B25A] border-opacity-20 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-[#D8B25A] rounded-full animate-spin"></div>
              <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <Logo className="h-12 w-auto" variant="white" />
              </div>
            </div>
            <p className="text-white text-lg font-medium">Entrando...</p>
            <p className="text-gray-400 text-sm mt-2">Preparando seu ambiente</p>
          </div>
        </div>
      )}
    </div>
  );
}