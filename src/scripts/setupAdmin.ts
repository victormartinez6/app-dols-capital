import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const ADMIN_EMAIL = 'victor@cambiohoje.com.br';
const ADMIN_PASSWORD = 'admin123456'; // Você deve alterar esta senha após o primeiro login

async function setupAdminUser() {
  try {
    // Criar usuário no Authentication
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      ADMIN_EMAIL,
      ADMIN_PASSWORD
    );

    // Criar documento do usuário no Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: ADMIN_EMAIL,
      role: 'admin',
      name: 'Administrador',
      createdAt: serverTimestamp(),
    });

    console.log('✅ Usuário administrador criado com sucesso!');
    console.log('Email:', ADMIN_EMAIL);
    console.log('Senha:', ADMIN_PASSWORD);
    console.log('⚠️ IMPORTANTE: Altere a senha após o primeiro login!');
    
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('❌ O usuário administrador já existe!');
    } else {
      console.error('❌ Erro ao criar usuário administrador:', error);
    }
  }
}

setupAdminUser();