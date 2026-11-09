# F60 / 60-04 — Revisão estática de segurança

**Status:** **SEM BLOQUEADOR DE SEGURANÇA IDENTIFICADO**; 60-04 tecnicamente aceito, com as quatro falhas globais conhecidas em acompanhamento separado.
**Método:** inspeção estática do SQL/TypeScript + evidência Postgres **reutilizada** da RUN 2 (26/26 PASS) e dos aceites 60-01/60-02.
**Conexão ao banco nesta fase:** **nenhuma**. `TEST_DATABASE_URL` não autorizou execução.

## 1. RLS, grants e superfície

| Item | Evidência | Veredito |
|---|---|---|
| RLS nas 4 tabelas novas | `20261109174110_f60_9_16_two_stage_control.sql:118-121` | **OK** |
| Apenas policy SELECT para `service_role` | `:123-137` | **OK** |
| `REVOKE ALL` de `PUBLIC/anon/authenticated` | `:139-142` | **OK** |
| `REVOKE ALL` de `service_role` e `GRANT SELECT` nas tabelas | `:144-152` | **OK** |
| Views de união: revoke público + `GRANT SELECT` service_role | `:263-269` | **OK** |
| Nenhuma policy/`GRANT` de escrita direta | inspeção de `:118-152`; nenhuma cláusula de INSERT/UPDATE/DELETE | **OK** |
| Superfície administrativa única | `route.ts:55,82-83` — `requireAdmin` + `requireSameOrigin`; sem rota nova | **OK** |

## 2. Funções `SECURITY DEFINER` e `search_path`

Funções novas/adaptadas no arquivo F60:

| Função | Linha | `SECURITY DEFINER` | `SET search_path = ''` |
|---|---|---|---|
| `product_abandon_residual_attempts` | `:275-282` | sim | sim |
| `product_9_16_open_operation` | `:321-329` | sim | sim |
| `product_9_16_acquire_step` | `:455-465` | sim | sim |
| `product_9_16_finish_step` | `:690-701` | sim | sim |
| `product_9_16_record_outcome` | `:783-793` | sim | sim |
| `product_9_16_resume_operation` | `:844-851` | sim | sim |
| `product_1_1_close_failed_operation` | `:984-990` | sim | sim |
| `admin_resolve_product_1_1_pending` | `:1039-1046` | sim | sim |
| `product_1_1_get_campaign_operation_by_campaign` | `:1209-1216` | sim | sim |

`trg_p916_outcome_immutable_fn` (`:155-160`) é função de trigger, sem `SECURITY DEFINER`; não é RPC pública. A RUN 2 já verificou `prosecdef=true` e `proconfig` contendo `search_path=""` nas seis funções cobertas pelo teste; a inspeção estática confirma o padrão nas demais.

Grants de execução: `:965-978` e `:1260-1272`; `product_abandon_residual_attempts` é revogada inclusive de `service_role` (`:314-315`).

## 3. Matriz por RPC — ordem real, garantia do banco × TypeScript

> A ordem **não é única**. `open/finish/record_outcome/resume/close` travam a linha de crédito primeiro; `acquire` e `admin_resolve` tomam advisory lock antes da linha de crédito.

| RPC / caminho | Travas, CAS e constraints reais | Garantia do BANCO | Verificação TypeScript | Risco residual |
|---|---|---|---|---|
| `product_9_16_open_operation` | **Primeira abertura:** o `SELECT ... FOR UPDATE` (`:343-346`) **não encontra linha financeira e, portanto, não trava nada**. A criação depende da inserção do controle com `UNIQUE(campaign_id, operation_id)` (`:35`), da reserva e da atomicidade da mesma transação (`:375-420`). **Replay:** com a linha já existente, o mesmo `SELECT ... FOR UPDATE` trava a linha de crédito e devolve o estado idempotente (`:348-372`). | atomicidade reserva+operação+etapas; identidade única impede segunda reserva; origem legada não é convertida (`:353-356`) | `reserveOperationOnce` confere `amount=1` lendo a autoridade (`financial-service.ts:152-158`); cliente não escolhe valor | primeira abertura sem lock de linha depende da unicidade/atomicidade; concorrência é resolvida pelo `ON CONFLICT`/unique e pela transação, não por um lock inexistente |
| `product_9_16_acquire_step` | advisory lock por `request_id` (`:488`) → `FOR UPDATE` na linha de crédito (`:490-493`) → valida terminal/unknown/failed (`:499-524`) → idempotência `request_id` (`:527-539`) → claim com `UNIQUE(campaign_id, operation_id, request_id)` (`:78`) e índice parcial de `in_progress` (`:101-103`) | uma execução ativa por operação; replay devolve o mesmo token; divergência de alvo/stage → `operation_identity_conflict`; limites de tentativa checados sob a trava (`:583-646`) | `TwoStageOperationClient.acquire` apenas envia parâmetros; bloqueios de UI/retomada são consumidores do resultado | se o TS for contornado, o banco ainda serializa e recusa conflito/limite; excesso de chamadas é limitado pelo cliente autenticado |
| `product_9_16_finish_step` | `FOR UPDATE` na linha de crédito (`:723-726`) → `FOR UPDATE` na claim (`:743`) → CAS por `attempt_token` + status esperado; terminal/unknown recusados (`:728-736`) | CAS impede transição com token divergente; terminal prevalece; `expected_status` validado (`:713-714`) | cliente envia token/status; nenhuma decisão financeira no TS | bypass TS não altera o CAS; token é necessário |
| `product_9_16_record_outcome` | `FOR UPDATE` na linha de crédito (`:805-808`) → insert `ON CONFLICT` (`:815-821`) → equivalente/divergente (`:827-840`); trigger BEFORE UPDATE/DELETE (`:166-168`) | desfecho único por operação (`UNIQUE :94`), imutável; `unknown`/`failed` não duplicam | `recordOutcome` apenas transporta `stage/outcome/support_reference` | bypass TS não permite duplicar; update/delete bloqueado por trigger |
| `product_9_16_resume_operation` | `FOR UPDATE` na linha de crédito (`:868-871`) → leitura de steps/desfechos; sem escrita de execução | resume não autoriza nem muta; decisão baseada em linhas persistidas | `resume` é usado por `confirmOnVerticalDelivery` para bloqueio/etapas (`financial-service.ts:199-205`) | bypass TS não transforma resume em mutação; não há efeito financeiro |
| `product_1_1_close_failed_operation` | `FOR UPDATE` na linha de crédito (`:1001-1004`) → `refunded` idempotente (`:1007-1010`) → `delivered_not_refundable` (`:1012`) → fence/epoch/claims/outcome (`:1013-1029`) → estorno único | terminal e fence prevalecem; epoch exato; ausência confirmada; claims ativos bloqueiam; um estorno | `refundOnDefinitiveFailure` valida store e captura epoch ANTES da sonda (`financial-service.ts:250-277`); usa `artKind` real | vínculo de loja é TS-only; a RPC não recebe `store_id`. Chamador `service_role` poderia contornar o TS, mas a identidade campanha+operação e o fence continuam válidos. Risco aceito no backend confiável |
| `admin_resolve_product_1_1_pending` | advisory lock por `resolution_operation_id` (`:1083`) → `FOR UPDATE` na linha de crédito (`:1088`) → auditoria/idempotência → efeito terminal | identidade global da resolução; auditoria única; conflito explícito; evidência de forma validada (`:1064-1081`) | `resolveUnknown` exige ator/identidade, sonda vertical e projeção com `expectedArtifactPath` (`financial-service.ts:318-382`); não aceita `evidence` do chamador | evidência é TS/server-derived; a RPC valida `origin=server-derived` e `art_kind`, mas não acessa Storage. `service_role` confiável pode forjar envelope; risco aceito e rastreado |
| `product_1_1_begin_publication` | `FOR UPDATE` na linha de crédito (`publication_fence.sql:50-51`) → terminal/fence (`:53-57`) → token/epoch (`:58-64`) | token de dono, fence `in_flight`, epoch incrementado | chamado pelo fluxo vertical antes da arte; token repassado à confirmação | nenhum caminho TS cria token; RPC é a autoridade |
| `product_1_1_mark_campaign_credit_art_uploaded` | `FOR UPDATE` (`:164-165`) → token de dono (`:168-171`) → idempotência `art_uploaded` (`:172-176`) → transição `reserved→art_uploaded` (`:177-180`) | token obrigatório; estado terminal/fence coerente; epoch | `confirmOnVerticalDelivery` exige sonda vertical e token (`financial-service.ts:207-229`) | bypass TS não dispensa token; sonda vertical é evidência de aplicação, não constraint SQL |
| `product_1_1_deliver_campaign_credit_operation` | `FOR UPDATE` (`:194-195`) → token antes do replay (`:197-201`) → `delivered` idempotente (`:202-206`) → `art_uploaded→delivered` (`:207-210`) | entrega única, token de dono, terminal | `confirmOnVerticalDelivery` faz `markArtUploaded` e `deliver` com o mesmo token (`:224-231`) | bypass TS não dispensa token nem permite segundo consumo; sonda/loja são verificações de aplicação |
| `product_abandon_residual_attempts` | helper interno, sem `FOR UPDATE`; assume chamador com C4 (`:286-289`); revogado inclusive de service_role (`:314-315`) | abandono de claims sob a trava de quem chama; sem EXECUTE público | usado somente pelo caminho administrativo autorizado | se executado como owner, não re-trava; risco controlado por grant e chamada interna |
| `product_1_1_get_campaign_operation_by_campaign` | leitura `STABLE`, sem lock; filtra campanha e usa views de desfecho | leitura consistente no snapshot; terminal prevalece | `queryProductOneToOneOperation` consome o envelope | leitura não muta; risco de leitura desatualizada é inerente ao snapshot |

### Observação obrigatória sobre a primeira abertura

`product_9_16_open_operation` **não tem lock de linha na primeira abertura**: o `SELECT ... FOR UPDATE` não encontra a linha financeira (ela ainda não existe) e não adquire trava. Nesse caminho, a garantia vem da **inserção com unicidade** (`uq_p916_operation_identity`), da **reserva executada na mesma transação** e da **atomicidade** da função — não de um lock preexistente. O replay, quando a linha já existe, é o caminho que efetivamente trava a linha de crédito. Esta revisão separa os dois caminhos e não atribui à primeira abertura uma trava que ela não possui.

## 4. Idempotência, fence e terminal

- `request_id` único: `:78`; replay idempotente e conflito em `:527-539`.
- `record_outcome` equivalente vs divergente: `:815-840`.
- `operation_identity_conflict`: `:359, 392, 534, 834, 1107`.
- `terminal` impede nova execução/entrega/estorno: `:499, 729, 811, 1007-1017`.
- Fence de publicação/token/epoch: `publication_fence.sql:50-64, 164-183, 194-213`; `close_failed_operation` revalida `in_flight/result_unknown/published` e `state_epoch` (`:1013-1016`).
- `credit_transactions`: não é tocada pela migration F60; somente comentários em `:15` e `:1310`. Nenhum INSERT/UPDATE/DELETE no código novo.

## 5. TypeScript × banco — separação explícita

Verificações **somente TS** (não são constraints do banco):
- vínculo de `storeId` em `confirmOnVerticalDelivery` (`financial-service.ts:176-182`) e `refundOnDefinitiveFailure` (`:250-254`);
- sonda vertical `9:16/1080x1920/jpeg` e path/ref (`:207-222`, `:344-356`);
- bloqueio `resume.action='blocked'`/`failedOutcome` (`:199-205`);
- origem canônica no repositório, exigindo sonda vertical (`pending-operations-repository.ts:343-355`);
- projeção administrativa com `expectedArtifactPath` (`financial-service.ts:334-382`).

Garantias **do banco**:
- locks `FOR UPDATE`, advisory locks, CAS por token, `UNIQUE`, FK/CHECK, trigger de imutabilidade, `SECURITY DEFINER`/`search_path`, grants/RLS, fence/epoch.

Riscos residuais registrados: (R1) loja/probe/projeção são verificações de aplicação; (R2) evidência administrativa server-side não é verificável pelo SQL; (R3) chamadores `service_role` são confiáveis por definição. Nenhum é BLOQUEADOR estático; todos exigem bypass do backend autenticado.

## 6. Veredito

- 10 itens de segurança revisados com evidência.
- Matriz por RPC entregue; nenhuma ordem única presumida.
- Nenhum **BLOQUEADOR** de segurança identificado.
- 60-04 **tecnicamente aceito**; suíte global `KNOWN_FAIL` pelas quatro falhas conhecidas em acompanhamento separado. Encerramento formal pendente de `/gsd-verify-work` e `/opsx-verify`.
