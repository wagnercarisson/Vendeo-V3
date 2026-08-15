<!-- GSD:project-start source:PROJECT.md -->

## Project

**Vendeo V3**

O Vendeo é um motor SaaS de geração de campanhas para lojistas de lojas físicas. O produto transforma informações simples da loja (produto, oferta, preço) em campanhas profissionais para redes sociais, combinando inteligência artificial comercial com renderização programática. O lojista informa o essencial, e o Vendeo entrega uma peça visual pronta para publicar — sem precisar aprender design, copywriting ou marketing.

**Core Value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais. Se tudo mais falhar, o Vendeo precisa ser capaz de transformar uma oferta simples em uma peça visual comercial, clara e publicável.

### Constraints

- **Stack**: Next.js (App Router) + TypeScript + Supabase (banco, storage, auth — escopo ativo da v1.2) + Vercel (deploy)
- **IA**: APIs externas via backend (OpenAI/Anthropic) com camada de abstração para troca de provedor
- **Geração visual**: Híbrida — IA decide parâmetros e copy, renderização programática executa a arte final
- **Fluxo**: Web app (browser), formulário → geração → revisão → exportação
- **Deploy**: Vercel, sem necessidade de infraestrutura adicional na fase 1
- **Validação**: Toda fase exige validação automática (TypeScript, lint, build) e manual (visual, fluxo, copy, legibilidade)
- **Ordem**: Visão primeiro → direção visual → core de campanha → estrutura SaaS depois

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| openspec-apply-change | Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks. | `.github/skills/openspec-apply-change/SKILL.md` |
| openspec-archive-change | Archive a completed change in the experimental workflow. Use when the user wants to finalize and archive a change after implementation is complete. | `.github/skills/openspec-archive-change/SKILL.md` |
| openspec-continue-change | Continue working on an OpenSpec change by creating the next artifact. Use when the user wants to progress their change, create the next artifact, or continue their workflow. | `.github/skills/openspec-continue-change/SKILL.md` |
| openspec-explore | Enter explore mode - a thinking partner for exploring ideas, investigating problems, and clarifying requirements. Use when the user wants to think through something before or during a change. | `.github/skills/openspec-explore/SKILL.md` |
| openspec-new-change | Start a new OpenSpec change using the experimental artifact workflow. Use when the user wants to create a new feature, fix, or modification with a structured step-by-step approach. | `.github/skills/openspec-new-change/SKILL.md` |
| openspec-propose | Propose a new change with all artifacts generated in one step. Use when the user wants to quickly describe what they want to build and get a complete proposal with design, specs, and tasks ready for implementation. | `.github/skills/openspec-propose/SKILL.md` |
| openspec-sync-specs | Sync delta specs from a change to main specs. Use when the user wants to update main specs with changes from a delta spec, without archiving the change. | `.github/skills/openspec-sync-specs/SKILL.md` |
| openspec-verify-change | Verify implementation matches change artifacts. Use when the user wants to validate that implementation is complete, correct, and coherent before archiving. | `.github/skills/openspec-verify-change/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase <plan-id>` for planned phase work (e.g., `/gsd-execute-phase 08-01`)
- `/gsd-plan-phase <N>` for planning a phase
- `/gsd-verify-phase <N>` for verification
- `/gsd-code-review` for code review

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

## Phase 40 — Campos Comerciais e Avisos do Brief

**Status:** 9/9 plans completed ✅ — 1997 testes, 4 gates verdes, UAT aprovado 6/6

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 40-01 | 1 | ✅ | Trackings / renumeração D1 (verificação grep-consistência F40 = Brief Comercial, Stripe → F41 nos 6 runbooks; zero resíduos) |
| 40-02 | 1 | ✅ | Constante única `ILLUSTRATIVE_NOTICE_TEXT` + checkbox `IllustrativeNoticeField` + placeholder normalizado |
| 40-03 | 1 | ✅ | Reframe do aviso ilustrativo nos 4 prompts do diretor (hardcode → bloco condicional) |
| 40-04 | 2 | ✅ | Form state 6 campos novos + helpers `buildMandatoryArtworkText`/`buildValidityDisplayText`/`formatDDMM` + body + migração de draft legado |
| 40-05 | 3 | ✅ | `ValidityField` presentacional + seções Produto/Oferta/Avisos + credits test co-migrado |
| 40-06 | 3 | ✅ | Testes 1-8 validade + 9-15 aviso + 8.8 brief |
| 40-07 | 3 | ✅ | Testes 16-21 prompt reframe + fixtures image-gen/review co-migradas |
| 40-08 | 4 | ✅ | route.test.ts fixtures + regressão completa |
| 40-09 | 5 | ✅ | Verificação final: gates + VERIFICATION.md + UAT humana (checkpoint) |

**Change artifacts (source of truth):** `openspec/changes/fase-40-campos-comerciais-avisos-brief/`
**Context:** `.planning/phases/40-campos-comerciais-avisos-brief/40-CONTEXT.md`

## Phase 41 — Mídia de Campanha Mobile

**Status:** Concluída ✅ — 13/13 plans, 4 gates verdes (222 files / 2033 testes), UAT humano 5/6 aprovado + cenário 3 (celular real iOS/Android, HEIC/EXIF) **pendente de validação em produção** (D4)

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 41-01 | 1 | ✅ | Trackings D1 (grep-verificação renumeração F41/F42, zero resíduos, registro commit 195b467) |
| 41-02 | 1 | ✅ | Config + Transporte schema (MAX_CAMPAIGN_IMAGES=4 + teto agregado; ProductImageInputSchema + productImages[] + productImageDataUrl optional) + co-migração route.ts |
| 41-03 | 1 | ✅ | Prompts 1+N (bloco descritivo nos 4 prompts, sem variável nova, golden 38 keys) |
| 41-04 | 2 | ✅ | Domínio + Persistência (mapper multi + mimeTypeFromDataUrl + storagePath; createCampaign campaignId? + uploadCampaignInputImage + removeCampaignInputs) |
| 41-05 | 1 | ✅ | Provider + Service (N input_image, fallback edit gated 2 pontos, mediaImagesDataUrls, review com primary) + co-migração testes |
| 41-06 | 3 | ✅ | Rota (exclusividade 400, teto 413, campaignId pré-gerado, upload pré-snapshot, cleanup) + co-migração asserts/integração |
| 41-07 | 3 | ✅ | Form hook (estado multi, HEIC/EXIF, body D2, draft multi) + co-migração call site/testes irmãos |
| 41-08 | 4 | ✅ | UI (CampaignImageUpload multi + capture + grid; seção Imagens adicionais) + credits test co-migrado |
| 41-09 | 4 | ✅ | Testes 1-8 (mapper/snapshot: multi, legado, invariante, mimeType, storagePath, exactly-1-primary) |
| 41-10 | 5 | ✅ | Testes 9-16 (UI/form: primary, remoção, source, HEIC/EXIF, body, draft N, limites) |
| 41-11 | 5 | ✅ | Testes 17-23 (pipeline/provider/review/prompt: N input_image, fallback gated, golden 38, bloco 1+N, primary-only, review) |
| 41-12 | 4 | ✅ | Testes 4 + 24-27 (rota: 400 ambíguo, 413, storage D5, cleanup, regressão) |
| 41-13 | 6 | ✅ | Verificação final (4 gates + VERIFICATION.md + UAT.md + checkpoint humano) |

**Pendência pós-deploy:** UAT cenário 3 — câmera no celular real (iOS HEIC + Android, foto vertical/horizontal, EXIF) — obrigatório D4.

**Change artifacts (source of truth):** `openspec/changes/fase-41-midia-de-campanha-mobile/`
**Context:** `.planning/phases/41-midia-de-campanha-mobile/41-CONTEXT.md`
**State:** `.planning/STATE.md`
**Roadmap:** `ROADMAP.md`
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
