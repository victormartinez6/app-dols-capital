// Proxy para contornar problemas de CORS com Firebase Storage
import express from 'express';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD8lEGQHYUqDdvRmqVGEYsUCQNRDDHGEBk",
  authDomain: "dols-capital-app.firebaseapp.com",
  projectId: "dols-capital-app",
  storageBucket: "dols-capital-app.appspot.com",
  messagingSenderId: "1031058131948",
  appId: "1:1031058131948:web:9b0e4e3a8b8d5a3b9b8d5a"
};

// Inicializar Firebase
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Configurar CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rota para upload de arquivos
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Recebendo requisição de upload');
    
    if (!req.file) {
      console.log('Nenhum arquivo enviado');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    console.log('Arquivo recebido:', req.file.originalname, 'Tamanho:', req.file.size, 'bytes');
    console.log('Corpo da requisição:', req.body);

    const { userId, documentType } = req.body;
    if (!userId || !documentType) {
      console.log('Dados incompletos:', { userId, documentType });
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    // Criar nome de arquivo único
    const timestamp = Date.now();
    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${originalName}`;
    const path = `documents/${userId}/${documentType}/${fileName}`;
    
    console.log('Caminho do arquivo:', path);

    try {
      // Criar referência no Storage
      const storageRef = ref(storage, path);
      console.log('Referência do storage criada');

      // Metadados do arquivo
      const metadata = {
        contentType: req.file.mimetype
      };
      console.log('Metadados:', metadata);

      // Fazer upload do arquivo
      console.log('Iniciando upload...');
      const snapshot = await uploadBytes(storageRef, req.file.buffer, metadata);
      console.log('Upload concluído');
      
      // Obter URL de download
      console.log('Obtendo URL de download...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('URL obtida:', downloadURL);

      // Retornar dados do documento
      const response = {
        name: req.file.originalname,
        url: downloadURL,
        type: documentType,
        path: path
      };
      
      console.log('Resposta enviada:', response);
      res.json(response);
    } catch (uploadError) {
      console.error('Erro específico no upload:', uploadError);
      console.error('Código do erro:', uploadError.code);
      console.error('Mensagem do erro:', uploadError.message);
      if (uploadError.customData) {
        console.error('Dados customizados:', uploadError.customData);
      }
      
      res.status(500).json({ 
        error: uploadError.message || 'Erro ao fazer upload do arquivo',
        code: uploadError.code,
        details: uploadError.customData
      });
    }
  } catch (error) {
    console.error('Erro geral no upload:', error);
    res.status(500).json({ 
      error: error.message || 'Erro ao fazer upload do arquivo',
      stack: error.stack
    });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor proxy rodando na porta ${PORT}`);
});
