# Quick 261118-sqr — Plano: restabelecer o estorno do quadrado conjunto

**Data:** 2026-11-18
**Base:** `feat/fase-60-7-entrega-conjunta-1-1-e-9-16` @ `9f30e0ee`
**Modo:** implementação futura, **após revisão explícita**. Esta rodada entrega apenas diagnóstico + plano.
**Solução:** **Solução 1** do diagnóstico — completar o handoff com as RPCs existentes. **Sem migration nova.**
**Custo:** 3 tasks pequenas; nenhuma chamada paga, banco, homolog, Storage ou provider.

## Resultado esperado

O estorno do quadrado passa a funcionar pelo caminho já previsto em `60.7-02-PLAN.md:210`:

```
epoch fresco → sonda de ausência → guard (vínculo/claim/publicação) 
  → product_1_1_record_generation_outcome(squareDeliveryId, 'failed')
  → product_two_format_refund_format(1:1, absent, epoch)
```

Sem sobrescrever `unknown`, sem tentativa/evento fictício e sem alterar a autoridade de A.

## Task 1 — Porta de outcome + handoff na falha conjunta

**Files**
- `src/lib/product-two-format/orchestration/joint-deps.ts`
- `src/lib/product-two-format/orchestration/finalize-joint-failure.ts`
- `src/lib/product-two-format/__tests__/finalize-joint-failure.contract.test.ts`

**Action**
1. Em `joint-deps.ts`, adicionar a porta `recordOutcome({campaignId, operationId, outcome, supportReference})` reutilizando `ProductOneToOneAttemptStartClient.recordOperationOutcome` (`src/lib/product-1-1/orchestration/attempt-start-client.ts:289`). A importação entra na mesma entrada de allowlist já existente para `joint-deps.ts` (par exato, sem prefixo).
2. Em `finalize-joint-failure.ts`, ampliar `readFormatStatuses`/a leitura de crédito para incluir `status`, `publicationState` e `stateEpoch`.
3. Ordem obrigatória por formato:
   - `unknown` persistido (`product_1_1_generation_outcomes.outcome='unknown'`) ⇒ **bloquear**; nunca tentar sobrescrever.
   - `delivered` ⇒ bloquear (`delivered_not_refundable`); `refunded` ⇒ replay idempotente.
   - `publicationState in ('in_flight','result_unknown','published')` ⇒ bloquear `publication_in_progress` **antes** de gravar o outcome.
   - Ler `getPublicationEpoch(squareDeliveryId)` **antes** da sonda; sondar ausência uma única vez; guard de vínculo/claim.
   - `recordOutcome({operationId: squareDeliveryId, outcome:'failed'})`; em `operation_identity_conflict` (unknown/outro outcome) ⇒ bloquear; em `operation_terminal` ⇒ bloquear/replay conforme status.
   - `refundFormat({format:'1:1', artKind:'absent', observedEpoch})` com o **mesmo** epoch.
4. Falha de base conjunta volta a estornar **os dois** formatos: para o controle, `recordOutcome('failed')` (duas etapas) antes do refund; para o quadrado, o handoff acima. Nenhum refund unilateral.
5. Falha de preparação/expansão continua estornando **somente** `9:16`.

**Behavior**
- Base definitiva sem arte: outcome `failed` do controle + outcome `failed` do quadrado, depois `refundFormat('9:16')` e `refundFormat('1:1')`; ambos `refunded`.
- Base com outcome `unknown` do quadrado: bloqueio `operation_identity_conflict`/`unknown`; zero refund.
- `publication_in_progress`: bloqueio antes do outcome; zero refund.
- Epoch velho: `evidence_stale`; zero refund.
- Replay: outcome `failed` idempotente; refund `refunded` idempotente; zero segundo efeito.
- Nenhuma chamada a `acquire`, provider, copy ou telemetria.

**Verify**
```
node node_modules/vitest/vitest.mjs run src/lib/product-two-format/__tests__/finalize-joint-failure.contract.test.ts
rg -n "recordOutcome\(|refundFormat\(" src/lib/product-two-format/orchestration/finalize-joint-failure.ts
npm run typecheck
```
**Done:** o quadrado tem desfecho durável gravado pela RPC existente antes do refund; `unknown` nunca é sobrescrito; replay não duplica.

## Task 2 — Handoff na resolução administrativa por formato

**Files**
- `src/lib/product-two-format/orchestration/resolve-joint-pending.ts`
- `src/lib/product-two-format/__tests__/resolve-joint-pending.contract.test.ts`

**Action**
1. Ampliar `readCreditStatus` para retornar `status`, `publicationState`, `stateEpoch`.
2. Na ação `refund` do formato `1:1`, depois do guard (vínculo completo, claim inativo, ausência comprovada, publicação inativa, epoch lido antes da sonda), gravar o outcome `failed` do `squareDeliveryId` e só então chamar `refundFormat('1:1')`.
3. Se o outcome existente for `unknown` ⇒ `block:"operation_identity_conflict"` (não sobrescrever). Se `operation_terminal` ⇒ `block`/replay idempotente conforme status.
4. Não mudar a auditoria (permanece após o sucesso, com a limitação já registrada) e não criar rota/UI.
5. O estorno do vertical continua exigindo finalidade compartilhada; sem finalidade, `block:"shared_operation_not_final"`.

**Behavior**
- Refund `1:1` feliz: ordem `epoch → sonda → outcome → refund → audit`; `auditInserts === 1`.
- `unknown` persistido: `block:"operation_identity_conflict"`, zero refund/auditoria.
- `publication_in_progress`/`evidence_stale`/`operation_in_progress`/`delivered_not_refundable`: bloqueio antes do outcome; zero refund/auditoria.
- Replay: uma única auditoria e um único efeito.
**Verify**
```
node node_modules/vitest/vitest.mjs run src/lib/product-two-format/__tests__/resolve-joint-pending.contract.test.ts
```
**Done:** resolução administrativa do quadrado usa o handoff existente, bloqueia `unknown` e mantém a auditoria idempotente.

## Task 3 — Testes de contrato reais, simulação fiel e documentação

**Files**
- `src/lib/product-two-format/__tests__/square-outcome.contract.test.ts` (novo)
- `src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts`
- `src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts`
- `src/lib/product-two-format/orchestration/__tests__/joint-admin-protection.integration.test.ts`
- `.planning/phases/60.7-.../60.7-06-PLAN.md`, `60.7-09-PLAN.md`, `60.7-10-PLAN.md`
- `.planning/phases/60.7-.../60.7-B-CONTEXT.md`
- `openspec/changes/f60-7-.../design.md`
- `openspec/changes/f60-7-.../specs/product-two-format-credit-billing/spec.md`
- `openspec/changes/f60-7-.../tasks.md`
- `.planning/phases/60.7-.../60.7-A-REOPENING-SQUARE-REFUND.md`

**Action**
1. **Teste estático novo** lendo o SQL real e afirmando:
   - `product_1_1_record_generation_outcome` aceita `failed` **sem** exigir tentativa/claim;
   - `UNIQUE (campaign_id, operation_id)` + trigger de imutabilidade (unknown não vira failed);
   - a view `product_generation_operation_outcomes_v` inclui `product_1_1_generation_outcomes` para a identidade do quadrado (sem linha de duas etapas);
   - `product_1_1_close_failed_operation` exige `outcome='failed'` do mesmo `operation_id` e checa publicação/epoch/claim/ausência;
   - o refund conjunta chama a autoridade com `v_delivery_operation_id` (identidade do formato);
   - nenhuma migration nova é necessária.
2. **Simulação offline fiel:** adicionar `product_1_1_generation_outcomes` ao mundo, fazer a simulação de `close_failed_operation` exigir outcome do mesmo `operation_id`, e adicionar a RPC `product_1_1_record_generation_outcome` com as mesmas recusas (`operation_terminal`, conflito `unknown`). A jornada do quadrado passa a ser verde **porque o handoff foi executado**, não por presunção do fake.
3. Jornadas: base sem arte ⇒ ambos `refunded`; `unknown` ⇒ bloqueio; publicação ativa ⇒ bloqueio; replay ⇒ sem duplicação; admin ⇒ refund do quadrado com auditoria única.
4. **Planos/documentação:** remover de 06/09/10 as instruções que tratam `finality_not_recorded` como comportamento final; documentar o handoff, a ordem e os bloqueios; atualizar o B context; esclarecer design/spec/tasks (3.7/3.14) sem criar migration; fechar a reabertura de A em `60.7-A-REOPENING-SQUARE-REFUND.md` com a distinção local × banco.
5. **Gates offline:**
```
node node_modules/vitest/vitest.mjs run src/lib/product-two-format/__tests__
node node_modules/vitest/vitest.mjs run src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts src/lib/product-two-format/orchestration/__tests__/joint-admin-protection.integration.test.ts
npm run typecheck
npm run lint
git diff --check
openspec validate --changes --strict
```
6. **Não** rodar DB/Docker/homolog/provider; **não** aplicar migration; **não** executar B/C; **não** alterar flags/pricing.

**Done:** testes offline provam a ordem e os bloqueios; a documentação não cristaliza mais o defeito; nenhuma migration foi criada.

## Critérios de aceite

- [ ] `record_generation_outcome(squareDeliveryId,'failed')` ocorre **antes** de `refundFormat('1:1')` e depois do epoch/sonda.
- [ ] `unknown` persistido bloqueia; nunca é sobrescrito por `failed`.
- [ ] `delivered` nunca estorna; `refunded` é replay idempotente.
- [ ] `publication_in_progress`/`evidence_stale`/`operation_in_progress` bloqueiam antes do outcome.
- [ ] Falha de base conjunta estorna os dois; falha de preparação/expansão estorna só o vertical.
- [ ] Nenhum `acquire`, provider, copy, telemetry ou tentativa fictícia é criado.
- [ ] Simulação offline reproduz a finalidade real; nenhum fake presume refund bem-sucedido.
- [ ] Planos 06/09/10 e OpenSpec refletem o handoff; `finality_not_recorded` deixa de ser "comportamento final".
- [ ] **Nenhuma migration nova**; a migration de A continua não aplicada.
- [ ] Provas de transação/concorrência/epoch real permanecem no **Gate de banco**.
- [ ] A reabertura é fechada como **omissão de handoff da B**, sem alterar o contrato de A.

## Não objetivos

- Corrigir a auditoria administrativa transacional (dívida separada).
- Corrigir as 7 violações pré-existentes do guard de não-ativação.
- Executar B/C, aplicar migration, acessar banco/provider, alterar flags/pricing.

## Review Stop

Esta rodada é **somente investigação e planejamento**. Nenhuma task acima foi executada.
Não iniciar a implementação, a migration, a B ou a C sem autorização explícita.
