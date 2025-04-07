import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

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

// Configurar CORS headers para o Storage
storage.customDomain = window.location.origin;