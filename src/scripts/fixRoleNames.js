// Script para corrigir inconsistências entre roleKey e roleName
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyApoamPAVUfhPvEUaAa8OgHwUh1MX6syzE",
  authDomain: "dols-capital-app.firebaseapp.com",
  projectId: "dols-capital-app",
  storageBucket: "dols-capital-app.appspot.com",
  messagingSenderId: "990060642007",
  appId: "1:990060642007:web:ec2f3f7f86fedc1964fa92"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mapeamento correto de roleKey para roleName
const correctRoleNames = {
  'admin': 'Administrador',
  'manager': 'Gerente',
  'client': 'Cliente',
  'partner': 'Parceiro',
  'director': 'Diretor' // Corrigir de "Gerente" para "Diretor"
};

async function fixRoleNames() {
  try {
    // Buscar todos os perfis
    const rolesSnapshot = await getDocs(collection(db, 'roles'));
    
    console.log(`Encontrados ${rolesSnapshot.size} perfis para verificar.`);
    
    const updatePromises = [];
    
    rolesSnapshot.forEach(roleDoc => {
      const roleData = roleDoc.data();
      const roleKey = roleData.key;
      const roleName = roleData.name;
      
      // Verificar se o nome está correto para a chave
      if (roleKey && correctRoleNames[roleKey] && roleName !== correctRoleNames[roleKey]) {
        console.log(`Corrigindo perfil ${roleKey}: "${roleName}" -> "${correctRoleNames[roleKey]}"`);
        
        // Adicionar promessa de atualização
        updatePromises.push(
          updateDoc(doc(db, 'roles', roleDoc.id), {
            name: correctRoleNames[roleKey]
          })
        );
      }
    });
    
    // Executar todas as atualizações
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`${updatePromises.length} perfis foram atualizados.`);
    } else {
      console.log('Nenhum perfil precisa ser corrigido.');
    }
    
    // Agora, vamos verificar os usuários que podem ter o roleName incorreto
    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    console.log(`Encontrados ${usersSnapshot.size} usuários para verificar.`);
    
    const userUpdatePromises = [];
    
    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const roleKey = userData.roleKey;
      const roleName = userData.roleName;
      
      // Verificar se o nome está correto para a chave
      if (roleKey && correctRoleNames[roleKey] && roleName !== correctRoleNames[roleKey]) {
        console.log(`Corrigindo usuário ${userDoc.id} (${userData.email}): "${roleName}" -> "${correctRoleNames[roleKey]}"`);
        
        // Adicionar promessa de atualização
        userUpdatePromises.push(
          updateDoc(doc(db, 'users', userDoc.id), {
            roleName: correctRoleNames[roleKey]
          })
        );
      }
    });
    
    // Executar todas as atualizações de usuários
    if (userUpdatePromises.length > 0) {
      await Promise.all(userUpdatePromises);
      console.log(`${userUpdatePromises.length} usuários foram atualizados.`);
    } else {
      console.log('Nenhum usuário precisa ser corrigido.');
    }
    
  } catch (error) {
    console.error('Erro ao corrigir nomes de perfis:', error);
  }
}

// Executar a função
fixRoleNames()
  .then(() => console.log('Processo concluído.'))
  .catch(error => console.error('Erro no processo:', error))
  .finally(() => process.exit(0));
