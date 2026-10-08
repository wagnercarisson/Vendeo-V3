## Why

Separar a fundação de segurança/contabilidade transacional do núcleo entregável permite verificar autorização, incompatibilidade de payload e atomicidade antes de conectar formulário, geração ou download. Depende da F56.2a concluída/arquivada. Nenhuma ativação operacional nesta fase.

## What Changes

- Diagnóstico somente leitura do warning F56.2a (reset exit 1 / HTTP 502, causa desconhecida) e gate verificável de instância/schema antes de testes.
- Autorização independente durável, auditada, com estágio e escopo; instalada e mantida `off`.
- Leitura válida de ambas as flags; ativação exige uma flag aplicável ao escopo mais autorização vigente, não ambas as flags ligadas.
- Payload com campos exclusivos sem elegibilidade é rejeitado antes de crédito; payload legado mantém compatibilidade.
- RPC/operação Postgres atômica reserva temporariamente crédito e cria estado durável `campaignId + operation_id` na mesma transação; teste real de concorrência e rollback.
- Nenhum formulário de produção, geração, arte ou download novo.

## Capabilities

### New
- `product-1-1-campaign-credit-billing`: reserva/estado atômicos, identidade, idempotência, CAS, estados terminais e política de reconciliação.

### Modified
- `product-1-1-flow-activation`: autorização, flags aplicáveis, recusa de payload incompatível.

## Critérios de Aceite

1. Diagnóstico somente leitura e gate documentado; reset anterior permanece registrado como exit 1 / HTTP 502 sem causa presumida ou sucesso presumido.
2. Autorização em armazenamento dedicado server-side, concessão/revogação administrativa auditada, validade comprovada em cada decisão; estado inicial `off` e nenhuma concessão habilitadora operacional.
3. Ambas as flags são lidas validamente; basta a flag aplicável ao escopo mais autorização correspondente. Falha de leitura é fail-closed.
4. Campos exclusivos sem elegibilidade retornam erro seguro antes de crédito; payload legado sem tais campos permanece funcional.
5. `reserve_credit` reduz saldo temporariamente em `reserved`; somente transição para `delivered` finaliza o consumo; `refunded` devolve crédito. Reserva e estado durável commitam/revertem juntos.
6. Testes reais em instância isolada cobrem rollback da transação, falhas nas fronteiras, concorrência e CAS. Testes de estágios habilitadores usam dados controlados sem passar pela API/RPC operacional de concessão.
7. Nenhum formulário novo, geração/provider, novo download, ativação ou loja habilitada.

## Dependências e corte

- Depende da F56.2a arquivada.
- F56.2b1b depende desta change e integra formulário, geração, uso da operação atômica e download.
- F56.2b2 permanece responsável por retry de copy, E2E e piloto autorizado.
- Proposta de tokens GSD: b1a `56.2.1`; b1b `56.2.2`; b2 `56.2.3`. Não alterar tracking até aprovação da numeração.

## Gate de execução e fronteira com b1b

O primeiro plano GSD da b1a SHALL ser diagnóstico somente por leitura da anomalia HTTP 502 e comprovação do gate de isolamento/schema. Nenhum teste transacional começa antes de esse gate passar. Se ficar inconclusivo, o plano para e propõe nova instância descartável com identidade/serviços/schema validados. A b1b só pode iniciar após a b1a ser verificada e fechada separadamente.

## Checkpoint

Revisão humana antes de implementação/plano GSD. Sem migration remota, `db push`, chamada paga, commit ou deploy nesta reconciliação documental.
