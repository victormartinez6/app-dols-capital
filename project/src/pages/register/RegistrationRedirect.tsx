import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

/**
 * Componente que verifica o tipo de cliente (PF ou PJ) e redireciona para o formulário correto
 */
export default function RegistrationRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkClientType = async () => {
      if (!id) {
        console.error('ID não fornecido');
        navigate('/register/type');
        return;
      }

      try {
        console.log('Verificando tipo de cliente para ID:', id);
        const docRef = doc(db, 'registrations', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const clientType = data.type;
          
          console.log('Tipo de cliente encontrado:', clientType);
          
          // Determinar qual URL estamos tentando acessar (individual ou company)
          const currentPath = location.pathname;
          const isIndividualPath = currentPath.includes('/individual/');
          const isCompanyPath = currentPath.includes('/company/');
          
          // Verificar se o tipo de cliente corresponde ao tipo de formulário
          if (clientType === 'individual' || clientType === 'PF') {
            // Cliente é pessoa física
            if (isCompanyPath) {
              // Tentando acessar formulário de empresa para um cliente pessoa física
              console.log('Redirecionando de company para individual');
              navigate(`/register/individual/${id}`);
            } else {
              // Já estamos no caminho correto, apenas renderizar o formulário individual
              navigate(`/register/individual/${id}`, { replace: true, state: { isEditing: true } });
            }
          } else if (clientType === 'company' || clientType === 'PJ') {
            // Cliente é pessoa jurídica
            if (isIndividualPath) {
              // Tentando acessar formulário individual para um cliente pessoa jurídica
              console.log('Redirecionando de individual para company');
              navigate(`/register/company/${id}`);
            } else {
              // Já estamos no caminho correto, apenas renderizar o formulário company
              navigate(`/register/company/${id}`, { replace: true, state: { isEditing: true } });
            }
          } else {
            console.error('Tipo de cliente desconhecido:', clientType);
            navigate('/register/type');
          }
        } else {
          console.error('Cliente não encontrado para o ID:', id);
          navigate('/register/type');
        }
      } catch (error) {
        console.error('Erro ao verificar tipo de cliente:', error);
        navigate('/register/type');
      } finally {
        setIsLoading(false);
      }
    };

    checkClientType();
  }, [id, navigate, location.pathname]);

  // Exibir um indicador de carregamento enquanto verifica o tipo de cliente
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <p className="ml-2 text-white">Verificando informações do cliente...</p>
      </div>
    );
  }
  
  // Este return só será alcançado se houver algum problema no redirecionamento
  return null;
}
