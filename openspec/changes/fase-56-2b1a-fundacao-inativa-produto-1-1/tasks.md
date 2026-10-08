# Tasks — F56.2b1a Fundação inativa

> Checkpoint humano antes de implementação. Sempre `off`; nenhum formulário novo, geração ou download novo.
>
> **Fronteira do primeiro plano:** Plan 01 cobre somente diagnóstico HTTP 502 por leitura e gate de isolamento/schema. Não executa reset, migration, comando de escrita DB ou teste transacional. Se o gate não passar/concluir, interromper o plano e propor instância isolada nova. Tasks transacionais 4.5–4.6 ficam bloqueadas até o gate estar documentado como aprovado.
>
> **Reconciliação (2026-10-08; Plano 06 + revisão pós-auditoria):** tasks marcadas conforme implementação + evidência. **Evidência:** `56.2.1-01-GATE.md`, `56.2.1-VERIFICATION.md` (§3/§4), `56.2.1-05-TRANSACTION-EVIDENCE.md`, `56.2.1-GSD-UAT.md`, `56.2.1-SECURITY.md`. **Condições não acionadas estão identificadas como tal (sem inventar execução).** Esta reconciliação **não** executa sync/archive.

## 1. Diagnóstico e gate
- [x] 1.1 Identificar instância descartável e registrar sua identidade/isolation boundary — `56.2.1-01-GATE.md` §2
- [x] 1.2 Diagnosticar somente leitura serviços, rotas e logs sanitizados da anomalia exit 1 / HTTP 502; sem presunção de causa e sem reset — `56.2.1-01-GATE.md` §1
- [x] 1.3 Registrar gate verificável de serviços/conectividade, schema, flags false e fixtures ausentes — `56.2.1-01-GATE.md` (APPROVED 12/12)
- [ ] 1.4 Se inconclusivo, propor instância nova e validar identidade, serviços e schema antes de testar transação — **NÃO ACIONADA: gate 1.3 APPROVED (12/12) em 2026-10-08; nenhuma instância nova foi necessária (sem execução a inventar).**

## 2. Autorização e decisão de roteamento, sem ativação
- [x] 2.1 Criar armazenamento dedicado com stage/scope/instance/grantor/timestamps/expiry/revocation/reason/operation_id e histórico append-only — migration `20261008000001` + `stage-authorization-repository.ts`
- [x] 2.2 Implementar API admin autenticada e RPC auditada para concessão/revogação; actor server-side, motivo/op_id obrigatórios, sem escrita direta — RPCs `SECURITY DEFINER` + `route.ts`; escrita direta removida pela migration `20261008000003` (prova Postgres)
- [x] 2.3 Manter autorização operacional em `off`; não permitir concessão de estágio habilitador nesta change — RPC recusa estágio habilitador (`granted` com `stage <> 'off'` = 0)
- [x] 2.4 Validar a cada decisão escopo, instância permitida, validade, expiração e revogação — `authorization-decision.ts` + matriz estágio×escopo×ambiente
- [x] 2.5 Ler ambas as flags; exigir somente a flag aplicável ao escopo mais autorização válida — `decideProductFlowAuthorization`
- [x] 2.6 Testar estágios por fixtures controladas em instância isolada + função pura/harness, sem chamar API/RPC de concessão ou rota/provider — `authorization.contract.test.ts` + prova Postgres (off/recusa/replay/conflito/revogação)
- [x] 2.7 Testar recusa operacional de concessão antes do gate b2, revogação, expiração, flags isoladas, leitura parcial e precedência geral — testes do decision + auth RPC

## 3. Proteção de submissão
- [x] 3.1 Detectar campos exclusivos novos antes de qualquer reserva quando a decisão não autoriza o fluxo — `submission/exclusive-fields.ts` + guard em `generate-image/route.ts`
- [x] 3.2 Retornar erro seguro identificável sem fallback que descarte campos — `assert-submission-eligible.ts` (`new_flow_ineligible`)
- [x] 3.3 Provar ausência de reserva/dedução em submissão recusada e preservar payload legado sem campos exclusivos — `submission.contract.test.ts`

## 4. Operação atômica de crédito/estado
- [x] 4.1 Definir identidade `campaignId + operation_id`, chave única e estados CAS `reserved → art_uploaded → delivered | refunded` — migration `20261008000002`
- [x] 4.2 Implementar reserva temporária e criação do estado na mesma transação Postgres; falha reverte ambas — RPC `product_1_1_reserve_credit_operation` (insert-first + `reserve_credit` + `credit_reservation_missing_tx`)
- [x] 4.3 Demonstrar `reserved` reduz saldo disponível temporariamente; `delivered` finaliza consumo; `refunded` restaura saldo — provas Postgres
- [x] 4.4 Implementar idempotência/concorrência, reconciliação excepcional e bloqueio de estorno após `delivered` — provas Postgres (concorrência equivalente/distinta; `delivered_not_refundable`); reconciliação **adia** a resolução
- [x] 4.5 **Bloqueada até gate 1.3/1.4 aprovado:** executar testes reais isolados: rollback, interrupção após reserva/upload, concorrência mesma/distinta identidade e worker × reconciliador — Plano 05, Postgres real **17/17**
- [x] 4.6 Consultar Postgres para provar ledger/saldo coerentes e ausência de dedução órfã após falha transacional — `56.2.1-05-TRANSACTION-EVIDENCE.md` §4/§7
- [x] 4.7 Rodar typecheck/lint/build e testes locais sem provider; registrar ausência de operação remota/paga — `56.2.1-VERIFICATION.md` §1

## 5. Fechamento b1a
- [x] 5.1 Validar `openspec validate --strict` e matriz de rastreabilidade — `openspec validate --strict`: valid; `56.2.1-VERIFICATION.md` §3
- [x] 5.2 Revisão humana da b1a; manter stage `off`; não iniciar b1b antes de verificação/fechamento independente — `56.2.1-UAT.md` (`approved`, 2026-10-08T21:00:22Z; stage `off`; b1b/b2 não iniciados)
