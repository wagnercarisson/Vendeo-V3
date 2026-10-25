---
status: complete
date: 2026-10-25
quick_id: 261025-k8e
slug: consumir-modelo-e-qualidade-da-assinatur
branch: feature/fase-47-1-modelos-assinatura-visual
phase: quick
type: execute
tasks_completed: 4/4
db_touched: false
provider_touched: false
env_touched: false
migrations_touched: false
---

# Quick 261025-k8e — Consumir modelo e qualidade da Assinatura Visual

## One-liner

O runtime da Assinatura Visual passa a **consumir** o par `image_model` + `image_quality` (e o `orchestrator_model`) gravado em `visual_signature_model_config`, resolvendo a configuração **uma única vez por operação**, com falha explícita (server action / HTTP 503 sem débito) e legado byte-a-byte quando não existe linha.

## Files changed

### Created

- `src/lib/visual-signature/model-config.ts` — `import "server-only"`; listas fechadas de orquestrador/modelo/qualidade, `deriveVisualSignaturePreset` (tabela fechada, fonte única do preset), `VisualSignatureModelConfigError` (`code:detail`), `resolveVisualSignatureGenerationConfig` (1 leitura: `from('visual_signature_model_config').select(...).eq('scope','visual_signature').maybeSingle()`; sem cache/flags/publicação).
- `src/lib/visual-signature/__tests__/model-config.test.ts` — 18 testes (fake query builder; sem banco/rede).
- `src/lib/visual-signature/__tests__/generation-config-snapshot.test.ts` — 6 testes (resolução única + reuso do MESMO objeto em `generateVariations`/`generateAutomatic`, inclusive no retry).

### Modified

- `src/lib/ai/types.ts` — `AiInvocationRequest` ganhou apenas `orchestratorModel?` e `imageGenerationModel?` (JSDoc em português).
- `src/lib/ai/adapters/responses.ts` — `effectiveModel = request.orchestratorModel ?? target.model` usado em `params.model`, `result.model` e `usageMeta.responsesModel`; `model` na tool `image_generation` só via spread condicional quando `imageGenerationModel` existe.
- `src/lib/ai/gateway.ts` — envelope de **falha** usa `request.orchestratorModel ?? prepared.model`; sucesso continua `result.model`.
- `src/lib/visual-signature/types.ts` — `VisualSignatureMetadata` + 4 campos aditivos (`orchestrator_model`, `image_model`, `image_quality`, `visual_signature_config_version_id`).
- `src/lib/visual-signature/ai-image-generator.ts` — param opcional `generationConfig`; request com `quality` do config + `orchestratorModel`/`imageGenerationModel`; metadata grava configuração (ou `null`/`'auto'`); validator **não** recebe overrides.
- `src/lib/visual-signature/identity-art-director.ts` — 5º parâmetro opcional `generationConfig` repassado ao `AiImageGenerator.generate`.
- `src/lib/visual-signature/server-actions.ts` — `generateVariations` e `generateAutomatic` resolvem a config **uma vez** (após carregar a store / antes de arquivar e de `startRun`), reutilizam o mesmo objeto nas tentativas 1 e 2 e derivam `effectiveVisualSignatureModel` de `config.orchestratorModel` quando dedicado.
- `src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts` — resolve a config após os guards de substituição e **antes** de `OperationCostService`/saldo/`reserveCredit`; falha → 503 `visual_signature_model_config_unavailable` sem débito; snapshot único passado ao Art Director (5º arg) e ao retry.
- Testes: `src/lib/ai/__tests__/adapters.test.ts` (+3 casos), `src/lib/ai/__tests__/gateway.test.ts` (+2 casos), `src/lib/visual-signature/__tests__/ai-image-generator.test.ts` (+4 casos), `.../generate-without-logo/__tests__/generate-route.test.ts` (+4 casos + mock do módulo).

## Behavior — dedicated vs legacy

| Aspecto | Configuração dedicada válida | Sem linha (legado) |
|---|---|---|
| Resolução | `{source:'dedicated', config:{camelCase}}` | `{source:'legacy', config:null}` |
| `request.quality` | `config.imageQuality` (`low`/`medium`) | `"auto"` |
| `request.orchestratorModel` | `config.orchestratorModel` | ausente |
| `request.imageGenerationModel` / `tool.model` | `config.imageModel` / presente | ausente / ausente (payload exato antigo preservado) |
| `result.model` / falha do gateway | orquestrador pinado | `target.model` / `prepared.model` |
| Metadata | `orchestrator_model`, `image_model`, `image_quality`, `visual_signature_config_version_id` | `image_model: null`, `image_quality: "auto"`, `visual_signature_config_version_id: null` |
| Server actions | usa `config.orchestratorModel` como modelo diagnóstico | `defaultAiModelResolver.resolve("visual_signature_image")` (inalterado) |
| Validação (`visual_signature_validation`) | sem overrides | sem overrides |
| Falha de leitura/config inválida | server action `{success:false, error:"Configuração de modelos da assinatura visual indisponível. Tente novamente."}`; rota HTTP 503 sem `getCost`/`reserveCredit` | não se aplica |

## Validation (commands + results)

Executados na ordem do plano, todos offline (sem Docker, sem Supabase CLI, sem psql, sem provider, sem rede):

1. `npx vitest run src/lib/visual-signature/__tests__/model-config.test.ts` → **1 file / 18 tests passed**
2. `npx vitest run src/lib/ai/__tests__/adapters.test.ts src/lib/ai/__tests__/gateway.test.ts` → **2 files / 54 tests passed**
3. `npx vitest run src/lib/visual-signature/__tests__/ai-image-generator.test.ts` → **1 file / 5 tests passed**
4. `npx vitest run src/lib/visual-signature/__tests__/generation-config-snapshot.test.ts` → **1 file / 6 tests passed**
5. `npx vitest run src/app/api/store` → **19 files / 215 tests passed** (cobre `generate-route`, `credit-flow`, `generate-without-logo`)
6. `npm run typecheck` → **exit 0**
7. `npm run lint` (gate completo, `eslint .`) → **exit 0**
8. `git diff --check` → **limpo (exit 0)**

Extras (regressão correlata): `src/__tests__/actions/visual-signature-guards.test.ts`, `src/lib/ai/__tests__/effective-model-labels.test.ts`, `src/lib/ai/__tests__/telemetry-coverage.test.ts` → **3 files / 13 tests passed**.

Static checks:
- `git diff --name-only` não inclui `chat-completions.ts`, `images.ts`, `gemini.ts`, nenhum arquivo em `supabase/`, `openspec/` ou `.planning/`.
- `orchestratorModel|imageGenerationModel` aparecem em `responses.ts` (3 usos) e `gateway.ts` (1 uso no envelope de falha) apenas.
- `visual_signature_model_config` é lido só em `model-config.ts`; nenhum `.insert`/`.update`/`.rpc`.

## Explicitly not touched

Nenhum banco, migration, Docker, Supabase CLI, `psql`, provider pago, rede, flag ou variável de ambiente foi executado ou alterado. Nenhuma migration criada ou aplicada. Fora do escopo e intocados: card/formulário/endpoint admin, prompts, parsing/direção visual, perfil de marca, créditos (além da ordem config → custo → saldo → reserva), onboarding, Produto 1:1, campanhas, F50.4, política de retry.

## Deviations from plan

1. **Teste existente passou a esperar o 5º argumento** — em `generate-route.test.ts`, o caso pré-existente “rejection context is passed to service” usava `toHaveBeenCalledWith` com 4 argumentos; como a assinatura planejada ganhou o 5º parâmetro, o assert agora inclui `null` (legado). Nenhum assert foi afrouxado/removido; o valor esperado reflete exatamente o comportamento legado.
2. **Novos testes do `AiImageGenerator` não mockam `VisualSignatureValidator.prototype.validate`** — o plano pedia simultaneamente o mock do validator e a prova de isolamento por `capability === "visual_signature_validation"`; com `validate` mockado a chamada de validação nunca ocorre. Para satisfazer a truth “a validação não recebe os overrides”, os testes novos usam o validator real com imagem fake > 1KB e um invoker fake que responde `{"valid": true}`; o teste pré-existente de `attemptNumber` (que usa o mock) permanece intacto e verde.
3. **Mocks explícitos do novo módulo não foram necessários nos testes vizinhos** — `visual-signature/__tests__/{generate-without-logo,credit-flow}.test.ts` caem deterministicamente no fallback `{data:null,error:null}` (legado) e continuaram verdes; nenhum assert vizinho foi editado.

## Complemento pós-revisão — metadata do `generateAutomatic` (2026-10-25)

Revisão do Codex apontou que `generateAutomatic` descartava o metadata do gerador nas duas tentativas (atualizava apenas `status`/`updated_at`). Complemento restrito:

- `activateGeneratedSignature(storagePath, generatedMetadata)` lê o `metadata` existente da linha e faz o update com `{ ...existingMetadata, ...quatroCampos }` — sem sobrescrever metadata de outras etapas.
- Os quatro campos persistidos: `orchestrator_model`, `image_model`, `image_quality`, `visual_signature_config_version_id`.
- Aplicado no sucesso inicial (attempt 1) e no sucesso do retry (attempt 2), com o metadata da tentativa vencedora.
- Nenhum outro comportamento alterado.

Testes adicionados em `generation-config-snapshot.test.ts` inspecionando o payload de `update`: sucesso inicial e retry, ambos preservando `existing`/`artDirectorOutput` e gravando os quatro campos. Resultado: **8/8** no arquivo; regressão `src/lib/visual-signature` + `src/__tests__/actions` + `src/app/api/store` = **32 files / 344 tests passed**; typecheck e lint exit 0.

Commit do complemento: `12223a8a`.

## Notes for review

- Commit atômico desta quick: `f3dcfa8f` (15 arquivos de código/teste; nenhum arquivo em `.planning/`, `supabase/` ou `openspec/` incluído).
- O único ponto de leitura da configuração dedicada é `model-config.ts`, chamado uma vez por operação nos três entry points; a ausência de linha é `legacy` explícito (caminho legítimo) e qualquer inconsistência é `invalid` (fail-closed).
- `git status --porcelain` antes do commit: apenas os 15 arquivos de código/teste desta quick (12 modificados + 3 criados) e o diretório `.planning/quick/261025-k8e-...` (não commitado por este executor).
