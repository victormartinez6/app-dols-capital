import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'ID do usuário é obrigatório' });
    }

    // Buscar todas as notificações não lidas do usuário
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );

    const querySnapshot = await getDocs(q);
    
    // Usar batch para atualizar várias notificações de uma vez
    const batch = writeBatch(db);
    
    querySnapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar todas notificações como lidas:', error);
    return res.status(500).json({ message: 'Erro ao marcar todas notificações como lidas' });
  }
}
