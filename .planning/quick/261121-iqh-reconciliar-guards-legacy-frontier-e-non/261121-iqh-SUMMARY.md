# QUICK 261121-iqh — Reconciliação dos guards `legacy-frontier` e `non-activation` (test-only)

**Status:** CONCLUÍDA (correção test-only, offline).
**Branch:** `fix/telemetria-snapshot-economico-9-16`.
**HEAD de partida:** `9e3ccdc0` (commit do plano desta quick); base congelada do guard: `335bfb70`.
**Escopo:** SOMENTE os dois arquivos de teste. Nenhuma alteração de produção, rota, schema,
migration, contrato OpenSpec, `package.json`, `package-lock.json` ou dependência. Nada foi
publicado (sem merge, push, deploy, migration ou chamada paga).

---

## Causa raiz

Os dois guards congelam um mundo fechado. O `legacy-frontier.guard` exige que o conjunto de
caminhos alterados desde `335bfb70` seja **exatamente** o conjunto autorizado (com
`expect(changed).toHaveLength(AUTHORIZED_FRONTIER_CHANGES.length)`) e que o **conteúdo** de
cada caminho adicional seja idêntico ao de um commit imutável registrado. O
`non-activation.contract` exige que todo runtime fora de `src/lib/product-1-1/` e
`src/components/product-1-1/` que importe `product-1-1` esteja nominalmente no mapa
importer→specifier.

Trabalho **já autorizado e executado** posteriormente ampliou a fronteira de `src/lib/ai/**`,
`src/lib/ai-cost/**` e `src/lib/lab/bench/**` sem registrar as entradas correspondentes:
F60.3-02 (opções de expansão no adapter de imagens), F60.4-03 (adapters no fluxo da base
quadrada), F60.6-01 (configuração de modelo 9:16), F60.6-05 (serviço/view da configuração),
quick 261107-hcx (bancada 9:16 e preset 2.6 experimental), quick 261107-qvo (expansão pronta e
formato 4:5), quick 261116-vpx (preflight de pricing) e quick 261120-qvp (snapshot econômico na
telemetria). Além disso, 7 caminhos **já registrados** tiveram o conteúdo avançado por essas
mesmas origens, e a rota `generate-image` recebeu **uma** adição aditiva de símbolo
(`uploadCampaignInputFile`) na linha de import de persistência.

Por fim, 7 módulos de `src/lib/product-9-16-two-stage/orchestration/` reutilizam, por design
(60.5-01/60.5-02), tipos e a autoridade financeira do Produto 1:1. Nenhuma dessas mudanças é
regressão de produção: as 5 falhas (4 + 1) eram **dívida de registro**, não de comportamento.
A reconciliação é estritamente de registro — nenhuma barreira foi relaxada.

---

## Matriz de reconciliação — 37 entradas novas

### quick 261116-vpx — preflight de pricing antes da base (leitura estrita aditiva)

Evidência: `.planning/quick/261116-vpx-expansao-preflight-de-pricing-antes-da-base/261116-vpx-SUMMARY.md`

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/ai/ai-model-catalog-service.ts` | entrada nova | 261116-vpx SUMMARY (leitura estrita aditiva do catálogo) | `f82a3ca3` |
| `src/lib/ai/__tests__/ai-model-catalog-service.test.ts` | entrada nova | 261116-vpx SUMMARY (testes do catálogo) | `f82a3ca3` |
| `src/lib/ai-cost/__tests__/ai-model-pricing.test.ts` | entrada nova | 261116-vpx SUMMARY (testes de pricing) | `f82a3ca3` |

### F60.6-01 — configuração de modelo da expansão 9:16

Evidência: `.planning/phases/60.6-f60-6-configuracao-admin-da-expansao-9-16/` (F60.6-01)

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/ai/nine-sixteen-expansion-model-config.ts` | entrada nova | F60.6-01 (configuração de modelo, aditiva) | `bc25feb4` |
| `src/lib/ai/__tests__/nine-sixteen-expansion-model-config.contract.test.ts` | entrada nova | F60.6-01 (contrato da configuração) | `77a59733` |
| `src/lib/ai/__tests__/nine-sixteen-expansion-model-config-migration.contract.test.ts` | entrada nova | F60.6-01 (contrato de migração) | `096cb703` |

### F60.6-05 — serviço e view da configuração de modelo

Evidência: `.planning/phases/60.6-f60-6-configuracao-admin-da-expansao-9-16/` (F60.6-05)

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/ai/nine-sixteen-expansion-model-config-service.ts` | entrada nova | F60.6-05 (serviço de leitura da configuração) | `8cfef0f1` |
| `src/lib/ai/__tests__/nine-sixteen-expansion-model-config-service.test.ts` | entrada nova | F60.6-05 (testes do serviço) | `8cfef0f1` |
| `src/lib/ai/nine-sixteen-expansion-model-config-view.ts` | entrada nova | F60.6-05 (view da configuração) | `4bc61965` |
| `src/lib/ai/__tests__/nine-sixteen-expansion-model-config-view.test.ts` | entrada nova | F60.6-05 (testes da view) | `4bc61965` |

### F60.3-02 — opções de expansão no adapter de imagens upstream

Evidência: `.planning/phases/60.3-f60-3-expansao-por-ia-da-campanha-9-16/` (F60.3-02)

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/ai/__tests__/upstream-images-expansion-options.test.ts` | entrada nova | F60.3-02 (opções de expansão 9:16; contrato offline) | `485736fb` |

### quick 261107-hcx — bancada 9:16 e preset 2.6 experimental (Checkpoint A; preset desabilitado)

Evidência: `.planning/quick/261107-hcx-estender-bancada-do-laboratorio-para-for/261107-hcx-PLAN.md`
(Checkpoint A; preset registrado `enabled: false`). Registro de código offline: **não** aprova
provider, ambiente, publicação nem o Checkpoint B.

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/ai/adapters/bench-images.ts` | entrada nova | 261107-hcx (bancada 9:16 — laboratório) | `6d9ef070` |
| `src/lib/lab/bench/__tests__/bench-execution.contract.test.ts` | entrada nova | 261107-hcx (contrato da execução da bancada) | `6d9ef070` |
| `src/lib/lab/bench/__tests__/bench-images-adapter.test.ts` | entrada nova | 261107-hcx (adapter de imagens da bancada) | `6d9ef070` |
| `src/lib/lab/bench/domain/bench-model-allowlist.ts` | entrada nova | 261107-hcx (`BENCH_MODEL_ALLOWLIST`) | `6d9ef070` |
| `src/lib/lab/bench/domain/policies/formato-9-16.ts` | entrada nova | 261107-hcx (política de formato 9:16) | `6d9ef070` |
| `src/lib/lab/bench/domain/schemas.ts` | entrada nova | 261107-hcx (schemas da bancada/preset) | `6d9ef070` |
| `src/lib/lab/bench/execution/bench-cost-resolver.ts` | entrada nova | 261107-hcx (resolução de custo da bancada) | `6d9ef070` |
| `src/lib/lab/bench/execution/bench-execution-service.ts` | entrada nova | 261107-hcx (serviço de execução; `maxRetries: 0` na bancada) | `6d9ef070` |
| `src/lib/lab/bench/gateway/runtime.ts` | entrada nova | 261107-hcx (runtime do gateway da bancada) | `6d9ef070` |
| `src/lib/lab/bench/domain/preset-registry.ts` | entrada nova | 261107-hcx (preset 2.6 `enabled: false`) | `0ba82d30` |
| `src/lib/lab/bench/__tests__/preset-registry.test.ts` | entrada nova | 261107-hcx (preset desabilitado no Checkpoint A) | `0ba82d30` |

### quick 261107-qvo — expansão de campanha pronta e formato 4:5 na bancada

Evidência: `.planning/quick/261107-qvo-planejar-expansao-de-campanha-pronta-par/261107-qvo-PLAN.md`
(módulos puros `expand-*`, políticas de formato, `bench-format`/`bench-pricing`/`config-registry`/
`prompt-base`). Código offline de laboratório.

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/lab/bench/__tests__/bench-format.test.ts` | entrada nova | 261107-qvo (formato 4:5 na bancada) | `575ce816` |
| `src/lib/lab/bench/__tests__/bench-pricing.test.ts` | entrada nova | 261107-qvo (pricing da bancada) | `575ce816` |
| `src/lib/lab/bench/__tests__/config-registry.test.ts` | entrada nova | 261107-qvo (registro de configuração) | `575ce816` |
| `src/lib/lab/bench/__tests__/expand-contract.test.ts` | entrada nova | 261107-qvo (contrato da expansão pronta) | `575ce816` |
| `src/lib/lab/bench/__tests__/expand-geometry.test.ts` | entrada nova | 261107-qvo (geometria da expansão) | `575ce816` |
| `src/lib/lab/bench/domain/bench-format.ts` | entrada nova | 261107-qvo (formato da bancada) | `575ce816` |
| `src/lib/lab/bench/domain/bench-pricing.ts` | entrada nova | 261107-qvo (pricing da bancada) | `575ce816` |
| `src/lib/lab/bench/domain/config-registry.ts` | entrada nova | 261107-qvo (registro de configuração) | `575ce816` |
| `src/lib/lab/bench/domain/expand-geometry.ts` | entrada nova | 261107-qvo (módulo puro de geometria) | `575ce816` |
| `src/lib/lab/bench/domain/expand-prompt.ts` | entrada nova | 261107-qvo (módulo puro de prompt) | `575ce816` |
| `src/lib/lab/bench/domain/expand-schema.ts` | entrada nova | 261107-qvo (schema da expansão) | `575ce816` |
| `src/lib/lab/bench/domain/policies/formato-4-5.ts` | entrada nova | 261107-qvo (política de formato 4:5) | `575ce816` |
| `src/lib/lab/bench/domain/policies/registry.ts` | entrada nova | 261107-qvo (registro de políticas) | `575ce816` |
| `src/lib/lab/bench/domain/prompt-base.ts` | entrada nova | 261107-qvo (base de prompt da bancada) | `575ce816` |
| `src/lib/lab/bench/persistence/bench-run-service.ts` | entrada nova | 261107-qvo (persistência da bancada) | `7e297770` |

---

## Matriz de reconciliação — 7 commits atualizados

O texto de autorização anterior foi **preservado e estendido** em todas as 7 entradas (nunca
substituído por rótulo genérico).

| caminho | alteração | evidência documental | commit imutável |
|---|---|---|---|
| `src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts` | commit atualizado `b7ab7b1b` → `575ce816` | 261107-qvo (expansão pronta/4:5) | `575ce816` |
| `src/lib/lab/bench/__tests__/prompt-base.contract.test.ts` | commit atualizado `e13732a2` → `575ce816` | 261107-qvo (expansão pronta/4:5) | `575ce816` |
| `src/lib/ai-cost/ai-model-pricing.ts` | commit atualizado `2d42c512` → `f82a3ca3` | 261116-vpx (leitura estrita aditiva) | `f82a3ca3` |
| `src/lib/ai/adapters/upstream-images.ts` | commit atualizado `5816a8ce` → `e03336ea` | F60.3-02 (opções de expansão 9:16) | `e03336ea` |
| `src/lib/ai/adapters/chat-completions.ts` | commit atualizado `322809d0` → `9b6c2351` | F60.4-03 | `9b6c2351` |
| `src/lib/ai/adapters/responses.ts` | commit atualizado `f3dcfa8f` → `9b6c2351` | F60.4-03 | `9b6c2351` |
| `src/lib/ai/types.ts` | commit atualizado `98cabd39` → `12288035` | 261120-qvp (campos opcionais `number \| null`) | `12288035` |

**Verificação de imutabilidade:** as 44 duplas `(path, commit)` foram conferidas com
`git cat-file -e <commit>^{commit}` (44/44 válidas) e `git diff --quiet <commit> -- <path>`
(44/44 sem diferença). `AUTHORIZED_FRONTIER_CHANGES` passou de 69 para **106 entradas**,
igual ao diff real (`git diff --name-only 335bfb70..HEAD -- <LEGACY_FRONTIER_PATHS>` = 106),
sem tocar `BASE_SHA`, `LEGACY_FRONTIER_PATHS` nem `AUTHORIZED_DOWNLOAD_ROUTE_COMMIT` (`e3fb664e`).

---

## Importações type-only × runtime — 7 importadores 9:16

Bloco `NINE_SIXTEEN_ORCHESTRATION_AUTHORIZED_IMPORTS` (congelado) + união exata no mapa global
`AUTHORIZED_PRODUCT_FLOW_IMPORTS` (`prefixes: []`).

| importador | type-only | runtime |
|---|---|---|
| `.../orchestration/copy-recovery-runner.ts` | `copy/default-copy-runner` | — |
| `.../orchestration/deadline-budget.ts` | — | `orchestration/deadline` |
| `.../orchestration/delivery-deps.ts` | — | `credit-operation/credit-operation-client`, `orchestration/project-delivered-campaign`, `orchestration/project-closed-campaign` |
| `.../orchestration/delivery.ts` | `orchestration/project-delivered-campaign`, `orchestration/project-closed-campaign` | — |
| `.../orchestration/resume-context.ts` | `background-direction`, `copy/default-copy-runner`, `intent-selection`, `policies/types` | — |
| `.../orchestration/types.ts` | `background-direction`, `copy/default-copy-runner`, `credit-operation/credit-operation-client`, `intent-selection`, `orchestration/project-delivered-campaign`, `orchestration/project-closed-campaign` (via `typeof import(...)`), `policies/types`, `snapshot/persist-snapshot` | — |
| `.../orchestration/vertical-probe.ts` | `artifact/types` | — |

Regras fechadas do classificador `classifyProductFlowImports`: `import type` ⇒ type-only;
`typeof import("...")` ⇒ type-only; `import("...")` dinâmico ⇒ runtime; import de VALOR com
`type` inline nas chaves ⇒ **runtime** (o módulo é carregado — caso real de
`projectDeliveredCampaign, type ProjectDeliveredCampaignResult` em `delivery-deps.ts`);
múltiplas instruções no mesmo specifier somam em `Set`. Nenhum diretório é excluído do
scanner e nenhum prefixo amplo (`@/lib/product-1-1/`, `.../orchestration/`, `.../artifact/`)
foi criado.

---

## Exceção da rota `generate-image`

Linha **removida** (exatamente uma no diff `335bfb70..HEAD` da rota):

```ts
import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, uploadCampaignInputImage, removeCampaignInputs, updateCampaignReady, updateCampaignError, deleteCampaignImage, createArtVersion } from "@/lib/campaign/persistence";
```

Linha **adicionada**:

```ts
import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, uploadCampaignInputImage, removeCampaignInputs, updateCampaignReady, updateCampaignError, deleteCampaignImage, createArtVersion, uploadCampaignInputFile } from "@/lib/campaign/persistence";
```

Por que a exceção é estreita: mesma instrução, mesmo specifier (`@/lib/campaign/persistence`),
todos os 9 símbolos anteriores preservados e **exatamente um** símbolo novo
(`uploadCampaignInputFile`). A rota não é reformatada. Os helpers provam o desvio com códigos
fechados: `removed_not_exactly_persistence_import`, `added_missing_persistence_import`,
`specifier_changed`, `symbol_lost:<symbol>`, `unexpected_symbol:<symbol>`. Quatro testes
negativos novos garantem que a exceção **não** admite remover outra linha (`const safeName = ...`
volta como remoção inesperada), perder `createArtVersion`, adicionar `deleteCampaign` ou omitir
o import. Todas as asserções seguintes do teste da rota (imports b1a/b1b, guard antes do
`safeParse`/reserva, `runProductOneToOneGeneration`, unicidade do import do orquestrador)
permanecem inalteradas.

---

## Gates (números reais, offline)

| gate | comando | resultado |
|---|---|---|
| guard legacy-frontier (focado) | `npx vitest run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` | **14/14 PASS** — 1 arquivo, 0 failed |
| contrato non-activation (focado) | `npx vitest run src/lib/product-1-1/__tests__/non-activation.contract.test.ts` | **65/65 PASS** (57 existentes + 8 novos) — 0 failed |
| ambos os guards | mesmo comando com os dois arquivos | **2 arquivos, 79/79 PASS**, exit 0 (baseline da sessão: 5 failed / 62 passed) |
| regressões relacionadas | 12 alvos do plano (rotas generate-image, `architecture-guard`, `generate-image-format`, download `two-stage`/`joint`, adapter `chat-completions`, `upstream-images-expansion-options`, `nine-sixteen-expansion-model-config.contract`, preflight `vertical-expansion/model.contract`, diretório `product-9-16-two-stage/orchestration/__tests__`, `joint-boundaries.contract`) | **41 arquivos, 465/465 PASS**, exit 0 |
| typecheck | `npm run typecheck` | **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`) |
| lint | `npm run lint` | **exit 0** — **limitação registrada:** o ESLint executa mas NÃO cobre TypeScript (flat config sem parser TS; `.ts` explícito é ignorado), portanto lint **não** substitui typecheck |
| diff check | `git diff --check` | **exit 0** (limpo) |
| suíte global | `npm test` (`scripts/testing/run-local-suite.mjs`) | **834 passed / 2 skipped (836 arquivos); 10315 passed / 10 skipped (10325 testes); 0 failed**, exit 0 |

Suíte global sem as 5 falhas dos dois guards e **sem nenhuma falha nova**. Os gates de
integração (PostgreSQL homolog/local-disposable/f50-4, app-env, Produto 1:1 isolado, F60 duas
etapas, F60.1 artefatos) permanecem **NÃO EXECUTADOS / NÃO APROVADOS** por falta de ambiente —
inalterados por esta quick.

---

## Limites preservados

- Reconhecer código **offline** NÃO aprova provider, ambiente, publicação, deploy ou
  checkpoint de laboratório. Este SUMMARY é registro de código/testes, não homologação.
- **Checkpoint B** da quick 261107-hcx (ativação local + primeiras chamadas pagas,
  `gpt-image-2.6-sunburst` / `1152x2048`) permanece **EXATAMENTE** como estava: não foi
  executado, aprovado ou promovido por esta quick. O preset segue `enabled: false`.
- O **aceite formal** da quick 261116-vpx permanece inalterado; o preflight de pricing e a
  leitura estrita aditiva não foram revalidados em ambiente.
- Merge, push, deploy, migration, geração paga e qualquer acesso a banco/Storage/provider
  continuam fora de escopo.
- Suíte global verde é evidência de testes locais, não de produção.

---

## Arquivos alterados e commits

| arquivo | natureza |
|---|---|
| `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` | teste (Task 1) |
| `src/lib/product-1-1/__tests__/non-activation.contract.test.ts` | teste (Task 2) |
| `.planning/quick/261121-iqh-reconciliar-guards-legacy-frontier-e-non/261121-iqh-SUMMARY.md` | documental (Task 3) |
| `.planning/STATE.md` | tracking (orquestrador, separado) |

| commit | mensagem |
|---|---|
| `89e6ed8d` | `test(261121-iqh): reconciliar guard legacy-frontier com 44 registros imutaveis` |
| `f4e8fe01` | `test(261121-iqh): separar imports type-only e runtime 9:16` |
| `d2713daa` | `test(261121-iqh): explicitar que o registro offline nao e aceite formal` |

Os dois arquivos `__pycache__/*.pyc` de `.codex/skills/ui-ux-pro-max/scripts/` já estavam
modificados antes da execução e **não foram tocados**.
