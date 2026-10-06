---
phase: 56.1-contrato-produtivo-modelos-e-fallback
plan: 11
verified: 2026-10-06
status: complete-local-human-approved
---

# Phase 56.1 — Verificação da fase (Plano 11)

**Infraestrutura F56.1 fechada e isolada: configuração auditável do par, catálogo elegível em `campaign_product_image`, snapshot imutável, política de falhas, resposta pública IMG-001 + UUID v4, pricing por qualidade, instrumentação e tela admin — componentes e testes simulados, sem ativar geração, com o fluxo legado sem mudança de comportamento.**

> **Fronteira F56.1 × F56.2:** snapshot no início de campanha real, não-débito real e aplicação da política sobre geração real são **contrato/componente testado por simulação** na F56.1; a **integração transacional** é da **F56.2** (D-25). Este documento verifica a cobertura da F56.1 e confirma o **não-push / não-ativação / não-promoção**.

> **Tracking:** a atualização de `.planning/STATE.md` e `.planning/ROADMAP.md` é **responsabilidade do orquestrador**. Este plano **não** modifica esses arquivos (ver Task 4 da PLAN).

---

## 1. Cobertura dos 27 REQ-IDs

| REQ-ID | Descrição | Evidência (arquivos / testes / evidência real) |
|---|---|---|
| REQ-56.1-01 | Configuração global de par principal/fallback (modelo+qualidade) | `src/lib/ai/image-model-pair.ts`; `src/lib/ai/image-model-pair-config-service.ts`; `src/lib/ai/image-model-pair-config-view.ts`; `supabase/migrations/20261005000001_f56_1_model_pair_config.sql`; `src/app/api/admin/image-model-pair/route.ts`; `src/app/(app)/admin/image-model-pair/page.tsx`+`form.tsx`; testes `image-model-pair-config-service.test.ts`, `image-model-pair.test.ts`, `image-model-pair.test.tsx`; UAT §1/§5 |
| REQ-56.1-02 | Catálogo elegível fechado de pares modelo-qualidade | `image-model-pair.ts` (`ELIGIBLE_IMAGE_MODELS`/`ELIGIBLE_IMAGE_QUALITIES`); `src/lib/admin/schemas.ts` (Zod strict); teste `image-model-pair-catalog.contract.test.ts`; UAT §5 |
| REQ-56.1-03 | Escolha inicial registrada como decisão humana expressa | `image-model-pair.ts` `INITIAL_IMAGE_MODEL_PAIR` (`origin:'human_decision'`, `active:false`, `production:false`); UAT §5 |
| REQ-56.1-04 | Persistência auditável com RPC | migration `20261005000001` (`admin_set_image_model_pair_config`); rota `.rpc(...)`; **UAT §1 (teste REAL)** |
| REQ-56.1-05 | Leitura server-only e invalidação de cache | `image-model-pair-config-service.ts` (TTL + dedupe in-flight + invalidação); teste `image-model-pair-config-service.test.ts`; UAT §2 |
| REQ-56.1-06 | Tratamento fail-closed de configuração inválida | `image-model-pair-config-service.ts` (`image_model_pair_config_missing`/`_divergent`); testes `new-flow-failclosed.contract.test.ts`, `image-model-pair-config-service.test.ts` |
| REQ-56.1-07 | Isolamento do fluxo legado | `new-flow-isolation.contract.test.ts` (Task 1); `legacy-selection-isolation.contract.test.ts`; UAT §4 |
| REQ-56.1-08 | Snapshot imutável da configuração por campanha | `src/lib/ai/image-generation-config-snapshot.ts`; migration `20261005000002`; teste `image-generation-config-snapshot.test.ts` |
| REQ-56.1-09 | Alteração posterior do admin não muda o passado | `image-generation-config-snapshot.ts` (correção reutiliza snapshot original); teste `image-generation-config-snapshot.test.ts` |
| REQ-56.1-10 | Correlação do snapshot com a telemetria | `image-generation-config-snapshot.ts` (run/trace); `gateway-quality-envelope.test.ts`; teste de snapshot |
| REQ-56.1-11 | Tolerância a operações legadas sem snapshot | teste `image-generation-config-snapshot.test.ts` (linhas legadas NULL toleradas) |
| REQ-56.1-12 | Taxonomia de falhas elegíveis e não elegíveis | `src/lib/ai/image-generation-failure-policy.ts`; teste `image-generation-failure-policy.test.ts` |
| REQ-56.1-13 | Política de execução com teto de chamadas | `image-generation-failure-policy.ts` (≤2 principal + ≤1 fallback = ≤3); teste dedicado |
| REQ-56.1-14 | Rate limit é transitório | `image-generation-failure-policy.ts`; teste dedicado |
| REQ-56.1-15 | Disponibilidade/capacidade aciona fallback sem repetição inútil | `image-generation-failure-policy.ts`; teste dedicado |
| REQ-56.1-16 | Falha técnica não é cobrada do lojista | `image-generation-failure-policy.ts` (`charged:false`/`consumedCredit:false`); teste dedicado + UAT §7 (enforcement real = F56.2) |
| REQ-56.1-17 | Resposta pública identificável com código e referência | `src/lib/ai/image-generation-support-reference.ts` (`IMG-001` + UUID v4); teste `image-generation-support-reference.test.ts` |
| REQ-56.1-18 | A mensagem pública não revela o motivo interno | `image-generation-support-reference.ts`; `sanitizeAiErrorMessage`; teste dedicado |
| REQ-56.1-19 | Correlação segura no admin/suporte | `src/lib/ai/image-generation-diagnosis-repository.ts`; `src/app/api/admin/image-generation-diagnosis/route.ts`; testes `image-generation-diagnosis-repository.test.ts`, `image-generation-diagnosis.test.ts` |
| REQ-56.1-20 | Referência não é credencial nem dado sensível | `image-generation-support-reference.ts` (UUID opaco); teste dedicado |
| REQ-56.1-21 | Propagação da qualidade até o adapter | `src/lib/ai/adapters/upstream-images.ts`; teste `upstream-images-adapter.test.ts` |
| REQ-56.1-22 | Observabilidade por tentativa (modelo-qualidade) | `src/lib/ai/gateway.ts` (envelope aditivo); `src/lib/ai/upstream-images-runtime.ts`; teste `gateway-quality-envelope.test.ts` |
| REQ-56.1-23 | Cálculo de custo por par modelo-qualidade | `src/lib/ai-cost/image-pair-pricing.ts`; `src/lib/ai-cost/ai-model-pricing.ts`; testes `image-pair-pricing.test.ts` |
| REQ-56.1-24 | Registro dos modelos elegíveis em capacidade própria | migration `20261005000001` (`campaign_product_image`); `model-registry.ts` (`CAPABILITY_PROTOCOLS`/`CAPABILITY_SEGMENTS`); UAT §5 |
| REQ-56.1-25 | Dimensão de qualidade no pricing (aditiva) | migration `20261005000002` (coluna `quality` + índices parciais + RPC `p_quality`); teste `ai-model-pricing.test.ts` |
| REQ-56.1-26 | Cobertura de pricing ciente de qualidade para os pares | `image-pair-pricing.ts` (`complete`/`partial`/`missing`); teste `image-pair-pricing.test.ts`; UI `form.tsx`; UAT §2 |
| REQ-56.1-27 | Envelope de telemetria registra o par modelo-qualidade | `src/lib/ai/types.ts` + `gateway.ts`; teste `gateway-quality-envelope.test.ts` |

**Cobertura:** 27/27 REQ-IDs com evidência — **completa**.

---

## 2. Cobertura das 55 tasks OpenSpec

### Seção 1 — Preparação e contratos
| Task | Evidência |
|---|---|
| 1.1 Par inicial confirmado como decisão humana não ativa | `image-model-pair.ts` `INITIAL_IMAGE_MODEL_PAIR`; UAT §5 |
| 1.2 Decisões abertas fechadas | `56.1-CONTEXT.md` D-01..D-26 (nome `campaign_product_image`, `IMG-001`, colunas dedicadas, gate de pricing D-23/D-24) |
| 1.3 Tipos/schemas TS e Zod | `image-model-pair.ts`; `src/lib/admin/schemas.ts` |
| 1.4 Lista fechada de modelos/qualidades | `image-model-pair.ts` (`ELIGIBLE_IMAGE_MODELS`/`ELIGIBLE_IMAGE_QUALITIES`) |

### Seção 2 — Banco de dados (migration aditiva)
| Task | Evidência |
|---|---|
| 2.1 Tabela global do par + RLS service_role | migration `20261005000001` (aplicada local; UAT §0) |
| 2.2 RPC auditada de gravação | migration `20261005000001`; **UAT §1 (teste REAL)** |
| 2.3 Snapshot imutável + trigger | migration `20261005000002`; `image-generation-config-snapshot.ts` |
| 2.4 Coluna `quality` nullable + índice de vigência | migration `20261005000002` |
| 2.5 `admin_set_ai_model_price` com `quality` opcional | migration `20261005000002` |
| 2.6 Inserção idempotente do catálogo elegível | migration `20261005000001`; UAT §5 |
| 2.7 Comportamento legado inalterado | UAT §4; `new-flow-isolation.contract.test.ts` |

### Seção 3 — Serviço e API administrativa
| Task | Evidência |
|---|---|
| 3.1 Serviço server-only com cache/invalidação | `image-model-pair-config-service.ts`; teste dedicado |
| 3.2 Resolução fail-closed | `image-model-pair-config-service.ts`; `new-flow-failclosed.contract.test.ts` |
| 3.3 GET/PUT `/api/admin/image-model-pair` com requireAdmin/Zod | `src/app/api/admin/image-model-pair/route.ts`; teste `image-model-pair.test.ts` |
| 3.4 Rejeição de par/qualidade fora do catálogo | `schemas.ts` (Zod strict) + RPC `model_not_in_catalog`/`invalid_quality`; testes |
| 3.5 Testes: gravação, motivo, idempotência, fail-closed | testes unit + **UAT §1 (real)** |
| 3.6 Fail-closed de pricing do novo fluxo | `image-pair-pricing.ts`; `image-pair-pricing.test.ts`; `cost-estimator.test.ts` (legado intacto) |

### Seção 4 — Tela administrativa
| Task | Evidência |
|---|---|
| 4.1 Tela admin do par | `src/app/(app)/admin/image-model-pair/page.tsx`+`form.tsx`; `layout.tsx` (link aditivo) |
| 4.2 Catálogo/par/origem/aviso não-ativa | `page.tsx`+`form.tsx`; teste `image-model-pair.test.tsx` |
| 4.3 Cobertura de pricing sem bloquear salvar | `form.tsx` (banner âmbar warn-not-block); teste de UI |
| 4.4 Testes de seleção/motivo/restrição | `image-model-pair.test.tsx` (10 testes) |

### Seção 5 — Snapshot (componente; integração real F56.2)
| Task | Evidência |
|---|---|
| 5.1 Componente de snapshot | `image-generation-config-snapshot.ts`; teste dedicado |
| 5.2 Imutabilidade | migration `20261005000002` (trigger); teste dedicado |
| 5.3 Alterar admin não muda snapshot anterior | teste de snapshot |
| 5.4 Nova campanha (vigente) × correção (snapshot original) | teste de snapshot (`resolveConfigForCorrection`) |
| 5.5 Correlação snapshot × telemetria | teste de snapshot (run/trace) |
| 5.6 Tolerância a operações legadas | teste de snapshot |
| 5.7 Integração real registrada como F56.2 | UAT §7; este VERIFICATION (fronteira) |

### Seção 6 — Taxonomia e política (componentes; integração real F56.2)
| Task | Evidência |
|---|---|
| 6.1 Separar rate_limit de quota/faturamento | `image-generation-failure-policy.ts`; teste dedicado |
| 6.2 Classificação elegível/não elegível | idem |
| 6.3 Política pura (≤2+1, máx 3) | idem |
| 6.4 rate_limit transitório | idem |
| 6.5 Disponibilidade/capacidade sem repetição inútil | idem |
| 6.6 Quota/faturamento sem fallback | idem |
| 6.7 Falha técnica não consome crédito (simulado) | `charged:false`/`consumedCredit:false`; teste |
| 6.8 Testes simulados de todas as ramificações | `image-generation-failure-policy.test.ts` (35 testes) |
| 6.9 Aplicação real registrada como F56.2 | UAT §7; este VERIFICATION |

### Seção 7 — Resposta ao lojista e correlação
| Task | Evidência |
|---|---|
| 7.1 Código público + referência opaca | `image-generation-support-reference.ts` |
| 7.2 Resposta pública para falhas | idem |
| 7.3 Mensagem sem saldo/quota/faturamento/chave/URL/texto cru | idem (`sanitizeAiErrorMessage`); teste |
| 7.4 Correlação referência → diagnóstico no admin | `image-generation-diagnosis-repository.ts`; rota; testes |
| 7.5 Testes de não revelação e correlação | `image-generation-support-reference.test.ts`, `image-generation-diagnosis-repository.test.ts`, `image-generation-diagnosis.test.ts` |

### Seção 8 — Instrumentação de qualidade, telemetria e custo
| Task | Evidência |
|---|---|
| 8.1 Propagar qualidade ao adapter (principal/fallback) | `upstream-images.ts`; `upstream-images-adapter.test.ts` |
| 8.2 Envelope por tentativa com modelo/qualidade/alvo | `gateway.ts` + `types.ts`; `gateway-quality-envelope.test.ts` |
| 8.3 Custo por par modelo-qualidade | `image-pair-pricing.ts`; `ai-model-pricing.ts`; testes |
| 8.4 Cobertura partial/missing sem inventar valor | `image-pair-pricing.ts`; teste |
| 8.5 Testes de qualidade/envelope/custo/regressão | `upstream-images-adapter.test.ts`, `gateway-quality-envelope.test.ts`, `image-pair-pricing.test.ts`, `cost-estimator.test.ts` |

### Seção 9 — Isolamento, regressão e validação
| Task | Evidência |
|---|---|
| 9.1 Fronteira produtiva sem mudança de comportamento | UAT §4; `new-flow-isolation.contract.test.ts` |
| 9.2 Novo fluxo não gera campanha/ativa geração | UAT §6; `new-flow-isolation.contract.test.ts` (item f) |
| 9.3 typecheck/lint/build/suíte local | UAT §2 (todos EXIT 0) |
| 9.4 `openspec validate --strict` + GSD | UAT §2 (`--changes --strict` válido); **GSD/OpenSpec verification lifecycle NOT run** — parado antes de verify/sync/archive por instrução do responsável (task OpenSpec 9.4 permanece `[ ]`) |
| 9.5 UAT local sem provider + ausência de `db push` | UAT §1/§3 |
| 9.6 Atualizar STATE/ROADMAP | **Responsabilidade do orquestrador** (não modificado por este plano) |

### Seção 10 — Checkpoint final
| Task | Evidência |
|---|---|
| 10.1 Revisão humana antes de ativação em F56.2 | Task 5 (`checkpoint:human-verify`) — **APROVADO** no escopo preparatório/local (§6) |
| 10.2 Par permanece decisão do responsável, não promoção | `INITIAL_IMAGE_MODEL_PAIR` (`active:false`); UAT §5 |

**Cobertura:** 55/55 tasks OpenSpec com evidência — **completa**.

---

## 3. Gates e evidência (referência ao UAT)

| Gate | Resultado |
|---|---|
| `npm run typecheck` | EXIT 0 |
| `npm run lint` | EXIT 0 |
| `npm run build` | EXIT 0 (78/78 páginas) |
| Suíte relevante `src/lib/ai` + `src/lib/ai-cost` + `src/app/api/admin` | 894 passed / 7 skipped |
| `npm test -- src/lib/ai/__tests__/new-flow-isolation.contract.test.ts` | 7/7 verdes |
| `openspec validate <change> --strict` / `--changes --strict` | válido, EXIT 0 (validação de conteúdo; o **lifecycle** verify/sync/archive **NÃO** foi executado) |
| `supabase db lint --local --fail-on error` | EXIT 0 |
| Teste REAL da RPC na instância isolada | UAT §1 (gravação + auditoria única + idempotência) |

Fonte detalhada: `.planning/phases/56.1-contrato-produtivo-modelos-e-fallback/56-1-UAT.md`.

---

## 4. Fronteira F56.1 × F56.2

- **Entregue e verificado na F56.1 (contrato/componente):** snapshot imutável, não-débito de falha técnica e política de tentativas — testados por **simulação**, sem campanha/provider/crédito real.
- **Integração transacional (F56.2):** gravar snapshot no início de campanha real; não debitar o lojista em falha técnica sobre o ledger; aplicar a política sobre geração real; preflight real de pricing `complete`; produção dos eventos reais de falha.
- A escolha do par permanece **decisão humana** (não promoção automática); nada é ativado nesta fase.

---

## 5. Confirmações finais

- ✅ **Nenhum `supabase db push` remoto** — validação exclusivamente local (UAT §3).
- ✅ **Nenhuma promoção/ativação** de geração ou de modelo.
- ✅ **Nenhuma chamada paga** a provider; **0 crédito** consumido (UAT §6).
- ✅ **Fluxo legado intocado** exceto as mudanças declarativas e revisadas (UAT §4).
- ✅ `.planning/STATE.md` e `.planning/ROADMAP.md` **não** modificados por este plano (ownership do orquestrador).
- ✅ **Checkpoint humano final (Task 5) APROVADO** pelo responsável no **escopo preparatório/local** (ver §6).

---

## 6. UAT Humano (revisão do responsável) — APROVADO (escopo preparatório/local)

**Aprovação:** o responsável **APROVOU** o UAT humano da F56.1 no **escopo preparatório/local**, com base na evidência abaixo, executada na instância descartável/isolada `vendeo-f561-isolated` (REST `http://127.0.0.1:55321` / DB `55322`). A aprovação cobre a infraestrutura preparatória e a configuração auditável do par; **não** cobre promoção/ativação produtiva nem a integração transacional (F56.2).

### 6.1 Evidência observada (instância isolada)

- Motivo vazio é **bloqueado** no formulário da UI.
- **Salvar** pela tela admin **funcionou**.
- Teste humano: salvou o par primário `gpt-image-2.5-flare`/`medium` + fallback `gpt-image-2`/`medium` (motivo "Teste"), gerando versão de configuração `f314d801-87be-479c-9c01-4d574b9d892f`, `operation_id` `600af8d0-090a-4419-807d-0282afb60afd`, com **EXATAMENTE UMA** linha em `admin_audit_log` (`action='image_model_pair_config_update'`).
- O **aviso de não-ativa em produção** e a **cobertura de pricing `missing`/`partial`** foram exibidos corretamente.
- A **operação de teste foi preservada** na história (nenhuma linha de auditoria apagada/alterada).
- Em seguida, o responsável **RESTAUROU** o par inicial Sunburst/medium + `gpt-image-2`/`medium` (motivo "teste"), gerando versão `b3fa7b83-a0aa-48db-8f02-9bcbdd32bbe8`, `operation_id` `ce191171-ea5d-4381-840b-07ad860a6c1d`, com **EXATAMENTE UMA** linha de auditoria.

### 6.2 Versões da instância isolada

| Operação | `operation_id` | `config_version_id` | Linhas de auditoria |
|---|---|---|---|
| Teste humano do par Flare (`gpt-image-2.5-flare`/`medium` + `gpt-image-2`/`medium`, motivo "Teste") | `600af8d0-090a-4419-807d-0282afb60afd` | `f314d801-87be-479c-9c01-4d574b9d892f` | **1** |
| Restauração do par inicial (`gpt-image-2.5-sunburst`/`medium` + `gpt-image-2`/`medium`, motivo "teste") | `ce191171-ea5d-4381-840b-07ad860a6c1d` | `b3fa7b83-a0aa-48db-8f02-9bcbdd32bbe8` | **1** |

**Linha vigente (instância isolada):** primário `gpt-image-2.5-sunburst`/`medium`, fallback `gpt-image-2`/`medium`, `config_version_id` `b3fa7b83-a0aa-48db-8f02-9bcbdd32bbe8`. Histórico de auditoria preservado (4 linhas: `5958d23c`→`c949372c`, `884e9260`→`cca10e2f`, `600af8d0`→`f314d801`, `ce191171`→`b3fa7b83`).

### 6.3 Não-promoção + ausência de mutações proibidas

- O teste do par `gpt-image-2.5-flare`/`medium` **NÃO é promoção** de Flare; foi revertido ao par inicial aprovado. A escolha do par **permanece decisão humana** do responsável.
- Instância isolada `vendeo-f561-isolated`; a stack compartilhada `Vendeo_V3` **não** foi tocada.
- **Nenhum `supabase db push`** (nem remoto, nem `--linked`); **nenhuma chamada a provider**; **nenhuma geração paga**; **nenhuma ativação/promoção**; histórico de auditoria **preservado**.

### 6.4 Lifecycle OpenSpec e verificação GSD — NÃO executados

Por **instrução do responsável**, houve **STOP antes** do lifecycle OpenSpec (`/opsx-verify` → `/opsx-sync` → `/opsx-archive`) e do passo de verificação da fase GSD. O que **foi** executado é apenas `openspec validate --strict` (validação de conteúdo, EXIT 0). O par é registrado como **aprovado no escopo preparatório/local**; a task OpenSpec **9.4 permanece `[ ]`** exatamente por registrar que o lifecycle **não** rodou.

---

*Phase: 56.1-contrato-produtivo-modelos-e-fallback — Plano 11*
*Verificado: 2026-10-06*
