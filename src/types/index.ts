export type UserRole = 'client' | 'manager' | 'admin' | 'partner';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  registrationType?: 'PF' | 'PJ';
  team?: string; // ID da equipe a que o usuário pertence
  roleId: string; // ID do perfil no Firestore
  roleKey: string; // Chave do perfil (ex: 'admin', 'manager', 'client')
  roleName: string; // Nome do perfil para exibição
}

// Interface para equipes
export interface Team {
  id: string;
  name: string;
  managerId: string; // ID do gerente responsável pela equipe
  members: string[]; // IDs dos membros da equipe
  teamCode?: string; // Código de 4 dígitos para vinculação de clientes
  createdAt: Date;
  managerName?: string; // Nome do gerente (usado apenas para exibição)
  membersCount?: number; // Contagem de membros (usado apenas para exibição)
}

export interface Address {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  localidade: string;
  uf: string;
  numero: string;
}

export interface IndividualRegistration {
  id: string;
  cpf: string;
  name: string;
  email: string;
  ddi: string;
  phone: string;
  address: Address;
  hasProperty: boolean;
  propertyValue?: number;
  desiredCredit: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyRegistration {
  id: string;
  cnpj: string;
  companyName: string;
  simples: boolean;
  constitutionDate: Date;
  revenue: string;
  legalRepresentative: string;
  partnerCpf: string;
  partnerEmail: string;
  ddi: string;
  phone: string;
  address: Address;
  creditLine: string;
  creditReason: string;
  desiredCredit: number;
  hasRestriction: boolean;
  companyDescription: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  name: string;
  url: string;
  type: string;
  registrationId: string;
  uploadedAt: Date;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  clientId: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  documents: string[];
  createdAt: Date;
  updatedAt: Date;
  managerId?: string;
  feedback?: string;
}