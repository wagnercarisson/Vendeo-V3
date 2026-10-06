# Image Generation Config Snapshot

> Synced from `fase-56-1-contrato-produtivo-modelos-fallback` (ADDED).

## Purpose

Contrato de snapshot **imutável** da configuração de geração (par principal/fallback, versão e origem) registrado por operação, garantindo reprodutibilidade e impedindo que alterações posteriores no admin reescrevam o histórico de campanhas e correções.

## Requirements

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
