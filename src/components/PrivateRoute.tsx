import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { Role } from '../types/roles';

interface PrivateRouteProps {
  children: React.ReactNode;
  // Mantemos o parâmetro na interface para compatibilidade com código existente
  requiredPermission?: string;
}

export default function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, loading } = useAuth();
  const { canViewPage } = useRolePermissions();
  const location = useLocation();

  // Mostrar indicador de carregamento enquanto o usuário está sendo carregado
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  // Redirecionar para login se o usuário não estiver autenticado
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Tratamento especial para o email do administrador
  if (user.email === 'victor@cambiohoje.com.br') {
    return <>{children}</>;
  }

  // Se o usuário é um cliente e não completou o registro, redirecionar para a página de tipo de registro
  if (
    user.roleKey === 'client' && 
    !user.registrationType && 
    !location.pathname.startsWith('/register')
  ) {
    return <Navigate to="/register/type" replace />;
  }
  
  // Temporariamente desativando a verificação de permissões
  // Permitir acesso a todas as páginas para depuração
  console.log('PrivateRoute - Permitindo acesso a:', location.pathname);
  
  // Se passou por todas as verificações, permitir acesso
  return <>{children}</>;
}

// Removida a função getPageKeyFromPath que não está sendo mais usada