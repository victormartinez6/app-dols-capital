const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, updateDoc, doc } = require('firebase/firestore');

// Configuração do Firebase
const firebaseConfig = {
  // Substitua com suas credenciais do Firebase
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateManagerPermissions() {
  try {
    console.log('Buscando perfil de gerente...');
    
    // Buscar o perfil de gerente
    const rolesCollection = collection(db, 'roles');
    const q = query(rolesCollection, where('key', '==', 'manager'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.error('Perfil de gerente não encontrado!');
      return;
    }
    
    // Obter o primeiro documento encontrado
    const managerDoc = querySnapshot.docs[0];
    const managerData = managerDoc.data();
    
    console.log('Perfil de gerente encontrado:', managerData.name);
    console.log('Permissões atuais:', managerData.permissions);
    
    // Permissões de menu necessárias para o gerente
    const menuPermissions = [
      'menu:dashboard',
      'menu:clients',
      'menu:proposals',
      'menu:pipeline',
      'menu:teams',
      'menu:settings'
    ];
    
    // Verificar quais permissões de menu estão faltando
    const missingPermissions = menuPermissions.filter(
      permission => !managerData.permissions.includes(permission)
    );
    
    if (missingPermissions.length === 0) {
      console.log('O perfil de gerente já possui todas as permissões de menu necessárias.');
      return;
    }
    
    console.log('Permissões de menu faltando:', missingPermissions);
    
    // Adicionar as permissões faltantes
    const updatedPermissions = [...managerData.permissions, ...missingPermissions];
    
    // Atualizar o documento
    await updateDoc(doc(db, 'roles', managerDoc.id), {
      permissions: updatedPermissions
    });
    
    console.log('Permissões atualizadas com sucesso!');
    console.log('Novas permissões:', updatedPermissions);
    
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
  }
}

// Executar a função
updateManagerPermissions()
  .then(() => {
    console.log('Script concluído.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro ao executar script:', error);
    process.exit(1);
  });
