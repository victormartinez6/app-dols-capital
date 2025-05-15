import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyApoamPAVUfhPvEUaAa8OgHwUh1MX6syzE",
  authDomain: "dols-capital-app.firebaseapp.com",
  projectId: "dols-capital-app",
  storageBucket: "dols-capital-app.appspot.com",
  messagingSenderId: "990060642007",
  appId: "1:990060642007:web:ec2f3f7f86fedc1964fa92"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

// Conectar ao emulador de funções se estiver em ambiente de desenvolvimento
if (process.env.NODE_ENV === 'development') {
  // Descomentar a linha abaixo para usar o emulador local de funções
  // connectFunctionsEmulator(functions, 'localhost', 5001);
}

// Configurar URL base para o Storage
// Removida a linha com customDomain que estava causando erro de tipo