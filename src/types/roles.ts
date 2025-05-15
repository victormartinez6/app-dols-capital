export type DataScope = 'all' | 'team' | 'own';

export interface PagePermission {
  view: boolean;
  [key: string]: boolean | DataScope;
}

export interface ClientsPermission extends PagePermission {
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
  sendMessage: boolean;
  viewDocuments: boolean;
  uploadDocuments: boolean;
  scope: DataScope;
}

export interface ProposalsPermission extends PagePermission {
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  reject: boolean;
  changeStatus: boolean;
  addObservation: boolean;
  scope: DataScope;
}

export interface PipelinePermission extends PagePermission {
  dragDrop: boolean;
  addObservation: boolean;
  scope: DataScope;
}

export interface UsersPermission extends PagePermission {
  create: boolean;
  edit: boolean;
  delete: boolean;
  changeRole: boolean;
  resetPassword: boolean;
}

export interface TeamsPermission extends PagePermission {
  create: boolean;
  edit: boolean;
  delete: boolean;
  generateCode: boolean;
}

export interface RolesPermission extends PagePermission {
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface SettingsPermission extends PagePermission {
  edit: boolean;
}

export interface WebhooksPermission extends PagePermission {
  create: boolean;
  edit: boolean;
  delete: boolean;
  test: boolean;
}

export interface MyRegistrationPermission extends PagePermission {
  edit: boolean;
}

export interface MarketingPermission extends PagePermission {
  upload: boolean;
  delete: boolean;
  download: boolean;
  scope: DataScope;
}

export interface DashboardPermission extends PagePermission {
  scope: DataScope;
}

export interface RoleMenus {
  dashboard: boolean;
  clients: boolean;
  proposals: boolean;
  pipeline: boolean;
  teams: boolean;
  roles: boolean;
  users: boolean;
  settings: boolean;
  webhooks: boolean;
  myRegistration: boolean;
  marketing: boolean;
}

export interface RolePages {
  dashboard: DashboardPermission;
  clients: ClientsPermission;
  proposals: ProposalsPermission;
  pipeline: PipelinePermission;
  users: UsersPermission;
  teams: TeamsPermission;
  roles: RolesPermission;
  settings: SettingsPermission;
  webhooks: WebhooksPermission;
  myRegistration: MyRegistrationPermission;
  marketing: MarketingPermission;
}

export interface Role {
  id: string;
  name: string;
  key: string;
  menus: RoleMenus;
  pages: RolePages;
  createdAt?: Date;
  updatedAt?: Date;
}
