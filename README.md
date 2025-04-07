# Dols Capital

Sistema de gestão para propostas de crédito e acompanhamento de clientes.

## Sobre o Projeto

O Dols Capital é uma plataforma desenvolvida para gerenciar propostas de crédito, acompanhar o pipeline de aprovação e administrar informações de clientes. O sistema oferece diferentes níveis de acesso para administradores, gerentes e clientes.

## Funcionalidades Principais

- **Dashboard**: Visualização de métricas e gráficos com dados em tempo real
- **Gestão de Propostas**: Cadastro, visualização, edição e exclusão de propostas de crédito
- **Pipeline**: Acompanhamento do fluxo de aprovação de propostas em formato Kanban
- **Gestão de Clientes**: Cadastro e gerenciamento de clientes (pessoas físicas e jurídicas)
- **Controle de Acesso**: Diferentes níveis de permissão (admin, gerente, cliente)

## Tecnologias Utilizadas

- React
- TypeScript
- Firebase (Firestore, Authentication)
- Tailwind CSS
- React Router
- Recharts (visualização de dados)
- date-fns (formatação de datas)

## Pré-requisitos

- Node.js (versão 14 ou superior)
- NPM ou Yarn
- Conta no Firebase

## Instalação

1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/app-dols-capital.git
cd app-dols-capital
```

2. Instale as dependências
```bash
npm install
# ou
yarn install
```

3. Configure as variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:
```
REACT_APP_FIREBASE_API_KEY=sua-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=seu-auth-domain
REACT_APP_FIREBASE_PROJECT_ID=seu-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=seu-storage-bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=seu-messaging-sender-id
REACT_APP_FIREBASE_APP_ID=seu-app-id
```

4. Inicie o servidor de desenvolvimento
```bash
npm start
# ou
yarn start
```

## Estrutura do Projeto

```
/project
  /src
    /components      # Componentes reutilizáveis
    /contexts        # Contextos React (Auth, Theme)
    /lib             # Configurações e utilitários
    /pages           # Páginas da aplicação
      /dashboard     # Componentes do dashboard
      /register      # Formulários de cadastro
    /assets          # Imagens e outros recursos
```

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para mais detalhes.
