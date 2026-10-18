---
id: 261018-enc
title: Alinhar a projeção da campanha ao encerramento persistido com estorno (Produto 1:1)
status: done
workflow: gsd-quick
scope: product-1-1-campaign-closure-projection
approval:
  by: revisor (Codex/usuário)
  date: 2026-10-18
  origin: pedido do responsável em 2026-10-18 (investigação + plano) — APROVADO com 3 ajustes dirigidos + redação do AC3
evidence: null
related:
  - .planning/quick/261017-cdi-investigar-dominancia-das-cores-do-produto-sobre-a-identidade-da-loja/261017-cdi-SUMMARY.md (§10 e §14, pendência 1)
  - src/lib/product-1-1/orchestration/project-delivered-campaign.ts
files_modified: []
---

# Quick Plan — 261018-enc — PLANEJADO / AGUARDANDO REVISÃO

> **Rodada de planejamento.** Nada foi implementado, nenhum dado/flag/autorização/
> migration/env/produção alterado, nenhum commit/push. Este artefato é a peça para
> revisão (usuário + Codex) antes de qualquer execução.

---

## 1. Problema e causa

A entrega confirmada do novo fluxo já é projetada em `campaigns` pelo helper
idempotente `projectDeliveredCampaign`
(`src/lib/product-1-1/orchestration/project-delivered-campaign.ts`): quando a
operação está persistida `delivered` + vínculo loja/campanha/operação/arte, ele
grava `campaigns.status='ready'` + o caminho real da arte.

**Lacuna:** encerramentos com **estorno confirmado** (`product_1_1_campaign_credit_operations.status='refunded'`)
NÃO têm projeção. A campanha permanece `campaigns.status='generating'` e, como
`listCampaigns` filtra `status ∈ ('ready','error')`
(`src/lib/campaign/list.ts:60,67-71`; `src/lib/campaign/search-params.ts:12`;
`src/lib/campaign/metrics.ts:14,58`), ela **desaparece do histórico** do lojista.

- Página de **detalhe** NÃO depende de `campaigns.status` para o novo fluxo: usa o
  marcador persistido `frozenContentReferences` (`classifyCampaignFlow`) + a
  operação (`mapNewFlowDisplayState`), então `refunded → RefundedPanel`
  (`src/app/(app)/campanhas/[id]/page.tsx:87,101-202`). A lacuna é **só a listagem**.
- Já registrada como pendência conhecida e **não autorizada/ampliada** na
  quick `261017-cdi` (§10 lacuna; §14 pendência 1): “terminais de falha/estorno
  não têm projeção”.

## 2. Caminhos de encerramento com estorno (confirmados por leitura)

Há **três** classes de encerramento; só as confirmadas-por-estado persistido
geram `refunded`:

| # | Caminho | Arquivo / função | Dispara estorno? | Estado persistido |
|---|---------|------------------|------------------|-------------------|
| A | **Automático** (falha definitiva) | `generation-orchestrator.ts` → `settleConfirmedFailure` (`:872-967`), chamada terminal `:1576-1587` (`reason:"generation_failed"`) | Sim, quando `p_art_kind='absent'` + `outcome='failed'` persistido + decisão terminal → `credit.closeFailedOperation` → `refunded` | `product_1_1_generation_outcomes.outcome='failed'`; `...credit_operations.status='refunded'` |
| B | **Resolução administrativa** (abandono autorizado) | `pending/resolve-pending-operation.ts` → `resolvePendingOperation` (`:207-358`), chamada via `src/app/api/admin/product-1-1-pending/route.ts:69-106` (`authorizeAbandon:true`, `authorizePublicationClosure:true`) | Sim (`action='refund_once'`), com evidência server-side `absent` + marca `authorized_abandon` | `status='refunded'`; `admin_audit_log(action='product_1_1_pending_resolution', reason)`; claim residual → `abandoned` |
| C | **Encerramento de publicação inconclusiva (administrativo autorizado)** | mesma resolução (`authorizePublicationClosure`) | Sim, quando `publication_state ∈ ('in_flight','result_unknown')` — **nunca `published`** | `status='refunded'`; `publication_state` preservado |
| D | **Reconciliação** | `credit-operation/credit-operation-client.ts:322-350` → RPC `product_1_1_reconcile_campaign_credit_operations` | **NÃO** (apenas ADIA; sem estorno) | lista operações incompletas antigas |
| E | **Recuperação de arte** | `artifact/artifact-recovery.ts` → `recoverDelivery` (`:256-329`) | **NÃO** (`absent` não fecha/estorna; `refunded` é terminal e não é marcado pronto) | — |

**Distinção exigida (falha confirmada × abandono autorizado × inconclusivo):**

- **Falha confirmada (técnica):** única gravação de `outcome='failed'` em
  `generation-orchestrator.ts:1564-1574`, seguida de `closeFailedOperation` com
  `reason="generation_failed"`.
- **Abandono administrativo autorizado:** `admin_resolve_product_1_1_pending`
  (`supabase/migrations/20261015000002_*.sql`), gatilho único
  `p_evidence->>'authorized_abandon'='true'` (`:97,167-168,185-187,197-203`).
- **Inconclusivo:** `outcome='unknown'` / claim `in_progress` / `publication_state ∈ ('in_flight','result_unknown')`.
  BLOQUEIA (`operation_in_progress`/`execution_not_ended`/`publication_in_progress`);
  **não** produz `refunded` → **não projeta**.
- Invariantes preservados: `delivered` é terminal e **nunca** estorna
  (`delivered_not_refundable`); `published` **nunca** estorna.

**`campaigns.status='error'` no legado × novo fluxo:** o legado grava `error`+`error_message`
via `src/lib/campaign/persistence.ts:113-132` a partir da rota legada
`generate-image`; o novo fluxo **nunca** grava `error` hoje — só `projectDeliveredCampaign`
grava (`ready`). Constraints relevantes (`supabase/migrations/20260708000001_create_campaigns_table.sql`):
`CHECK status IN ('generating','ready','error')` (`:22`);
`CHECK (status <> 'error' OR nullif(trim(error_message),'') IS NOT NULL)` (`:24-25`);
`storage_path TEXT NOT NULL` (`:16`).

## 3. Escopo de dados (investigação SOMENTE leitura — executada)

Consulta read-only na instância local `vendeo-homolog` (`127.0.0.1:57781`; Postgres
`supabase_db_vendeo-homolog`, via `docker exec ... psql`):

- `product_1_1_campaign_credit_operations` por status: **`delivered` = 10** (nenhuma `refunded`).
- Join operação × campanha: **todas** `delivered`/`ready`.
- `campaigns` por status: `error = 3`, `ready = 66` (nenhuma `generating`).
- **Registros afetados (`op.status='refunded'` E `campaigns.status <> 'error'`): `0`.**

> Instâncias isoladas de teste (`vendeo-f562a-isolated`, etc.) contêm fixtures
> `refunded` (dados descartáveis de teste) — **fora do escopo** e não tratados.

**Conclusão:** **0 linhas afetadas** no ambiente real → **nenhum backfill/backfill-reparo
necessário nesta rodada.** Para reconferência posterior, o procedimento read-only é:

```sql
SELECT c.id, c.status, c.error_message, o.operation_id, o.status AS op_status, o.publication_state
FROM public.campaigns c
JOIN public.product_1_1_campaign_credit_operations o ON o.campaign_id = c.id
WHERE o.status = 'refunded' AND c.status <> 'error';
```

## 4. Plano (curto) — reutilizar o padrão do helper de entrega

**Princípio:** um único helper irmão no mesmo módulo de orquestração (sem novo
subsistema), com o mesmo formato de contrato/garantias de `projectDeliveredCampaign`:
deriva estado persistido → valida vínculo → atualiza a projeção de forma
condicional, idempotente e sem lançar.

### 4.1 Novo helper `projectClosedCampaign`
`src/lib/product-1-1/orchestration/project-closed-campaign.ts`

Assinatura de entrada: `{ storeId, campaignId, operationId, reason }` com
`reason: "confirmed_failure" | "authorized_abandon" | "publication_closure"`.
Dependências injetáveis (`client`, `log`) — igual ao helper de entrega.

Passos (espelhando `project-delivered-campaign.ts`):
1. Ler `product_1_1_campaign_credit_operations` por `(campaign_id, operation_id)`;
   exigir `status === 'refunded'` e identidade batendo; senão `operation_not_closed`.
2. Ler `campaigns`; exigir existência e `store_id === input.storeId`; senão
   `campaign_not_found` / `store_mismatch`.
3. **Entrega preservada:** se `status === 'ready'` → `delivery_preserved` (não
   sobrescreve). Ver §5 corrida.
4. **Idempotência:** se `status === 'error'` e `error_message === mensagem(reason)`
   → `already_projected` (sem update).
5. **Update condicional atômico** (uma instrução PostgREST):
   `update campaigns set status='error', error_message=msg where id=? and store_id=? and status='generating'`
   com `.select('id')` para detectar 0 linhas (⇒ `delivery_preserved`/`already_projected`/`projection_not_applied`).
6. NUNCA lançar: qualquer erro → `projection_update_failed`. NUNCA tocar
   `approval_status`, créditos, auditoria, snapshots, `storage_path` nem publicação.
   NUNCA disparar provider/retry/estorno/reclassificação.

Mensagens por motivo (não chamar abandono administrativo de falha técnica):
- `confirmed_failure`: "A geração não foi concluída e o crédito foi estornado."
- `authorized_abandon`: "Esta geração foi encerrada administrativamente e o crédito foi estornado."
- `publication_closure`: "A publicação não pôde ser confirmada; a operação foi encerrada e o crédito foi estornado."
- `closed_neutral` (fallback quando o motivo específico não é comprovável): "Esta geração foi encerrada e o crédito foi estornado."

**Ajuste 2 (revisão) — replays não trocam o motivo exibido.** Se a campanha JÁ
está `status='error'` (projeção válida anterior), o helper retorna
`already_projected` e **não** recalcula nem sobrescreve `error_message`, pois
`processing`/`publication_state` são transitórios e um replay administrativo pode
observá-los de forma diferente. O motivo só é gravado na PRIMEIRA projeção; na
dúvida (motivo não comprovável) a primeira projeção usa `closed_neutral`.

### 4.2 Chamadas nos caminhos confirmados
- **A — automático:** `generation-orchestrator.ts`, em `settleConfirmedFailure`,
  quando `closed === true` (`:954-964`), best-effort (`try/catch`), reason
  `confirmed_failure`.
- **B/C — administrativo:** `resolve-pending-operation.ts`, no ramo
  `action === 'refund_once'` com envelope confirmado `status === 'refunded'`
  (`:321-329`), best-effort, com dependência injetável (padrão já usado para
  `projectDeliveredCampaign` em `:148-157,333-348`). `reason`: `authorized_abandon`
  quando houve claim `in_progress` (`state.processing`); `publication_closure`
  quando `state.publicationState ∈ ('in_flight','result_unknown')`; caso contrário
  `authorized_abandon`.
- **D/E:** nenhuma chamada — reconciliação só adia; recuperação nunca estorna.
  Documentado como intencional.

### 4.3 Apresentação (lista + detalhe)
- **Detalhe:** já correto — `refunded → RefundedPanel`
  (`src/components/flow/refunded-panel.tsx`), mensagem honesta de "não conseguimos
  concluir … crédito estornado", sem "falha técnica". **Sem alteração.**
- **Lista:** a campanha passa a aparecer via `status='error'` (contrato),
  preservando os filtros atuais (nenhuma ampliação).
  - **Ajuste 1 (revisão) — opção recomendada aprovada:** rotular campanhas do
    **novo fluxo** encerradas com rótulo neutro (“Não concluída”) em vez do “Erro”
    genérico. A classificação é feita **no servidor** (`listCampaigns`), que envia
    ao card **apenas a classificação do fluxo** (`"new" | "legacy"`) — **nunca** o
    `input_snapshot` inteiro. O card
    (`src/app/(app)/campanhas/client.tsx:255-261`) escolhe o rótulo:
    `status==='error' && flow==='new'` ⇒ “Não concluída”; legado mantém “Erro”.
  - Reutiliza `classifyCampaignFlow` (`src/lib/campaign/new-flow-marker.ts`) sobre
    o marcador já persistido; `indeterminate` é tratado como legado para exibição
    (conservador, sem novo caminho).
- **Thumbnail sem arte:** com `status='error'`, `generateBatchThumbnailUrls`
  (`list.ts:158-186`) só assina itens `status==='ready'` → card recebe
  `thumbnailUrl=null` → placeholder cinza (`client.tsx:238-246`), **sem URL
  quebrada**. `storage_path` (determinístico `${storeId}/${campaignId}.jpg`,
  `persistence.ts:17`) não é reescrito nem fabricado. Coberto por teste.

### 4.4 Arquivos previstos
- `src/lib/product-1-1/orchestration/project-closed-campaign.ts` (novo).
- `src/lib/product-1-1/orchestration/generation-orchestrator.ts` (chamada + dep).
- `src/lib/product-1-1/pending/resolve-pending-operation.ts` (chamada + dep).
- *(opção de lista aprovada — Ajuste 1)* `src/lib/campaign/list.ts` e
  `src/app/(app)/campanhas/client.tsx` (classificação server-side + rótulo neutro).
- Testes: `src/lib/product-1-1/__tests__/project-closed-campaign.contract.test.ts`
  (novo) + ajustes em `orchestration.contract.test.ts`,
  `pending-resolution.contract.test.ts`, `src/lib/campaign/__tests__/list.test.ts`
  e teste de render do card.

## 5. Proteção contra corrida (explicitada)

- `delivered` e `refunded` são **mutuamente exclusivos** por operação (estados
  terminais; `delivered_not_refundable`), então `ready` e `error` não podem
  coexistir legitimamente para a mesma operação.
- A escrita é **condicional** (`status = 'generating'`), de modo que um evento
  atrasado de encerramento **nunca** reverte uma entrega confirmada (`ready`) para
  `error`, **nem sobrescreve um `error` JÁ gravado** por outra chamada concorrente.
- **Ajuste 3 (revisão) — corrida testada na ESCRITA, não só na leitura.** O teste
  simula a campanha tornando-se `ready` **entre** a consulta e o `UPDATE`; a
  condição atômica impede a reversão. O resultado separa dois desfechos:
  - **`delivery_preserved`** — a releitura pós-update comprova `status='ready'`
    (entrega confirmada preservada);
  - **`projection_not_applied`** — o `UPDATE` não casou nenhuma linha e a
    releitura NÃO mostra `ready` (nenhuma linha atualizada por outro motivo).
- **Ajuste 4 (revisão 2) — concorrência de `error`.** A condição atômica passa a
  projetar **somente a partir de `generating`** (`status = 'generating'`), de modo
  que um `error` JÁ gravado por outra chamada concorrente é preservado
  (`already_projected` na releitura), sem trocar a mensagem. Regressão dedicada:
  outra chamada grava `error` com motivo DIFERENTE entre a leitura e o UPDATE.
- O helper lê a operação e exige `refunded` **antes** de qualquer escrita, e um
  `projectDeliveredCampaign` concorrente exige `delivered` — sinais divergentes não
  se sobrescrevem.
- Repetir a projeção é seguro (`already_projected`, sem troca de mensagem — §4.1).

## 6. Migration

**Não necessária.** A projeção usa apenas `campaigns.status`/`error_message`
já existentes e satisfaz o `CHECK` (`error` ⇒ `error_message` não vazio). O update
condicional é uma única instrução atômica via PostgREST (sem RPC/coluna/índice
novos). Nenhuma mudança de schema, constraint ou RPC é requerida.

## 7. Testes previstos (simulados; banco local só se autorizado; sem geração paga)

1. **Encerramento automático confirmado** → `confirmed_failure`; campanha `error` + mensagem.
2. **Encerramento administrativo** → `authorized_abandon`; mensagem neutra.
3. **Encerramento de publicação inconclusiva autorizado** → `publication_closure`.
4. **Repetição idempotente** → 2ª chamada `already_projected`, sem novo update.
5. **Inconclusivo não projetado** (`unknown`/`in_progress`/`publication_state` inconclusivo ⇒ operação não `refunded`) → `operation_not_closed`, sem efeito.
6. **Entrega protegida contra evento atrasado** → campanha `ready` + operação `refunded` (simulado) ⇒ `delivery_preserved`, sem reversão.
7. **Vínculo divergente** (loja divergente / campanha ausente) ⇒ sem projeção.
8. **Falha de projeção** ⇒ resultado tipado; sem provider/retry/estorno/reclassificação.
9. **Lista + detalhe sem arte** ⇒ `thumbnailUrl=null` (placeholder, sem URL quebrada); detalhe → RefundedPanel honesto.
10. **Preservação** ⇒ `approval_status`, créditos, auditoria, snapshots históricos, legado intactos; “published nunca estorna”.

## 8. Critérios de aceite

- AC1: operação persistida `refunded` + vínculo correto ⇒ campanha aparece na lista (`status='error'`) com mensagem por motivo.
- AC2: `ready` nunca é sobrescrito por encerramento (corrida na escrita), um `error` já gravado nunca é sobrescrito por chamada concorrente, e `delivered` nunca é projetado como erro.
- AC3: **inconclusivo SEM encerramento confirmado não projeta erro** (`unknown`/`in_progress`/publicação inconclusiva **não terminal** ⇒ `operation_not_closed`). Em contrapartida, uma operação **administrativamente encerrada e persistida como `refunded` É projetada**, mesmo preservando um marcador histórico de publicação inconclusiva (`publication_state` inconclusivo).
- AC4: projeção idempotente, sem lançar e **sem trocar o motivo exibido em replays** (`already_projected` preserva `error_message`).
- AC5: falha de projeção não dispara provider/retry/estorno adicional nem reclassifica a operação.
- AC6: vínculo divergente não projeta.
- AC7: thumbnail sem arte = placeholder (sem URL quebrada); detalhe honesto.
- AC8: preserva créditos, auditoria, `approval_status`, snapshots, legado e “published nunca estorna”.
- AC9: filtros/`VALID_STATUSES` da lista inalterados.
- AC10: rótulo neutro “Não concluída” apenas para campanha de **novo fluxo** com `status='error'`; legado mantém “Erro”; o servidor envia somente a classificação (sem `input_snapshot`).

## 9. Gates

`npm run typecheck` 0 · `eslint .` 0 · `next build` exit 0 · testes focados
(novos + regressão das suítes tocadas) · guardas `legacy-frontier` e
`non-activation` verdes · `openspec validate --strict` válido (se alguma spec for
tocada) · `git diff --check` limpo. Sem geração paga, sem provider real, sem
flags/migrations/produção/deploy/push.

## 10. Riscos / resíduos fora do recorte (não incorporados)

- Campanhas **legadas** `error`/`ready` e a rota legada `generate-image`: intocadas.
- **Snapshots históricos** (ex.: Destaque “R$ 0,00”) e payloads antigos: intocados.
- **Reconciliação** (`reconcile`) permanece apenas “adia”; nenhuma mudança.
- **`campaigns.status='generating'` de operações `delivered` sem projeção** já foi
  tratado pela quick `261017-cdi`; este recorte cobre apenas o **encerramento com estorno**.
- Não há coluna persistida dedicada a “motivo do encerramento”; o motivo do
  caminho B/C é **derivado** do estado (`processing`/`publication_state`). Se o
  revisor exigir rastreabilidade do motivo no banco, isso é **mudança de schema
  fora deste recorte**.
- A decisão sobre o **rótulo da lista** foi **aprovada** (Ajuste 1): classificação
  server-side e rótulo neutro só para o novo fluxo; legado intacto.
- Não se alteram filtros da lista para “esconder” o problema (AC9).

## 11. Ajustes da revisão (2026-10-18) — incorporados

1. **Rótulo “Não concluída” (novo fluxo):** classificação do fluxo feita no
   servidor por `listCampaigns`; o card recebe **somente** a classificação
   (`"new" | "legacy"`), nunca o `input_snapshot`. Legado permanece “Erro”.
2. **Replays administrativos não trocam o motivo:** projeção válida anterior
   (`status='error'`) ⇒ `already_projected` sem recalcular/sobrescrever a
   mensagem; motivo não comprovável ⇒ `closed_neutral`.
3. **Corrida testada na escrita:** simula `ready` entre a consulta e o `UPDATE`;
   a condição atômica impede a reversão; `delivery_preserved` (releitura `ready`)
   × `projection_not_applied` (nenhuma linha, não `ready`) são distintos.
4. **AC3 reescrito:** inconclusivo sem encerramento confirmado **não projeta erro**;
   operação administrativamente encerrada e persistida `refunded` **é projetada**,
   mesmo com marcador histórico de publicação inconclusiva.
5. **Ajuste 4 (revisão 2, 2026-10-18):** condição atômica passa a `status = 'generating'`,
   preservando `ready` **e** `error` já gravado; releitura após 0 linhas mantém
   `delivery_preserved` / `already_projected` / `projection_not_applied`; regressão
   de concorrência com `error` de motivo diferente entre leitura e UPDATE.

## 12. Fora do escopo desta rodada

Implementação, alteração de dados, backfill, migrations, flags, autorizações,
env, produção, deploy ou push. Nada executado além de leitura e composição deste
plano. Contadores de fases/quicks encerrados **não** foram tocados; B2.3 não foi
reaberta.

---

**Status: EXECUTADO (2026-10-18) — ENTREGUE PARA REVISÃO.**
