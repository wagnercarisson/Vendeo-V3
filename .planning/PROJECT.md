# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

O Vendeo é hoje uma aplicação multi-tenant com autenticação completa, isolamento de propriedade via RLS, e geração de campanhas com IA — pronta para receber os primeiros usuários reais em ambiente controlado.

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Current State

**Shipped: v1.2 — Contas e Propriedade (2026-07-08)**

A milestone v1.2 estabeleceu a camada fundacional de contas e propriedade sobre o motor de campanhas (v1.1):

- **Autenticação completa**: signup, confirmação de email, login, sessão SSR via `@supabase/ssr`, logout, recuperação de senha. Anti-enumeration, templates PT-BR, SMTP via Resend.com com DKIM/DMARC/SPF.
- **Vínculo user→store**: `stores.user_id` como fonte canônica de ownership. `localStorage("store_id")` eliminado.
- **Isolamento multi-tenant**: RLS em 5 tabelas + Storage policies. 20+ route handlers protegidos com CSRF + Auth + Ownership. Server Actions com guards.
- **Serviço publicável**: beta.vendeo.tech operacional com sessão SSR, cookies, e fluxo completo de entrada.
- **Verificação formal**: D8 catalog com 21 cenários de segurança validados manualmente (cross-tenant, sessão, storage, RLS, vazamento).

**465 testes automatizados**, **51 test files**, **TypeScript/lint/build limpos**.

<details>
<summary>Histórico de versões anteriores</summary>

**v1.1 — Motor de Campanhas (shipped 2026-07-03)**

- AI Campaign Intelligence: OpenAI/Anthropic providers com structured output, abstraction layer
- Visual Rendering: programmatic renderer + IA-generated images + CSS legacy fallback
- Store Identity: logo upload com BrandDirector AI analysis, 5 image variants, color probing
- Visual Signature: AI-generated, typographic fallback, approval flow, color drift detection
- Campaign Briefing: identity-aware pipeline com StoreIdentitySnapshot 2.0, 5 directives
- Drift Detection: snapshot-based, state-specific policy, critical/sensitive tiers
- Identity Transitions: state machine para logo/VS/text_only com provenance preservation

**v1.0 — Core de Geração (shipped 2026-07-03)**

- Formulário guiado com máscara de preço BRL, upload de imagem com preview, validação inline
- Store identity: form + API routes (POST/GET/PATCH) + Supabase persistence
- Campaign input: BRL mask, image upload, validation, local success state
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

### Active (próxima milestone)

A definir na próxima milestone. Sugestões iniciais:

- Persistência de campanhas no banco
- Dashboard com histórico de campanhas
- Export PNG/JPG
- Navegação e menus definitivos
- Configurações da loja e do usuário

### Out of Scope

- Dashboard — core de geração já concluído (v1.1), escopo v1.2 era auth/ownership
- Campanhas persistidas — v1.2 era auth/ownership, não inclui salvar campanhas
- Export PNG/JPG — movido para milestone futura
- Regeneração — redefinida como "novo briefing" (MC-02), não implementada
- Planos e cobrança — uso livre durante validação do core
- Múltiplas lojas — relação 1:1 nesta milestone
- Menus definitivos e navegação completa — fluxo mínimo suficiente
- Plano semanal e calendário inteligente — fase futura
- Editor visual livre tipo Canva — geração guiada, não livre
- Geração por IA de imagem (DALL-E, etc) — reduz previsibilidade
- Múltiplos tipos de campanha, equipe, automações avançadas
- OAuth social / Magic link — exclusão deliberada v1.2

## Context

**Current state (pós-v1.2):**
- ~465 testes automatizados, 51 test files, zero erros de tipo/lint/build
- Aplicação multi-tenant funcional em beta.vendeo.tech
- Autenticação completa com Supabase Auth + sessão SSR
- Ownership validado em todas as operações (CSRF → Auth → Ownership)
- Geração de campanhas com IA + renderização programática
- Pipeline de identidade visual (logo, brand profile, visual signature, drift detection)
- Bucket `store-logos`: 0 objetos, pendente de remoção

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

> **Nota:** "Auth futura" já não é mais uma constraint — auth está implementado desde v1.2.

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

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-08 after v1.2 milestone*
