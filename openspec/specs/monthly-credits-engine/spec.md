# Monthly Credits Engine

> Synced from `fase-29-3-creditos-mensais-automaticos` (ADDED).

## Purpose

SQL function `grant_monthly_credits()` que implementa a concessão mensal automática de créditos bônus com elegibilidade por idade da loja, teto de bônus configurável, grant parcial, idempotência por ciclo efetivo de 30 dias e `FOR UPDATE SKIP LOCKED` para concorrência.

## Requirements

### Requirement: grant_monthly_credits RPC function

O sistema SHALL criar a SQL function `public.grant_monthly_credits(p_amount INTEGER, p_bonus_cap INTEGER, p_min_store_age_days INTEGER) RETURNS JSONB`.

A função implementa a concessão mensal automática de créditos bônus com as seguintes regras:

1. **Pré-contagem de elegíveis**: `eligible` = todas as lojas com `created_at <= NOW() - p_min_store_age_days` AND (`last_monthly_grant_at IS NULL` OR `last_monthly_grant_at < NOW() - p_min_store_age_days`), independente do cap
2. **Pré-contagem de skipped**: `skipped` = lojas elegíveis cujo `bonus_balance >= p_bonus_cap` (teto já atingido)
3. **Etapa 1 (garantia de row)**: INSERT em `credit_balances` com zeros para lojas elegíveis abaixo do cap sem registro (LEFT JOIN anti-join com `cb.store_id IS NULL`), `ON CONFLICT (store_id) DO NOTHING`
4. **Etapa 2 (varredura)**: `SELECT ... FOR UPDATE OF cb SKIP LOCKED` filtrando apenas `bonus_balance < p_bonus_cap` — evita lock em lojas no teto
5. **Grant**: `LEAST(p_amount, p_bonus_cap - rec.bonus_balance)` — grant parcial se necessário
6. **Idempotency key**: `'mensal_ciclo_' || FLOOR(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / (30 * 86400)) || '_' || s.id`
7. **Chamada**: `grant_credits(s.id, grant, 'mensal', idempotency_key, jsonb_build_object('cycle', ciclo_efetivo, 'grant_type', 'bonus_monthly'), 'bonus_monthly')`
8. **Atualização**: `credit_balances.last_monthly_grant_at = NOW()` apenas quando há grant efetivo
9. **Retorno**: `{ eligible: int, granted: int, skipped: int, errors: int }` — skipped é contado na pré-contagem, não na varredura

#### Scenario: grant for eligible store creates bonus_monthly transaction

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** existe loja com `created_at >= 30 dias`, `bonus_balance = 0`, `last_monthly_grant_at IS NULL`
- **THEN** insere transação `type = 'bonus_monthly'`, `amount = 5`
- **AND** `bonus_balance` incrementado em 5
- **AND** `last_monthly_grant_at` atualizado para `NOW()`
- **AND** retorno inclui `granted = 1`

#### Scenario: store at bonus cap is skipped

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** loja tem `bonus_balance = 10`
- **THEN** loja é pulada
- **AND** `last_monthly_grant_at` NÃO é atualizado
- **AND** retorno inclui `skipped = 1`

#### Scenario: partial grant when close to cap

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** loja tem `bonus_balance = 8`
- **THEN** concede `grant = 2` (apenas o necessário para atingir cap)
- **AND** `bonus_balance` = 10 após grant
- **AND** `last_monthly_grant_at` atualizado

#### Scenario: store younger than min age is ineligible

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** loja tem `created_at = NOW() - 15 dias`
- **THEN** loja não entra na elegibilidade
- **AND** retorno inclui `eligible = 0` para esta loja

#### Scenario: already granted store not processed again

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** loja tem `last_monthly_grant_at = NOW() - 5 dias`
- **THEN** loja é pulada (last_monthly_grant_at < NOW() - 30 é falso)

#### Scenario: store consumed bonus after cap — eligible next cycle

- **WHEN** loja tem `bonus_balance = 10` (teto) e `last_monthly_grant_at = NOW() - 35 dias`
- **AND** loja consome 3 créditos (bonus_balance = 7)
- **AND** `grant_monthly_credits(5, 10, 30)` executa
- **THEN** loja é elegível (created_at >= 30, last_monthly_grant_at >= 30, bonus_balance < cap)
- **AND** concede `grant = 3` (parcial, até cap)
- **AND** `bonus_balance` = 10

#### Scenario: concurrent execution uses SKIP LOCKED

- **WHEN** duas execuções de `grant_monthly_credits` ocorrem simultaneamente
- **THEN** `FOR UPDATE SKIP LOCKED` previne deadlock
- **AND** cada loja é processada exatamente uma vez

#### Scenario: return JSON structure

- **WHEN** `grant_monthly_credits` é executado
- **THEN** retorna `{ eligible: number, granted: number, skipped: number, errors: number }`

#### Scenario: store without credit_balances row gets row created

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** loja elegível não tem registro em `credit_balances`
- **THEN** Etapa 1 insere `credit_balances(store_id, balance=0, bonus_balance=0, purchased_balance=0)`
- **AND** Etapa 2 processa a loja normalmente

#### Scenario: idempotency key based on effective cycle

- **WHEN** `grant_monthly_credits` é executado para loja com `created_at` há 65 dias
- **THEN** ciclo efetivo = `FLOOR(65 / 30) = 2`
- **AND** idempotency_key = `'mensal_ciclo_2_' || store_id`
