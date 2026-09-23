# Backup Continuity

## Purpose

Garantir continuidade temporária do beta com Supabase e backup externo restaurável antes do primeiro convite.

## Requirements

### Requirement: Supabase permanece o provedor

O sistema SHALL manter Supabase como banco, autenticação e storage, sem migração para R2 nesta fase.

### Requirement: Backup externo temporário antes do primeiro convite

O sistema SHALL executar antes do primeiro convite dump lógico do banco e cópia dos objetos de todos os buckets, com criptografia, destino externo privado, retenção rotativa de 30 dias, checksum e teste real de restauração. O restore SHALL cobrir banco, metadados e objetos, contagens, checksum e leitura assinada de arquivo restaurado.

#### Scenario: Backup restaurável comprovado

- **WHEN** o primeiro convite é liberado
- **THEN** há evidência de restauração do banco, metadados e objetos com contagem de linhas/objetos, checksum verificado e leitura assinada de um arquivo restaurado

#### Scenario: Segredos fora do Git

- **WHEN** o backup é configurado
- **THEN** credenciais, segredos e artefatos não entram no repositório

### Requirement: Rollout bloqueado até restauração

O sistema SHALL permitir conclusão técnica antes do convite, mas manter o rollout bloqueado sem evidência de restauração.

#### Scenario: Convite bloqueado sem backup restaurável

- **WHEN** não há evidência de restauração
- **THEN** o primeiro convite não é liberado
