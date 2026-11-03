---
quick_id: 261103-cpv
phase: quick
plan: 01
type: plan
wave: 1
depends_on: []
autonomous: false
status: complete
revision: 2
diff_review: complete
visual_acceptance: accepted_by_owner_local
visual_acceptance_date: 2026-11-03
closure: complete
production_acceptance: confirmed_reported_by_owner
production_acceptance_date: 2026-11-03
revision_notes: "Revisão 2 (2026-11-03): gate derivado das condições reais de renderização; marcação es-419 alcança header/breadcrumb e interface fora do recorte recebe lang=pt-BR; homolog exige campanha sem recuperação pendente/ativa; espanhol unificado (¡Copiado! / texto de la publicación); P1 e P2 decididos."
approval_required: true
implementation_authorized: true
implementation_status: complete
implementation_date: 2026-11-03
validation_homolog_authorized: false
homolog_status: not_executed_by_agent
gate3: not_executed_by_agent
publication_authorized: true
publication_status: executed_reported_by_owner
publication_date: 2026-11-03
agent_production_smoke: not_executed
sync_archive: not_applicable_main_specs_updated_directly
base_sha: cfb729b38eed1d9fde5d08a7fcf763f2e6aef209
head_at_planning: 62c2f341d4dc1314bde420b1a70ad3adf55419a7
branch: feature/traducao-da-interface-da-campanha-pronta
files_modified:
  - src/lib/i18n/campaign-detail/messages.ts
  - src/lib/i18n/campaign-detail/catalogs/pt-BR.ts
  - src/lib/i18n/campaign-detail/catalogs/es-419.ts
  - src/lib/i18n/campaign-detail/get-messages.ts
  - src/lib/i18n/campaign-detail/index.ts
  - src/lib/i18n/campaign-detail/__tests__/catalogs.test.ts
  - src/lib/i18n/campaign-detail/__tests__/isolation.test.ts
  - src/app/(app)/campanhas/[id]/page.tsx
  - src/app/(app)/campanhas/[id]/client.tsx
  - src/components/ui/page-header.tsx
  - src/__tests__/components/ui/page-header.test.tsx
  - src/__tests__/app/campanha/[id]/client.test.tsx
  - src/__tests__/app/campanhas/campaign-detail-page.test.tsx
  - src/__tests__/api/campaign-page.test.tsx
  - src/__tests__/api/campaign-page-server.test.tsx
  - src/__tests__/api/campaign-approval-view-problem.test.tsx
  - src/app/(app)/campanhas/[id]/__tests__/persisted-state.test.tsx
  - src/app/(app)/campanhas/[id]/__tests__/copy-recovery-driving.test.tsx
  - src/app/(app)/campanhas/[id]/__tests__/page-read-failure.test.tsx
  - src/lib/product-1-1/__tests__/copy-wiring-gaps.contract.test.ts
  - openspec/specs/campaign-page-ui/spec.md
  - openspec/specs/campaign-page-tests/spec.md
  - openspec/specs/ui-base-components/spec.md
  - .planning/quick/261103-cpv-localizar-interface-da-campanha-pronta/evidence/
must_haves:
  truths:
    - "Usuário com uiLocale=es-419 abre uma campanha pronta (legado ou novo fluxo delivered) e vê breadcrumb, título de fallback, rótulos, botões e mensagens das ações de copiar/baixar em espanhol neutro LATAM."
    - "Usuário com uiLocale=pt-BR vê exatamente os mesmos textos fixos de hoje, sem lang=\"es-419\" na página."
    - "Nome do produto, caption, hashtags, CTA, título da copy do novo fluxo, data, imagem e arquivo baixado permanecem idênticos nos dois idiomas; nada é traduzido, regenerado ou recalculado."
    - "Conteúdo persistido não herda o idioma da interface: produto/copy recebem lang=\"\" e a marcação es-419 fica restrita à interface traduzida da entrega pronta."
    - "URLs, downloadUrl, PATCH de publication-copy, polling, flags, consultas, eventos, estados e autorização permanecem inalterados."
    - "Estados fora do recorte (running, refunded, unknown, regenerating, approval pending, stale, error, recovery de copy) mantêm o comportamento e os textos atuais."
    - "O catálogo da campanha pronta não entra no payload global do shell e não é importado por layout, shell ou admin."
  artifacts:
    - path: "src/lib/i18n/campaign-detail/"
      provides: "Namespace isolado de textos fixos da campanha pronta, com paridade pt-BR/es-419 e resolvedor por SupportedUiLocale"
    - path: "src/app/(app)/campanhas/[id]/page.tsx"
      provides: "Resolução server-first do idioma e entrega apenas do namespace da rota ao cliente"
    - path: "src/app/(app)/campanhas/[id]/client.tsx"
      provides: "Visualização pronta localizada, preservando arte, copy, URLs e ações"
    - path: "src/components/ui/page-header.tsx"
      provides: "Marcação opcional de idioma no título e no breadcrumb, com padrão atual inalterado"
  key_links:
    - from: "src/app/(app)/campanhas/[id]/page.tsx"
      to: "src/lib/i18n/server.ts"
      via: "getUiRenderContext"
      pattern: "getUiRenderContext"
    - from: "src/app/(app)/campanhas/[id]/page.tsx"
      to: "src/lib/i18n/campaign-detail/get-messages.ts"
      via: "getCampaignDetailMessages"
      pattern: "getCampaignDetailMessages"
    - from: "src/app/(app)/campanhas/[id]/client.tsx"
      to: "src/components/ui/page-header.tsx"
      via: "titleLang / breadcrumb lang"
      pattern: "titleLang"
user_setup: []
---

# Localizar a interface da campanha pronta (`/campanhas/[id]`) para pt-BR e es-419

**Objetivo:** completar a navegação já localizada da listagem. Um usuário com interface `es-419` abre uma campanha pronta existente, visualiza a arte e o conteúdo sem alteração e usa as ações existentes de copiar e baixar com os textos fixos da interface em espanhol neutro LATAM.

**Estado desta entrega:** **somente plano**. Nenhum código, teste, catálogo, spec, campanha, preferência, banco ou ambiente foi alterado. Nenhum commit foi criado nesta etapa. A implementação permanece bloqueada até aprovação explícita (Gate 1).

---

## 1. Contexto verificado (antes de planejar)

### Git / worktree / quick anterior

- Branch atual: `feature/traducao-da-interface-da-campanha-pronta`.
- `HEAD = 62c2f341` (`docs(quick-261103-jjc): close with reported production acceptance`).
- `origin/main = cfb729b3`; a branch está **1 commit à frente** e `origin/main` é ancestral de `HEAD`. Esse commit é o fechamento documental da quick `261103-jjc` — **preservar**.
- Worktree único: `C:\Projetos\Vendeo V3`; `git status --porcelain` vazio antes deste plano.
- Quick `261103-jjc`: `SUMMARY.md` com `status: complete`, `homolog: executed_pass_with_limitations`, `publication: executed_by_responsible` e aceite de produção **relatado pelo responsável**. Nenhum smoke de produção foi executado pelo agente. Fechamento conferido e preservado.
- Quick `261103-hlq` (listagem): já integrada em `origin/main`; o padrão de namespace/resolução server-first será reutilizado, não reescrito.
- Nenhuma troca de branch, merge, pull, restart de aplicação, instalação de dependência ou acesso a ambiente nesta etapa.

### Fundação reutilizada

- `getUiRenderContext` (`src/lib/i18n/server.ts`) — resolução server-first, `cache()` por requisição, timeout único de 1000 ms. **Não alterar.**
- `SupportedUiLocale` (`src/lib/i18n/locales.ts`) — `pt-BR` | `es-419`. **Não criar resolvedor paralelo.**
- Padrão de namespace por rota: `src/lib/i18n/dashboard/**`, `src/lib/i18n/campaign-list/**`, `src/lib/i18n/novidades/**` — tipos explícitos, catálogos congelados, `satisfies`, testes de catálogo e isolamento, barrel local **não** reexportado por `src/lib/i18n/index.ts`.
- `src/app/(app)/layout.tsx` já chama `getUiRenderContext(user.userId)`; a chamada na página será deduplicada pelo `cache()`.

### Código real da rota

- `src/app/(app)/campanhas/[id]/page.tsx` (Server Component):
  - resolve usuário, loja, campanha e props de exibição; mantém o caminho legado (F37) e o caminho do novo fluxo Product 1:1 (`props.newFlow`), com classificação persistida e fail-closed.
  - **não contém texto de interface**; devolve `<CampaignPageClient {...props} />` em três pontos (unknown, novo fluxo e legado).
- `src/app/(app)/campanhas/[id]/client.tsx` (Client Component):
  - concentra header/breadcrumb e as views `ReadyView` (legado) e `NewFlowDeliveredView` (novo fluxo `delivered`), além de `CopyButton` e `NewFlowCopyPanel`.
  - também concentra fluxos **fora do recorte**: `GeneratingView`, `RegeneratingView`, `StaleView`, `ErrorView`, `RefundedPanel`, `UnknownResultPanel`, `CopyRecoveryPanel` e `CampaignApprovalView`.
- `src/components/ui/page-header.tsx`: recebe `title: string` e breadcrumbs `{ label, href? }`; renderiza `<h1>` e `<Link>/<span>` sem marcação de idioma.
- `src/app/(app)/campanhas/[id]/loading.tsx`: apenas skeleton, **sem texto fixo**.
- `src/app/api/campaign/[id]/download/route.ts`: entrega bytes e filename; **não será tocado**.

### Consumidores e testes que tocam o cliente

Testes que renderizam `campanhas/[id]/client` e precisarão do novo contrato de props:

- `src/__tests__/app/campanha/[id]/client.test.tsx`
- `src/__tests__/api/campaign-page.test.tsx`
- `src/__tests__/api/campaign-approval-view-problem.test.tsx`
- `src/app/(app)/campanhas/[id]/__tests__/persisted-state.test.tsx`
- `src/app/(app)/campanhas/[id]/__tests__/copy-recovery-driving.test.tsx`

Testes do Server Component que precisarão mockar `getUiRenderContext`:

- `src/__tests__/api/campaign-page-server.test.tsx`
- `src/__tests__/app/campanhas/campaign-detail-page.test.tsx`
- `src/app/(app)/campanhas/[id]/__tests__/page-read-failure.test.tsx`

Achado relevante: `src/lib/product-1-1/__tests__/copy-wiring-gaps.contract.test.ts` faz **grep do código-fonte** e exige `clientSource.toContain("Kit de Publicação")`. Ao mover a string para o catálogo, esse contrato **quebra** e deve ser atualizado para a nova chave, mantendo a intenção (o painel de copy existe e não oferece retry).

### Specs pertinentes

- `openspec/specs/campaign-page-ui/spec.md` — estados da página e entrega pronta.
- `openspec/specs/campaign-page-tests/spec.md` — testes da página/estados.
- `openspec/specs/ui-base-components/spec.md` — contrato do `PageHeader`.
- Revisados e **sem alteração**: `campaign-download-route` (rota intocada), `campaign-approval-gate` (fora do recorte), `product-1-1-copy-recovery` (fora do recorte), `ui-localization` (fundação global), `microcopy-ptbr` (tom pt-BR preservado), `campaign-list-ui` (rota diferente).
- Não existe fase F57.5/F57.6 nem REQ-ID de fase para esta entrega. Esta quick **não** cria fase, REQ-ID, change OpenSpec ou migration.

---

## 2. Recorte

### Dentro

1. Namespace próprio `campaign-detail` com catálogos `pt-BR`/`es-419`, tipos explícitos, catálogos congelados e resolvedor por `SupportedUiLocale`.
2. Resolução server-first do idioma em `/campanhas/[id]` e entrega apenas do namespace da rota ao cliente.
3. Localização dos textos fixos da **entrega pronta**:
   - breadcrumb `Campanhas` e título de fallback `Campanha`;
   - rótulo `Criada em`;
   - título `Kit de Publicação`;
   - badge `Editado`;
   - botão `Baixar Original`;
   - aviso fixo de autorização/revisão;
   - ação de copiar: `Copiar`, `¡Copiado!`, `aria-label` e nomes dos alvos (`caption` → es `texto de la publicación`, `hashtags`, `Chamada` → es `Llamada`, `título`).
4. Caminho **legado** (`ReadyView`, inclusive `approved`/`legacy`/`not_enabled`) **e** caminho do **novo fluxo** (`NewFlowDeliveredView` com `newFlow.state === "delivered"`), sempre derivando a localização da **mesma condição que decide qual view é renderizada**.
5. `lang="es-419"` no contêiner que inclui header/breadcrumb e view pronta (não apenas no wrapper interno); conteúdo persistido com `lang=""`; textos de interface que permanecem em português (edição, recuperação e falha/cancelamento de copy) com `lang="pt-BR"`.
6. `PageHeader` com marcação opcional de idioma no título e no breadcrumb, com padrão atual preservado.
7. Atualização pontual de 3 main specs.
8. Testes focados de catálogo, isolamento, render pt-BR/es-419, preservação de conteúdo e comportamento de copiar/baixar.
9. Evidência local + roteiro da homologação posterior (execução somente no Gate 3).

### Fora

- Formulário de nova campanha (`/campanhas/nova`), geração, crédito, billing, prompts e IA.
- Edição de conteúdo (modo de edição do Kit: `Legenda`, `Hashtags (uma por linha)`, `Salvar`, `Restaurar original`, confirmação, erros de PATCH).
- Aprovação (`CampaignApprovalView`), correção/regeneração, recuperação de copy (`CopyRecoveryPanel`), estorno (`RefundedPanel`), resultado desconhecido (`UnknownResultPanel`), `running`, `stale` e `error`.
- Tradução de conteúdo persistido/gerado: produto, descrição, preço, moeda, caption, hashtags, CTA, título da copy, data, imagem ou arquivo.
- Contratos de erro da API, rotas, autorização, schema, migrations, dependências e infraestrutura.
- Admin, shell, dashboard, conta, loja, novidades e landing.
- Refatorações estruturais, limpeza de código sem relação e reorganização visual.
- Fase nova, REQ-ID de fase, change OpenSpec artificial, sync/archive.

### Limite explícito

A página concentra vários fluxos. Somente a **entrega pronta** é localizada. Os demais estados continuam exatamente como hoje (sem tradução). Quando a entrega pronta estiver exibindo a superfície de recuperação de copy ou o feedback de falha/cancelamento da copy, o **chrome** da entrega (header, download, aviso) será localizado e o **painel do estado fora do recorte** permanecerá em pt-BR, **marcado com `lang="pt-BR"`** para não herdar espanhol — limitação declarada e coberta pelo roteiro de homolog.

O modo de edição do Kit permanece fora desta quick (P1 aprovado): `Legenda`, `Hashtags (uma por linha)`, `Salvar`, `Restaurar original`, confirmação e erros continuam em pt-BR e recebem `lang="pt-BR"` quando exibidos sob interface `es-419`. O `confirm()` nativo do navegador não aceita marcação de idioma; a limitação é registrada.

---

## 3. Inventário de textos e classificação

| Texto atual | Origem / local | Classificação | Ação |
|---|---|---|---|
| `Campanhas` | `client.tsx` — breadcrumb | UI fixa | catálogo `breadcrumbCampaigns` |
| `Campanha` | `client.tsx` — fallback de título/breadcrumb e `alt` | UI fixa | catálogo `fallbackTitle` |
| `Criada em` | `ReadyView` e `NewFlowDeliveredView` | UI fixa | catálogo `createdAtLabel` (data inalterada) |
| `Kit de Publicação` | `ReadyView` e `NewFlowCopyPanel` | UI fixa | catálogo `publicationKit` |
| `Editado` | badge do `ReadyView` | UI fixa | catálogo `editedBadge` (idêntico nos dois idiomas) |
| `Copiar` / `Copiado!` | `CopyButton` | UI fixa/ação | catálogo `copy.copy` / `copy.copied`; es `¡Copiado!` (forma única) |
| `Copiar {label}` (aria) | `CopyButton` | UI fixa/acessível | catálogo `copy.ariaPrefix` + alvo |
| `caption` / `hashtags` / `Chamada` / `título` | alvos do `CopyButton` | UI fixa (nome do campo) | catálogo `copy.targets.*`; pt-BR mantém literal; es `texto de la publicación` / `hashtags` / `Llamada` / `título` |
| `Baixar Original` | `ReadyView` e `NewFlowDeliveredView` | UI fixa | catálogo `downloadOriginal` |
| Aviso “Use apenas materiais…” | rodapé das duas views | UI fixa | catálogo `disclaimer` (P2 aprovado, significado integral) |
| **Nome do produto** | `props.productName` — título, breadcrumb, `alt` | **Conteúdo persistido** | **não traduzir**; `lang=""` |
| **Data de criação** | `props.createdAt` | **Dado** | **formato atual `dd/mm/aaaa` preservado**; só o rótulo traduz |
| **Caption / hashtags / CTA / título da copy** | `props` / `newFlow.copy` | **Conteúdo gerado/persistido** | **não traduzir**; `lang=""`; cópia continua copiando o valor exato |
| **Imagem / arquivo** | `imageUrl` / `downloadUrl` | **Arte** | **intocados** |
| `Legenda`, `Hashtags (uma por linha)`, `Salvar`, `Restaurar original`, confirmação, erros | modo de edição | Fora do recorte | sem tradução; **`lang="pt-BR"`** na região de edição quando sob interface es-419 |
| Mensagens de falha/cancelamento da copy | `NewFlowCopyPanel` (ramos não entregues) | Fora do recorte | sem tradução; **`lang="pt-BR"`** no bloco de feedback |
| `Corrigindo a arte...`, `Sua campanha está sendo gerada...`, `Geração interrompida...`, `Não foi possível gerar...` | views de processamento/erro | Fora do recorte | sem alteração (não são renderizadas sob a entrega pronta localizada) |
| Textos de `RefundedPanel`, `UnknownResultPanel`, `CampaignApprovalView` | componentes importados | Fora do recorte | sem alteração (estados sem wrapper es-419) |
| Textos de `CopyRecoveryPanel` e `actionError` da recuperação | componente importado, exibido dentro da entrega pronta | Fora do recorte | sem tradução; **`lang="pt-BR"`** no contêiner do painel e no alerta de erro |

**Regra de idioma do conteúdo:** não presumir que o conteúdo persistido está em português. O conteúdo recebe `lang=""` (idioma desconhecido) para **não herdar** `es-419` da interface. Textos de interface que permanecem em português (edição, recuperação, falha/cancelamento de copy) recebem `lang="pt-BR"`. Nenhum campo de idioma de campanha é lido, criado ou alterado.

---

## 4. Decisões e contrato do plano (revisão 2)

| # | Decisão | Justificativa |
|---|---|---|
| D1 | Namespace em `src/lib/i18n/campaign-detail/` (types, catálogos congelados, `getCampaignDetailMessages`, barrel local) | Mesmo padrão de `campaign-list`/`novidades`; isolamento por rota e paridade em compilação |
| D2 | `getCampaignDetailMessages(locale: SupportedUiLocale)` reutiliza o tipo da F57.4 | Proibido criar resolvedor concorrente ou mexer no timeout central |
| D3 | `page.tsx` resolve `getCurrentStore` + `getUiRenderContext` em `Promise.all` e passa `messages`/`locale` ao cliente; o cliente deriva a localização do **mesmo modo de renderização** que decide a view | Server-first; o layout já aquece o `cache()` da preferência |
| D4 | Extrair uma única função pura de modo de renderização e usá-la **tanto** para o `switch` das views **quanto** para o gate de localização | Elimina divergência entre "o que aparece" e "o que é traduzido"; não altera qual tela renderiza |
| D5 | `PageHeader` ganha `titleLang?: string` e `Breadcrumb.lang?: string`, ambos opcionais e sem default | Marca conteúdo persistido sem alterar o DOM dos demais consumidores |
| D6 | `lang="es-419"` no **contêiner externo** que inclui header/breadcrumb e view pronta; `lang=""` no produto, na imagem e nos blocos de copy; `lang="pt-BR"` nas regiões de interface não traduzidas | Header/breadcrumb traduzidos precisam herdar espanhol; conteúdo não pode herdar; texto pt-BR não pode herdar espanhol |
| D7 | Data continua `new Date(...).toLocaleDateString("pt-BR")` (formato `dd/mm/aaaa`) | Atende os dois idiomas; alterar formatação é decisão funcional separada |
| D8 | `CopyButton` recebe os textos por props (sem importar catálogo) | Mantém o cliente sem catálogo embutido e segue o padrão de `campaign-list` |
| D9 | Nenhuma alteração em `display.ts`, `download/route.ts`, `publication-copy` ou `newFlow` mapping | Contratos e comportamento preservados |
| D10 | Regra de modo de renderização: novo fluxo ⇒ localiza somente em `delivered`; legado ⇒ `regenerating` **não** localiza; `pending` **não tiver ambos** `candidateImageUrl` e `candidateVersionId` ⇒ localiza (pois a tela real é `ReadyView`); `pending` com ambos ⇒ `CampaignApprovalView`, não localiza; demais estados não localizam | Reproduz exatamente as condições atuais de renderização, sem mudar qual tela aparece |
| D11 | Espanhol único: `¡Copiado!` para feedback e `texto de la publicación` como alvo acessível/visível de `caption` | Consistência entre catálogo, testes e homolog |
| P1 | **Aprovado — edição de conteúdo fica fora**: strings do modo de edição não entram no catálogo e permanecem em pt-BR, com `lang="pt-BR"` na região | Decisão do responsável; evita ampliar escopo |
| P2 | **Aprovado — incluir o aviso fixo** “Use apenas materiais…” com significado integral | É texto fixo da view pronta, não conteúdo |
| P3 | **Não** traduzir data nem adotar fuso da loja | Preserva o comportamento atual e evita mudança funcional |

**Decisões pendentes:** nenhuma. P1/P2 aprovados nesta revisão; D1–D11 são o contrato proposto para o Gate 1.

---

## 5. Arquivos previstos

### Novos (namespace)

- `src/lib/i18n/campaign-detail/messages.ts`
- `src/lib/i18n/campaign-detail/catalogs/pt-BR.ts`
- `src/lib/i18n/campaign-detail/catalogs/es-419.ts`
- `src/lib/i18n/campaign-detail/get-messages.ts`
- `src/lib/i18n/campaign-detail/index.ts`
- `src/lib/i18n/campaign-detail/__tests__/catalogs.test.ts`
- `src/lib/i18n/campaign-detail/__tests__/isolation.test.ts`

### Alterados (rota e componente compartilhado)

- `src/app/(app)/campanhas/[id]/page.tsx` — resolver idioma, montar mensagens e repassar `messages`/`locale` nos três retornos; nenhuma mudança de consulta/estado.
- `src/app/(app)/campanhas/[id]/client.tsx` — consumir mensagens na entrega pronta; `lang` escopado; conteúdo com `lang=""`; `CopyButton`/`NewFlowCopyPanel` por props.
- `src/components/ui/page-header.tsx` — `titleLang?` e `Breadcrumb.lang?` opcionais.
- `.planning/quick/261103-cpv-localizar-interface-da-campanha-pronta/evidence/` — criado apenas na execução.

### Alterados (testes diretamente afetados)

- `src/__tests__/components/ui/page-header.test.tsx` — defaults + marcação de idioma.
- `src/__tests__/app/campanha/[id]/client.test.tsx` — fixture com mensagens; pt-BR inalterado.
- `src/__tests__/app/campanhas/campaign-detail-page.test.tsx` — mock de `getUiRenderContext`.
- `src/__tests__/api/campaign-page.test.tsx` — fixture com mensagens; pt-BR inalterado.
- `src/__tests__/api/campaign-page-server.test.tsx` — mock de `getUiRenderContext`.
- `src/__tests__/api/campaign-approval-view-problem.test.tsx` — fixture com mensagens.
- `src/app/(app)/campanhas/[id]/__tests__/persisted-state.test.tsx` — fixture com mensagens; expectativas atuais preservadas.
- `src/app/(app)/campanhas/[id]/__tests__/copy-recovery-driving.test.tsx` — fixture com mensagens.
- `src/app/(app)/campanhas/[id]/__tests__/page-read-failure.test.tsx` — mock de `getUiRenderContext`.
- `src/lib/product-1-1/__tests__/copy-wiring-gaps.contract.test.ts` — trocar a asserção de string `"Kit de Publicação"` pela chave `publicationKit`, preservando a intenção do contrato.

### Intocados por decisão

- `src/lib/campaign/display.ts`, `src/app/api/campaign/[id]/download/route.ts`, `publication-copy`, `copy-recovery`, `campaign-approval-view`, `refunded-panel`, `unknown-result-panel`, `copy-recovery-panel`.
- `src/lib/i18n/index.ts`, `src/lib/i18n/server.ts`, `src/lib/i18n/locales.ts`, `(app)/layout.tsx`, `app-shell.tsx`.
- `src/lib/onboarding/microcopy.ts`, `src/app/(app)/campanhas/loading.tsx`, `src/app/(app)/campanhas/[id]/loading.tsx`, `src/app/(app)/error.tsx`.
- Migrations, APIs, schema, dependências e configuração de deploy.

---

## 6. Tasks

### Task 1 — Namespace `campaign-detail`

**Files**
- `src/lib/i18n/campaign-detail/{messages,catalogs/pt-BR,catalogs/es-419,get-messages,index}.ts`
- `src/lib/i18n/campaign-detail/__tests__/{catalogs,isolation}.test.ts`

**Action**
1. Criar `messages.ts` com interfaces explícitas (sem `any`, sem index signature):
   ```ts
   interface CampaignDetailCopyMessages {
     readonly copy: string;        // "Copiar"
     readonly copied: string;      // pt "Copiado!" / es "¡Copiado!" (forma única)
     readonly ariaPrefix: string;  // "Copiar"
     readonly targets: {
       readonly caption: string;   // pt "caption" / es "texto de la publicación"
       readonly hashtags: string;  // "hashtags"
       readonly cta: string;       // pt "Chamada" / es "Llamada"
       readonly title: string;     // "título"
     };
   }
   interface CampaignDetailMessages {
     readonly breadcrumbCampaigns: string; // "Campanhas" / "Campañas"
     readonly fallbackTitle: string;       // "Campanha" / "Campaña"
     readonly createdAtLabel: string;      // "Criada em" / "Creada el"
     readonly publicationKit: string;      // "Kit de Publicação" / "Kit de Publicación"
     readonly editedBadge: string;         // "Editado" / "Editado"
     readonly downloadOriginal: string;    // "Baixar Original" / "Descargar original"
     readonly disclaimer: string;
     readonly copy: CampaignDetailCopyMessages;
   }
   ```
2. `catalogs/pt-BR.ts`: strings **exatamente iguais** às atuais, incluindo `caption` minúsculo e `Chamada`. `Object.freeze` na raiz e em cada subobjeto.
3. `catalogs/es-419.ts`: mesmas chaves; `satisfies CampaignDetailMessages`; espanhol neutro LATAM (`Campañas`, `Campaña`, `Creada el`, `Kit de Publicación`, `Descargar original`, `texto de la publicación`, `Llamada`, `título`, `¡Copiado!` — forma única, sem variante `Copiado!`).
4. `get-messages.ts`: `getCampaignDetailMessages(locale)` → `es-419` ou `pt-BR`; sem leitura de preferência.
5. `index.ts`: barrel local; **não** adicionar nada a `src/lib/i18n/index.ts`.
6. Testes:
   - paridade exata de chaves/namespaces por `flatten`;
   - nenhum valor vazio; mesmo conjunto de placeholders (vazio);
   - congelamento raiz e subobjetos;
   - lista contratada de chaves pt-BR (trava de regressão) e strings pt-BR atuais;
   - isolamento estático: `i18n/index.ts`, `messages.ts`, `get-catalog.ts`, `(app)/layout.tsx`, `app-shell.tsx` e `src/app/(app)/admin/**` não importam `campaign-detail`;
   - namespace client-safe (sem `server-only`);
   - resolvedor devolve a instância congelada esperada.

**Verify**
- `npm.cmd test -- src/lib/i18n/campaign-detail`
- `npm.cmd run typecheck`

**Done**
- Namespace compilando, congelado, paritário e isolado; nenhum consumidor de UI alterado ainda.

---

### Task 2 — Ligar página, cliente e `PageHeader`

**Files**
- `src/app/(app)/campanhas/[id]/page.tsx`
- `src/app/(app)/campanhas/[id]/client.tsx`
- `src/components/ui/page-header.tsx`
- testes listados em §5

**Action**
1. `page.tsx`:
   - manter `requirePageUser`, `getCurrentStore`, `getCampaignForDisplay`, classificação de fluxo e recuperação lazy **intactos**;
   - `const [store, ui] = await Promise.all([getCurrentStore(user.userId), getUiRenderContext(user.userId)])`;
   - `const locale: SupportedUiLocale = ui.ok ? ui.locale : "pt-BR";`
   - `const messages = getCampaignDetailMessages(locale);`
   - repassar `messages={messages} locale={locale}` nos três `return <CampaignPageClient ... />`;
   - **não** alterar queries, gates, URLs, flags ou ordem de leitura da campanha.
2. `client.tsx`:
   - props obrigatórias `messages: CampaignDetailMessages` e `locale: SupportedUiLocale` (import type de `messages.ts`/`locales.ts`, não do barrel);
   - **extrair uma função pura de modo de renderização** e usar o mesmo resultado para o `switch` das views e para o gate de localização:
     - `newFlow` presente ⇒ `"ready"` somente se `newFlow.state === "delivered"`; senão `"other"`;
     - legado com `displayStatus !== "ready"` ⇒ `"other"`;
     - legado `ready` + `approval.state.status === "regenerating"` ⇒ `"regenerating"` (não localiza);
     - legado `ready` + `approval.state.status === "pending"` **com `candidateImageUrl` E `candidateVersionId`** ⇒ `"approval"` (não localiza);
     - qualquer outro legado `ready` — **inclusive `pending` sem candidata** — ⇒ `"ready"` (localiza), pois é o que `ReadyView` realmente renderiza;
   - **não** alterar a ordem/condições que decidem qual tela aparece: o `switch` passa a consumir o modo extraído, preservando a mesma precedência;
   - header/breadcrumb só localizados quando o modo é `"ready"`; caso contrário, strings atuais (`Campanhas`, `Campanha`) e **sem** `lang`;
   - `lang="es-419"` no **contêiner externo** (`<div className="mx-auto max-w-2xl">`) quando o modo é `"ready"` e `locale === "es-419"`, de forma que header/breadcrumb e view fiquem cobertos; caso contrário, sem `lang`;
   - `PageHeader title={productName || messages.fallbackTitle}` com `titleLang={productName ? "" : undefined}`; breadcrumb do produto com `lang={productName ? "" : undefined}`;
   - `<img lang="">` e `alt={productName || messages.fallbackTitle}`;
   - trocar `Criada em`, `Kit de Publicação`, `Editado`, `Baixar Original` e o aviso fixo pelas mensagens;
   - `CopyButton` recebe `copyMessages` e o alvo já traduzido; `aria-label`/texto visível vêm do catálogo (`¡Copiado!` é a única forma espanhola);
   - `CopyButton` mantém `navigator.clipboard.writeText(text)`, timeout de 2000 ms e fallback silencioso;
   - `NewFlowCopyPanel` recebe `messages` para o título e os alvos; **ramos `failed`/`canceled` permanecem com o texto atual, envolvidos em `lang="pt-BR"`**;
   - envolver caption/hashtags/CTA/título da copy em `lang=""`;
   - envolver o conteúdo do **modo de edição** do `ReadyView` em `lang="pt-BR"` (sem traduzir nada); `confirm()` nativo não é marcável — registrar como limitação;
   - envolver o **fragmento de recuperação** (`CopyRecoveryPanel` + eventual parágrafo `actionError`/`role="alert"`) em `<div lang="pt-BR">` quando renderizado dentro da entrega pronta (sem traduzir);
   - **não** tocar em `downloadUrl`, `window.location.href`, PATCH de publication-copy, `router.refresh`, polling, `isDriving`, contadores, flags ou handlers;
   - **não traduzir** `GeneratingView`, `RegeneratingView`, `StaleView`, `ErrorView`, `RefundedPanel`, `UnknownResultPanel`, `CopyRecoveryPanel` e `CampaignApprovalView`.
3. `page-header.tsx`:
   - `titleLang?: string` aplicado ao `<h1 lang={titleLang}>`;
   - `Breadcrumb.lang?: string` aplicado ao `<Link>`/`<span>`;
   - props ausentes ⇒ nenhum atributo `lang` novo (DOM dos demais consumidores inalterado).
4. Testes:
   - `page-header.test.tsx`: defaults sem `lang` + caso com `titleLang`/crumb `lang`.
   - `campaign-page.test.tsx` e `client.test.tsx`: fixture com `ptBRCampaignDetailMessages`/`locale:"pt-BR"`; todas as expectativas atuais passam sem mudança; adicionar caso `es-419` com `Campañas`, `Campaña`, `Creada el`, `Kit de Publicación`, `Descargar original`, `Copiar`, `¡Copiado!`, `aria-label` com `texto de la publicación`, `lang="es-419"` no contêiner (alcançando header/breadcrumb) e conteúdo com `lang=""`.
   - **caso de regressão do gate:** legado `displayStatus="ready"` com `approval.state.status === "pending"` **sem** `candidateImageUrl`/`candidateVersionId` deve continuar renderizando `ReadyView` **e** ser localizado; com candidata presente, deve renderizar `CampaignApprovalView` e **não** ser localizado. O mesmo teste garante que a tela exibida não mudou.
   - `persisted-state.test.tsx` e `copy-recovery-driving.test.tsx`: fixture com mensagens; expectativas atuais preservadas (incluindo `Baixar Original` e `Kit de Publicação` em pt-BR); caso es-419 com `CopyRecoveryPanel` sob `lang="pt-BR"` e `NewFlowCopyPanel` de falha/cancelamento sob `lang="pt-BR"`.
   - `campaign-approval-view-problem.test.tsx`: fixture com mensagens; estados `pending` com candidata e `regenerating` continuam em pt-BR e sem `lang` novo.
   - `client.test.tsx`/`persisted-state.test.tsx`: modo de edição em `es-419` mantém `Legenda`/`Salvar` em pt-BR sob `lang="pt-BR"`, sem tradução.
   - `page-read-failure.test.tsx`, `campaign-page-server.test.tsx` e `campaign-detail-page.test.tsx`: mockar `@/lib/i18n/server` (`getUiRenderContext` → `{ ok: true, locale: "pt-BR", preference }`), sem tocar Supabase; reafirmar que `props.newFlow`/approval não mudam.
   - `copy-wiring-gaps.contract.test.ts`: trocar `toContain("Kit de Publicação")` por `toContain("publicationKit")`; manter `not.toMatch(/>\s*Gerar novamente/)` e as demais asserções.

**Verify**
- `npm.cmd test -- src/lib/i18n/campaign-detail src/__tests__/app/campanha/[id]/client.test.tsx src/__tests__/api/campaign-page.test.tsx src/__tests__/api/campaign-page-server.test.tsx src/__tests__/api/campaign-approval-view-problem.test.tsx src/__tests__/app/campanhas/campaign-detail-page.test.tsx src/__tests__/components/ui/page-header.test.tsx "src/app/(app)/campanhas/[id]/__tests__"`
- `npm.cmd run typecheck`

**Done**
- A localização acompanha exatamente a view exibida (incluindo `pending` sem candidata → `ReadyView`); header/breadcrumb ficam cobertos por `es-419`; conteúdo persistido intocado com `lang=""`; interface não traduzida com `lang="pt-BR"`; pt-BR mantém textos/layout/comportamento; estados fora do recorte inalterados.

---

### Task 3 — Specs, gates, payload e evidência

**Files**
- `openspec/specs/campaign-page-ui/spec.md`
- `openspec/specs/campaign-page-tests/spec.md`
- `openspec/specs/ui-base-components/spec.md`
- `.planning/quick/261103-cpv-localizar-interface-da-campanha-pronta/evidence/`

**Action**
1. Atualizar specs de forma pontual (ver §8). **Não** tocar archives F57.4/F58/quicks anteriores.
2. Gates automatizados:
   - focados: namespace + cliente + página + `PageHeader`;
   - regressão dirigida: `src/__tests__/api/campaign-download.test.ts`, `src/__tests__/api/campaign-approval-view.test.tsx`, `src/app/(app)/campanhas/__tests__/refunded-recovery.test.tsx`, `src/lib/product-1-1/__tests__/copy-wiring-gaps.contract.test.ts`, `src/lib/product-1-1/__tests__/non-activation.contract.test.ts`, testes de `publication-copy`, `copy-recovery` e `campaign-list` (rota vizinha);
   - `npm.cmd run typecheck`, `npm.cmd run lint` (limitação conhecida: ESLint sem cobertura de `.ts`), `npm.cmd run build`, `git diff --check`;
   - `openspec validate campaign-page-ui --type spec --strict`, `campaign-page-tests` e `ui-base-components`. **`ui-base-components` NÃO está validada** (falha estrutural preexistente, sem `## Purpose`); registrar separadamente, sem corrigir implicitamente nem ampliar o escopo.
3. Isolamento/payload:
   - teste estático do namespace (já na Task 1);
   - medir no build `First Load JS` de `/campanhas/[id]` e `shared`; usar evidência anterior utilizável como baseline; **não** trocar branch nem rebuildar por cima de aplicação em execução; se não houver baseline, medir apenas a entrega final e registrar a limitação;
   - conferência curta, no homolog, do HTML/RSC de uma campanha pronta em pt-BR e es-419: somente o namespace `campaign-detail` serializado; nenhum catálogo de outra rota; shell inalterado. Sem bateria de desempenho.
4. Evidência local: `evidence/local-gates.md` (comandos, contagens, resultados e limitações) e `evidence/payload.md` (baseline utilizável × final ou apenas final).
5. Roteiro para o Gate 3 (NÃO executar agora), usando **campanha pronta existente que realmente renderiza a view pronta** e conta de teste existente:
   - **seleção segura obrigatória:** abrir uma campanha cujo estado renderize `ReadyView`/`NewFlowDeliveredView` (não aprovação, não regeneração, não running/refunded/unknown/stale/error). No **novo fluxo**, exigir `newFlow.recovery` **nulo ou `concluida`** — nunca `ativa`, `aguardando`, `indeterminada`, `falha`, `falha_definitiva` ou `interrompida`; no **legado**, confirmar que não há `approval` pendente com candidata e que o `displayStatus` é `ready`. Abrir uma campanha com recuperação pendente/ativa pode **acompanhar e iniciar recuperação automática de copy** — não é uma prova sem efeitos;
   - se não existir exemplo seguro no homolog, **registrar a limitação e usar os testes automatizados**; não criar campanha, não alterar mecanismos de recuperação e não forçar estado por escrita;
   - registrar o DTO inicial de preferência (`GET /api/preferences`: valor/fonte/versão);
   - alternar para `es-419` pela API com CSRF e `expectedVersion`; validar **header e breadcrumb**, título de fallback, `Creada el`, `Kit de Publicación`, `Descargar original`, ação de copiar (texto, `¡Copiado!` — forma única, alvos e `aria-label` com `texto de la publicación`), aviso fixo e `lang` (contêiner `es-419` alcançando header/breadcrumb; produto/copy `lang=""`; região de edição/recuperação `lang="pt-BR"`);
   - confirmar que **nome do produto e texto da campanha permanecem no idioma original**, sem tradução automática: caption, hashtags, CTA, título da copy, imagem e data não mudaram; copiar entrega o texto exato e baixar entrega o mesmo arquivo (nome/tipo/tamanho);
   - confirmar **`pending` com e sem candidata** mantendo as telas corretas: sem `candidateImageUrl`/`candidateVersionId` → `ReadyView` localizado; com ambos → `CampaignApprovalView` não localizado. Se um estado não existir no homolog, registrar como não observado e citar o teste automatizado;
   - confirmar **edição, recuperação e erros preservados em português** (conforme o recorte), com `lang="pt-BR"` sob interface es-419;
   - verificar **ausência de regressões visuais e funcionais** nas ações existentes, em desktop e mobile, sem overflow;
   - restaurar a preferência pela API (explícita → valor original; `legacy_br` → `uiLocale:null`), sem apagar linha e sem retroceder versão;
   - registrar que os estados fora do recorte não foram cobertos.
6. **Proibido nesta quick (planejamento e execução local/homolog, salvo autorização específica):** criar campanha, gerar/regenerar arte ou copy, aprovar arte, informar problema, acionar recuperação, salvar edição de copy, disparar provider pago ou qualquer prova que possa gerar cobrança. O roteiro só abre campanha já pronta **sem recuperação pendente/ativa** e usa copiar/baixar.
7. Registrar explicitamente: planejamento ≠ implementação local ≠ homolog ≠ publicação ≠ smoke; nenhum gate autoriza o seguinte.

**Verify**
- `npm.cmd test -- src/lib/i18n/campaign-detail src/__tests__/app/campanha src/__tests__/api/campaign-page.test.tsx src/__tests__/api/campaign-page-server.test.tsx src/__tests__/api/campaign-approval-view-problem.test.tsx src/__tests__/app/campanhas/campaign-detail-page.test.tsx src/__tests__/components/ui/page-header.test.tsx "src/app/(app)/campanhas/[id]/__tests__"`
- `npm.cmd run typecheck && npm.cmd run lint && npm.cmd run build`
- `git diff --check`
- `openspec validate campaign-page-ui --type spec --strict` (e os outros dois specs)

**Done**
- Specs refletem o comportamento localizado; gates verdes com limitações declaradas; evidência local, payload e roteiro de homolog prontos.

---

## 7. Critérios de aceite

1. Com `uiLocale=es-419`, uma campanha pronta (legado e novo fluxo `delivered`) exibe em espanhol: breadcrumb, título de fallback, `Creada el`, `Kit de Publicación`, badge, `Descargar original`, aviso fixo e ação de copiar (texto visível, `¡Copiado!`, alvos e `aria-label` com `texto de la publicación`).
2. Com `uiLocale=pt-BR`, os textos fixos são **exatamente** os atuais; nenhum `lang="es-419"` é declarado.
3. Nome do produto, caption, hashtags, CTA, título da copy, data, imagem e arquivo permanecem idênticos nos dois idiomas.
4. Copiar entrega exatamente o texto original (`clipboard.writeText` inalterado); baixar continua usando `downloadUrl`/rota atual e entrega o mesmo arquivo.
5. `lang="es-419"` está no contêiner que inclui header/breadcrumb e view pronta; produto/copy/imagem usam `lang=""`; interface que permanece em português (edição, recuperação, falha/cancelamento de copy) usa `lang="pt-BR"`; demais estados não ganham marcação nova.
6. Nenhuma mudança em `display.ts`, rota de download, PATCH de publication-copy, polling, flags, consultas, autorização, eventos ou handlers.
7. Estados fora do recorte (running, refunded, unknown, regenerating, approval pending **com candidata**, stale, error, recovery, falha/cancelamento de copy) mantêm comportamento e textos atuais. Aprovação `pending` **sem candidata** continua caindo em `ReadyView` e é localizada, como a tela real exige.
8. `PageHeader` mantém o DOM atual quando `titleLang`/`lang` não são passados.
9. Catálogo `campaign-detail` não entra no payload global e não é importado por layout, shell ou admin.
10. Typecheck, testes focados, build e `git diff --check` verdes; lint registrado com a limitação conhecida; `openspec validate --strict` válido nos 3 specs.
11. Nenhuma fase, REQ-ID, change OpenSpec, migration ou dependência criada.
12. Quicks `261103-hlq`/`261103-jjc` e commits existentes preservados.

---

## 8. Specs afetados (atualização pontual, na implementação)

| Spec | Mudança proposta |
|---|---|
| `openspec/specs/campaign-page-ui/spec.md` | Novo requisito "Localização da interface da campanha pronta (pt-BR/es-419)": namespace próprio, resolução server-first, textos fixos traduzidos, localização derivada das mesmas condições de renderização (incluindo `pending` sem candidata → `ReadyView`), `lang="es-419"` no contêiner do header+view, `lang=""` no conteúdo e `lang="pt-BR"` na interface não traduzida, data no formato atual, ações copiar/baixar preservadas; cenários pt-BR inalterado, es-419 traduzido, conteúdo sem herança e estados fora do recorte inalterados |
| `openspec/specs/campaign-page-tests/spec.md` | Cenários de paridade de catálogo, render es-419, marcação de idioma (incluindo `lang="pt-BR"` em edição/recuperação/falha), gate `pending` com/sem candidata, preservação de copy/download/URLs e não regressão dos estados fora do recorte |
| `openspec/specs/ui-base-components/spec.md` | `PageHeader` ganha `titleLang?` e `Breadcrumb.lang?` opcionais; sem atributo quando omitidos |

Revisados e **sem alteração**: `campaign-download-route`, `campaign-approval-gate`, `product-1-1-copy-recovery`, `ui-localization`, `microcopy-ptbr`, `campaign-list-ui`.

---

## 9. Riscos e mitigação

| # | Risco | Mitigação |
|---|---|---|
| R1 | Gate de localização divergir da tela realmente exibida (ex.: `pending` sem candidata cai em `ReadyView`) | Função pura única consumida pelo `switch` e pelo gate; teste de regressão `pending` com/sem candidata |
| R2 | Contrato `copy-wiring-gaps` quebra ao mover `"Kit de Publicação"` | Atualizar a asserção para `publicationKit`, preservando a intenção; catálogo trava a string pt-BR |
| R3 | Conteúdo persistido herda `es-419` | `lang=""` no produto, imagem e blocos de copy; teste de render verifica os atributos |
| R3b | Interface pt-BR fora do recorte herda espanhol (edição, recuperação, falha/cancelamento) | `lang="pt-BR"` nessas regiões; teste de render verifica |
| R4 | Título/breadcrumb de produto não podem receber `lang` pelo `PageHeader` atual | Props opcionais `titleLang`/`lang`; teste de defaults garante DOM inalterado |
| R5 | Payload cresce ao importar catálogo no cliente | Mensagens vêm do servidor; cliente importa apenas tipos; teste estático + medição de build |
| R6 | Testes existentes quebram pelo novo contrato de props | Atualizar fixtures dos 5 testes de cliente e mockar `getUiRenderContext` nos 3 testes de página |
| R7 | Latência extra da leitura de preferência | `getUiRenderContext` é `cache()` e já é chamado no layout; não alterar timeout nem criar leitura nova |
| R8 | pt-BR sofrer alteração de texto | Catálogo pt-BR reproduz literalmente as strings atuais e teste trava a lista |
| R9 | Mistura de idioma visível quando a recuperação de copy/falha está ativa | Limitação declarada; painel permanece pt-BR com `lang="pt-BR"`; homolog registra o que foi observado |
| R10 | Baseline de payload exige troca de branch/build retroativo | Não trocar branch; usar evidência anterior utilizável ou medir só a entrega final |
| R11 | Homolog tocar em fluxo que gera cobrança | Roteiro restrito a campanha pronta existente **sem recuperação pendente/ativa** + ler/copiar/baixar; proibição explícita de gerar/aprovar/recuperar/editar |
| R12 | Preferência inicial perdida no homolog | Registrar DTO e restaurar pela API com versão vigente; `legacy_br` → `null` |
| R13 | Abrir campanha entregue do novo fluxo com recuperação pendente/ativa pode acompanhar e iniciar recuperação automática de copy | Seleção segura no homolog (`recovery` nulo/`concluida`); se não houver exemplo, registrar limitação e usar testes automatizados; não alterar mecanismos |
| R14 | Espanhol inconsistente entre catálogo, testes e roteiro | Forma única `¡Copiado!` e alvo `texto de la publicación`; teste de catálogo trava as strings |

---

## 10. Gates

1. **Plano → revisão usuário/Codex.** (este documento; nenhuma implementação)
2. Implementação local + revisão.
3. Homolog existente — autorização específica (inclui a conferência curta de HTML/RSC).
4. Publicação — autorização específica.
5. Smoke curto e fechamento documental — próprio desta quick, distinto das fases anteriores.

Nenhum gate autoriza o seguinte. Esta etapa **não** implementa, não acessa homolog/produção, não cria sessão, não altera preferências, não inicia/reinicia app, não instala dependências, não faz push/merge/deploy e não cria commit.

### Publicação e aceite de produção (relato do responsável)

- Em **2026-11-03**, o responsável informou **merge, push e deploy realizados** e **conteúdo validado em produção nos dois idiomas**.
- **Autoria:** resultado **relatado pelo responsável**. O agente **não** executou smoke de produção, **não** acessou homolog/produção e **não** validou conteúdo em produção.
- **Cronologia preservada:** implementação e gates locais → revisão read-only do diff → aceite visual local (pt-BR/es-419) → publicação pelo responsável → aceite de produção relatado. A validação local ocorreu **antes** da publicação.
- **Gate 3 formal NÃO executado pelo agente.** A decisão registrada foi seguir com validação manual e aceite posterior em produção; isso **não** converte o Gate 3 em PASS.
- **Sync/archive não aplicável:** os main specs foram atualizados diretamente nesta quick.
- Limitações conhecidas e observações O1–O3 preservadas como registro, sem tratá-las como implementação pendente.

---

## 11. Artefatos e estado do Git

- Plano: `.planning/quick/261103-cpv-localizar-interface-da-campanha-pronta/261103-cpv-PLAN.md`
- Evidence: `.planning/quick/261103-cpv-localizar-interface-da-campanha-pronta/evidence/` (`local-gates`, `payload`, `diff-review`, `visual-acceptance-local`, `production-acceptance`).
- Summary: `261103-cpv-SUMMARY.md`
- Branch/merge: implementação na `feature/traducao-da-interface-da-campanha-pronta`; **merge e push realizados pelo responsável**; fechamento documental final na `main`, sem push automático.
- `STATE.md`: linha da quick atualizada para concluída e aceita em produção (relato do responsável).
- Revisão 2 (2026-11-03): incorpora os quatro ajustes solicitados — gate derivado das condições reais de renderização; marcação es-419 no contêiner do header/breadcrumb e `lang="pt-BR"` para interface não traduzida; seleção segura de campanha no homolog (sem recuperação pendente/ativa); espanhol unificado em `¡Copiado!`/`texto de la publicación`. P1 e P2 decididos; nenhuma decisão pendente.
- **Fechamento:** documentação concluída. Nenhum código, teste, catálogo ou spec foi alterado nesta etapa; nenhum ambiente foi acessado; nenhum push automático foi realizado.
