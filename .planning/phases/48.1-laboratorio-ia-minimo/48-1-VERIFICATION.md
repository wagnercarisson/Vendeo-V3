# F48.1 Verification — Laboratório Mínimo de IA

**Status:** **PASSED** — UAT local aprovado (Passos 1–10 PASS), migration remota aplicada e verificada, 4 gates verdes, contract guard com 0 violações. Arquivamento OpenSpec **preparado e não executado**; deploy **não** executado (fora do escopo da fase).

**Goal:** Laboratório isolado e local-only que permite comparar duas variantes **prompt-only** de `campaign_image` com IA real, com snapshots imutáveis, artefatos próprios, custo auditável e avaliação humana append-only — sem tocar nenhuma superfície produtiva.

**Escopo de numeração:** F48.1 = primeira fatia do programa incremental F48.x. `model`/`configuration` (F48.2+) e F44/Stripe permanecem fora da numeração.

---

## Goal-Backward Matrix

Legenda: **A** = evidência automatizada (arquivo de teste/comando + resultado) · **H** = evidência humana (passo do UAT local).

| Capability / Requirement | Evidência automatizada (A) | A | Evidência humana (H) | H |
|---|---|---|---|---|
| `lab-isolation`: Guarda de ambiente fail-closed e local-only | `environment-guard.test.ts`, `lab-environment-guard.contract.test.ts` (matriz exaustiva dos 5 motivos); `48-local-uat-prep.mjs` recusou antes de escrever | PASS | UAT 1.1–1.3 (estado habilitado, sem `reason`) | PASS |
| `lab-isolation`: Isolamento absoluto da produção | `lab-isolation.contract.test.ts`; `48-1-13-contract-guard.mjs` (0 violações, base `75ab54cf…`) | PASS | UAT 9.1–9.3 (delta zero em §6) | PASS |
| `lab-isolation`: Guardas arquiteturais e testes de isolamento | `architecture-guard.test.ts`; guard script (forbidden tokens em `src/lib/lab/**` e `scripts/uat/48-*`) | PASS | n/a (estático) | — |
| `lab-isolation`: Segurança financeira | `lab-financial-safety.contract.test.ts` (reserva antes do gasto, `budget_exceeded` com **zero invocações**), `limits.test.ts` | PASS | UAT 4.1–4.3 e 5.1–5.5 (estimativa + `confirmed: true`) | PASS |
| `lab-isolation`: Ausência de secrets em persistência | Testes de snapshot/redação (D15); evidências sem chave/token | PASS | §5 — apenas IDs, hashes, custo, latência e erro sanitizado | PASS |
| `lab-scenarios`: Cenários controlados e versionados | `scenarios/schema.test.ts`, `scenarios/service.test.ts`, `lab-scenarios.contract.test.ts` | PASS | UAT 2.1–2.2 (3 cenários com versão + hash) | PASS |
| `lab-scenarios`: Corpus inicial representativo e extensível | `fixtures/lab/**` (3 cenários) + `scenarios/service.test.ts` (bootstrap idempotente) | PASS | UAT 2.2 (3/3 materializados; `created 0 / skipped 3`) | PASS |
| `lab-scenarios`: Cenários com imagens de produto controladas | `scenarios/mapper.test.ts` (hash canônico SHA-256, imagens controladas) | PASS | UAT 5.4 (mesmas imagens nas duas variantes) | PASS |
| `lab-experiments`: Experimento com baseline e candidata | `domain/experiment-service.test.ts`, `domain/lab-experiments.contract.test.ts` | PASS | UAT 3.9–3.12 (2 variantes, `ready`) | PASS |
| `lab-experiments`: Congela alvo/params; variantes congelam prompt | `domain/model-target.test.ts`, `domain/prompt-snapshot.test.ts` | PASS | UAT 3.5–3.6 e 3.11 (alvo/params idênticos) | PASS |
| `lab-experiments`: Dimensão única de prompt nesta fase | `domain/schemas.test.ts` (`unsupported_changed_dimension`) | PASS | UAT 3.4 (dimensão `prompt`, modelo não editável) | PASS |
| `lab-experiments`: Estados e transições do experimento | `domain/experiment-service.test.ts` (máquina de estados travada) | PASS | UAT 3.12 / 7 (v.2 → `evaluated`) | PASS |
| `lab-experiments`: Imutabilidade estrutural após o primeiro run | Migration `20260915000003` (trigger de congelamento) + contract tests | PASS | UAT 3 (configuração não editável após run) | PASS |
| `lab-experiments`: Limites de cenários, repetições e concorrência | `limits.test.ts` (`MAX_SCENARIOS_PER_EXPERIMENT=3`, `MAX_REPETITIONS=3`, `MAX_RUNS_PER_EXPERIMENT=12`, `MAX_CONCURRENT_LAB_RUNS=1`) | PASS | UAT 3.8 / 5.5 (1 run por vez) | PASS |
| `lab-runs`: Snapshot imutável por execução | `run-snapshot.test.ts`, `snapshot-fixtures.contract.test.ts` | PASS | UAT 5.3–5.4 (snapshot por run em §5.1) | PASS |
| `lab-runs`: Reserva atômica de execução | RPC `lab_reserve_run` + `run-service.test.ts` (11 códigos, índice único global de run ativo) | PASS | UAT 5.5 (`activeRuns=[]`) | PASS |
| `lab-runs`: Execução real e focada reutilizando o gateway | `run-execution.test.ts`, `gateway/runtime.test.ts` (exatamente 1 envelope/run) | PASS | UAT 5.1–5.4 (2 runs reais `succeeded`, `calls=1`) | PASS |
| `lab-runs`: Idempotência e histórico explícito de reexecução | `run-service.test.ts` (`operation_id`, `supersedes_run_id`) | PASS | n/a (não exercitado no UAT) | — |
| `lab-runs`: Estados e transições do run | `lab-runs.contract.test.ts` (terminal único, reconciliação de órfãos) | PASS | UAT 5.3–5.4 (`succeeded`) | PASS |
| `lab-runs`: Validação automática limitada ao técnico | `technical-validation.test.ts` (`sharp`; sem nota automática de qualidade) | PASS | UAT 6.5 (nenhuma nota/score automático) | PASS |
| `lab-runs`: Revisão produtiva não é redefinida | Guard de contrato (prompts oficiais e `campaign-image-reviewer` intactos) | PASS | UAT §6.4 (16/16 hashes idênticos) | PASS |
| `lab-gateway-harness`: Instância isolada com alvo fixo | `gateway/lab-model-resolver.test.ts`, `lab-gateway-harness.contract.test.ts` | PASS | UAT 3.5 (alvo do catálogo F47) | PASS |
| `lab-gateway-harness`: Override de prompt sem alterar prompts oficiais | `gateway/lab-prompt-loader.test.ts` | PASS | §6.4 (16/16 hashes de `prompts/*.md` idênticos) | PASS |
| `lab-gateway-harness`: Telemetria própria sem eventos produtivos | `lab-telemetry-sink.test.ts` | PASS | §6.1 (`generation_events=0`) | PASS |
| `lab-gateway-harness`: Fallback automático desabilitado no laboratório | `gateway/runtime.test.ts` (1 invoke; sem target/retry/fallback) | PASS | UAT 5.3–5.4 (`calls=1` em ambos) | PASS |
| `lab-gateway-harness`: Caminho real de geração reutilizado sem duplicação | Seam aditivo `buildDirectorPrompt` + harness tests | PASS | n/a (estático) | — |
| `lab-gateway-harness`: Compatibilidade com o catálogo da F47 | Allowlist read-only do catálogo + paridade | PASS | UAT 3.5 (alvo fixo `openai/gpt-5.5/responses`) | PASS |
| `lab-artifacts`: Bucket e paths próprios do laboratório | `lab-artifacts.contract.test.ts` (path próprio validado) | PASS | §6.3 (`lab-artifacts` com 3 objetos; `campaign-images` vazio) | PASS |
| `lab-artifacts`: Metadados e checksum do artefato | `artifact-service.test.ts` (SHA-256 + rollback sem órfão) | PASS | §5.1 (checksums dos artefatos) | PASS |
| `lab-artifacts`: Leitura por URL assinada | `artifact-service.test.ts` (3600 s) | PASS | UAT 6.3 (arte por URL assinada) | PASS |
| `lab-artifacts`: Retenção e cleanup | `48-cleanup-artifacts.mjs` + testes | PASS | UAT 8.1–8.2 (`eligible=0`, nenhum run ativo elegível) | PASS |
| `lab-admin-api`: Superfície de API administrativa protegida | `lab-admin-api.contract.test.ts`, `api/admin/laboratorio/__tests__/route.test.ts` (`apiHandler` + `requireAdmin` + `assertLabEnvironment`) | PASS | UAT 1.2 (superfície habilitada, autorizada) | PASS |
| `lab-admin-api`: Criação e leitura de experimentos | `experiments/[id]/__tests__/route.test.ts`, `experiment-queries.test.ts` | PASS | UAT 3.1–3.12 | PASS |
| `lab-admin-api`: Estimativa de custo antes da execução | `api/estimate.test.ts`, `domain/cost-coverage.test.ts` | PASS | UAT 4.1–4.3 (cobertura `partial` + aviso) | PASS |
| `lab-admin-api`: Execução de run com confirmação explícita | `runs/__tests__/route.test.ts` (422 sem `confirmed`), `run-execution.test.ts` (NDJSON) | PASS | UAT 5.1–5.2 (progresso NDJSON) | PASS |
| `lab-admin-api`: Detalhe do run e registro de avaliação | `runs/[id]/__tests__/route.test.ts`, `evaluations/__tests__/route.test.ts` | PASS | UAT 6.1–6.4 e 7.1–7.4 | PASS |
| `lab-admin-ui`: Entrada única e navegação interna | `lab-admin-ui.contract.test.tsx` | PASS | UAT 1.3 (um único link "Laboratório") | PASS |
| `lab-admin-ui`: Página inicial funcional | `lab-admin-ui.contract.test.tsx` | PASS | UAT 1.1–1.3 | PASS |
| `lab-admin-ui`: Estado de ambiente desabilitado | `disabled-notice.test.tsx` | PASS | UAT 1.2 (estado habilitado, sem recusa) | PASS |
| `lab-admin-ui`: Criação e detalhe de experimento | `experiment-form.test.tsx`, `run-execution-panel.test.tsx` | PASS | UAT 3.1–3.12, 4.1–4.3, 5.1–5.5 | PASS |
| `lab-admin-ui`: Conformidade com o design system | `lab-admin-ui.contract.test.tsx` | PASS | UAT 1.3 | PASS |
| `lab-human-evaluation`: Comparação lado a lado | `comparison-view.test.tsx` (modo cego, sem score automático) | PASS | UAT 6.1–6.5 | PASS |
| `lab-human-evaluation`: Registro da avaliação humana | `evaluation-form.test.tsx`, `api/evaluation-service.test.ts` | PASS | UAT 7.1–7.2 (verdict + observação + `blind_order`) | PASS |
| `lab-human-evaluation`: Avaliação append-only e validada | Migration `20260915000003` (trigger anti-UPDATE/DELETE) + testes | PASS | UAT 7.3–7.4 (**3 registros** preservados) | PASS |

**Resumo:** 9/9 capabilities cobertas; todos os requirements com evidência automatizada **PASS**; validação humana **PASS** onde aplicável (4 requirements marcados `n/a` são estáticos ou não exercitados no roteiro — idempotência de reexecução, guardas arquiteturais, reutilização do caminho real e ausência de secrets não têm passo humano dedicado).

---

## Critérios da proposta (item 14.6) — um a um

| # | Critério | Resultado | Evidência |
|---|---|---|---|
| 1 | Abrir `/admin/laboratorio` | **CONFIRMADO** | UAT 1.1–1.3; `GET /admin/laboratorio` → 200; guarda `ok` |
| 2 | Selecionar cenário | **CONFIRMADO** | UAT 2.1–2.2; 3 cenários somente leitura com versão + hash |
| 3 | Configurar baseline/candidata prompt-only | **CONFIRMADO** | UAT 3.9–3.11; `changed_dimension='prompt'`; `unsupported_changed_dimension` rejeita modelo/configuração |
| 4 | Executar gerações isoladas | **CONFIRMADO** | UAT 5.1–5.5; 2 runs `succeeded` (`4f632754…`, `e5fc68c7…`), `calls=1`, escritas só em `lab_*`/`lab-artifacts` |
| 5 | Comparar lado a lado | **CONFIRMADO** | UAT 6.1–6.5; arte por URL assinada + evidência técnica; sem nota automática |
| 6 | Registrar avaliação com runs comparados | **CONFIRMADO** | UAT 7.1–7.4; 3 registros com `baseline_run_id`/`candidate_run_id`; o mais recente com `blind_order=candidate_left` |
| 7 | Consultar prompt/modelo/params/custo/latência/erros | **CONFIRMADO** | §5.1/§5.2; snapshots com hash/origem do prompt, alvo, params, custo + cobertura, latência, validação técnica e erro sanitizado |
| 8 | Nenhum dado produtivo alterado | **CONFIRMADO** | §6.1–6.4; delta zero em 6 contagens, `credit_balances` vazio, `campaign-images` vazio, 16/16 hashes de prompts idênticos |
| 9 | Testes sem chamadas pagas | **CONFIRMADO** | 4 gates sem rede a provider; seams mockados; `lab-financial-safety.contract.test.ts` asserta **zero invocações** nos caminhos de recusa; nenhuma chave real usada em teste |
| 10 | 4 gates verdes | **CONFIRMADO** | vitest 333/3588+1 skipped; typecheck 0; lint 0; build 0 (números reais abaixo) |
| 11 | Fluxo completo em Docker local | **CONFIRMADO** | Supabase local (`127.0.0.1`), `48-local-uat-prep.mjs` exit 0, `VENDEO_LAB_ENABLED=true`, UAT completo Passos 1–10 |
| 12 | Pontos de extensão F48.2+ preservados (sem implementá-los) | **CONFIRMADO** | `changed_dimension` aceita **somente** `prompt`; mensagem explícita `unsupported_changed_dimension: … modelo e configuração ficam para a F48.2`; `model_target`/`params` são do experimento (não editáveis por variante) |

**12/12 critérios CONFIRMADOS.**

---

## Gates (números reais, 2026-09-17)

| Gate | Comando | Resultado |
|---|---|---|
| Testes (regressão completa) | `npx vitest run` | ✅ **333 arquivos / 3588 passed + 1 skipped** (exit 0) |
| Escopo do laboratório | `npx vitest run src/lib/lab "src/app/api/admin/laboratorio" "src/app/(app)/admin/laboratorio"` | ✅ **42 arquivos / 750 passed + 1 skipped** (exit 0) |
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Build | `npm run build` | ✅ exit 0 |
| Contract guard F48.1 | `node scripts/verify/48-1-13-contract-guard.mjs` | ✅ **PASS — 0 violações** (base `75ab54cf23eee1a6a31b500a5a2646398aada6eb`) |
| Prep local | `node scripts/uat/48-local-uat-prep.mjs` | ✅ exit 0 (host `127.0.0.1`, guarda `ok`, 3 cenários, `writes.paidCalls: 0`) |
| Cleanup (dry-run) | `node scripts/lab/48-cleanup-artifacts.mjs --dry-run` | ✅ `eligible=0`, `invalid=0`, `removed=0`, `skipped=0` |
| UAT local | roteiro `48.1-UAT.md` | ✅ **Passos 1–10 PASS — APPROVED** (aprovador: Wagner, 2026-09-17) |
| Migration remota | `npx supabase db push --dry-run` → `db push` | ✅ dry-run listou **apenas** as 2 migrations `f48_1`; push aplicado no projeto `gvbzwihwgzujwsviufgy` |
| Schema remoto | `db dump --linked` + `db diff --linked` | ✅ 8 tabelas com RLS; **0** grants a `anon`/`authenticated`; bucket `lab-artifacts` `public=false`; RPCs `SECURITY DEFINER` + `search_path=''`; 8 funções `trg_lab_*_fn`; **0 divergências de schema em `lab_*`** |
| Superfície em produção | `vercel env ls production` | ✅ `VENDEO_LAB_ENABLED` / `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS` **ausentes** (0 de 25 vars) |

---

## Release Controls

- **`authorize remote migration`** concedida explicitamente em 2026-09-17; `db push` executado **depois** do dry-run limpo. O dry-run foi gate obrigatório (T-48-1-109).
- **Deploy NÃO executado** — fora do escopo da fase. A superfície do laboratório é inerte em produção pela ausência de `VENDEO_LAB_ENABLED` (T-48-1-110).
- **Orçamento do UAT:** 4 runs / **`0.458826` USD** (2 runs da UAT final + 2 da tentativa diagnóstica pré-fix), cobertura `partial`; nenhum crédito de loja consumido.
- **Desvios:** D-01 **resolvido** (reteste sem custo confirmou `blind_order=candidate_left`); D-02 **resolvido** (fix `7d6c2f03`, sessão de debug arquivada); D-03 e D-04 residuais documentados e **não-bloqueantes**; D-05 (drift pré-existente de `idempotency_keys`/`pg_net`) **fora do escopo**, não agravado pela F48.1.
- **Histórico preservado:** entradas de F46/F47 mantidas integralmente nos trackings; nenhuma reescrita.
- **Arquivamento OpenSpec:** `openspec/changes/fase-48-1-laboratorio-ia-minimo/` permanece **no lugar** — arquivamento apenas **preparado**, não executado.
- **Verificação final:** **passed** (UAT local aprovado + migration remota confirmada + 4 gates verdes + contract guard 0 violações).
