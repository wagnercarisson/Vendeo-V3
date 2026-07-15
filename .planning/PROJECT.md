# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

O Vendeo é hoje uma aplicação SaaS multi-tenant com autenticação completa, isolamento de propriedade via RLS, geração de campanhas com IA, app shell profissional, onboarding, dashboard, busca, paginação e suporte mobile — pronta para receber os primeiros usuários reais em ambiente controlado.

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Current State

**Shipped: v1.4 — Experiência SaaS (2026-07-15)**

A milestone v1.4 transformou o Vendeo em um produto SaaS coerente: app shell profissional, navegação PT-BR, dashboard, onboarding, busca/filtros/paginação e suporte mobile responsivo.

- **App Shell + UI Base**: 7 componentes UI (Button, Card, Input, Badge, EmptyState, Skeleton, PageHeader), sidebar com 4 nav links + Lucide icons, topbar com CTA + AccountMenu, drawer mobile com acessibilidade
- **Rotas PT-BR**: `/dashboard`, `/campanhas`, `/campanhas/nova`, `/campanhas/[id]`, `/loja`, `/conta` — 5 redirects 301, middleware atualizado
- **Onboarding & Empty States**: helper 3 estados (no_store, has_store_no_campaigns, has_store_with_campaigns), empty states contextuais em vez de redirects, microcopy centralizada
- **Dashboard Real**: saudação com 3 períodos (manhã/tarde/noite), 3 metric cards (total, prontas, taxa de sucesso), campanhas recentes, card de próximo passo adaptativo
- **Histórico e Busca**: busca ILIKE, filtros por status/data, ordenação, paginação page-based (10/página), URL state compartilhável, Pagination component com ellipsis
- **Mobile Hardening**: drawer com focus trap + body scroll lock + prefers-reduced-motion, touch targets ≥44px em toda a interface, responsivo validado em 320/375/768px

**713 testes automatizados**, **89 test files**, **TypeScript/lint/build limpos**.

## Current Milestone: v1.5 — (A definir)

**Goal:** A definir via `/gsd-new-milestone`.

**Target features:**
- _Em definição_

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

### Active

_Requirements para v1.5 serão definidos via `/gsd-new-milestone`._

### Out of Scope

- Regeneração — redefinida como "novo briefing" (MC-02), não implementada
- Planos e cobrança — uso livre durante validação do SaaS
- Múltiplas lojas — relação 1:1 mantida
- Plano semanal e calendário inteligente — fase futura
- Editor visual livre tipo Canva — geração guiada, não livre
- Geração por IA de imagem (DALL-E, etc) — reduz previsibilidade
- Múltiplos tipos de campanha, equipe, automações avançadas
- OAuth social / Magic link — exclusão deliberada v1.2
- Export agendado / programado — fora do escopo v1.4
- Métricas e analytics avançados — métricas básicas apenas no dashboard

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
- **Próximo: v1.5 — a definir**

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-15 after milestone v1.4 shipped*
