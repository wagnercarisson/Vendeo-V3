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
  | { ok: false; locale: "pt-BR"; errorCode: "preferences_unavailable" | "stored_preferences_invalid" };
```

- Sucesso: usa o `uiLocale` persistido; `legacy_br` resolve `pt-BR`.
- Falha conhecida (`PreferencesUnavailableError`, `StoredPreferencesInvalidError`): retorna
  `pt-BR` com `errorCode`, registra warning sem PII e **não bloqueia** a página existente.
- Erro desconhecido: propaga, para não mascarar bug.
- O layout e `/configuracoes` chamam a mesma função cacheada; uma única leitura por requisição.
- O contrato de `/api/preferences` não muda: a API continua retornando 503/500; o fallback é
  exclusivo da renderização.

**Por que não buscar via HTTP no layout:** exigiria uma requisição interna por navegação e
poderia atrasar o primeiro paint. O serviço existente já é server-only e retorna DTO/versão.

### 4. Mensagens no HTML, sem flash e sem fetch de tradução

- O layout server passa `locale`, `shellMessages` e `commonMessages` ao `AppShell`; o HTML já
  sai no idioma correto.
- `AppShell` aplica `lang={effectiveLocale}` no contêiner raiz do shell e, após hidratação,
  ajusta `document.documentElement.lang` com `useEffect` (sem alterar o texto renderizado).
- O `<html lang="pt-BR">` do root layout permanece para páginas públicas; a área autenticada
  declara o idioma no shell.
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
o layout envia o namespace `shell`/`common` nos dois idiomas apenas para o AppShell. É um
subconjunto pequeno, não o catálogo completo; o custo será medido (ver Riscos). A alternativa
seria separar `/admin` em outro route group com layout próprio, o que muda a composição de
guarda/privacidade e amplia o escopo.

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
- `200`: `router.replace("/configuracoes?saved=1")` para o servidor re-renderizar no novo
  idioma e exibir a confirmação traduzida; sem reload completo, sem perda de dados.
- `409`: mostra mensagem de conflito e botão “Recarregar”; não regrava automaticamente.
  `router.refresh()` traz o valor/versão atuais.
- `503`/`500`: mensagem de indisponibilidade, mantém a seleção e permite tentar novamente.
- `400`: mensagem de validação genérica (não deve ocorrer com opções fixas).
- `401`: mensagem de sessão expirada e link para login; nenhuma escrita.
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
- badge: “Novidades disponíveis”, “Ver novidades”.
- sino: “Notificações” e “Notificações não lidas: {count}”.
- página de configurações: todos os textos próprios e erros de formulário.

Não traduzir: nomes de loja, e-mail, conteúdo de notificações, changelog, campanhas, dados
gerados, mensagens de erro de outras páginas e qualquer texto do admin além do shell.

## Risks / Trade-offs

- **Payload duplicado do shell para suportar admin** → manter apenas `common` + `shell` nos
  dois idiomas, medir bytes e First Load JS; se ultrapassar o orçamento de revisão (proposta:
  ≤ 6 KB gzip para o conjunto do shell), reavaliar a separação de `/admin` em outro route
  group. Não enviar catálogo completo.
- **Flash de português** → textos renderizados no servidor; `lang` do shell definido no HTML.
  O ajuste de `document.documentElement.lang` ocorre após hidratação e não altera texto visível.
- **Falha de leitura da preferência** → fallback `pt-BR` apenas na renderização; API mantém
  503/500. Na página de configurações, falha vira estado de erro, não formulário.
- **Conflito de versão** → 409 não regrava; exige recarregar para evitar overwrite silencioso.
- **Reload ao salvar** → apenas navegação RSC para `/configuracoes?saved=1`; não há formulário
  de campanha nessa página, então não há perda de campos. A troca de idioma não acontece no
  meio de outra tela.
- **Cache compartilhado entre usuários** → nenhum estado mutável de módulo; `cache()` é por
  requisição/usuário; mensagens são imutáveis e passadas por props.
- **Cobertura de tradução** → teste de paridade/placeholders; revisão humana do espanhol LATAM.
- **Admin** → shell forçado a `pt-BR` por pathname; sem link de configurações; conteúdo do
  admin intocado.

## Migration Plan

- Sem migration de banco. Nenhuma alteração de schema ou API.
- Implementação local: catálogos, shell, página e testes; gates typecheck/lint/build.
- Homolog: validar com usuário de teste com loja e sem loja; conferir menu, salvamento,
  persistência, 409/erro, admin em português e ausência de flash; medir payload em rede
  limitada.
- Publicação: deploy normal após revisão; a preferência já persistida continua válida.
- Rollback: reverter o código; preferências `es-419` permanecem no banco e passam a ser
  exibidas em português por ausência de tradução, sem corrupção de dados. Nenhuma migration
  reversa é necessária.
- Admin e conteúdo não dependem de flag; não há ativação separada nesta fatia.

## Open Questions

1. **Admin:** aprovar o pequeno payload duplicado de `common` + `shell` (recomendado) ou exigir
   a separação de `/admin` em outro route group com layout próprio? A segunda opção amplia a
   mudança de composição do shell.
2. **Revisão do espanhol LATAM:** quem aprova os textos? A proposta usa termos neutros
   (“Configuración”, “Idioma de la aplicación”, “Guardar cambios”) e rótulos endônimos para as
   opções; a redação final precisa de revisão humana antes da publicação.
3. **Rótulo da página:** “Configurações”/“Configuración” no singular é a recomendação; confirmar
   se o produto prefere “Configurações”/“Configuraciones”.
