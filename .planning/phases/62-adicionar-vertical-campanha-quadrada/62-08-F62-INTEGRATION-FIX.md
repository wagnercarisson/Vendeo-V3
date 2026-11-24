# 62-08 — Correção de integração F62 (ponte × original / RPC / erros / modal)

**Status:** **CORRIGIDO E VALIDADO LOCALMENTE; REVISÃO HUMANA PENDENTE; `62-08` NÃO CONCLUÍDO NO MOMENTO DESTA EVIDÊNCIA.**
> **Atualização 2026-11-24:** o `62-08` foi consolidado e aceito localmente em `62-ACCEPTANCE.md`/`62-08-SUMMARY.md`; o status acima permanece como registro histórico.
**Data:** 2026-11-23.
**Branch:** `feat/campaign-add-vertical`.
**Migration única:** `supabase/migrations/20261123130252_campaign_format_addition.sql`.
**Homologação:** `supabase_db_vendeo-homolog`, `postgres`, `127.0.0.1:57782`.

## Defeito reproduzido

A Jarra (`c06b16f5-…`) já possuía um `square_original` interno
`origin=provider_generation` com:

- 178.723 bytes;
- SHA-256 `f9ed34703ae84f41694bbe265d654616d4b8cdc8b0670149b1c914e8c30970d4`;
- mesmo checksum/bytes do `art-1024.jpg` entregue.

A ponte usava a identidade da operação primária (`41c3f33f-…`) e tentava
persistir `delivered_campaign_reuse` na mesma identidade. O
`persistCompositionArtifact` retornava `provenance_mismatch` →
`bridge_provenance_conflict` (409), sem criar vínculo/reserva/débito.

## Correção de fonte

- `ensureFormatAdditionSourceBridge` lê o `square_original` existente pela
  identidade estável.
- Se for íntegro, corresponder à operação primária e aos bytes/checksum da
  imagem entregue atual, **reutiliza a linha original** sem alterar origem,
  bytes, proveniência, path ou identidade (`persistence: "reused"`).
- `delivered_campaign_reuse` é criado somente quando não há original íntegro.
- Checksum/path/bucket/dimensão/MIME/identidade divergentes continuam recusados;
  nenhuma sobrescrita ou remoção.
- `provider_generation` só é aceito em `new_flow_1_1`; legado 1024 continua
  aceito e 1080 bloqueado.

## RPC `campaign_format_add_open`

A validação passou a aceitar:

1. `delivered_campaign_reuse` com `source_campaign_id = campanha` e proveniência
   de reuso; ou
2. `provider_generation`, somente `new_flow_1_1`, com a identidade da operação
   primária, `source_campaign_id` nulo, `derived_from_artifact_id` nulo,
   1024×1024 JPEG e checksum igual à fonte.

Os checks de loja/campanha, operação primária entregue, path canônico da imagem
entregue, dimensão, MIME e checksum permanecem.

## Erros reais do gate

`statusForRun` foi extraído para `src/lib/campaign/format-addition/status.ts` e
alinha os códigos reais:

| Código do gate | HTTP |
|---|---|
| `insufficient_credits` / `balance_below_one` | **402** |
| `rate_limit_exceeded` | **429** |
| `addition_disabled`, `engine_disabled`, `legal_blocked`, `store_not_ready` | **403** |
| `stage_not_enabling`, `revoked`, `expired`, demais negações de autorização | **403** |
| `authorization_unavailable`, `authorization_resolver_not_configured`, `gate_read_failed`, `read_failure`, `flags_unavailable` | **503** |
| `rpc_failed` / `durable_context_read_failed` | **503** |
| conflito real de ponte | **409** |

A rota passa a devolver `code` + `reason` seguros; a modal preserva ambos em
`data-code`/`data-reason`, sem mensagens cruas, token ou segredo.

## Modal

- Considera `expiresAt`; confirmação vencida não mostra “Confirmar”.
- Oferece “Tentar novamente” fazendo novo **GET** read-only para emitir novo
  token, sem POST/geração automática.
- Fechar a modal aborta somente o GET local; o POST/geração em andamento não é
  abortado (`postAbortRef` não é abortado no close/unmount).
- A guarda de `sessionRef`/`appliedSeqRef` continua descartando respostas de
  sessões antigas.

## Migration única — aplicação seletiva na homologação

- Hash anterior do arquivo:
  `61c727198f8ad7519e6cb3b9c79dba6fd1d9bbb9f948b9600d37bc43c7f5b878`.
- Hash novo do arquivo:
  `56dc3423c9be5d7363bd663a694a7e20f9bb9faed3569eb3e1c9574a76b9272a`.
- Aplicada **somente** a definição de `public.campaign_format_add_open`, em
  transação com `ON_ERROR_STOP=1`, `statement_timeout=30s` e
  `lock_timeout=5s`.
- Nenhum `DROP`/`TRUNCATE`/reset/`db push`/repair; ledger intocado.
- Hash da função antes: `ca6ef3c9daee87ddd776e5f35e1c7429`.
- Hash da função depois: `4e3fd785528bd56705f17a55613f26ab`.
- ACL preservada: `postgres=X/postgres,service_role=X/postgres`.
- `SECURITY DEFINER=true`; `SET search_path = ''` preservado.
- Ledger: **158** entradas, F62 exatamente **1** vez, `statements IS NULL`.
- Dados financeiros/artefatos/flags: inalterados.

## Validação descartável desde a instalação inicial

Harness `scripts/f50-4/disposable-db.mjs`, projeto
`f50-4-disposable-f62check20261123`, porta 54822, CLI 2.75.0, sem provider:

- 159 migrations aplicadas; ledger 159.
- F62 aplicada uma vez.
- `pg_get_functiondef` hash:
  **`4e3fd785528bd56705f17a55613f26ab`** — idêntico à homologação.
- ACL/SECURITY DEFINER idênticos.
- Stack destruído ao final.

## Ponte real (homologação)

Execução real de `ensureFormatAdditionSourceBridge` na Jarra, sem provider:

```json
{
  "ok": true,
  "persistence": "reused",
  "sourceRegistrationOperationId": "41c3f33f-3be0-4086-b04e-710258643609",
  "artifact": {
    "origin": "provider_generation",
    "role": "square_original",
    "format": "1:1",
    "width": 1024,
    "height": 1024,
    "mimeType": "image/jpeg",
    "checksumSha256": "f9ed34703ae84f41694bbe265d654616d4b8cdc8b0670149b1c914e8c30970d4",
    "sourceCampaignId": null
  }
}
```

`campaign_composition_artifacts` antes/depois: **3 → 3**;
`campaign_format_additions`: **0 → 0**.

## RPC real em transação com rollback

Chamada real de `campaign_format_add_open` na homologação com a arte
`provider_generation` original, seleção/economia vigentes, em `BEGIN … ROLLBACK`:

```json
{
  "before": { "additions": 0, "ops": 1, "balance": 8 },
  "after":  { "additions": 0, "ops": 1, "balance": 8 },
  "rpc": {
    "success": true,
    "state": "open",
    "sourceRegistrationOperationId": "41c3f33f-3be0-4086-b04e-710258643609",
    "squareArtifactId": "5ff1c350-f58a-442a-84de-90e684e03bca"
  }
}
```

A reserva/operação criada dentro da transação foi **revertida**; nenhum dado
financeiro, operação, vínculo ou artefato persistiu. Nenhum provider foi
chamado.

## Regressões adicionadas

- Ponte: original `provider_generation` com bytes iguais → `reused`, sem persist;
  checksum divergente → recusa sem sobrescrever; metadados divergentes → recusa.
- Status: `runFormatAdditionOpening` → `statusForRun` para saldo/rate
  limit/autorização/leitura incerta/conflito real.
- Modal: confirmação vencida → sem Confirmar + novo GET; fechar modal não aborta
  o POST em andamento.
- RPC: contrato estático exige os dois ramos.
- Fronteiras: allowlists específicas reconhecem a migration F62 e o transporte
  `node-http-storage-download` read-only do detalhe; nenhum gate foi afrouxado.

## Gates

| Gate | Resultado |
|---|---|
| Suíte global | **866 arquivos / 10.789 testes PASS** (2 arquivos/10 testes skip) |
| Testes dirigidos | 77 PASS (ponte/status/modal/RPC/catálogos) |
| Typecheck | **0** |
| Lint | **0** |
| Build | **0** |
| OpenSpec strict | **1/0** |
| `git diff --check` | limpo |

Os gates de integração PostgreSQL/Storage que exigem `TEST_DATABASE_URL` /
opt-in de escrita aparecem como “NÃO EXECUTADO” no runner global; as provas
reais acima foram feitas separadamente na homologação e no descartável.

## Remoção do cancelamento implícito do POST (2026-11-24)

- `submit` não chama mais abort do POST anterior ao iniciar confirmação/retomada.
  Cada POST mantém seu próprio `AbortController`/signal; ao iniciar B, o signal de
  A permanece **não abortado**.
- A concorrência de operações mutáveis é controlada por identificação, não por
  abort: `sessionRef`, `postIdRef`/`activePostRef` e `appliedSeqRef` descartam
  respostas antigas.
- A resposta de A não altera a nova sessão de B nem libera o indicador de
  `submitting` de B; o `finally` só limpa quando `activePostRef` ainda é o
  próprio POST.
- Regressão adicionada: POST A pendente → fechar → reabrir → GET `processing`
  → retomar com POST B → A continua não abortado; A `delivered` é ignorado;
  B `delivered` conclui uma única vez.
- Nenhuma alteração de banco, migration, flags ou provider.
- Conjunto afetado: **7 arquivos / 105 testes PASS**; typecheck, lint e
  diff-check limpos.

## Limitações / parada

- Nenhuma confirmação HTTP paga, provider, geração, merge, push ou deploy.
- A RPC foi provada em transação com rollback; não foi persistida reserva nem
  operação.
- O teste manual da modal/confirmação permanece para revisão humana.
- `62-08` **não** é declarado concluído.
