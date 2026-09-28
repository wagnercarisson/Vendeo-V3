# F48.2.2 — Verificação da Fase (Fundação da bancada de geração)

> Arquivo iniciado pelo Plano 01 (`48-2-2-01`). O **SHA base** foi capturado no início
> da execução da fase e é a referência para o encerramento (plano 08) comparar
> `base..HEAD` — não apenas o working tree.

Base SHA: 50ae600792158b781b7ac3fb5f61004b17a96dd2

Capturado em: 2026-09-28 (início da execução da F48.2.2).

---

## 1. Escopo verificado

A F48.2.2 entrega a **fundação da bancada de geração** no Admin/Laboratório: bounded context isolado `src/lib/lab/bench/**`, persistência local-first (`lab_bench_runs`/`lab_bench_artifacts` fora da cadeia de migrations), lojas de teste por manifesto local, branding completo (incl. `typography_direction`) servido por signer local restrito, registry extensível de dimensões e presets (`BENCH_MODEL_ALLOWLIST`), pricing local em código, invocação isolada single-shot, API administrativa, UI desktop e UAT local com geração real controlada. Fonte da verdade: `openspec/changes/fase-48-2-2-fundacao-bancada-geracao/`.

---

## 2. `must_haves` da fase — evidência

| # | Verdade exigida | Evidência | Resultado |
|---|---|---|---|
| 1 | Bounded context `src/lib/lab/bench/**` coberto pelos gates arquiteturais do laboratório | `src/lib/ai/__tests__/architecture-guard.test.ts` (subconjunto `src/lib/lab/bench/`) | ✅ |
| 2 | Registry de dimensões habilita apenas o primeiro recorte; demais desabilitados com motivo | `config-registry.ts` + `config-registry.test.ts` | ✅ |
| 3 | Valor fora do registry é recusado antes de qualquer chamada paga | `config_registry_unknown_value`; testes | ✅ |
| 4 | Estado inicial do run `draft` (não ocupa o slot global) | `schemas.ts` (`BENCH_INITIAL_RUN_STATUS`), DDL `bench-schema.sql` | ✅ |
| 5 | Allowlist própria `BENCH_MODEL_ALLOWLIST`; `MODEL_ALLOWLIST` produtivo intocado | `bench-model-allowlist.ts`; teste negativo do Flare | ✅ |
| 6 | Detector de isolamento permite **somente leitura** de lojas/branding local e mantém `campaign-images`/lojas remotas proibidos | `lab-isolation.contract.test.ts` (`READ_ONLY_TABLES`/`READ_ONLY_BUCKETS`/`wrapReadOnlyBucket`) | ✅ |
| 7 | Acesso a tabelas produtivas de campanha faz o teste falhar | testes negativos de fronteira | ✅ |
| 8 | SHA base registrado no início da fase | linha `Base SHA` acima | ✅ |
| 9 | Spike produzido a partir de documentação oficial + evidência do repositório, **sem chamada paga** | `docs/lab/48-2-2-spike-models.md` | ✅ |
| 10 | Nenhum preset habilitado antes do CHECKPOINT 1; presets habilitados apenas após CP1/CP2 | `preset-registry.ts`; UAT | ✅ |
| 11 | UAT local com geração real controlada sob autorização humana | `48.2.2-UAT.md` (run `f6148ea6-…` `succeeded`) | ✅ |
| 12 | UAT é condicional (recusa ⇒ fase não concluída) | UAT aprovado explicitamente | ✅ |
| 13 | Produção intocada — comparativo `base..HEAD` | §4 abaixo | ✅ |
| 14 | Artefatos de verificação/UAT gerados; tracking atualizado; arquivamento preparado | `48-2-2-VERIFICATION.md`, `48.2.2-UAT.md`, tracking | ✅ |

---

## 3. Gates automatizados

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 |
| Fronteira + signer | `bench-boundary.contract.test.ts` | ✅ PASS |
| Concorrência | `bench-concurrency.contract.test.ts` | ✅ PASS |
| Suíte completa | `npm test` | ⚠ `385 passed (386)` / `4200 passed | 1 skipped` — **1 falha externa** (§5) |
| Sem chamada paga | fakes em memória / `executeBenchRun` mockado | ✅ |

**Regressão da bancada/API/UI (planos 05–07):** `64` + `58` + `17` testes de contrato verdes (além dos gates transversais do plano 08). Typecheck/lint verdes em cada plano.

---

## 4. Produção intocada — comparativo `base..HEAD`

`BASE = 50ae600792158b781b7ac3fb5f61004b17a96dd2` (lido da linha `Base SHA` acima; **não** recriado).

Comando: `git diff --name-only $BASE..HEAD -- <caminhos produtivos>`.

| Caminho protegido | Resultado |
|---|---|
| `src/components/campaign/types.ts` | vazio |
| `src/lib/store-identity-service.ts` | vazio |
| `src/lib/image-generation/services/art-director-briefing.ts` | vazio |
| `src/lib/ai/adapters/images.ts` | vazio |
| `src/lib/ai/adapters/registry.ts` | vazio |
| `src/lib/ai/model-registry.ts` | vazio |
| `src/lib/ai-cost/cost-estimator.ts` | vazio |
| `src/lib/ai/lab-cost-estimate.ts` | vazio |
| `prompts/` | vazio |
| `supabase/migrations/**` | vazio |

**Nenhum `supabase db push`**; `lab_bench_runs`/`lab_bench_artifacts` existem **somente** no Supabase local (criadas pelo bootstrap, fora de `supabase/migrations/`). **Nenhuma linha produtiva** foi tocada.

---

## 5. Exceções preexistentes

- **F50 (externa à fase):** `src/lib/legal/__tests__/legal-document-versions.test.ts` → `ENOENT` do caminho antigo da change arquivada da F50. **Não corrigida** nesta fase; follow-up externo.
- **Flaky de infraestrutura local:** `src/lib/__tests__/data-subject-requests.postgres.test.ts` (integração Postgres local) falhou em uma execução e passou em outra; **não relacionado** à F48.2.2.

---

## 6. Isolamento e custo

- **Créditos:** nenhum consumo (`credit_transactions` e `admin_audit_log` mais recentes são **anteriores** ao run do UAT).
- **Tabelas operacionais:** `campaigns=0`, `campaign_art_versions=0`, `generation_events=0`, `ai_model_selection=0`; bucket `campaign-images` não utilizado.
- **Custo:** exatamente **uma** geração real controlada no run principal; custo **estimado** US$ 0,00588 e **calculado** US$ 0,014592 (`cost_source: bench_local_pricing`, rule `2026-09-bench-1`, `coverage: partial`); **custo reportado pelo provider `null`** — nada apresentado como faturado. Detalhes e classificação em `48.2.2-UAT.md` §6.
- **Achado não bloqueante:** o `branding_snapshot` persiste URLs assinadas locais (tokens efêmeros, já expirados) por desenho do schema — registrado como limitação em `48.2.2-UAT.md` §9.1.

---

## 7. Conclusão

A F48.2.2 atinge o objetivo: a bancada de geração opera **de ponta a ponta** em ambiente local, com **uma** geração real controlada executada sob autorização humana, evidência técnica e financeira registradas, **produção intocada** e **nenhuma promoção**. O **UAT técnico** está **APROVADO**; a **qualidade criativa** não foi validada (fixtures artificiais) — a descoberta orienta a futura **F48.2.3 (Fidelidade experimental da bancada)**.

**Status da verificação:** `passed` (UAT técnico aprovado; exceção F50 externa registrada).

---

*Fase: 48.2.2-fundacao-bancada-geracao. OpenSpec ativo — aguardando verificação, sincronização e arquivamento manuais. Nenhuma promoção para produção.*
