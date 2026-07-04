# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

Na v1.0, o lojista cadastra a identidade da loja e insere dados do produto + oferta em um formulário guiado, com máscara de preço BRL, upload de imagem com preview, e validação inline.

Na v1.1 (Motor de Campanhas, shipped 2026-07-03), o sistema completo de geração foi implementado: inteligência artificial interpreta o contexto comercial e gera especificação estruturada, renderização programática compõe a arte final, e a identidade da loja (logo, assinatura visual, cores, direção de marca) é integrada ao briefing de campanha. O motor está validado, mas o produto ainda não é uma versão pública utilizável — falta estrutura SaaS (auth, dashboard, export).

## Current Milestone: v1.2 — Contas e Propriedade

**Status:** Alinhamento D1–D11 consolidado. 5 fases (7–11) definidas. Próximo passo: alinhamento técnico da Phase 7 via OpenSpec Explore.

**Goal:** Um usuário entra no Vendeo e acessa exclusivamente sua própria loja e identidade.

**Confirmed scope (decisões em `docs/alinhamento-milestone-v1.2.md`):**
- Autenticação: Supabase Auth, email + senha, sessão SSR via `@supabase/ssr`
- Vínculo 1:1: `stores.user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)`
- Loja criada durante onboarding pós-auth (não no signup)
- RLS em 5 tabelas (SELECT only para o owner; `generation_events` default-deny)
- Cliente de sessão + RLS como padrão; service role excepcional com ownership verificado
- Middleware + server component + route handler + serviço (4 camadas de proteção)
- Remoção completa de `localStorage("store_id")` — identidade via claims
- Cenários de segurança binários como critério de aceite

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Requirements

### Validated

- ✓ **INPT-01** — Product name, price/offer, and short description entry — v1.0
- ✓ **INPT-02** — Product image upload with preview and validation — v1.0
- ✓ **INPT-03** — Store info (name, segment/subsegment) with persistence — v1.0
- ✓ **INPT-04** — Basic visual identity (colors, logo, name style) — v1.0 + v1.1 (logo upload implemented)
- ✓ **DSGN-01** — No free-form editor — form controls and presets only — v1.0
- ✓ **DSGN-02** — UI/UX Pro Max as design tool, not runtime dep — v1.0
- ✓ **DSGN-03** — Campaign composition rules documented — v1.0
- ✓ **DSGN-04** — V1 scope guardrail (no auth/dashboard/plans) — v1.0
- ✓ **AI-01** — AI interprets product/offer/store context and generates structured spec — v1.1
- ✓ **AI-02** — AI generates commercial copy (title, subtitle, CTA) tailored to product/offer — v1.1
- ✓ **AI-03** — AI output includes visual parameters: palette, hierarchy, layout, badge — v1.1
- ✓ **AI-04** — AI provider abstraction layer (OpenAI/Anthropic) — v1.1
- ✓ **AI-05** — AI output is structured JSON, validated before rendering — v1.1
- ✓ **REND-01** — Programmatic renderer composes final image (IA gera, CSS como fallback legacy) — v1.1
- ✓ **REND-02** — Template system with layout variations for Produto + Oferta — v1.1
- ✓ **REND-03** — Store identity tokens (name, logo, colors, fonts) applied to campaign — v1.1
- ✓ **REND-04** — Campaign maintains minimum visual quality — v1.1
- ✓ **REND-05** — Identity fallback: name-based identity with safe defaults — v1.1
- ✓ **REVW-01** — User can preview generated campaign before export — v1.1

### Active — v1.2 Contas e Propriedade

Alinhamento D1–D11 consolidado em `docs/alinhamento-milestone-v1.2.md`. Decisões registradas em `docs/alinhamento-milestone-v1.2.md`.

- Confirmado: Autenticação (Supabase Auth, email + senha, sessão SSR via `@supabase/ssr`)
- Confirmado: Vínculo 1:1 (`stores.user_id` FK + UNIQUE)
- Confirmado: Loja criada durante onboarding (não no signup)
- Confirmado: RLS em 5 tabelas (SELECT only; generation_events default-deny)
- Confirmado: Cliente de sessão padrão; service role excepcional
- Confirmado: 4 camadas de proteção (middleware → server component → handler → serviço)
- Confirmado: Remoção de `localStorage("store_id")`
- Confirmado: Cenários de segurança como critério de aceite
- Confirmado: CSRF same-origin para mutações em Route Handlers
- Confirmado: Fluxo mínimo de recuperação de senha incluso na v1.2
- Confirmado: Classificação das 7 Server Actions (3 internas, 4 entrypoints autenticados)

> Nota: Alinhamento D1–D11 consolidado via OpenSpec Explore. 5 fases (7–11) definidas em `docs/alinhamento-milestone-v1.2.md`. Próximo passo: alinhamento técnico da Phase 7 via OpenSpec.

### Future

- Dashboard com histórico de campanhas
- Navegação e menus
- Configurações da loja e do usuário
- Export PNG/JPG
- Planos e cobrança
- Campanhas persistidas
- Regeneração de campanhas

### Out of Scope

- Dashboard — core de geração já concluído (v1.1), mas fica fora do escopo restrito da v1.2 (auth/ownership)
- Campanhas persistidas — escopo v1.2 é auth + ownership, não inclui salvar campanhas no banco
- Export PNG/JPG — movido para milestone futura (decisão MC-03, posteriormente superada pelo estreitamento da v1.2 — sem milestone atribuída atualmente)
- Regeneração de campanhas — redefinida como "novo briefing" (decisão MC-02), não implementada nesta milestone
- Planos e cobrança — uso livre durante validação do core
- Múltiplas lojas — relação 1:1 (usuário:loja) nesta milestone
- Menus definitivos e navegação completa — fluxo mínimo de entrada é suficiente
- Plano semanal e calendário inteligente — fase futura
- Editor visual livre tipo Canva — geração deve ser guiada
- Geração por IA de imagem (DALL-E, etc) — reduz previsibilidade e controle sobre texto
- Múltiplos tipos de campanha, equipe, automações avançadas

## Context

**v1.0 shipped with:**
- 1,633 lines of TypeScript/TSX (18 source files in src/)
- 2 phases, 3 plans, 25 tasks implemented
- Store identity: form + API routes (POST/GET/PATCH) + Supabase persistence
- Campaign input: form with BRL mask, image upload, validation, local success state
- Route split: `/` = campaign, `/store` = store identity
- Design system: MASTER.md + CAMPAIGN_VISUAL_SYSTEM.md defining composition rules

**v1.1 shipped with:**
- ~8.800+ lines of TypeScript/TSX across 100+ source files
- 26 phases, 128 plans, 297 automated tests (27 suites)
- AI Campaign Intelligence: OpenAI/Anthropic providers with structured output, abstraction layer
- Visual Rendering: programmatic renderer + IA-generated images + CSS legacy fallback
- Store Identity: logo upload with BrandDirector AI analysis, 5 image variants, color probing
- Visual Signature: AI-generated, typographic fallback, approval flow, color drift detection
- Campaign Briefing: identity-aware pipeline with StoreIdentitySnapshot 2.0, 5 directives
- Drift Detection: snapshot-based, state-specific policy, critical/sensitive tiers
- Identity Transitions: state machine for logo/VS/text_only with provenance preservation
- Full UAT cycle across all phases, quality gates, and manual verification

O Vendeo resolve a dificuldade de pequenos e médios lojistas físicos em transformar a divulgação da loja em campanhas profissionais, consistentes e orientadas à venda. O cliente ideal acumula funções operacionais, comerciais e administrativas — não tem tempo, criatividade ou recursos para design profissional.

Versões anteriores (V1, V2) tiveram problemas de escopo e desvio. A V3 adota uma abordagem sistemática: especificação antes da implementação, ciclos pequenos, validação automática e manual, e avanço progressivo sem misturar escopos.

O ambiente de desenvolvimento usa VS Code, OpenCode como agente de IA, OpenSpec para especificações, GSD (Get Shit Done) para organização e execução, e UI/UX Pro Max como skill de apoio para direção visual.

## Constraints

- **Stack**: Next.js (App Router) + TypeScript + Supabase (banco, storage, auth — escopo ativo da v1.2) + Vercel (deploy)
- **IA**: APIs externas via backend (OpenAI/Anthropic) com camada de abstração para troca de provedor
- **Geração visual**: Híbrida — IA decide parâmetros e copy, renderização programática executa a arte final
- **Fluxo**: Web app (browser), formulário → geração → revisão → exportação
- **Deploy**: Vercel, sem necessidade de infraestrutura adicional na fase 1
- **Validação**: Toda fase exige validação automática (TypeScript, lint, build) e manual (visual, fluxo, copy, legibilidade)
- **Ordem**: Visão primeiro → direção visual → core de campanha → estrutura SaaS depois

> **Nota histórica:** As constraints acima evoluíram com o projeto. "Auth futura" e "fase inicial sem auth" eram verdadeiras para v1.0–v1.1. A v1.2 introduzirá auth e ownership, tornando-as obsoletas como constraint — o texto acima reflete o escopo atual.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Geração híbrida (IA decide, renderização programática executa) | Controle de texto, consistência visual, ajustes guiados, custo previsível | ✓ Good — confirmed in Phase 1 design |
| APIs externas (OpenAI/Anthropic) com abstração | Evita acoplamento a um provedor, permite troca futura sem refatoração | — Pending (Phase 3) |
| Supabase para banco/storage/auth futura | Solução integrada, escalável, bom fit com Next.js + Vercel | ✓ Good — working for store CRUD |
| Campanha avulsa antes de estrutura SaaS | Valida o core antes de construir o produto ao redor | ✓ Good — DSGN-04 guardrail effective |
| Três camadas: Intelligence → Spec → Render | Separa responsabilidades, permite evolução independente de cada camada | — Pending (Phases 3-5) |
| Route split: `/` = campaign, `/store` = store identity | Limpeza, navegação nativa App Router | ✓ Good — clean separation |
| BRL via cents-internal state + Intl.NumberFormat | Precisão numérica, formatação consistente | ✓ Good — raw-digit extraction after fix |
| Component decomposition (hook + form + preview) | Single responsibility, reusável | ✓ Good — same pattern as Phase 1 |
| Geração por IA (imagem final) + CSS como fallback legado | IA garante qualidade visual; CSS legado preservado para preview | ✓ Good — MC-04 validated in v1.1 close-out |
| Ajustes de arte removidos do escopo v1 | Motor valida geração, não edição pós-geração | ✓ Decisão MC-01 |
| Regeneração redefinida como "novo briefing" | Evita complexidade de re-renderização com parâmetros | ✓ Decisão MC-02 |
| Export movido para milestone de infraestrutura | Export depende de dashboard e histórico para fazer sentido | ⚠ Superada — v1.2 estreitou para auth/ownership, export sem milestone definida |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-03 after starting v1.2 milestone*
