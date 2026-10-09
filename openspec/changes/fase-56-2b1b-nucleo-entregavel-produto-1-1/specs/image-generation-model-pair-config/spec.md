# Image Generation Model Pair Config — Delivery Integration

## MODIFIED Requirements

### Requirement: Tratamento fail-closed de configuração inválida

A resolução da configuração para o novo fluxo SHALL ser **fail-closed**. Se a configuração estiver ausente, incompleta, ambígua ou divergente do catálogo elegível, a execução do novo fluxo SHALL falhar com erro identificável. O sistema SHALL NOT substituir silenciosamente o modelo escolhido por um default ou por outra capacidade. Na b1b, a execução SHALL exigir pricing `complete` para **principal e fallback** antes de reserva/provider, e SHALL congelar a configuração resolvida no snapshot.

#### Scenario: Configuração ausente falha fechado

- **WHEN** o novo fluxo tenta resolver a configuração e ela não existe
- **THEN** a execução do novo fluxo falha com erro identificável
- **AND** nenhum modelo alternativo é escolhido silenciosamente

#### Scenario: Configuração divergente do catálogo falha fechado

- **WHEN** a configuração vigente aponta para um modelo/qualidade fora do catálogo elegível
- **THEN** a execução do novo fluxo falha com erro identificável
- **AND** o erro é correlacionável a diagnóstico interno

#### Scenario: Pricing incompleto bloqueia execução

- **WHEN** a cobertura de pricing de qualquer par (principal ou fallback) não é `complete`
- **THEN** a execução é bloqueada antes de reserva e provider
- **AND** nenhum valor é inventado

#### Scenario: Configuração congelada no snapshot

- **WHEN** a configuração é resolvida com sucesso
- **THEN** ela é congelada no snapshot antes da reserva/provider
- **AND** permanece imutável para a operação
