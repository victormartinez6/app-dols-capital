import { doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuth, updateProfile } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Chave de API do Firebase obtida do arquivo de configuração
const FIREBASE_API_KEY = "AIzaSyApoamPAVUfhPvEUaAa8OgHwUh1MX6syzE";

export interface UserData {
  name: string;
  email: string;
  password?: string;
  role: 'client' | 'manager' | 'admin';
}

// Cria um documento de usuário no Firestore
export async function createUserDocument(uid: string, userData: UserData, createdById: string): Promise<void> {
  // Criar o documento do usuário no Firestore usando o UID fornecido
  const newUser = {
    name: userData.name,
    email: userData.email,
    role: userData.role,
    createdAt: serverTimestamp(),
    createdBy: createdById,
    hasRegistration: false
  };
  
  await setDoc(doc(db, 'users', uid), newUser);
}

// Cria um usuário no Firebase Authentication e no Firestore
export async function createUserWithRole(userData: UserData, createdById: string): Promise<string> {
  if (!userData.password) {
    throw new Error('A senha é obrigatória para criar um usuário');
  }

  try {
    // Em um ambiente de produção, isso seria feito por uma Cloud Function
    // para evitar problemas com o login automático
    
    // Usar a API REST do Firebase para criar o usuário
    // Isso evita o login automático que ocorre com createUserWithEmailAndPassword
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        returnSecureToken: false // Não queremos o token de autenticação
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erro ao criar usuário: ${errorData.error.message}`);
    }
    
    const data = await response.json();
    const uid = data.localId;
    
    // Criar o documento do usuário no Firestore
    await createUserDocument(uid, userData, createdById);
    
    return uid;
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    throw error;
  }
}

// Exclui um usuário do Firestore
export async function deleteUserDocument(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid));
}

// Atualiza o status de bloqueio de um usuário no Firestore
export async function updateUserBlockStatus(uid: string, blocked: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    blocked: blocked,
    blockedAt: blocked ? serverTimestamp() : null
  }, { merge: true });
}

// Nota: As funções abaixo não podem ser executadas diretamente no frontend
// Em um ambiente de produção, essas operações devem ser realizadas por Cloud Functions

// Exclui um usuário do Firebase Authentication
// Esta função deve ser chamada apenas por um administrador através de uma Cloud Function
export async function deleteAuthUser(uid: string): Promise<void> {
  try {
    // Em um ambiente real, você usaria uma Cloud Function para isso
    const functions = getFunctions();
    const deleteAuthUserFunction = httpsCallable(functions, 'deleteAuthUser');
    await deleteAuthUserFunction({ uid });
  } catch (error) {
    console.error('Erro ao excluir usuário do Firebase Authentication:', error);
    throw error;
  }
}

// Desativa um usuário no Firebase Authentication
// Esta função deve ser chamada apenas por um administrador através de uma Cloud Function
export async function disableAuthUser(uid: string, disabled: boolean): Promise<void> {
  try {
    // Em um ambiente real, você usaria uma Cloud Function para isso
    const functions = getFunctions();
    const disableAuthUserFunction = httpsCallable(functions, 'disableAuthUser');
    await disableAuthUserFunction({ uid, disabled });
  } catch (error) {
    console.error('Erro ao desativar usuário no Firebase Authentication:', error);
    throw error;
  }
}
