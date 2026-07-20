# Cleanup 90 Dias — Decisão

**Verificado em:** 2026-07-20
**Referência:** D8 — Pipeline de Geração

## Função de Cleanup

A função `cleanup_generation_events_90d()` existe e está versionada nas migrations da F25/F28.

### Comando de invocação (runbook)

```sql
SELECT public.cleanup_generation_events_90d();
```

### Localização da migration

A migration que cria a função está em `supabase/migrations/` (encontrada durante a F25).

## Status

| Item | Status |
|------|--------|
| Função SQL existe e versionada | ✅ OK |
| Comando documentado no runbook | ✅ OK |
| Job automático agendado | ⏳ Pendente — agendar para D+30 pós-launch |

## Plano

1. **No launch:** Manter cleanup manual via runbook
2. **D+30:** Agendar job automático (pg_cron ou Vercel Cron)
3. **D+90:** Primeira execução automática cobre dados de 90 dias atrás

## Lembrete

- [ ] D+30: Agendar job automático de cleanup
- [ ] D+90: Verificar primeira execução automática
