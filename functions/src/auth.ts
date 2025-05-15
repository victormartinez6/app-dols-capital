import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Função para excluir um usuário do Firebase Authentication
export const deleteAuthUser = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado e é um administrador
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para realizar esta ação.'
      );
    }

    // Verificar se o usuário é um administrador (você deve implementar essa verificação)
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.roleKey !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores podem excluir usuários.'
      );
    }

    // Verificar se o UID foi fornecido
    if (!data.uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'O UID do usuário a ser excluído é obrigatório.'
      );
    }

    try {
      // Excluir o usuário do Firebase Authentication
      await admin.auth().deleteUser(data.uid);
      return { success: true, message: 'Usuário excluído com sucesso.' };
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Erro ao excluir usuário do Firebase Authentication.'
      );
    }
  });

// Função para desativar/ativar um usuário no Firebase Authentication
export const disableAuthUser = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // Verificar se o usuário está autenticado e é um administrador
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'O usuário deve estar autenticado para realizar esta ação.'
      );
    }

    // Verificar se o usuário é um administrador
    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.roleKey !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Apenas administradores podem bloquear/desbloquear usuários.'
      );
    }

    // Verificar se o UID e o status de bloqueio foram fornecidos
    if (!data.uid || data.disabled === undefined) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'O UID do usuário e o status de bloqueio são obrigatórios.'
      );
    }

    try {
      // Atualizar o status de bloqueio do usuário no Firebase Authentication
      await admin.auth().updateUser(data.uid, { disabled: data.disabled });
      return { 
        success: true, 
        message: `Usuário ${data.disabled ? 'bloqueado' : 'desbloqueado'} com sucesso.` 
      };
    } catch (error) {
      console.error('Erro ao atualizar status de bloqueio do usuário:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Erro ao atualizar status de bloqueio do usuário no Firebase Authentication.'
      );
    }
  });
