---
quick_id: 261102-oab
phase: quick
plan: 01
date: 2026-11-02
status: complete
reconciliation: applied
guard_modified: true
base_sha: "335bfb70"
commits:
  - 3433a713
---

# Quick 261102-oab — Reconciliação do legacy-frontier guard

## Resultado

Reconciliação concluída após o parecer técnico favorável do Codex e a
autorização explícita desta retomada. O guard voltou a **10/10** e a suíte local
ficou **verde** (7507 passed / 10 skipped / 0 failed), sem alterar código
funcional, runners, configs, dependências, migrations ou banco.

- `BASE_SHA = 335bfb70` preservado.
- 34 caminhos extras reconciliados + 4 conteúdos atualizados.
- Nenhuma divergência nova fora dos grupos revisados.
- Matriz final e pacotes em `261102-oab-AUDIT.md` e `review/`.
- Parecer desta retomada em `261102-oab-RETOMADA.md`, separado das evidências
  históricas.

## Parecer e autorização

O parecer do Codex revisou os diffs dos quatro grupos pendentes e executou 280
testes em 21 arquivos, além de typecheck, lint e `git diff --check`. O usuário
autorizou a retomada. Esse parecer cobre **código/testes offline** para a
reconciliação da fronteira; **não** é validação de banco/provider, não autoriza
publicação e **não** atribui aprovação retroativa aos summaries históricos.

## Contagem corrigida

- Auditoria original: 34 caminhos extras + 4 conteúdos divergentes.
- `261026-p11`: **11 caminhos** — 9 extras + `ai/types.ts` e
  `ai/telemetry-sink.ts`. A tabela resumida anterior omitia os 4 caminhos de
  `5816a8ce`; o detalhamento já os continha. A matriz foi recontada e confere
  com 34/4.

## Mudanças no guard

Arquivo: `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts`
(commit `3433a713`).

- Adicionadas 34 entradas com `path` + `authorization` + `commit` imutável:
  - `261026-pricing`: 12 caminhos (`89994b1d`, `99132b1e`, `ab69495a`).
  - `261026-vs`: 8 caminhos (`43652290`, `563e1a09`, `c282d0bc`) + `gateway.ts`.
  - `261026-p11`: 9 caminhos (`2d42c512`, `5816a8ce`) + `types.ts`/`telemetry-sink.ts`.
  - `261025-k8e`: 2 caminhos (`f3dcfa8f`).
  - `261027-llm`: 2 caminhos (`76c1ef02`).
  - `261102-o00`: 1 caminho (`4d5cfc19`).
- Atualizados 4 commits de conteúdo:
  - `ai/types.ts` e `ai/telemetry-sink.ts`: `201e606f` → `2d42c512`.
  - `ai/gateway.ts`: `322809d0` → `43652290`.
  - `credit/credit-service.ts`: `05e81d90` → `59e8bea0` (F58-01).
- Teste negativo de caminho extra passou a usar `src/lib/ai/adapters/registry.ts`
  (intencionalmente não autorizado), pois `adapters/images.ts` agora tem entrada
  própria.
- Os dois testes que comparam conteúdo receberam timeout de **20 s** para
  absorver ~64 `git show` sob carga da suíte completa. Nenhuma asserção foi
  removida ou afrouxada.

## Proteções preservadas

- `BASE_SHA = 335bfb70` e a evidência histórica intocados.
- Comparação exata de caminhos e de conteúdo contra commits imutáveis.
- Nenhuma referência a `HEAD` para derivar conjunto ou conteúdo.
- Testes negativos de caminho extra, ausente e conteúdo divergente mantidos.
- Verificações específicas das rotas `generate-image` e download preservadas.

## Validação

| Comando | Resultado |
| --- | --- |
| Guard isolado | **10/10 passed** |
| `npm.cmd test` | **596 passed / 2 skipped (598 arquivos)**; **7507 passed / 10 skipped / 0 failed** |
| `npm.cmd run test:scripts` | **73/73 passed** |
| `npm.cmd run test:gates` | exit 0; gates de integração não executados |
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd run lint` | exit 0 |
| `git diff --check` | exit 0 |

### Instabilidade observada e investigada

Na primeira execução da suíte completa após a reconciliação, o teste positivo
“aceita caminhos e conteúdos quando idênticos ao autorizado” estourou o timeout
padrão de 5 s (`Test timed out in 5000ms`), não por divergência de conteúdo. A
causa é o custo de ~64 subprocessos `git show` sob a suíte completa. O timeout
dos dois testes de conteúdo foi elevado para 20 s e a suíte foi repetida uma
vez, passando. A primeira falha fica registrada aqui; não foi ocultada por
repetições cegas.

## Skips e gates pendentes

- 10 testes ignorados pela própria suíte (skips legítimos já existentes).
- Perfis de integração **não executados**: PostgreSQL/homolog, PostgreSQL/local,
  PostgreSQL/f50-4, app-env e Produto 1:1. `app-env` está com ambiente presente,
  mas permanece “NÃO EXECUTADO”.
- Nenhum banco, provider, migration, integração, push, merge, deploy ou chamada
  paga.

## Próximo passo

Revisão final do conjunto completo (código + documentos). O push permanece
reservado para depois dessa revisão.
