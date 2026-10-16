# Product 1:1 Artifact Delivery

> B2.2 — recuperação da arte no Storage privado. A arte entregue é 1024×1024 em bucket privado com caminho imutável; a recuperação consulta a sonda tipada existente (`integral | absent | invalid | indeterminate`) e **nunca regenera** quando há arte íntegra. Restringe-se a operações **não terminais**.

## MODIFIED Requirements

### Requirement: Sem entrega sem arte íntegra e reenvio recupera arte salva

Sem arte íntegra persistida, o download SHALL permanecer recusado e a operação SHALL ficar pendente/limitada **até a recuperação**. Resultado desconhecido SHALL NOT liberar download. A recuperação SHALL consultar o Storage privado: **arte íntegra existente SHALL ser recuperada e a entrega concluída sem regenerar a imagem**; o reenvio SHALL apenas consultar a operação e SHALL NOT chamar o modelo novamente.

#### Scenario: Sem arte íntegra não há entrega

- **WHEN** não há arte íntegra persistida
- **THEN** o download é recusado
- **AND** a recuperação consulta o Storage privado antes de qualquer conclusão

#### Scenario: Reenvio recupera arte salva

- **WHEN** o lojista reenvia e existe arte salva íntegra para a operação
- **THEN** a arte salva é recuperada
- **AND** nenhuma nova chamada ao modelo é feita

#### Scenario: Resultado desconhecido não libera

- **WHEN** a operação está pendente por resultado desconhecido
- **THEN** o download continua recusado
- **AND** o reenvio não chama o modelo novamente

## ADDED Requirements

### Requirement: Recuperação da arte no Storage privado

A recuperação SHALL buscar a arte no **Storage privado** pelo caminho determinístico do novo fluxo e SHALL limitar-se a operações **não terminais** (`reserved`/`art_uploaded`). **Arte íntegra existente** SHALL ser recuperada e a entrega **concluída sem regenerar**. A recuperação SHALL usar o resultado **tipado** da sonda, sem colapsar erro/indisponibilidade com ausência. Uma operação `refunded` SHALL NOT retornar a `delivered` mesmo que apareça imagem atrasada.

A entrega da arte recuperada SHALL confirmar o **objeto EXISTENTE** após sonda `integral`, **sem novo upload** e **sem** depender do **token de posse** de publicação. A recuperação SHALL cobrir a operação cuja arte já foi anunciada/publicada (`in_flight`, `result_unknown`, `published` ou histórico pré-fence) e SHALL NOT reabrir operações **terminais** (`delivered`/`refunded`): **objeto íntegro** confirmado pela sonda SHALL ser **entregue**. Um estado de publicação **ainda não confirmado** (`in_flight`/`result_unknown`) **pode** ser encerrado pela **exceção administrativa autorizada** (capability de crédito) — a recuperação **não** promete que “arte íntegra sempre vence” nesse caminho —, mas uma operação `published` SHALL NOT ser estornada.

#### Scenario: Arte íntegra recuperada sem regenerar

- **WHEN** a sonda retorna `integral` para uma operação não terminal
- **THEN** a arte existente é recuperada
- **AND** a entrega é concluída sem regenerar a imagem
- **AND** nenhuma nova chamada ao modelo de imagem é feita

#### Scenario: Arte atrasada não reabre operação estornada

- **WHEN** uma imagem atrasada aparece para uma operação `refunded`
- **THEN** a operação permanece `refunded`
- **AND** não retorna a `delivered`

#### Scenario: Arte inválida ou indefinida não é ausência

- **WHEN** a sonda retorna `invalid` ou `indeterminate`
- **THEN** isso não é tratado como ausência da arte
- **AND** a recuperação reverifica e dá feedback honesto
- **AND** nenhuma conclusão de ausência é declarada

#### Scenario: Recuperação confirma objeto existente sem novo upload

- **WHEN** a sonda retorna `integral` para uma operação com publicação anunciada/publicada
- **THEN** a arte existente é confirmada e entregue
- **AND** nenhum novo upload ao Storage é realizado
- **AND** nenhuma nova chamada ao modelo é feita

### Requirement: Recuperação não regenera a imagem

A recuperação de imagem SHALL NOT regenerar nem modificar a arte e SHALL NOT criar reserva/cobrança adicional. Se houver arte recuperável, essa arte SHALL ser a entregue.

#### Scenario: Nenhuma regeneração

- **WHEN** há arte recuperável para a operação
- **THEN** a arte existente é entregue
- **AND** nenhuma nova imagem é gerada
- **AND** nenhum crédito adicional é consumido
