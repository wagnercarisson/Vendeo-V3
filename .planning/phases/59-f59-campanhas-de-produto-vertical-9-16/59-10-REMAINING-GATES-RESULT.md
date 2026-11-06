# 59-10 — Resultado dos gates restantes no homolog

Data: 2026-11-06. Execução autorizada do plano `59-10-REMAINING-GATES-PLAN.md`
(revisão `2e450c54`), exclusivamente no homolog e na loja de teste
`48b212f8-2b0f-4679-b553-122a601bacac` (Padaria da Esquina, `is_test_store=true`).

## 1. Pré-checagem

| Item | Valor |
|---|---|
| Homolog | `supabase_db_vendeo-homolog`, PostgreSQL 17.6, `127.0.0.1:57782` |
| Flag | `product_9_16_enabled = true` |
| Saldo | 0 |
| Teto / gasto | 2,20 / 2,0882 (margem 0,1118) |
| Operações em andamento | 0 claims `in_progress`; 0 créditos `reserved/art_uploaded` |
| Config `new_flow` | `gpt-image-2.5-sunburst`/`medium` + `gpt-image-2`/`low` |
| Pricing | sunburst medium `0,044` → estimativa vertical `0,11`; gpt-image-2 low `0,042` → `0,105` |
| Registros sintéticos prévios | 0 |

Divergência registrada: a estimativa real (0,11/0,105) é **menor** que o teto
conservador de 0,136 usado no plano. O envelope de US$ 3,40 permaneceu suficiente;
nada foi alterado por isso.

## 2. Inventário executado

| Caso | Campanha | Operação | Reserva | Resultado |
|---|---|---|---|---|
| A1 recuperação | `557460a6-df7e-4b70-88ee-ce0f42085955` | `80237fbf-6f65-47d6-9ddb-f0707579e415` | 1 crédito | `delivered`, `ready`, path vertical |
| A2 resolução admin | `0ebdc3d4-3371-474d-b3f5-0d9fe3cddc16` | `51bbbec0-9fb9-48f2-8c51-034cd98de66b` | 1 crédito | `delivered`, `ready`, path vertical |
| A3 unknown | `11b56832-6515-4688-be2c-1f4327a62e19` | `38985059-1e87-4582-abdb-d5f79da8ac51` | 1 crédito | `refunded`; campanha `error` |
| B concorrência | `e09039ca-27c5-4efa-97b4-851884494f09` | `c55644d7-5f08-4f48-9267-835764a3c863` | 1 crédito | `delivered`, `ready`, path vertical |
| D concorrência SQL | `e5ac1195-eb96-4076-b93c-06ec32962b88` | `964c323b-c0c1-4249-974f-3f5386aa06a0` | 1 crédito | `refunded`; campanha `generating` (sem arte) |

## 3. Resultado por gate

| Gate | Resultado | Evidência |
|---|---|---|
| A1 — recuperação vertical até detalhe/lista | **PASS** | HTTP 200; `outcome=delivered`, `kind=integral`, 1080×1920; campanha `ready`; detalhe 200 com nome; lista presente |
| A2 — resolução administrativa `deliver_existing_art` | **PASS** | HTTP 200; `status=delivered`, `artifactKind=integral`; detalhe 200; lista presente |
| A3 — `unknown` → resolução administrativa explícita `refund_once` | **PASS** | GET admin mostrou `unknown=true`; POST 200 `status=refunded`, `artifactKind=absent`; novo `deliver_existing_art` ⇒ **409 `operation_terminal`**; status permaneceu `refunded` |
| B — concorrência de rota + idempotência | **PASS** | 2 submissões simultâneas, ambas 200; **1** campanha, **1** operação de crédito `delivered`, **1** claim `primary/done`, **1** `image_primary` + **1** `copy_initial`; sem fallback |
| B — geração em andamento + flag OFF | **PASS** | flag OFF aplicada após o surgimento de `image_primary`; geração concluiu `ready`; flag restaurada ON no `finally` |
| C — reenvio somente leitura | **PASS** | terminal `result`, `campaignUrl` da campanha; contagens inalteradas |
| D — concorrência SQL de reserva | **PASS** | duas chamadas concorrentes: uma `reserved`, uma `idempotent=true`; **1** linha, **1** débito |
| D — concorrência SQL de tentativa | **PASS** | duas chamadas concorrentes: uma `acquired=true`, uma `out_of_sequence`; **1** claim |
| D — estorno da reserva | **PASS** | `refunded`; saldo restaurado |

Os gates concorrentes acima passaram **nos cenários executados**. Isso não significa
que todas as suítes antigas de concorrência tenham sido executadas; elas não foram.

## 4. Créditos, saldo e custos

| Etapa | Ação | Saldo |
|---|---|---|
| 0 | concessão de 3 créditos | 3 |
| 1 | A3 reserva | 2 |
| 2 | A3 `refund_once` | 3 |
| 3 | D reserva | 2 |
| 4 | D estorno | 3 |
| 5 | A1 reserva + entrega | 2 |
| 6 | A2 reserva + entrega | 1 |
| 7 | B reserva + entrega | **0** |

- Concessão: `admin_grant_credits`, operação `1563e756-845a-4301-8251-e6428af1c464`, +3, auditoria `credit_grant`.
- Teto: `product_1_1_pilot_set_cap` para **3,40**, operação `5f6d2d00-7cc2-4859-a01b-f8e52982ffd9`; **sem restauração para 2,20**.
- Gasto antes: **2,0882**; depois: **2,1989**; delta **0,1107**.
- Run B: 1 `copy_initial` (0,0007) + 1 `image_primary` (0,1100) = **0,1107**. Esse valor é o **incremento contabilizado no piloto**, não o custo real do provider reconciliado por usage.
- Saldo final: **0**. Nenhum crédito adicional foi concedido.
- Invocações lógicas observadas: **1 imagem + 1 copy**. Retries HTTP do SDK **não são diretamente observáveis**; a contagem de `pilot_paid_calls` permaneceu em 1 por tipo, sem fallback.

## 5. Auditorias

| Ação | Operação | Resultado |
|---|---|---|
| Teto 3,40 | `5f6d2d00-7cc2-4859-a01b-f8e52982ffd9` | registrado em `product_1_1_pilot_cap_audit` |
| Concessão de 3 créditos | `1563e756-845a-4301-8251-e6428af1c464` | `credit_grant`, +3 |
| A3 `refund_once` | `3675c41c-e90d-4417-b598-888d0f8f680a` | `product_1_1_pending_resolution`, `refunded`, `absent` |
| A2 `deliver_existing_art` | `b9adee01-00f3-4da9-8519-aafa8a3e9e33` | `product_1_1_pending_resolution`, `delivered`, `integral` |
| Flag OFF no Run B | `fa71334e-812d-4f23-b0c8-394d9d63ce7e` | `true → false` |
| Flag ON no Run B | `2650e575-e20b-4b52-bb28-c082c83ee4ba` | `false → true` |

## 6. Estado final e preservação

- Flag: **ON** (estado inicial restaurado).
- Teto: **3,40**; gasto **2,1989**; margem **1,2011**.
- Saldo: **0**.
- Contagens finais: campanhas **91**, credit_ops **32**, claims **29**, outcomes **3**, generation_events **368**, paid_calls **54**, rate_events **29**.
- Campanhas de referência pré-existentes: 4 × `ready`, `updated_at` inalterado.
- Registros sintéticos **preservados**: 5 campanhas/operações, créditos, claims, outcomes, eventos, paid calls, artefatos e auditoria. Nenhuma linha financeira/operacional foi apagada.
- A campanha B foi criada pela rota e não carrega `input_snapshot.f59Test`; está identificada pelo nome `F59 teste - B concorrencia`, pela operação, pelo crédito e pelos paid calls. Não foi alterada após a entrega.
- D permanece `generating` (caso SQL-only, sem arte); operação `refunded`.
- A1/A2 não têm miniatura (artefato sintético inserido diretamente); não é requisito deste gate.
- Temporários locais criados nesta execução foram removidos. Nada foi apagado do banco ou do Storage.

## 7. Pendências

- Revisão visual de Reels/overlays: **executada e não aprovada** (ver seção 9).
- Caso D: campanha `generating` com operação `refunded`; encerramento proposto na
  seção 8, **não executado**.
- Gate de produção continua **não executado** por desenho.
- Retries HTTP internos do SDK não são observáveis diretamente; a evidência é a
  contagem de invocações pagas.
- A F59 **não** é encerrada por este resultado.

## 8. Caso D — proposta de encerramento (não executada)

Estado atual: campanha `e5ac1195-eb96-4076-b93c-06ec32962b88` em `generating`,
`error_message` nulo, operação `964c323b-c0c1-4249-974f-3f5386aa06a0` `refunded`,
`publication_state=none`, claim `failed`, zero artefatos.

Menor procedimento, pelo mecanismo existente:

1. `POST /api/admin/product-1-1-pending` com:
   - `campaignId` e `operationId` acima;
   - `action: "refund_once"`;
   - `resolutionOperationId` novo;
   - `reason: "F59 D - encerramento de projecao residual (59-10)"`.
2. O serviço chama a RPC auditada `admin_resolve_product_1_1_pending`; para operação
   já `refunded`, o replay equivalente é idempotente.
3. Em seguida, `projectClosedCampaign` altera **somente** `campaigns.status` de
   `generating` para `error` e grava `error_message` neutro.
4. Não toca crédito, `refund_tx_id`, ledger, artefatos, snapshots ou auditoria
   anterior; não chama provider.

Verificação esperada: campanha `error`; operação continua `refunded`; `refund_tx_id`
inalterado; nenhuma nova transação de crédito; uma nova linha de auditoria
`product_1_1_pending_resolution`; nenhuma operação em andamento.

Se o POST retornar conflito/terminal divergente ou a projeção falhar, parar e
informar. **Não executar atualização direta de banco.**

## 9. Reels — revisão com as artes existentes

Sobreposição local (sem publicação): topo 14% (269 px), base 35% (672 px), laterais
6% (65 px), ações 324×768 no canto inferior direito.

| Arte | Resultado |
|---|---|
| Bolo | Identidade no topo; validade na base; aviso vertical na base/lateral. **Não aprovado.** |
| Pão de Queijo | Identidade no topo; “Pré assado”, “Rápido e prático” e validade na base; aviso sob ações. **Não aprovado.** |
| Pão Francês | Identidade no topo; base apenas com produto. **Ressalva no topo.** |

Stories FB/IG permanece aprovado separadamente; Reels não herda esse aceite. As
correções ficam para a quick pós-F59; prompt congelado não foi alterado.

## 10. Operações em andamento

Confirmado no estado final: **0** claims `in_progress` e **0** créditos
`reserved/art_uploaded`. O caso D tem operação `refunded`, claim `failed` e nenhum
artefato; não é operação em andamento.
