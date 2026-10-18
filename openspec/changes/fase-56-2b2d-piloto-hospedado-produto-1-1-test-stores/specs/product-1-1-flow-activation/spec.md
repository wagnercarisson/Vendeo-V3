# Product 1:1 Flow Activation — Delta (piloto hospedado em lojas de teste)

## ADDED Requirements

### Requirement: Ativação operacional restrita a lojas de teste

O sistema SHALL permitir a habilitação do estágio `test_stores` no **ambiente operacional**, restrita ao escopo de lojas de teste (`scope="test_stores"`), alinhando a RPC de concessão, a rota admin e o gate de gasto. A via `isolated_pilot` SHALL permanecer **inalterada** (ambiente `isolated`). O escopo geral (`all_stores`) SHALL permanecer **sempre recusado**.

#### Scenario: Estágio test_stores operacional é aceito apenas para lojas de teste
- **WHEN** um admin concede `test_stores` com escopo `test_stores`
- **THEN** a concessão é `granted`, auditada e revalidada server-side
- **AND** apenas lojas de teste (`is_test_store=true`) são elegíveis no ambiente operacional

#### Scenario: isolated_pilot permanece inalterado
- **WHEN** a via `isolated_pilot` é usada
- **THEN** ela continua exigindo escopo `test_stores` e ambiente `isolated`
- **AND** nenhuma mudança é feita na sua matriz

#### Scenario: all_stores permanece recusado
- **WHEN** se tenta conceder `all_stores` ou qualquer escopo `all_stores`
- **THEN** a RPC recusa e registra a recusa
- **AND** o escopo geral permanece bloqueado

#### Scenario: Gate de gasto arma para test_stores
- **WHEN** a loja é de teste, o estágio `test_stores` está vigente e as flags são válidas
- **THEN** o gate de gasto resolve `armed`
- **AND** estágios/escopos não-estreitos permanecem `blocked`

#### Scenario: Instância canônica obrigatória
- **WHEN** a autorização é concedida no operacional
- **THEN** ela é vinculada à identidade canônica da instância (host server-side)
- **AND** a revalidação exige correspondência exata

## MODIFIED Requirements

### Requirement: Habilitação de lojas de teste condicionada à validação do piloto

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto controlado, executado em loja de teste com **autorização humana específica** e **pricing completo**, e **após** a comprovação da estratégia substituta de D13. O piloto **hospedado** restrito a lojas de teste SHALL ocorrer no **ambiente operacional** sob autorização `test_stores`, com o **fluxo mantido OFF** fora da janela.

#### Scenario: Piloto em loja de teste com autorização e pricing completo

- **WHEN** o piloto controlado é executado
- **THEN** ele ocorre em loja de teste (`is_test_store = true`) sob autorização `test_stores` vigente
- **AND** usa pricing completo (principal e fallback)

#### Scenario: Habilitação só depois da validação

- **WHEN** o piloto ainda não foi validado ou a estratégia de D13 não foi comprovada
- **THEN** a habilitação de lojas de teste não é concedida
- **AND** a abertura geral permanece fora de escopo

### Requirement: Testes negativos de habilitação e não regressão do legado

O novo fluxo SHALL cobrir **testes negativos**: **flag desligada**, **loja não-test**, **instância/ambiente não autorizado** e **escopo geral** (`all_stores`). O **fluxo legado** SHALL permanecer **inalterado** (sem regressão intencional).

#### Scenario: Flag desligada

- **WHEN** o flag de lojas de teste está desligado
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Loja não-test

- **WHEN** a loja não é de teste
- **THEN** o novo fluxo é negado

#### Scenario: Instância ou combinação não autorizada

- **WHEN** a instância canônica não corresponde **ou** a combinação estágio×ambiente×escopo é incompatível (ex.: `test_stores` em loja não-test, `isolated_pilot` em ambiente operacional)
- **THEN** o novo fluxo é negado
- **AND** nenhuma geração ocorre

#### Scenario: Escopo geral

- **WHEN** se tenta o escopo geral (`all_stores`)
- **THEN** a recusa permanece
- **AND** a produção permanece intocada

#### Scenario: Legado sem regressão

- **WHEN** o recorte de lojas de teste é exercido
- **THEN** o comportamento do fluxo legado permanece inalterado
- **AND** não há regressão intencional do legado
