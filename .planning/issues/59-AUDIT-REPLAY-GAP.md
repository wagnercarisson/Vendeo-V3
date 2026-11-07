# Pendência separada — auditoria do replay terminal idempotente

Status: **aceita formalmente como exceção de rastreabilidade nesta fase; NÃO corrigida.**
Data do aceite: 2026-11-06. Escopo: F59 (homolog), replay administrativo.

## Evidência

- Campanha: `e5ac1195-eb96-4076-b93c-06ec32962b88` (caso D sintético).
- Operação: `964c323b-c0c1-4249-974f-3f5386aa06a0`.
- Resolução: `refund_once`, `resolutionOperationId`
  `dd7ddce5-2be4-47bd-b310-c0f87a6d72eb`.
- Resultado: campanha `error`; operação `refunded`; `refund_tx_id`
  `35ed3cde-a152-434d-b797-57eaa8faeceb`; saldo 0; nenhuma transação nova;
  nenhum provider.
- `admin_audit_log`: **nenhuma linha** para `dd7ddce5…`.

## Mecanismo responsável

`public.admin_resolve_product_1_1_pending` possui retorno antecipado:

```sql
IF v_credit.status = 'refunded' AND p_action = 'refund_once' THEN
  RETURN jsonb_build_object('success', true, 'idempotent', true, ...);
END IF;
```

Esse retorno ocorre **antes** do `INSERT INTO public.admin_audit_log`. O serviço
`resolvePendingOperation` ainda executa `projectClosedCampaign`, que muda a campanha
para `error`. Portanto o replay terminal é idempotente por desenho, mas não gera nova
auditoria da projeção.

## Impacto

- Rastreabilidade: a projeção de encerramento não tem linha de auditoria própria.
- Financeiro: **não há falha de estorno**; `refund_tx_id` e ledger permanecem
  íntegros e inalterados.
- Funcional: campanha fechada corretamente em `error`.

## Aceite

O responsável aceitou formalmente a lacuna nesta fase como exceção de rastreabilidade.
A correção do mecanismo (auditar replay terminal idempotente) fica para trabalho
separado. **Não marcar como corrigida.**

## Correção futura sugerida

Mover o `INSERT` de auditoria para antes do retorno terminal idempotente, ou registrar
a projeção de encerramento em evento auditável próprio, com testes de replay.
