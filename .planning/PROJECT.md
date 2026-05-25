# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

Na v1.0, o lojista cadastra a identidade da loja e insere dados do produto + oferta em um formulário guiado, com máscara de preço BRL, upload de imagem com preview, e validação inline.

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Requirements

### Validated

- ✓ **INPT-01** — Product name, price/offer, and short description entry — v1.0
- ✓ **INPT-02** — Product image upload with preview and validation — v1.0
- ✓ **INPT-03** — Store info (name, segment/subsegment) with persistence — v1.0
- ✓ **INPT-04** — Basic visual identity (colors, name style) — v1.0 (logo deferred)
- ✓ **DSGN-01** — No free-form editor — form controls and presets only — v1.0
- ✓ **DSGN-02** — UI/UX Pro Max as design tool, not runtime dep — v1.0
- ✓ **DSGN-03** — Campaign composition rules documented — v1.0
- ✓ **DSGN-04** — V1 scope guardrail (no auth/dashboard/plans) — v1.0

### Active

- [ ] IA interpreta contexto comercial e gera especificação estruturada (título, subtítulo, CTA, preço, badge, hierarquia visual, paleta, layout)
- [ ] Renderização programática compõe e exporta imagem final (PNG/JPG)
- [ ] Fluxo de revisão com ajustes guiados (paleta, estilo de fonte, variações de layout)
- [ ] Arquitetura com camada de abstração para provedores de IA (OpenAI/Anthropic)

### Out of Scope

- Login e autenticação — core precisa ser validado antes da estrutura SaaS
- Dashboard — não implementar antes do core de geração
- Menus definitivos e navegação completa — fluxo único de campanha é suficiente na fase 1
- Plano semanal e calendário inteligente — fase futura, não entra na validação do core
- Cobrança e planos — uso livre durante validação
- Editor visual livre tipo Canva — geração deve ser guiada, não arrastar-e-soltar
- Geração por IA de imagem (DALL-E, etc) — reduz previsibilidade e controle sobre texto
- Múltiplos tipos de campanha — foco em Produto + Oferta inicialmente
- Múltiplas lojas, equipe, automações avançadas
- Upload de logo — nome da loja como identidade visual inicial (fallback via `resolveStoreIdentity`)

## Context

**v1.0 shipped with:**
- 1,633 lines of TypeScript/TSX (18 source files in src/)
- 2 phases, 3 plans, 25 tasks implemented
- Store identity: form + API routes (POST/GET/PATCH) + Supabase persistence
- Campaign input: form with BRL mask, image upload, validation, local success state
- Route split: `/` = campaign, `/store` = store identity
- Design system: MASTER.md + CAMPAIGN_VISUAL_SYSTEM.md defining composition rules

O Vendeo resolve a dificuldade de pequenos e médios lojistas físicos em transformar a divulgação da loja em campanhas profissionais, consistentes e orientadas à venda. O cliente ideal acumula funções operacionais, comerciais e administrativas — não tem tempo, criatividade ou recursos para design profissional.

Versões anteriores (V1, V2) tiveram problemas de escopo e desvio. A V3 adota uma abordagem sistemática: especificação antes da implementação, ciclos pequenos, validação automática e manual, e avanço progressivo sem misturar escopos.

O ambiente de desenvolvimento usa VS Code, OpenCode como agente de IA, OpenSpec para especificações, GSD (Get Shit Done) para organização e execução, e UI/UX Pro Max como skill de apoio para direção visual.

## Constraints

- **Stack**: Next.js (App Router) + TypeScript + Supabase (banco, storage, auth futura) + Vercel (deploy)
- **IA**: APIs externas via backend (OpenAI/Anthropic) com camada de abstração para troca de provedor
- **Geração visual**: Híbrida — IA decide parâmetros e copy, renderização programática executa a arte final
- **Fase inicial**: Campanha avulsa Produto + Oferta, sem auth, dashboard, planos ou estrutura SaaS completa
- **Fluxo**: Web app (browser), formulário → geração → revisão → exportação
- **Deploy**: Vercel, sem necessidade de infraestrutura adicional na fase 1
- **Validação**: Toda fase exige validação automática (TypeScript, lint, build) e manual (visual, fluxo, copy, legibilidade)
- **Ordem**: Visão primeiro → direção visual → core de campanha → estrutura SaaS depois

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
*Last updated: 2026-05-25 after v1.0 milestone*
