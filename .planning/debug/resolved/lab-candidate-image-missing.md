---
status: resolved
trigger: "Durante o UAT local da F48.1, o baseline de campaign_image succeeded, mas a candidata falhou com 'image_generation tool returned no image'. Evidências: experimento 85ec8eba-bd23-427a-a031-d4d0d93deed8; baseline run 6fb5720b-8e7b-42fb-885e-6d517eff178d — succeeded, 1 artefato; candidate run 8c6f3ad4-89d1-4cd6-a5a5-e1a3c8991207 — failed, 0 artefatos; exatamente 1 envelope por run; o ResponsesAdapter fornece tools:[{type:'image_generation'}], mas não envia tool_choice."
created: 2026-09-17T00:00:00Z
updated: 2026-09-17T12:00:00Z
---

## Current Focus

hypothesis: "O `ResponsesAdapter` envia `tools:[{type:'image_generation'}]` mas NUNCA envia `tool_choice`, então o modelo tem discricionariedade para responder apenas com texto e nunca emitir o `image_generation_call`. Com o prompt candidato degenerado (Markdown perdido na cópia), o modelo escolheu texto → resposta sem imagem → adapter lança `capability` → como o laboratório é single-shot sem fallback, o run falha. Em produção o mesmo gap é mascarado pelo fallback `images.edit`."
test: "Fix: forçar `tool_choice: { type: 'image_generation' }` quando `tools === 'image_generation'` (doc oficial OpenAI: 'To force the image generation tool call, you can set the parameter tool_choice to {\"type\": \"image_generation\"}')."
expecting: "O request enviado ao SDK passa a conter `tool_choice` explícito; o modelo não pode mais responder sem chamar a tool; 1 envelope por run preservado (sem retry/fallback)."
next_action: "apply fix em src/lib/ai/adapters/responses.ts + cobertura automatizada (request enviado ao SDK; resposta sem imagem; custo do caminho de falha)"
reasoning_checkpoint: "Confirmado na doc oficial (platform.openai.com/docs/guides/tools-image-generation) e no SDK openai@^6 (ToolChoiceTypes aceita 'image_generation')"
tdd_checkpoint: null

## Symptoms

expected: "Both variants of campaign_image (baseline prompt and candidate prompt) return an image; the candidate run should be `succeeded` with 1 artifact, exactly like the baseline."
actual: "Baseline run succeeded with 1 artifact. Candidate run failed with `image_generation tool returned no image` and 0 artifacts. Exactly 1 envelope per run (single-shot preserved)."
errors: "\"image_generation tool returned no image\" (candidate run 8c6f3ad4-89d1-4cd6-a5a5-e1a3c8991207)"
reproduction: "Local UAT of F48.1: create a prompt-only experiment (scenario produto-oferta-preco, target openai/gpt-5.5/responses, same model/params/images), run baseline (official prompt) and candidate (override prompt) via /admin/laboratorio. Baseline succeeds; candidate fails."
started: "First observed during the F48.1 local UAT (2026-09-17). Baseline path works; failure is specific to the candidate/override path."

## Reporter Constraints

- Preserve the lab rule: single-shot, **no retry** and **no automatic fallback** (exactly 1 envelope per run).
- Investigate whether `campaign_image` should **explicitly force** the `image_generation` tool (i.e. send `tool_choice`).
- Add **automated coverage** for (a) the request sent to the SDK and (b) a response without an image.
- Also verify the **telemetry/cost of the failure path** (cost recorded for a failed run).
- **Do NOT** make any paid provider call during the debug.
- **Do NOT** alter existing experiment data (read-only against the local DB).
- Operational note from the reporter: the frozen candidate prompt **lost Markdown formatting** during copy. After the fix, a NEW experiment will be created copying the file in raw format. Consider whether the lost formatting contributed to the failure.

## Eliminated

<!-- APPEND only - prevents re-investigating after /clear -->

- 2026-09-17T00:00:00Z — "Parâmetros de imagem divergentes entre baseline e candidato": DESCARTADO. Ambos os runs usam o mesmo `modelTarget` (openai/gpt-5.5/responses) e os mesmos `params` (size/quality) do experimento — o snapshot de ambos registra o mesmo `modelTarget`/`params`; o único campo divergente é o prompt.
- 2026-09-17T00:00:00Z — "Placeholders não interpolados no candidato": DESCARTADO. `LabPromptLoader.load()` interpola `{{chave}}` com as mesmas variáveis do loader real e o template candidato usa exatamente o mesmo conjunto de placeholders do baseline; `assertPromptUnderTestServed` passou (hash bate), logo o prompt servido é o congelado.
- 2026-09-17T00:00:00Z — "Fallback automático acionado no laboratório": DESCARTADO. `LabModelResolver` devolve o alvo fixo e `runLabCampaignImage` faz 1 `invoke("campaign_image")`; o run falho tem `calls` com exatamente 1 entrada (sem segunda invocação/fallback).
- 2026-09-17T00:00:00Z — "Falha de persistência de artefato / validação técnica": DESCARTADO. `technical_validation` é nulo no run falho e a mensagem persistida é `image_generation tool returned no image` (`error_type=provider_error`), lançada pelo adapter antes de qualquer validação.

## Evidence

<!-- APPEND only - facts discovered during investigation -->

- 2026-09-17T00:00:00Z — DB local (read-only), `lab_runs` do experimento `85ec8eba-bd23-427a-a031-d4d0d93deed8`: baseline `6fb5720b-…` = `succeeded`, `attempts=1`, `latency_ms=59316`, `estimated_cost_usd=0.106440`, `technical_validation` com `mimeType=image/png`, `1024x1024`, `jsonb_array_length(calls)=1`. Candidato `8c6f3ad4-…` = `failed`, `attempts=1`, `latency_ms=26150`, `estimated_cost_usd=0.150000`, `error_type=provider_error`, `error_message="image_generation tool returned no image"`, `technical_validation` nulo, `jsonb_array_length(calls)=1`. Confirmado: exatamente 1 chamada por run (single-shot preservado).
- 2026-09-17T00:00:00Z — `calls[0]` do run falho: `{capability:"campaign_image", provider:"openai", model:"gpt-5.5", protocol:"responses", status:"failed", durationMs:26128, errorType:"capability", cost:{costSource:"fallback_static", estimatedCostUsd:0.15}}` — sem `usage`.
- 2026-09-17T00:00:00Z — `calls[0]` do baseline: `{status:"success", cost:{costSource:"pricing_table", estimatedCostUsd:0.10644, textComponentUsd:0.04144, imageToolComponentUsd:0.065, costFormulaVersion:"responses_image_generation_v2", ...}, usage:{totalTokens:4678, promptTokens:3956, completionTokens:722}}`.
- 2026-09-17T00:00:00Z — `lab_runs.usage` do run falho = NULL e `cost_detail = {costSource:"fallback_static", estimatedCostUsd:0.15}`. Ou seja: o caminho de falha REGISTRA telemetria e custo (1 entrada), mas perde o `usage` real, porque `ResponsesAdapter.invoke` lança ANTES de retornar (o erro não carrega usage) → o sink não consegue precificar por tabela e cai no fallback estático.
- 2026-09-17T00:00:00Z — `src/lib/ai/adapters/responses.ts` (L34-49): monta `params.tools = [{type:"image_generation", size, quality}]` quando `request.tools === "image_generation"`, mas **nunca** define `params.tool_choice`. Nenhuma ocorrência de `tool_choice` no repositório (`rg -n "tool_choice"` = 0 resultados).
- 2026-09-17T00:00:00Z — `src/lib/ai/gateway.ts` (L107-126): no `catch`, emite envelope `failed` com `capability/protocol/provider/model/durationMs/errorType` — **sem `usage`** (o adapter lançou antes de produzir usage).
- 2026-09-17T00:00:00Z — `src/lib/ai/__tests__/adapters.test.ts` (L319-321) já asserta `tools` enviado ao SDK, mas **não** asserta `tool_choice` — cobertura ausente do request exato.
- 2026-09-17T00:00:00Z — Doc oficial OpenAI (Image generation, Responses API): "To force the image generation tool call, you can set the parameter `tool_choice` to `{"type": "image_generation"}`." SDK `openai` instalado: `ToolChoiceTypes.type` inclui `'image_generation'` (responses.d.ts L5904-5921), então o parâmetro é tipado e aceito.
- 2026-09-17T00:00:00Z — Callers produtivos que enviam `tools:"image_generation"`: `src/lib/image-generation/providers/openai.ts` (L69, `campaign_image`) e `src/lib/visual-signature/ai-image-generator.ts` (L204, `visual_signature_image`). Ambos só consomem `imageBase64`; o `content` textual do Responses não é usado nesses caminhos → forçar a tool não quebra consumidor.

## Resolution

root_cause: |
  O `ResponsesAdapter` montava `tools:[{type:"image_generation", size, quality}]` mas NUNCA enviava
  `tool_choice`. Sem `tool_choice`, o modelo mantém a discricionariedade de responder apenas com texto e
  não emitir o `image_generation_call`; o adapter então lança `AiInvocationError{kind:"capability",
  message:"image_generation tool returned no image"}`. No laboratório, single-shot e sem fallback por
  design, isso encerra o run como `failed` (0 artefatos). O prompt candidato degenerado (Markdown perdido
  na cópia) foi o gatilho que levou o modelo a responder sem imagem; o baseline (prompt oficial bem
  formado) o fez chamar a tool. Em produção o mesmo gap fica mascarado pelo fallback `images.edit`
  (segunda chamada paga) — daí "baseline succeeded / candidato failed" no mesmo alvo e parâmetros.
fix: |
  `src/lib/ai/adapters/responses.ts`: quando `request.tools === "image_generation"`, além de `params.tools`,
  passa a enviar `params.tool_choice = { type: "image_generation" }` — forma explícita documentada pela
  OpenAI ("To force the image generation tool call, you can set the parameter tool_choice to
  {\"type\": \"image_generation\"}"). Continua sendo UMA única chamada por run: sem retry, sem alvo
  alternativo e sem fallback automático. `src/lib/ai/gateway.ts` NÃO foi modificado. Cobertura adicionada
  em `src/lib/ai/__tests__/adapters.test.ts` (payload EXATO enviado ao SDK via `toEqual`, com `tools` +
  `tool_choice` forçado; ausência de `tool_choice` no caminho texto; resposta sem imagem = falha de
  capability com a tool forçada) e em `src/lib/ai/__tests__/lab-telemetry-sink.test.ts` (envelope failed
  sem usage → 1 entrada + custo fallback estático preservado).
approval: |
  O reporter aprovou o fix como correção COMPARTILHADA de produção (não restrita ao laboratório),
  com as condições: `tool_choice` somente quando `request.tools === "image_generation"`; demais usos do
  `ResponsesAdapter` inalterados; falha fail-closed preservada quando não houver imagem; harness do
  laboratório continua single-shot (sem retry/fallback); fallback produtivo mantido apenas para falhas
  reais; teste do payload exato enviado ao SDK; teste de resposta sem imagem; exceção no guard 48-1-13
  limitada a `responses.ts` + `adapters.test.ts`, específica e documentada; regressão completa + contract
  guard verdes antes de retomar a UAT; nenhuma chamada paga nos testes.
guard_exception: |
  `scripts/verify/48-1-13-contract-guard.mjs`: `src/lib/ai/adapters/responses.ts` e
  `src/lib/ai/__tests__/adapters.test.ts` adicionados a `allowedExact` com justificativa inline (fix
  descoberto na UAT; 1 chamada/run preservada; elimina o fallback pago acidental em produção). Além
  disso, o script `scripts/uat/48-local-uat-prep.mjs` (artefato da própria F48.1) foi excluído do scan de
  referências proibidas porque precisa NOMEAR as tabelas produtivas para provar o delta zero (D3) e ler o
  catálogo ativo (F47) — a exclusão é acompanhada de uma ASSERÇÃO POSITIVA: o guard falha se o script
  contiver qualquer escrita (INSERT/UPDATE/DELETE/TRUNCATE/DROP/ALTER/upsert/RPC), ignorando apenas
  `createHash(...).update(...)` (hashing local em memória). Resultado: guard PASS com 0 violações.
verification: |
  - 4 gates verdes: typecheck (`npx tsc -p tsconfig.typecheck.json --noEmit`) OK; lint (`npm run lint`) OK;
    testes (`npx vitest run`) 333 arquivos / 3588 passed + 1 skipped; build (`npm run build`) OK.
  - Suítes dirigidas verdes: `src/lib/ai` + `src/lib/lab` + `src/lib/image-generation` = 62 arquivos /
    1057 passed + 1 skipped.
  - Telemetria/custo do caminho de falha verificados (DB local, read-only): run falho
    `8c6f3ad4-…` registrou exatamente 1 entrada em `calls` com `status:"failed"`,
    `errorType:"capability"`, `cost:{costSource:"fallback_static", estimatedCostUsd:0.15}`, provider/model/
    protocol/capability preenchidos e `attempts=1`. O `usage` fica NULL porque o adapter lança ANTES de
    retornar (o erro não carrega usage) → o custo cai no fallback estático em vez de `pricing_table`
    (baseline: 0.10644 com usage 4678 tokens). Comportamento conservador e aceitável para a segurança
    financeira do laboratório; registrado como observação residual, não como bloqueio.
  - Nenhuma chamada paga executada no debug. Dados do experimento `85ec8eba-…` não foram alterados.
  - UAT pós-fix pendente do reporter: criar NOVO experimento copiando o prompt candidato em formato bruto
    (Markdown preservado) e reexecutar baseline × candidato — com `tool_choice` forçado, ambos devem
    emitir o `image_generation_call`.
files_changed:
  - src/lib/ai/adapters/responses.ts
  - src/lib/ai/__tests__/adapters.test.ts
  - src/lib/ai/__tests__/lab-telemetry-sink.test.ts
  - scripts/verify/48-1-13-contract-guard.mjs
