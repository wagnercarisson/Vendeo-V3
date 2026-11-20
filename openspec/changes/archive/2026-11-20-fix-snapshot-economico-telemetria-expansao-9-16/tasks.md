## 1. Baseline e contratos vermelhos

- [x] 1.1 Registrar o baseline atual: `npx vitest run src/lib/ai/__tests__/telemetry-coverage.test.ts` (esperado 1 falha/3 passes, apontando `vertical-expansion/telemetry.ts`) e guardar a saída como evidência inicial.
- [x] 1.2 Em `src/lib/campaign/vertical-expansion/__tests__/telemetry.contract.test.ts`, adicionar casos que exijam os valores congelados nos DOIS contextos (principal e envelope do flush), incluindo `null` explícito e ausência de leitura de parâmetro vigente. Rodar e confirmar RED.
- [x] 1.3 Em `src/lib/campaign/vertical-expansion/__tests__/policy.contract.test.ts` e `types.contract.test.ts`, cobrir os campos opcionais de snapshot (number finito e `null`; inválido normalizado para `null`) sem alterar as igualdades existentes. Rodar e confirmar RED quando aplicável.

## 2. Contrato do módulo de expansão

- [x] 2.1 Estender `ExpandVerticalInput` (`types.ts`) com `usdBrlRateAtGeneration?: number | null` e `creditValueBrlAtGeneration?: number | null`.
- [x] 2.2 Atualizar `parseExpandVerticalInput` (`policy.ts`) para ler os dois campos, aceitar número finito ou `null` e normalizar inválido/ausente para `null`, preservando o objeto congelado e sem novo motivo de recusa.
- [x] 2.3 Em `expand.ts`, encaminhar os valores validados a `createExpansionTelemetry` e manter o restante do contrato de entrada/saída inalterado.
- [x] 2.4 Reconciliar `expand.core.contract.test.ts`: permitir somente o identificador completo `creditValueBrlAtGeneration` na cópia analisada (limites de palavra), manter busca financeira case-insensitive e todas as proibições; remover qualquer helper/alias usado para contornar o scanner e cobrir o guard com testes positivos/negativos.

## 3. Telemetria: dois contextos

- [x] 3.1 Tornar `usdBrlRateAtGeneration` e `creditValueBrlAtGeneration` obrigatórios (number | null) em `ExpansionTelemetryInput`.
- [x] 3.2 Repassar os dois valores ao `createDefaultTelemetryContext` principal (sink de buffering) e ao contexto criado por envelope dentro do flush, sem alterar a allowlist de metadata nem o sink.
- [x] 3.3 Rodar `telemetry.contract.test.ts` e `expand.*.contract.test.ts`; garantir GREEN sem enfraquecer asserções.

## 4. Leitura durável no step compartilhado

- [x] 4.1 Criar um leitor best-effort do snapshot econômico em `src/lib/product-9-16-two-stage/orchestration/` que leia `campaigns.input_snapshot.resumeContext` com `parseResumeContext`, restrito a `campaigns.id = campaignId` **e** `campaigns.store_id = storeId`, com limite de espera padrão de 2.000 ms (injetável); devolve `{ usdBrlRateAtGeneration, creditValueBrlAtGeneration }` e usa `null` em ausência/erro/timeout (mesmo padrão de `copy-recovery-runner.ts`).
- [x] 4.2 Expor `readEconomicSnapshot?` e o limite (ou clock/timer injetável) em `ExpansionStepDeps` para teste; default = leitor acima.
- [x] 4.3 Em `runExpansionStep`, inserir a leitura **depois do preflight e antes do recheck final de cancelamento/prazo**, garantindo que o recheck continue sendo a última verificação antes do `acquire`; encaminhar os dois valores ao objeto passado a `deps.expand`.
- [x] 4.4 Atualizar `expansion-step.contract.test.ts` provando: leitura única; consulta restrita à campanha+loja validadas; encaminhamento ao `expand`; ausência ⇒ `null`; snapshot malformado ⇒ `null`; exceção do leitor ⇒ `null`; rejeição da dependência injetada ⇒ `null`; timeout ⇒ `null`; nenhuma leitura de parâmetro vigente; nenhum `acquire`/tentativa consumida por causa da telemetria; recheck final preservado como última verificação.

## 5. Fluxo individual, conjunto, continuação e retry

- [x] 5.1 Em `run-nine-sixteen.contract.test.ts` (ou teste dirigido equivalente), provar que a expansão individual recebe o snapshot persistido em geração inicial.
- [x] 5.2 Em `product-two-format` (`deliver-joint-vertical.contract.test.ts` e/ou `joint-journeys.integration.test.ts`), provar que a expansão conjunta `1:1+9:16` recebe os mesmos valores.
- [x] 5.3 Adicionar teste de continuação/retry que altera os parâmetros econômicos simulados entre etapas e comprova que a expansão mantém os valores originais do snapshot (sem reler o vigente).
- [x] 5.4 Garantir que operações antigas sem snapshot continuam `null` explícito e não bloqueiam.

## 6. Base quadrada: confirmar antes de tocar

- [x] 6.1 Em `base-step.contract.test.ts`/`reconstruction.contract.test.ts`, adicionar teste que injeta `economicSnapshot` persistido, altera os parâmetros vigentes simulados e verifica que a telemetria da base mantém os valores congelados.
- [x] 6.2 **Gate de escopo:** se o teste 6.1 passar, NÃO alterar a base. Se falhar, parar a execução e apresentar a evidência antes de ampliar o escopo.

## 7. Gates e fechamento

- [x] 7.1 Rodar `npx vitest run src/lib/ai/__tests__/telemetry-coverage.test.ts` e confirmar 4/4.
- [x] 7.2 Rodar as suítes dirigidas de `vertical-expansion`, `product-9-16-two-stage`, `product-two-format` e as regressões de rota afetadas.
- [x] 7.3 Rodar `npm.cmd run typecheck`, `npm.cmd run lint` e `git diff --check`.
- [x] 7.4 Confirmar diff restrito ao escopo (expansão/orquestração/testes/documentação), sem migration, pricing, cobrança, reservas, provider, entrega ou backfill de eventos históricos.
- [x] 7.5 Registrar a evidência no SUMMARY/verificação da change; não declarar a suíte global verde sem reexecutá-la por completo.
- [x] 7.6 Confirmar ausência de `frozenCreditValueField` e de qualquer alias/helper de contorno; confirmar o encaminhamento direto de `creditValueBrlAtGeneration` e que o único arquivo de código adicional ao escopo anterior é `expand.core.contract.test.ts`.
