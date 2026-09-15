# Tasks — Fase 48.1: Laboratório Mínimo de IA

> Divide a implementação em **plans pequenos (48-01..48-14)** por ondas, com dependências explícitas. Executar somente após aprovação dos artefatos. Specs: `specs/lab-isolation`, `specs/lab-scenarios`, `specs/lab-experiments`, `specs/lab-runs`, `specs/lab-gateway-harness`, `specs/lab-artifacts`, `specs/lab-admin-api`, `specs/lab-admin-ui`, `specs/lab-human-evaluation`. Design: `design.md`.
>
> **Ordem de migration (D16):** criar e testar a migration **localmente** (48-01) → implementar e rodar **UAT local** (48-02..48-13) → **após a UAT, aplicar a migration deliberadamente no remoto** (48-14) para **não deixar migration pendente** que um `supabase db push` de outra fase arrastaria. O schema remoto fica **inerte** e `VENDEO_LAB_ENABLED=false` em produção.
>
> **Regra de isolamento (D2/D6/D15):** nenhuma task pode tocar `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `ai_model_catalog`, `admin_audit_log`, `prompts/` oficiais ou o bucket `campaign-images`. Nenhum secret em banco/log/snapshot. Nenhuma chamada paga em testes/CI.
>
> **Dependências entre plans:** 48-01 ← 48-02,48-03,48-04; 48-03,48-04 ← 48-05; 48-05 ← 48-07; 48-06 ← 48-07; 48-07 ← 48-08; 48-08 ← 48-09,48-10; 48-11,48-12 ← implementação correspondente; 48-13 ← 48-08..48-12; 48-14 ← 48-13.

## 1. Plan 48-01 — Trackings e migration local (onda 1)

- [ ] 1.1 Registrar F48.1 nos runbooks de trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `AGENTS.md`); grep-verificação de nomenclatura (F48.1 = Laboratório Mínimo de IA; F48.2+ diferidas; Stripe fora da numeração) com zero resíduos
- [ ] 1.2 Criar migration **local** com as tabelas `lab_scenarios` e `lab_scenario_versions` (conteúdo imutável + `content_hash` + `fixture_path`; `UNIQUE(scenario_id, version)`; RLS service_role) — design D3/D4
- [ ] 1.3 Criar migration **local** com `lab_experiments` (dimensão fixa `prompt`, `model_target` e `params` **no experimento**, status, `repetitions`, `max_runs`, autoria) e `lab_experiment_variants` (role baseline/candidate, `prompt_snapshot`; `UNIQUE(experiment_id, role)`) — design D3/D5
- [ ] 1.4 Criar migration **local** com `lab_experiment_scenarios` (junção ordenada) — design D3
- [ ] 1.5 Criar migration **local** com `lab_runs` (snapshot, status, `operation_id` único, `supersedes_run_id`, `run_sequence`, latência/usage/custo/`cost_detail`/erro/validação/`calls`; `UNIQUE(experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence)` + **índice único parcial** `uq_lab_runs_one_active_per_experiment (experiment_id) WHERE status IN ('pending','running')`) — design D3/D8/D14
- [ ] 1.6 Criar migration **local** com `lab_artifacts` (path, MIME, dimensões, bytes, checksum, `removed_at`) e `lab_human_evaluations` (verdict, `baseline_run_id`, `candidate_run_id`, `blind_order`, observação, avaliador, append-only) — design D3/D10/D13
- [ ] 1.7 Criar bucket privado `lab-artifacts` (sem acesso público; policies somente `service_role`; **sem** policies para `authenticated`/`anon`) e `REVOKE`/`GRANT` das tabelas `lab_*` — design D10
- [ ] 1.8 Adicionar trigger que impede UPDATE das colunas de snapshot em `lab_runs` e do conteúdo em `lab_scenario_versions`; para `lab_experiment_variants`/`model_target`/`params`, bloquear UPDATE **somente quando o experimento já tiver run** (configuração editável em `draft`/`ready`); e trigger que impede `UPDATE`/`DELETE` em `lab_human_evaluations` (append-only) — design D3/D5/D8/D13
- [ ] 1.9 Criar RPC `lab_reserve_run` (SECURITY DEFINER, `search_path=''`): lock `FOR UPDATE` no experimento **antes** das checagens; idempotência por `operation_id` **após o lock** e **vinculada ao payload** (`idempotency_conflict` se divergir); prontidão `ready|running|evaluated`; valida relações (variante/cenário no experimento, `repetition_index` no limite, `supersedes_run_id` da **mesma combinação, incluindo `repetition_index`, e em estado terminal**); conta budget; recusa run ativo (`run_already_active`); **deriva `run_sequence` no banco**; insere run `pending` **com `p_snapshot` completo** (`missing_snapshot` se vazio); trata `unique_violation` de `operation_id` como idempotente; promove `ready|evaluated→running`; `REVOKE`/`GRANT` service_role — design D14
- [ ] 1.10 Escrever bloco REVERT (drop bucket → drop funções → drop tabelas) e testar a migration **localmente** (`npx supabase db reset` + `db lint`): reaplicação idempotente, RLS/grants, trigger de imutabilidade, reserva atômica rejeita concorrência — **não aplicar no remoto nesta task**

## 2. Plan 48-02 — Isolamento e segurança (onda 1, depende de 48-01)

- [ ] 2.1 Criar `src/lib/lab/environment-guard.ts` com `getLabEnvironment()` e `assertLabEnvironment()` (flag `VENDEO_LAB_ENABLED`, host local, allowlist `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS`, bloqueio de hosts de produção, fail-closed) + `LabEnvironmentError` — design D2
- [ ] 2.2 Aplicar a guarda no início de toda página e rota do laboratório (page renderiza estado desabilitado com `reason`; rota retorna 403 com `{ error, reason }`) — design D2/D12
- [ ] 2.3 Definir constantes de limite do domínio (`MAX_SCENARIOS_PER_EXPERIMENT=3`, `MAX_REPETITIONS=3`, `MAX_RUNS_PER_EXPERIMENT=12`, `MAX_CONCURRENT_LAB_RUNS=1`, `LAB_RUN_STALE_MS`, `LAB_ARTIFACT_RETENTION_DAYS=30`) — design D14
- [ ] 2.4 Adicionar `VENDEO_LAB_ENABLED` (default `false`) e `VENDEO_LAB_ALLOWED_SUPABASE_HOSTS` ao `.env.example` e documentar a recomendação de chave/projeto de desenvolvimento dos providers, sem criar mecanismo novo de chave — design D15
- [ ] 2.5 Estender `src/lib/ai/__tests__/architecture-guard.test.ts` para cobrir o laboratório (sem SDK/wire fora dos adapters; sem `AiCostTracker.record`; sem leitura de env-var de modelo) e permitir explicitamente o `LabTelemetrySink` onde necessário — design D6/D15
- [ ] 2.6 Testes do guard: flag off, URL ausente/inválida, host local ok, host remoto/produção recusa, allowlist respeitada; teste de sanitização de erro sem vazar chave

## 3. Plan 48-03 — Cenários controlados (onda 2, depende de 48-01/48-02)

- [ ] 3.1 Criar `src/lib/lab/scenarios/schema.ts` com Zod `LabScenarioContent` (`brief`, `store`, `identity`, `images[]`, `intent`, `format`, `locale`, `mediaKinds`) e `unsupported_scenario_mode` para valores fora de `offer`/`1:1`/`pt-BR` — design D4
- [ ] 3.2 Criar fixtures em `fixtures/lab/scenarios/<slug>/` com 3 cenários de oferta (`produto-oferta-preco`, `produto-oferta-texto-obrigatorio`, `produto-oferta-badge`) e imagens de produto controladas; dados fictícios — design D4
- [ ] 3.3 Criar `src/lib/lab/scenarios/service.ts` (carregar/listar versões; calcular `content_hash` SHA-256 do JSON canônico; bootstrap idempotente `scripts/uat/48-local-scenarios.mjs`) — design D4
- [ ] 3.4 Mapear `LabScenarioContent` → `CampaignBrief` + `ResolvedCampaignContext` fictício (loja/identidade) e resolver os data URLs das imagens controladas server-side — design D4/D7
- [ ] 3.5 Testes: hash determinístico, reaplicação idempotente, modalidade não suportada rejeitada, imagem ausente rejeitada, mapeamento para brief/contexto correto

## 4. Plan 48-04 — Domínio de experimentos (onda 2, depende de 48-01/48-02)

- [ ] 4.1 Criar `src/lib/lab/domain/schemas.ts` (Zod) para criação de experimento/variante/cenários e para avaliação; validar dimensão (**somente `prompt`**), repetições, teto, alvo fixo e runs comparados — design D5/D13
- [ ] 4.2 Criar `src/lib/lab/domain/experiment-service.ts`: criação com exatamente duas variantes, transições de estado (`draft→ready→running⇄evaluated→archived`, incluindo `evaluated→running` em novo run) e congelamento no primeiro run — design D5
- [ ] 4.3 Rejeitar dimensões `model`/`configuration` com erro explícito (F48.2) e garantir alvo de modelo + params **fixos e idênticos** entre as variantes — design D5
- [ ] 4.4 Validar o alvo de modelo contra o catálogo (linha ativa de `campaign_image`, somente leitura) e snapshots de prompt (baseline `official` do arquivo atual; candidata `override`) — design D5/D6
- [ ] 4.5 Testes: criação válida/inválida, dimensão `model`/`configuration` rejeitada, transições proibidas, edição permitida em `draft`/`ready` e congelada após o primeiro run, alvo fora do catálogo rejeitado, baseline usa prompt oficial

## 5. Plan 48-05 — Integração com gateway (onda 3, depende de 48-03/48-04)

- [ ] 5.1 Expor seam aditivo `buildDirectorPrompt(brief, context)` em `ImageGenerationService` reutilizando `buildPromptVariables` + `assemblePrompt` (**sem mudança de comportamento**) — design D7
- [ ] 5.2 Criar `src/lib/lab/gateway/lab-model-resolver.ts` (`AiModelResolver` com **alvo fixo do experimento** para `campaign_image`; delega ao `defaultAiModelResolver` fora do escopo) — design D6
- [ ] 5.3 Criar `src/lib/lab/gateway/lab-prompt-loader.ts` (`extends PromptLoader`; serve override do snapshot; delega ao loader real) — design D6
- [ ] 5.4 Criar `src/lib/ai/lab-telemetry-sink.ts` (sink capturador: `resolveAiCost` em leitura + acumulação de envelopes sanitizados com **`CostResolution` completa** e flag de parcial; **sem** `AiCostTracker.record`/`generation_events`) — design D6/D8
- [ ] 5.5 Criar `src/lib/lab/gateway/runtime.ts` compondo `AiGateway(labResolver, defaultAdapterRegistry)` + contexto de telemetria e **invocando `campaign_image` direto no gateway** (sem `OpenAIImageProvider`/fallback automático) — design D6/D7
- [ ] 5.6 Testes: alvo fixo tem precedência; capacidades auxiliares delegam ao resolver padrão; override de prompt não altera arquivo oficial; sink não grava `generation_events`; **fallback desabilitado = um único envelope**; pipeline de produção inalterado

## 6. Plan 48-06 — Persistência de artefatos (onda 4, depende de 48-01/48-02)

- [ ] 6.1 Criar `src/lib/lab/persistence/artifact-service.ts` (upload para `lab-artifacts`, path `experiments/{experimentId}/runs/{runId}/output.{ext}`, metadados + checksum, rollback do objeto em falha de insert) — design D10
- [ ] 6.2 Implementar geração de URL assinada server-side (3600s) para leitura na comparação — design D10
- [ ] 6.3 Criar `scripts/lab/48-cleanup-artifacts.mjs` (cleanup manual por idade/arquivamento; nunca limpa run em andamento) — design D10
- [ ] 6.4 Testes: path/bucket corretos, metadados/checksum, rollback sem órfão, URL assinada, cleanup elegível e proteção de run em andamento

## 7. Plan 48-07 — Execução e snapshots imutáveis (onda 4, depende de 48-03/48-04/48-05/48-06)

- [ ] 7.1 Criar `src/lib/lab/technical-validation.ts` com `sharp` (decodificação, MIME real, dimensões, proporção, bytes, imagem vazia/corrompida/uniforme; campos reservados `structuredOutputValid`/`ocrAlert = null`) — design D9
- [ ] 7.2 Criar `src/lib/lab/run-service.ts`: **montar o snapshot completo antes da reserva**, chamar `lab_reserve_run` (`p_snapshot`), transicionar `running → succeeded|failed|cancelled|timeout` em `finally`, persistir latência/usage/custo/erro sanitizado/`calls`/validação — design D7/D8/D9
- [ ] 7.3 Implementar idempotência por `operation_id` e reexecução explícita (`supersedes_run_id` validado; `run_sequence` **derivado no banco**), com constraint única — design D8
- [ ] 7.4 Implementar a reserva atômica via RPC `lab_reserve_run` antes de qualquer chamada paga (mapear `budget_exceeded`/`run_already_active`/`missing_snapshot`/relações inválidas) e reconciliação preguiçosa de run órfão cobrindo **`pending` e `running`** (`LAB_RUN_STALE_MS`) — design D14
- [ ] 7.5 Testes: snapshot imutável e nunca vazio, relações inválidas recusadas, `run_sequence` derivado, idempotência concorrente, reexecução preserva histórico, budget/concorrência, transição terminal em falha, validação técnica (válida/corrompida/uniforme), run órfão `pending`/`running` marcado

## 8. Plan 48-08 — API administrativa (onda 5, depende de 48-07)

- [ ] 8.1 Adicionar schemas do laboratório em `src/lib/admin/schemas.ts` (criação de experimento prompt-only, execução de run com `confirmed`/`operationId`, avaliação com `baseline_run_id`/`candidate_run_id`/ordem cega) — design D11
- [ ] 8.2 Criar rotas `GET /api/admin/laboratorio/scenarios` e `GET/POST /api/admin/laboratorio/experiments` (`apiHandler` + `requireAdmin` + `assertLabEnvironment`) — design D11
- [ ] 8.3 Criar `GET /api/admin/laboratorio/experiments/[id]` (variantes, runs, avaliações, budget restante) e `GET /api/admin/laboratorio/runs/[id]` (detalhe + URLs assinadas) — design D11
- [ ] 8.4 Criar `GET /api/admin/laboratorio/experiments/[id]/estimate` (estimativa por componente, com cobertura `complete|partial|missing`) — design D11
- [ ] 8.5 Criar `POST /api/admin/laboratorio/experiments/[id]/runs` com NDJSON streaming, confirmação explícita (`422 confirmation_required`) e mapeamento de erros (`budget_exceeded`, `experiment_not_ready`, `environment_blocked`, `unsupported_scenario_mode`, …) — design D11
- [ ] 8.6 Criar `POST /api/admin/laboratorio/experiments/[id]/evaluations` (exige os runs comparados e valida que pertencem ao mesmo experimento/cenário e aos papéis baseline/candidate) — design D11/D13
- [ ] 8.7 Testes de rota: 403 não-admin, 403 ambiente bloqueado, 400 payload inválido, criação/detalhe, estimativa, execução sem confirmação, budget, `run_already_active`, `idempotency_conflict`, `missing_snapshot`, idempotência, avaliação com runs comparados e recusa de runs de experimento/cenário/papel divergentes

## 9. Plan 48-09 — UI do laboratório (onda 6, depende de 48-08)

- [ ] 9.1 Criar `src/app/(app)/admin/laboratorio/layout.tsx` (guarda de ambiente + sub-navegação interna) e adicionar **um único** link “Laboratório” em `src/app/(app)/admin/layout.tsx` — design D1/D12
- [ ] 9.2 Criar `page.tsx` inicial (experimentos recentes + avaliações pendentes + estado vazio + estado desabilitado) — design D12
- [ ] 9.3 Criar `experimentos/novo/page.tsx` + form (nome, objetivo, hipótese, dimensão fixa `prompt`, cenário(s), baseline, candidata, repetições, teto; modelo fixo não editável por variante) — design D12
- [ ] 9.4 Criar `experimentos/[id]/page.tsx` (variantes, runs, budget restante, “Executar run” com estimativa + confirmação + progresso NDJSON) — design D11/D12
- [ ] 9.5 Criar `cenarios/page.tsx` (lista somente leitura) — design D12
- [ ] 9.6 Seguir `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis/light mode) e usar `src/components/ui/` — design D12
- [ ] 9.7 Testes de componente/página: guarda desabilitada, estado vazio, criação prompt-only, modelo fixo não editável, confirmação de execução, budget visível

## 10. Plan 48-10 — Comparação e avaliação humana (onda 6, depende de 48-08)

- [ ] 10.1 Criar `experimentos/[id]/comparar/page.tsx` com comparação lado a lado (arte, cenário, status técnico, custo, latência, erros/alertas, repetições) e modo de escolha cega (ocultar modelo/prompt) — design D13
- [ ] 10.2 Criar form de avaliação (baseline/candidata/empate/nenhuma + observação) com avaliador, timestamp, `baseline_run_id`/`candidate_run_id` e ordem cega; exibir avaliação mais recente e permitir reavaliar — design D13
- [ ] 10.3 Garantir ausência de nota automática de qualidade (nenhum score estético/comercial/publicável na UI) — design D9/D13
- [ ] 10.4 Testes de componente: renderização lado a lado, modo cego, repetições, registro de verdict, reavaliação preserva histórico, ausência de nota automática

## 11. Plan 48-11 — Testes 1: domínio, guardas, isolamento e cenários (onda 7)

- [ ] 11.1 Testes de guarda de ambiente e constantes de limite (cobertura de todos os `reason` e fail-closed)
- [ ] 11.2 Testes de isolamento: run com fakes não toca tabelas produtivas, não consome créditos, não grava `generation_events`/`ai_model_selection`/`campaign-images`
- [ ] 11.3 Testes de cenários (schema, hash, idempotência, modalidade não suportada, imagens controladas)
- [ ] 11.4 Testes de domínio de experimento (variantes, transições, congelamento, uma dimensão, alvos no catálogo)
- [ ] 11.5 Testes de segurança financeira (confirmação obrigatória, budget, concorrência, sem chamadas reais)
- [ ] 11.6 Garantir que todos os testes usam fakes (`AiInvoker`/`LabTelemetrySink`) e não dependem de imagens geradas

## 12. Plan 48-12 — Testes 2: harness, execução, artefatos, API, UI e avaliação (onda 7)

- [ ] 12.1 Testes do harness (precedência do alvo, delegação, override de prompt, sink sem `generation_events`, pipeline de produção inalterado)
- [ ] 12.2 Testes de execução/snapshot (imutabilidade, transição terminal, idempotência, reexecução, órfão, validação técnica)
- [ ] 12.3 Testes de artefatos (bucket/path, metadados, rollback, URL assinada, cleanup)
- [ ] 12.4 Testes de API (403/400/409/422, criação, estimativa, execução, avaliação)
- [ ] 12.5 Testes de UI (página inicial, criação, alerta, confirmação, comparação, avaliação)
- [ ] 12.6 Testes de snapshots como futura fixture determinística (extração de caso sem chamada paga)

## 13. Plan 48-13 — Regressão e co-migração (onda 8, depende de 48-08..48-12)

- [ ] 13.1 Rodar a suíte completa (`npx vitest run`) e corrigir resíduos; confirmar que nenhum teste existente de F46/F47 quebrou
- [ ] 13.2 Rodar `npm run typecheck`, `npm run lint` e `npm run build`; corrigir resíduos
- [ ] 13.3 Verificar não-mudança de contrato externo por `git diff`: UI/form do lojista, schema público, snapshot/domínio, `prompts/` oficiais, `src/lib/ai/gateway.ts`, `ai_model_catalog`/`ai_model_selection` intactos
- [ ] 13.4 Verificar que `generation_events` e `campaign-images` não receberam nenhuma referência nova do laboratório
- [ ] 13.5 Co-migrar fixtures/testes irmãos afetados pelo seam aditivo de `ImageGenerationService`

## 14. Plan 48-14 — UAT local com IA real e verificação final (onda 9, depende de 48-13)

- [ ] 14.1 Preparar ambiente local (Next.js local + Supabase Docker + bucket + cenários bootstrap) com **chave/projeto de desenvolvimento** dos providers; documentar o orçamento de UAT
- [ ] 14.2 Executar o **experimento inicial obrigatório**: cenário controlado de produto/oferta, prompt atual como baseline, pequena alteração candidata no prompt, **mesmo modelo/parâmetros/imagens**, ≥1 geração por variante, comparação lado a lado, voto humano, custo/latência registrados
- [ ] 14.3 Confirmar que a produção permaneceu inalterada (nenhuma campanha/crédito/seleção/catálogo/prompt/`generation_events`/`campaign-images` alterados)
- [ ] 14.4 **Aplicar a migration deliberadamente no remoto** (`npx supabase db push` com `--dry-run` antes), mantendo tabelas/bucket **inertes** e `VENDEO_LAB_ENABLED=false` em produção — evita migration pendente
- [ ] 14.5 Gerar `48-VERIFICATION.md` (goal-backward) e `48-UAT.md` (roteiro humano, orçamento, resultados)
- [ ] 14.6 Confirmar os critérios da proposta (abrir `/admin/laboratorio`, selecionar cenário, configurar baseline/candidata prompt-only, executar gerações isoladas, comparar lado a lado, registrar avaliação com runs comparados, consultar prompt/modelo/params/custo/latência/erros, nenhum dado produtivo alterado, testes sem chamadas pagas, 4 gates verdes, fluxo completo em Docker local, pontos de extensão F48.2+)
- [ ] 14.7 Atualizar registros (AGENTS.md/STATE/ROADMAP) e preparar arquivamento após aprovação
