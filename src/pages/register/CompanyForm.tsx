import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import InputMask from 'react-input-mask';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import CurrencyInput from '../../components/CurrencyInput';
import LocalDocumentUpload from '../../components/LocalDocumentUpload';
import { ArrowLeft, Save } from 'lucide-react';
import SuccessModal from '../../components/SuccessModal';
import { teamService } from '../../services/TeamService';
import { webhookService } from '../../services/WebhookService';

interface Document {
  name: string;
  url: string;
  type: string;
  path: string;
  id?: string; // ID do documento no Firestore
}

interface CompanyFormProps {
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

const schema = z.object({
  cnpj: z.string().min(14, 'CNPJ é obrigatório').transform(val => val.replace(/\D/g, '')),
  companyName: z.string().min(3, 'Razão Social é obrigatória'),
  simples: z.boolean(),
  constitutionDate: z.string().min(8, 'Data de constituição é obrigatória').transform(val => val.replace(/\D/g, '')),
  revenue: z.string().min(1, 'Faturamento é obrigatório'),
  legalRepresentative: z.string().min(3, 'Representante legal é obrigatório'),
  partnerCpf: z.string().min(11, 'CPF do sócio é obrigatório').transform(val => val.replace(/\D/g, '')),
  partnerEmail: z.string().email('E-mail do sócio inválido'),
  ddi: z.string().min(2, 'DDI é obrigatório'),
  phone: z.string().min(10, 'Telefone é obrigatório').transform(val => val.replace(/\D/g, '')),
  cep: z.string().min(8, 'CEP é obrigatório').transform(val => val.replace(/\D/g, '')),
  street: z.string().min(3, 'Logradouro é obrigatório'),
  number: z.string().min(1, 'Número é obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(3, 'Bairro é obrigatório'),
  city: z.string().min(3, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado é obrigatório'),
  companyDescription: z.string().min(10, 'Descrição da empresa é obrigatória'),
  teamCode: z.string().optional(),
  desiredCredit: z.coerce.number().min(1, 'Valor do crédito é obrigatório').nullable(),
  hasRestriction: z.boolean(),
  creditLine: z.string().optional(),
  creditReason: z.string().optional(),
});

type FormData = z.infer<typeof schema> & {
  createdAt?: any;
  updatedAt?: any;
  pipelineStatus?: string;
};

const revenueRanges = [
  '1 a 10 milhões',
  '11 a 30 milhões',
  '31 a 100 milhões',
  'Acima de 100 milhões',
];

export default function CompanyForm({ isEditing = false }: CompanyFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [_, setInviteInfo] = useState<any>(null);
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
        setInviterName(parsedInvite.inviterName || '');
        setTeam(parsedInvite.team || '');
        setInviteInfo(parsedInvite);
        setIsFromInvite(true);
      } catch (error) {
        console.error('Erro ao processar convite armazenado:', error);
        localStorage.removeItem('dolsCapitalInvite');
      }
    }
  }, [location.state]);

  const [initialLoading, setInitialLoading] = useState(true); // Começar como true para mostrar o carregamento inicial
  const [searchingCNPJ, setSearchingCNPJ] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [documents, setDocuments] = useState<{
    social_contract?: Document;
    revenue_last_12_months?: Document;
    balance_sheet?: Document;
    partner_document?: Document;
    address_proof?: Document;
  }>({});
  const [isCheckingTeam, setIsCheckingTeam] = useState(false);

  // Determinar se estamos em modo de edição baseado na presença de um ID na URL ou no estado da navegação
  const locationState = location.state as { isEditing?: boolean } | null;
  const isEditMode = Boolean(id) || isEditing || Boolean(locationState?.isEditing);
  
  console.log('Modo de edição (empresa):', isEditMode, 'ID:', id, 'isEditing prop:', isEditing, 'location state:', locationState);

  // Inicializar o formulário com useForm
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    defaultValues: {
      cnpj: '',
      companyName: '',
      simples: false,
      constitutionDate: '',
      revenue: '',
      legalRepresentative: '',
      partnerCpf: '',
      partnerEmail: '',
      ddi: '+55',
      phone: '',
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      companyDescription: '',
      desiredCredit: undefined,
      hasRestriction: false,
      creditLine: '',
      creditReason: '',
      teamCode: '',
    },
    resolver: zodResolver(schema),
  });
  
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

  const handleDocumentChange = (type: string, doc: Document | undefined) => {
    setDocuments(prev => ({
      ...prev,
      [type]: doc,
    }));
  };

  const handleDocumentError = (error: string) => {
    console.error(error);
  };

  const searchCep = async (cep: string) => {
    try {
      const formattedCep = cep.replace(/\D/g, '');
      if (formattedCep.length === 8) {
        const response = await axios.get(`https://viacep.com.br/ws/${formattedCep}/json/`);
        if (!response.data.erro) {
          setValue('street', response.data.logradouro);
          setValue('neighborhood', response.data.bairro);
          setValue('city', response.data.localidade);
          setValue('state', response.data.uf);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleCNPJSearch = async (cnpj: string) => {
    try {
      setSearchingCNPJ(true);
      const formattedCnpj = cnpj.replace(/\D/g, '');
      
      if (formattedCnpj.length === 14) {
        const response = await axios.get(`https://publica.cnpj.ws/cnpj/${formattedCnpj}`);
        
        if (response.data) {
          const estabelecimento = response.data.estabelecimento || {};
          
          setValue('companyName', response.data.razao_social || '');
          setValue('constitutionDate', estabelecimento.data_inicio_atividade || '');
          
          setValue('cep', estabelecimento.cep || '');
          setValue('street', estabelecimento.logradouro || '');
          setValue('number', estabelecimento.numero || '');
          setValue('complement', estabelecimento.complemento || '');
          setValue('neighborhood', estabelecimento.bairro || '');
          setValue('city', estabelecimento.cidade?.nome || '');
          setValue('state', estabelecimento.estado?.sigla || '');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar CNPJ:', error);
    } finally {
      setSearchingCNPJ(false);
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      // Só carrega os dados se estiver editando ou se tiver um ID na URL
      if (isEditMode) {
        try {
          console.log('Iniciando carregamento de dados do cliente empresa...');
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
            
            // Verificar se o cliente é do tipo pessoa jurídica
            const clientType = data.type;
            console.log('Tipo de cliente:', clientType);
            
            if (clientType !== 'PJ') {
              console.error('Tentando carregar cliente não-PJ no formulário de empresa');
              setError('Este cliente não é uma pessoa jurídica. Redirecionando...');
              setTimeout(() => {
                navigate(`/register/individual/${registrationId}`);
              }, 2000);
              return;
            }
            
            // Primeiro, definir todos os campos exceto desiredCredit
            Object.entries(data).forEach(([key, value]) => {
              if (key !== 'documents' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'desiredCredit') {
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

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      
      // Determinar o ID a ser usado para o registro
      const registrationId = id || user?.id;
      
      if (!registrationId) {
        throw new Error('ID não encontrado para salvar os dados');
      }
      
      // Garantir que os valores numéricos sejam tratados corretamente
      const sanitizedData = {
        ...data,
        // Garantir que desiredCredit seja 0 se não estiver definido
        desiredCredit: data.desiredCredit || 0,
        // Valores padrão para empresa
        hasProperty: false,
        propertyValue: 0,
        status: 'pending',
        pipelineStatus: 'submitted',
        userId: registrationId,
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
        type: 'PJ', // Usar consistentemente 'PJ' em vez de 'company'
        pipelineStatus: 'submitted',
        // Definir o status com base na existência de documentos
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
      
      await setDoc(doc(db, 'registrations', registrationId), registrationData, { merge: true });
      
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
          registrationType: 'PJ'
        }, { merge: true });
      }
      
      // Preparar dados do cliente para o webhook
      const clientData = {
        id: registrationId,
        name: sanitizedData.companyName,
        email: sanitizedData.partnerEmail,
        type: 'PJ',
        status: registrationData.status, // Usar o mesmo status definido anteriormente
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
        cnpj: sanitizedData.cnpj,
        ddi: sanitizedData.ddi.replace('_', ''),
        phone: sanitizedData.phone,
        legalRepresentative: sanitizedData.legalRepresentative,
        partnerCpf: sanitizedData.partnerCpf,
        constitutionDate: sanitizedData.constitutionDate,
        revenue: sanitizedData.revenue,
        simples: sanitizedData.simples,
        desiredCredit: sanitizedData.desiredCredit,
        creditLine: sanitizedData.creditLine,
        creditReason: sanitizedData.creditReason,
        hasRestriction: sanitizedData.hasRestriction,
        companyDescription: sanitizedData.companyDescription,
        pipelineStatus: 'submitted'
      };
      
      // Criar proposta APENAS se for um novo cadastro (não edição)
      if (!isEditMode && !id) {
        console.log('Criando nova proposta para cadastro novo');
        const proposalData = {
          clientName: sanitizedData.companyName || 'Nome não disponível',
          clientId: registrationId,
          clientType: 'PJ',
          desiredCredit: sanitizedData.desiredCredit || 0,
          // Valores padrão para empresa
          hasProperty: false,
          propertyValue: 0,
          status: 'pending',
          pipelineStatus: 'submitted',
          userId: registrationId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Adicionar os campos de linha de crédito e finalidade
          creditLine: sanitizedData.creditLine || 'Capital de Giro',
          creditReason: sanitizedData.creditReason || 'Expandir a empresa',
          // Adicionar dados de contato do cliente
          ddi: sanitizedData.ddi.replace('_', ''),
          phone: sanitizedData.phone,
          email: sanitizedData.partnerEmail,
          partnerEmail: sanitizedData.partnerEmail,
          userEmail: user?.email || '',
          // Incluir informações de equipe
          teamCode: teamCode || '',
          teamName: teamName || ''
        };

        console.log('Dados da proposta a serem salvos:', proposalData);
        
        // Adicionar a proposta à coleção 'proposals'
        await addDoc(collection(db, 'proposals'), proposalData);
        
        // Adicionar data de criação para novos clientes
        const clientDataWithCreatedAt = {
          ...clientData,
          createdAt: new Date().toISOString()
        };
        
        // Disparar webhook de cliente criado imediatamente
        await webhookService.sendClientCreated(clientDataWithCreatedAt);
      } else if (isEditMode) {
        // Obter os dados atualizados do cliente do banco de dados
        const updatedClientDocRef = doc(db, 'clients', registrationId);
        const updatedClientDoc = await getDoc(updatedClientDocRef);
        
        if (updatedClientDoc.exists()) {
          const updatedClientData = {
            id: registrationId,
            ...updatedClientDoc.data()
          };
          await webhookService.sendClientUpdated(updatedClientData);
        } else {
          // Fallback para o objeto clientData se não conseguir obter os dados atualizados
          await webhookService.sendClientUpdated(clientData);
        }
      }
      
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Erro ao salvar cadastro:', error);
      setError(error.message || 'Erro ao salvar o cadastro. Por favor, tente novamente.');
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-black py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-semibold text-white mb-8">
            Cadastro de Pessoa Jurídica
          </h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <form id="company-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Bloco do Código da Equipe */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white">
                Código da Equipe
              </h2>
              
              {isFromInvite && team ? (
                <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
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
              ) : (
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
              )}
            </div>

            {/* Dados da Empresa */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Dados da Empresa
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    CNPJ
                  </label>
                  <div className="relative">
                    <InputMask
                      mask="99.999.999/9999-99"
                      type="text"
                      {...register('cnpj')}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleCNPJSearch(e.target.value)}
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                      placeholder="00.000.000/0000-00"
                    />
                    {searchingCNPJ && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                  {errors.cnpj && (
                    <p className="mt-1 text-sm text-red-400">{errors.cnpj.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    {...register('companyName')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Razão Social"
                  />
                  {errors.companyName && (
                    <p className="mt-1 text-sm text-red-400">{errors.companyName.message}</p>
                  )}
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('simples')}
                      disabled={initialLoading}
                      className="h-4 w-4 text-[#D8B25A] focus:ring-[#D8B25A] border-gray-300 rounded bg-black"
                    />
                    <span className="ml-2 text-gray-300">
                      Optante pelo Simples Nacional
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Data de Constituição
                  </label>
                  <input
                    type="date"
                    {...register('constitutionDate')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                  />
                  {errors.constitutionDate && (
                    <p className="mt-1 text-sm text-red-400">{errors.constitutionDate.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Faixa de Faturamento
                  </label>
                  <select
                    {...register('revenue')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                  >
                    <option value="">Selecione uma faixa</option>
                    {revenueRanges.map((range) => (
                      <option key={range} value={range}>{range}</option>
                    ))}
                  </select>
                  {errors.revenue && (
                    <p className="mt-1 text-sm text-red-400">{errors.revenue.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Dados do Representante Legal */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Dados do Representante Legal
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Nome do Representante Legal
                  </label>
                  <input
                    type="text"
                    {...register('legalRepresentative')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Nome do Representante Legal"
                  />
                  {errors.legalRepresentative && (
                    <p className="mt-1 text-sm text-red-400">{errors.legalRepresentative.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    CPF do Sócio
                  </label>
                  <InputMask
                    mask="999.999.999-99"
                    type="text"
                    {...register('partnerCpf')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="000.000.000-00"
                  />
                  {errors.partnerCpf && (
                    <p className="mt-1 text-sm text-red-400">{errors.partnerCpf.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    E-mail do Sócio
                  </label>
                  <input
                    type="email"
                    {...register('partnerEmail')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="exemplo@email.com"
                  />
                  {errors.partnerEmail && (
                    <p className="mt-1 text-sm text-red-400">{errors.partnerEmail.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300">
                      DDI
                    </label>
                    <input
                      type="text"
                      {...register('ddi')}
                      disabled={initialLoading}
                      defaultValue="+55"
                      className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    />
                    {errors.ddi && (
                      <p className="mt-1 text-sm text-red-400">{errors.ddi.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Telefone
                    </label>
                    <InputMask
                      mask="(99) 99999-9999"
                      type="text"
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

            {/* Endereço */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Endereço
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    CEP
                  </label>
                  <InputMask
                    mask="99999-999"
                    type="text"
                    {...register('cep')}
                    disabled={initialLoading}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => searchCep(e.target.value)}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="00000-000"
                  />
                  {errors.cep && (
                    <p className="mt-1 text-sm text-red-400">{errors.cep.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Logradouro
                  </label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Número
                  </label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Complemento
                  </label>
                  <input
                    type="text"
                    {...register('complement')}
                    disabled={initialLoading}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Complemento (opcional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Bairro
                  </label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Cidade
                  </label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Estado
                  </label>
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

            {/* Informações de Crédito */}
            <div className="bg-black border border-gray-800 rounded-lg p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white">
                Informações de Crédito
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="desiredCredit" className="block text-sm font-medium text-gray-300 mb-1">
                    Valor do Crédito Desejado
                  </label>
                  <div className="mt-1">
                    <CurrencyInput
                      name="desiredCredit"
                      register={register}
                      error={errors.desiredCredit?.message}
                      setValue={setValue}
                      disabled={false}
                    />
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
                      <option value="Antecipação de Recebíveis">Antecipação de Recebíveis</option>
                      <option value="Crédito com garantia de imóvel">Crédito com garantia de imóvel</option>
                      <option value="Crédito para Importação">Crédito para Importação</option>
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
                      <option value="Comprar maquinário ou equipamentos">Comprar maquinário ou equipamentos</option>
                      <option value="Investir em marketing">Investir em marketing</option>
                      <option value="Contratar novos funcionários">Contratar novos funcionários</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('hasRestriction')}
                      disabled={initialLoading}
                      className="h-4 w-4 text-[#D8B25A] focus:ring-[#D8B25A] border-gray-300 rounded bg-black"
                    />
                    <span className="ml-2 text-gray-300">
                      Empresa possui restrição financeira?
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Breve Relato sobre a Empresa
                  </label>
                  <textarea
                    {...register('companyDescription')}
                    disabled={initialLoading}
                    rows={4}
                    className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-600 bg-black text-white placeholder-gray-400 focus:ring-[#D8B25A] focus:border-[#D8B25A] focus:z-10 shadow-sm"
                    placeholder="Descreva brevemente a empresa, seu ramo de atuação e principais produtos/serviços"
                  />
                  {errors.companyDescription && (
                    <p className="mt-1 text-sm text-red-400">{errors.companyDescription.message}</p>
                  )}
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
                    label="Contrato Social"
                    type="social_contract"
                    userId={user.id}
                    document={documents.social_contract}
                    onChange={(doc) => handleDocumentChange('social_contract', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />

                  <LocalDocumentUpload
                    label="Faturamento dos últimos 12 meses"
                    type="revenue_last_12_months"
                    userId={user.id}
                    document={documents.revenue_last_12_months}
                    onChange={(doc) => handleDocumentChange('revenue_last_12_months', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Balanço Patrimonial"
                    type="balance_sheet"
                    userId={user.id}
                    document={documents.balance_sheet}
                    onChange={(doc) => handleDocumentChange('balance_sheet', doc)}
                    onError={(error) => error && handleDocumentError(error)}
                  />
                  
                  <LocalDocumentUpload
                    label="Documento do Sócio"
                    type="partner_document"
                    userId={user.id}
                    document={documents.partner_document}
                    onChange={(doc) => handleDocumentChange('partner_document', doc)}
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
          form="company-form"
          className="px-4 py-2 border border-transparent rounded-md shadow-lg text-sm font-medium text-black bg-[#D8B25A] hover:bg-[#00e090] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D8B25A] flex items-center"
        >
          <Save className="h-4 w-4 mr-2" />
          Salvar Cadastro
        </button>
      </div>

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