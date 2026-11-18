---
status: complete
type: documentary
---

# Quick 261118-sqr — Summary

**Data:** 2026-11-18
**Escopo:** investigação + reconciliação documental do estorno do quadrado conjunto (F60.7).
**Resultado:** **Solução 1 aprovada e documentada** — completar o handoff já previsto em A com as RPCs existentes. **Nenhuma migration.** Nenhum código, teste ou SQL alterado.

## Diagnóstico

- `product_two_format_refund_format` chama `product_1_1_close_failed_operation` com a identidade da entrega; o quadrado usa `squareDeliveryId`.
- A autoridade exige outcome `failed` para o **mesmo** `operation_id`; a view de outcomes inclui `product_1_1_generation_outcomes` quando não há operação de duas etapas — o quadrado se enquadra.
- `product_1_1_record_generation_outcome` grava `failed` sem exigir tentativa/claim/provider; é idempotente e imutável (`unknown` não é sobrescrito).
- O handoff já estava documentado em `60.7-02-PLAN.md:210`; a B o omitiu e tratou `finality_not_recorded` como bloqueio permanente.

## Decisão

- **Sem migration.** A correção é documental: os planos 06/09/10 passam a executar `record_generation_outcome(square,'failed')` após o guard e antes do refund.
- **Janelas tratadas:** falha entre outcome e refund (`outcomeRecorded:true`, retry idempotente); falha entre os dois estornos (`partial` retomável, sem `error`); corrida com entrega resolvida pela revalidação SQL (`delivered_not_refundable`), sem promessa de detecção antecipada.
- **`unknown` persistido** bloqueia e nunca vira `failed`.
- **A preservada:** aceite histórico intacto; reabertura encerrada como omissão de handoff da B.

## Arquivos alterados (somente documentação)

- `.planning/phases/60.7-.../60.7-06-PLAN.md`
- `.planning/phases/60.7-.../60.7-09-PLAN.md`
- `.planning/phases/60.7-.../60.7-10-PLAN.md`
- `.planning/phases/60.7-.../60.7-08-PLAN.md` (bloco reservado ao serviço)
- `.planning/phases/60.7-.../60.7-B-CONTEXT.md`
- `.planning/phases/60.7-.../60.7-A-REOPENING-SQUARE-REFUND.md`
- `openspec/changes/f60-7-.../design.md`
- `openspec/changes/f60-7-.../specs/product-two-format-credit-billing/spec.md`
- `openspec/changes/f60-7-.../tasks.md`
- `.planning/quick/261118-sqr-.../261118-sqr-DIAGNOSIS.md`, `261118-sqr-PLAN.md`, este SUMMARY
- `.planning/STATE.md`

## Verificação

- `openspec validate --changes --strict` → 1 passed / 0 failed.
- `git diff --check` → limpo.
- `git status` → somente documentação.
- Busca por instruções de remediação/bloqueio final → zero.
- Nenhum módulo, teste, migration ou arquivo de `src/`/`supabase/` alterado.

## Limites preservados

- Nenhuma migration criada ou aplicada; migration de A continua **não aplicada**.
- Nenhum banco/homolog/Storage/provider; nenhuma chamada paga.
- B/C não executadas; flags/pricing intocados.
- A **não** é declarada corrigida por evidência offline; transações/concorrência/epoch reais permanecem no **Gate de banco**.

## Próximo passo

Implementar o handoff nos planos 06/09/10, mediante autorização separada. Nenhuma migration é necessária.
