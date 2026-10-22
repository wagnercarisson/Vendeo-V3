> Synced from `fase-32-freemium-anti-abuso-cnpj` (ADDED).

## Purpose

Validação de CNPJ (dígitos verificadores, formato, sequências inválidas), normalização e hash HMAC-SHA256 da raiz com pepper server-side, mascaramento e similaridade textual para validação cadastral.
## Requirements
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

### Requirement: compareBusinessName — similaridade textual para validação cadastral

O sistema SHALL prover `compareBusinessName(name: string, razaoSocial: string, nomeFantasia?: string): CnpjValidationScore` que calcula similaridade textual (Levenshtein) e retorna score. A validação cadastral é score, não bloqueio — o fluxo nunca é interrompido.

#### Scenario: Nome coincide com razão social → score alto

- **WHEN** `compareBusinessName("Loja ABC LTDA", "Loja ABC LTDA")` é chamado
- **THEN** o score é ≥ 0.8

#### Scenario: Nome diverge da razão social → score baixo, fluxo não bloqueado

- **WHEN** `compareBusinessName("Minha Loja", "ABC Comércio Ltda")` é chamado
- **THEN** o score é < 0.8
- **AND** nenhum erro é lançado
- **AND** o score é registrado em `stores.cnpj_validation_score`

### Requirement: Formatação de CNPJ para input e exibição

O sistema SHALL centralizar a máscara progressiva de digitação/colagem, a detecção de caracteres desconhecidos e a formatação completa de exibição em `src/lib/cnpj/`, preservando letras maiúsculas nas posições alfanuméricas.

- `hasInvalidCnpjChars(raw)` SHALL retornar `true` quando a entrada contiver qualquer caractere fora de `[0-9A-Za-z./\-\s]`, incluindo acentos, emojis e símbolos.
- `formatCnpjInput(raw, previousValue = "")` SHALL ser fail-closed na UI: se houver caractere desconhecido, retorna `previousValue` sem incorporar o caractere; caso contrário, remove a formatação conhecida, converte letras para maiúscula, limita a 14 caracteres canônicos e aplica progressivamente a máscara `XX.XXX.XXX/XXXX-DV`.
- A UI SHALL detectar o caractere desconhecido no evento de mudança/colagem, exibir erro local de CNPJ inválido, limpar o estado de lookup, NÃO chamar a consulta no blur e NÃO permitir submissão.
- O erro local SHALL ser limpo somente quando uma entrada posterior passar em `validateCnpj` (formato completo válido). Entradas parciais válidas mantêm o erro anterior.
- A tolerância da UI NÃO SHALL ser replicada na API/domínio: o servidor revalida o valor, rejeita caracteres desconhecidos e nunca os remove para produzir um CNPJ válido.
- Nenhum componente SHALL manter uma máscara local que remova letras ou caracteres desconhecidos com `\D`.

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

#### Scenario: Caractere desconhecido mantém o último valor válido

- **WHEN** `formatCnpjInput("12.ABC.345/01DE-35😀", "12.ABC")` é chamado
- **THEN** retorna `"12.ABC"`
- **AND** o caractere desconhecido não é incorporado ao valor visual

#### Scenario: Detector reconhece acentos, emojis e símbolos

- **WHEN** `hasInvalidCnpjChars("12.ABC.345/01DE-35😀")`, `hasInvalidCnpjChars("12.ÁBC.345/01DE-35")` ou `hasInvalidCnpjChars("12.ABC.345/01DE-35!")` é chamado
- **THEN** retorna `true`

#### Scenario: Detector aceita formatação conhecida e alfanuméricos

- **WHEN** `hasInvalidCnpjChars(" 12. ABC. 345/01DE-35 ")` é chamado
- **THEN** retorna `false`

#### Scenario: Colagem com emoji não realiza consulta nem envio

- **WHEN** o lojista cola `12.ABC.345/01DE-35😀` no campo CNPJ
- **THEN** o campo mantém visualmente o último valor válido
- **AND** a UI exibe erro local de CNPJ inválido
- **AND** o evento de blur NÃO chama `/api/cnpj/lookup`
- **AND** o formulário NÃO é submetido

#### Scenario: Erro local só é limpo após entrada válida

- **WHEN** a UI está com erro local por caractere desconhecido
- **AND** o lojista digita uma entrada parcial válida
- **THEN** o erro permanece
- **AND** quando a entrada completa passa em `validateCnpj`, o erro é limpo
- **AND** o lookup/submissão voltam a ser permitidos

#### Scenario: API direta continua estrita

- **WHEN** uma chamada direta à API recebe `12.ABC.345/01DE-35😀`
- **THEN** responde `400` com `{ "error": "CNPJ inválido" }`
- **AND** o caractere não é removido para produzir um CNPJ válido

