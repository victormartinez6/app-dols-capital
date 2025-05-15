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
import Teams from './dashboard/Teams';
import Roles from './dashboard/Roles';
import Marketing from './dashboard/Marketing';
import { useAuth } from '../contexts/AuthContext';
import { useRegistrationMonitor } from '../hooks/useRegistrationMonitor';
import PermissionRoute from '../components/PermissionRoute';

export default function Dashboard() {
  const { user } = useAuth();
  
  // Ativar o monitoramento de novos registros para administradores e gerentes
  useRegistrationMonitor();

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="my-registration" element={
          <PermissionRoute requiredPermission="view:myRegistration">
            <MyRegistration />
          </PermissionRoute>
        } />
        <Route path="proposals" element={
          <PermissionRoute requiredPermission="view:proposals">
            <Proposals />
          </PermissionRoute>
        } />
        <Route path="proposals/detail/:id" element={
          <PermissionRoute requiredPermission="view:proposals">
            <ProposalDetail />
          </PermissionRoute>
        } />
        <Route path="proposals/edit/:id" element={
          <PermissionRoute requiredPermission="edit:proposals">
            <ProposalEdit />
          </PermissionRoute>
        } />
        <Route path="proposals/new/:clientId" element={
          <PermissionRoute requiredPermission="edit:proposals">
            <ProposalNew />
          </PermissionRoute>
        } />
        <Route path="profile" element={<UserProfile />} />
        <Route path="pipeline" element={
          <PermissionRoute requiredPermission="view:pipeline">
            <Pipeline />
          </PermissionRoute>
        } />
        <Route path="clients" element={
          <PermissionRoute requiredPermission="view:clients">
            <Clients />
          </PermissionRoute>
        } />
        <Route path="clients/detail/:id" element={
          <PermissionRoute requiredPermission="view:clients">
            <ClientDetail />
          </PermissionRoute>
        } />
        <Route path="settings" element={
          <PermissionRoute requiredPermission="view:settings">
            <Settings />
          </PermissionRoute>
        } />
        <Route path="teams" element={
          <PermissionRoute requiredPermission="view:teams">
            <Teams />
          </PermissionRoute>
        } />
        <Route path="users" element={
          <PermissionRoute requiredPermission="view:users">
            <Users />
          </PermissionRoute>
        } />
        <Route path="users/edit/:id" element={
          <PermissionRoute requiredPermission="edit:users">
            <UserEdit />
          </PermissionRoute>
        } />
        <Route path="users/detail/:id" element={
          <PermissionRoute requiredPermission="view:users">
            <UserDetail />
          </PermissionRoute>
        } />
        <Route path="webhooks" element={
          <PermissionRoute requiredPermission="view:webhooks">
            <Webhooks />
          </PermissionRoute>
        } />
        <Route path="roles" element={
          <PermissionRoute requiredPermission="view:roles">
            <Roles />
          </PermissionRoute>
        } />
        <Route path="marketing" element={
          <Marketing />
        } />
      </Routes>
    </DashboardLayout>
  );
}