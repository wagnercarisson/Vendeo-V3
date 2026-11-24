# F62 — Autorização test-only da allowlist F60.4

**Data:** 2026-11-24
**Autorizador:** responsável pelo produto (instrução explícita nesta sessão)
**Natureza:** autorização **test-only**, limitada à allowlist do guard F60.4.
**Não autoriza:** código de produto, migration, banco, Storage, flags,
configuração, geração paga, cleanup destrutivo, acesso remoto, merge, push ou
deploy.

## 1. Motivo

A verificação final da F62 executou a suíte global e encontrou uma falha
determinística em:

`src/lib/campaign/square-base/__tests__/regression.contract.test.ts`

O guard F60.4 compara os caminhos protegidos contra `PHASE_BASE_SHA` e aceita
somente arquivos listados em `AUTHORIZED_CONTRACT_CHANGES`. O transporte Node
HTTP introduzido pelo `62-08` alterou cinco caminhos de
`composition-artifacts` que ainda não estavam na allowlist. A autorização
dirigida anterior (F62/62-03) cobriu outros seis caminhos, não estes cinco.

## 2. Escopo exato autorizado

Adicionar **somente** estes cinco caminhos a
`AUTHORIZED_CONTRACT_CHANGES`:

- `src/lib/campaign/composition-artifacts/node-http-download.ts`
- `src/lib/campaign/composition-artifacts/retrieve.ts`
- `src/lib/campaign/composition-artifacts/storage.ts`
- `src/lib/campaign/composition-artifacts/__tests__/node-http-download.contract.test.ts`
- `src/lib/campaign/composition-artifacts/__tests__/retrieve.contract.test.ts`

## 3. Restrições

- Não alterar `PHASE_BASE_SHA`.
- Não alterar `PROTECTED_PATHS`.
- Não alterar `CONTRACT_PATHS`.
- Não alterar o controle positivo nem qualquer outra asserção do arquivo.
- Não liberar diretórios inteiros nem prefixos.
- Não alterar testes para esconder falhas.
- Manter o build de produção já comprovado como evidência anterior; não
  executar build enquanto a instância 3100 estiver usando a mesma `.next`.

## 4. Verificação exigida após a edição

1. Guard F60.4 (`regression.contract.test.ts`) verde.
2. Testes dirigidos pertinentes da F62 e de `composition-artifacts`.
3. `typecheck`, `lint`, suíte global, `openspec validate --changes --strict` e
   `git diff --check` (range completo e worktree).
4. Se a falha intermitente `store-identity-form.direction-pending` reaparecer na
   suíte global, registrar e investigar; isolamento verde não equivale a global
   verde.

## 5. Estado

**AUTORIZADO E EXECUTADO EM 2026-11-24.** Resultado: guard F60.4 **8/8 PASS**;
suíte global **867 arquivos / 10.805 testes PASS + 2 arquivos/10 skipped, 0
falhas**. O commit deve ser focado e não incluir `.f62-check/`, segredos,
cookies, tokens ou artefatos temporários.
