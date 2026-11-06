# 59-10 — Plano mínimo dos gates restantes no homolog

Status: **proposta para aprovação; nada executado**. Escopo: homolog atual
(`127.0.0.1:57782`, app `127.0.0.1:3000`), somente lojas/registros de teste.
Nenhuma suíte antiga será executada. Nenhuma campanha/operação existente será
alterada.

## 1. Conclusão da investigação

Todos os gates restantes podem ser feitos no homolog com dados sintéticos e, no
máximo, **uma** chamada real de imagem. Não é necessário criar outro ambiente.

| Gate restante | Pode no homolog? | Como |
|---|---|---|
| Recuperação vertical até detalhe/lista | sim | campanha/operação sintética + arte real no Storage + RPC de recuperação |
| Resolução administrativa vertical | sim | campanha/operação sintética + arte real + rota admin |
| `unknown` → `refunded` (estorno único) | sim | operação sintética sem arte + outcome `unknown` + resolução `refund_once` |
| Reenvio de operação existente | sim | somente leitura sobre campanha já entregue |
| Concorrência de rota / idempotência | sim | duas submissões simultâneas com a mesma identidade; 1 crédito, 1 chamada de imagem |
| Geração em andamento + flag OFF | sim | combinar com a corrida: desligar a flag quando a chamada de imagem aparecer |
| Concorrência SQL de crédito/tentativa | sim | duas conexões Postgres, sem provider, com reserva/estorno de teste |
| Reels/overlays | sim (manual) | revisão visual; sem escrita |

## 2. Alvos e dados sintéticos

- Loja: **Padaria da Esquina** `48b212f8-2b0f-4679-b553-122a601bacac`
  (`is_test_store=true`; o dono `1273d07b…` também é admin — **uma sessão serve
  para loja e admin**).
- Campanhas sintéticas: 4 no total, IDs novos, `product_name` prefixado
  `F59 teste — ...`, `input_snapshot` derivado de uma campanha v14 existente
  (mantém `frozenContentReferences`, `campaignFormat=9:16`,
  `formatContractVersion`), sem tocar nos registros originais.
- Arte sintética: JPEG 1080×1920 gerado localmente com `sharp`, enviado ao bucket
  `campaign-images` no path vertical determinístico.
- Imagem de produto para a corrida paga: JPEG 1024×1024 sintético, com
  `inputValidationOverride.productImageCheck="brief_review_confirmed"` para evitar
  a validação visual por IA. A qualidade visual é irrelevante; a campanha é
  removida ao final.

## 3. Créditos e custo

- Concessão: **3 créditos** para a Padaria via `admin_grant_credits` (auditado,
  motivo “F59 gates restantes”).
- Consumo previsto: 2 entregas sintéticas (recuperação + resolução), 1 corrida paga
  e 1 reserva SQL estornada. Sequência planejada devolve a reserva antes das
  entregas; **saldo final 0**, igual ao inicial.
- Custo máximo: **1 chamada de imagem** + 1 copy. Estimativa registrada:
  imagem até US$ 0,136; copy até US$ 0,002. **Máximo ~US$ 0,14**; esperado
  US$ 0,03–0,08.
- Teto atual: US$ 2,20; gasto 2,0882; margem 0,1118. Como a estimativa de imagem
  pode chegar a 0,136, o gate pode bloquear antes do provider.
  **Decisão necessária:** autorizar `product_1_1_pilot_set_cap` para **2,25**
  (auditado) durante a corrida e restaurar **2,20** depois — ou manter 2,20 e
  aceitar que a corrida paga pode não executar.
- Nenhuma compra, crédito real, ampliação permanente ou chamada fora do homolog.

## 4. Run A — recuperação, resolução e `unknown` (sem provider)

Sequência única, com 3 operações sintéticas:

| Caso | Estado inicial | Ação | Resultado esperado |
|---|---|---|---|
| A1 | `reserved` + arte vertical real | `POST /api/campaign/[id]/image-recovery` | `delivered`; campanha `ready` com path vertical; detalhe/lista |
| A2 | `reserved` + arte vertical real | `POST /api/admin/product-1-1-pending` `deliver_existing_art` | `delivered`; projeção vertical; detalhe/lista |
| A3 | `reserved`, sem arte, outcome `unknown` | `GET` admin mostra `unknown`; `POST` `refund_once` | `refunded`; uma única transição; novo `deliver_existing_art` recusado |

Efeitos: 2 créditos consumidos, 1 estornado; sem provider; `admin_audit_log` da
resolução. Cleanup conforme seção 7.

## 5. Run B — concorrência + geração em andamento (1 chamada paga)

1. Duas submissões **simultâneas** `POST /api/campaign/generate-image` com a mesma
   identidade nova (`campaignId`+`operationId`), flag ON, 1 crédito.
2. Quando aparecer `image_primary` em `product_1_1_pilot_paid_calls` (ou claim
   `in_progress`), desligar a flag pela via auditada.
3. Aguardar o terminal; religar a flag pela via auditada.
4. Evidência esperada: **uma** campanha, **uma** dedução, **um** `paid_call`,
   **um** evento de imagem; vencedor entregue; perdedor observa a operação (sem
   segunda chamada). A flag OFF **não** aborta a geração em andamento.
5. Se a geração terminar antes do OFF, registrar como **inconclusivo** para
   “em andamento” (sem retry automático).

Risco: janela de ~20 s do provider; se o gate de gasto bloquear, não há chamada.
Custo máximo já declarado na seção 3.

## 6. Run C — reenvio (somente leitura) e Run D — concorrência SQL

**Run C:** `POST /api/campaign/generate-image` com a identidade existente do Pão de
Queijo (`72ab9ddb…` / `b703b7c5…`, 9:16). Esperado: terminal `result`, sem
provider/crédito/escrita. Contagens inalteradas.

**Run D:** duas conexões Postgres sobre uma campanha/operação sintética:
- duas chamadas concorrentes a `product_1_1_reserve_credit_operation` com a mesma
  identidade → uma reserva, sem cobrança dupla;
- duas chamadas concorrentes a `product_1_1_acquire_attempt_start` → um único
  `acquired=true`;
- estornar a reserva de teste ao final.
Sem provider, sem Storage. É o teste **completo de concorrência SQL**; o Run B é o
**controle por execução**.

## 7. Limpeza segura

Somente IDs sintéticos. Ordem:

1. apagar objetos de Storage dos paths sintéticos;
2. apagar `product_1_1_generation_outcomes`, `attempt_claims`,
   `campaign_artifacts`, `campaign_credit_operations`,
   `snapshot_frozen_evidence`, `snapshot_content_binding`, `copy_state`,
   `copy_cancellations`;
3. apagar `image_generation_operations`, `generation_events`,
   `generation_rate_events`, `pilot_paid_calls` dos IDs sintéticos;
4. apagar as campanhas sintéticas (FK de `credit_transactions.campaign_id` vira
   `NULL`);
5. manter `credit_transactions` e `admin_audit_log` (append-only) como evidência;
   saldo final 0.

Nenhuma campanha/operação existente é tocada. A limpeza só ocorre **depois** de
capturar as evidências.

## 8. Checkpoints de aprovação

1. Concessão de 3 créditos e criação das 4 campanhas sintéticas.
2. Ajuste opcional do teto para 2,25 (e restauração para 2,20).
3. Execução da chamada paga única (Run B).
4. Limpeza dos registros sintéticos.

Sem aprovação, nenhuma escrita/crédito/provider é executado.

## 9. O que não será feito

- Executar as 15 suítes antigas ou as 5 suítes SQL antigas contra o homolog.
- Criar outro ambiente, runner ou migration.
- Alterar campanhas/operações existentes.
- Fabricar operações fora das RPCs oficiais.
- Conceder créditos além dos 3 declarados.
- Fazer mais de uma chamada paga.
- Encerrar a F59 ou promover gates não executados.
