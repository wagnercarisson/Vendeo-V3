## ADDED Requirements

### Requirement: Fonte entregue registrada para expansão posterior

O sistema SHALL poder registrar, como `square_original` interno, uma fonte de campanha `1:1` já entregue, por cópia byte-idêntica validada, com identidade estável por fonte/campanha. Quando já existir um `square_original` interno íntegro com a identidade da fonte, `origin=provider_generation`, correspondente à operação primária e com bytes/checksum iguais aos da imagem entregue atual, o sistema SHALL reutilizá-lo sem alterar origem, bytes, proveniência ou identidade. Caso contrário, o registro SHALL usar a origem explícita de reuso de campanha entregue (`delivered_campaign_reuse`), `source.kind = delivered_campaign_source`, vínculo à campanha-fonte e proveniência com path, largura, altura, MIME, tamanho e checksum recalculados. As origens suportadas SHALL ser `new_flow_1_1` e `legacy_campaign`; no fluxo novo, a identidade de registro SHALL ser a operação `1:1` primária entregue que sustenta a fonte; no legado, SHALL ser uma identidade sintética determinística, sem operação financeira. O registro SHALL NOT ser tratado como geração por provider ou transformação determinística; o artefato original SHALL permanecer intacto. A operação SHALL ser idempotente, reutilizar a evidência durável existente e convergir para uma única ponte por fonte/campanha.

#### Scenario: Registro de fonte entregue é criado

- **WHEN** uma fonte de campanha `1:1` entregue é validada como JPEG 1024×1024 íntegro e não existe `square_original` original correspondente
- **THEN** o sistema SHALL persistir a linha `square_original` com a origem de reuso de campanha entregue
- **AND** os bytes persistidos SHALL ser idênticos aos bytes validados
- **AND** o checksum persistido SHALL ser o recalculado dos bytes
- **AND** o artefato original da campanha SHALL permanecer inalterado

#### Scenario: Original provider_generation íntegro é reutilizado

- **WHEN** já existe `square_original` interno com `origin=provider_generation`, a mesma operação primária e bytes/checksum iguais aos da imagem entregue atual
- **THEN** o sistema SHALL reutilizar essa linha como fonte
- **AND** SHALL NOT criar `delivered_campaign_reuse` na mesma identidade
- **AND** SHALL NOT alterar origem, bytes, proveniência, path ou identidade
- **AND** a validação da abertura SHALL aceitar a linha original

#### Scenario: Legado 1024 é registrado sem operação financeira

- **WHEN** uma fonte de campanha `legacy_campaign` é validada como JPEG 1024×1024 íntegro no path histórico canônico
- **THEN** o sistema SHALL persistir a ponte com identidade sintética determinística e `source_campaign_id` da campanha
- **AND** SHALL registrar a procedência histórica no vínculo/proveniência
- **AND** SHALL NOT criar operação financeira original, reserva ou crédito para a fonte
- **AND** SHALL NOT converter 1080×1080 nem aceitar outro path

#### Scenario: Mesma identidade e concorrência reutilizam o registro

- **WHEN** o registro é solicitado novamente com a mesma identidade, bytes e proveniência, ou duas aberturas concorrentes tentam criá-lo
- **THEN** o sistema SHALL retornar `reused` ou convergir para uma única linha
- **AND** SHALL NOT executar segundo upload útil, segundo insert ou transformação
- **AND** SHALL NOT chamar provider

#### Scenario: Origem de reuso não é confundida com geração

- **WHEN** uma linha de composição tem origem `delivered_campaign_reuse`
- **THEN** o sistema SHALL reconhecê-la como fonte registrada de campanha entregue
- **AND** SHALL NOT descrevê-la como `provider_generation` ou `deterministic_preparation`
- **AND** SHALL NOT permitir que ela satisfaça o papel `square_prepared` ou `vertical`

#### Scenario: Proveniência divergente falha fechado

- **WHEN** a identidade já existe com campanha-fonte, checksum, dimensão ou proveniência diferentes
- **THEN** o sistema SHALL retornar conflito de conteúdo ou proveniência
- **AND** SHALL NOT sobrescrever o objeto ou a linha existente
- **AND** SHALL NOT iniciar operação financeira
