# 62-01 — Evidência de gates (execução)

**Data:** 2026-11-23 (UTC)
**Branch:** `feat/campaign-add-vertical`
**Baseline de código:** `241815fa831ceb6db85fbc8747a9599c83fb66bc`
**HEAD da execução:** ver commits abaixo (o SUMMARY registra o fechamento documental)
**Escopo:** somente `62-01`. Nenhum banco, Storage, provider, geração, migration aplicada, flag, merge, push, deploy, sync ou archive.

## Baseline (antes de alterar `src/`)

| Verificação | Resultado |
|---|---|
| `git rev-parse --abbrev-ref HEAD` | `feat/campaign-add-vertical` |
| `git rev-parse HEAD` | `241815fa831ceb6db85fbc8747a9599c83fb66bc` |
| `git status --porcelain` | `.planning/ROADMAP.md` e `.planning/STATE.md` modificados; somente fase e change não rastreadas; **nenhuma alteração em `src/` ou `supabase/`** |
| `git diff --check` | limpo (exit 0) |
| `npx openspec validate --changes --strict` | `1 passed, 0 failed` |

Baseline documental aprovada e versionada em `c76f3b2e` antes de qualquer alteração de código, incluindo `62-REVIEW-RESIDUALS.md`.

## Commits da execução

| Commit | Conteúdo |
|---|---|
| `c76f3b2e` | docs: aprovação dos planos, baseline documental e ajustes residuais |
| `fe1a4ba7` | feat: contratos puros + derivação de elegibilidade + testes |
| `786661f6` | feat: extensão da apresentação individual + testes |
| `4074ee77` | feat: textos pt-BR/es-419 + testes de catálogo |

## Gates dirigidos

| Gate | Comando | Resultado real |
|---|---|---|
| Elegibilidade | `npx vitest run src/lib/campaign/__tests__/format-addition-eligibility.test.ts` | **27/27 PASS**, 1 arquivo |
| Apresentação | `npx vitest run src/lib/campaign/__tests__/format-presentation.test.ts` | **30/30 PASS**, 1 arquivo |
| Catálogos | `npx vitest run src/lib/i18n/campaign-detail/__tests__/catalogs.test.ts` | **11/11 PASS**, 1 arquivo |
| Combinado | os três arquivos anteriores | **3 arquivos / 68 testes PASS** |
| Typecheck | `npm.cmd run typecheck` | exit **0** |
| Lint | `npm.cmd run lint` | exit **0** (limitação preexistente: não cobre TypeScript) |
| Build | `npm.cmd run build` | exit **0**; `102/102` páginas; shared `102 kB` |
| Suíte global local | `npm.cmd test -- --reporter=dot` | **845 arquivos PASS + 2 skipped (847)**; **10.529 testes PASS + 10 skipped (10.539)**; 106,22 s |
| Diff-check | `git diff 241815fa..HEAD --check` | limpo |

## Gates não executados (por escopo)

PostgreSQL/homolog, PostgreSQL/local, f50-4, app-env, Produto 1:1, F60 e F60.1 **não foram executados** — exigem banco/Storage/ambiente e autorização separada. Não há prova financeira, de banco ou de Storage nesta execução.

## Testes que cobrem os requisitos

- **ADD-ELIG-01:** 1024 novo/legado elegível; 1080 e 1024×1080 incompatíveis; MIME/bytes/checksum/path/origem/status/format incompatíveis; ausência, indeterminação, falha de leitura e conflito de identidade em `unavailable`; vínculo durável com precedência.
- **FMT-ADD-12:** sem adição preserva `not_requested`; adição `delivered`/`processing`/`unknown`/`absent`; `absent` usa `not_delivered`; `flow=single_format`; `partial=false`; `active` só com seleção e entrega.
