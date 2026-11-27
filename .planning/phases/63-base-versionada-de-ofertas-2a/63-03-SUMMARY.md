---
phase: 63-base-versionada-de-ofertas-2a
plan: 03
subsystem: database
tags: [postgres, supabase, migration, seed, triggers, publisher, homolog]

# Dependency graph
requires:
  - phase: 63-base-versionada-de-ofertas-2a
    plan: 02
    provides: "Migration A aplicada (tabela versionada, guardas, funções, current_version_id nullable, ledger 159) e scripts/f63"
provides:
  - "Migration B aplicada: v1 publicada (trial_28d_v1/v1, 28/20/weekly/5) e vigente"
  - "trial_offer_settings.current_version_id preenchido e NOT NULL"
  - "Migration C forward-only aplicada: guard de publicação corrigido para published_by"
  - "Prova comportamental do publisher em 6 casos dentro de transação com rollback"
  - "Preservação post-b e post-c iguais ao baseline 63-01"
affects: ["63-04 (módulo TS)", "63-05 (suíte F63 e preservação post-tests)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seed verificar-ou-falhar em DO block, sem ON CONFLICT DO UPDATE"
    - "Snapshot temporário de preservação (count+md5) no início e no fim da mesma transação"
    - "Validação fail-closed do calendário chamando a própria função SQL de leitura"
    - "Correção forward-only de função de trigger com CREATE OR REPLACE + REVOKE/GRANT"
    - "Smoke de trigger em transação única com ROLLBACK e asserts de zero resíduo"

key-files:
  created:
    - supabase/migrations/20261126230735_offer_catalog_seed_v1.sql
    - supabase/migrations/20261126231022_offer_catalog_published_by_fix.sql
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-b.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-b.md
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-b.log
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-preservation-post-b.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-preservation-post-b.md
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-c.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-c.md
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-c.log
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-preservation-post-c.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-preservation-post-c.md
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-publisher-smoke.log
  modified:
    - .planning/phases/63-base-versionada-de-ofertas-2a/63-02-SUMMARY.md

key-decisions:
  - "Timestamp B 20261126230735 e C 20261126231022 gerados no instante real de criação (UTC), B>A e C>B, com unicidade conferida em worktree, git log --all e branches conhecidas"
  - "Migration B usa seed verificar-ou-falhar, valida o calendário pela função real (0/7/14/21/total 20) e compara preservação antes/depois na mesma transação"
  - "Migration A permanece byte-idêntica (SHA-256 ED652A26…F8329BC); correção do publisher é apenas forward-only em C"
  - "Migration C contém somente CREATE OR REPLACE FUNCTION do guard + REVOKE/GRANT + REVERT comentado; nenhuma tabela/dado/outra função alterada"
  - "Smoke do publisher em uma transação com ROLLBACK usando usuários fixture; pós-rollback sem linhas residuais"
  - "COMMENT ON FUNCTION da Migration A não foi alterado (restrição da autorização); comportamento é o do novo corpo"

patterns-established:
  - "Evidência de preservação por estágio (post-b, post-c) com delta de ledger 2 e 3"
  - "Smoke de regras de trigger com fixtures e asserts de SQLSTATE/mensagem dentro de subtransações"

requirements-completed: [REQ-63-02, REQ-63-03, REQ-63-05]

# Metrics
duration: 10min
completed: 2026-11-26
---

# Phase 63 Plan 03: Seed da v1 e correção forward-only do publisher

**Migration B publicou a v1 vigente (28 dias/20 créditos/semanal/5 por liberação) com `current_version_id` NOT NULL, e a Migration C forward-only corrigiu o guard de publicação para aceitar `published_by` na primeira publicação — ledger 158→159→160→161, publisher 6/6 em rollback e as quatro tabelas preservadas idênticas ao baseline em post-b e post-c.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-11-26T23:03:00Z (aprox.)
- **Completed:** 2026-11-26T23:13:00Z
- **Tasks:** 3/3
- **Files modified:** 2 migrations + 13 evidências criadas + 1 summary atualizado (63-02) + este SUMMARY

## Accomplishments

- `supabase/migrations/20261126230735_offer_catalog_seed_v1.sql` (SHA-256 `e511295e…5c4b7`) criada com timestamp UTC real `> A` e aplicada com `--stage post-b`: `exit_code=0`, `duration_ms=185`, ledger **159→160**.
- Seed da v1 exatamente como especificado: `trial_28d_v1/v1`, `Teste gratuito de 28 dias`, 28 dias, 20 créditos, `weekly`, 5 por liberação, `published_at` preenchido, motivo `publicação inicial da oferta vigente`, `published_by`/`created_by` NULL.
- Calendário fail-closed pela função real em duas datas (`2026-03-10 09:30+00` e `2026-12-28 23:00+00`): 4 liberações de 5 nos dias 0/7/14/21, total 20, `expires_at = started_at + 28 dias`.
- `trial_offer_settings.current_version_id` = id da v1 (`426783dc-5918-447e-8cae-bb9ee917df25`) e `is_nullable = NO` (`attnotnull = true`); guarda dos oito campos restantes sem divergência.
- `supabase/migrations/20261126231022_offer_catalog_published_by_fix.sql` (SHA-256 `817cbd8a…d549c`) criada com timestamp UTC real `> B` e aplicada com `--stage post-c`: `exit_code=0`, `duration_ms=134`, ledger **160→161**.
- Migration C contém apenas `CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()` (`provolatile='v'`, `prosecdef=false`, `search_path=""`), `REVOKE`/`GRANT` service_role-only e `REVERT` comentado. `anon`/`authenticated` sem EXECUTE; `service_role` com EXECUTE.
- Migration A `20261126223854` permanece byte-idêntica: SHA-256 `ED652A26FC9294CDC239A842C2AEBB00CCC1A182FF39E9DAE13DEF947F8329BC` antes e depois; não editada, renomeada nem reaplicada.
- Smoke do publisher 6/6 dentro de uma transação com `ROLLBACK`: rascunho com publisher rejeitado; primeira publicação NULL→UUID aceita; publicado→outro UUID rejeitado; publicado→NULL aceito com condições inalteradas; rascunho→rascunho com publisher rejeitado; `created_by` só→NULL. Pós-rollback: 0 linhas `f63test-%`, 0 usuários fixture, `trial_offer_versions` = 1 (só a v1).
- Preservação: `preservation-report --stage post-b` e `--stage post-c` exit 0; quatro tabelas com `count`/`row_checksum_md5` idênticos ao baseline, `settings_guard` igual (inclui `individual_launch_at`), `functions_md5_match` true, ledger 160/161 com SHA-256.
- 63-04 **não iniciado**; nenhum consumidor, constante, status, completion, copy, página, Admin, flag, enrollment, saldo, transação ou entitlement alterado; nenhum backfill.

## Task Commits

Nenhum commit foi feito: a autorização explícita desta execução proíbe commit, push e deploy.

1. **Task 1: Autorar a Migration B** — sem commit (proibido)
2. **Task 2: Aplicar a Migration B com `--stage post-b` e provar v1/vigência/preservação** — sem commit (proibido)
3. **Task 3: Autorar/aplicar a Migration C, provar publisher e registrar post-c** — sem commit (proibido)

**Plan metadata:** sem commit (proibido)

## Files Created/Modified

- `supabase/migrations/20261126230735_offer_catalog_seed_v1.sql` — seed verificar-ou-falhar, calendário fail-closed, vigência, NOT NULL, guarda de preservação e REVERT comentado.
- `supabase/migrations/20261126231022_offer_catalog_published_by_fix.sql` — `CREATE OR REPLACE FUNCTION public.trial_offer_versions_guard()` forward-only + REVOKE/GRANT + REVERT comentado.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-b.{json,md,log}` — aplicação post-b, sha256, ledger 159→160, v1, calendário, contratos e preservação.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-preservation-post-b.{json,md}` — comparação contra o baseline no estágio post-b.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-migration-c.{json,md,log}` — aplicação post-c, hash de A antes/depois, inventário da função, smoke 6/6 e preservação.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-preservation-post-c.{json,md}` — comparação contra o baseline no estágio post-c (ledger 161).
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-03-publisher-smoke.log` — saída do smoke transacional com rollback.
- `.planning/phases/63-base-versionada-de-ofertas-2a/63-02-SUMMARY.md` — Addendum atualizado com o status executado de B/C (sem duplicar a seção).

## Decisions Made

- Timestamps reais `20261126230735` (B) e `20261126231022` (C), sem contador artificial, verificados contra worktree, `git log --all` e branches `main`, `feature/fase-44-temas-de-campanha-v2`, `backup/antes-reversao-f47-20261025-114407` e refs remotas.
- Seed sem `ON CONFLICT DO UPDATE`: divergência de qualquer campo esperado aborta com `F63_SEED_CONFLICT`.
- Validação do calendário usando `public.trial_offer_release_schedule` (função real), não uma reimplementação.
- Preservação comparada por `count` + `md5` dentro da transação (B) e por `preservation-report` fora dela (post-b/post-c).
- Migration C restrita a função + grants + REVERT; `COMMENT ON FUNCTION` de A não alterado (ver nota em Deviation).

## Deviations from Plan

### Implementation notes

**1. [Escopo autorizado] `COMMENT ON FUNCTION` removido da Migration C**
- **Found during:** Task 3 (autoria de C)
- **Issue:** o rascunho inicial atualizava o comentário da função; a autorização exige que C contenha apenas `CREATE OR REPLACE FUNCTION` + `REVOKE`/`GRANT` + `REVERT` comentado.
- **Fix:** o `COMMENT ON FUNCTION` foi removido antes do dry-run/aplicação; C não toca nenhum objeto além da função e seus grants. O comentário da Migration A permanece no catálogo.
- **Files modified:** `supabase/migrations/20261126231022_offer_catalog_published_by_fix.sql`
- **Verification:** verificação estática do plano passou; nenhum `ALTER TABLE`/`CREATE TABLE`/`DROP TABLE`/DML de negócio no corpo executável.
- **Committed in:** não commitado (proibido).

**2. [Documentação] Comentário de função desatualizado (sem impacto funcional)**
- **Found during:** Task 3 (inventário da função)
- **Issue:** o `COMMENT ON FUNCTION` herdado da Migration A descreve a política antiga de autoria; o corpo novo aceita `published_by` NULL→UUID na primeira publicação.
- **Fix:** nenhum — fora do escopo autorizado de C. Registrado em `63-03-migration-c.md` §8 como pendência documental; não altera comportamento.
- **Files modified:** nenhum
- **Verification:** comportamento comprovado pelo smoke 6/6.
- **Committed in:** não aplicável.

---

**Total deviations:** 1 ajuste de escopo antes da aplicação (sem efeito residual) + 1 pendência documental registrada.
**Impact on plan:** nenhum desvio comportamental; valores, stages, ledger, publisher e preservação seguem exatamente o plano.

## Issues Encountered

Nenhum. Não houve falha de aplicação, SQLSTATE de erro, rollback por falha, ledger divergente ou resíduo de smoke. Único ruído operacional: o PowerShell exibiu NOTICEs do psql no stream de erro (`NativeCommandError`), com `exit_code=0` real do psql e todos os `SMOKE_CASE*_OK` presentes no log.

## Known Stubs

Nenhum stub. A v1 está realmente semeada, vigente e referenciada; as funções de leitura resolvem a v1; nenhum placeholder, valor vazio ou componente sem fonte de dados foi introduzido.

## Threat Flags

Nenhuma superfície nova além do previsto no `<threat_model>` do plano: a Migration C substitui apenas a função de trigger já existente, mantendo `search_path=''` e EXECUTE restrito a `service_role`; nenhum endpoint, rota de auth, padrão de acesso a arquivos ou mudança de schema em fronteira de confiança foi adicionado.

## User Setup Required

Nenhum — o homolog já estava provisionado; identidade reconfirmada antes de cada escrita. Nenhuma credencial, connection string, JWT ou valor `*_EXPECTED_*` foi impresso ou persistido.

## Next Phase Readiness

- Base versionada concluída no homolog: v1 publicada/vigente, `current_version_id` NOT NULL, guard de publisher corrigido forward-only, preservação intacta.
- **Não iniciado:** `63-04` (módulo TypeScript `offer.ts`), suíte F63/`post-tests` do `63-05`, integração de consumidores, backfill, produção.
- F57.2 pós-F63 não executado; re-baseline fora de escopo (fingerprint `f57_2_` divergente por +3 linhas).
- Nada commitado, enviado (push) ou implantado (deploy).

---

## Review Stop

**Status:** plano 63-03 executado e parado no Review Stop. Autorização: `approved: 63-03`. Nenhuma etapa do 63-04 foi iniciada.

Checklist do revisor coberto pela evidência:
- Migration A `20261126223854` e SHA-256 `ED652A26…F8329BC` intactos (antes/depois).
- B `20261126230735` (real > A) aplicada com `--stage post-b`; ledger 160.
- C `20261126231022` (real > B), apenas `CREATE OR REPLACE FUNCTION` + REVOKE/GRANT + REVERT; `--stage post-c`; ledger 161.
- Publisher: rascunho sem `published_by`; primeira publicação aceita NULL→UUID; publicado→outro UUID rejeitado; publicado→NULL aceito; `created_by` só→NULL.
- REVOKE/GRANT reaplicados; REVERT comentado sem auto-execução.
- Smoke 6/6 em transação com rollback; zero linhas residuais.
- `preservation-report --stage post-c` exit 0, delta 3, quatro tabelas iguais.
- Addendum do `63-02-SUMMARY.md` registra o defeito de A e o status executado de B/C.

**Sinal de retomada:** `approved: 63-03` (revisão) ou a lista de ajustes obrigatórios.

---

## Self-Check: PASSED

Arquivos verificados como existentes: `20261126230735_offer_catalog_seed_v1.sql`,
`20261126231022_offer_catalog_published_by_fix.sql`, os cinco artefatos de B
(`63-03-migration-b.{json,md,log}`, `63-03-preservation-post-b.{json,md}`), os cinco de C
(`63-03-migration-c.{json,md,log}`, `63-03-preservation-post-c.{json,md}`),
`63-03-publisher-smoke.log` e este SUMMARY. Contagens: 1 migration `*_offer_catalog_seed_v1.sql`,
1 migration `*_offer_catalog_published_by_fix.sql`. Hash de A inalterado; ledger 161; v1
publicada/vigente. Nenhum conteúdo semelhante a credencial nas evidências. Sem commits por
proibição explícita (não há hash a verificar).

*Phase: 63-base-versionada-de-ofertas-2a*
*Completed: 2026-11-26*
