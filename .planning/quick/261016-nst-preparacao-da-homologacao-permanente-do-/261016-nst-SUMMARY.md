---
id: 261016-nst
status: in_progress
date: 2026-10-16
---

# Levantamento — homologação permanente do Vendeo no Docker (rodada 1)

**Resultado:** levantamento concluído, **somente leitura**. Nenhuma exportação,
restauração, migration, flag, banco, provider, limpeza Docker ou escrita no
remoto foi executada. **PARADA PARA REVISÃO antes da exportação/restauração.**

Todas as leituras do remoto usaram `GET` (PostgREST/Storage API) com a
`service_role` já presente em `.env.local.remote.bak`. Segredos não foram
impressos, persistidos nem commitados.

## 1. Origem

- Projeto remoto: `Vendeo-V3`, ref `gvbzwihwgzujwsviufgy` (`supabase/.temp/linked-project.json`).
- Postgres 17; pooler `aws-1-sa-east-1`; API `https://gvbzwihwgzujwsviufgy.supabase.co`.
- Credenciais disponíveis no repo: **apenas** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  remotos (em `.env.local.remote.bak`). **Não** há `DB password` nem
  `SUPABASE_ACCESS_TOKEN` no ambiente.
- `.env.local` ativo hoje aponta para **LOCAL** (`127.0.0.1`), com `BENCH_IMPORT_SOURCE_URL` vazio.

## 2. Lojas de teste (`is_test_store=true`) — 2 lojas

| store_id (prefixo) | nome | identity_state | verification_status | dono |
|---|---|---|---|---|
| `48b212f8…` | Adega Mestre das Geladas | `logo` | `approved` | distinto (user A) |
| `3dc7d274…` | NovaTek Eletrônicos | `visual_signature` | `approved` | distinto (user B) |

- 2 donos distintos (ownership 1:1 `stores.user_id UNIQUE`; não existe tabela de membros).
- Contagens exatas via `count=exact` (sem expor linhas). IDs completos e `user_id`
  ficam fora do Git; reconsultáveis na próxima rodada.

## 3. Mapa de dependências (footprint das 2 lojas)

**Escopo direto por `store_id`** (linhas):

| tabela | linhas |
|---|---|
| `campaigns` | 59 |
| `generation_events` | 253 |
| `credit_transactions` | 75 |
| `store_brand_assets` | 30 |
| `store_brand_profiles` | 18 |
| `store_visual_signatures` | 10 |
| `legal_acceptances` | 9 |
| `credit_balances` | 2 |
| `theme_generation_requests` | 1 |
| `generation_rate_events` / `store_billing_info` / `store_campaign_themes` / `campaign_correction_reports` / `credit_notifications` / `product_events` / `support_credit_requests` / `data_subject_requests` | 0 |
| `freemium_entitlements` | bloqueado (403 — RLS/grants; reconsultar com DB ou RPC) |

**Escopo transitivo por `campaign_id`** (59 campanhas): `campaign_art_versions` = 0;
`campaign_correction_submissions` = 0. Demais tabelas transitivas
(`image_generation_*`, `product_1_1_*`) **não existem no remoto** (ver §4).

**Usuários:** 2 donos em `auth.users` (schema `auth` — **não exposto** via REST).
Copiar usuários exige acesso ao banco (dump/restore do schema `auth` ou Admin API);
REST sozinho não resolve login na homologação.

## 4. Estrutura do remoto vs. repositório (achado crítico)

O remoto **está atrás** das migrations do repositório. Não existem no remoto
(HTTP 404): `image_model_pair_config`, `image_generation_config_snapshots`,
`image_generation_operations`, `image_generation_failure_diagnoses`,
`product_flow_stage_authorizations`, `product_1_1_*`, `lab_bench_*` (F56.1/F56.2,
migrations local-only nunca aplicadas) e as flags `product_1_1_test_stores_enabled`
/ `product_1_1_all_stores_enabled`.

Presentes no remoto: `feature_flags` (6 chaves), `ai_model_catalog` (12),
`ai_model_pricing` (8), `legal_document_versions` (11), `credit_operation_costs`,
`economic_parameters`, `cnpj_lookup_cache`, tabelas `lab_*` (F48.1) — ou seja, o
schema do remoto corresponde ao repositório **até ~F50 / F48.1**. O limite exato
de migrations aplicadas precisa de `supabase migration list --linked`
(requer token/senha) para confirmação.

> Nesta rodada **não** se aplica nenhuma migration pendente. O destino deve
> reproduzir a estrutura ATUAL do remoto (não a HEAD do repositório).

## 5. Exportadores/importadores existentes

- **Não existe** script de dump/restore (`pg_dump`/`pg_restore`/`supabase db dump`)
  no repositório. Os dumps reais foram externos (`C:\Vendeo-Backups`,
  `G:\F56.1-Docker-Move-Backup-20261007`) e documentados no runbook.
- Ativos reutilizáveis (padrões, não ferramenta pronta):
  - `docs/operations/backup-runbook.md` — procedimento oficial de dump + objetos + manifesto + restore.
  - `scripts/lab/48-2-3-bench-import-stores.mjs` — **único** importador remoto→local já existente; leitura remota read-only por allowlist, destino local-only (`assertLocalHost`), cópia de assets content-addressed. Cobre só identidade/branding, não dump geral.
  - `scripts/run-f56-*-isolated-integration.ps1` — padrão seguro de instância isolada (project_id dedicado, faixa de portas, gate fail-closed, cópia de migrations com SHA-256, `migration up --local`).
  - `switch-env.ps1` — troca `.env.local`; **não** copia banco/storage.
- Buckets privados: `campaign-images`, `store-brand-assets`, `visual-signatures`,
  `store-logos`, `lab-artifacts`.

## 6. Storage (objetos das 2 lojas)

| bucket | objetos | bytes |
|---|---|---|
| `campaign-images` | 76 | 13,61 MB |
| `visual-signatures` | 6 | 5,65 MB |
| `store-brand-assets` | 6 | metadados sem `size` (0 na soma) |
| `store-logos` | 0 | 0 |
| `lab-artifacts` | 0 | 0 |

## 7. Dimensionamento

- **Remoto:** ~460 linhas escopo direto + 59 campanhas + config global pequena;
  Storage ~19,3 MB. Estimativa de cópia (dump + objetos) **< ~200 MB**.
- **Local:** `C:` 13,58 GB livres; `G:` 42,09 GB livres.
- **Docker:** engine 29.8.1 ativo; imagens 18,86 GB (reutilizáveis, sem novo pull
  relevante); volumes locais 7 / 379,8 MB; 3 instâncias isoladas rodando
  (`vendeo-landing-lab`, `vendeo-f562a-isolated`, `vendeo-f561-isolated`).
  Reclaimable: imagens 3,73 GB / volumes 74,96 MB — **não limpar nesta fase**.
- Recomendação: dados persistentes em `G:` (ou `C:`), com volume próprio da homologação.

## 8. Destino permanente proposto

- Instância Docker **permanente** `vendeo-homolog` (não descartável por fatia),
  faixa de portas dedicada (ex.: 56420–56429), **volumes preservados**.
- Schema = estrutura atual do remoto; dados = lojas de teste + config global
  necessária; Storage = buckets/objetos dessas lojas. `auth.users` conforme decisão de credencial (§9).

## 9. Bloqueios / decisões pendentes (antes da exportação/restauração)

1. **Acesso ao banco:** sem `DB password` nem `SUPABASE_ACCESS_TOKEN`, não é possível
   `supabase db dump --linked`, `migration list --linked`, `pg_database_size`, nem
   dump do schema `auth`. Alternativas: (a) fornecer a senha do banco/token;
   (b) exportar **somente via REST/Storage** (perde schema e `auth.users`).
2. **Usuários:** definir se copiar `auth.users` (requer DB) ou recriar sintéticos.
3. **Fronteira de migrations do remoto:** confirmar o limite aplicado (F50/F48.1).
4. **Destino:** confirmar `project_id`, faixa de portas e caminho de dados (C:/G:).
5. **Conteúdo global:** confirmar quais tabelas globais entram (flags, catálogo,
   pricing, custos, parâmetros econômicos, legal versions).

## 10. Comandos previstos (próxima rodada, ainda NÃO executados)

Com proteção contra escrita no remoto (só `GET`/dump; guarda `assertLocalHost`;
`--local`/`--workdir` no destino; **sem** `db push`/`--linked`/`reset` remoto):

1. Export schema+data (após §9.1): `supabase db dump --linked` (ou pg_dump direto)
   → arquivo **fora do Git** (`G:\Vendeo-Homolog-...`).
2. Export objetos: Storage API `POST /storage/v1/object/list/<bucket>` + download,
   por prefixo das lojas, com SHA-256 e manifesto (padrão do runbook).
3. Subir `vendeo-homolog` (volumes preservados) e restaurar **localmente**.
4. Validar: contagens, checksums, URL assinada e leitura de amostra.

## 11. Parada

Pare aqui para revisão. Nenhuma exportação/restauração, migration, flag, provider,
limpeza Docker, escrita no remoto, commit ou push. Decisões de §9 são necessárias
antes de prosseguir.

## 12. Rodada 2 — execução autorizada (export remoto → homologação local)

Autorizada pelo responsável: exportar e restaurar **localmente**; sem aplicar as 24
migrations pendentes; sem tocar produção/provedor/.env.local/Docker cleanup.

### Acesso e export
- `npx supabase migration list --linked` **exit 0** (sem token no ambiente): **99 aplicadas**, última `20260924000003`, **24 pendentes** (todas F56 local-only).
- `npx supabase db dump --linked` (roles/schema/data) **exit 0**: `schema.sql` (352 KB), `data.sql` (2,29 MB), `roles.sql`.
- Nenhuma escrita remota; apenas leitura.

### Destino
- `vendeo-homolog`, permanente, volumes gerenciados pelo Docker preservados; workdir `G:\Vendeo-Homolog`.
- **Portas: 57780–57789** (API 57781, DB 57782, Studio 57783). *Desvio:* o pedido 57420–57429 é **reservado pelo Windows** (faixas excluídas de TCP 57378–57777 → bind falha).
- `logflare/edge-runtime/vector/mailpit` excluídos (mailpit local falhou com `exec format error`).

### Restauração e verificação
- Schema + dados filtrados restaurados; prune para as **2 lojas** + config global.
- **Correção de encoding:** a 1ª filtragem (PowerShell) **double-encodou UTF-8**; refeita com filtro **Node byte-safe** e DB resetado. Verificado: `NovaTek Eletrônicos` = bytes `...c3b4...` (correto).
- **Achado de runtime:** após `db reset`, Kong ficou com upstream stale da storage-api (502); resolvido reiniciando o Kong local.
- **Storage:** 116 objetos copiados e **verificados por nome/tamanho/SHA-256 (0 divergências)**; buckets privados recriados com os limites do remoto.

### Contagens finais (homolog) × remoto (medidas)

| item | homolog | remoto |
|---|---|---|
| `stores` | 2 | 2 (test) |
| `auth.users` | 2 | alvo (2 donos) |
| `campaigns` | 59 | 59 |
| `generation_events` | 253 | 253 |
| `credit_transactions` | 75 | 75 |
| `store_brand_assets` | 30 | 30 |
| `store_brand_profiles` | 18 | 18 |
| `store_visual_signatures` | 10 | 10 |
| `legal_acceptances` | 9 | 9 |
| `credit_balances` | 2 | 2 |
| `feature_flags` / `ai_model_catalog` / `ai_model_pricing` / `legal_document_versions` | 6 / 12 / 8 / 11 | 6 / 12 / 8 / 11 |

Storage: `campaign-images` 80 obj / 18,63 MB; `store-brand-assets` 30 / 6,31 MB;
`visual-signatures` 6 / 5,92 MB; `store-logos` e `lab-artifacts` 0.
*Correção do levantamento:* os números anteriores (76/6/6) subestimavam por não recursar
subpastas; autoritativos são **80/30/6**.

### Divergências e limitações (NÃO há equivalência completa)

1. **Portas** 57780–57789, não 5742x (reserva do SO).
2. **Volumes Docker** permanecem no data-root do Docker (não em `G:`); o workdir em `G:` guarda só config/scripts/evidências.
3. **Sem ledger de migrations:** o schema foi reproduzido por dump vivo; `supabase_migrations` não foi reconstruído. **Nenhuma das 24 pendentes aplicada** — `product_1_1_*`/`image_generation_*`/`image_model_pair_config` ausentes (`NONE`) e flags `product_1_1_*` ausentes.
4. **Auth:** somente `auth.users` + `auth.identities` (e-mail+Google, senha) dos 2 donos; sessões/refresh/one_time/mfa/oauth/saml/scim/webauthn/audit **não** copiados. O schema `auth` local difere do remoto em tabelas de config (ex. `custom_oauth_providers`) — blocos pulados.
5. **Storage drift:** `storage.buckets`/`objects` recriados via API local (não COPY); `owner`/timestamps podem diferir.
6. **Excluídos:** caches `cnpj_lookup_cache`/`idempotency_keys`, dados `lab_*`; `freemium_entitlements` só para os `root_hash` das 2 lojas; sem privilégios administrativos adicionais.
7. **PII transitória:** o `data.sql` completo (10 usuários/lojas) foi usado pelo pipeline e **removido** ao final; permaneceram apenas `schema.sql` (sem dados) e o manifesto.
8. **Não validado nesta rodada:** app/UAT visual, troca de `.env.local`, e consistência de dados além das contagens/checksums medidos. Produção intocada.

### Evidência (fora do Git)

`G:\Vendeo-Homolog\MANIFEST.json` (counts, tamanhos, SHA-256 dos artefatos, portas, split 99/24).
Scripts: `G:\Vendeo-Homolog\_probe\{filter-data,copy-storage,verify-storage}.mjs`, `prune.sql`, `schema.sql`, `roles.sql`.

### Parada

Reprodução **comprovada** por schema + contagens + Storage (SHA-256), **sem** declarar
equivalência completa. Nenhuma das 24 migrations pendentes aplicada, `.env.local`
inalterado, produção intocada. Aguardando revisão.

## 13. Rodada 3 — baseline (proposto), rede/admin/integrações e troca preparada

Homologação **não** recriada.

### Baseline de migrations — **EXECUTADO e VERIFICADO (Opção A)**
- Estado: `supabase_migrations.schema_migrations` **ausente** no homolog.
- Procedimento em `261016-nst-BASELINE.md` (OPÇÃO A recomendada): copiar os **99** arquivos
  aplicados para `G:\Vendeo-Homolog\supabase\migrations\`, criar o ledger (DDL CLI 2.104:
  `version/statements/name`) e inserir as **99** versões ≤ `20260924000003`. As **24
  pendentes não são copiadas nem aplicadas**. Guarda fail-closed de destino local
  (project_id `vendeo-homolog`, container local, `API_URL` loopback:57781, proibição de
  `--linked`/`db push`/`up`/`reset`). Rollback: `drop schema supabase_migrations cascade` + remover arquivos.
- **Executado:** lista EXATA das 99 do remoto (coluna REMOTE de `migration list --linked`; CLI do PATH = **2.75.0**, sem atualizar ferramentas) → 99↔99 arquivos com SHA-256 (`migration-baseline.json`). Guarda local OK. **Incidente corrigido:** a 1ª inserção corrompeu `version` (objetos `@{value=…}` do PowerShell); refeita de forma determinística em Node.
- **Verificado:** ledger `total=99`, `clean=99`, `missing=0`, `extra=0`, `pending=0`; `supabase migration list --local --workdir G:\Vendeo-Homolog` = 99 linhas (LOCAL=REMOTE), exit 0; app inalterada (`2/59/2/6`; `product_1_1_*`/`image_generation_*` ausentes). Documenta o schema restaurado — **não** reexecuta migrations nem comprova histórico.

### Administrador e integrações
- Admin preservado: `admin_users` = **1** (`1273d07b-…`, owner da Adega) — **idêntico ao remoto**; sem super-admin; sem privilégio extra.
- **Nenhuma integração externa ativa:** `hooks`=0, `net.http_request_queue`=0, sem triggers `net/http`, sem `pg_cron`, sem webhooks; edge/vector/analytics/mailpit excluídos; Google OAuth inerte (sem secret); sem chaves de provider.
- Detalhe em `261016-nst-NETWORK-INTEGRATIONS.md`.

### Rede — PENDÊNCIA de isolamento
- Containers na rede dedicada `supabase_network_vendeo-homolog`; mas o CLI publica **0.0.0.0/[::]** em 57781/57782/57783.
- Compensatório: Windows Firewall ativo, `DefaultInboundAction≈Block`, **sem** regra de liberação para 5778x.
- **Regra aplicada com elevação (UAC):** `vendeo-homolog block 57780-57789` (Inbound/Block/Any/Enabled). Localhost segue OK.
- **Bloqueio externo NÃO comprovado** (e a regra sozinha **não** foi tratada como prova): o **experimento de controle** (listener na porta `59999` + regra `Block`) permaneceu **acessível** de outro namespace Docker — o tráfego container→host **não passa pelo Windows Firewall**. Antes da regra o homolog era `REACHABLE` de outro namespace. Comprovar bloqueio de um host LAN real exige teste de outro dispositivo (não disponível); o CLI não oferece bind loopback. Regra mantida como defesa em profundidade, reversível.

### Troca reversível preparada e ENDURECIDA (executada só até `prepare`)
- Script `scripts/switch-env-homolog.ps1` (`status|prepare|apply|rollback`). **`apply` revalida:** container `running`, `project_id`, `API_URL` loopback:57781, chaves locais presentes, e o artefato (sem ref remota, providers vazios, `VENDEO_GENERATION_PAUSED=true`); garante **backup recuperável** (`.env.local.pre-homolog.bak`) antes de copiar; **não imprime credenciais**.
- `-Action prepare` executado e validado: `.env.local.pre-homolog.bak` (estado atual) + `.env.local.homolog.bak` (`SUPABASE_URL=127.0.0.1:57781`, providers/deploy/OAuth vazios, geração pausada). Ambos gitignored.
- **`.env.local` NÃO foi alterado** (segue `vendeo-f562a-isolated:56321`). `-Action apply`/`rollback` **não** executados.

### Parada
Aguarda autorização para `apply` (troca do `.env.local`). Baseline executado/verificado; rede com regra aplicada mas **bloqueio externo não comprovado** (limitação aberta). Nenhuma migration aplicada, produção intocada, sem geração paga, `.env.local` inalterado.

## 14. Rodada 4 — apply da troca + validação da aplicação (AUTORIZADO)

Detalhe em `261016-nst-APPLY-VALIDATION.md`.

- **`apply` executado:** `.env.local` → **`http://127.0.0.1:57781`**; `VENDEO_GENERATION_PAUSED=true`; providers neutralizados; `.env.local.pre-homolog.bak` para rollback.
- **Next reiniciado** com `-H 127.0.0.1`: escuta **127.0.0.1:3000** (não 0.0.0.0); log `Environments: .env.local`; `/`=200, `/login`=200, `/campanhas` e `/loja`=302→/login. Destino confirmado (`.env.local`=127.0.0.1:57781) **sem imprimir chaves**.
- **Login por senha:** **200** para os **dois donos** (Adega e NovaTek). Senha temporária via Admin API; **hash original restaurado** (`password_restored=true`).
- **Ownership/lojas:** cada usuário vê **1** loja (Adega / NovaTek). **Campanhas:** 52 + 7 = **59**. **Imagens:** URL assinada server-side **200 / 279.999 bytes** (62 objetos na Adega).
- **Captcha:** exigido pelo GoTrue do homolog; **desativado temporariamente** só para o teste headless de senha e **reativado** (`enabled=true`) + stack reiniciado. Produção intocada.
- **Não testado:** geração, Google OAuth, migrations pendentes (nenhuma aplicada).
- **Divergência nova:** schema `storage` local **sem policies de RLS** (dump só de `public`; políticas vêm de migrations aplicadas não re-executadas) → listagem de objetos com token de usuário = 0; app segue OK via URL assinada. Fora do escopo desta rodada.
- **Teste LAN preparado** para o usuário (outro dispositivo, sem instalar nada): `http://192.168.1.8:57781/rest/v1/` e `http://192.168.1.8:57783/` — registrar bloqueado/exposto. Isolamento LAN permanece **pendência aberta**.

### Parada (rodada 4)
Apply e validações concluídos. Sem geração, sem OAuth, sem migrations pendentes, produção intocada. Aguardando o resultado do teste LAN do usuário.

## 15. Rodada 5 — Storage (policies) + login real com CAPTCHA

Revisão do usuário: a homologação **não** estava pronta para migrations (faltavam policies de Storage e login habitual). Detalhe em `261016-nst-APPLY-VALIDATION.md`.

- **Policies de Storage reproduzidas:** obtidas do remoto via `supabase db dump --linked --schema storage` → **15 policies** em `storage.objects` (0 em `buckets`); aplicadas **somente** essas policies no homolog, **sem** reexecutar as 99 migrations. Verificado: 15 policies locais com **nomes idênticos**; RLS ativo; grants presentes.
- **Acesso autenticado equivalente comprovado** (não só URL assinada): JWT de usuário → `campaign-images` **Adega 62**, **NovaTek 14**; cruzado NovaTek→Adega = **0** (tenant isolation).
- **Login real com CAPTCHA habilitado:** site key do widget estava **real** com segredo de **teste** (widget falharia no localhost) → corrigida para a site key de **teste**; `VENDEO_CAPTCHA_ENABLED=true` mantido. Validado o caminho do cliente (`supabase-js.signInWithPassword` com `captchaToken`): **Adega OK**, **NovaTek OK** (senhas temporárias restauradas). **Sem** desativar o captcha. *Limitação:* sem browser automation instalada — comprovação pelo caminho de código + `/login` servindo a site key de teste; login manual no navegador recomendado.
- **Correção incidental:** `.env.local` gerado tinha **BOM** (quebrava o parser do CLI); passou a ser gravado **UTF-8 sem BOM**.
- **Não** reexecutamos a importação (99 versões e 116 objetos preservados), **nenhuma** das 24 migrations aplicada, produção intocada, geração pausada.
- **Pendência LAN** pode ser verificada em paralelo (teste `57781`/`57783` em outro dispositivo).

## 16. Consolidação + plano das 24 migrations (preparação, NÃO aplicado)

- **Consolidação:** `261016-nst-CONSOLIDATION.md` (histórico das rodadas 1–5 preservado + estado atual).
- **Credencial Adega registrada:** senha temporária de validação **revertida** (hash `$2a$` original restaurado); usuário confirmou **login manual**; NovaTek acessível. `updated_at` mudou (efeito do set/restore) — divergência menor. **Não substituir senhas novamente.**
- **Reverificação:** origem 99/24 (última `20260924000003`); destino `vendeo-homolog`; ledger local **99**.
- **Ponto de recuperação criado:** `recovery\homolog-pre24mig-20261016-182920.dump` (`-Fc`, sha256 `360F6E…`) + snapshot (ledger 99, stores 2, campaigns 59, users 2, policies 15, objects 116).
- **24 migrations staged** em `G:\Vendeo-Homolog\pending-24\` com SHA-256 (`pending-24-migrations.json`); dir de migrations mantém **99** (baseline) → `pending_local=0` (sem risco de aplicação acidental).
- **Plano:** `261016-nst-PLAN-24-MIGRATIONS.md` — 7 grupos (A–G) ordenados, verificação após cada grupo, critérios de parada, recuperação (sem rollback automático), proibições. **Aguarda autorização única.**

### Parada (rodada 6)
Preparação concluída; **nenhuma** das 24 aplicada. Sem produção/reset/limpeza de volumes/flags/provider/deploy/push. Aguardando autorização única para executar A→G localmente.

## 17. Execução das 24 migrations A→G (autorizada) — CONCLUÍDA

Detalhe em `261016-nst-EXECUTION-24-MIGRATIONS.md`.

- Pré-voo: destino revalidado + **hashes OK**. Grupos A→G aplicados via `migration up --local` (exit 0 em todos): ledger **101→104→106→111→116→119→123**.
- **Final: 123 versões exatas, 0 pendentes** (`migration list --local` 123/123; ledger 123).
- **Preservados:** `stores=2`, `campaigns=59`, `users=2`; storage policies **15**; objetos **116**.
- **Flags novas desligadas:** `product_1_1_all_stores_enabled=false`, `product_1_1_test_stores_enabled=false` (8 flags totais).
- **Geração pausada** (`VENDEO_GENERATION_PAUSED=true`); **sem geração paga**; **sem redefinir senhas**.
- **App acessível:** `127.0.0.1:3000` → `/`=200, `/login`=200.
- **Incidentes (só do meu harness; nenhum arquivo de migration editado):** (1) *quoting* do wrapper do CLI falhou → nada aplicado; (2) verificador comparava booleano `t`/`f` com `true` → falso negativo no grupo A (que estava aplicado); corrigido; A idempotente. Parada honrada com diagnóstico antes de prosseguir.
- **Recuperação:** não necessária (dump `-Fc` preservado).
- **LAN (humano):** 57781/57783 deram **timeout** no celular/Wi-Fi principal → favorável, **não conclusivo**; **57782 não coberta**; pendência **aberta** (sem repetição).

## 18. Realinhamento da change `fase-56-2b2c-…` (somente documentação)

- **Change existente realinhada** (nenhuma change/ambiente novo). Novos/atualizados:
  `openspec/changes/fase-56-2b2c-autorizacao-estreita-e-teste-real-produto-1-1/B2.3-READINESS.md`
  (novo) + `proposal.md`/`design.md`/`tasks.md` (dependências e ambiente).
- **Dependências:** B2.1 (F56.2b2a) e B2.2 (F56.2b2b) **concluídas e arquivadas**; **D13 NÃO resolvido** e **sign-off de segurança B2.1 pendente/separado** — preservados como gates; B2.3 não os resolve.
- **Ambiente fixado:** `vendeo-homolog` (workdir `G:\Vendeo-Homolog`, API `127.0.0.1:57781`), identidade canônica server-side `127.0.0.1:57781` (não o container), 123 migrations; sem reset/reimportação/nova instância.
- **Conformidade de código:** fundação existe (instância/`expires_at`/revogação/auditoria append-only/barreira global/revalidação server-side); **falta por-loja** (hoje é por escopo) + expiração na concessão + revogação/auditoria por loja. Tudo **aditivo**, preservando a recusa de escopo geral.
- **Loja proposta:** **Adega** primeira; **NovaTek não autorizada** (comprova a restrição). **Nada habilitado.**
- **Modelos/pricing:** F56.1 elegíveis `gpt-image-2.5-flare`/`gpt-image-2`/`gpt-image-2.5-sunburst`; bench Flare low `requer ajuste`, Sunburst low `aprovado com follow-up`, Sunburst medium documental (Adega). **Pricing ausente** para os 2.5 e `quality` nulo → **decisão pendente** (não inventar). Créditos: `campaign_generation`=1; `credit_value_brl`=2,5; `usd_brl_rate`=5,57.
- **Desenho do teste:** percurso UI; **1 geração** + **1 copy** (bound copy 6; imagem 3); teto **cumulativo** em USD (após pricing); critérios de parada; desligamento (revogar + flag off).
- **Distinções:** automatizados (provider simulado, US$0) × inspeção humana × geração real (autorização+teto; **sem** exigir falhas raras do provider pago).
- **`openspec validate … --strict`: valid.** `git diff --check` limpo.
- **Sem** implementação, GSD, migrations, flags, chaves, provider pago, produção, commit/push ou lifecycle.

## 19. Ajuste documental da change (pricing, teto, inspeção, via estreita por loja)

Somente documentos da **mesma change** ajustados (`design.md`, `proposal.md`, `tasks.md`, specs e `B2.3-READINESS.md`). `openspec validate --strict`: **valid**.

- **Pricing completo (principal E fallback), por modelo+qualidade**, na configuração **própria do fluxo novo** (`image_model_pair_config`); preflight já é fail-closed (`complete` para ambos). **Não** preencher `ai_model_selection` (legado) por conveniência.
- **Teto:** **cap cumulativo verificado ANTES de cada chamada**, contando **retries/fallback/copy**; a **estimativa** de preflight (`resolveImagePairCost`, por tentativa) **não** é o limite garantido. Limites existentes: imagem **≤3** (≤2 principal + ≤1 fallback); copy **3+3=6** — **critérios de parada conciliados** com esses limites.
- **Inspeção humana obrigatória** do resultado do teste real; **falhas raras** cobertas por **simulação**.
- **NovaTek negada** no fluxo novo, **sem regressão intencional** do legado.
- **Via estreita fixada:** `isolated_pilot` + `test_stores` + `isolated`; Adega autorizada / **NovaTek não**; `product_1_1_test_stores_enabled=true` **só na janela**, `all_stores` **sempre false**; **expiração obrigatória com UTC explícito**.
- **Desenho mínimo por loja fixado** (design D7 + spec): `store_id` por evento; concessão exige loja+expiração e **recusa** escopo geral/`all_stores`; revogação por loja; **idempotência inclui a loja**; auditoria por loja; revalidação da loja no runtime; **barreira geral preservada**.
- **Checkpoints de gates:** **A** (pré-implementação) avalia **sign-off de segurança B2.1**; **B** (autorização do teste real) avalia **D13** + modelo/quality/pricing + teto + inspeção — **sem** considerá-los resolvidos nem ignorá-los.
- **Modelos/qualidades e teto financeiro permanecem pendentes de decisão humana.**
- Sem código, GSD, banco, flags, provider ou commit.

## 20. Revisão documental — piloto cobre AS DUAS lojas de teste (reversão do desenho por loja)

Decisão humana: **sem autorização individual por loja**. Reconciliados `design.md`, `proposal.md`, `tasks.md`, specs e `B2.3-READINESS.md`. `openspec validate --strict`: **valid**. Sem contradições per-store (só as negações explícitas).

- **Removido:** `store_id` por evento, allowlist, concessão/revogação individual, expiração individual.
- **Habilitação:** controlada por **`product_1_1_test_stores_enabled`** (janela); **`product_1_1_all_stores_enabled` sempre `false`**.
- **Ajuste mínimo da barreira:** permitir **`isolated_pilot` + `test_stores` + `isolated`**, recusando `all_stores`/demais habilitadores; **reaproveita** instância/autorização/auditoria/revogação existentes — **sem novo subsistema**; produção intocada.
- **Lojas:** **Adega e NovaTek** (ambas de teste) validam o fluxo novo.
- **Negativos:** flag desligada; loja não-test; instância/ambiente não autorizado; escopo geral.
- **Preservado:** pricing **complete principal/fallback**, controle de gasto (cap antes de cada chamada, retries/fallback/copy), autorização específica para chamadas pagas, **inspeção humana**.
- **D13** e **sign-off B2.1** permanecem **não resolvidos** (checkpoints A/B).
- **Escopo mínimo restante:** ajustar a RPC da barreira (permitir `isolated_pilot`+`test_stores`); revalidar negativos; no checkpoint humano, definir **modelo/quality**, **pricing (principal+fallback)** e **teto**, então executar o piloto com inspeção humana.
- Somente documentação; sem implementação/migrations/flags/provider/commit/GSD.

## 21. Correções documentais da B2.3 (expiração, controle de gasto, ordem dos checkpoints)

`openspec validate --strict`: **valid**; sem contradições positivas. Somente documentação.

- **Expiração alinhada:** D1 e o requirement “Autorização temporária estreita” já **não** exigem nova expiração. A **expiração existente é respeitada quando informada**; **sem** nova expiração obrigatória — janela por **flag** + **revogação**. Corrigidos design/spec/proposal/capability e tasks 2.2.
- **Controle de gasto (honesto):** **não existe** cap monetário cumulativo no código (o `budgetUsd` é do laboratório; `estimatedCostUsd` é telemetria). Reenquadrado como **mecanismo mínimo a implementar**, com **alcance real**: limites de chamadas (imagem ≤3; copy ≤6), **estimativas conservadoras**, **prevenção de execuções simultâneas** (claims/acquire atômicos) e **parada**; **sem** prometer **garantia financeira** da cobrança final e **sem** virar subsistema de orçamento. Corrigidos design (D9/riscos), proposal (critérios 6/13), spec (flow-activation) e READINESS.
- **Ordem dos checkpoints corrigida:** **Checkpoint A** é **pré-implementação** (sign-off B2.1 + aprovação do plano) — movido para o início do Migration Plan e para a task 1.4; **Checkpoint B** (pré-teste-real) avalia D13 + modelo/quality/pricing + controle de gasto + inspeção (task 5.6 ajustada).
