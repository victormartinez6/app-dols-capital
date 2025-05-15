import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import InputMask from 'react-input-mask';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, collection, addDoc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import CurrencyInput from '../../components/CurrencyInput';
import LocalDocumentUpload from '../../components/LocalDocumentUpload';
import { ArrowLeft, Save, Loader2, Info } from 'lucide-react';
import SuccessModal from '../../components/SuccessModal';
import { teamService } from '../../services/TeamService';

interface IndividualFormProps {
  isEditing?: boolean;
}

interface InvitePayload {
  userId: string;
  email: string;
  roleKey: string;
  team: string;
  timestamp: number;
}

interface LocationState {
  inviteData?: InvitePayload;
  inviterUserId?: string;
  inviterEmail?: string;
  inviterName?: string;
  team?: string;
}

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
  id?: string; // ID do documento no Firestore
}

const schema = z.object({
  cpf: z.string().min(11, 'CPF é obrigatório').transform(val => val.replace(/\D/g, '')),
  name: z.string().min(3, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  ddi: z.string().min(2, 'DDI é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório').transform(val => val.replace(/\D/g, '')),
  cep: z.string().min(8, 'CEP é obrigatório').transform(val => val.replace(/\D/g, '')),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(3, 'Bairro é obrigatório'),
  city: z.string().min(3, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado é obrigatório'),
  hasProperty: z.boolean(),
  propertyValue: z.coerce.number().optional().nullable(),
  desiredCredit: z.coerce.number().min(1, 'Valor do crédito é obrigatório').nullable(),
  creditLine: z.string().optional(),
  creditReason: z.string().optional(),
  teamCode: z.string().optional(),
});

type FormData = z.infer<typeof schema> & {
  createdAt?: any;
  updatedAt?: any;
  pipelineStatus?: string;
};

// Usar o InputMask diretamente
const MaskedInput = InputMask;

export default function IndividualForm({ isEditing = false }: IndividualFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [isFromInvite, setIsFromInvite] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [inviterUserId, setInviterUserId] = useState<string>('');
  const [inviterEmail, setInviterEmail] = useState<string>('');
  const [inviterName, setInviterName] = useState<string>('');
  const [team, setTeam] = useState<string>('');
  
  // Verificar se existe um convite armazenado no localStorage
  useEffect(() => {
    // Primeiro, verificar se temos dados no state da navegação
    const state = location.state as LocationState || {};
    if (state.inviteData) {
      console.log('Dados de convite encontrados no state da navegação:', state);
      setInviteData(state.inviteData);
      setInviterUserId(state.inviterUserId || '');
      setInviterEmail(state.inviterEmail || '');
      setInviterName(state.inviterName || '');
      setTeam(state.team || '');
      setInviteInfo(state);
      setIsFromInvite(true);
      return;
    }
    
    // Se não temos dados no state, verificar o localStorage
    const storedInvite = localStorage.getItem('dolsCapitalInvite');
    if (storedInvite) {
      try {
        const parsedInvite = JSON.parse(storedInvite);
        console.log('Dados de convite encontrados no localStorage:', parsedInvite);
        setInviteData(parsedInvite.inviteData);
        setInviterUserId(parsedInvite.inviterUserId || '');
        setInviterEmail(parsedInvite.inviterEmail || '');
        setInviterName(parsedInvite.inviterName || parsedInvite.inviterDisplayName || '');
        setTeam(parsedInvite.team || '');
        setInviteInfo(parsedInvite);
        setIsFromInvite(true);
      } catch (error) {
        console.error('Erro ao processar dados do convite do localStorage:', error);
      }
    }
  }, [location.state]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [isCheckingTeam, setIsCheckingTeam] = useState(false); // Começar como true para mostrar o carregamento inicial
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{
    identity_document?: Document;
    address_proof?: Document;
    income_tax_declaration?: Document;
    income_tax_receipt?: Document;
    marital_status_certificate?: Document;
  }>({});

  // Determinar se estamos em modo de edição baseado na presença de um ID na URL ou no estado da navegação
  const isEditMode = Boolean(id) || isEditing;

  console.log('Modo de edição:', isEditMode, 'ID:', id, 'isEditing prop:', isEditing, 'location state:', location.state);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    defaultValues: {
      cpf: '',
      name: '',
      email: '',
      ddi: '+55',
      phone: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      hasProperty: false,
      propertyValue: undefined,
      desiredCredit: undefined,
      creditLine: '',
      creditReason: '',
      pipelineStatus: 'novo',
    },
    resolver: zodResolver(schema),
  });

  const hasProperty = watch('hasProperty');

  // Efeito para carregar os dados do cliente quando o componente é montado
  // Buscar informações da equipe do convite
  useEffect(() => {
    if (isFromInvite && team) {
      const fetchTeamInfo = async () => {
        try {
          // Buscar a equipe pelo ID
          const teamDoc = await getDoc(doc(db, 'teams', team));

          if (teamDoc.exists()) {
            const teamData = teamDoc.data();
            const teamCodeValue = teamData.teamCode || '';
            setTeamCode(teamCodeValue);
            setTeamName(teamData.name || '');
            
            // Preencher automaticamente o campo de código da equipe no formulário
            if (teamCodeValue) {
              console.log('Preenchendo automaticamente o código da equipe:', teamCodeValue);
              // Usar o setValue do react-hook-form para preencher o campo
              setValue('teamCode', teamCodeValue);
              // Chamar o checkTeamCode para atualizar o nome da equipe na interface
              checkTeamCode(teamCodeValue);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar informações da equipe:', error);
        }
      };

      fetchTeamInfo();
    }
  }, [isFromInvite, team, setValue]);

  useEffect(() => {
    const loadUserData = async () => {
      // Só carrega os dados se estiver editando ou se tiver um ID na URL
      if (isEditMode) {
        try {
          console.log('Iniciando carregamento de dados do cliente pessoa física...');
          // Usar o ID da URL se disponível, caso contrário usar o ID do usuário logado
          const registrationId = id || user?.id;

          if (!registrationId) {
            console.error('ID não encontrado para carregar os dados');
            setInitialLoading(false);
            return;
          }

          console.log('Carregando dados do cliente com ID:', registrationId);
          const docRef = doc(db, 'registrations', registrationId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            console.log('Dados do cliente encontrados:', data);

            // Verificar se o cliente é do tipo pessoa física
            const clientType = data.type;
            console.log('Tipo de cliente:', clientType);

            if (clientType !== 'PF') {
              console.error('Tentando carregar cliente não-PF no formulário de pessoa física');
              setError('Este cliente não é uma pessoa física. Redirecionando...');
              setTimeout(() => {
                navigate(`/register/company/${registrationId}`);
              }, 2000);
              return;
            }

            // Primeiro, definir todos os campos exceto desiredCredit e propertyValue
            Object.entries(data).forEach(([key, value]) => {
              if (key !== 'documents' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'desiredCredit' && key !== 'propertyValue') {
                console.log(`Definindo campo ${key} com valor:`, value);

                // Tratamento especial para campos aninhados como address
                if (key === 'address' && typeof value === 'object') {
                  Object.entries(value as Record<string, any>).forEach(([addressKey, addressValue]) => {
                    console.log(`Definindo campo address.${addressKey} com valor:`, addressValue);
                    setValue(`address.${addressKey}` as any, addressValue);
                  });
                } else {
                  setValue(key as any, value);
                }
              }
            });

            // Verificar e definir o código e nome da equipe
            if (data.teamCode) {
              console.log('Definindo código da equipe:', data.teamCode);
              // Não usar setValue para teamCode, pois não está no schema
              setTeamCode(data.teamCode);
            }

            if (data.teamName) {
              console.log('Definindo nome da equipe:', data.teamName);
              setTeamName(data.teamName);
            }

            // Definir o valor do crédito desejado separadamente para garantir que seja tratado como número
            if (data.desiredCredit !== undefined) {
              console.log('Definindo crédito desejado:', data.desiredCredit);
              setValue('desiredCredit', data.desiredCredit);

              // Definir novamente com um pequeno atraso para garantir que o componente esteja pronto
              setTimeout(() => {
                console.log('Definindo crédito desejado com atraso:', data.desiredCredit);
                setValue('desiredCredit', data.desiredCredit);
              }, 500);
            }

            // Definir o valor do imóvel separadamente para garantir que seja tratado como número
            if (data.propertyValue !== undefined) {
              console.log('Definindo valor do imóvel:', data.propertyValue);
              setValue('propertyValue', data.propertyValue);

              // Definir novamente com um pequeno atraso para garantir que o componente esteja pronto
              setTimeout(() => {
                console.log('Definindo valor do imóvel com atraso:', data.propertyValue);
                setValue('propertyValue', data.propertyValue);
              }, 500);
            }

            // Carregar documentos
            if (data.documents) {
              console.log('Documentos encontrados:', data.documents);
              // Converter os documentos para o formato esperado pelo componente
              const formattedDocuments: Record<string, Document> = {};

              Object.entries(data.documents).forEach(([key, value]) => {
                const doc = value as any;
                if (doc) {
                  formattedDocuments[key] = {
                    id: doc.id || undefined,
                    name: doc.name || 'Documento',
                    url: doc.url || '',
                    type: doc.type || key,
                    path: doc.path || ''
                  };
                }
              });

              console.log('Documentos formatados:', formattedDocuments);
              setDocuments(formattedDocuments);
            }
          } else {
            console.error('Documento não encontrado para o ID:', registrationId);
          }
        } catch (error) {
          console.error('Erro ao carregar dados do cliente:', error);
        } finally {
          setInitialLoading(false);
        }
      } else {
        setInitialLoading(false);
      }
    };

    loadUserData();
  }, [user, id, setValue, isEditMode]);

  useEffect(() => {
    console.log('Estado initialLoading:', initialLoading);
  }, [initialLoading]);

  const searchCep = async (cep: string) => {
    if (cep.length < 8) return;

    try {
      // Remover caracteres não numéricos
      const cleanCep = cep.replace(/\D/g, '');

      // Fazer a requisição para a API do ViaCEP
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP não encontrado');
      }

      // Preencher os campos com os dados retornados
      setValue('street', data.logradouro || '');
      setValue('neighborhood', data.bairro || '');
      setValue('city', data.localidade || '');
      setValue('state', data.uf || '');
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleDocumentChange = (type: string, doc: Document | undefined) => {
    if (doc) {
      setDocuments(prev => ({ ...prev, [type]: doc }));
    } else {
      const newDocs = { ...documents };
      delete newDocs[type as keyof typeof documents];
      setDocuments(newDocs);
    }
  };

  const handleDocumentError = (error: string) => {
    setError(error);
  };

  // Função para verificar o código da equipe
  const checkTeamCode = async (code: string) => {
    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
      setTeamName('');
      return;
    }

    setIsCheckingTeam(true);
    try {
      const teamsRef = collection(db, 'teams');
      const teamQuery = query(teamsRef, where('teamCode', '==', code));
      const teamSnapshot = await getDocs(teamQuery);

      if (!teamSnapshot.empty) {
        const teamData = teamSnapshot.docs[0].data();
        setTeamName(teamData.name);
      } else {
        setTeamName('');
      }
    } catch (error) {
      console.error('Erro ao verificar código da equipe:', error);
      setTeamName('');
    } finally {
      setIsCheckingTeam(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError(null);

      // Determinar o ID a ser usado para o registro
      const registrationId = id || user?.id;

      if (!registrationId) {
        throw new Error('ID não encontrado para salvar os dados');
      }

      // Garantir que os valores numéricos sejam tratados corretamente
      const sanitizedData = {
        ...data,
        // Garantir que propertyValue seja 0 se não estiver definido ou se hasProperty for false
        propertyValue: data.hasProperty && data.propertyValue ? data.propertyValue : 0,
        // Garantir que desiredCredit seja 0 se não estiver definido
        desiredCredit: data.desiredCredit || 0
      };

      // Preparar os documentos para salvar apenas as referências
      const documentReferences: Record<string, any> = {};

      // Converter os documentos para referências
      if (documents) {
        Object.entries(documents).forEach(([key, doc]) => {
          if (doc && doc.id) {
            // Se já é uma referência, mantenha apenas os dados necessários
            documentReferences[key] = {
              id: doc.id,
              name: doc.name,
              type: doc.type,
              path: doc.path
            };
          }
        });
      }

      // Preparar os dados para salvar
      const registrationData = {
        ...sanitizedData,
        documents: documentReferences, // Salvar apenas as referências
        type: 'PF', // Usar consistentemente 'PF' em vez de 'individual'
        pipelineStatus: 'submitted',
        status: Object.keys(documentReferences).length > 0 ? 'complete' : 'documents_pending',
        updatedAt: serverTimestamp(),
        // Adicionar o código da equipe e o nome da equipe
        teamCode: teamCode || '',
        teamName: teamName || '',
        // Adicionar informações do convite se disponíveis
        inviterUserId: inviterUserId || '',
        inviterEmail: inviterEmail || '',
        inviterName: inviterName || '',
        team: team || ''
      };

      if (!isEditMode) {
        registrationData.createdAt = serverTimestamp();
      }
      
      console.log('Dados a serem salvos:', registrationData);
      
      // Salvar no Firestore
      // Obter o status anterior para o webhook (apenas em modo de edição)
      let previousStatus = null;
      if (isEditMode) {
        const registrationDoc = await getDoc(doc(db, 'registrations', registrationId));
        if (registrationDoc.exists()) {
          previousStatus = registrationDoc.data().status;
        }
      }
      
      // Salvar o registro no Firestore
      if (!isEditMode) {
        // Adicionar campos específicos para novos registros
        const newRegistrationData = {
          ...registrationData,
          createdAt: serverTimestamp(),
          userId: registrationId,
          createdBy: user?.id || ''
        };
        
        // Salvar o documento com o ID do usuário
        await setDoc(doc(db, 'registrations', registrationId), newRegistrationData);
        
        // Se o registro veio de um convite e temos informações de equipe, atualizar a equipe com o gerente
        if (isFromInvite && team && inviterUserId && inviterName) {
          try {
            console.log('Atualizando informações de equipe com o gerente:', { 
              team, 
              managerId: inviterUserId, 
              managerName: inviterName 
            });
            
            // Verificar se a roleKey do convidador é de gerente
            if (inviteData?.roleKey?.includes('manager')) {
              // Atualizar ou criar a equipe com as informações do gerente
              await teamService.updateTeamManager(team, inviterUserId, inviterName);
            }
          } catch (teamError) {
            console.error('Erro ao atualizar informações de equipe:', teamError);
            // Não interromper o fluxo se a atualização da equipe falhar
          }
        }
        
        // Webhook removido - implementar conforme necessidade
      } else {
        await setDoc(doc(db, 'registrations', registrationId), registrationData, { merge: true });
      }
      
      // Se estiver em modo de edição, atualizar todas as propostas relacionadas a este cliente
      if (isEditMode) {
        try {
          // Buscar todas as propostas relacionadas a este cliente
          const proposalsQuery = query(
            collection(db, 'proposals'),
            where('clientId', '==', registrationId)
          );
          const proposalsSnapshot = await getDocs(proposalsQuery);
          
          // Atualizar cada proposta com os dados atualizados da equipe
          const proposalUpdates = proposalsSnapshot.docs.map(async (proposalDoc) => {
            const proposalRef = doc(db, 'proposals', proposalDoc.id);
            return updateDoc(proposalRef, {
              teamCode: teamCode || '',
              teamName: teamName || ''
            });
          });
          
          // Executar todas as atualizações em paralelo
          if (proposalUpdates.length > 0) {
            console.log(`Atualizando equipe em ${proposalUpdates.length} propostas relacionadas`);
            await Promise.all(proposalUpdates);
          }
          
          // Atualizar também o documento do usuário para manter a consistência
          const userRef = doc(db, 'users', registrationId);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            console.log('Atualizando equipe no cadastro do usuário');
            
            // Se temos um código de equipe, precisamos buscar o ID da equipe
            let teamId = '';
            
            if (teamCode) {
              // Buscar o ID da equipe pelo código
              const teamsQuery = query(
                collection(db, 'teams'),
                where('teamCode', '==', teamCode)
              );
              const teamsSnapshot = await getDocs(teamsQuery);
              
              if (!teamsSnapshot.empty) {
                teamId = teamsSnapshot.docs[0].id;
              }
            }
            
            await updateDoc(userRef, {
              team: teamId,
              teamName: teamName || '',
              teamCode: teamCode || ''
            });
          }
        } catch (err) {
          console.error('Erro ao atualizar propostas e usuário relacionados:', err);
          // Não interromper o fluxo principal se houver erro na atualização das propostas
        }
      }
      
      // Enviar webhook de alteração de status se estiver em modo de edição e o status mudou
      if (isEditMode && previousStatus && previousStatus !== registrationData.status) {
        // Obter os dados atualizados do cliente
        const updatedClientDoc = await getDoc(doc(db, 'registrations', registrationId));
        
        if (updatedClientDoc.exists()) {
          const clientData = {
            id: registrationId,
            ...updatedClientDoc.data()
          };
          
          // Importar o serviço de webhook
          const { webhookService } = await import('../../services/WebhookService');
          await webhookService.sendClientStatusChanged(clientData, previousStatus);
        }
      }
      
      // Atualizar perfil do usuário com o tipo de cadastro
      if (!isEditMode && !id) {
        const userRef = doc(db, 'users', registrationId);
        await setDoc(userRef, {
          hasRegistration: true,
          registrationType: 'PF'
        }, { merge: true });
      }
      
      // Criar proposta APENAS se for um novo cadastro (não edição)
      if (!isEditMode && !id) {
        console.log('Criando nova proposta para cadastro novo');
        const proposalData = {
          clientName: sanitizedData.name || 'Nome não disponível',
          clientId: registrationId,
          clientType: 'PF',
          desiredCredit: sanitizedData.desiredCredit || 0,
          hasProperty: sanitizedData.hasProperty || false,
          propertyValue: sanitizedData.propertyValue || 0,
          status: 'pending',
          pipelineStatus: 'submitted',
          userId: registrationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          creditLine: sanitizedData.creditLine || 'Capital de Giro',
          creditReason: sanitizedData.creditReason || 'Expandir a empresa',
          // Adicionar dados de contato do cliente
          ddi: sanitizedData.ddi.replace('_', ''),
          phone: sanitizedData.phone,
          email: sanitizedData.email,
          // Adicionar e-mail do usuário logado
          userEmail: user?.email || '',
          // Incluir informações de equipe
          teamCode: teamCode || '',
          teamName: teamName || ''
        };

        console.log('Dados da proposta a serem salvos:', proposalData);
        
        // Adicionar a proposta à coleção 'proposals'
        await addDoc(collection(db, 'proposals'), proposalData);
        
        // Preparar dados do cliente para o webhook
        const clientData = {
          id: registrationId,
          name: sanitizedData.name,
          email: sanitizedData.email,
          type: 'PF',
          status: registrationData.status, // Usar o mesmo status definido anteriormente
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          address: {
            street: sanitizedData.street,
            number: sanitizedData.number,
            complement: sanitizedData.complement,
            neighborhood: sanitizedData.neighborhood,
            city: sanitizedData.city,
            state: sanitizedData.state,
            zipCode: sanitizedData.cep
          },
          cpf: sanitizedData.cpf,
          ddi: sanitizedData.ddi.replace('_', ''),
          phone: sanitizedData.phone,
          hasProperty: sanitizedData.hasProperty,
          propertyValue: sanitizedData.propertyValue,
          desiredCredit: sanitizedData.desiredCredit,
          creditLine: sanitizedData.creditLine,
          creditReason: sanitizedData.creditReason,
          pipelineStatus: sanitizedData.pipelineStatus || 'novo'
        };
        
        // Webhook de cliente criado removido
      } else if (isEditMode) {
        // Obter os dados atualizados do cliente do banco de dados
        const updatedClientDocRef = doc(db, 'clients', registrationId);
        const updatedClientDoc = await getDoc(updatedClientDocRef);
        
        if (updatedClientDoc.exists()) {
          const updatedClientData = {
            id: registrationId,
            ...updatedClientDoc.data()
          };
          // Webhook de cliente atualizado removido
        } else {
          // Fallback para o objeto clientData se não conseguir obter os dados atualizados
          const clientData = {
            id: registrationId,
            name: sanitizedData.name,
            email: sanitizedData.email,
            type: 'PF',
            status: 'documents_pending',
            updatedAt: new Date().toISOString(),
            address: {
              street: sanitizedData.street,
              number: sanitizedData.number,
              complement: sanitizedData.complement,
              neighborhood: sanitizedData.neighborhood,
              city: sanitizedData.city,
              state: sanitizedData.state,
              zipCode: sanitizedData.cep
            },
            cpf: sanitizedData.cpf,
            ddi: sanitizedData.ddi.replace('_', ''),
            phone: sanitizedData.phone,
            hasProperty: sanitizedData.hasProperty,
            propertyValue: sanitizedData.propertyValue,
            desiredCredit: sanitizedData.desiredCredit,
            creditLine: sanitizedData.creditLine,
            creditReason: sanitizedData.creditReason,
            pipelineStatus: sanitizedData.pipelineStatus || 'novo'
          };
          // Webhook de cliente atualizado removido
        }
      }
      
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Erro ao salvar cadastro:', error);
      setError(error.message || 'Erro ao salvar o cadastro. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    console.log('Renderizando indicador de carregamento...');
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  console.log('Renderizando formulário...');
  return (
    <>
      <div className="min-h-screen bg-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-semibold text-white mb-8">
            Cadastro de Pessoa Física
          </h1>
          
          {/* Mostrar informações do convite se disponíveis */}
          {isFromInvite && (
            <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-8">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-white">
                    Você está se cadastrando através de um convite de{' '}
                    <span className="font-semibold">
                      {inviteData?.roleKey === 'admin' ? 'um administrador' : 
                       inviteData?.roleKey === 'manager' ? 'um gerente' : 
                       inviteData?.roleKey === 'partner' ? 'um parceiro' : 'um usuário'}
                    </span>
                  </p>
                  {teamName && (
                    <p className="text-white mt-1">
                      Você será vinculado à equipe <span className="font-semibold">{teamName}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} id="individual-form" className="space-y-6">
            {/* Bloco do Código da Equipe */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white">
                Código da Equipe
              </h2>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="teamCode" className="block text-sm font-medium text-gray-300">
                    Código da Equipe (4 dígitos)
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      id="teamCode"
                      maxLength={4}
                      value={teamCode}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setTeamCode(value);
                        if (value.length === 4) {
                          checkTeamCode(value);
                        } else {
                          setTeamName('');
                        }
                      }}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="0000"
                    />
                    {isCheckingTeam && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                  {teamName && (
                    <p className="mt-1 text-sm text-green-500">
                      Equipe encontrada: {teamName}
                    </p>
                  )}
                  {teamCode && teamCode.length === 4 && !teamName && !isCheckingTeam && (
                    <p className="mt-1 text-sm text-yellow-500">
                      Equipe não encontrada. Verifique o código.
                    </p>
                  )}
                  <p className="mt-2 text-sm text-gray-400">
                    Caso você não possua um código de equipe, pode seguir normalmente com o cadastro. O código pode ser fornecido pelo seu gerente ou consultor.
                  </p>
                </div>
              </div>
            </div>

            {/* Dados Pessoais */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Dados Pessoais
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPF */}
                <div className="relative">
                  <MaskedInput
                    mask="999.999.999-99"
                    {...register('cpf')}
                    disabled={isEditMode || initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="000.000.000-00"
                  />
                  {errors.cpf && (
                    <p className="mt-1 text-sm text-red-400">{errors.cpf.message}</p>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    {...register('name')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Nome completo"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-400">{errors.name.message}</p>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="email"
                    {...register('email')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="exemplo@email.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <div className="w-1/4 relative">
                    <MaskedInput
                      mask="+99"
                      {...register('ddi')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="+55"
                    />
                    {errors.ddi && (
                      <p className="mt-1 text-sm text-red-400">{errors.ddi.message}</p>
                    )}
                  </div>
                  <div className="w-3/4 relative">
                    <MaskedInput
                      mask="(99) 99999-9999"
                      {...register('phone')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="(00) 00000-0000"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-400">{errors.phone.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Endereço
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <MaskedInput
                    mask="99999-999"
                    {...register('cep')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="00000-000"
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => searchCep(e.target.value)}
                  />
                  {errors.cep && (
                    <p className="mt-1 text-sm text-red-400">{errors.cep.message}</p>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    {...register('street')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Logradouro"
                  />
                  {errors.street && (
                    <p className="mt-1 text-sm text-red-400">{errors.street.message}</p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <div className="w-1/3 relative">
                    <input
                      type="text"
                      {...register('number')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="Número"
                    />
                    {errors.number && (
                      <p className="mt-1 text-sm text-red-400">{errors.number.message}</p>
                    )}
                  </div>
                  <div className="w-2/3 relative">
                    <input
                      type="text"
                      {...register('complement')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="Complemento (opcional)"
                    />
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    {...register('neighborhood')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Bairro"
                  />
                  {errors.neighborhood && (
                    <p className="mt-1 text-sm text-red-400">{errors.neighborhood.message}</p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <div className="w-2/3 relative">
                    <input
                      type="text"
                      {...register('city')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="Cidade"
                    />
                    {errors.city && (
                      <p className="mt-1 text-sm text-red-400">{errors.city.message}</p>
                    )}
                  </div>
                  <div className="w-1/3 relative">
                    <input
                      type="text"
                      {...register('state')}
                      disabled={initialLoading}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="UF"
                      maxLength={2}
                    />
                    {errors.state && (
                      <p className="mt-1 text-sm text-red-400">{errors.state.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Informações Financeiras
              </h2>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hasProperty"
                    {...register('hasProperty')}
                    disabled={initialLoading}
                    className="h-4 w-4 text-[#D8B25A] focus:ring-[#D8B25A] border-gray-300 rounded bg-black"
                  />
                  <label className="text-gray-300" htmlFor="hasProperty">Possui Imóvel?</label>
                </div>

                {hasProperty && (
                  <div className="relative">
                    <label htmlFor="propertyValue" className="block text-sm font-medium text-gray-300 mb-1">
                      Valor do Imóvel
                    </label>
                    <div className="mt-1">
                      {isEditMode || id ? (
                        <div>
                          <input
                            type="text"
                            value={watch('propertyValue') ? `R$ ${Number(watch('propertyValue')).toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                            disabled={true}
                            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 opacity-70"
                          />
                          <div className="text-xs text-gray-400 mt-1">
                            Este valor não pode ser alterado pois foi definido no cadastro inicial.
                          </div>
                        </div>
                      ) : (
                        <CurrencyInput
                          name="propertyValue"
                          disabled={!hasProperty || initialLoading}
                          register={register}
                          setValue={setValue}
                          className={`appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm ${!hasProperty ? 'opacity-50' : ''}`}
                          placeholder="Valor do imóvel"
                        />
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="desiredCredit" className="block text-sm font-medium text-gray-300 mb-1">
                    Valor do Crédito Pretendido
                  </label>
                  <div className="mt-1">
                    {isEditMode || id ? (
                      <div>
                        <input
                          type="text"
                          value={watch('desiredCredit') ? `R$ ${Number(watch('desiredCredit')).toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                          disabled={true}
                          className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 opacity-70"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                          Este valor não pode ser alterado pois foi definido no cadastro inicial.
                        </div>
                      </div>
                    ) : (
                      <CurrencyInput
                        name="desiredCredit"
                        register={register}
                        setValue={setValue}
                        className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                        placeholder="Valor desejado"
                        error={errors.desiredCredit?.message}
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="creditLine" className="block text-sm font-medium text-gray-300 mb-1">
                    Linha de Crédito
                  </label>
                  <div className="mt-1">
                    <select
                      id="creditLine"
                      {...register('creditLine')}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    >
                      <option value="Capital de Giro">Capital de Giro</option>
                      <option value="Investimento">Investimento</option>
                      <option value="Home Equity">Home Equity</option>
                      <option value="Desconto">Desconto</option>
                      <option value="CRI (Certificado de Recebíveis Imobiliários)">CRI (Certificado de Recebíveis Imobiliários)</option>
                      <option value="CRA (Certificado de Recebíveis do Agronegócio)">CRA (Certificado de Recebíveis do Agronegócio)</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="creditReason" className="block text-sm font-medium text-gray-300 mb-1">
                    Finalidade do Crédito
                  </label>
                  <div className="mt-1">
                    <select
                      id="creditReason"
                      {...register('creditReason')}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    >
                      <option value="Expandir a empresa">Expandir a empresa</option>
                      <option value="Modernizar a empresa">Modernizar a empresa</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            {user && (
              <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
                <h2 className="text-xl font-semibold text-white">
                  Documentos
                </h2>

                <div className="space-y-4">
                  <LocalDocumentUpload
                    label="Documento de Identidade (RG)"
                    type="identity_document"
                    userId={user.id}
                    document={documents.identity_document}
                    onChange={(doc) => handleDocumentChange('identity_document', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />

                  <LocalDocumentUpload
                    label="Comprovante de Endereço"
                    type="address_proof"
                    userId={user.id}
                    document={documents.address_proof}
                    onChange={(doc) => handleDocumentChange('address_proof', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Declaração de Imposto de Renda"
                    type="income_tax_declaration"
                    userId={user.id}
                    document={documents.income_tax_declaration}
                    onChange={(doc) => handleDocumentChange('income_tax_declaration', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Recibo de Imposto de Renda"
                    type="income_tax_receipt"
                    userId={user.id}
                    document={documents.income_tax_receipt}
                    onChange={(doc) => handleDocumentChange('income_tax_receipt', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Certidão de Estado Civil"
                    type="marital_status_certificate"
                    userId={user.id}
                    document={documents.marital_status_certificate}
                    onChange={(doc) => handleDocumentChange('marital_status_certificate', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Botões flutuantes para Voltar e Salvar */}
      <div className="fixed bottom-6 right-6 flex space-x-4 z-50">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-lg text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </button>
        <button
          type="submit"
          disabled={loading}
          form="individual-form"
          className="px-4 py-2 border border-transparent rounded-md shadow-lg text-sm font-medium text-black bg-[#D8B25A] hover:bg-[#00e090] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A] flex items-center"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Cadastro
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {showSuccessModal && (
        <SuccessModal
          isOpen={true}
          onClose={() => {
            // Forçar redirecionamento para a página principal usando window.location diretamente
            window.location.href = '/';
          }}
          message="Cadastro realizado com sucesso!"
          buttonText="Ir para o Dashboard"
        />
      )}
    </>
  );
}