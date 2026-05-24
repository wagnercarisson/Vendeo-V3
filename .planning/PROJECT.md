# Vendeo V3

## What This Is

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

## Core Value

Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Campanha avulsa de Produto + Oferta com entrada simples de dados
- [ ] IA interpreta contexto comercial e gera especificação estruturada (título, subtítulo, CTA, preço, badge, hierarquia visual, paleta, layout)
- [ ] Renderização programática compõe e exporta imagem final (PNG/JPG)
- [ ] Fluxo de revisão com ajustes guiados (paleta, estilo de fonte, variações de layout)
- [ ] Arquitetura com camada de abstração para provedores de IA (OpenAI/Anthropic)
- [ ] Separação entre Campaign Intelligence, Visual Specification e Programmatic Renderer

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Login e autenticação — core precisa ser validado antes da estrutura SaaS
- Dashboard — não implementar antes do core de geração
- Menus definitivos e navegação completa — fluxo único de campanha é suficiente na fase 1
- Plano semanal e calendário inteligente — fase futura, não entra na validação do core
- Cobrança e planos — uso livre durante validação
- Editor visual livre tipo Canva — geração deve ser guiada, não arrastar-e-soltar
- Geração por IA de imagem (DALL-E, etc) — reduz previsibilidade e controle sobre texto
- Múltiplos tipos de campanha — foco em Produto + Oferta inicialmente
- Múltiplas lojas, equipe, automações avançadas

## Context

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

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Geração híbrida (IA decide, renderização programática executa) | Controle de texto, consistência visual, ajustes guiados, custo previsível | — Pending |
| APIs externas (OpenAI/Anthropic) com abstração | Evita acoplamento a um provedor, permite troca futura sem refatoração | — Pending |
| Supabase para banco/storage/auth futura | Solução integrada, escalável, bom fit com Next.js + Vercel | — Pending |
| Campanha avulsa antes de estrutura SaaS | Valida o core antes de construir o produto ao redor | — Pending |
| Três camadas: Intelligence → Spec → Render | Separa responsabilidades, permite evolução independente de cada camada | — Pending |

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
*Last updated: 2026-05-24 after initialization*
