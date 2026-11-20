## Context

A expansão 9:16 emite telemetria bufferizada própria (`src/lib/campaign/vertical-expansion/telemetry.ts`). Ela cria dois `AiTelemetryContext` via `createDefaultTelemetryContext`:

1. o contexto principal entregue ao gateway (`telemetry`);
2. o contexto criado por envelope dentro do flush do `BufferingAiTelemetrySink`.

Nenhum dos dois recebe `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`. O `DefaultAiTelemetrySink` grava `null` (`telemetry-sink.ts:156-157`), e a apuração BRL usa o fallback vigente.

O snapshot econômico já é resolvido uma vez por run e persistido em `campaigns.input_snapshot.resumeContext.economicSnapshot`:

- no fluxo individual, o snapshot inicial é construído antes do orquestrador;
- no fluxo conjunto `1:1+9:16`, `joint-initial-snapshot.ts` grava `economicSnapshot` no `resumeContext`;
- na base, `runBaseStep` sempre reconstrói o conteúdo pelo snapshot durável (`reconstruction.ts:238-257`), por isso a base **não deve** ser alterada sem prova de lacuna.

Os dois fluxos (individual e conjunto) convergem em `runExpansionStep`, que já recebe `client` em `ExpansionStepDeps` e encaminha a chamada a `deps.expand`.

## Goals / Non-Goals

**Goals:**

- Propagar os dois valores econômicos congelados aos dois contextos da telemetria da expansão.
- Usar o snapshot durável como fonte única em geração inicial, conjunto, continuação e retry.
- Preservar `null` explícito para operações antigas/sem snapshot.
- Cobrir individual e conjunto pelo mesmo ponto (`runExpansionStep`).
- Confirmar por teste o comportamento atual da base antes de qualquer mudança nela.

**Non-Goals:**

- Não alterar cobrança, reservas, crédito, pricing, provider, entrega ou orçamento.
- Não reprocessar, corrigir ou reescrever eventos históricos.
- Não criar migration nem coluna nova.
- Não mudar a forma como câmbio/valor do crédito são capturados no início do run.
- Não bloquear a expansão quando a leitura econômica falhar (telemetria é best-effort).

## Decisions

### D1 — Ler o snapshot durável uma única vez no `runExpansionStep`, antes do último recheck

`runExpansionStep` resolve o snapshot econômico por uma dependência injetável (`readEconomicSnapshot`), com default que lê `campaigns.input_snapshot` e interpreta `resumeContext` com o parser já existente (`parseResumeContext`), no mesmo padrão de `copy-recovery-runner.ts:34-63`.

**Ordem contratual:** retrieve → probe → gate inicial → preflight → **leitura econômica (com espera limitada)** → **recheck final de cancelamento/prazo** → `acquire`. O recheck existente permanece a ÚLTIMA verificação após qualquer consulta nova; nenhuma leitura ocorre entre o recheck e o `acquire`.

- **Escopo da consulta:** restrita à identidade já validada — `campaigns.id = campaignId` **e** `campaigns.store_id = storeId`. Nenhuma consulta por operação/campanha de terceiros, nenhuma ampliação de superfície.
- **Espera limitada:** a leitura é envolvida por um limite padrão curto (2.000 ms, injetável para teste). Estouro do limite, ausência de linha, `resumeContext` ausente/malformado ou exceção/rejeição da dependência resultam em `{ usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null }`.
- **Sem consumo de tentativa por telemetria:** a leitura não adquire tentativa nem chama provider. Se o tempo consumido esgotar o orçamento, o recheck final (que continua sendo o último) suspende a execução sem `acquire`; a telemetria nunca é motivo de consumo/estorno.
- **Sem fallback para parâmetro vigente:** em nenhum cenário o leitor consulta `EconomicParameterService`/câmbio atual. `null` é registrado como ausência explícita.
- **Cache:** não há cache adicional; a expansão executa uma vez por operação/tentativa. Se o custo da leitura incomodar, uma evolução futura pode reaproveitar o snapshot já lido pela reconstrução — fora deste escopo.

### D2 — Estender o contrato do módulo, não o do orquestrador

`ExpandVerticalInput` ganha dois campos opcionais (`usdBrlRateAtGeneration?: number | null`, `creditValueBrlAtGeneration?: number | null`). O parser (`policy.ts`) aceita `number` finito ou `null`; valor inválido/não finito é normalizado para `null` (não decide gasto, então não vira novo motivo de recusa).

`runExpansionStep` preenche esses campos no objeto passado a `deps.expand`. `ExpansionStepInput` permanece estável para não propagar o detalhe econômico por toda a árvore de orquestração.

### D3 — Telemetria exige o valor e repassa aos DOIS contextos

`ExpansionTelemetryInput` passa a exigir `usdBrlRateAtGeneration: number | null` e `creditValueBrlAtGeneration: number | null` (mesmo padrão de `square-base/telemetry.ts:146-148`). `expand.ts` encaminha os campos validados.

Em `telemetry.ts`, os dois `createDefaultTelemetryContext` recebem os valores:

- contexto principal (sink de buffering);
- contexto por envelope no flush (sink padrão).

O restante do sink permanece intocado.

### D4 — Base não é alterada nesta change

`runBaseStep` já reconstrói o conteúdo pelo snapshot durável. A change adiciona um teste que injeta `economicSnapshot` persistido, altera os parâmetros vigentes simulados e prova que a base mantém os valores congelados. Se o teste falhar, a execução para e apresenta evidência antes de ampliar o escopo.

### D5 — Sem backfill

Eventos já gravados com `null` permanecem como estão. A correção vale para eventos novos; qualquer reprocessamento histórico exigiria change separada e autorização própria.

## Risks / Trade-offs

- **Leitura extra por expansão:** uma consulta a `campaigns` antes da chamada paga. Mitigação: limite de 2.000 ms, best-effort, sem bloquear; caminho já usado pela recuperação de copy.
- **Leitura lenta/instável:** o limite pode expirar e produzir `null`. É preferível a atrasar a expansão; o recheck final continua sendo a última verificação e pode suspender sem consumir tentativa.
- **Dependência injetada rejeitando:** precisa ser capturada e convertida em `null`; um teste negativo dedicado impede rejeição não tratada.
- **Snapshot antigo sem `resumeContext`:** resultado `null` explícito, preservando o comportamento atual e sinalizando a ausência — não mascarado como valor atual.
- **Snapshot malformado:** `parseResumeContext` falha de forma fechada no leitor (retorna `null`), sem lançar para o step.
- **Duplicação de parser:** reutilizar `parseResumeContext` evita divergência; não criar um segundo formato.
- **Risco de regressão em testes de contrato:** campos obrigatórios no input da telemetria exigem atualização do helper de teste; é intencional para que uma nova omissão falhe cedo.
- **Gate global:** após a correção, `telemetry-coverage` deve voltar a 4/4. A suíte global só será declarada verde após reexecução completa, que não faz parte desta change isolada.
