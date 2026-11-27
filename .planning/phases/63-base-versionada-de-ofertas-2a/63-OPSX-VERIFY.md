# F63 / OpenSpec Verify — `fase-2a-base-versionada-de-ofertas`

**Executado em:** 2026-11-26
**Escopo:** verificação documental/evidência do change contra `proposal.md`, `design.md`, `specs/trial-offer-catalog/spec.md` e `tasks.md`.
**Modo:** não reexecutou a suíte PostgreSQL; usa as evidências do 63-05 e o aceite técnico do responsável.
**Homolog ≠ produção.**

---

## 1. Summary Scorecard

| Dimensão | Status |
|---|---|
| Completeness | **74/74 tasks**, **12/12 requirements** |
| Correctness | **12/12 requirements cobertos**, **59/59 cenários mapeados** |
| Coherence | Design seguido; **0 CRITICAL**, **2 WARNING**, **1 SUGGESTION** |

**Resultado:** sem CRITICAL. **Pronto para arquivar com ressalvas registradas.**

---

## 2. Completeness

### 2.1 Tasks

`openspec instructions apply` → `progress.total=74`, `progress.complete=74`, `progress.remaining=0`.

As 74 tasks foram reconciliadas após a execução dos planos 63-01..63-05. As exceções de validação estão anotadas nas próprias tasks 5.18, 6.1 e 6.8:
- 5.18: suítes da oferta passam; 3 falhas globais alheias permanecem.
- 6.1: `npm run lint` executou, mas **TypeScript não foi validado** porque ESLint ignora `.ts`.
- 6.8: pendências de produção registradas.

### 2.2 Requirements

| # | Requirement | Evidência principal | Status |
|---|---|---|---|
| 1 | Identidade estável da oferta | `trial_offer_versions.offer_key` + FK para `trial_offer_settings`; schema test 5/12; seed v1 | COVERED |
| 2 | Condições versionadas | 13 colunas, checks, `release_frequency`/`credits_per_release`; schema tests 4/5/11 | COVERED |
| 3 | Imutabilidade das condições publicadas | trigger `trial_offer_versions_guard` + delete guard; schema tests 6/14; publisher test 16 | COVERED |
| 4 | Metadados de autoria | FKs `SET NULL`, `created_by`/`published_by`; schema test 15; Migration C | COVERED |
| 5 | Publicação validada e unilateral | INSERT/UPDATE, motivo, calendário; schema tests 13/14/16 | COVERED |
| 6 | Publicação concorrente consistente | duas conexões reais + lock; concurrency tests 1/2a/2b | COVERED |
| 7 | Referência vigente publicada do mesmo programa | FK composta + trigger; schema tests 17/18 | COVERED |
| 8 | Oferta inicial versionada | v1 28/20/weekly/5 publicada/vigente; schema tests 2/3; calendar test 1 | COVERED |
| 9 | Calendário derivado | 0/7/14/21, mensal, once, daily, timezone; calendar tests 1-5; helper borders 4 | COVERED |
| 10 | Contratos de leitura centralizados | 3 RPCs, projeção de 6 campos, RLS/grants; schema 7-10; calendar 7-9; offer tests | COVERED |
| 11 | Sem backfill / concessões inalteradas | schema 19; preservation post-tests; `trial_offer_enrollments` sem `offer_version_id` | COVERED |
| 12 | Consumidores e créditos preservados | nenhum import de `offer.ts`; preservation 1/41/265/1; global 3 falhas alheias | COVERED |

---

## 3. Correctness

### 3.1 Cenários

**59/59 cenários** da spec foram mapeados para implementação/teste/evidência; nenhum cenário sem cobertura foi encontrado.

| Grupo | Cenários | Evidência |
|---|---|---|
| Identidade/condições | 8 | schema 4/5/11/12; seed |
| Imutabilidade/autoria | 9 | schema 6/14/15/16; Migration C |
| Publicação/concorrência | 11 | schema 13/14/16; concurrency 1/2a/2b |
| Vigência | 6 | schema 17/18; calendar 8 |
| Oferta inicial/calendário | 10 | calendar 1-5; seed |
| Contratos de leitura | 7 | schema 7-10; calendar 7-9; offer tests |
| Sem backfill/consumidores | 8 | schema 19; preservation; guard de import; Súmulas 63-04/05 |

### 3.2 Suite real

- `f63-offer-catalog-schema.postgres.test.ts`: 19/19 PASS
- `f63-offer-catalog-calendar.postgres.test.ts`: 10/10 PASS
- `f63-offer-catalog-concurrency.postgres.test.ts`: 4/4 PASS
- `trial-offer-offer.test.ts`: 30/30 PASS
- `preservation-report --stage post-tests`: exit 0, 10/10 checks

### 3.3 Divergências

Nenhuma divergência funcional encontrada. A única diferença documental é o **comentário SQL desatualizado** da função `trial_offer_versions_guard()` (herdado da Migration A), registrado como SUGGESTION.

---

## 4. Coherence

### 4.1 Design

- Identidade via `offer_key`, sem `trial_offers` — seguido.
- Versão imutável com `published_at` como único marcador — seguido.
- Frequência + créditos por liberação, sem tabela filha/JSON — seguido.
- Calendário derivado, total exato, UTC na função — seguido.
- Publicação validada em INSERT/UPDATE, `id` imutável, publisher na primeira publicação — seguido; correção forward-only em C sem editar A.
- Vigência com FK composta + trigger de publicada; `enabled` independente — seguido.
- RLS/grants service_role-only; projeção pública sem contagem — seguido.
- Sem backfill e sem alteração de consumidores — seguido.
- Homolog existente, transações por migration, sem reset/backup — seguido.
- Aplicador com stage explícito e relatório de preservação — seguido.

### 4.2 Padrões

- Migrations forward-only com timestamp UTC real e `REVERT` comentado.
- Funções `SECURITY DEFINER` com `search_path=''`; helper `IMMUTABLE INVOKER`.
- Testes negativos em savepoint/rollback; concorrência com duas conexões.
- Fixtures `f63test-%` inertes, listadas e não atribuídas à migration.

---

## 5. Issues

### CRITICAL

Nenhum.

### WARNING

1. **Lint TypeScript não validado.** `npm run lint` exit 0, mas ESLint ignora `.ts` neste repositório. Não é gate verde.
2. **Suíte global permanece falhando.** `npm test` exit 1 com 3 falhas: 2 guardas F60.4/F60.7 por migrations F63 não rastreadas e 1 comparativo do HEAD (`expected 1 to be +0`). Guardas/referências não foram alterados.

### SUGGESTION

1. **Comentário SQL desatualizado** em `public.trial_offer_versions_guard()`: descreve a política anterior de `published_by`. O comportamento está correto (Migration C); atualizar o comentário em etapa documental/migration futura, se desejado.

---

## 6. Final Assessment

**0 CRITICAL; 2 WARNING; 1 SUGGESTION.** A implementação corresponde ao proposal, design e spec no escopo do homolog. Tasks reconciliadas 74/74. **Pronto para sincronizar/arquivar o OpenSpec, mantendo as ressalvas explícitas.**

Pendências de produção permanecem fora deste verify: conferência remota de estruturas/migrations/permissões, integração de `offer_version_id`, backfill/roteiro, RPC/painel Admin e troca de fonte dos consumidores.
