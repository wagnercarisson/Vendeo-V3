# F57.3 — Evidência do gate de homolog (2026-10-29)

## Alvo

- Container: `supabase_db_vendeo-homolog`
- Imagem: `public.ecr.aws/supabase/postgres:17.6.1.132`
- Endpoint: `127.0.0.1:57782`
- Banco: `postgres`
- Identidade SQL: `current_database()=postgres`, `auth.users` presente.
- `auth.users` antes: 4 linhas.

## Preflight (read-only)

Comandos principais:

```powershell
docker inspect supabase_db_vendeo-homolog --format '{{.Name}} {{.Config.Image}}'
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -Atc "select current_database(), current_user, (select count(*) from auth.users), (select count(*) from supabase_migrations.schema_migrations);"
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -Atc "select version || '|' || coalesce(name,'') from supabase_migrations.schema_migrations order by version;"
```

Resultados:

- Ledger antes: **151**.
- `20261029175849` ausente (F57.3 não aplicada).
- Fingerprint de identidade usado pelos testes (exclui `f57_2_`): **149 / `acc1ce62227e54b8cf0f2f9178e3b2e77f77b89d4582b904a7c1b11972c1e9a9`**.
- Constraint anterior:
  `CHECK ((ui_locale IS NULL) OR (ui_locale = ANY (ARRAY['pt-BR','es-PY'])))`.
- RPC anterior: `write_user_locale_preference(uuid,text,bigint)`, `SECURITY DEFINER`,
  validação `IN ('pt-BR','es-PY')`.
- Grants da RPC: `postgres`, `service_role` (EXECUTE). `anon`/`authenticated` sem EXECUTE.
- Linhas `user_preferences.ui_locale='es-PY'`: **0**.
- Resíduos `f572test-`/`f572proof-` em `auth.users`: **0**.

Snapshot S0 antes: `evidence/f573-s0-before.json`
(stores=4, billing=0, credit_transactions=99, credit_balances=3, entitlements=1,
legal=13, campaigns=70, audit=78).

## Migration

- Arquivo: `supabase/migrations/20261029175849_f57_3_ui_locale_es_419.sql`
- SHA-256: `96D88928D8C75216164F524EF71172258EA29938EAFD86A23A33D9A67AEAE7D4`
- Aplicação: `psql -v ON_ERROR_STOP=1 --single-transaction`, somente esse arquivo.
- Registro no ledger feito na mesma transação:
  `20261029175849 | f57_3_ui_locale_es_419`.
- Saída literal:

```text
ALTER TABLE
UPDATE 0
ALTER TABLE
COMMENT
COMMENT
CREATE FUNCTION
REVOKE
GRANT
INSERT 0 1
```

`UPDATE 0` é o resultado esperado: não havia linhas `es-PY` para converter.

## Pós-aplicação

Comandos principais:

```powershell
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -P pager=off -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.user_preferences'::regclass and conname='chk_user_preferences_ui_locale';"
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -P pager=off -c "select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.store_market_settings'::regclass and conname='chk_store_market_settings_locale';"
docker exec supabase_db_vendeo-homolog psql -U postgres -d postgres -P pager=off -c "select p.oid::regprocedure, position('es-419' in pg_get_functiondef(p.oid)) > 0, position('es-PY' in pg_get_functiondef(p.oid)) > 0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='write_user_locale_preference';"
```

Resultados:

- Ledger depois: **152**; versão `20261029175849` presente.
- `user_preferences`:
  `CHECK ((ui_locale IS NULL) OR (ui_locale = ANY (ARRAY['pt-BR','es-419'])))`.
- `store_market_settings` permanece:
  `CHECK ((default_content_locale = ANY (ARRAY['pt-BR','es-PY'])))`.
- RPC: mesma assinatura `write_user_locale_preference(uuid,text,bigint)`;
  contém `es-419`, **não** contém `es-PY`.
- Grants preservados: `postgres`, `service_role`; `anon`/`authenticated` sem EXECUTE.
- Linhas `es-PY` em `user_preferences`: **0** (conversão de zero linhas, esperada).
- Linhas `es-419` em `user_preferences`: **0**.

Snapshot S0 depois: `evidence/f573-s0-after.json`
(`evidence/f573-s0-compare.md` mostra todas as tabelas com counts/MD5 iguais; o único
“drift” é o ledger, esperado pela nova migration).

## Testes proporcionais

Variáveis usadas: `F57_2_EXPECTED_LEDGER_COUNT=150`,
`F57_2_EXPECTED_LEDGER_SHA256=faf8d309f267a93d95a26d70358b877e6b28147207f3a8183c5f186197fd02fd`
(fingerprint pós-migration, ainda excluindo `f57_2_`).

| Suíte | Comando | Resultado |
|---|---|---|
| Schema | `vitest run src/lib/__tests__/market-preferences-schema.postgres.test.ts` | **9/9 PASS**, exit 0 |
| Segurança | `vitest run src/lib/__tests__/market-preferences-security.postgres.test.ts` | **7/7 PASS**, exit 0 |
| Onboarding — cenário Q | `vitest run ...market-preferences-onboarding... -t "Q. idioma do app e configura"` | **1/1 PASS, 20 skipped**, exit 0 |

Não foram executados a suíte completa de onboarding nem as provas comparativas da F57.2.

## Cleanup e estado final

- Cleanup executado pelos próprios testes via `afterAll`, limitado aos IDs `f572test-` /
  `f572proof-` desta execução. Nenhum registro preexistente removido.
- Resíduos em `auth.users`: **0**.
- Resíduos de lojas de teste: **0**.
- `user_preferences`: **0** linhas.
- `stores`: **4** (igual ao baseline).
- Snapshot pós-testes: `evidence/f573-s0-after-tests.json`; todas as tabelas de dados com
  counts/MD5 iguais ao baseline. Único drift: ledger (esperado).
- Ledger final: **152**.

## Smoke de API — BLOQUEADO (tentativa de retomada em 2026-10-29)

- A aplicação Next.js está em execução em `127.0.0.1:3000` (PID 24012,
  `next/dist/server/lib/start-server.js`).
- `.env.local` aponta `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL` para
  `http://127.0.0.1:57781` (homolog), não para produção.
- A sessão autenticada existe apenas no navegador do usuário. O shell do agente não possui
  cookies de sessão: `GET http://127.0.0.1:3000/api/preferences` retornou **401**.
- Não é possível usar a sessão existente a partir do shell sem extrair cookies do navegador,
  o que foi explicitamente proibido. Nenhuma credencial foi procurada ou extraída.
- Portanto, nenhum PATCH foi executado: os cenários de `es-419`, `es-PY` 400, 409, omitido,
  `null` e independência da loja permanecem **não executados**.
- Nenhuma alternativa em produção foi acessada.
- Ação necessária: executar o smoke a partir do navegador autenticado ou disponibilizar um
  mecanismo autorizado de sessão para o agente. Sem isso, o gate de API permanece aberto.

## Limites respeitados

Sem produção, push, merge, deploy, restore, reinstalação de dependências, recriação de ambiente,
`db reset`, `REVERT`, alteração de outras tabelas/RPCs/permissões, criação de fixtures ou
extração de credenciais/cookies. Nenhuma migration foi reaplicada e nenhuma suíte de banco foi
repetida.
