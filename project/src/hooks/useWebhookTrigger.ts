import { useEffect, useRef } from 'react';
import { collection, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { webhookService } from '../services/WebhookService';
import { useAuth } from '../contexts/AuthContext';

// Interfaces para tipagem
interface ClientData {
  id: string;
  name?: string;
  email?: string;
  type?: string;
  status?: string;
  registrationStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  documents?: Array<{
    type: string;
    number: string;
  }>;
  [key: string]: any; // Para outros campos que possam existir
}

interface ProposalData {
  id: string;
  number?: string;
  clientId?: string;
  clientName?: string;
  bankId?: string;
  bankName?: string;
  bankTradingName?: string;
  status?: string;
  pipelineStatus?: string;
  creditValue?: number;
  propertyValue?: number;
  creditLine?: string;
  creditReason?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any; // Para outros campos que possam existir
}

interface PipelineChangeData {
  proposalId: string;
  proposalNumber?: string;
  clientId?: string;
  clientName?: string;
  previousStatus?: string;
  newStatus?: string;
  changedAt: string;
  changedBy?: {
    id?: string;
    name?: string;
    role?: string;
  };
}

/**
 * Hook para monitorar alterações nas coleções e disparar webhooks
 * Este hook deve ser usado no componente App ou em um componente de alto nível
 * para garantir que os webhooks sejam disparados para todas as alterações
 */
export function useWebhookTrigger() {
  const { user } = useAuth();
  
  // Referência para armazenar o estado anterior das propostas e clientes
  const previousProposalStates = useRef<Map<string, ProposalData>>(new Map());
  const previousClientStates = useRef<Map<string, ClientData>>(new Map());
  
  // Só ativa o monitoramento se o usuário for admin ou manager
  const isAuthorized = user?.role === 'admin' || user?.role === 'manager';
  
  useEffect(() => {
    if (!isAuthorized) return;
    
    console.log('Iniciando monitoramento de webhooks');
    
    // Array para armazenar as funções de cancelamento dos listeners
    const unsubscribes: (() => void)[] = [];
    
    // Monitorar alterações na coleção de clientes
    const clientsUnsubscribe = onSnapshot(
      collection(db, 'clients'),
      async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const clientData: ClientData = {
            id: change.doc.id,
            ...change.doc.data() as Omit<ClientData, 'id'>
          };
          
          // Remover dados sensíveis antes de enviar
          if (clientData.documents) {
            clientData.documents = clientData.documents.map((doc) => ({
              ...doc,
              number: doc.number ? doc.number.replace(/\d/g, '*') : '***'
            }));
          }
          
          if (change.type === 'added') {
            console.log(`Cliente criado: ${clientData.id} - ${clientData.name}`);
            await webhookService.sendClientCreated(clientData);
            // Armazenar o estado atual para comparações futuras
            previousClientStates.current.set(clientData.id, { ...clientData });
          } else if (change.type === 'modified') {
            // Obter o estado anterior
            const previousState = previousClientStates.current.get(clientData.id);
            
            // Verificar se houve mudança no status
            if (previousState && previousState.status !== clientData.status) {
              console.log(`Status do cliente alterado: ${clientData.id} - ${previousState.status} -> ${clientData.status}`);
              await webhookService.sendClientStatusChanged(clientData, previousState.status || '');
            }
            
            // Sempre enviar o evento de atualização
            console.log(`Cliente atualizado: ${clientData.id} - ${clientData.name}`);
            await webhookService.sendClientUpdated(clientData);
            
            // Atualizar o estado armazenado
            previousClientStates.current.set(clientData.id, { ...clientData });
          }
        });
      },
      (error) => {
        console.error('Erro ao monitorar clientes:', error);
      }
    );
    unsubscribes.push(clientsUnsubscribe);
    
    // Monitorar alterações na coleção de propostas
    const proposalsUnsubscribe = onSnapshot(
      collection(db, 'proposals'),
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          const proposalData: ProposalData = {
            id: change.doc.id,
            ...change.doc.data() as Omit<ProposalData, 'id'>
          };
          
          // Buscar dados adicionais do cliente
          if (proposalData.clientId) {
            try {
              const clientDoc = await getDoc(doc(db, 'clients', proposalData.clientId));
              if (clientDoc.exists()) {
                const clientData = clientDoc.data();
                proposalData.clientName = clientData.name;
              }
            } catch (error) {
              console.error('Erro ao buscar dados do cliente:', error);
            }
          }
          
          // Buscar dados adicionais do banco
          if (proposalData.bankId) {
            try {
              const bankDoc = await getDoc(doc(db, 'banks', proposalData.bankId));
              if (bankDoc.exists()) {
                const bankData = bankDoc.data();
                proposalData.bankName = bankData.name;
                proposalData.bankTradingName = bankData.tradingName || '';
              }
            } catch (error) {
              console.error('Erro ao buscar dados do banco:', error);
            }
          }
          
          if (change.type === 'added') {
            console.log(`Proposta criada: ${proposalData.id} - ${proposalData.number}`);
            await webhookService.sendProposalCreated(proposalData);
            // Armazenar o estado atual para comparações futuras
            previousProposalStates.current.set(proposalData.id, { ...proposalData });
          } else if (change.type === 'modified') {
            // Obter o estado anterior
            const previousState = previousProposalStates.current.get(proposalData.id);
            
            if (previousState) {
              // Verificar se houve mudança no status
              if (previousState.status !== proposalData.status) {
                console.log(`Status da proposta alterado: ${proposalData.id} - ${previousState.status} -> ${proposalData.status}`);
                await webhookService.sendProposalStatusChanged(proposalData, previousState.status || '');
              }
              
              // Verificar se houve mudança no status do pipeline
              if (previousState.pipelineStatus !== proposalData.pipelineStatus) {
                console.log(`Status do pipeline alterado: ${proposalData.id} - ${previousState.pipelineStatus} -> ${proposalData.pipelineStatus}`);
                
                const pipelineData: PipelineChangeData = {
                  proposalId: proposalData.id,
                  proposalNumber: proposalData.number,
                  clientId: proposalData.clientId,
                  clientName: proposalData.clientName,
                  previousStatus: previousState.pipelineStatus,
                  newStatus: proposalData.pipelineStatus,
                  changedAt: new Date().toISOString(),
                  changedBy: {
                    id: user?.id,
                    name: user?.name,
                    role: user?.role
                  }
                };
                
                await webhookService.sendPipelineStatusChanged(pipelineData);
              }
            }
            
            // Sempre enviar o evento de atualização da proposta (não do cliente)
            console.log(`Proposta atualizada: ${proposalData.id} - ${proposalData.number}`);
            await webhookService.sendProposalUpdated(proposalData);
            
            // Atualizar o estado armazenado
            previousProposalStates.current.set(proposalData.id, { ...proposalData });
          }
        }
      },
      (error) => {
        console.error('Erro ao monitorar propostas:', error);
      }
    );
    unsubscribes.push(proposalsUnsubscribe);
    
    // Função de limpeza para cancelar todos os listeners
    return () => {
      console.log('Finalizando monitoramento de webhooks');
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [isAuthorized, user]);
}
