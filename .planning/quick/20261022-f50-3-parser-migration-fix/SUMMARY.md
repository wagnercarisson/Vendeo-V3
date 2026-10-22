---
status: complete
date: 2026-10-22
slug: f50-3-parser-migration-fix
---

# Summary: correção de parser da migration F50.3

## Causa

O parser do Supabase CLI **2.75.0** (`pkg/parser/state.go`) trata qualquer substring `atomic` fora de string/comentário como início de `BEGIN ATOMIC`. O nome `chk_stores_cnpj_atomic` termina em `atomic`; ao processar o `DROP CONSTRAINT`, o tokenizer entra em modo atômico e ignora os `;` seguintes até um `END` inexistente. Resultado: `DROP + ADD + VALIDATE + COMMENTs` viram um único statement e o `pgconn.ExecBatch` falha com `SQLSTATE 42601: cannot insert multiple commands into a prepared statement` (`At statement: 1`), após o `DO` de preflight.

## Correção

Somente as três referências executáveis foram trocadas por `U&"chk_stores_cnpj_atom\0069c"` (escape Unicode de `i`). O identificador resolve para o **mesmo** nome real `chk_stores_cnpj_atomic`. Preflight, regex `^[A-Z0-9]{12}[0-9]{2}$`, `NOT VALID` + `VALIDATE`, comentários e o bloco REVERT foram preservados. Comentário curto adicionado no arquivo explicando o workaround.

## Produção

Permanece **sem esta migration aplicada** (verificado em 2026-10-22, somente leitura): `supabase migration list --linked` mostra `20261021000001` local presente e remoto **vazio**; `chk_stores_cnpj_atomic` ainda está com `^\d{14}$`.

## Reprodução e validação

- **Reprodução:** `supabase db push --db-url` (CLI 2.75.0) contra PostgreSQL 17.6 descartável → exit 1, `ERROR: cannot insert multiple commands into a prepared statement (SQLSTATE 42601)`, `At statement: 1`.
- **Validação do arquivo corrigido:** mesmo mecanismo/CLI → **exit 0**; constraint `chk_stores_cnpj_atomic` recriada com `convalidated = true` e regex `[A-Z0-9]{12}[0-9]{2}`; ledger com `20261021000001`; dado existente intacto.

## Verificações

- `node --check scripts/verify/50-3-cnpj-alfanumerico-verification.mjs` → exit 0.
- `node scripts/verify/50-3-cnpj-alfanumerico-verification.mjs --self-test` → **14/14 PASS** (offline).
- Verificador usa o nome real via consulta ao banco (`CONSTRAINT_NAME = "chk_stores_cnpj_atomic"`); **nenhuma verificação estática ativa dependia da grafia literal** — nenhum ajuste necessário.
- `git diff --check` limpo.

## Não executado

`db push` remoto, `migration repair`, merge, deploy, atualização do CLI, reparo do container isolado ou alteração do archive.