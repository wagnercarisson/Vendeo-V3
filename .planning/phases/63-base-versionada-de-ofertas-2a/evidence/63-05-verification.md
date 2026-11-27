# F63 / 63-05 — Verificação final da base versionada de ofertas (2A)

**Fase:** 63 — base versionada de ofertas (subfatia 2A)
**Plano:** 63-05 (wave 5)
**Executado em:** 2026-11-26
**Autorização:** `approved: 63-05`
**Escopo:** validação real no homolog existente, perfil/gate F63, relatório de preservação
`post-tests`, reconciliação documental e gates finais. **Homolog ≠ produção.**

---

## 1. Identidade do homolog

| Campo | Valor |
|---|---|
| Workdir | `G:\Vendeo-Homolog` |
| Container | `supabase_db_vendeo-homolog` (running) |
| Imagem | `public.ecr.aws/supabase/postgres:17.6.1.132` |
| Publicação | `0.0.0.0:57782,[::]:57782` → container `5432` |
| Banco / usuário | `postgres` / `postgres` |
| Versão do servidor | 17.6 |

A conexão de teste foi usada apenas em processo (`127.0.0.1:57782/postgres`, `ssl:false`);
nenhum valor de ambiente, senha ou token foi impresso, gravado em artefato ou ecoado.

## 2. Ledger final e política F57.2

| Campo | Valor (dados calculados) |
|---|---|
| `ledger.count` | **161** |
| `ledger.max_version` | `20261126231022` |
| `ledger.sha256` | `d95abc29958780f9021c8c9e9f5b5b2db33a8d4924cbbb2700cfc468c8dd0b0e` |

- Delta de ledger no estágio `post-tests`: **+3** (A `20261126223854`, B `20261126230735`,
  C `20261126231022`), conforme `LEDGER_DELTA_BY_STAGE['post-tests'] = 3`.
- **O F57.2 NÃO foi executado.** O fingerprint `all_rows` do F63 mudou necessariamente em
  **+3 linhas**; o fingerprint armazenado do F57.2 (que filtra `f57_2_`) passaria a divergir.
  Re-baseline do F57.2 está **explicitamente fora de escopo** desta subfatia.
- A Migration A permanece byte-idêntica: SHA-256 do arquivo confere com
  `ed652a26…f8329bc` (`A_HASH_MATCH=true`). A correção do publisher é forward-only em C.

## 3. Perfil/gate F63

- `vitest.integration-f63.config.ts`: serial (`fileParallelism: false`,
  `sequence.concurrent: false`, `testTimeout: 180000`, `hookTimeout: 60000`).
- `scripts/testing/test-categories.json`: categoria `integration.f63` com os três arquivos,
  sem duplicatas; inventário válido (`node scripts/testing/test-status.mjs` exit 0).
- `scripts/testing/test-status.mjs`: `f63GateStatus` exige `TEST_DATABASE_URL` em
  `127.0.0.1:57782/postgres`, `F63_EXPECTED_LEDGER_COUNT` inteiro ≥ 1,
  `F63_EXPECTED_LEDGER_SHA256` de 64 hex e ausência de `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_URL`.
  `f63GateStatus({})` **falha fechado** com reasons (exit 0 no teste de fail-closed).
- `scripts/testing/run-integration.mjs` + `package.json`: perfil `f63` e script
  `test:integration:f63`. Nenhuma semântica de F57.2/F60/F60.1 foi alterada.

## 4. Suítes F63 — resultados

| Arquivo | Foco | Resultado |
|---|---|---|
| `f63-offer-catalog-schema.postgres.test.ts` | ledger/v1, colunas, constraints, triggers, RLS/grants, funções, domínio, imutabilidade, autoria, publisher (C), vigência sem DDL, guardas do baseline | **19/19 PASS** |
| `f63-offer-catalog-calendar.postgres.test.ts` | calendário, timezone, leitura pura, contratos SQL↔TS, constants | **10/10 PASS** |
| `f63-offer-catalog-concurrency.postgres.test.ts` | duas conexões, lock real, publicação única, edição vs publicação, vigência | **4/4 PASS** |
| **Total** | `npm run test:integration:f63` | **3 arquivos / 33 testes PASS** (exit 0) |

### 4.1 Schema / constraints / triggers / RLS

- 13 colunas de `trial_offer_versions` com tipo, nullability e defaults conferidos
  (`id uuid` default `gen_random_uuid()`, `created_at` default `now()`).
- Constraints nomeadas: `chk_tov_*` (duração, total, frequência, créditos, rótulo/nome não
  vazios), `uq_tov_offer_key_version_label`, `uq_tov_id_offer_key`, `fk_tov_offer_key`
  (`ON DELETE RESTRICT`), `fk_tov_created_by`/`fk_tov_published_by` (`SET NULL`).
- Triggers: `trg_trial_offer_versions_guard` (INSERT OR UPDATE),
  `trg_trial_offer_versions_guard_delete` (DELETE) e
  `trg_trial_offer_settings_guard_current_version`.
- RLS habilitada, exatamente **uma** policy `trial_offer_versions_service_role_all`
  (`ALL`, `service_role`).
- Contratos de função: helper `IMMUTABLE`/`SECURITY INVOKER`; três leituras
  `STABLE`/`SECURITY DEFINER`; `TimeZone=UTC` só no schedule; todas com
  `search_path=""`; EXECUTE apenas `service_role`. `SET LOCAL ROLE` prova **42501** para
  `anon`/`authenticated` e sucesso para `service_role`.
- Domínio: 23514 (frequência, duração, total, `once` com créditos, recorrente sem/ acima do
  teto, rótulo/nome em branco), 23503 (programa inexistente), 23505 (par duplicado e id
  duplicado), 23502 (`current_version_id = NULL`).
- Imutabilidade: update de condições/id/identidade/motivo/`published_at` em version
  publicada e DELETE de publicada → **P0001**; rascunho editável e excluível.
- Autoria: exclusão de `auth.users` anula `created_by`/`published_by` sem alterar condições;
  UUID→outro UUID → P0001; `NULL` + mudança de condição → P0001.
- Publisher (Migration C): rascunho com `published_by` → rejeitado; INSERT publicado com
  UUID/NULL → aceito; rascunho→rascunho definindo publisher → rejeitado; rascunho→publicado
  NULL→UUID → aceito; publicado→outro UUID → rejeitado; publicado UUID→NULL → aceito com
  condições/`published_at`/motivo inalterados; `created_by` só→NULL.
- Vigência **sem DDL**: rascunho → P0001 `not_published`; inexistente → P0001 `not_found`;
  `NULL` → 23502; `enabled=false` mantém `current_version_id` e `trial_offer_public_offer()`
  continua v1. A FK composta é provada por `INSERT` com **23503**, não por `ALTER`.
- Guardas do baseline 63-01: 5 hashes de função idênticos; colunas de
  `trial_offer_enrollments` idênticas e **sem** `offer_version_id`; colunas de
  `trial_offer_settings` idênticas + `current_version_id` (NOT NULL, FK composta).

### 4.2 Calendário e contratos

- v1 semanal em `2026-03-10 09:30Z` e `2026-12-28 23:00Z`: 4 liberações seq 0..3, 5 cada,
  dias 0/7/14/21, total 20, `expires_at = início + 28 dias`.
- Mensal 120/20/5 iniciando `2026-01-31 12:00Z`: **31/01 → 28/02 → 31/03 → 30/04**
  (mês de calendário, sem 30 dias fixos).
- Semanal 20/7 → **7, 7, 6**; `once` 30/20 → uma liberação de 20; `daily` 4/20/5 → 0..3×5.
- Borda do helper: `weekly 5/20/21=false`, `22=true`; `monthly 5/20/93=false`, `94=true`.
  Publicação semanal 21/20/5 e mensal 28/20/5 → **P0001** calendar_insufficient.
- Para dados válidos, `trial_offer_schedule_exceeds_window` é defesa inalcançável (a spec
  diz “não incluída”; a implementação falha fechado em vez de truncar).
- Timezone: o mesmo `started_at='2026-01-31T23:30:00Z'` sob `UTC`, `America/Sao_Paulo` e
  `Asia/Tokyo` devolve payload **serializado idêntico** (`expires_at`, `due_at`, `releases`,
  `total`), porque a função fixa `TimeZone='UTC'`.
- Leitura pura: contagens de `trial_offer_enrollments`, `credit_balances` e
  `credit_transactions` iguais antes/depois; nenhuma reserva/escrita.
- Contratos: `conditions(null)`/`(v1)` com 9 campos e valores da v1;
  `public_offer()` com exatamente `PUBLIC_OFFER_FIELDS` e nenhum `FORBIDDEN_PUBLIC_FIELDS`;
  rascunho/inexistente → P0001. O adapter `{ rpc }` sobre `pg` alimenta
  `readCurrentTrialOffer`/`readTrialOfferConditions`/`readTrialOfferSchedule` e o mapeamento
  TS coincide com o SQL real.
- O seed v1 coincide com `constants.ts` (28/20/5/0-7-14-21); a troca de fonte dos
  consumidores pertence à **fatia 4**.

### 4.3 Concorrência (duas conexões reais)

| Cenário | Observação | Resultado |
|---|---|---|
| Duas publicações simultâneas | `pg_stat_activity.wait_event_type='Lock'` em T2; T1 COMMIT; T2 **P0001**; uma única linha publicada com motivo de T1 | PASS |
| Edição segura lock + publicação | T2 espera lock; T1 COMMIT; T2 publica e congela **10/5/weekly/28** | PASS |
| Publicação commitada + edição posterior | T2 recebe **P0001** `conditions_immutable`; versão permanece 20 | PASS |
| Troca simultânea de vigência | espera de lock na linha de settings; ambas commitam; valor final ∈ {X,Y}; X/Y continuam publicadas e com condições intactas | PASS |

- **Nenhum store/user foi criado ou apagado.** Fixtures são versões sem `store_id`.
- `afterAll`: `current_version_id` restaurado para v1; rascunhos `f63test-conc-%` apagados;
  publicadas permanecem inertes e são listadas.

## 5. Preservação `post-tests`

Artefatos: `63-05-preservation-post-tests.json` / `.md`. `preservation-report --stage
post-tests` **exit 0**, todos os 10 checks `true`.

| Tabela | Contagem | Baseline | Igual |
|---|---|---|---|
| `trial_offer_enrollments` | 1 | 1 | sim |
| `credit_balances` | 41 | 41 | sim |
| `credit_transactions` | 265 | 265 | sim |
| `freemium_entitlements` | 1 | 1 | sim |

- `settings_guard` igual ao baseline nos oito campos, incluindo `individual_launch_at`.
- `current_version_id` de volta à **v1** (`equal=true`; `NOT NULL`).
- `schema_guards`: hashes das 5 funções iguais, enrollments iguais, settings +`current_version_id`.
- `ledger_delta_ok=true` (delta 3), `versions_ok=true`, `test_rows_inert=true`.

### 5.1 Efeitos esperados da migration (não atribuir a testes)

- `trial_offer_settings.current_version_id`: coluna + referência à v1 + `NOT NULL`.
- `trial_offer_versions`: linha v1 publicada e vigente (28/20/weekly/5).
- Migration C: substituição forward-only do guard de `published_by`.
- Ledger: +3 linhas (A+B+C).

### 5.2 Dados criados pelos testes (inertes, não atribuídos à migration)

Rascunhos: **0**. Referenciados pela vigência: **0**. Publicadas inertes: **15** (três
execuções de 5 cenários; não podem ser excluídas por desenho):

```
f63test-conc-1795736131892-p1v7b3-{pub-race,edit-pub,pub-edit,vig-x,vig-y}
f63test-conc-1795736146589-glm0l4-{pub-race,edit-pub,pub-edit,vig-x,vig-y}
f63test-conc-1795736230870-am59ru-{pub-race,edit-pub,pub-edit,vig-x,vig-y}
```

Total de versões: 16 (v1 + 15 inertes). Nenhuma linha de teste é atribuída à migration.

## 6. Reconciliação documental

`docs/alinhamento-onboarding-responsavel-cnpj-opcional.md`:

| Local | Antes | Depois |
|---|---|---|
| Tabela de concessão | “versão e cópia das condições adquiridas” | “versão imutável e referência às condições adquiridas” |
| Fatia 4 | “registrar versão/cópia das condições na concessão” | “registrar a referência à versão imutável na concessão” |
| Detalhes técnicos (fatia 1) | “referência vigente/cópia das condições” | “referência vigente/referência à versão imutável” |
| Seção 2A | — | frase curta: calendário é leitura pura, sem reserva; validação é de homolog local ≠ produção; `offer_version_id`/RPC-painel Admin/troca de fonte pertencem às fatias seguintes |

Nenhuma menção a “cópia das condições” permaneceu. O escopo técnico não foi ampliado e a
fatia 4 não foi antecipada.

## 7. Gates finais — exit codes

| Gate | Comando | Exit | Observação |
|---|---|---|---|
| OpenSpec strict | `openspec validate "fase-2a-base-versionada-de-ofertas" --strict` | **0** | `Change ... is valid` |
| Lint | `npm run lint` | **0** | 1 warning introduzido no 63-03 desta entrega (não anterior à F63) em `scripts/f63/preservation-report.mjs` (`'stage' unused`), corrigido na quick `261126-tmn`. **ESLint ignora `.ts` neste repo ⇒ NÃO VALIDADO para TypeScript.** |
| Typecheck | `npm run typecheck` | **0** | 4 erros de tipagem introduzidos nos testes foram corrigidos (Rule 3); execução final limpa |
| Build | `npm run build` | **0** | 102/102 páginas |
| Suíte global | `npm test` | **1** | 3 falhas aceitas (ver §7.1); 873 arquivos + 2 skipped; 10.944 testes PASS + 10 skipped |
| Scripts | `npm run test:scripts` | **0** | 119/119 |
| F63 | `npm run test:integration:f63` | **0** | 3 arquivos / 33 testes |
| Gates | `npm run test:gates` | **0** | inventário válido, F63 presente |
| Diff check | `git diff --check` | **0** | apenas aviso LF→CRLF em `.planning/REQUIREMENTS.md` (pré-existente) |
| Status | `git status --porcelain` | — | executado; ver §8 |
| Preservação | `preservation-report --stage post-tests` | **0** | 10/10 checks |
| test-status | `node scripts/testing/test-status.mjs` | **0** | inventário válido |
| Gate F63 fail-closed | `f63GateStatus({})` | **0** | `ready=false` com reasons |

### 7.1 Falhas aceitas da suíte global (NÃO corrigidas)

1. `src/lib/campaign/square-base/__tests__/boundaries.contract.test.ts` — F60.4 encontra as
   três migrations F63 **untracked** em `supabase/migrations` (`expected [...] to equal []`).
2. `src/lib/product-two-format/orchestration/__tests__/joint-boundaries.contract.test.ts` —
   F60.7-10, mesma causa (três migrations untracked).
3. `src/lib/campaign/square-base/__tests__/regression.contract.test.ts` — comparação por
   HEAD (`git diff` protegido): `expected 1 to be +0`; HEAD permanece `3f2daa50`.

Nenhuma falha envolve `src/lib/credit/**`. Os guardas F60.4/F60.7 **não foram alterados**
para “fazer a suíte passar”. São achados aceitos a reportar, não a corrigir neste plano.

## 8. Reconciliação de escopo e não-ações

- `git status --porcelain` contém apenas: `package.json`, `scripts/testing/*`,
  `vitest.shared.ts`, `vitest.integration-f63.config.ts`, os três testes F63, `docs/…`,
  `.planning/phases/63-…/`, e artefatos pré-existentes de planos anteriores
  (63-01..63-04, openspec, `scripts/f63`, migrations A/B/C untracked).
- **Não alterados** por este plano: `src/lib/credit/trial-offer/constants.ts`, `status.ts`,
  `completion.ts`, `public-offer-copy.ts`, Admin, páginas e flags. Nenhum backfill,
  nenhum `offer_version_id`, nenhuma alteração de RPC/constante/status/completion/copy.
- **Nenhum DDL destrutivo em teste**: as únicas ocorrências de `ALTER ... DROP NOT NULL` /
  `DROP COLUMN` / `TRUNCATE` nos arquivos F63 são comentários de proibição (linhas 15–16 do
  teste de schema). A FK composta é provada por `INSERT` 23503.
- **Nenhuma migration executada** neste plano; A/B/C já estavam aplicadas; ledger 161.
- **Nenhum** `db reset`, `db push`, `supabase link`, backup, `--project-ref`, dump/restore,
  criação de banco ou acesso remoto/produção. A suíte F63 não executou o perfil F57.2.
- Migrations A/B/C com prefixos únicos no worktree (1 arquivo cada) e ausentes do
  `git log --all` (untracked). A permanece com hash inalterado.
- **Nenhum commit, push ou deploy.**

## 9. Pendente para produção

Esta evidência é **de homolog local** e **não equivale a aprovação de produção**.
Permanecem pendentes, em etapas próprias:

- Conferência remota de estruturas, migrations e permissões (ACL/RLS) em produção.
- Integração de `offer_version_id` na concessão e backfill/roteiro de transição (fatias
  seguintes; sem backfill nesta subfatia).
- RPC/painel Admin de publicação/edição e troca de fonte dos consumidores (fatia 4/6).
- Publicação do código, deploy, smoke e ativação — exigem autorização específica.
- Re-baseline do F57.2 continua fora de escopo; o perfil F57.2 não deve ser reexecutado
  contra este ledger sem revisão explícita.

---

*F63 / 63-05 — homolog local, 2026-11-26. Sem commit/push/deploy; produção/remotos intocados.*
