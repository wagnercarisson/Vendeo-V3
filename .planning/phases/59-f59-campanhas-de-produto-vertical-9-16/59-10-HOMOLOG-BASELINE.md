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

## 6. Aplicação do seed F59 (autorizada nesta etapa)

Pré-condições reconfirmadas antes da cópia:

- 152 arquivos locais × 152 versões no ledger;
- versão `20261105162052`: **ABSENT**;
- `product_9_16_enabled`: **ABSENT**;
- SHA-256 de origem: `734FF930CE96625208C472CC11D4AE6673B78EC7E9AB5E74929F0470B172FBC2`;
- SHA-256 de destino após cópia: idêntico (`match=true`);
- única migration pendente na listagem: `20261105162052`.

Aplicação pelo procedimento do projeto:

`supabase migration up --local --workdir "G:\Vendeo-Homolog"`

Saída: `Applying migration 20261105162052_f59_product_9_16_flag.sql...` →
`Local database is up to date.`

## 7. Estado após a aplicação

- ledger: **153 versões**;
- versão F59 presente com nome `f59_product_9_16_flag`;
- `supabase migration list`: **153 locais × 153 no ledger**, sem lacunas;
- flag:
  `product_9_16_enabled | false | Registra a preparação inativa do Produto
  vertical 9:16. Não ativa geração, roteamento, provider, crédito, entrega ou
  download; apenas permite administração futura da flag.`
- nenhuma outra migration pendente foi aplicada.

## 8. Painel admin

A chave é renderizada pelo painel existente:

- a página `/admin/feature-flags` consulta `feature_flags` por
  `ALL_FEATURE_FLAG_KEYS`;
- `product_9_16_enabled` está em `ALL_FEATURE_FLAG_KEYS`;
- a linha existe no banco com `enabled=false`;
- `FLAG_LABELS.product_9_16_enabled` existe;
- a chave não é filtrada pelo bloco exclusivo do Produto 1:1.

Painel autenticado aberto em `http://127.0.0.1:3000/admin/feature-flags`:
HTTP 200, chave e label presentes no HTML, estado exibido **Desligada**. Nenhuma
ação de escrita foi executada no painel.

## 9. Ações NÃO executadas

- nenhum SQL das três migrations reconciliadas foi executado;
- nenhum `migration repair`, reset, `db push` ou alteração manual de ledger;
- flag não ativada;
- nenhuma chamada paga, geração, push, deploy ou acesso à produção;
- nenhuma campanha gerada.

## 10. Lojas de teste e saldos

| Loja | store_id | is_test_store | Saldo | Bônus | Comprado | Demo |
|---|---|---:|---:|---:|---:|---:|
| Loja Mega Vale | `3dc7d274-0b57-45ba-883a-7b235056feda` | true | 1 | 1 | 0 | 0 |
| Padaria da Esquina | `48b212f8-2b0f-4679-b553-122a601bacac` | true | 4 | 4 | 0 | 0 |

Campanhas das lojas de teste: **70** no total; **0 verticais**.
- Loja Mega Vale: 8 campanhas, 8 ready.
- Padaria da Esquina: 62 campanhas, 59 ready, 3 error.

## 11. Campanhas de referência (1:1)

| Loja | Campanha | Produto | Status | Operação | Path |
|---|---|---|---|---|---|
| Padaria da Esquina | `22d4c990-91c8-4ea5-a4db-a59c7e559499` | Pão Caseiro (kg) | ready/delivered | `8c83fae4-9e46-4f77-83d9-a7152b5c973f` | `.../product-1-1/.../art-1024.jpg` |
| Loja Mega Vale | `c06b16f5-f126-429c-b5b0-9567fe4adb95` | Jarra Finesse 1l | ready/delivered | `41c3f33f-3be0-4086-b04e-710258643609` | `.../product-1-1/.../art-1024.jpg` |

Não há campanha vertical existente. Nenhum estado `unknown`/`refunded` está
disponível nas lojas de teste; os cenários de falha que exigem esses estados
permanecem PENDING até existir um procedimento autorizado.

## 12. Aplicação para acompanhamento

- URL local: **`http://127.0.0.1:3000`**
- Login: `/login`
- Painel de flags: `http://127.0.0.1:3000/admin/feature-flags`
- Nova campanha: `http://127.0.0.1:3000/campanhas/nova`

Servidor local iniciado apontando para o homolog `127.0.0.1:57781`.

## 13. Próximo passo

A matriz manual e o orçamento estão em `59-10-HOMOLOG-MATRIX.md`, aguardando
aprovação. Nenhuma geração paga foi executada.
