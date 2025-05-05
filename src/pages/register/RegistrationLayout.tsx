import { Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function RegistrationLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Verificar se está em uma página de edição usando uma lógica mais robusta
  const pathname = location.pathname;
  
  // Verificar o tipo de cliente (individual ou company) baseado no pathname
  const isIndividualPage = pathname.includes('/individual/');
  const isCompanyPage = pathname.includes('/company/');
  
  // Verificar se está em uma página de edição
  const isEditPage = pathname.includes('/edit/') || isIndividualPage || isCompanyPage;
  
  console.log('Current path:', pathname, 'Is edit page:', isEditPage, 'Is individual:', isIndividualPage, 'Is company:', isCompanyPage);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header with logout button - ocultar na página de edição */}
      {!isEditPage && (
        <div className="fixed top-0 right-0 p-4 z-50">
          <button
            onClick={handleLogout}
            className="flex items-center px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sair
          </button>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}