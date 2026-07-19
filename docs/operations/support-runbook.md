# Support Runbook

## Conceder Créditos Manualmente

Via admin UI (`/admin/users`):
1. Localizar o usuário/loja
2. Clicar em "Conceder Créditos"
3. Informar quantidade e motivo

Alternativa via SQL:
```sql
SELECT public.admin_grant_credits(
  p_actor_id := '<admin-user-id>',
  p_store_id := '<store-id>',
  p_amount := <quantidade>,
  p_reason := 'Motivo da concessão',
  p_operation_id := gen_random_uuid()
);
```

## Estornar Transação

Se uma transação de crédito precisa ser estornada:
```sql
SELECT public.refund_credit(
  p_store_id := '<store-id>',
  p_amount := <quantidade>,
  p_reason := 'Estorno manual',
  p_idempotency_key := 'manual_refund_' || gen_random_uuid()
);
```

## Verificar Saldo/Extrato de Loja

Acesso admin:
1. Acessar `/admin/users`
2. Localizar o usuário
3. O saldo aparece na listagem
4. Clicar para ver extrato detalhado

## Investigar Campanha com Erro

1. Acessar `/admin/campaigns/errors`
2. Identificar a campanha com erro
3. Verificar `generation_events` para diagnóstico:
```sql
SELECT * FROM public.generation_events
WHERE campaign_id = '<campaign-id>'
ORDER BY created_at DESC;
```

## Executar Cleanup Manual de Generation Events

Para aplicar retenção de 90 dias:
```sql
SELECT public.cleanup_generation_events_90d();
```
Retorna o número de linhas deletadas.

## Pausar Geração

Ativar emergency brake via env var no Vercel:
```
VENDEO_GENERATION_PAUSED=true
```
Isso faz com que `POST /api/campaign/generate-image` retorne 503 antes de qualquer operação.

## Procedimentos por Health State

### Healthy (🟢)
Sistema operando normalmente. Nenhuma ação necessária.

### Attention (🟡)
Monitorar indicadores. Investigar causas se o estado persistir por mais de 1 hora:
1. Verificar logs no Vercel
2. Verificar erros recentes em `/admin/campaigns/errors`
3. Verificar `generation_events` para padrões de falha

### Pause (🔴)
Ação imediata necessária:
1. Considerar pausar geração (`VENDEO_GENERATION_PAUSED=true`)
2. Investigar causa raiz
3. Resolver antes de reativar
4. Comunicar time sobre o incidente
