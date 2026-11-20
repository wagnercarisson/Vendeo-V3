## Why

A telemetria da expansão 9:16 (`src/lib/campaign/vertical-expansion/telemetry.ts`) cria o `AiTelemetryContext` sem `usdBrlRateAtGeneration`/`creditValueBrlAtGeneration`. O sink persiste `null` nesses campos, e a apuração BRL dessas chamadas cai no "parâmetro atual (fallback)" em vez do snapshot congelado do run. Há perda real de informação econômica histórica — não é apenas um teste desatualizado.

O gate global `telemetry-coverage` já aponta exatamente esse arquivo (1 falha / 3 passes), e a falha está documentada como preexistente desde a F60.4/F60.6. O objetivo é fechar a lacuna sem tocar cobrança, reservas, pricing, entrega ou eventos históricos.

## What Changes

- Propagar o snapshot econômico congelado (`usdBrlRateAtGeneration`, `creditValueBrlAtGeneration`) até os **dois** contextos criados pela telemetria da expansão (contexto principal e contexto por envelope do buffering).
- Usar como fonte o **snapshot durável** da campanha/operação (`input_snapshot.resumeContext.economicSnapshot`), restrito à campanha+loja já validadas, em geração inicial, conjunto `1:1+9:16`, continuação e retry — sem reler câmbio/valor do crédito vigentes.
- Ler antes do **último recheck** de cancelamento/prazo, com espera limitada; o recheck continua sendo a última verificação antes do `acquire` e a telemetria nunca consome tentativa.
- Preservar `null` explícito para registros antigos/sem snapshot, ausência, malformação, exceção, rejeição da dependência injetada ou timeout — sem inventar valor, sem zero e sem bloquear a expansão (best-effort).
- Cobertura única em `runExpansionStep`, compartilhada pelo fluxo individual 9:16 e pelo conjunto `1:1+9:16`.
- **Confirmar por teste** se a base quadrada já recebe os valores pela reconstrução durável; só alterar a base se o teste comprovar lacuna.
- NÃO alterar cobrança, reservas, créditos, pricing, provider, entrega, migrations ou eventos históricos.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `campaign-vertical-ai-expansion`: a telemetria por chamada passa a registrar o snapshot econômico congelado nas duas dimensões, inclusive `null` explícito para operações antigas.
- `product-9-16-two-stage-orchestration`: o step de expansão lê o snapshot durável e o encaminha ao módulo, preservando os valores originais em continuação/retry e no fluxo conjunto.

## Impact

- Código: `src/lib/campaign/vertical-expansion/{telemetry,types,policy,expand}.ts`; `src/lib/product-9-16-two-stage/orchestration/expansion-step.ts`; possivelmente o orquestrador/rotas apenas para injeção testável — a fonte preferencial é o snapshot já persistido.
- Testes: `telemetry.contract`, `policy.contract`, `expand`/`expansion-step`, orquestração individual e conjunto, continuação/retry, e `telemetry-coverage` (deve voltar a 4/4).
- Dados: nenhuma migration, nenhuma alteração em `generation_events` históricos e nenhum backfill.
- Operação: gerações continuam normalmente; a correção é de apuração econômica, não de entrega ou débito.
