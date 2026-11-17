## ADDED Requirements

### Requirement: Campanha conjunta elegível no dashboard sem duplicar card

O dashboard SHALL considerar elegível a campanha conjunta com pelo menos um formato entregue e `status = ready`. A campanha conjunta SHALL aparecer no máximo uma vez entre as campanhas recentes, com indicação dos formatos `1:1` e `9:16` e sem criar uma linha por formato. A contagem de campanhas disponíveis SHALL contar a campanha uma única vez. A miniatura SHALL ser derivada, com preferência para o quadrado quando entregue. A ação de abertura SHALL permanecer disponível mesmo quando apenas um formato estiver entregue ou a miniatura estiver indisponível.

#### Scenario: Campanha conjunta parcial aparece uma vez

- **WHEN** a campanha conjunta está `ready` com o quadrado entregue e o vertical ausente
- **THEN** o dashboard SHALL exibir uma única linha para a campanha
- **AND** SHALL indicar os dois formatos
- **AND** a contagem SHALL incrementar uma única vez

#### Scenario: Miniatura quadrada é preferida no dashboard

- **WHEN** o quadrado está entregue e possui miniatura derivada
- **THEN** o dashboard SHALL exibir a miniatura do quadrado
- **AND** SHALL NOT usar o original como fallback

#### Scenario: Abertura permanece disponível sem miniatura

- **WHEN** a miniatura está indisponível
- **THEN** o dashboard SHALL exibir o fallback visual
- **AND** a ação “Abrir campanha” SHALL permanecer disponível

#### Scenario: Campanha sem formato entregue não entra no dashboard

- **WHEN** a campanha conjunta não possui nenhum formato entregue
- **THEN** o dashboard SHALL NOT exibi-la entre as campanhas elegíveis
