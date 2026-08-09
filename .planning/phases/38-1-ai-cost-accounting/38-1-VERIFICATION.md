# Phase 38.1 — Verificação I1–I6 + Gates (Plano 38-1-10)

**Gerado em:** 2026-08-09
**Execução:** Task 1 (I1–I6, seção 7.1) + Task 2 (gates automáticos, seção 7.2)
**Status Task 3 (UAT manual 7.3):** pendente — checkpoint humano

---

## 7.1 — Verificações I1–I6

Método: script `scripts/verify/38-1-ai-cost-verification.mjs` (padrão F38-08), executado contra o
banco remoto `gvbzwihwgzujwsviufgy` via service_role + RPCs definer. Resultado: **31/31 asserts verdes**.

### I1 — Migration em banco real (colunas + CHECKs + índices)

| Comando/Query | Resultado |
|---|---|
| `supabase migration list` | `20260808000001` presente em **Local e Remote** ✅ |
| `select(operation_run_id, operation_run_type, visual_signature_id, theme_id, cached_input_tokens, image_tokens, provider_reported_cost_usd, cost_source, pricing_version)` em `generation_events` (limit 1) | Sem erro — as **9 colunas D2** existem e são selecionáveis ✅ |
| `select(operation_run_id)` em `campaigns` | Sem erro — `campaigns.operation_run_id` presente ✅ |
| INSERT com `cost_source = 'invalid_source_value'` | Erro `23514` — `chk_generation_events_cost_source` ativo ✅ |
| INSERT com `generation_type = 'bogus_type'` | Erro `23514` — `chk_generation_events_type` expandido (D5) ativo ✅ |
| INSERT duplicado de linha vigente `(openai, gpt-4o)` em `ai_model_pricing` | Erro `23505` — `uq_ai_model_pricing_vigente` (índice parcial único) ativo ✅ |

> Índices não-únicos (`idx_generation_events_*`, `idx_campaigns_operation_run_id`): confirmados pela
> aplicação da migration (migration list) — o push de 38-1-01 foi transacional (2 falhas reverteram 100%).

### I2 — RPC `admin_set_ai_model_price` versiona (D8)

| Comando/Query | Resultado |
|---|---|
| `rpc(admin_set_ai_model_price, {p_reason: ''})` — reason vazio | Erro `ai_model_price_reason_required` (validação antes dos opcionais) ✅ |
| 1ª chamada válida (modelo de teste) | Retorna JSONB `{id, provider, model, effective_from, previous_id: null}` ✅ |
| 2ª chamada válida (mesmo modelo, preço novo) | Retorna novo `id`, `previous_id = id da 1ª` ✅ |
| SELECT linhas do modelo de teste | **2 linhas**: 1ª `effective_until NOT NULL` (fechada) + 2ª `effective_until NULL` (vigente) ✅ |
| Verificação de transação | 2ª linha com os preços novos (1.5/2.5) — fechou + abriu **na mesma transação** ✅ |
| Cleanup | Linhas de teste deletadas via DELETE service_role (grant D8) ✅ |

### I3 — RLS: `ai_model_pricing` sem acesso para não-admin

| Comando/Query | Resultado |
|---|---|
| SELECT com **anon key** | Erro `permission denied for table ai_model_pricing` ✅ |
| Usuário **authenticated** temporário (criado via admin, sign-in com senha) → SELECT | Erro `permission denied for table ai_model_pricing` ✅ |
| Cleanup | Usuário temporário deletado via `auth.admin.deleteUser` ✅ |

### I4 — Seeds reais + resolveAiCost → pricing_table

| Comando/Query | Resultado |
|---|---|
| SELECT seed `gemini-3.1-flash-lite` vigente | `input 0.1 / output 0.4`, `effective_until NULL`, `source_url` preenchido ✅ |
| SELECT seed `gpt-image-2` vigente | `image_unit_usd 0.04`, **input/output NULL** (só imagem — nunca soma com tokens) ✅ |
| Unit tests `cost-estimator.test.ts` (cenários 6.1, incl. #3 gemini→pricing_table com uuid, #4 gpt-image-2→image_unit) | **16/16 passed** ✅ |

### I5 — Views/RPC somam SÓ call-level (anti-dupla-contagem D1/D6)

Setup: 1 `operation_run_id` com 2 eventos call-level (copy + image, com custo) + 1 delivery marker
(`campaign_pipeline`, custo NULL), inseridos na store de teste.

| Comando/Query | Resultado |
|---|---|
| `rpc(admin_get_ai_costs, {p_operation_run_id})` | Responde com `by_operation_run` para o run ✅ |
| `by_operation_run.chamadas` | **2** (delivery marker EXCLUÍDO — anti-dupla-contagem) ✅ |
| `by_operation_run.custo_usd_total` | **0.04018** = 0.00018 (copy) + 0.04 (image) — delivery NULL não soma ✅ |
| `by_generation_type` | Só etapas call-level, **sem `campaign_pipeline`** ✅ |
| Cleanup | Eventos neutralizados (`operation_run_id → null`) — service_role não tem DELETE em generation_events (append-only F28) ✅ |

### I6 — `admin_get_metrics` sem regressão (F28)

| Comando/Query | Resultado |
|---|---|
| `rpc(admin_get_metrics, {p_store_kind:'production', p_hours:24, p_metric_type:'all'})` | Responde JSONB com `pipeline`/`vs`/`wallet` ✅ |

---

## ⚠️ Incidente de limpeza (Rule 1 — auto-corrigido/documentado)

**Contexto:** após o I5, a limpeza dos eventos de teste foi tentada via script temporário de cleanup
(NÃO commitado) usando a Management API com um DELETE que tinha **bug de precedência de operadores SQL**
(`OR` sem parênteses — o segundo ramo do predicado perdeu os filtros de `store_id`/`created_at`).

**Dano:** o DELETE removeu **56 linhas históricas reais** `campaign_copy` (eras F25/F28, 2026-07-20 →
2026-08-07) além das 6 linhas de teste. Total do banco: 180 → 118.

**Análise de impacto (verificada no banco):**
- **Dados de negócio intactos:** campaigns 86, stores 10, credit_transactions 104, ai_model_pricing 7, store_visual_signatures 7 ✅
- **Custo apurado: ZERO impacto** — todas as 56 linhas deletadas tinham `estimated_cost_usd IS NULL` (pré-38.1, sem custo) e `operation_run_id IS NULL` (fora das views de apuração que filtram call-level com run/custo)
- **`admin_get_metrics`: ZERO regressão** — o RPC F28 usa `campaign_pipeline`/`visual_signature`, não `campaign_copy`
- **Views 38.1: ZERO impacto** — filtram `operation_run_id IS NOT NULL` + call-level com custo
- **Recuperação:** PITR desabilitado, backups API vazios, restore exige estado paused → **sem restauração possível via API**

**Fix aplicado:** o script oficial commitado (`38-1-ai-cost-verification.mjs`) usa **UPDATE de
neutralização** (`operation_run_id → null`, custo → null) em vez de DELETE — não destrutivo, nunca toca
linhas fora do escopo (filtra por `metadata->>verification`). Nenhum script destrutivo foi commitado.

**Estado pós-limpeza:** 118 eventos (56 image + 57 pipeline + 5 VS), zero markers de verificação restantes,
zero eventos de teste recentes na store de teste. A limpeza segura (com parênteses) removeu os 3 eventos
de teste da re-execução do script — **apenas os marcados**, sem tocar em dados reais.
**Ação pendente:** avaliar com o usuário se a perda das 56 linhas de telemetria `campaign_copy` (sem custo,
sem operação) é aceitável; recomenda-se aceitar (dado de telemetria histórica sem valor contábil).

---

## 7.2 — Gates automáticos

### Gate 1 — `npx vitest run`

```
Test Files  199 passed (199)
      Tests  1700 passed (1700)
```

**Resultado: ✅ 1700/1700 testes, 0 falhas, 199 arquivos.** Sem regressões nas suítes de
pipeline (402/409/estorno), VS F29.1.1, gates F32/F33/F34/F36, legal F30, créditos F24/F38.

### Gate 2 — `npm run typecheck` (`npx tsc -p tsconfig.typecheck.json --noEmit`)

**Resultado: ✅ limpo** — nenhum erro de tipo.

### Gate 3 — `npm run lint` (`npx eslint .`)

**Resultado: ✅ limpo** — 0 erros, 0 warnings (após remover variável não usada no script de verificação).

### Gate 4 — `npm run build` (`npx next build`)

**Resultado: ✅ `✓ Compiled successfully in 8.4s`** — build completo, exit 0, todas as rotas
prerenderizadas/servidas (Middleware 91.6 kB, First Load JS 102 kB).

---

## 7.3 — UAT manual (checkpoint humano — PENDENTE)

Pendente — ver checklist no checkpoint report do executor.
