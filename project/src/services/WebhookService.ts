import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  secret: string;
  events: {
    clients: {
      created: boolean;
      updated: boolean;
      statusChanged: boolean;
    };
    proposals: {
      created: boolean;
      updated: boolean;
      statusChanged: boolean;
    };
    pipeline: {
      statusChanged: boolean;
    };
  };
  throttle: {
    enabled: boolean;
    interval: number; // em segundos
  };
}

type EventType = 
  | 'client_created' 
  | 'client_updated' 
  | 'client_status_changed'
  | 'proposal_created' 
  | 'proposal_updated' 
  | 'proposal_status_changed'
  | 'pipeline_status_changed';

class WebhookService {
  private configs: WebhookConfig[] = [];
  private lastFetch: number = 0;
  private fetchPromise: Promise<WebhookConfig[]> | null = null;
  private lastEventTimes: Map<string, number> = new Map();

  // Busca todas as configurações de webhook do Firestore
  private async fetchConfigs(): Promise<WebhookConfig[]> {
    try {
      const webhooksRef = collection(db, 'webhooks');
      const querySnapshot = await getDocs(query(webhooksRef));
      
      if (querySnapshot.empty) {
        // Verificar se existe a configuração antiga
        const oldWebhookRef = doc(db, 'settings', 'webhook');
        const oldDocSnap = await getDoc(oldWebhookRef);
        
        if (oldDocSnap.exists()) {
          const oldConfig = oldDocSnap.data() as Omit<WebhookConfig, 'id' | 'name'>;
          return [{
            id: 'default',
            name: 'Webhook Padrão',
            ...oldConfig
          }];
        }
        
        return [];
      }
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WebhookConfig[];
    } catch (error) {
      console.error('Erro ao buscar configurações de webhook:', error);
      return [];
    }
  }

  // Obtém as configurações atuais, com cache de 5 minutos
  private async getConfigs(): Promise<WebhookConfig[]> {
    const now = Date.now();
    
    // Se já temos as configurações em cache e elas foram buscadas há menos de 5 minutos
    if (this.configs.length > 0 && (now - this.lastFetch < 5 * 60 * 1000)) {
      return this.configs;
    }
    
    // Se já existe uma busca em andamento, aguarda ela terminar
    if (this.fetchPromise) {
      return this.fetchPromise;
    }
    
    // Inicia uma nova busca
    this.fetchPromise = this.fetchConfigs();
    
    try {
      this.configs = await this.fetchPromise;
      this.lastFetch = Date.now();
      return this.configs;
    } finally {
      this.fetchPromise = null;
    }
  }

  // Verifica quais webhooks estão habilitados para um tipo de evento
  private async getEnabledWebhooksForEvent(eventType: EventType): Promise<WebhookConfig[]> {
    const configs = await this.getConfigs();
    
    return configs.filter(config => {
      if (!config.enabled || !config.url) {
        return false;
      }
      
      // Verificar se o evento específico está habilitado
      if (eventType === 'client_created') {
        return config.events.clients.created;
      } else if (eventType === 'client_updated') {
        return config.events.clients.updated;
      } else if (eventType === 'client_status_changed') {
        return config.events.clients.statusChanged;
      } else if (eventType === 'proposal_created') {
        return config.events.proposals.created;
      } else if (eventType === 'proposal_updated') {
        return config.events.proposals.updated;
      } else if (eventType === 'proposal_status_changed') {
        return config.events.proposals.statusChanged;
      } else if (eventType === 'pipeline_status_changed') {
        return config.events.pipeline.statusChanged;
      }
      
      return false;
    });
  }

  // Verifica se o evento deve ser throttled (limitado por frequência)
  private shouldThrottle(config: WebhookConfig, eventType: EventType, entityId: string): boolean {
    if (!config.throttle.enabled) {
      return false;
    }
    
    const now = Date.now();
    const eventKey = `${config.id}:${eventType}:${entityId}`;
    const lastTime = this.lastEventTimes.get(eventKey) || 0;
    
    // Se o último evento foi enviado há menos tempo que o intervalo configurado
    if (now - lastTime < config.throttle.interval * 1000) {
      console.log(`Evento ${eventKey} throttled (último envio: ${new Date(lastTime).toISOString()})`);
      return true;
    }
    
    // Atualizar o timestamp do último envio
    this.lastEventTimes.set(eventKey, now);
    return false;
  }

  // Envia dados para um webhook específico
  private async sendToWebhook(config: WebhookConfig, eventType: EventType, data: any, entityId: string): Promise<boolean> {
    // Verifica se o evento deve ser throttled
    if (this.shouldThrottle(config, eventType, entityId)) {
      return false;
    }
    
    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data
    };
    
    try {
      console.log(`Enviando webhook ${config.name} (${config.id}) para ${config.url}:`, eventType);
      
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': config.secret
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error(`Erro ao enviar webhook ${config.id}: ${response.status} - ${response.statusText}`);
        return false;
      }
      
      console.log(`Webhook ${config.id} enviado com sucesso: ${eventType}`);
      return true;
    } catch (error) {
      console.error(`Erro ao enviar webhook ${config.id}:`, error);
      return false;
    }
  }

  // Envia dados para todos os webhooks habilitados
  public async send(eventType: EventType, data: any, entityId: string): Promise<boolean> {
    // Obtém todos os webhooks habilitados para este tipo de evento
    const enabledWebhooks = await this.getEnabledWebhooksForEvent(eventType);
    
    if (enabledWebhooks.length === 0) {
      console.log(`Nenhum webhook habilitado para o evento: ${eventType}`);
      return false;
    }
    
    // Envia para todos os webhooks habilitados
    const results = await Promise.all(
      enabledWebhooks.map(config => this.sendToWebhook(config, eventType, data, entityId))
    );
    
    // Retorna true se pelo menos um webhook foi enviado com sucesso
    return results.some(result => result === true);
  }

  // Métodos específicos para cada tipo de evento
  public async sendClientCreated(clientData: any): Promise<boolean> {
    return this.send('client_created', clientData, clientData.id);
  }
  
  public async sendClientUpdated(clientData: any): Promise<boolean> {
    return this.send('client_updated', clientData, clientData.id);
  }
  
  public async sendClientStatusChanged(clientData: any, previousStatus: string): Promise<boolean> {
    const data = {
      ...clientData,
      previousStatus,
      newStatus: clientData.status
    };
    return this.send('client_status_changed', data, clientData.id);
  }
  
  public async sendProposalCreated(proposalData: any): Promise<boolean> {
    return this.send('proposal_created', proposalData, proposalData.id);
  }
  
  public async sendProposalUpdated(proposalData: any): Promise<boolean> {
    return this.send('proposal_updated', proposalData, proposalData.id);
  }
  
  public async sendProposalStatusChanged(proposalData: any, previousStatus: string): Promise<boolean> {
    const data = {
      ...proposalData,
      previousStatus,
      newStatus: proposalData.status
    };
    return this.send('proposal_status_changed', data, proposalData.id);
  }
  
  public async sendPipelineStatusChanged(pipelineData: any): Promise<boolean> {
    return this.send('pipeline_status_changed', pipelineData, pipelineData.proposalId);
  }
}

// Exporta uma instância única do serviço
export const webhookService = new WebhookService();
