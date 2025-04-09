import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserProfile: (userData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({
              id: userDoc.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              registrationType: userData.registrationType,
              createdAt: userData.createdAt?.toDate() || new Date(),
            } as User);
          } else {
            await firebaseSignOut(auth);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Autenticação Firebase bem-sucedida. UID:', userCredential.user.uid);
      
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      console.log('Documento do usuário existe?', userDoc.exists());
      
      if (!userDoc.exists()) {
        console.log('Documento do usuário não encontrado no Firestore. Criando documento...');
        
        // Criar o documento do usuário no Firestore
        const userData = {
          email: userCredential.user.email || email,
          name: userCredential.user.displayName || 'Usuário',
          role: 'client', // Papel padrão
          createdAt: serverTimestamp(),
        };
        
        // Salvar o documento no Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        
        // Definir o usuário no estado
        const user = {
          id: userCredential.user.uid,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          createdAt: new Date(),
        } as User;
        
        setUser(user);
        return;
      }

      const userData = userDoc.data();
      console.log('Dados do usuário recuperados:', userData);
      
      const user = {
        id: userDoc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        registrationType: userData.registrationType,
        createdAt: userData.createdAt?.toDate() || new Date(),
      } as User;
      
      setUser(user);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const userData = {
        email,
        name,
        role: 'client',
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      const user = {
        id: userCredential.user.uid,
        ...userData,
        createdAt: new Date(),
      } as User;
      
      setUser(user);
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('Usuário não autenticado');
      }

      // Reautenticar o usuário antes de alterar a senha
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
      // Atualizar a senha
      await updatePassword(currentUser, newPassword);
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      throw error;
    }
  };

  const updateUserProfile = async (userData: Partial<User>) => {
    try {
      if (!user || !user.id) {
        throw new Error('Usuário não autenticado');
      }

      // Atualizar no Firestore
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, userData);

      // Atualizar o estado local
      setUser(prev => {
        if (!prev) return null;
        return { ...prev, ...userData };
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      updateUserPassword,
      updateUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};