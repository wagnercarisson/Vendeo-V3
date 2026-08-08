# Operation Cost Service

> Synced from `fase-38-credit-operation-costs` (ADDED).

## Purpose

Camada de tipos e serviço de resolução de custo por operação (D5/D6/D7): enum versionado `OPERATION_KEYS`/`OperationKey` em `src/lib/credit/types.ts` (sem server-only), `OperationCostService.getCost` (server-only) com fonte `credit_operation_costs` + fallback seguro fail-open (linha inexistente), `OperationCostUnavailableError` fail-closed (erro real de leitura) e `OperationCostSnapshot` para o metadata do ledger.

## Requirements

### Requirement: Enum versionado OperationKey

O sistema SHALL definir o enum versionado das chaves de operação em `src/lib/credit/types.ts` (D7), como fonte da verdade das chaves — junto com `OperationKey`, `OperationCostResolution` e `OperationCostSnapshot` (um único módulo de tipos, sem server-only):

```typescript
export const OPERATION_KEYS = ["campaign_generation", "visual_signature_generation"] as const;
export type OperationKey = (typeof OPERATION_KEYS)[number];
```

- O enum TS é a **fonte da verdade das chaves**; a tabela é povoada pelo seed com as mesmas chaves
- `OperationCostService` (server-only) importa `OPERATION_KEYS`/`OperationKey`/`OperationCostResolution` de `src/lib/credit/types.ts` — nunca define tipos de operação no próprio service, evitando import acidental de código server-only em schema/zod/UI
- F37 (aprovação/regeração) e temas entram como **novos itens no enum + seeds** — sem tocar em rotas existentes que não os consumam
- Chaves futuras previstas (fora desta fase): `campaign_regeneration`, `campaign_approval`, `theme_generation`, etc.

#### Scenario: OPERATION_KEYS contém as chaves iniciais

- **WHEN** `OPERATION_KEYS` é importado
- **THEN** contém `["campaign_generation", "visual_signature_generation"]`

#### Scenario: OperationKey deriva do array

- **WHEN** `OperationKey` é usado como tipo
- **THEN** aceita `"campaign_generation"` e `"visual_signature_generation"` e rejeita chaves desconhecidas em compile time

### Requirement: OperationCostService.getCost com fonte primária e fallback seguro

O sistema SHALL prover `OperationCostService` em `src/lib/credit/operation-cost-service.ts` (import `server-only`), com o contrato (D5/D6):

```typescript
import "server-only";
import type { OperationCostResolution, OperationKey } from "./types";

export class OperationCostService {
  constructor(client?: SupabaseClient);   // default supabaseAdmin

  // Resolve o custo de uma operação. Fonte primária: credit_operation_costs.
  //  - linha existente            → source 'table'
  //  - linha inexistente          → default seguro, source 'fallback' (fail-open)
  //  - erro real de leitura       → LANÇA OperationCostUnavailableError (fail-closed)
  //    (nunca retorna enabled presumido quando a tabela não respondeu)
  async getCost(operationKey: OperationKey): Promise<OperationCostResolution>;
}
```

**Semântica de resolução (D5):**

| Situação | Comportamento | source |
|----------|---------------|--------|
| Linha existente | custo/habilitação da tabela | `"table"` |
| Linha inexistente (tabela saudável) | default seguro versionado no código (fail-open) | `"fallback"` |
| Erro real de leitura (rede/banco/query) | **LANÇA** `OperationCostUnavailableError` (fail-closed) | — |

**Defaults versionados no código** (mesma fonte do enum), usados apenas na situação "linha inexistente":

```typescript
const DEFAULT_OPERATION_COSTS: Record<OperationKey, { costCredits: number; enabled: boolean }> = {
  campaign_generation:         { costCredits: 1, enabled: true },
  visual_signature_generation: { costCredits: 1, enabled: true },
};
```

- **Log:** `source: 'fallback'` (linha inexistente) é logado como aviso; `OperationCostUnavailableError` é logado como erro (observabilidade/alerting)
- **`getCost` ignora chaves desconhecidas na tabela** (não consulta) — D7

#### Scenario: getCost com linha na tabela retorna source table

- **WHEN** `getCost("campaign_generation")` é chamado com linha existente na tabela (cost_credits=2, enabled=true)
- **THEN** retorna `{ operationKey: "campaign_generation", costCredits: 2, enabled: true, source: "table" }`

#### Scenario: getCost com linha inexistente usa fallback seguro

- **WHEN** `getCost("campaign_generation")` é chamado e a tabela não tem linha para a operação
- **THEN** retorna `{ operationKey: "campaign_generation", costCredits: 1, enabled: true, source: "fallback" }`

#### Scenario: fallback de visual_signature_generation é 1/habilitado

- **WHEN** `getCost("visual_signature_generation")` é chamado e a tabela não tem linha
- **THEN** retorna `{ costCredits: 1, enabled: true, source: "fallback" }`

#### Scenario: getCost com erro real de leitura lança OperationCostUnavailableError

- **WHEN** a query falha por erro real (rede/banco/erro da query) ao resolver `campaign_generation`
- **THEN** o método LANÇA `OperationCostUnavailableError` (nunca retorna `enabled` presumido)

#### Scenario: getCost retorna enabled false quando a tabela diz false

- **WHEN** `getCost("campaign_generation")` é chamado com linha existente com `enabled=false`
- **THEN** retorna `{ enabled: false, source: "table" }`

#### Scenario: getCost ignora chaves desconhecidas

- **WHEN** a tabela contém uma linha com `operation_key` fora do enum (ex.: `foo_bar`)
- **THEN** `getCost` NÃO consulta essa chave (chaves desconhecidas ignoradas — D7)

#### Scenario: fallback logado como aviso

- **WHEN** `getCost` cai em `source: "fallback"` (linha inexistente)
- **THEN** um log de aviso é emitido (observabilidade)

#### Scenario: erro de leitura logado como erro

- **WHEN** `getCost` lança `OperationCostUnavailableError`
- **THEN** um log de erro é emitido (observabilidade/alerting)

### Requirement: OperationCostUnavailableError (fail-closed)

O sistema SHALL definir a classe `OperationCostUnavailableError` em `src/lib/credit/operation-cost-service.ts` (D5), usada para **erro real de leitura** (rede/banco/query) — o sistema **não sabe** se a operação foi desligada:

```typescript
export class OperationCostUnavailableError extends Error {
  constructor(public readonly operationKey: OperationKey) {
    super(`credit_operation_costs indisponível para ${operationKey}`);
    this.name = "OperationCostUnavailableError";
  }
}
```

- As rotas capturam e respondem `503 operation_cost_unavailable` (D12)
- **Nunca** retorna resolução (`enabled` presumido) nesse caminho — a disponibilidade é desconhecida
- Erro de leitura **nunca** é tratado como custo zero nem como `enabled:true`

#### Scenario: erro de leitura não retorna resolução

- **WHEN** a query falha ao resolver uma operação
- **THEN** nenhuma `OperationCostResolution` é retornada
- **AND** `OperationCostUnavailableError` é lançado com o `operationKey` da operação

### Requirement: Tipos de snapshot no metadata do ledger

O sistema SHALL definir o tipo `OperationCostSnapshot` em `src/lib/credit/types.ts` (D6 — ledger auto-descritivo), gravado no metadata da deduction — junto de `OPERATION_KEYS`, `OperationKey` e `OperationCostResolution`:

```typescript
export interface OperationCostSnapshot {
  operation_key: OperationKey;
  operation_cost_credits: number;
  operation_cost_source: "table" | "fallback";
}
```

- O snapshot torna o ledger **auto-descritivo**: dá para responder "essa geração custou X créditos, resolvido da tabela/fallback" mesmo se o admin mudar o custo depois
- `reserve_credit` (F24) permanece **inalterado** — o custo é resolvido no service layer e o snapshot anexado no metadata da chamada

#### Scenario: snapshot contém chave, custo e source

- **WHEN** uma deduction de `campaign_generation` é gravada
- **THEN** o metadata da transação contém `operation_key: "campaign_generation"`, `operation_cost_credits` e `operation_cost_source` ("table" ou "fallback")

#### Scenario: reserve_credit assinatura inalterada

- **WHEN** `reserveCredit` é chamado com o custo resolvido
- **THEN** o RPC `reserve_credit` (F24) não recebe parâmetro de operação (custo resolvido no service layer)
