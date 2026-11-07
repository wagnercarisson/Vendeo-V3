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

- Caso D: encerrado para `error`; operação `refunded`; **auditoria da resolução
  idempotente não registrada** — recomendação de aceite nesta fase; aceite formal
  posteriormente registrado como exceção na reconciliação de 2026-11-06 (seção 15);
  RPC não alterada.
- Custo: **calculado por usage e pricing** (0,030441), não fatura; piloto 0,1107;
  desvio 0,080259; sem ajuste. Não é bloqueador.
- Gate de produção continua **não executado** por desenho.
- Reels: **aceito com ressalva observada no Facebook** (ver seção 9).

**Fora do escopo da F59:** proteção contra perda de dados no reload e distinção de
nova campanha (`59-OUT-OF-SCOPE-DATA-PRESERVATION.md`). A task 5.14 está reconciliada
com os cenários comprovados de formato/restauração; o comportamento ausente não é
marcado como implementado.
- Retries HTTP internos do SDK não são observáveis diretamente; a evidência é a
  contagem de invocações pagas.
- Este resultado foi posteriormente incorporado ao fechamento técnico da F59
  (ver seção 15).

## 8. Caso D — encerramento executado (com divergência de auditoria)

Estado anterior: campanha `e5ac1195-eb96-4076-b93c-06ec32962b88` em `generating`,
`error_message` nulo, operação `964c323b-c0c1-4249-974f-3f5386aa06a0` `refunded`,
`publication_state=none`, claim `failed`, zero artefatos.

Execução autorizada via `POST /api/admin/product-1-1-pending` com `refund_once`,
`resolutionOperationId` `dd7ddce5-2be4-47bd-b310-c0f87a6d72eb` e motivo auditável.
Resposta HTTP 200: `status=refunded`, `artifactKind=absent`, `idempotent=true`.

Verificação:

- campanha: **`error`**, mensagem “Esta geração foi encerrada e o crédito foi
  estornado.”;
- operação: permanece **`refunded`**; `refund_tx_id` `35ed3cde…` e `credit_tx_id`
  `c402b0c9…` inalterados;
- saldo: **0**; transações de crédito: **102** (sem nova);
- `paid_calls`: **0** (sem provider);
- campanhas sintéticas em `generating`: **0**;
- claims `in_progress`: **0**; créditos em aberto: **0**.

**Divergência:** a RPC retornou replay idempotente e **não inseriu nova linha em
`admin_audit_log`** para esta resolução. Não foi feito UPDATE direto nem inserção
manual de auditoria. O encerramento da campanha foi aplicado, mas o requisito de
“auditoria registrada” nesta chamada **não foi comprovado**.

**Diagnóstico:** em `admin_resolve_product_1_1_pending`, o bloco
`IF v_credit.status = 'refunded' AND p_action = 'refund_once'` retorna
`success:true, idempotent:true` **antes** do `INSERT INTO admin_audit_log`. O replay
terminal é, por desenho, sem nova auditoria. O serviço ainda executa
`projectClosedCampaign`, por isso a campanha mudou para `error`.

Opções: (a) ajustar o mecanismo para auditar replay terminal idempotente (mudança
de código, exige autorização) ou (b) aceitar o `refund_tx_id`/ledger como evidência
do encerramento e registrar a lacuna de auditoria da projeção.

**Recomendação registrada:** aceitar explicitamente esta lacuna nesta fase como
exceção de rastreabilidade do replay administrativo, **não** como falha de estorno,
e corrigir em trabalho separado. A aceitação formal é do responsável e permanece
**pendente**; a lacuna não está marcada como resolvida.

## 9. Reels — análise conservadora de risco

Sobreposição local com a máscara conservadora antiga (topo 14%, base 35%, laterais
6%, recorte 324×768), **sem publicação e sem preview real de Reels**.

| Arte | Interseção observada |
|---|---|
| Bolo | Identidade no topo; validade na base; aviso vertical na base/lateral. |
| Pão de Queijo | Identidade no topo; “Pré assado”, “Rápido e prático” e validade na base; aviso sob o recorte de ações. |
| Pão Francês | Identidade no topo; base apenas com produto. |

**Classificação:** o responsável **aceitou Reels com a ressalva observada no
Facebook**. A máscara conservadora identifica risco, mas não é preview real nem
aprovação irrestrita. Stories FB/IG permanece aprovado separadamente. A quick
pós-F59 cobre apenas seletor, identificação na listagem e direção de fundo na
revisão; prompt congelado.

## 10. Operações em andamento

Confirmado no estado final: **0** claims `in_progress` e **0** créditos
`reserved/art_uploaded`. O caso D tem operação `refunded`, claim `failed`, campanha
`error` e nenhum artefato; não é operação em andamento.

## 11. Teste manual — revisão → edição durante mudança de flag

Executado em 2026-11-06 com acompanhamento do executor:

1. Flag ON, formato 9:16, dados preenchidos, avanço somente até a revisão.
2. Flag OFF auditada: `f6b4cb4a-b02a-4b56-aa86-e293aea1df08` (`true → false`).
3. “Voltar e editar” sem confirmar geração.
4. Resultado confirmado pelo responsável: **campos, imagens e formato 9:16
   preservados**; seletor mantido.
5. Flag ON restaurada: `427ce649-4f7c-4824-92e0-73d92e700ee6` (`false → true`).

O banner de pausa **não apareceu** na página já aberta. Isso é esperado:
`campaignFormatPaused` é calculado no servidor a cada carregamento de
`/campanhas/nova`; não há polling da flag. A ausência do banner nesse cenário não é
defeito e não foi usada como evidência de bloqueio.

Sem consumo: saldo permaneceu **10**, nenhuma campanha criada nos 10 minutos
seguintes e nenhuma chamada paga. O teste cobre preservação de dados na transição
revisão → edição; não substitui o teste de restauração a partir de rascunho.

## 12. Task 5.14 — cruzamento das evidências

| Evidência | Cobre |
|---|---|
| Retorno após saldo insuficiente | campos e formato preservados no retorno à tela de dados |
| Revisão → edição com flag OFF | campos, imagem e 9:16 preservados; sem troca para 1:1 |
| `restoreFrom` de campanha vertical com flag OFF | 9:16 preservado, aviso de pausa, sem troca para 1:1 |

**Cenário distinto ainda não coberto:** reload de um **rascunho local persistido**
(sessionStorage), não de uma campanha `restoreFrom`.

- **Ponto de entrada:** `/campanhas/nova` com flag ON; preencher 9:16 + imagem; ir
  à revisão; “Voltar e editar” (persiste o draft); recarregar a página.
- **Procedimento:** conferir restauração com flag ON; depois desligar a flag pela
  via auditada e recarregar o mesmo draft; conferir 9:16 preservado e bloqueio
  explicado, sem troca silenciosa para 1:1; restaurar a flag.
- **Critério de aprovação:** campos/imagem/9:16 restaurados; com flag OFF, submissão
  bloqueada com explicação (ou, no mínimo, rejeição server-side 503 sem troca de
  formato); nenhum crédito/provider.
- **Risco identificado:** `campaignFormatPaused` é calculado no servidor apenas a
  partir de `restoredForm`; um draft local não tem `restoredForm`, então a pausa
  visual pode não aparecer no reload com flag OFF.
- **Defeito confirmado por código (não executado em navegador):**
  1. O rascunho de campanha nova é salvo nas chaves globais
     `campaign_draft`/`campaign_draft_image` (`draftScope = null`).
  2. `CampaignPageClient` remove essas chaves globais em `useLayoutEffect` a cada
     montagem/reload, **antes** do `useEffect` de restauração do
     `useCampaignForm`. Portanto o reload apaga o draft antes de restaurá-lo.
  3. Mesmo que o draft sobrevivesse, `campaignFormatPaused` só é derivado de
     `restoredForm` no servidor; com draft local e flag OFF, não há banner nem
     bloqueio visual da submissão (o servidor ainda rejeitaria com 503).
- **Menor correção proposta (não editada):**
  - preservar as chaves globais no mount quando não houver `restoredForm`/escopo
    de campanha (o draft novo é justamente o global), mantendo a limpeza apenas
    para o caminho com snapshot server-side;
  - derivar no cliente um `formatPaused` a partir de
    `fields.campaignFormat === "9:16" && !verticalEnabled` (OR com
    `campaignFormatPaused`) e usá-lo no banner, no `disabled` do seletor e no
    botão de revisão.
- **Critério de aprovação após correção:** reload com ON restaura
  campos/imagem/9:16; reload com OFF mantém 9:16 e exibe bloqueio explicado, sem
  submissão nem crédito/provider.
- **Decisão de escopo:** esta proteção contra perda de dados no reload é **melhoria
  transversal fora da F59** (`59-OUT-OF-SCOPE-DATA-PRESERVATION.md`), não
  implementada. A task 5.14 fica reconciliada com os cenários comprovados de
  formato/restauração; o comportamento ausente não é marcado como implementado.

## 13. Recuperação com flag OFF — verificação técnica

- Nenhum dos caminhos `image-recovery`, `copy-recovery`, repositório de pendências,
  resolução administrativa, `projectDeliveredCampaign` ou `projectClosedCampaign`
  referencia `product_9_16_enabled`/`isProduct9x16Enabled`.
- Verificação em runtime: flag OFF auditada `ae4718a8-5697-4343-bae1-3041112f5c43`;
  `POST /api/campaign/557460a6…/image-recovery` retornou **200**
  `operation_terminal`/`delivered`/`integral`; flag ON restaurada
  `a87aa32b-eecd-4abb-a384-87d543a14d3f`.
- O cenário de operação **pendente** com flag OFF não foi executado porque não há
  operação pendente; a ausência de referência à flag nos caminhos indica que ele não
  é bloqueado. Se for exigida prova ponta a ponta, seria um caso sintético novo
  (1 crédito, sem provider).

## 14. Reconciliação de custo (dados existentes)

| Fonte | Copy | Imagem | Total |
|---|---|---|---|
| `pilot_paid_calls` (pré-chamada) | 0,0007 | 0,1100 | **0,1107** |
| `generation_events` / `admin_campaign_delivery_costs` (usage/pricing) | 0,000172 | 0,030269 | **0,030441** |

- `provider_reported_cost_usd`: **nulo** nas duas linhas; o custo pós-chamada é
  estimativa por usage/pricing table, não fatura do provider.
- Incremento efetivamente contabilizado no piloto: **0,1107**.
- Custo pós-chamada apurado: **0,030441**.
- Diferença a reconciliar: **0,080259** (o piloto ficou acima do usage apurado).
- Gasto do piloto: 2,1989; se reconciliado ao usage, seria 2,118641. Nenhum ajuste
  foi executado.
- Conclusão: **custo calculado por usage e pricing**, não valor confirmado em
  fatura (`provider_reported_cost_usd` nulo). O piloto registrou 0,1107; o usage
  calculado é 0,030441; desvio 0,080259, sem ajuste. O contador conservador do
  piloto não precisa ser alterado para fechar a fase.

## 15. Reconciliação de fechamento (2026-11-06)

- A F59 foi encerrada tecnicamente e em homologação no escopo 9:16; a quick
  `261106-qxn` foi concluída e aceita como pré-requisito de clareza da interface.
- Caso D: a lacuna de auditoria do replay terminal foi formalmente aceita como
  exceção de rastreabilidade em `.planning/issues/59-AUDIT-REPLAY-GAP.md`; não foi
  corrigida.
- Custo permanece **calculado por usage e pricing** (0,030441), não valor de
  fatura; o piloto registrado é 0,1107, com desvio documentado de 0,080259.
- As pendências deste resultado não são mais gates funcionais de homolog abertos.
  O gate de produção (deploy, migration data-only, ativação da flag, smoke e
  rollback) permanece **não executado** e exige autorização separada.
