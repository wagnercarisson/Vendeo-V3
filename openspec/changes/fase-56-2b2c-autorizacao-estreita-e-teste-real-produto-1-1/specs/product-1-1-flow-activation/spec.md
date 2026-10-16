# Product 1:1 Flow Activation

> B2.3 — validação local-primeiro, teste real controlado sob autorização temporária estreita e **preservação** da barreira global. Habilitação de lojas de teste só após validação do piloto e comprovação de D13.

## MODIFIED Requirements

### Requirement: Concessão operacional bloqueada nesta change

A API/RPC operacional SHALL **recusar** estágios habilitadores no **escopo geral** antes do gate da F56.2b2. A **barreira global NÃO é removida**. A **única** via para habilitar o **teste real isolado** SHALL ser a **autorização temporária ESTREITA** (capability `product-1-1-controlled-real-test-authorization`), com **instância** e **escopo de lojas de teste**, **auditoria** e **revogação** (a **expiração existente** é respeitada quando informada). Testes de lógica usam dados controlados e não chamam esse caminho operacional.

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

### Requirement: Pricing completo e controle de gasto mínimo (alcance real)

O teste real SHALL exigir **pricing `complete` para principal E fallback**, por **modelo+qualidade**, na configuração **própria do fluxo novo** (`image_model_pair_config`) — **não** em `ai_model_selection` (legado). O **controle de gasto mínimo** SHALL **limitar chamadas** (imagem ≤3; copy ≤6), usar **estimativas conservadoras** para **parar** e **prevenir execuções simultâneas**. **Não** existe cap monetário cumulativo hoje e o mecanismo SHALL NOT prometer **garantia financeira** da cobrança final do provider.

#### Scenario: Pricing incompleto bloqueia

- **WHEN** o principal ou o fallback não tem pricing `complete` por modelo+qualidade
- **THEN** a execução é bloqueada antes de reserva/provider
- **AND** nenhum valor é inventado

#### Scenario: Controle mínimo limita chamadas e para

- **WHEN** o limite de chamadas/tentativas ou o limite conservador é atingido
- **THEN** novas chamadas não ocorrem e o estado é encerrado honestamente
- **AND** nenhuma garantia financeira da cobrança final é prometida

#### Scenario: Execuções simultâneas prevenidas

- **WHEN** duas execuções concorrem pela mesma operação
- **THEN** apenas uma vence a aquisição atômica
- **AND** a perdedora não chama o provider

### Requirement: Inspeção humana do resultado do teste real

O **resultado do teste real** SHALL ser submetido a **inspeção humana**. Falhas **raras** do provider SHALL permanecer cobertas por **testes simulados**, sem exigir provocá-las no provider pago.

#### Scenario: Inspeção humana obrigatória

- **WHEN** o teste real produz um resultado
- **THEN** o resultado é inspecionado por humano
- **AND** nenhuma aprovação automática substitui a inspeção

#### Scenario: Falhas raras por simulação

- **WHEN** uma falha rara do provider precisa ser coberta
- **THEN** ela é exercitada por simulação
- **AND** não é exigida no provider pago

### Requirement: Testes negativos de habilitação e não regressão do legado

O novo fluxo SHALL cobrir **testes negativos**: **flag desligada**, **loja não-test**, **instância/ambiente não autorizado** e **escopo geral** (`all_stores`). O **fluxo legado** SHALL permanecer **inalterado** (sem regressão intencional).

#### Scenario: Flag desligada

- **WHEN** o flag de lojas de teste está desligado
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Loja não-test

- **WHEN** a loja não é de teste
- **THEN** o novo fluxo é negado

#### Scenario: Instância ou ambiente não autorizado

- **WHEN** a instância canônica não corresponde ou o ambiente não é `isolated`
- **THEN** o novo fluxo é negado

#### Scenario: Escopo geral

- **WHEN** se tenta o escopo geral (`all_stores`)
- **THEN** a recusa permanece
- **AND** a produção permanece intocada

#### Scenario: Legado sem regressão

- **WHEN** o recorte de lojas de teste é exercido
- **THEN** o comportamento do fluxo legado permanece inalterado
- **AND** não há regressão intencional do legado
