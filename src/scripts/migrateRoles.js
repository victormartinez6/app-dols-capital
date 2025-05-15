// Script para migrar os perfis existentes para o novo formato
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { createDefaultMenus, createDefaultPages } from '../hooks/useRolePermissions';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mapeamento de permissões antigas para novas
const permissionToMenuMap = {
  'menu:dashboard': { menu: 'dashboard' },
  'menu:clients': { menu: 'clients' },
  'menu:proposals': { menu: 'proposals' },
  'menu:pipeline': { menu: 'pipeline' },
  'menu:teams': { menu: 'teams' },
  'menu:roles': { menu: 'roles' },
  'menu:users': { menu: 'users' },
  'menu:settings': { menu: 'settings' },
  'menu:webhooks': { menu: 'webhooks' },
  'menu:my_registration': { menu: 'myRegistration' }
};

const permissionToPageMap = {
  // Dashboard
  'view:dashboard': { page: 'dashboard', action: 'view' },
  'view:own_dashboard': { page: 'dashboard', scope: 'own' },
  'view:team_dashboard': { page: 'dashboard', scope: 'team' },
  'view:all_dashboard': { page: 'dashboard', scope: 'all' },
  
  // Clientes
  'view:clients': { page: 'clients', action: 'view' },
  'view:own_clients': { page: 'clients', scope: 'own' },
  'view:team_clients': { page: 'clients', scope: 'team' },
  'view:all_clients': { page: 'clients', scope: 'all' },
  'edit:clients': { page: 'clients', action: 'edit' },
  'delete:clients': { page: 'clients', action: 'delete' },
  
  // Propostas
  'view:proposals': { page: 'proposals', action: 'view' },
  'view:own_proposals': { page: 'proposals', scope: 'own' },
  'view:team_proposals': { page: 'proposals', scope: 'team' },
  'view:all_proposals': { page: 'proposals', scope: 'all' },
  'edit:proposals': { page: 'proposals', action: 'edit' },
  'approve:proposals': { page: 'proposals', action: 'approve' },
  'reject:proposals': { page: 'proposals', action: 'reject' },
  'delete:proposals': { page: 'proposals', action: 'delete' },
  
  // Pipeline
  'view:pipeline': { page: 'pipeline', action: 'view' },
  'view:own_pipeline': { page: 'pipeline', scope: 'own' },
  'view:team_pipeline': { page: 'pipeline', scope: 'team' },
  'view:all_pipeline': { page: 'pipeline', scope: 'all' },
  'edit:pipeline': { page: 'pipeline', action: 'dragDrop' },
  
  // Usuários
  'view:users': { page: 'users', action: 'view' },
  'edit:users': { page: 'users', action: 'edit' },
  'delete:users': { page: 'users', action: 'delete' },
  
  // Configurações
  'view:settings': { page: 'settings', action: 'view' },
  'edit:settings': { page: 'settings', action: 'edit' },
  
  // Webhooks
  'view:webhooks': { page: 'webhooks', action: 'view' },
  'edit:webhooks': { page: 'webhooks', action: 'edit' },
  
  // Meu cadastro
  'view:my_registration': { page: 'myRegistration', action: 'view' },
  'view:profile': { page: 'myRegistration', action: 'view' },
  'edit:profile': { page: 'myRegistration', action: 'edit' },
  
  // Equipes
  'view:teams': { page: 'teams', action: 'view' },
  'edit:teams': { page: 'teams', action: 'edit' },
  'delete:teams': { page: 'teams', action: 'delete' },
  
  // Perfis
  'view:roles': { page: 'roles', action: 'view' },
  'edit:roles': { page: 'roles', action: 'edit' },
  'delete:roles': { page: 'roles', action: 'delete' }
};

// Função para converter permissões antigas para o novo formato
function convertPermissions(oldPermissions) {
  const menus = createDefaultMenus();
  const pages = createDefaultPages();
  
  // Processar cada permissão antiga
  oldPermissions.forEach(permission => {
    // Processar permissões de menu
    if (permissionToMenuMap[permission]) {
      const { menu } = permissionToMenuMap[permission];
      menus[menu] = true;
    }
    
    // Processar permissões de página
    if (permissionToPageMap[permission]) {
      const { page, action, scope } = permissionToPageMap[permission];
      
      // Garantir que a página existe
      if (pages[page]) {
        // Definir a ação como true
        if (action) {
          pages[page][action] = true;
          
          // Se a ação for 'view', também habilitar o menu correspondente
          if (action === 'view') {
            const menuKey = page === 'myRegistration' ? 'myRegistration' : page;
            menus[menuKey] = true;
          }
        }
        
        // Definir o escopo se fornecido
        if (scope) {
          pages[page].scope = scope;
        }
      }
    }
  });
  
  return { menus, pages };
}

// Função principal para migrar os perfis
async function migrateRoles() {
  try {
    console.log('Iniciando migração de perfis...');
    
    // Buscar todos os perfis
    const rolesCollection = collection(db, 'roles');
    const rolesSnapshot = await getDocs(rolesCollection);
    
    if (rolesSnapshot.empty) {
      console.log('Nenhum perfil encontrado para migrar.');
      return;
    }
    
    console.log(`Encontrados ${rolesSnapshot.size} perfis para migrar.`);
    
    // Processar cada perfil
    for (const roleDoc of rolesSnapshot.docs) {
      const roleData = roleDoc.data();
      const roleId = roleDoc.id;
      
      console.log(`Migrando perfil: ${roleData.name} (${roleData.key})`);
      
      // Verificar se já tem o novo formato
      if (roleData.menus && roleData.pages) {
        console.log(`Perfil ${roleData.name} já está no novo formato. Pulando...`);
        continue;
      }
      
      // Converter permissões antigas para o novo formato
      const { menus, pages } = convertPermissions(roleData.permissions || []);
      
      // Atualizar o documento com o novo formato
      await updateDoc(doc(db, 'roles', roleId), {
        menus,
        pages,
        updatedAt: new Date()
      });
      
      console.log(`Perfil ${roleData.name} migrado com sucesso.`);
    }
    
    console.log('Migração de perfis concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao migrar perfis:', error);
  }
}

// Executar a migração
migrateRoles().then(() => {
  console.log('Script de migração finalizado.');
  process.exit(0);
}).catch(error => {
  console.error('Erro no script de migração:', error);
  process.exit(1);
});
