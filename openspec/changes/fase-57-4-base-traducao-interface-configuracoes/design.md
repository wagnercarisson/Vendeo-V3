## Context

A F57.3 entregou o contrato do idioma da interface (`pt-BR` | `es-419`), a persistência em
`user_preferences` e `/api/preferences`, validados em produção. A UI ainda é monolíngue em
português e não há catálogo, resolvedor de idioma nem página de configurações.

O shell da área do lojista é compartilhado com `/admin`: `(app)/layout.tsx` renderiza `AppShell`
para todas as rotas filhas, incluindo `/admin/*`. O admin está fora do escopo e deve continuar
em português, sem seletor e sem herdar o idioma do lojista.

Restrições relevantes:
- Next.js App Router + React 19; `(app)/layout.tsx` é Server Component e `AppShell` é Client
  Component.
- `getUserLocalePreference` já lê a preferência no servidor; `/api/preferences` já implementa
  CAS, CSRF e erros.
- Nenhuma dependência nova é necessária; catálogos em Git.
- Conteúdo de campanha, loja, cobrança e onboarding não entram na tradução.

## Goals / Non-Goals

**Goals:**
- Catálogos versionados, tipados e validados para `pt-BR` e `es-419`, com namespaces
  `common`, `shell` e `settings`.
- Resolver o idioma no servidor e entregar os textos já renderizados, sem requisição de
  tradução e sem flash de português.
- Traduzir o shell compartilhado do lojista e manter `/admin` em português.
- Criar `/configuracoes` autenticada, sem dependência de loja, com leitura inicial server-side
  e escrita exclusiva via `/api/preferences`.
- Aplicar o novo idioma após salvar sem reload completo e sem perda de dados.
- Preservar o contrato de erros/CAS da API e o comportamento de `null`/omitido.

**Non-Goals:**
- Traduzir páginas de dashboard, conta, loja, campanhas, login/cadastro ou novidades.
- Traduzir conteúdo dinâmico, notificações, changelog, dados do lojista ou campanhas.
- Criar seletor no admin, alterar o admin ou propagar o idioma para ele.
- URLs por idioma, SEO multilíngue, detecção por IP/navegador.
- Novas migrations, colunas, tabelas ou alterações em `/api/preferences`.
- Reorganizar `/conta` ou mover seu conteúdo.
- Nova dependência de i18n ou serviço externo de tradução.

## Decisions

### 1. Catálogo próprio, tipado e sem dependência

Criar `src/lib/i18n/` com:
- `locales.ts` — reutiliza `SUPPORTED_UI_LOCALES`/`SupportedUiLocale` da fundação F57.3;
  `DEFAULT_UI_LOCALE = "pt-BR"`.
- `catalogs/pt-BR.ts` — fonte de verdade das chaves e textos.
- `catalogs/es-419.ts` — mesmo tipo, com paridade validada.
- `messages.ts` — tipos `CommonMessages`, `ShellMessages`, `SettingsMessages`, `Messages`.
- `translate.ts` — `formatMessage(template, params)` com interpolação `{name}`; sem avaliação
  dinâmica, sem HTML.
- `server.ts` — leitura cacheada da preferência e montagem do contexto de renderização.
- `client.tsx` — provider opcional para componentes cliente que não recebem messages por prop.

Namespaces:
- `common`: ações reutilizáveis de formulário (`save`, `retry`, `loading`).
- `shell`: navegação, topbar, menu da conta, acessibilidade e indicadores.
- `settings`: título, seção, opções, confirmação e erros da página de configurações.

**Por que não next-intl/react-intl/lingui:** a fatia é pequena, não há rotas por idioma,
pluralização complexa ou tradução em runtime. Uma dependência aumentaria bundle/configuração
sem benefício proporcional. O catálogo tipado cobre paridade e interpolação.

### 2. Paridade, interpolação e chaves ausentes

- `pt-BR` define o tipo; `es-419` deve satisfazer exatamente o mesmo tipo. Chave faltante ou
  namespace divergente quebra o typecheck.
- Teste dedicado achata as chaves dos três namespaces e compara os dois catálogos; também
  compara placeholders `{...}` de cada string, impedindo interpolação divergente.
- Em runtime, `translate(catalog, fallbackCatalog, key, params)`:
  - usa o catálogo do locale;
  - se a chave estiver ausente, usa `pt-BR`;
  - se também estiver ausente, retorna a própria chave e registra aviso apenas em
    desenvolvimento.
- Nunca traduz durante a renderização: apenas seleciona strings já versionadas.

### 3. Resolução server-first e cache por requisição

`(app)/layout.tsx` já tem o usuário autenticado. Adicionar
`getUiRenderContext(user.userId)` em `src/lib/i18n/server.ts`, envolvido por `cache()` do React:

```ts
type UiRenderContext =
  | { ok: true; locale: SupportedUiLocale; preference: UserLocalePreferenceDTO }
  | {
      ok: false;
      locale: "pt-BR";
      errorCode:
        | "preferences_unavailable"
        | "stored_preferences_invalid"
        | "preferences_read_timeout";
    };
```

- Sucesso: usa o `uiLocale` persistido; `legacy_br` resolve `pt-BR`.
- Falha conhecida (`PreferencesUnavailableError`, `StoredPreferencesInvalidError`): retorna
  `pt-BR` com `errorCode`, registra warning sem PII e **não bloqueia** a página existente.
- Erro desconhecido: propaga, para não mascarar bug.
- O layout e `/configuracoes` chamam a mesma função cacheada; uma única leitura por requisição.
- O contrato de `/api/preferences` não muda: a API continua retornando 503/500; o fallback é
  exclusivo da renderização.

**Limite de espera:** a leitura adicional no layout SHALL ser limitada por
`UI_LOCALE_READ_TIMEOUT_MS = 200`. A implementação usa `Promise.race` entre a leitura existente e
um timer, sem alterar o cliente Supabase global, sem novo client e sem timeout em outras
consultas. Se o limite estourar, o layout usa `pt-BR` e registra
`preferences_read_timeout`; a promise original continua isolada com `catch` para não gerar
unhandled rejection. Em `/configuracoes`, o timeout produz estado de erro com retry, pois a página
precisa da versão para salvar. O valor de 200 ms é um orçamento de revisão e SHALL ser medido em
homolog sob latência simulada.

**Por que não buscar via HTTP no layout:** exigiria uma requisição interna por navegação e
poderia atrasar o primeiro paint. O serviço existente já é server-only e retorna DTO/versão.

### 4. Mensagens no HTML, sem flash e sem fetch de tradução

- O layout server passa `locale`, `shellMessages` e `commonMessages` ao `AppShell`; o HTML já
  sai no idioma correto.
- O documento permanece `lang="pt-BR"`. A fatia **não** altera globalmente
  `document.documentElement.lang`, porque dashboard, conta, campanhas e demais páginas continuam
  em português.
- Apenas as regiões efetivamente traduzidas declaram `lang`:
  - sidebar e drawer (`nav`/painel);
  - CTA, hamburger, sino e menu da conta na topbar;
  - conteúdo traduzido de `/configuracoes`.
- Regiões com conteúdo dinâmico não traduzido (nome da loja, e-mail, notificações) não recebem
  `lang` de espanhol.
- Nenhum catálogo completo vai ao cliente: o shell recebe apenas `common` + `shell`; a página
  de configurações recebe apenas `settings` + `common`.
- Nenhuma requisição de rede é feita para obter traduções.

### 5. Exceção do admin sem refatorar o route group

`AppShell` é client e pode usar `usePathname()`. Para `pathname.startsWith("/admin")`:
- `effectiveLocale = "pt-BR"`;
- renderiza o shell em português;
- o menu da conta preserva o comportamento atual do admin: “Configurações” → `/conta`,
  “Novidades”, “Sair”, sem link para `/configuracoes`.

Para permitir isso sem consulta extra no servidor nem mover `/admin` para outro route group,
o layout envia o namespace `shell`/`common` em `pt-BR` e, **somente quando o locale do usuário
for `es-419`**, também o namespace em `es-419`. Usuários em `pt-BR` recebem apenas o catálogo
português; usuários em espanhol recebem o espanhol (para o lojista) e o português (para a
exceção do admin). É um subconjunto pequeno, não o catálogo completo; o custo será medido (ver
Riscos). A alternativa seria separar `/admin` em outro route group com layout próprio, o que
muda a composição de guarda/privacidade e amplia o escopo; ela não será usada nesta fase.

### 6. Página `/configuracoes`

Arquivos:
- `src/app/(app)/configuracoes/page.tsx` (Server Component)
- `src/app/(app)/configuracoes/loading.tsx`
- `src/components/settings/settings-language-form.tsx` (Client Component)
- `src/components/settings/__tests__/*`

Fluxo:
1. `requirePageUser()`; sem dependência de loja (não chama `getCurrentStore`).
2. `getUiRenderContext(user.userId)` cacheado.
3. Se leitura falhou: renderiza card de erro traduzido com botão “Tentar novamente”
   (`router.refresh()`), sem formulário e sem escrita.
4. Se sucesso: `PageHeader` “Configurações”/“Configuración”, breadcrumb Dashboard → Configurações,
   e `SettingsLanguageForm` com `{ uiLocale, version }`.
5. Formulário: `fieldset` + `legend` “Idioma do aplicativo”, dois radios nativos:
   - “Português (Brasil)” → `pt-BR`
   - “Español (Latinoamérica)” → `es-419`
   Botão “Salvar”/“Guardar cambios”, desabilitado quando não há mudança ou durante o envio.
6. Nenhum efeito dispara PATCH no mount. Visitar a página só faz leitura.

Salvamento:
- `PATCH /api/preferences` com `{ uiLocale: selected, expectedVersion: version }` e
  `Content-Type: application/json`; mesma origem/CSRF do navegador.
- `200`: atualizar seleção/versão locais a partir do DTO retornado, marcar confirmação de
  salvamento real e chamar `router.refresh()` para re-renderizar o layout compartilhado e a
  página juntos, sem reload completo e sem perda de dados.
- A confirmação SHALL depender do sucesso do PATCH, não da presença de query string. Não usar
  `?saved=1`.
- `router.refresh()` SHALL atualizar shell e configurações na mesma operação; o formulário SHALL
  sincronizar `uiLocale`/`version` com as novas props do servidor sem apagar a confirmação.
- Trocas repetidas `pt-BR → es-419 → pt-BR` SHALL funcionar com o mesmo fluxo, mantendo seleção e
  versão sincronizadas após cada sucesso.
- `409`: mostra mensagem de conflito e botão “Recarregar”; não regrava automaticamente.
  `router.refresh()` traz o valor/versão atuais e o formulário sincroniza a seleção.
- `403`: mensagem de origem/CSRF inválida, mantém a seleção e orienta recarregar a página.
- Falha de rede/interrupção: mensagem de conexão, mantém a seleção e permite tentar novamente.
- `503`/`500`: mensagem de indisponibilidade, mantém a seleção e permite tentar novamente.
- `400`: mensagem de validação genérica (não deve ocorrer com opções fixas).
- `401`: mensagem de sessão expirada e link para login; nenhuma escrita.
- Em qualquer erro, o estado “salvando” SHALL ser encerrado em `finally`, os controles SHALL
  voltar a ficar disponíveis e a seleção SHALL permanecer.
- `null` e omitido não são expostos na UI; o significado da API permanece intacto.

### 7. Menu do usuário e sidebar

- Ordem no menu: Conta (`/conta`, ícone `UserCircle`) → Novidades (`/novidades`, `Sparkles`) →
  Configurações (`/configuracoes`, `Settings`) → Sair (`LogoutButton`, `LogOut`).
- O item atual “Configurações” que aponta para `/conta` é renomeado para “Conta”.
- A sidebar mantém exatamente os cinco itens atuais; nenhum item novo.
- No admin, o menu permanece com “Configurações” → `/conta` e sem `/configuracoes`.

### 8. Textos traduzidos e limites

Traduzir apenas:
- sidebar: Dashboard, Campanhas, Loja, Conta, Novidades, `aria-label` “Navegação principal”.
- drawer: `aria-label` do diálogo, “Fechar menu”, títulos de acessibilidade.
- topbar: “Nova Campanha”, `aria-label` “Criar nova campanha”, “Abrir menu de navegação”,
  nome da marca não traduzido.
- menu da conta: “Menu da conta”, “Conta”, “Novidades”, “Configurações”, “Sair”, fallback
  “Usuário”.
- botão de saída (`src/components/auth/logout-button.tsx`): recebe `label` por prop, com padrão
  “Sair” para consumidores não traduzidos (`/conta`, admin). O shell passa o rótulo do catálogo.
  O componente NÃO deve depender de provider de i18n, e o logout/limpeza de rascunhos permanece
  integral.
- badge: “Novidades disponíveis”, “Ver novidades”.
- sino: “Notificações” e “Notificações não lidas: {count}”.
- página de configurações: todos os textos próprios e erros de formulário.

Não traduzir: “Vendeo”, nomes de loja, e-mail, conteúdo de notificações, changelog, campanhas,
dados gerados, mensagens de erro de outras páginas e qualquer texto do admin além do shell.

## Risks / Trade-offs

- **Payload duplicado do shell para suportar admin** → enviar `common` + `shell` em `pt-BR`
  sempre e o conjunto em `es-419` apenas quando o usuário estiver em espanhol. Medir bytes e
  First Load JS; orçamento de revisão: ≤ 6 KB gzip para o conjunto do shell. Não enviar catálogo
  completo e não reorganizar `/admin` nesta fase.
- **Leitura de preferência lenta** → timeout de 200 ms no layout via `Promise.race`, fallback
  `pt-BR` e log `preferences_read_timeout`; sem alterar o cliente Supabase global. Medir em
  homolog com latência simulada; se o orçamento atrasar páginas, reduzir ou rever a estratégia.
- **Flash de português** → textos renderizados no servidor; nenhuma troca client-side de
  catálogo. O documento permanece `pt-BR` e apenas regiões traduzidas recebem `lang="es-419"`.
- **Acessibilidade de páginas não traduzidas** → não declarar `es-419` em dashboard, conta,
  campanhas ou conteúdo dinâmico; evitar que leitores de tela pronunciem português como espanhol.
- **Falha de leitura da preferência** → fallback `pt-BR` apenas na renderização; API mantém
  503/500. Na página de configurações, falha/timeout vira estado de erro, não formulário.
- **Conflito de versão** → 409 não regrava; exige recarregar para evitar overwrite silencioso.
- **Atualização do shell após salvar** → `router.refresh()` explícito após 200, com confirmação
  local baseada no DTO real; não usar `?saved=1`. Testar trocas repetidas.
- **Reload ao salvar** → `router.refresh()` não é reload completo; a página de configurações não
  contém outros campos em edição, então não há perda de dados.
- **Cache compartilhado entre usuários** → nenhum estado mutável de módulo; `cache()` é por
  requisição/usuário; mensagens são imutáveis e passadas por props.
- **Cobertura de tradução** → teste de paridade/placeholders; textos espanhóis preparados pelo
  executor, revisados pelo Codex e aprovados na validação visual.
- **Admin** → shell forçado a `pt-BR` por pathname; sem link de configurações; composição atual
  preservada; conteúdo do admin intocado.

## Migration Plan

- Sem migration de banco. Nenhuma alteração de schema ou API.
- Implementação local: catálogos, shell, página e testes; gates typecheck/lint/build.
- Homolog: validar com usuário de teste com loja e sem loja; conferir menu, salvamento,
  persistência, trocas repetidas, 409/rede/403, admin em português, ausência de flash e
  declaração de `lang` apenas nas regiões traduzidas; medir payload e timeout em rede limitada.
- Publicação: deploy normal após revisão; a preferência já persistida continua válida.
- Rollback: reverter o código; preferências `es-419` permanecem no banco e passam a ser
  exibidas em português por ausência de tradução, sem corrupção de dados. Nenhuma migration
  reversa é necessária.
- Admin e conteúdo não dependem de flag; não há ativação separada nesta fatia.

## Open Questions

Nenhuma decisão pendente após a revisão:

- **Admin:** manter a composição atual; não separar route groups. Exceção pequena e medida:
  catálogo `pt-BR` do shell sempre presente; `es-419` adicional apenas para usuários em espanhol.
- **Rótulo:** “Configurações” / “Configuración” no singular.
- **Textos espanhóis:** executor prepara; Codex revisa consistência; aprovação final do
  responsável na validação visual, sem revisor externo.
