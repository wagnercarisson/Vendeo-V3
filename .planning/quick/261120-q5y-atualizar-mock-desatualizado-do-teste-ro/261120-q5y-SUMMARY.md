---
phase: quick/261120-q5y
plan: 01
subsystem: admin-pending-route-tests
tags: [testing, vitest, f60.5, mock-repair]
requires: []
provides:
  - "teste hermético de GET/POST /api/admin/product-1-1-pending exercitando o buildAdminPendingRepository REAL"
  - "mapeamento fiel de resolutionErrorStatus (400/404/409/500) no mock de resolve-pending-operation"
affects:
  - src/app/api/admin/product-1-1-pending/__tests__/route-format.test.ts
tech-stack:
  added: []
  patterns:
    - "vi.mock parcial via importOriginal para preservar exports reais do módulo mockado"
    - "sondas fake estáveis em vi.hoisted + asserção de identidade de options do repositório"
key-files:
  created: []
  modified:
    - src/app/api/admin/product-1-1-pending/__tests__/route-format.test.ts
decisions:
  - "Mock parcial (importOriginal) em vez de mock total: buildAdminPendingRepository precisa permanecer real (F60.5)"
  - "resolutionErrorStatus do teste espelha literalmente BAD_REQUEST_CODES/CONFLICT_CODES do código real para que erro técnico nunca vire 409"
  - "Nenhum caso de teste novo foi adicionado — escopo travado nos 5 testes existentes (gate do usuário)"
metrics:
  duration: "~10min"
  completed: 2026-11-20
---

# Quick 261120-q5y: Correção do mock desatualizado de `route-format.test.ts` — Summary

Teste do admin de pendências voltou a exercitar o `buildAdminPendingRepository` real, com fake adapter completo (incl. `twoStageArtifacts`) e mapeamento HTTP fiel; **5/5 verdes** contra baseline **4 failed / 1 passed**.

## O que foi feito

### Causa raiz

O teste substituía o módulo `@/lib/product-vertical-9-16/recovery/pending-adapter` **inteiro** por um mock que exportava apenas `createPendingFormatAdapter`. Desde a F60.5 a rota importa também `buildAdminPendingRepository` do mesmo módulo, então o builder chegava como `undefined`:

- `GET` lançava `TypeError` e caía no `catch` ⇒ **500**;
- `POST` lançava `TypeError` em `buildAdminPendingRepository(...)` e caía em `resolutionError`;
- o stub `resolutionErrorStatus: () => 409` rotulava essa falha **técnica** como conflito de negócio, escondendo a regressão.

### Mudanças (somente o arquivo de teste)

1. **Mock parcial do adapter** (padrão já validado em `src/lib/product-9-16-two-stage/__tests__/admin-pending-route.test.ts:30-39`):
   `vi.mock(..., async (importOriginal) => ({ ...actual, createPendingFormatAdapter: mockCreateAdapter }))`.
   `buildAdminPendingRepository` permanece **real** e instancia o `MockRepository` do teste, que captura `options`.
2. **Fake adapter completo**: `resolveFormat`, `verticalArtifacts`, `twoStageArtifacts` (F60.5) e `projectionFor`. As sondas `verticalProbe`/`twoStageProbe` são criadas **uma vez** dentro de `vi.hoisted` (identidade estável), com `probeArtifact` devolvendo `{ kind: "absent" }`.
3. **Asserções de identidade no GET**: `repoOptions[0]?.resolveFormat === mockResolveFormat`, `?.verticalArtifacts === mockVerticalArtifacts` (substitui o `toBeDefined()` frouxo) e `?.twoStageArtifacts === mockTwoStageArtifacts`.
4. **Determinismo**: `repoOptions.length = 0` no `beforeEach`, após `vi.clearAllMocks()` (mantido `clearAllMocks`, não `resetAllMocks`, para preservar as implementações dos `vi.fn` hoisted).
5. **`resolutionErrorStatus` fiel** substituindo `() => 409`: listas `BAD_REQUEST_CODES` (8 códigos ⇒ 400) e `CONFLICT_CODES` (5 códigos ⇒ 409) copiadas literalmente, `operation_not_found` ⇒ 404, `instanceof MockResolutionError` para o `code`, e **500 para todo o resto** (TypeError/Error genérico/`unknown`).
6. **Guarda anti-mascaramento**: nos quatro caminhos de sucesso (GET, POST 9:16 com estado, POST 1:1, POST 9:16 sem estado) além de `toBe(200)` foram adicionados `expect(res.status).not.toBe(409)` e `not.toBe(500)`.

Casos preservados sem alteração de intenção: GET 200; formato indisponível ⇒ 503 `format_unavailable` **antes** de resolver (sem chamar `mockResolvePendingOperation`); POST 9:16 com estado injeta projeção; POST 1:1 não injeta; POST 9:16 sem estado não injeta. Nenhum teste removido, nenhum `skip`/`todo`, nenhum `expect` enfraquecido.

## Deviations from Plan

Nenhum desvio de execução. Duas notas de escopo (aplicadas de propósito, conforme `<scope_overrides>` do orquestrador):

- **Task 2 não incluiu casos novos**: os itens 2 e 3 do plano (caso `TypeError ⇒ 500` e o par `operation_terminal ⇒ 409`) eram **opcionais/extra**; o gate de validação é "os 5 testes existentes passam", então nenhum caso foi adicionado. O mapeamento fiel de `resolutionErrorStatus` (parte obrigatória) foi implementado.
- **ESLint não cobre o arquivo**: `npx eslint ...route-format.test.ts` retorna "File ignored because no matching configuration was supplied" (0 errors) — arquivos `__tests__` estão fora da configuração do ESLint do projeto.

## Verification

| Comando | Resultado |
|---|---|
| `npx vitest run src/app/api/admin/product-1-1-pending/__tests__/route-format.test.ts` | **5 passed / 0 failed** (baseline: 4 failed / 1 passed) |
| `npx vitest run` nas 4 suítes de `product-9-16-two-stage` (`admin-pending-route`, `admin-pending-two-stage.contract`, `admin-pending-wiring.contract`, `pending-operations-repository`) | **4 files, 10 passed / 10** (nenhuma regressão) |
| `npx vitest run` nas **5 suítes juntas** (route-format + as 4 acima) | **5 files, 15 passed / 15** |
| `npm.cmd run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | **limpo** |
| `npm.cmd run lint` (`eslint .`) | **projeto limpo, 0 erros**; ressalva: o ESLint **ignora** `__tests__/route-format.test.ts` (sem configuração correspondente), então o lint **não cobre** este arquivo |
| `git diff --check` | **limpo** |
| `git diff --stat` | 1 arquivo de código (o teste) + 2 `__pycache__` pré-existentes, não stageados |

### Revisão independente (2026-11-20)

Revisão do usuário aprovou a correção técnica sem bloqueadores:

- fábrica real preservada pelo mock parcial confirmada;
- sondas encaminhadas corretamente ao repositório;
- mapeamento de erros confere com o código atual;
- nenhum código de produção alterado;
- reexecução das **5 suítes juntas: 15/15 testes passaram**;
- diff limpo; apenas os dois `__pycache__` preexistentes permanecem modificados.

A suíte global **não foi reexecutada** nesta quick; a contagem geral de falhas externas permanece não atualizada.

Gates do plano (`rg -n "importOriginal" <arquivo>` ⇒ 1 ocorrência; `twoStageArtifacts` presente; `resolutionErrorStatus: () => 409` ⇒ 0 ocorrências) confirmados.

## Commits

- `63f18642` — `test(261120-q5y): fix stale admin pending route mock` (1 arquivo: `route-format.test.ts`)

## Proteções respeitadas

Nenhuma alteração em código de produção, schema, RPC, migration, credit/pricing, banco, homolog, produção, Storage ou provider. Nenhum merge/push/deploy. Arquivos `__pycache__` pré-modificados permaneceram intocados e não foram stageados.

## Self-Check: PASSED

- FOUND: `.planning/quick/261120-q5y-atualizar-mock-desatualizado-do-teste-ro/261120-q5y-SUMMARY.md`
- FOUND: `63f18642` (`git log --oneline -1`)
- FOUND: `src/app/api/admin/product-1-1-pending/__tests__/route-format.test.ts` modificado no commit; `git status` limpo para código (restam apenas os `__pycache__` pré-existentes e os artefatos de `.planning/quick/...`, que o orquestrador commita)
