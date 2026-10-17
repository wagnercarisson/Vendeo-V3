## Context

Esta change é a **B2.3** da divisão aprovada da F56.2b2 (B2.1 copy, B2.2 imagem/estorno/D13, B2.3 autorização/teste real). Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; não implementada**). Depende do **fechamento e comprovação de B2.1 e B2.2** — **ambas CONCLUÍDAS e ARQUIVADAS**: B2.1 (F56.2b2a) com limitações preservadas e **sign-off de segurança B2.1 pendente/separado**; B2.2 (F56.2b2b) `approved_with_limitations` com **D13 NÃO resolvido** (gate separado).

**Ambiente de validação fixado:** homologação permanente **`vendeo-homolog`** (workdir `G:\Vendeo-Homolog`, API `127.0.0.1:57781`, 123 migrations). A identidade canônica usada pelo runtime e pelo admin é `127.0.0.1:57781` (host da URL), **não** o nome do container, com comparação **exata**. Sem reset/reimportação; sem nova instância por fatia. Prontidão detalhada em `B2.3-READINESS.md`.

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

### B2C-D1 — Autorização temporária estreita (por instância + escopo de lojas de teste)

O sistema SHALL permitir autorização **temporária e estreita** restrita a **instância autorizada** + **escopo de lojas de teste** (`test_stores`), com **auditoria** (concessor, motivo, `operation_id`, escopo, instância) e **revogação**. Concessão por **admin autenticado** via RPC auditada. A autorização é separada das feature flags e **revalidada a cada decisão**. **Expiração:** a coluna/handling existentes são **respeitados quando informados**, mas **não** se implementa **nova expiração obrigatória** — a janela é controlada pela **flag** (`product_1_1_test_stores_enabled`) e pela **revogação**.

**Conformidade de código (realinhamento):** a fundação já existe (identidade de instância, expiração, revogação, auditoria append-only, barreira global que recusa `stage <> 'off'`, revalidação server-side). A autorização é **por escopo** (`test_stores`/`all_stores`) — **não por loja**, e o piloto **não** exige granularidade por loja. B2.3 faz um **ajuste mínimo e aditivo** na RPC para **permitir** `isolated_pilot`+`test_stores`, mantendo a **recusa de escopo geral** e reutilizando os controles existentes — **nenhum** novo subsistema. Detalhe em `B2.3-READINESS.md` §3.

### B2C-D2 — Barreira global preservada

O recorte temporário SHALL NOT remover a **recusa de estágios habilitadores de escopo geral**. Fora do recorte, o comportamento existente de recusa permanece. A autorização **nunca** decorre de alegação do cliente (leitura server-side).

### B2C-D3 — Validação local-primeiro

1. **Testes no navegador** na **homologação permanente `vendeo-homolog`** (127.0.0.1:57781), com **lojas de teste** e **provider simulado**, cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download; **nenhuma chamada paga** em CI.
2. **Teste real controlado local** só **após checkpoint humano** com **autorização humana específica** e **teto de gasto**, no recorte autorizado.
3. **Preview restrito** opcional/posterior, exigindo **configuração isolada de dados/credenciais** — **não** apenas restrição de URL.
4. **Produção/main, migrations remotas e habilitação de lojas** são decisões posteriores e separadas. **Rollback de deploy não desfaz automaticamente** banco/ledger.

### B2C-D4 — Habilitação de lojas de teste condicionada

A habilitação de lojas de teste para uso real SHALL ser avaliada somente **após** a validação do piloto e a **comprovação** da estratégia substituta de **D13** (B2.2). **Sem** promoção automática.

### B2C-D5 — F56.3 separada

A autorização temporária SHALL NOT habilitar aprovação, reprovação ou correção de arte, que permanecem na **F56.3**.

### B2C-D6 — Via estreita e ajuste mínimo da barreira

A **única** via habilitadora SHALL ser **`isolated_pilot` + `test_stores` + `isolated`** (combinação já imposta pela matriz existente; `isolated_pilot` **não** vale no ambiente operacional). O **ajuste mínimo da barreira existente** é: a RPC administrativa passa a **conceder** apenas **`stage='isolated_pilot'` com `scope='test_stores'`**; continua **recusando** `test_stores` (estágio), `all_stores` e qualquer escopo `all_stores`. O ambiente `isolated` é derivado server-side (loopback) — assim a **produção permanece intocada** e a recusa de escopo geral é preservada. **`all_stores` permanece sempre `false`/recusado.** O escopo `test_stores` cobre **as duas lojas de teste**.

### B2C-D7 — Habilitação pelo flag de lojas de teste (sem autorização por loja)

O controle de habilitação da janela do piloto SHALL ser **`product_1_1_test_stores_enabled`** (`true` **somente** durante a janela autorizada); **`product_1_1_all_stores_enabled` permanece sempre `false`**. A flag **não** habilita sozinha: a decisão continua exigindo **autorização vigente** (`isolated_pilot` + `test_stores`) **e** a flag aplicável; a autorização **não** substitui a flag. **Não** há **autorização/expiração por loja**, **allowlist** nem `store_id` por evento. A janela é delimitada pela **flag** e pela **revogação** da autorização; o `expires_at` existente permanece disponível, mas **não** é requisito do piloto.

### B2C-D8 — Reaproveitamento dos controles existentes (sem novo subsistema)

SHALL reaproveitar, sem criar subsistema: **identidade canônica de instância** (`instance-identity.ts`), **tabela/RPCs append-only** `product_flow_stage_authorizations` (concessão/revogação/recusa), **auditoria** (`granted_by, reason, operation_id, scope, instance_identity, expires_at, created_at`) e **revalidação server-side** no runtime. **Não** criar allowlist, tabela de loja nem revisão/auditoria por loja.

### B2C-D9 — Pricing e controle de gasto (mínimo, sem promessa de garantia financeira)

- **Configuração do fluxo novo = `image_model_pair_config`** (`primary` **e** `fallback`, cada um `model+quality`) — **não** `ai_model_selection` (legado). **Não** preencher `ai_model_selection` por conveniência.
- **Pricing `complete` obrigatório para principal E fallback**, por `model+quality` (preflight `assertImagePairExecutable` bloqueia sem reserva/provider se incompleto).
- **Não existe**, no código atual, **cap monetário cumulativo** do fluxo novo. (Há `estimatedCostUsd` de **telemetria** por evento e um `budgetUsd` do **laboratório** — nenhum é cap do piloto.) O **controle de gasto mínimo** é, portanto, **escopo de implementação** da B2.3, **não** funcionalidade existente a reutilizar.
- **Alcance real do mecanismo mínimo (a implementar):**
  - **Limites de chamadas (existentes, duros):** imagem **≤3** (≤2 principal + ≤1 fallback, F56.1); copy **≤6** (3 automáticas + 3 manuais, B2.1).
  - **Custos estimados/conservadores:** usar `resolveImagePairCost` **por tentativa** (pode ser `partial`/`provider_reported`) e o teto de chamadas para um **limite conservador** de decisão; **estimativa ≠ cobrança final**.
  - **Prevenção de execuções simultâneas (existente):** aquisição atômica de tentativa (`product_1_1_generation_attempt_claims`) e de copy (`..._acquire_copy_attempt`) — **um** vencedor por operação; o perdedor **não** chama provider.
  - **Parada:** ao atingir o limite conservador, o limite de chamadas, erro/timeout ou limite de tentativas, **não** chamar e encerrar com estado honesto.
- **Limite e honestidade:** o mecanismo **limita chamadas** e usa **estimativas conservadoras** para parar; **NÃO** garante a **cobrança final** do provider (uso real pode divergir) e **não** deve virar um novo subsistema de orçamento.

### B2C-D10 — Autorização específica para chamadas pagas e inspeção humana

A geração real (paga) SHALL ocorrer **somente** sob **autorização específica** (estágio+escopo vigentes), **flag de janela**, **pricing `complete`** e o **controle de gasto mínimo** (§D9); o **resultado** SHALL passar por **inspeção humana obrigatória** (visual/qualidade). Falhas **raras** do provider continuam cobertas por **testes simulados** — não se exige provocá-las no provider pago.

### B2C-D11 — Ambas as lojas de teste e testes negativos

**Adega e NovaTek** (ambas `is_test_store=true`) SHALL poder validar o novo fluxo. **Testes negativos** SHALL cobrir: **flag desligada**, **loja não-test** (fora do escopo de teste), **instância/ambiente não autorizado** e **escopo geral** (`all_stores`). O fluxo **legado** permanece **inalterado** — **sem regressão intencional**.

### B2C-D12 — Checkpoints de gates (D13 e sign-off B2.1)

- **Checkpoint A (pré-implementação):** avaliar o **sign-off de segurança B2.1** (separado) como precondição e aprovar o plano. Se pendente, a implementação não avança ao teste real.
- **Checkpoint B (autorização do teste real):** avaliar **D13** (estratégia operacional de claims residuais) + **modelo/quality/pricing** + **teto** + **inspeção humana**. Se **D13** não estiver satisfeito, o teste real permanece **bloqueado**. D13 e o sign-off **não** são considerados resolvidos nem ignorados.

## Risks / Trade-offs

- **[Autorização larga demais]** → recorte **estreito** por **instância + escopo de teste** (`isolated_pilot`+`test_stores`+`isolated`), com auditoria/revogação; barreira global mantida.
- **[Habilitação acidental]** → nada é habilitado por omissão; janela controlada pelo flag `product_1_1_test_stores_enabled` + autorização vigente; `all_stores` **sempre `false`**.
- **[Teste real fora de controle]** → Checkpoint B + **controle de gasto mínimo** (limites de chamadas + estimativas conservadoras + concorrência prevenida + parada) + inspeção humana; preview isolado.
- **[Rollback ilusório]** → rollback de deploy não reverte banco/ledger.
- **[Pricing incompleto]** → preflight fail-closed exige `complete` para principal **e** fallback (por `model+quality`); sem pricing, **não** executa.
- **[Falsa garantia financeira]** → o controle de gasto mínimo **limita chamadas** e usa **estimativas conservadoras**; **não** garante a **cobrança final** do provider e **não** vira subsistema de orçamento.
- **[Gate ignorado]** → **D13** e **sign-off B2.1** avaliados em checkpoints (A/B); **não** resolvidos por omissão.

## Migration Plan

1. **Checkpoint A (pré-implementação):** avaliar o **sign-off de segurança B2.1** (separado) e **aprovar o plano** — **antes** de qualquer implementação.
2. Implementar a **via estreita** com o **ajuste mínimo da barreira** (`isolated_pilot`+`test_stores`+`isolated`) e o **mecanismo mínimo de controle de gasto** (§D9), reaproveitando os controles existentes (instância, autorização, auditoria, revogação); **testes negativos** (flag desligada; loja não-test; instância/ambiente não autorizado; escopo geral recusado).
3. Rodar validação **local-primeiro** na homologação permanente (provider simulado); nenhuma chamada paga.
4. **Checkpoint B** (D13 + modelo/quality/pricing + limite conservador + inspeção) → **teste real controlado local** no recorte, com inspeção humana.
5. Avaliar **preview restrito** (configuração isolada); habilitação/produção em etapa posterior autorizada.

Rollback: revogar/expirar a autorização encerra o recorte.

## Open Questions

- **Formato do teto de gasto** e do recorte de lojas — fechados no checkpoint humano/implementação, sem reduzir as garantias.
