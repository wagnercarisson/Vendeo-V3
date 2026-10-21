## MODIFIED Requirements

### Requirement: validateCnpj — valida dígitos verificadores e formato

O sistema SHALL prover uma função `validateCnpj(raw: string)` que aplica a normalização estrita: aceita apenas `[0-9A-Za-z]`, `.`, `/`, `-` e espaços; remove somente a formatação conhecida; converte letras para maiúscula; e rejeita qualquer caractere fora desse conjunto. Valida comprimento = 14, valida que as 12 primeiras posições são `[A-Z0-9]` e que as 2 últimas são `[0-9]`, valida os dois dígitos verificadores pelo algoritmo oficial (módulo 11, valor do caractere = ASCII − 48) e rejeita sequências numéricas conhecidas. Retorna `{ normalized: string }` ou `Error`. O root_hash não faz parte do retorno — o hash é calculado apenas na rota server-side (Next.js) via `hashCnpjRoot()`.

#### Scenario: CNPJ numérico válido com pontuação é normalizado

- **WHEN** `validateCnpj("12.345.678/0001-95")` é chamado
- **THEN** retorna `{ normalized: "12345678000195" }`

#### Scenario: CNPJ numérico válido apenas dígitos é normalizado

- **WHEN** `validateCnpj("12345678000195")` é chamado
- **THEN** retorna `{ normalized: "12345678000195" }`

#### Scenario: CNPJ alfanumérico oficial válido é aceito

- **WHEN** `validateCnpj("12.ABC.345/01DE-35")` é chamado
- **THEN** retorna `{ normalized: "12ABC34501DE35" }`

#### Scenario: CNPJ alfanumérico em minúsculas e com pontuação é canonicalizado

- **WHEN** `validateCnpj("12.abc.345/01de-35")` é chamado
- **THEN** retorna `{ normalized: "12ABC34501DE35" }`

#### Scenario: CNPJ alfanumérico com DV inválido retorna erro

- **WHEN** `validateCnpj("12.ABC.345/01DE-34")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`

#### Scenario: CNPJ numérico com dígitos inválidos retorna erro

- **WHEN** `validateCnpj("12.345.678/0001-00")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`

#### Scenario: CNPJ com comprimento inválido retorna erro

- **WHEN** `validateCnpj("12.345.678/0001")`, `validateCnpj("12.345.678/0001-9000")` ou `validateCnpj("12.ABC.345/01DE")` é chamado
- **THEN** retorna `new Error("CNPJ deve ter 14 caracteres")`

#### Scenario: CNPJ com sequência numérica conhecida retorna erro

- **WHEN** `validateCnpj("11.111.111/0001-11")` ou `validateCnpj("00.000.000/0001-00")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`

#### Scenario: CNPJ vazio retorna erro

- **WHEN** `validateCnpj("")` é chamado
- **THEN** retorna `new Error("CNPJ deve ter 14 caracteres")`

#### Scenario: Letras nas posições de dígito verificador são rejeitadas

- **WHEN** `validateCnpj("12.ABC.345/01DE-3A")` ou `validateCnpj("12.ABC.345/01DE-A5")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`

#### Scenario: Letras A-Z são aceitas nas 12 primeiras posições

- **WHEN** um CNPJ canônico com letras de `A` a `Z` nas 12 primeiras posições e DV oficial válido é validado
- **THEN** retorna `{ normalized }` sem rejeitar a letra
- **AND** letras `I`, `O`, `U`, `Q` e `F` não são rejeitadas nesta fase, pois a restrição não está confirmada na IN RFB nº 2.229/2024

#### Scenario: CNPJ numérico existente não tem valor transformado

- **WHEN** `validateCnpj("12345678000195")` é chamado
- **THEN** o valor retornado é exatamente `"12345678000195"`

#### Scenario: Caractere desconhecido invalida a entrada

- **WHEN** `validateCnpj("12.ABC.345/01DE-35😀")`, `validateCnpj("12.ABC.345/01DE-35!")` ou `validateCnpj("12.ÁBC.345/01DE-35")` é chamado
- **THEN** retorna `new Error("CNPJ inválido")`
- **AND** o caractere desconhecido NÃO é removido para produzir um CNPJ válido

#### Scenario: Espaços e formatação conhecida são tolerados

- **WHEN** `validateCnpj(" 12. ABC. 345/01DE-35 ")` é chamado
- **THEN** retorna `{ normalized: "12ABC34501DE35" }`

### Requirement: hashCnpjRoot — HMAC-SHA256 da raiz com pepper (uso restrito)

O sistema SHALL prover `hashCnpjRoot(root: string): string` que calcula HMAC-SHA256 dos 8 primeiros caracteres canônicos do CNPJ (a raiz, que pode conter letras maiúsculas e dígitos) com pepper server-side. O pepper nunca está no código. Esta função é de uso restrito — na produção, o hash é calculado na rota Next.js (server-side) com `process.env.CNPJ_PEPPER`. `hashCnpjRoot()` é usada em testes e em contexto de servidor.

#### Scenario: root_hash numérico calculado corretamente

- **WHEN** `hashCnpjRoot("12345678")` é chamado em contexto de servidor/teste
- **THEN** retorna HMAC-SHA256("12345678", pepper) como hex string

#### Scenario: root_hash alfanumérico calculado sobre a raiz canônica

- **WHEN** `hashCnpjRoot("12ABC345")` é chamado em contexto de servidor/teste
- **THEN** retorna HMAC-SHA256("12ABC345", pepper) como hex string

#### Scenario: Caixa e pontuação não produzem hashes diferentes

- **WHEN** o CNPJ `"12.abc.345/01de-35"` é normalizado e sua raiz `"12ABC345"` é usada em `hashCnpjRoot`
- **THEN** o hash é idêntico ao calculado para a raiz `"12ABC345"` obtida de `"12ABC34501DE35"`
- **AND** o hash não é calculado sobre a string crua com pontuação

### Requirement: maskCnpj — mascaramento seguro

O sistema SHALL prover `maskCnpj(normalized: string): string` que mascara o CNPJ canônico de 14 caracteres no formato `**.***.***/YYYY-**`. Os 8 primeiros caracteres e os 2 dígitos verificadores são substituídos por `*`. O sufixo `YYYY` corresponde às posições 9–12 e é preservado, podendo conter letras maiúsculas e dígitos. A função SHALL ser fail-closed: quando a entrada não casar `^[A-Z0-9]{12}[0-9]{2}$`, SHALL retornar o placeholder `"CNPJ inválido"` e NUNCA devolver o identificador fiscal integral.

#### Scenario: CNPJ numérico mascarado corretamente

- **WHEN** `maskCnpj("12345678000195")` é chamado
- **THEN** retorna `"**.***.***/0001-**"`

#### Scenario: CNPJ alfanumérico mascarado preserva o sufixo

- **WHEN** `maskCnpj("12ABC34501DE35")` é chamado
- **THEN** retorna `"**.***.***/01DE-**"`

#### Scenario: Entrada inválida retorna placeholder seguro

- **WHEN** `maskCnpj("12abc34501de35")`, `maskCnpj("12ABC")` ou `maskCnpj("12.ABC.345/01DE-35😀")` é chamado
- **THEN** retorna `"CNPJ inválido"`
- **AND** o valor de entrada não é devolvido integralmente

### Requirement: normalizeCnpj — canônico alfanumérico

O sistema SHALL prover `normalizeCnpj(raw: string): string` que remove somente a formatação conhecida (`.`, `/`, `-` e espaços), converte letras ASCII `a-z` para maiúscula e preserva letras e dígitos. A função NÃO SHALL remover caracteres desconhecidos — acentos, emojis e símbolos permanecem no resultado para que a validação estrutural os rejeite. A função SHALL ser a única normalização de CNPJ usada pelas demais camadas de domínio/API.

#### Scenario: CNPJ numérico com pontuação normalizado

- **WHEN** `normalizeCnpj("12.345.678/0001-90")` é chamado
- **THEN** retorna `"12345678000190"`

#### Scenario: CNPJ alfanumérico com pontuação e minúsculas normalizado

- **WHEN** `normalizeCnpj("12.abc.345/01de-35")` é chamado
- **THEN** retorna `"12ABC34501DE35"`

#### Scenario: Letras não são removidas

- **WHEN** `normalizeCnpj("AB.CDE.FGH/0001-00")` é chamado
- **THEN** retorna `"ABCDEFGH000100"` (14 caracteres preservados para a validação decidir)

#### Scenario: Caractere desconhecido não é descartado silenciosamente

- **WHEN** `normalizeCnpj("12.ÁBC.345/01DE-35")` é chamado
- **THEN** retorna `"12ÁBC34501DE35"`
- **AND** `validateCnpj("12.ÁBC.345/01DE-35")` retorna `new Error("CNPJ inválido")`

#### Scenario: Emoji não é descartado silenciosamente

- **WHEN** `normalizeCnpj("12.ABC.345/01DE-35😀")` é chamado
- **THEN** o resultado contém o emoji e não é um CNPJ canônico
- **AND** `validateCnpj` retorna `new Error("CNPJ inválido")`

#### Scenario: Espaços são removidos como formatação

- **WHEN** `normalizeCnpj(" 12. ABC. 345/01DE-35 ")` é chamado
- **THEN** retorna `"12ABC34501DE35"`

## ADDED Requirements

### Requirement: Formatação de CNPJ para input e exibição

O sistema SHALL centralizar a máscara progressiva de digitação/colagem e a formatação completa de exibição em `src/lib/cnpj/`, preservando letras maiúsculas nas posições alfanuméricas.

- `formatCnpjInput(raw)` SHALL ser tolerante na UI: ignorar caracteres fora de `[0-9A-Za-z./\-\s]`, remover a formatação conhecida, converter letras para maiúscula, limitar a 14 caracteres canônicos e aplicar progressivamente a máscara `XX.XXX.XXX/XXXX-DV`.
- `formatCnpj(normalized)` SHALL exibir o CNPJ canônico completo no formato `XX.XXX.XXX/XXXX-DV`.
- A tolerância da UI NÃO SHALL ser replicada na API/domínio: o servidor revalida o valor e rejeita caracteres desconhecidos.
- Nenhum componente SHALL manter uma máscara local que remova letras com `\D`.

#### Scenario: Digitação parcial alfanumérica recebe máscara progressiva

- **WHEN** `formatCnpjInput("12abc")` é chamado
- **THEN** retorna `"12.ABC"`

#### Scenario: Colagem de CNPJ alfanumérico completo é formatada

- **WHEN** `formatCnpjInput("12.abc.345/01de-35")` é chamado
- **THEN** retorna `"12.ABC.345/01DE-35"`

#### Scenario: Exibição completa preserva letras

- **WHEN** `formatCnpj("12ABC34501DE35")` é chamado
- **THEN** retorna `"12.ABC.345/01DE-35"`

#### Scenario: Excesso de caracteres é truncado no limite canônico

- **WHEN** `formatCnpjInput("12ABC34501DE3599")` é chamado
- **THEN** retorna `"12.ABC.345/01DE-35"`

#### Scenario: UI ignora caractere desconhecido sem alterar o valor canônico

- **WHEN** `formatCnpjInput("12.ABC.345/01DE-35😀")` é chamado
- **THEN** retorna `"12.ABC.345/01DE-35"`
- **AND** a tolerância é exclusiva da UI; uma chamada direta à API com o valor contendo emoji retorna `400` e não é canonicalizada para um CNPJ válido
