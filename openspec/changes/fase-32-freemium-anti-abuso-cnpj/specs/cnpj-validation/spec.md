## ADDED Requirements

### Requirement: validateCnpj — valida dígitos verificadores e formato

O sistema SHALL prover uma função `validateCnpj(raw: string)` que normaliza (remove não dígitos), valida comprimento = 14, valida dígitos verificadores (algoritmo oficial do CNPJ) e rejeita sequências conhecidas (11.111.111/...., 00.000.000/...., etc.). Retorna `{ normalized: string }` ou `Error`. O root_hash não faz parte do retorno — o hash é calculado apenas dentro da RPC (service_role) ou via `hashCnpjRoot()` em contexto de servidor/teste.

#### Scenario: CNPJ válido com pontuação é normalizado

- **WHEN** `validateCnpj("12.345.678/0001-90")` é chamado
- **THEN** retorna `{ normalized: "12345678000190" }`

#### Scenario: CNPJ válido apenas dígitos é normalizado

- **WHEN** `validateCnpj("12345678000190")` é chamado
- **THEN** retorna `{ normalized: "12345678000190" }`

#### Scenario: CNPJ com dígitos inválidos retorna erro

- **WHEN** `validateCnpj("12.345.678/0001-00")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`

#### Scenario: CNPJ com comprimento inválido retorna erro

- **WHEN** `validateCnpj("12.345.678/0001")` ou `validateCnpj("12.345.678/0001-9000")` é chamado
- **THEN** retorna `new Error("CNPJ deve ter 14 dígitos")`

#### Scenario: CNPJ com sequência conhecida retorna erro

- **WHEN** `validateCnpj("11.111.111/0001-11")` ou `validateCnpj("00.000.000/0001-00")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`

#### Scenario: CNPJ vazio retorna erro

- **WHEN** `validateCnpj("")` é chamado
- **THEN** retorna `new Error("CNPJ deve ter 14 dígitos")`

#### Scenario: CNPJ com letras retorna erro

- **WHEN** `validateCnpj("AB.CDE.FGH/0001-00")` é chamado
- **THEN** retorna `new Error("CNPJ deve ter 14 dígitos")`

### Requirement: hashCnpjRoot — HMAC-SHA256 da raiz com pepper (uso restrito)

O sistema SHALL prover `hashCnpjRoot(root: string): string` que calcula HMAC-SHA256 dos 8 primeiros dígitos com pepper server-side. O pepper nunca está no código ou no banco. Esta função é de uso restrito — na produção, o hash é calculado dentro da RPC (service_role). `hashCnpjRoot()` é usada em testes e em contexto de servidor para validação/verificação.

#### Scenario: root_hash calculado corretamente

- **WHEN** `hashCnpjRoot("12345678")` é chamado em contexto de servidor/teste
- **THEN** retorna HMAC-SHA256("12345678", pepper) como hex string

### Requirement: maskCnpj — mascaramento seguro

O sistema SHALL prover `maskCnpj(normalized: string): string` que mascara o CNPJ normalizado (14 dígitos) no formato `**.***.***/YYYY-**`. Os 8 primeiros dígitos e os 2 dígitos verificadores são substituídos por `*`. O sufixo YYYY é preservado para identificação do estabelecimento. Formato único para UI, admin e APIs.

#### Scenario: CNPJ mascarado correto

- **WHEN** `maskCnpj("12345678000190")` é chamado
- **THEN** retorna `"**.***.***/0001-**"`

### Requirement: normalizeCnpj — apenas dígitos

O sistema SHALL prover `normalizeCnpj(raw: string): string` que remove tudo que não é dígito.

#### Scenario: CNPJ com pontuação normalizado

- **WHEN** `normalizeCnpj("12.345.678/0001-90")` é chamado
- **THEN** retorna `"12345678000190"`

### Requirement: compareBusinessName — similaridade textual para validação cadastral

O sistema SHALL prover `compareBusinessName(name: string, razaoSocial: string, nomeFantasia?: string): CnpjValidationScore` que calcula similaridade textual (Levenshtein ou Jaro-Winkler) e retorna score. A validação cadastral é score, não bloqueio — o fluxo nunca é interrompido.

#### Scenario: Nome coincide com razão social → score alto

- **WHEN** `compareBusinessName("Loja ABC LTDA", "Loja ABC LTDA")` é chamado
- **THEN** o score é ≥ 0.8

#### Scenario: Nome diverge da razão social → score baixo, fluxo não bloqueado

- **WHEN** `compareBusinessName("Minha Loja", "ABC Comércio Ltda")` é chamado
- **THEN** o score é < 0.8
- **AND** nenhum erro é lançado
- **AND** o score é registrado em `stores.cnpj_validation_score`