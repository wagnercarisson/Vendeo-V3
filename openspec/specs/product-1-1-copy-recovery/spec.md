# Product 1:1 Copy Recovery

> Synced from `fase-56-2b1b-nucleo-entregavel-produto-1-1` (ADDED).

## Purpose

Tratamento da **copy** no novo fluxo Produto 1:1: falha de copy não bloqueia a arte entregue, copy pendente não prolonga a entrega da imagem, estados persistidos com feedback seguro e **sem** retry (retry pertence à b2).

## Requirements

### Requirement: Falha de copy não bloqueia arte entregue

Falha apenas da copy SHALL ser persistida sem bloquear download da arte entregue; não SHALL gerar crédito adicional. Nesta change SHALL NOT existir botão ou endpoint de retry; retry pertence à b2.

#### Scenario: Copy falha

- **WHEN** arte é íntegra e operação `delivered`, mas copy falha
- **THEN** arte permanece baixável, estado de falha persiste e reserva é finalizada uma vez

#### Scenario: Sem retry

- **WHEN** copy está pendente/falha
- **THEN** nenhuma ação de retry é exposta nesta change

### Requirement: Copy pendente não prolonga a entrega da imagem

A entrega da imagem SHALL ser independente do estado da copy. Copy pendente SHALL NOT prolongar indefinidamente a entrega da imagem; a operação de imagem SHALL ser finalizada (`delivered`) segundo suas próprias evidências, sem aguardar a conclusão da copy.

#### Scenario: Imagem entrega com copy pendente

- **WHEN** a arte está íntegra e entregável, mas a copy ainda está pendente
- **THEN** a entrega da imagem é finalizada como `delivered`
- **AND** a pendência de copy não bloqueia nem adia indefinidamente a imagem

#### Scenario: Arte pendente não é liberada por copy

- **WHEN** a copy foi concluída mas a arte não está íntegra/`delivered`
- **THEN** o download da imagem permanece recusado

### Requirement: Estados persistidos e feedback seguro

Os estados da copy (pendente, concluída, falha) SHALL ser persistidos e exibidos ao lojista com **feedback seguro** (sem motivo interno). Cancelamentos SHALL ser tratados separadamente do estado de copy e não SHALL ser confundidos com falha de geração. Esta change SHALL NOT prometer retomada automática do processamento da copy.

#### Scenario: Estado exibido ao retornar

- **WHEN** o lojista retorna ao aplicativo
- **THEN** o estado persistido da copy é exibido
- **AND** o feedback ao lojista não expõe motivo interno

#### Scenario: Cancelamento separado

- **WHEN** a operação é cancelada pelo lojista
- **THEN** o cancelamento é registrado separadamente do estado de copy
- **AND** não é classificado como falha de geração
