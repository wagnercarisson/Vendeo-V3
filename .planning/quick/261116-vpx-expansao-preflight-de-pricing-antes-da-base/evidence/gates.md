# 261116-vpx — evidências de gate (2026-11-16)

Base da correção: `main` @ `ae5d0e79b176d6d8716d74fca2315ee27bbb67b2`.
Todos os comandos abaixo foram executados localmente, sem rede, banco, Storage,
provider ou produção.

## Suítes

```
npx vitest run src/lib/campaign/vertical-expansion src/lib/product-9-16-two-stage
Test Files  51 passed (51)
     Tests  447 passed (447)
```

```
npx vitest run src/lib/campaign src/lib/product-vertical-9-16
Test Files  88 passed (88)
     Tests  1163 passed (1163)
```

```
npx vitest run src/app/api/campaign/generate-image src/app/api/campaign/generation-status "src/app/api/campaign/[id]/continue"
Test Files  5 passed (5)
     Tests  140 passed (140)
```

```
npx vitest run src/lib/product-1-1/__tests__/orchestration.contract.test.ts \
  src/lib/product-1-1/__tests__/credit-operation.contract.test.ts \
  src/lib/product-1-1/__tests__/result-states.contract.test.ts \
  src/lib/product-1-1/__tests__/failure-closure.layer1-simulation.test.ts
Test Files  4 passed (4)
     Tests  104 passed (104)
```

```
npm run test:scripts
tests 102
pass 102
fail 0
```

## Estático / build / diff / OpenSpec

```
npm run typecheck
> tsc -p tsconfig.typecheck.json --noEmit
exit 0
```

```
npm run lint
> eslint .
exit 0
```
Limitação preexistente: ESLint sem cobertura de arquivos TypeScript.

```
npm run build
exit 0 (next build concluído; tabela de rotas emitida)
```

```
git diff --check
(diff-check: OK)
```

```
openspec validate campaign-vertical-ai-expansion --strict
Specification 'campaign-vertical-ai-expansion' is valid

openspec validate product-9-16-two-stage-orchestration --strict
Specification 'product-9-16-two-stage-orchestration' is valid
```

## Falhas preexistentes confirmadas na base

Com a worktree limpa (stash da correção) e somente esses dois alvos:

```
npx vitest run src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts \
  src/lib/ai/__tests__/telemetry-coverage.test.ts
Test Files  2 failed (2)
     Tests  5 failed | 9 passed (14)
```

- `telemetry-coverage.test.ts`: 1 falha preexistente.
- `legacy-frontier.guard.test.ts`: 4 falhas preexistentes.

O stash foi restaurado (`git stash pop`) imediatamente após a conferência.
Nenhuma dessas falhas foi introduzida ou “corrigida” por esta quick.

## Proibições respeitadas

- Sem acesso/escrita em homolog/produção.
- Sem alteração de pricing, catálogo ou flags.
- Sem migration, push, deploy, nova geração ou chamada paga.
- Sem reparo/reexecução da campanha estornada `c1c0448d-…`.
