import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';

// Tipo para a requisição
interface Request {
  method: string;
  query: {
    id?: string;
  };
}

// Tipo para a resposta
interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
  redirect: (url: string) => void;
  setHeader: (name: string, value: string) => Response;
  send: (body: any) => Response;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID do documento não fornecido' });
  }

  try {
    // Buscar o documento no Firestore
    const docRef = doc(db, 'document_files', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error('Documento não encontrado:', id);
      return res.status(404).json({ message: 'Documento não encontrado' });
    }

    const documentData = docSnap.data();
    
    // Se o documento tiver um conteúdo base64 direto, retornar como arquivo
    if (documentData.url && documentData.url.startsWith('data:')) {
      const contentType = documentData.url.split(';')[0].split(':')[1];
      res.setHeader('Content-Type', contentType);
      const base64Data = documentData.url.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      return res.status(200).send(buffer);
    }
    
    // Se o documento tiver uma URL completa, redirecionar para ela
    if (documentData.url && documentData.url.startsWith('http')) {
      return res.redirect(documentData.url);
    }
    
    // Se não tiver URL, mas tiver um caminho no Storage, gerar a URL e redirecionar
    if (documentData.path) {
      try {
        const storage = getStorage();
        const storageRef = ref(storage, documentData.path);
        const url = await getDownloadURL(storageRef);
        return res.redirect(url);
      } catch (storageError) {
        console.error('Erro ao obter URL do Storage:', storageError);
        return res.status(500).json({ message: 'Erro ao acessar o documento no Storage' });
      }
    }
    
    // Se não tiver nem URL nem caminho, retornar erro
    return res.status(404).json({ message: 'Documento sem URL ou caminho válido' });
    
  } catch (error) {
    console.error('Erro ao buscar documento:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}
