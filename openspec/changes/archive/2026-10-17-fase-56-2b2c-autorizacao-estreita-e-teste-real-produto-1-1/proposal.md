## Why

A **F56.2b2** foi reconciliada e o responsável **aprovou a divisão em três bases independentes**. Esta change formaliza **B2.3 — Autorização estreita e teste real local**, a fatia final, sem redesenhar decisões aprovadas.

O mecanismo atual de autorização **recusa estágios habilitadores** (`operational_activation_blocked_in_b1a`) e a **barreira global** deve ser **preservada**. Falta uma via **temporária e estreita** para permitir o **teste real controlado local** no recorte autorizado, **sem** promover para produção nem habilitar lojas em geral.

A change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` é **substituída documentalmente** e **NÃO** é tratada como implementada.

## What Changes

- **Autorização temporária estreita** por **instância e escopo de lojas de teste** (via `isolated_pilot` + `test_stores`), com **auditoria** (concessor, motivo, `operation_id`, escopo, instância) e **revogação**; concessão por **admin autenticado** via RPC auditada; **ajuste mínimo da barreira** existente, **sem** granularidade por loja. A **janela** é controlada por `product_1_1_test_stores_enabled`; `all_stores` permanece `false`.
- **Barreira global preservada:** a recusa de estágios habilitadores de **escopo geral** **não** é removida; fora do recorte autorizado, o comportamento de recusa permanece.
- **Revalidação server-side** a cada decisão; a autorização **nunca** decorre de alegação do cliente.
- **Validação local-primeiro:** testes no navegador no **ambiente Docker/Supabase isolado** com **lojas de teste** e **provider simulado** cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download; **nenhuma chamada paga** em CI.
- **Teste real controlado local** somente **após checkpoint humano** com **autorização humana específica** e **teto de gasto**, no recorte autorizado.
- **Preview restrito** é **opcional/posterior**, exigindo **configuração isolada de dados/credenciais** (não apenas restrição de URL).
- **Sem promoção automática** para produção/habilitação geral; produção/main, migrations remotas e habilitação de lojas permanecem **decisões separadas**.
- **Habilitação de lojas de teste** só **após** validação do piloto e comprovação da estratégia de D13.
- **Rollback de deploy não reverte banco/ledger** automaticamente.
- A **F56.3** (aprovação/reprovação/correção) permanece fora de escopo.

**BREAKING:** nenhuma. As mudanças são aditivas e **preservam** a barreira global.

## Capabilities

### New Capabilities

- `product-1-1-controlled-real-test-authorization`: autorização **temporária estreita** para o **teste real isolado** (**instância** e **escopo de lojas de teste**, auditoria, revogação; **expiração existente respeitada quando informada**), **sem** remover a barreira global que hoje recusa estágios habilitadores.

### Modified Capabilities

- `product-1-1-flow-activation`: define a validação **local-primeiro**, o **teste real isolado** sob autorização humana/teto e a **não-remoção da barreira global**; habilitação de lojas de teste só após validação; rollback de deploy não reverte banco/ledger.

## Critérios de Aceite Verificáveis

1. A autorização temporária é **restrita** à **instância** e ao **escopo de lojas de teste** (`test_stores`); **`all_stores` não é habilitado** e a **produção permanece intocada**.
2. A concessão é **auditada** (concessor, motivo, `operation_id`, escopo, instância) e **revogável**; a **expiração existente**, quando informada, é **respeitada** — **sem** nova expiração obrigatória (janela por flag + revogação).
3. A decisão é **server-side** e **revalidada** a cada uso; **nenhum** parâmetro do cliente altera o resultado.
4. A **barreira global** de recusa de estágios habilitadores de escopo geral **permanece**; apenas o recorte temporário é permitido.
5. A validação **local-primeiro** cobre formulário, geração, estados, persistência, copy, recuperação, créditos e download no **ambiente isolado** com **provider simulado**; **nenhuma chamada paga** em CI.
6. O **teste real controlado local** exige **autorização humana específica**, **pricing completo** (principal **e** fallback) e o **controle de gasto mínimo** (limites de chamadas + estimativas conservadoras + prevenção de concorrência + parada; **sem garantia** de cobrança final), e só ocorre no recorte autorizado; o resultado é submetido a **inspeção humana**.
7. **Preview restrito** exige configuração **isolada de dados/credenciais**; produção/main, migration remota e habilitação de lojas são **decisões posteriores e separadas**.
8. **Habilitação de lojas de teste** só é avaliada após a validação do piloto e a comprovação da estratégia de D13.
9. **Rollback de deploy não reverte** estado de banco/ledger.
10. A autorização **não antecipa a F56.3** (aprovação/reprovação/correção permanecem fora).
11. A via estreita é **`isolated_pilot` + `test_stores` + `isolated`** (ajuste **mínimo** da barreira existente); **`all_stores` permanece sempre `false`**; a **janela** é controlada por **`product_1_1_test_stores_enabled`** — **sem** autorização/expiração por loja e **sem** novo subsistema.
12. **Pricing completo para principal E fallback**, por **modelo+qualidade**, é exigido antes de executar; a configuração é a **própria do fluxo novo** (`image_model_pair_config`), **sem** preencher `ai_model_selection` por conveniência.
13. O **controle de gasto mínimo** (a implementar) **limita chamadas** (imagem ≤3; copy ≤6) e usa **estimativas conservadoras** para parar; **não** existe cap monetário cumulativo hoje e **não** se promete **garantia financeira** da cobrança final.
14. **Adega e NovaTek** (lojas de teste) validam o fluxo novo; **testes negativos** cobrem **flag desligada**, **loja não-test**, **instância/ambiente não autorizado** e **escopo geral**, **sem regressão intencional** do legado.
15. **D13** e o **sign-off de segurança B2.1** são avaliados em **checkpoints** (A/B) e **não** são considerados resolvidos nem ignorados.

## Dependência explícita

Depende do **fechamento e comprovação de B2.1 e B2.2** — **ambas CONCLUÍDAS e ARQUIVADAS**:
B2.1 (F56.2b2a / GSD 56.2.3) com limitações preservadas e **sign-off de segurança B2.1 pendente/separado**;
B2.2 (F56.2b2b / GSD 56.2.4) com checkpoint `approved_with_limitations` e **D13 permanece NÃO resolvido**
(gate bloqueante separado). B2.1 e B2.2 **não** são redefinidas aqui. B2.3 é a **última** das três fatias;
**não** habilita produção nem lojas em geral.

**Ambiente de validação fixado:** homologação permanente `vendeo-homolog` (workdir `G:\Vendeo-Homolog`,
API `127.0.0.1:57781`; identidade canônica server-side = `127.0.0.1:57781`, não o nome do container).
Sem reset/reimportação; sem nova instância por fatia. Ver `B2.3-READINESS.md`.

## Fronteira com a F56.3

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na **F56.3**.

## Migração e Compatibilidade

- **Aditivo.** Nada é habilitado por omissão; a barreira global é preservada.
- **Rollback.** Revogar/expirar a autorização encerra o recorte; **rollback de deploy não desfaz automaticamente** banco/ledger.

## Tamanho estimado

**3–4 planos** (abaixo do limite de 8–10). Se exceder, **parar** e propor ajuste sem retirar segurança nem testes.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. O **teste real exige autorização humana específica e teto de gasto**.

## Impact

- **Banco (migration [BLOCKING])**: autorização temporária estreita por instância/lojas com expiração/auditoria/revogação (local-only; autorada no GSD).
- **Código alterado (aditivo)**: recorte temporário na autorização (sem remover a barreira global); revalidação server-side.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode).
- **Rastreabilidade**: deriva da change agregadora substituída; ver `RECONCILIATION.md`.
- **Validação**: typecheck, lint, build, testes locais simulados, testes negativos de autorização e `openspec validate --strict`; `git diff --check`.
