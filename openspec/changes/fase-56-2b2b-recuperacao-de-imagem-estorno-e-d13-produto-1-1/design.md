## Context

Esta change é a **B2.2** da divisão aprovada da F56.2b2 (B2.1 copy, B2.2 imagem/estorno/D13, B2.3 autorização/teste real). Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; não implementada**). Depende da **F56.2b1b** (arquivada em 2026-10-12) e de **B2.1** (dependência **não funcional**; harness reutilizável).

**Contratos implementados (b1a/b1b) que esta change SHALL preservar:**

- Operação de crédito idempotente por `campaignId + operation_id`: `reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `delivered_not_refundable`; `refunded` uma vez; reconciliação **adia**.
- Início de tentativa atômico: `product_1_1_generation_attempt_claims` (`in_progress|done|failed|abandoned`) com trava comum `FOR UPDATE` na linha de crédito (`product_1_1_campaign_credit_operations`), usada por `product_1_1_acquire_attempt_start` e pela resolução financeira.
- Marcador `product_1_1_generation_outcomes` (`unknown|failed`, imutável).
- Sonda de arte **tipada** (`integral | absent | invalid | indeterminate`); erro de Storage **não** colapsa com `absent`; bucket privado; caminho imutável.
- Execução **dentro da requisição**, sem fila/worker/cron/outbox.

**Ponto crítico confirmado no orquestrador:** `generation-orchestrator.ts` grava `finish(... 'failed')` e **só depois** decide `nextImageGenerationAttempt`/`continue` — logo, `failed` de tentativa **não** é falha final da operação.

## Goals / Non-Goals

**Goals:**

- Recuperar arte íntegra no Storage **sem regenerar**.
- **Encerramento local com estorno único confirmado** por **gatilho persistido de falha FINAL**, substituindo o tratamento de D13.
- **Sem sinal de finalidade:** encerramento **autorizado e auditado**; **atômico** sob a trava financeira.
- Preservar as **provas exigidas** e o **gate D13** até comprovação.

**Non-Goals:**

- Recuperação de **copy** (B2.1); autorização estreita/teste real (B2.3); aprovação/correção (F56.3).
- Exigir encerramento externo do provider ou marcador de falha pré-salvo.
- Migration remota, deploy, habilitação de lojas, chamada paga, GSD.

## Decisions

### B2B-D1 — Recuperação de arte no Storage privado (sem regenerar)

Sonda **tipada** (`probeArtifact`). `integral` → **recuperar e concluir** a entrega (transição válida para `delivered` com evidência persistida). **Nunca regenerar.** `invalid`/`indeterminate` → **reverificar** e dar **feedback honesto**, sem conclusão de ausência. Escopo financeiro **apenas** em operações **não terminais**.

### B2B-D2 — Necessário, mas não suficiente

Operação **não terminal** + **arte ausente** são **evidências necessárias, mas NÃO comprovam falha** — é **também** a situação normal durante a geração. **Consulta/reload durante a geração normal NÃO autoriza encerramento nem estorno.**

### B2B-D3 — Gatilho server-side de falha FINAL (sem marcador prévio, sem encerramento externo)

Autoriza o **encerramento local** com **estorno UMA vez**:

- (a) **falha FINAL para a operação, sem retry/fallback pendente** — `outcome = 'failed'` **de operação** **ou** estado persistido que **prove que nenhuma tentativa adicional pode ser iniciada**;
- (b) **nenhum** claim `in_progress`; **e**
- (c) arte `absent` confirmada com operação não terminal.

**Um claim `failed` que ainda admite retry/fallback NÃO é gatilho.** O **status persistido do claim** e a **finalidade da operação** são as âncoras que sobrevivem à falha da gravação do marcador `generation_outcomes`. Se a **finalidade não puder ser provada** → item D4.

### B2B-D4 — Sem sinal de finalidade: encerramento autorizado e auditado (atomicamente impeditivo)

Sem finalidade provável (nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou prova indisponível), **não** há estorno automático. O encerramento local SHALL ser **explicitamente autorizado e auditado** (admin/operador autorizado, **motivo obrigatório** + **evidência**), que **registra a resolução** (append-only, idempotente) e **só então** encerra com estorno único. O cliente **só solicita**.

**Atomicidade:** automático **ou** autorizado, o encerramento SHALL ocorrer sob a **mesma trava `FOR UPDATE`** da linha de crédito usada por `product_1_1_acquire_attempt_start` e transitar para **terminal** (`refunded`); qualquer `acquire` posterior é recusado (`operation_terminal`) — **impedindo atomicamente** qualquer tentativa posterior.

### B2B-D5 — Estorno único confirmado, formulário e mensagem aprovada

O estorno SHALL ser **idempotente** por `campaignId + operation_id` (CAS). Somente **após o estorno persistido confirmado**, exibir exatamente: **“Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.”** Devolver o **formulário preenchido** com os dados preservados. Se o estorno **não** puder ser confirmado, **não** anunciar crédito.

### B2B-D6 — Terminais, corrida e resultado atrasado

- **`delivered` nunca é estornado**; **`refunded` é terminal** e **não** retorna a `delivered`, mesmo com imagem atrasada.
- **Corrida entrega × estorno:** arte/`delivered` comprovada **vence**; estorno só na ausência de arte; **no máximo um efeito de ledger**.
- **Resultado atrasado** de `refunded` não reabre cobrança, não sobrescreve estado e não libera a nova campanha; a nova submissão é **geração nova, com cobrança normal**. A autorização de recuperação/gratuidade decorre do **estado server-side**, nunca do cliente.

### B2B-D7 — Gate de D13 preservado

**D13 NÃO é declarado resolvido** nesta change. O **gate bloqueante** de piloto/habilitação permanece até a estratégia ser **implementada e comprovada**. O objeto do gate **não** é a antiga exigência de **encerramento externo**: a operação é encerrada **localmente** a partir do estado persistido. **Evidência simulada não substitui comprovação operacional.** O archive da b1b **não** é reescrito.

## Risks / Trade-offs

- **[Estorno indevido / duplo]** → gatilho de **falha final**; estorno idempotente; `delivered` não estorna; `indeterminate` não estorna.
- **[Estorno no meio de geração normal]** → arte ausente não basta; **retry/fallback pendente não estorna**.
- **[Caso sem sinal virar bloqueio permanente (recriar D13)]** → **encerramento autorizado e auditado**, atômico sob a trava financeira.
- **[Resultado atrasado reabre cobrança]** → terminais `refunded`/`delivered` prevalecem.
- **[Gate confundido com resolvido]** → provas exigidas e **não declaração** de resolução.

## Migration Plan

1. Implementar recuperação de arte/gatilho/encerramento atômico/estorno; typecheck/lint/build/testes locais.
2. Rodar testes simulados locais (provider simulado) e as **provas exigidas** (B2B-D8).
3. **Checkpoint humano** desta fatia; submeter B2.2 à revisão; **gate D13** só então avaliado.

Rollback: desabilitar a recuperação não afeta o core; **rollback de deploy não desfaz banco/ledger**.

### B2B-D8 — Provas exigidas (implementação + testes)

(a) corrida entrega×estorno; (b) estorno idempotente; (c) resultado atrasado; (d) falha de Storage/banco; (e) formulário restaurado; (f) **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna**; (g) **principal falhou, fallback ainda será iniciado → NÃO estorna**; (h) **falha final sem marcador prévio → encerra e estorna uma vez**; (i) **sem sinal de finalidade → exige encerramento local autorizado e auditado**; (j) **o encerramento impede atomicamente tentativa posterior**.

## Open Questions

- **Forma do registro autorizado/auditado** e o predicado exato de finalidade — fechados na implementação, sem reduzir as garantias.
- Nenhuma questão aberta de escopo (financeiro apenas em operações não terminais).
