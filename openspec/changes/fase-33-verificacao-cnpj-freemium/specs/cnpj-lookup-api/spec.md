## ADDED Requirements

### Requirement: GET /api/cnpj/lookup — endpoint server-side para consulta onBlur

O sistema SHALL prover um endpoint `GET /api/cnpj/lookup?cnpj={cnpj}` que o frontend chama no evento onBlur do campo CNPJ (após validação local de dígitos). O endpoint orquestra cache → BrasilAPI → CNPJá via `CnpjVerificationService` e retorna o resultado para o frontend.

#### Scenario: CNPJ resolvido retorna dados oficiais

- **WHEN** `GET /api/cnpj/lookup?cnpj=12345678000190` é chamado por usuário autenticado
- **AND** o CNPJ é resolvido via cache ou provedor
- **THEN** response `200` com:
  ```json
  {
    "status": "resolved",
    "data": {
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

#### Scenario: CNPJ não encontrado retorna not_found

- **WHEN** `GET /api/cnpj/lookup?cnpj=00000000000000` é chamado
- **AND** provedor retorna CNPJ inexistente
- **THEN** response `200` com:
  ```json
  {
    "status": "not_found",
    "message": "CNPJ não encontrado na Receita Federal."
  }
  ```

#### Scenario: API indisponível retorna unavailable

- **WHEN** `GET /api/cnpj/lookup?cnpj=12345678000190` é chamado
- **AND** ambos provedores estão indisponíveis (timeout/erro/rate limit)
- **THEN** response `200` com:
  ```json
  {
    "status": "unavailable",
    "message": "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'."
  }
  ```

#### Scenario: CNPJ sem validação local de dígitos retorna erro

- **WHEN** `GET /api/cnpj/lookup?cnpj=123` é chamado (menos de 14 dígitos)
- **THEN** response `400` com `{ "error": "CNPJ inválido" }`

#### Scenario: Usuário não autenticado recebe 401

- **WHEN** `GET /api/cnpj/lookup?cnpj=12345678000190` é chamado sem sessão
- **THEN** response `401`
