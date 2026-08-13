# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

O Vendeo é hoje uma aplicação SaaS multi-tenant com autenticação completa, isolamento de propriedade via RLS, geração de campanhas com IA, app shell profissional, onboarding, dashboard, busca, paginação e suporte mobile — pronta para receber os primeiros usuários reais em ambiente controlado.

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Current State

**F38.2 Admin de Custos Operacionais + Configurações Econômicas — COMPLETE (2026-08-11)** — 15/15 plans: painel `/admin/ai-operation-costs` (KPIs, filtros, tabela por entrega, drilldown call-level, agregados por segmento, breakdown créditos brutos/estornos/líquidos + receita/resultado/margem), parâmetros econômicos configuráveis (`usd_brl_rate`, `credit_value_brl` com audit), badges de confiança, correção `/admin/metrics` (Custo Médio IA call-level). 1839 testes, verificação I1-I6 63/63 em banco real, 4 gates verdes, UAT manual 12/12 aprovado.

**Shipped: v1.4 — Experiência SaaS (2026-07-15)**

A milestone v1.4 transformou o Vendeo em um produto SaaS coerente: app shell profissional, navegação PT-BR, dashboard, onboarding, busca/filtros/paginação e suporte mobile responsivo.

- **App Shell + UI Base**: 7 componentes UI (Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader), sidebar com 4 nav links + Lucide icons, topbar com CTA + AccountMenu, drawer mobile com acessibilidade
- **Rotas PT-BR**: `/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta` — 5 redirects 301, middleware atualizado
- **Onboarding & Empty States**: helper 3 estados (no_store, has_store_no_campaigns, has_store_with_campaigns), empty states contextuais em vez de redirects, microcopy centralizada
- **Dashboard Real**: saudação com 3 períodos (manhã/tarde/noite), 3 metric cards (total, prontas, taxa de sucesso), campanhas recentes, card de próximo passo adaptativo
- **Histórico e Busca**: busca ILIKE, filtros por status/data, ordenação, paginação page-based (10/página), URL state compartilhável, Pagination component com ellipsis
- **Mobile Hardening**: drawer com focus trap + body scroll lock + prefers-reduced-motion, touch targets ≥44px em toda a interface, responsivo validado em 320/375/768px

**1345 testes automatizados**, **170 test files**, **TypeScript/lint/build limpos**.

**v1.5 — Lançamento Externo Controlado (2026-08-05):** F36 Onboarding por Abas completa (6 plans / 5 waves, 1479 testes, 31/31 requirements). F38 (Tabela de Custos por Operação) concluída (8/8 plans, 1597 testes, UAT 4/4). F38.1 (Apuração de Custos de IA por Entrega) **CONCLUÍDA** (11/11 plans, 1713 testes, UAT validado — fechada como camada de estimativa operacional granular). F37 (Revisão e Aprovação da Arte) em planejamento.

## Current Milestone: v1.5 — Lançamento Externo Controlado

**Goal:** Preparar o Vendeo para o primeiro público real controlado — copy inteligente via IA, sistema de créditos, admin operacional para suporte beta, controle de custos, observabilidade e operação monitorada.

**Target features:**
- Copy Director (serviço de IA de texto persuasivo com title, caption, hashtags, CTA)
- Sistema de créditos (saldo por loja, transações imutáveis, grant/estorno)
- Pipeline paralelo (Copy ∥ Image) com merge, fallback e atomicidade financeira
- Admin operacional: diretório de usuários, grant manual auditável, extrato, triagem de erros
- Controle de custos (rate limit 10/h, teto 30/dia, timeout 120s)
- Saldo visível na topbar + seção de créditos em `/conta` com extrato
- Observabilidade (logging estruturado, telemetria IA, dashboard operacional)
- Refinamento visual + Launch Readiness (UAT externo, runbook, feature flag)
- Tabela de Custos por Operação (F38): fonte única de custo em `credit_operation_costs`, admin sem deploy, auditoria old/new, UI dinâmica sem "1 crédito" hardcoded
- Apuração de Custos de IA por Entrega (F38.1, desdobramento da F38): custo real por chamada de IA (tokens/USD) agregado por entrega via `generation_events` + `operation_run_id`, tabela de preço versionada `ai_model_pricing` + admin API, `AiCostTracker` como camada única de registro, views/RPCs de reconciliação USD × créditos (sem UI) — **CONCLUÍDA** (11/11 plans, 1713 testes, UAT validado); fechada como **camada de ESTIMATIVA OPERACIONAL GRANULAR** — o ajuste provisório da tool image_generation (`responses:image_generation = USD 0.065`) é estimativa beta provisória (calibrada por UAT/dashboard/CSV), NÃO é custo financeiro real; reconciliação financeira real fica para a próxima fase
- **Admin de Custos Operacionais + Configurações Econômicas (F38.2, desdobramento da F38, v1.5) — CONCLUÍDA (11/11 plans, 1832 testes, verificação I1-I6 + 4 gates verdes)**: painel admin `/admin/ai-operation-costs` ("Custos de Operação") com KPIs/filtros/tabela por entrega/drilldown call-level e agregados por segmento econômico (D9); Parâmetros Econômicos configuráveis por admin (`economic_parameters` — `usd_brl_rate` e `credit_value_brl`, defaults 1.00, auditoria append-only + RPC `admin_set_economic_parameter`) na página `/admin/operation-costs` (título "Configurações Econômicas", rota mantida); badges de confiança do custo (persistência `cost_formula_version`/`cost_estimation_note`/`text_component_usd`/`image_tool_component_usd` em `generation_events`); correção do `/admin/metrics` (card "Custo Médio IA" via apuração call-level); UI preparada para F38.3 (reconciliação provider). Fonte: `openspec/changes/fase-38-2-admin-custos-operacionais/`
- **Stripe / compra real de créditos**: adiado para F40 (v1.7, pós-beta)

<details>
<summary>Versões anteriores</summary>

**v1.2 — Contas e Propriedade (shipped 2026-07-08)**

- Autenticação completa: signup, confirmação de email, login, sessão SSR via @supabase/ssr, logout, recuperação de senha
- Vínculo user→store: stores.user_id como fonte canônica de ownership
- Isolamento multi-tenant: RLS em 5 tabelas + Storage policies, 20+ route handlers protegidos
- Serviço publicável: beta.vendeo.tech operacional
- Verificação formal: D8 catalog com 21 cenários de segurança validados

**v1.1 — Motor de Campanhas (shipped 2026-07-03)**

- AI Campaign Intelligence: OpenAI/Anthropic providers com structured output
- Visual Rendering: programmatic renderer + IA-generated images
- Store Identity: logo upload, brand analysis, visual signature com drift detection
- Campaign Briefing: identity-aware pipeline com StoreIdentitySnapshot 2.0

**v1.0 — Core de Geração (shipped 2026-07-03)**

- Formulário guiado com máscara BRL, upload de imagem, validação inline
- Store identity: form + API routes + Supabase persistence
- Route split: `/` = campaign, `/store` = store identity
</details>

## Requirements

### Validated

- ✓ **INPT-01** — Product name, price/offer, and short description entry — v1.0
- ✓ **INPT-02** — Product image upload with preview and validation — v1.0
- ✓ **INPT-03** — Store info (name, segment/subsegment) with persistence — v1.0
- ✓ **INPT-04** — Basic visual identity (colors, logo, name style) — v1.0 + v1.1
- ✓ **DSGN-01** — No free-form editor — form controls and presets only — v1.0
- ✓ **DSGN-02** — UI/UX Pro Max as design tool, not runtime dep — v1.0
- ✓ **DSGN-03** — Campaign composition rules documented — v1.0
- ✓ **DSGN-04** — V1 scope guardrail (no auth/dashboard/plans) — v1.0
- ✓ **AI-01** — AI interprets product/offer/store context and generates structured spec — v1.1
- ✓ **AI-02** — AI generates commercial copy (title, subtitle, CTA) — v1.1
- ✓ **AI-03** — AI output includes visual parameters (palette, hierarchy, layout, badge) — v1.1
- ✓ **AI-04** — AI provider abstraction layer (OpenAI/Anthropic) — v1.1
- ✓ **AI-05** — AI output is structured JSON, validated before rendering — v1.1
- ✓ **REND-01** — Programmatic renderer composes final image — v1.1
- ✓ **REND-02** — Template system with layout variations — v1.1
- ✓ **REND-03** — Store identity tokens applied to campaign — v1.1
- ✓ **REND-04** — Campaign maintains minimum visual quality — v1.1
- ✓ **REND-05** — Identity fallback: name-based identity with safe defaults — v1.1
- ✓ **REVW-01** — User can preview generated campaign before export — v1.1
- ✓ **AUTH-01** — Autenticação (Supabase Auth, email+senha, sessão SSR) — v1.2
- ✓ **AUTH-02** — Vínculo user→store (`stores.user_id` FK+UNIQUE) — v1.2
- ✓ **AUTH-03** — Loja criada durante onboarding (não no signup) — v1.2
- ✓ **AUTH-04** — RLS em 5 tabelas com isolamento de propriedade — v1.2
- ✓ **AUTH-05** — Cliente sessão como padrão; service role excepcional — v1.2
- ✓ **AUTH-06** — 4 camadas de proteção (middleware → server component → handler → serviço) — v1.2
- ✓ **AUTH-07** — Remoção de `localStorage("store_id")` — v1.2
- ✓ **AUTH-08** — CSRF same-origin para mutações — v1.2
- ✓ **AUTH-09** — Recuperação de senha — v1.2
- ✓ **AUTH-10** — Classificação das 7 Server Actions (3 internas, 4 entrypoints) — v1.2
- ✓ **AUTH-11** — Catálogo D8: 21 cenários de segurança validados — v1.2
- ✓ **PERSIST-01** — Campanha é persistida como artefato imutável (briefing + resultado final) — v1.3
- ✓ **PERSIST-02** — Registro da campanha no banco com parâmetros, copy e metadados — v1.3
- ✓ **PERSIST-03** — Imagem final da campanha salva no Storage — v1.3
- ✓ **PERSIST-04** — Estados mínimos do processo de geração (gerando, pronto, erro) — v1.3
- ✓ **PERSIST-05** — Rota protegida `/campanha/[id]` exibe campanha persistida — v1.3
- ✓ **PERSIST-06** — Download do original (PNG/JPG) — v1.3
- ✓ **PERSIST-07** — Rota autenticada `/minhas-campanhas` lista campanhas da loja do usuário logado — v1.3
- ✓ **SHELL-01** — App shell com navegação estrutural (sidebar/topbar, menus definitivos) — v1.4
- ✓ **DASH-01** — Dashboard principal com visão geral (campanhas recentes, métricas básicas) — v1.4
- ✓ **ONBRD-01** — Fluxo de onboarding para novos usuários pós-signup — v1.4
- ✓ **HIST-01** — Histórico de campanhas melhor organizado (ordenação, paginação) — v1.4
- ✓ **UX-01** — Estados vazios consistentes em toda a aplicação — v1.4
- ✓ **SEARCH-01** — Busca e filtros essenciais nas listas de campanhas — v1.4
- ✓ **MOBILE-01** — Fluxo mobile completo responsivo — v1.4
- ✓ **F35-CONTENT-01..06** — Changelog: fonte de dados estática content/changelog (3 seeds), parser próprio, renderer sanitizado (h2/p/ul/li/strong), schema Zod fail-fast, formato de data sem shift de fuso, get-changelog server-only — v1.5 (F35)
- ✓ **F35-STATE-01..06** — Estado de leitura via localStorage (2 chaves vendeo:*) SSR-safe, sem estado global — v1.5 (F35)
- ✓ **F35-UI-01..07** — Página /novidades, ChangelogCard/List/Announcement, SidebarBadge, estilo design system — v1.5 (F35)
- ✓ **F35-APP-SHELL-01..03** — Fluxo latestEntryId por prop, sidebar 5º item, AccountMenu link Novidades — v1.5 (F35)
- ✓ **F35-DASHBOARD-01..03** — Anúncio contextual no dashboard (null-safe), guia docs/changelog-update.md — v1.5 (F35)

### Active

#### Copy Director (COPY)

- [ ] **COPY-01**: TextProvider abstraction layer (createTextProvider, OpenAI/Anthropic implementations)
- [ ] **COPY-02**: CopyDirectorService generates title, caption, hashtags, CTA from CampaignBrief
- [ ] **COPY-03**: Prompt template in `prompts/campaign-copy-director.md` with segment-aware copywriting
- [ ] **COPY-04**: Copy Director callable standalone (without image generation)

#### Sistema de Créditos (CRED)

- [ ] **CRED-01**: credit_balances table with RLS (user can SELECT own balance)
- [ ] **CRED-02**: credit_transactions table (append-only, types: grant/purchase/deduction/refund/adjustment)
- [ ] **CRED-03**: CreditService with reserveCredit, confirmCredit, refundCredit, grantCredits, getBalance, getHistory
- [ ] **CRED-04**: Balance never negative — every deduction checks balance before executing
- [ ] **CRED-05**: Atomic reserve/refund via SQL transactions (SELECT FOR UPDATE or SQL function)

#### Pipeline de Geração (PIPE)

- [ ] **PIPE-01**: Parallel execution of Copy Director ∥ Image Director in generate-image pipeline
- [ ] **PIPE-02**: Rate limit guard (10/h per user, 30/dia) before any paid operation
- [ ] **PIPE-03**: Saldo check before pipeline starts; 402 Payment Required if insufficient
- [ ] **PIPE-04**: Credit reserve before IA calls; refund on failure; confirm on success
- [ ] **PIPE-05**: publication_copy_snapshot populated by Copy Director (replaces deterministic buildCaption/hashtags)
- [ ] **PIPE-06**: Timeout abort (120s total) treated as failure with refund

#### Admin Operacional (ADMIN)

- [ ] **ADMIN-01**: Admin access control — only explicitly authorized users (admin_users table) access admin routes/pages
- [ ] **ADMIN-02**: Admin user/store directory — list and search beta users/stores with support data
- [ ] **ADMIN-03**: Admin credit grant — manual grant with mandatory reason, using CreditService.grantCredits (idempotent + audit trail)
- [ ] **ADMIN-04**: Admin credit ledger view — view balance and full transaction history of any store/user
- [ ] **ADMIN-05**: Admin campaign error review — view errored campaigns with error_message, status, dates
- [ ] **ADMIN-06**: Admin audit log — every sensitive admin action recorded with actor, target, action, reason, timestamp (append-only)

#### Conta e Saldo Visível (UI-CREDIT)

- [ ] **UI-01**: Credit balance visible in topbar (app shell) — server-side lookup
- [ ] **UI-02**: Credits section in `/conta` — balance card, transaction history, beta credit request CTA
- [ ] **UI-03**: Zero-credit CTA during beta — "Solicitar créditos" / "Fale com o time" (não Stripe)
- [ ] **UI-04**: Extrato paginado (credit_transactions history with all types except adjustment)
- [ ] **UI-05**: Onboarding grant: 5 free credits on store creation (POST /api/store integration)
- [ ] **UI-06**: Zero-credit states: tooltip, disabled button, CTA to request credits — product never blocks entirely

#### Observabilidade e Operação (OPS)

- [ ] **OPS-01**: Structured logging in pipeline (campaignId, phase, duration_ms, status)
- [ ] **OPS-02**: IA telemetry (tokens, cost, model, provider) in generation_events
- [ ] **OPS-03**: Deploy checklist, rollback process, environment variables documented
- [ ] **OPS-04**: Support runbook (manual grant, refund, balance check)
- [ ] **OPS-05**: Feature flag v1.5-credits-enabled for safe rollout

#### Refinamento Visual e Launch Readiness (LAUNCH)

- [ ] **LAUNCH-01**: Loading, empty, error states for all new screens/components
- [ ] **LAUNCH-02**: Insufficient-credit UX across the app (disabled states, tooltips, microcopy)
- [ ] **LAUNCH-03**: Mobile hardening for credit flows (viewport 320–768px, touch targets ≥44px)
- [ ] **LAUNCH-04**: UAT externo com 3–5 lojistas reais
- [ ] **LAUNCH-05**: Canal de feedback, métricas de saúde, critérios de expansão/pausa documentados
- [ ] **LAUNCH-06**: Feature flag active and verified in UAT before milestone close

#### Segurança (SEC)

- [ ] **SEC-01**: RLS policies for credit_balances and credit_transactions
- [ ] **SEC-02**: Ownership validation on all /api/credits/* routes
- [ ] **SEC-03**: Sanitized inputs to Copy Director (no sensitive data in prompts)
- [ ] **SEC-04**: Admin routes protected by requireAdmin gate — admin_users table, no auth.users flag
- [ ] **SEC-05**: Service role usage reviewed — credit operations use service role only after identity validation
- [ ] **SEC-06**: Data retention policy implemented (90d cleanup for logs/generation_events)

### Out of Scope

- Regeneração — redefinida como "novo briefing" (MC-02), não implementada
- Planos e assinaturas mensais — uso livre + créditos avulsos é suficiente para lançamento controlado
- Múltiplas lojas — relação 1:1 mantida
- Times / permissões multi-usuário — single-user
- Integração com Instagram (API de postagem automática) — milestone futura
- Plano semanal e calendário inteligente — fase futura
- Editor visual livre tipo Canva — geração guiada, não livre
- Geração por IA de imagem (DALL-E, etc) — reduz previsibilidade
- Múltiplos tipos de campanha, equipe, automações avançadas
- OAuth social / Magic link — exclusão deliberada v1.2
- Export agendado / programado — fora do escopo v1.4
- Métricas e analytics avançados — métricas básicas apenas no dashboard
- PWA / install prompt — não prioritário para lançamento controlado
- Campanhas multi-formato (Stories, Landscape) — apenas 1080×1080 feed
- Cache de prompts / otimização de tokens — feature futura de redução de custo

## Context

**Current state (após v1.4):**
- ~713 testes automatizados, 89 test files, zero erros de tipo/lint/build
- Aplicação SaaS multi-tenant funcional em beta.vendeo.tech
- Ciclo completo de campanha + persistência + entrega
- App shell profissional com sidebar, topbar, drawer mobile acessível
- Dashboard com métricas, campanhas recentes e onboarding adaptativo
- Histórico com busca ILIKE, filtros, paginação e URL state
- Interface responsiva com touch targets ≥44px, validada em 320/375/768px
- Bucket `store-logos`: 0 objetos, pendente de remoção
- **Em andamento: v1.5 — Lançamento Externo Controlado**

**User profile:** Pequenos e médios lojistas físicos que acumulam funções operacionais, comerciais e administrativas — não têm tempo, criatividade ou recursos para design profissional.

**Development environment:** VS Code, OpenCode como agente de IA, OpenSpec para especificações, GSD para organização/execução, UI/UX Pro Max para direção visual.

## Constraints

- **Stack**: Next.js (App Router) + TypeScript + Supabase (banco, storage, auth) + Vercel (deploy)
- **IA**: APIs externas via backend (OpenAI/Anthropic) com camada de abstração
- **Geração visual**: Híbrida — IA decide parâmetros e copy, renderização programática executa a arte final
- **Fluxo**: Web app (browser), formulário → geração → revisão → exportação
- **Deploy**: Vercel, sem necessidade de infraestrutura adicional
- **Validação**: Toda fase exige validação automática (TypeScript, lint, build) e manual
- **Ordem**: Visão primeiro → direção visual → core de campanha → estrutura SaaS

> **Nota:** Auth, multi-tenant, persistência, entrega, app shell e experiência SaaS estão implementados desde v1.4.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Geração híbrida (IA decide, renderização programática executa) | Controle de texto, consistência visual, custo previsível | ✓ Good |
| APIs externas (OpenAI/Anthropic) com abstração | Evita acoplamento a um provedor | ✓ Good |
| Supabase para banco/storage/auth | Solução integrada, escalável, bom fit Next.js+Vercel | ✓ Good |
| Campanha avulsa antes de estrutura SaaS | Valida core antes de construir produto ao redor | ✓ Good |
| Três camadas: Intelligence → Spec → Render | Separa responsabilidades | ✓ Good |
| Route split: `/` = campaign, `/store` = store identity | Limpeza, navegação nativa App Router | ✓ Good |
| BRL via cents-internal state + Intl.NumberFormat | Precisão numérica, formatação consistente | ✓ Good |
| Component decomposition (hook + form + preview) | Single responsibility, reusável | ✓ Good |
| Geração por IA + CSS fallback legado | IA garante qualidade; CSS preservado para preview | ✓ Good — MC-04 |
| Ajustes de arte removidos do escopo v1 | Motor valida geração, não edição pós-geração | ✓ Decisão MC-01 |
| Regeneração como "novo briefing" | Evita complexidade de re-renderização | ✓ Decisão MC-02 |
| Export movido para milestone futura | Export depende de dashboard/histórico | ⚠ Sem milestone |
| Supabase Auth + `@supabase/ssr` | Sessão SSR com cookies, não localStorage | ✓ Good — D2 |
| `stores.user_id` como ownership canônico | Fonte única de verdade | ✓ Good — D1 |
| RLS com políticas FOR SELECT específicas | Sem `FOR ALL`, mínimo privilégio | ✓ Good — D6 |
| Cliente sessão padrão; service role excepcional | Defense in depth | ✓ Good — D5 |
| CSRF same-origin para mutações | Proteção contra ataques cross-site | ✓ Good — D9 |
| Catálogo D8 como critério de aceite | Milestone só fecha com cenários VERDES | ✓ Good — D8 |
| Sharp v0.34.5 para transcodificação PNG/WEBP→JPEG | Industria standard, <50ms 1080×1080 | ✓ Good — F14 |
| Pipeline INSERT antes da IA (D8) | Registros `generating` só para requisições válidas | ✓ Good — F14 |
| Compensação por tipo de falha (upload vs updateReady) | Delete imagem se upload OK mas updateReady falha | ✓ Good — F14 |
| Fallback publication copy: current > snapshot > vazio | Por shape/tipo, não truthiness | ✓ Good — F17 |
| Validação isolada em publication-copy.ts | Reutilizável entre backend e frontend | ✓ Good — F17 |
| PT-BR como língua padrão da interface | Produto brasileiro | ✓ Good — F18 |
| Empty states em vez de redirects | Melhor UX de onboarding, evita bouncing | ✓ Good — F19 |
| Dashboard adaptativo 3 estados reaproveitando onboarding helper | DRY, single source of truth | ✓ Good — F20 |
| Busca ILIKE server-side + client-side debounce | Performance sem comprometer UX | ✓ Good — F21 |
| Touch targets ≥44px como padrão de acessibilidade mobile | WCAG minimum, sem lib externa | ✓ Good — F22 |
| Focus trap manual no drawer (sem lib externa) | Evita dependência para funcionalidade simples | ✓ Good — F22 |
| Copy Director como serviço de IA independente (texto) | Separa responsabilidades, paralelizável com Image Director | ✓ Good — D1 v1.5 |
| Pipeline paralelo Copy ∥ Image | Copy não influencia arte; latência cortada pela metade | ✓ Good — D2 v1.5 |
| Crédito só debitado na geração bem-sucedida | Contrato com o usuário: falha = estorno automático | ✓ Good — D3 v1.5 |
| Stripe Checkout (redirect) — ADIADO para F30/v1.6 | Crédito operado pelo time durante beta; Stripe retomado pós-validação | △ Adiado — D4 v1.5 |
| Rate limit via tabela generation_events (janela deslizante) | Sem dependência externa (Redis); migra se carga crescer | ✓ Good — D5 v1.5 |
| Observabilidade começa com logs estruturados + Vercel Logs | Escala conforme necessidade; sem ferramental externo inicial | ✓ Good — D6 v1.5 |
| Saldo visível na topbar (server component) | Usuário nunca precisa adivinhar quantos créditos tem | ✓ Good — D7 v1.5 |
| Copy Director usa TextProvider, não ImageProvider | Provider de texto paralelo, intercambiável OpenAI↔Anthropic | ✓ Good — D8 v1.5 |
| Saldo zero não bloqueia o app | Dashboard/histórico funcionam; apenas geração é limitada | ✓ Good — D9 v1.5 |
| Política de retenção definida por entidade | Campanhas vitalícias, logs 90 dias, transações financeiras vitalícias | ✓ Good — D10 v1.5 |
| Feature flag v1.5-credits-enabled para rollout seguro | Milestone concluída só com flag ativa em UAT | ✓ Good — D11 v1.5 |
| Admin Operacional (F26) substitui Stripe no caminho crítico | Beta controlado precisa de capacidade operacional antes de automatizar vendas | ✓ Good — D12 v1.5 |
| Convite beta MVP: sem email convite, admin completa onboarding | Usuário existe via auth normal; admin apenas cria loja + concede créditos | ✓ Good — D13 v1.5 |
| Admin gate via admin_users table (não auth.users flag) | Tabela própria, auditável, sem risco de reset em migração auth | ✓ Good — D14 v1.5 |
| Admin audit log append-only obrigatório | Grant sem audit trail tratado como falha; RPC atômica grant+audit | ✓ Good — D15 v1.5 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-13 - F39 (Brief Estruturado de Campanha, v1.5) CONCLUÍDA (8/8 plans, 1950 testes, 4 gates verdes, UAT aprovado 5/5); renumeração D1: Stripe / Monetização Pública → F40 (v1.7, pós-beta), fonte `openspec/changes/fase-39-brief-estruturado-campanha/`. Antes: F38.2 (Admin de Custos Operacionais + Configurações Econômicas, desdobramento da F38) CONCLUÍDA (15/15 plans, 1839 testes, verificação I1-I6 63/63 + 4 gates + UAT manual 12/12 aprovado; gap closure UAT: créditos líquidos/estornos por run no RPC/service/UI, P95 legend, tracking STATE.md UTF-8 limpo) — fonte `openspec/changes/fase-38-2-admin-custos-operacionais/`. Antes: Phase 38 complete + F38.1 (Apuração de Custos de IA por Entrega) CONCLUÍDA (11/11 plans, 1713 testes, UAT validado — fechada como estimativa operacional granular: `responses:image_generation = 0.065` provisório beta, reconciliação financeira real na próxima fase) — v1.5 segue com F39 (Brief Estruturado de Campanha) CONCLUÍDA; F40 (Stripe) futura pós-beta*
