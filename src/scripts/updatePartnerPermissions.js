// Script para atualizar as permissões do perfil "Parceiro" no Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');

// Configuração do Firebase (substitua pelos seus valores reais)
const firebaseConfig = {
  // Sua configuração do Firebase aqui
  // Você pode copiar isso do seu arquivo firebase.js ou .env
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updatePartnerPermissions() {
  try {
    // ID do documento do perfil "Parceiro" no Firestore
    // Este é o ID que você mencionou nos logs: 'j2JbNS2bM1ouzG6hh8hH'
    const roleId = 'j2JbNS2bM1ouzG6hh8hH';
    
    // Referência ao documento do perfil
    const roleRef = doc(db, 'roles', roleId);
    
    // Obter o documento atual
    const roleDoc = await getDoc(roleRef);
    
    if (!roleDoc.exists()) {
      console.error('Perfil "Parceiro" não encontrado!');
      return;
    }
    
    // Dados atuais do perfil
    const roleData = roleDoc.data();
    console.log('Permissões atuais:', roleData.permissions);
    
    // Novas permissões de menu a serem adicionadas
    const menuPermissions = [
      'menu:dashboard',
      'menu:clients',
      'menu:proposals',
      'menu:pipeline'
    ];
    
    // Combinar permissões existentes com as novas permissões de menu
    const updatedPermissions = [
      ...new Set([
        ...(roleData.permissions || []),
        ...menuPermissions
      ])
    ];
    
    console.log('Permissões atualizadas:', updatedPermissions);
    
    // Atualizar o documento no Firestore
    await updateDoc(roleRef, {
      permissions: updatedPermissions
    });
    
    console.log('Permissões do perfil "Parceiro" atualizadas com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
  }
}

// Executar a função
updatePartnerPermissions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro:', error);
    process.exit(1);
  });
