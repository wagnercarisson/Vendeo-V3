## ADDED Requirements

### Requirement: Card único com indicadores de formato para campanha conjunta

A listagem `/campanhas` SHALL exibir no máximo um card por campanha conjunta. O card SHALL identificar os formatos `1:1` e `9:16` com indicadores de estado independentes (`entregue`, `em processamento`, `ausente` ou `indisponível`). O formato entregue SHALL ser clicável e SHALL abrir o detalhe no formato escolhido (`/campanhas/[id]?format=1:1|9:16`). O formato em processamento SHALL apenas indicar o estado, sem iniciar geração. O formato ausente SHALL informar a ausência, sem ação de geração nesta fatia. A campanha com um formato entregue e o outro não SHALL ser apresentada como parcial, sem duplicar o card.

#### Scenario: Campanha conjunta aparece uma única vez

- **WHEN** a listagem contém uma campanha conjunta
- **THEN** exatamente um card SHALL ser renderizado
- **AND** o card SHALL exibir indicadores para `1:1` e `9:16`
- **AND** SHALL NOT renderizar um card separado por formato

#### Scenario: Indicador entregue abre o formato escolhido

- **WHEN** o usuário aciona o indicador `9:16` de um formato entregue
- **THEN** a navegação SHALL abrir `/campanhas/[id]?format=9:16`
- **AND** o detalhe SHALL pré-selecionar o vertical

#### Scenario: Indicador em processamento não inicia geração

- **WHEN** um formato está em processamento
- **THEN** o indicador SHALL exibir o estado
- **AND** SHALL NOT iniciar nova geração, reserva ou chamada ao provider

#### Scenario: Indicador ausente informa sem ação

- **WHEN** um formato está ausente
- **THEN** o card SHALL informar a ausência
- **AND** SHALL NOT oferecer modal, confirmação ou ação de geração nesta fatia

#### Scenario: Entrega parcial é identificada

- **WHEN** exatamente um dos formatos está entregue e o outro não
- **THEN** o card SHALL indicar a entrega parcial
- **AND** o formato entregue SHALL permanecer acessível e baixável

### Requirement: Miniatura preferida e sempre derivada na listagem conjunta

O card da campanha conjunta SHALL usar miniatura derivada. A miniatura do quadrado SHALL ser preferida quando o quadrado estiver entregue; se apenas o vertical estiver entregue, SHALL ser usada a miniatura do vertical. A ausência da miniatura SHALL renderizar placeholder e SHALL NOT usar o artefato original como fallback.

#### Scenario: Quadrado entregue define a miniatura

- **WHEN** o quadrado está entregue e possui miniatura derivada
- **THEN** o card SHALL exibir a miniatura do quadrado

#### Scenario: Somente vertical entregue usa miniatura vertical

- **WHEN** apenas o vertical está entregue e possui miniatura derivada
- **THEN** o card SHALL exibir a miniatura do vertical

#### Scenario: Sem miniatura não usa original

- **WHEN** a miniatura derivada está ausente ou a assinatura falha
- **THEN** o card SHALL exibir placeholder
- **AND** SHALL NOT assinar ou exibir a arte original
