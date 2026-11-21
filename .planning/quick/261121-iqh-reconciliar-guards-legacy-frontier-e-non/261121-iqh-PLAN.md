---
phase: 261121-iqh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
  - src/lib/product-1-1/__tests__/non-activation.contract.test.ts
  - .planning/STATE.md
  - .planning/quick/261121-iqh-reconciliar-guards-legacy-frontier-e-non/261121-iqh-SUMMARY.md
autonomous: true
requirements:
  - product-1-1-non-activation/fronteira-legada-reconhecida-por-caminho-autorizacao-e-conteudo-imutavel
  - product-1-1-non-activation/importacoes-9-16-separadas-entre-tipo-e-runtime-por-importador
  - product-9-16-two-stage-orchestration/aceite-offline-de-codigo-nao-aprova-provider-ambiente-publicacao-ou-checkpoint
must_haves:
  truths:
    - "A suíte global deixa de ter as 5 falhas dos dois guards (2 de arquivo): `legacy-frontier.guard` 10/10 e `non-activation.contract` 57/57 verdes, sem alterar uma linha de produção."
    - "O guard legacy-frontier continua comparando o conjunto de caminhos alterados EXATAMENTE ao conjunto autorizado e o CONTEÚDO de cada caminho adicional ao commit imutável registrado; BASE_SHA permanece literal `335bfb70`."
    - "A rota generate-image continua exigindo preservação do fluxo legado: a ÚNICA remoção admitida é a linha de import de `@/lib/campaign/persistence` substituída pela mesma linha acrescida EXATAMENTE de `uploadCampaignInputFile`, com todos os símbolos anteriores preservados."
    - "O contrato de não-ativação passa a distinguir import TYPE-ONLY de import de RUNTIME por importador para os 7 módulos de `product-9-16-two-stage/orchestration`, sem ignorar type-only genericamente e sem excluir diretórios do scanner."
    - "Nenhum caminho é liberado em bloco, nenhum prefixo amplo é criado e qualquer importador novo, módulo adicional ou runtime financeiro não autorizado continua sendo violação."
    - "A matriz de reconciliação do SUMMARY registra, por caminho, alteração, evidência documental e commit imutável, e nomeia a causa raiz sem declarar aprovação de provider, ambiente, publicação ou checkpoint de laboratório."
  artifacts:
    - path: "src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts"
      provides: "Manifesto de fronteira legada com 106 entradas (autorização + commit imutável) e exceção estreita do import de persistência"
      contains: "AUTHORIZED_FRONTIER_CHANGES"
    - path: "src/lib/product-1-1/__tests__/non-activation.contract.test.ts"
      provides: "Mapa global de importações autorizadas + bloco dedicado type-only vs runtime dos 7 importadores 9:16"
      contains: "AUTHORIZED_PRODUCT_FLOW_IMPORTS"
    - path: ".planning/quick/261121-iqh-reconciliar-guards-legacy-frontier-e-non/261121-iqh-SUMMARY.md"
      provides: "Matriz de reconciliação (44 entradas + 7 importadores), causa raiz e resultados dos gates"
      min_lines: 80
  key_links:
    - from: "src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts"
      to: "git show <commit>:<path>"
      via: "contentMismatches compara conteúdo atual com o commit congelado de cada entrada"
      pattern: "git\\(\\[\"show\""
    - from: "src/lib/product-1-1/__tests__/non-activation.contract.test.ts"
      to: "src/lib/product-9-16-two-stage/orchestration/*.ts"
      via: "collectRuntimeSources + comparador real==autorizado por importador"
      pattern: "product-9-16-two-stage/orchestration"
---

<objective>
Reconciliar test-only os dois guards históricos que concentram as 5 falhas restantes da suíte global — `legacy-frontier.guard.test.ts` (4 falhas) e `non-activation.contract.test.ts` (1 falha) — reconhecendo, por caminho e por commit imutável, mudanças de fronteira JÁ AUTORIZADAS por fases e quicks anteriores, e separando explicitamente importação type-only de runtime nos 7 módulos de orquestração 9:16.

Purpose: os guards congelaram um mundo fechado quando o conjunto de arquivos era menor. Trabalho posterior já aprovado (F60.3-02, F60.4-03, F60.6-01/05, quicks 261107-hcx, 261107-qvo, 261116-vpx, 261120-qvp) tocou a fronteira sem registrar entradas, e 7 entradas congeladas ficaram atrás de conteúdo posteriormente aprovado. Nada disso é regressão de produção: é dívida de registro. O objetivo é fechar a dívida sem relaxar nenhuma barreira.

Output: um plano com 3 tarefas e 3 commits separados (guard legacy-frontier, contrato de não-ativação, tracking). Zero alteração de produção, rota, schema, migration, contrato OpenSpec ou dependência.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@./AGENTS.md
@docs/fluxo-de-desenvolvimento.md

Artefatos de origem das autorizações (evidência documental, já lidos no planejamento):

- `.planning/phases/60.5-f60-5-integracao-e-entrega-9-16-por-expansao/60.5-01-PLAN.md` — Task 1a declara `RunNineSixteenInput` com `campaignIntent`, `backgroundDirection`, `copyContext`, `referenceSelections` e `RunNineSixteenDeps.credit: Pick<ProductOneToOneCreditOperationClient, "beginPublication" | "getPublicationEpoch" | "markArtUploaded" | "deliver">`; Task 2 declara `resume-context.ts` "puro (sem `server-only`), importando apenas tipos"; Task 3c declara `delivery.ts` recebendo projeções injetadas. "Fronteira" do plano: nenhuma rota/página/flag/migration/banco/provider neste plano; os módulos de orquestração reutilizam a autoridade financeira e as projeções do Produto 1:1 por design.
- `.planning/phases/60.5-f60-5-integracao-e-entrega-9-16-por-expansao/60.5-02-PLAN.md` — declara `vertical-probe.ts` com `ArtifactProbe` e `delivery-deps.ts -> credit-operation-client` (`beginPublication`), `projectDeliveredCampaign` e `projectClosedCampaign`, além do runner de copy com `DefaultProductOneToOneCopyRunnerInput`.
- `.planning/phases/60.5-f60-5-integracao-e-entrega-9-16-por-expansao/60.5-02-SUMMARY.md` (seção "Limitacoes / fora do escopo") — declara explicitamente que "os modulos de orquestracao 9:16 reutilizam F60/F60.1 por design" e que `non-activation.contract` era vermelho preexistente.
- `.planning/phases/60.5-.../60.5-05-ACTIVATION-REPORT.md` — também registra `non-activation.contract` como falha preexistente.
- `.planning/quick/261116-vpx-.../261116-vpx-SUMMARY.md` — preflight de pricing antes da primeira chamada paga: leitura estrita ADITIVA (`readActiveCatalogRows`/`readModelPricing`), com `getActiveCatalogRows`/`getCatalogRows`/`getModelPricing` fail-open preservados.
- `.planning/quick/261120-qvp-.../261120-qvp-SUMMARY.md` — snapshot econômico na telemetria; `src/lib/ai/types.ts` recebeu apenas campos opcionais de tipo (`number | null`) e o aceite registra a autorização.
- `.planning/quick/261107-hcx-.../261107-hcx-PLAN.md` — bancada 9:16 e preset 2.6 experimental; preset registrado como `enabled: false` no Checkpoint A, `BENCH_MODEL_ALLOWLIST`/pricing cadastrados, `maxRetries: 0` somente na bancada.
- `.planning/quick/261107-qvo-.../261107-qvo-PLAN.md` — expansão de campanha pronta e formato 4:5 na bancada (módulos puros `expand-*`, políticas de formato, `bench-format`/`bench-pricing`/`config-registry`/`prompt-base`).

<interfaces>
Contratos que o executor consome sem explorar o repositório:

Guard legacy-frontier (estado atual, a preservar integralmente):

- `BASE_SHA = "335bfb70"` (literal) e `BASE_SHA_RECORD = .planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md`.
- `interface AuthorizedFrontierChange { readonly path: string; readonly authorization: string; readonly commit: string }`
- `AUTHORIZED_FRONTIER_CHANGES` — hoje com 69 entradas; `AUTHORIZED_ROUTE_FILE` e `AUTHORIZED_DOWNLOAD_ROUTE_FILE` são filtrados para fora de `ADDITIONAL_AUTHORIZED_FILES`.
- `LEGACY_FRONTIER_PATHS` — lista fixa (rota generate-image, rota download literal, `src/lib/ai/adapters/{images,registry}.ts`, `src/lib/ai/gateway.ts`, `src/lib/credit/credit-service.ts`, `src/lib/ai-cost/**`, `src/lib/lab/bench/**`, `src/lib/ai/**`, 4 exclusões de `image-generation-operations-repository`/reuse).
- Helpers: `git(args)`, `normalize(text)` (CRLF→LF), `legacyBlock`, `diffAgainstAuthorized(changed, authorized) -> { extra, missing }`, `contentMismatches(entries, readCurrent, readApproved)`.
- Testes atuais: 10 no total (6 positivos + 4 negativos). Asserções a preservar: BASE_SHA literal e ancestry; conjunto exato + `toHaveLength(AUTHORIZED_FRONTIER_CHANGES.length)`; conteúdo de cada caminho adicional igual ao commit; guard antes do `safeParse`/reserva; ausência de duplicação; rota de download por conteúdo; e os 4 negativos.

Contrato de não-ativação (estado atual, a preservar):

- `PRODUCT_MODULE_ROOTS = ["src/lib/product-1-1/", "src/components/product-1-1/"]`.
- `PRODUCT_FLOW_IMPORT_CAPTURE_RE` captura `from "..."` e `import("...")` cujo specifier contenha `product-1-1` ou `image-generation-operations-repository`.
- `interface AuthorizedImportRule { readonly prefixes: readonly string[]; readonly exact?: readonly string[] }`
- `AUTHORIZED_PRODUCT_FLOW_IMPORTS: Readonly<Record<string, AuthorizedImportRule>>` — autoridade global, hoje com importadores de rotas admin/campaign, páginas, formulários, `square-base`, `product-vertical-9-16`, `product-two-format` e `two-stage-financial-service`.
- `collectRuntimeSources(directory)`, `collectProductFlowImports(source)`, `isAuthorizedAdminAuthorizationImport(relativePath, specifier)`, `hasUnauthorizedProductFlowImport(relativePath, source)`; `SIDE_EFFECT_IMPORT_RE`.
- Testes: 57 no total; 1 falha atual é `nenhum runtime legado importa as estruturas do Produto 1:1` com exatamente 7 caminhos de `src/lib/product-9-16-two-stage/orchestration/`.

Pares reais importador→specifier (extraídos do fonte nesta sessão; tipo-only x runtime):

- `copy-recovery-runner.ts`: type-only `@/lib/product-1-1/copy/default-copy-runner`; runtime nenhum.
- `deadline-budget.ts`: runtime `@/lib/product-1-1/orchestration/deadline`; type-only nenhum.
- `delivery-deps.ts`: runtime `@/lib/product-1-1/credit-operation/credit-operation-client`, `@/lib/product-1-1/orchestration/project-delivered-campaign`, `@/lib/product-1-1/orchestration/project-closed-campaign`; type-only nenhum (o `type` inline dentro de um import de valor NÃO rebaixa a instrução para type-only).
- `delivery.ts`: type-only `@/lib/product-1-1/orchestration/project-delivered-campaign`, `@/lib/product-1-1/orchestration/project-closed-campaign`; runtime nenhum.
- `resume-context.ts`: type-only `@/lib/product-1-1/background-direction`, `@/lib/product-1-1/copy/default-copy-runner`, `@/lib/product-1-1/intent-selection`, `@/lib/product-1-1/policies/types`; runtime nenhum.
- `types.ts`: type-only `@/lib/product-1-1/background-direction`, `@/lib/product-1-1/copy/default-copy-runner`, `@/lib/product-1-1/intent-selection`, `@/lib/product-1-1/policies/types`, `@/lib/product-1-1/snapshot/persist-snapshot`, `@/lib/product-1-1/credit-operation/credit-operation-client`, e via `typeof import(...)` `@/lib/product-1-1/orchestration/project-delivered-campaign` e `@/lib/product-1-1/orchestration/project-closed-campaign`; runtime nenhum.
- `vertical-probe.ts`: type-only `@/lib/product-1-1/artifact/types`; runtime nenhum.
- Nenhum outro runtime do diretório importa `product-1-1` (somente `__tests__`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reconhecer no guard legacy-frontier as 37 mudanças já autorizadas e admitir apenas a transformação exata do import de persistência</name>
  <files>src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts</files>
  <action>
Ajuste exclusivamente este arquivo de teste. NÃO reformatar a rota, NÃO tocar produção, NÃO alterar `BASE_SHA`, `LEGACY_FRONTIER_PATHS`, `AUTHORIZED_DOWNLOAD_ROUTE_COMMIT` (`e3fb664e`), `diffAgainstAuthorized`, `contentMismatches`, `legacyBlock`, `normalize` nem qualquer teste negativo existente.

(1) Acrescentar 37 entradas novas a `AUTHORIZED_FRONTIER_CHANGES`, no fim do array, agrupadas por origem e com comentário de bloco por grupo (`// Reconciliação 2026-11-21 (quick 261121-iqh) — <origem>: <motivo>`). Cada entrada é `{ path, authorization, commit }` com exatamente estes pares (o commit é IMUTÁVEL; nunca usar HEAD, branch ou "conteúdo atual" como referência aprovada):

quick 261116-vpx — preflight de pricing (leitura estrita aditiva):
- `src/lib/ai/ai-model-catalog-service.ts` @ `f82a3ca3`
- `src/lib/ai/__tests__/ai-model-catalog-service.test.ts` @ `f82a3ca3`
- `src/lib/ai-cost/__tests__/ai-model-pricing.test.ts` @ `f82a3ca3`

F60.6-01 — configuração de modelo da expansão 9:16:
- `src/lib/ai/nine-sixteen-expansion-model-config.ts` @ `bc25feb4`
- `src/lib/ai/__tests__/nine-sixteen-expansion-model-config.contract.test.ts` @ `77a59733`
- `src/lib/ai/__tests__/nine-sixteen-expansion-model-config-migration.contract.test.ts` @ `096cb703`

F60.6-05 — serviço e view da configuração de modelo:
- `src/lib/ai/nine-sixteen-expansion-model-config-service.ts` @ `8cfef0f1`
- `src/lib/ai/__tests__/nine-sixteen-expansion-model-config-service.test.ts` @ `8cfef0f1`
- `src/lib/ai/nine-sixteen-expansion-model-config-view.ts` @ `4bc61965`
- `src/lib/ai/__tests__/nine-sixteen-expansion-model-config-view.test.ts` @ `4bc61965`

F60.3-02 — opções de expansão no adapter de imagens upstream:
- `src/lib/ai/__tests__/upstream-images-expansion-options.test.ts` @ `485736fb`

quick 261107-hcx — bancada 9:16 e preset 2.6 experimental (Checkpoint A; preset desabilitado):
- `src/lib/ai/adapters/bench-images.ts` @ `6d9ef070`
- `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` @ `6d9ef070`
- `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts` @ `6d9ef070`
- `src/lib/lab/bench/domain/bench-model-allowlist.ts` @ `6d9ef070`
- `src/lib/lab/bench/domain/policies/formato-9-16.ts` @ `6d9ef070`
- `src/lib/lab/bench/domain/schemas.ts` @ `6d9ef070`
- `src/lib/lab/bench/execution/bench-cost-resolver.ts` @ `6d9ef070`
- `src/lib/lab/bench/execution/bench-execution-service.ts` @ `6d9ef070`
- `src/lib/lab/bench/gateway/runtime.ts` @ `6d9ef070`
- `src/lib/lab/bench/domain/preset-registry.ts` @ `0ba82d30`
- `src/lib/lab/bench/__tests__/preset-registry.test.ts` @ `0ba82d30`

quick 261107-qvo — expansão de campanha pronta e formato 4:5 na bancada:
- `src/lib/lab/bench/__tests__/bench-format.test.ts` @ `575ce816`
- `src/lib/lab/bench/__tests__/bench-pricing.test.ts` @ `575ce816`
- `src/lib/lab/bench/__tests__/config-registry.test.ts` @ `575ce816`
- `src/lib/lab/bench/__tests__/expand-contract.test.ts` @ `575ce816`
- `src/lib/lab/bench/__tests__/expand-geometry.test.ts` @ `575ce816`
- `src/lib/lab/bench/domain/bench-format.ts` @ `575ce816`
- `src/lib/lab/bench/domain/bench-pricing.ts` @ `575ce816`
- `src/lib/lab/bench/domain/config-registry.ts` @ `575ce816`
- `src/lib/lab/bench/domain/expand-geometry.ts` @ `575ce816`
- `src/lib/lab/bench/domain/expand-prompt.ts` @ `575ce816`
- `src/lib/lab/bench/domain/expand-schema.ts` @ `575ce816`
- `src/lib/lab/bench/domain/policies/formato-4-5.ts` @ `575ce816`
- `src/lib/lab/bench/domain/policies/registry.ts` @ `575ce816`
- `src/lib/lab/bench/domain/prompt-base.ts` @ `575ce816`
- `src/lib/lab/bench/persistence/bench-run-service.ts` @ `7e297770`

Texto de `authorization` por entrada: nome da origem + motivo curto em português, no mesmo estilo das entradas vizinhas (por exemplo "F60.6-05 (servico e view da configuracao de modelo da expansao 9:16)"; "quick 261107-qvo (expansao pronta e formato 4:5 na bancada — laboratorio)"). Para as entradas de laboratório, incluir explicitamente que o reconhecimento é de código offline e não aprova provider/ambiente/publicação.

(2) Atualizar o `commit` de 7 entradas JÁ EXISTENTES, mantendo o `path` e ampliando o texto de autorização para citar a origem que avançou o conteúdo:
- `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts`: `b7ab7b1b` -> `575ce816` (quick 261107-qvo)
- `src/lib/lab/bench/__tests__/prompt-base.contract.test.ts`: `e13732a2` -> `575ce816` (quick 261107-qvo)
- `src/lib/ai-cost/ai-model-pricing.ts`: `2d42c512` -> `f82a3ca3` (quick 261116-vpx)
- `src/lib/ai/adapters/upstream-images.ts`: `5816a8ce` -> `e03336ea` (F60.3-02)
- `src/lib/ai/adapters/chat-completions.ts`: `322809d0` -> `9b6c2351` (F60.4-03)
- `src/lib/ai/adapters/responses.ts`: `f3dcfa8f` -> `9b6c2351` (F60.4-03)
- `src/lib/ai/types.ts`: `98cabd39` -> `12288035` (quick 261120-qvp; somente tipo aditivo opcional `number | null`)
O texto de autorização anterior deve ser PRESERVADO e estendido (nunca substituído por um rótulo genérico), para não apagar a trilha histórica.

(3) Substituir a asserção absoluta `expect(removed).toEqual([])` do teste "a rota generate-image evolui para o wiring b1b preservando o fluxo legado" por uma exceção ESTREITA e verificável. Declarar dois constantes literais: `PERSISTENCE_IMPORT_BEFORE` = a linha original `import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, uploadCampaignInputImage, removeCampaignInputs, updateCampaignReady, updateCampaignError, deleteCampaignImage, createArtVersion } from "@/lib/campaign/persistence";` e `PERSISTENCE_IMPORT_AFTER` = exatamente a mesma linha com `, uploadCampaignInputFile` inserido antes do `}`. Implementar dois helpers puros:
- `unexpectedRouteRemovals(removed: readonly string[]): string[]` — devolve as linhas removidas que NÃO sejam exatamente `PERSISTENCE_IMPORT_BEFORE`.
- `additivePersistenceImportViolations(removed: readonly string[], added: readonly string[]): string[]` — devolve códigos fechados: `removed_not_exactly_persistence_import` quando `removed` não é exatamente `[PERSISTENCE_IMPORT_BEFORE]`; `added_missing_persistence_import` quando `added` não contém `PERSISTENCE_IMPORT_AFTER`; `specifier_changed` quando o specifier extraído difere de `@/lib/campaign/persistence`; `symbol_lost:<simbolo>` para cada símbolo de `PERSISTENCE_IMPORT_BEFORE` ausente em `PERSISTENCE_IMPORT_AFTER`; `unexpected_symbol:<simbolo>` para cada símbolo de `PERSISTENCE_IMPORT_AFTER` fora do conjunto `simbolos(BEFORE) ∪ {uploadCampaignInputFile}`.
No teste da rota: exigir `expect(removed).toEqual([PERSISTENCE_IMPORT_BEFORE])` (uma e somente uma remoção), `expect(unexpectedRouteRemovals(removed)).toEqual([])`, `expect(additivePersistenceImportViolations(removed, added)).toEqual([])` e manter todas as asserções seguintes do teste (imports do guard b1a/b1b, índice do guard antes de `safeParse`/reserva, `runProductOneToOneGeneration`, unicidade do import do orquestrador) inalteradas.

(4) Acrescentar ao `describe` de testes negativos da reconciliação 4 testes novos que provem que a exceção NÃO permite remover outro símbolo nem alterar código legado: (a) `unexpectedRouteRemovals([PERSISTENCE_IMPORT_BEFORE])` -> `[]` e `unexpectedRouteRemovals(['  const safeName = campaign.product_name.replace(...)'])` -> contém a linha; (b) `additivePersistenceImportViolations([PERSISTENCE_IMPORT_BEFORE], [PERSISTENCE_IMPORT_AFTER])` -> `[]`; (c) `PERSISTENCE_IMPORT_AFTER` sem `createArtVersion` -> `symbol_lost:createArtVersion`; (d) `PERSISTENCE_IMPORT_AFTER` com símbolo extra (`deleteCampaign`) -> `unexpected_symbol:deleteCampaign`, e uma variante em que `added` omite `PERSISTENCE_IMPORT_AFTER` -> `added_missing_persistence_import`. Não usar `skip`/`only`, não remover nem enfraquecer nenhuma asserção existente.

(5) Atualizar o comentário de cabeçalho do arquivo para citar a quick 261121-iqh e registrar que a exceção da rota generate-image passa a ser "linha de import de persistência substituída pela mesma linha com `uploadCampaignInputFile`", mantendo qualquer outra remoção como falha.

Contexto numérico esperado após as etapas (1) e (2): o diff `git diff --name-only 335bfb70..HEAD -- <LEGACY_FRONTIER_PATHS>` tem 106 caminhos e `AUTHORIZED_FRONTIER_CHANGES` passa a ter 106 entradas, mantendo `expect(changed).toHaveLength(...)` verdadeiro. Não alterar o conjunto de caminhos do diff para fazer a conta fechar.
  </action>
  <verify>
    <automated>npx vitest run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts</automated>
    Confirmar 1 arquivo e 14 testes PASS (10 existentes + 4 novos negativos), 0 failed.
  </verify>
  <done>Os 4 testes antes vermelhos passam (`conjunto exato`, `conteúdo dos caminhos adicionais`, `rota generate-image`, `aceita caminhos e conteúdos idênticos`); BASE_SHA `335bfb70` e `LEGACY_FRONTIER_PATHS` inalterados; única remoção admitida na rota é a linha de import de persistência, com `uploadCampaignInputFile` adicionado e nenhum símbolo perdido; commit `test(261121-iqh): ...` criado.</done>
</task>

<task type="auto">
  <name>Task 2: Separar type-only de runtime no contrato de não-ativação para os 7 importadores de orquestração 9:16</name>
  <files>src/lib/product-1-1/__tests__/non-activation.contract.test.ts</files>
  <action>
Ajuste exclusivamente este arquivo de teste, com reconciliação TEST-ONLY. NÃO alterar nenhum runtime, rota, schema, migration ou contrato OpenSpec. Manter `AUTHORIZED_PRODUCT_FLOW_IMPORTS` como autoridade GLOBAL: as duas varreduras globais (`nenhuma rota do lojista importa...` e `nenhum runtime legado importa...`) devem continuar passando por esse mapa, e os importadores já registrados (rotas, páginas, formulários, `square-base`, `product-vertical-9-16`, `product-two-format`, `two-stage-financial-service`, `pilot/resolve-pilot-spend-gate`) NÃO podem mudar de comportamento nem de entradas.

(1) Implementar um classificador puro `classifyProductFlowImports(source: string): { typeOnly: string[]; runtime: string[] }` que capture, para os specifiers de `product-1-1`/`image-generation-operations-repository`, se a importação é TYPE-ONLY ou de RUNTIME. Regras fechadas, documentadas no próprio arquivo: instrução com modificador `import type` -> type-only; múltiplas instruções no mesmo specifier somam no conjunto (`Set`); `typeof import("...").x` em posição de tipo -> type-only; `import("...")` dinâmico -> runtime; instrução de valor com `type` INLINE dentro das chaves (por exemplo `import { projectDeliveredCampaign, type ProjectDeliveredCampaignResult } from "..."`) -> RUNTIME (o módulo é carregado em runtime). Não usar heurísticas frouxas que rebaixem imports de valor para type-only.

(2) Declarar um bloco dedicado, congelado, `NINE_SIXTEEN_ORCHESTRATION_AUTHORIZED_IMPORTS: Readonly<Record<string, { readonly typeOnly: readonly string[]; readonly runtime: readonly string[] }>>` cobrindo EXATAMENTE os 7 importadores e estes pares (espelham o fonte real, extraídos nesta sessão):
- `src/lib/product-9-16-two-stage/orchestration/copy-recovery-runner.ts`: typeOnly `["@/lib/product-1-1/copy/default-copy-runner"]`; runtime `[]`.
- `src/lib/product-9-16-two-stage/orchestration/deadline-budget.ts`: typeOnly `[]`; runtime `["@/lib/product-1-1/orchestration/deadline"]`.
- `src/lib/product-9-16-two-stage/orchestration/delivery-deps.ts`: typeOnly `[]`; runtime `["@/lib/product-1-1/credit-operation/credit-operation-client", "@/lib/product-1-1/orchestration/project-delivered-campaign", "@/lib/product-1-1/orchestration/project-closed-campaign"]`.
- `src/lib/product-9-16-two-stage/orchestration/delivery.ts`: typeOnly `["@/lib/product-1-1/orchestration/project-delivered-campaign", "@/lib/product-1-1/orchestration/project-closed-campaign"]`; runtime `[]`.
- `src/lib/product-9-16-two-stage/orchestration/resume-context.ts`: typeOnly `["@/lib/product-1-1/background-direction", "@/lib/product-1-1/copy/default-copy-runner", "@/lib/product-1-1/intent-selection", "@/lib/product-1-1/policies/types"]`; runtime `[]`.
- `src/lib/product-9-16-two-stage/orchestration/types.ts`: typeOnly `["@/lib/product-1-1/background-direction", "@/lib/product-1-1/copy/default-copy-runner", "@/lib/product-1-1/intent-selection", "@/lib/product-1-1/policies/types", "@/lib/product-1-1/snapshot/persist-snapshot", "@/lib/product-1-1/credit-operation/credit-operation-client", "@/lib/product-1-1/orchestration/project-delivered-campaign", "@/lib/product-1-1/orchestration/project-closed-campaign"]`; runtime `[]`.
- `src/lib/product-9-16-two-stage/orchestration/vertical-probe.ts`: typeOnly `["@/lib/product-1-1/artifact/types"]`; runtime `[]`.

(3) Acrescentar as 7 entradas correspondentes a `AUTHORIZED_PRODUCT_FLOW_IMPORTS` com `prefixes: []` e `exact` = união (ordenada, sem duplicatas) de `typeOnly` + `runtime` daquele importador, cada uma com comentário apontando para `60.5-01` (deps/tipos) ou `60.5-02` (probe/factory) e para o SUMMARY do 60.5-02 ("reutilizam F60/F60.1 por design"). A união é necessária porque o mapa permanece a autoridade global das duas varreduras; a distinção tipo/runtime é imposta pelo bloco dedicado. Nenhum prefixo amplo (`@/lib/product-1-1/`, `.../orchestration/`, `.../artifact/`) pode ser criado.

(4) Implementar helpers de comparação para o bloco dedicado: `isTypeOnlyAuthorized(importer, specifier): boolean`, `isRuntimeAuthorized(importer, specifier): boolean` e `authorizedUnionMismatches(): string[]` (para cada importador, devolve divergências entre o `exact` do mapa global e a união declarada tipo/runtime, incluindo duplicatas e ordens divergentes).

(5) Escrever um novo `describe` ("F60.5 — importações type-only vs runtime da orquestração 9:16 (test-only)") com, no mínimo, 8 testes:
a) "igualdade real==autorizado por importador": para cada um dos 7, ler o fonte, classificar e comparar `new Set(classify.typeOnly)` com `new Set(declarado.typeOnly)` e `new Set(classify.runtime)` com `new Set(declarado.runtime)`; falhar com mensagem que nomeia o importador.
b) "o mapa global continua sendo a autoridade": para cada um dos 7, exigir `prefixes` vazio, `new Set(rule.exact)` igual à união declarada, e `hasUnauthorizedProductFlowImport(importer, source) === false`.
c) "nenhum prefixo amplo": para as 7 entradas, nenhum `exact` igual a `@/lib/product-1-1/` nem terminando em `/product-1-1/`, `/orchestration/` ou `/artifact/`; e `authorizedUnionMismatches()` vazio.
d) "o scanner não exclui o diretório": `collectRuntimeSources(path.join(SOURCE_ROOT, "lib/product-9-16-two-stage"))` inclui os 7 `relativePath` e nenhum entra por prefixo liberado.
e) NEGATIVO "importador novo fora do mapa": `hasUnauthorizedProductFlowImport("src/lib/product-9-16-two-stage/orchestration/novo-runtime.ts", 'import type { X } from "@/lib/product-1-1/artifact/types";')` -> `true`.
f) NEGATIVO "módulo adicional em importador autorizado": `hasUnauthorizedProductFlowImport(resume-context.ts, 'import { x } from "@/lib/product-1-1/orchestration/generation-orchestrator";')` -> `true`.
g) NEGATIVO "dependência financeira em runtime de arquivo não autorizado para ela": `credit-operation-client` importado como VALOR em `vertical-probe.ts` -> `hasUnauthorizedProductFlowImport(...) === true` e `isRuntimeAuthorized(vertical-probe, spec) === false`; idem `resume-context.ts`.
h) NEGATIVO "type-only não é liberado genericamente": `classifyProductFlowImports('import type { X } from "@/lib/product-1-1/orchestration/generation-orchestrator";')` produz `typeOnly` com o specifier, mas `isTypeOnlyAuthorized(resume-context.ts, spec) === false` e `hasUnauthorizedProductFlowImport(...) === true`; e import de VALOR de `@/lib/product-1-1/artifact/types` em `vertical-probe.ts` -> runtime não autorizado (`isRuntimeAuthorized` false), apesar de o type-only do mesmo specifier ser autorizado.

(6) Não usar `skip`/`only`, não remover asserções, não adicionar exclusões de diretório, não afrouxar `SIDE_EFFECT_IMPORT_RE` nem os testes negativos existentes.
  </action>
  <verify>
    <automated>npx vitest run src/lib/product-1-1/__tests__/non-activation.contract.test.ts</automated>
    Confirmar 57 existentes + 8 novos = 65 testes PASS, 0 failed, e os 7 caminhos de `product-9-16-two-stage/orchestration` fora da lista de violações.
  </verify>
  <done>O teste "nenhum runtime legado importa as estruturas do Produto 1:1" passa com `violations === []`; os 7 importadores têm separação tipo/runtime verificada contra o fonte real; negativos de importador novo, módulo adicional, runtime financeiro e type-only genérico falham como violação; commit `test(261121-iqh): ...` criado.</done>
</task>

<task type="auto">
  <name>Task 3: Rodar os gates, registrar a matriz de reconciliação e o tracking da quick</name>
  <files>.planning/quick/261121-iqh-reconciliar-guards-legacy-frontier-e-non/261121-iqh-SUMMARY.md, .planning/STATE.md</files>
  <action>
Primeiro executar os gates na worktree, na ordem abaixo, registrando o resultado REAL (números, não "verde") no SUMMARY. Não iniciar o app, não acessar banco/Storage/provider, não gerar nada pago, não instalar dependências.

1. Guards completos: `npx vitest run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts src/lib/product-1-1/__tests__/non-activation.contract.test.ts` -> esperado 2 arquivos, 0 failed.
2. Regressões diretamente relacionadas (alvos concretos já existentes, todos offline): `npx vitest run src/app/api/campaign/generate-image/__tests__/route.test.ts`, `src/app/api/campaign/generate-image/__tests__/route.integration.test.ts`, `src/app/api/campaign/__tests__/architecture-guard.test.ts`, `src/app/api/campaign/__tests__/generate-image-format.test.ts`, `src/app/api/campaign/[id]/download/__tests__/route.two-stage.test.ts`, `src/app/api/campaign/[id]/download/__tests__/route.joint.test.ts`, `src/lib/ai/adapters/__tests__/chat-completions.test.ts`, `src/lib/ai/__tests__/upstream-images-expansion-options.test.ts`, `src/lib/ai/__tests__/nine-sixteen-expansion-model-config.contract.test.ts`, `src/lib/campaign/vertical-expansion/__tests__/model.contract.test.ts` (preflight de expansão), o diretório `src/lib/product-9-16-two-stage/orchestration/__tests__`, e `src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts` (fluxo conjunto). Citar caminhos entre aspas no PowerShell por causa de `[id]`.
3. `npm run typecheck` -> esperado exit 0.
4. `npm run lint` -> exit 0, registrando explicitamente a limitação já conhecida: o ESLint executa mas NÃO cobre TypeScript (arquivo `.ts` explícito é ignorado por falta de configuração), portanto lint não substitui typecheck.
5. `git diff --check` -> limpo.
6. Suíte global: `npm test` (scripts/testing/run-local-suite.mjs). É longa; se não concluir no ambiente, registrar a saída real e a limitação em vez de declarar sucesso. Baseline a comparar: as 5 falhas dos dois guards devem desaparecer; qualquer outra falha deve ser registrada nominalmente e classificada como preexistente (com evidência) ou nova (bloqueante).

Depois, escrever `.planning/quick/261121-iqh-reconciliar-guards-legacy-frontier-e-non/261121-iqh-SUMMARY.md` contendo:
- Cabeçalho com status honesto: "CONCLUÍDA (correção test-only, offline)"; branch `fix/telemetria-snapshot-economico-9-16`; HEAD de partida `76f82f7f`; declaração explícita de que nenhuma alteração de produção, rota, schema, migration, OpenSpec ou dependência foi feita e que nada foi publicado.
- **Causa raiz** (seção própria, em prosa): os dois guards congelam um mundo fechado (conjunto exato de caminhos autorizados + conteúdo idêntico ao commit congelado). Trabalho posterior JÁ APROVADO — F60.3-02, F60.4-03, F60.6-01/05 e as quicks 261107-hcx, 261107-qvo, 261116-vpx e 261120-qvp — ampliou a fronteira (`src/lib/ai/**`, `src/lib/ai-cost/**`, `src/lib/lab/bench/**`) e avançou o conteúdo de 7 caminhos já registrados, sem atualizar os guards. Além disso, a rota generate-image recebeu UMA adição aditiva de símbolo (`uploadCampaignInputFile`) no import de persistência. Nenhuma dessas mudanças é regressão: as 5 falhas eram dívida de registro, não de comportamento.
- **Matriz de reconciliação** em tabelas, com colunas `caminho`, `alteração` (`entrada nova` ou `commit atualizado <antigo> -> <novo>`), `evidência documental` (plano/summary/quick exato) e `commit imutável`. Uma tabela por origem (quick 261116-vpx; F60.6-01; F60.6-05; F60.3-02; F60.4-03; quick 261107-hcx; quick 261107-qvo; atualizações de commit) cobrindo as 44 linhas, mais uma tabela dos 7 importadores 9:16 com `typeOnly`/`runtime`.
- **Exceção da rota generate-image**: reproduzir a linha removida e a linha adicionada e explicar por que a exceção é estreita (mesma instrução, mesmo specifier, símbolos anteriores preservados, exatamente um símbolo novo) e como os 4 negativos provam que ela não admite remover outro símbolo nem alterar código legado.
- **Gates** com os números reais de cada comando, incluindo a limitação de lint e o resultado da suíte global.
- **Limites preservados** (seção obrigatória): reconhecer código offline NÃO aprova provider, ambiente, publicação, deploy ou checkpoint de laboratório. O **Checkpoint B** da quick 261107-hcx (ativação local + primeiras chamadas pagas, `gpt-image-2.6-sunburst` / `1152x2048`) e o **aceite formal** da quick 261116-vpx permanecem EXATAMENTE como estão: não foram executados, aprovados ou promovidos por esta quick. Merge, push, deploy, migration e qualquer chamada paga continuam fora de escopo.
- Lista de arquivos alterados (somente os 2 testes + SUMMARY + STATE) e commits produzidos.

Por fim, acrescentar em `.planning/STATE.md`, na seção `## Quick Tasks Completed`, um bullet no padrão das entradas vizinhas (`- **QUICK 261121-iqh (2026-11-21) - ...**`) registrando: correção test-only dos dois guards; 44 registros de fronteira reconciliados; 7 importadores 9:16 com separação tipo/runtime; gates com números; nenhuma alteração de produção; nada publicado; Checkpoint B e aceite 261116-vpx inalterados. Não reescrever nem reordenar entradas existentes de STATE.md.

Commit final: `docs(261121-iqh): registrar matriz de reconciliacao dos guards e tracking da quick`, incluindo apenas os arquivos desta tarefa (o SUMMARY e o STATE.md) — os dois testes já foram commitados nas tarefas 1 e 2.
  </action>
  <verify>
    <automated>npx vitest run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts src/lib/product-1-1/__tests__/non-activation.contract.test.ts</automated>
    Complementar: `npm run typecheck` exit 0, `npm run lint` exit 0 (com limitação de cobertura TS registrada), `git diff --check` limpo, `git status --porcelain` sem alterações fora dos 4 arquivos do plano (exceto os dois `__pycache__/*.pyc` preexistentes, que não devem ser tocados).
  </verify>
  <done>SUMMARY contém a causa raiz, as 44 linhas da matriz de reconciliação e a tabela tipo/runtime dos 7 importadores, além dos gates com números reais e dos limites preservados (Checkpoint B e aceite 261116-vpx inalterados); STATE.md tem o bullet da quick; commit documental criado; nenhuma alteração de produção presente na worktree.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Descrição |
|----------|-----------|
| guard → histórico Git | O guard aceita como "aprovado" apenas o conteúdo de um commit imutável (`git show <commit>:<path>`); um commit errado ou uma referência móvel converteria dívida de registro em autorização silenciosa |
| scanner de imports → fonte real | `collectRuntimeSources` + classificador tipo/runtime determinam o que o runtime legado pode importar; um prefixo amplo ou uma exclusão de diretório cegaria a barreira |
| exceção de rota → fluxo legado | A exceção do import de persistência toca o arquivo que hospeda o caminho legado de geração; frouxidão aqui permite alterar o fluxo legado sob aparência de "import aditivo" |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261121-01 | Tampering | `AUTHORIZED_FRONTIER_CHANGES` (legacy-frontier) | mitigate | Toda entrada carrega `authorization` + `commit` imutável de 8 caracteres válido em `git cat-file`; nenhuma entrada usa HEAD/branch; cada commit foi verificado nesta sessão com `git diff --quiet <commit> -- <path>` (44/44 idênticos). `expect(changed).toHaveLength(106)` mantém o conjunto fechado |
| T-261121-02 | Elevation of privilege | `AUTHORIZED_PRODUCT_FLOW_IMPORTS` (non-activation) | mitigate | Entradas por caminho com `prefixes: []` e `exact` exato (união tipo/runtime); teste impede `@/lib/product-1-1/`, `.../orchestration/` e `.../artifact/` genéricos; `authorizedUnionMismatches()` impede divergência entre mapa global e bloco dedicado |
| T-261121-03 | Tampering | exceção do import de persistência na rota generate-image | mitigate | Só aceita `PERSISTENCE_IMPORT_BEFORE` removida e `PERSISTENCE_IMPORT_AFTER` adicionada, com `symbol_lost:<sym>` e `unexpected_symbol:<sym>` como violações; 4 testes negativos provam que outra remoção ou outra alteração falham |
| T-261121-04 | Repudiation | SUMMARY e STATE.md | mitigate | Matriz com caminho/alteração/evidência/commit para as 44 linhas e tabela tipo/runtime dos 7 importadores; limites (Checkpoint B, aceite 261116-vpx, "offline ≠ produção") explicitados, impedindo que o registro vire aprovação de provider/ambiente |
| T-261121-05 | Denial of service | scanners de fonte (`readdirSync` recursivo, `git show` por entrada) | accept | Custo já existente (~4 s por guard); o acréscimo de 37 entradas não muda a ordem de grandeza. Nenhuma otimização para não alterar o comportamento verificado |
| T-261121-SC | Tampering | npm/pip/cargo installs | accept | Nenhuma instalação de dependência prevista; `package.json`/`package-lock.json` intocados. Se surgir necessidade de instalar, parar e escalar (checkpoint humano bloqueante) |
</threat_model>

<verification>
Gates obrigatórios (todos offline; nenhum app, banco, Storage, provider ou chamada paga):

- `npx vitest run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` -> 14/14 PASS.
- `npx vitest run src/lib/product-1-1/__tests__/non-activation.contract.test.ts` -> 65/65 PASS.
- Guards completos em um único comando -> 2 arquivos, 0 failed (baseline desta sessão: 5 failed / 62 passed).
- Regressões relacionadas: rotas `generate-image` (route + integration), `architecture-guard`, `generate-image-format`, download `two-stage` e `joint`, adapter `chat-completions`, `upstream-images-expansion-options`, `nine-sixteen-expansion-model-config.contract`, preflight `vertical-expansion/model.contract`, diretório `product-9-16-two-stage/orchestration/__tests__`, `joint-boundaries.contract` — todos exit 0.
- `npm run typecheck` exit 0; `npm run lint` exit 0 com a limitação de cobertura TS registrada; `git diff --check` limpo; `npm test` com as 5 falhas dos guards ausentes (demais falhas classificadas com evidência).
- `git status --porcelain`: apenas os 4 arquivos do plano, mais os dois `__pycache__/*.pyc` preexistentes (não tocar).

Invariantes que NÃO podem mudar: `BASE_SHA = "335bfb70"`, `LEGACY_FRONTIER_PATHS`, `AUTHORIZED_DOWNLOAD_ROUTE_COMMIT = "e3fb664e"`, `PRODUCT_MODULE_ROOTS`, `SIDE_EFFECT_IMPORT_RE`, todos os testes negativos existentes, ausência de `skip`/`only`, ausência de prefixo amplo e ausência de exclusão de diretório no scanner.
</verification>

<success_criteria>
- As 5 falhas dos dois guards desaparecem; a suíte global não ganha nenhuma falha nova.
- `legacy-frontier.guard.test.ts`: 106 entradas autorizadas (69 + 37), 7 commits atualizados preservando o texto histórico de autorização, exatamente 1 remoção admitida na rota generate-image (import de persistência com `uploadCampaignInputFile`).
- `non-activation.contract.test.ts`: 7 importadores de `product-9-16-two-stage/orchestration` registrados por par exato com separação explícita type-only/runtime, mapa global ainda autoridade, 8 testes novos incluindo 4 negativos.
- Nenhuma alteração de produção, rota, schema, migration, contrato OpenSpec ou dependência; nenhum arquivo além dos 4 do plano (mais os `.pyc` preexistentes intocados).
- SUMMARY com causa raiz + matriz de reconciliação (44 linhas + 7 importadores) e limites preservados (Checkpoint B da 261107-hcx e aceite formal da 261116-vpx inalterados; offline não aprova provider/ambiente/publicação).
- 3 commits atômicos: teste legacy-frontier, teste non-activation, tracking documental.
</success_criteria>

<output>
Criar `.planning/quick/261121-iqh-reconciliar-guards-legacy-frontier-e-non/261121-iqh-SUMMARY.md` ao concluir, com a matriz de reconciliação, a causa raiz e os gates.
</output>
