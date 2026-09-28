---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: — Lançamento Externo Controlado ◆
status: complete
last_updated: "2026-09-28T20:50:55.200Z"
progress:
  total_phases: 39
  completed_phases: 34
  total_plans: 309
  completed_plans: 299
  percent: 87
---

# Project State

## Project Reference

- Project: `.planning/PROJECT.md`.
- Core value: transformar uma oferta simples em uma campanha profissional, clara e publicável.
- Foco atual: F48.2.2 — **Fundação da bancada de geração no Admin/Laboratório** (**em execução** desde 2026-09-28; 8 planos; `48-2-2-01` concluído com CHECKPOINT 1 aprovado, `48-2-2-02`, `48-2-2-03`, `48-2-2-04` (CHECKPOINT 2 aprovado) e `48-2-2-05` concluídos; próxima ação é executar `48-2-2-06`).
- Fase anterior: F48.2.1 — **Bancada Manual de Prompts do Diretor** (CONCLUÍDA, VERIFICADA, SINCRONIZADA e ARQUIVADA).
- Próxima fase: **F48.2.3 — Experimento determinístico Oferta 1:1** (depende da bancada validada na F48.2.2).
- Próxima iniciativa condicionada: F50.1 aguardando constituição da PJ.

## Current Position

Phase: 48.2.2 (Fundação da bancada de geração no Admin/Laboratório) — **IN PROGRESS** (8 planos; 5 executados — `48-2-2-01` concluído com CHECKPOINT 1 aprovado, `48-2-2-02`, `48-2-2-03`, `48-2-2-04` (CHECKPOINT 2 aprovado) e `48-2-2-05` concluídos)
Plans: `48-2-2-01` .. `48-2-2-08` — **criados em 2026-09-28**; `48-2-2-01`, `48-2-2-02`, `48-2-2-03`, `48-2-2-04` e `48-2-2-05` **executados/summarized**; `48-2-2-06`..`48-2-2-08` pendentes.
Checkpoints humanos: **CP1 aprovado** (spike de modelos/presets, plano 01; 4 presets propostos), **CP2 aprovado** (presets habilitados antes de qualquer geração paga, plano 04 — 4 presets `images` habilitados após correção do pricing; nenhuma geração paga autorizada), **CP3** (UAT local, plano 08). Nenhuma task executa chamada paga autonomamente.
Próxima ação: **executar `48-2-2-06`** (API administrativa sob `/api/admin/laboratorio/bancada` — guards, estimativa, stream NDJSON, detalhe e artefatos) e, em sequência, `48-2-2-07`..`48-2-2-08`; depois, **F48.2.3 — Experimento determinístico Oferta 1:1**.
Fase anterior: 48.2.1 (Bancada Manual de Prompts do Diretor) — **COMPLETE**; chain `48-2-1-05 → 48-2-1-07 → 48-2-1-08 → 48-2-1-09`.

- F48.2.1 realinhada (OpenSpec `017b8799`) e **concluída**: bancada manual dos prompts do Diretor.
- Todos os planos resolvidos; programa local `closed` e experimento `archived`, com recusas fail-closed confirmadas e histórico preservado.
- **Zero runs e zero custo**; `prompts/` intocado; sem promoção/canário/`db push`.
- OpenSpec **verificado, sincronizado e arquivado** em `openspec/changes/archive/2026-09-27-fase-48-2-1-otimizacao-prompts-diretor/` (commit `f55bed45`).
- **Realinhamento de tracking (2026-09-28):** a F48.2.2 antiga (**Auditoria e Otimização do Prompt do Revisor**) foi **descartada/substituída** pela nova direção, **sem artefatos mantidos** (implementação não iniciada; recuperável pelo histórico do Git). A change antiga **saiu** da lista de changes ativas do OpenSpec.
- **Nova sequência:** **F48.2.2 — Fundação da bancada de geração no Admin/Laboratório** → **F48.2.3 — Experimento determinístico Oferta 1:1**. A F48.2.2 é a próxima fase a planejar; a F48.2.3 depende da bancada validada na F48.2.2.
- Próximo trabalho: **planejar a F48.2.2 (nova)**; as sessões manuais de teste dos prompts do Diretor (`offer`/`spotlight`/`exclusive`) seguem como trabalho conduzido pelo usuário e pelo assistente, e qualquer operação real paga exige **novo programa** e **nova autorização humana explícita**.

## F48.2.1 — Inventário da fase (mecânico)

- **Concluídos (8):** `48-2-1-01` .. `48-2-1-05`, `48-2-1-07`, `48-2-1-08`, `48-2-1-09`.
- **Suplantado/resolvido (1):** `48-2-1-06` — interrompido na Task 4 (Checkpoint 3); resolvido via `48-2-1-06-SUMMARY.md` (supersessão); fora da cadeia executável.
- `verify.phase-completeness 48.2.1`: `complete: true`, `plan_count 9`, `summary_count 9`, `incomplete_plans []`.

## F48.2.2 — Inventário da fase (mecânico)

- **Planejados (8):** `48-2-2-01` .. `48-2-2-08` (criados em 2026-09-28). **Executado/summarized (5):** `48-2-2-01` (CHECKPOINT 1 aprovado após correção do spike; nenhuma chamada paga; base SHA `50ae6007`), `48-2-2-02` (persistência local-first: DDL local + bootstrap + guard `bench/` + serviços de run/artefato; nenhuma chamada paga; commits `ffd982e0`, `39671a1e`, `7b709feb`), `48-2-2-03` (lojas de teste e branding completo: manifesto local + `assertBenchTestStore` + signer restrito `createBenchBrandingSignedUrl` + contrato de branding com `typography_direction` + snapshot de campanha com intenção resolvida; nenhuma chamada paga; commits `ef04240f`, `ba1c57c9`, `b9321f41`) e `48-2-2-04` (presets confirmados habilitados + pricing local versionado + CHECKPOINT 2 aprovado após correção do pricing; nenhuma geração paga; commits `e1928770`, `fd447b64`, `02b0dbcc`) e `48-2-2-05` (invocação isolada: adapter `Images` dedicado que propaga `quality` e ignora o branding, resolver de preset single-shot sem consultar a seleção produtiva, resolvedor de custo local chaveado pelo preset completo com usage/custo do provider separados e `low` ≠ `medium`, e orquestração de exatamente uma chamada paga com telemetria read-only e erro sanitizado; produção intocada; typecheck exit 0 e 64 testes verdes; **nenhuma chamada paga**; commits `c8edd4c7`, `77c85e6d`, `62dcb559`).
- **Fonte da verdade:** `openspec/changes/fase-48-2-2-fundacao-bancada-geracao/` (proposal / design D1–D17 / tasks 1–8 / 8 specs), corrigida no commit `388db445` e refletida nos planos.
- **Artefatos de planejamento:** `48.2.2-CONTEXT.md`, `48.2.2-UI-SPEC.md`, `48-2-2-PATTERNS.md` + 8 `PLAN.md`; verificados por `gsd-plan-checker` (**VERIFICATION PASSED**).
- **Checkpoints:** **CP1 aprovado** (spike, plano 01 — `gpt-image-2` e `gpt-image-2.5-flare` confirmados pela documentação oficial; 4 presets propostos), **CP2 aprovado** (presets antes de geração paga, plano 04 — 4 presets `images` habilitados após correção do pricing; `responses` desabilitado; nenhuma geração paga autorizada), CP3 (UAT local, plano 08).
- **Ondas:** cadeia sequencial `48-2-2-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08` (o plano 04 depende também do 01).

## Global (mecânico — `gsd-sdk query progress`)

- `total_phases: 39` / `completed_phases: 34`; `total_plans: 309`; `completed_plans (summaries): 299`; `percent: 87` (frontmatter recalculado pelo SDK em 2026-09-28).

## Accumulated Context — Decisions

- F48.2.1 realinhada (OpenSpec `017b8799`): entrega exclusivamente a **bancada manual** dos prompts do Diretor (`offer`/`spotlight`/`exclusive`).
- Diagnóstico versionado v1/v2/v3 preservado como evidência histórica; regra de vitória **consultiva**; rascunho `offer/v1` apenas como exemplo (não aprovado, não vencedor).
- Checkpoint 1 aprovado (`matrix-v1` + `diagnosticVersion 3`); Checkpoint 2 aprovado (`autorizar-inicial`, US$ 2.808).
- Contrato de autorização: `status='closed'` = encerrado com autorização revogada; somente `authorized` reserva; `closed` terminal; nova sessão exige novo programa; histórico preservado.
- Plano `48-2-1-07`: reserva fail-closed por `status='authorized'`; `closed` terminal (serviço + trigger); reautorização recusada; UI de encerramento.
- Plano `48-2-1-08`: orçamento completo visível + `BudgetPanel` integrado + `programRemainingUsd` propagado; arquivamento seguro (domínio + `PATCH` + UI) terminal.
- Plano `48-2-1-09`: validação automática + UAT sem execução paga; **decisão humana `aprovar-encerramento`**; programa `860ca4fe-…` `closed` e experimento `c48e21b5-…` `archived`, com histórico preservado.
- Correção test-only autorizada (fora do escopo F48.2.1) do date-bomb preexistente em `use-campaign-form-validity.test.ts` (freeze de relógio), restaurando a suíte com apenas a exceção F50.
- **Realinhamento F48.2.2 (2026-09-28):** a direção da F48.2.2 mudou de "Auditoria e Otimização do Prompt do Revisor" para "**Fundação da bancada de geração no Admin/Laboratório**" (gerações reais e mensuráveis, isoladas da produção, acesso restrito, loja real, branding persistido como fonte de verdade, prompt manual, seleção de modelo/qualidade, registro de evidência técnica e financeira). A F48.2.2 antiga foi **descartada/substituída**, sem artefatos mantidos (implementação não iniciada; recuperável pelo histórico do Git); a F48.2.3 passa a ser "**Experimento determinístico Oferta 1:1**". Backlog posterior (fora das duas fases): Destaque, Exclusivo, outros formatos, temas recorrentes, carrossel, comparação cega/lado a lado, avaliação automática, mobile e promoção de modelos/pipelines para produção. Regra: a identidade persistida da loja é a **fonte de verdade**; a criatividade do modelo fica restrita à composição específica da campanha (sem novo "diretor criativo" redefinindo tipografia/cores/posicionamento).
- **Planejamento F48.2.2 (2026-09-28):** base OpenSpec corrigida (`388db445`) — allowlist própria `BENCH_MODEL_ALLOWLIST` (sem tocar `MODEL_ALLOWLIST`); ciclo `draft → pending` (slot global só na confirmação); signer local restrito de branding (`createBenchBrandingSignedUrl`); custo local por `modelo + qualidade + tamanho`, com pricing **somente em código** (`bench-pricing.ts`, sem tabela); `assertBenchTestStore` em toda entrada. 8 planos criados; spike bloqueante no plano 01; aprovação humana antes de geração paga (CP2). `gsd-plan-checker` = VERIFICATION PASSED.
- **Execução F48.2.2 — plano `48-2-2-01` (2026-09-28):** **CHECKPOINT 1 aprovado** após correção dirigida por humano do spike (commit `d77d40ca`) — `gpt-image-2` e `gpt-image-2.5-flare` **confirmados pela documentação oficial**; **4 presets propostos** (`gpt-image-2-low`/`gpt-image-2-medium`/`gpt-image-2.5-flare-low`/`gpt-image-2.5-flare-medium`), **todos desabilitados** (`spike_pendente`) até o CP2 (plano 04); `account_availability_pending` a comprovar no UAT autorizado (plano 08); **nenhuma chamada paga executada**. Entregues: bounded context `src/lib/lab/bench/**`, registry de dimensões (primeiro recorte), `BENCH_MODEL_ALLOWLIST`, registry de presets e contratos de isolamento read-only (typecheck + 48 testes verdes). F48.2.2 antiga (Revisor) permanece descartada/substituída.
- **Execução F48.2.2 — plano `48-2-2-02` (2026-09-28):** persistência local-first da bancada. **DDL local fora da cadeia de migrations** (`supabase/lab/bench-schema.sql`, D17) com `lab_bench_runs` (status inicial `draft`) + `lab_bench_artifacts`, RLS/grants service-role, trigger de imutabilidade a partir de `running` (população `draft → pending` permitida), trigger de proibição de DELETE e índice único parcial **global** de geração ativa cobrindo **somente** `pending`/`running`; **bootstrap local idempotente** (`scripts/lab/48-2-2-bench-bootstrap.mjs`) com guarda local-only (`assertLocalHost`), `--revert` e `--with-catalog` (opt-in, **não executado** — presets desabilitados até o CP2). Guard de path aditivo `bench/{runId}/inputs/{index}.{ext}` e `bench/{runId}/output.{ext}` (anti-traversal mantido; `experiments/...` intacto). Serviços: `bench-artifact-service` (builders, checksum, rollback sem órfão com `finalizeRun` injetado, URL assinada) e `bench-run-service` (reserva em `draft` idempotente por `operation_id` sem ocupar o slot; `setBenchRunInput` em `draft`; `confirmBenchRun` CAS `draft → pending` com `unique_violation` → `bench_run_already_active`; `markBenchRunRunning`; `finalizeBenchRun` com erro sanitizado; `reconcileStaleBenchRuns` com `bench_run_orphan_timeout` e `bench_run_draft_abandoned`; `getBenchRun`/`getBenchRunByOperationId`). **Nenhum `supabase db push` executado** e `lab_bench_*` ausente no remoto. Verificação: `db reset` + `db lint --fail-on error` exit 0; bootstrap idempotente (2×); 15/15 validações de DDL; typecheck exit 0; 78 testes verdes. **Nenhuma chamada paga.**
- **Execução F48.2.2 — plano `48-2-2-03` (2026-09-28):** lojas de teste e branding completo. **Manifesto local** `fixtures/lab/bench/stores.json` (única fonte de elegibilidade, D4; arquivo versionado com `stores: []`, IDs reais a preencher no UAT) e `store-manifest.ts` com `loadBenchStoreManifest` (anti-traversal `assertWithinRoot`/`path.relative`), `listBenchTestStores` (manifesto **E** `stores` local, `.select(...)` somente-leitura) e **`assertBenchTestStore` exportado** (recusa `store_not_in_manifest` sem leitura; `bench_store_not_materialized` quando ausente localmente) — contrato exigido nos pontos de entrada (GET branding, estimativa e POST runs; consumo no plano 06). **Signer local restrito** `bench-branding-signer.ts`: `createBenchBrandingSignedUrl` aceita **somente** `store-logos`/`store-brand-assets`/`visual-signatures` (allowlist estrita de bucket/path, `assertLabEnvironment` na entrada, TTL do servidor, códigos `bench_branding_bucket_not_allowed`/`bench_branding_path_invalid`) e `createBenchBrandingSignedUrlForStore` exige `assertBenchTestStore` **antes** de assinar; **não** reutiliza o signer/bucket de artefatos (`lab-artifacts`) nem `campaign-images`. **Contrato de branding** `branding-service.ts`: `loadBenchBranding` começa por `assertBenchTestStore`, lê `stores`/`store_brand_profiles` (`status='synced'`, fallback `source='without_logo'`)/`store_brand_assets` (`status='active'`)/`store_visual_signatures` (`status='active'`) em somente leitura, expõe **todos** os campos incluindo `typography_direction` (da coluna persistida) e resolve logo/assinatura por URL assinada restrita; `toBenchBrandingSnapshot` registra a evidência. **Snapshot de campanha** `campaign-snapshot.ts` (módulo puro): `buildBenchCampaignSnapshot` compatível com os contratos reais de produto/comercial, `resolveBenchIntent` determinística e `intentResolvedFrom` (`explicit` | `inferred_from_prices`); `assertBenchCampaignSnapshot` (`missing_campaign_snapshot`); nenhum serviço de crédito/entrega/correção/publicação. Fronteiras produtivas intocadas (`git diff` vazio para `BrandProfileSnapshot`/`resolveStoreIdentity`/`art-director-briefing`). Verificação: typecheck exit 0; 5 arquivos / 67 testes verdes; gates de arquitetura/isolamento 2 arquivos / 31 testes verdes. **Nenhuma chamada paga.**

- **Execução F48.2.2 — plano `48-2-2-04` (2026-09-28):** registry final de presets + pricing local + **CHECKPOINT 2 aprovado** (após correção do pricing dirigida por humano). **Habilitados (`enabled: true`, protocolo `images`):** `gpt-image-2-low`, `gpt-image-2-medium`, `gpt-image-2.5-flare-low`, `gpt-image-2.5-flare-medium`; **`responses` permanece desabilitado** (`reason: protocolo_nao_confirmado`). **`BENCH_MODEL_ALLOWLIST`** lista `openai.gpt-image-2` e `openai.gpt-image-2.5-flare` em `images` (o `MODEL_ALLOWLIST` produtivo permanece intocado; teste negativo cobre o Flare ausente da allowlist produtiva). **Pricing local** (`bench-pricing.ts`, módulo puro, `BENCH_PRICING_RULE_VERSION = "2026-09-bench-1"`) chaveado pelo preset completo (`provider+model+protocol+quality+size`), modo `token_based`, **somente em código** (sem tabela de pricing, D17); `gpt-image-2` = `coverage: complete` (low 400 / medium 3533 tokens, derivados da referência pública) e `gpt-image-2.5-flare` = `coverage: partial`. **Correção dirigida por humano (commit `02b0dbcc`):** estimativas de tokens de saída chaveadas por `model+quality+size` (nunca compartilhadas entre modelos); Flare low = 196 tokens / ~US$0,00588 (calculador oficial); Flare medium **ausente** (sem valor comprovado); taxas publicadas do Flare preservadas (imagem entrada US$8/M, saída US$30/M). **Bootstrap local** (`48-2-2-bench-bootstrap.mjs`) inseriu **apenas linhas de catálogo** (`ai_model_catalog`) de forma idempotente (`inserted:2` local); **nada promovido ao remoto** e **nenhum `supabase db push`**. Verificação: `npm run typecheck` exit 0; `preset-registry.test.ts` + `bench-pricing.test.ts` = **2 arquivos / 22 testes verdes**. **Nenhuma geração paga** e nenhuma chamada paga a provedor foi executada; nenhuma autorizada. Commits: `e1928770`, `fd447b64`, `02b0dbcc`.
- **Execução F48.2.2 — plano `48-2-2-05` (2026-09-28):** invocação isolada da bancada. **Adapter `Images` dedicado** (`src/lib/ai/adapters/bench-images.ts`) propaga `quality` no `images.edit` (fecha a lacuna do adapter produtivo) e **ignora** `identityImageUrl` (branding nunca vira referência), registrado **apenas** no runtime da bancada (`gateway/runtime.ts` — `createBenchAdapterRegistry`/`createBenchGateway`/`buildBenchInvocationRequest`); o `ImagesAdapter` e o `defaultAdapterRegistry` permanecem intocados (regressão por teste). **Resolver de preset** (`gateway/bench-model-resolver.ts`) devolve capability + alvo do preset via `resolveBenchPreset`, **single-shot** (`fallback: undefined`), recusando preset desabilitado (`preset_not_enabled`) e alvo divergente (`INVALID_BENCH_TARGET`); nunca consulta a seleção produtiva. **Resolvedor local de custo** (`execution/bench-cost-resolver.ts`) chaveado pelo preset completo (`provider+model+protocol+quality+size`): prioridade custo reportado pelo provider (separado) → `per_image` (preço fixo, sem tokens) → `token_based` (taxas × usage) → estimado (`isEstimate: true`); `cost_source: "bench_local_pricing"` + `cost_rule_version`; `low` ≠ `medium`; nunca multiplicação genérica `usage × unitPriceUsd`. **Orquestração single-shot** (`execution/bench-execution-service.ts` — `executeBenchRun`) invoca **exatamente uma** vez (sem fallback), persiste a saída, valida tecnicamente, acumula telemetria **read-only** (`LabTelemetrySink`) e finaliza com latência/usage/custo/`cost_detail` e erro **sanitizado** (`sanitizeAiErrorMessage`). Verificação: `npm run typecheck` exit 0; `bench-images-adapter` + `bench-execution.contract` + `bench-run-service` + `architecture-guard` = **4 arquivos / 64 testes verdes**; `git diff` das fronteiras de produção **vazio** (`images.ts`, `registry.ts`, `lab/gateway/runtime.ts`, `lab-model-resolver.ts`, `cost-estimator.ts`, `lab-cost-estimate.ts`). **Nenhuma chamada paga** (SDK mockado; fakes em memória). Commits: `c8edd4c7`, `77c85e6d`, `62dcb559`.

## Pending Todos

- **Executar a F48.2.2 — Fundação da bancada de geração no Admin/Laboratório** (**em execução**; `48-2-2-01` a `48-2-2-05` concluídos — CHECKPOINT 1 e CHECKPOINT 2 aprovados; próxima ação: `48-2-2-06`).
- F48.2.3 — Experimento determinístico Oferta 1:1 — não iniciada; depende da bancada validada na F48.2.2.
- Sessões manuais de teste dos prompts do Diretor (`offer`/`spotlight`/`exclusive`), conduzidas pelo usuário e pelo assistente; qualquer operação real paga exige novo programa e nova autorização humana explícita.
- F48.2.2 antiga (Auditoria e Otimização do Prompt do Revisor) — **descartada/substituída**; implementação não iniciada; sem artefatos mantidos (recuperável pelo histórico do Git).
- Exceção preexistente F50 (`src/lib/legal/__tests__/legal-document-versions.test.ts`, `ENOENT`) é falha externa à F48.2.1; registrada como follow-up.

## Blockers/Concerns

- Constituição da PJ é dependência externa da futura F50.1 (não é pendência da F48.2.1).

## Deferred Items

| Initiative | Status |
|---|---|
| F50.1 Formalização Legal e Ativação da Demonstração | Futura, aguardando PJ |
| Stripe/monetização pública | Diferida para v1.7+, fora da numeração |

## Quick Tasks Completed

| ID | Date | Summary |
|---|---|---|
| 260924-jv4 | 2026-09-24 | Compactação de STATE e archive integral |
| 260924-jl2 | 2026-09-24 | Compactação de AGENTS.md |
| 260924-il3 | 2026-09-24 | Alinhamento documental F50/F50.1 |
| 260924-i6l | 2026-09-24 | Reconciliação documental e operacional F50 |
| 260919-hju | 2026-09-19 | Ajuste acessível de Tom de Voz |

## Session Continuity

- Última sessão: 2026-09-28 — execução do plano `48-2-2-05` (invocação isolada: adapter `Images` dedicado, resolver de preset single-shot, resolvedor de custo local e orquestração single-shot).
- Último trabalho: plano `48-2-2-05` **concluído** (`bench-images.ts` propaga `quality` e ignora o branding; `gateway/runtime.ts` registra o adapter dedicado só no runtime da bancada; `gateway/bench-model-resolver.ts` single-shot sem consultar a seleção produtiva; `execution/bench-cost-resolver.ts` com `cost_source: bench_local_pricing` e provider separado; `execution/bench-execution-service.ts` com `LabTelemetrySink`, `resolveBenchCost`, `sanitizeAiErrorMessage` e `validateArtifactTechnically`; typecheck exit 0; 4 arquivos / 64 testes verdes; **nenhuma chamada paga**, produção intocada); commits `c8edd4c7`, `77c85e6d` e `62dcb559`.
- Próximo trabalho: **executar `48-2-2-06`** (API administrativa sob `/api/admin/laboratorio/bancada` — guards, estimativa, stream NDJSON, detalhe e artefatos) e a sequência até `48-2-2-08` (CP3 no plano 08); depois, F48.2.3 — Experimento determinístico Oferta 1:1. Sessões manuais de teste dos prompts do Diretor seguem em paralelo, com novo programa e nova autorização humana antes de qualquer chamada paga.
- Resume file: `None` (plano `48-2-2-05` concluído; próxima ação é executar `48-2-2-06`).
