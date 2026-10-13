## Why

A **F56.2b2** foi reconciliada e o responsável **aprovou a divisão em três bases independentes**. Esta change formaliza **B2.2 — Recuperação de imagem, estorno e D13**, sem redesenhar decisões aprovadas.

A **F56.2b1b** (arquivada em 2026-10-12) deixou a operação de crédito (`reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `delivered_not_refundable`), a sonda de arte **tipada** (`integral | absent | invalid | indeterminate`) e a limitação **D13** (claim residual bloqueado, sem fonte operacional de encerramento) como **gate bloqueante** da b2. Esta fatia **substitui o tratamento de D13** por uma estratégia operacional comprovável — **sem** exigir encerramento externo do provider nem marcador de falha pré-salvo.

A change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` é **substituída documentalmente** e **NÃO** é tratada como implementada.

## What Changes

- **Recuperação de arte no Storage privado:** arte **íntegra existente** → **recuperar e concluir** a entrega **sem regenerar**; limitada a operações **não terminais** (`reserved`/`art_uploaded`).
- **Encerramento local com estorno confirmado (substitui D13):** com **ausência de arte confirmada** **e** **falha FINAL para a operação, sem retry/fallback pendente**, **encerrar a operação LOCALMENTE** com **estorno UMA vez** (`refunded`) — **sem** depender de encerramento externo do provider e **sem** exigir o marcador `generation_outcomes` pré-salvo.
- **Ausência de arte não demonstra falha sozinha.** Operação não terminal + arte ausente são **necessárias, mas NÃO suficientes**; **consulta/reload durante a geração normal NÃO estorna**.
- **Gatilho server-side persistido de falha FINAL:** `outcome = 'failed'` de operação **ou** estado persistido que prove que **nenhuma tentativa adicional pode ser iniciada**; **nenhum** claim `in_progress`; arte `absent` confirmada. **`failed` de tentativa com retry/fallback pendente NÃO estorna.**
- **Sem sinal de finalidade:** encerramento local **explicitamente autorizado e auditado** (motivo + evidência), registrando a resolução (append-only, idempotente); o cliente **só solicita**, nunca autoriza.
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
3. O encerramento local exige **falha FINAL para a operação, sem retry/fallback pendente** + **nenhum** claim `in_progress` + arte `absent` confirmada; **`failed` de tentativa com retry/fallback pendente não estorna**.
4. **Sem sinal de finalidade** → encerramento local **explicitamente autorizado e auditado**; o cliente sozinho **não** autoriza estorno.
5. O encerramento ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** qualquer tentativa posterior (`operation_terminal`).
6. **Ausência confirmada + gatilho** → **estornar uma única vez**, encerrar como `refunded` e devolver o **formulário preenchido** com os dados preservados.
7. A mensagem exata só é exibida **após o estorno persistido confirmado**; se não confirmado, **não** se anuncia crédito.
8. **Erro/indisponibilidade** do Storage **não** é ausência confirmada: reverificar e dar **feedback honesto** (sem estorno indevido).
9. **`delivered` nunca é estornado**; **`refunded` não retorna a `delivered`**, mesmo com imagem atrasada.
10. **Corrida entrega × estorno** e **estorno idempotente**: no máximo um efeito de ledger.
11. Resultado atrasado de `refunded` **não** reabre cobrança, **não** sobrescreve e **não** libera a nova campanha; nova submissão é **geração nova com cobrança normal**.
12. **Provas exigidas aprovadas:** corrida entrega×estorno; estorno idempotente; resultado atrasado; falha de Storage/banco; formulário restaurado; **geração normal sem arte não estorna**; **principal falhou/fallback pendente não estorna**; **falha final sem marcador prévio encerra e estorna uma vez**; **sem sinal de finalidade exige autorização auditada**; **encerramento impede tentativa posterior**.
13. **D13 não é declarado resolvido**: o gate permanece até implementação e **comprovação**; **evidência simulada não satisfaz** o gate; o **archive da b1b não é reescrito**.

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

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável.

## Impact

- **Banco (migration [BLOCKING])**: suporte ao **encerramento local com estorno confirmado** e à **resolução autorizada/auditada** quando não há sinal de finalidade (local-only; autorada no GSD).
- **Código novo/alterado (aditivo)**: recuperação de imagem no Storage privado; gatilho de falha final; encerramento atômico sob a trava financeira; caminho de estorno confirmado com formulário restaurado e mensagem aprovada.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode).
- **Rastreabilidade**: deriva da change agregadora substituída; ver `RECONCILIATION.md`.
- **Validação**: typecheck, lint, build, testes locais simulados, **provas de recuperação** e `openspec validate --strict`; `git diff --check`.
