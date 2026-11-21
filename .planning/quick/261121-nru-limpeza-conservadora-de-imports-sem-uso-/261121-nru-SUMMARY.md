# Quick 261121-nru — Limpeza conservadora de imports sem uso

**Natureza:** higiene de testes. **Não é correção funcional** do aplicativo. Não há bug de produto,
mudança de comportamento ou ganho funcional prometido. O efeito observável é a remoção de 10 avisos
`@typescript-eslint/no-unused-vars` em 10 arquivos de teste, sem alterar a quantidade ou o resultado
dos testes.

## Partida

- Branch: `chore/test-unused-imports`
- HEAD de referência do plano/baseline: `1f876d61`
- HEAD real no início da execução: `b4ac07f2` (dois commits **somente de documentação** acima de
  `1f876d61`: `8a926507` plano + `b4ac07f2` baseline no plano). Árvore de código idêntica a `1f876d61`.
- Worktree limpa no início; nenhum arquivo modificado ou não rastreado.
- Baseline focada já registrada: 10 arquivos / 52 testes / 52 PASS / 0 FAIL.

## As 10 edições (1 ImportSpecifier removido por arquivo)

| # | Arquivo | Linha | Removido | Import final |
|---|---------|-------|----------|--------------|
| 1 | `src/__tests__/actions/store-identity-service.test.ts` | 2 | `beforeEach` | `import { describe, it, expect, vi } from "vitest";` |
| 2 | `src/__tests__/api/campaign-intent-guard.test.ts` | 1 | `vi` | `import { describe, it, expect } from "vitest";` |
| 3 | `src/__tests__/auth/check-email.test.tsx` | 3 | `screen` | `import { render } from "@testing-library/react";` |
| 4 | `src/app/api/store/[id]/logo/retry-brand-director/__tests__/retry-route.test.ts` | 1 | `beforeAll` | `import { describe, it, expect, vi, beforeEach } from 'vitest';` (aspas simples preservadas) |
| 5 | `src/components/admin/__tests__/review-actions.test.tsx` | 3 | `act` | `import { render, screen, fireEvent, waitFor } from "@testing-library/react";` |
| 6 | `src/components/credit/__tests__/credit-cta.test.tsx` | 3 | `vi` | `import { describe, it, expect } from "vitest";` (linha 4 intocada) |
| 7 | `src/components/flow/__tests__/campaign-input-form-generation.test.tsx` | 3 | `act` | `import { fireEvent, render, screen, waitFor } from "@testing-library/react";` |
| 8 | `src/components/flow/__tests__/store-identity-form.drift-fiscal-block.test.tsx` | 15 | `act` | `import { render, screen, fireEvent, waitFor } from "@testing-library/react";` |
| 9 | `src/components/flow/__tests__/use-campaign-form-review.test.ts` | 4 | `waitFor` | `import { renderHook, act } from "@testing-library/react";` (linha 5 intocada) |
| 10 | `src/components/legal/__tests__/privacy-recovery.test.tsx` | 3 | `act` | `import { render, screen, waitFor } from "@testing-library/react";` |

Cada arquivo teve exatamente 1 linha alterada (`git diff --numstat`: dez linhas `1	1	<arquivo>`).
Ordem, aspas, espaçamento, ponto e vírgula e os demais especificadores foram preservados. Nenhum
import inteiro removido, nenhuma consolidação, reordenação ou reformatação. Antes de editar, foi
confirmado por AST/texto que cada símbolo removido tinha **zero referências fora da própria linha de
import**. A linha 5 de `use-campaign-form-review.test.ts` (`import { render, screen } ...`) permaneceu
byte a byte igual; a linha 4 de `credit-cta.test.tsx` não foi tocada.

## Testes focados (mesmo comando da baseline, pós-edição)

Comando: `node node_modules/vitest/vitest.mjs run <10 arquivos> --reporter=json --outputFile=<temp>`.

| # | Arquivo | Testes | Resultado |
|---|---------|--------|-----------|
| 1 | `src/__tests__/actions/store-identity-service.test.ts` | 4 | 4 PASS |
| 2 | `src/__tests__/api/campaign-intent-guard.test.ts` | 6 | 6 PASS |
| 3 | `src/__tests__/auth/check-email.test.tsx` | 4 | 4 PASS |
| 4 | `retry-route.test.ts` | 9 | 9 PASS |
| 5 | `review-actions.test.tsx` | 3 | 3 PASS |
| 6 | `credit-cta.test.tsx` | 1 | 1 PASS |
| 7 | `campaign-input-form-generation.test.tsx` | 7 | 7 PASS |
| 8 | `store-identity-form.drift-fiscal-block.test.tsx` | 2 | 2 PASS |
| 9 | `use-campaign-form-review.test.ts` | 12 | 12 PASS |
| 10 | `privacy-recovery.test.tsx` | 4 | 4 PASS |
| | **Total** | **52** | **52 PASS / 0 FAIL / 0 skip / 0 todo** |

Contagens por arquivo idênticas à baseline (4/6/4/9/3/1/7/2/12/4).

## Gates oficiais (exit codes reais)

| Gate | Comando | Exit | Resultado |
|------|---------|------|-----------|
| Typecheck | `npm.cmd run typecheck` | **0** | 0 erros |
| Lint oficial | `npm.cmd run lint` | **0** | 0 problemas |
| Build | `npm.cmd run build` | **0** | build completo, rotas geradas |
| Suíte global | `npm.cmd test` | **0** | **835 arquivos passed / 2 skipped (837)**; **10.324 testes passed / 10 skipped (10.334)**; **0 failed** |

A suíte global coincide exatamente com a baseline conhecida da quick `261121-m97` no HEAD `1f876d61`
(835 arquivos / 10.324 testes PASS / 0 failed). Não houve novo arquivo falhando, redução de PASS nem
skip novo atribuível ao lote.

## Reavaliação diagnóstica somente leitura (sem `--fix`, saída fora do repo)

- `node scripts/lint/build-inventory.mjs --out <TEMP>/nru-inventory-after --baseline <k4g>`:
  exit **0**; 1.965 arquivos; **warnings 373 → 363** (redução exata de 10); **0 erros**, **0 fatais**,
  **0 configNotices**, **0 configErrors**.
- ESLint diagnóstico fresco (`node node_modules/eslint/bin/eslint.js --config
  eslint.diagnostic.config.mjs --no-inline-config -f json`, saída em `<TEMP>`): 1.965 arquivos,
  363 warnings, 0 erros, 0 fatais, JSON sem BOM.
- Extração AST (TypeScript compiler API sobre os resultados do ESLint; ImportSpecifier nomeado com
  0 referências fora do import): **28 → 18**. Decomposição exata:
  - **6** em `src/lib/product-two-format/orchestration/__tests__/support/joint-offline-world.ts`
    (suporte compartilhado): `frozenFingerprint`, `serializeFrozenPayload`, `composeSquareBasePrompt`,
    `TwoStageStepStatus`, `retrieveCompositionArtifact`, `generateCampaignThumbnailSafely`.
  - **9** imports de teste não utilitários (adiados): `Loader2`, `SupabaseClient` (bench),
    `getBenchRun`, `AiInvocationRequest`, `SupabaseClient` (persisted-campaign), `reserveCredit`,
    `ProductOneToOneAttemptStartClient`, `OPERATION_ID`, `FormData`.
  - **3** utilitários adiados por limite de 10 arquivos: `vi` em `thumbnail-generator.test.ts`,
    `beforeEach` em `pending-resolution.contract.test.ts`, `vi` em `telemetry.contract.test.ts`.
- **Nenhum dos 10 arquivos do lote permanece na lista** e nenhum aviso novo apareceu em arquivo do lote.

## Candidatos preservados e motivos

- `support/joint-offline-world.ts` (6): suporte compartilhado de testes; fora do escopo autorizado.
- 3 utilitários (`thumbnail-generator.test.ts`, `pending-resolution.contract.test.ts`,
  `telemetry.contract.test.ts`): adiados pelo limite de 10 arquivos desta quick.
- 9 imports não utilitários: fora da prioridade deste lote.

## Escopo e não-alteração

- Alterados: **somente** os 10 arquivos de teste acima (10 linhas de import). Commit de código:
  `6820e0f5 chore(tests): remover imports sem uso em 10 arquivos de teste` (10 files changed,
  10 insertions, 10 deletions).
- Nenhum código de produção, nenhum suporte compartilhado de testes, nenhum teste/asserção/mock/
  fixture/tipo removido, ignorado, renomeado ou enfraquecido.
- Nenhuma alteração em `eslint.config.mjs`, `eslint.diagnostic.config.mjs`, `package.json`,
  `package-lock.json`, `supabase/`, `vercel.json` ou `.planning/STATE.md`.
- `git diff --check` limpo; worktree limpo; sem arquivos não rastreados.
- Nenhum `eslint --fix`, prettier, organizeImports ou substituição em massa foi usado.
- Sem merge, push, deploy, PR, migration, banco, Storage, provider, geração paga ou acesso a ambiente.
- Este SUMMARY foi criado pelo executor e commitado pelo orquestrador no commit documental
  `1c471bb4 docs(261121-nru): registrar limpeza conservadora de imports sem uso`; a atualização do
  STATE é feita no fechamento da quick.

**Ponto de parada respeitado.** A quick é higiene de testes, não correção funcional; nenhum novo lote
foi iniciado.

## Aceite

- **Aprovado em 2026-11-21, sem bloqueadores no diff.** A revisão conferiu o commit `6820e0f5`:
  exatamente dez remoções de símbolos nas linhas de import, módulos ainda importados, nenhuma
  asserção/mock/código de produção alterado, `git diff --check` limpo e árvore limpa.
- Os resultados registrados foram considerados coerentes com o lote; nesta revisão os testes **não**
  foram reexecutados pelo revisor.
- Ajuste documental solicitado e aplicado: esta nota corrige a frase anterior que dizia que o SUMMARY
  não havia sido commitado.
- Os três imports adiados permanecem limpeza opcional; não são pendência funcional nem bloqueio de
  publicação. Nenhum novo lote foi iniciado.
