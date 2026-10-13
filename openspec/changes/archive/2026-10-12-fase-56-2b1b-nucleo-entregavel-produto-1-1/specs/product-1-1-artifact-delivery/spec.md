# Product 1:1 Artifact Delivery

## ADDED Requirements

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

Sem arte íntegra persistida, o download SHALL permanecer recusado e a operação SHALL ficar pendente/limitada, sem prometer recuperação automática. Resultado desconhecido SHALL NOT liberar download. O **reenvio do lojista** SHALL apenas consultar a operação: **se houver arte salva, recupera essa arte**; caso contrário, **não** chama o modelo novamente.

#### Scenario: Sem arte íntegra não há entrega

- **WHEN** não há arte íntegra persistida
- **THEN** o download é recusado
- **AND** nenhuma recuperação automática é prometida

#### Scenario: Reenvio recupera arte salva

- **WHEN** o lojista reenvia e existe arte salva para a operação
- **THEN** a arte salva é recuperada
- **AND** nenhuma nova chamada ao modelo é feita

#### Scenario: Resultado desconhecido não libera

- **WHEN** a operação está pendente por resultado desconhecido
- **THEN** o download continua recusado
- **AND** o reenvio não chama o modelo novamente
