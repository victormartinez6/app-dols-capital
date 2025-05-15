import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useLocation } from 'react-router-dom';
import { FileText, Users, Settings, LogOut, LayoutDashboard, Baseline as Pipeline, UserCircle, ClipboardList, Menu, X, Globe, UsersRound, Shield, Link as LinkIcon, Check, UserCog, Image } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Logo } from './Logo';
import NotificationBell from './NotificationBell';
import MenuNotificationBell from './MenuNotificationBell';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { Role } from '../types/roles';

const NavItem = ({ to, icon: Icon, children, isActive, notificationBadge, onClick }: { 
  to: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  isActive: boolean;
  notificationBadge?: React.ReactNode;
  onClick?: () => void;
}) => {
  // Adicionar log para depuração
  const handleClick = () => {
    console.log('NavItem clicked:', to);
    
    // Se onClick for fornecido, chamá-lo
    if (onClick) {
      onClick();
    }
  };
  
  return (
    <Link
      to={to}
      className={`group flex items-center px-6 py-3 text-gray-600 dark:text-gray-300 transition-colors ${
        isActive ? 'bg-[#A4A4A4] text-white dark:bg-[#A4A4A4] dark:text-white' : 'hover:bg-black dark:hover:bg-black'
      }`}
      onClick={handleClick}
    >
      <div className="transition-transform duration-200">
        <Icon className={`h-5 w-5 transition-transform duration-200 ${!isActive && 'group-hover:scale-125'}`} />
      </div>
      <span className="ml-2">{children}</span>
      {notificationBadge}
    </Link>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [teamInfo, setTeamInfo] = useState<{ name: string; teamCode: string } | null>(null);
  
  // Usar o hook de permissões baseado em roles
  const { canViewPage, canAccessMenu, role, loading, error, rawRoleData } = useRolePermissions();
  
  // Log para depuração
  useEffect(() => {
    console.log('DashboardLayout - Estado do hook de permissões:');
    console.log('- Role:', role);
    console.log('- Loading:', loading);
    console.log('- Error:', error);
    console.log('- Raw Role Data:', rawRoleData);
  }, [role, loading, error, rawRoleData]);
  
  // Buscar informações da equipe do gerente
  useEffect(() => {
    const fetchTeamInfo = async () => {
      if (user?.roleKey === 'manager' && user?.team) {
        try {
          const teamDoc = await getDoc(doc(db, 'teams', user.team));
          if (teamDoc.exists()) {
            const data = teamDoc.data();
            setTeamInfo({
              name: data.name || 'Equipe',
              teamCode: data.teamCode || '0000'
            });
          }
        } catch (error) {
          console.error('Erro ao buscar informações da equipe:', error);
        }
      }
    };
    
    fetchTeamInfo();
  }, [user?.roleKey, user?.team]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Verificar se o usuário pode acessar a rota atual
  const currentPath = location.pathname;
  const baseRoute = currentPath.split('/').slice(0, 2).join('/') || '/';

  // Mapear rotas para as páginas correspondentes no novo sistema
  const routeToPageMap: Record<string, keyof Role['pages']> = {
    '/': 'dashboard',
    '/dashboard': 'dashboard',
    '/clients': 'clients',
    '/proposals': 'proposals',
    '/pipeline': 'pipeline',
    '/users': 'users',
    '/settings': 'settings',
    '/webhooks': 'webhooks',
    '/my-registration': 'myRegistration',
    '/profile': 'myRegistration',
    '/teams': 'teams',
    '/roles': 'roles',
    '/marketing': 'marketing'
  };
  
  // Usar useEffect para evitar loop infinito e aguardar o carregamento das permissões
  useEffect(() => {
    // Desativar a verificação de permissões para não bloquear a navegação
    // Isso será tratado pelos componentes ProtectedRoute e PermissionRoute
  }, []);

  // Removido o redirecionamento forçado para permitir a navegação livre

  // Definir os itens de menu base
  const baseMenuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', pageKey: 'dashboard' },
    { 
      path: '/clients', 
      icon: UsersRound, 
      label: 'Clientes', 
      pageKey: 'clients',
      showNotification: true,
      notificationType: 'client' as 'proposal' | 'client'
    },
    { 
      path: '/proposals', 
      icon: FileText, 
      label: 'Propostas', 
      pageKey: 'proposals',
      showNotification: true,
      notificationType: 'proposal' as 'proposal' | 'client'
    },
    { path: '/pipeline', icon: Pipeline, label: 'Pipeline', pageKey: 'pipeline' },
    { path: '/marketing', icon: Image, label: 'Marketing', pageKey: 'marketing' },
    { path: '/teams', icon: UsersRound, label: 'Equipes', pageKey: 'teams' },
    { path: '/roles', icon: Shield, label: 'Perfis', pageKey: 'roles' },
    { path: '/users', icon: Users, label: 'Usuários', pageKey: 'users' },
    { path: '/settings', icon: Settings, label: 'Configurações', pageKey: 'settings' },
    { path: '/webhooks', icon: Globe, label: 'Webhooks', pageKey: 'webhooks' },
  ];
  
  // Adicionar o item "Meu Cadastro" apenas para usuários que não são parceiros
  const menuItems = user?.roleKey !== 'partner' 
    ? [...baseMenuItems, { path: '/my-registration', icon: ClipboardList, label: 'Meu Cadastro', pageKey: 'myRegistration' }]
    : baseMenuItems;

  // Filtrar os itens de menu com base nas permissões do usuário
  // Se ainda estiver carregando as permissões, não mostrar nenhum menu até que esteja pronto
  const filteredMenuItems = loading 
    ? [] // Array vazio enquanto carrega, para evitar o efeito de "piscar"
    : menuItems.filter(item => {
        // Verificar se o usuário tem permissão para acessar este menu
        console.log(`Verificando permissão para menu: ${item.pageKey}`);
        const hasAccess = canAccessMenu(item.pageKey);
        console.log(`Resultado para ${item.pageKey}: ${hasAccess ? 'Permitido' : 'Negado'}`);
        return hasAccess;
      });
      
  // Log para depuração
  console.log('Menus filtrados:', filteredMenuItems.map(item => item.pageKey));

  // Função para gerar o link de convite
  const generateInviteLink = () => {
    if (!user) return '';
    
    // Criar payload com os dados necessários
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name || user.displayName || '',
      roleKey: user.roleKey,
      team: user.team || '',
      timestamp: Date.now()
    };
    
    // Converter para string e codificar em base64
    const payloadString = JSON.stringify(payload);
    const hash = btoa(payloadString);
    
    // Retornar URL completa
    return `${window.location.origin}/register/invite?invite=${hash}`;
  };
  
  // Função para copiar o link para a área de transferência
  const copyInviteLink = () => {
    const link = generateInviteLink();
    navigator.clipboard.writeText(link).then(() => {
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-black">
      {/* Menu Lateral Fixo - Visível apenas em desktop */}
      <div className="hidden md:flex w-64 bg-white border-r border-gray-200 dark:bg-black dark:border-gray-800 flex-col fixed h-full z-10">
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200 dark:border-gray-800">
          <Logo className="w-48 h-auto" variant={isDark ? "white" : "default"} />
        </div>
        
        {/* Main Navigation */}
        <nav className="flex-1 mt-4 overflow-y-auto">
          {filteredMenuItems.map(item => (
            <NavItem
              key={item.path}
              to={item.path}
              icon={item.icon}
              isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
              notificationBadge={item.showNotification ? <MenuNotificationBell filterType={item.notificationType} /> : undefined}
            >
              {item.label}
            </NavItem>
          ))}
        </nav>
        
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="mb-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Logado como</div>
            <div className="text-gray-900 dark:text-white font-medium">{user?.name}</div>
            <div className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`}>
                {user?.roleName || user?.roleKey}
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

      {/* Menu Mobile - Visível apenas quando aberto */}
      <div className={`md:hidden fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-black transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
            <Logo className="w-32 h-auto" variant={isDark ? "white" : "default"} />
            <button onClick={toggleMobileMenu} className="text-gray-500 dark:text-gray-400">
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <nav className="mt-4">
            {filteredMenuItems.map(item => (
              <NavItem
                key={item.path}
                to={item.path}
                icon={item.icon}
                isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
                onClick={toggleMobileMenu}
                notificationBadge={item.showNotification ? <MenuNotificationBell filterType={item.notificationType} /> : undefined}
              >
                {item.label}
              </NavItem>
            ))}
          </nav>
        </div>
      </div>

      {/* Área de conteúdo com margem à esquerda para compensar o menu fixo em desktop */}
      <div className="flex-1 md:ml-64">
        {/* Header Fixo */}
        <header className="h-16 bg-white border-b border-gray-200 dark:bg-black dark:border-gray-800 flex items-center justify-between px-6 fixed top-0 right-0 left-0 md:left-64 z-10">
          <div className="flex items-center">
            {/* Botão do menu mobile */}
            <button 
              className="mr-4 text-gray-500 dark:text-gray-400 md:hidden"
              onClick={toggleMobileMenu}
            >
              <Menu className="h-6 w-6" />
            </button>
            {/* Logo mobile */}
            <div className="md:hidden mr-3">
              <Logo className="h-8 w-auto" variant={isDark ? "white" : "default"} isMobile={true} />
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {(() => {
                // Verificar se o caminho atual começa com algum dos caminhos definidos
                if (location.pathname.startsWith('/proposals')) {
                  return 'Propostas';
                } else if (location.pathname.startsWith('/clients')) {
                  return 'Clientes';
                } else if (location.pathname.startsWith('/pipeline')) {
                  return 'Pipeline';
                } else if (location.pathname.startsWith('/marketing')) {
                  return 'Marketing';
                } else if (location.pathname.startsWith('/teams')) {
                  return 'Equipes';
                } else if (location.pathname.startsWith('/users')) {
                  return 'Usuários';
                } else if (location.pathname.startsWith('/settings')) {
                  return 'Configurações';
                } else if (location.pathname.startsWith('/webhooks')) {
                  return 'Webhooks';
                } else if (location.pathname.startsWith('/my-registration')) {
                  return 'Meu Cadastro';
                } else if (location.pathname.startsWith('/roles')) {
                  return 'Perfis';
                } else {
                  return 'Dashboard';
                }
              })()}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            {/* Botão de Link de Cadastro (visível apenas para gerentes, parceiros e admin) */}
            {(user?.roleKey === 'admin' || user?.roleKey === 'manager' || user?.roleKey === 'partner') && (
              <button
                onClick={copyInviteLink}
                className="flex items-center p-2 text-green-500 bg-transparent rounded-lg transition-all duration-300 hover:text-white hover:bg-green-500 hover:shadow-[0_0_15px_rgba(34,197,94,0.7)] hover:scale-105 hover:border-2 hover:border-white"
                title="Copiar link de cadastro"
              >
                {showCopiedToast ? 
                  <Check className="h-5 w-5 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" /> : 
                  <LinkIcon className="h-5 w-5 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                }
                <span className="ml-1 text-sm font-medium hidden md:inline">Link de Cadastro</span>
              </button>
            )}
            
            {/* Etiqueta de Equipe para gerentes */}
            {user?.roleKey === 'manager' && teamInfo && (
              <div className="hidden md:flex items-center bg-gradient-to-b from-black to-gray-800 text-gray-200 px-3 py-1.5 rounded-md shadow-sm border border-gray-700 hover:border-gray-500 transition-all duration-300">
                <UserCog className="h-4 w-4 mr-2 text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold tracking-wide">{teamInfo.name}</span>
                  <span className="text-[10px] text-gray-400">Equipe #{teamInfo.teamCode}</span>
                </div>
              </div>
            )}
            
            {/* Toast de confirmação */}
            {showCopiedToast && (
              <div className="absolute top-16 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
                Link copiado!
              </div>
            )}
            
            {/* Mostrar o sino de notificações apenas para admin e manager */}
            {user?.roleKey !== 'client' && <NotificationBell />}
            
            {/* Botão de perfil do usuário */}
            <Link
              to="/profile"
              className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900 rounded-lg transition-colors"
              title="Meu Perfil"
            >
              <UserCircle className="h-5 w-5" />
            </Link>
          </div>
        </header>
        {/* Conteúdo principal com padding-top para compensar o header fixo */}
        <main className="p-4 md:p-6 pt-20 md:pt-24 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
