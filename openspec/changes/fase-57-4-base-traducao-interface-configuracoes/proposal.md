## Why

A F57.3 separou o idioma da interface (`pt-BR` | `es-419`) do idioma de conteúdo (`pt-BR` |
`es-PY`) e entregou a persistência via `/api/preferences`, validada em produção. Falta a base
de tradução e o primeiro percurso funcional para o lojista escolher o idioma e navegar em
espanhol LATAM sem alterar loja, campanhas ou conteúdo.

## What Changes

- Criar uma fundação de tradução versionada em arquivos, com catálogos `pt-BR` e `es-419`,
  namespaces (`common`, `shell`, `settings`), interpolação, política de chave ausente e
  validação de paridade/cobertura.
- Traduzir somente textos fixos dos componentes compartilhados da área do lojista: sidebar,
  navegação mobile, topbar, menu da conta, rótulos de acessibilidade, badge de novidades e
  sino de notificações. Conteúdo dinâmico permanece como está.
- Reorganizar o menu do usuário para: **Conta** (`/conta`) → **Novidades** → **Configurações**
  (`/configuracoes`) → **Sair**. O link atual “Configurações” que aponta para `/conta` passa a
  se chamar “Conta”.
- Criar a página autenticada `/configuracoes`, disponível também para usuário sem loja, com
  apenas a seção “Idioma do aplicativo”. Sem novo item na sidebar.
- Carregar a preferência no servidor e entregar os textos já no idioma correto, sem requisição
  exclusiva de tradução e sem piscar português antes do espanhol.
- Aplicar a preferência nos próximos acessos após o salvamento, sem reload destrutivo e sem
  perder campos preenchidos.
- Preservar integralmente o contrato de `/api/preferences` (CSRF, CAS, `null`/omitido, 409,
  503/500) e não criar linha ao visitar a página.
- Preservar `/admin` em português, sem seletor e sem propagar o idioma do lojista para a área
  administrativa.
- Não alterar conteúdo de campanhas, país da loja, moeda, cobrança, créditos ou onboarding.

## Capabilities

### New Capabilities

- `ui-localization`: catálogos versionados, namespaces, interpolação, chaves ausentes,
  validação de cobertura, resolução server-first do idioma, fallback de renderização e
  isolamento por usuário.
- `shell-localization`: tradução dos textos fixos da sidebar, drawer mobile, topbar, menu da
  conta, acessibilidade e indicadores compartilhados; exceção do admin em português.
- `app-settings`: rota autenticada `/configuracoes`, entrada no menu do usuário, seção de
  idioma, carregamento/salvamento/erros e aplicação da preferência sem escrita automática.

### Modified Capabilities

- `app-shell`: ordem e rótulos do menu do usuário, inclusão de `/configuracoes` apenas no menu
  da topbar, ausência de novo item na sidebar e rótulos localizados no shell.
- `accessible-drawer`: rótulo de acessibilidade do botão de fechar passa a ser localizado,
  preservando foco, Escape, overlay e foco de retorno.
- `user-locale-preference`: adiciona a resolução de idioma na renderização, com fallback
  explícito para `pt-BR` em falha de leitura, sem alterar os erros de `/api/preferences`.

Comportamentos de acessibilidade do menu da conta, do badge de novidades e do sino de
notificações permanecem os mesmos; apenas seus rótulos passam a vir do catálogo, cobertos por
`shell-localization`.

## Impact

- **Código:** novo `src/lib/i18n/**`; `src/app/(app)/layout.tsx`; `src/app/(app)/configuracoes/`;
  `src/components/shell/*`; `src/components/auth/logout-button.tsx`;
  `src/components/changelog/sidebar-badge.tsx`;
  `src/components/notifications/notification-bell.tsx`; testes co-localizados.
- **APIs:** nenhuma alteração de contrato; `/api/preferences` continua sendo a única escrita.
- **Banco:** nenhuma migration ou alteração de schema; leitura existente via
  `getUserLocalePreference`, com timeout de renderização e sem alterar o cliente global.
- **Dependências:** nenhuma nova dependência prevista.
- **Sistemas:** conteúdo de campanhas, loja, cobrança, créditos, onboarding e admin permanecem
  fora do escopo funcional; `/admin` mantém a composição atual e não é movido de route group.
