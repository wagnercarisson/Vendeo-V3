---
phase: 261120-qvp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ai/types.ts
  - src/lib/campaign/vertical-expansion/types.ts
  - src/lib/campaign/vertical-expansion/policy.ts
  - src/lib/campaign/vertical-expansion/telemetry.ts
  - src/lib/campaign/vertical-expansion/expand.ts
  - src/lib/campaign/vertical-expansion/__tests__/expand.core.contract.test.ts
  - src/lib/campaign/vertical-expansion/__tests__/telemetry.contract.test.ts
  - src/lib/campaign/vertical-expansion/__tests__/policy.contract.test.ts
  - src/lib/campaign/vertical-expansion/__tests__/types.contract.test.ts
  - src/lib/product-9-16-two-stage/orchestration/economic-snapshot-reader.ts
  - src/lib/product-9-16-two-stage/orchestration/expansion-step.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/expansion-step.contract.test.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/fixtures.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/offline-harness.ts
  - src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/journey.offline.test.ts
  - src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts
  - src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts
autonomous: true
requirements:
  - campaign-vertical-ai-expansion/snapshot-economico-congelado-na-telemetria-da-expansao
  - campaign-vertical-ai-expansion/cobertura-unica-da-expansao-individual-e-conjunta
  - product-9-16-two-stage-orchestration/step-de-expansao-preserva-o-snapshot-economico-duravel
must_haves:
  truths:
    - "A telemetria da expansão registra usdBrlRateAtGeneration e creditValueBrlAtGeneration do snapshot congelado nos DOIS contextos (principal e por envelope no flush), nunca null por omissão quando o snapshot existe."
    - "Fluxo 9:16 individual e fluxo conjunto 1:1+9:16 propagam os mesmos valores pelo ponto único runExpansionStep, sem caminho divergente."
    - "Operação antiga/sem snapshot, resumeContext ausente/malformado, exceção, rejeição da dependência injetada ou timeout resultam em null explícito e a expansão prossegue (best-effort), sem consultar parâmetro vigente."
    - "A leitura ocorre UMA vez por runExpansionStep, depois do preflight e antes do recheck final de cancelamento/prazo, inclusive no caminho de artefato reutilizado (que pula apenas o preflight); o recheck continua sendo a última verificação antes do acquire e nenhuma nova consulta acontece entre eles."
    - "A consulta restringe-se a campaigns.id = campaignId E campaigns.store_id = storeId."
    - "Continuação/retry mantém os valores originais do snapshot mesmo quando os parâmetros econômicos vigentes mudam entre etapas."
    - "A telemetria nunca consome tentativa nem altera o desfecho: exatamente um acquire no sucesso, zero acquire quando o recheck suspende, e nenhuma chamada extra ao provider."
    - "A base quadrada continua recebendo os valores pela reconstrução durável sem nenhuma alteração em runBaseStep."
  artifacts:
    - path: "src/lib/ai/types.ts"
      provides: "AiTelemetryContext com snapshot econômico opcional tipado (number | null)"
      contains: "usdBrlRateAtGeneration?: number | null"
    - path: "src/lib/product-9-16-two-stage/orchestration/economic-snapshot-reader.ts"
      provides: "Leitor best-effort do snapshot econômico durável (campanha+loja) com limite de espera injetável"
      exports: ["readExpansionEconomicSnapshot", "withEconomicReadBudget", "ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS"]
      min_lines: 45
    - path: "src/lib/campaign/vertical-expansion/types.ts"
      provides: "ExpandVerticalInput com campos econômicos opcionais"
      contains: "usdBrlRateAtGeneration"
    - path: "src/lib/campaign/vertical-expansion/policy.ts"
      provides: "Normalização de entrada econômica (finito ou null, sem novo motivo de recusa)"
      contains: "creditValueBrlAtGeneration"
    - path: "src/lib/campaign/vertical-expansion/telemetry.ts"
      provides: "ExpansionTelemetryInput com campos obrigatórios e repasse aos dois createDefaultTelemetryContext"
      contains: "usdBrlRateAtGeneration: input.usdBrlRateAtGeneration"
    - path: "src/lib/campaign/vertical-expansion/expand.ts"
      provides: "Encaminhamento dos valores validados à telemetria da expansão"
      contains: "usdBrlRateAtGeneration"
    - path: "src/lib/product-9-16-two-stage/orchestration/expansion-step.ts"
      provides: "Leitura única do snapshot econômico antes do recheck final e encaminhamento a deps.expand"
      contains: "readEconomicSnapshot"
  key_links:
    - from: "src/lib/product-9-16-two-stage/orchestration/expansion-step.ts"
      to: "src/lib/product-9-16-two-stage/orchestration/economic-snapshot-reader.ts"
      via: "deps.readEconomicSnapshot com default readExpansionEconomicSnapshot"
      pattern: "readEconomicSnapshot"
    - from: "src/lib/product-9-16-two-stage/orchestration/expansion-step.ts"
      to: "deps.expand"
      via: "input econômico opcional encaminhado após a leitura"
      pattern: "usdBrlRateAtGeneration"
    - from: "src/lib/campaign/vertical-expansion/expand.ts"
      to: "src/lib/campaign/vertical-expansion/telemetry.ts"
      via: "createExpansionTelemetry recebendo os dois valores validados"
      pattern: "createExpansionTelemetry"
    - from: "src/lib/campaign/vertical-expansion/telemetry.ts"
      to: "@/lib/ai/telemetry-sink createDefaultTelemetryContext"
      via: "dois pontos de criação (sink de buffering e contexto por envelope)"
      pattern: "usdBrlRateAtGeneration"
    - from: "src/lib/product-9-16-two-stage/orchestration/economic-snapshot-reader.ts"
      to: "campaigns.input_snapshot.resumeContext.economicSnapshot"
      via: "query restrita por id e store_id + parseResumeContext"
      pattern: "eq\\(\"store_id\""
---

<objective>
Corrigir a perda de informação econômica histórica na telemetria da expansão 9:16: propagar `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` congelados no run até os DOIS contextos de telemetria criados pela expansão (principal e por envelope no flush), lendo o snapshot durável uma única vez no ponto compartilhado `runExpansionStep` (fluxo individual 9:16 e conjunto 1:1+9:16), com espera limitada, best-effort e `null` explícito.

Fonte da verdade: `openspec/changes/fix-snapshot-economico-telemetria-expansao-9-16/` (proposal, design D1–D5, specs `campaign-vertical-ai-expansion` e `product-9-16-two-stage-orchestration`, tasks.md). Este plano NÃO redesenha nenhuma decisão do OpenSpec.

Purpose: hoje o sink persiste `null` nesses campos para toda chamada da expansão (`telemetry-sink.ts:156-157`) e a apuração BRL cai no "parâmetro atual (fallback)" — perda real de histórico, não apenas teste desatualizado. O gate global `telemetry-coverage` aponta exatamente `src/lib/campaign/vertical-expansion/telemetry.ts` (1 falha / 3 passes) e deve voltar a 4/4.

Output: contrato do módulo estendido, telemetria com dois contextos preenchidos, leitor durável best-effort, step compartilhado com leitura única antes do recheck final, provas de fluxo individual/conjunto/continuação/retry, confirmação da base sem alterá-la, e gates dirigidos com evidência.

Escopo proibido nesta change (não negociável): cobrança, reservas, créditos, pricing, provider, entrega, migrations, backfill de eventos históricos, alteração de `runBaseStep`/`runSquareBase`, e qualquer consulta a câmbio/valor do crédito vigentes. Sem novos pacotes (nenhum `npm install`/`pip`/`cargo`).
</objective>

<authorized_deviation_correction>
**Desvio registrado (histórico preservado, sem reescrita):** na primeira execução, o guard
`expand.core.contract.test.ts` proibia a substring `"credit"` em `expand.ts`. Para não alterar um
arquivo fora do `files_modified`, o executor criou `frozenCreditValueField` em `telemetry.ts` e o
espalhou em `expand.ts`. O helper **contornou a busca textual** (usou “Credit” com maiúscula) e
**não foi uma correção da regra**. Não houve autorização retroativa; o workaround foi identificado
na revisão e agora é removido.

**Correção autorizada pelo usuário (escopo adicional):**
- `src/lib/campaign/vertical-expansion/__tests__/expand.core.contract.test.ts` entra no escopo.
- Remover `frozenCreditValueField` de `telemetry.ts` e seu import/uso em `expand.ts`.
- `expand.ts` encaminha diretamente `creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration`.
- O guard deve permitir **exclusivamente** o identificador completo `creditValueBrlAtGeneration`,
  com limites de palavra, aplicando a exceção **somente à cópia do código analisada** (string),
  sem alterar o código de produção para satisfazer o scanner.
- Manter a busca por operações financeiras com variações de caixa (ex.: `reserveCredit`,
  `refundCredit`, `credit_operation`, `campaign_credit_operations`, `CreditOperation`), inclusive
  `rpc(`, e todas as demais proibições existentes. Não remover genericamente a proteção de
  `"credit"` nem substituí-la por uma lista curta de funções conhecidas.
- Nenhum outro helper, alias, concatenação ou mudança de caixa pode contornar o guard.
</authorized_deviation_correction>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
Leituras obrigatórias antes de editar (não reler em loop; extrair e seguir):
- `openspec/changes/fix-snapshot-economico-telemetria-expansao-9-16/{proposal,design,tasks}.md`
- `openspec/changes/fix-snapshot-economico-telemetria-expansao-9-16/specs/campaign-vertical-ai-expansion/spec.md`
- `openspec/changes/fix-snapshot-economico-telemetria-expansao-9-16/specs/product-9-16-two-stage-orchestration/spec.md`
- `docs/fluxo-de-desenvolvimento.md` (OpenSpec é a fonte; gates locais ≠ produção)

Decisões travadas que as tarefas implementam (referenciar D-01..D-10 nas ações):
- D-01 leitura única por `runExpansionStep`, após preflight, antes do recheck final; recheck permanece a última verificação antes de `acquire`; nada entre recheck e acquire.
- D-02 limite padrão 2000 ms injetável; ausência/malformação/exceção/rejeição/timeout ⇒ `null` explícito; sem throw, sem bloqueio, sem tentativa consumida, sem provider, sem consulta ao parâmetro vigente.
- D-03 query restrita a `campaigns.id = campaignId` E `campaigns.store_id = storeId`.
- D-04 fonte congelada: `campaigns.input_snapshot.resumeContext.economicSnapshot` via `parseResumeContext`; continuação/retry preserva o original; linha antiga ⇒ `null`.
- D-05 ambos os contextos de telemetria recebem os dois valores.
- D-06 `ExpandVerticalInput` ganha campos opcionais; parser normaliza inválido/não finito para `null` e NÃO cria motivo novo de recusa.
- D-07 `ExpansionTelemetryInput` exige ambos (`number | null`), espelhando `square-base/telemetry.ts:146-148`.
- D-08 individual e conjunto cobertos pelo mesmo `runExpansionStep`.
- D-09 base quadrada NÃO é alterada; teste de confirmação com STOP se falhar.
- D-10 sem cobrança/reserva/crédito/pricing/provider/entrega/migration/backfill.

Interfaces e fatos do código (extraídos; usar diretamente, sem garimpar):

`src/lib/campaign/vertical-expansion/telemetry.ts` (estado atual):
- `ExpansionTelemetryInput` não tem os campos econômicos.
- Dois `createDefaultTelemetryContext({ operationRunId, operationRunType: "campaign_delivery", traceId, storeId, campaignId, attemptNumber, ... })`: um no callback do `BufferingAiTelemetrySink` (contexto por envelope, recebe `internalCost` e `onCostResolved`) e um para `telemetry` (com `sink: buffering`).
- `EXPANSION_TELEMETRY_FIELDS` é a allowlist de metadata — NÃO acrescentar os campos econômicos a ela (eles são do contexto, não de metadata).

`src/lib/ai/types.ts:237-254` (estado atual):
- `AiTelemetryContext` NÃO declara `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`, mas `createDefaultTelemetryContext` (tipado por `AiTelemetrySinkContext`, `telemetry-sink.ts:31-65`) já os recebe e o sink os persiste (`telemetry-sink.ts:156-157`) — os valores já existem em runtime. Sem a declaração, ler `handle.telemetry.*` ou o 3º argumento de `invokePrepared` exigiria cast/`any`. Correção (Task 1, aditiva e só de tipo): declarar os dois campos OPCIONAIS `number | null`. Nada de `AiTelemetrySink`/`AiCostEvent` muda.

`src/lib/campaign/vertical-expansion/policy.ts`:
- `ExpandVerticalParseResult` (`policy.ts:131-133`) hoje é `{ ok: true; input: ExpandVerticalInput }` — campos econômicos opcionais. A correção (Task 3) estreita o sucesso para `ExpandVerticalParsedInput`, com os dois campos NÃO opcionais (`number | null`), e o parser sempre emite o valor explícito (`null` quando ausente/inválido).
- `parseExpandVerticalInput(raw)` recusa 16 chaves proibidas (`EXPANSION_FORBIDDEN_KEYS`), valida `source`, `operationId`, `attempt`, `authorization`, `timeoutMs`; devolve `Object.freeze({ ok: true, input })`.
- Nenhum dos dois nomes econômicos está na lista proibida; não adicionar motivo novo a `ExpansionInvalidReason`.

`src/lib/campaign/vertical-expansion/expand.ts`:
- `parseExpandVerticalInput` → `const valid = parsed.input`; `createExpansionTelemetry({...})` em ~linha 460; campos lidos de `valid.*` e `deps.selection.*`.

`src/lib/product-9-16-two-stage/orchestration/expansion-step.ts` (ordem atual):
- gate `allowNewPaidStep` → `expansionStatus` → `preCallGate` → `retrieve` → `probe` → `preCallGate` (gate pós-leituras) → bloco `if (!reusableArtifact) { preflight }` → `const recheck = preCallGate(input, deps)` → `control.acquire` → `deps.expand(...)` → finish/reconcile.
- `reusableArtifact` (`expansion-step.ts:192-193`, `reused`/`adopted`) NÃO retorna cedo: pula apenas o preflight e segue para o recheck, o acquire e o expand. A leitura nova (inserida entre o bloco do preflight e o recheck) acontece UMA vez também nesse caminho.
- `ExpansionStepDeps` já tem `control`, `expand`, `preflightFrozenExpansion`, `retrieve?`, `probe?`, `clock`, `client?: unknown`, `reconcile?`.
- O `expand` de `ExpansionStepDeps` recebe um tipo inline com `source`, `operationId`, `attempt`, `authorization`, `timeoutMs`, `signal?`.

`src/lib/product-9-16-two-stage/orchestration/copy-recovery-runner.ts:34-63` (padrão de leitura a seguir, mas SEM limite e filtrando só por `id`):
- `client.from("campaigns").select("input_snapshot").eq("id", campaignId).maybeSingle()`; erro/ausência ⇒ nulls; `parseResumeContext(record.resumeContext)`; retorna `parsed.context.economicSnapshot`.

`src/lib/product-9-16-two-stage/orchestration/durable-input.ts:121-166`:
- `parseResumeContext` exige `briefing` (objeto), `briefingText` (string), `campaignIntent` (string), `backgroundDirection` (string), `inputFiles` (array de descritores) e `economicSnapshot` como OBJETO; campos econômicos viram `number` ou `null`. Fixtures de teste precisam desse formato completo ou o parser devolve `malformed`.

`src/lib/product-9-16-two-stage/orchestration/__tests__/fixtures.ts:68-78`:
- `durableClient(row)` só encadeia UM `.eq` (`select().eq().maybeSingle()`). Precisa aceitar `.eq().eq().maybeSingle()` sem quebrar chamadas de um único `.eq`.

`src/lib/campaign/square-base/telemetry.ts:146-148, 236-249, 293-306` (padrão D-07):
- `usdBrlRateAtGeneration: number | null` obrigatório; `creditValueBrlAtGeneration?: number | null` propagado quando definido (inclusive `null`).

`src/lib/product-9-16-two-stage/orchestration/base-step.ts:118-124` + `reconstruction.ts:251-257`:
- A base já encaminha `input.content.usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` ao `runSquareBase`; a reconstrução já os deriva de `context.economicSnapshot`. Por isso D-09 = não tocar na base.

`src/lib/ai/__tests__/telemetry-coverage.test.ts:128-145`:
- Falha quando um arquivo contém `createDefaultTelemetryContext(` sem `usdBrlRateAtGeneration`. Correção esperada: 4/4.

Harnesses offline (D-08) — ambos recebem o `telemetry` no invoker da expansão e ambos já semeiam `economicSnapshot` 5.1 / 1:
- `src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/offline-harness.ts` (`RESUME_CONTEXT.economicSnapshot`, `campaigns` semeado com `id`+`store_id`, builder com `.eq` encadeável, `counters`).
- `src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts` (mesmo formato, `counters`).
- `joint-journeys.integration.test.ts` e `journey.offline.test.ts` já afirmam contagens de provider; mudanças nos harnesses devem ser ADITIVAS (registrar valores recebidos), sem emitir envelope novo nem mudar `telemetryEmits`/`expansionProviderCalls`.

Comandos do projeto: testes `npx vitest run <path>`; gates `npm.cmd run typecheck`, `npm.cmd run lint`, `git diff --check`, `git status --porcelain --untracked-files=all`. Não executar `npm install`/`npm ci`.

Regressões de rota que consomem o caminho (`run-two-format-deps.ts:348` chama `runExpansionStep`): `src/app/api/campaign/generation-status/__tests__/route.two-stage.test.ts` e `src/app/api/campaign/[id]/continue/__tests__/route.test.ts` já existem; são regressões puras (devem passar sem alteração; o filtro de diretório `npx vitest run src/app/api/campaign` cobre ambos sem precisar escapar `[id]`).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Baseline + contratos RED (telemetria política/tipos) + gate de confirmação da base</name>
  <files>
    src/lib/ai/types.ts,
    src/lib/campaign/vertical-expansion/__tests__/telemetry.contract.test.ts,
    src/lib/campaign/vertical-expansion/__tests__/policy.contract.test.ts,
    src/lib/campaign/vertical-expansion/__tests__/types.contract.test.ts,
    src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts
  </files>
  <action>
    Registrar baseline primeiro: rodar `npx vitest run src/lib/ai/__tests__/telemetry-coverage.test.ts` no HEAD limpo e guardar a saída (esperado 1 falha/3 passes apontando `src/lib/campaign/vertical-expansion/telemetry.ts`; a falha deve ser a de snapshot econômico). Salvar a evidência para o SUMMARY; não corrigir nada neste passo.

    Capturar também o baseline de worktree ANTES de qualquer edição: salvar a saída literal de `git status --porcelain --untracked-files=all` (inclui os dois `.codex/.../__pycache__/*.pyc` preexistentes, a árvore `openspec/changes/fix-snapshot-economico-telemetria-expansao-9-16/` e este PLAN.md). O gate de escopo da Task 6 compara com esta lista e reprova apenas caminhos NOVOS fora do allowlist; não é permitido "limpar" os itens preexistentes.

    Em `src/lib/ai/types.ts` (aditivo, apenas tipo; D-07): declarar em `AiTelemetryContext` os campos OPCIONAIS `usdBrlRateAtGeneration?: number | null` e `creditValueBrlAtGeneration?: number | null`. Não alterar `AiTelemetrySink`, `AiCostEvent`, `AiTelemetrySinkContext` nem runtime: `createDefaultTelemetryContext` já carrega os valores, só faltava a declaração. Isto é pré-requisito para que os testes desta tarefa (e a instrumentação 5a) leiam `handle.telemetry.usdBrlRateAtGeneration`/`handle.telemetry.creditValueBrlAtGeneration` e o 3º argumento `telemetry: AiTelemetryContext` de `invokePrepared` SEM cast, SEM `any` e SEM `@ts-ignore`. Como a mudança é só de tipo, os testes de telemetria continuam RED por ausência de valores em runtime (`telemetry.ts` ainda não os repassa).

    Em `telemetry.contract.test.ts`, atualizar o helper `telemetryInput()` para incluir `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` (D-07: obrigatórios) com valores distintos e não triviais (ex.: 5,42 e 1,07). Adicionar casos que provem: (a) `handle.telemetry.usdBrlRateAtGeneration` e `handle.telemetry.creditValueBrlAtGeneration` carregam exatamente os valores; (b) após `emit` + `flush`, o evento capturado em `captured.events` (sink padrão criado por envelope) carrega os MESMOS dois valores — este é o segundo contexto (D-05); (b.1) os DOIS caminhos de custo afirmam os dois campos econômicos no evento persistido: caminho com custo reportado pelo provider (`providerReportedCostUsd`, `costSource: "provider_reported"`) e caminho derivado por uso (`costSource: "pricing_table"`), tomando como base os testes existentes em `telemetry.contract.test.ts:198-221` (preservar as asserções de `costSource`/`estimatedCostUsd` e acrescentar, em CADA um dos dois caminhos, `captured.events[0].usdBrlRateAtGeneration`/`.creditValueBrlAtGeneration` iguais a 5,42/1,07 — no campo de topo do evento, nunca em `metadata`); nenhum dos dois caminhos pode ficar sem asserção, para provar o cenário "independentemente de custo reportado pelo provider ou calculado por tokens"; (c) com ambos `null`, o evento persiste `null` explícito e NÃO herda valor do contexto principal nem zero; (d) os campos econômicos NÃO aparecem em `metadata` (allowlist `EXPANSION_TELEMETRY_FIELDS` intacta) e `assertNoSensitiveFields` continua válido. Não enfraquecer asserções existentes de custo/outcome.

    Em `policy.contract.test.ts`, adicionar casos do parser (D-06): número finito preservado (incluindo `0` explícito, que é valor válido e não ausência); `null` preservado; ausente ⇒ `null`; não finito (`NaN`, `Infinity`, `-Infinity`), string numérica, objeto e booleano ⇒ `null`; e em nenhum caso novo `ok: false` (o resultado continua `ok: true` com os demais campos inalterados). Manter as igualdades/recusas existentes intactas.

    Em `types.contract.test.ts`, cobrir o contrato de tipos com uma única verdade, sem opcionalidade na saída do parser: (i) `ExpandVerticalInput` aceita omitir os dois campos e aceita `number` e `null`; (ii) `ExpandVerticalParsedInput` (tipo estreito de sucesso) declara os dois campos NÃO opcionais como `number | null`; (iii) o braço `ok: true` de `ExpandVerticalParseResult` tipa `input` como `ExpandVerticalParsedInput`; (iv) em runtime, o objeto devolvido pelo parser tem as DUAS chaves sempre presentes (`hasOwnProperty`), com `number | null` — `null` explícito quando ausente/inválido, nunca `undefined`; (v) asserção estática de que cada campo é exatamente `number | null` (não `number | null | undefined`). Usar as verificações de tipo já usadas na suíte (sem `any`, sem `@ts-ignore`, sem cast que esconda campo).

    Em `base-step.contract.test.ts`, adicionar o teste de confirmação da base (D-09), ANTES de qualquer implementação: reconstruir conteúdo a partir de um `resumeContext` persistido com `economicSnapshot` (usar `durableReconstruction()`/`durableRow()` de `__tests__/fixtures.ts`, cujos valores são 5,1 e 1, ou um `resumeContext` completo no formato de `parseResumeContext`), alterar um estado simulado de "parâmetros vigentes" entre a captura e a execução (variáveis locais do teste; nenhuma dependência de produção), executar `runBaseStep` com `vi.fn()` injetado na costura REAL `deps.base` (`BaseStepDeps.base: (input: SquareBaseInput, deps?: SquareBaseDeps) => Promise<SquareBaseResult>`, `base-step.ts:43-52`, chamada em `base-step.ts:237`) e inspecionar o primeiro argumento `SquareBaseInput` recebido: afirmar que `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` valem 5,1 e 1 — nunca os valores vigentes simulados — e que `@/lib/economic/economic-parameter-service` não é consultado (mock com espia zerada). Não existe dependência chamada `runSquareBase` em `BaseStepDeps`: não inventar costura nem espionar símbolo inexistente. Se este teste falhar no HEAD atual: PARAR imediatamente, não alterar `runBaseStep`/`runSquareBase`/`reconstruction.ts`, e apresentar a evidência (saída do teste + trechos relevantes) antes de qualquer ampliação de escopo. Este gate é obrigatório e precede as demais tarefas.
  </action>
  <verify>
    <automated>npx vitest run src/lib/campaign/vertical-expansion/__tests__/telemetry.contract.test.ts src/lib/campaign/vertical-expansion/__tests__/policy.contract.test.ts src/lib/campaign/vertical-expansion/__tests__/types.contract.test.ts src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts</automated>
    Resultado esperado nesta etapa: `telemetry.contract`, `policy.contract` e `types.contract` falham por ausência dos campos/do tipo estreito (RED intencional; `types.contract` pode também falhar o typecheck até a Task 3) e `base-step.contract` passa. STOP apenas se `base-step.contract` falhar.
  </verify>
  <done>
    Baseline registrado (1 falha/3 passes, arquivo apontado). `AiTelemetryContext` declara os dois campos opcionais (`number | null`) sem alterar runtime. Os novos casos de `telemetry.contract` (incluindo os dois caminhos de custo, reportado e por tokens) e de `policy.contract` existem e falham por ausência dos campos (RED), com os testes antigos ainda verdes; `types.contract` expressa a saída do parser como `ExpandVerticalParsedInput` com os dois campos não opcionais e falha (RED) até a Task 3. O teste de confirmação da base PASSA usando a costura `deps.base` e inspecionando o `SquareBaseInput` recebido, sem nenhuma alteração nesses módulos de produção (`runBaseStep`, `runSquareBase`, `reconstruction.ts` intocados); a única edição de produção da tarefa é a declaração de tipo aditiva em `src/lib/ai/types.ts`. Se o teste da base não passar, a execução parou com evidência.
  </done>
</task>

<task type="auto">
  <name>Task 2: Contratos RED do leitor durável e do step compartilhado</name>
  <files>
    src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts,
    src/lib/product-9-16-two-stage/orchestration/__tests__/expansion-step.contract.test.ts,
    src/lib/product-9-16-two-stage/orchestration/__tests__/fixtures.ts
  </files>
  <action>
    Ajustar `__tests__/fixtures.ts` para que `durableClient` aceite encadeamento arbitrário de `.eq` (o builder devolve um objeto com `eq` e `maybeSingle`, reaplicando o filtro) mantendo compatibilidade com chamadas de um único `.eq` já usadas por reconstrução e demais suítes; sem mudar `durableRow`/`durableResumeContext` (5,1 e 1).

    Criar `__tests__/economic-snapshot.contract.test.ts` (novo; importará um módulo ainda inexistente — o erro de import é o RED aceitável desta tarefa) cobrindo o leitor de `economic-snapshot-reader.ts` e o wrapper de limite. Contrato único do wrapper, usado IGUAL na Task 2 e na Task 4: `withEconomicReadBudget(read: () => Promise<{ usdBrlRateAtGeneration: number | null; creditValueBrlAtGeneration: number | null }>, timeoutMs?: number)` recebe um THUNK (nunca a promise já iniciada, nunca o leitor cru com argumentos) e é o ÚNICO ponto que o invoca, exatamente uma vez; o thunk é quem captura as identidades, na forma `() => reader({ campaignId, storeId, client })`. Casos nomeados e explícitos: (1) linha válida com `resumeContext.economicSnapshot` completo ⇒ exatamente `{ usdBrlRateAtGeneration: 5.1, creditValueBrlAtGeneration: 1 }`; (2) ausência de linha (`maybeSingle` devolve `{ data: null, error: null }`) ⇒ ambos `null`; (3) `input_snapshot` nulo/não-objeto ⇒ ambos `null`; (4) `resumeContext` ausente ⇒ ambos `null`; (5) `resumeContext` malformado (sem `briefing`/`briefingText`/`inputFiles`, ou `economicSnapshot` não-objeto) ⇒ ambos `null`; (6) erro PostgREST (`{ data: null, error: {...} }`) ⇒ ambos `null`; (7) cliente que LANÇA (síncrono e rejeição assíncrona) ⇒ ambos `null`, sem propagar (D-02); (8) `economicSnapshot` com valores não finitos/strings ⇒ campo correspondente `null`, nunca zero nem valor inventado; (9) filtros da consulta: espiar o builder e afirmar que foram aplicados `id = campaignId` E `store_id = storeId` (dois `.eq`, nesta ordem de presença) e que a coluna selecionada é apenas `input_snapshot` (D-03); (10) consulta a outra loja/campanha não é feita: afirmar que nenhum `.eq` recebe valor diferente das identidades passadas; (11) nenhuma consulta a parâmetro vigente: `vi.mock("@/lib/economic/economic-parameter-service")` com espia e `expect(spy).not.toHaveBeenCalled()`, MAIS checagem estática do fonte do leitor (remover comentários e afirmar ausência de `EconomicParameterService` e de `@/lib/economic`), no estilo de `telemetry-coverage.test.ts`; (12) orçamento: `withEconomicReadBudget(() => leitorQueNuncaResolve(), 5)` — thunk que nunca resolve, `timeoutMs` curto (5–10 ms) ⇒ ambos `null` e a promise resolve; (13) leitor injetado que REJEITA ⇒ ambos `null`; (14) leitor injetado que devolve objeto inválido/parcial ⇒ normalização para `null` por campo; (15) `timeoutMs` inválido (`0`, negativo, `NaN`) cai no default e NUNCA em espera ilimitada (afirmar via default exportado `ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS === 2000`); (16) timers limpos: o teste não deixa handle aberto (usar fake timers ou timeout curto real; nada de espera de 2 s).

    Em `expansion-step.contract.test.ts`, adicionar (mantendo todos os casos atuais): (a) leitura única — `readEconomicSnapshot` chamado exatamente 1× por invocação que chega ao acquire; 0× em TODOS os retornos anteriores ao ponto de leitura: `allowNewPaidStep` falso, `expansionStatus` `done`, `expansionStatus` `in_progress`, `initialGate` (`signal` abortado e `deadline_exceeded`), falha de retrieve, `source_indeterminate`/fonte não-integral, falha de probe, gate pós-leituras (`preCallGate` depois de retrieve/probe) e preflight inválido (afirmar o spy do leitor zerado em cada um desses caminhos, inclusive nos de cancelamento/prazo); (a.1) caminho `reusableArtifact` (`probeResult.kind === "reused"` E também `"adopted"`) NÃO retorna cedo e NÃO pode ficar fora da leitura: afirmar leitura exatamente **1×**, `preflightFrozenExpansion` 0×, `acquire` 1×, `deps.expand` 1× e `finish` 1×, com o desfecho inalterado; a leitura acontece no mesmo ponto único, uma vez — nunca 0× nem 2× (o caminho pula só o preflight, não a leitura); (b) ordem contratual — log compartilhado de interações (`retrieve`, `probe`, `preflightFrozenExpansion`, `economy-read`, `acquire`, `expand`): afirmar índices crescentes e que `acquire` é a interação imediatamente seguinte a `economy-read` (nenhuma consulta entre recheck e acquire); (c) recheck final é o último — leitor avança um `now` mutável além de `deadlineAtMs`; resultado deve ser `processing` com `reason: "deadline_exceeded"`, `acquire` 0×, `expand` 0×, `finish` 0×, leitor 1× (D-01); (d) encaminhamento — `deps.expand` recebe `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` exatamente iguais aos lidos (5,1 e 1); (e) todas as degradações (ausência, malformação, exceção, rejeição da dependência injetada, timeout) ⇒ `deps.expand` recebe `null` e `null`, e o desfecho continua sendo `completed` com exatamente 1 `acquire` e 1 `finish` (`status: "completed"`) — telemetria não consome tentativa nem muda o resultado (D-02); (f) nenhuma consulta a parâmetro vigente no step (mesmo mock/espia zerada); (g) o step NÃO chama `deps.expand` antes de `acquire`.

    Rodar os dois arquivos e confirmar RED (falha por módulo/necessidade de dep nova, não por asserção mal escrita). Não implementar produção nesta tarefa.
  </action>
  <verify>
    <automated>npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts src/lib/product-9-16-two-stage/orchestration/__tests__/expansion-step.contract.test.ts</automated>
  </verify>
  <done>
    Os dois arquivos existem, compilam sintaticamente e falham apenas porque `economic-snapshot-reader.ts` e `deps.readEconomicSnapshot`/`economicSnapshotTimeoutMs` ainda não existem. Todos os casos nomeados (ausência, malformação, exceção, rejeição, timeout, filtros, ordem, recheck, leitura 0× nos retornos iniciais/antecipados inclusive `initialGate`, leitura 1× no caminho `reusableArtifact` com preflight 0×, sem parâmetro vigente, sem tentativa consumida) estão escritos e são observáveis, e o wrapper é exercitado pelo contrato de thunk `() => reader({ campaignId, storeId, client })` — o mesmo que a Task 4 usará.
  </done>
</task>

<task type="auto">
  <name>Task 3: Contrato do módulo de expansão e telemetria de dois contextos (GREEN)</name>
  <files>
    src/lib/campaign/vertical-expansion/types.ts,
    src/lib/campaign/vertical-expansion/policy.ts,
    src/lib/campaign/vertical-expansion/telemetry.ts,
    src/lib/campaign/vertical-expansion/expand.ts,
    src/lib/campaign/vertical-expansion/__tests__/expand.core.contract.test.ts
  </files>
  <action>
    Em `types.ts` (D-06), adicionar a `ExpandVerticalInput` dois campos opcionais documentados: `usdBrlRateAtGeneration?: number | null` e `creditValueBrlAtGeneration?: number | null`, com comentário explicando que são snapshot CONGELADO do run, usados apenas para apuração/telemetria, nunca para decidir gasto, e que `null` é ausência explícita. Exportar também o tipo estreito de sucesso `ExpandVerticalParsedInput = ExpandVerticalInput & { usdBrlRateAtGeneration: number | null; creditValueBrlAtGeneration: number | null }` — é o contrato que o parser devolve (campos SEMPRE presentes, nunca opcionais). Não alterar `ExpansionInvalidReason` nem `ExpansionCallEvidence`.

    Em `policy.ts` (D-06), tipar o braço de sucesso de `ExpandVerticalParseResult` como `{ readonly ok: true; readonly input: ExpandVerticalParsedInput }` (importando `ExpandVerticalParsedInput` de `./types`) e ler os dois campos de `raw` quando presentes (`hasOwn`) e normalizar: número finito (incluindo `0`) preservado; `null` preservado; qualquer outro valor (ausente, `undefined`, `NaN`, ±`Infinity`, string, booleano, objeto) ⇒ `null`. Emitir os dois campos SEMPRE como chaves explícitas do literal congelado (nada de spread condicional, nada de `undefined`, nada de `as`), sem criar motivo de recusa e sem tocar nas validações/ordem existentes; assim o próprio TypeScript prova a não-opcionalidade. Manter `Object.freeze`.

    Em `telemetry.ts` (D-05/D-07), tornar `usdBrlRateAtGeneration: number | null` e `creditValueBrlAtGeneration: number | null` obrigatórios em `ExpansionTelemetryInput` (espelhando `square-base/telemetry.ts`), e passar `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` aos DOIS `createDefaultTelemetryContext`: o do callback do `BufferingAiTelemetrySink` (contexto por envelope, junto de `internalCost`/`onCostResolved`) e o do handle `telemetry` (junto de `sink: buffering`). Não alterar a allowlist `EXPANSION_TELEMETRY_FIELDS`, o `decorateEnvelope`, o cálculo de custo, nem o comportamento de `flush()`.

    Em `expand.ts`, tipar `const valid: ExpandVerticalParsedInput = parsed.input` e encaminhar `valid.usdBrlRateAtGeneration` e `valid.creditValueBrlAtGeneration` DIRETAMENTE ao `createExpansionTelemetry` (D-07), na forma literal `creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration` — já são `number | null`, sem `?? null`, sem cast, sem `any`, sem helper/alias/concatenação. Remover o import e o uso de `frozenCreditValueField`; remover o helper exportado de `telemetry.ts`. Não mexer em seleção, catálogo, pricing, transporte, persistência ou evidência da chamada.

    Em `__tests__/expand.core.contract.test.ts` (correção autorizada do guard), reconciliar a fronteira sem enfraquecer a proteção financeira: manter TODAS as proibições existentes; remover apenas `"credit"` da lista de `toContain` e criar uma verificação case-insensitive (`/credit/i`, além de `rpc(`) sobre uma CÓPIA da fonte obtida por `withoutAuthorizedEconomicIdentifier(source)`. Essa cópia remove SOMENTE ocorrências do identificador completo `creditValueBrlAtGeneration` com limites de palavra (`\b`), então o encaminhamento direto é aceito; `reserveCredit`, `refundCredit`, `credit_operation`, `campaign_credit_operations`, `CreditOperation`, identificadores maiores contendo o nome autorizado e `rpc(` continuam recusados. A exceção não pode alterar o arquivo-fonte nem o código de produção. Adicionar testes do próprio guard cobrindo aceite do identificador exato, recusa das variações/maiores e manutenção de `rpc(` e demais proibições — sem reduzir asserções existentes.

    Rodar os contratos da Task 1, `expand.core.contract.test.ts` e a suíte inteira de `vertical-expansion` para garantir GREEN sem enfraquecer asserções; atualizar helpers de teste de `expand.*.contract.test.ts` apenas se a exigência nova quebrar a construção de input (nunca relaxar expectativas).
  </action>
  <verify>
    <automated>npx vitest run src/lib/campaign/vertical-expansion/__tests__/telemetry.contract.test.ts src/lib/campaign/vertical-expansion/__tests__/policy.contract.test.ts src/lib/campaign/vertical-expansion/__tests__/types.contract.test.ts src/lib/campaign/vertical-expansion/__tests__/expand.core.contract.test.ts src/lib/campaign/vertical-expansion</automated>
  </verify>
  <done>
    `telemetry.contract`, `policy.contract`, `types.contract` e `expand.core.contract` verdes; toda a suíte `src/lib/campaign/vertical-expansion` verde; `ExpandVerticalParsedInput` exportado e devolvido pelo parser com as duas chaves sempre presentes (`number | null`, não opcionais) e `expand.ts` consumindo `creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration` DIRETAMENTE, sem `?? null`, cast, `any`, helper, alias ou concatenação; `frozenCreditValueField` ausente de `telemetry.ts`; o guard aceita apenas o identificador exato e continua recusando operações financeiras (qualquer caixa), `rpc(` e as demais proibições; os dois `createDefaultTelemetryContext` recebem os valores; nenhuma alteração em pricing/custo/transporte/persistência; `ExpandVerticalInput` inalterado nos campos existentes.
  </done>
</task>

<task type="auto">
  <name>Task 4: Leitor durável best-effort + wiring único no runExpansionStep (GREEN)</name>
  <files>
    src/lib/product-9-16-two-stage/orchestration/economic-snapshot-reader.ts,
    src/lib/product-9-16-two-stage/orchestration/expansion-step.ts
  </files>
  <action>
    Criar `economic-snapshot-reader.ts` (server-only, no padrão de `copy-recovery-runner.ts`): exportar `EconomicSnapshotReaderInput` (`campaignId`, `storeId`, `client?`, `timeoutMs?`), o tipo de resultado `{ usdBrlRateAtGeneration: number | null; creditValueBrlAtGeneration: number | null }`, a constante `ECONOMIC_SNAPSHOT_READ_TIMEOUT_MS = 2000`, `readExpansionEconomicSnapshot` e `withEconomicReadBudget` (D-01/D-02/D-03/D-04). Detalhes obrigatórios:
    - Query: `client.from("campaigns").select("input_snapshot").eq("id", campaignId).eq("store_id", storeId).maybeSingle()` — as DUAS igualdades, nada além; cliente padrão `supabaseAdmin` quando `client` não for fornecido.
    - `error` ou `data` ausente ⇒ `{ null, null }`; `input_snapshot` não-objeto ⇒ `{ null, null }`; `parseResumeContext(snapshot.resumeContext)` com `ok: false` ⇒ `{ null, null }`; sucesso ⇒ `parsed.context.economicSnapshot` normalizado por campo (apenas número finito; senão `null`).
    - Nunca lançar: envolver consulta e parsing em `try/catch` (inclui rejeição e exceção síncrona do cliente injetado).
    - `withEconomicReadBudget(read: () => Promise<{ usdBrlRateAtGeneration: number | null; creditValueBrlAtGeneration: number | null }>, timeoutMs?: number)`: contrato idêntico ao exercitado na Task 2 — recebe um THUNK e o invoca exatamente uma vez (nunca recebe promise já iniciada nem o leitor cru com argumentos); corre contra um timer; rejeição, exceção, timer vencido e resultado inválido ⇒ `{ null, null }`; `clearTimeout` em `finally`; anexar tratamento de rejeição à promise resultante do thunk para não deixar `unhandledRejection`; `timeoutMs` ausente/não finito/≤ 0 ⇒ default 2000 (nunca ilimitado). Exportar os dois símbolos para teste.
    - Nenhum import de `@/lib/economic/**`, nenhum acesso a `EconomicParameterService`, nenhum cálculo/câmbio, nenhum cache.

    Em `expansion-step.ts` (D-01/D-02/D-08), adicionar a `ExpansionStepDeps`: `readEconomicSnapshot?: (input: { campaignId: string; storeId: string; client?: unknown }) => Promise<{ usdBrlRateAtGeneration: number | null; creditValueBrlAtGeneration: number | null }>` e `economicSnapshotTimeoutMs?: number`. Estender o tipo inline do `expand` de `ExpansionStepDeps` com os dois campos opcionais (`number | null`).

    Inserir a leitura em UM único ponto: imediatamente após o fechamento do bloco `if (!reusableArtifact) { ... preflight ... }` e imediatamente antes do `const recheck = preCallGate(input, deps)` já existente (nunca depois dele, nunca dentro do bloco do preflight). Chamar no máximo uma vez, via `withEconomicReadBudget(() => (deps.readEconomicSnapshot ?? readExpansionEconomicSnapshot)({ campaignId: input.campaignId, storeId: input.storeId, ...(deps.client === undefined ? {} : { client: deps.client }) }), deps.economicSnapshotTimeoutMs)` — o thunk é criado aqui e só é invocado pelo wrapper, exatamente uma vez; não iniciar a promise antes nem chamar o leitor fora do wrapper. Guardar o resultado e encaminhá-lo ao objeto passado a `deps.expand` como `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration`. Não introduzir nenhuma outra consulta; não mover/duplicar o `recheck`; não alterar o DESFECHO/ORDEM do caminho `reusableArtifact` (ele continua pulando apenas o preflight e seguindo para recheck → acquire → expand → finish) nem suprimir a leitura nele: por estar fora do bloco condicional, o caminho reutilizado executa a leitura UMA vez, com 1 acquire/1 expand/1 finish; também não alterar os demais desfechos, o finish/reconcile, o gate de orçamento ou o `timeoutMs` da chamada.

    Rodar os contratos RED da Task 2 até GREEN, mais toda a suíte `product-9-16-two-stage`.
  </action>
  <verify>
    <automated>npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts src/lib/product-9-16-two-stage/orchestration/__tests__/expansion-step.contract.test.ts src/lib/product-9-16-two-stage</automated>
  </verify>
  <done>
    Leitor e step verdes: leitura 1× no ponto correto (inclusive no caminho `reusableArtifact`, que mantém 1 acquire/1 expand/1 finish e preflight 0×), filtros `id`+`store_id`, todas as degradações em `null`, ordem com `acquire` imediatamente após a leitura, recheck final preservado como última verificação, um `acquire`/um `finish` no sucesso, nenhum acesso a parâmetro vigente. `runExpansionStep` continua com a mesma assinatura pública de entrada.
  </done>
</task>

<task type="auto">
  <name>Task 5: Fluxos individual e conjunto + continuação/retry com valores congelados</name>
  <files>
    src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/offline-harness.ts,
    src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/journey.offline.test.ts,
    src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts,
    src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts,
    src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts
  </files>
  <action>
    Executar em duas etapas internas, fechando 5a antes de 5b (mesma tarefa; sem nova tarefa e sem escopo novo).

    Etapa 5a — instrumentação aditiva dos harnesses (sem asserção nova de jornada):
    Nos dois harnesses offline, adicionar APENAS registro (aditivo) do contexto recebido pelo invoker da expansão: no `invokePrepared` (terceiro argumento `telemetry: AiTelemetryContext`), gravar `counters.expansionTelemetry = { usdBrlRateAtGeneration: telemetry.usdBrlRateAtGeneration, creditValueBrlAtGeneration: telemetry.creditValueBrlAtGeneration }` (ou equivalente nomeado) e manter contadores existentes intactos. A leitura é type-safe (campos já declarados em `AiTelemetryContext` pela Task 1): registrar o valor como vier (`number | null | undefined`), SEM cast, `any` ou `@ts-ignore`; NÃO normalizar no harness — a prova de `5,1`/`1` é asserção de 5b. Não emitir envelope novo, não alterar `telemetryEmits`, `expansionProviderCalls`, `baseProviderCalls` nem ordem de eventos; não mexer em produção. Fechar 5a rodando as duas suítes de jornada e confirmando verdes com as MESMAS contagens/ordem já existentes; se algo quebrar, corrigir só o registro aditivo — nunca ajustar expectativas existentes.

    Etapa 5b — asserções de jornada (individual, conjunto, continuação/retry):
    Em `journey.offline.test.ts` (fluxo individual, semente real de `campaigns.input_snapshot.resumeContext.economicSnapshot` = 5,1/1), adicionar ao teste de percurso completo a asserção de que a expansão recebeu 5,1 e 1 — provando que o leitor default (sem injeção) leu o snapshot durável da campanha+loja após o preflight. Manter as asserções atuais (incluindo `telemetryEmits === 1`).

    Em `joint-journeys.integration.test.ts` (fluxo conjunto 1:1+9:16), adicionar em uma jornada de sucesso a mesma asserção (5,1 e 1), provando comportamento idêntico ao individual pelo mesmo `runExpansionStep` (D-08). Não alterar as jornadas existentes nem contagens de RPC/provider.

    Continuidade/retry (D-04): em `economic-snapshot.contract.test.ts`, adicionar um teste que executa `runExpansionStep` DUAS vezes (duas tentativas/continuação) com um leitor cuja fonte é um `resumeContext` congelado e uma variável separada de "parâmetros vigentes simulados"; entre as execuções, alterar apenas os parâmetros vigentes (ex.: 6,9 / 2,3) e afirmar que as DUAS chamadas a `deps.expand` receberam 5,1 e 1 (nunca os vigentes alterados), com 1 leitura por execução e nenhum acesso ao serviço de parâmetros vigentes. Adicionar também o caso de operação antiga: linha sem `resumeContext`/`economicSnapshot` ⇒ `null`/`null` nas duas execuções, com desfecho `completed` e sem bloqueio.
  </action>
  <verify>
    <automated>npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/journey.offline.test.ts src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts</automated>
    Fechamento de 5a (antes de adicionar asserções de 5b): `npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/journey.offline.test.ts src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts` verde com as contagens atuais.
  </verify>
  <done>
    5a concluído com as duas suítes de jornada verdes e contagens/ordem inalteradas (registro puramente aditivo). 5b: o fluxo individual e o conjunto provam 5,1/1 na expansão sem caminho divergente; continuação/retry mantém os valores originais mesmo com parâmetros vigentes alterados; operação antiga resulta em `null` explícito sem bloquear; nenhuma contagem de provider/telemetria dos harnesses mudou.
  </done>
</task>

<task type="auto">
  <name>Task 6: Gates dirigidos, escopo e evidência</name>
  <files>
    .planning/quick/261120-qvp-corrigir-snapshot-economico-na-telemetri/261120-qvp-SUMMARY.md
  </files>
  <action>
    Rodar os gates em sequência e registrar cada saída (comando + resultado) no SUMMARY: (1) `npx vitest run src/lib/ai/__tests__/telemetry-coverage.test.ts` — exigir 4/4 passes, sem tolerância para a falha antiga; (2) suítes dirigidas completas: `npx vitest run src/lib/campaign/vertical-expansion`, `npx vitest run src/lib/product-9-16-two-stage`, `npx vitest run src/lib/product-two-format`; (2.1) regressões de rota afetadas (superfície que consome `runTwoFormatGeneration` → `runExpansionStep`): `npx vitest run src/app/api/campaign` — inclui obrigatoriamente `src/app/api/campaign/generation-status/__tests__/route.two-stage.test.ts` e `src/app/api/campaign/[id]/continue/__tests__/route.test.ts`, que devem passar SEM alteração (regressão pura). Se alguma dessas duas falhar, PARAR e registrar a evidência; só é permitido tocar nelas com justificativa explícita, e nesse caso elas entram em `files_modified` e a alteração fica limitada a elas (nunca ao `route.ts`); (3) `npm.cmd run typecheck` (exit 0); (4) `npm.cmd run lint` (exit 0; registrar que o lint não cobre TS se continuar verdadeiro no ambiente); (5) `git diff --check` E inspeção de arquivos não rastreados com `git status --porcelain --untracked-files=all` (equivalente a complementar com `git ls-files --others --exclude-standard`); (6) conferência de escopo por delta contra o baseline capturado na Task 1: comparar a saída atual de `git status --porcelain --untracked-files=all` e de `git diff --name-only` com o baseline e reprovar apenas caminhos NOVOS. O allowlist explícito inclui: arquivos listados em `files_modified`; o SUMMARY desta quick (`.planning/quick/261120-qvp-.../261120-qvp-SUMMARY.md`); a árvore `openspec/changes/fix-snapshot-economico-telemetria-expansao-9-16/`; e os dois `.codex/skills/ui-ux-pro-max/scripts/__pycache__/*.pyc` preexistentes (nunca stagear nem editar). Nenhum arquivo novo em `supabase/migrations`, `src/lib/ai-cost`, `src/lib/product-1-1/credit-operation`, pricing, provider, entrega; em `src/app`, nada pode aparecer, exceto (e somente se justificado no passo 2.1) os dois arquivos de teste de rota citados — nenhum `route.ts` ou código de rota; nenhum evento histórico reescrito e nenhum backfill. Migration acidental/não autorizada deve ser visível e barrada mesmo que `??`.

    Confirmar por inspeção dirigida: `runBaseStep`/`runSquareBase`/`reconstruction.ts` sem diff; ausência de `EconomicParameterService`/`@/lib/economic` nos arquivos novos; `EXPANSION_TELEMETRY_FIELDS` inalterado; nenhuma migration criada; `src/lib/ai/types.ts` declara `usdBrlRateAtGeneration?` e `creditValueBrlAtGeneration?` em `AiTelemetryContext` (só tipo, sem mudança de runtime); `ExpandVerticalParseResult` (`ok: true`) tipa `input` como `ExpandVerticalParsedInput`, com os dois campos NÃO opcionais (`number | null`) e o parser emitindo-os sempre como chaves explícitas; nenhum `any`, `@ts-ignore` ou cast que esconda campo nos arquivos modificados; `rg -n "frozenCreditValueField" src` sem ocorrências; `expand.ts` contém exatamente `creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration` (encaminhamento direto) e nenhum outro helper/alias/concatenação; o guard em `expand.core.contract.test.ts` mantém todas as proibições e aplica a exceção só à cópia analisada com limites de palavra.

    No SUMMARY, declarar explicitamente: o que está provado localmente (testes offline, sem banco/Storage/provider), o que NÃO foi provado (suíte global completa não reexecutada; nenhum ambiente real) e que NÃO se declara a suíte global verde. Registrar o baseline da Task 1 e a decisão de escopo da base (D-09: intocada porque o teste de confirmação passou). Registrar pendências de publicação/ativação como gates separados, fora desta change.
  </action>
  <verify>
    <automated>npx vitest run src/lib/ai/__tests__/telemetry-coverage.test.ts src/lib/campaign/vertical-expansion src/lib/product-9-16-two-stage src/lib/product-two-format src/app/api/campaign; if ($LASTEXITCODE -ne 0) { exit 1 }; npm.cmd run typecheck; if ($LASTEXITCODE -ne 0) { exit 1 }; npm.cmd run lint; if ($LASTEXITCODE -ne 0) { exit 1 }; git diff --check; if ($LASTEXITCODE -ne 0) { exit 1 }; git status --porcelain --untracked-files=all</automated>
    Inspecionar a saída de `git status` (inclui não rastreados) junto de `git diff --name-only` e do baseline da Task 1: qualquer caminho NOVO fora do allowlist (arquivos de `files_modified`, SUMMARY da quick, árvore OpenSpec desta change, os dois `.pyc` preexistentes e os dois testes de rota somente se justificados) reprova o gate, mesmo que esteja `??` (não rastreado). Itens do baseline não contam como violação.
  </verify>
  <done>
    `telemetry-coverage` 4/4; três suítes dirigidas verdes; `src/app/api/campaign` verde com as duas regressões de rota (`generation-status/route.two-stage` e `[id]/continue/route`) sem alteração; typecheck 0; lint 0; `git diff --check` limpo; comparação com o baseline da Task 1 sem NENHUM caminho novo fora do allowlist (nem `??`); diff restrito ao escopo declarado, com `AiTelemetryContext` e `ExpandVerticalParsedInput` conferidos; SUMMARY com evidências, limites explícitos e nenhuma alegação de suíte global verde.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| banco (`campaigns`) → leitor do step | linha lida de tabela compartilhada; precisa ser escopada à identidade já validada |
| step → módulo de expansão | valores econômicos atravessam a fronteira de orquestração até a telemetria |
| telemetria → sink persistente | dados econômicos históricos gravados em evento auditável |
| teste → harness offline | fakes simulam banco/provider; não podem mascarar lacuna |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261120-01 | Information Disclosure | `economic-snapshot-reader.ts` query | mitigate | Filtrar simultaneamente `campaigns.id = campaignId` e `campaigns.store_id = storeId`, selecionar apenas `input_snapshot`, sem consulta por operação de terceiros; provado por teste de filtros (Task 2, caso 9/10) |
| T-261120-02 | Tampering | `policy.ts` normalização de entrada | mitigate | Aceitar apenas número finito ou `null`; qualquer outro tipo vira `null`; valores nunca decidem gasto (apenas telemetria) e não alteram `pricing`/cobrança; teste de normalização (Task 1/3) |
| T-261120-03 | Denial of Service | leitura extra antes da chamada paga | mitigate | `withEconomicReadBudget` com default 2000 ms injetável, `clearTimeout` em `finally`, best-effort sem throw; timeout ⇒ `null` e recheck final ainda suspende sem `acquire` (Task 2 caso 12, Task 4) |
| T-261120-04 | Repudiation | telemetria persistida | mitigate | `null` explícito para ausência/malformação/falha; proibido zero e proibido fallback ao parâmetro vigente; asserção de zero consultas a `EconomicParameterService` (behavioral + estática) |
| T-261120-05 | Elevation of Privilege | consulta a outras identidades | accept | A query já é escopada por campanha+loja validadas e não há parâmetro de identidade externo; risco residual baixo |
| T-261120-06 | Spoofing | dependência injetada `readEconomicSnapshot` | mitigate | Resultado normalizado por campo (apenas número finito) e rejeição convertida em `null`; teste de rejeição e de resultado inválido |
| T-261120-SC | Tampering | instalação de pacotes | accept | Nenhum pacote novo nesta change; proibido `npm install`/`npm ci`/`pip`/`cargo`. Nenhum checkpoint de legitimidade é necessário por não haver instalação |
</threat_model>

<verification>
Ordem de verificação (todas dirigidas, offline):
1. `npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/base-step.contract.test.ts` — gate de escopo da base (deve passar sem alterar produção; STOP se falhar).
2. `npx vitest run src/lib/campaign/vertical-expansion` — contrato do módulo + telemetria de dois contextos.
3. `npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/economic-snapshot.contract.test.ts src/lib/product-9-16-two-stage/orchestration/__tests__/expansion-step.contract.test.ts` — leitor e step (negativos, ordem, recheck).
4. `npx vitest run src/lib/product-9-16-two-stage/orchestration/__tests__/integrated/journey.offline.test.ts` — fluxo individual ponta a ponta offline.
5. `npx vitest run src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts` — fluxo conjunto 1:1+9:16.
6. `npx vitest run src/lib/product-9-16-two-stage` e `npx vitest run src/lib/product-two-format` — regressão dirigida completa.
6.1. `npx vitest run src/app/api/campaign` — regressões de rota afetadas, incluindo `generation-status/__tests__/route.two-stage.test.ts` e `[id]/continue/__tests__/route.test.ts` sem alteração.
7. `npx vitest run src/lib/ai/__tests__/telemetry-coverage.test.ts` — 4/4.
8. `npm.cmd run typecheck`, `npm.cmd run lint`, `git diff --check`, `git status --porcelain --untracked-files=all`.
9. `git diff --name-only` + lista de não rastreados do passo 8 restritos a `files_modified` (em `src/app`, somente os dois testes de rota se justificados); nenhuma migration, pricing, cobrança, reserva, provider, entrega ou backfill; `AiTelemetryContext` e `ExpandVerticalParsedInput` conferidos.

Não provado por esta change: suíte global completa (não reexecutada), qualquer ambiente real (PostgreSQL/PostgREST/Storage/provider), comportamento em produção e ativação. Nenhuma alegação de "suíte global verde".
</verification>

<success_criteria>
- `telemetry-coverage` volta a 4/4, sem tolerância.
- Os dois contextos da telemetria da expansão persistem `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration` do snapshot congelado quando ele existe, e `null` explícito quando não existe.
- Leitura única por `runExpansionStep`, após o preflight e antes do recheck final; recheck continua sendo a última verificação antes do `acquire`; evidência por ordem de interações e por suspensão de prazo. Caminho `reusableArtifact` executa a leitura exatamente 1× (preflight 0×, 1 `acquire`/1 `expand`/1 `finish`), sem retorno antecipado.
- `AiTelemetryContext` declara `usdBrlRateAtGeneration?`/`creditValueBrlAtGeneration?` (`number | null`, só tipo) e `ExpandVerticalParsedInput` garante os dois campos não opcionais na saída do parser, lidos sem cast/`any`/`@ts-ignore`.
- Regressões de rota `generation-status/route.two-stage` e `[id]/continue/route` verdes sem alteração.
- Consulta restrita a `campaigns.id` + `campaigns.store_id`; nenhuma consulta a parâmetro econômico vigente (prova comportamental e estática).
- Ausência, malformação, exceção, rejeição da dependência injetada e timeout ⇒ `null`, expansão prossegue, exatamente um `acquire`/`finish` no sucesso e zero `acquire` quando o recheck suspende.
- Fluxo individual e conjunto provam os mesmos valores congelados; continuação/retry preserva os originais com parâmetros vigentes alterados.
- `runBaseStep`/`runSquareBase`/`reconstruction.ts` sem alteração, com teste de confirmação verde.
- `frozenCreditValueField` ausente; `expand.ts` encaminha `creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration` diretamente; guard aceita só o identificador exato e continua recusando operações financeiras (qualquer caixa), `rpc(` e as demais proibições.
- Typecheck 0, lint 0, `git diff --check` limpo, `git status --porcelain --untracked-files=all` comparado ao baseline da Task 1 sem caminho NOVO fora do allowlist (inclusive não rastreados), diff restrito ao escopo, nenhuma migration/backfill/cobrança/pricing/provider/entrega.
- SUMMARY registra baseline, evidências, decisão de escopo da base e limites explícitos (nenhuma alegação de suíte global verde).
</success_criteria>

<output>
Create `.planning/quick/261120-qvp-corrigir-snapshot-economico-na-telemetri/261120-qvp-SUMMARY.md` when done.
</output>
