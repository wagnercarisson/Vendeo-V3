## ADDED Requirements

### Requirement: Função SQL cleanup_generation_events_90d()

O sistema SHALL criar uma função SQL `public.cleanup_generation_events_90d()` via migration `20260718000003_cleanup_generation_events_90d.sql`.

A migration SHALL apenas **definir** a função (CREATE OR REPLACE FUNCTION), nunca executá-la.

```sql
CREATE OR REPLACE FUNCTION public.cleanup_generation_events_90d()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.generation_events
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
```

#### Scenario: Migration cria função sem executar

- **WHEN** a migration `20260718000003` é aplicada
- **THEN** a função `public.cleanup_generation_events_90d()` existe
- **AND** nenhum DELETE foi executado durante a migration

#### Scenario: Função retorna número de registros deletados

- **WHEN** `SELECT public.cleanup_generation_events_90d()` é chamado e há 5 registros com `created_at < NOW() - 90 days`
- **THEN** retorna `5`
- **AND** esses 5 registros não existem mais em `generation_events`
