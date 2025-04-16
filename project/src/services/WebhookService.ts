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
    // Nunca limitar eventos de mudança de status do pipeline
    if (eventType === 'pipeline_status_changed') {
      return false;
    }
    
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

  // Função utilitária para garantir todos os campos de contato no payload
  private withContactFields(data: any): any {
    return {
      ...data,
      clientEmail: data.clientEmail || data.email || '',
      clientPhone: data.clientPhone || data.phone || '',
      ddi: data.ddi || '',
      partnerEmail: data.partnerEmail || '',
      phone: data.phone || '',
    };
  }

  // Métodos específicos para cada tipo de evento
  public async sendClientCreated(clientData: any): Promise<boolean> {
    const contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(clientData.id, clientData.type));
    const data = this.withContactFields({
      ...clientData,
      ...(contactInfo || {}),
      oldStatus: null, // Cliente novo não tem status anterior
      newStatus: statusLabels.client[clientData.status] || clientData.status,
      userEmail: clientData.userEmail || ''
    });
    this.logContactFields(data, 'sendClientCreated');
    return this.send('client_created', data, clientData.id);
  }
  
  public async sendClientUpdated(clientData: any): Promise<boolean> {
    const contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(clientData.id, clientData.type));
    const data = this.withContactFields({
      ...clientData,
      ...(contactInfo || {}),
      oldStatus: statusLabels.client[clientData.previousStatus] || clientData.previousStatus || clientData.status,
      newStatus: statusLabels.client[clientData.status] || clientData.status,
      userEmail: clientData.userEmail || ''
    });
    delete data.previousStatus;
    this.logContactFields(data, 'sendClientUpdated');
    return this.send('client_updated', data, clientData.id);
  }
  
  public async sendClientStatusChanged(clientData: any, previousStatus: string): Promise<boolean> {
    const contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(clientData.id, clientData.type));
    const data = this.withContactFields({
      ...clientData,
      ...(contactInfo || {}),
      oldStatus: statusLabels.client[previousStatus] || previousStatus,
      newStatus: statusLabels.client[clientData.status] || clientData.status,
      userEmail: clientData.userEmail || ''
    });
    delete data.previousStatus;
    this.logContactFields(data, 'sendClientStatusChanged');
    return this.send('client_status_changed', data, clientData.id);
  }
  
  public async sendProposalCreated(proposalData: any): Promise<boolean> {
    const contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(proposalData.clientId, proposalData.clientType));
    const data = this.withContactFields({
      ...proposalData,
      ...(contactInfo || {}),
      oldStatus: null,
      newStatus: statusLabels.proposal[proposalData.status] || proposalData.status,
      pipelineStatus: statusLabels.pipeline[proposalData.pipelineStatus] || proposalData.pipelineStatus,
      userEmail: proposalData.userEmail || ''
    });
    this.logContactFields(data, 'sendProposalCreated');
    return this.send('proposal_created', data, proposalData.id);
  }

  public async sendProposalUpdated(proposalData: any): Promise<boolean> {
    const contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(proposalData.clientId, proposalData.clientType));
    const data = this.withContactFields({
      ...proposalData,
      ...(contactInfo || {}),
      oldStatus: statusLabels.proposal[proposalData.previousStatus] || proposalData.previousStatus || proposalData.status,
      newStatus: statusLabels.proposal[proposalData.status] || proposalData.status,
      pipelineStatus: statusLabels.pipeline[proposalData.pipelineStatus] || proposalData.pipelineStatus,
      userEmail: proposalData.userEmail || ''
    });
    delete data.previousStatus;
    this.logContactFields(data, 'sendProposalUpdated');
    return this.send('proposal_updated', data, proposalData.id);
  }

  public async sendProposalStatusChanged(proposalData: any, previousStatus: string): Promise<boolean> {
    // Sempre montar info de pendência, mesmo se não houver
    let pendencyInfo = {
      pendencyText: '',
      pendencyDate: '',
      pendencyCreatedBy: ''
    };
    // Sempre buscar a última pendência, independente do status anterior
    if (proposalData.lastPendency) {
      const last = proposalData.lastPendency;
      pendencyInfo = {
        pendencyText: last.text ?? '',
        pendencyDate: last.createdAt ?? new Date().toISOString(),
        pendencyCreatedBy: last.createdBy ?? ''
      };
    } else if (proposalData.pendencyText) {
      pendencyInfo = {
        pendencyText: proposalData.pendencyText ?? '',
        pendencyDate: proposalData.pendencyDate ?? new Date().toISOString(),
        pendencyCreatedBy: proposalData.pendencyCreatedBy ?? ''
      };
    }
    // Diagnóstico: logar os dados antes da busca de contato
    console.log('[sendProposalStatusChanged] Dados recebidos:', {
      clientId: proposalData.clientId,
      clientType: proposalData.clientType,
      proposalData
    });
    // Garantir campos obrigatórios
    const clientId = proposalData.clientId ?? '';
    let clientType = proposalData.clientType ?? '';
    if (!clientId) {
      console.error('[sendProposalStatusChanged] ERRO: clientId ausente no payload!', proposalData);
      return false;
    }
    if (!clientType) {
      console.warn('[sendProposalStatusChanged] AVISO: clientType ausente, usando "PF" como padrão');
      clientType = 'PF';
    }
    let contactInfo = {};
    try {
      contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(clientId, clientType));
      console.log('[sendProposalStatusChanged] Dados de contato obtidos:', contactInfo);
    } catch (err) {
      console.error('[sendProposalStatusChanged] Erro ao buscar dados de contato:', err);
    }
    // Unificar todos os campos relevantes, preenchendo com '' se ausente
    const data = this.withContactFields({
      id: proposalData.id ?? '',
      number: proposalData.number ?? '',
      clientId: clientId,
      clientType: clientType,
      clientName: proposalData.clientName ?? '',
      bankId: proposalData.bankId ?? '',
      bankName: proposalData.bankName ?? '',
      bankTradingName: proposalData.bankTradingName ?? '',
      status: proposalData.status ?? '',
      pipelineStatus: proposalData.pipelineStatus ?? '',
      creditValue: proposalData.creditValue ?? '',
      propertyValue: proposalData.propertyValue ?? '',
      creditLine: proposalData.creditLine ?? '',
      creditReason: proposalData.creditReason ?? '',
      createdAt: proposalData.createdAt ?? '',
      updatedAt: proposalData.updatedAt ?? '',
      userEmail: proposalData.userEmail ?? '',
      oldStatus: (typeof previousStatus !== 'undefined' ? (statusLabels.proposal?.[previousStatus] ?? previousStatus ?? '') : ''),
      newStatus: (typeof proposalData.status !== 'undefined' ? (statusLabels.proposal?.[proposalData.status] ?? proposalData.status ?? '') : ''),
      // Padroniza o campo do texto da pendência SEMPRE como pendencyText
      pendencyText: pendencyInfo.pendencyText ?? '',
      pendencyDate: pendencyInfo.pendencyDate ?? '',
      pendencyCreatedBy: pendencyInfo.pendencyCreatedBy ?? '',
      ...(contactInfo || {})
    });
    // Garantir que todos os campos de contato estejam presentes como string
    data.clientEmail = data.clientEmail ?? '';
    data.clientPhone = data.clientPhone ?? '';
    data.ddi = data.ddi ?? '';
    data.partnerEmail = data.partnerEmail ?? '';
    data.phone = data.phone ?? '';
    // Remover campos não desejados e garantir que arrays/collections de pendências não sejam enviados
    delete data.previousStatus;
    delete data.pendencies;
    delete data.lastPendency;
    delete data.observationsTimeline;
    delete data.observations;
    delete data.pendency;
    this.logContactFields(data, 'sendProposalStatusChanged');
    // Diagnóstico: logar o payload final
    console.log('[sendProposalStatusChanged] Payload final:', data);
    try {
      return await this.send('proposal_status_changed', data, proposalData.id ?? '');
    } catch (sendErr) {
      console.error('[sendProposalStatusChanged] Erro ao enviar webhook:', sendErr);
      return false;
    }
  }
  
  public async sendPipelineStatusChanged(pipelineData: any): Promise<boolean> {
    console.log('WebhookService - Dados recebidos:', pipelineData);
    
    // Garantir que temos um clientId válido
    if (!pipelineData.clientId) {
      console.warn('WebhookService - clientId não encontrado no pipelineData:', pipelineData);
      // Se não tiver clientId, tenta buscar da proposta
      if (pipelineData.proposalId) {
        try {
          const proposalDoc = await getDoc(doc(db, 'proposals', pipelineData.proposalId));
          if (proposalDoc.exists()) {
            const proposalData = proposalDoc.data();
            pipelineData.clientId = proposalData.clientId || '';
            // Aproveita para pegar o email do usuário que criou a proposta
            if (proposalData.userEmail && !pipelineData.userEmail) {
              pipelineData.userEmail = proposalData.userEmail;
            }
            console.log('WebhookService - clientId recuperado da proposta:', pipelineData.clientId);
          }
        } catch (error) {
          console.error('WebhookService - Erro ao buscar proposta:', error);
        }
      }
    }
    
    // Se ainda não tiver userEmail, tenta buscar do cliente
    if (!pipelineData.userEmail && pipelineData.clientId) {
      try {
        // Tenta buscar em registrations primeiro
        let clientDoc = await getDoc(doc(db, 'registrations', pipelineData.clientId));
        if (clientDoc.exists()) {
          const clientData = clientDoc.data();
          if (clientData.userId) {
            // Se tiver userId, busca o email do usuário
            const userDoc = await getDoc(doc(db, 'users', clientData.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              pipelineData.userEmail = userData.email || '';
            }
          }
        }
        // Se não encontrou em registrations, tenta em clients
        if (!pipelineData.userEmail) {
          clientDoc = await getDoc(doc(db, 'clients', pipelineData.clientId));
          if (clientDoc.exists()) {
            const clientData = clientDoc.data();
            if (clientData.userId) {
              const userDoc = await getDoc(doc(db, 'users', clientData.userId));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                pipelineData.userEmail = userData.email || '';
              }
            }
          }
        }
      } catch (error) {
        console.error('WebhookService - Erro ao buscar email do usuário:', error);
      }
    }
    
    // Busca dados de contato com fallback para proposalData
    const contactInfo = await import('./getClientContactInfo').then(m => m.getClientContactInfo(pipelineData.clientId, pipelineData.clientType, pipelineData));
    // Construir um objeto simples com os campos básicos
    // IMPORTANTE: contactInfo por último, para sobrescrever pipelineData
    const data: any = {
      ...(pipelineData || {}),
      ...(contactInfo || {}),
      id: pipelineData.id || '',
      proposalId: pipelineData.proposalId || pipelineData.id || '',
      previousStatus: pipelineData.previousStatus || '',
      newStatus: pipelineData.newStatus || pipelineData.pipelineStatus || '',
      oldPipelineStatus: statusLabels.pipeline[pipelineData.previousStatus] || pipelineData.previousStatus || '',
      newPipelineStatus: statusLabels.pipeline[pipelineData.newStatus || pipelineData.pipelineStatus] || pipelineData.newStatus || pipelineData.pipelineStatus || '',
      clientName: pipelineData.clientName || '',
      clientType: pipelineData.clientType || '',
      userEmail: pipelineData.userEmail || ''
    };
    // Garantir que todos os campos de contato estejam presentes como string
    data.clientEmail = data.clientEmail ?? '';
    data.clientPhone = data.clientPhone ?? '';
    data.ddi = data.ddi ?? '';
    data.partnerEmail = data.partnerEmail ?? '';
    data.phone = data.phone ?? '';
    this.logContactFields(data, 'sendPipelineStatusChanged');
    console.log('WebhookService - Dados formatados para envio:', data);
    return this.send('pipeline_status_changed', data, pipelineData.id || pipelineData.proposalId || '');
  }
  
  // Adiciona método utilitário para logar campos de contato ausentes
  private logContactFields(data: any, method: string) {
    const missing = [];
    if (!data.clientEmail) missing.push('clientEmail');
    if (!data.clientPhone) missing.push('clientPhone');
    if (!data.ddi) missing.push('ddi');
    if (!data.partnerEmail) missing.push('partnerEmail');
    if (!data.phone) missing.push('phone');
    if (missing.length > 0) {
      console.warn(`[${method}] Campos de contato ausentes:`, missing.join(', '), data);
    }
  }
}

// Mapeamento de status técnicos para labels em português
export const statusLabels: {
  client: { [key: string]: string };
  proposal: { [key: string]: string };
  pipeline: { [key: string]: string };
} = {
  // Status de Cliente
  client: {
    complete: 'Completo',
    documents_pending: 'Documentos Pendentes'
  },
  // Status de Proposta
  proposal: {
    pending: 'Pendente',
    approved: 'Aprovada',
    rejected: 'Rejeitada',
    in_analysis: 'Em Análise',
    with_pendencies: 'Com Pendências'
  },
  // Status de Pipeline
  pipeline: {
    submitted: 'Cadastro Enviado',
    pre_analysis: 'Pré-Análise',
    credit: 'Crédito',
    legal: 'Jurídico/Imóvel',
    contract: 'Em Contrato',
    closed: 'Negócio Fechado',
    lost: 'Perdido'
  }
};

// Exporta uma instância única do serviço
export const webhookService = new WebhookService();
