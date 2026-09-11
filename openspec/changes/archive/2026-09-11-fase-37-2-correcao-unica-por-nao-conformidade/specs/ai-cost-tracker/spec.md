# AI Cost Tracker

## Purpose

Evolução da capability `ai-cost-tracker` pela **F37.2 realinhada — Correção Única por Não Conformidade** (D37.2-R2/R3/R4 + achado 4 de revisão). O `AiCostTracker` é a camada única de registro call-level de custo (`generation_events`); a F37.2 registra a chamada de IA textual da **análise do relato** como evento call-level **sob o mesmo `operation_run_id`** da campanha, com um **novo literal `campaign_correction_analysis`** no contrato `generationType`/`AiCostEvent` (union `GenerationEventType` em `src/lib/visual-signature/types.ts`) e a **evolução correspondente do CHECK `chk_generation_events_type`**. Instrumentação mínima: nenhuma tela, agregação financeira, RPC de operation-runs ou cálculo existente é alterado; a melhoria ampla da contabilidade (ex.: agregar/expor o novo tipo no painel F38.2) fica para fase futura.

## ADDED Requirements

### Requirement: Novo generation_type campaign_correction_analysis no contrato de custo call-level

O sistema SHALL estender o contrato de custo call-level para aceitar o novo tipo da análise do relato (achado 4 — fonte normativa principal atualizada):

- O union `GenerationEventType` (`src/lib/visual-signature/types.ts`) SHALL ganhar o literal **`campaign_correction_analysis`** (12 → 13 valores).
- O CHECK `chk_generation_events_type` em `generation_events` SHALL ser evoluído (bloco idempotente `DROP CONSTRAINT IF EXISTS`/`ADD CONSTRAINT` no padrão das migrations F38.1 `20260808000001` e F44.1 `20260825000001`) para incluir o novo literal — **aditivo e retrocompatível** (eventos existentes preservados).
- `AiCostEvent.generationType` aceita o novo literal; `AiCostTracker.record` persiste eventos de **análise** exatamente como os demais eventos call-level (colunas completas, incl. `generation_type`, `provider`, `model`, tokens, custo por `resolveAiCost`, snapshots econômicos).
- A análise roda sob `operationRunType: "campaign_delivery"` e reutiliza o `operation_run_id` da campanha original; `attemptNumber` = `attempt_number` da submissão (`campaign_correction_submissions`).
- **Sem** nova `operation_key`, `credit_transactions` ou reserva; **sem** alterar telas/agregações financeiras/RPCs de leitura existentes; `record` segue best-effort (nunca lança).

#### Scenario: Evento de análise registrado com o novo generation_type

- **WHEN** a análise textual do relato roda
- **THEN** o `AiCostTracker.record` grava um evento `generation_type = 'campaign_correction_analysis'` com `provider`/`model`/tokens/custo no `operation_run_id` da campanha
- **AND** o CHECK `chk_generation_events_type` aceita o valor (migration M4 aplicada) e o TypeScript aceita o literal no union

#### Scenario: Evolução do CHECK é aditiva

- **WHEN** a migration M4 é aplicada (idempotente)
- **THEN** o CHECK passa a aceitar `campaign_correction_analysis` junto dos 12 valores existentes
- **AND** nenhum evento antigo é alterado/reclassificado

#### Scenario: Sem alteração financeira de superfície

- **WHEN** eventos de análise são gravados
- **THEN** nenhuma `credit_transactions`/`operation_key` nova é criada
- **AND** telas, agregações financeiras e RPCs de leitura (operation-runs/costs) permanecem inalterados (melhoria ampla fica para fase futura)
