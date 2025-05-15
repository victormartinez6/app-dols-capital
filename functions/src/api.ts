import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';

// Configuração do CORS
const corsMiddleware = cors({ 
  origin: true, 
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// API para excluir usuário do Firebase Authentication
export const deleteUser = functions.https.onRequest((req, res) => {
  return corsMiddleware(req, res, async () => {
    try {
      // Verificar método
      if (req.method !== 'DELETE') {
        return res.status(405).json({ error: 'Método não permitido. Use DELETE.' });
      }

      // Verificar autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Token não fornecido.' });
      }

      const idToken = authHeader.split('Bearer ')[1];
      
      try {
        // Verificar token e obter usuário
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Verificar se o usuário é um administrador
        const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
        if (!userDoc.exists || userDoc.data()?.roleKey !== 'admin') {
          return res.status(403).json({ error: 'Permissão negada. Apenas administradores podem excluir usuários.' });
        }
        
        // Obter o UID do usuário a ser excluído
        const { uid } = req.query;
        if (!uid || typeof uid !== 'string') {
          return res.status(400).json({ error: 'UID do usuário não fornecido ou inválido.' });
        }
        
        // Excluir o usuário
        await admin.auth().deleteUser(uid);
        
        return res.status(200).json({ 
          success: true, 
          message: 'Usuário excluído com sucesso da autenticação do Firebase.' 
        });
      } catch (verifyError) {
        console.error('Erro ao verificar token:', verifyError);
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
      }
    } catch (error) {
      console.error('Erro ao processar requisição:', error);
      return res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });
});
