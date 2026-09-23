# Backup Continuity

> Capability nova (ADDED) pela `fase-50-demonstracao-gratuita-e-validade-dos-creditos` (D26). Continuidade temporária: Supabase permanece como banco/auth/storage; backup externo restaurável é gate do primeiro convite.

## ADDED Requirements

### Requirement: Supabase permanece o provedor

O sistema SHALL manter Supabase como banco, autenticação e storage da F50/beta, **sem** migração para R2 nesta fase.

#### Scenario: Sem migração de storage

- **WHEN** a F50 executa
- **THEN** banco/auth/storage continuam no Supabase

### Requirement: Backup externo temporário antes do primeiro convite

O sistema SHALL executar, **antes do primeiro convite**, um backup externo temporário: dump lógico do banco + cópia dos objetos de **todos os buckets**, criptografia, destino externo privado, retenção rotativa de 30 dias, **checksum** e **teste real de restauração**. O teste de restore SHALL cobrir **banco + metadados + objetos do storage**, com **contagem de linhas/objetos**, **verificação de checksum** e **leitura assinada de um arquivo restaurado**.

#### Scenario: Backup restaurável comprovado (banco + metadados + objetos)

- **WHEN** o primeiro convite é liberado
- **THEN** há evidência de restauração do banco e dos objetos, com contagem/checksum conferidos e **leitura assinada de um arquivo restaurado**

#### Scenario: Segredos e backups fora do Git

- **WHEN** o backup é configurado
- **THEN** credenciais/segredos e os artefatos de backup não entram no repositório

### Requirement: Rollout bloqueado até restauração

O sistema SHALL permitir a **conclusão técnica** da fase antes do convite, mas o **rollout permanece bloqueado** até existir evidência de restauração.

#### Scenario: Convite bloqueado sem backup restaurável

- **WHEN** não há evidência de restauração
- **THEN** o primeiro convite não é liberado (mesmo com a fase tecnicamente concluída)
