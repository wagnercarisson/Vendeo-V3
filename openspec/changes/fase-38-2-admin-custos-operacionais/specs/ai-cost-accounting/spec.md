## ADDED Requirements

### Requirement: admin_get_ai_costs (F38.1) permanece inalterado e compatível

O sistema SHALL **não alterar** o RPC `admin_get_ai_costs` (F38.1) — ele continua servindo o `GET /api/admin/ai-costs` existente e permanece a fonte de agregado; os RPCs novos de operation runs (`admin_get_ai_operation_runs` / `admin_get_ai_operation_run_events`, especificados na capability `ai-operation-runs-api`) são **adicionais**, sem modificar a assinatura nem o comportamento do RPC antigo.

#### Scenario: admin_get_ai_costs segue respondendo com filtros antigos

- **WHEN** `admin_get_ai_costs` é chamado com os filtros existentes (`p_store_id`/`p_provider`/`p_model`/`p_generation_type`/`p_hours`/`p_operation_run_id`)
- **THEN** retorna as agregações de sempre (compat — sem mudança de contrato)

#### Scenario: novos RPCs coexistem sem conflito

- **WHEN** `admin_get_ai_operation_runs` é usado pela nova UI
- **THEN** `admin_get_ai_costs` continua disponível e compatível (sem duplicação de nomes nem quebra)
