# Tasks — B2.2 Recuperação de imagem, estorno e D13 (Produto 1:1)

> **Reconciliação documental (2026-10-16) — tarefas conferidas contra a evidência GSD `56.2.4`.** A implementação desta change foi executada e comprovada na fase GSD `56.2.4` (10/10 planos; checkpoint humano `approved_with_limitations`, escopo **INATIVO/local**; código final `7877e317`). As caixas abaixo foram reconciliadas **individualmente** com as evidências `.planning/phases/56.2.4-.../56.2.4-*.md` e com o código; **nenhuma** tarefa foi marcada por presunção — as que dependem de ação humana estão marcadas com a evidência da ação efetivamente realizada. **D13 NÃO é declarado resolvido**; o **sign-off de segurança da B2.1 permanece PENDENTE** (sinalizado, não encerrado). O **lifecycle OpenSpec (sync/archive) NÃO foi executado**. Ver `RECONCILIATION.md` §11.

> **Checkpoint humano pré-implementação — HISTÓRICO.** A nota original ("nenhum código, migration, `db push`, chamada paga, commit, sync/archive ou GSD antes da aprovação do responsável") descreve a condição da base **pré-implementação** (2026-10-15). A implementação foi **posteriormente autorizada e executada** (GSD `56.2.4`, 2026-10-16). Preservada como histórico. O que permanece vigente: esta fatia **não** implementa copy (B2.1) nem autorização/teste real (B2.3).

> **Dependência:** **F56.2b1b** (arquivada em 2026-10-12) e **B2.1** (dependência **não funcional**; harness reutilizável). Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **D13 NÃO é declarado resolvido** nesta fatia até a comprovação; o **gate bloqueante** permanece. **Simular a falha (Camada 1) não substitui comprovar os efeitos (Camada 2).**

> **Precisões fechadas na rodada documental (2026-10-15):** predicado **PF** com **(4a) aprovada como regra única** (**4b retirada**) (A), resolução autorizada com **reuso** da RPC existente e **abandono de claim exclusivo desse caminho** (B), **formulário restaurado com limites** (C) e **provas em duas camadas** (D). **UI-SPEC** aprovada como **contrato pré-implementação** (2026-10-15); a validação do **resultado implementado** é checkpoint **posterior e distinto** (UAT `56.2.4-UAT.md`).

> **Tamanho estimado:** **5–7 planos**. Se exceder 8–10, **parar** e propor ajuste sem retirar segurança/testes.

## 1. Preparação, dependência e ambiente

- [x] 1.1 Confirmar por escrito a dependência da F56.2b1b e de B2.1 (não funcional) e o recorte B2.2 (imagem/estorno/D13) — **✅ `proposal.md` §Dependência explícita; `design.md` §Context; `RECONCILIATION.md` §1/§6**
- [x] 1.2 Confirmar que o novo fluxo permanece inativo (chaves `false`, autorização `off`) e que a b1b está arquivada — **✅ `56.2.4-VERIFICATION.md` §6; `RECONCILIATION.md` §1 (b1b arquivada em 2026-10-12)**
- [x] 1.3 Confirmar a instância Supabase/Docker isolada e registrar sua identidade (provider simulado) — **✅ `56.2.4-06-SUMMARY.md` §Preflight (`vendeo-f562a-isolated`, API `127.0.0.1:56321`, DB `56322`); `56.2.4-UAT.md` §Ambiente**
- [x] 1.4 Confirmar que archives/specs principais permanecem intocados e que a agregadora **não** é sincronizada/arquivada — **✅ `56.2.4-VERIFICATION.md` §6; `RECONCILIATION.md` §1/§10**

## 2. Recuperação de arte (sem regenerar)

- [x] 2.1 Consultar o **Storage privado** pela sonda tipada existente (`integral | absent | invalid | indeterminate`), sem colapsar erro com ausência — **✅ `src/lib/product-1-1/artifact/artifact-recovery.ts` (consome `probeArtifact`); `56.2.4-02-SUMMARY.md`**
- [x] 2.2 **Arte íntegra** → recuperar e concluir a entrega **sem regenerar** — **✅ `artifact-recovery.ts` (`integral` → `confirmExistingArt`, sem upload/provider); `56.2.4-02-SUMMARY.md`; `56.2.4-06-SUMMARY.md` (e)**
- [x] 2.3 Limitar a recuperação **financeira** a operações **não terminais** (`reserved`/`art_uploaded`) — **✅ `artifact-recovery.ts:266-274` (`delivered`/`refunded` ⇒ `operation_terminal`); `56.2.4-02-SUMMARY.md`**
- [x] 2.4 **Erro/indisponibilidade** → reverificar e dar **feedback honesto** (sem estorno, sem anúncio de crédito) — **✅ `artifact-recovery.ts:233-242` (`invalid`/`indeterminate` ⇒ `unresolved`); `56.2.4-06-SUMMARY.md` (d); `refunded-panel.tsx`/`UnknownResultPanel` (feedback honesto)**

## 3. Gatilho de falha final e encerramento local

- [x] 3.1 Garantir que **operação não terminal + arte ausente** são **necessárias, mas NÃO suficientes**; **consulta/reload durante a geração normal NÃO estorna** — **✅ `generation-orchestrator.ts:797-892` (`settleConfirmedFailure`, `allowPfClosure`); `failure-closure.contract.test.ts`; `56.2.4-06-SUMMARY.md` (f)**
- [x] 3.2 Definir o **predicado PF** de encerramento local (`design.md` B2B-D3; (4a); sob a trava C4) — **✅ `supabase/migrations/20261015000001_f56_2b2b_failure_closure.sql`; `generation-orchestrator.ts:1384-1422`; `56.2.4-01-SUMMARY.md`/`56.2.4-03-SUMMARY.md`**
- [x] 3.3 Garantir que **`failed` de tentativa com retry/fallback pendente NÃO estorna** (janela principal→fallback) — **✅ `generation-orchestrator.ts` (marcador `failed` só no ponto terminal); `failure-closure.contract.test.ts` ("ausência de (4b)"); `56.2.4-06-SUMMARY.md` (g)**
- [x] 3.4 **Sem sinal de finalidade** → **encerramento local explicitamente autorizado e auditado**, **reusando** `admin_resolve_product_1_1_pending` (o cliente não autoriza sozinho) — **✅ `src/lib/product-1-1/pending/resolve-pending-operation.ts:250-290`; `20261015000002_f56_2b2b_pending_abandon.sql`; `src/app/api/admin/product-1-1-pending/route.ts`; `56.2.4-04-SUMMARY.md`; `56.2.4-06-SUMMARY.md` (i)**
- [x] 3.5 Encerramento sob a **mesma trava** e **impedindo atomicamente** tentativa posterior (`operation_terminal`); estender a RPC **somente no caminho autorizado** para finalizar o claim `in_progress` como `abandoned`; **PF NÃO abandona claim** — **✅ `20261015000001`/`20261015000002` (`FOR UPDATE`; `authorized_abandon`); `56.2.4-04-SUMMARY.md`; `56.2.4-06-SUMMARY.md` (j)**
- [x] 3.6 **Preservar a saída quando o marcador não puder ser gravado** (falha de escrita ou `unknown` imutável) ⇒ não sucesso/sobrescrita; permanece não terminal ⇒ resolução autorizada (3.4) — **✅ `generation-orchestrator.ts:1392-1409` (`failedMarkerPersisted`); `failure-closure.layer1-simulation.test.ts` (iii); `56.2.4-03-SUMMARY.md`**
- [x] 3.7 **Neutralizar resultados de chamadas já iniciadas** (`recordOperationOutcome` → `operation_terminal`; `deliver` só `art_uploaded → delivered`; `unknown` não governa terminal; `finish` recusa `invalid_transition`) — **✅ `56.2.4-06-SUMMARY.md` (c); `56.2.4-04-SUMMARY.md` (resultado atrasado); `failure-closure.contract.test.ts`**

## 4. Estorno confirmado, formulário e mensagem

- [x] 4.1 **Ausência confirmada + gatilho** → **estorno único**, encerrar como `refunded` — **✅ `20261015000001_f56_2b2b_failure_closure.sql` (`product_1_1_close_failed_operation`); `56.2.4-06-SUMMARY.md` (h); `56.2.4-01-SUMMARY.md`**
- [x] 4.2 Garantir **estorno idempotente** por `campaignId + operation_id` e **corrida entrega × estorno** (arte/`delivered` vence) — **✅ `20261015000001` (CAS sob a trava); `56.2.4-06-SUMMARY.md` (a)/(b)**
- [x] 4.3 Exibir a mensagem exata **somente após o estorno persistido confirmado**; se não confirmado, não anunciar crédito — **✅ `src/components/flow/refunded-panel.tsx` (`confirmed`); `persisted-state.test.tsx`; `56.2.4-05-SUMMARY.md`**
- [x] 4.4 Devolver o **formulário preenchido** com os dados preservados; **não** prometer restauração de **imagem**/referências (client-only) — **✅ `src/lib/campaign/display.ts` (`mapRestoredForm`); `use-campaign-form.ts`; `refunded-recovery.test.tsx`; `56.2.4-05-SUMMARY.md`; `56.2.4-06-SUMMARY.md` (e)**
- [x] 4.5 **`delivered` nunca é estornado** e **`refunded` não retorna a `delivered`** — **✅ `20261015000001` (`delivered_not_refundable`); `56.2.4-06-SUMMARY.md` (a); `failure-closure.contract.test.ts`**
- [x] 4.6 Isolar **resultado atrasado** de `refunded` (não reabre, não sobrescreve, não libera; nova submissão é geração nova) — **✅ `56.2.4-06-SUMMARY.md` (c); `56.2.4-03-SUMMARY.md`**
- [x] 4.7 Garantir que a autorização de recuperação/gratuidade vem do **estado server-side**, nunca do cliente — **✅ `src/app/api/campaign/[id]/image-recovery/route.ts` (prelude auth/ownership); `resolve-pending-operation.ts` (evidência server-derived); `56.2.4-02-SUMMARY.md`/`56.2.4-04-SUMMARY.md`**
- [x] 4.8 Registrar internamente falhas, tentativas, correlação e custos; não apresentar geração extra cobrada ao lojista — **✅ `src/lib/product-1-1/orchestration/instrumentation.ts` (envelope/tentativa/custo interno — "nunca vira cobrança adicional"); `generation-orchestrator.ts` (`recordPendingDiagnosis`, `runId`/`traceId`); `56.2.4-03-SUMMARY.md`**

## 5. Testes e provas exigidas (duas camadas — Precisão D)

> **Camada 1:** falhas raras por **simulação controlada** (harness/fake) — prova **controle de fluxo**; **não** substitui a Camada 2.
> **Camada 2:** **efeitos reais** comprovados em **Postgres/Storage locais** (instância isolada e descartável). **Nenhum** provider pago.

- [x] 5.1 Rodar no **ambiente isolado** com **provider simulado**; nenhuma chamada paga — **✅ `56.2.4-06-SUMMARY.md` (instância `vendeo-f562a-isolated`; provider SIMULADO; nenhuma paga); `56.2.4-UAT.md` §Ambiente**
- [x] 5.2 Provar a **corrida entrega × estorno** (Camada 2) — **✅ `failure-closure.integration.test.ts` (a, conexões independentes); `56.2.4-06-SUMMARY.md`**
- [x] 5.3 Provar o **estorno idempotente** (Camada 2) — **✅ `failure-closure.integration.test.ts` (b); `56.2.4-06-SUMMARY.md`**
- [x] 5.4 Provar o tratamento de **resultado atrasado** (Camada 2) — **✅ `failure-closure.integration.test.ts` (c); `56.2.4-06-SUMMARY.md`**
- [x] 5.5 Provar o comportamento sob **falha de Storage/banco** (Camada 1 exercita; Camada 2 observa) — **✅ `failure-closure.integration.test.ts` (d); `failure-closure.layer1-simulation.test.ts`; `56.2.4-06-SUMMARY.md`**
- [x] 5.6 Provar o **formulário restaurado** com dados preservados (Camada 2) — **✅ `failure-closure.integration.test.ts` (e); `recovery-seams.integration.test.ts` (c); `56.2.4-06-SUMMARY.md`**
- [x] 5.7 Provar **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna** (Camada 2) — **✅ `failure-closure.integration.test.ts` (f); `56.2.4-06-SUMMARY.md`**
- [x] 5.8 Provar **principal falhou, fallback ainda será iniciado → recuperação NÃO estorna** (Camada 2) — **✅ `failure-closure.integration.test.ts` (g); `56.2.4-06-SUMMARY.md`**
- [x] 5.9 Provar **falha final (PF) → encerra e estorna uma vez**, decisão **server-side** (Camada 2) — **✅ `failure-closure.integration.test.ts` (h) + SEAM (b) orquestrador REAL; `56.2.4-06-SUMMARY.md`**
- [x] 5.10 Provar **sem sinal de finalidade → encerramento local autorizado e auditado** (Camada 2) — **✅ `pending-resolution.integration.test.ts` (i) + SEAM (a) rota admin REAL; `56.2.4-06-SUMMARY.md`**
- [x] 5.11 Provar que o **encerramento impede atomicamente** tentativa posterior (`operation_terminal`) (Camada 2) — **✅ `failure-closure.integration.test.ts` (j); `56.2.4-06-SUMMARY.md`**
- [x] 5.12 Rodar **Camada 1** (harness/fake) para as **falhas raras** (`storeArtifact`, sonda `indeterminate`, falha de gravação do marcador) — **✅ `failure-closure.layer1-simulation.test.ts`; `56.2.4-03-SUMMARY.md`**
- [x] 5.13 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga) — **✅ `56.2.4-07-SUMMARY.md`/`56.2.4-VERIFICATION.md` §1 (typecheck/lint/build 0; suíte local 30/711 + render 52/551; Camada 2 isolada 99 + 9)**

## 6. Gate D13 e checkpoint final

- [x] 6.1 Manter o **gate bloqueante** até a **implementação e comprovação** da estratégia — **não** até a antiga exigência de encerramento externo — **✅ `56.2.4-VERIFICATION.md` §5; `56.2.4-07-SUMMARY.md` (gate bloqueante preservado; D13 NÃO resolvido)**
- [x] 6.2 Confirmar a reconciliação: **simular a falha** (Camada 1) **não** substitui **comprovar os efeitos** (Camada 2); **não** declarar D13 resolvido — **✅ `56.2.4-VERIFICATION.md` §5; `56.2.4-07-SUMMARY.md`**
- [x] 6.3 Separar o fechamento local de migration remota, deploy e habilitação (rollback de deploy não desfaz banco/ledger) — **✅ `56.2.4-VERIFICATION.md` §6/§8; `56.2.4-06-SUMMARY.md` (LOCAL-ONLY); `56.2.4-08-SUMMARY.md`**
- [x] 6.4 Rodar `openspec validate --strict` desta change e `git diff --check` — **✅ `56.2.4-07-SUMMARY.md` (`--strict` valid; `git diff --check` limpo); reexecutado nesta reconciliação**
- [x] 6.5 Submeter a B2.2 à **revisão humana**; confirmar que B2.3 e a F56.3 não foram antecipadas — **✅ checkpoint `approved_with_limitations` — `56.2.4-UAT.md` §Aprovação humana (2026-10-16); `56.2.4-07-SUMMARY.md` (B2.3/F56.3 NÃO iniciados)**
- [x] 6.6 Registrar o resultado sem iniciar GSD — **⚠ HISTÓRICO: registrado na etapa de alinhamento documental (`RECONCILIATION.md` §8/§9) SEM iniciar GSD. O GSD `56.2.4` foi autorizado e executado em etapa posterior; esta marca preserva o registro daquele momento (não afirma que o GSD nunca foi executado).**
- [x] 6.7 Registrar que a **decisão A-1 está RESOLVIDA**: **(4a) aprovada como regra única**; **(4b) retirada**; **abandono de claim `in_progress` exclusivo do caminho autorizado** — **✅ `RECONCILIATION.md` §5; `proposal.md` §Reconciliação desta rodada; `design.md` §Open Questions**
- [x] 6.8 Submeter o **UI-SPEC** (formulário restaurado, mensagem, ações) à **aprovação humana** — **✅ aprovada como CONTRATO pré-implementação (2026-10-15; `RECONCILIATION.md` §9 e §2); a validação da IMPLEMENTAÇÃO é checkpoint posterior e distinto (`56.2.4-UAT.md`, `approved_with_limitations`). LIMITAÇÃO PRESERVADA: inspeção visual adicional dos reparos **NÃO** realizada.**
- [x] 6.9 Sinalizar **separadamente** o **sign-off de segurança PENDENTE da B2.1** (não corrigir silenciosamente) — **✅ sinalização registrada: `RECONCILIATION.md` §7; `56.2.4-VERIFICATION.md` §7; `56.2.4-07-SUMMARY.md`. O sign-off da B2.1 permanece **PENDENTE** (não aprovado nem encerrado nesta change).**
