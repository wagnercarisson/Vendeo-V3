# Quick 261116-vpx — Expansão 9:16: preflight de pricing antes da base

**Data:** 2026-11-16
**Base:** `main` @ `ae5d0e79b176d6d8716d74fca2315ee27bbb67b2`
**Escopo:** correção local do bloqueio produtivo da expansão 9:16. Sem
migration, banco/Storage/produção, pricing, flags, chamada paga, push ou deploy.

## Causa reproduzida

Campanha `c1c0448d-6603-4847-bc73-5b3e03878084`: base e copy geradas,
`square_prepared` persistido, expansão falhou com
`pricing_unavailable / incomplete_coverage / missing: ["image_unit_usd"]` e a
operação foi estornada.

A linha de pricing do alvo tinha as tarifas de tokens aplicáveis completas, mas
`image_unit_usd = NULL`. O gate pré-chamada tratava a estimativa por unidade
como se fosse cobertura de usage, bloqueando um cálculo que, no protocolo
`images.edit`, é feito por tokens.

## Decisão

1. **Cobertura de usage ≠ estimativa pré-chamada.**
   - A cobertura exige apenas as tarifas aplicáveis ao cálculo por usage
     (entrada/cache textual, entrada/cache/saída de imagem; saída textual só
     quando aplicável).
   - `image_unit_usd` passa a ser avaliado separadamente. Ausente/zero/negativo
     ⇒ estimativa `null`/indisponível, nunca zero, cópia de outra linha, valor
     inventado ou custo efetivo.
   - O custo efetivo continua sendo usage real × tarifas; sem usage/tarifa
     suficiente permanece `null`/`not_available`.
   - Nenhuma política nova de orçamento foi inventada: no fluxo 9:16 ativo o
     controle de gasto é a reserva de 1 crédito. O harness de prova da F60.3
     continua sem estimativa (e portanto sem orçamento pré-calculado) quando
     `image_unit_usd` está ausente.

2. **Preflight antes da primeira chamada paga.**
   - Modelo + tarifas de usage são verificados em modo read-only antes da
     reserva de uma geração nova e antes de uma nova chamada paga da base numa
     continuação.
   - **Configuração comprovadamente ausente/incompleta** impede
     reserva/tentativa/provider de base, copy e expansão; numa continuação já
     reservada, encerra com estorno único e projeção de encerramento.
   - **Erro/indeterminação de leitura** (catálogo ou pricing) é distinto:
     bloqueia novas chamadas, mas numa continuação reservada não adquire etapa,
     não chama provider, não registra desfecho `failed` e não estorna; a
     operação permanece recuperável para uma leitura seguinte.
   - Replay/consulta, retomada de etapa concluída e entrega de vertical já
     comprovado não executam o preflight e não dependem do pricing atual.
   - Os leitores compartilhados do caminho legado mantêm o comportamento
     fail-open; a distinção de leitura existe apenas no resultado estrito do
     preflight.

3. **Diagnóstico seguro.**
   - `pricing_unavailable`, `model_unavailable` e
     `configuration_read_failed` são classificações distintas de falha do
     provider.
   - O motivo fechado é registrado em log de pipeline com a referência de
     suporte persistida no desfecho (`support_reference`).
   - Nenhum segredo, payload, prompt, URL ou evento de chamada fictício.
   - Nenhum código público de suporte foi criado/alterado; a convenção
     `docs/convencoes/codigos-de-erro-suporte.md` foi lida.

## Fora de escopo / limites

- Não reabre a F60.5 nem altera a flag produtiva (permanece desligada).
- Não corrige nem reexecuta a campanha estornada.
- Não altera `ai_model_pricing`, pricing, catálogo, homolog ou produção.
- Não cria migration nem tabela de suporte.
- A validação é local/offline; ativação, push, deploy e validação produtiva
  continuam gates separados e não autorizados nesta rodada.
