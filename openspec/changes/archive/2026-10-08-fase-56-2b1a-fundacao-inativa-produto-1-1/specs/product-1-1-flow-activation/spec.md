# Product 1:1 Flow Activation — Foundation

## ADDED Requirements

### Requirement: Autorização independente e flags aplicáveis

O sistema SHALL ler validamente ambas as flags server-side, mas a ativação exige apenas a flag aplicável ao escopo da loja e autorização independente vigente. A autorização reside em armazenamento dedicado durável, contém estágio/escopo/instância/concessor/validade/revogação/motivo/operation_id, e só pode ser concedida ou revogada por admin autenticado via API/RPC auditada. Em b1a o estado operacional SHALL permanecer `off`.

#### Scenario: Uma flag aplicável mais autorização válida
- **WHEN** ambas as flags foram lidas com sucesso, a flag aplicável está ligada e a autorização controlada corresponde ao estágio/escopo
- **THEN** a função pura de decisão permite o estágio no harness isolado
- **AND** o teste não concede autorização operacional nem habilita loja

#### Scenario: Flag não aplicável não precisa estar ligada
- **WHEN** loja de teste tem flag test-stores ligada e flag geral desligada, com autorização correspondente
- **THEN** a flag aplicável permite o cenário controlado
- **AND** a ativação geral continua desligada

#### Scenario: Falha em qualquer leitura é fail-closed
- **WHEN** a leitura de qualquer flag ou autorização falha
- **THEN** a função de decisão não permite o fluxo novo

### Requirement: Concessão operacional bloqueada nesta change

A API/RPC operacional SHALL recusar estágios habilitadores antes da autorização humana e do gate da F56.2b2. Testes de lógica usam dados controlados e não chamam esse caminho operacional.

#### Scenario: Fixture de estágio não ativa fluxo real
- **WHEN** testes inserem dados sintéticos de estágios na instância descartável
- **THEN** somente a função pura/harness é exercitada
- **AND** nenhum usuário, loja, provider ou endpoint produtivo é habilitado

#### Scenario: Concessão operacional precoce recusada
- **WHEN** um admin tenta conceder estágio habilitador antes do gate autorizado
- **THEN** API/RPC recusa e registra a recusa
- **AND** autorização operacional permanece `off`
