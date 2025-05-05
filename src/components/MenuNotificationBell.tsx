import { Bell } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

interface MenuNotificationBellProps {
  filterType?: 'proposal' | 'client';
}

export default function MenuNotificationBell({ filterType }: MenuNotificationBellProps) {
  const { notifications } = useNotifications();
  
  // Filtrar notificações pelo tipo específico (proposta ou cliente)
  const filteredNotifications = filterType 
    ? notifications.filter(n => n.targetType === filterType && !n.read)
    : notifications.filter(n => !n.read);
  
  const filteredCount = filteredNotifications.length;
  
  // Se não houver notificações não lidas, não mostrar o sino
  if (filteredCount === 0) {
    return null;
  }
  
  return (
    <div className="relative ml-2 flex items-center">
      <Bell className="h-4 w-4 text-amber-400 animate-pulse" />
      <span className="absolute -top-2 -right-2 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full animate-bounce">
        {filteredCount > 9 ? '9+' : filteredCount}
      </span>
    </div>
  );
}
