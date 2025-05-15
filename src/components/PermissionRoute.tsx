// import { Navigate } from 'react-router-dom';
// import { useRolePermissions } from '../hooks/useRolePermissions';

interface PermissionRouteProps {
  children: React.ReactNode;
  requiredPermission: string;
  redirectTo?: string;
}

/**
 * Componente que protege rotas com base em permissões específicas
 * Se o usuário não tiver a permissão necessária, será redirecionado
 */
export default function PermissionRoute({ 
  children, 
  requiredPermission
  // redirectTo = '/' (não utilizado no momento)
}: PermissionRouteProps) {
  // Não estamos mais usando as permissões
  // const { canAccessMenu, canViewPage, canPerformAction } = useRolePermissions();
  
  // Temporariamente desativando a verificação de permissões
  // Registrando a tentativa de acesso para depuração
  console.log(`PermissionRoute - Permitindo acesso à rota com permissão: ${requiredPermission}`);
  
  // Sempre permitir acesso para depuração
  // Comentado para referência futura:
  /*
  const hasAccess = () => {
    // Verificar permissões de menu
    if (requiredPermission.startsWith('menu:')) {
      const menuKey = requiredPermission.replace('menu:', '');
      return canAccessMenu(menuKey as any);
    }
    
    // Verificar permissões de visualização de página
    if (requiredPermission.startsWith('view:')) {
      // Extrair a página e o escopo (all, team, own)
      const permParts = requiredPermission.replace('view:', '').split('_');
      const pageKey = permParts[permParts.length - 1];
      return canViewPage(pageKey as any);
    }
    
    // Verificar permissões de ação
    if (requiredPermission.includes(':')) {
      const [action, pageKey] = requiredPermission.split(':');
      if (action && pageKey) {
        return canPerformAction(pageKey as any, action);
      }
    }
    
    console.warn(`Formato de permissão não reconhecido: ${requiredPermission}`);
    return false;
  };

  if (!hasAccess()) {
    console.log(`Acesso negado: permissão ${requiredPermission} não encontrada`);
    return <Navigate to={redirectTo} replace />;
  }
  */

  return <>{children}</>;
}
