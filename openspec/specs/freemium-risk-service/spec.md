> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED), then `fase-42-signup-controlado-elegibilidade-freemium` (MODIFIED). Ordem D10, novos motivos D8/D9/D7, pré-gate de cidade/UF no caller, `decision` `"approved"` e `cnaeCompatible` preenchido.

## Purpose

Motor de decisão determinístico `evaluateFreemiumEligibility` que avalia elegibilidade do freemium com base em sinais de verossimilhança (nome, cidade, UF, situação cadastral, elegibilidade da raiz) e regras determinísticas — approve/review/reject/defer.

## Requirements

### Requirement: evaluateFreemiumEligibility — motor de decisão determinístico

O sistema SHALL prover `evaluateFreemiumEligibility(input: FreemiumEligibilityInput): FreemiumEligibilityOutput` que avalia a elegibilidade do freemium com base em regras determinísticas (sem ML, sem IA) — ordem revisada **D10** e novos motivos **D8/D9/D7**.

```typescript
interface FreemiumEligibilityInput {
  cnpj: string;
  storeName: string;
  city: string | null; // reflete a loja no banco (nullable); o pre-gate do caller/rota impede chamadas com null (D7)
  state: string | null; // reflete a loja no banco (nullable); o pre-gate do caller/rota impede chamadas com null (D7)
  segment: string;
  officialData: CnpjLookupData | null;
  lookupOutcome: 'resolved' | 'not_found' | 'unavailable';
  rootHash: string;
  rootEligible: boolean; // resolvido externamente — NÃO consultar Supabase dentro da função
}

interface FreemiumEligibilityOutput {
  decision: "approved" | "review" | "reject" | "defer";
  reasons: string[];
  score: number; // 0-100
  signals: {
    nameSimilarity: number | null;
    cityMatch: boolean | null;
    stateMatch: boolean | null;
    cnpjExists: boolean | null;
    situacaoCadastral: string | null;
    rootEligible: boolean | null;
    cnaeCompatible: CnaeCompatibility | null; // "compatible" | "incompatible" | "unknown" — preenchido na F42 (D9)
  };
}
```

**Pré-gate do caller/rota (D7):** cidade/UF ausentes (`null`/vazias) na loja são verificadas **antes** de chamar `evaluateFreemiumEligibility` — a loja permanece draft/unverified, sem avaliação, sem review e sem concessão. O motor só é invocado com `city`/`state` preenchidos e NUNCA emite um quinto retorno ("draft") — seu contrato permanece `"approved" | "review" | "reject" | "defer"`.

**Ordem do motor (D10):**
1. CNPJ existe (resolved)? NÃO → reject `cnpj_not_found` / defer `api_unavailable` (sem dados)
2. Situação cadastral normalizada == `ATIVA`? (`BAIXADA` → reject `cnpj_baixada`; `NULA` → reject `cnpj_nula`; não-vazia e outro valor → review `situacao_nao_ativa`; ausente/inválida em resposta resolvida → defer `dados_oficiais_incompletos`) — **D8**
3. Raiz CNPJ já usada? SIM → reject `root_already_used`
4. Similaridade nome (informado × oficial) ≥ 0.6? NÃO → review `nome_divergente`
5. Cidade/UF (sempre preenchidas aqui — pré-gate): sem correspondência oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente` — **D7**
6. Segmento × CNAE: `incompatible` → review `segmento_cnae_divergente` (nunca reject) — **D9**
7. Senão → approved (score final ≥ 60)

Score/signals preservados (score final ≥ 60 para approved) com `cnaeCompatible` agora preenchido (antes `null`).

#### Scenario: APPROVED quando todos os sinais são positivos

- **WHEN** `officialData` existe com `situacao_cadastral = 'ATIVA'`
- **AND** `rootEligible = true`
- **AND** `nameSimilarity >= 0.6` (com razão social ou nome fantasia)
- **AND** `cityMatch = true`
- **AND** `stateMatch = true`
- **THEN** `decision = 'approved'`
- **AND** `reasons` vazio ou vazio de impedimentos

#### Scenario: APPROVED via nome fantasia

- **WHEN** `storeName` diverge da razão social (similarity < 0.6)
- **BUT** `storeName` coincide com nome fantasia (similarity >= 0.6)
- **AND** demais sinais positivos
- **THEN** `decision = 'approved'`

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

#### Scenario: REVIEW quando situação é INAPTA (corrige lacuna F33)

- **WHEN** `situacaoCadastral = 'INAPTA'` (situação não-vazia ≠ ATIVA/BAIXADA/NULA)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `situacao_nao_ativa`

#### Scenario: REVIEW quando situação é SUSPENSA (substitui situacao_suspensa no motor)

- **WHEN** `situacaoCadastral = 'SUSPENSA'` (situação não-vazia ≠ ATIVA/BAIXADA/NULA)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `situacao_nao_ativa` (novas avaliações NÃO emitem mais `situacao_suspensa` — legado de histórico, D8)

#### Scenario: DEFER quando situação ausente/inválida em resposta resolvida

- **WHEN** `lookupOutcome = 'resolved'`
- **AND** `situacaoCadastral` é `null`/vazia/não normalizável
- **THEN** `decision = 'defer'`
- **AND** `reasons` contém `dados_oficiais_incompletos` (nunca aprova; não gera review ruidoso)

#### Scenario: REVIEW quando nome diverge

- **WHEN** `nameSimilarity < 0.6` (com ambos razão social e nome fantasia)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `nome_divergente`

#### Scenario: Pré-gate — cidade/UF ausentes deixam a loja em draft sem avaliação

- **WHEN** a loja não preencheu `city`/`state` no formulário (`city = null` e/ou `state = null`)
- **THEN** o **caller/rota NÃO chama `evaluateFreemiumEligibility`** (pré-gate D7)
- **AND** a loja permanece **draft/unverified**, sem avaliação e sem review (sem ruído na fila admin)
- **AND** não há aprovação automática nem concessão
- **AND** o motor nunca é consultado com `city`/`state` nulos — seu contrato não expõe estado "draft"

#### Scenario: REVIEW quando cidade/UF preenchidas mas oficiais ausentes

- **WHEN** a loja preencheu `city`/`state`
- **AND** o provedor não fornece dados de localização (sem correspondência oficial)
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `localizacao_oficial_indisponivel`

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

#### Scenario: REVIEW quando segmento × CNAE é incompatible (nunca reject)

- **WHEN** `cnaeCompatible = "incompatible"` (CNAE principal na lista negativa explícita do segmento)
- **AND** demais sinais não configuram rejection puro
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `segmento_cnae_divergente`
- **AND** NUNCA é `reject` apenas por CNAE

#### Scenario: CNAE unknown não influencia a decisão

- **WHEN** `cnaeCompatible = "unknown"` (ausente, inválido ou fora das listas)
- **AND** demais sinais positivos
- **THEN** o sinal CNAE não penaliza — segue a avaliação dos demais sinais

#### Scenario: DEFER quando lookup está indisponível (ambos provedores falham)

- **WHEN** `lookupOutcome = 'unavailable'`
- **THEN** `decision = 'defer'`
- **AND** `reasons` contém `api_unavailable`

#### Scenario: Ordem do motor — situação não ATIVA antes de raiz/nome/cidade/UF

- **WHEN** uma loja tem `situacaoCadastral = 'INAPTA'` E `rootEligible = false`
- **THEN** o motor avalia a situação primeiro (D10 ordem 2)
- **AND** retorna `review` com `situacao_nao_ativa` (não `reject root_already_used`, pois a situação é avaliada antes da raiz)

### Requirement: normalizeCity — comparação ignorando acentos e case

O sistema SHALL prover `normalizeCity(city: string): string` que normaliza a cidade removendo acentos, convertendo para maiúsculas, e removendo espaços extras para comparação.

#### Scenario: Cidades com acentos e case diferentes são consideradas iguais

- **WHEN** `normalizeCity("São Paulo")` é comparado com `normalizeCity("SAO PAULO")`
- **THEN** são iguais

#### Scenario: Cidades diferentes são detectadas

- **WHEN** `normalizeCity("São Paulo")` é comparado com `normalizeCity("São Bernardo do Campo")`
- **THEN** são diferentes
