# Product 1:1 Flow Activation

> F56.2b2 — gate de habilitação de lojas de teste condicionado ao piloto.

## ADDED Requirements

### Requirement: Habilitação de lojas de teste condicionada à validação do piloto

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto controlado, executado em loja de teste com **autorização humana específica** e **pricing completo**.

#### Scenario: Piloto em loja de teste com autorização e pricing completo

- **WHEN** o piloto controlado é executado
- **THEN** ele ocorre em loja de teste (`is_test_store = true`), no ambiente isolado autorizado
- **AND** usa a autorização temporária de piloto (escopo restrito ao ambiente isolado e à geração paga aprovada), com pricing completo

#### Scenario: Habilitação só depois da validação

- **WHEN** o piloto ainda não foi validado
- **THEN** a habilitação de lojas de teste não é concedida
- **AND** a abertura geral permanece fora de escopo
