import { doc, setDoc, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';

// Chave de API do Firebase obtida do arquivo de configuração
const FIREBASE_API_KEY = "AIzaSyApoamPAVUfhPvEUaAa8OgHwUh1MX6syzE";

export interface UserData {
  name: string;
  email: string;
  password?: string;
  roleId: string; // ID do perfil no Firestore
  team?: string;
}

// Cria um documento de usuário no Firestore
export async function createUserDocument(uid: string, userData: UserData, createdById: string): Promise<void> {
  try {
    // Buscar informações do perfil selecionado
    const roleDoc = await getDoc(doc(db, 'roles', userData.roleId));
    
    if (!roleDoc.exists()) {
      throw new Error('Perfil selecionado não existe');
    }
    
    const roleData = roleDoc.data();
    
    // Criar o documento do usuário no Firestore usando o UID fornecido
    const newUser = {
      name: userData.name,
      email: userData.email,
      roleId: userData.roleId,
      roleKey: roleData.key, // Armazenar a chave do perfil para facilitar consultas
      roleName: roleData.name, // Armazenar o nome do perfil para exibição
      createdAt: serverTimestamp(),
      createdBy: createdById,
      hasRegistration: false,
      team: userData.team || null
    };
    
    await setDoc(doc(db, 'users', uid), newUser);
  } catch (error) {
    console.error('Erro ao criar documento de usuário:', error);
    throw error;
  }
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
// Esta função deve ser chamada apenas por um administrador
export async function deleteAuthUser(uid: string): Promise<void> {
  try {
    console.log(`Tentando excluir usuário ${uid} do Firebase Authentication`);
    
    // Exibir mensagem para o administrador
    alert(`Para excluir completamente o usuário ${uid} do Firebase Authentication, execute o seguinte comando no terminal:
    
    cd scripts && npm install firebase-admin && node deleteAuthUser.js ${uid}
    
    Você precisará baixar o arquivo de credenciais da conta de serviço do Firebase Admin SDK:
    1. Acesse https://console.firebase.google.com/project/dols-capital-app/settings/serviceaccounts/adminsdk
    2. Clique em "Gerar nova chave privada"
    3. Salve o arquivo como "serviceAccountKey.json" na pasta "scripts"
    `);
    
    // Não lançar erro para não interromper o fluxo
    console.log('Instruções fornecidas ao administrador para excluir o usuário do Firebase Authentication');
    
  } catch (error) {
    console.error('Erro ao excluir usuário do Firebase Authentication:', error);
    // Não lançar erro para não interromper o fluxo
  }
}

// Desativa um usuário no Firebase Authentication
// Esta função deve ser chamada apenas por um administrador através de uma Cloud Function
export async function disableAuthUser(uid: string, disabled: boolean): Promise<void> {
  try {
    // Utilizar a instância de functions exportada do firebase.ts
    const disableAuthUserFunction = httpsCallable(functions, 'disableAuthUser');
    await disableAuthUserFunction({ uid, disabled });
  } catch (error) {
    console.error('Erro ao desativar usuário no Firebase Authentication:', error);
    throw error;
  }
}
