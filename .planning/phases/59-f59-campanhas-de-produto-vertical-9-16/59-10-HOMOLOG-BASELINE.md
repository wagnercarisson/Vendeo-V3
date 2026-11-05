# F59 / 59-10 — Baseline de homologação (BLOQUEADO)

Data: 2026-11-05. **Status: BLOQUEADO por divergência de ledger. Nenhuma migration
foi aplicada; a flag não foi alterada.**

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

## 3. Estado anterior do ledger

Consulta read-only em `supabase_migrations.schema_migrations`:

- total de versões no ledger: **152**.
- últimas versões:
  - `20261029175849` — `f57_3_ui_locale_es_419`
  - `20261028171746` — `f57_2_onboarding_market_settings`
  - `20261028145738` — `f57_2_market_preferences`
  - `20261026231324` — `quick_access_request_admin_notice`
  - `20261026191931` — `quick_openai_pricing_sync`
- versão alvo `20261105162052`: **ABSENT** (não aplicada).

## 4. Divergência encontrada

`supabase migration list --local --workdir "G:\Vendeo-Homolog"` mostrou:

- arquivos locais: **149**;
- ledger remoto/local DB: **152**;
- três versões presentes no ledger e **sem arquivo local correspondente**:
  - `20261028145738` — `f57_2_market_preferences`
  - `20261028171746` — `f57_2_onboarding_market_settings`
  - `20261029175849` — `f57_3_ui_locale_es_419`.

Isso caracteriza divergência de ledger. Conforme a autorização, **parei antes de
qualquer aplicação** e não corrigi nem reparei o ledger.

## 5. Ações NÃO executadas

- seed `20261105162052_f59_product_9_16_flag.sql`: **não copiado/não aplicado**;
- nenhuma outra migration aplicada;
- nenhum reset/repair de banco;
- flag `product_9_16_enabled` não criada nem alterada;
- nenhuma chamada paga, geração, push, deploy ou acesso à produção.

## 6. Decisão necessária

Antes de prosseguir, é necessário decidir como tratar a divergência:

1. localizar/restaurar os três arquivos de migration ausentes no workdir de
   homolog e reconciliar o ledger; ou
2. autorizar explicitamente um procedimento controlado de verificação/reparo do
   ledger, com evidência antes/depois; ou
3. apresentar uma alternativa de aplicação estritamente manual do seed, com
   registro de versão no ledger, se o responsável aceitar esse caminho.

Nenhuma dessas opções foi executada.
