import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'ID da notificação é obrigatório' });
    }

    const notificationRef = doc(db, 'notifications', id);
    await updateDoc(notificationRef, {
      read: true
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    return res.status(500).json({ message: 'Erro ao marcar notificação como lida' });
  }
}
