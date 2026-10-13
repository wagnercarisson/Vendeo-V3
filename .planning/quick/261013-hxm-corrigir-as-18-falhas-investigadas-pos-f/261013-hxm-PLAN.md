---
id: 261013-hxm
title: Corrigir as 18 falhas investigadas após o fechamento da F56.2b1b
status: in-progress
scope: post-b1b-test-failures-burndown
approval:
  by: responsável (owner)
  date: 2026-10-13
  origin: escopo aprovado fornecido na invocação da quick (contexto)
files_modified:
  - src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts
  - src/lib/lab/bench/__tests__/branding-service.test.ts
  - src/lib/lab/bench/__tests__/prompt-base.contract.test.ts
  - src/lib/lab/bench/__tests__/form-parity.contract.test.ts
  - src/lib/lab/bench/__tests__/run-history.contract.test.ts
  - src/lib/lab/bench/domain/campaign-snapshot.ts
  - src/lib/lab/bench/__tests__/campaign-snapshot.test.ts
  - src/lib/visual-signature/__tests__/ai-image-generator.test.ts
  - src/lib/image-generation/providers/__tests__/openai-provider.test.ts
  - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
  - src/lib/legal/__tests__/legal-document-versions.test.ts
  - .planning/quick/261013-hxm-corrigir-as-18-falhas-investigadas-pos-f/
  - .planning/STATE.md
---

# Quick Plan — 261013-hxm

## Objetivo

Corrigir as **18 falhas pré-existentes** herdadas após o fechamento da F56.2b1b, na **branch atual**
(`feature/fase-56-1-contrato-produtivo-modelos-e-fallback`). Sem iniciar a b2, sem reabrir a b1b,
sem alterar runtime produtivo, schemas, prompts, composer, políticas, versões ou baseline aprovados.
Somente fixtures de teste, a construção do snapshot do laboratório e o isolamento determinístico dos
testes de provider/resolver e do teste legal.

## Causas confirmadas por reprodução (2026-10-13)

1. **13 fixtures inválidas (lab/bench)** — o schema da bancada passou a exigir `offer.backgroundDirection`
   (`BenchRunInputSchema.superRefine` → `bench_background_direction_required`) e o snapshot idem
   (`campaign-snapshot.ts:131`). Fixtures antigas não informam a direção.
   - `intent-schema.contract.test.ts` (5 casos)
   - `branding-service.test.ts` (3 casos, `BRIEFING_OFFER`)
   - `prompt-base.contract.test.ts` (3 casos, `makeOffer()`)
   - `form-parity.contract.test.ts` (1 caso, "sem efeitos produtivos")
   - `run-history.contract.test.ts` (1 caso, fixture `base` com `offer: {}` e `product` sem preço válido)
2. **Inconsistência real do snapshot (lab/bench)** — `snapshot.preserveImageContext` deriva de
   `backgroundDirection === "original"`, mas `snapshot.briefSnapshot.creativeContext.preserveImageContext`
   vem do mapper legado `buildCampaignBriefFromFlat`, que fixa `false` para `offer` e não considera a
   direção. Resultado divergente para `original`.
3. **3 timeouts de 5s** — `defaultAiModelResolver` (resolução de catálogo/seleção no Supabase) vaza para
   o teste: `fallbackToImageApi` em `providers/openai.ts` (linha 202) e `generateImage` em
   `services/image-generation-service.ts` (linhas 158–165) consultam o resolver real. Em
   `visual-signature/ai-image-generator.test.ts` o `defaultAiGateway` real é usado no `invoke`.
4. **Teste legal** — `legal-document-versions.test.ts` lê a change ativa da F50, já arquivada
   (`openspec/changes/.../fase-50-...`), em vez do archive.

## Recortes de execução (commits separados, caminhos explícitos)

### Recorte 1 — Fixtures do laboratório (13 falhas de direção)
- Adicionar `backgroundDirection` explícita e adequada ao cenário em cada fixture/caso.
- `run-history`: fornecer intenção/preço/direção válidos no `base`, **mantendo** o teste de isolamento
  de paths (`invalid_bench_reference_path`) e usando direção sem a restrição de referência única.
- **Preservar as asserções originais**; nenhum schema relaxado, default silencioso ou cobertura removida.

### Recorte 2 — Consistência do snapshot do laboratório
- Em `buildBenchCampaignSnapshot`, derivar `snapshot.preserveImageContext` **e**
  `briefSnapshot.creativeContext.preserveImageContext` exclusivamente de `offer.backgroundDirection`.
- **Não** alterar o mapper legado `src/lib/campaign/brief.ts`.
- Testar Original/Estúdio/Ambientado nas intenções aplicáveis em `campaign-snapshot.test.ts`
  (a asserção de paridade existente em `form-parity.contract.test.ts:198-199, 213` permanece).

### Recorte 3 — Timeouts de provider/resolver
- `ai-image-generator.test.ts`: injetar `invoker` fake determinístico (seam já existente no construtor).
- `openai-provider.test.ts` e `image-generation-service.test.ts`: mockar `defaultAiModelResolver` de
  forma determinística (`vi.mock('@/lib/ai', importOriginal)`), preservando `AiGateway`, `ModelRegistry`
  e `AiInvocationError` reais e as verificações de tentativa, fallback, envelopes e modelo efetivo.
- Sem aumentar timeout, sem retries, sem conexão real.

### Recorte 4 — Teste legal
- Apontar para `openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/`.
- Preservar as verificações de não publicação e separação dos gates legais.

## Validação

- Testes afetados por recorte; guardas relevantes (`campaign-brief`/`brief-mapper`, `form-parity`,
  `campaign-snapshot`); suíte completa; `typecheck`; `lint`; `build`.
- `build` **não** roda simultaneamente ao `dev` na mesma `.next`.
- Suítes reais dependentes do runner isolado não são executadas sem autorização (distinguir ausência
  de ambiente de falha de implementação).

## Limites e proibidos

- Sem banco/migrations/reset/`db push`; sem provider pago; sem instalação de dependências; sem ativação;
  sem deploy; sem push; sem lifecycle OpenSpec; sem início da b2.
- Preservar as alterações ambientais de `.opencode/**`.
- Se surgirem outras falhas, investigar/classificar e **parar** antes de ampliar o escopo.
- Se uma guarda congelada for afetada, parar e apresentar a divergência (não afrouxar).
