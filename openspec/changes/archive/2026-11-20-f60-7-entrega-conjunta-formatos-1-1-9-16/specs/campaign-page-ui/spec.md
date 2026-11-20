## ADDED Requirements

### Requirement: Detalhe da campanha conjunta com acesso individual por formato

O detalhe `/campanhas/[id]` SHALL reconhecer a campanha conjunta e exibir os formatos `1:1` e `9:16` em uma organização única, com seleção por `?format=1:1|9:16`. Cada formato entregue SHALL oferecer preview e download próprios. A copy SHALL ser exibida uma única vez e compartilhada pelos dois formatos. O formato em processamento SHALL indicar o estado e manter o acompanhamento do servidor sem iniciar geração. O formato ausente SHALL informar a ausência e, quando o crédito estiver comprovadamente devolvido, SHALL informar o crédito devolvido. O formato desconhecido SHALL exibir verificação/suporte, sem recuperação de imagem.

#### Scenario: Detalhe conjunto mostra os dois formatos

- **WHEN** o lojista abre o detalhe de uma campanha conjunta
- **THEN** o detalhe SHALL exibir os formatos `1:1` e `9:16`
- **AND** a copy compartilhada SHALL aparecer uma única vez
- **AND** cada formato entregue SHALL ter preview e download individuais

#### Scenario: Formato escolhido na URL é pré-selecionado

- **WHEN** o detalhe é aberto com `?format=1:1` ou `?format=9:16`
- **THEN** o formato correspondente SHALL estar selecionado
- **AND** a URL inválida ou formato não pertencente à campanha SHALL falhar fechado sem assinar arte

#### Scenario: Entrega parcial não esconde o formato entregue

- **WHEN** o quadrado está entregue e o vertical está ausente com crédito devolvido
- **THEN** o detalhe SHALL exibir o quadrado com preview e download
- **AND** SHALL informar o vertical ausente e o crédito devolvido
- **AND** SHALL NOT ocultar ou invalidar o quadrado

#### Scenario: Formato em processamento mantém acompanhamento

- **WHEN** um formato está em processamento
- **THEN** o detalhe SHALL indicar o estado
- **AND** SHALL continuar acompanhando o estado persistido
- **AND** SHALL NOT iniciar nova geração

#### Scenario: Formato desconhecido não oferece recuperação de imagem

- **WHEN** um formato tem resultado desconhecido
- **THEN** o detalhe SHALL exibir verificação/suporte
- **AND** SHALL NOT oferecer recuperação de imagem ou nova geração

#### Scenario: Formato ausente não oferece geração nesta fatia

- **WHEN** um formato está ausente
- **THEN** o detalhe SHALL informar a ausência
- **AND** SHALL NOT oferecer modal, confirmação, custo ou ação de geração nesta fatia
