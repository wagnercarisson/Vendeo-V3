# Vendeo — Roadmap

> Milestones: **Contas e Propriedade** (v1.2 ✓) | **Persistência e Entrega da Campanha** (v1.3 ✓) | **Experiência SaaS** (v1.4 ✓)
> v1.2 estabelece a camada fundacional de contas e propriedade. v1.3 implementa persistência e entrega de campanhas. v1.4 transforma o Vendeo em um produto SaaS coerente.

---

## Phase 7 — Sessão e Login Vertical

**Status:** `Complete` ✓
**Slug:** `fase-7-sessao-login-vertical`
**Change:** `openspec/changes/archive/2026-07-04-fase-7-sessao-login-vertical/`

Infraestrutura de sessão: `@supabase/ssr`, middleware, login, logout, `requireUser()`, `sanitizeRedirectPath()`.

**Entrega:** Usuário provisionado → `/login` → cookie SSR → rota protegida → `POST /auth/signout`.

---

## Phase 8 — Ciclo de Conta ✓

**Status:** `Complete` ✓
**Slug:** `fase-8-ciclo-de-conta`
**Change:** `openspec/changes/fase-8-ciclo-de-conta/`
**Plans:** `.planning/phases/08-ciclo-de-conta/08-01-PLAN.md` — `08-04-PLAN.md`
**Context:** `.planning/phases/08-ciclo-de-conta/CONTEXT.md`

Ciclo completo de credenciais: signup, confirmação de email, recuperação de senha.

**Entrega:** Ciclo de signup (`cria conta → /check-email → confirma email → login`) e ciclo de recuperação (`forgot → email → confirma token → nova senha → login`).

**Dependências:** Phase 7

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 08-01 | 1 | ✓ | Setup & Middleware Expansion |
| 08-02 | 2 | ✓ | Pages & Route Handler |
| 08-03 | 3 | ✓ | Tests |
| 08-04 | 4 | ✓ | UAT — Local & Online |

**Tests:** 383 passing (344 prior + 39 novos)
**UAT:** 14/14 passed, 0 issues. SMTP Resend.com configurado e funcional, domínio vendeo.tech com DKIM/DMARC/SPF, templates PT-BR no Dashboard remoto, fluxo signup e recovery validados com Gmail em beta.vendeo.tech.

---

## Phase 9 — Cutover de Ownership e Onboarding ✓

**Status:** `Complete` ✓
**Slug:** `fase-9-cutover-ownership`
**Change:** `openspec/changes/fase-9-cutover-ownership/`
**Plans:** `.planning/phases/09-cutover-ownership/09-01-PLAN.md` — `09-04-PLAN.md`
**Context:** `.planning/phases/09-cutover-ownership/09-CONTEXT.md`

Vinculação user→store, `getCurrentStore()`, `requireOwnership()`, RLS em `stores`, routes ownership, server components, remoção de localStorage.

**Entrega:** Migration `user_id` + RLS em `stores`. Ownership nas rotas CRUD. Páginas transformadas em server component. `localStorage("store_id")` removido de todos os componentes. 26 novos testes (410 total). TypeScript, lint e build limpos.

**Dependências:** Phase 7, Phase 8

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 09-01 | 1 | ✓ | Database & Auth Helpers Core |
| 09-02 | 1 | ✓ | API Routes — Ownership |
| 09-03 | 2 | ✓ | Server Components & Client Refactoring |
| 09-04 | 3 | ✓ | Tests, Verificação e Regressão |

**Migration:** `20260706000001_add_user_id_to_stores.sql` aplica coluna `user_id`, RLS policy e `GRANT SELECT TO authenticated`. ⚠️ Destrutiva — deleta dados filhos antes de adicionar coluna. Não rodar em produção sem backfill.

**Procedimentos manuais pendentes:**
1. Rodar migração no Supabase DB (após verificar se `auth.uid()` function existe)
2. Remover `store_id` das variáveis de ambiente se existirem
3. Fazer backfill de user_id para stores existentes antes de ativar RLS em produção
4. Validar fluxo E2E: signup → redirect /store → criar loja → recarregar → dashboard → criar campanha

---

## Phase 10 — Perímetro Multi-tenant ✓

**Status:** `Complete` ✓
**Slug:** `fase-10-perimetro-multitenant`
**Change:** `openspec/changes/fase-10-perimetro-multitenant/`
**Plans:** `.planning/phases/10-perimetro-multitenant/10-01-PLAN.md` — `10-06-PLAN.md`
**Context:** `.planning/phases/10-perimetro-multitenant/10-CONTEXT.md`

Fechar o perímetro multi-tenant: erros centralizados, CSRF, `requireAuthorizedStore()` em ~20 handlers, Server Actions com auth, RLS em 4 tabelas filhas, Storage policies, matriz de testes parametrizados.

**Entrega:** Toda superfície existente respeita o tenant. ~100 novos testes. TypeScript, lint e build limpos.

**Dependências:** Phase 9

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 10-01 | 1 | ✓ | Auth Guards & Error Contracts |
| 10-02 | 2 | ✓ | Route Handlers — requireAuthorizedStore + CSRF |
| 10-03 | 2 | ✓ | Server Actions — Extração de Serviço + Guards |
| 10-04 | 1 | ✓ | RLS + Storage Policies |
| 10-05 | 3 | ✓ | Matriz de Testes Parametrizados |
| 10-06 | 4 | ✓ | Validação e Regressão |

**Tests:** 51 files, 457 tests passing (47 novos em relação à Phase 9)
**TypeScript, lint, build:** Todos verdes
**Procedimentos manuais pendentes:**
1. Rodar migration `enable_rls_child_tables` no Supabase DB (`supabase/migrations/20260707000001_enable_rls_child_tables.sql`)
2. Rodar Storage policies migration (mesmo arquivo)
3. Validar fluxo E2E: acessar rota alheia → 404, mutação cross-origin → 403
4. Bucket `store-logos` mantido como exceção temporária — inventário e migração na Fase 11

---

## Phase 11 — Verificação e Hardening ✓

**Status:** `Complete` ✓
**Slug:** `fase-11-verificacao-hardening`
**Change:** `openspec/changes/archive/2026-07-08-fase-11-verificacao-hardening/`

Testes RLS, cross-tenant, E2E de sessão, vazamento de storage, regressão, fechamento do catálogo de cenários.

**Entrega:** Evidência formal de conclusão da milestone — todos os cenários de segurança VERDES. Catálogo D8: 21/21 PASS. Inventário store-logos: 0 objetos órfãos.

**Dependências:** Phase 10

---

## v1.3 — Persistência e Entrega da Campanha

> Milestone: **Persistência e Entrega da Campanha**
> O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

---

## Phase 12 — Fundação DB/Storage ✓

**Status:** `Complete` ✓
**Slug:** `fase-12-fundacao-db-storage`
**Change:** `openspec/changes/fase-12-fundacao-db-storage/`
**Plans:** `.planning/phases/12-fundacao-db-storage/12-01-PLAN.md` — `12-05-PLAN.md`
**Context:** `.planning/phases/12-fundacao-db-storage/12-CONTEXT.md`

Criar a infraestrutura fundacional de banco e Storage para campanhas: tabela `public.campaigns`, bucket privado `campaign-images`, RLS e políticas de acesso. Fase puramente de banco + Storage — não cria services, não modifica app code, não altera fluxo de geração.

**Entrega:** Tabela `campaigns` com DDL completa, bucket `campaign-images` com policies, smoke tests 9/9 PASS, UAT manual com 10 verificações.

**Dependências:** Phases 7–11

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 12-01 | 1 | ✓ | Migration 1 — Create campaigns table DDL |
| 12-02 | 1 | ✓ | Migration 2 — Create campaign-images bucket + policies |
| 12-03 | 2 | ✓ | Smoke Tests & Manual Verification |
| 12-04 | 3 | ✓ | Migration Squash (opcional) |
| 12-05 | 3 | ✓ | UAT Checklist & Validação |

**Smoke tests:** 9/9 PASS
**UAT:** 5/10 verificado (RLS, CHECK, trigger, isolation) — pendente deploy online para validação completa

---

## Phase 13 — Serviço de Persistência e Download

**Status:** `Planned`
**Slug:** `fase-13-servico-persistencia-download`
**Change:** `openspec/changes/fase-13-servico-persistencia-download/`
**Plans:** `.planning/phases/13-servico-persistencia-download/13-01-PLAN.md` — `13-03-PLAN.md`
**Context:** `.planning/phases/13-servico-persistencia-download/13-CONTEXT.md`

Criar camada de persistência isolada para campanhas: tipos manuais (`types.ts`), 7 helpers de escrita/leitura (`persistence.ts`), e rota de download com signed URL (`GET /api/campaign/[id]/download/`). Não modifica o fluxo de geração existente.

**Entrega:** `src/lib/campaign/types.ts`, `src/lib/campaign/persistence.ts`, `GET /api/campaign/[id]/download`, testes unitários (19+6 cenários), TypeScript/lint/build limpos.

**Dependências:** Phases 7–12

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 13-01 | 1 | ○ | Types & Persistence Service |
| 13-02 | 1 | ○ | Download Route |
| 13-03 | 2 | ○ | Tests — Persistence Service & Download Route |

---

## Phase 14 — Integração no Fluxo de Geração (Next)

**Status:** `Pending`
**Slug:** `fase-14-integracao-fluxo-geracao`

Modificar o fluxo de geração (`generate-image`) para salvar a campanha pós-renderização: orquestrar `createCampaign` → `dataUrlToCampaignImage` → `uploadCampaignImage` → `updateCampaignReady`, com compensação via `updateCampaignError` + `deleteCampaignImage` em falha.

**Dependências:** Phase 13

---

## Phase 15 — Página de Campanha ✓

**Status:** `Complete` ✓
**Slug:** `fase-15-pagina-de-campanha`
**Change:** `openspec/changes/fase-15-pagina-de-campanha/`
**Plans:** `.planning/phases/15-pagina-de-campanha/15-01-PLAN.md` — `15-03-PLAN.md`
**Context:** `.planning/phases/15-pagina-de-campanha/15-CONTEXT.md`

Página `/campanha/[id]` com preview e download da campanha persistida. Server Component com RLS, 4 estados visuais (ready/generating/stale/error), signed URL para preview, e kit de publicação.

**Dependências:** Phase 13, Phase 14

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 15-01 | 1 | ✓ | Data/Display Contract — display.ts com getCampaignForDisplay, generateSignedPreviewUrl, computeDisplayStatus |
| 15-02 | 2 | ✓ | UI `/campanha/[id]` — page.tsx + client.tsx com 4 estados + middleware matcher |
| 15-03 | 2 | ✓ | Testes e Verificação — page states, middleware, typecheck/lint/build |

**Tests:** 524 passing (60 files, 19 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

---

## v1.4 — Experiência SaaS

> Milestone: **Experiência SaaS** (F18-F22) — F18 ✅, F19 ✅, F20 ✅, F21 ✅, F22 ○ Pending
> O Vendeo passa a parecer e funcionar como um produto SaaS coerente — app shell profissional, navegação PT-BR, dashboard, onboarding, busca e mobile.

---

## Phase 18 — App Shell + UI Base + Rotas

**Status:** `Complete (2026-07-13)`
**Slug:** `fase-18-app-shell-ui-base-rotas`
**Change:** `openspec/changes/fase-18-app-shell-ui-base-rotas/`
**Plans:** `.planning/phases/18-app-shell-ui-base-rotas/18-01-PLAN.md` — `18-03-PLAN.md`
**Context:** `.planning/phases/18-app-shell-ui-base-rotas/18-CONTEXT.md`

App Shell profissional (sidebar + topbar + drawer mobile + menu de conta), 7 componentes base de UI, reorganização de rotas para PT-BR (`/campanhas/nova`, `/campanhas`, `/campanhas/[id]`, `/loja`, `/conta`, `/dashboard`), 5 redirects 301, migração de todas as páginas existentes, design token cleanup.

**Entrega:** Navegação SaaS profissional com sidebar/topbar, 7 componentes UI enxutos, rotas PT-BR consistentes, dashboard placeholder, página de conta mínima, AuthHeader removido, 25+ testes. TypeScript/lint/build limpos.

**Dependências:** Phases 7–17 (fundação completa)

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 18-01 | 1 | ✓ | UI Base (Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader) + estrutura diretórios + root layout cleanup + redirects next.config.ts + testes |
| 18-02 | 2 | ✓ | App Shell: sidebar, topbar, account-menu, sidebar-drawer, (app)/layout.tsx + testes shell |
| 18-03 | 2 | ✓ | Migração rotas: campanhas/nova, campanhas, campanhas/[id], loja; criar dashboard + conta; middleware matcher; remover AuthHeader; token cleanup; testes redirects + middleware |

---

## Phase 16 — Minhas Campanhas

**Status:** `Complete`
**Slug:** `fase-16-minhas-campanhas`
**Change:** `openspec/changes/fase-16-minhas-campanhas/`
**Plans:** `.planning/phases/16-minhas-campanhas/16-01-PLAN.md` — `16-03-PLAN.md`
**Context:** `.planning/phases/16-minhas-campanhas/16-CONTEXT.md`

Página `/minhas-campanhas` com listagem de campanhas persistidas, thumbnails via signed URL, estado vazio, e navegação. Fecha o ciclo da milestone v1.3 ("gerou, saiu, voltou, encontrou e baixou").

**Dependências:** Phase 13, Phase 15

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 16-01 | 1 | ✅ | Contrato de listagem — list.ts com listCampaigns, CampaignListItem, generateBatchThumbnailUrls |
| 16-02 | 2 | ✅ | UI `/minhas-campanhas` + navegação — page.tsx, client.tsx, header, middleware, back link |
| 16-03 | 2 | ✅ | Testes e Verificação — helper, page states, middleware, typecheck/lint/build |

---

## Phase 17 — Edição de Publication Copy

**Status:** `Complete (2026-07-10)`
**Slug:** `fase-17-edicao-publication-copy`
**Change:** `openspec/changes/fase-17-edicao-publication-copy/`
**Plans:** `.planning/phases/17-edicao-publication-copy/17-01-PLAN.md` — `17-02-PLAN.md`
**Context:** `.planning/phases/17-edicao-publication-copy/17-CONTEXT.md`

O lojista pode editar o publication copy (caption, hashtags, cta_post) da campanha sem regerar a imagem. Adiciona coluna `publication_copy_current` (JSONB) para armazenar a versão editada, com fallback `current > snapshot > vazio` no display layer. Inclui validação server-side, rota PATCH segura (CSRF + auth + ownership), e UI de edição inline na página `/campanha/[id]`.

**Dependências:** Phase 12 (tabela `campaigns`), Phase 15 (página `/campanha/[id]`, display contract), Phase 13 (padrão route handler)

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 17-01 | 1 | ✅ | Migration + Validation + Display Contract — migration SQL, types.ts, publication-copy.ts, display.ts (getEffectivePublicationCopy), 12 testes |
| 17-02 | 2 | ✅ | PATCH Route + UI Edit Mode — route.ts, client.tsx modo edição inline, 17 testes |

---

## Phase 19 — Onboarding & Estados Vazios

**Status:** `Complete (2026-07-13)`
**Slug:** `fase-19-onboarding-estados-vazios`
**Change:** `openspec/changes/fase-19-onboarding-estados-vazios/`
**Plans:** `.planning/phases/19-onboarding-estados-vazios/19-01-PLAN.md` — `19-03-PLAN.md`
**Context:** `.planning/phases/19-onboarding-estados-vazios/19-CONTEXT.md`

Helper centralizado de onboarding (`getUserOnboardingState`) com 3 estados, dashboard inteligente com 3 estados visuais, substituição de redirects por orientação contextual em `/campanhas` e `/campanhas/[id]`, e microcopy centralizada.

**Dependências:** Phase 18

**Tests:** 628 passing (86 files, 28 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Commits:**
- `8dfc693` — 19-01: Fundação do Onboarding Helper — types, count, state, microcopy + 9 testes
- `801948a` — 19-02: Dashboard Inteligente — async server component com 3 estados + 6 testes
- `bbd3d0e` — 19-03: Campanhas + Detalhe sem Loja — redirects substituídos por empty state/404 + 7 testes
- `ef18659` — Atualiza testes existentes para redirect→empty state e nova microcopy

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 19-01 | 1 | ✅ | Fundação do Onboarding Helper — types, count, state, microcopy + 9 testes |
| 19-02 | 2 | ✅ | Dashboard Inteligente — async server component com 3 estados + 6 testes |
| 19-03 | 2 | ✅ | Campanhas + Detalhe sem Loja — redirects substituídos por empty state/404 + 7 testes |

---

## Phase 20 — Dashboard

**Status:** `Complete (2026-07-13)` ✓
**Slug:** `fase-20-dashboard`
**Change:** `openspec/changes/fase-20-dashboard/`
**Plans:** `.planning/phases/20-dashboard/20-01-PLAN.md` — `20-03-PLAN.md`
**Context:** `.planning/phases/20-dashboard/20-CONTEXT.md`

Dashboard com conteúdo real para `has_store_with_campaigns`: saudação com hora do servidor, métricas consolidadas (total, prontas, taxa de sucesso), campanhas recentes sem thumbnails, card de próximo passo adaptativo. Preserva estados vazios da F19.

**Entrega:** `getGreeting` com 3 períodos (manhã/tarde/noite), 3 cards de métricas em grid responsivo, lista de campanhas recentes sem thumbnails, card de próximo passo adaptativo (review ou criar nova), links "Configurar loja", "Ver todas", "Nova campanha". Placeholder F19 removido.

**Dependências:** Phase 18, Phase 19

**Tests:** 651 passing (87 files, 23 novos)
**TypeScript:** Clean | **Lint:** Clean | **Build:** Clean

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 20-01 | 1 | ✅ | Métricas e Recentes — `metrics.ts` (countCampaigns, countReadyCampaigns, getCampaignSuccessRate, getRecentCampaigns, RecentCampaignItem) + reexport count.ts + 9 testes |
| 20-02 | 2 | ✅ | Dashboard Completo — saudação, 3 cards métricas, campanhas recentes, next-step card, links |
| 20-03 | 2 | ✅ | Testes e Acabamento Responsivo — 20 testes (15 novos): saudação mock Date, métricas, edge cases, responsividade |

---

## Phase 21 — Histórico e Busca ✅

**Status:** `Complete` ✅
**Slug:** `fase-21-historico-busca`
**Change:** `openspec/changes/2026-07-14-fase-21-historico-busca/`
**Plans:** `.planning/phases/21-historico-busca/21-01-PLAN.md` — `21-03-PLAN.md`
**Context:** `.planning/phases/21-historico-busca/21-CONTEXT.md`

Evoluir a página `/campanhas` de lista plana com `limit(50)` para listagem completa com busca textual (ILIKE), filtros por status (ready/error) e data (presets), ordenação por data/nome, paginação page-based (10 itens/página), URL state compartilhável, e componente `Pagination` reutilizável.

**Entrega:** `listCampaigns(storeId, params?)` com `ListCampaignsResult`, `countCampaignsFiltered`, `parseCampaignListSearchParams`, SSR com searchParams, client com busca+filtros+pagination, `useDebounce` hook, `Pagination` component, 40 novos testes (691 total). TypeScript/lint/build limpos.

**Dependências:** Phase 18, Phase 19, Phase 20

**Planos:**
| Plan | Wave | Status | Descrição |
|------|------|--------|-----------|
| 21-01 | 1 | ✅ | Query Contract — listCampaigns evoluído, countCampaignsFiltered, search-params.ts, 29 testes |
| 21-02 | 2 | ✅ | URL State + Filtros — SSR searchParams, client refatorado, useDebounce, empty states, 12 testes |
| 21-03 | 2 | ✅ | Pagination + Acabamento — Pagination component, integração, 10 testes |

**Commits:**
- `3886f96` — 21-01
- `b31923b` — 21-02
- `48a6e3b` — 21-03
