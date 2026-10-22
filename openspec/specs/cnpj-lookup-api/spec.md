> Synced from `fase-33-verificacao-cnpj-freemium` (ADDED).

## Purpose

Endpoint `GET /api/cnpj/lookup?cnpj={cnpj}` chamado pelo frontend no evento onBlur do campo CNPJ (após validação local de dígitos). Orquestra cache → BrasilAPI → CNPJá via `CnpjVerificationService` e retorna resultado para o frontend.
## Requirements
### Requirement: GET /api/cnpj/lookup — endpoint server-side para consulta onBlur

O sistema SHALL prover um endpoint `GET /api/cnpj/lookup?cnpj={cnpj}` que o frontend chama no evento onBlur do campo CNPJ (após validação local do formato canônico). O endpoint normaliza a entrada, rejeita caracteres fora da formatação conhecida, valida o formato canônico e orquestra cache → BrasilAPI → CNPJá via `CnpjVerificationService`, retornando o resultado para o frontend. O endpoint SHALL aceitar CNPJs numéricos e alfanuméricos.

#### Scenario: CNPJ numérico resolvido retorna dados oficiais

- **WHEN** `GET /api/cnpj/lookup?cnpj=12345678000195` é chamado por usuário autenticado
- **AND** o CNPJ é resolvido via cache ou provedor
- **THEN** response `200` com:
  ```json
  {
    "status": "resolved",
    "data": {
      "cnpj_normalized": "12345678000195",
      "razao_social": "EMPRESA EXEMPLO LTDA",
      "nome_fantasia": "Empresa Exemplo",
      "situacao_cadastral": "ATIVA",
      "cep": "01234-567",
      "logradouro": "Rua Exemplo",
      "numero": "123",
      "bairro": "Centro",
      "cidade": "São Paulo",
      "uf": "SP",
      "cnae_principal": "4781-4/00",
      "cnae_descricao": "Comércio varejista de artigos do vestuário e acessórios"
    },
    "message": "Dados carregados da Receita Federal."
  }
  ```

#### Scenario: CNPJ alfanumérico resolvido retorna dados oficiais

- **WHEN** `GET /api/cnpj/lookup?cnpj=12.abc.345/01de-35` é chamado por usuário autenticado
- **AND** ao menos um provedor resolve o CNPJ
- **THEN** response `200` com `status: "resolved"`
- **AND** `data.cnpj_normalized` é `"12ABC34501DE35"`

#### Scenario: CNPJ alfanumérico ainda não suportado pelos provedores

- **WHEN** `GET /api/cnpj/lookup?cnpj=12ABC34501DE35` é chamado
- **AND** TODOS os provedores tentados rejeitam explicitamente o formato com `unsupported_format`
- **THEN** response `200` com:
  ```json
  {
    "status": "unsupported_format",
    "message": "A consulta cadastral ainda não suporta este formato de CNPJ. Tente novamente mais tarde."
  }
  ```
- **AND** o resultado NÃO é retornado como `not_found`

#### Scenario: Rejeição de formato misturada com indisponibilidade

- **WHEN** um provedor retorna `unsupported_format` e o outro retorna `unavailable`
- **THEN** response `200` com `status: "unavailable"`
- **AND** NÃO retorna `unsupported_format`, pois não houve rejeição definitiva de todos os provedores

#### Scenario: CNPJ alfanumérico não encontrado retorna not_found

- **WHEN** `GET /api/cnpj/lookup?cnpj=12.ABC.345/01DE-35` é chamado
- **AND** um provedor declarado compatível retorna 404 conclusivo
- **THEN** response `200` com:
  ```json
  {
    "status": "not_found",
    "message": "CNPJ não encontrado na Receita Federal."
  }
  ```

#### Scenario: CNPJ numérico não encontrado retorna not_found

- **WHEN** `GET /api/cnpj/lookup?cnpj=12.345.678/0001-95` é chamado
- **AND** um provedor retorna 404 conclusivo
- **THEN** response `200` com `status: "not_found"`

#### Scenario: API indisponível retorna unavailable

- **WHEN** `GET /api/cnpj/lookup?cnpj=12345678000195` é chamado
- **AND** ambos provedores estão indisponíveis (timeout/erro/rate limit)
- **THEN** response `200` com:
  ```json
  {
    "status": "unavailable",
    "message": "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'."
  }
  ```

#### Scenario: CNPJ com formato inválido retorna erro

- **WHEN** `GET /api/cnpj/lookup?cnpj=123` é chamado (menos de 14 caracteres)
- **THEN** response `400` com `{ "error": "CNPJ inválido" }`

#### Scenario: CNPJ alfanumérico com DV inválido retorna erro

- **WHEN** `GET /api/cnpj/lookup?cnpj=12ABC34501DE34` é chamado
- **THEN** response `400` com `{ "error": "CNPJ inválido" }`

#### Scenario: Sequência numérica conhecida retorna erro sem consultar provedores

- **WHEN** `GET /api/cnpj/lookup?cnpj=00000000000000` é chamado
- **THEN** response `400` com `{ "error": "CNPJ inválido" }`
- **AND** nenhum provedor é consultado

#### Scenario: Caractere desconhecido retorna erro sem consultar provedores

- **WHEN** `GET /api/cnpj/lookup?cnpj=12.ABC.345/01DE-35😀` é chamado
- **THEN** response `400` com `{ "error": "CNPJ inválido" }`
- **AND** o valor não é canonicalizado para um CNPJ válido

#### Scenario: Usuário não autenticado recebe 401

- **WHEN** `GET /api/cnpj/lookup?cnpj=12345678000195` é chamado sem sessão
- **THEN** response `401`

