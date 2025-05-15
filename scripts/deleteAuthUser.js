const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de credenciais do Firebase Admin SDK
// Você precisará criar este arquivo com as credenciais da conta de serviço
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Verificar se o arquivo de credenciais existe
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Arquivo de credenciais não encontrado:', serviceAccountPath);
  console.log('Você precisa baixar o arquivo de credenciais da conta de serviço do Firebase Admin SDK');
  console.log('1. Acesse https://console.firebase.google.com/project/dols-capital-app/settings/serviceaccounts/adminsdk');
  console.log('2. Clique em "Gerar nova chave privada"');
  console.log('3. Salve o arquivo como "serviceAccountKey.json" na pasta "scripts"');
  process.exit(1);
}

// Inicializar o Firebase Admin SDK
try {
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase Admin SDK inicializado com sucesso');
} catch (error) {
  console.error('Erro ao inicializar o Firebase Admin SDK:', error);
  process.exit(1);
}

// Função para excluir um usuário do Firebase Authentication
async function deleteAuthUser(uid) {
  try {
    await admin.auth().deleteUser(uid);
    console.log(`Usuário ${uid} excluído com sucesso do Firebase Authentication`);
    return true;
  } catch (error) {
    console.error(`Erro ao excluir usuário ${uid}:`, error);
    return false;
  }
}

// Função principal
async function main() {
  // Obter o UID do usuário a ser excluído dos argumentos da linha de comando
  const uid = process.argv[2];
  
  if (!uid) {
    console.error('UID do usuário não fornecido');
    console.log('Uso: node deleteAuthUser.js <uid>');
    process.exit(1);
  }
  
  const success = await deleteAuthUser(uid);
  
  if (success) {
    console.log('Operação concluída com sucesso');
    process.exit(0);
  } else {
    console.error('Falha na operação');
    process.exit(1);
  }
}

// Executar a função principal
main();
