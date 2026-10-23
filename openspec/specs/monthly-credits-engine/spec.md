# Monthly Credits Engine

> Synced from `fase-29-3-creditos-mensais-automaticos` (ADDED).
> **Revisado (alinhamento pós-F32):** semântica por RAIZ de CNPJ com LIMIAR de elegibilidade (limiar, não acumulação), ciclo por aniversário com clamp, recipiente determinístico e idempotência por `freemium_entitlements(root_hash, 'monthly', cycle)`. Seções que descreviam o desenho F29.3 original (cap de acúmulo, ciclo de 30 dias, `last_monthly_grant_at` como fonte de verdade) estão superadas (ver `docs/alinhamento-fase-29-3-creditos-mensais-automaticos.md` — "Revisão de alinhamento").

## Purpose

SQL function `grant_monthly_credits()` que implementa a concessão mensal automática de créditos bônus **por raiz de CNPJ** com elegibilidade por idade da loja, **limiar de bônus configurável** (grant integral abaixo do limiar; nenhum grant no limiar ou acima), ciclo por aniversário em `America/Sao_Paulo`, recipiente determinístico (matriz → loja mais antiga não-teste) e idempotência por raiz+cycle via `freemium_entitlements`.

## Requirements

### Requirement: grant_monthly_credits RPC function

O sistema SHALL manter a SQL function legada `public.grant_monthly_credits(...)` para rollback estrutural, mas descontinuar sua execução automática no corte F50. Até o corte, `monthlyCreditsEnabled` permanece true; após o corte nenhum novo `bonus_monthly` é emitido e saldos mensais históricos permanecem não-expiráveis.

#### Scenario: Nenhum grant mensal após corte

- **WHEN** F50 está ativa
- **THEN** cron/UI não invocam a RPC e nenhuma transação `bonus_monthly` nova é criada

#### Scenario: Mensal preservado até corte

- **WHEN** deploy ocorre antes do corte
- **THEN** `monthlyCreditsEnabled` permanece true

#### Scenario: Saldo mensal legado preservado

- **WHEN** usuário possui `bonus_monthly` histórico
- **THEN** saldo permanece sem expiração retroativa

A função implementa a concessão mensal automática de créditos bônus com as seguintes regras:

1. **Iteração por raiz**: cursor sobre `DISTINCT stores.cnpj_root_hash` (não vazio, `is_test_store = FALSE`); máximo 1 grant por raiz por ciclo mensal
2. **Recipiente determinístico** (escolhido ENTRE TODAS as lojas não-teste da raiz, sem filtro EXISTS no recipiente): matriz (`substring(cnpj_normalized, 9, 4) = '0001'`) preferida; sem matriz, a loja não-teste mais antiga (`created_at ASC, id ASC`)
3. **Histórico freemium validado NO NÍVEL DA RAIZ** (qualquer loja da raiz), nunca no nível do recipiente
4. **Row garantida em `credit_balances`** do recipiente (`INSERT ... ON CONFLICT (store_id) DO NOTHING`) antes do `SELECT ... FOR UPDATE` do `bonus_balance` (matriz cadastrada depois pode nunca ter recebido crédito)
5. **Limiar de elegibilidade**: `bonus_balance < p_bonus_cap` → grant INTEGRAL de `p_amount`; `bonus_balance >= p_bonus_cap` → NENHUM grant no ciclo (raiz perde o ciclo)
6. **Idempotência por raiz+cycle**: check de existência (`SELECT` somente leitura) antes do limiar; INSERT via `try_grant_monthly_entitlement(recipient_id, root_hash, cycle)` como salvaguarda final contra corrida concorrente (ON CONFLICT)
7. **Idempotency key da transação**: `'mensal_' || cycle || '_' || root_hash`
8. **Fuso explícito**: todos os cálculos de dia de aniversário, ciclo e idade usam `America/Sao_Paulo` (`(NOW() AT TIME ZONE 'America/Sao_Paulo')::date`; `created_at AT TIME ZONE 'America/Sao_Paulo'`)
9. **Ciclo**: `cycle = TO_CHAR(v_ref_date, 'YYYY-MM')` (mês calendário BR); raiz concedida apenas no dia-do-mês do `created_at` do recipiente com clamp `LEAST(v_anniv_day, v_last_day)` (dia 29/30/31 → último dia do mês curto; nunca dia 1 do mês seguinte)
10. **Retorno**: shape canônico `{ eligible, granted, skipped, errors, details: { roots_considered, skipped_no_cnpj, skipped_already_granted, skipped_not_due, skipped_bonus_threshold } }` — `eligible = granted + skipped_already_granted + skipped_bonus_threshold`; `roots_considered = eligible + skipped_not_due`; `skipped_not_due` NÃO entra em `eligible`

#### Scenario: grant for eligible root creates bonus_monthly transaction

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** existe raiz com recipiente `created_at >= 30 dias`, `bonus_balance = 0`, sem entitlement monthly no ciclo
- **THEN** insere transação `type = 'bonus_monthly'`, `amount = 5` (integral)
- **AND** `bonus_balance` incrementado em 5
- **AND** retorno inclui `granted = 1`

#### Scenario: root at bonus threshold is skipped without grant

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** recipiente tem `bonus_balance = 10`
- **THEN** a raiz é pulada (sem entitlement criado, sem grant)
- **AND** `details.skipped_bonus_threshold` é incrementado
- **AND** a raiz entra em `eligible` (passou dia/idade/histórico, falhou o limiar)

#### Scenario: threshold grants full amount, never fractional

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** recipiente tem `bonus_balance = 9`
- **THEN** concede o valor INTEGRAL `grant = 5` (grant cheio, nunca fracionado)
- **AND** `bonus_balance` = 14 após grant (ultrapassa o limiar — limiar de elegibilidade, não cap de acumulação)

#### Scenario: store younger than min age is not due

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** recipiente tem `created_at = v_ref_date - 15 dias` (dia civil BR)
- **THEN** a raiz não recebe grant (ainda não atingiu a idade mínima)
- **AND** `details.skipped_not_due` é incrementado
- **AND** a raiz NÃO entra em `eligible`

#### Scenario: already granted root in cycle is not processed again

- **WHEN** `grant_monthly_credits` é executado
- **AND** já existe entitlement `(root_hash, 'monthly', cycle)` (2ª execução do mesmo dia)
- **THEN** a raiz é pulada com `details.skipped_already_granted` (mesmo que `bonus_balance` esteja abaixo do limiar após consumo)

#### Scenario: root consumed bonus after threshold — eligible next cycle

- **WHEN** recipiente tem `bonus_balance = 10` (no limiar) no ciclo anterior
- **AND** a raiz consome 3 créditos (bonus_balance = 7) — a raiz fica abaixo do limiar
- **AND** novo ciclo (novo `YYYY-MM`, sem entitlement) com `grant_monthly_credits(5, 10, 30)` executa
- **THEN** a raiz é elegível (idade ok, sem entitlement no ciclo novo, bonus < cap)
- **AND** concede `grant = 5` integral
- **AND** `bonus_balance` = 12

#### Scenario: recipient selected deterministically — matriz preferred

- **WHEN** a raiz tem filial ANTIGA (com transação/onboarding) e matriz CADASTRADA DEPOIS (sem transação própria)
- **THEN** o recipiente é a MATRIZ (`substring(cnpj_normalized, 9, 4) = '0001'`), não a filial com transação
- **AND** a transação `bonus_monthly` aponta para `store_id` = matriz

#### Scenario: no matriz — oldest non-test store is recipient

- **WHEN** a raiz só tem filiais (sem `0001`)
- **THEN** o recipiente é a loja não-teste mais antiga (`created_at ASC, id ASC`)

#### Scenario: anniversary cycle — granted only on day-of-month of created_at

- **WHEN** `grant_monthly_credits` é executado fora do dia-do-mês do `created_at` do recipiente
- **THEN** a raiz não recebe grant (`details.skipped_not_due`)
- **AND** `eligible` não a inclui

#### Scenario: anniversary clamp — day 29/30/31 lands on last day of short month

- **WHEN** o dia de aniversário do recipiente é 31 e o mês corrente tem 30 dias
- **THEN** a raiz é concedida em `LEAST(31, 30) = 30` (último dia do mês)
- **AND** nunca rola para o dia 1 do mês seguinte

#### Scenario: concurrent execution is safe

- **WHEN** duas execuções de `grant_monthly_credits` ocorrem simultaneamente para a mesma raiz
- **THEN** o check de existência é leitura pura; a corrida real se resolve no INSERT de `try_grant_monthly_entitlement` (ON CONFLICT DO NOTHING)
- **AND** a 2ª execução incrementa `details.skipped_already_granted` e NÃO concede grant adicional

#### Scenario: return JSON structure (canonical shape)

- **WHEN** `grant_monthly_credits` é executado
- **THEN** retorna `{ eligible: number, granted: number, skipped: number, errors: number, details: { roots_considered, skipped_no_cnpj, skipped_already_granted, skipped_not_due, skipped_bonus_threshold } }`
- **AND** `eligible = granted + skipped_already_granted + skipped_bonus_threshold`
- **AND** `roots_considered = eligible + skipped_not_due`

#### Scenario: recipient without credit_balances row gets row created

- **WHEN** `grant_monthly_credits(5, 10, 30)` é executado
- **AND** o recipiente (ex.: matriz cadastrada depois) não tem registro em `credit_balances`
- **THEN** `INSERT INTO credit_balances (store_id, balance, bonus_balance, purchased_balance) VALUES (..., 0, 0, 0) ON CONFLICT (store_id) DO NOTHING` roda antes do lock
- **AND** o `bonus_balance` é lido sob `FOR UPDATE` após a row garantida

#### Scenario: idempotency key based on root and cycle

- **WHEN** `grant_monthly_credits` concede para uma raiz no ciclo `2026-04`
- **THEN** idempotency_key = `'mensal_2026-04_' || root_hash`

### Requirement: Exclusão da coorte do teste do bônus mensal

O sistema SHALL preservar a configuração e a chave da concessão mensal legada (`VENDEO_MONTHLY_CREDITS_*`, `grant_monthly_credits`) e SHALL NOT alterar saldos ou entitlements mensais já concedidos. A função SHALL manter o limite interno de bônus, o ciclo, o recipiente determinístico, a idempotência por raiz/cycle e o cap de bônus existentes.

Quando uma raiz tiver enrollment **`policy_cohort='root_legacy'`** em `trial_offer_enrollments`, `grant_monthly_credits` SHALL pular a raiz com `skipped_trial_offer_cohort`, sem criar entitlement `monthly` e sem conceder crédito. A exclusão SHALL valer também após o vencimento do teste legado; não há retorno automático ao mensal.

Enrollment **`policy_cohort='per_cnpj_f50_4'`** de uma filial SHALL NOT, por si só, excluir a raiz inteira nem reduzir o enquadramento mensal de uma conta `root_legacy` da mesma raiz. O recipiente elegível SHALL ser escolhido apenas entre lojas de conta `root_legacy` e sem enrollment próprio. Uma loja `per_cnpj_f50_4` SHALL NOT receber `bonus_monthly` automático. Se a raiz só tiver lojas da nova coorte, o ciclo SHALL ser pulado sem grant e sem entitlement.

O retorno SHALL preservar o shape canônico e os contadores existentes, acrescentando `details.skipped_new_policy_store` para lojas da nova coorte não recipientes.

#### Scenario: Raiz com enrollment legado é pulada

- **WHEN** a raiz possui enrollment `root_legacy`
- **THEN** o mensal não concede no ciclo
- **AND** `skipped_trial_offer_cohort` é incrementado
- **AND** nenhum entitlement mensal é criado

#### Scenario: Filial nova não exclui a matriz legada

- **WHEN** a raiz possui apenas enrollment `per_cnpj_f50_4` de uma filial
- **AND** a matriz é uma conta `root_legacy` sem enrollment próprio
- **THEN** a matriz preserva o enquadramento mensal anterior
- **AND** o mensal pode ser concedido à matriz conforme as regras vigentes
- **AND** a filial não é escolhida como recipiente

#### Scenario: Ordem de chegada não altera o mensal

- **WHEN** a filial F50.4 entra antes ou depois da avaliação mensal da matriz legada
- **THEN** o resultado do mensal da matriz é o mesmo
- **AND** a filial não cria nem retira direito mensal da conta anterior
- **AND** somente enrollment `root_legacy` exclui a raiz

#### Scenario: Loja da nova coorte nunca recebe mensal

- **WHEN** a única loja elegível da raiz é `per_cnpj_f50_4`
- **THEN** nenhum `bonus_monthly` é concedido
- **AND** a loja não recebe entitlement mensal
- **AND** `skipped_new_policy_store` é incrementado

#### Scenario: Conta antiga permanece no mensal

- **WHEN** a raiz não possui enrollment `root_legacy`
- **THEN** o mensal segue as regras existentes para a conta legada
- **AND** nenhum comportamento do limite interno é flexibilizado

#### Scenario: Direito mensal anterior preservado

- **WHEN** a raiz já recebeu `bonus_monthly` antes do teste
- **THEN** o saldo permanece utilizável
- **AND** nenhum estorno ou expiração é aplicado

#### Scenario: Sem retorno automático após o teste legado

- **WHEN** o teste `root_legacy` vence
- **THEN** a raiz continua excluída do mensal automático
- **AND** qualquer benefício posterior exige política aprovada explicitamente

#### Scenario: Ligar ou desligar a chave não altera a exclusão legada

- **WHEN** a chave da oferta é habilitada ou desabilitada
- **THEN** a raiz com enrollment `root_legacy` continua excluída do mensal
- **AND** `launch_at` e `individual_launch_at` não são alterados
- **AND** contas antigas permanecem no mensal quando não há enrollment legado

#### Scenario: Configuração legada intacta

- **WHEN** a oferta é habilitada ou o marco da F50.4 é ativado
- **THEN** as env vars e a chave de idempotência mensal permanecem as mesmas
- **AND** nenhuma alteração global no mensal é feita

#### Scenario: Mensal concorrente com trial, demo e exceção

- **WHEN** o mensal processa uma raiz concorrentemente com inscrição, demo ou exceção administrativa
- **THEN** adquire o advisory de raiz antes de tocar no saldo do recipiente
- **AND** a decisão observa o estado commitado pela outra operação
- **AND** não há concessão duplicada nem deadlock por ordem invertida
