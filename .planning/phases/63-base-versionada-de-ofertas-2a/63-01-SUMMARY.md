---
phase: 63-base-versionada-de-ofertas-2a
plan: 01
subsystem: database
tags: [postgres, supabase, homolog, preflight, ledger, checksum, docker, read-only]

# Dependency graph
requires:
  - phase: 50.2-f50-2-oferta-de-teste-gratuito
    provides: trial_offer_settings/trial_offer_enrollments e RPCs da oferta
  - phase: 50.4-f50-4-oferta-de-onboarding-individualizada-por-cnpj-completo
    provides: individual_launch_at, assinaturas finais das RPCs e padrão de imutabilidade
provides:
  - scripts/f63/homolog-identity.mjs com assertHomologIdentity/readLedgerFingerprint/readPreservedSnapshot/readSchemaGuards
  - scripts/f63/preservation-report.mjs com estágios post-a/post-b/post-tests e contrato JSON pinado
  - 63-01-baseline.json determinístico (ledger all_rows, quatro tabelas preservadas, settings_guard de oito campos, guardas de schema)
  - 63-01-preflight.md com identidade, semântica F57.2 vs F63 e política de evidência
affects: [63-02, 63-03, 63-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Identidade de homolog provada por docker inspect + docker port + SELECT interno, sem connection string"
    - "Fingerprint de ledger all_rows calculado em Node sobre version|name ordenado"
    - "Checksum determinístico por tabela com TimeZone=UTC e DateStyle=ISO,YMD"
    - "CLI ESM com guard de entrypoint para permitir import pelas etapas seguintes"

key-files:
  created:
    - scripts/f63/homolog-identity.mjs
    - scripts/f63/preservation-report.mjs
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-baseline.json
    - .planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-preflight.md
  modified: []

key-decisions:
  - "O alvo é o homolog existente (G:\\Vendeo-Homolog, supabase_db_vendeo-homolog, 127.0.0.1:57782/postgres); o script só aceita esse alvo e recusa host não-loopback"
  - "Acesso SQL exclusivamente por docker exec psql (somente SELECT), sem ler ou persistir connection string"
  - "Fingerprint do ledger usa all_rows; o F57.2 não é executado e seu re-baseline fica fora de escopo"
  - "settings_guard guarda os oito campos pré-existentes, incluindo individual_launch_at"
  - "O contrato JSON de baseline/relatório foi implementado com as chaves exatas consumidas por 63-02/03/05"

patterns-established:
  - "Preflight read-only: provar container/porta/banco antes de qualquer escrita"
  - "Evidência versionável sem credenciais: apenas contagens, hashes e comandos sem valores de ambiente"
  - "Comparação antes/depois por count + row_checksum_md5; sha256 informativo"

requirements-completed: [REQ-63-01]

# Metrics
duration: ~2 min de captura de evidência (leitura de contexto à parte)
completed: 2026-11-26
---

# Phase 63 Plan 01: Preflight read-only e baseline do homolog Summary

**Identidade do homolog provada e baseline determinístico registrado: ledger 158 linhas, quatro tabelas preservadas com checksums, settings_guard de oito campos e guardas das cinco RPCs — sem nenhuma escrita**

## Performance

- **Duration:** ~2 min entre a primeira e a última captura de evidência (a leitura de plano/contexto ocorreu antes e não é contabilizada)
- **Started:** 2026-11-26T22:30:44Z (primeira captura de evidência)
- **Completed:** 2026-11-26T22:32Z (aprox.)
- **Tasks:** 2/2
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

- Alvo confirmado sem ambiguidade: container `supabase_db_vendeo-homolog` em execução, imagem `public.ecr.aws/supabase/postgres:17.6.1.132`, publicação real `0.0.0.0:57782,[::]:57782` (host 57782 → container 5432), banco `postgres`, servidor 17.6.
- Estado pré-migração registrado: `trial_offer_versions` ausente, `trial_offer_settings.current_version_id` ausente, singleton `trial_28d_v1` com uma única linha.
- Baseline de preservação: `trial_offer_enrollments` (1), `credit_balances` (41), `credit_transactions` (265) e `freemium_entitlements` (1), cada um com `row_checksum_md5` e `sha256`.
- Guardas de schema: hashes MD5 das cinco RPCs atuais e listas posicionais de colunas de `trial_offer_enrollments` e `trial_offer_settings`.
- Contrato JSON pinado e validado por `--verify`, pronto para consumo por 63-02/03/05.
- Nenhuma escrita executada e pós-checagem idêntica ao baseline (ledger e quatro tabelas inalterados).

## Task Commits

Nenhum commit foi criado: a instrução explícita desta execução proíbe commit, push e deploy. É uma exceção deliberada ao protocolo padrão de commits atômicos do executor.

1. **Task 1: Exportar identidade/ledger/guardas e pinar o contrato de evidência** — não commitado (instrução explícita)
2. **Task 2: Executar preflight read-only e registrar baseline** — não commitado (instrução explícita)

**Plan metadata:** não commitado (instrução explícita)

## Files Created/Modified

- `scripts/f63/homolog-identity.mjs` — CLI/ESM somente leitura: identidade, ledger `all_rows`, snapshot determinístico das quatro tabelas, guardas de schema, linha de settings, estado de versões, geração de baseline/Markdown e `--verify`.
- `scripts/f63/preservation-report.mjs` — CLI/ESM somente leitura: comparação baseline × atual por estágio (`post-a`, `post-b`, `post-tests`), classificação de fixtures `f63test-` e contrato JSON do relatório.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-baseline.json` — baseline versionável, sem credenciais.
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-preflight.md` — registro legível de identidade, ledger, tabelas, estado pré-migração, baseline, guardas, semântica F57.2 vs F63 e declaração de somente leitura.

## Decisions Made

- Acesso ao banco exclusivamente por `docker exec ... psql` com SELECT; nenhuma URL de conexão é necessária, impressa ou persistida.
- `published` registra a string real do `docker port`; a invariante é host 57782 → container 5432, aceitando `0.0.0.0`, `127.0.0.1` e `[::]`.
- Checksums calculados sobre `t::text` com sessão fixa em `TimeZone=UTC` e `DateStyle=ISO, YMD`, ordenados por `id` ou `store_id` conforme o contrato.
- `schema_guards.functions` usa a assinatura completa como chave (`public.fn(types)`), com `md5(pg_get_functiondef(oid))`.
- O relatório mantém `ledger` em todos os estágios e separa `current_version_id` como efeito de migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `inet_server_port()` é nulo na sessão de socket local do container**

- **Found during:** Task 1 (identidade)
- **Issue:** `docker exec psql` conecta por socket Unix dentro do container, onde `inet_server_port()` retorna NULL, embora o plano espere ler a porta interna 5432.
- **Fix:** a consulta usa `coalesce(inet_server_port(), current_setting('port')::int)`; a porta 5432 é conferida contra o mapeamento `docker port` (que também resulta em 5432) e a divergência lança erro.
- **Files modified:** `scripts/f63/homolog-identity.mjs`
- **Verification:** identidade executada com sucesso; `containerPort` e porta interna ambos 5432.
- **Committed in:** não commitado (instrução explícita)

**2. [Rule 1 - Bug] Literal proibido pelo próprio check estático dentro do gerador de Markdown**

- **Found during:** Task 1 (verificação estática)
- **Issue:** a frase "nenhum `db reset` ocorreu" no template do Markdown fazia o check estático do plano falhar, pois ele varre linhas não-comentário dos scripts.
- **Fix:** a frase foi reescrita como "nenhum reset de banco ocorreu", preservando o significado e satisfazendo o gate.
- **Files modified:** `scripts/f63/homolog-identity.mjs`
- **Verification:** check estático retorna `read-only static ok`.
- **Committed in:** não commitado (instrução explícita)

**3. [Rule 1 - Bug] Nome de propriedade divergente no mapa de checks do relatório**

- **Found during:** Task 2 (smoke test read-only do `preservation-report` antes das migrations)
- **Issue:** o objeto `checks` lia `stageChecks.testRowsInert` (camelCase), mas `evaluateStage()` retorna `test_rows_inert` (snake_case); o valor ficava `undefined` e o check era reprovado indevidamente.
- **Fix:** a leitura passou a usar `stageChecks.test_rows_inert`.
- **Files modified:** `scripts/f63/preservation-report.mjs`
- **Verification:** smoke test `--stage post-a` agora reprova apenas os três checks esperados antes das migrations (`ledger_delta_ok`, `settings_columns_expected`, `versions_ok`), provando falha fechada correta.
- **Committed in:** não commitado (instrução explícita)

### Environment / Process Notes

**4. `TEST_DATABASE_URL` ausente no ambiente de execução**

- A premissa do `user_setup` ("já provisionado") não se confirmou neste shell. Não bloqueou o plano: todo acesso SQL ocorreu dentro do container e nenhuma URL era necessária.
- O script valida a variável apenas se ela existir e recusa qualquer host não-loopback ou porta/banco divergentes, sem imprimir o valor.
- Registrado no `63-01-preflight.md` (seção 9).

**5. Review Stop sem token formal de aprovação**

- O plano declara "nenhuma tarefa pode rodar antes da aprovação explícita" e espera o sinal `approved: 63-01`.
- A execução foi autorizada explicitamente pelo prompt do orquestrador, que determinou executar somente o 63-01 (read-only) e parar no Review Stop. Não houve token `approved: 63-01` em arquivo.
- Nenhum passo do 63-02 foi iniciado.

**6. Sem commits e sem atualização de STATE/ROADMAP**

- A instrução explícita proíbe commit/push/deploy e limita a criação de arquivos aos listados no plano mais este SUMMARY. Por isso não houve commit atômico nem atualização de `STATE.md`/`ROADMAP.md`.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs) + 3 notas de ambiente/processo
**Impact on plan:** Nenhum desvio alterou escopo, alvo ou contrato; o plano permaneceu estritamente read-only.

## Issues Encountered

- `node scripts/testing/test-status.mjs` reporta os gates de integração como "GATE NÃO EXECUTADO — NÃO APROVADO" porque `TEST_DATABASE_URL`/`F57_2_EXPECTED_*` não estão presentes neste shell. Isso é o comportamento esperado do harness ("gate não executado ≠ aprovado"), não uma falha do 63-01. O inventário em si está válido (exit 0).
- O smoke test read-only `preservation-report --stage post-a` foi executado antes das migrations e saiu 1 de forma correta e falha-fechada, apontando apenas `ledger_delta_ok`, `settings_columns_expected` e `versions_ok`. Isso exercitou todas as leituras do relatório e revelou o bug corrigido no item 3. Os ramos `post-b`/`post-tests` só podem ser exercitados após as migrations e ficam com 63-03/63-05.

## User Setup Required

Nenhuma configuração externa nova. O homolog existente já estava em execução. Observação: `TEST_DATABASE_URL` não estava presente no shell desta execução; se os planos seguintes exigirem a variável, ela deve apontar para `127.0.0.1:57782/postgres` (valor nunca deve ser impresso ou versionado).

## Addendum — correção posterior (2026-11-26)

Após a revisão do 63-02, o F63 passou a ter **três migrations** (A estrutural, B seed e C correção forward-only do guard de `published_by`). O baseline deste 63-01 foi capturado quando o plano previa duas migrations; os valores de ledger/checksums permanecem válidos. O fingerprint do F57.2 muda necessariamente em **+3 linhas** (158 → 161), e o re-baseline do F57.2 continua fora de escopo. Nenhuma migration foi criada ou aplicada neste plano.

## Review Stop Status

**Status: STOPPED antes do 63-02.**

- Task 1 e Task 2 concluídas com verificação automatizada aprovada.
- `63-02` **não foi iniciado**; nenhuma migration foi criada, aplicada ou reservada; nenhum `db reset`, criação de banco, backup ou acesso remoto ocorreu.
- Checklist do revisor:
  - [x] Alvo `G:\Vendeo-Homolog`, container `supabase_db_vendeo-homolog`; `docker port` expõe host 57782 → container 5432 em `0.0.0.0:57782` e `[::]:57782`; alvo lógico `127.0.0.1:57782/postgres`; hosts não-loopback recusados.
  - [x] Nenhuma criação de banco, reset, backup, escrita de schema ou DML.
  - [x] `settings_guard` inclui `individual_launch_at` e as oito colunas pré-existentes.
  - [x] F57.2 não executado; diferença de fingerprint (all_rows vs filtro `f57_2_`, +3 linhas A/B/C) documentada; re-baseline fora de escopo.
  - [x] Somente `docker inspect`/`docker port` e SELECT; nenhuma suíte de testes.
  - [x] `assertHomologIdentity()` e contrato JSON pinados para 63-02/03/05.
  - [x] Evidência sem credenciais; regex ancorado em atribuição/segredo e nome do container permitido.
  - [x] Nenhum timestamp de migration reservado.

## Verification Evidence

| Verificação | Resultado |
|---|---|
| `node --check scripts/f63/homolog-identity.mjs` | exit 0 |
| `node --check scripts/f63/preservation-report.mjs` | exit 0 |
| Check estático read-only (comment-stripped) | `read-only static ok` |
| `node scripts/f63/homolog-identity.mjs --dry-run` | exit 0; alvo impresso sem executar Docker |
| `node scripts/f63/homolog-identity.mjs --out ... --md-out ...` | exit 0 |
| `node scripts/f63/homolog-identity.mjs --verify .../63-01-baseline.json` | exit 0 |
| Checagem JS do contrato + regex de credencial (Task 2) | `baseline ok` |
| `node scripts/testing/test-status.mjs` | inventário válido, exit 0 |
| Smoke test `preservation-report --stage post-a` (pré-migration) | exit 1 esperado/falha-fechada: `ledger_delta_ok`, `settings_columns_expected`, `versions_ok` |
| Pós-checagem de preservação | ledger 158/`5f9a2c62…` igual; quatro tabelas com count/md5 iguais; `trial_offer_versions` ausente; `current_version_id` ausente |

Números registrados no baseline:

- Ledger: `count = 158`, `max_version = 20261123130252`, `sha256 = 5f9a2c6263982cb144af9d933e71a7a8445d5f1466c745d9f02d63fa71b46365`.
- Preservadas: enrollments `1`/`3ffb438b…`, credit_balances `41`/`3469aa81…`, credit_transactions `265`/`79910afd…`, freemium_entitlements `1`/`3a7efe44…`.
- `pre_state`: `trial_offer_versions_absent = true`, `current_version_id_absent = true`, `settings_singleton_count = 1`.

Caminhos exatos da evidência:

- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-baseline.json`
- `.planning/phases/63-base-versionada-de-ofertas-2a/evidence/63-01-preflight.md`

## Known Stubs

None. Os scripts não contêm dados vazios, placeholders ou componentes sem fonte; todas as funções leem o homolog real.

## Threat Flags

None. Não houve nova superfície de rede, autenticação ou mudança de schema; o código criado é somente leitura e restrito ao alvo homolog.

## Next Phase Readiness

- 63-02 pode importar `assertHomologIdentity()`, `readLedgerFingerprint()`, `readPreservedSnapshot()`, `readSchemaGuards()` e usar `--verify` do baseline.
- 63-02 deve gerar o timestamp real da migration na criação do arquivo (nada foi reservado aqui) e rodar `preservation-report --stage post-a`.
- Risco residual: os caminhos de banco do relatório ainda não foram exercitados; a primeira execução real em 63-02 deve ser tratada como validação do próprio relatório.
- A validação no homolog é salvaguarda local, não aprovação de produção.

## Self-Check: PASSED

- Arquivos existem: `scripts/f63/homolog-identity.mjs`, `scripts/f63/preservation-report.mjs`, `63-01-baseline.json`, `63-01-preflight.md`.
- `--verify` do baseline retorna 0; checagem de contrato/credencial retorna `baseline ok`.
- Commit check: N/A por instrução explícita de não commitar.

---

*Phase: 63-base-versionada-de-ofertas-2a*
*Completed: 2026-11-26*
