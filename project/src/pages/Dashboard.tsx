import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import DashboardHome from './dashboard/DashboardHome';
import Proposals from './dashboard/Proposals';
import ProposalDetail from './dashboard/ProposalDetail';
import ProposalEdit from './dashboard/ProposalEdit';
import ProposalNew from './dashboard/ProposalNew';
import Pipeline from './dashboard/Pipeline';
import Clients from './dashboard/Clients';
import ClientDetail from './dashboard/ClientDetail';
import Users from './dashboard/Users';
import Settings from './dashboard/Settings';
import MyRegistration from './dashboard/MyRegistration.tsx';
import UserProfile from './dashboard/UserProfile';
import UserEdit from './dashboard/UserEdit';
import UserDetail from './dashboard/UserDetail';
import Webhooks from './dashboard/Webhooks';
import { useAuth } from '../contexts/AuthContext';
import { useRegistrationMonitor } from '../hooks/useRegistrationMonitor';

export default function Dashboard() {
  const { user } = useAuth();
  
  // Ativar o monitoramento de novos registros para administradores e gerentes
  useRegistrationMonitor();

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        {user?.role === 'client' && (
          <Route path="my-registration" element={<MyRegistration />} />
        )}
        <Route path="proposals" element={<Proposals />} />
        <Route path="proposals/detail/:id" element={<ProposalDetail />} />
        <Route path="proposals/edit/:id" element={<ProposalEdit />} />
        <Route path="proposals/new/:clientId" element={<ProposalNew />} />
        <Route path="profile" element={<UserProfile />} />
        {(user?.role === 'manager' || user?.role === 'admin') && (
          <>
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/detail/:id" element={<ClientDetail />} />
            <Route path="settings" element={<Settings />} />
          </>
        )}
        {user?.role === 'admin' && (
          <>
            <Route path="users" element={<Users />} />
            <Route path="users/edit/:id" element={<UserEdit />} />
            <Route path="users/detail/:id" element={<UserDetail />} />
            <Route path="webhooks" element={<Webhooks />} />
          </>
        )}
      </Routes>
    </DashboardLayout>
  );
}