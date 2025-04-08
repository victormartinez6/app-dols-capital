import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
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
    // Verificar se já existe uma notificação similar para evitar duplicação
    // Usamos uma consulta mais específica para evitar duplicatas
    const existingQuery = query(
      collection(db, 'notifications'),
      where('type', '==', notificationData.type),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    
    const existingDocs = await getDocs(existingQuery);
    
    // Verificar se existe uma notificação com mensagem similar nas últimas 24 horas
    if (!existingDocs.empty) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      // Procurar por notificações com a mesma mensagem (que contém o nome do cliente)
      const duplicateNotification = existingDocs.docs.find(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        
        // Verificar se a notificação é recente (últimas 24 horas)
        if (createdAt < oneDayAgo) return false;
        
        // Comparar o conteúdo da mensagem para detectar duplicatas
        // Se a mensagem contém o mesmo nome de cliente, consideramos uma duplicata
        if (data.message && notificationData.message) {
          // Extrair o nome do cliente da mensagem
          const messageWords = data.message.split(' ');
          const newMessageWords = notificationData.message.split(' ');
          
          // Se a mensagem contém pelo menos 3 palavras iguais consecutivas, consideramos duplicata
          for (let i = 0; i < messageWords.length - 2; i++) {
            for (let j = 0; j < newMessageWords.length - 2; j++) {
              if (
                messageWords[i] === newMessageWords[j] &&
                messageWords[i+1] === newMessageWords[j+1] &&
                messageWords[i+2] === newMessageWords[j+2] &&
                messageWords[i] !== 'de' && 
                messageWords[i] !== 'como' && 
                messageWords[i] !== 'se'
              ) {
                return true;
              }
            }
          }
        }
        
        return false;
      });
      
      if (duplicateNotification) {
        console.log('Notificação similar já existe, ignorando duplicata');
        return duplicateNotification.id;
      }
    }
    
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
