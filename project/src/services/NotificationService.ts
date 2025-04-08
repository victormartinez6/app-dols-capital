import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface NotificationData {
  type: 'new_registration' | 'new_proposal' | 'status_change';
  title: string;
  message: string;
  read: boolean;
  recipientRoles: Array<'admin' | 'manager'>;
  targetId?: string;
  targetType?: 'client' | 'proposal';
}

// Criar uma nova notificação
export const createNotification = async (notificationData: NotificationData) => {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notificationData,
      createdAt: serverTimestamp(),
      read: false
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    throw error;
  }
};

// Monitorar novos registros de clientes
export const monitorNewRegistrations = (callback: (registrationId: string, registrationType: 'PF' | 'PJ', clientName: string) => void) => {
  // Configurar a consulta para monitorar novos registros
  const q = query(
    collection(db, 'registrations'),
    orderBy('createdAt', 'desc'),
    limit(10)
  );

  // Iniciar o listener
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      // Apenas notificar sobre novos documentos
      if (change.type === 'added') {
        const data = change.doc.data();
        const registrationId = change.doc.id;
        const registrationType = data.type as 'PF' | 'PJ';
        const clientName = registrationType === 'PF' ? data.name : data.companyName;
        
        // Verificar se o registro foi criado recentemente (últimos 5 minutos)
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        if (createdAt > fiveMinutesAgo) {
          callback(registrationId, registrationType, clientName);
        }
      }
    });
  });
};

// Criar notificação para novo registro de cliente
export const notifyNewRegistration = async (registrationId: string, registrationType: 'PF' | 'PJ', clientName: string) => {
  const type = 'new_registration';
  const title = 'Novo cadastro de cliente';
  const message = `${registrationType === 'PF' ? 'Cliente' : 'Empresa'} ${clientName} acabou de se cadastrar.`;
  
  await createNotification({
    type,
    title,
    message,
    read: false,
    recipientRoles: ['admin', 'manager'],
    targetId: registrationId,
    targetType: 'client'
  });
};
