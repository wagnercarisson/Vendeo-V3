## Contexto

F56.2b1a separa readiness/isolamento, gate independente e ledger transacional do wiring entregável. A autorização não depende das duas feature flags; ambas precisam ser lidas sem erro, mas apenas a flag aplicável ao escopo precisa estar ligada junto da autorização.

## Decisões

### A1 — Diagnóstico e gate de instância

O **primeiro plano da b1a** é exclusivamente diagnóstico somente leitura de serviços, rotas e logs sanitizados do reset F56.2a que terminou exit 1 / HTTP 502. Causa não identificada; não presumir Docker/Kong e não repetir reset nem executar migration/comando de banco como diagnóstico. O gate explícito comprova identidade/isolamento, conectividade/saúde, schema esperado, flags false e fixtures ausentes. Nenhum teste transacional pode começar antes de todos os critérios do gate estarem registrados como aprovados. Se inconclusivo, parar e propor instância descartável nova; validar identidade, serviços e schema nessa instância antes de autorizar testes transacionais.

### A2 — Autorização independente

Armazenar em tabela durável dedicada `product_flow_stage_authorizations`, separada de `feature_flags`, com estágio/escopo, ambiente ou identidade da instância, `granted_by`, `granted_at`, expiração, revogação, motivo e `operation_id`; histórico de concessões/revogações append-only. Admin autenticado via `requireAdmin()` solicita concessão/revogação à API administrativa; RPC `SECURITY DEFINER` deriva actor da sessão server-side e exige motivo/`operation_id`; escrita direta não permitida. Roteador sempre revalida estágio, escopo, instância, expiração e revogação. Estágios `off → piloto isolado → lojas de teste → todas as lojas`; somente revogação emergencial pode retornar a `off`.

Nesta change, controles operacionais não concedem estágio habilitador. Para testar lógica de estágios, usar fixtures/dados controlados diretamente na instância descartável e invocar a função pura de decisão/roteamento em harness; nenhuma chamada à API/RPC de concessão, provider ou rota de geração.

### A3 — Flag aplicável e payload incompatível

Ler ambas as flags validamente. Loja de teste requer flag test-stores; escopo geral requer flag all-stores; somente a flag aplicável precisa estar ligada, além da autorização. Se ambas true, geral prevalece sem eliminar a autorização. Payload com campos novos inelegível é recusado antes de crédito; payload legado sem campos exclusivos conserva o ramo legado.

### A4 — Reserva temporária e cobrança definitiva

Uma única transação Postgres reserva (dedução temporária) e cria estado `reserved`, identificados por `campaignId + operation_id`. No estado `reserved`, o saldo disponível diminui, mas o consumo ainda não é definitivo. `delivered` confirma definitivamente um crédito; `refunded` restaura a reserva. A criação do estado e a reserva commitam ou revertem juntas. Reconciliação de órfão é excepcional, não caminho normal. Transições usam CAS/idempotência; `delivered` não pode ser estornado.

### A5 — Testes sem ativação operacional

Testes reais transacionais rodam somente depois do gate A1. Testes de autorização usam fixtures com estágios/escopos sintéticos em banco isolado e chamada à lógica de decisão, sem conceder autorização via API/RPC. O estado operacional permanece `off`; nenhum lojista, provider ou rota produtiva é habilitado.

## Fora de escopo

Montagem de formulário, geração, integração com provider, arte e download novo (b1b); retry de copy, E2E e piloto (b2); migration remota/deploy.

F56.2b1b depende de fechamento/verificação independente da b1a; não basta a b1a ter sido iniciada ou implementada parcialmente.
