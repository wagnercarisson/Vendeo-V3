# F57.3 — Aplicação da migration em produção (2026-10-29)

## Autorização e escopo

- Autorização específica do responsável: aplicar **somente** a migration F57.3.
- Alvo: **Vendeo-V3** / `gvbzwihwgzujwsviufgy`.
- Nenhum push, merge, deploy, restore, alteração de ACL/flag ou mudança de código.

## Dry-run

`supabase db push --linked --dry-run` listou exatamente:

```text
20261029175849_f57_3_ui_locale_es_419.sql
```

## Aplicação

```text
supabase db push --linked --yes
Initialising login role...
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20261029175849_f57_3_ui_locale_es_419.sql
 [Y/n] y
Applying migration 20261029175849_f57_3_ui_locale_es_419.sql...
Finished supabase db push.
```

Exit: **0**. Nenhuma outra migration foi aplicada.

## Verificação pós-aplicação (read-only)

- Ledger: **151 → 152**.
- `20261029175849`: **presente**; `max_version = 20261029175849`.
- Local × remoto: **152** linhas, **0 local-only**, **0 remote-only**.
- Constraint de UI:
  `CHECK ((ui_locale IS NULL) OR (ui_locale = ANY (ARRAY['pt-BR','es-419'])))`.
- Constraint de conteúdo da loja: permanece `pt-BR`/`es-PY`.
- RPC `write_user_locale_preference(uuid,text,bigint)`:
  - owner `postgres`, `SECURITY DEFINER = true`, `search_path` vazio;
  - grants `postgres`/`service_role`; `anon`/`authenticated` sem EXECUTE;
  - corpo contém `es-419`, não contém `es-PY`;
  - MD5 normalizado (sem whitespace): `812879f78e23f2319fd4455a76e27fb6`;
  - idêntico ao corpo da migration local aplicada (mesmo norm_len 1336 e MD5).
- Preferências:
  - `NULL`/`legacy_br` = 1;
  - `es-PY` = 0;
  - `es-419` = 0.

## Conversão

Não havia linhas `es-PY`; conversão de **zero linhas**, resultado esperado. Nenhum dado foi criado
para exercitar a conversão.

## Estado e próximo passo

- Migration aplicada e verificada em produção.
- Código **não** publicado: push/deploy continuam pendentes e são gate separado do responsável.
- Smoke autenticado em produção ainda não executado.
- Risco de janela: o código atualmente em produção não aceita `es-419`; após gravações nesse
  idioma, rollback apenas do código pode ser insuficiente e exige também a migration reversa
  pontual.
