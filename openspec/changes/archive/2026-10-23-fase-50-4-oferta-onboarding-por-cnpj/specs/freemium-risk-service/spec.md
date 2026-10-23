## MODIFIED Requirements

### Requirement: evaluateFreemiumEligibility — motor de decisão determinístico

O sistema SHALL prover `evaluateFreemiumEligibility(input: FreemiumEligibilityInput): FreemiumEligibilityOutput` que avalia a elegibilidade do freemium com base em regras determinísticas (sem ML, sem IA) — ordem revisada **D10** e motivos **D8/D9/D7**, com separação entre a restrição legada por raiz e a elegibilidade da oferta F50.4 por CNPJ completo.

```typescript
interface FreemiumEligibilityInput {
  cnpj: string;
  storeName: string;
  city: string | null;
  state: string | null;
  segment: string;
  officialData: CnpjLookupData | null;
  lookupOutcome: 'resolved' | 'not_found' | 'unavailable';
  rootHash: string;
  rootEligible: boolean; // política legada por raiz
  policyCohort?: 'root_legacy' | 'per_cnpj_f50_4'; // resolvido externamente
  beneficiaryEligible?: boolean; // política por CNPJ completo na coorte F50.4
}

interface FreemiumEligibilityOutput {
  decision: "approved" | "review" | "reject" | "defer";
  reasons: string[];
  score: number;
  signals: {
    nameSimilarity: number | null;
    cityMatch: boolean | null;
    stateMatch: boolean | null;
    cnpjExists: boolean | null;
    situacaoCadastral: string | null;
    rootEligible: boolean | null;
    beneficiaryEligible?: boolean | null;
    cnaeCompatible: CnaeCompatibility | null;
  };
}
```

**Pré-gate do caller/rota (D7):** cidade/UF ausentes (`null`/vazias) na loja são verificadas **antes** de chamar `evaluateFreemiumEligibility` — a loja permanece draft/unverified, sem avaliação, sem review e sem concessão. O motor só é invocado com `city`/`state` preenchidos e NUNCA emite um quinto retorno ("draft") — seu contrato permanece `"approved" | "review" | "reject" | "defer"`.

**Ordem do motor (D10):**
1. CNPJ existe (resolved)? NÃO → reject `cnpj_not_found` / defer `api_unavailable` (sem dados)
2. Situação cadastral normalizada == `ATIVA`? (`BAIXADA` → reject `cnpj_baixada`; `NULA` → reject `cnpj_nula`; não-vazia e outro valor → review `situacao_nao_ativa`; ausente/inválida em resposta resolvida → defer `dados_oficiais_incompletos`)
3. Restrição de benefício:
   - `policyCohort = 'per_cnpj_f50_4'`: se `beneficiaryEligible === false` → reject `beneficiary_already_used`; `rootEligible` NÃO é usado para rejeitar por outra filial;
   - caso contrário (`root_legacy` ou coorte ausente): se `rootEligible === false` → reject `root_already_used`
4. Similaridade nome (informado × oficial) ≥ 0.6? NÃO → review `nome_divergente`
5. Cidade/UF (sempre preenchidas aqui — pré-gate): sem correspondência oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente`
6. Segmento × CNAE: `incompatible` → review `segmento_cnae_divergente` (nunca reject)
7. Senão → approved (score final ≥ 60)

O motor SHALL permanecer puro, sem consultar Supabase. Os callers SHALL resolver `policyCohort` e `beneficiaryEligible` server-side. Na coorte `root_legacy`, `beneficiaryEligible` SHALL espelhar `rootEligible` e o comportamento existente SHALL ser preservado.

#### Scenario: APPROVED quando todos os sinais são positivos

- **WHEN** `officialData` existe com `situacao_cadastral = 'ATIVA'`
- **AND** a restrição de benefício aplicável é elegível
- **AND** `nameSimilarity >= 0.6`
- **AND** `cityMatch = true`
- **AND** `stateMatch = true`
- **THEN** `decision = 'approved'`
- **AND** `reasons` vazio ou vazio de impedimentos

#### Scenario: APPROVED via nome fantasia

- **WHEN** `storeName` diverge da razão social mas coincide com o nome fantasia
- **AND** demais sinais positivos
- **THEN** `decision = 'approved'`

#### Scenario: REJECT quando CNPJ não encontrado

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

#### Scenario: REJECT legado por raiz já usada

- **WHEN** `policyCohort = 'root_legacy'` e `rootEligible = false`
- **THEN** `decision = 'reject'`
- **AND** `reasons` contém `root_already_used`
- **AND** `beneficiaryEligible` não altera a decisão legada

#### Scenario: Nova coorte não usa restrição de raiz

- **WHEN** `policyCohort = 'per_cnpj_f50_4'`, `rootEligible = false` e `beneficiaryEligible = true`
- **THEN** o motor NÃO emite `root_already_used`
- **AND** a decisão segue os demais sinais (não é rejeitada pela raiz)
- **AND** a filial pode ser aprovada se os outros critérios forem satisfeitos

#### Scenario: Nova coorte rejeita benefício do mesmo CNPJ

- **WHEN** `policyCohort = 'per_cnpj_f50_4'` e `beneficiaryEligible = false`
- **THEN** `decision = 'reject'`
- **AND** `reasons` contém `beneficiary_already_used`
- **AND** `reasons` NÃO contém `root_already_used`

#### Scenario: Coorte ausente preserva compatibilidade

- **WHEN** `policyCohort` não é informado e `rootEligible = false`
- **THEN** o comportamento legado é preservado com `root_already_used`
- **AND** nenhum caller existente quebra

#### Scenario: REVIEW por nome divergente

- **WHEN** `nameSimilarity < 0.6` e os demais critérios permitem avaliação
- **THEN** `decision = 'review'`
- **AND** `reasons` contém `nome_divergente`

#### Scenario: Sinal de beneficiário é exposto

- **WHEN** `beneficiaryEligible` é informado
- **THEN** `signals.beneficiaryEligible` reflete o valor
- **AND** o score e a ordem D10 permanecem determinísticos

## ADDED Requirements

### Requirement: Mensagem de restrição compatível com a coorte

O sistema SHALL NOT apresentar a mensagem “Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas.” quando a loja é elegível à oferta F50.4. Para a coorte `per_cnpj_f50_4`, mensagens de restrição SHALL se referir ao benefício do mesmo CNPJ completo, quando aplicável, e SHALL NOT prometer “créditos de boas-vindas” que a política legada não concede à filial.

A mensagem SHALL continuar segura, sem expor CNPJ completo, `root_hash` ou dados de outra filial.

#### Scenario: Filial elegível não recebe mensagem de raiz usada

- **WHEN** a filial tem CNPJ completo novo e é elegível à F50.4, mas a raiz já usou o onboarding legado
- **THEN** a resposta não usa a mensagem de “já utilizou o benefício” por causa da raiz
- **AND** a loja é criada e pode seguir o onboarding da oferta

#### Scenario: Mesmo CNPJ recebe mensagem própria

- **WHEN** o mesmo CNPJ completo já consumiu benefício inicial
- **THEN** a resposta informa a restrição do benefício sem dados de outra loja
- **AND** nenhum enrollment ou crédito é apresentado como disponível

#### Scenario: Coorte legada preserva a mensagem atual

- **WHEN** a conta é `root_legacy` e a raiz restringe o benefício
- **THEN** a mensagem legada de raiz permanece válida
- **AND** nenhum dado sigiloso é exposto
