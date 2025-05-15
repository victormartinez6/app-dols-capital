const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

// Definições de permissões por perfil
const rolePermissionsDefinitions = {
  admin: [
    // Dashboard
    'view:dashboard', 'view:own_dashboard', 'view:team_dashboard', 'view:all_dashboard',
    // Clientes
    'view:clients', 'view:own_clients', 'view:team_clients', 'view:all_clients',
    'edit:clients', 'delete:clients',
    // Propostas
    'view:proposals', 'view:own_proposals', 'view:team_proposals', 'view:all_proposals',
    'edit:proposals', 'approve:proposals', 'reject:proposals', 'delete:proposals',
    // Pipeline
    'view:pipeline', 'view:own_pipeline', 'view:team_pipeline', 'view:all_pipeline',
    'edit:pipeline',
    // Usuários
    'view:users', 'edit:users', 'delete:users',
    // Configurações
    'view:settings', 'edit:settings',
    // Webhooks
    'view:webhooks', 'edit:webhooks',
    // Perfil
    'view:profile', 'edit:profile',
    // Equipes
    'view:teams', 'edit:teams', 'delete:teams',
    // Perfis
    'view:roles', 'edit:roles', 'delete:roles',
    // Itens de menu
    'menu:dashboard', 'menu:clients', 'menu:proposals', 'menu:pipeline',
    'menu:teams', 'menu:roles', 'menu:users', 'menu:settings', 'menu:webhooks'
  ],
  manager: [
    // Dashboard
    'view:dashboard', 'view:own_dashboard', 'view:team_dashboard',
    // Clientes
    'view:clients', 'view:own_clients', 'view:team_clients',
    'edit:clients',
    // Propostas
    'view:proposals', 'view:own_proposals', 'view:team_proposals',
    'edit:proposals', 'approve:proposals', 'reject:proposals',
    // Pipeline
    'view:pipeline', 'view:own_pipeline', 'view:team_pipeline',
    'edit:pipeline',
    // Configurações
    'view:settings', 'edit:settings',
    // Perfil
    'view:profile', 'edit:profile',
    // Equipes
    'view:teams', 'edit:teams',
    // Itens de menu
    'menu:dashboard', 'menu:clients', 'menu:proposals', 'menu:pipeline',
    'menu:teams', 'menu:settings'
  ],
  client: [
    // Dashboard
    'view:dashboard', 'view:own_dashboard',
    // Clientes
    'view:own_clients',
    // Propostas
    'view:proposals', 'view:own_proposals',
    // Meu cadastro
    'view:my_registration',
    // Perfil
    'view:profile', 'edit:profile',
    // Itens de menu
    'menu:dashboard', 'menu:proposals', 'menu:my_registration'
  ]
};

async function syncRolePermissions() {
  try {
    console.log('Buscando todos os perfis...');
    
    // Buscar todos os perfis
    const rolesCollection = collection(db, 'roles');
    const querySnapshot = await getDocs(rolesCollection);
    
    if (querySnapshot.empty) {
      console.error('Nenhum perfil encontrado!');
      return;
    }
    
    // Processar cada perfil
    const updatePromises = [];
    
    querySnapshot.forEach(roleDoc => {
      const roleData = roleDoc.data();
      const roleKey = roleData.key;
      
      // Verificar se temos definições para este perfil
      if (!roleKey || !rolePermissionsDefinitions[roleKey]) {
        console.log(`Perfil "${roleKey}" não tem definições de permissões, pulando...`);
        return;
      }
      
      console.log(`\nProcessando perfil: ${roleData.name} (${roleKey})`);
      console.log('Permissões atuais:', roleData.permissions || []);
      
      // Obter as permissões definidas para este perfil
      const definedPermissions = rolePermissionsDefinitions[roleKey];
      
      // Verificar diferenças
      const currentPermissions = roleData.permissions || [];
      const missingPermissions = definedPermissions.filter(
        permission => !currentPermissions.includes(permission)
      );
      const extraPermissions = currentPermissions.filter(
        permission => !definedPermissions.includes(permission)
      );
      
      if (missingPermissions.length === 0 && extraPermissions.length === 0) {
        console.log(`O perfil ${roleData.name} já está com as permissões corretas.`);
        return;
      }
      
      if (missingPermissions.length > 0) {
        console.log('Permissões faltando:', missingPermissions);
      }
      
      if (extraPermissions.length > 0) {
        console.log('Permissões extras:', extraPermissions);
      }
      
      // Atualizar o documento com as permissões definidas
      const updatePromise = updateDoc(doc(db, 'roles', roleDoc.id), {
        permissions: definedPermissions
      }).then(() => {
        console.log(`Permissões do perfil ${roleData.name} atualizadas com sucesso!`);
      });
      
      updatePromises.push(updatePromise);
    });
    
    // Aguardar todas as atualizações
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log('\nTodas as permissões foram sincronizadas com sucesso!');
    } else {
      console.log('\nNenhuma atualização necessária.');
    }
    
  } catch (error) {
    console.error('Erro ao sincronizar permissões:', error);
  }
}

// Executar a função
syncRolePermissions()
  .then(() => {
    console.log('Script concluído.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro ao executar script:', error);
    process.exit(1);
  });
