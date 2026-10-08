## Why

Esta change conecta os componentes preparados na F56.2a e a fundação segura/atômica da F56.2b1a em um fluxo entregável. Geração, crédito e download passam a funcionar juntos, ainda com flags e autorização `off` e sem habilitar lojas.

## What Changes

- Formulário e roteamento conectados apenas sob elegibilidade server-side; em `off`, sem seletores/campos exclusivos.
- Orquestração real com preflight `complete`, política 2+1, snapshot e histórico append-only.
- Reserva temporária via operação atômica da b1a; `delivered` finaliza consumo; `refunded` devolve reserva.
- Arte 1024×1024 imutável e download somente após `delivered`.
- Copy não bloqueante, falha persistida, sem botão retry.
- Diagnóstico `IMG-001` e instrumentação por tentativa; legado preservado.

## Capabilities

### New
- `product-1-1-generation-orchestration`
- `product-1-1-artifact-delivery`
- `product-1-1-copy-recovery`

### Modified
- `product-1-1-flow-activation` (conexão do roteamento após a fundação b1a)
- `product-1-1-intent-background-selection`
- `product-1-1-campaign-credit-billing` (consumo da operação atômica, definição final delivered/refunded)
- `image-generation-config-snapshot`
- `image-generation-failure-policy`
- `image-generation-support-reference`
- `image-generation-model-pair-config`
- `image-generation-instrumentation`

## Critérios de Aceite

1. Sem elegibilidade, controles/campos novos não são montados/enviados; POST revalida elegibilidade e payload incompatível é recusado antes de crédito.
2. Snapshot é persistido antes da reserva/provider; tentativas são append-only e reconstruíveis.
3. Preflight exige pricing `complete` para principal e fallback; política permite até 2+1 e não chama revisor automático.
4. Reserva temporária reduz saldo disponível; só `delivered` torna o crédito consumo definitivo e libera download; `refunded` devolve reserva.
5. Arte 1024×1024 real, caminho imutável; campanhas legadas conservam seu download.
6. Falha apenas da copy persiste seu estado e não bloqueia arte entregue; sem retry nesta change.
7. Instrumentação, custo por tentativa, `IMG-001` e diagnóstico durável funcionam sem expor motivo interno.
8. B1b mantém flags/autorização `off`, nenhuma loja habilitada, sem chamada paga/`db push`/deploy.

## Dependências e fronteiras

- Depende da F56.2b1a fechada e verificada separadamente, incluindo aprovação documentada do gate de isolamento/schema; utiliza seu RPC transacional e autorização.
- F56.2b2 permanece responsável por retry de copy, E2E e piloto controlado autorizado.
- F56.3 continua aprovação/reprovação/correção.
- Proposta de tokens GSD: `56.2.2`; b1a `56.2.1`; b2 `56.2.3`. A numeração só será gravada no tracking após aprovação humana.

## Checkpoint

Revisão humana antes de implementação/plano GSD. Nenhuma loja habilitada nesta change.
