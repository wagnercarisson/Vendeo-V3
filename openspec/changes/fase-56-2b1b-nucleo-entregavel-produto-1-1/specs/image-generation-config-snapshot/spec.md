# Image Generation Config Snapshot — Delivery Wiring

## MODIFIED Requirements

### Requirement: Contrato de reuso do snapshot original

O sistema SHALL preservar o contrato pelo qual nova geração/correção da **mesma** campanha reutiliza o snapshot **original**, independentemente da configuração vigente. Na b1b, o snapshot passa a ser persistido pela execução antes da reserva/provider e passa a congelar também o **briefing, as referências/seleções e as versões de composição**. (A execução da correção permanece na F56.3.)

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** uma correção da mesma campanha é considerada
- **THEN** o contrato resolve o snapshot original
- **AND** não adota a configuração vigente

#### Scenario: Snapshot é gravado pela execução

- **WHEN** a campanha elegível inicia a execução
- **THEN** o snapshot original é persistido antes de reserva e provider
- **AND** falha ao persistir bloqueia a operação

## ADDED Requirements

### Requirement: Congelamento de briefing, referências e versões de composição

O snapshot SHALL congelar, de forma imutável: o briefing, as referências/seleções (intenção, direção de fundo, imagens), as **versões de composição** (base de prompt, compositor, políticas) e o par principal/fallback modelo+qualidade com versão/origem. A execução SHALL NOT reler briefing, referências ou configuração mutável depois do congelamento.

#### Scenario: Briefing e referências congelados

- **WHEN** o snapshot é gravado
- **THEN** briefing, referências e seleções ficam registrados de forma imutável
- **AND** alterações posteriores não os modificam

#### Scenario: Versões de composição registradas

- **WHEN** a composição é associada à campanha
- **THEN** as versões de base, compositor e políticas são registradas no snapshot
- **AND** correspondem exatamente às usadas na execução

#### Scenario: Sem releitura de configuração mutável

- **WHEN** a execução ocorre após o congelamento
- **THEN** ela não relê configuração mutável da bancada/admin
- **AND** usa exclusivamente o snapshot congelado

### Requirement: Persistência idempotente, tolerante a corrida e com reparo de estado parcial

A persistência do snapshot e da sua evidência congelada SHALL ser idempotente e tolerante a corrida: tentativas de inserção concorrentes para a MESMA identidade SHALL reutilizar a linha vencedora somente quando o conteúdo for equivalente. Um estado parcial (snapshot congelado sem a sua evidência) SHALL ser reparado na próxima chamada de persistência, antes da reserva, inserindo a evidência para o MESMO snapshot congelado, sem substituí-lo. Conteúdo divergente para a mesma identidade SHALL ser recusado como conflito e nada SHALL ser gravado. O vínculo entre a evidência e a campanha do snapshot SHALL ser imposto pelo banco.

#### Scenario: Corrida reutiliza a linha vencedora equivalente

- **WHEN** duas persistências concorrentes usam a MESMA identidade e o MESMO conteúdo
- **THEN** ao final existem exatamente um snapshot e uma evidência
- **AND** a persistência perdedora reutiliza a linha vencedora sem erro

#### Scenario: Estado parcial é reparado sem substituir o snapshot congelado

- **WHEN** existe um snapshot congelado sem a sua evidência e a persistência é chamada novamente antes da reserva
- **THEN** a evidência ausente é inserida para o MESMO snapshot congelado
- **AND** o snapshot congelado não é substituído

#### Scenario: Conteúdo divergente é recusado

- **WHEN** a persistência encontra conteúdo divergente para a mesma identidade
- **THEN** a operação é recusada como conflito de identidade
- **AND** nada é gravado

#### Scenario: Vínculo campanha-snapshot imposto pelo banco

- **WHEN** uma evidência é inserida com `campaign_id` diferente da campanha do snapshot referenciado
- **THEN** o banco rejeita a inserção
