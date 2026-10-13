## Context

Esta change é a **B2.3** da divisão aprovada da F56.2b2 (B2.1 copy, B2.2 imagem/estorno/D13, B2.3 autorização/teste real). Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; não implementada**). Depende do **fechamento e comprovação de B2.1 e B2.2**.

**Contratos implementados (b1a) que esta change SHALL preservar:**

- Histórico append-only `product_flow_stage_authorizations`; estágios `off | isolated_pilot | test_stores | all_stores`; escopos `test_stores | all_stores`; ambientes `isolated | operational`.
- A RPC administrativa **RECUSA** estágios habilitadores (`operational_activation_blocked_in_b1a`) — a **barreira global**.
- Instância canônica server-side; **expiração** e **revogação** revalidadas a cada decisão; compatibilidade estágio×escopo×ambiente.
- Execução **dentro da requisição**, sem fila/worker/cron.

## Goals / Non-Goals

**Goals:**

- Autorização **temporária e estreita** por instância/lojas, com expiração, auditoria e revogação, **sem** remover a barreira global.
- Validação **local-primeiro** (Docker/Supabase isolado, provider simulado) e **teste real controlado local** sob autorização humana + teto.
- Preview restrito **opcional/posterior**; **sem** promoção automática.

**Non-Goals:**

- Recuperação de copy (B2.1) ou de imagem/estorno/D13 (B2.2).
- Produção/main, migrations remotas, habilitação geral de lojas, deploy.
- Aprovação/reprovação/correção (**F56.3**).
- Remover a barreira global; habilitar estágios de escopo geral.

## Decisions

### B2C-D1 — Autorização temporária estreita (por instância/lojas)

O sistema SHALL permitir autorização **temporária e estreita** restrita a **instância autorizada** + **lojas autorizadas**, com **expiração**, **auditoria** (concessor, motivo, `operation_id`, escopo, instância) e **revogação**. Concessão por **admin autenticado** via RPC auditada. A autorização é separada das feature flags e **revalidada a cada decisão**.

### B2C-D2 — Barreira global preservada

O recorte temporário SHALL NOT remover a **recusa de estágios habilitadores de escopo geral**. Fora do recorte, o comportamento existente de recusa permanece. A autorização **nunca** decorre de alegação do cliente (leitura server-side).

### B2C-D3 — Validação local-primeiro

1. **Testes no navegador** no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**, cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download; **nenhuma chamada paga** em CI.
2. **Teste real controlado local** só **após checkpoint humano** com **autorização humana específica** e **teto de gasto**, no recorte autorizado.
3. **Preview restrito** opcional/posterior, exigindo **configuração isolada de dados/credenciais** — **não** apenas restrição de URL.
4. **Produção/main, migrations remotas e habilitação de lojas** são decisões posteriores e separadas. **Rollback de deploy não desfaz automaticamente** banco/ledger.

### B2C-D4 — Habilitação de lojas de teste condicionada

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto e a **comprovação** da estratégia substituta de **D13** (B2.2). **Sem** promoção automática.

### B2C-D5 — F56.3 separada

A autorização temporária SHALL NOT habilitar aprovação, reprovação ou correção de arte, que permanecem na **F56.3**.

## Risks / Trade-offs

- **[Autorização larga demais]** → recorte **estreito** por instância/lojas, com expiração/auditoria/revogação; barreira global mantida.
- **[Habilitação acidental]** → nada é habilitado por omissão; só o recorte temporário vigente.
- **[Teste real fora de controle]** → checkpoint humano + teto; preview isolado.
- **[Rollback ilusório]** → rollback de deploy não reverte banco/ledger.

## Migration Plan

1. Implementar o recorte temporário (instância/lojas) com expiração/auditoria/revogação e revalidação; testes negativos.
2. Rodar validação **local-primeiro** (provider simulado); nenhuma chamada paga.
3. **Checkpoint humano** (autorização humana específica + teto) → **teste real controlado local** no recorte.
4. Avaliar **preview restrito** (configuração isolada); habilitação/produção em etapa posterior autorizada.

Rollback: revogar/expirar a autorização encerra o recorte.

## Open Questions

- **Formato do teto de gasto** e do recorte de lojas — fechados no checkpoint humano/implementação, sem reduzir as garantias.
