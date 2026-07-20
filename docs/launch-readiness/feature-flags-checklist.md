# Feature Flags — Check List

**Verificado em:** 2026-07-20
**Fonte:** `src/lib/launch-config/config.ts`

## Flags Atuais

| Flag | Valor Atual | Recomendado para Launch | Notas |
|------|-------------|------------------------|-------|
| `VENDEO_V15_ENABLED` | `true` (default) | `true` | Essencial — habilita todo o pipeline v1.5 |
| `VENDEO_CREDITS_CHARGING_ENABLED` | `true` (default) | `true` | Essencial — debita créditos nas gerações |
| `VENDEO_COPY_DIRECTOR_ENABLED` | `true` (default) | `true` | Essencial — Copy Director com IA |
| `VENDEO_RATE_LIMIT_ENABLED` | `true` (default) | `true` | Essencial — protege contra abuso |
| `VENDEO_GENERATION_PAUSED` | `false` (default) | `false` | Deve estar `false` para operação normal |

## Recomendações

1. **Antes do launch:** Confirmar que `VENDEO_GENERATION_PAUSED=false` no ambiente de produção
2. **Durante beta controlado:** Manter todas as flags como `true` exceto `VENDEO_GENERATION_PAUSED`
3. **Em caso de incidente:** Setar `VENDEO_GENERATION_PAUSED=true` para pausar gerações sem desligar o sistema
4. **Rollback de emergência:** Setar `VENDEO_V15_ENABLED=false` desativa todas as features v1.5

## Como alterar

As flags são configuradas via variáveis de ambiente no Vercel. Nenhuma migration necessária.
