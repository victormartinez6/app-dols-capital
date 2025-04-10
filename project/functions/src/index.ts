import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { deleteAuthUser, disableAuthUser } from './auth';
import * as cors from 'cors';

// Inicializar o app do Firebase Admin
admin.initializeApp();

// Configuração do CORS
const corsHandler = cors({ 
  origin: true, // Permite qualquer origem, você pode restringir para origens específicas
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Função para aplicar CORS a todas as funções HTTP
const applyCorsToCloudfunctions = (fn: functions.HttpsFunction) => {
  return functions.https.onRequest((req, res) => {
    return corsHandler(req, res, () => fn(req, res));
  });
};

// Exportar as funções de autenticação
export { deleteAuthUser, disableAuthUser };
