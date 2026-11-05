# F59 / 59-10 — Baseline de homologação

Data: 2026-11-05. **Status: ledger reconciliado por cópia de arquivos; nenhuma
migration foi executada, a flag continua ausente e o seed F59 NÃO foi copiado.**

## 1. Identidade do ambiente (confirmada)

- API: `http://127.0.0.1:57781` (`SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`).
- Banco: `127.0.0.1:57782/postgres`.
- Workdir: `G:\Vendeo-Homolog`.
- Containers locais observados: `supabase_kong_vendeo-homolog`,
  `supabase_db_vendeo-homolog`, `supabase_studio_vendeo-homolog`.
- Código em teste: commit `ec1b9b449d5ec64d424808881026a65eb7a3b662`.
- Produção: **NÃO acessada**.

## 2. Estado anterior da flag

Consulta read-only em `public.feature_flags`:

- `product_9_16_enabled`: **ABSENT**.
- total de flags: **8**.

Nenhuma ativação ou inserção foi executada.

## 3. Ledger antes da reconciliação

- total de versões no ledger: **152**.
- versão alvo `20261105162052`: **ABSENT**.
- workdir tinha **149** arquivos de migration; três versões do ledger estavam
  sem arquivo local:
  - `20261028145738` — `f57_2_market_preferences`
  - `20261028171746` — `f57_2_onboarding_market_settings`
  - `20261029175849` — `f57_3_ui_locale_es_419`

## 4. Identificação no Git

Os três arquivos existiam no repositório principal e tinham o mesmo blob em
`HEAD`, `main` e `origin/main`:

| Versão | Blob Git (HEAD/main/origin/main) | SHA-256 |
|---|---|---|
| `20261028145738_f57_2_market_preferences.sql` | `a81e4a4253cfe8498c558bd9adabde8280a1f4d5` | `61A2C3E58E8D8A242025B974D6E276B34591DA774B86C286BB696264C52A0BC6` |
| `20261028171746_f57_2_onboarding_market_settings.sql` | `1f647a193942b37d754ad8c7b93a67e12e378481` | `FC3CC9E726977C214C068FD40C1AB96413BF61418A448E4FD092C7DE67E7065E` |
| `20261029175849_f57_3_ui_locale_es_419.sql` | `755b0c674adee45f6b926d95b75ba1d814265c30` | `751368CF2F437434F0D5280B71043C512CEE9ADAFBF2105F03971DD7C263CF13` |

Conferência com o ledger:

- `20261028145738`: `statements[1]` normalizado (LF) tem md5
  `b0f0d58a9843a7d02232d7e5e07232ea`, idêntico ao arquivo normalizado.
- `20261028171746`: `statements[1]` normalizado (LF) tem md5
  `cb70047c96456485151061f1e6d213b7`, idêntico ao arquivo normalizado.
- `20261029175849`: o ledger não guardou `statements` (0), mas o efeito aplicado
  confere:
  - constraint `chk_user_preferences_ui_locale` aceita
    `pt-BR`/`es-419`;
  - `write_user_locale_preference` contém `es-419`.

Nenhuma divergência de conteúdo foi encontrada.

## 5. Cópia para o workdir de homolog

Copiados exclusivamente os três arquivos para
`G:\Vendeo-Homolog\supabase\migrations`, preservando nomes e conteúdo. SHA-256
de origem e destino conferem nos três casos.

Não foi copiado o seed F59 `20261105162052_f59_product_9_16_flag.sql`
(`seed_copied=0`).

## 6. Estado após a reconciliação

- `supabase migration list --local --workdir "G:\Vendeo-Homolog"`:
  **152 locais × 152 no ledger, sem lacunas**.
- ledger: **152 versões**.
- `product_9_16_enabled`: **ABSENT**.
- versão alvo F59 `20261105162052`: **ABSENT**.

## 7. Ações NÃO executadas

- nenhum SQL das três migrations foi executado;
- nenhum `migration repair`, reset, `db push` ou alteração de ledger;
- seed F59 não copiado/aplicado;
- flag não criada/alterada;
- nenhuma chamada paga, geração, push, deploy ou acesso à produção.

## 8. Próximo passo

O ledger está reconciliado. A próxima autorização necessária é específica para
copiar/aplicar o seed F59 **somente em homolog**, registrar o baseline completo e
seguir para a matriz manual.
