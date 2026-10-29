# F57.3 — Preflight READ-ONLY de produção (2026-10-29)

## Alvo confirmado

- Projeto: **Vendeo-V3**
- Project ref: **gvbzwihwgzujwsviufgy**
- Status: `ACTIVE_HEALTHY`, `linked=true`
- Região: `sa-east-1`
- Método: `POST /v1/projects/{ref}/database/query/read-only`
- `current_database()`: `postgres`
- `current_user`: **`supabase_read_only_user`**
- PostgreSQL: 17.6
- Nenhum token, cookie, senha ou connection string foi impresso ou persistido. O token do CLI foi
  lido do Credential Manager apenas em memória para a chamada read-only.

## Ledger

```json
{ "ledger_count": 151, "f573_present": 0, "max_version": "20261028171746" }
```

- `20261028145738` (`f57_2_market_preferences`): presente.
- `20261028171746` (`f57_2_onboarding_market_settings`): presente.
- `20261029175849` (**F57.3**): **ausente**.

## Conjunto local × remoto

- Arquivos locais em `supabase/migrations`: **152**.
- Linhas em `supabase migration list --linked`: **152**.
- Local-only: **1** — `20261029175849` (`f57_3_ui_locale_es_419`).
- Remote-only: **0**.
- Portanto, a única migration pendente esperada é a F57.3. Nenhum `db push` foi executado.

## Constraint de UI

```text
CHECK (((ui_locale IS NULL) OR (ui_locale = ANY (ARRAY['pt-BR'::text, 'es-PY'::text]))))
```

Estado esperado antes da F57.3: aceita `pt-BR`/`es-PY`; `es-419` ainda não aceito.

## RPC `public.write_user_locale_preference(uuid,text,bigint)`

| Item | Valor |
|---|---|
| Assinatura | `write_user_locale_preference(uuid,text,bigint)` |
| Owner | `postgres` |
| `SECURITY DEFINER` | `true` |
| `search_path` | vazio (`search_path=""`) |
| `proacl` | `postgres=X/postgres \| service_role=X/postgres` |
| `anon` EXECUTE | `false` |
| `authenticated` EXECUTE | `false` |
| `service_role` EXECUTE | `true` |
| Corpo contém `es-PY` | `true` |
| Corpo contém `es-419` | `false` |
| `md5(prosrc)` | `558253ce90905de3159a3ab25eba2b84` |
| `md5(regexp_replace(prosrc, '\s+', '', 'g'))` | `939ddaa95600b82520f73027a2a2fdb1` |

Comparação com a definição esperada antes da F57.3 (migration
`20261028145738_f57_2_market_preferences.sql`):

- O corpo local normalizado (sem whitespace) tem o mesmo MD5:
  **`939ddaa95600b82520f73027a2a2fdb1`**.
- Diferenças observadas: apenas whitespace/indentação. Sem mudança funcional.
- Portanto, a produção está no estado anterior esperado, pronto para receber a F57.3.

## Preferências de interface

| `ui_locale` | `ui_locale_source` | count |
|---|---|---|
| `NULL` | `legacy_br` | 1 |

- `es-PY`: **0** linhas.
- `es-419`: **0** linhas.
- Conversão esperada na F57.3: **zero linhas**; não é bloqueio.

## Contrato de conteúdo da loja

```text
chk_store_market_settings_locale:
CHECK ((default_content_locale = ANY (ARRAY['pt-BR'::text, 'es-PY'::text])))
```

Permanece `pt-BR`/`es-PY`; a F57.3 não altera essa constraint.

## Conferências locais

- SHA-256 de `supabase/migrations/20261029175849_f57_3_ui_locale_es_419.sql`:
  **`96D88928D8C75216164F524EF71172258EA29938EAFD86A23A33D9A67AEAE7D4`**.
- Hash idêntico ao validado no homolog.
- Timestamp `20261029175849` único nas refs conhecidas; presente apenas em `HEAD`.

## Divergências

**Nenhuma divergência estrutural relevante.** A F57.3 não está registrada e a única migration
pendente é a esperada.

## Conclusão

**APTO para solicitar autorização de promoção.** Nenhuma alteração foi feita em produção.

## Sequência curta da futura janela

1. Aplicar **somente** a migration F57.3 em transação atômica e registrar no ledger.
2. Verificar constraint/RPC/grants e a contagem de conversão.
3. Push/deploy pelo responsável, na mesma janela.
4. Smoke autenticado de `GET`/`PATCH /api/preferences`.

**Risco de janela:** o código atualmente em produção não aceita `es-419` e não lê valores
`es-419` corretamente. Após qualquer gravação nesse idioma, rollback apenas do código pode ser
insuficiente; a recuperação exige também a migration reversa pontual.
