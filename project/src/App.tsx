import { 
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route
} from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/PrivateRoute';
import RegistrationType from './pages/RegistrationType';
import IndividualForm from './pages/register/IndividualForm';
import CompanyForm from './pages/register/CompanyForm';
import RegistrationLayout from './pages/register/RegistrationLayout';
import ClientDetail from './pages/dashboard/ClientDetail';
import Clients from './pages/dashboard/Clients';
import Proposals from './pages/dashboard/Proposals';
import ProposalDetail from './pages/dashboard/ProposalDetail';
import ProposalEdit from './pages/dashboard/ProposalEdit';
import ProposalNew from './pages/dashboard/ProposalNew';

// Configurando o roteador com as flags futuras
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<Login />} />
      <Route
        path="/register"
        element={
          <PrivateRoute>
            <RegistrationLayout />
          </PrivateRoute>
        }
      >
        <Route path="type" element={<RegistrationType />} />
        <Route path="individual" element={<IndividualForm />} />
        <Route path="individual/:id" element={<IndividualForm />} />
        <Route path="individual/edit" element={<IndividualForm isEditing={true} />} />
        <Route path="company" element={<CompanyForm />} />
        <Route path="company/:id" element={<CompanyForm />} />
        <Route path="company/edit" element={<CompanyForm isEditing={true} />} />
      </Route>
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      >
        <Route index element={<div className="p-6">Bem-vindo ao Dashboard</div>} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/detail/:id" element={<ClientDetail />} />
        <Route path="proposals" element={<Proposals />} />
        <Route path="proposals/detail/:id" element={<ProposalDetail />} />
        <Route path="proposals/edit/:id" element={<ProposalEdit />} />
        <Route path="proposals/new/:clientId" element={<ProposalNew />} />
      </Route>
    </Route>
  ),
  {
    future: {
      v7_relativeSplatPath: true
    }
  }
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;