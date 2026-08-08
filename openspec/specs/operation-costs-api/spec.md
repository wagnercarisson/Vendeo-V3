# Operation Costs API

> Synced from `fase-38-credit-operation-costs` (ADDED).

## Purpose

Dados de custo para componentes client e server: `GET /api/operation-costs` (autenticado, D11) retornando custos resolvidos `{ costCredits, enabled }`, hook compartilhado `useOperationCosts()` (client) e leitura direta de `OperationCostService` por server components — sem expor dados admin (`updated_by`/`updated_at`/`source`).

## Requirements

### Requirement: GET /api/operation-costs (autenticado)

O sistema SHALL expor `GET /api/operation-costs` (requer login — apiHandler, padrão do repositório) para componentes client (D11), retornando os custos **resolvidos**:

```
GET /api/operation-costs        (requer login — apiHandler)
  → 200 { "campaign_generation": { costCredits, enabled },
          "visual_signature_generation": { costCredits, enabled } }
```

- Retorna custos **resolvidos** (tabela ou fallback de linha inexistente) — exatamente o que a UI precisa
- **Erro real de leitura** → `503 operation_cost_unavailable` (fail-closed, D5) — a UI trata como "custos indisponíveis" (não mostra "1 crédito" presumido)
- **Não expõe `updated_by`/`updated_at`/`source`** (dados admin); só custo + habilitação

#### Scenario: Retorna custos resolvidos para todas as chaves

- **WHEN** um usuário autenticado chama `GET /api/operation-costs`
- **THEN** retorna `200` com `{ "campaign_generation": { costCredits, enabled }, "visual_signature_generation": { costCredits, enabled } }` (valores resolvidos da tabela ou do fallback)

#### Scenario: Não expõe dados admin

- **WHEN** um usuário autenticado chama `GET /api/operation-costs`
- **THEN** a resposta NÃO contém `updated_by`, `updated_at` nem `source`

#### Scenario: Sem login retorna 401/403

- **WHEN** um usuário não autenticado chama `GET /api/operation-costs`
- **THEN** retorna `401`/`403` (apiHandler)

#### Scenario: Erro real de leitura retorna 503 operation_cost_unavailable

- **WHEN** o `OperationCostService` lança `OperationCostUnavailableError` ao resolver os custos
- **THEN** retorna `503` com `{ error: "operation_cost_unavailable", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }` (fail-closed)

### Requirement: Hook client useOperationCosts

O sistema SHALL prover o hook compartilhado client `useOperationCosts()` em `src/hooks/use-operation-costs.ts` (D11) — fetch + cache do endpoint `GET /api/operation-costs`, um único contrato para form e modais:

- Retorna os custos resolvidos `{ [operationKey]: { costCredits, enabled } }`
- Estados de loading e erro (o erro de `503 operation_cost_unavailable` é exposto como "custos indisponíveis")
- `campaign-input-form`, `balance-card`, `drift-critical-modal` e `visual-signature-approval-modal` usam o mesmo hook

#### Scenario: Hook retorna custos carregados

- **WHEN** `useOperationCosts()` é usado e o fetch resolve com sucesso
- **THEN** retorna os custos resolvidos para as chaves conhecidas

#### Scenario: Hook expõe estado indisponível em erro de leitura

- **WHEN** o fetch responde `503 operation_cost_unavailable`
- **THEN** o hook expõe estado de "custos indisponíveis" (a UI NÃO mostra "1 crédito" presumido)

#### Scenario: Hook expõe loading

- **WHEN** o fetch ainda não resolveu
- **THEN** o hook expõe estado de loading

### Requirement: Server components leem o service direto

O sistema SHALL permitir que **server components** (`balance-display`, páginas server) leiam `OperationCostService` diretamente (import server-only, D11) em vez do endpoint:

- **Handlers HTTP** capturam `OperationCostUnavailableError` e respondem `503 operation_cost_unavailable` (o status HTTP é responsabilidade do handler/página)
- **Server components** renderizam estado indisponível (ex.: custo "indisponível", sem "1 crédito" presumido) ou propagam o erro para o handler/página decidir o status — um componente não emite status HTTP diretamente
- Server components NÃO dependem do endpoint (sem roundtrip desnecessário)

#### Scenario: Server component lê o service

- **WHEN** um server component precisa do custo de uma operação
- **THEN** chama `OperationCostService.getCost(operationKey)` diretamente (server-only)

#### Scenario: Handler HTTP converte erro em 503

- **WHEN** um handler HTTP captura `OperationCostUnavailableError` lançado pelo `getCost`
- **THEN** responde `503` com `{ error: "operation_cost_unavailable", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." }`

#### Scenario: Server component renderiza estado indisponível em erro de leitura

- **WHEN** o `getCost` do service lança `OperationCostUnavailableError` num server component
- **THEN** o componente renderiza estado indisponível (sem custo presumido) ou delega a decisão de status ao handler/página
