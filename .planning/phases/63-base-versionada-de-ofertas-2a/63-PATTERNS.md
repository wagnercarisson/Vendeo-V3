# F63 — Patterns & Analogues — Base versionada de ofertas (2A)

> Ponte para os planos. Não substitui o OpenSpec. Caminhos relativos à raiz.

## 1. Banco e migrations

| Artefato novo | Análogo mais próximo | Padrão a preservar |
|---|---|---|
| `trial_offer_versions` | `trial_offer_settings` (`20261020000001_f50_2_trial_offer_settings.sql`) | tabela pequena, checks explícitos, RLS/service-role-only, seed idempotente, sem grant de escrita ao cliente |
| FK composta de vigência | `trial_offer_enrollments` (`20261022000002_f50_4_enrollment_identity.sql`) | unicidade composta, integridade referencial, `ON DELETE RESTRICT` |
| Trigger de publicação/imutabilidade | `20261023000001_f50_4_snapshot_integrity.sql` e `20261022000002_f50_4_enrollment_identity.sql` | `BEFORE INSERT OR UPDATE`, comparação de `OLD/NEW`, rejeição fail-closed, exceção restrita a autoria `SET NULL` |
| Guarda de vigência em settings | RPC/trigger de feature flags existente | `BEFORE INSERT OR UPDATE`, validação da linha referenciada, `enabled` independente |
| Funções de leitura | RPCs `SECURITY DEFINER` de F50/F50.4 | `search_path = ''`, `REVOKE`/`GRANT` explícitos, execução só `service_role`, retorno JSONB |
| Calendário derivado | `status.ts`/RPCs de parcelas F50.2 | derivação pura, sem escrita, `make_interval(months => n)`, total exato |

**Convenções:** migrations aditivas, `CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP FUNCTION IF EXISTS` quando a assinatura mudar, `REVOKE`/`GRANT` explícitos, bloco `REVERT` comentado, timestamp UTC real e unicidade conferida. Aplicação no homolog com `psql --single-transaction`.

## 2. Módulo TypeScript

| Artefato novo | Análogo | Padrão |
|---|---|---|
| `src/lib/credit/trial-offer/offer.ts` | `src/lib/credit/credit-service.ts`, `src/lib/credit/trial-offer/status.ts` | `server-only`, tipos explícitos, leitura via RPC, mapeamento defensivo, sem efeitos colaterais |
| Leitura pública sem contagem | `public-offer-copy.ts` (não alterar) | projeção sem UUIDs/auditoria/dados internos; contagem só com `started_at` |

**Proibido:** importar `offer.ts` em páginas, Admin, `constants.ts`, `status.ts` ou `completion.ts` nesta fase.

## 3. Testes e harness

| Área | Análogo | Uso |
|---|---|---|
| Preflight de homolog | `scripts/testing/test-status.mjs` (`postgresHomologGateStatus`) | validar `TEST_DATABASE_URL` em `127.0.0.1:57782/postgres` e fingerprint do ledger |
| Perfil de integração | `scripts/testing/run-integration.mjs` + `test-categories.json` | criar categoria/perfil F63 sem alterar o perfil F57.2 |
| Testes de schema/RLS | `src/lib/__tests__/market-preferences-schema.postgres.test.ts` | `pg.Pool`, transações/rollback, savepoints, fingerprint do ledger |
| Testes de grants/roles | `src/lib/__tests__/market-preferences-security.postgres.test.ts` | `set local role`, `request.jwt.claims`, negação para `anon`/`authenticated` |
| Concorrência | `src/lib/credit/__tests__/f50-4-concurrency.test.ts` | duas conexões reais, locks, resultado único |
| Preservação de dados | `.planning/phases/50.4-*/evidence/50.4-12-db-verification.txt` | contagens/checksums antes/depois e classificação de efeitos |

**Regra:** triggers, RLS/grants e concorrência não podem ser encerrados por mocks ou leitura estática de SQL. Testes podem usar transação/rollback; concorrência que exige commit pode deixar versões publicadas de teste inertes, identificadas e separadas dos efeitos da migration.

## 4. Anti-padrões proibidos

- Criar tabela filha/JSON de parcelas ou tabela `trial_offers`.
- Alterar `trial_offer_enrollments`, `credit_balances`, `credit_transactions`, `freemium_entitlements`, RPCs ou constantes existentes.
- Copiar condições para a concessão ou reservar parcelas.
- Publicar configuração cujo calendário não alcance o total.
- Expor contagem efetiva de liberações na projeção pública.
- Usar `db reset`, criar outro banco, exigir backup ou apontar para produção/banco remoto.
- Aplicar migration fora de transação ou prosseguir após falha sem diagnóstico.
- Declarar homolog aprovado como produção aprovada.
