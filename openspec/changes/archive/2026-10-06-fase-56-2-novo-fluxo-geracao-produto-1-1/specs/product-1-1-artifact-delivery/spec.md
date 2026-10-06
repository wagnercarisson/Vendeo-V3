# Product 1:1 Artifact Delivery

## ADDED Requirements

### Requirement: Formato 1:1 com saída 1024×1024 e dimensões reais persistidas

O novo fluxo SHALL gerar e persistir a arte em formato 1:1 com saída **1024×1024**. As dimensões reais do arquivo persistido SHALL ser registradas. O sistema SHALL NOT declarar 1080×1080 para um arquivo de 1024×1024.

#### Scenario: Arte 1:1 com dimensões reais

- **WHEN** uma arte do novo fluxo é persistida
- **THEN** ela é 1:1 com saída 1024×1024
- **AND** as dimensões reais persistidas correspondem ao arquivo

#### Scenario: Não declarar 1080×1080

- **WHEN** o arquivo persistido é 1024×1024
- **THEN** nenhum registro declara 1080×1080
- **AND** as dimensões reportadas refletem o arquivo real

### Requirement: Download direto sem aprovação no novo fluxo

A arte do novo fluxo SHALL ficar disponível para uso/download **diretamente**, sem aprovação/reprovação humana e sem revisor automático nesta fatia.

#### Scenario: Download direto disponível

- **WHEN** uma campanha do novo fluxo tem a arte persistida
- **THEN** o lojista pode baixá-la diretamente
- **AND** nenhum gate de aprovação bloqueia a entrega

### Requirement: Regras de download das campanhas antigas preservadas

Campanhas criadas antes do novo fluxo SHALL manter as regras de download anteriores. A chave de ativação e a regeneração da F37 SHALL NOT governar o novo fluxo.

#### Scenario: Campanha antiga mantém regra anterior

- **WHEN** uma campanha antiga é baixada
- **THEN** ela segue as regras de download anteriores
- **AND** não é afetada pelo roteamento do novo fluxo

#### Scenario: F37 não governa o novo fluxo

- **WHEN** a regeneração da F37 está disponível para o legado
- **THEN** ela não é aplicada ao novo fluxo
- **AND** o novo fluxo não depende dela para entregar ou baixar
