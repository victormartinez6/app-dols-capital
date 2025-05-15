import { 
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route
} from 'react-router-dom';
import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PermissionProvider } from './contexts/PermissionContext';
import { useWebhookTrigger } from './hooks/useWebhookTrigger';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import RegistrationType from './pages/RegistrationType';
import IndividualForm from './pages/register/IndividualForm';
import CompanyForm from './pages/register/CompanyForm';
import RegistrationLayout from './pages/register/RegistrationLayout';
import RegisterInvite from './pages/register/RegisterInvite';
import ClientDetail from './pages/dashboard/ClientDetail';
import Clients from './pages/dashboard/Clients';
import Proposals from './pages/dashboard/Proposals';
import ProposalDetail from './pages/dashboard/ProposalDetail';
import ProposalEdit from './pages/dashboard/ProposalEdit';
import ProposalNew from './pages/dashboard/ProposalNew';
import Pipeline from './pages/dashboard/Pipeline';
import Settings from './pages/dashboard/Settings';
import Webhooks from './pages/dashboard/Webhooks';
import Teams from './pages/dashboard/Teams';
import Roles from './pages/dashboard/Roles';
import Users from './pages/dashboard/Users';
import Marketing from './pages/dashboard/Marketing';

// Configurando o roteador com as flags futuras
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<Login />} />
      {/* Rota para processar convites - acessível sem autenticação */}
      <Route path="/register/invite" element={<RegisterInvite />} />
      <Route
        path="/register"
        element={
          <PrivateRoute>
            <RegistrationLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<RegistrationType />} />
        <Route path="type" element={<RegistrationType />} />
        <Route path="individual" element={<IndividualForm />} />
        <Route path="individual/:id" element={<IndividualForm isEditing={true} />} />
        <Route path="company" element={<CompanyForm />} />
        <Route path="company/:id" element={<CompanyForm isEditing={true} />} />
      </Route>
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      >
        <Route index element={
          <PrivateRoute>
            <div className="p-6">Bem-vindo ao Dashboard</div>
          </PrivateRoute>
        } />
        <Route path="clients" element={
          <PrivateRoute>
            <Clients />
          </PrivateRoute>
        } />
        <Route path="clients/detail/:id" element={
          <PrivateRoute>
            <ClientDetail />
          </PrivateRoute>
        } />
        <Route path="proposals" element={
          <PrivateRoute>
            <Proposals />
          </PrivateRoute>
        } />
        <Route path="proposals/detail/:id" element={
          <PrivateRoute>
            <ProposalDetail />
          </PrivateRoute>
        } />
        <Route path="proposals/edit/:id" element={
          <PrivateRoute>
            <ProposalEdit />
          </PrivateRoute>
        } />
        <Route path="proposals/new/:clientId" element={
          <PrivateRoute>
            <ProposalNew />
          </PrivateRoute>
        } />
        <Route path="pipeline" element={
          <PrivateRoute>
            <Pipeline />
          </PrivateRoute>
        } />
        <Route path="teams" element={
          <PrivateRoute>
            <Teams />
          </PrivateRoute>
        } />
        <Route path="settings" element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        } />
        <Route path="webhooks" element={
          <PrivateRoute>
            <Webhooks />
          </PrivateRoute>
        } />
        <Route path="roles" element={
          <PrivateRoute>
            <Roles />
          </PrivateRoute>
        } />
        <Route path="users" element={
          <PrivateRoute>
            <Users />
          </PrivateRoute>
        } />
        <Route path="marketing" element={<Marketing />} />
      </Route>
    </Route>
  ),
  {
    future: {
      v7_relativeSplatPath: true
    }
  }
);

// Componente para ativar o monitoramento de webhooks
function WebhookProvider() {
  useWebhookTrigger();
  return null;
}

// Componente para capturar erros
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Erro capturado pela ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
          <h1 className="text-2xl font-bold mb-4">Algo deu errado</h1>
          <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-4 max-w-2xl overflow-auto">
            <p className="font-mono text-sm">{this.state.error?.toString()}</p>
          </div>
          <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-lg max-w-2xl overflow-auto">
            <p className="font-mono text-sm whitespace-pre-wrap">
              {this.state.errorInfo?.componentStack}
            </p>
          </div>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => window.location.href = '/login'}
          >
            Voltar para o login
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [error] = React.useState<string | null>(null);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
        <h1 className="text-2xl font-bold mb-4">Erro ao inicializar a aplicação</h1>
        <div className="bg-red-900 p-4 rounded-lg mb-4 max-w-2xl">
          <p>{error}</p>
        </div>
        <button 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PermissionProvider>
            <NotificationProvider>
              <WebhookProvider />
              <RouterProvider router={router} />
            </NotificationProvider>
          </PermissionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;