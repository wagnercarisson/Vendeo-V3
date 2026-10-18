# Quick — 261018-enc — Alinhar a projeção da campanha ao encerramento persistido com estorno (Produto 1:1)

**Tipo:** implementação local (sem provider, sem banco de dados, sem migrations).
**Data:** 2026-10-18
**Escopo:** fluxo Produto 1:1 — projeção de `campaigns` após **encerramento confirmado com estorno**.
**Revisão:** plano aprovado em 2026-10-18 com 3 ajustes dirigidos + redação do AC3 (ver §4).
**Status:** EXECUTADO — **ENTREGUE PARA REVISÃO**.

---

## 1. Problema e causa

`projectDeliveredCampaign` (quick `261017-cdi`) já projeta a ENTREGA confirmada
(operação `delivered` → `campaigns.status='ready'`). Porém **encerramentos com
estorno** persistidos como `product_1_1_campaign_credit_operations.status='refunded'`
**não** eram projetados: a campanha permanecia `campaigns.status='generating'` e
desaparecia do histórico, porque `listCampaigns` filtra `status ∈ ('ready','error')`
(`src/lib/campaign/list.ts`; `search-params.ts`; `metrics.ts`).

Caminhos que produzem `refunded` (confirmados por leitura): (A) automático em
`generation-orchestrator.ts` → `settleConfirmedFailure` (falha definitiva com
`outcome='failed'` + ausência comprovada); (B/C) resolução administrativa
autorizada em `pending/resolve-pending-operation.ts` (abandono de claim residual
e/ou fechamento de publicação inconclusiva). Reconciliação (`reconcile`) apenas
**adia** e a recuperação de arte **nunca** estorna — ambos sem projeção (intencional).

## 2. Solução (reutilizando o padrão do helper de entrega)

Novo helper irmão, com as mesmas garantias de contrato/idempotência de
`projectDeliveredCampaign`:

- **`src/lib/product-1-1/orchestration/project-closed-campaign.ts` (novo)** —
  `projectClosedCampaign({ storeId, campaignId, operationId, reason? })`:
  1. exige operação PERSISTIDA `refunded` + identidade; senão `operation_not_closed`;
  2. campanha existe + vínculo de loja; senão `campaign_not_found`/`store_mismatch`;
  3. `status='ready'` ⇒ **`delivery_preserved`** (nunca sobrescreve entrega);
  4. `status='error'` ⇒ **`already_projected`** (preserva a mensagem; não recalcula);
  5. **UPDATE condicional atômico** `status='error' + error_message` com filtro
     `status = 'generating'`; 0 linhas ⇒ releitura distinguindo `delivery_preserved`
     (releitura `ready`), `already_projected` (releitura `error`, mensagem preservada)
     de `projection_not_applied`;
  6. **nunca lança** ⇒ `projection_update_failed`. NÃO toca `approval_status`,
     créditos, auditoria, snapshots, `storage_path` nem publicação.

- **`src/lib/product-1-1/orchestration/generation-orchestrator.ts`** — chama
  `projectClosedCampaign` (best-effort) quando `closeFailedOperation` confirma
  `refunded`, com `reason: "confirmed_failure"`; dependência injetável
  `projectClosedCampaign`.

- **`src/lib/product-1-1/pending/resolve-pending-operation.ts`** — chama o helper
  (best-effort) quando `refund_once` é confirmado (`status==='refunded'`); motivo
  derivado do estado: `authorized_abandon` (claim `processing`),
  `publication_closure` (`publicationState ∈ in_flight|result_unknown`) ou
  `closed_neutral` (não comprovável).

- **`src/lib/campaign/list.ts`** — classifica o FLUXO no servidor
  (`classifyCampaignFlow`) e expõe ao card somente `flow: "new" | "legacy"`
  (o `input_snapshot` NUNCA é enviado).

- **`src/app/(app)/campanhas/client.tsx`** — rótulo neutro **“Não concluída”** para
  `status='error' && flow==='new'`; legado mantém **“Erro”**.

## 3. Mensagens por motivo (nunca chamar abandono administrativo de falha técnica)

| Motivo | Mensagem (`error_message`) |
|--------|-----------------------------|
| `confirmed_failure` | A geração não foi concluída e o crédito foi estornado. |
| `authorized_abandon` | Esta geração foi encerrada administrativamente e o crédito foi estornado. |
| `publication_closure` | A publicação não pôde ser confirmada; a operação foi encerrada e o crédito foi estornado. |
| `closed_neutral` (fallback) | Esta geração foi encerrada e o crédito foi estornado. |

O **detalhe** permanece honesto e inalterado (`refunded → RefundedPanel`).

## 4. Ajustes da revisão — incorporados

1. **Rótulo “Não concluída” (novo fluxo):** classificação server-side; o card
   recebe só a classificação. ✅
2. **Replays não trocam o motivo:** campanha já `error` ⇒ `already_projected`, sem
   recalcular/sobrescrever; motivo não comprovável ⇒ `closed_neutral`. ✅
3. **Corrida testada na ESCRITA:** simula `ready` entre a consulta e o UPDATE; a
   condição atômica impede a reversão; `delivery_preserved` × `projection_not_applied`
   distinguidos. ✅
4. **AC3 reescrito:** inconclusivo sem encerramento confirmado **não projeta erro**;
   operação administrativamente encerrada e persistida `refunded` **é projetada**,
   mesmo com marcador histórico de publicação inconclusiva. ✅
5. **Ajuste 4 (revisão 2):** condição atômica alterada para **`status = 'generating'`**,
   preservando `ready` **e** um `error` já gravado por chamada concorrente; releitura
   após 0 linhas mantém a distinção `delivery_preserved` / `already_projected` /
   `projection_not_applied`; regressão de concorrência com `error` de motivo
   diferente. ✅

## 5. Escopo de dados (read-only — reconferido nesta rodada)

`vendeo-homolog` (`127.0.0.1:57781`; Postgres `supabase_db_vendeo-homolog`):

- `product_1_1_campaign_credit_operations`: **10 `delivered`, 0 `refunded`**.
- `campaigns`: 3 `error`, 66 `ready`, **0 `generating`**.
- **Registros afetados (`op='refunded'` E `campaign='generating'`): 0.**
- **Nenhum backfill/schema aplicado.** Fixtures `refunded` existem apenas nas
  instâncias isoladas de teste (fora do escopo).

## 6. Testes e evidências

**Novos:**
- `src/lib/product-1-1/__tests__/project-closed-campaign.contract.test.ts` —
  projeção (automático/administrativo/publicação/neutro), idempotência preservando
  mensagem, entrega protegida, **corrida na escrita** (`delivery_preserved` ×
  `projection_not_applied`), **concorrência de `error`** (outra chamada grava motivo
  diferente entre leitura e UPDATE ⇒ `already_projected`, mensagem intacta), op
  não-`refunded`, campanha ausente, loja divergente, falha de UPDATE e exceção (sem lançar).

**Ajustados:**
- `orchestration.contract.test.ts` — encerramento confirmado projeta com
  `confirmed_failure`; falha da projeção não reclassifica/estorna.
- `pending-resolution.contract.test.ts` — `refund_once` projeta com motivo por
  estado; falha da projeção não altera o resultado.
- `src/__tests__/lib/campaign/list.test.ts` — classificação server-side
  (`new`/`legacy`, snapshot malformado ⇒ legado) e ausência de `input_snapshot` na saída.
- `src/__tests__/app/minhas-campanhas-client.test.tsx` — rótulo neutro para novo
  fluxo e preservação do rótulo legado.

**Resultados:**
- Focados (novos + tocados + guardas + render):
  `project-closed`/`project-delivered`/`pending-resolution`/`orchestration`/`list`/
  `minhas-campanhas-client` = **157 testes** verdes (após o ajuste 4: +1 regressão de
  concorrência de `error`). Guardas `legacy-frontier` e `non-activation` + app
  (`minhas-campanhas`, `campanhas-page`) + `artifact-recovery` = **94/94**.
  Render `refunded-recovery` + `persisted-state` = **76/76**.

**Gates:** `npm run typecheck` **0**; `eslint .` **0**; `next build` **exit 0**
(via `cmd /c`, `EXIT=0`); `git diff --check` **exit 0** (apenas avisos LF/CRLF).
Sem spec OpenSpec tocada ⇒ `openspec validate` não aplicável nesta quick.

## 7. Limites / fora do escopo

- Nenhum dado alterado (0 afetados), nenhuma migration/flag/autorização/env,
  nenhuma chamada paga, sem produção/deploy/push.
- Reconciliação permanece “adia”; recuperação de arte continua sem estorno.
- Não há coluna dedicada a “motivo do encerramento”; o motivo é derivado do estado.
- Legado, snapshots históricos e `approval_status` intocados; “published nunca estorna”.
- Contadores de fases/quicks encerrados intactos; B2.3 não reaberta.

## 8. Arquivos

- `src/lib/product-1-1/orchestration/project-closed-campaign.ts` (novo)
- `src/lib/product-1-1/orchestration/generation-orchestrator.ts`
- `src/lib/product-1-1/pending/resolve-pending-operation.ts`
- `src/lib/campaign/list.ts`
- `src/app/(app)/campanhas/client.tsx`
- `src/lib/product-1-1/__tests__/project-closed-campaign.contract.test.ts` (novo)
- `src/lib/product-1-1/__tests__/orchestration.contract.test.ts`
- `src/lib/product-1-1/__tests__/pending-resolution.contract.test.ts`
- `src/__tests__/lib/campaign/list.test.ts`
- `src/__tests__/app/minhas-campanhas-client.test.tsx`
