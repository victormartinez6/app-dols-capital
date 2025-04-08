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
    const existingQuery = query(
      collection(db, 'notifications'),
      where('type', '==', notificationData.type),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const existingDocs = await getDocs(existingQuery);
    
    // Verificar se existe uma notificação com mensagem similar nas últimas 24 horas
    if (!existingDocs.empty) {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      // Extrair palavras importantes da mensagem atual (ignorando palavras comuns)
      const stopWords = ['de', 'como', 'se', 'o', 'a', 'os', 'as', 'um', 'uma', 'para', 'com', 'em'];
      const messageWords = notificationData.message
        .toLowerCase()
        .split(' ')
        .filter((word: string) => !stopWords.includes(word) && word.length > 2);
      
      // Procurar por notificações com mensagem similar
      const duplicateNotification = existingDocs.docs.find(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        
        // Verificar se a notificação é recente (últimas 24 horas)
        if (createdAt < oneDayAgo) return false;
        
        // Se não tiver mensagem, não é duplicata
        if (!data.message) return false;
        
        // Extrair palavras importantes da mensagem existente
        const existingMessageWords = data.message
          .toLowerCase()
          .split(' ')
          .filter((word: string) => !stopWords.includes(word) && word.length > 2);
        
        // Verificar quantas palavras importantes coincidem
        const matchingWords = messageWords.filter((word: string) => 
          existingMessageWords.includes(word)
        );
        
        // Se mais de 50% das palavras importantes coincidem, considerar como duplicata
        const matchPercentage = matchingWords.length / Math.min(messageWords.length, existingMessageWords.length);
        return matchPercentage > 0.5;
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
  // Manter um registro de clientes já notificados para evitar duplicatas
  const notifiedClients = new Set<string>();
  
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
        
        // Verificar se já notificamos sobre este cliente (usando o nome como identificador)
        // ou se o cliente tem um documento de identificação (CPF/CNPJ)
        const clientIdentifier = data.cpf || data.cnpj || clientName.toLowerCase().trim();
        
        if (createdAt > fiveMinutesAgo && !notifiedClients.has(clientIdentifier)) {
          // Marcar este cliente como já notificado
          notifiedClients.add(clientIdentifier);
          
          // Limitar o tamanho do conjunto para evitar vazamento de memória
          if (notifiedClients.size > 100) {
            // Remover o cliente mais antigo (primeiro adicionado)
            const oldestClient = Array.from(notifiedClients)[0];
            notifiedClients.delete(oldestClient);
          }
          
          callback(registrationId, registrationType, clientName);
        }
      }
    });
  });
};

// Criar notificação para novo registro de cliente
export const notifyNewRegistration = async (registrationId: string, registrationType: 'PF' | 'PJ', clientName: string) => {
  // Verificar se já existe uma notificação para este cliente nas últimas 24 horas
  const existingQuery = query(
    collection(db, 'notifications'),
    where('type', '==', 'new_registration'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  
  const existingDocs = await getDocs(existingQuery);
  
  // Verificar se já existe uma notificação com o mesmo nome de cliente
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  const isDuplicate = existingDocs.docs.some(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    
    // Verificar se a notificação é recente (últimas 24 horas)
    if (createdAt < oneDayAgo) return false;
    
    // Verificar se a mensagem contém o nome do cliente
    return data.message && data.message.includes(clientName);
  });
  
  if (isDuplicate) {
    console.log(`Já existe uma notificação para o cliente ${clientName}, ignorando duplicata`);
    return;
  }
  
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
