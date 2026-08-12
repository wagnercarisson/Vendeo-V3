## MODIFIED Requirements

### Requirement: EconomicParameterService (fail-open / fail-closed)

O sistema SHALL manter a classe `EconomicParameterService` em `src/lib/economic/economic-parameter-service.ts` (server-only, padrão `OperationCostService` F38) com a semântica atual, documentando o papel dos valores correntes:

```typescript
import "server-only";

export class EconomicParameterUnavailableError extends Error { /* fail-closed */ }

export class EconomicParameterService {
  constructor(client?: SupabaseClient);   // default supabaseAdmin
  async getParameter(key: EconomicParameterKey): Promise<EconomicParameterResolution>;
  async getAll(): Promise<EconomicParameterResolution[]>;
}
```

- **`getParameter(key)`** → linha existente → `{ key, value, source: 'table' }`; linha inexistente → default seguro **1.00** com `source: 'fallback'` (fail-open, log aviso); **erro real de leitura** → lança `EconomicParameterUnavailableError` (fail-closed)
- **`getAll()`** → mescla tabela + fallback para as duas chaves, expondo `source` para o admin
- **Semântica de uso:** o valor corrente retornado por `getParameter`/`getAll` é o valor **vigente para novas gerações** — a F38.2.1 passa a usar o snapshot `*_at_generation` em `generation_events` para o histórico; o valor corrente serve como **fallback explícito** para eventos sem snapshot
- Sem alteração de assinatura: os snapshots são resolvidos pelos callers (início do run) e persistidos no tracker

#### Scenario: linha existente → source table

- **WHEN** `getParameter('usd_brl_rate')` e a linha existe com valor 5.20
- **THEN** retorna `{ key: 'usd_brl_rate', value: 5.20, source: 'table' }`

#### Scenario: linha inexistente → fallback 1.00

- **WHEN** `getParameter('credit_value_brl')` e a linha não existe
- **THEN** retorna `{ key: 'credit_value_brl', value: 1.00, source: 'fallback' }` (fail-open, log aviso)

#### Scenario: erro real de leitura → fail-closed

- **WHEN** a leitura em `economic_parameters` falha (ex.: RPC error)
- **THEN** `getParameter` lança `EconomicParameterUnavailableError`

#### Scenario: getAll mescla tabela + fallback

- **WHEN** `getAll()` é chamado com uma linha na tabela e outra ausente
- **THEN** retorna as duas chaves, uma com `source: 'table'` e a outra com `source: 'fallback'`

### Requirement: Página /admin/operation-costs — "Configurações Econômicas" + seção de Parâmetros

O sistema SHALL manter a rota `/admin/operation-costs` (não quebra bookmarks/testes/navegação — D2) com **título visual "Configurações Econômicas"** e conter:

1. **Créditos debitados por tipo de entrega** — tabela `credit_operation_costs` existente (F38), inalterada em schema
2. **Seção "Parâmetros Econômicos"** — inputs para `usd_brl_rate` ("Taxa de conversão USD→BRL") e `credit_value_brl` ("Valor operacional do crédito em BRL"), cada um com **motivo obrigatório**, badge `source` (`tabela`/`fallback`), e feedback com `audit_id` após salvar via `PUT /api/admin/economic-parameters`
3. **Aviso de semântica:** a página SHALL exibir um aviso de que **as alterações valem para novas gerações e não recalculam o histórico** (os runs existentes usam o snapshot gravado na geração)

#### Scenario: Título visual "Configurações Econômicas" mantendo rota

- **WHEN** um admin acessa `/admin/operation-costs`
- **THEN** a página renderiza com o título "Configurações Econômicas"
- **AND** a rota continua `/admin/operation-costs` (não há redirect para outro path)

#### Scenario: Seção de parâmetros renderiza com badge source

- **WHEN** a página é renderizada
- **THEN** exibe a seção "Parâmetros Econômicos" com `usd_brl_rate` e `credit_value_brl`, cada um com badge `source` (`tabela` ou `fallback`)

#### Scenario: Página avisa que alteração vale para novas gerações

- **WHEN** a seção de parâmetros é exibida
- **THEN** há um aviso de que alterar `usd_brl_rate`/`credit_value_brl` vale para novas gerações e não recalcula o histórico exibido

#### Scenario: Editar parâmetro exige motivo

- **WHEN** um admin altera `usd_brl_rate` (ou `credit_value_brl`) e clica em salvar sem preencher o motivo
- **THEN** a página bloqueia o save e pede o motivo

#### Scenario: Salvar parâmetro chama PUT e mostra audit_id

- **WHEN** um admin altera `usd_brl_rate` com motivo válido e salva
- **THEN** a página chama `PUT /api/admin/economic-parameters`
- **AND** exibe feedback com o `audit_id` retornado
