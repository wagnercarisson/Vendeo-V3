# Product 1:1 Artifact Delivery

> Synced from `fase-56-2b1b-nucleo-entregavel-produto-1-1` (ADDED) and `fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1` (1 MODIFIED + 2 ADDED).

## Purpose

Entrega da arte do novo fluxo Produto 1:1: arte real 1024×1024 em bucket **privado** com caminho imutável, e download liberado **somente** após `delivered` com objeto íntegro; reenvio recupera arte salva sem nova chamada ao modelo.

## Requirements

### Requirement: Arte e dimensões reais

Arte nova SHALL ser 1:1 1024×1024, dimensões reais persistidas, em `campaign-images` (bucket **privado**) sob prefixo próprio e caminho imutável, com upload `upsert: false`.

#### Scenario: Persistência imutável

- **WHEN** arte nova é persistida
- **THEN** dimensões 1024×1024 correspondem ao arquivo e caminho não sobrescreve legado
- **AND** o bucket permanece privado, acessível apenas por URL assinada

#### Scenario: Upload não sobrescreve

- **WHEN** a arte nova é gravada
- **THEN** o caminho é imutável e nenhum arquivo anterior é sobrescrito

### Requirement: Download só após delivered

O download novo SHALL exigir campanha do fluxo persistido, objeto íntegro e operação `delivered`. Upload não SHALL liberar download. Campanhas antigas SHALL seguir regras anteriores; F37 SHALL NOT governar o novo fluxo.

#### Scenario: Reserva/upload sem delivered

- **WHEN** há objeto no storage mas a operação não está `delivered`
- **THEN** download é recusado

#### Scenario: Entregue

- **WHEN** campanha nova íntegra está `delivered`
- **THEN** download direto é liberado sem gate de aprovação/revisor

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
