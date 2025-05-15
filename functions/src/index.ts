import * as admin from 'firebase-admin';
import { deleteAuthUser, disableAuthUser } from './auth';
import { deleteUser } from './api';

// Inicializar o app do Firebase Admin
admin.initializeApp();

// Exportar as funções de autenticação
export { deleteAuthUser, disableAuthUser, deleteUser };
