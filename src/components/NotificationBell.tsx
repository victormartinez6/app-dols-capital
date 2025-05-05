import { useState, useRef, useEffect, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, Notification } from '../contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Filtrar notificações: mostrar todas as não lidas ou as 5 últimas lidas
  const filteredNotifications = useMemo(() => {
    // Primeiro, separar as notificações lidas e não lidas
    const unreadNotifications = notifications.filter(notification => !notification.read);
    const readNotifications = notifications.filter(notification => notification.read);
    
    // Se houver notificações não lidas, mostrar todas elas
    if (unreadNotifications.length > 0) {
      return unreadNotifications;
    }
    
    // Caso contrário, mostrar apenas as 5 últimas lidas
    return readNotifications.slice(0, 5);
  }, [notifications]);

  // Fechar o dropdown quando clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Adicionar animação quando houver notificações não lidas
  useEffect(() => {
    if (unreadCount > 0) {
      // Iniciar animação
      const animationInterval = setInterval(() => {
        setIsAnimating(prev => !prev);
      }, 1000);
      
      return () => clearInterval(animationInterval);
    } else {
      setIsAnimating(false);
    }
  }, [unreadCount]);

  // Função para lidar com o clique em uma notificação
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navegar para a página apropriada com base no tipo de notificação
    if (notification.targetType === 'client' && notification.targetId) {
      navigate(`/clients/detail/${notification.targetId}`);
    } else if (notification.targetType === 'proposal' && notification.targetId) {
      navigate(`/proposals/detail/${notification.targetId}`);
    }
    
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-all duration-300 ${
          unreadCount > 0 
            ? 'text-white bg-blue-600 hover:bg-blue-700' 
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-900'
        } ${isAnimating ? 'scale-110 shadow-lg shadow-blue-500/50' : ''}`}
        aria-label="Notificações"
      >
        <Bell className={`h-5 w-5 ${isAnimating ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full animate-bounce">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {unreadCount > 0 
                ? `Notificações não lidas (${unreadCount})` 
                : "Últimas 5 notificações"}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-[60vh]">
            {filteredNotifications.length > 0 ? (
              <div>
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`h-2 w-2 mt-1.5 rounded-full flex-shrink-0 ${
                        !notification.read ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <div className="ml-3 flex-1">
                        <p className={`text-sm font-medium ${
                          !notification.read 
                            ? 'text-blue-600 dark:text-blue-400' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {format(notification.createdAt, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Nenhuma notificação encontrada.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
