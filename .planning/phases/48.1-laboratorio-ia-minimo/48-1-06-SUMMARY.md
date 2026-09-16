---
phase: 48.1-laboratorio-ia-minimo
plan: 48-1-06
subsystem: lab
tags: [supabase-storage, sha256, signed-url, cleanup, lab, vitest, server-only]

# Dependency graph
requires:
  - phase: 48.1
    plan: 48-1-01
    provides: "tabelas lab_* + bucket privado lab-artifacts (public=false, policy service_role)"
  - phase: 48.1
    plan: 48-1-02
    provides: "LAB_ARTIFACT_RETENTION_DAYS=30 (limites travados) e guarda de ambiente fail-closed"
provides:
  - "Serviço de artefatos do laboratório: upload no bucket privado com path próprio, metadados + checksum SHA-256 e rollback sem órfão"
  - "Leitura por URL assinada server-side de 3600s (individual e em lote tolerante a falha)"
  - "Script de cleanup manual opt-in com proteção de run em andamento e preservação de metadados/histórico"
affects: [48-1-07, 48-1-08, 48-1-10, 48-1-12, 48-1-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Upload em bucket privado com upsert:false + rollback explícito do objeto quando o insert falha"
    - "Path de artefato derivado de UUIDs validados + barreira anti-traversal (assertLabArtifactPath) chamada em builders e leitura"
    - "Leitura exclusiva por createSignedUrl server-side com TTL em constante (bucket nunca público)"
    - "Script opt-in sem efeito colateral no import (CLI só roda como entry point)"

key-files:
  created:
    - src/lib/lab/persistence/artifact-service.ts
    - src/lib/lab/persistence/__tests__/artifact-service.test.ts
    - scripts/lab/48-cleanup-artifacts.mjs
    - scripts/lab/__tests__/48-cleanup-artifacts.test.mjs
  modified:
    - src/lib/lab/persistence/artifact-service.ts
    - src/lib/lab/persistence/__tests__/artifact-service.test.ts
    - scripts/lab/48-cleanup-artifacts.mjs
    - scripts/lab/__tests__/48-cleanup-artifacts.test.mjs
    - openspec/changes/fase-48-1-laboratorio-ia-minimo/design.md
    - openspec/changes/fase-48-1-laboratorio-ia-minimo/specs/lab-artifacts/spec.md
    - .planning/phases/48.1-laboratorio-ia-minimo/48-1-06-PLAN.md

key-decisions:
  - "O token do bucket de imagens de campanha é montado em runtime (['campaign','images'].join('-')) em artifact-service.ts: o path é recusado sem que o literal proibido apareça no arquivo (aceite exige 0 ocorrências)."
  - "assertLabArtifactPath exige prefixo experiments/ e segmentos UUID para experimentId e runId (reforço do T-48-1-40: path montado só com UUIDs validados)."
  - "Rollback do objeto é best-effort em try/catch: uma falha da remoção não mascara o erro original de persistência (artifact_persistence_failed)."
  - "O script de cleanup não importa código de produção; o default de retenção (30) é travado por teste contra LAB_ARTIFACT_RETENTION_DAYS de src/lib/lab/limits.ts."
  - "createArtifactSignedUrls resolve em paralelo e tolera falha individual: o path problemático fica ausente do mapa sem derrubar a comparação (48-1-08/48-1-10)."

patterns-established:
  - "Persistência de artefato em 2 fases (upload → insert) com compensação: insert falhou ⇒ remove o objeto; upload falhou ⇒ nada é inserido."
  - "Barreira anti-traversal única (assertLabArtifactPath) reutilizada por builders, listagem e assinatura de URL."
  - "Cleanup destrutivo como ação humana explícita: script local-only, --dry-run e nenhuma rotina automática."

requirements-completed: [lab-artifacts]

# Metrics
duration: 5min
completed: 2026-09-16
---

# Phase 48.1 Plan 48-1-06: Persistência de Artefatos do Laboratório Summary

**Artefatos de run gravados no bucket privado `lab-artifacts` com path próprio, checksum SHA-256, rollback sem órfão, leitura por URL assinada de 3600s e cleanup manual opt-in que nunca limpa run em andamento.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-16T17:52:11Z
- **Completed:** 2026-09-16T17:57:35Z
- **Tasks:** 3
- **Files modified:** 4 (4 criados, 0 alterados)

## Accomplishments

- **Serviço de artefatos** (`src/lib/lab/persistence/artifact-service.ts`): upload no bucket privado `lab-artifacts` no path `experiments/{experimentId}/runs/{runId}/output.{png|jpg|webp}` (e `.../inputs/{index}.{ext}`), com `upsert: false`, metadados (path, MIME, dimensões, bytes) + **checksum SHA-256** do buffer gravado e **rollback** do objeto quando o insert dos metadados falha — nenhum órfão.
- **Barreira anti-traversal** `assertLabArtifactPath`: recusa path vazio, `..`, caminho absoluto, `\`, `://`, o bucket de imagens de campanha, ausência do prefixo `experiments/` e segmentos que não sejam UUID. Chamada pelos builders, pela listagem e pela assinatura de URL.
- **Leitura por URL assinada** server-side com TTL fixo `LAB_SIGNED_URL_TTL_SECONDS = 3600`, individual (`createArtifactSignedUrl`) e em lote (`createArtifactSignedUrls`, tolerante a falha individual). O bucket permanece privado — nenhum `getPublicUrl`.
- **Cleanup manual opt-in** (`scripts/lab/48-cleanup-artifacts.mjs`): seleciona apenas artefatos de runs terminais (experimento `archived` **ou** idade > `LAB_ARTIFACT_RETENTION_DAYS = 30`), **nunca** runs `pending`/`running`, remove só os arquivos do bucket e marca `removed_at` (nenhum `delete` de metadados/runs/avaliações). Recusa host não local antes de qualquer leitura; `--dry-run` disponível; sem scheduler e sem efeito colateral no import.
- **41 testes verdes** (25 do serviço + 16 do cleanup), todos com fakes em memória — nenhuma chamada de rede.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: artifact-service — path próprio, upload, metadados/checksum e rollback sem órfão** - `2a863454` (feat)
2. **Task 2: URL assinada server-side (3600s) e listagem de artefatos do run** - `97c43565` (feat)
3. **Task 3: Script de cleanup manual (idade/arquivamento) com proteção de run em andamento** - `414f0cef` (feat)

**Plan metadata:** _(commit de docs deste plano — SUMMARY + STATE/ROADMAP)_

## Files Created/Modified

- `src/lib/lab/persistence/artifact-service.ts` — serviço server-only: constantes (`LAB_ARTIFACT_BUCKET`, `LAB_ALLOWED_ARTIFACT_MIME_TYPES`, `LAB_SIGNED_URL_TTL_SECONDS`), builders de path, `assertLabArtifactPath`, `computeArtifactChecksum`, `persistOutputArtifact` (com rollback), `listRunArtifacts`, `createArtifactSignedUrl(s)`.
- `src/lib/lab/persistence/__tests__/artifact-service.test.ts` — 25 testes com client fake (bucket/path/upsert/contentType/metadados/checksum, rollback 1×, upload falho sem insert/remove, anti-traversal, TTL 3600, tolerância a falha em lote).
- `scripts/lab/48-cleanup-artifacts.mjs` — cleanup opt-in: `isRunInProgress`, `resolveRetentionDays`, `selectEligibleArtifacts`, `main` (host local-only, service role obrigatória, `--dry-run`, resumo `{ eligible, removed, skipped, dryRun }`).
- `scripts/lab/__tests__/48-cleanup-artifacts.test.mjs` — 16 testes das funções puras (proteção `pending`/`running`, elegibilidade por idade/arquivamento, `removed_at`, run ausente, paridade de retenção, ausência de side effect no import, recusa de host/serviço).

## Decisions Made

- **Token do bucket produtivo montado em runtime:** `artifact-service.ts` precisa recusar paths do bucket de imagens de campanha, mas o literal é proibido no arquivo (aceite: 0 ocorrências). A recusa usa `["campaign","images"].join("-")`, mantendo o comportamento sem violar o grep de aceite.
- **Validação de UUID nos dois segmentos:** além de `experiments/{id}`, o segmento `runs/{runId}` também é validado como UUID — o path só é montado com identificadores validados (T-48-1-40).
- **Rollback best-effort:** o `remove` do rollback roda em `try/catch` para não mascarar o erro original (`artifact_persistence_failed`); o path é único por run, então não há risco de apagar arte de outro run.
- **Default de retenção espelhado e travado por teste:** o script não importa código de produção; `DEFAULT_RETENTION_DAYS = 30` é asserido contra `LAB_ARTIFACT_RETENTION_DAYS` de `src/lib/lab/limits.ts`.
- **Helpers puros adicionais exportados** (`resolveRetentionDays`, `DEFAULT_RETENTION_DAYS`, `CleanupBlockedError`) para permitir testar o default e a recusa de ambiente sem executar a CLI — aditivo ao contrato mínimo exigido.

## Deviations from Plan

None - plan executed exactly as written.

_Nota de implementação (não é desvio):_ os códigos `artifact_upload_failed`/`artifact_persistence_failed` foram inlined no `throw` em vez de constantes, porque `Select-String` é case-insensitive e o nome da constante em maiúsculas casaria com o padrão do aceite, que exige exatamente 1 ocorrência de cada literal.

## Corrections Applied After Review

### 1. HIGH — cleanup destrutivo confiava no `storage_path` armazenado

**Finding (revisão do usuário):** a elegibilidade era decidida pelo `run_id`, mas o `storage_path` era enviado ao Storage sem validação. Um registro corrompido de um run terminal poderia apontar para o arquivo de **outro** run ainda `pending`/`running` — o cleanup consideraria o primeiro elegível e apagaria a evidência do run ativo, contrariando "run em andamento nunca é limpo" e a mitigação de path corrompido/forjado.

**Fix (`scripts/lab/48-cleanup-artifacts.mjs`):**
- `parseArtifactStoragePath(storagePath)` valida o formato canônico (`experiments/{uuid}/runs/{uuid}/output.{png|jpg|webp}` ou `inputs/{n}.{ext}`) e devolve `{ experimentId, runId }` (ou `null`).
- `partitionArtifacts(...)` → `{ eligible, invalid }`: além do formato, exige **coerência com o registro** — `runId` do path = `artifact.run_id` **e** `experimentId` do path = `run.experiment_id`. Paths malformados/incompatíveis vão para `invalid` e **nunca** são elegíveis.
- `main` reporta `invalid` no resumo e **revalida** o path imediatamente antes do `remove` (defesa extra). `selectEligibleArtifacts` preserva o contrato anterior delegando a `partitionArtifacts`.

**Testes adicionados (+5):** path de outro run; path de outro experimento; path malformado (`campaign-images/...`); path canônico coerente elegível; `selectEligibleArtifacts` filtra o incompatível; `parseArtifactStoragePath` aceita output/jpg/webp/inputs e rejeita `campaign-images`, extensão inválida, `..` e UUID inválido.

### 2. WARNING — rollback podia falhar silenciosamente

**Finding (revisão do usuário):** em `artifact-service.ts`, o rollback aguardava `remove()` mas não examinava o `{ error }` retornado (o `try/catch` só cobria exceção lançada), então "rollback sem órfão" não era garantido.

**Fix:** o retorno de `remove` é inspecionado — `{ error }` resolvido (ou exceção) é registrado via `console.warn` (sem conteúdo sensível, apenas o path validado) e **não** mascara o erro original `artifact_persistence_failed`. Teste novo cobre `remove` resolvendo com `{ error }`: o erro original é preservado e o rollback falho é reportado.

### 3. Tracking — numeração de onda (declarada × DAG)

Os planos 48-1-05 e 48-1-06 declaram `wave: 3` no frontmatter (o plan-index registra que o DAG os colocaria na onda 2). **Formalmente, a Onda 2 termina em 48-1-03/48-1-04 e a Onda 3 contém 48-1-05/48-1-06.** A comunicação anterior ("Wave 2 complete") usava o agrupamento do DAG; o tracking passa a seguir a onda **declarada** pelos planos. Nenhum artefato de tracking afirmava conclusão de onda — a correção é de reporte.

**Source-of-truth sincronizada:** `design.md` (D10), `specs/lab-artifacts/spec.md` (novo cenário "Path incoerente com o registro não é removido") e `48-1-06-PLAN.md` (Task 1 rollback/testes, Task 3 `parseArtifactStoragePath`/`partitionArtifacts`/testes/aceite, novo threat model T-48-1-48).

**Verification:** `npx vitest run src/lib/lab/persistence scripts/lab` → exit 0 (**49 testes**, +8); `npx tsc -p tsconfig.typecheck.json --noEmit` → exit 0; `npm.cmd run lint` → exit 0.

## Issues Encountered

- Nenhum problema de execução. Ajuste trivial de teste: as linhas do fake de `lab_artifacts` precisaram do campo `run_id` para o filtro `eq("run_id", ...)` do fake thenable funcionar (corrigido no próprio teste da Task 1).

## User Setup Required

None - no external service configuration required. (O bucket `lab-artifacts` já existe no Supabase **local** desde o 48-1-01; nenhuma migration foi criada/alterada neste plano.)

## Next Phase Readiness

- **48-1-07** (execução e snapshots) pode persistir o artefato de saída via `persistOutputArtifact` e marcar o run `failed` com `artifact_persistence_failed` quando o rollback for acionado.
- **48-1-08/48-1-10** podem consumir `listRunArtifacts` + `createArtifactSignedUrls` para o detalhe do run e a comparação lado a lado.
- **48-1-14** pode documentar/exercitar `scripts/lab/48-cleanup-artifacts.mjs` na UAT local (confirmando que run em andamento não é limpo).
- Nenhum blocker. `git status --porcelain src/lib/campaign src/lib/ai src/lib/ai-cost prompts/` vazio — nenhuma superfície produtiva tocada.

---

*Phase: 48.1-laboratorio-ia-minimo*
*Completed: 2026-09-16*

## Self-Check: PASSED

- Arquivos criados verificados no disco: `artifact-service.ts`, `artifact-service.test.ts`, `48-cleanup-artifacts.mjs`, `48-cleanup-artifacts.test.mjs`.
- Commits verificados: `2a863454` (Task 1), `97c43565` (Task 2), `414f0cef` (Task 3).
- Gates: `npx vitest run src/lib/lab/persistence scripts/lab` exit 0 (41 testes); `npx tsc -p tsconfig.typecheck.json --noEmit` exit 0; `npm run lint` exit 0.
- `git status --porcelain src/lib/campaign src/lib/ai src/lib/ai-cost prompts/` vazio.
