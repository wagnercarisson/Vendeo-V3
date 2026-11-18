# Quick 261118-sqr — Plano documental: reconciliar o handoff do estorno do quadrado

**Data:** 2026-11-18
**Base:** `feat/fase-60-7-entrega-conjunta-1-1-e-9-16` @ `9f30e0ee`
**Escopo:** **exclusivamente documental.** Nenhum módulo, teste, SQL ou migration é criado/alterado nesta Quick.
**Solução aprovada:** Solução 1 — completar o handoff já previsto em A com as RPCs existentes. **Sem migration.**
**Distribuição:** as mudanças de implementação ficam nos planos `60.7-06/09/10`; esta Quick apenas os reconcilia e encerra a investigação.

## Resultado esperado

1. Os planos 06/09/10 deixam de tratar `finality_not_recorded` como comportamento final e passam a documentar:
   - `epoch → sonda → recordFormatOutcome(square,'failed') → refund`, com guarda de publicação/claim/terminal;
   - falha entre outcome e refund: estado seguro (`outcomeRecorded:true`), retry idempotente;
   - falha entre os dois estornos: `partial` retomável, sem `error` inferido;
   - corrida com entrega: revalidação SQL (`delivered_not_refundable`), sem promessa de detecção antecipada.
2. `60.7-B-CONTEXT.md` reflete o handoff e as janelas.
3. O OpenSpec (design, spec de crédito, tasks) registra o mesmo contrato, sem migration.
4. A reabertura de A é encerrada como omissão de handoff da B, preservando o aceite histórico.
5. A Quick é encerrada com SUMMARY; nenhum código/teste/migration.

## Task 1 — Reconciliar planos 06/09/10 e B-CONTEXT

**Files**
- `.planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-06-PLAN.md`
- `.planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-09-PLAN.md`
- `.planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-10-PLAN.md`
- `.planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-B-CONTEXT.md`

**Action**
1. Plano 06: base sem arte grava outcome `failed` do controle e do quadrado e estorna os dois; adicionar testes de janela (outcome→refund e entre os dois estornos) e de corrida; remover "bloqueio/remediação".
2. Plano 09: estorno do quadrado grava outcome `failed` após o guard e antes do refund; `unknown` bloqueia; falha entre outcome/refund retorna `outcomeRecorded:true`; auditoria só após sucesso.
3. Plano 10: mundo offline inclui outcomes e finalidade real; jornadas do quadrado verdes pelo handoff; adicionar janelas e corrida; nenhum fake presume refund.
4. B-CONTEXT: substituir 3a por handoff e 3a.1 por janelas; D12 base estorna os dois.

**Verify**
```
rg -n "remediação obrigatória|remedia..o obrigat|bloquead[oa] por `finality_not_recorded`" .planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-06-PLAN.md .planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-09-PLAN.md .planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-10-PLAN.md
```
→ zero ocorrências.
```
rg -n "recordFormatOutcome|outcomeRecorded|partial" .planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-0{6,9}-PLAN.md
```
→ presente.

**Done:** os planos não cristalizam o defeito e descrevem o handoff e as janelas.

## Task 2 — Reconciliar OpenSpec

**Files**
- `openspec/changes/f60-7-entrega-conjunta-formatos-1-1-9-16/design.md`
- `openspec/changes/f60-7-entrega-conjunta-formatos-1-1-9-16/specs/product-two-format-credit-billing/spec.md`
- `openspec/changes/f60-7-entrega-conjunta-formatos-1-1-9-16/tasks.md`

**Action**
1. `design.md`: documentar o desfecho durável do quadrado antes do estorno e as janelas de falha (D11/D12), sem migration.
2. Spec de crédito: cenários de handoff do quadrado, `unknown` imutável, falha entre outcome/refund, falha entre os dois estornos e corrida com entrega; cenário administrativo equivalente.
3. `tasks.md`: 3.7/3.14/3.16 mencionam o handoff e as janelas.

**Verify**
```
openspec validate --changes --strict
```
→ 1 passed / 0 failed.
```
rg -n "record_generation_outcome|delivered_not_refundable|parcial" openspec/changes/f60-7-entrega-conjunta-formatos-1-1-9-16
```
→ presente nos artefatos esperados.

**Done:** o OpenSpec está coerente com o handoff e com o tratamento das janelas.

## Task 3 — Encerrar a reabertura de A e a Quick

**Files**
- `.planning/phases/60.7-entrega-conjunta-formatos-1-1-9-16/60.7-A-REOPENING-SQUARE-REFUND.md`
- `.planning/quick/261118-sqr-estorno-quadrado-conjunto-f60-7/261118-sqr-SUMMARY.md`
- `.planning/STATE.md`

**Action**
1. Atualizar a reabertura: encerrada como omissão de handoff da B; contrato de A preservado; evidência local × validação de banco.
2. Criar SUMMARY da Quick com status `complete` (investigação/reconciliação), arquivos, verificação e limites.
3. Atualizar STATE: quick concluída na lista e nota de que o bloqueio anterior foi substituído pelo handoff; planos 06/09/10 reconciliados.

**Verify**
```
git status --short
git diff --check
openspec validate --changes --strict
```
→ apenas docs; diff limpo; OpenSpec válido.

**Done:** Quick encerrada documentalmente, sem código/SQL/teste/migration.

## Critérios de aceite

- [ ] Planos 06/09/10 e B-CONTEXT sem instruções que tratem `finality_not_recorded` como resultado final.
- [ ] Handoff `record_generation_outcome(square,'failed')` antes do refund documentado nos três planos e no OpenSpec.
- [ ] Janelas outcome→refund e entre os dois estornos documentadas com estado seguro/retry e `partial`.
- [ ] Nenhuma promessa de detecção antecipada; revalidação SQL e precedência de `delivered` preservadas.
- [ ] `unknown` imutável e bloqueante documentado.
- [ ] OpenSpec strict válido.
- [ ] Nenhum arquivo de código/SQL/teste/migration alterado nesta Quick.
- [ ] A reabertura encerrada como omissão de handoff da B, sem alterar o aceite de A.
- [ ] SUMMARY da Quick criado e STATE atualizado.

## Não objetivos

- Implementar o handoff (distribuído aos planos 06/09/10).
- Criar/alterar módulos ou testes de B nesta Quick.
- Migration nova, banco, provider, B/C, flags/pricing.
- Auditoria administrativa transacional e dívidas de teste preexistentes.

## Review Stop

Quick documental concluída. A implementação do handoff permanece nos planos 06/09/10 e exige autorização separada.
