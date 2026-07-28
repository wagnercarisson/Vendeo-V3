## ADDED Requirements

### Requirement: evaluateFreemiumEligibility — motor de decisão determinístico

O sistema SHALL prover `evaluateFreemiumEligibility(input: FreemiumEligibilityInput): FreemiumEligibilityOutput` que avalia a elegibilidade do freemium com base em regras determinísticas (sem ML, sem IA).

```typescript
interface FreemiumEligibilityInput {
  cnpj: string;
  storeName: string;
  city: string;
  state: string;
  segment: string;
  officialData: CnpjLookupData | null;
  lookupOutcome: 'resolved' | 'not_found' | 'unavailable';
  userId: string;
  storeId?: string;
  rootHash: string;
}

interface FreemiumEligibilityOutput {
  decision: "approve" | "review" | "reject" | "defer";
  reasons: string[];
  score: number; // 0-100
  signals: {
    nameSimilarity: number | null;
    cityMatch: boolean | null;
    stateMatch: boolean | null;
    cnpjExists: boolean | null;
    situacaoCadastral: string | null;
    rootEligible: boolean | null;
    cnaeCompatible: boolean | null; // sinal fraco, sempre null na F33
  };
}
```

#### Scenario: APPROVE quando todos os sinais são positivos

- **WHEN** `officialData` existe com `situacao_cadastral = 'ATIVA'`
- **AND** `rootEligible = true`
- **AND** `nameSimilarity >= 0.6` (com razão social ou nome fantasia)
- **AND** `cityMatch = true`
- **AND** `stateMatch = true`
- **THEN** `decision = 'approve'`
- **AND** `reasons` vazio ou vazio de impedimentos

#### Scenario: APPROVE via nome fantasia

- **WHEN** `storeName` diverge da razão social (similarity < 0.6)
- **BUT** `storeName` coincide com nome fantasia (similarity >= 0.6)
- **AND** demais sinais positivos
- **THEN** `decision = 'approve'`

#### Scenario: REJECT quando CNPJ não encontrado (not_found)

- **WHEN** `lookupOutcome = 'not_found'`
- **THEN** `decision = 'reject'`
- **AND** `reasons` contém `cnpj_not_found`

#### Scenario: REJECT quando situação cadastral é BAIXADA

- **WHEN** `situacaoCadastral = 'BAIXADA'`
- **THEN** `decision = 'reject'`
- **AND** `reasons` contém `cnpj_baixada`

#### Scenario: REJECT quando situação cadastral é NULA

- **WHEN** `situacaoCadastral = 'NULA'`
- **THEN** `decision = 'reject'`
- **AND** `reasons` contém `cnpj_nula`

#### Scenario: REJECT quando root não é elegível

- **WHEN** `rootEligible = false` (raiz já recebeu onboarding)
- **THEN** `decision = 'reject'`
- **AND** `reasons` contém `root_already_used`

#### Scenario: REVIEW quando situação é SUSPENSA

- **WHEN** `situacaoCadastral = 'SUSPENSA'`
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `situacao_suspensa`

#### Scenario: REVIEW quando nome diverge

- **WHEN** `nameSimilarity < 0.6` (com ambos razão social e nome fantasia)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `nome_divergente`

#### Scenario: REVIEW quando cidade diverge

- **WHEN** `cityMatch = false` (cidade informada ≠ cidade oficial)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `cidade_divergente`

#### Scenario: REVIEW quando UF diverge

- **WHEN** `stateMatch = false` (UF informada ≠ UF oficial)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `uf_divergente`

#### Scenario: DEFER quando lookup está indisponível (ambos provedores falham)

- **WHEN** `lookupOutcome = 'unavailable'`
- **THEN** `decision = 'defer'`
- **AND** `reasons` contém `api_unavailable`

#### Scenario: CNAE não influencia decisão na F33

- **WHEN** qualquer cenário de decisão
- **THEN** `signals.cnaeCompatible = null`
- **AND** CNAE não influencia approve/review/reject/defer

### Requirement: normalizeCity — comparação ignorando acentos e case

O sistema SHALL prover `normalizeCity(city: string): string` que normaliza a cidade removendo acentos, convertendo para maiúsculas, e removendo espaços extras para comparação.

#### Scenario: Cidades com acentos e case diferentes são consideradas iguais

- **WHEN** `normalizeCity("São Paulo")` é comparado com `normalizeCity("SAO PAULO")`
- **THEN** são iguais

#### Scenario: Cidades diferentes são detectadas

- **WHEN** `normalizeCity("São Paulo")` é comparado com `normalizeCity("São Bernardo do Campo")`
- **THEN** são diferentes
