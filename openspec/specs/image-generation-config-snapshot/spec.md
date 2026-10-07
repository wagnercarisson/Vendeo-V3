# Image Generation Config Snapshot

> Synced from `fase-56-1-contrato-produtivo-modelos-fallback` (ADDED).
> Extended by `fase-56-2a-preparacao-nao-operacional-produto-1-1` with append-only operation history and snapshot reuse contracts.

## Purpose

Contrato de snapshot **imutável** da configuração de geração (par principal/fallback, versão e origem) registrado por operação, garantindo reprodutibilidade e impedindo que alterações posteriores no admin reescrevam o histórico de campanhas e correções.

## Requirements

### Requirement: Estrutura append-only de operações/tentativas vinculada à campanha e ao snapshot original

O sistema SHALL manter uma relação **append-only** própria para operações/tentativas do novo fluxo, vinculada à **campanha** e ao **snapshot original** da configuração. O snapshot referenciado SHALL pertencer à mesma campanha informada na operação. Cada operação SHALL acrescentar registros sem reescrever os anteriores. `service_role` SHALL ter somente SELECT/INSERT, e qualquer UPDATE/DELETE SHALL ser rejeitado.

#### Scenario: Operação registrada append-only

- **WHEN** uma operação/tentativa é registrada
- **THEN** ela é acrescentada à relação
- **AND** os registros anteriores permanecem inalterados

#### Scenario: Vínculo com o snapshot original

- **WHEN** uma operação é registrada
- **THEN** ela referencia a campanha e o snapshot original
- **AND** o snapshot original pertence à mesma campanha
- **AND** a correlação com o par modelo–qualidade é preservada

#### Scenario: Rejeitar snapshot de outra campanha

- **GIVEN** a campanha A e o snapshot original existente da campanha B
- **WHEN** uma tentativa associa a campanha A ao snapshot da campanha B
- **THEN** a inserção é rejeitada com `image_generation_operations_snapshot_campaign_mismatch`
- **AND** nenhum registro de operação é criado
- **AND** os FKs individuais continuam rejeitando separadamente IDs de campanha ou snapshot inexistentes

#### Scenario: Rejeitar alteração e remoção de tentativas existentes

- **GIVEN** uma operação/tentativa já registrada
- **WHEN** qualquer papel tenta atualizá-la ou removê-la
- **THEN** `service_role` não possui privilégio UPDATE/DELETE
- **AND** uma tentativa SQL direta de UPDATE/DELETE é rejeitada com `image_generation_operations_immutable`
- **AND** a linha histórica permanece inalterada

### Requirement: Contrato de reuso do snapshot original

O sistema SHALL preservar o contrato pelo qual nova geração/correção da **mesma** campanha reutiliza o snapshot **original**, independentemente da configuração vigente. (Contrato arquitetural; a execução da correção é da F56.3.)

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** uma correção da mesma campanha é considerada
- **THEN** o contrato resolve o snapshot original
- **AND** não adota a configuração vigente

### Requirement: Não sobrescrever o run/trace histórico

A estrutura SHALL NOT sobrescrever o `run_id`/`trace_id` histórico do snapshot único; a correlação de cada geração/tentativa SHALL ser preservada na relação append-only.

#### Scenario: Gerações sucessivas preservam a referência histórica

- **WHEN** a mesma campanha passa por mais de uma geração
- **THEN** cada geração/tentativa é registrada append-only
- **AND** a referência histórica anterior não é sobrescrita

#### Scenario: Correlação por tentativa permanece reconstruível

- **WHEN** as tentativas de uma campanha são inspecionadas
- **THEN** é possível reconstruir o par modelo–qualidade e o alvo de cada tentativa
- **AND** a correlação usa os identificadores de operação preservados

### Requirement: Snapshot imutável da configuração por campanha

Cada campanha do novo fluxo de imagem SHALL registrar um snapshot imutável da configuração usada, contendo no mínimo: par principal (`modelo` + `qualidade`), par fallback (`modelo` + `qualidade`), identificador/versão da configuração e origem. As origens válidas do novo fluxo são **`human_decision`** (escolha inicial aprovada pelo responsável) e **`selection`** (configuração persistida pelo admin). A origem **`default` NÃO existe** no novo fluxo: a resolução é fail-closed e não admite default silencioso; ausência de configuração é erro, não uma origem. O snapshot SHALL permanecer fiel à campanha.

**Nota de fronteira:** a gravação do snapshot numa campanha real é integração da F56.2; a F56.1 entrega o contrato e o componente com teste simulado.

#### Scenario: Campanha grava o snapshot

- **WHEN** uma campanha do novo fluxo é registrada
- **THEN** o snapshot da configuração usada é persistido
- **AND** o snapshot identifica o par principal, o fallback e a versão/origem da configuração (`human_decision` ou `selection`)
- **AND** a origem `default` não é usada

#### Scenario: Snapshot é imutável

- **WHEN** uma operação já iniciada tenta atualizar o snapshot
- **THEN** a alteração é rejeitada
- **AND** o snapshot original permanece inalterado

### Requirement: Alteração posterior do admin não muda o passado

Uma alteração posterior da configuração global no admin SHALL NOT modificar o snapshot de operações, campanhas ou correções já existentes. A operação já registrada SHALL continuar usando e reportando a configuração congelada em seu snapshot.

A resolução da configuração SHALL distinguir expressamente:

- **Nova campanha:** SHALL usar a configuração **vigente** no momento de sua criação.
- **Nova geração ou correção da mesma campanha:** SHALL reutilizar o snapshot **original** da campanha, independentemente da configuração vigente no admin, para não abrir a brecha de a correção de uma campanha existente adotar uma configuração nova.

#### Scenario: Mudança no admin não afeta operação existente

- **WHEN** o admin altera o par principal/fallback depois que uma operação foi registrada
- **THEN** o snapshot da operação anterior permanece com a configuração original
- **AND** uma eventual correção dessa campanha usa o snapshot registrado, não a configuração nova

#### Scenario: Nova campanha usa a configuração vigente

- **WHEN** uma **nova campanha** é iniciada após a mudança do admin
- **THEN** o snapshot da nova campanha registra a configuração vigente
- **AND** snapshots de campanhas anteriores permanecem intactos

#### Scenario: Correção da mesma campanha reutiliza o snapshot original

- **WHEN** o admin altera a configuração e, depois, uma campanha existente é corrigida ou regerada
- **THEN** a nova geração/correção da mesma campanha reutiliza o snapshot original da campanha
- **AND** ela NÃO adota a configuração vigente no admin
- **AND** o snapshot original permanece inalterado

### Requirement: Correlação do snapshot com a telemetria

O snapshot SHALL ser correlacionável com as chamadas de telemetria da mesma operação (run/trace), permitindo reconstruir qual par modelo–qualidade foi usado em cada tentativa e qual fallback foi acionado.

#### Scenario: Reconstrução por run/trace

- **WHEN** o admin/suporte inspeciona uma operação
- **THEN** é possível obter, a partir do snapshot, o par principal/fallback e a versão da configuração
- **AND** as chamadas de telemetria da operação são correlacionáveis ao snapshot pelo run/trace

### Requirement: Tolerância a operações legadas sem snapshot

Operações do fluxo legado, criadas antes desta fase, SHALL NOT ser quebradas pela ausência de snapshot. A ausência de snapshot em operações legadas SHALL ser tratada como estado esperado, e não como erro.

#### Scenario: Operação legada sem snapshot é tolerada

- **WHEN** uma operação legada é consultada
- **THEN** a ausência de snapshot não gera erro
- **AND** o comportamento do fluxo legado permanece inalterado
