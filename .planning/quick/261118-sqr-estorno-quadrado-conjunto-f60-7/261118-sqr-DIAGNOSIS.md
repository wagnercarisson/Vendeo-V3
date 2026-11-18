# Quick 261118-sqr — Diagnóstico: estorno do quadrado conjunto (F60.7)

**Data:** 2026-11-18
**Base:** `feat/fase-60-7-entrega-conjunta-1-1-e-9-16` @ `9f30e0ee` (worktree limpo)
**Escopo:** investigação e planejamento. **Nenhum código, SQL ou teste foi alterado.**
**Migrations aplicadas:** nenhuma. `20261118002139_f60_7_two_format_foundation.sql` segue **autorada e não aplicada**.

## 1. Veredito

O defeito **não é da autoridade SQL de A**. É uma **omissão de handoff no planejamento da B**:

- A própria `60.7-02-PLAN.md:210` registra o handoff: `product_1_1_close_failed_operation` exige que o desfecho `failed` da identidade da entrega já tenha sido gravado por `product_1_1_record_generation_outcome`; **B deve persistir esse desfecho antes de solicitar o estorno**.
- Os planos `60.7-06/09/10` não implementaram esse passo e transformaram `finality_not_recorded` em bloqueio permanente ("remediação de migration obrigatória"). Isso é contenção, não contrato.

**Solução escolhida:** completar o handoff com as RPCs existentes, sem migration. A alternativa de migration corretiva não tem necessidade técnica demonstrada (§5).

## 2. Cadeia real confirmada

1. `product_two_format_refund_format` (`supabase/migrations/20261118002139_f60_7_two_format_foundation.sql:889`) chama
   `product_1_1_close_failed_operation(p_campaign_id, v_delivery_operation_id, 'absent', p_observed_epoch, p_reason)`.
   Para o quadrado, `v_delivery_operation_id = squareDeliveryId` (vínculo `1:1`; `:764`, `:790-805`).
2. `product_1_1_close_failed_operation` (`supabase/migrations/20261109174110_f60_9_16_two_stage_control.sql:984`) exige:
   crédito `reserved|art_uploaded`; `publication_state NOT IN ('in_flight','result_unknown','published')`;
   `state_epoch = p_observed_epoch`; `p_art_kind='absent'`; nenhum claim `in_progress`; e
   **outcome `failed` para o MESMO `operation_id`** na view `product_generation_operation_outcomes_v` (`:1026-1030`), senão `finality_not_recorded`.
3. A view (`:234-247`) lê `product_1_1_generation_outcomes` quando **não existe** linha em `product_9_16_two_stage_operations` para aquele `(campaign, operation)`. O `squareDeliveryId` não tem operação de duas etapas (a operação de controle usa outro id), portanto **uma linha de outcome do quadrado é vista pela view**.
4. `product_1_1_record_generation_outcome` (`supabase/migrations/20261009000001_f56_2b1b_atomic_attempt_start.sql:392`) :
   - trava a linha de crédito do `(campaign, operation)` (`FOR UPDATE`);
   - recusa `delivered`/`refunded` com `operation_terminal` (sucesso `false`);
   - insere em `product_1_1_generation_outcomes` (`UNIQUE (campaign_id, operation_id)`, `outcome IN ('unknown','failed')`);
   - replay igual ⇒ `{success:true, idempotent:true}`; replay divergente ⇒ `operation_identity_conflict`;
   - **não exige tentativa, claim, provider, telemetria ou evento de geração**;
   - a tabela tem trigger de imutabilidade (`UPDATE/DELETE` recusados), logo um `unknown` persistido **não pode** ser sobrescrito por `failed`.
5. Cliente existente: `ProductOneToOneAttemptStartClient.recordOperationOutcome` (`src/lib/product-1-1/orchestration/attempt-start-client.ts:289-305`) já invoca essa RPC e tipa `operation_terminal` / `operation_identity_conflict` / sucesso idempotente.

**Conclusão da cadeia:** gravar `failed` para `squareDeliveryId` via a RPC existente, **antes** do `refundFormat("1:1")`, satisfaz a finalidade exigida pela autoridade. Nenhum artefato novo, nenhuma tentativa fictícia.

## 3. Comparação das duas soluções

### Solução 1 — completar o handoff com RPCs existentes (escolhida)

**Desenho:**
1. Ler o crédito do quadrado (status, `publication_state`, `state_epoch`).
2. Bloquear cedo: `delivered` ⇒ não estorna; `refunded` ⇒ replay idempotente (pular outcome, chamar refund); `publication_state in_flight|result_unknown|published` ⇒ `publication_in_progress`; epoch deve ser lido **antes** da sonda.
3. Sondar ausência do `square_original` (server-side) e aplicar o guard de vínculo/claim/evidência.
4. Gravar `product_1_1_record_generation_outcome(campaign, squareDeliveryId, 'failed', supportReference)`.
5. Chamar `refundFormat({format:"1:1", artKind:"absent", observedEpoch})` com o epoch lido antes da sonda.
6. Replay: outcome `failed` ⇒ idempotente; refund `refunded` ⇒ idempotente.

**Atende aos requisitos:**
- **Travas compartilhadas:** o refund continua travando campanha → vínculo → crédito compartilhado → crédito do quadrado; o outcome trava a linha do quadrado em transação própria, sem ciclo (não adquire campanha).
- **Ausência comprovada:** inalterada; a sonda continua obrigatória e `p_art_kind='absent'`.
- **Epoch:** lido antes da sonda; `record_generation_outcome` não altera `state_epoch`, então o valor continua válido para o refund.
- **Publicação:** o guard bloqueia `in_flight|result_unknown|published` **antes** de gravar o outcome, evitando finalidade órfã.
- **Execução ativa:** o guard bloqueia claim ativo antes do outcome/refund; a autoridade revalida sob a trava.
- **Idempotência:** outcome `failed` idempotente; refund idempotente; retry não duplica.
- **Resultado desconhecido:** se já existe `unknown`, o outcome `failed` retorna `operation_identity_conflict` e o serviço **bloqueia**; o `unknown` permanece imutável. Não há sobrescrita artificial.
- **Formato entregue:** `delivered` é bloqueado antes; a RPC também recusa `delivered_not_refundable`.
- **Resposta tardia:** após o refund, `record_generation_outcome`/`deliver` retornam `operation_terminal`; nada reabre.
- **Sem tentativa/evento fictício:** a RPC não cria claim nem telemetria.

**Custo:** dois RPCs em transações separadas (outcome → refund). É o **mesmo padrão aprovado** do fluxo 1:1 (F56.2b2b, decisão 4a: finalidade persistida no ponto de decisão terminal antes do fechamento). A não-atomicidade efeito↔finalidade já é conhecida e aceita; o refund continua fail-closed (`finality_not_recorded` se o outcome não existir).

### Solução 2 — migration corretiva da autoridade conjunta

**O que exigiria:** uma migration forward-only nova para `CREATE OR REPLACE` de `product_two_format_refund_format` (ou uma RPC auxiliar) que gravasse internamente o outcome do quadrado antes de `close_failed_operation`, ou que fizesse o fechamento do quadrado aceitar a finalidade da operação de controle.

**Por que não é necessária:**
- Duplicaria uma responsabilidade que já tem RPC própria e idempotente (`product_1_1_record_generation_outcome`).
- Alteraria/estenderia a autoridade aceita em A antes de a primeira migration sequer ser aplicada, criando uma segunda migration a ordenar no Gate de banco.
- O único ganho seria atomicidade outcome↔refund — um requisito **não** presente no contrato aprovado (o fluxo 1:1 aceita a mesma janela) e que o refund já falha fechado quando ausente.
- Exigiria novos testes estáticos e provas de banco, ampliando o Gate de banco sem necessidade demonstrada.

**Conclusão:** solução 2 rejeitada por ausência de necessidade técnica. Fica registrada como opção futura apenas se o Gate de banco comprovar uma corrida que a solução 1 não cubra.

## 4. Ajustes necessários (implementação futura)

| Área | Ajuste |
|---|---|
| `src/lib/product-two-format/orchestration/joint-deps.ts` | Expor a porta `recordOutcome({campaignId, operationId, outcome, supportReference})` reutilizando `ProductOneToOneAttemptStartClient.recordOperationOutcome` (mesma allowlist de import já existente). |
| `finalize-joint-failure.ts` | Antes do estorno do quadrado: ler estado (status/publicação/epoch), gravar `failed` na identidade `squareDeliveryId`, então `refundFormat("1:1")`. Falha de base volta a estornar os dois formatos. Remover o bloqueio `finality_not_recorded` como comportamento final. |
| `resolve-joint-pending.ts` | Mesmo handoff para o estorno administrativo do quadrado; guard antes da gravação; bloquear `unknown`/`operation_terminal`/publicação ativa; auditoria permanece após sucesso (fora do escopo ampliar auditoria). |
| `readCreditStatus` | Passar a ler `status`, `publication_state`, `state_epoch` (não só `status`). |
| Clientes/testes | Testes de ordem `epoch → sonda → outcome → refund`; `unknown` persistido bloqueia; `delivered`/`refunded`/`publication_in_progress` bloqueiam; replay idempotente. Teste estático confrontando a RPC/view reais (outcome sem tentativa; view inclui o quadrado; imutabilidade; finality). |
| Simulação offline (plano 10) | Incluir `product_1_1_generation_outcomes` + a checagem de finalidade por `operation_id`; a jornada do quadrado passa a ser verde **porque o outcome foi gravado**, não porque o fake presume sucesso. |
| Planos `60.7-06/09/10` | Remover instruções que cristalizam o bloqueio; documentar o handoff e a ordem; manter `finality_not_recorded` como falha de contrato (nunca deve ocorrer no caminho correto). |
| OpenSpec | Esclarecer no design/spec de crédito e na task 3.7/3.14 o handoff `record_generation_outcome(squareDeliveryId,'failed')` antes do refund; não criar migration. |
| `60.7-B-CONTEXT.md` | Substituir "remediação de migration obrigatória" por "handoff existente — solução 1". |
| A | Registrar reabertura pontual e **fechá-la sem mudança de contrato**: A está correto e delegou o outcome à B. |

## 5. Encerramento da reabertura de A

- **Item reaberto:** estorno do formato quadrado (cobertura de D12/3.7 e 3.14).
- **Conclusão:** o contrato de A está correto; a falha é a ausência do handoff na B.
- **Mudança em A:** **nenhuma** migration, RPC ou schema. Nenhuma alteração retroativa.
- **Evidência:** local/estática (SQL lido e confrontado com a view, a RPC de outcome, o cliente existente e o handoff já escrito em `60.7-02-PLAN.md:210`).
- **Não comprovado:** transações, locks, concorrência e comportamento real de `unknown`/epoch no PostgreSQL. Permanece no **Gate de banco**.
- **Não declarar A integralmente corrigida** por testes offline.

## 6. Fora de escopo (registrado)

- Auditoria administrativa transacional (janela efeito→audit) — dívida separada do plano 09.
- 7 violações pré-existentes do `non-activation.contract.test.ts` (F60.6) — dívida separada.
- B/C, migration apply, banco, provider, UI, flags/pricing.

## 7. Arquivos previstos para a implementação

- `src/lib/product-two-format/orchestration/joint-deps.ts` (modificar)
- `src/lib/product-two-format/orchestration/finalize-joint-failure.ts` (modificar)
- `src/lib/product-two-format/orchestration/resolve-joint-pending.ts` (modificar)
- `src/lib/product-two-format/__tests__/finalize-joint-failure.contract.test.ts` (ampliar)
- `src/lib/product-two-format/__tests__/resolve-joint-pending.contract.test.ts` (ampliar)
- `src/lib/product-two-format/__tests__/square-outcome.contract.test.ts` (novo teste estático)
- `src/lib/product-two-format/orchestration/__tests__/joint-journeys.integration.test.ts` (ajustar)
- `src/lib/product-two-format/orchestration/__tests__/joint-admin-protection.integration.test.ts` (ajustar)
- `src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts` (ajustar)
- `.planning/phases/60.7-.../60.7-06-PLAN.md`, `60.7-09-PLAN.md`, `60.7-10-PLAN.md` (corrigir)
- `.planning/phases/60.7-.../60.7-B-CONTEXT.md` (corrigir)
- `openspec/changes/f60-7-.../design.md`, `specs/product-two-format-credit-billing/spec.md`, `tasks.md` (esclarecer handoff)
- `.planning/phases/60.7-.../60.7-A-REOPENING-SQUARE-REFUND.md` (novo)

**Nenhuma migration nova está prevista.**
