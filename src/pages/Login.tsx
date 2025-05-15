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
  
  const { register, handleSubmit, formState: { errors }, setFocus, setValue } = useForm<FormData>({
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
        // Criar o usuário
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
    <div className="fixed inset-0 flex items-center justify-center font-['Montserrat'] overflow-hidden">
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
      <div className="max-w-md w-full space-y-6 p-6 sm:p-8 bg-black bg-opacity-70 rounded-xl shadow-2xl backdrop-blur-sm z-20 m-4 overflow-y-auto max-h-[90vh] md:overflow-visible md:max-h-none">
        <div className="flex flex-col items-center">
          <Logo className="h-16 w-auto mb-4" variant="white" />
          <h2 className="text-center text-2xl font-extrabold text-white">
            {forgotPassword ? 'Recuperar Senha' : isRegistering ? 'Crie sua conta' : 'Entre na sua conta'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            {forgotPassword 
              ? 'Informe seu e-mail para receber instruções de recuperação de senha' 
              : isRegistering 
                ? 'Preencha os dados abaixo para criar sua conta'
                : 'Acesse a plataforma Dols Capital'
            }
          </p>
        </div>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-white px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {isRegistering && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="h-5 w-5 text-gray-500" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    {...register('name')}
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-700 rounded-md bg-black bg-opacity-70 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D8B25A] focus:border-transparent"
                    placeholder="Seu nome completo"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-1">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-700 rounded-md bg-black bg-opacity-70 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D8B25A] focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-700 rounded-md bg-black bg-opacity-70 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D8B25A] focus:border-transparent"
                  placeholder="Sua senha"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-gray-400 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            
            {!isRegistering && !forgotPassword && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#D8B25A] focus:ring-[#D8B25A] bg-black"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-400">
                    Lembrar-me
                  </label>
                </div>

                <div className="text-sm">
                  <button
                    type="button"
                    onClick={toggleForgotPassword}
                    className="font-medium text-[#D8B25A] hover:text-[#E6C36A] focus:outline-none"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="submit"
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-[#D8B25A] to-[#A88D45] ${
                isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:from-[#E6C36A] hover:to-[#B99B53]'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A] transition-all duration-300 hover:shadow-[0_0_15px_rgba(216,178,90,0.6)] hover:-translate-y-1 hover:scale-[1.02]`}
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