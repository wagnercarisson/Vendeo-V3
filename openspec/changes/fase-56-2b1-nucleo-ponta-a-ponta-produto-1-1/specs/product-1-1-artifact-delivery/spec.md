# Product 1:1 Artifact Delivery

## ADDED Requirements

### Requirement: Formato 1:1 com saída 1024×1024 e dimensões reais persistidas

O novo fluxo SHALL gerar e persistir a arte em 1:1 com saída **1024×1024**, registrando as dimensões reais do arquivo. Nenhum registro SHALL declarar 1080×1080 para arquivo 1024×1024.

#### Scenario: Arte 1:1 com dimensões reais

- **WHEN** uma arte do novo fluxo é persistida
- **THEN** ela é 1:1 com saída 1024×1024
- **AND** as dimensões reais persistidas correspondem ao arquivo

#### Scenario: Não declarar 1080×1080

- **WHEN** o arquivo persistido é 1024×1024
- **THEN** nenhum registro declara 1080×1080
- **AND** as dimensões reportadas refletem o arquivo real

### Requirement: Persistência imutável com prefixo próprio

A arte do novo fluxo SHALL ser persistida em `campaign-images` com **prefixo próprio** e caminhos **imutáveis**, sem sobrescrever objetos de campanhas legadas.

#### Scenario: Arte persistida sob prefixo próprio

- **WHEN** a arte do novo fluxo é armazenada
- **THEN** ela usa o prefixo próprio do novo fluxo
- **AND** o caminho é imutável

### Requirement: Download direto sem aprovação no novo fluxo

A arte do novo fluxo SHALL ficar disponível para download **diretamente**, sem aprovação/reprovação humana e sem revisor automático, **somente quando a operação estiver `delivered`** (crédito resolvido). O upload da arte ao storage, por si só, SHALL NOT liberar o download. O download SHALL ser decidido pelo fluxo persistido da campanha.

#### Scenario: Download liberado somente após a entrega confirmada

- **WHEN** a campanha do novo fluxo tem a operação em `delivered`
- **THEN** o lojista pode baixá-la diretamente
- **AND** nenhum gate de aprovação bloqueia a entrega

#### Scenario: Upload isolado não libera download

- **WHEN** a arte foi enviada ao storage, mas a operação ainda não está `delivered`
- **THEN** o download não é liberado
- **AND** a liberação depende da resolução do crédito

### Requirement: Regras de download das campanhas antigas preservadas

Campanhas antigas SHALL manter as regras de download anteriores; a chave e a regeneração da F37 SHALL NOT governar o novo fluxo.

#### Scenario: Campanha antiga mantém regra anterior

- **WHEN** uma campanha antiga é baixada
- **THEN** ela segue as regras anteriores
- **AND** não é afetada pelo roteamento do novo fluxo

#### Scenario: F37 não governa o novo fluxo

- **WHEN** a regeneração da F37 está disponível para o legado
- **THEN** ela não é aplicada ao novo fluxo
- **AND** o novo fluxo não depende dela para entregar ou baixar
