# Avantar Authenticator – Documentação

## Visão Geral

Este projeto é um sistema de autenticação de dois fatores (2FA) para franqueados, com integração a múltiplos serviços e monitoramento de códigos enviados por e-mail. Ele utiliza autenticação TOTP (Google Authenticator/OTP) e também monitora caixas de e-mail para capturar códigos automaticamente, exibindo-os em tempo real na interface web.

## Estrutura de Pastas

```
2fa-app-avantar/
├── app/                # Código principal Next.js (páginas, rotas API)
│   ├── api/            # Rotas de API (TOTP, usuários, e-mails, sessão)
│   ├── dashboard/      # Dashboard principal do usuário
│   ├── admin/          # Página de administração
│   └── ...
├── components/         # Componentes React reutilizáveis
├── contexts/           # Contextos globais (ex: AuthContext)
├── lib/                # Integrações e utilitários (Firebase, logs, etc)
├── hooks/              # Hooks customizados
├── functions/          # Cloud Functions (Node.js)
├── public/             # Assets públicos (imagens, logos)
├── styles/             # Estilos globais
├── EMAIL_SETUP.md      # Guia detalhado de configuração de e-mails
├── README.md           # Este arquivo
└── ...
```

## Tecnologias Utilizadas

- **Next.js** (React, API Routes)
- **Firebase** (Auth, Firestore, Storage, Admin SDK)
- **TailwindCSS** (estilização)
- **Radix UI** (componentes acessíveis)
- **Speakeasy** (TOTP)
- **IMAP/Mailparser** (monitoramento de e-mails)
- **TypeScript**

## Fluxo de Autenticação e Funcionalidades

- **Login:**
  - Usuário faz login com e-mail e senha (Firebase Auth)
  - Sessão persistente via cookies e localStorage
- **2FA TOTP:**
  - Usuário pode cadastrar segredos TOTP (Google Authenticator, etc)
  - Geração e validação de tokens via API (`/api/totp`)
- **Monitoramento de E-mails:**
  - Sistema monitora caixas IMAP para capturar códigos de 6 dígitos
  - Códigos são exibidos em tempo real na dashboard
  - Configuração detalhada em [`EMAIL_SETUP.md`](./EMAIL_SETUP.md)
- **Administração:**
  - Criação e remoção de usuários via painel admin ou API
  - Controle de permissões (admin/user)

## Como Rodar Localmente

1. **Pré-requisitos:**
   - Node.js 18+
   - Conta Firebase (Auth, Firestore, Storage)
   - Configurar variáveis de ambiente (`.env.local`)

2. **Instale as dependências:**
   ```bash
   npm install
   # ou
   pnpm install
   ```

3. **Configure o Firebase:**
   - Preencha as variáveis `NEXT_PUBLIC_FIREBASE_*` no `.env.local`
   - Para recursos admin, configure as variáveis do serviço no backend

4. **Configuração de E-mails:**
   - Siga o guia em [`EMAIL_SETUP.md`](./EMAIL_SETUP.md)

5. **Rode o projeto:**
   ```bash
   npm run dev
   # ou
   pnpm dev
   ```

6. **Acesse:**
   - [http://localhost:3000](http://localhost:3000)

## Pontos de Atenção para Manutenção

- **Variáveis de ambiente:** Nunca suba `.env` para o repositório.
- **Firebase Admin:** Só inicialize no backend (verifique `lib/firebase-admin.ts`).
- **Permissões Firestore:** Mantenha as regras seguras (`firestore.rules`).
- **Atualização de dependências:** Sempre teste após atualizar pacotes.
- **Monitoramento de e-mails:**
  - Se adicionar/remover caixas, atualize as variáveis e o watcher.
  - Regex de código pode ser ajustada em `lib/email-watcher.ts`.
- **Funções Cloud:**
  - As funções em `/functions` podem ser deployadas no Firebase Functions.

## Boas Práticas para Contribuir

- Sempre escreva código tipado (TypeScript)
- Prefira componentes reutilizáveis
- Documente endpoints e funções complexas
- Teste localmente antes de subir PR
- Use commits descritivos

## Links Úteis

- [Guia de configuração de e-mails](./EMAIL_SETUP.md)
- [Documentação Firebase](https://firebase.google.com/docs)
- [Documentação Next.js](https://nextjs.org/docs)
- [Documentação Radix UI](https://www.radix-ui.com/docs/primitives/overview/introduction)

---

Dúvidas ou sugestões? Abra um chamado ou entre em contato direto com o comigo (Bruno). 