---
quick_id: 261102-qna
status: complete
date: 2026-11-02
branch: perf/miniaturas-campanhas
base_sha: 6447f3441a47be5ca2271245d3aab4e23a7ced9e
gate_a: complete
gate_b_dry_run: complete
gate_b_pilot: complete
gate_b_backfill: complete_local
gate_b_production: complete_production
gate_b_homolog: pending
production_release_guard: complete_local
production_backfill: complete_production
gate_c_publication: complete_production
production_acceptance: approved_by_owner
push_deploy: complete
final_gates: passed
---

# Miniaturas de campanhas — geração e persistência (Gate A)

## Resultado

Implementado e validado localmente:

1. **Geração automática** de uma miniatura WebP por arte final imutável, nos três caminhos reais:
   - novo fluxo: `storeArtifact` após upload + insert de metadados;
   - legado: `generate-image/route.ts` após `updateCampaignReady`, reutilizando `jpegImage.buffer`;
   - correção v2: `generate-reports` após `complete_campaign_correction_v2`, reutilizando `jpeg.buffer`.
2. **Contrato determinístico**: `<original-sem-ext>.thumb-v1.webp`, WebP, maior aresta 288 px, `fit: inside`, sem crop, sem upscale, qualidade 78; bucket privado `campaign-images`, `upsert:false`.
3. **Falha isolada**: gerador nunca lança; wrapper `generateCampaignThumbnailSafely` é defesa em profundidade; cada call site tem `try/catch` local. Falha/timeout não altera campanha, crédito, status, entrega ou recuperação.
4. **Vínculo de ambiente**: `ThumbnailContext` exige endpoint igual ao do uploader. Client customizado sem contexto compatível desabilita a miniatura com diagnóstico — sem leitura silenciosa do env e sem chamada à origem errada.
5. **Orçamento de tempo**: upload abortado por `AbortSignal.timeout(2000)` no `global.fetch` do client dedicado; timeout vira `failed/thumbnail_upload_timeout`, sem retry e sem tarefa solta. Render do sharp é bounded por `limitInputPixels` e não é abortável (documentado).
6. **Script de preenchimento**: `scripts/campaign-thumbnails/backfill.ts` + `backfill-runner.ts`; dry-run padrão, inventário canônico `campaigns.storage_path` (`status='ready'`), filtros, lotes, concorrência, cursor, relatório JSON, guarda de endpoint exato e homolog/produção bloqueados.

## Arquivos

**Novos**
- `src/lib/campaign/thumbnail/thumbnail-path.ts`
- `src/lib/campaign/thumbnail/thumbnail-generator.ts`
- `src/lib/campaign/thumbnail/thumbnail-safe.ts`
- `src/lib/campaign/thumbnail/backfill-selection.ts`
- `src/lib/campaign/thumbnail/backfill-runner.ts`
- `scripts/campaign-thumbnails/backfill.ts`
- 5 arquivos de teste em `src/lib/campaign/thumbnail/__tests__/`
- `src/__tests__/lib/campaign/correction-thumbnail-isolation.test.ts`

**Alterados**
- `src/lib/product-1-1/artifact/artifact-store.ts`
- `src/app/api/campaign/generate-image/route.ts`
- `src/lib/campaign/correction-reports.ts`
- testes: `artifact-store.contract`, `route.test`, `route.integration`, `campaign-generate`, `regression-master-switch`, `concurrency`, `correction-v2-persistence`

## Ajustes pós-revisão (Gate B continua bloqueado)

1. **Cursor único keyset:** `--after` agora é `<createdAt EXATO>|<campaignId>`, emitido pelo inventário (`created_at,id`) e consumido sem offset. O `created_at` é preservado como **texto do PostgreSQL, com até 6 casas decimais**, sem passar por `Date`/`toISOString` (que truncaria para ms). Validação estrita do timestamp antes de interpolar no filtro. Lote final parcial emite `null`; UUID solto/offset/formato inválido é rejeitado (exit 3). Testes cobrem microssegundos, paginação de um em um e retomada.
2. **Sem bypass de timeout:** removida a opção `client` de `createTimedSupabaseUploader`; todo upload passa pelo `global.fetch` com `AbortSignal`. `fetchImpl` permanece apenas para teste.
3. **Falhas esperadas não silenciosas:** o wrapper registra `failed` (ex.: timeout) e `skipped` inesperado (ex.: endpoint mismatch) com warn sanitizado, sem lançar; `ineligible_path` continua sem ruído.
4. **Dry-run inspeciona formato:** `inspectOriginalImage` (metadata + decode completo com saída 1×1, somente leitura) classifica conteúdo arbitrário **e JPEG truncado** como `invalid_format`; não gera nem envia.

## Dry-run preparatório do Gate B (2026-11-02)

Executado **somente leitura** no Supabase local `http://127.0.0.1:57781` (loopback exato de `--expected-url`), sem `--write` e sem iniciar serviços. Inventário **completo**: **67/67 campanhas `ready`**, 67 paths únicos, cobertura idêntica ao banco, cursor final `null`.

| Outcome | Contagem |
|---|---|
| `would_create` | **67** |
| `already_exists` | 0 |
| `missing_original` | 0 |
| `access_error` | 0 |
| `invalid_format` | 0 |
| `ineligible` | 0 |
| `failed` | 0 |
| `created` | 0 |

- Nenhum `/inputs/`, logo, assinatura, `bench/` ou `lab/`; todos os paths são legado canônico.
- Cursors preservaram microssegundos (`...249074+00:00`, `...321887+00:00`, `...569938+00:00`).
- Nenhum segredo/URL assinada nos relatórios; nenhuma alteração em campanha, crédito, Storage ou original.
- Evidência: `evidence/gate-b-dry-run-REPORT.md`, `gate-b-dry-run-01..04.json`, `gate-b-inventory-verification.json`.
- **Gate B continua pendente**: nenhuma execução com `--write`.

## Piloto local com escrita — 10 campanhas (2026-11-02)

Executado **somente no fluxo legado local**, com autorização explícita: 10 itens, lote 5, concorrência 2, `--write --confirm-env local`.

| Resultado | Valor |
|---|---|
| `created` | **10** |
| `failed` / `access_error` / `missing_original` / `invalid_format` | 0 |
| WebP 288×288 | **10/10** |
| Peso | 13.030–18.920 bytes |
| Bucket privado / signed URL disponível | true / true |
| Originais intactos (SHA-256/bytes) | true |
| Campanhas e créditos inalterados | true |
| Reexecução dos 10 | **10 `already_exists`**, 0 `created` |
| Hashes das miniaturas após reexecução | idênticos (sem sobrescrita) |

- **Limitação:** validação real apenas do fluxo legado; v2/novo fluxo seguem em testes automatizados.
- **57 restantes processadas na sequência final** (25/25/7 pelo cursor do piloto): **57 `created`**, 0 falhas.
- Evidência: `evidence/gate-b-write-PILOT.md`, `gate-b-write-01.json`, `gate-b-write-01-rerun.json`, `gate-b-write-pilot-pre/post/rerun.json`.

## Fechamento do Gate B local — 67 campanhas (2026-11-02)

| Resultado final | Valor |
|---|---|
| Miniaturas existentes | **67/67** |
| WebP 288×288 | **67/67** |
| Peso | 10.562–23.638 bytes |
| Bucket privado / signed URL | true / true |
| Originais intactos (SHA-256/bytes) | true |
| Campanhas e créditos inalterados | true |
| Hashes do piloto após as 57 | idênticos (sem sobrescrita) |
| Varredura final (somente leitura) | **67 `already_exists`**, 0 falhas, cursor `null` |

- Gate B **local** concluído para o fluxo legado. **Não** representa prontidão de homolog/produção.
- Consumidores, commit, merge, push e deploy exigem autorização separada.
- Evidência: `evidence/gate-b-write-FINAL.md`, `gate-b-write-02/03/04.json`, `gate-b-final-pre/post.json`, `gate-b-final-dry-run.json`.

## Preparação da liberação de produção (2026-11-03)

Guardas ajustadas e testadas localmente, **sem acesso à produção**:

- `production` permitido apenas com `--env production`, `--expected-url` exato e origem **não loopback**;
- dry-run padrão; `--write` exige `--confirm-env production`;
- `homolog` continua bloqueado;
- preflight é executado **antes de criar client** (zero chamadas externas em bloqueio);
- inventário/allowlist/skip-existing/limites/cursor/relatórios preservados.

Testes: **51/51** no módulo (runner 18/18), typecheck 0, lint 0, `git diff --check` limpo.

Evidência: `evidence/gate-b-production-release.md` (diff, comandos com placeholders, fornecimento seguro de credenciais, plano dry-run → piloto → restante → publicação e critérios de parada).

**Dry-run de produção 01 (2026-11-03, somente leitura):** projeto `gvbzwihwgzujwsviufgy`, origem exata `https://gvbzwihwgzujwsviufgy.supabase.co`, 10 itens / batch 5 / concorrência 2. Contadores: **would_create 10**, `already_exists/missing_original/access_error/invalid_format/ineligible/failed/created = 0`; cursor com microssegundos. Nenhum path inesperado ou segredo. **Inventário não ampliado; aguardando revisão.** Evidência: `evidence/production-dry-run-01-REPORT.md` + JSON.

**Dry-run de produção ampliado (2026-11-03, somente leitura):** lotes 02–09 em 25 itens, concorrência 2. Total parcial **210 itens / 210 paths únicos**, `would_create 209`, `ineligible 1`, demais contadores 0, sem duplicatas. **PARADO no lote 09** por caminho inesperado `{store}/{campaign}/v3.jpg` (campanha `830d104a…`), fora da allowlist atual. Cursor final emitido, cobertura **parcial**, nenhuma escrita. Evidência: `evidence/production-dry-run-PARTIAL.md` + `production-dry-run-02..09.json`.

**Investigação read-only do v3 (2026-11-03):** v3 é arte final **aprovada/ativa** e referenciada por `campaigns.storage_path`; v1/v2 foram descartadas; objeto JPEG 1080×1080 (245.151 B). É caso **isolado** (1 campanha com `/v3.jpg`, 0 `/v4.jpg`), mas **legítimo** do fluxo histórico de regeneração (schema 1..3 / RPC `complete_campaign_regeneration`). Menor ajuste recomendado: aceitar `v2.jpg` e `v3.jpg` no contrato de caminho; impacto no gerador automático é nulo no código atual, no backfill é gerar `v3.thumb-v1.webp`, e nos consumidores é automático via `deriveThumbnailPath`. Evidência: `evidence/investigate-v3-REPORT.md` + `investigate-v3.json`.

**Inventário de produção completo (2026-11-03, somente leitura):** reinspeção do v3 ⇒ `would_create`; continuação a partir do cursor do lote 09 até `cursor: null`. **246 campanhas `ready`, 246 paths únicos, 246 `would_create`**, 0 duplicados, 0 ineligible/missing/access/invalid/failed, cursor final `null`. O item v3 anterior foi substituído, sem dupla contagem. Produção não alterada; piloto com escrita continua pendente de autorização. Evidência: `evidence/production-dry-run-FINAL.md` + `production-dry-run-FINAL.json`.

**Gates finais (2026-11-03):** typecheck 0, lint 0, build 0 (95/95), suíte local **7583 passed / 10 skipped / 0 failed** (605 arquivos), `test:scripts` 73/73, `test:gates` exit 0, `git diff --check` limpo, varredura de credenciais/URLs assinadas nas evidências limpa.

**Piloto de produção com escrita (2026-11-03):** 10 campanhas, lote 5, concorrência 2, `--write --confirm-env production`, sem `--after`. **10 `created`**, 0 falhas; WebP 288×288 (12.228–18.920 B), bucket privado, originais/campanhas/créditos intactos (hashes/contagens). Reexecução dos 10 ⇒ **10 `already_exists`**, 0 `created`, hashes idênticos. Restam **236** campanhas; nenhum lote ampliado. Evidência: `evidence/production-write-PILOT.md` + `production-write-pilot-*.json`.

**Restante de produção concluído (2026-11-03):** 236 campanhas em 9×25 + 11, cursor do piloto, pré-checagem por lote contra o inventário aprovado. **236 `created`**, 0 falhas. Consolidação: **246/246 WebP 288×288** (7.392–26.010 B), bucket privado, originais/campanhas/créditos intactos, hashes do piloto inalterados; varredura final read-only **246 `already_exists`**, cursor `null`, **0 campanhas novas**. v3 `830d104a…` ⇒ `already_exists` (288×288, 15.408 B). Evidência: `evidence/production-write-FINAL.md` + `production-batch-*`/`production-final-*`.

**Suporte a v3 implementado (2026-11-03):** `thumbnail-path.ts` aceita estritamente `v2.jpg`/`v3.jpg` (incluindo `.jpeg`) e deriva `v2.thumb-v1.webp`/`v3.thumb-v1.webp`. `v1.jpg`, `v4.jpg`, `v10.jpg`, `v02.jpg`, `v3.png` e paths malformados são rejeitados. Testes cobrem derivação, elegibilidade do backfill e assinatura por dashboard/listagem; consumidores não duplicam regra. Sem alteração de migrations, gerador automático ou fluxo histórico. Evidência: `evidence/v3-support-IMPLEMENTED.md`.

## Encerramento e aceite de produção (2026-11-03)

Conforme confirmação do responsável:

- **Push e deploy realizados.**
- **Validação funcional e visual em produção aprovada.**
- **Original 1024×1024 preservado.**
- **Miniaturas 288×288 funcionando.**
- **As duas quicks (`261102-qna` + `261102-tnu`) concluídas e aceitas em produção.**

Registro sem novas evidências inventadas: não foi observada geração de campanha nova nem validação visual em es-419 na produção nesta rodada. Evidência: `evidence/production-ACCEPTANCE.md`.

## Evidência (Gate A)

| Gate | Resultado |
|---|---|
| Módulo thumbnail (5 arquivos) | **45/45** |
| Focados (thumbnail + artifact + correção + route) | **179/179** em 8 arquivos |
| Regressão relacionada (10 arquivos) | **153/153** |
| Suíte local completa | **603 passed / 2 skipped (605 arquivos)**; **7570 passed / 10 skipped** |
| Typecheck | exit 0 |
| Lint | exit 0 (**limitação conhecida: sem cobertura TS**) |
| Build | exit 0; `/dashboard` 4.55 kB / 110 kB; shared 102 kB |
| `git diff --check` | limpo |
| `npm.cmd run test:gates` | exit 0; local 605 arquivos; integrações continuam **GATE NÃO EXECUTADO — NÃO APROVADO** |

### Medição de render (somente sharp, sem rede)

Fixture fotorrealista convertida para JPEG; 20 amostras após 3 warmups:

| Entrada | Saída | Peso | p50 | p95 |
|---|---|---|---|---|
| foto 1024×1024 | 288×288 WebP | 17.016 B | 19,5 ms | 21,0 ms |
| foto 1080×1080 | 288×288 WebP | 23.920 B | 21,7 ms | 25,7 ms |

**Não é latência fim-a-fim.** Upload foi exercitado apenas com fake/timeout (simulado); medição integrada (render + Storage real) fica para o Gate B. A estimativa antiga de 50–200 ms não foi usada como garantia.

## Testes críticos comprovados

- **Duas origens:** contexto `:54321` + uploader `:54322` ⇒ `skipped/endpoint_mismatch`, zero chamadas ao uploader; client customizado sem contexto ⇒ miniatura desabilitada, 1 upload (somente original), sem env/rede.
- **Timeout real:** `fetch` fake que só rejeita no `abort`; `AbortSignal.timeout(25ms)` aborta e devolve erro de Storage; o gerador mapeia para `thumbnail_upload_timeout` sem lançar.
- **Correção v2:** wrapper forçado a lançar ⇒ `success: true`, `fail_campaign_correction_v2` não chamada, `storage.remove` não chamado, `complete_campaign_correction_v2` chamada.
- **Legado:** wrapper forçado a lançar ⇒ resposta `result`, sem `deleteCampaignImage`, sem `updateCampaignError`.
- **Backfill:** dry-run sem `generate`; guardas com zero chamadas; limite/concorrência; `/inputs/` e store divergente excluídos; ausência ≠ acesso; retomada após timeout com objeto persistido ⇒ `already_exists` sem novo upload.
- **Cursor:** lote final parcial ⇒ `null` (nunca UUID); `--after` keyset repassado intacto; offset inválido ⇒ exit 3.
- **Precisão:** `created_at` com 6 casas (`...123456+00:00`) sobrevive a encode/decode/filtro sem truncar; paginação de 1 em 1 não repete o item anterior.
- **Dry-run inválido:** bytes não-imagem ⇒ `invalid_format`, sem geração/upload.
- **Warnings:** `failed/timeout` e `skipped/endpoint_mismatch` geram warn sanitizado; `created`/`already_exists`/`ineligible_path` não geram ruído.

## Limpeza avaliada

Sem cascata/varredura nesta quick. Remoções existentes do original ocorrem antes do ponto de criação da miniatura. Aprovação/substituição não apaga versões. Órfãos por remoção manual futura ficam documentados como limitação; resíduos de testes de integração **não** são autorizados — suítes não executadas permanecem pendentes.

## Pendências / gates — estado final (2026-11-03)

- **Gate B (preenchimento):** **concluído em produção** — 246/246 miniaturas, 0 falhas.
- **Gate C (publicação/consumidores):** **concluído** — push e deploy realizados; dashboard/listagem consomem as miniaturas; aceite funcional/visual de produção aprovado pelo responsável.
- Suítes de integração Product 1:1 / PostgreSQL: não executadas (ambiente); permanecem **não aprovadas** e isso não foi alterado pelo aceite de produção.
- Lint sem cobertura TS: limitação preexistente registrada.
- Não houve registro, nesta rodada, de geração de campanha nova ou validação visual em es-419 na produção.

## Desvios do plano

- O wrapper seguro foi extraído para `thumbnail-safe.ts` (em vez de ficar no gerador) para permitir teste real com o gerador mockado.
- O script usa parser local de `.env.local` (mesmo formato do projeto) em vez de importar `scripts/testing/test-status.mjs`, para evitar acoplamento TS→.mjs no typecheck.
- Nenhuma migration, dependência, bucket, coluna, API, fila, cron ou alteração de consumidores.
