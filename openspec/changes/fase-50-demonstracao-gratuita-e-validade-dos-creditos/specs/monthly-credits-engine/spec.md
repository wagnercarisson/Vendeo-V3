# Monthly Credits Engine

> Delta spec para `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D9). A concessão mensal automática é descontinuada; `grant_monthly_credits` permanece como legado/deprecada (rollback).

## MODIFIED Requirements

### Requirement: grant_monthly_credits RPC function

O sistema SHALL descontinuar a execução automática de `grant_monthly_credits` **no corte** (D15): nenhuma nova concessão mensal ocorre após a vigência da F50. Até o corte, o mensal permanece ativo (`monthlyCreditsEnabled` default `true`). A RPC e `try_grant_monthly_entitlement` permanecem no schema como **legado/deprecadas** para rollback estrutural, sem serem chamadas pelo cron ou pela UI após o corte.

> **Delta F50 (D9):** concessão mensal encerrada no corte (coordenado com a vigência da v1.5 e a ativação da demo). `bonus_monthly` permanece um tipo histórico válido (não removido do CHECK); nenhum novo grant `bonus_monthly` é emitido após o corte.

#### Scenario: Nenhum novo grant mensal após o corte

- **WHEN** a F50 está ativa (corte executado)
- **THEN** `grant_monthly_credits` não é invocada por cron nem pela UI
- **AND** nenhuma transação `bonus_monthly` nova é criada

#### Scenario: Mensal preservado até o corte

- **WHEN** o deploy roda antes do corte
- **THEN** `monthlyCreditsEnabled` permanece `true` (nenhuma janela de vácuo)

#### Scenario: Saldos mensais legados preservados

- **WHEN** um usuário possui `bonus_monthly` histórico
- **THEN** o saldo permanece (bônus não-expirável) e não sofre expiração retroativa
