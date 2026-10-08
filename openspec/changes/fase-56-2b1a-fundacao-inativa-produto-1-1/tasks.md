# Tasks — F56.2b1a Fundação inativa

> Checkpoint humano antes de implementação. Sempre `off`; nenhum formulário novo, geração ou download novo.
>
> **Fronteira do primeiro plano:** Plan 01 cobre somente diagnóstico HTTP 502 por leitura e gate de isolamento/schema. Não executa reset, migration, comando de escrita DB ou teste transacional. Se o gate não passar/concluir, interromper o plano e propor instância isolada nova. Tasks transacionais 4.5–4.6 ficam bloqueadas até o gate estar documentado como aprovado.

## 1. Diagnóstico e gate
- [ ] 1.1 Identificar instância descartável e registrar sua identidade/isolation boundary
- [ ] 1.2 Diagnosticar somente leitura serviços, rotas e logs sanitizados da anomalia exit 1 / HTTP 502; sem presunção de causa e sem reset
- [ ] 1.3 Registrar gate verificável de serviços/conectividade, schema, flags false e fixtures ausentes
- [ ] 1.4 Se inconclusivo, propor instância nova e validar identidade, serviços e schema antes de testar transação

## 2. Autorização e decisão de roteamento, sem ativação
- [ ] 2.1 Criar armazenamento dedicado com stage/scope/instance/grantor/timestamps/expiry/revocation/reason/operation_id e histórico append-only
- [ ] 2.2 Implementar API admin autenticada e RPC auditada para concessão/revogação; actor server-side, motivo/op_id obrigatórios, sem escrita direta
- [ ] 2.3 Manter autorização operacional em `off`; não permitir concessão de estágio habilitador nesta change
- [ ] 2.4 Validar a cada decisão escopo, instância permitida, validade, expiração e revogação
- [ ] 2.5 Ler ambas as flags; exigir somente a flag aplicável ao escopo mais autorização válida
- [ ] 2.6 Testar estágios por fixtures controladas em instância isolada + função pura/harness, sem chamar API/RPC de concessão ou rota/provider
- [ ] 2.7 Testar recusa operacional de concessão antes do gate b2, revogação, expiração, flags isoladas, leitura parcial e precedência geral

## 3. Proteção de submissão
- [ ] 3.1 Detectar campos exclusivos novos antes de qualquer reserva quando a decisão não autoriza o fluxo
- [ ] 3.2 Retornar erro seguro identificável sem fallback que descarte campos
- [ ] 3.3 Provar ausência de reserva/dedução em submissão recusada e preservar payload legado sem campos exclusivos

## 4. Operação atômica de crédito/estado
- [ ] 4.1 Definir identidade `campaignId + operation_id`, chave única e estados CAS `reserved → art_uploaded → delivered | refunded`
- [ ] 4.2 Implementar reserva temporária e criação do estado na mesma transação Postgres; falha reverte ambas
- [ ] 4.3 Demonstrar `reserved` reduz saldo disponível temporariamente; `delivered` finaliza consumo; `refunded` restaura saldo
- [ ] 4.4 Implementar idempotência/concorrência, reconciliação excepcional e bloqueio de estorno após `delivered`
- [ ] 4.5 **Bloqueada até gate 1.3/1.4 aprovado:** executar testes reais isolados: rollback, interrupção após reserva/upload, concorrência mesma/distinta identidade e worker × reconciliador
- [ ] 4.6 Consultar Postgres para provar ledger/saldo coerentes e ausência de dedução órfã após falha transacional
- [ ] 4.7 Rodar typecheck/lint/build e testes locais sem provider; registrar ausência de operação remota/paga

## 5. Fechamento b1a
- [ ] 5.1 Validar `openspec validate --strict` e matriz de rastreabilidade
- [ ] 5.2 Revisão humana da b1a; manter stage `off`; não iniciar b1b antes de verificação/fechamento independente
