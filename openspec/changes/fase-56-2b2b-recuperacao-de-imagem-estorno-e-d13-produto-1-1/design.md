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

### B2B-D3 — Gatilho server-side de falha FINAL: predicado **PF** (aprovado — **4a** como regra única)

O gatilho que autoriza o **encerramento local** com **estorno UMA vez** é o predicado **PF** — **todos** exigidos, avaliados **server-side sob a trava C4** (mesma linha de crédito de `acquire`/resolução):

1. **Operação não terminal** (`reserved`/`art_uploaded`).
2. **Arte `absent` CONFIRMADA** pela sonda tipada (nunca `invalid`/`indeterminate`/erro → não é ausência).
3. **Nenhum claim `in_progress`** para a operação.
4. **Finalidade persistida (4a):** linha `outcome='failed'` em `product_1_1_generation_outcomes`, **gravada no ponto de decisão terminal** (quando a política **não** produz próxima tentativa) via a **RPC existente** `product_1_1_record_generation_outcome`, que **já aceita** `failed`. **O gatilho exige que o marcador tenha sido gravado com SUCESSO.**

**Regra única (aprovada):** adota-se **somente (4a)**. A antiga alternativa **(4b)** — exaustão estrutural por `attempt_number` máximo / recusas como `primary_after_fallback`/`attempt_already_completed`/`attempt_limit_reached` — é **retirada**: **recusas isoladas NÃO comprovam, sozinhas, falha final da operação** (um processo vivo ainda poderia decidir; uma recusa de `acquire` não é prova de finalidade).

**Cobertura do intervalo principal→fallback:** na janela entre `finish('failed')` e a aquisição da próxima tentativa, **não há marcador `failed`** (ele só é gravado no ponto de decisão terminal). ⇒ o intervalo **não satisfaz PF** ⇒ **retry/fallback pendente NÃO estorna.**

**Um claim `failed` sozinho NÃO é gatilho** (é idêntico a "processo morto após gravar `failed`"). Se o **marcador `failed` não existir** → **D4** (caminho autorizado).

**Preservação da saída quando o marcador NÃO puder ser gravado:** se a gravação de `outcome='failed'` **falhar** (erro de escrita) ou se já existir um `unknown` **imutável** (a tabela é imutável e única por operação), **não** se trata como sucesso automático nem se **sobrescreve** o marcador existente. A operação **permanece não terminal** e é encaminhada à **resolução autorizada e auditada** (D4) — nunca se infere erro da ausência nem se força PF.

### B2B-D4 — Sem sinal de finalidade: encerramento autorizado e auditado (atomicamente impeditivo)

Sem finalidade provável (nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou prova indisponível), **não** há estorno automático. O encerramento local SHALL ser **explicitamente autorizado e auditado**, **reutilizando a resolução administrativa existente** `admin_resolve_product_1_1_pending`:

- **Quem autoriza:** administrador/operador **autorizado** (`requireAdmin` + `requireSameOrigin`; `actor_id` registrado). O **cliente/lojista apenas solicita** — nunca autoriza.
- **Ação:** `refund_once` (estorno único) para o caso inconclusivo; `deliver_existing_art` quando houver arte íntegra (sem regenerar).
- **Motivo/evidência:** `reason` **obrigatório**; evidência **server-derived** (`origin='server-derived'`, `art_kind`, `execution_ended`). `refund_once` exige `art_kind='absent'`; `invalid`/`indeterminate` **bloqueiam**. **NÃO** se exige comprovar encerramento **externo** do provider.
- **Auditoria:** `admin_audit_log.action='product_1_1_pending_resolution'`, `operation_id = resolution_operation_id` (**único global**), metadata (campanha/operação/ação/`art_kind`/status/motivo); **append-only, idempotente** (replay equivalente ⇒ idempotente; divergente ⇒ `operation_identity_conflict`), na **mesma transação**.
- **Extensão necessária (exclusiva do caminho autorizado):** a RPC hoje **recusa** `operation_in_progress` **sempre** (D13). B2.2 SHALL permitir, **somente** no caminho **autorizado e auditado**, finalizar o claim **`in_progress` residual** como `abandoned` **na mesma transação sob a trava** — **sem** exigir encerramento externo, mantendo `invalid`/`indeterminate` bloqueando. Alteração **aditiva/condicional** da RPC existente.

**Precisão (regra fixada):** **PF exige ausência de `in_progress`**; logo o **caminho automático NÃO abandona claim algum** e **não** pode autorizar abandonar um claim **ativo**. **Abandonar um claim `in_progress` pertence EXCLUSIVAMENTE ao caminho autorizado** (D4), que o faz sob a trava e com as proteções do terminal (abaixo).

**Atomicidade:** automático **ou** autorizado, o encerramento SHALL ocorrer sob a **mesma trava `FOR UPDATE`** da linha de crédito usada por `product_1_1_acquire_attempt_start` e transitar para **terminal** (`refunded`); qualquer `acquire` posterior é recusado (`operation_terminal`) — **impedindo atomicamente** qualquer tentativa posterior.

**Neutralização de resultados em voo:** com a operação terminal, `product_1_1_record_generation_outcome` devolve `operation_terminal`; `product_1_1_deliver_campaign_credit_operation` só transita `art_uploaded → delivered` (recusa a partir de `refunded`); o `unknown` **não governa** terminal (precedência I2). Uma resposta/imagem atrasada **não** sobrescreve estado nem reabre cobrança. **No caminho autorizado que abandona um claim `in_progress`**, a chamada em voo que retornar depois encontra o claim já `abandoned`: `product_1_1_finish_attempt` recusa a transição (`invalid_transition`), `markArtUploaded`/`deliver` recusam a partir de `refunded`, e o estado terminal **não** é sobrescrito (proteção contra o **resultado atrasado**).

### B2B-D5 — Estorno único confirmado, formulário e mensagem aprovada

O estorno SHALL ser **idempotente** por `campaignId + operation_id` (CAS). Somente **após o estorno persistido confirmado**, exibir exatamente: **“Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.”** Devolver o **formulário preenchido** com os dados preservados. Se o estorno **não** puder ser confirmado, **não** anunciar crédito.

### B2B-D9 — Formulário restaurado: dados, limites e honestidade

- **Fonte server-side:** brief congelado em `campaigns.input_snapshot` (produto, preço original/desconto, intenção, selo, validade, direção de fundo, texto obrigatório, oferta) + `identitySnapshot` (direção textual de identidade) + **seleções** de referência (`frozenContentReferences`). No cliente, reaproveita-se o rascunho em `sessionStorage` (`campaign_draft`, `campaign_draft_image`) **quando ainda existir**.
- **Limitação (não prometer o insustentável):** o **arquivo de imagem do produto** e as **imagens de referência** **NÃO** são persistidos server-side (client-only). Restauram-se **os campos preenchidos**; **não** se promete restauração de **imagem**; a UI SHALL **avisar** que a imagem do produto (e referências) pode precisar ser re-adicionada.
- **Sem confirmação do estorno:** feedback **honesto**, **sem** prometer crédito devolvido; a autorização de recuperação/gratuidade decorre do **estado server-side**.
- **Nova submissão** após estorno é **geração nova com cobrança normal**; o formulário restaurado é uma **nova submissão**, não a reabertura da operação.

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

**Camada 1 — falhas raras por simulação controlada (harness/fake):** força caminhos raros (falha de `storeArtifact`, sonda `indeterminate`, falha de gravação do marcador). Prova **controle de fluxo**; **não** substitui a Camada 2.

**Camada 2 — comprovação de efeitos reais em Postgres/Storage locais (instância isolada e descartável):** prova, com efeitos observados: (a) corrida entrega×estorno; (b) estorno idempotente; (c) resultado atrasado; (d) falha de Storage/banco; (e) formulário restaurado; (f) **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna**; (g) **principal falhou, fallback ainda será iniciado → NÃO estorna**; (h) **falha final (PF) → encerra e estorna uma vez**; (i) **sem sinal de finalidade → exige encerramento local autorizado e auditado**; (j) **o encerramento impede atomicamente tentativa posterior**.

**Provider real/ativação** é reservado à **B2.3**; **não** se provoca falha rara em provider pago.

**Reconciliação de “evidência simulada não satisfaz o gate”:** **simular a falha** (gatilho) **não** é o mesmo que **simular todos os efeitos da recuperação**. O gate exige **prova operacional dos efeitos** (Camada 2); a indução da falha rara por harness (Camada 1) é **permitida** para exercitar o controle de fluxo.

## Open Questions

- **A-1 — resolvida (2026-10-15):** adotada **(4a)** como **regra única** (gravar `outcome='failed'` no ponto de decisão terminal, reusando RPC/tabela existentes); **(4b) retirada**. Aprovação humana registrada; ver `RECONCILIATION.md` §5.
- Nenhuma questão aberta de escopo (financeiro apenas em operações não terminais) nem de schema.
