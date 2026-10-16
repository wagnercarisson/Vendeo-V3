---
id: 261016-nst
part: baseline-migrations
status: executed-verified
date: 2026-10-16
---

# Procedimento — baseline local de migrations do homolog (PROPOSTA, NÃO EXECUTADO)

Objetivo: registrar no `vendeo-homolog` (local) o baseline de migrations que o
remoto já tem — **99 aplicadas**, última `20260924000003` — **sem aplicar nenhuma
das 24 pendentes**. Estado atual do homolog: `supabase_migrations.schema_migrations`
**não existe** (baseline ausente).

Compatibilidade: DDL do CLI 2.104.0 (conferido em `vendeo-f561-isolated`):
`version text not null pk`, `statements text[]`, `name text`.

## Guarda explícita de destino LOCAL (fail-closed)

Executar somente se TODAS as condições forem verdadeiras; parar em qualquer divergência:

1. `G:\Vendeo-Homolog\supabase\config.toml` contém exatamente `project_id = "vendeo-homolog"`.
2. Container `supabase_db_vendeo-homolog` existe e está `Up`.
3. `supabase status --workdir G:\Vendeo-Homolog` → `API_URL` host ∈ {`127.0.0.1`,`localhost`} e porta `57781`.
4. Nenhum destino contém `gvbzwihwgzujwsviufgy`, `supabase.co`, `pooler.supabase.com`.
5. Todo SQL roda por `docker exec -i supabase_db_vendeo-homolog psql -U postgres -d postgres`.
6. **Proibido** nesta etapa: `supabase migration up`, `supabase db push`, `--linked`, `db reset`.

## Procedimento proposto (OPÇÃO A — recomendada)

Baseline = somente as 99 aplicadas; as 24 pendentes **não são copiadas nem aplicadas**
(assim nenhum `migration up` acidental as aplica).

1. **Copiar os 99 arquivos** aplicados para `G:\Vendeo-Homolog\supabase\migrations\`
   (todos os `supabase/migrations/*.sql` com prefixo ≤ `20260924000003`). As 24 pendentes ficam de fora.
2. **Criar o ledger** (DDL do CLI):
   ```
   create schema if not exists supabase_migrations;
   create table if not exists supabase_migrations.schema_migrations (
     version text not null primary key,
     statements text[],
     name text
   );
   ```
3. **Inserir as 99 versões** (version = prefixo de 14 dígitos; name = nome do arquivo;
   statements = null). Gerado a partir dos arquivos copiados em (1).
4. **Verificar**:
   - `select count(*) from supabase_migrations.schema_migrations` = **99**.
   - Nenhuma das 24 versões (`20260925000001`…`20261016000001`) presente no ledger.
   - `product_1_1_*`/`image_generation_*`/`image_model_pair_config` continuam **ausentes**.
   - `supabase migration list --workdir G:\Vendeo-Homolog` mostra as 99 sem pendências locais.
   - `supabase migration list --linked` (repo) permanece **99/24** — remoto intocado.

## Rollback

- `drop schema supabase_migrations cascade;` e remover os arquivos copiados de
  `G:\Vendeo-Homolog\supabase\migrations\`. Nenhum impacto em schema/dados do homolog.

## Alternativa (OPÇÃO B — não recomendada agora)

Copiar os **123** arquivos e registrar as 99 no ledger, deixando 24 como *pendentes
locais*. Reproduz a lacuna repo↔remoto, porém cria risco de um `migration up`
acidental aplicar as 24. Só adotar com controle explícito.

## O que NÃO faz

Não aplica as 24 pendentes, não altera produção, não faz `db push`/`up`/`reset`,
não chama provider.

---

## RESULTADO (executado)

- CLI usado na verificação: **`supabase` do PATH = 2.75.0** (`--local`). O binário do repo (`node_modules`) é 2.104.0; **nenhuma ferramenta foi atualizada silenciosamente**.
- Lista EXATA das 99 obtida da coluna **REMOTE** de `supabase migration list --linked` (não por data). 99↔99 arquivos, sem duplicatas; SHA-256 de cada arquivo em `G:\Vendeo-Homolog\migration-baseline.json`.
- Guarda local aprovada: `project_id=vendeo-homolog`, container `running`, `API_URL=http://127.0.0.1:57781`; sem ref remota.
- **Incidente corrigido:** a 1ª inserção do ledger ficou **corrompida** (a montagem via PowerShell serializou objetos `@{value=…}` em `version`). Corrigido com reconstrução determinística em Node (`truncate` + insert limpo).
- Verificação final: `total=99`, `clean(^[0-9]{14}$)=99`, `missing=0`, `extra=0`, `pending=0`; `supabase migration list --local --workdir G:\Vendeo-Homolog` → **99 linhas** (LOCAL=REMOTE), exit 0.
- App inalterada após o registro: `stores=2, campaigns=59, auth.users=2, feature_flags=6`; `product_1_1_*`/`image_generation_*` ausentes.
- Caráter: **documenta o schema restaurado**; NÃO reexecuta migrations e NÃO comprova reprodução por histórico.
