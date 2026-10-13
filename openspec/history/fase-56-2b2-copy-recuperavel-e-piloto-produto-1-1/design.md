## Context

Esta change é a **F56.2b2**, última fatia da F56.2, e é uma **reconciliação** da especificação existente (não uma change nova). Depende da **F56.2b1b** (núcleo ponta a ponta, concluída/verificada/sincronizada/arquivada em **2026-10-12**) e, transitivamente, da b1a e da F56.2a (concluída/arquivada em 2026-10-07). O novo fluxo permanece **INATIVO** (chaves `false`, autorização `off`) e o deploy existe apenas em **preview**.

**Estado do ambiente (2026-10-13):** a quick `261013-hxm` corrigiu as 18 falhas herdadas; o ambiente isolado foi recuperado; `build` e **54 testes reais** passaram. Todos os archives/evidências históricas permanecem **intocados**.

**Contratos implementados (b1a/b1b) que esta change SHALL preservar:**

- **Copy (`src/lib/product-1-1/copy/copy-state.ts`):** `COPY_BUDGET_MS = 30_000`; `product_1_1_copy_state` com `pending|completed|failed`; `completed`/`failed` são **terminais PROTEGIDOS** (`product_1_1_apply_copy_state` devolve `rejected`/`conflict` e **recusa** reabrir/sobrescrever terminal); cancelamento atômico separado (`product_1_1_cancel_copy`); `completed` **exige conteúdo entregável** (`invalid_content`); drenagem **dentro do ciclo da requisição** (`drainCopyTask`), sem task órfã e **sem retry**.
- **Crédito (`credit-operation-client.ts`):** operação idempotente por `campaignId + operation_id`, estados `reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `delivered_not_refundable`; `refunded` uma vez; reconciliação **adia** a resolução.
- **Arte (`artifact-store.ts`/`download-gate.ts`):** bucket **privado** `campaign-images`, caminho imutável `{store}/{campaign}/{product-1-1}/{operation}/art-1024.jpg`, sonda **tipada** `integral | absent | invalid | indeterminate` (erro de Storage **nunca** colapsa com `absent`), download exige `delivered` + arte íntegra.
- **Autorização (`authorization/*`):** histórico append-only `product_flow_stage_authorizations`; estágios `off | isolated_pilot | test_stores | all_stores`; a RPC administrativa **RECUSA** estágios habilitadores (`operational_activation_blocked_in_b1a`); instância canônica server-side; expiração/revogação revalidadas.
- **Execução:** geração **dentro de uma única requisição** (`generate-image/route.ts`), **sem** fila/worker/outbox/cron e **sem** execução durável (diferida para quando houver Vercel Pro, mediante nova investigação).

## Goals / Non-Goals

**Goals:**

- Recuperação de copy como **falha de entrega**, com **tentativas identificadas**, histórico preservado, anti-duplicação e proteção contra conclusão atrasada — com a **menor mudança necessária** e **sem** introduzir execução durável.
- **Recuperação de imagem** no Storage privado e **reconciliação de D13** via **estorno único e confirmado**, com provas (corrida entrega×estorno, idempotência, resultado atrasado, falha de Storage/banco, formulário restaurado).
- Validação **local-primeiro** com provider simulado; **teste real controlado local** só sob autorização humana e teto, via **autorização temporária estreita**.

**Non-Goals:**

- Alterar o core da b1b ou o fluxo legado; reescrever o archive da b1b.
- Retomar/implementar **execução durável**, cron, worker, outbox ou fila.
- Aprovação/reprovação/correção (F56.3), migration remota, `db push`, deploy, produção/main ou habilitação de lojas nesta etapa.
- Chamada paga, remoção da barreira global de autorização ou planejamento/execução GSD nesta etapa.

## Decisions

### B2-D1 — Recuperação de copy é falha de ENTREGA, não qualidade editorial

Copy **entregue** (estado `completed` **com conteúdo entregável**) **encerra** a recuperação. Texto mal elaborado **pode ser editado pelo lojista** e **NÃO** autoriza nova geração. A recuperação existe apenas para **não entregar** texto quando a geração falhou/expirou — nunca para "melhorar" copy entregue. A recuperação de copy é **independente do estado da imagem**: pode ocorrer com a imagem já `delivered`, sem tocar a operação financeira nem a arte.

*Alternativa descartada:* permitir regeneração para "melhorar" copy. Rejeitada: transforma qualidade editorial em consumo de crédito e conflita com "sem novo crédito".

### B2-D2 — Política de tentativas (automáticas + manuais) e teto

- **1ª tentativa:** até **30s** (reusa o orçamento `COPY_BUDGET_MS`).
- **Falha transitória:** esperar **5s**; **2ª tentativa:** até **30s**.
- **Nova falha transitória:** esperar **10s**; **3ª tentativa:** até **30s**.
- **Após falhar nas três:** ofertar **ação manual + suporte**.
- **Máximo de 3 tentativas manuais** adicionais: **6 tentativas no total por entrega**.
- **Cada clique manual inicia somente UMA tentativa** e **NÃO reinicia** o ciclo automático.
- **Sucesso encerra** as tentativas. **Falhas definitivas** de configuração/permissão **NÃO** recebem repetição cega.
- **Cliques duplicados, reload e reenvio** não duplicam chamadas nem reiniciam contadores.
- **Chamadas técnicas/fallback são contabilizadas no limite** (sem tentativas escondidas).
- **Sem crédito adicional** ao lojista; custo das APIs registrado **internamente**.
- **Não** regenerar/modificar a imagem; a imagem `delivered` **permanece acessível** durante a recuperação.

Classificação: `transient` (timeout/indisponibilidade/rate limit) é elegível a repetição; `definitive` (configuração/permissão/validação) encerra sem repetição cega. A classificação vem do **estado/envelope server-side**, nunca do cliente.

### B2-D3 — Como a política cabe no ciclo de execução escolhido (sem execução durável)

A b1b executa a geração **dentro de uma única requisição**; **não** há fila/worker/cron. A recuperação **não** introduz execução durável:

1. A **1ª tentativa** ocorre no dreno da copy da requisição original (`COPY_BUDGET_MS`).
2. As **tentativas 2 e 3** do ciclo automático e as **tentativas manuais** são **novas requisições explícitas** (o estado persistido dirige a UI a re-tentar após 5s/10s, ou o lojista clica). Cada uma inicia **uma** tentativa identificada com seu **próprio orçamento de 30s**.
3. O **contador server-side de tentativas identificadas** é a fonte da verdade; requisições duplicadas/paralelas **não** criam tentativas extras (a tentativa ativa é única).
4. **Não há continuidade** após fechar o navegador: se a página fechar, o ciclo automático **para** (limitação explícita) e o lojista retoma com tentativa **manual**. A UI **não promete** retomada automática.

*Direção escolhida:* **requisições separadas** — cada tentativa é uma requisição explícita com orçamento próprio de 30s, governada pelo contador server-side. A escolha decorre do modelo de **tentativas identificadas** (cada tentativa é discreta e governável), **não** de uma afirmação sobre os limites da plataforma, que **permanecem não verificados**. Não se assume que manter o ciclo inteiro numa única requisição exceda o teto da função/rota nem que exija execução durável; essa alternativa simplesmente **não** é adotada.

### B2-D4 — Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada

Menor mudança necessária, **sem** reabrir/sobrescrever linha terminal. **Direção fixada antes do planejamento:**

- Cada tentativa recebe **identidade**: `attempt_seq` (1..6) + `attempt_token`.
- `product_1_1_copy_state` passa a **uma linha por tentativa** (`campaign_id, operation_id, attempt_seq`), preservando o histórico; o **estado corrente** é a tentativa de maior `attempt_seq`.
- A proteção de terminal é **por tentativa** e **entre tentativas**: `completed` em **qualquer** tentativa é **terminal para a entrega** (não há novas tentativas); um `completed` **nunca** é sobrescrito.
- `product_1_1_apply_copy_state`/`product_1_1_cancel_copy` passam a exigir `attempt_seq`+`attempt_token`; escrita de tentativa **superada** (ou token inválido) é **rejeitada** (`stale_attempt`) → **proteção contra conclusão atrasada**.
- Histórico/telemetria por tentativa (trigger automatic/manual, estado, custo, `run_id`/`trace_id`, timestamps) é preservado.
- Cancelamento por orçamento continua **atômico** e **separado** do estado da copy.

**Compatibilidade dos leitores/RPCs atuais (obrigatória):** `readCopyState`/`readCopyDelivery` passam a ler a linha de **maior `attempt_seq`** (o comportamento de tentativa única da b1b equivale a `attempt_seq = 1`); as RPCs mantêm o contrato de envelope e o **terminal protegido**, apenas com a identidade de tentativa acrescentada. A migration é **local-only**, autorada no GSD; a decisão de schema é **fixada aqui**.

*Alternativa rejeitada (decisão fechada):* tabela append-only separada + projeção. Custo maior (duas escritas/consistência) sem ganho sobre a identidade por tentativa.

### B2-D5 — Recuperação de imagem e estratégia substituta de D13

A decisão substitui o **tratamento anterior de D13** (claim residual permanentemente bloqueado) por uma estratégia **operacional** e comprovável. **Escopo financeiro:** a recuperação de imagem SHALL limitar-se a operações **não terminais** (`reserved`/`art_uploaded`); `delivered` **nunca** é estornado e `refunded` é **terminal** — **não** retorna a `delivered` mesmo que encontre imagem atrasada.

1. Com a operação **não terminal**, consultar o Storage privado pela **sonda tipada** existente (`probeArtifact`).
2. **`integral`** → **recuperar e concluir** a entrega (transição válida para `delivered` com evidência persistida). **Nunca regenerar.**
3. **Necessário, mas NÃO suficiente.** Operação não terminal **e** arte ausente são **evidências necessárias**, mas **não comprovam falha** por si sós: essa é **também** a situação normal **enquanto a imagem está sendo gerada**. **Consulta/reload durante a geração normal NÃO autoriza encerramento nem estorno.**
4. **Gatilho server-side que autoriza o encerramento local (persistido, sem exigir marcador `generation_outcomes` pré-salvo e sem encerramento externo do provider):**
   - (a) **falha FINAL para a operação, sem retry/fallback pendente** — persistida como `outcome = 'failed'` **de operação**, **ou** estado persistido que **prove que nenhuma tentativa adicional pode ser iniciada** (política de tentativas esgotada). **Um claim `failed` de uma tentativa que ainda admite retry/fallback NÃO é gatilho** — o orquestrador grava `failed` e **só depois** decide/inicia a próxima tentativa (`generation-orchestrator.ts`, `finish(... 'failed')` antes de `nextImageGenerationAttempt`/`continue`); nesse intervalo pode não haver `in_progress`, embora a geração continue. **e**
   - (b) **nenhum** claim `in_progress` para a operação; **e**
   - (c) arte **`absent` (confirmada)** com a operação **não terminal**.
   → autoriza o **encerramento local** com **estorno UMA vez** e a mensagem exata após o estorno persistido.
   O **estado de finalidade** (operação terminalmente falha) é a âncora que **sobrevive** à falha da gravação do marcador `generation_outcomes` **quando provável server-side**; se a finalidade **não puder ser provada**, **não** há estorno automático (item 5).
5. **Sem sinal de finalidade ⇒ SEM estorno automático.** Se **nenhum** claim tiver sido persistido (nem `in_progress`), ou o estado for `in_progress`/`abandoned`/`unknown`, **ou** houver **retry/fallback pendente**, **ou** a finalidade não puder ser provada, a recuperação **NÃO** infere erro da ausência de arte e **não** estorna automaticamente. Nesse caso, o encerramento local SHALL ser **explicitamente autorizado e auditado** (admin/operador autorizado, **motivo obrigatório** + **evidência**), que **registra a resolução** (append-only, idempotente) e **só então** encerra com estorno único. **Atomicidade:** o encerramento (automático ou autorizado) SHALL ocorrer sob a **mesma trava** `FOR UPDATE` da linha de crédito usada por `product_1_1_acquire_attempt_start`, transitando a operação para **terminal** (`refunded`); qualquer `acquire` posterior é recusado (`operation_terminal`) — impedindo **atomicamente** qualquer tentativa posterior. O cliente **só solicita**; a autorização é **server-side e auditada**. **Nunca** se inventa que a ausência demonstra erro.
6. **`invalid`/`indeterminate`** (erro/indisponibilidade/ambíguo) **NÃO** é ausência confirmada: **reverificar**, dar **feedback honesto**, **sem estorno** e **sem** anunciar crédito. Enquanto o banco consultado estiver indisponível, também **não** se encerra por ausência.
7. **Corrida entrega × estorno:** o estorno é **idempotente** e a transição usa CAS; a arte/`delivered` vence se comprovada; o estorno só ocorre sem arte. Uma resposta/imagem **atrasada** de operação `refunded` **não** reabre cobrança, **não** sobrescreve estado, **não** retorna a `delivered` e **não** libera a nova campanha.
8. **Autorização de recuperação/gratuidade** decorre do **estado server-side persistido**, nunca de alegação do cliente.
9. **`delivered` nunca é estornado.**
10. A **nova submissão** é uma **geração nova, com cobrança normal**.

**Provas exigidas (implementação + testes):** (a) corrida entrega×estorno; (b) estorno idempotente; (c) resultado atrasado; (d) falha de Storage/banco; (e) formulário restaurado; (f) **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna**; (g) **falha FINAL da operação (sem retry/fallback pendente) → encerra e estorna UMA vez**, inclusive sem marcador `generation_outcomes` quando a finalidade for provada server-side; (h) **principal falhou, fallback ainda será iniciado → recuperação NÃO estorna**; (i) **sem sinal de finalidade → exige encerramento local explicitamente autorizado e auditado** (cliente não autoriza sozinho); (j) **o encerramento (automático/autorizado) impede atomicamente tentativa posterior** (acquire recusado).

### B2-D6 — Gate de D13 preservado

**D13 NÃO é declarado resolvido** nesta change. O **gate bloqueante** de piloto/habilitação permanece até a **estratégia substituta ser implementada e comprovada** — recuperação de arte + **encerramento local com estorno confirmado**. O objeto do gate **não** é a antiga exigência de **encerramento externo do provider**: a operação é encerrada **localmente** a partir do estado persistido do servidor. **Evidência simulada não substitui comprovação operacional**; confirmar plano/limites da plataforma (Vercel Hobby/Supabase Free, **limites não verificados**) **isoladamente não satisfaz** o gate. O **archive da b1b não é reescrito**.

### B2-D7 — Validação local-primeiro

1. **Testes no navegador** no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**, cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download.
2. **Teste real controlado local** só com **autorização humana específica** e **teto de gasto**.
3. **Preview restrito** é **opcional e posterior** e exige configuração **isolada de dados/credenciais** — **não** apenas restrição de URL.
4. **Produção/main, migrations remotas e habilitação de lojas** são **decisões posteriores e separadas**. **Rollback de deploy não desfaz automaticamente** banco/ledger.

### B2-D8 — Autorização temporária estreita (sem remover a barreira global)

O mecanismo atual **recusa estágios habilitadores**. Para o **teste real isolado**, especificar uma autorização **temporária e ESTREITA**: **instância autorizada** + **lojas autorizadas**, **expiração**, **auditoria** e **revogação**, concedida por admin autenticado via RPC auditada. A **barreira global permanece** (a recusa de estágios habilitadores **não** é removida para o escopo geral). A autorização é revalidada a cada decisão e **nunca** decorre do cliente.

### B2-D9 — F56.3 separada

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na **F56.3**. Esta change **não** antecipa F56.3.

## Risks / Trade-offs

- **[Repetição abusiva / custo oculto]** → tentativas **identificadas** com teto de 6; chamadas técnicas/fallback **contabilizadas**; custo **interno**.
- **[Reabrir/sobrescrever terminal]** → identidade por tentativa + rejeição de `stale_attempt`; `completed` **nunca** sobrescrito.
- **[Execução durável acidental]** → tentativas 2/3 e manuais são **requisições explícitas**; **sem** cron/worker/outbox; sem continuidade após fechar o navegador.
- **[Estorno indevido / duplo]** → ausência **confirmada** apenas (404 de objeto); estorno **idempotente**; `delivered` **não** estorna; `indeterminate` **não** estorna.
- **[Resultado atrasado reabre cobrança]** → terminal `refunded`/`delivered` prevalece; resultado atrasado não sobrescreve nem libera nova campanha.
- **[Regressão no core/legado]** → mudanças aditivas/condicionais e testes de não-regressão.
- **[Gate de D13 confundido com resolvido]** → gate explícito, provas exigidas e **não declaração** de resolução.
- **[Autorização larga demais]** → recorte **estreito** por instância/lojas, com expiração/auditoria/revogação; barreira global mantida.

## Migration Plan

1. Implementar a recuperação de copy (identidade de tentativa/histórico/anti-duplicação) e a recuperação de imagem/estorno; typecheck/lint/build/testes locais.
2. Rodar os testes simulados locais (provider simulado) e as **provas de recuperação** exigidas (B2-D5).
3. **Checkpoint humano** → autorização temporária estreita + teto → **teste real controlado local**.
4. Avaliar preview restrito (configuração isolada); migration remota/deploy/habilitação em etapa posterior autorizada.

Rollback: desabilitar a ação/recuperação não afeta o core; **rollback de deploy não desfaz automaticamente** banco/ledger.

## Open Questions

- **Formato exato do teto de gasto** do teste real controlado — a definir no checkpoint humano (não bloqueante para o planejamento).

> **Sem questões abertas de schema:** a direção de `copy_state` (uma linha por tentativa) está **fixada** em B2-D4; o encerramento por ausência é **local** (B2-D5), sem depender de encerramento externo do provider.

## Lacunas técnicas restantes (honestas)

- **D13 permanece NÃO resolvido** até a **implementação e comprovação** da estratégia substituta (recuperação de arte + **encerramento local com estorno confirmado**). O que falta é **prova operacional** no health harness/matriz real — **não** a resolução de uma fonte de encerramento externo do provider, que **não** é exigida.
- **Limites efetivos** de Vercel Hobby / Supabase Free permanecem **não verificados** (e **não** são usados como justificativa de desenho).
- A **classificação `transient × definitive`** e os limiares exatos serão fechados na implementação, sem reduzir as garantias desta especificação.
- Nenhuma decisão aqui é declarada **implementada**: a change permanece **especificada**, aguardando revisão humana e posterior GSD.
