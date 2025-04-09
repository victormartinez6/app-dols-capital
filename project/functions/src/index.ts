import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { deleteAuthUser, disableAuthUser } from './auth';

// Inicializar o app do Firebase Admin
admin.initializeApp();

// Exportar as funções de autenticação
export { deleteAuthUser, disableAuthUser };
