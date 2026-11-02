# Phase 58: F58 — Composição operacional do dashboard — Research

**Pesquisado em:** 2026-11-02
**Domínio:** Next.js App Router (Server Components) + i18n server-first + Supabase (leitura) + composição de UI operacional
**Confiança:** MEDIUM-HIGH (código verificado no worktree; uma divergência crítica de contrato de crédito precisa de decisão)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### D-01 — Elegibilidade de campanhas
- Campanha elegível é somente `status = "ready"`.
- `generating` e `error` não entram nas consultas de conteúdo, cartões ou contagens do dashboard.
- `/campanhas` continua acessível com o contrato existente de `ready` + `error`.
- Não alterar a semântica de `countCampaigns`, `countReadyCampaigns`, `getRecentCampaigns` nem `getUserOnboardingState`.

#### D-02 — Derivação de estado
- `no_store` quando `getCurrentStore` retorna `null`.
- `no_eligible_campaigns` quando a loja existe e a contagem `ready` é 0.
- `has_eligible_campaigns` quando existe ao menos uma campanha `ready`.
- O dashboard não usa `getUserOnboardingState` para transformar lojas com apenas campanhas com erro em “com campanhas”.

#### D-03 — Consulta e miniaturas
- Nova composição server-only específica do dashboard consulta no máximo 3 campanhas `ready`, ordenadas por `created_at` desc.
- Selecionar somente `id`, `product_name`, `created_at`, `storage_path`.
- Reutilizar `generateBatchThumbnailUrls` para URLs assinadas do bucket `campaign-images`.
- `thumbnailUrl: null` ou erro de carregamento usa fallback visual; o link para `/campanhas/[id]` permanece funcional.
- Não expor `storage_path` ao cliente.

#### D-04 — Créditos
- Usar `CreditService.getBalanceBreakdown`.
- Sucesso: saldo disponível legível no idioma da interface + acesso a `/conta`.
- Zero: exibir `0` créditos, nunca “indisponível”.
- Falha: exibir “saldo indisponível” no idioma da interface, nunca `0`.
- Não alterar `BalanceDisplay`; o dashboard usa bloco próprio para distinguir indisponível de zero.

#### D-05 — Anúncio de novidades
- Estender `ChangelogAnnouncement` com modo compacto retrocompatível, trecho e rótulos opcionais.
- Padrão sem modo compacto preserva o comportamento atual em português.
- Modo compacto: título, data, trecho do conteúdo editorial existente, ação para `/novidades` e dispensa.
- Não renderizar o corpo markdown completo no dashboard.
- Não traduzir título/trecho, não gerar resumo por IA e não alterar `lastSeenId` ao dispensar.
- Preservar `card`/`modal` conforme o anúncio original.

#### D-06 — Saudação
- Função pura com `storeName`, `timeZone`, `locale`, `now` injetável e mensagens.
- Período calculado no `timeZone` resolvido por `getStoreMarketSettings`.
- Texto no `uiLocale` via namespace do dashboard.
- Falha de fuso: saudação neutra; não substituir silenciosamente por `America/Sao_Paulo`.
- Default legado do contrato continua válido quando resolvido como tal.
- Sem loja: boas-vindas neutras.

#### D-07 — Namespace de localização
- Criar namespace `dashboard` próprio, com `DashboardMessages`, catálogos `pt-BR`/`es-419` e resolvedor.
- `satisfies DashboardMessages` garante paridade estrutural em compilação; placeholders são comparados por teste automatizado.
- Não adicionar ao tipo `Messages`, ao `getCatalog` global nem aos imports de `AppShell`/admin.
- Reutilizar `getUiRenderContext` e a preferência da F57.4; nenhum seletor, detector, provider ou serviço paralelo.
- Preferência resolvida: renderizar no idioma escolhido, sem troca visual posterior.
- Timeout/falha conhecida: fallback legítimo `pt-BR`, consistente com o shell; não exigir espanhol.
- Não recalibrar o timeout de 1000 ms.

#### D-08 — Avisos localizados
- `VerificationBanners` e `ReadinessBanner` recebem props opcionais de mensagens: título, descrição, itens pendentes, CTA e rótulos acessíveis.
- Sem props, mantêm português como padrão para demais consumidores e admin.
- No dashboard em `es-419`, os avisos são traduzidos.

#### D-09 — `lang` por bloco
- Região traduzida do dashboard em `es-419`: `lang="es-419"`.
- Saudação: somente o nome da loja recebe `lang=""`.
- Cartões: somente o nome do produto recebe `lang=""`.
- Anúncio: somente título e trecho editorial em português recebem `lang="pt-BR"`.
- Botões, rótulos, ações, datas e textos acessíveis traduzidos permanecem no idioma da interface.
- Documento base continua `pt-BR`; não alterar `document.documentElement.lang`.

#### D-10 — Falhas parciais e carregamento
- Buscar dados independentes em paralelo quando possível.
- Falha de campanhas: estado de falha da seção + link `/campanhas`; saldo e novidades continuam.
- Falha de créditos: indisponibilidade + link `/conta`; campanhas e novidades continuam.
- Falha/ausência de novidades: bloco omitido.
- Erro de autenticação/inesperado: error boundary existente.
- `loading.tsx` com esqueletos na ordem final.

#### D-11 — Layout e prioridade mobile
- Cabeçalho compacto com `h1` de saudação; sem `PageHeader` “Dashboard” duplicado.
- Mobile: saldo → campanhas → novidades.
- Desktop: campanhas na coluna principal; saldo e novidades na secundária.
- Cartões 1/2/3 colunas; alvos de 44 px; truncamento seguro.
- Preservar ações de criar campanha, configurar loja e acessar `/campanhas`.

#### D-12 — Escopo e gates
- Preservar shell, identidade, navegação, admin e acessibilidade.
- Remover taxa de sucesso e cartão adaptativo de próximo passo.
- Não criar recomendações, novas regras comerciais ou serviços para preencher espaço.
- Validação separada: automatizada, visual humana e gates de publicação.
- Testes locais não provam produção; deploy/smoke exigem autorização específica.

### the agent's Discretion
Não há seção explícita de discrição no CONTEXT. As áreas abertas estão listadas em `## Open Questions` (detecção de falha de crédito, fallback de trecho, comportamento do link de novidades, fuso da data dos cartões, anúncio no estado sem loja, escopo do `lang="pt-BR"`).

### Deferred Ideas (OUT OF SCOPE)
- Recomendações contextuais, matriz de prioridades e próximo passo adaptativo.
- Tradução de conteúdo editorial de novidades, nomes de loja/campanha e idiomas regionais de campanha.
- Alterações de crédito, geração, onboarding, admin ou schema.
- Variante canônica de `getStoreMarketSettings` por `storeId` para eliminar o lookup duplicado.
- Recalibrar timeout de preferência.
- Publicação, deploy e smoke de produção.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte de pesquisa |
|----|-----------|---------------------|
| REQ-58-01 | Elegibilidade somente `ready`; erro/geração fora das consultas, cartões e contagens do dashboard; `/campanhas` preservado; serviços compartilhados intactos | Nova query em `src/lib/dashboard/` com `.eq("status","ready")`; `countReadyCampaigns` já é `ready`-only; `metrics.ts`/`list.ts` não mudam; testes existentes de `list.test.ts`/`state.test.ts` viram regressão |
| REQ-58-02 | Até 3 campanhas com miniatura assinada, fallback e link `/campanhas/[id]` | `generateBatchThumbnailUrls` assina `campaign-images` com `Promise.allSettled` e `null` por item; cartão client com `onError` |
| REQ-58-03 | Saldo legível, `/conta`, zero ≠ disponível ≠ indisponível | **Risco crítico**: `getBalanceBreakdown` engole erro e devolve zeros; requer opção aditiva `throwOnError` ou leitura dedicada |
| REQ-58-04 | Anúncio compacto dispensável com trecho editorial, sem tradução/IA | `ChangelogAnnouncement` + `useChangelogState`; novo extrator puro de trecho; markdown subset restrito |
| REQ-58-05 | Saudação com nome, `timeZone` canônico e `uiLocale`; falha → neutra | Função pura com `Intl.DateTimeFormat(..., { timeZone })`; vetores UTC vs São Paulo/Assunção verificados no Node 24 |
| REQ-58-06 | Namespace próprio `pt-BR`/`es-419`, paridade e placeholders, sem payload global | Novo módulo `src/lib/i18n/dashboard/` fora do barrel `src/lib/i18n/index.ts`; testes de catálogo + isolamento |
| REQ-58-07 | Avisos localizados por props opcionais, default português | `VerificationBanners`/`ReadinessBanner` com `messages?`; sem props mantêm strings atuais |
| REQ-58-08 | `lang` no menor bloco | Região `lang="es-419"`; nome loja/produto `lang=""`; título/trecho `lang="pt-BR"`; ações sem override |
| REQ-58-09 | Estados sem loja, sem elegíveis, loading, falha e indisponibilidade parcial | `Promise.allSettled` por seção; `try/catch` em anúncio e fuso; `loading.tsx` reescrito |
| REQ-58-10 | Responsividade, prioridade mobile e toque 44 px | DOM na ordem saldo→campanhas→novidades; posicionamento desktop por `lg:col-start`/`lg:row-start` |
| REQ-58-11 | Shell, identidade, navegação, ações, acessibilidade e admin preservados | Nenhuma alteração em `AppShell`/layout/admin; testes de shell/layout como regressão |
| REQ-58-12 | Validação automatizada, visual humana e gates de publicação separados | Comandos e baseline documentados em `## Test Strategy`; sem deploy |
</phase_requirements>

## Summary

A F58 é uma fase de composição de UI server-first, sem banco, API ou dependência nova. O worktree está na branch `feature/fase-58-composicao-operacional-do-dashboard`, commit `33c38702`, com apenas os artefatos de planejamento/OpenSpec não rastreados. O dashboard atual é monolítico em `src/app/(app)/dashboard/page.tsx` (305 linhas, 3 estados de onboarding, métricas técnicas, lista `ready`+`error`, cartão de próximo passo e textos fixos em português). A página usa `getUserOnboardingState`, que inclui `error` na contagem, e `getRecentCampaigns`, que consulta `ready`+`error` — ambos precisam deixar de ser usados no dashboard sem alteração dos serviços.

A fundação de i18n da F57.4 já oferece o padrão exato de que a F58 precisa: `getUiRenderContext` (cache por requisição, timeout de 1000 ms, fallback `pt-BR`), catálogos tipados com `satisfies`/`Object.freeze`, barrel client-safe e o exemplo de `lang` escopado em `src/app/(app)/configuracoes/page.tsx`. O catálogo do dashboard deve viver fora do barrel `src/lib/i18n/index.ts`; hoje o barrel reexporta os catálogos globais e é importado pelo layout, então qualquer reexport do dashboard entraria no caminho do shell.

A maior divergência encontrada está no contrato de crédito: `CreditService.getBalanceBreakdown` **não verifica `error`** e devolve `0` (via `data?.… ?? 0`) quando a leitura falha (`src/lib/credit/credit-service.ts:21-37`). Portanto um `try/catch` no dashboard nunca detecta falha de saldo, e o cenário normativo “quando a leitura lança erro” não é satisfeito pelo método como está. A recomendação é uma extensão aditiva e opt-in (`getBalanceBreakdown(storeId, { throwOnError: true })`), preservando byte a byte o comportamento de todos os chamadores atuais, ou — se o responsável não autorizar tocar no serviço compartilhado — uma leitura dedicada do dashboard com a mesma regra de `availableBalance`. Essa decisão precisa ser confirmada antes do plano.

Baseline verificado neste worktree: `npx vitest run src/__tests__/app/dashboard "src/app/(app)/dashboard/__tests__"` → **24/24**; shell + layout i18n → **85/85**; `npm.cmd run typecheck` → exit 0; `npm.cmd run lint` → exit 0; `openspec validate fase-58-composicao-operacional-do-dashboard --strict` → **valid**.

**Recomendação principal:** implementar uma camada de dados server-only específica do dashboard (`src/lib/dashboard/`), um namespace de catálogo isolado (`src/lib/i18n/dashboard/`) e componentes de apresentação finos; a página apenas orquestra `Promise.allSettled`, escolhe o estado operacional e aplica `lang` por bloco. Resolver a detecção de falha de crédito por extensão aditiva do `CreditService` (decisão a confirmar).

## Architectural Responsibility Map

| Capacidade | Tier primário | Tier secundário | Racional |
|------------|---------------|-----------------|----------|
| Autenticação e resolução de loja | API/Backend (Server Component) | — | `requirePageUser` + `getCurrentStore`; cookies/RLS; nunca no cliente |
| Elegibilidade e consulta de campanhas `ready` | API/Backend (server-only) | Database/Storage | Query filtrada por `store_id`+`status`; URLs assinadas geradas no servidor |
| Composição do saldo | API/Backend (server-only) | Database | `CreditService` com client server; estado zero vs indisponível decidido no servidor |
| Saudação por fuso | API/Backend (função pura) | — | `Intl` com `timeZone` explícito; `now` injetável; sem relógio do cliente |
| Catálogo do dashboard e `lang` | API/Backend (render) | Browser (atributos HTML) | Textos resolvidos no servidor; cliente só recebe strings e `lang` |
| Fallback de miniatura em erro de carregamento | Browser/Client | — | `onError` do `<img>` exige estado de cliente; link permanece no DOM |
| Avisos de verificação/prontidão | API/Backend (dados) | Browser/Client (dispensa) | Dados/readiness no servidor; `VerificationBanners` é client por `sessionStorage` |
| Dismissão do anúncio | Browser/Client | — | `useChangelogState`/`localStorage`; servidor só fornece entry + trecho |
| Shell/navegação/admin | Frontend Server (SSR) | Browser | Fora de escopo; não alterar `AppShell`, layout ou catálogos globais |

## Standard Stack

Nenhuma dependência nova. A fase reutiliza exclusivamente o stack instalado.

### Core (já instalado)

| Biblioteca/Módulo | Versão | Propósito | Por que é padrão |
|-------------------|--------|-----------|------------------|
| `next` | `^15.3.1` (`[VERIFIED: package.json]`) | App Router, Server Components, `loading.tsx`, error boundary | Stack obrigatório do projeto |
| `react` / `react-dom` | `^19.1.0` (`[VERIFIED: package.json]`) | SSR/RSC, `cache()` | Base do App Router |
| `@supabase/supabase-js` | `^2.49.4` (`[VERIFIED: package.json]`) | Consultas e Storage assinado | Já usado por `metrics.ts`/`list.ts`/`CreditService` |
| `vitest` | `^4.1.9` (`[VERIFIED: package.json]`) | Testes unitários/página | Runner do projeto |
| `@testing-library/react` + `jsdom` | `^16.3.2` / `^29.1.1` | Componentes client e erros de imagem | Padrão existente em `src/components/changelog/__tests__` |
| `lucide-react` | `^1.16.0` | Ícones (empty states, fallback de miniatura) | Biblioteca de ícones aprovada no design system |

### Módulos internos reutilizados (sem alteração)

| Módulo | Papel na F58 |
|--------|--------------|
| `src/lib/auth/store-ownership.ts` → `getCurrentStore` | Resolve loja e nome |
| `src/lib/campaign/metrics.ts` → `countReadyCampaigns` | Contagem “Campanhas disponíveis” (`ready`-only) |
| `src/lib/campaign/list.ts` → `generateBatchThumbnailUrls` | URL assinada `campaign-images` (TTL 3600 s) |
| `src/lib/credit/credit-service.ts` → `getBalanceBreakdown` | Saldo disponível (ver risco de erro) |
| `src/lib/market-preferences/store-market-settings-service.ts` → `getStoreMarketSettings` | `timeZone` canônico |
| `src/lib/i18n/server.ts` → `getUiRenderContext` | Locale da interface (timeout 1000 ms) |
| `src/lib/changelog/get-changelog.ts` → `getLatestAnnouncement` | Entry do anúncio |
| `src/hooks/use-changelog-state.ts` | Dispensa sem alterar `lastSeenId` |

### Alternativas Consideradas

| Em vez de | Poderia usar | Trade-off |
|-----------|--------------|-----------|
| Nova composição `src/lib/dashboard/` | Alterar `getRecentCampaigns`/`countCampaigns` | Violaria D-01 e o contrato `campaign-metrics` (`ready`+`error`); rejeitado |
| Bloco próprio de crédito | `BalanceDisplay` | `BalanceDisplay` formata em português e não representa indisponível; D-04 proíbe alterá-lo |
| Catálogo do dashboard no barrel global | `src/lib/i18n/index.ts` | Aumentaria o caminho de import do shell e arriscaria payload global; D-07 proíbe |
| Componente novo de anúncio | Estender `ChangelogAnnouncement` | Duplicaria dispensa/modal/foco; D-05 prefere variante retrocompatível |
| Provider/contexto de i18n no cliente | Props server-side | Adiciona estado/bundle sem necessidade; D-07 proíbe |

**Instalação:** nenhuma (`npm install` não é necessário).

## Package Legitimacy Audit

**N/A — esta fase não instala pacotes externos.** Nenhuma nova dependência, script de instalação ou atualização de versão faz parte do escopo (proposal/design/tasks e D-12). Não há `slopcheck` a executar; nenhuma alegação de pacote novo é feita neste documento.

## Architecture Patterns

### Diagrama de fluxo (Server Component)

```
Requisição autenticada /dashboard
        │
        ├─ requirePageUser() ── falha auth ──► redirect /login / error boundary
        │
        ├─ Fase 1 (paralela, independente de loja)
        │    ├─ getCurrentStore(userId) ───────────────► Store | null
        │    ├─ getUiRenderContext(userId) ────────────► locale (es-419 | pt-BR)
        │    └─ getLatestAnnouncement().catch(→null) ──► ChangelogEntry | null
        │
        ├─ getCurrentStore === null ──► ESTADO no_store
        │      └─ h1 boas-vindas neutras + CTA /loja
        │         (NÃO consulta créditos nem campanhas)
        │
        └─ loja existe ──► Fase 2 (Promise.allSettled, independentes)
             ├─ getStoreMarketSettings(userId).timeZone ── falha ──► timeZone=null
             │      └─ resolveDashboardGreeting({ storeName, timeZone, locale, now, messages })
             │             └─ período por Intl(timeZone) | falha ⇒ saudação neutra
             ├─ getDashboardCampaigns(storeId)
             │      ├─ countReadyCampaigns(storeId)
             │      └─ query 3 × ready (id, product_name, created_at, storage_path)
             │             └─ generateBatchThumbnailUrls(...) ⇒ thumbnailUrl|null
             │      ├─ sucesso + count=0 ⇒ no_eligible_campaigns
             │      ├─ sucesso + count>0 ⇒ has_eligible_campaigns
             │      └─ rejeição ⇒ estado de falha da seção + link /campanhas
             ├─ getDashboardCreditState(storeId)
             │      ├─ sucesso ⇒ available | zero
             │      └─ falha ⇒ unavailable (nunca 0)
             └─ excerpt = buildAnnouncementExcerpt(entry.body) (null se vazio)
                  └─ <ChangelogAnnouncement compact labels excerpt /> (client)
                       ├─ sem entry ⇒ null (bloco omitido)
                       └─ dispensado ⇒ null (localStorage, sem tocar lastSeenId)

Render final:
  <div lang={locale==="es-419" ? "es-419" : undefined}>
    h1 saudação (nome da loja em <span lang="">)
    VerificationBanners(messages?) | ReadinessCheckBanner(messages?)
    grid mobile-first: saldo → campanhas → novidades
    desktop (lg): campanhas col-span-2, saldo/novidades na coluna 3
  </div>
```

### Pattern 1: Composição server-only com resultados discriminados e falha isolada

**O que:** cada seção retorna um resultado explícito (`ok: true/false`), nunca lança para a página; a página usa `Promise.allSettled` e decide o estado de cada seção.

**Quando usar:** dados independentes cuja indisponibilidade parcial é requisito (D-10).

**Exemplo (padrão do repo, adaptado):**
```ts
// Source: src/app/(app)/conta/page.tsx:42-61 (padrão de isolamento existente)
let creditError = false;
try {
  [breakdown, ...] = await Promise.all([...]);
} catch {
  creditError = true;
}
```
```ts
// Recomendado para a F58: resultados explícitos por seção
type SectionResult<T> = { ok: true; data: T } | { ok: false };

async function loadCampaignSection(storeId: string): Promise<SectionResult<EligibleCampaignOverview>> {
  try {
    const [count, items] = await Promise.all([
      countReadyCampaigns(storeId),
      queryEligibleCampaigns(storeId, 3),
    ]);
    return { ok: true, data: { count, items } };
  } catch {
    return { ok: false };
  }
}
```

### Pattern 2: Catálogo tipado por rota, fora do catálogo global

**O que:** tipo próprio + catálogo `pt-BR` como fonte de verdade + `es-419` com `satisfies` + resolvedor puro; nenhum reexport no barrel global.

**Quando usar:** textos de uma única rota que não devem entrar no payload do shell (D-07).

**Exemplo (padrão F57.4 verificado):**
```ts
// Source: src/lib/i18n/catalogs/pt-BR.ts:9-11 e src/lib/i18n/catalogs/es-419.ts (padrão)
export const ptBRMessages: Messages = Object.freeze({ ... });
```
```ts
// Recomendado para o dashboard
import type { DashboardMessages } from "./messages";
export const ptBRDashboardMessages: DashboardMessages = Object.freeze({ ... });
```
```ts
import type { DashboardMessages } from "./messages";
export const es419DashboardMessages = Object.freeze({ ... }) satisfies DashboardMessages;
```

### Pattern 3: `lang` no menor bloco, com região traduzida

**O que:** região raiz do dashboard recebe `lang="es-419"` somente quando o locale é espanhol; conteúdo dinâmico/editorial recebe override local.

**Exemplo verificado no repo:**
```tsx
// Source: src/app/(app)/configuracoes/page.tsx:19-24
const lang = locale === "es-419" ? "es-419" : undefined;
return <div lang={lang}> ... </div>;
```
```tsx
// Recomendado na F58
<h1>
  {greetingText}
  {storeName ? <>, <span lang="">{storeName}</span></> : null}
</h1>
<h3><span lang="">{productName}</span></h3>
<h2 lang="pt-BR">{entry.frontmatter.title}</h2>
<p lang="pt-BR">{excerpt}</p>
```

### Pattern 4: Ordem mobile por DOM, posição desktop por grid explícito

**O que:** manter o DOM na ordem mobile (saldo → campanhas → novidades) e posicionar no desktop com `lg:col-start`/`lg:row-start`, sem depender de `order` CSS.

**Por quê:** DOM = ordem de leitura/acessibilidade e testável por `indexOf`; no desktop, placements explícitos ignoram a ordem do DOM.

```tsx
<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
  <section className="lg:col-start-3 lg:row-start-1">{credits}</section>
  <section className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2">{campaigns}</section>
  <section className="lg:col-start-3 lg:row-start-2">{news}</section>
</div>
```

### Anti-Patterns a evitar

- **`Promise.all` único para tudo:** qualquer falha derruba a página; contraria D-10.
- **Filtrar `error` na renderização:** a exigência é excluir na origem (REQ-58-01); a query deve ter `.eq("status","ready")`.
- **`new Date().getHours()` no servidor:** usa fuso do servidor; proibido por D-06.
- **Fallback silencioso para `America/Sao_Paulo`:** proibido; só vale quando o contrato canônico resolver o default legado.
- **`renderMarkdown` no modo compacto:** renderiza corpo completo e HTML; o compacto usa texto plano.
- **`dangerouslySetInnerHTML` com trecho:** XSS; o trecho deve ser texto React escapado.
- **Passar `storage_path` ao cliente:** D-03 proíbe; só `thumbnailUrl` assinado.
- **Importar `src/lib/i18n/dashboard/**` em `AppShell`, layout ou admin:** quebra o isolamento de payload.
- **Duplicar regra de `availableBalance`:** risco de divergência de crédito; reutilizar o serviço.

## Recommended Implementation Files

> Estrutura sugerida; o planner pode ajustar nomes, mas deve preservar as fronteiras (server-only × client, catálogo isolado, sem tocar shell/admin).

### Novos — dados e funções puras
| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/dashboard/campaigns.ts` | `queryEligibleCampaigns(storeId, limit=3)` com select de 4 colunas, `.eq("status","ready")`, `.order("created_at",{ascending:false})`, `.limit(3)`; mapeia para `{ id, productName, createdAt }`, chama `generateBatchThumbnailUrls`, devolve `thumbnailUrl`; não retorna `storagePath` |
| `src/lib/dashboard/credits.ts` | `loadDashboardCreditState(storeId)` → `{ state:"available", availableBalance }` \| `{ state:"unavailable" }` \| `{ state:"zero", availableBalance:0 }`; usa `CreditService` com detecção de erro (ver Open Question 1) |
| `src/lib/dashboard/greeting.ts` | `resolveDashboardGreeting({ storeName, timeZone, locale, now, messages })` puro; retorna `{ period, storeName }` ou `{ period:"welcome" }`; nenhum acesso a banco |
| `src/lib/dashboard/sections.ts` (opcional) | `SectionResult<T>` + wrappers `loadCampaignSection`/`loadCreditSection` para a página |
| `src/lib/changelog/excerpt.ts` | `buildAnnouncementExcerpt(body, maxLength≈200)`: primeira linha textual (não heading), remove `## `, `- `, `**`, colapsa espaços, corta em limite de palavra + `…`; `null` se vazio |

### Novos — i18n
| Arquivo | Responsabilidade |
|---------|------------------|
| `src/lib/i18n/dashboard/messages.ts` | `DashboardMessages` sem index signature/`any`; chaves de cabeçalho, saudação, créditos, campanhas, anúncio, avisos e acessibilidade |
| `src/lib/i18n/dashboard/catalogs/pt-BR.ts` | Fonte de verdade tipada `: DashboardMessages`, congelada em todos os níveis |
| `src/lib/i18n/dashboard/catalogs/es-419.ts` | `satisfies DashboardMessages`, mesmas chaves/placeholders |
| `src/lib/i18n/dashboard/get-messages.ts` | `getDashboardMessages(locale: SupportedUiLocale): DashboardMessages` reutilizando `SupportedUiLocale` |
| `src/lib/i18n/dashboard/index.ts` | Barrel local (tipos + resolver); **não** reexportado por `src/lib/i18n/index.ts` |

### Novos — componentes
| Arquivo | Tipo | Responsabilidade |
|---------|------|------------------|
| `src/components/dashboard/dashboard-header.tsx` | Server | `h1` saudação, `span lang=""` no nome, ações “Nova campanha” (`/campanhas/nova`) e “Configurar loja” (`/loja`) |
| `src/components/dashboard/dashboard-campaigns.tsx` | Server | Heading “Campanhas disponíveis” + contagem, grade 1/2/3, cards, link `/campanhas`, estado vazio e estado de falha |
| `src/components/dashboard/available-campaign-card.tsx` | Client | Miniatura `<img>` com `onError` → fallback; link `/campanhas/[id]`; nome do produto com `lang=""`; data formatada no servidor (prop string) |
| `src/components/dashboard/dashboard-credits.tsx` | Server | Três estados (available/zero/unavailable), valor + `credits.label*`, link `/conta` 44 px |
| `src/components/dashboard/dashboard-news.tsx` | Server | Monta `excerpt` + labels e renderiza `ChangelogAnnouncement compact`; omite se `entry`/`excerpt` ausente |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `src/app/(app)/dashboard/page.tsx` | Reescrever como orquestrador (sem `getUserOnboardingState`, sem métricas técnicas, sem próximo passo); estados `no_store`/`no_eligible`/`has_eligible`; `lang` na região; `Promise.allSettled` |
| `src/app/(app)/dashboard/loading.tsx` | Esqueletos: header, saldo, campanhas, novidades, na ordem final |
| `src/components/changelog/changelog-announcement.tsx` | Props opcionais `compact`, `excerpt`, `labels`; modo completo intacto; `lang="pt-BR"` só no compacto |
| `src/components/verification/verification-banners.tsx` | `messages?` para review/approved/dismiss; defaults atuais preservados |
| `src/components/readiness/readiness-banner.tsx` | `messages?` para título, CTA e labels dos itens; defaults atuais |
| `src/components/readiness/readiness-check-banner.tsx` | Repassar `messages` opcional ao `ReadinessBanner` |

### Não alterar
`src/components/shell/**`, `src/app/(app)/layout.tsx`, `src/app/(app)/admin/**`, `src/lib/campaign/metrics.ts`, `src/lib/campaign/list.ts`, `src/lib/onboarding/state.ts`, `src/lib/credit/credit-service.ts` (exceto a extensão aditiva se aprovada), `src/components/credit/balance-display.tsx`, `src/lib/i18n/index.ts`, `src/lib/i18n/messages.ts`, `src/lib/i18n/get-catalog.ts`, schema/migrations/APIs.

## Detalhamento das decisões de implementação

### 1. Consulta de campanhas e contagem (REQ-58-01/02)

- `countReadyCampaigns` já filtra `.eq("status","ready")` (`src/lib/campaign/metrics.ts:21-33`) — usar como fonte do rótulo.
- Nova query dedicada em `src/lib/dashboard/campaigns.ts`:
  ```ts
  supabase.from("campaigns")
    .select("id, product_name, created_at, storage_path")
    .eq("store_id", storeId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(3);
  ```
- Não selecionar `input_snapshot`, `status`, `error_message`; o status é constante (`ready`) por construção.
- `generateBatchThumbnailUrls` exige `{ id, status, storagePath }`; mapear `status: "ready"` e `storagePath: row.storage_path` apenas no servidor (`src/lib/campaign/list.ts:173-201`). `campaigns.storage_path` é `TEXT NOT NULL` (`supabase/migrations/20260708000001_create_campaigns_table.sql:16`), portanto o fallback por ausência de path é defensivo, não esperado.
- Assinatura usa `supabaseAdmin` dentro de `list.ts`; a query usa `createServerClient` (RLS owner-only em `campaigns`, migration citada linhas 47-52). Não criar client paralelo.
- Retornar `thumbnailUrl: string | null` e omitir `storagePath` do DTO final.

### 2. Estados operacionais (REQ-58-09)

- `no_store` somente quando `getCurrentStore` retorna `null` (D-02), sem consultar créditos/campanhas.
- `no_eligible_campaigns` quando a contagem `ready` = 0 — inclusive loja com apenas `error`/`generating`.
- `has_eligible_campaigns` quando contagem > 0.
- **Não** usar `getUserOnboardingState` na página; o serviço permanece intacto para outros consumidores (`src/lib/onboarding/state.ts`).
- `getCurrentStore` já engole erro de query e retorna `null` (`src/lib/auth/store-ownership.ts:17-35`); portanto erro de leitura de loja vira `no_store`. É limitação pré-existente do contrato compartilhado — não corrigir nesta fase; registrar como risco.

### 3. Créditos (REQ-58-03) — divergência crítica

**Fato verificado:** `getBalanceBreakdown` faz `.single()` e usa apenas `data`, sem `error` (`src/lib/credit/credit-service.ts:21-37`). Em erro de rede/banco, `data` é `null` e o método retorna `{ availableBalance: 0, ... }`. Logo, `try/catch` no dashboard **não** distingue falha de zero.

Opções:

| Opção | Como | Prós | Contras |
|-------|------|------|---------|
| **A (recomendada)** | Adicionar parâmetro opcional `{ throwOnError?: boolean }` (default `false`); quando `true`, lançar em `error`. Dashboard chama com `true` dentro de `try/catch` | Menor duplicação; comportamento atual byte a byte para todos os chamadores; satisfaz D-04 e o cenário normativo | Toca em serviço compartilhado (aditivo); exige aprovação |
| B | Novo método aditivo `getDashboardCreditState`/`getBalanceBreakdownStrict` no mesmo serviço | Mantém a assinatura original intocada | Duplica a query/forma de leitura; mais superfície |
| C | Leitura dedicada em `src/lib/dashboard/credits.ts` com `.maybeSingle()` + `error` | Zero mudança no serviço compartilhado | Duplica a regra de `availableBalance` (demo ativo + bônus + comprado), risco de divergência; “don’t hand-roll” |
| D | Manter `getBalanceBreakdown` sem mudanças e usar `try/catch` | Nenhuma mudança | **Não atende** ao cenário de falha; falha vira `0` silencioso. Rejeitada |

Recomendação A, com teste específico em `src/lib/credit/__tests__/demo-services.test.ts` (default continua devolvendo zeros) e no dashboard (erro ⇒ indisponível). **Requer confirmação do responsável** (ver Open Question 1).

Estados:
- `availableBalance > 0` → valor + `credits.labelPlural`/`labelSingular` + “Ver detalhes” `/conta`.
- `availableBalance === 0` sem erro → `credits.labelZero` (“0 créditos”), sem “indisponível”.
- erro → `credits.unavailable` + link `/conta`, sem `0`.
- Não renderizar `BalanceDisplay`.

### 4. Saudação (REQ-58-05)

Função pura em `src/lib/dashboard/greeting.ts`:

```ts
type GreetingPeriod = "morning" | "afternoon" | "evening" | "neutral" | "welcome";

resolveDashboardGreeting({
  storeName: string | null,
  timeZone: string | null,
  locale: SupportedUiLocale,
  now: Date,
  messages: GreetingMessages,
}): { period: GreetingPeriod; storeName: string | null }
```

- Período via `Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", hourCycle: "h23" })` + `formatToParts` para obter a hora; normalizar `"24"` → `0`.
- Limites: 6–11 morning, 12–17 afternoon, 18–23/0–5 evening.
- `timeZone` nulo, inválido (`RangeError`) ou formatação falha → `period:"neutral"`.
- `storeName` nulo → `period:"welcome"`.
- **Nunca** usar `now.getHours()` (fuso do servidor) nem `America/Sao_Paulo` como fallback de erro.
- Textos: `greeting.morning/afternoon/evening/neutral/welcome` + `greeting.nameSeparator` (para compor “, ”); o nome é renderizado em `<span lang="">`.

Vetores determinísticos verificados no Node 24.13.1 (`[VERIFIED: node runtime]`). Nota: `America/Asuncion` e `America/Sao_Paulo` compartilham UTC-3 em 2026 (Paraguai adotou UTC-3 permanente desde 2024).
- `2026-07-13T15:00:00Z` + `America/Asuncion` → hora 12 → **afternoon**.
- `2026-07-13T02:00:00Z` + `America/Sao_Paulo` → hora 23 (dia anterior) → **evening**.
- `2026-07-13T15:00:00Z` + `America/Sao_Paulo` → hora 12 → **afternoon**.
- `2026-07-13T14:00:00Z` + `America/Sao_Paulo` → hora 11 → **morning**, enquanto o mesmo instante em `UTC` é hora 14 → **afternoon** (prova que o fuso da loja decide, não o do servidor).
- `timeZone: "Not/AZone"` → `RangeError` → **neutral**.

### 5. Namespace e payload (REQ-58-06)

- Novo namespace fora do barrel global. `src/lib/i18n/index.ts` hoje reexporta `ptBRMessages/es419Messages/getCatalog` (linhas 18-22) e é importado por `src/app/(app)/layout.tsx` e `AppShell` (tipos). Adicionar o catálogo do dashboard ali criaria caminho de import no shell.
- `Messages` (`src/lib/i18n/messages.ts:83-87`) permanece com `common`/`shell`/`settings`; nenhuma chave `dashboard.*`.
- O `satisfies` garante estrutura, não placeholders (`readonly string`); teste copiado do padrão `src/lib/i18n/__tests__/catalogs.test.ts:8-94` deve comparar placeholders por chave, strings não vazias, congelamento e lista exata de chaves.
- Passar aos componentes client **apenas** os sub-objetos usados (anúncio, avisos, cartão), não o catálogo inteiro, para não inflar o payload RSC.
- Medição: `npm.cmd run build` + comparação do First Load JS de `/dashboard` e das rotas do shell antes/depois; teste estático de isolamento (ver Test Strategy) cobre o resto.

### 6. Anúncio compacto (REQ-58-04)

- Estender `ChangelogAnnouncement` (`src/components/changelog/changelog-announcement.tsx:11-88`):
  ```ts
  interface ChangelogAnnouncementProps {
    entry: ChangelogEntry | null;
    compact?: boolean;                 // default false
    excerpt?: string | null;
    labels?: { view?: string; close?: string; dialogLabel?: string };
  }
  ```
- Modo completo: exatamente o comportamento atual (`renderMarkdown`, `Card className="mb-6 p-4 sm:p-6"`, textos “Ver novidades”/“Fechar anúncio”, modal conforme frontmatter).
- Modo compacto: título, data (`formatChangelogDate`), `excerpt` em texto plano, ação `/novidades`, botão fechar; sem `renderMarkdown`/`dangerouslySetInnerHTML`; preservar modal quando `announcement === "modal"`; card sem `mb-6`.
- Dispensa continua `dismissAnnouncement(entry.frontmatter.id)`; **não** chamar `markChangelogAsViewed` no clique do anúncio (o `/novidades` já marca ao montar — `src/app/(app)/novidades/novidades-client.tsx:24-28`). Ver Open Question 3.
- Trecho: `src/lib/changelog/excerpt.ts`. O conteúdo real começa com `## O que mudou` seguido de **lista** (ex.: `content/changelog/2026-10-19-campanhas-mais-qualidade-novos-cenarios.md:11-19`). Interpretar “primeiro parágrafo” como “primeiro bloco textual” (inclui item de lista), senão todos os anúncios atuais ficariam sem trecho. Remover `## `, `- `, `**`; ignorar headings; limite ~200 caracteres em fronteira de palavra + `…`; `null` se não houver texto.
- `lang="pt-BR"` apenas no `<h2>` do título e no `<p>` do trecho (no modo compacto); data, botões e `aria-label` herdam o idioma da interface.

### 7. Avisos localizados (REQ-58-07)

`VerificationBanners` (`src/components/verification/verification-banners.tsx:31-57`) é client e usa `sessionStorage`. Adicionar:
```ts
interface VerificationMessages {
  review: string; approved: string; dismiss: string;
}
export function VerificationBanners({ verificationStatus, messages }: {
  verificationStatus: string | null; messages?: VerificationMessages;
})
```
`ReviewBanner`/`ApprovedBanner` recebem `message?`/`dismissLabel?` e mantêm os textos atuais como default. `aria-label` do fechar passa a usar `messages?.dismiss ?? "Fechar"`.

`ReadinessBanner` (`src/components/readiness/readiness-banner.tsx:4-44`) hoje deriva labels de `missingToDisplay`; adicionar:
```ts
interface ReadinessMessages { title: string; cta: string; cadastroFiscal: string; brandProfile: string; }
export function ReadinessBanner({ missing, messages }: { missing: MissingItem[]; messages?: ReadinessMessages })
```
`ReadinessCheckBanner({ storeId, messages })` repassa. Defaults em português inalterados. Nenhum consumidor admin usa esses componentes (grep em `src/app/(app)/admin/**` não encontrou referências), então a regressão é sobre defaults + ausência de import do catálogo do dashboard.

### 8. Layout, loading e acessibilidade (REQ-58-10/11)

- `page.tsx` renderiza `<div lang={es ? "es-419" : undefined}>`.
- Cabeçalho: `h1` com saudação; ações “Nova campanha” e “Configurar loja” com `min-h-[44px]` e `focus:ring-2`.
- Avisos após o cabeçalho (preservados).
- Grid: DOM saldo → campanhas → novidades; mobile 1 coluna; desktop campanhas `lg:col-span-2` + saldo/novidades na coluna 3 (placements explícitos).
- Cartões: 1 coluna mobile, 2 `sm`, 3 `lg`; nome truncado (`truncate`/`break-words`), data curta no idioma da interface e fuso da loja (recomendado) ou UTC (ver Open Question 4).
- `loading.tsx`: substituir `StatsSkeleton count={4}` por esqueletos na ordem header/saldo/campanhas/novidades; reutilizar `Skeleton`/`CardSkeleton`.
- Sem `PageHeader`, sem “Taxa de Sucesso”, “Total de Campanhas”, “Campanhas Prontas”, “Próximo passo”.
- Estado vazio elegível: `EmptyState` com ícone `Megaphone`, novo texto (não reutilizar `DASHBOARD_NO_CAMPAIGNS`, que afirma “primeira campanha”), CTA `/campanhas/nova`.
- Estado sem loja: `EmptyState` com ícone `Store`, CTA `/loja`, sem consultas.

### 9. Falhas parciais (REQ-58-09)

- Fase 1: `getCurrentStore`, `getUiRenderContext`, `getLatestAnnouncement().catch(() => null)` em paralelo (auth antes).
- Fase 2: `Promise.allSettled([campaigns, credits, marketSettings])`.
- `getUiRenderContext` propaga erro desconhecido por design (`src/lib/i18n/server.ts:80-91`); não capturar — deve chegar ao error boundary (`src/app/(app)/error.tsx`).
- `getLatestAnnouncement` pode lançar (`ChangelogFrontmatterSchema.parse`/fs); capturar sempre → bloco omitido.
- Falha de campanhas → estado de falha + link `/campanhas`; falha de créditos → indisponível + `/conta`; falha de fuso → neutra.

## Don't Hand-Roll

| Problema | Não construir | Usar | Por quê |
|----------|---------------|------|---------|
| URL assinada de miniatura | `createSignedUrl` próprio/rota de imagem | `generateBatchThumbnailUrls` | Já trata bucket, TTL, `allSettled` e `null` por item |
| Contagem `ready` | Query nova de contagem | `countReadyCampaigns` | Semântica `ready`-only já testada |
| Regra de saldo disponível | Cálculo local de demo/bônus/comprado | `CreditService`/`availableBalance` | Evita divergência de crédito |
| Resolução de locale | Seletor/detector/provider | `getUiRenderContext` + `getDashboardMessages` | F57.4 já resolve timeout/fallback/cache |
| Fuso da loja | Default próprio ou `Intl.DateTimeFormat().resolvedOptions()` | `getStoreMarketSettings().timeZone` | Contrato canônico e proveniência |
| Interpolação | Template string manual com `{count}` | `formatMessage` (`src/lib/i18n/translate.ts`) | Já testado e sem HTML |
| Dispensa/modal/foco do anúncio | Componente novo | `ChangelogAnnouncement` + `useChangelogState` | Duplicaria contrato de dispensa e `lastSeenId` |
| Markdown editorial | Parser próprio | `renderMarkdown` (modo completo) / extrator de trecho (compacto) | Subset restrito já validado |

## Common Pitfalls

### Pitfall 1: Achar que `try/catch` detecta falha de crédito
**O que dá errado:** dashboard mostra “0 créditos” quando o banco falha.
**Por que:** `getBalanceBreakdown` ignora `error` e devolve zeros.
**Como evitar:** opção aditiva `throwOnError` (ou leitura dedicada) + teste de erro.
**Sinal:** teste “falha de crédito” passa a exibir `0`.

### Pitfall 2: Fuso do servidor na saudação
**O que dá errado:** usuário em São Paulo vê “Boa tarde” às 11h da manhã.
**Por que:** `new Date().getHours()` usa TZ do processo (servidor em UTC → 14h).
**Como evitar:** `Intl.DateTimeFormat` com `timeZone` explícito e `now` injetável.
**Sinal:** teste UTC vs `America/Sao_Paulo`/`America/Asuncion` diverge.

### Pitfall 3: Contar/exibir campanhas com erro
**O que dá errado:** “Campanhas disponíveis” inclui falhas; cartões de erro aparecem.
**Por que:** reutilizar `getUserOnboardingState`/`getRecentCampaigns`.
**Como evitar:** `countReadyCampaigns` + query `.eq("status","ready")`.
**Sinal:** teste com 4 `ready` + 2 `error` mostra 6.

### Pitfall 4: Vazamento de `storage_path`
**O que dá errado:** path interno vai ao RSC payload/cliente.
**Por que:** mapear a row inteira.
**Como evitar:** DTO explícito com `thumbnailUrl` apenas; teste de chaves do objeto.
**Sinal:** HTML/objeto contém `storage_path`.

### Pitfall 5: Catálogo do dashboard entrando no shell
**O que dá errado:** First Load JS de todas as rotas cresce.
**Por que:** reexportar em `src/lib/i18n/index.ts` ou importar o resolver em `AppShell`.
**Como evitar:** barrel local; teste estático de imports e chaves globais exatas.
**Sinal:** build mostra chunk compartilhado novo.

### Pitfall 6: `lang` contaminando conteúdo dinâmico
**O que dá errado:** nome da loja/produto lido como espanhol; botões lidos como português.
**Por que:** aplicar `lang` na região errada.
**Como evitar:** `lang=""` só no nome; `lang="pt-BR"` só em título/trecho; região es-419.
**Sinal:** teste de atributo no elemento errado.

### Pitfall 7: `renderMarkdown` no modo compacto
**O que dá errado:** corpo completo/HTML no dashboard.
**Por que:** reaproveitar o bloco existente.
**Como evitar:** branch `compact` sem `dangerouslySetInnerHTML`.
**Sinal:** HTML compacto contém `<ul>`/`<h2>` do corpo.

### Pitfall 8: Derrubar a página por `Promise.all`
**O que dá errado:** falha de campanhas esconde saldo e novidades.
**Por que:** rejeição única.
**Como evitar:** `allSettled` + resultados discriminados.
**Sinal:** teste de falha de campanhas não encontra bloco de créditos.

### Pitfall 9: Extrair trecho de heading
**O que dá errado:** anúncio compacto mostra “O que mudou”.
**Por que:** primeiro parágrafo é heading.
**Como evitar:** pular headings; usar primeiro bloco textual (inclui item de lista).
**Sinal:** trecho igual a “O que mudou”.

### Pitfall 10: Reescrever testes antigos “no lugar” sem cobrir os novos estados
**O que dá errado:** cobertura de `no_eligible`/falha parcial some.
**Por que:** os 24 testes atuais afirmam métricas/next-step que serão removidos.
**Como evitar:** substituir por matriz de estados + manter regressões de serviços.

## Runtime State Inventory

Não aplicável: a fase não é rename/refactor/migration; não há dados persistidos, configuração de serviço, estado de OS, segredos ou artefatos de build a migrar. Nenhuma migration é criada ou aplicada.

## Test Strategy

> `workflow.nyquist_validation` está explicitamente `false` em `.planning/config.json`; a seção formal de Validation Architecture é omitida. A estratégia abaixo é a validação proporcional exigida por REQ-58-12.

### Baseline verificado (2026-11-02)

| Comando | Resultado |
|---------|-----------|
| `npx vitest run src/__tests__/app/dashboard "src/app/(app)/dashboard/__tests__"` | **24/24 passed** |
| `npx vitest run src/__tests__/components/shell src/__tests__/app/layout-i18n.test.tsx` | **85/85 passed** |
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run lint` | exit 0 (limitação conhecida: sem cobertura TS) |
| `openspec validate fase-58-composicao-operacional-do-dashboard --strict` | valid |

> **Ambiente Windows/PowerShell:** `npm run ...` pode falhar com “Não é possível executar um documento no meio de um pipeline: C:\WINDOWS\system32\npm”. Usar `npm.cmd run ...` (npm real 11.8.0). `npx` funciona.

### Testes existentes a atualizar

| Arquivo | Ação |
|---------|------|
| `src/__tests__/app/dashboard/dashboard-page.test.tsx` | **Reescrever**: remover asserções de `PageHeader`, métricas, taxa, próximo passo, `getUserOnboardingState`; cobrir `no_store`, `no_eligible`, `has_eligible`, falha de campanhas, falha de créditos, saldo zero vs indisponível, limite 3, links e ausência de métricas técnicas |
| `src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx` | **Reescrever**: estados `available`/`zero`/`unavailable`, texto localizado, link `/conta`, sem `BalanceDisplay` |
| `src/components/changelog/__tests__/changelog-announcement.test.tsx` | **Manter 5 testes** e adicionar compacto (trecho, sem corpo, `lang`, labels, modal compacto, dispensa sem `lastSeenId`) |
| `src/components/readiness/__tests__/readiness-banner.test.tsx` | **Manter 6 testes** e adicionar default pt-BR + localizado es-419 + CTA/labels |
| `src/components/verification/__tests__/verification-banners.test.ts` | **Manter lógica**; adicionar novo teste de render (jsdom) para default e localizado |

### Novos testes recomendados

| Arquivo | Cobre |
|---------|-------|
| `src/lib/dashboard/__tests__/campaigns.test.ts` | `.eq("status","ready")`, `.limit(3)`, `.order(...desc)`, select exato sem `input_snapshot`, exclusão de `error`/`generating`, `thumbnailUrl:null`, ausência de `storagePath` no DTO |
| `src/lib/dashboard/__tests__/credits.test.ts` | available/zero/unavailable; falha não vira zero |
| `src/lib/dashboard/__tests__/greeting.test.ts` | morning/afternoon/evening em São Paulo e Assunção com servidor UTC; hora 24→0; fuso inválido/nulo → neutral; sem loja → welcome; sem “America/Sao_Paulo” em falha |
| `src/lib/changelog/__tests__/excerpt.test.ts` | primeiro bloco textual; ignora heading; remove `- `/`**`; limite em palavra; body vazio → null; não inventa texto |
| `src/lib/i18n/dashboard/__tests__/catalogs.test.ts` | mesmas chaves, sem strings vazias, mesmos placeholders, congelamento, lista exata de chaves |
| `src/lib/i18n/dashboard/__tests__/isolation.test.ts` | `src/lib/i18n/index.ts`, `messages.ts`, `get-catalog.ts`, `src/app/(app)/layout.tsx`, `app-shell.tsx` e `src/app/(app)/admin/**` não importam `i18n/dashboard`; catálogo global não tem chaves `dashboard.*` |
| `src/components/dashboard/__tests__/available-campaign-card.test.tsx` | miniatura presente, `onError` → fallback, link preservado, `lang=""` no nome, alt localizado, 44 px |
| `src/components/dashboard/__tests__/dashboard-credits.test.tsx` | três estados + link + sem “0” em indisponível |
| `src/__tests__/app/dashboard/dashboard-loading.test.tsx` | esqueletos na ordem header/saldo/campanhas/novidades |
| `src/__tests__/app/dashboard/dashboard-localization.test.tsx` | pt-BR/es-419, `lang` por elemento, textos do namespace, fallback de timeout em pt-BR |
| `src/__tests__/app/dashboard/dashboard-layout-order.test.tsx` | ordem DOM saldo→campanhas→novidades; classes `lg:col-start-*`; ausência de `Taxa de Sucesso`/`Próximo passo` |

### Comandos de validação (focados → gate)

```powershell
# Focados
npx vitest run src/lib/dashboard src/lib/i18n/dashboard src/lib/changelog `
  src/components/dashboard src/components/changelog src/components/verification `
  src/components/readiness src/__tests__/app/dashboard "src/app/(app)/dashboard/__tests__"

# Regressão de contratos preservados
npx vitest run src/__tests__/lib/campaign/list.test.ts src/__tests__/lib/onboarding/state.test.ts `
  src/__tests__/lib/onboarding/microcopy.test.ts

# Regressão de shell/admin/localização
npx vitest run src/__tests__/components/shell src/__tests__/app/layout-i18n.test.tsx `
  src/__tests__/app/configuracoes src/app/(app)/admin

# Gates
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
openspec validate fase-58-composicao-operacional-do-dashboard --strict
```

### Medição de payload (task 6.5)

1. `npm.cmd run build`.
2. Comparar o “First Load JS” de `/dashboard` antes/depois no output do build.
3. Verificar `.next/app-build-manifest.json`: nenhum chunk compartilhado novo deve aparecer nas rotas do shell/admin; o chunk da página do dashboard pode conter apenas os rótulos passados aos componentes client.
4. Teste estático de isolamento (acima) como prova determinística; a medição numérica fica registrada como evidência manual.

### Validação visual humana (tasks 7.x)

pt-BR/es-419 em mobile/tablet/desktop; ordem mobile; `lang` por bloco; fuso da loja ≠ servidor e falha de fuso; campanhas com erro fora do dashboard e presentes em `/campanhas`; miniaturas presente/ausente/falha; saldo zero/disponível/indisponível; Slow 4G com preferência resolvida e com timeout; teclado/foco/contraste/truncamento; shell/identidade/admin preservados.

## State of the Art

| Abordagem antiga | Abordagem atual | Quando mudou | Impacto |
|------------------|-----------------|--------------|---------|
| Saudação com hora do servidor | `Intl.DateTimeFormat` com `timeZone` explícito e `now` injetável | F58 | Correção de fuso e testes determinísticos |
| Catálogo global único `Messages` | Namespace por rota fora do barrel | F57.4 (base) / F58 (dashboard) | Evita payload global e mistura de ciclos |
| Lista `ready`+`error` no dashboard | Query `ready`-only na origem | F58 | Operação focada; `/campanhas` preserva o contrato completo |
| `BalanceDisplay` com `—` para falha | Bloco próprio com estados available/zero/unavailable | F58 | Distingue indisponível de zero |
| Anúncio com corpo markdown completo antes do conteúdo | Variante compacta com trecho textual e dispensa | F58 | Reduz ruído; mantém `/novidades` como fonte completa |

**Deprecated/outdated:**
- `dashboard/design-system/pages/dashboard.md` é referência histórica e declara-se “FUTURE SAAS PHASE — NOT PART OF V1”; regras incompatíveis com a F58 não prevalecem (CONTEXT).
- `getUserOnboardingState` no dashboard: substituído pela derivação `getCurrentStore` + contagem `ready`; o serviço continua para outros consumidores.

## Assumptions Log

| # | Alegação | Seção | Risco se errado |
|---|----------|-------|-----------------|
| A1 | Textos exatos em `es-419` (ex.: “Buenos días”, “Buenas tardes”, “Buenas noches”, “Hola”, “Bienvenido a Vendeo”, “Saldo no disponible”, “Ver detalles”) são propostas de tradução, não copy aprovada | Namespace/i18n | Copy precisa de revisão humana; não quebra estrutura, mas o aceite visual pode rejeitar |
| A2 | “Primeiro parágrafo” do anúncio pode ser interpretado como primeiro bloco textual (inclui item de lista) | Anúncio | Se o responsável exigir apenas parágrafo literal, os anúncios atuais ficam sem trecho |
| A3 | Datas dos cartões podem ser formatadas no fuso da loja (além do idioma da interface) | Layout | Se o requisito exigir data “civil” independente de fuso, o dia pode divergir; validar no aceite visual |
| A4 | O link “Ver novidades” do anúncio não deve chamar `markChangelogAsViewed` (o `/novidades` já marca) | Anúncio | Interpretação literal do spec poderia exigir a chamada no clique |
| A5 | `lang="pt-BR"` pode ser aplicado sempre no modo compacto (não só em es-419) | `lang` | Nenhum impacto funcional; apenas diferença de atributo em pt-BR |
| A6 | Não exibir anúncio no estado `no_store` | Estados | Spec não proíbe; remover o bloco é mais conservador, mas pode ser questionado |
| A7 | Extensão aditiva `throwOnError` no `CreditService` é aceitável | Créditos | Se não autorizada, a alternativa C duplica regra de saldo e precisa de aprovação |

## Open Questions (RESOLVED)

1. **Como detectar falha de crédito sem alterar o contrato compartilhado?** — **RESOLVED: D-04.** Adotar a opção aditiva `getBalanceBreakdown(storeId, { throwOnError?: boolean })`, default `false`, e o dashboard usa `true`. Nenhuma regra de crédito muda; todos os consumidores atuais preservam o comportamento.

2. **Trecho do anúncio quando o conteúdo começa com heading + lista** — **RESOLVED: D-05.** Aceitar o primeiro bloco textual, incluindo o primeiro item de lista; remover marcação simples; `null` se não houver texto. O compacto nunca renderiza o corpo completo.

3. **“Ver novidades” deve marcar `lastSeenId` ao clicar?** — **RESOLVED: D-05.** Manter link puro; `/novidades` marca ao montar. A dispensa continua usando `dismissAnnouncement` e não altera `lastSeenId`.

4. **Fuso das datas dos cartões** — **RESOLVED: D-03.** Usar o `timeZone` da loja quando disponível; fallback explícito `UTC`, nunca o fuso do servidor.

5. **Anúncio no estado `no_store`** — **RESOLVED: D-05.** Omitir o anúncio e não consultar créditos/campanhas no estado sem loja.

6. **Escopo do `lang="pt-BR"` no modo compacto** — **RESOLVED: D-09.** Aplicar somente quando a interface estiver em `es-419` e somente no título e no trecho editorial; ações e rótulos permanecem no idioma da interface. Em `pt-BR`, não declarar `es-419`.

7. **Uso de `total` da query para a contagem** — **RESOLVED: D-03.** Manter `countReadyCampaigns` como contrato explícito e executar a contagem e a lista de 3 em paralelo; não usar `count: "exact"` na consulta da lista.

## Environment Availability

| Dependência | Necessária para | Disponível | Versão | Fallback |
|-------------|-----------------|-----------|--------|----------|
| Node.js | Runtime/testes | ✓ | v24.13.1 | — |
| npm (real) | Gates | ✓ | 11.8.0 | Usar `npm.cmd` no PowerShell |
| npx | Vitest/CLI | ✓ | 11.8.0 (npm) | `node_modules/.bin/vitest` |
| Vitest | Testes | ✓ | 4.1.9 | — |
| OpenSpec CLI | `validate --strict` | ✓ | 1.3.1 | — |
| Next.js build | Gate de build/medição | ✓ | `^15.3.1` | — |
| Supabase local/Docker | Não necessário (sem migration/DB) | — | — | — |
| `.next` build existente | Baseline de medição | ✓ | manifest presente | Rebuild com `npm.cmd run build` |

**Dependências ausentes sem fallback:** nenhuma.
**Dependências ausentes com fallback:** nenhuma.
**Observação operacional:** `npm run` no PowerShell pode resolver um `C:\Windows\System32\npm` inválido; usar `npm.cmd run`. `npx` funcionou normalmente.

## Security Domain

`workflow.security_enforcement` está habilitado (ASVS L1, bloqueio em high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | sim | `requirePageUser()` inalterado; redirect `/login` |
| V3 Session Management | sim (indireto) | Cookies gerenciados pelo Supabase/Next; nenhuma mudança |
| V4 Access Control | sim | `storeId` sempre derivado de `getCurrentStore`/sessão; RLS owner-only em `campaigns`/`credit_balances`; nenhum `storeId` vindo do cliente |
| V5 Input Validation | sim (mínimo) | Nenhum input novo; trecho tratado como texto; links fixos; `formatMessage` sem HTML |
| V6 Cryptography | sim (indireto) | URLs assinadas via `supabaseAdmin.storage.createSignedUrl` (TTL 3600 s); não implementar assinatura própria |
| V7 Error Handling/Logging | sim | Falhas de seção isoladas; não logar nome de loja/PII; não expor `storage_path`/erro interno |
| V8 Data Protection | sim | RSC payload só com `thumbnailUrl` assinado e textos de interface |
| V13 API/Web Service | não | Nenhuma rota nova |
| V14 Configuration | não | Nenhuma env/flag nova |

### Known Threat Patterns for Next.js Server Components + Supabase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR em campanhas/miniaturas | Elevation of Privilege / Information Disclosure | `store_id` derivado do usuário; RLS; nunca aceitar `storeId` de URL/body |
| Vazamento de `storage_path`/bucket | Information Disclosure | DTO sem `storagePath`; apenas URL assinada; teste de chaves |
| XSS no anúncio | Tampering | Modo compacto em texto React (sem `dangerouslySetInnerHTML`); modo completo mantém `renderMarkdown` sanitizado |
| Injeção de HTML no trecho | Tampering | Remover marcação e renderizar texto; sem `eval`/HTML |
| Open redirect | Tampering | Links estáticos `/novidades`, `/campanhas`, `/conta`, `/loja` |
| Cache cruzado de dados por usuário | Information Disclosure | `getUiRenderContext` usa `cache()` por requisição; nenhum cache de módulo com dados de loja |
| Exposição de erro interno | Information Disclosure | Estados genéricos localizados; detalhes só em log server-side sem PII |
| CSRF | — | Nenhuma mutação nesta fase; dispensa é `localStorage` |

## Sources

### Primary (HIGH confidence — código verificado neste worktree)
- `src/app/(app)/dashboard/page.tsx` (estados, métricas, saudação local, próximo passo)
- `src/app/(app)/dashboard/loading.tsx`
- `src/lib/campaign/metrics.ts` (`countReadyCampaigns` `ready`-only; `getRecentCampaigns` `ready`+`error`)
- `src/lib/campaign/list.ts` (`generateBatchThumbnailUrls`, filtro `ready`+`storagePath`)
- `src/lib/credit/credit-service.ts` (`getBalanceBreakdown` sem tratamento de `error`)
- `src/lib/market-preferences/store-market-settings-service.ts` (`getStoreMarketSettings`, `timeZone`, erro)
- `src/lib/i18n/server.ts` (timeout 1000 ms, fallback), `messages.ts`, `get-catalog.ts`, `index.ts`, `catalogs/*`, `__tests__/catalogs.test.ts`
- `src/components/changelog/changelog-announcement.tsx`, `src/hooks/use-changelog-state.ts`, `src/app/(app)/novidades/novidades-client.tsx`
- `src/components/verification/verification-banners.tsx`, `src/components/readiness/readiness-banner.tsx`, `readiness-check-banner.tsx`
- `src/app/(app)/configuracoes/page.tsx` (padrão de `lang`), `src/__tests__/app/configuracoes/configuracoes-page.test.tsx`
- `src/app/(app)/layout.tsx`, `src/components/shell/app-shell.tsx`
- `src/app/(app)/conta/page.tsx` (padrão de isolamento de crédito)
- `content/changelog/2026-10-19-campanhas-mais-qualidade-novos-cenarios.md` (estrutura real do corpo)
- `supabase/migrations/20260708000001_create_campaigns_table.sql` (`storage_path NOT NULL`, RLS)
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/**`
- Baseline executado: Vitest 24/24 e 85/85; typecheck 0; lint 0; OpenSpec valid.

### Secondary (MEDIUM confidence)
- `openspec/design-system/MASTER.md` (tokens, tipografia, dark mode, acessibilidade)
- `openspec/design-system/pages/dashboard.md` (referência histórica; não prevalece)

### Tertiary (LOW confidence)
- Wording exato `es-419` (A1): proposta de tradução, pendente de aprovação humana.

## Metadata

**Confidence breakdown:**
- Stack/arquitetura: HIGH — todo o fluxo foi lido no código e o baseline de testes/gates foi executado.
- Padrões de i18n: HIGH — F57.4 tem catálogo, resolvedor, testes e exemplo de `lang`.
- Créditos: MEDIUM — o código comprova que o erro não é detectável; a solução recomendada exige decisão.
- Pitfalls: HIGH — derivados de código real e de specs normativas.
- Copy es-419: LOW — proposta, não aprovada.

**Research date:** 2026-11-02
**Valid until:** 2026-12-02 (30 dias; stack estável, sem dependências novas)
