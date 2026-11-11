---
phase: 261111-idz
plan: 01
subsystem: campaign/square-preparation
tags:
  - f60.2
  - deterministic-preparation
  - jpeg
  - sharp
  - f60.1-reuse
status: complete
completed: "2026-11-11"
duration_minutes: 22
tasks_completed: 3
tasks_total: 3
commits:
  - 8b483a03
  - 1f43506f
  - 73cff523
files_created: 11
files_modified: 0
---

# Quick 261111-idz: Preparation Summary

**One-liner:** Módulo server-only que converte um `square_original` JPEG 1024×1024 em `square_prepared` JPEG 1152×1152 por receita Sharp determinística (fator único 9/8, Lanczos3, sRGB, q90 4:4:4), persistido e recuperado exclusivamente pela F60.1, com `reused` liberado apenas após verificar a evidência durável do objeto.

## Files created

Production (6):

| File | Purpose |
|---|---|
| `src/lib/campaign/square-preparation/types.ts` | Contrato puro de entrada + união discriminada de 9 resultados (reusa tipos F60.1) |
| `src/lib/campaign/square-preparation/recipe.ts` | Fonte/alvo/origem e receita congelada derivadas de `ROLE_POLICY`; escala 9/8 |
| `src/lib/campaign/square-preparation/reuse-compatibility.ts` | Predicado puro e conservador prepared↔fonte (13 condições, conjunto exato de proveniência) |
| `src/lib/campaign/square-preparation/reuse-evidence.ts` | Verificação READ-ONLY: `buildObjectEvidence` + `CompositionArtifactStorage.readObjectInfo` + `verifyObjectEvidence` |
| `src/lib/campaign/square-preparation/transform.ts` | Pipeline Sharp 1024→1152 com decode completo da fonte e verificação F60.1 da saída |
| `src/lib/campaign/square-preparation/prepare.ts` | Orquestração retrieve → probe (linha+bytes+evidência) → transform → persist F60.1 → readback |

Testes (5):

| File | Purpose |
|---|---|
| `__tests__/reuse-compatibility.contract.test.ts` | 15 casos: condição compatível, cada divergência isolada, case-insensitive, entrada malformada |
| `__tests__/transform.contract.test.ts` | 8 casos com Sharp real: dimensões, recusas, determinismo, nenhum caminho lança |
| `__tests__/prepare.contract.test.ts` | 35 casos com fake de DB/Storage: criação, geometria, original preservado, idempotência, evidência durável (5 negativos), recusas, persistência, conflito, efeitos |
| `__tests__/support/jpeg-fixtures.ts` | Fixtures de pixel cru (quadrantes + 2 marcadores) e constantes escaladas (288/864, lado 72, coluna 576) |
| `__tests__/support/fake-artifact-backend.ts` | Fake focado na fronteira DB/Storage com handles observáveis e helpers de seed/tamper/snapshot |

Nenhum arquivo existente foi modificado (`git diff --name-status d442c973..HEAD` contém apenas 11 linhas `A`).

## Focused gates

| Gate | Command | Result |
|---|---|---|
| Suíte focada | `node node_modules/vitest/vitest.mjs run src/lib/campaign/square-preparation` | **3 arquivos / 58 testes PASS**, exit **0** |
| Typecheck | `npm.cmd run typecheck` | exit **0** |
| Lint | `npm.cmd run lint` | exit **0** (limitação preexistente: `eslint.config.mjs` sem parser TS, cobre só JS/MJS/CJS — não corrigida) |
| Whitespace | `git diff --check` | exit **0**, sem saída |
| Worktree | `git status --porcelain` | apenas `?? .planning/quick/261111-idz-preparacao-deterministica-1024-para-1152/` (PLAN/SUMMARY); nenhum arquivo rastreado tocado |

Per-file counts: `reuse-compatibility` **15/15**, `transform` **8/8**, `prepare` **35/35**.

`git diff --name-status d442c973..HEAD`:

```
A  src/lib/campaign/square-preparation/__tests__/prepare.contract.test.ts
A  src/lib/campaign/square-preparation/__tests__/reuse-compatibility.contract.test.ts
A  src/lib/campaign/square-preparation/__tests__/support/fake-artifact-backend.ts
A  src/lib/campaign/square-preparation/__tests__/support/jpeg-fixtures.ts
A  src/lib/campaign/square-preparation/__tests__/transform.contract.test.ts
A  src/lib/campaign/square-preparation/prepare.ts
A  src/lib/campaign/square-preparation/recipe.ts
A  src/lib/campaign/square-preparation/reuse-compatibility.ts
A  src/lib/campaign/square-preparation/reuse-evidence.ts
A  src/lib/campaign/square-preparation/transform.ts
A  src/lib/campaign/square-preparation/types.ts
```

Confirmado: **zero** alterações em `src/lib/campaign/composition-artifacts/**`, `supabase/migrations/**`, `package.json`, configs de Vitest, rotas, UI ou orquestradores. Nenhuma dependência nova, nenhum `npx`, nenhuma rede/DB/Storage real/IA/chamada paga.

## Durable evidence — negative results (critical addendum)

Após uma preparação bem-sucedida, cada caso adultera/remove a metadata do objeto prepared e repete a chamada:

| Tamper | Resultado observado | Transform | uploads/inserts | removes | Linha/objeto |
|---|---|---|---|---|---|
| metadata removida | `conflict` / `provenance_conflict` / `evidence_missing` | invocado (1×) | não aumentam | 0 | inalterados |
| metadata `"{not-json"` | `conflict` / `provenance_conflict` / `evidence_invalid` | invocado (1×) | não aumentam | 0 | inalterados |
| `evidenceDigest` adulterado | `conflict` / `provenance_conflict` / `evidence_mismatch` | invocado (1×) | não aumentam | 0 | inalterados |
| campo divergente + digest recalculado | `conflict` / `provenance_conflict` / `evidence_mismatch` | invocado (1×) | não aumentam | 0 | inalterados |
| `info` indisponível (503 pós-upload) | `indeterminate` / `stage: "persist"` | invocado (1×) | não aumentam | 0 | inalterados |

Em todos: `result.kind !== "prepared"`, `updates = 0`, linha (`rowsForPath`) e objeto (checksum/byteSize/metadata) idênticos ao estado adulterado — nenhuma sobrescrita, correção ou delete.

Caminho positivo mantido: prepared válido (bytes da receita **ou** de outra codificação q70) + linha compatível + evidência verificada → `persistence: "reused"`, transform **não** invocado, sem segundo upload/insert; `verifyPreparedReuseEvidence` devolve `verified`.

## Geometry evidence

Decodificação real da saída via Sharp: 1152×1152, 3 canais, formato `jpeg`; transição vermelho→azul em y=100 dentro de 576 ± 3; centróides preto (288,288) ± 4 e branco (864,864) ± 4; bounding box de cada marcador 72 ± 3 px de lado e razão largura/altura 1,0 ± 0,03 (escala uniforme, sem distorção anamórfica); amostras dos quatro quadrantes preservadas; cantos não quase-pretos (sem pad/fundo). Tolerâncias justificadas no teste: cobrem ringing do Lanczos3 + quantização JPEG q90 e não cobrem crop/pad/distorção.

## Deviations from plan

1. **[Rule 3 - Blocking] Gate commands** — o plano listava `npm.cmd exec --no-install vitest run …`; a instrução de execução proíbe `npm exec --no-install`. Todos os gates de teste usaram `node node_modules/vitest/vitest.mjs run …` (mesmo efeito, sem resolução de pacote).
2. **[Rule 2 - Missing critical support] Helpers extras no fake** — além da lista do plano, o fake expõe `hideNextObjectInfoWhenPresent` (isola a leitura `info` **pós-upload**), `hideNextObjectDownload`, `rowsForTable`, `objectBytes`, `rowsForPath`. Motivo: `persistCompositionArtifact` lê `info` no path do prepared **antes** do upload (passo 5) e depois no passo 8; um "hide once" simples consumia a primeira leitura e não reproduzia a ambiguidade pós-upload exigida pelo caso "info ambíguo após upload".
3. **[Rule 1 - Gate hygiene] Comentário de `transform.ts` reescrito** — a primeira redação citava os nomes literais dos métodos proibidos no comentário, o que quebrava o critério `grep vazio` do plano. O comentário agora descreve as proibições sem os identificadores; `grep -E "rotate|withMetadata|flatten|extend|extract"` retorna **0** ocorrências no arquivo.
4. **[Rule 1 - Type-only] `SquareTransformFailureReason` exportado** — o helper `fail()` usava `Extract<…>`, que também casava o grep de `extract`. A união de motivos foi nomeada; comportamento idêntico.

Sem alteração de escopo, sem enfraquecimento de teste, sem tocar F60.1.

## Limitations (declared, not fixed)

- **JPEG é lossy.** A saída não é lossless nem pixel-idêntica; a garantia é de geometria (1:1, fator único 1,125, sem crop/pad/barra) dentro da tolerância Lanczos3 + quantização q90.
- **Reprodutibilidade atrelada ao build de libvips/Sharp.** Outra versão pode gerar checksum diferente para a mesma fonte; nesse caso a F60.1 responde `content_conflict` (fail-closed) sem sobrescrever. O prepared já compatível continua reutilizável sem re-encode (coberto por teste com bytes de outra qualidade).
- **Múltiplas leituras de Storage por chamada.** No caminho `created`: retrieve da fonte + revalidação da fonte pela persistência + `info` pré-upload + `info`/download pós-upload + readback; no caminho `reused`: retrieve da fonte, retrieve do prepared e um `info` extra para a evidência durável. Custo aceito; nenhum cache paralelo foi criado.
- **Evidência durável falha fechado.** `info` indisponível ou metadata ausente/inválida/divergente recusa o atalho e delega à F60.1 (`indeterminate`/`provenance_conflict`), nunca devolve `reused` sem evidência.
- **Papel `square_prepared` segue aceito como fonte pela F60.1.** Este módulo estreita a própria entrada para `square_original` sem alterar a F60.1 (testado).
- **Checksum/digests** são apenas consumidos da F60.1; nenhuma implementação paralela.
- Sem execução de suíte global, integração real, Docker, banco, Storage real, IA, deploy, push, merge ou OpenSpec nesta rodada.

## Self-Check

- Arquivos criados existem: PASSED (11/11 presentes na árvore e nos commits).
- Commits existem na branch atual: PASSED (`8b483a03`, `1f43506f`, `73cff523`).
- Nenhum arquivo F60.1/migration/dependência/config alterado: PASSED (`git diff --name-status d442c973..HEAD` só com `A` no diretório novo).
- Suíte focada 58/58, typecheck 0, lint 0, `git diff --check` limpo: PASSED.
