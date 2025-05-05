import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Função para criar uma notificação de teste no Firestore
 * Esta função é apenas para testes durante o desenvolvimento
 */
export const createTestNotification = async () => {
  try {
    const notificationData = {
      type: 'new_registration',
      title: 'Novo cadastro de cliente',
      message: 'Cliente de teste acabou de se cadastrar no sistema.',
      read: false,
      recipientRoles: ['admin', 'manager'],
      targetId: 'test-client-id',
      targetType: 'client',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    console.log('Notificação de teste criada com ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar notificação de teste:', error);
    throw error;
  }
};
