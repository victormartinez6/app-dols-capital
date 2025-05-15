import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc, addDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

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

const defaultConfig: Omit<WebhookConfig, 'id'> = {
  name: '',
  url: '',
  enabled: false,
  secret: '',
  events: {
    clients: {
      created: true,
      updated: false,
      statusChanged: true
    },
    proposals: {
      created: true,
      updated: false,
      statusChanged: true
    },
    pipeline: {
      statusChanged: true
    }
  },
  throttle: {
    enabled: true,
    interval: 300 // 5 minutos
  }
};

export default function Webhooks() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [currentWebhook, setCurrentWebhook] = useState<WebhookConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{success?: boolean; message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Verifica se o usuário é admin
  if (user?.roleKey !== 'admin') {
    return (
      <div className="p-6 bg-black rounded-lg shadow">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
          Acesso Restrito
        </h2>
        <p className="mt-2">Esta página é restrita a administradores.</p>
      </div>
    );
  }

  useEffect(() => {
    // Carrega a configuração inicial
    const loadWebhooks = async () => {
      try {
        setIsLoading(true);
        
        // Verificar se existe a configuração antiga
        const oldWebhookRef = doc(db, 'settings', 'webhook');
        const oldDocSnap = await getDoc(oldWebhookRef);
        
        if (oldDocSnap.exists()) {
          const oldData = oldDocSnap.data();
          
          // Migrar a configuração antiga para o novo formato
          const webhooksRef = collection(db, 'webhooks');
          await addDoc(webhooksRef, {
            name: 'Webhook Padrão',
            url: oldData.url || '',
            enabled: oldData.enabled || false,
            secret: oldData.secret || '',
            events: {
              clients: {
                created: oldData.events?.clients?.created ?? true,
                updated: oldData.events?.clients?.updated ?? false,
                statusChanged: oldData.events?.clients?.statusChanged ?? true
              },
              proposals: {
                created: oldData.events?.proposals?.created ?? true,
                updated: oldData.events?.proposals?.updated ?? false,
                statusChanged: oldData.events?.proposals?.statusChanged ?? true
              },
              pipeline: {
                statusChanged: oldData.events?.pipeline?.statusChanged ?? true
              }
            },
            throttle: {
              enabled: oldData.throttle?.enabled ?? true,
              interval: oldData.throttle?.interval ?? 300
            }
          });
          
          // Remover a configuração antiga
          await deleteDoc(oldWebhookRef);
        }
        
        // Configurar o listener para atualizações em tempo real
        const webhooksRef = collection(db, 'webhooks');
        const unsubscribe = onSnapshot(query(webhooksRef), (snapshot) => {
          const webhookList: WebhookConfig[] = [];
          snapshot.forEach((doc) => {
            webhookList.push({
              id: doc.id,
              ...doc.data()
            } as WebhookConfig);
          });
          setWebhooks(webhookList);
          setIsLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Erro ao carregar configurações de webhook:', error);
        alert('Erro ao carregar configurações');
        setIsLoading(false);
        return () => {};
      }
    };
    
    const unsubscribe = loadWebhooks();
    return () => {
      unsubscribe.then(unsub => unsub());
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentWebhook) return;
    
    const { name, value, type, checked } = e.target;
    
    // Lidar com campos aninhados
    if (name.includes('.')) {
      const parts = name.split('.');
      
      if (parts.length === 2) {
        // Exemplo: throttle.enabled
        setCurrentWebhook({
          ...currentWebhook,
          [parts[0]]: {
            ...currentWebhook[parts[0] as keyof WebhookConfig],
            [parts[1]]: type === 'checkbox' ? checked : value
          }
        });
      } else if (parts.length === 3) {
        // Exemplo: events.clients.created
        setCurrentWebhook({
          ...currentWebhook,
          [parts[0]]: {
            ...currentWebhook[parts[0] as keyof WebhookConfig],
            [parts[1]]: {
              ...currentWebhook[parts[0] as keyof WebhookConfig][parts[1]],
              [parts[2]]: type === 'checkbox' ? checked : value
            }
          }
        });
      }
    } else {
      // Campos simples
      setCurrentWebhook({
        ...currentWebhook,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  const saveConfig = async () => {
    if (!currentWebhook) return;
    
    try {
      setIsSaving(true);
      
      if (isEditing && currentWebhook.id) {
        // Atualizar webhook existente
        await setDoc(doc(db, 'webhooks', currentWebhook.id), {
          name: currentWebhook.name,
          url: currentWebhook.url,
          enabled: currentWebhook.enabled,
          secret: currentWebhook.secret,
          events: currentWebhook.events,
          throttle: currentWebhook.throttle
        });
      } else {
        // Criar novo webhook
        await addDoc(collection(db, 'webhooks'), {
          name: currentWebhook.name,
          url: currentWebhook.url,
          enabled: currentWebhook.enabled,
          secret: currentWebhook.secret,
          events: currentWebhook.events,
          throttle: currentWebhook.throttle
        });
      }
      
      setShowForm(false);
      setCurrentWebhook(null);
    } catch (error) {
      console.error('Erro ao salvar configuração de webhook:', error);
      alert('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const generateSecret = () => {
    if (!currentWebhook) return;
    
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 32; i++) {
      secret += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    setCurrentWebhook({
      ...currentWebhook,
      secret
    });
  };

  const testWebhook = async () => {
    if (!currentWebhook || !currentWebhook.url) {
      setTestResult({
        success: false,
        message: 'URL do webhook não configurada'
      });
      return;
    }
    
    try {
      setTestResult({
        message: 'Enviando requisição de teste...'
      });
      
      const response = await fetch(currentWebhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': currentWebhook.secret
        },
        body: JSON.stringify({
          event: 'test',
          timestamp: new Date().toISOString(),
          data: {
            message: 'Este é um teste de webhook da plataforma Dols Capital',
            sentAt: new Date().toISOString()
          }
        })
      });
      
      if (response.ok) {
        setTestResult({
          success: true,
          message: `Teste enviado com sucesso! Resposta: ${response.status} ${response.statusText}`
        });
      } else {
        setTestResult({
          success: false,
          message: `Erro ao enviar teste: ${response.status} ${response.statusText}`
        });
      }
    } catch (error) {
      console.error('Erro ao testar webhook:', error);
      setTestResult({
        success: false,
        message: `Erro ao enviar teste: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  };
  
  const handleAddWebhook = () => {
    setCurrentWebhook({
      id: '',
      ...defaultConfig,
      name: `Novo Webhook ${webhooks.length + 1}`
    });
    setIsEditing(false);
    setShowForm(true);
  };
  
  const handleEditWebhook = (webhook: WebhookConfig) => {
    setCurrentWebhook({...webhook});
    setIsEditing(true);
    setShowForm(true);
  };
  
  const handleDeleteWebhook = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este webhook?')) {
      try {
        await deleteDoc(doc(db, 'webhooks', id));
      } catch (error) {
        console.error('Erro ao excluir webhook:', error);
        alert('Erro ao excluir webhook');
      }
    }
  };
  
  const handleToggleWebhook = async (webhook: WebhookConfig) => {
    try {
      await setDoc(doc(db, 'webhooks', webhook.id), {
        ...webhook,
        enabled: !webhook.enabled
      }, { merge: true });
    } catch (error) {
      console.error('Erro ao alterar status do webhook:', error);
      alert('Erro ao alterar status do webhook');
    }
  };

  const renderPipelineStatusChangedData = (data: any) => {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="font-semibold">ID da Proposta:</div>
          <div>{data.id || data.proposalId || 'N/A'}</div>
          
          <div className="font-semibold">Status Anterior:</div>
          <div>{data.oldPipelineStatus || data.oldStatus || 'N/A'}</div>
          
          <div className="font-semibold">Novo Status:</div>
          <div>{data.newPipelineStatus || data.newStatus || 'N/A'}</div>
          
          <div className="font-semibold">Coluna Anterior:</div>
          <div>{data.oldPipelineColumn || 'N/A'}</div>
          
          <div className="font-semibold">Nova Coluna:</div>
          <div>{data.newPipelineColumn || 'N/A'}</div>
          
          <div className="font-semibold">Status da Proposta:</div>
          <div>{data.proposalStatus || 'N/A'}</div>
          
          <div className="font-semibold">Nome do Cliente:</div>
          <div>{data.clientName || 'N/A'}</div>
          
          <div className="font-semibold">E-mail do Cliente:</div>
          <div>{data.clientEmail || 'N/A'}</div>
          
          <div className="font-semibold">Telefone do Cliente:</div>
          <div>{data.clientDDI || '+55'} {data.clientPhone || 'N/A'}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-black rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">
            Webhooks
          </h2>
          <button
            onClick={handleAddWebhook}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Adicionar Webhook
          </button>
        </div>
        
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-gray-400">Carregando webhooks...</p>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-4 border border-gray-800 rounded-md">
            <p className="text-gray-400">Nenhum webhook configurado</p>
            <button
              onClick={handleAddWebhook}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Configurar Webhook
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-black border border-gray-800 rounded-md">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-2 text-left text-gray-400">Nome</th>
                  <th className="px-4 py-2 text-left text-gray-400">URL</th>
                  <th className="px-4 py-2 text-center text-gray-400">Status</th>
                  <th className="px-4 py-2 text-center text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((webhook) => (
                  <tr key={webhook.id} className="border-b border-gray-800">
                    <td className="px-4 py-2 text-white">{webhook.name}</td>
                    <td className="px-4 py-2 text-white truncate max-w-xs">{webhook.url}</td>
                    <td className="px-4 py-2 text-center">
                      <span 
                        className={`inline-block px-2 py-1 rounded-full text-xs ${
                          webhook.enabled ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                        }`}
                      >
                        {webhook.enabled ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleToggleWebhook(webhook)}
                          className={`px-2 py-1 rounded-md text-xs ${
                            webhook.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                          } text-white`}
                        >
                          {webhook.enabled ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleEditWebhook(webhook)}
                          className="px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteWebhook(webhook.id)}
                          className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && currentWebhook && (
        <div className="p-6 bg-black rounded-lg shadow">
          <h2 className="text-xl font-semibold text-white mb-4">
            {isEditing ? `Editar Webhook: ${currentWebhook.name}` : 'Novo Webhook'}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-1">Nome do Webhook</label>
              <input
                type="text"
                name="name"
                value={currentWebhook.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white"
                placeholder="Nome para identificação"
              />
            </div>
            
            <div>
              <label className="block text-gray-400 mb-1">URL do Webhook</label>
              <input
                type="url"
                name="url"
                value={currentWebhook.url}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white"
                placeholder="https://exemplo.com/webhook"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                name="enabled"
                checked={currentWebhook.enabled}
                onChange={handleInputChange}
                className="mr-2"
              />
              <label className="text-gray-400">Webhook Ativo</label>
            </div>
            
            <div>
              <label className="block text-gray-400 mb-1">Secret Key</label>
              <div className="flex">
                <input
                  type="text"
                  name="secret"
                  value={currentWebhook.secret}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-l-md text-white"
                  placeholder="Chave secreta para autenticação"
                />
                <button
                  type="button"
                  onClick={generateSecret}
                  className="px-4 py-2 bg-gray-700 text-white rounded-r-md hover:bg-gray-600"
                >
                  Gerar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Esta chave será enviada no header X-Webhook-Secret
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">Eventos</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-medium text-gray-400 mb-1">Clientes</h4>
                  <div className="space-y-2 ml-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.clients.created"
                        checked={currentWebhook.events.clients.created}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Cliente Criado</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.clients.updated"
                        checked={currentWebhook.events.clients.updated}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Cliente Atualizado</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.clients.statusChanged"
                        checked={currentWebhook.events.clients.statusChanged}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Status do Cliente Alterado</label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-md font-medium text-gray-400 mb-1">Propostas</h4>
                  <div className="space-y-2 ml-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.proposals.created"
                        checked={currentWebhook.events.proposals.created}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Proposta Criada</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.proposals.updated"
                        checked={currentWebhook.events.proposals.updated}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Proposta Atualizada</label>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.proposals.statusChanged"
                        checked={currentWebhook.events.proposals.statusChanged}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Status da Proposta Alterado</label>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-md font-medium text-gray-400 mb-1">Pipeline</h4>
                  <div className="space-y-2 ml-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="events.pipeline.statusChanged"
                        checked={currentWebhook.events.pipeline.statusChanged}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <label className="text-gray-400">Status do Pipeline Alterado</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">Throttling</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="throttle.enabled"
                    checked={currentWebhook.throttle.enabled}
                    onChange={handleInputChange}
                    className="mr-2"
                  />
                  <label className="text-gray-400">Limitar frequência de envio</label>
                </div>
                
                {currentWebhook.throttle.enabled && (
                  <div>
                    <label className="block text-gray-400 mb-1">Intervalo mínimo (segundos)</label>
                    <input
                      type="number"
                      name="throttle.interval"
                      value={currentWebhook.throttle.interval}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Tempo mínimo entre envios do mesmo tipo de evento para a mesma entidade
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between pt-4">
              <div>
                <button
                  type="button"
                  onClick={testWebhook}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 mr-2"
                >
                  Testar Webhook
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setCurrentWebhook(null);
                  }}
                  className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                >
                  Cancelar
                </button>
              </div>
              
              <button
                type="button"
                onClick={saveConfig}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>

            {testResult && (
              <div className={`mt-4 p-3 rounded-md ${testResult.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-6 bg-black rounded-lg shadow">
        <h2 className="text-xl font-semibold text-white mb-4">
          Estrutura dos Dados
        </h2>
        <p className="mb-4 text-gray-400">
          Os dados serão enviados no seguinte formato JSON:
        </p>

        <div className="bg-black border border-gray-800 p-4 rounded-md overflow-auto">
          <pre className="text-sm text-gray-200">
{`{
  "event": "client_created | client_updated | client_status_changed | proposal_created | proposal_updated | proposal_status_changed | pipeline_status_changed",
  "timestamp": "2025-04-10T13:45:30.000Z",
  "data": {
    // Dados completos do objeto (cliente, proposta ou status de pipeline)
  }
}`}
          </pre>
        </div>

        <h3 className="text-lg font-medium text-gray-200 mt-6 mb-2">
          Exemplo de dados de cliente
        </h3>
        <div className="bg-black border border-gray-800 p-4 rounded-md overflow-auto">
          <pre className="text-sm text-gray-200">
{`{
  "event": "client_created",
  "timestamp": "2025-04-10T13:45:30.000Z",
  "data": {
    "id": "abc123",
    "name": "Nome do Cliente",
    "email": "cliente@exemplo.com",
    "type": "PF",
    "status": "active",
    "registrationStatus": "complete",
    "createdAt": "2025-04-01T10:30:00.000Z",
    "updatedAt": "2025-04-10T13:45:30.000Z",
    "address": {
      "street": "Rua Exemplo",
      "number": "123",
      "complement": "Apto 101",
      "neighborhood": "Centro",
      "city": "São Paulo",
      "state": "SP",
      "zipCode": "01234-567"
    },
    "documents": [
      {
        "type": "cpf",
        "number": "***.***.***-**"
      }
    ]
  }
}`}
          </pre>
        </div>

        <h3 className="text-lg font-medium text-gray-200 mt-6 mb-2">
          Exemplo de dados de proposta
        </h3>
        <div className="bg-black border border-gray-800 p-4 rounded-md overflow-auto">
          <pre className="text-sm text-gray-200">
{`{
  "event": "proposal_updated",
  "timestamp": "2025-04-10T14:20:15.000Z",
  "data": {
    "id": "prop456",
    "number": "2025/0042",
    "clientId": "abc123",
    "clientName": "Nome do Cliente",
    "bankId": "bank789",
    "bankName": "Banco Exemplo",
    "status": "approved",
    "pipelineStatus": "Aprovado",
    "creditValue": 250000,
    "propertyValue": 500000,
    "creditLine": "Financiamento Imobiliário",
    "creditReason": "Aquisição",
    "createdAt": "2025-04-05T09:15:00.000Z",
    "updatedAt": "2025-04-10T14:20:15.000Z"
  }
}`}
          </pre>
        </div>

        <h3 className="text-lg font-medium text-gray-200 mt-6 mb-2">
          Exemplo de mudança de status no pipeline
        </h3>
        <div className="bg-black border border-gray-800 p-4 rounded-md overflow-auto">
          <pre className="text-sm text-gray-200">
{`{
  "event": "pipeline_status_changed",
  "timestamp": "2025-04-10T15:10:45.000Z",
  "data": {
    "proposalId": "prop456",
    "proposalNumber": "2025/0042",
    "clientId": "abc123",
    "clientName": "Nome do Cliente",
    "previousStatus": "Em Análise",
    "newStatus": "Aprovado",
    "changedAt": "2025-04-10T15:10:45.000Z",
    "changedBy": {
      "id": "user123",
      "name": "Gerente Exemplo",
      "role": "manager"
    }
  }
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
