# Product 1:1 Flow Activation

> B2.3 — validação local-primeiro, teste real controlado sob autorização temporária estreita e **preservação** da barreira global. Habilitação de lojas de teste só após validação do piloto e comprovação de D13.

## MODIFIED Requirements

### Requirement: Concessão operacional bloqueada nesta change

A API/RPC operacional SHALL **recusar** estágios habilitadores no **escopo geral** antes do gate da F56.2b2. A **barreira global NÃO é removida**. A **única** via para habilitar o **teste real isolado** SHALL ser a **autorização temporária ESTREITA** (capability `product-1-1-controlled-real-test-authorization`), com instância e lojas autorizadas, expiração, auditoria e revogação. Testes de lógica usam dados controlados e não chamam esse caminho operacional.

#### Scenario: Fixture de estágio não ativa fluxo real

- **WHEN** testes inserem dados sintéticos de estágios na instância descartável
- **THEN** somente a função pura/harness é exercitada
- **AND** nenhum usuário, loja, provider ou endpoint produtivo é habilitado

#### Scenario: Concessão operacional precoce recusada

- **WHEN** um admin tenta conceder estágio habilitador de escopo geral antes do gate autorizado
- **THEN** API/RPC recusa e registra a recusa
- **AND** a autorização operacional de escopo geral permanece `off`

#### Scenario: Barreira global preservada

- **WHEN** o teste real isolado é autorizado por recorte estreito
- **THEN** a recusa de estágios habilitadores de escopo geral permanece
- **AND** nenhuma loja fora do recorte autorizado é habilitada

## ADDED Requirements

### Requirement: Validação local-primeiro

A validação SHALL ocorrer **primeiro localmente**, no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**, cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download. **Nenhuma chamada paga** SHALL ocorrer em CI. Somente **depois** SHALL ocorrer o **teste real controlado local**, sob **autorização humana específica** e **teto de gasto**.

#### Scenario: Testes locais com provider simulado

- **WHEN** a validação local roda no ambiente isolado
- **THEN** o provider é simulado e nenhuma chamada paga ocorre
- **AND** formulário, geração, estados, persistência, copy, recuperação, créditos e download são cobertos

#### Scenario: Teste real só depois e sob autorização

- **WHEN** se pretende executar o teste real controlado
- **THEN** a validação local-primeiro já foi concluída
- **AND** há autorização humana específica e teto de gasto
- **AND** a execução ocorre no recorte autorizado

#### Scenario: Preview restrito é posterior e isolado

- **WHEN** se avalia o preview restrito
- **THEN** ele exige configuração isolada de dados/credenciais
- **AND** não basta restringir a URL
- **AND** produção/main, migration remota e habilitação de lojas permanecem decisões posteriores e separadas

### Requirement: Habilitação de lojas de teste condicionada à validação do piloto

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto controlado, executado em loja de teste com **autorização humana específica** e **pricing completo**, e **após** a comprovação da estratégia substituta de D13.

#### Scenario: Piloto em loja de teste com autorização e pricing completo

- **WHEN** o piloto controlado é executado
- **THEN** ele ocorre em loja de teste (`is_test_store = true`), no ambiente isolado autorizado
- **AND** usa autorização temporária estreita vigente, com pricing completo

#### Scenario: Habilitação só depois da validação

- **WHEN** o piloto ainda não foi validado ou a estratégia de D13 não foi comprovada
- **THEN** a habilitação de lojas de teste não é concedida
- **AND** a abertura geral permanece fora de escopo

### Requirement: Rollback de deploy não reverte banco/ledger

A separação entre deploy e dados SHALL ser explícita: **rollback de deploy não desfaz automaticamente** estado de banco, migrations aplicadas ou ledger de crédito. Migrations remotas e habilitação de lojas permanecem **decisões separadas e autorizadas**.

#### Scenario: Rollback não reverte ledger

- **WHEN** um deploy é revertido
- **THEN** o estado de banco e o ledger permanecem como estavam
- **AND** nenhuma reversão automática de migration/cobrança é executada
