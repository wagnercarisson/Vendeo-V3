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

**Status:** Concluída ✅ — 13/13 plans, 4 gates verdes (222 files / 2033 testes), UAT humano 6/6 aprovado (Android em produção ✅ + iOS HEIC pendente de confirmação final)

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

**Pendência pós-deploy:** UAT cenário 3 — iOS HEIC (Android validado em produção: captura + orientação EXIF ok).

**Change artifacts (source of truth):** `openspec/changes/fase-41-midia-de-campanha-mobile/`
**Context:** `.planning/phases/41-midia-de-campanha-mobile/41-CONTEXT.md`
**State:** `.planning/STATE.md`
**Roadmap:** `ROADMAP.md`
<!-- GSD:workflow-end -->

## Phase 42 — Signup Controlado e Elegibilidade Freemium

**Status:** Concluída ✅ — 20/20 plans, 2182 testes, 4 gates verdes, UAT 20.5–20.15 PASS

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 42-01 | 1 | ✅ | Trackings D1 — renumeração F42 = Signup / Stripe → F43 (runbook + verificação grep, zero resíduos) |
| 42-02 | 2 | ✅ | Config — flag `publicSignupEnabled` (default false) + paridade `config.toml` (D5/D13) |
| 42-03 | 2 | ✅ | CNAE — `cnae-mapping.ts` determinístico segmento×CNAE (D9) |
| 42-04 | 3 | ✅ | Motor — ordem D10, `situacao_nao_ativa`, `dados_oficiais_incompletos`, CNAE tri-state, **pré-gate D7 no caller** (D8/D9/D10) |
| 42-05 | 4 | ✅ | Admin — 4 novos labels + `review-detail.tsx` informado × oficial (D11) |
| 42-06 | 4 | ✅ | Signup — flag on/off + `signup-form.tsx` restaurado (mín. 8, anti-enumeração, captcha, Google) (D2/D4/D5) |
| 42-07 | 3 | ✅ | Google OAuth — `google-button.tsx` + `/auth/callback` PKCE + allowlist + PrivacyGate, scopes mínimos (D15/D16) |
| 42-08 | 3 | ✅ | Turnstile — `captcha-field.tsx` + aplicação login/recuperação + co-migração testes (D3) |
| 42-09 | 5 | ✅ | Login + Recuperação — Google sempre visível + captcha + link conforme flag; check-email inalterado (D5/D15) |
| 42-10 | 4 | ✅ | Landing — flag on: GoogleButton principal "Continuar com Google" + secundário "Continuar com email" → /signup (D4/D15) |
| 42-11 | 5 | ✅ | Legal — Terms v1.4 / Privacy v1.3 + coordenação PrivacyGate × PrivacyRecovery (D12/D16) |
| 42-12 | 6 | ✅ | Migration publica v1.4/v1.3 em `legal_document_versions` + **push [BLOCKING]** + paridade config.toml (D12/D13) |
| 42-13 | 6 | ✅ | Testes 1–13 — Signup/flag/landing/OAuth UI (Teste 10 trava contrato "Continuar com Google") |
| 42-14 | 4 | ✅ | Testes 14–21 — Callback OAuth / identity linking |
| 42-15 | 4 | ✅ | Testes 22–36 — Motor de elegibilidade (incl. pré-gate D7 na rota real) |
| 42-16 | 3 | ✅ | Testes 37–46 — Mapeamento CNAE |
| 42-17 | 5 | ✅ | Testes 47–53 — Admin |
| 42-18 | 6 | ✅ | Testes 54–58 — Legal/transição |
| 42-19 | 7 | ✅ | Regressão e co-migração de fixtures (19.1–19.11) |
| 42-20 | 8 | ✅ | Verificação — 4 gates + UAT fail-closed (20.1–20.15) |

**Change artifacts (source of truth):** `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/`
**Context:** `.planning/phases/42-signup-controlado-elegibilidade-freemium/42-CONTEXT.md`
**State:** `.planning/STATE.md`
**Roadmap:** `ROADMAP.md`

## Phase 43 — Revisão do Brief Pré-Geração

**Status:** Concluída ✅ — 15/15 plans, 2317 testes, 4 gates verdes, UAT 15.5–15.13 PASS (9/9)

**Fonte da verdade:** `openspec/changes/fase-43-revisao-brief-pre-geracao/`
**Context:** `.planning/phases/43-revisao-brief-pre-geracao/43-CONTEXT.md`
**Verification:** `.planning/phases/43-revisao-brief-pre-geracao/43-VERIFICATION.md`
**UAT:** `.planning/phases/43-revisao-brief-pre-geracao/43-UAT.md` (15.5–15.13 — PASS 9/9)

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 43-01 | 1 | ✅ | Trackings / renumeração D1 (grep-verificação F42/F43/Stripe-diferida, zero resíduos) |
| 43-02 | 2 | ✅ | Helpers puros `prepareCampaignImages` + `buildCampaignGenerationBody` (single source, XOR idempotente) |
| 43-03 | 3 | ✅ | Hook `reviewMode` + snapshot travado + transições (D2/D3/D4/D5) |
| 43-04 | 4 | ✅ | UI tela de revisão (`campaign-brief-review`) + botão "Revisar e gerar" + identidade real no server (D6/D7) |
| 43-05 | 2 | ✅ | Schema override `brief_review_confirmed` (z.union, .strict preservado) (D5) |
| 43-06 | 3 | ✅ | Serviço `input_validation` `skipped` + GenerationProgress trata skipped (D5) |
| 43-07 | 2 | ✅ | Migration `feature_flags` + RPC `admin_update_feature_flag` + CHECKs (aplicada no remoto) (D5) |
| 43-08 | 4 | ✅ | Rota normalização flag + serviço de leitura (fallback enabled=false) (D5) |
| 43-09 | 3 | ✅ | Admin feature-flags (rota PUT + página "Controles operacionais" + navegação) (D5) |
| 43-10 | 4 | ✅ | Testes 1-10 (hook/form reviewMode + helpers) |
| 43-11 | 5 | ✅ | Testes 11-16 (UI do resumo) |
| 43-12 | 5 | ✅ | Testes 17-23 (schema/rota/serviço) |
| 43-13 | 4 | ✅ | Testes 24-26 (admin da flag + fallback) |
| 43-14 | 6 | ✅ | Regressão e co-migração de fixtures (2317 testes) |
| 43-15 | 7 | ✅ | Verificação 4 gates + UAT (43-VERIFICATION.md passed + 43-UAT.md 15.5–15.13) |

**Escopo (D1–D7):** gate client-side obrigatório de revisão do brief em tela intermediária (`reviewMode`) entre o form e o `POST /api/campaign/generate-image`; botão "Revisar e gerar"; "Voltar e editar" preserva tudo; "Confirmar e gerar campanha" trava o snapshot e dispara o submit; compressão das imagens antes da revisão (`prepareCampaignImages`); helpers puros `prepareCampaignImages`/`buildCampaignGenerationBody` (body idêntico ao exibido); resumo Produto/Oferta/Imagens/Avisos/Custo + loja/marca + rótulos Principal/Referência + "Vai consumir X crédito(s)" + slot Tema (preparação F44); override `brief_review_confirmed` (pula a IA de visão; fase `input_validation` como `skipped`); flag administrativa mínima `force_brief_vision_check` em `feature_flags` (tela admin, motivo obrigatório, auditoria, fallback de leitura). **Renumeração D1:** F42 = Signup concluída; F43 = Revisão do Brief; **Stripe/Monetização Pública fora da numeração (iniciativa diferida v1.7+)**.

## Phase 45 — Briefing Contextual do Diretor de Arte

**Status:** Concluída ✅ — 8/8 plans (45-01..45-08, 5 waves), 4 gates verdes (253 files / 2427 testes), UAT comparativo antes×depois APROVADO (PASS 7/7) + artes reais de UAT aprovadas como publicáveis (45-08 Task 8 HUMAN-APPROVED)

**Fonte da verdade (arquivada):** `openspec/changes/archive/2026-09-05-fase-45-briefing-contextual-do-diretor-de-arte/`
**Context:** `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-CONTEXT.md`
**Verification:** `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-VERIFICATION.md`
**UAT:** `.planning/phases/45-briefing-contextual-do-diretor-de-arte/45-UAT.md` (comparativo antes×depois — PASS 7/7)

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 45-01 | 1 | ✅ | Trackings — grep-verificação F45/F44/Stripe (registro 371077f7) + inventário de consumidores das chaves + baselines de não-mudança e de testes (tasks 1.1–1.4) |
| 45-02 | 1 | ✅ | Helper puro `art-director-briefing.ts` — extração SEM mudança de comportamento + `sanitizePromptText` cópia pura + delegação com saída idêntica + testes iniciais (tasks 2.1–2.3) |
| 45-03 | 2 | ✅ | Reescrita offer + base em editorial + blocos + montagem contextual offer + deduplicação + saneamento + **mapa transicional** + **co-migração in-plan** (tasks 3.1–3.6) |
| 45-04 | 2 | ✅ | Reescrita spotlight + exclusive + ajustes de blocos por intent + **mapa FINAL (12 chaves)** + **co-migração in-plan** (tasks 4.1–4.4) |
| 45-05 | 3 | ✅ | Testes — golden→invariantes D5 + validatePrompts por cenário + prompt-reframe invariantes transversais + `art-director-briefing.test.ts` aditivo (tasks 5.1–5.5) |
| 45-06 | 4 | ✅ | Regressão completa + typecheck/lint/build + verificação não-mudança do contrato externo + revisão humana dos 4 `.md` (HUMAN-APPROVED após F45-06a/06b) (tasks 6.1–6.3) |
| 45-07 | 5 | ✅ | Verificação final — `45-VERIFICATION.md` (passed) + `45-UAT.md` comparativo antes×depois APROVADO + 4 gates + registros/arquivamento do change (tasks 7.1–7.3) |
| 45-08 | 5 | ✅ | Alinhamento Diretor × Revisor — contrato legal splitado no mesmo split canônico, `campaign-image-reviewer.md` com autoridade estreita (identidade fora da avaliação), bloco canônico de identidade (área segura/margens/posição secundária), rodada de ajuste focado + **concordância de gênero da identidade**; Task 8 HUMAN-APPROVED (artes reais de UAT aprovadas como publicáveis) |

**Escopo (D1–D7):** reestruturação dos 4 `.md` do diretor de imagem (`campaign-image-director.md` base + offer/spotlight/exclusive) em **camada editorial legível + blocos contextuais** nomeados por propósito; novo helper puro `art-director-briefing.ts` montando o prompt final por **presença real de dados** (campo ausente → bloco não enviado; sem seção vazia, sem linha de tabela em branco, sem placeholder não resolvido); separação semântica explícita (texto obrigatório do lojista × aviso ilustrativo × identidade × produto/referências × detalhes comerciais × restrições × direção criativa); eliminação de duplicações — cada natureza opcional/sensível em **um único bloco canônico** (`buildCommercialRepertoire` repartido: validade → fatos; details/availability → contexto comercial); saneamento do texto do lojista nos blocos novos; regras anti-invenção, autorização de criatividade, preservação de identidade e fidelidade primary × auxiliares mantidas. **Sem mudança de superfície externa** (UI/form, contrato HTTP/schema/snapshot/domínio, Copy Director, fallback OpenAI); paridade de keys substituída por invariantes (placeholders ⊆ chaves; determinismo; presente/ausente por bloco; contrato externo intacto) + UAT humano comparativo (PASS 7/7). O **45-08** (adendo pós-UAT, aprovado em revisão humana) abriu a exceção prevista do revisor: contrato interno do Revisor splitado no mesmo `splitDirectorLegalText` do Diretor e `campaign-image-reviewer.md` reescrito com autoridade estreita e políticas legíveis — UI/form/schema público/domínio/snapshot/Copy Director/fallback OpenAI permanecem intactos. Observação residual não-bloqueante: briefings longos, aceitos deliberadamente (artes resultantes boas e publicáveis). **Numeração:** F45 = Briefing Contextual do Diretor de Arte (v1.5) CONCLUÍDA; **F44 = Temas de Campanha permanece fora da numeração** (adicionada pelo runbook da própria F44); **Stripe/Monetização Pública fora da numeração (iniciativa diferida v1.7+)**.

## Phase 46 — Gateway Único de IA e Registry de Modelos

**Status:** CONCLUÍDA — 9/9 plans concluídos (46-01 ✅: registry de modelos por capacidade + resolver assíncrono + migration `campaign_spec` no remoto; 46-02 ✅: api-keys + gateway injetável + adapters por protocolo + `AiCallEnvelope` + contrato de erro + sink de telemetria + mapa capability→generationType; 46-03 ✅: migração das capacidades de TEXTO — `campaign_copy` com dono único + `AiInvoker` seam, fallback por alvo na rota, `campaign_correction_analysis`, `brand_profile_text` e `campaign_spec` legado via gateway; 46-04 ✅ (REABERTO e concluído): migração das capacidades de VISÃO — `campaign_input_validation`/`campaign_image_review`/`brand_profile_vision`/`visual_signature_validation` via gateway, furo 1 corrigido (modelo real de visão), threading do director, remoção da persistência manual de visão e **conversão atômica de TODOS os callers produtivos de visão** (correction-reports, logo, retry-brand-director, server-actions, approve, restore, VS generate-without-logo); bypass fail-open do validator removido (telemetria obrigatória); 4 testes de custo de `generate-image/route.test.ts` co-migrados ao sink; **271 arquivos / 2697 testes, 4 gates verdes**; 46-05 ✅: migração das capacidades de IMAGEM — `campaign_image` via adapter `responses`, `campaign_image_edit` como **segunda invoke explícita** (falha+fallback = dois envelopes) e `visual_signature_image`, furos 3/4 corrigidos, `cost-estimator` somando a tool nas duas capacidades e **fim da soma híbrida manual de imagem** em `generate-image/route.ts`, `correction-reports.ts` e VS `generate-without-logo` (imagem no `BufferingAiTelemetrySink`); **272 arquivos / 2702 testes, 4 gates verdes**; 46-06 ✅ (reaberto): gate global de arquitetura + inventário de cobertura, Tasks 1/2 neutralizadas (callers de visão antecipados ao 46-04), `recordCall` de generate-image delivery-only (limpeza D9) — **275 arquivos / 2719 testes, 4 gates verdes**; 46-07 ✅: remoção das 14 env-vars de modelo/provider do runtime e `.env.example` (chaves + operacionais apenas), gate de arquitetura estendido (env-var) e ordem de deploy (D5), `scripts/benchmark.ts` via registry — **275 arquivos / 2720 testes, 4 gates verdes**; 46-08 ✅: regressão completa verde (275 arquivos / 2720 testes), não-mudança do contrato externo por git diff (UI/form/schema público/snapshot/domínio/prompts intactos), prompts sem drift e equivalência de defaults registry × pré-F46 (11 capacidades, zero divergência)) — 9 plans (46-01..46-09, 9 waves — DAG serializado por `depends_on`), Change A. Fonte da verdade: `openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`. Change B (catálogo/seleção admin) = **F47**.

**Conclusão:** 46-08 ✅ (regressão completa + não-mudança do contrato externo + equivalência de defaults, prompts sem drift) e 46-09 ✅ (VERIFICATION goal-backward `passed` + UAT humano **8/8 PASS** + registros atualizados + arquivamento preparado; achado de UAT do snapshot econômico corrigido em `529a69c5`) — **275 arquivos / 2721 testes, 4 gates verdes**. Fonte da verdade: `openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`. Sucessora: **F47 (Catálogo e Seleção de Modelos Admin — Change B)**.

**Fonte da verdade:** `openspec/changes/archive/2026-09-13-fase-46-gateway-unico-de-ia-e-registry-de-modelos/`
**Context:** `.planning/phases/46-gateway-unico-de-ia-e-registry-de-modelos/46-CONTEXT.md`

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 46-01 | 1 | ✅ | Trackings + baseline/inventário das 11 capacidades + registry (`AiModelConfig` com protocol no primary e fallback) + migration CHECK `campaign_spec` (tasks 1.1–1.5) |
| 46-02 | 2 | ✅ | api-keys + gateway (`invoke`/alvo explícito/uma tentativa) + adapters por protocolo + `AiCallEnvelope` + contrato de erro + sink + mapa capability→generationType (tasks 2.1–2.6) |
| 46-03 | 3 | ✅ | Migração das capacidades de TEXTO (copy, correção, brand_profile_text, campaign_spec legado via provider+service+rota) + proprietário único + remoção da persistência manual + co-migração (tasks 3.1–3.5) |
| 46-04 | 4 | ✅ | Migração das capacidades de VISÃO + furo 1 (modelo real) + threading do director + remoção da persistência manual + co-migração (tasks 4.1–4.5). **Reabertura (Tasks 5/6):** bypass fail-open do validator removido + conversão atômica de todos os callers de visão (correction-reports, logo, retry-brand-director, server-actions, approve, restore, VS generate-without-logo) + 4 testes de custo de `generate-image/route.test.ts` co-migrados (271 files / 2697 testes, 4 gates verdes) |
| 46-05 | 5 | ✅ | Migração das capacidades de IMAGEM (`campaign_image` via `responses`; `campaign_image_edit` como segunda invoke explícita = dois envelopes; `visual_signature_image`) + furos 3/4 + `cost-estimator` (tool em `campaign_image` e `visual_signature_image`) + fim da soma híbrida manual de imagem em `generate-image/route.ts`, `correction-reports.ts` e VS `generate-without-logo` + co-migração das suites — 272 files / 2702 testes, 4 gates verdes |
| 46-06 | 6 | ✅ | Gate global de arquitetura (SDK/wire + persistência manual) + inventário global de telemetria. Tasks 1/2 neutralizadas (callers de visão antecipados ao 46-04 Task 6); `recordCall` de `generate-image` delivery-only (limpeza D9) — 275 files / 2719 testes, 4 gates verdes |
| 46-07 | 7 | ✅ | Remoção das 14 env-vars de modelo/provider do runtime e `.env.example` + extensão do gate (env-var) + co-migração verificada + ordem de deploy (D5); `scripts/benchmark.ts` via registry — 275 files / 2720 testes, 4 gates verdes |
| 46-08 | 8 | ✅ | Regressão completa + não-mudança do contrato externo + equivalência de defaults (tasks 8.1–8.3) — 275 files / 2720 testes, 4 gates verdes, prompts sem drift |
| 46-09 | 9 | ✅ | Verificação final (`46-VERIFICATION.md` goal-backward `passed` + `46-UAT.md` 8/8 PASS + registros/arquivamento preparado) (tasks 9.1–9.3) — 275 files / 2721 testes, 4 gates verdes |

## Phase 47 — Catálogo e Seleção de Modelos Admin (Change B)

**Status:** CONCLUÍDA — 8/8 planos em 7 ondas, 287 files / 2782 testes, 4 gates verdes, UAT local aprovado (UAT-01..07 PASS, 08 AUTOMATED, 09..12 PASS), migration remota aplicada/verificada, deploy pós-cleanup Ready, env-vars obsoletas removidas e fluxo feliz validado em produção. Fonte da verdade: `openspec/changes/fase-47-catalogo-e-selecao-de-modelos-admin/`.

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 47-01 | 1 | ✅ | Trackings + migration local, exatamente 12 seeds, RLS/CHECKs/RPCs/auditoria/idempotência e checkpoint Docker/Supabase |
| 47-02 | 2 | ✅ | Serviços bulk de catálogo/seleção, cache TTL 30s/invalidação e paridade registry × catálogo |
| 47-03 | 3 | ✅ | PersistedModelResolver fail-open e composição em index.ts sem editar gateway.ts |
| 47-04 | 4 | ✅ | Schemas Zod + GET/PUT/DELETE admin, DELETE JSON exato e operationId UUID obrigatório |
| 47-05 | 5 | ✅ | Página/form Modelos de IA, grupos, fallback campaign_copy, reset auditado e navegação |
| 47-06 | 5 | ✅ | Pricing capacity-aware com helper bulk, sem alterar resolveAiCost |
| 47-07 | 6 | ✅ | Labels efetivos, regressão, gates e não-mudança de contratos |
| 47-08 | 7 | ✅ | UAT local, migration remota [BLOCKING] → deploy, verificação e tracking final |

**Fences:** catálogo somente leitura na UI; sem homologação automatizada/paga; `campaign_image_edit` é primary independente; não alterar `src/lib/ai/gateway.ts`, prompts, contratos de geração, snapshot, domínio ou merchant UI/form. Cache server-side por instância com TTL 30s e invalidação local; documentar residual cross-instance.

**Escopo (D1–D10):** catálogo persistido `ai_model_catalog` com exatamente 12 seeds iniciais e UI somente leitura; seleções persistidas em `ai_model_selection` por capability, com RPCs de set/reset auditadas e idempotentes; `PersistedModelResolver` fail-open, cache bulk com TTL de 30s e invalidação local; API e página admin agrupadas em Text/Visual/Image; avisos de pricing capacity-aware; labels diagnósticos efetivos; DELETE com JSON exato `{ capability, reason, operationId }` e UUID obrigatório gerado/reutilizado pela UI; migration local → UAT aprovada por humano → migration remota [BLOCKING] → deploy. `campaign_image_edit` permanece independente e fallback existe somente para `campaign_copy`. **Sem alterar** `src/lib/ai/gateway.ts`, prompts, contratos de geração, snapshot, domínio ou UI/form do merchant.

## Phase 48.1 — Laboratório Mínimo de IA

**Status:** EM PLANEJAMENTO ◆ — 0/14 plans (9 waves); fonte da verdade `openspec/changes/fase-48-1-laboratorio-ia-minimo/` (proposal / design D1–D18 / 9 specs / tasks 48-1-01..48-1-14); planos, CONTEXT e UI-SPEC gerados; **aguardando revisão humana antes da execução**.

| Plan | Wave | Status | Description |
|------|------|--------|-------------|
| 48-1-01 | 1 | ○ | Trackings (verificação de resíduos) + migration local: 8 tabelas `lab_*`, bucket `lab-artifacts`, RLS/grants, triggers de imutabilidade e RPC `lab_reserve_run` |
| 48-1-02 | 1 | ○ | Guarda de ambiente fail-closed (`environment-guard`), constantes de limite, env vars e gate de arquitetura |
| 48-1-03 | 2 | ○ | Cenários controlados: schema Zod, fixtures (3 cenários de oferta) e serviço de bootstrap/hash |
| 48-1-04 | 2 | ○ | Domínio de experimentos prompt-only: schemas, criação com 2 variantes, transições e congelamento |
| 48-1-05 | 3 | ○ | Harness de gateway: `buildDirectorPrompt`, `LabModelResolver`, `LabPromptLoader`, `LabTelemetrySink` e runtime single-shot |
| 48-1-06 | 3 | ○ | Persistência de artefatos: bucket/paths, metadados/checksum, URL assinada e cleanup manual |
| 48-1-07 | 4 | ○ | Execução e snapshots imutáveis: validação técnica (`sharp`), `run-service`, idempotência/reexecução e reserva atômica |
| 48-1-08 | 5 | ○ | API administrativa sob `/api/admin/laboratorio` (schemas, rotas, estimativa, execução NDJSON e avaliação) |
| 48-1-09 | 6 | ○ | UI do laboratório: layout/sub-nav, página inicial, criação, detalhe, cenários e execução |
| 48-1-10 | 6 | ○ | Comparação lado a lado e avaliação humana (modo cego, verdict, reavaliação) |
| 48-1-11 | 7 | ○ | Testes 1: domínio, guardas, isolamento e cenários |
| 48-1-12 | 7 | ○ | Testes 2: harness, execução, artefatos, API, UI e avaliação |
| 48-1-13 | 8 | ○ | Regressão e co-migração de fixtures |
| 48-1-14 | 9 | ○ | UAT local com IA real, migration remota deliberada e verificação final |

**Fences:** nenhuma task toca `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `ai_model_catalog`, `admin_audit_log`, prompts oficiais ou o bucket `campaign-images`; nenhum secret em banco/log/snapshot; nenhuma chamada paga em testes/CI; `src/lib/ai/gateway.ts`, prompts oficiais, `src/lib/campaign/**`, `src/lib/ai-cost/**` e `src/lib/ai/model-registry.ts` intactos.

**Escopo (D1–D18):** bounded context `src/lib/lab/**` + `/admin/laboratorio` + `/api/admin/laboratorio`; guarda de ambiente fail-closed (somente Supabase local: `VENDEO_LAB_ENABLED` + `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS`); isolamento absoluto (tabelas/bucket próprios, sem `generation_events`/`ai_model_selection`/campanhas/créditos/prompts oficiais); cenários versionados com `content_hash`; experimentos **prompt-only** com modelo fixo e idêntico (`model`/`configuration` → F48.2); snapshots imutáveis com origem completa do custo; harness isolado do gateway F46 (alvo fixo, `LabPromptLoader`, `LabTelemetrySink`; **sem** `OpenAIImageProvider`/fallback automático; exatamente 1 chamada `campaign_image`/run; validação de visão dispensada por `brief_review_confirmed`); validação técnica objetiva (`sharp`) sem nota automática; comparação lado a lado + avaliação humana append-only (`lab_human_evaluations` com trigger anti-UPDATE/DELETE); segurança financeira (`confirmed: true`, estimativa, limites `MAX_SCENARIOS_PER_EXPERIMENT=3`/`MAX_REPETITIONS=3`/`MAX_RUNS_PER_EXPERIMENT=12`/`MAX_CONCURRENT_LAB_RUNS=1`, RPC `lab_reserve_run` antes de qualquer chamada paga); migration local → UAT local → migration remota deliberada após a UAT (schema remoto inerte, `VENDEO_LAB_ENABLED=false`). **Sem mudança de superfície externa.** **Divergência resolvida:** `CostResolution` real (sem `imageUnitUsd`/`costPartial`; usa `imageToolComponentUsd`/`imageToolPricing*` e parcialidade via `costFormulaVersion`/`costEstimationNote`) — nenhuma alteração em `src/lib/ai-cost/**`. **Numeração:** F48.1 = Laboratório Mínimo de IA (v1.5), primeira fatia do programa incremental F48.x (F48.2–F48.6 propostas em `docs/alinhamento-roadmap-pos-f48-1.md`); F44 e Stripe fora da numeração.

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
