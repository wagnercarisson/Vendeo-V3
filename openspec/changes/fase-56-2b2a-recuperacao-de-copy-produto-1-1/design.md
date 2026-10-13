## Context

Esta change é a **B2.1** da divisão aprovada da F56.2b2 (B2.1 copy, B2.2 imagem/estorno/D13, B2.3 autorização/teste real). Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (substituída documentalmente, **não** implementada). Depende da **F56.2b1b** (arquivada em 2026-10-12) e, transitivamente, da b1a e da F56.2a.

**Contratos implementados (b1b) que esta change SHALL preservar:**

- `src/lib/product-1-1/copy/copy-state.ts`: `COPY_BUDGET_MS = 30_000`; `product_1_1_copy_state` com `pending|completed|failed`; `completed`/`failed` **terminais PROTEGIDOS** (`product_1_1_apply_copy_state` recusa reabrir/sobrescrever terminal; `rejected`/`conflict`); cancelamento atômico separado (`product_1_1_cancel_copy`); `completed` **exige conteúdo entregável** (`invalid_content`); drenagem **dentro do ciclo da requisição** (`drainCopyTask`), sem task órfã e **sem retry**.
- Execução **dentro de uma única requisição**, **sem** fila/worker/cron/outbox e **sem** execução durável.

## Goals / Non-Goals

**Goals:**

- Recuperação de copy como **falha de entrega**, com **tentativas identificadas**, histórico preservado, anti-duplicação e proteção contra conclusão atrasada — **menor mudança necessária** e **sem** execução durável.
- Política 3 automáticas (30s/5s/30s/10s/30s) + até 3 manuais (máx. 6).
- Testes de contrato, Postgres isolado e navegador com **provider simulado**.

**Non-Goals:**

- Regenerar/alterar a imagem; consumir crédito adicional.
- Recuperação **financeira** de imagem / estorno / D13 (pertence a **B2.2**).
- Autorização estreita e teste real (pertence a **B2.3**).
- Aprovação/reprovação/correção (**F56.3**), migration remota, deploy, habilitação de lojas, chamada paga ou GSD.

## Decisions

### B2A-D1 — Recuperação de copy é falha de ENTREGA, não qualidade editorial

Copy **entregue** (estado `completed` **com conteúdo entregável**) **encerra** a recuperação. Texto mal elaborado **pode ser editado pelo lojista** e **NÃO** autoriza nova geração. A recuperação existe apenas para **não entregar** texto quando a geração falhou/expirou. A recuperação é **independente do estado da imagem**: pode ocorrer com a imagem já `delivered`, sem tocar a operação financeira nem a arte.

### B2A-D2 — Política de tentativas (automáticas + manuais) e teto

- **1ª tentativa:** até **30s** (reusa `COPY_BUDGET_MS`).
- **Falha transitória:** esperar **5s**; **2ª:** até **30s**.
- **Nova falha transitória:** esperar **10s**; **3ª:** até **30s**.
- **Após falhar nas três:** **ação manual + suporte**.
- **Máximo de 3 manuais** adicionais: **6 no total por entrega**.
- **Cada clique manual** inicia **UMA** tentativa e **NÃO reinicia** o ciclo automático.
- **Sucesso encerra**; **falhas definitivas** (configuração/permissão) **não** repetem cegamente.
- **Cliques duplicados/reload/reenvio** não duplicam chamadas nem reiniciam contadores.
- **Chamadas técnicas/fallback contabilizadas** no limite.
- **Sem crédito adicional**; custo registrado **internamente**.

Classificação `transient × definitive` vem do **estado/envelope server-side**, nunca do cliente.

**Cada chamada efetiva é uma tentativa — sem fallback escondido.** A recuperação **NÃO** executa uma chamada de fallback **dentro da mesma tentativa/acionamento (clique)**: cada chamada efetiva de provider é uma **tentativa identificada própria**, adquirida pelo servidor **antes** da chamada, e segue **integralmente** esta política — **contadores, limites e esperas**. Quando aplicável, um alvo de **fallback** é usado na **tentativa seguinte governada pela política** (após a espera), **não** como segunda chamada oculta dentro do mesmo acionamento. A **aquisição** da tentativa (ver B2A-D4) é decidida pelo **servidor**, sob trava, **antes** de qualquer chamada ao provider.

### B2A-D3 — Como a política cabe no ciclo de execução (sem execução durável)

1. A **1ª tentativa** ocorre no dreno da copy da requisição original (`COPY_BUDGET_MS`).
2. As **tentativas 2 e 3** e as **manuais** são **requisições explícitas** (o estado persistido dirige a UI a re-tentar após 5s/10s, ou o lojista clica), cada uma com **orçamento próprio de 30s**.
3. O **contador server-side de tentativas identificadas** é a fonte da verdade; requisições duplicadas/paralelas **não** criam tentativas extras.
4. **Sem continuidade** após fechar o navegador: o ciclo automático **para** e a retomada é **manual**. A UI **não promete** retomada automática.

*Direção:* **requisições separadas** pelo modelo de tentativas identificadas — **não** por afirmação sobre limites da plataforma (que permanecem **não verificados**).

**Esperas e atividade são decididas pelo SERVIDOR.** A UI não infere espera nem atividade por tempo; o estado persistido (com **posse/lease** da tentativa — B2A-D4) determina se há tentativa **ativa** ou **interrompida**. Quem **agenda** a próxima automática é o **estado do servidor**: após falha transitória, a UI apresenta `aguardando` com a contagem reportada pelo servidor e emite a próxima tentativa automática ao fim dela; se o servidor **não comprovar atividade** (ex.: requisição encerrada sem gravação final), a tentativa é **interrompida** e a retomada é **manual** (sem spinner preso).

### B2A-D4 — Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada

Direção de schema **fixada antes do planejamento** (sem questão aberta):

- Cada tentativa recebe **identidade**: `attempt_seq` (1..6) + `attempt_token`.
- `product_1_1_copy_state` passa a **uma linha por tentativa** (`campaign_id, operation_id, attempt_seq`); o **estado corrente** é a tentativa de maior `attempt_seq`.
- Terminal **por tentativa** e **entre tentativas**: `completed` em **qualquer** tentativa é **terminal para a entrega**; nunca é sobrescrito.
- `product_1_1_apply_copy_state`/`product_1_1_cancel_copy` passam a exigir `attempt_seq`+`attempt_token`; tentativa **superada** é **rejeitada** (`stale_attempt`) → proteção contra atraso.
- **Compatibilidade:** `readCopyState`/`readCopyDelivery` leem a linha de **maior `attempt_seq`** (tentativa única da b1b ≡ `attempt_seq = 1`); o contrato de envelope e o terminal protegido são preservados.
- **Aquisição atômica por RPC:** uma RPC condicional (`SECURITY DEFINER`, sob a **trava da operação**) decide a aquisição — tentativa **ativa**, próximo `attempt_seq`, **limites** (3 automáticas + 3 manuais = 6) e entrega **já `completed`** — e devolve o **vencedor**; requisições **perdedoras** apenas **acompanham** (não iniciam chamada). A aquisição ocorre **antes** de qualquer chamada ao provider (inclusive fallback).
- **`pending` exige atividade comprovada:** a linha corrente carrega **posse/lease** (token + marca temporal); `pending` **sem** atividade comprovada é **interrompida**, **não** ativa (evita spinner preso). A conclusão atrasada de tentativa superada continua **rejeitada** (`stale_attempt`).
- **Migração de dados:** registros existentes da b1b (estado e cancelamento) são migrados **transacionalmente** para o modelo por tentativa, preservando o **vínculo da MESMA tentativa** (tokens derivados da MESMA tentativa) e **restaurando a imutabilidade** do cancelamento ao final; provado com **fixtures anteriores à B2.1**.

*Alternativa rejeitada (decisão fechada):* tabela append-only separada + projeção (custo maior sem ganho).

### B2A-D5 — Escopo restrito e segurança

A recuperação SHALL exigir **autenticação** e **ownership** da campanha/loja; sem ownership, é negada **sem** chamada de IA. A tentativa SHALL abranger **somente os textos** (`campaign_copy`), SHALL NOT regenerar/alterar a imagem, SHALL NOT consumir crédito adicional (débito inalterado) e SHALL registrar o **custo interno**.

**Barreira de não-ativação e identidade.** Além de auth/ownership, a recuperação exige que a campanha pertença ao **novo fluxo**, que o `operationId` **corresponda** à campanha e que a **elegibilidade/autorização vigente** seja respeitada; com o fluxo **`off`**, a ação é **negada sem chamada de IA**. `mode`, sequência e token enviados pelo cliente são **solicitações**, nunca **autoridade** (autorização e identidade corrente são decididas **server-side**).

### B2A-D6 — Testes (contrato, Postgres isolado, navegador)

- **Contrato:** política, teto de 6, clique manual, `stale_attempt`, terminal não sobrescrito, falha definitiva, anti-duplicação, independência copy×imagem.
- **Postgres isolado:** transições condicionais e proteção de terminal (instância descartável; nenhuma migration remota).
- **Navegador:** com **provider simulado**; **nenhuma chamada paga**.

## Risks / Trade-offs

- **[Repetição abusiva / custo oculto]** → tentativas identificadas com teto de 6; chamadas técnicas/fallback contabilizadas; custo interno.
- **[Reabrir/sobrescrever terminal]** → identidade por tentativa + `stale_attempt`; `completed` nunca sobrescrito.
- **[Execução durável acidental]** → tentativas 2/3 e manuais são requisições explícitas; sem cron/worker/outbox.
- **[Regressão no core/legado]** → mudanças aditivas/condicionais e testes de não-regressão.
- **[Confundir com qualidade editorial]** → copy entregue encerra; não autoriza nova geração.
- **[Spinner preso por `pending` órfão]** → `pending` exige **atividade comprovada** (posse/lease); tentativa **interrompida** é distinta de **ativa** e oferece retomada manual.
- **[Fallback escondido / teto burlado]** → **cada chamada efetiva = tentativa identificada**; **aquisição atômica** antes do provider.
- **[Backfill quebrando imutabilidade/vínculo]** → migração **transacional** com restauração da imutabilidade, provada com **fixtures anteriores à B2.1**.

## Migration Plan

1. Implementar **aquisição atômica**, identidade de tentativa/histórico/anti-duplicação e a política (**cada chamada efetiva = uma tentativa**); typecheck/lint/build/testes locais.
2. Migrar **dados existentes** da b1b transacionalmente (preservando o vínculo da mesma tentativa e **restaurando a imutabilidade**), provado com **fixtures anteriores à B2.1**.
3. Rodar testes de contrato, **Postgres isolado** (incluindo **concorrência pela ROTA real**, limites separados, esperas, fallback e tentativa inicial) e navegador (**provider simulado**); **nenhuma chamada paga**.
4. **Checkpoint humano** desta fatia; submeter B2.1 à revisão.

Rollback: desabilitar a ação/recuperação não afeta o core nem o legado.

## Open Questions

- **Limiares exatos de `transient × definitive`** — fechados na implementação, sem reduzir as garantias desta especificação.
- Nenhuma questão aberta de schema (direção fixada em B2A-D4).
