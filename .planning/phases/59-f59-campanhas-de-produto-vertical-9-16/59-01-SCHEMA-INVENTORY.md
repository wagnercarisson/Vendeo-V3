# 59-01 — Inventário read-only de schema (Task 1.1 / D-19)

**Data:** 2026-11-04
**Escopo:** somente repositório (`supabase/migrations/**`, tipos e consumidores em `src/lib/product-1-1/**`).
**Método:** grep e leitura estática. Nenhuma conexão com banco, nenhum SQL executado, nenhuma
invocação de Supabase CLI. Nenhum arquivo de `supabase/migrations/**` foi alterado.

Evidência no formato `arquivo#linha`. Trechos SQL são citações, não scripts executáveis.

---

## 1. `product_1_1_campaign_artifacts`

Criação: `supabase/migrations/20261009000004_f56_2b1b_campaign_artifacts.sql#19`.

| Item | Evidência | Situação |
|---|---|---|
| Colunas `campaign_id`, `operation_id`, `storage_path`, `width`, `height`, `mime_type` | `20261009000004_f56_2b1b_campaign_artifacts.sql#21-27` | Presentes |
| `storage_path` único | `#23` | `storage_path TEXT NOT NULL UNIQUE` |
| Identidade por operação | `#28` | `UNIQUE (campaign_id, operation_id)` |
| Índice composto | `#31-32` | `(campaign_id, operation_id)` |
| CHECK de dimensões 1–8192 | `#24-25` | Aceita 1080 × 1920 |
| Trigger de imutabilidade (UPDATE/DELETE recusados) | `#35-48` | Imutável |
| RLS/grants somente leitura e inserção para `service_role` | `#50-60` | SELECT/INSERT |
| Coluna de formato | ausente em `#19-29` | **Não existe** |
| Restrição que impeça path vertical | ausente | Identidade é `(campaign_id, operation_id)`; o path é texto livre |

Consumidores que confirmam as colunas lidas/escritas: `src/lib/product-1-1/artifact/types.ts#13-18`
(`ProductOneToOneArtifactRef`) e `src/lib/product-1-1/artifact/artifact-store.ts#33-35`
(`ARTIFACT_SELECT_COLUMNS`, `ARTIFACT_SIZE`) e `#247-253` (insert com `storage_path`, `width`,
`height`, `mime_type`).

**Veredito:** compatível com o artefato vertical; a linha vertical grava `width = 1080`,
`height = 1920`, `mime_type = image/jpeg` decodificados dos bytes, sem qualquer coluna nova.

## 2. `product_1_1_campaign_credit_operations`

Criação: `supabase/migrations/20261008000002_f56_2b1a_product_1_1_campaign_credit.sql#24`.

| Item | Evidência | Situação |
|---|---|---|
| Estados `reserved`, `art_uploaded`, `delivered`, `refunded` | `#30` | CHECK exato |
| Identidade única | `#37` | `UNIQUE (campaign_id, operation_id)` |
| Um único crédito por entrega | `#36` | `CHECK (amount = 1)` |
| Reserva atômica (`reserve_credit` + linha `reserved`) | `#60` | RPC `product_1_1_reserve_credit_operation` |
| `reserved → art_uploaded` | `#165-203` | CAS idempotente |
| `art_uploaded → delivered` (terminal) | `#208-247` | CAS idempotente |
| Estorno único `reserved|art_uploaded → refunded` | `#252-284` | Recusa `delivered` |
| Leitura da operação | `#312` | `product_1_1_get_campaign_credit_operation` |
| Reconciliação excepcional | `#344` | `product_1_1_reconcile_campaign_credit_operations` |
| Dependência de formato | ausente | Nenhuma coluna/CHECK/RPC menciona formato |

**Veredito:** compatível. O vertical reutiliza exatamente esses estados e RPCs; nenhum tipo de
crédito, tabela ou RPC novo.

## 3. RPCs reutilizadas — assinaturas e evidência

| RPC | Assinatura | Evidência |
|---|---|---|
| `product_1_1_reserve_credit_operation` | `(p_store_id UUID, p_campaign_id UUID, p_operation_id UUID, p_amount INTEGER, p_metadata JSONB DEFAULT '{}')` | `20261008000002_...#60-66` |
| `product_1_1_mark_campaign_credit_art_uploaded` | `(p_campaign_id UUID, p_operation_id UUID)` | `20261008000002_...#165-168` |
| `product_1_1_deliver_campaign_credit_operation` | `(p_campaign_id UUID, p_operation_id UUID)` | `20261008000002_...#208-211` |
| `product_1_1_refund_campaign_credit_operation` | `(p_campaign_id UUID, p_operation_id UUID, p_reason TEXT DEFAULT 'refund')` | `20261008000002_...#252-256` |
| `product_1_1_acquire_attempt_start` | `(p_campaign_id UUID, p_operation_id UUID, p_target TEXT, p_attempt_number INTEGER)` | `20261009000001_...#131-136` |
| `product_1_1_finish_attempt` | contrato interno de conclusão de tentativa | `20261009000001_...#281` |
| `product_1_1_close_failed_operation` | `(p_campaign_id UUID, p_operation_id UUID, p_art_kind TEXT, p_reason TEXT)` | `20261015000001_...#45-50` |
| `product_1_1_begin_publication` | fence de publicação | `20261016000001_...#42` |
| `product_1_1_abort_publication` | aborta publicação antes do envio | `20261016000001_...#67` |
| `product_1_1_mark_result_unknown` | marca resultado desconhecido | `20261016000001_...#96` |
| `product_1_1_confirm_existing_art` | confirma arte pré-existente | `20261016000001_...#123` |
| `admin_resolve_product_1_1_pending` | `(p_actor_id UUID, p_campaign_id UUID, p_operation_id UUID, p_action TEXT, p_reason TEXT, p_resolution_operation_id UUID, p_evidence JSONB)` | `20261016000001_...#305-308` |

Payload de evidência da resolução administrativa (validação no banco):
`20261016000001_...#321-329` exige `origin = 'server-derived'`, `art_kind` em
`integral|absent|invalid|indeterminate`, `execution_ended` booleano e flags de autorização
opcionais. No TypeScript: `src/lib/product-1-1/pending/resolve-pending-operation.ts#179-190`
(`ServerDerivedEvidence`) e `#288-296` (montagem congelada).

**Declaração explícita:** o vertical **NÃO adiciona chave de formato** ao payload de evidência. O
RPC permanece bit a bit o mesmo; o formato é resolvido antes da chamada, pela leitura do
`campaigns.input_snapshot` no serviço.

## 4. `campaigns`

Criação: `supabase/migrations/20260708000001_create_campaigns_table.sql#6`.

| Coluna | Evidência | Situação |
|---|---|---|
| `status` | `#9` | `TEXT NOT NULL DEFAULT 'generating'` |
| `input_snapshot` | `#11` | `JSONB NOT NULL DEFAULT '{}'` |
| `storage_path` | `#16` | `TEXT NOT NULL` |
| CHECK de status | `#22` | `generating|ready|error` |
| CHECK de `error_message` | `#25` | exigido quando `status = 'error'` |

`input_snapshot` é `jsonb` livre: aceita `campaignFormat` e `formatContractVersion` como chaves
novas, sem migration. A ausência das duas chaves continua sendo o contrato histórico 1:1
(`src/lib/campaign/new-flow-marker.ts#27-41` já opera por presença de chave).

## 5. Tabelas de tentativa/resultado

| Tabela | Evidência | Observação |
|---|---|---|
| `product_1_1_generation_attempt_claims` | `20261009000001_...#48` | Identidade de tentativa por operação |
| `product_1_1_generation_outcomes` | `20261009000001_...#73` | Resultado append-only |

Não existe tabela `product_1_1_attempts`; os nomes reais acima são os usados pelo runtime. O
vertical reutiliza ambos sem alteração.

## 6. Riscos de reutilização

| Risco | Evidência | Veredito |
|---|---|---|
| CHECK de dimensão recusar 1080 × 1920 | `20261009000004_...#24-25` | **Compatível** (1–8192) |
| Imutabilidade impedir correção de linha vertical | `20261009000004_...#35-48` | **Compatível** (vertical nunca atualiza a linha; cria uma por operação) |
| Unicidade `(campaign_id, operation_id)` colidir com operação 1:1 | `20261009000004_...#28` | **Compatível** (a operação é única por campanha; não há duas entregas para a mesma operação) |
| `storage_path` único colidir com path 1:1 | `20261009000004_...#23` | **Compatível** (paths distintos: `product-9-16/.../art-1080x1920.jpg` × `product-1-1/.../art-1024.jpg`) |
| RPC de crédito depender de formato | `20261008000002_...#24-38` | **Compatível** (nenhuma coluna de formato) |
| `campaigns.input_snapshot` recusar chaves novas | `20260708000001_...#11` | **Compatível** (`jsonb` livre) |
| Payload de evidência exigir/recusar formato | `20261016000001_...#321-329` | **Compatível** (formato não entra no payload) |

## 7. Conclusão

**Nenhuma migration estrutural necessária.**

O seed data-only da flag global (`product_9_16_enabled`) é a única migration prevista na fase e
não altera schema, constraints, RPCs, grants ou linhas existentes (D-17/D-19). Ele não faz parte
deste plano e exige checkpoint próprio.

Nenhum impedimento foi encontrado no repositório. Se a aplicação local futura revelar divergência
entre estas citações e o banco real, o trabalho deve parar em decisão pendente com evidência, sem
contorno silencioso.
