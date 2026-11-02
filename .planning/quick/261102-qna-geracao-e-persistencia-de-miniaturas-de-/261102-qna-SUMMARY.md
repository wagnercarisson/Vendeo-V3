---
quick_id: 261102-qna
status: complete
date: 2026-11-02
branch: perf/miniaturas-campanhas
base_sha: 6447f3441a47be5ca2271245d3aab4e23a7ced9e
gate_a: complete
gate_b_backfill: pending_authorization
gate_c_publication: pending_authorization
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

1. **Cursor único keyset:** `--after` agora é `<createdAt ISO>|<campaignId>`, emitido pelo inventário (`created_at,id`) e consumido sem offset. Lote final parcial emite `null`; UUID solto/offset é rejeitado (exit 3). Testes cobrem lote parcial e retomada com cursor opaco.
2. **Sem bypass de timeout:** removida a opção `client` de `createTimedSupabaseUploader`; todo upload passa pelo `global.fetch` com `AbortSignal`. `fetchImpl` permanece apenas para teste.
3. **Falhas esperadas não silenciosas:** o wrapper registra `failed` (ex.: timeout) e `skipped` inesperado (ex.: endpoint mismatch) com warn sanitizado, sem lançar; `ineligible_path` continua sem ruído.
4. **Dry-run inspeciona formato:** `inspectOriginalImage` (metadata + decode completo com saída 1×1, somente leitura) classifica conteúdo arbitrário **e JPEG truncado** como `invalid_format`; não gera nem envia.

## Evidência (Gate A)

| Gate | Resultado |
|---|---|
| Módulo thumbnail (5 arquivos) | **42/42** |
| Focados (thumbnail + artifact + correção + route) | **176/176** em 8 arquivos |
| Regressão relacionada (10 arquivos) | **153/153** |
| Suíte local completa | **603 passed / 2 skipped (605 arquivos)**; **7567 passed / 10 skipped** |
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
- **Dry-run inválido:** bytes não-imagem ⇒ `invalid_format`, sem geração/upload.
- **Warnings:** `failed/timeout` e `skipped/endpoint_mismatch` geram warn sanitizado; `created`/`already_exists`/`ineligible_path` não geram ruído.

## Limpeza avaliada

Sem cascata/varredura nesta quick. Remoções existentes do original ocorrem antes do ponto de criação da miniatura. Aprovação/substituição não apaga versões. Órfãos por remoção manual futura ficam documentados como limitação; resíduos de testes de integração **não** são autorizados — suítes não executadas permanecem pendentes.

## Pendências / gates

- **Gate B (preenchimento):** não executado. Nenhuma escrita em Storage/banco. Requer dry-run revisado + autorização explícita.
- **Gate C (publicação/consumidores):** fora desta quick. Dashboard/listagem continuam usando o original.
- Suítes de integração Product 1:1 / PostgreSQL: não executadas (ambiente); permanecem **não aprovadas**.
- Lint sem cobertura TS: limitação preexistente registrada.

## Desvios do plano

- O wrapper seguro foi extraído para `thumbnail-safe.ts` (em vez de ficar no gerador) para permitir teste real com o gerador mockado.
- O script usa parser local de `.env.local` (mesmo formato do projeto) em vez de importar `scripts/testing/test-status.mjs`, para evitar acoplamento TS→.mjs no typecheck.
- Nenhuma migration, dependência, bucket, coluna, API, fila, cron ou alteração de consumidores.
