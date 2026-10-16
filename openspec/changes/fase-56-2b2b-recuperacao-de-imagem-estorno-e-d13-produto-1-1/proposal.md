## Why

A **F56.2b2** foi reconciliada e o responsável **aprovou a divisão em três bases independentes**. Esta change formaliza **B2.2 — Recuperação de imagem, estorno e D13**, sem redesenhar decisões aprovadas.

A **F56.2b1b** (arquivada em 2026-10-12) deixou a operação de crédito (`reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `delivered_not_refundable`), a sonda de arte **tipada** (`integral | absent | invalid | indeterminate`) e a limitação **D13** (claim residual bloqueado, sem fonte operacional de encerramento) como **gate bloqueante** da b2. Esta fatia **substitui o tratamento de D13** por uma estratégia operacional comprovável — **sem** exigir encerramento externo do provider nem marcador de falha pré-salvo.

A change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` é **substituída documentalmente** e **NÃO** é tratada como implementada.

## What Changes

- **Recuperação de arte no Storage privado:** arte **íntegra existente** → **recuperar e concluir** a entrega **sem regenerar**; limitada a operações **não terminais** (`reserved`/`art_uploaded`).
- **Encerramento local com estorno confirmado (substitui D13):** com **ausência de arte confirmada** **e** **falha FINAL para a operação, sem retry/fallback pendente**, **encerrar a operação LOCALMENTE** com **estorno UMA vez** (`refunded`) — **sem** depender de encerramento externo do provider e **sem** exigir o marcador `generation_outcomes` pré-salvo.
- **Ausência de arte não demonstra falha sozinha.** Operação não terminal + arte ausente são **necessárias, mas NÃO suficientes**; **consulta/reload durante a geração normal NÃO estorna**.
- **Gatilho server-side persistido de falha FINAL:** predicado **PF** (aprovado): operação **não terminal** **e** arte `absent` **confirmada** **e** **nenhum** claim `in_progress` **e** **finalidade persistida (4a)** — `outcome='failed'` **gravado com sucesso** no **ponto de decisão terminal** (reuso da RPC/tabela existentes). **`failed` de tentativa com retry/fallback pendente NÃO estorna** (a janela principal→fallback não satisfaz PF). **Se o marcador não puder ser gravado** (erro ou `unknown` imutável pré-existente), **não** se força PF nem se sobrescreve: encaminha à resolução autorizada.
- **Sem sinal de finalidade:** encerramento local **explicitamente autorizado e auditado** (motivo + evidência), **reutilizando a resolução administrativa existente** `admin_resolve_product_1_1_pending` (administrador autorizado; ação `refund_once`); o cliente **só solicita**, nunca autoriza; **sem** exigir encerramento externo do provider.
- **Atomicidade:** o encerramento (automático ou autorizado) ocorre sob a **mesma trava** da linha de crédito usada por `acquire_attempt_start` e transita para terminal, **impedindo atomicamente** qualquer tentativa posterior.
- **Estorno único confirmado, formulário preservado e mensagem aprovada.** Somente **após o estorno persistido confirmado**, exibir exatamente: **“Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.”** Se o estorno **não** puder ser confirmado, **não** anunciar crédito. **Erro/indisponibilidade** do Storage **não** é ausência confirmada.
- **`delivered` nunca estorna; `refunded` não volta a `delivered`.** Resultado/imagem **atrasada** de operação `refunded` **não** reabre cobrança, **não** sobrescreve estado e **não** libera a nova campanha; a nova submissão é **geração nova com cobrança normal**.
- **D13 não é declarado resolvido**; o **gate bloqueante** de piloto/habilitação é **preservado** até a implementação e **comprovação** — **não** até resolver a antiga exigência de encerramento externo. O **archive da b1b não é reescrito**.

**BREAKING:** nenhuma. A mudança **substitui explicitamente** o tratamento anterior de D13, que permanece **documentado como não resolvido**.

## Capabilities

### Modified Capabilities

- `product-1-1-artifact-delivery`: acrescenta a **recuperação da arte no Storage privado** (íntegra → concluir sem regenerar) e remove a promessa de "nenhuma recuperação" quando há arte íntegra recuperável.
- `product-1-1-campaign-credit-billing`: acrescenta o **encerramento local com estorno confirmado por gatilho de falha FINAL**, o **estorno idempotente**, a **não-estorno de `delivered`**, o **`refunded` terminal** e o **isolamento de resultado atrasado**.
- `product-1-1-generation-orchestration`: substitui o tratamento de **D13** pela **estratégia substituta de recuperação + encerramento local confirmado**, mantendo o **gate bloqueante** e sem reescrever o archive da b1b.

## Critérios de Aceite Verificáveis

1. **Arte íntegra** no Storage privado → **recuperar e concluir** a entrega, **sem regenerar**.
2. **Operação não terminal + arte ausente** são **necessárias, mas NÃO suficientes** para estorno; **consulta/reload durante a geração normal NÃO estorna**.
3. O encerramento local exige o **predicado PF** (operação não terminal + arte `absent` confirmada + **nenhum** claim `in_progress` + **finalidade persistida (4a)**: marcador `outcome='failed'` **gravado com sucesso** no ponto de decisão); **`failed` de tentativa com retry/fallback pendente não estorna**, a **janela principal→fallback** não autoriza estorno, e **sem marcador gravado não há PF** (vai para resolução autorizada).
4. **Sem sinal de finalidade** → encerramento local **explicitamente autorizado e auditado**; o cliente sozinho **não** autoriza estorno.
5. O encerramento ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** qualquer tentativa posterior (`operation_terminal`).
6. **Ausência confirmada + gatilho** → **estornar uma única vez**, encerrar como `refunded` e devolver o **formulário preenchido** com os dados preservados.
7. A mensagem exata só é exibida **após o estorno persistido confirmado**; se não confirmado, **não** se anuncia crédito.
8. **Erro/indisponibilidade** do Storage **não** é ausência confirmada: reverificar e dar **feedback honesto** (sem estorno indevido).
9. **`delivered` nunca é estornado**; **`refunded` não retorna a `delivered`**, mesmo com imagem atrasada.
10. **Corrida entrega × estorno** e **estorno idempotente**: no máximo um efeito de ledger.
11. Resultado atrasado de `refunded` **não** reabre cobrança, **não** sobrescreve e **não** libera a nova campanha; nova submissão é **geração nova com cobrança normal**.
12. **Provas exigidas aprovadas em duas camadas** (Precisão D): **Camada 1** — falhas raras por **simulação controlada** (harness/fake) exercitam o controle de fluxo; **Camada 2** — **efeitos reais** comprovados em **Postgres/Storage locais** (instância isolada): corrida entrega×estorno; estorno idempotente; resultado atrasado; falha de Storage/banco; formulário restaurado; **geração normal sem arte não estorna**; **principal falhou/fallback pendente não estorna**; **falha final (PF) encerra e estorna uma vez**; **sem sinal de finalidade exige autorização auditada**; **encerramento impede tentativa posterior**. **Teste com provider real/ativação reservado à B2.3.**
13. **D13 NÃO é declarado resolvido**: o gate permanece até **implementação e comprovação dos efeitos** (Camada 2); **simular a falha não substitui comprovar os efeitos**; o **archive da b1b não é reescrito**.
14. **Formulário restaurado com honestidade:** restauram-se os **campos preenchidos** (fonte server-side `input_snapshot`/`identitySnapshot`); **não** se promete restauração de **imagem**/referências (client-only); a mensagem exata só aparece após estorno **persistido e confirmado**.
15. **Marcador de falha final (4a) — regra única:** o encerramento automático exige `outcome='failed'` **gravado com sucesso**; **(4b) retirada** (recusas isoladas **não** comprovam falha final). Se o marcador **não** puder ser gravado (erro de escrita ou `unknown` imutável pré-existente), **não** há sucesso nem sobrescrita: encaminha à **resolução autorizada e auditada**.
16. **Abandono de claim só no caminho autorizado:** PF exige ausência de `in_progress`, portanto **não** abandona claim; **abandonar um claim `in_progress` pertence exclusivamente** à resolução autorizada, sob a trava, **com proteção contra o resultado atrasado**.
17. **Escopo e infraestrutura:** **nenhuma** fila/worker/cron/outbox/subsistema novo; estimativa **5–7 planos** (teto 8–10).

## Dependência explícita

Depende da **F56.2b1b** (arquivada em 2026-10-12) e de **B2.1** (recuperação de copy). A dependência de **B2.1 é não funcional** para o núcleo desta fatia; o **harness** de testes isolado pode ser reutilizado. **Não** depende de B2.3.

## Fronteira com a F56.3

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na **F56.3**.

## Migração e Compatibilidade

- **Escopo financeiro estrito.** A recuperação financeira limita-se a operações **não terminais**; `delivered` **nunca** estorna e `refunded` **não** retorna a `delivered`.
- **Independência de copy.** A recuperação de **copy** é de **B2.1** e independe do estado da imagem; esta fatia **não** a redefine.
- **Rollback.** Desabilitar a recuperação não afeta o core; **rollback de deploy não desfaz automaticamente** banco/ledger.

## Tamanho estimado

**5–7 planos** (abaixo do limite de 8–10). Se exceder, **parar** e propor ajuste sem retirar segurança nem testes.

## Reconciliação desta rodada (2026-10-15)

- **Precisão A** (predicado de falha final), **B** (resolução autorizada/D13), **C** (experiência/formulário restaurado) e **D** (validação em duas camadas/gate) estão **fechadas** em `design.md` (B2B-D3, D4, D8, D9) e `RECONCILIATION.md` §3.
- **Decisão resolvida (aprovada 2026-10-15):** **A-1** — adotada **(4a)** como regra única; **(4b) retirada**; ver `RECONCILIATION.md` §5.
- **UI-SPEC** para formulário restaurado, mensagem e ações: `UI-SPEC.md` **APROVADO** (2026-10-15) como contrato pré-implementação, no escopo INATIVO.
- **Resíduo separado:** sign-off de segurança da **B2.1** permanece **PENDENTE** (não corrigido aqui) — `RECONCILIATION.md` §7.

## Checkpoint Humano (pré-implementação) — HISTÓRICO

> **Estado no momento da aprovação (2026-10-15, escopo INATIVO).** Este parágrafo descreve a condição **pré-implementação** e é preservado como histórico; o estado implementado está em **"Estado de implementação"** abaixo.

**APROVADA (2026-10-15, escopo INATIVO).** O responsável aprovou a **base reconciliada** (precisões A–D e decisão **A-1 = 4a**) e a **UI-SPEC** da B2.2 como **contrato pré-implementação**, **exclusivamente no escopo INATIVO**. Naquele momento, nenhuma implementação, GSD, migration/`db push`, chamada paga, ativação ou B2.3 havia sido iniciada. A **validação do resultado implementado** é um checkpoint **posterior e distinto** (UAT da B2.2). O sign-off pendente da **B2.1** permanece **separado**.

## Estado de implementação (2026-10-16)

> **Adendo de reconciliação documental.** Registra o estado **implementado e comprovado** da B2.2, preservando o histórico pré-implementação acima. Nada aqui altera os 11 requirements, o **gate D13** (que permanece **NÃO resolvido**) nem o archive da b1b.

- **Implementação executada (GSD `56.2.4`):** **10/10 planos** concluídos; checkpoint humano **`approved_with_limitations`** (2026-10-16) **exclusivamente** no escopo **INATIVO/local**. Evidências: `.planning/phases/56.2.4-.../56.2.4-VERIFICATION.md`, `-UAT.md`, `-REVIEW-INDEPENDENT.md`, `-SECURITY-INDEPENDENT.md`.
- **Provas em duas camadas:** Camada 1 (contrato/simulação) e Camada 2 (efeitos reais em Postgres/Storage **locais**, provider **SIMULADO**) — efeitos (a)–(j) e os **seams** (a)/(b)/(c), **0 skipped**. **Nenhuma** chamada paga; **nenhuma** ativação.
- **Protocolo final de publicação/token/epoch (recorte de integridade):** além do PF, a operação passou a registrar **`publication_state`** (`none|in_flight|published|failed_before_upload|result_unknown`), **`publication_token`** (dono) e **`state_epoch`** (frescor). As RPCs `begin_publication`/`abort_publication`/`mark_result_unknown`/`confirm_existing_art`/`get_publication_epoch` governam a janela **Storage→banco**; `mark`/`deliver` exigem **token do dono**; `refund`/`close_failed_operation` exigem **`observed_epoch` fresco** capturado **antes** da sonda e **bloqueiam `published`**. A recuperação de arte usa `confirm_existing_art` (**sem** novo upload).
- **Exceção administrativa auditada:** `admin_resolve_product_1_1_pending` ganhou, **somente no caminho autorizado e auditado**, a marca **`authorized_publication_closure`** para encerrar publicação **realmente inconclusiva** (`in_flight`/`result_unknown`); **`published` nunca estorna**; a entrega tardia **não** reabre cobrança.
- **Migrations — LOCAL-ONLY, aplicadas SOMENTE na instância isolada** (`vendeo-f562a-isolated`), nunca por `db push`/`--linked`/remoto: **quatro** arquivos B2.2 — `20261015000001_f56_2b2b_failure_closure.sql`, `20261015000002_f56_2b2b_pending_abandon.sql`, `20261015000003_f56_2b2b_pending_read.sql`, `20261016000001_f56_2b2b_publication_fence.sql`.
- **Lifecycle OpenSpec SEPARADO:** `sync`/`archive` **NÃO** executados; `openspec/specs/**` e archives intocados; a change agregadora **não** é sincronizada/arquivada. **D13 NÃO resolvido**; sign-off de segurança da **B2.1** permanece **PENDENTE** (sinalizado separadamente). **B2.3** e a **F56.3** **NÃO** antecipadas.

## Impact

- **Banco (migration [BLOCKING])**: suporte ao **encerramento local com estorno confirmado** e à **resolução autorizada/auditada** quando não há sinal de finalidade (local-only; autorada no GSD).
- **Código novo/alterado (aditivo)**: recuperação de imagem no Storage privado; gatilho de falha final; encerramento atômico sob a trava financeira; caminho de estorno confirmado com formulário restaurado e mensagem aprovada.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode).
- **Rastreabilidade**: deriva da change agregadora substituída; ver `RECONCILIATION.md`.
- **Validação**: typecheck, lint, build, testes locais simulados, **provas de recuperação** e `openspec validate --strict`; `git diff --check`.
