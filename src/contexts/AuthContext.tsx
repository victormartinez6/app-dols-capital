import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, teamId?: string | null) => Promise<void>;
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
            
            // Garantir que todos os campos necessários existam
            const user = {
              id: userDoc.id,
              email: userData.email || firebaseUser.email || '',
              name: userData.name || '',
              roleId: userData.roleId || userData.role?.id || '', 
              roleKey: userData.roleKey || userData.role || 'user', 
              roleName: userData.roleName || (userData.roleKey === 'admin' ? 'Administrador' : 'Usuário'),
              registrationType: userData.registrationType || null,
              team: userData.team || null,
              createdAt: userData.createdAt?.toDate() || new Date(),
            } as User;
            
            console.log('Usuário autenticado:', user);
            setUser(user);
          } else {
            console.warn('Documento do usuário não encontrado. Criando perfil básico.');
            // Criar um perfil básico para o usuário
            const basicUserData = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || '',
              roleId: '',
              roleKey: 'user',
              roleName: 'Usuário',
              createdAt: new Date()
            };
            
            // Salvar o perfil básico no Firestore
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), {
                email: basicUserData.email,
                name: basicUserData.name,
                roleKey: basicUserData.roleKey,
                roleName: basicUserData.roleName,
                createdAt: serverTimestamp()
              });
              
              setUser(basicUserData as User);
            } catch (error) {
              console.error('Erro ao criar perfil básico:', error);
              await firebaseSignOut(auth);
              setUser(null);
            }
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('AuthContext - Iniciando login para:', email);
      
      // Tratamento especial para o email do administrador
      const isAdminEmail = email === 'victor@cambiohoje.com.br';
      if (isAdminEmail) {
        console.log('AuthContext - Usuário é o administrador principal (victor@cambiohoje.com.br)');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        console.log('AuthContext - Perfil de usuário não encontrado, criando perfil básico');
        
        // Buscar o perfil padrão (cliente ou admin para o email especial)
        let roleId = '';
        let roleKey = isAdminEmail ? 'admin' : 'client';
        let roleName = isAdminEmail ? 'Administrador' : 'Cliente';
        
        // Se não for o admin, buscar o perfil padrão de cliente
        if (!isAdminEmail) {
          const rolesCollection = await getDoc(doc(db, 'roles', 'cliente-padrao'));
          if (rolesCollection.exists()) {
            const roleData = rolesCollection.data();
            roleId = rolesCollection.id;
            roleKey = roleData.key;
            roleName = roleData.name;
          }
        }
        
        const userData = {
          email: userCredential.user.email || email,
          name: userCredential.user.displayName || 'Usuário',
          roleId: roleId, 
          roleKey: roleKey, 
          roleName: roleName, 
          createdAt: serverTimestamp(),
        };
        
        console.log('AuthContext - Criando perfil de usuário com dados:', userData);
        await setDoc(doc(db, 'users', userCredential.user.uid), userData);
        
        const user = {
          id: userCredential.user.uid,
          email: userData.email,
          name: userData.name,
          roleId: userData.roleId,
          roleKey: userData.roleKey,
          roleName: userData.roleName,
          createdAt: new Date(),
        } as User;
        
        console.log('AuthContext - Usuário autenticado com perfil criado:', user);
        setUser(user);
        return;
      }

      const userData = userDoc.data();
      console.log('AuthContext - Dados do usuário recuperados:', userData);
      
      // Tratamento especial para o email do administrador
      if (isAdminEmail) {
        console.log('AuthContext - Aplicando perfil de administrador para', email);
        const user = {
          id: userDoc.id,
          email: userData.email,
          name: userData.name,
          roleId: 'admin', 
          roleKey: 'admin', 
          roleName: 'Administrador', 
          registrationType: userData.registrationType,
          team: userData.team,
          createdAt: userData.createdAt?.toDate() || new Date(),
        } as User;
        
        console.log('AuthContext - Usuário autenticado com perfil de admin:', user);
        setUser(user);
        return;
      }
      
      // Se o usuário é um cliente, buscar o roleId correto
      if (userData.roleKey === 'client' || userData.role === 'client') {
        console.log('AuthContext - Usuário é um cliente, buscando roleId correto');
        
        try {
          // Buscar o perfil de cliente no banco de dados
          const rolesCollection = collection(db, 'roles');
          const q = query(rolesCollection, where('key', '==', 'client'));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const roleDoc = querySnapshot.docs[0];
            console.log('AuthContext - Perfil de cliente encontrado:', roleDoc.id);
            
            // Atualizar o documento do usuário com o roleId correto
            try {
              await updateDoc(doc(db, 'users', userDoc.id), {
                roleId: roleDoc.id
              });
              
              console.log(`AuthContext - roleId atualizado para ${roleDoc.id} no banco de dados`);
            } catch (error) {
              console.error('AuthContext - Erro ao atualizar roleId no banco de dados:', error);
            }
            
            const user = {
              id: userDoc.id,
              email: userData.email,
              name: userData.name,
              roleId: roleDoc.id, // Usar o ID do perfil de cliente encontrado
              roleKey: 'client',
              roleName: 'Cliente',
              registrationType: userData.registrationType,
              team: userData.team,
              createdAt: userData.createdAt?.toDate() || new Date(),
            } as User;
            
            console.log('AuthContext - Usuário autenticado com perfil de cliente:', user);
            setUser(user);
            return;
          }
        } catch (error) {
          console.error('AuthContext - Erro ao buscar perfil de cliente:', error);
        }
      }
      
      // Para outros tipos de usuários
      const user = {
        id: userDoc.id,
        email: userData.email,
        name: userData.name,
        roleId: userData.roleId || userData.role?.id || '', 
        roleKey: userData.roleKey || userData.role || 'user', 
        roleName: userData.roleName || 'Usuário', 
        registrationType: userData.registrationType,
        team: userData.team,
        createdAt: userData.createdAt?.toDate() || new Date(),
      } as User;
      
      console.log('AuthContext - Usuário autenticado:', user);
      setUser(user);
    } catch (error) {
      console.error('AuthContext - Erro no login:', error);
      throw error;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    teamId?: string | null
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      const rolesCollection = await getDoc(doc(db, 'roles', 'cliente-padrao'));
      let roleId = '';
      let roleKey = 'client';
      let roleName = 'Cliente';
      
      if (rolesCollection.exists()) {
        const roleData = rolesCollection.data();
        roleId = rolesCollection.id;
        roleKey = roleData.key;
        roleName = roleData.name;
      }
      
      const userData = {
        email,
        name,
        roleId: roleId,
        roleKey: roleKey,
        roleName: roleName,
        team: teamId || null, // Vincular à equipe se fornecido
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      const user = {
        id: userCredential.user.uid,
        ...userData,
        team: teamId || null, // Garantir que o campo team esteja no objeto do usuário
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

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      
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

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, userData);

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