# Product 1:1 Artifact Delivery

## ADDED Requirements

### Requirement: Arte e dimensões reais

Arte nova SHALL ser 1:1 1024×1024, dimensões reais persistidas, em `campaign-images` sob prefixo próprio e caminho imutável.

#### Scenario: Persistência imutável
- **WHEN** arte nova é persistida
- **THEN** dimensões 1024×1024 correspondem ao arquivo e caminho não sobrescreve legado

### Requirement: Download só após delivered

O download novo SHALL exigir campanha do fluxo persistido, objeto íntegro e operação `delivered`. Upload não SHALL liberar download. Campanhas antigas SHALL seguir regras anteriores; F37 SHALL NOT governar o novo fluxo.

#### Scenario: Reserva/upload sem delivered
- **WHEN** há objeto no storage mas a operação não está `delivered`
- **THEN** download é recusado

#### Scenario: Entregue
- **WHEN** campanha nova íntegra está `delivered`
- **THEN** download direto é liberado sem gate de aprovação/revisor
