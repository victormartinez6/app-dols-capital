import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function getClientContactInfo(clientId: string, clientType: 'PF' | 'PJ', proposalData?: any) {
  console.log('DEBUG - Tipo recebido:', clientType);
  if (!clientId || !clientType) {
    console.warn('getClientContactInfo: clientId ou clientType indefinido!', { clientId, clientType });
    return {
      clientEmail: '',
      clientPhone: '',
      ddi: '',
      partnerEmail: '',
      phone: ''
    };
  }
  
  // Função auxiliar para buscar campo independente de maiúsculas/minúsculas
  const getFieldCaseInsensitive = (obj: any, fieldName: string): string => {
    if (!obj) return '';
    // Busca exata primeiro
    if (obj[fieldName] !== undefined) return obj[fieldName];
    // Busca case-insensitive
    const lowerFieldName = fieldName.toLowerCase();
    const keys = Object.keys(obj);
    for (const key of keys) {
      if (key.toLowerCase() === lowerFieldName) {
        return obj[key];
      }
    }
    return '';
  };
  
  // Primeiro tenta buscar na 'registrations'
  let clientDoc = await getDoc(doc(db, 'registrations', clientId));
  let client = clientDoc.exists() ? clientDoc.data() : null;
  if (client) {
    console.log('DEBUG - Dados do cliente em registrations:', client);
  }
  // Se não encontrar, tenta buscar na 'clients'
  if (!client) {
    clientDoc = await getDoc(doc(db, 'clients', clientId));
    client = clientDoc.exists() ? clientDoc.data() : null;
    console.log('DEBUG - Dados do cliente em clients:', client);
  }
  
  if (client) {
    console.log('DEBUG - Dados brutos do cliente:', client);
    // Busca todos os campos possíveis, independente de maiúsculas/minúsculas
    return {
      clientEmail: getFieldCaseInsensitive(client, 'email') || getFieldCaseInsensitive(client, 'partnerEmail') || '',
      clientPhone: getFieldCaseInsensitive(client, 'phone') || '',
      ddi: getFieldCaseInsensitive(client, 'ddi') || '',
      partnerEmail: getFieldCaseInsensitive(client, 'partnerEmail') || getFieldCaseInsensitive(client, 'email') || '',
      phone: getFieldCaseInsensitive(client, 'phone') || ''
    };
  }
  
  // Fallback: buscar direto em proposalData se enviado
  if (proposalData) {
    console.log('DEBUG - Fallback para proposalData:', proposalData);
    return {
      clientEmail: getFieldCaseInsensitive(proposalData, 'clientEmail') || getFieldCaseInsensitive(proposalData, 'email') || '',
      clientPhone: getFieldCaseInsensitive(proposalData, 'clientPhone') || getFieldCaseInsensitive(proposalData, 'phone') || '',
      ddi: getFieldCaseInsensitive(proposalData, 'ddi') || '',
      partnerEmail: getFieldCaseInsensitive(proposalData, 'partnerEmail') || getFieldCaseInsensitive(proposalData, 'email') || '',
      phone: getFieldCaseInsensitive(proposalData, 'phone') || ''
    };
  }
  
  // Garante retorno padronizado mesmo se não encontrar nada
  return {
    clientEmail: '',
    clientPhone: '',
    ddi: '',
    partnerEmail: '',
    phone: ''
  };
}
