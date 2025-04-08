import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Users, Settings, LogOut, LayoutDashboard, Baseline as Pipeline, Sun, Moon, UserCircle, ClipboardList } from 'lucide-react';
import { Logo } from './Logo';
import NotificationBell from './NotificationBell';
import MenuNotificationBell from './MenuNotificationBell';

const NavItem = ({ to, icon: Icon, children, isActive, notificationBadge }: { 
  to: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  isActive: boolean;
  notificationBadge?: React.ReactNode;
}) => (
  <Link
    to={to}
    className={`group flex items-center px-6 py-3 text-gray-600 dark:text-gray-300 transition-colors ${
      isActive ? 'bg-[#A4A4A4] text-white dark:bg-[#A4A4A4] dark:text-white' : 'hover:bg-black dark:hover:bg-black'
    }`}
  >
    <div className="transition-transform duration-200">
      <Icon className={`h-5 w-5 transition-transform duration-200 ${!isActive && 'group-hover:scale-125'}`} />
    </div>
    <span className="ml-2">{children}</span>
    {notificationBadge}
  </Link>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['client', 'manager', 'admin'] },
    { path: '/clients', icon: UserCircle, label: 'Clientes', roles: ['manager', 'admin'] },
    { path: '/proposals', icon: FileText, label: 'Propostas', roles: ['client', 'manager', 'admin'] },
    { path: '/pipeline', icon: Pipeline, label: 'Pipeline', roles: ['manager', 'admin'] },
    { path: '/users', icon: Users, label: 'Usuários', roles: ['admin'] },
    { path: '/settings', icon: Settings, label: 'Configurações', roles: ['admin'] },
    { path: '/my-registration', icon: ClipboardList, label: 'Meu Cadastro', roles: ['client'] },
  ];

  return (
    <div className="min-h-screen flex bg-white dark:bg-black">
      {/* Menu Lateral Fixo */}
      <div className="w-64 bg-white border-r border-gray-200 dark:bg-black dark:border-gray-800 flex flex-col fixed h-full z-10">
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200 dark:border-gray-800">
          <Logo className="w-48 h-auto" variant={isDark ? "white" : "default"} />
        </div>
        
        {/* Main Navigation */}
        <nav className="flex-1 mt-4 overflow-y-auto">
          {menuItems
            .filter(item => item.roles.includes(user?.role || ''))
            .map(item => (
              <NavItem
                key={item.path}
                to={item.path}
                icon={item.icon}
                isActive={location.pathname === item.path}
                notificationBadge={item.path === '/proposals' ? <MenuNotificationBell filterType="proposal" /> : undefined}
              >
                {item.label}
              </NavItem>
            ))}
        </nav>

        {/* User Profile and Logout - Moved to bottom */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="mb-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Logado como</div>
            <div className="text-gray-900 dark:text-white font-medium">{user?.name}</div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user?.role === 'admin' 
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                  : user?.role === 'manager'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              }`}>
                {user?.role === 'admin' ? 'Administrador' : 
                 user?.role === 'manager' ? 'Gerente' : 
                 user?.role === 'client' ? 'Cliente' : user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="ml-2">Sair</span>
          </button>
        </div>
      </div>

      {/* Área de conteúdo com margem à esquerda para compensar o menu fixo */}
      <div className="flex-1 ml-64">
        {/* Header Fixo */}
        <header className="h-16 bg-white border-b border-gray-200 dark:bg-black dark:border-gray-800 flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-10">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {(() => {
              // Verificar se o caminho atual começa com algum dos caminhos definidos
              if (location.pathname.startsWith('/proposals')) {
                return 'Propostas';
              } else if (location.pathname.startsWith('/clients')) {
                return 'Clientes';
              } else if (location.pathname.startsWith('/pipeline')) {
                return 'Pipeline';
              } else if (location.pathname.startsWith('/users')) {
                return 'Usuários';
              } else if (location.pathname.startsWith('/settings')) {
                return 'Configurações';
              } else if (location.pathname.startsWith('/my-registration')) {
                return 'Meu Cadastro';
              } else {
                return 'Dashboard';
              }
            })()}
          </h1>
          <div className="flex items-center space-x-2">
            {/* Mostrar o sino de notificações apenas para admin e manager */}
            {user?.role !== 'client' && <NotificationBell />}
            
            {/* Botão de perfil do usuário */}
            <Link
              to="/profile"
              className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 rounded-lg transition-colors"
              title="Meu Perfil"
            >
              <UserCircle className="h-5 w-5" />
            </Link>
            
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 rounded-lg transition-colors"
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
        </header>
        {/* Conteúdo principal com padding-top para compensar o header fixo */}
        <main className="p-6 pt-24">
          {children}
        </main>
      </div>
    </div>
  );
}