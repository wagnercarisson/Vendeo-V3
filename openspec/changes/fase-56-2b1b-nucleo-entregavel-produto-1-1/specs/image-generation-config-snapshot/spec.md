# Image Generation Config Snapshot

## MODIFIED Requirements

### Requirement: Snapshot e histórico operacional

O sistema SHALL persistir antes de reserva/provider snapshot imutável da configuração vigente (par principal/fallback, versão e origem). Falha SHALL bloquear operação. Tentativas SHALL ser append-only vinculadas à campanha e snapshot, sem sobrescrever run/trace. Regeração/correção da mesma campanha SHALL reutilizar snapshot original.

#### Scenario: Persistência inicial
- **WHEN** campanha elegível inicia
- **THEN** snapshot é gravado antes de crédito/provider

#### Scenario: Tentativas sucessivas
- **WHEN** há múltiplas tentativas
- **THEN** histórico permite reconstruir par/target sem sobrescrever referências anteriores
