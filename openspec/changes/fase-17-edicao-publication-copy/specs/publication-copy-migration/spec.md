# Publication Copy Migration

> Part of `fase-17-edicao-publication-copy` (ADDED).

## Purpose

Migration SQL que adiciona a coluna `publication_copy_current` (JSONB, nullable) na tabela `public.campaigns` para armazenar a versão editada pelo usuário do publication copy. O campo `publication_copy_snapshot` permanece imutável.

## ADDED Requirements

### Requirement: Migration ADD COLUMN publication_copy_current

O sistema SHALL prover uma migration SQL que adiciona a coluna `publication_copy_current` à tabela `public.campaigns`.

A migration SHALL:
- Usar `ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS publication_copy_current JSONB;`
- Incluir `COMMENT ON COLUMN` com descrição: "Versão editada pelo usuário do publication copy. Se null, usar publication_copy_snapshot como fallback."
- Ser nomeada no padrão `_<timestamp>_add_publication_copy_current.sql`
- Ser não destrutiva — não altera dados existentes, não remove colunas
- Preservar `publication_copy_snapshot` inalterado

#### Scenario: Migration adiciona coluna sem quebrar dados existentes

- **WHEN** a migration é executada em uma tabela `campaigns` com registros existentes
- **THEN** a coluna `publication_copy_current` é adicionada como JSONB nullable
- **AND** todos os registros existentes têm `publication_copy_current = null`
- **AND** `publication_copy_snapshot` permanece inalterado

#### Scenario: Migration é idempotente

- **WHEN** a migration é executada novamente
- **THEN** não causa erro (deve usar `IF NOT EXISTS` ou ser gerenciada pelo Supabase migrations)
