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

### B2A-D3 — Como a política cabe no ciclo de execução (sem execução durável)

1. A **1ª tentativa** ocorre no dreno da copy da requisição original (`COPY_BUDGET_MS`).
2. As **tentativas 2 e 3** e as **manuais** são **requisições explícitas** (o estado persistido dirige a UI a re-tentar após 5s/10s, ou o lojista clica), cada uma com **orçamento próprio de 30s**.
3. O **contador server-side de tentativas identificadas** é a fonte da verdade; requisições duplicadas/paralelas **não** criam tentativas extras.
4. **Sem continuidade** após fechar o navegador: o ciclo automático **para** e a retomada é **manual**. A UI **não promete** retomada automática.

*Direção:* **requisições separadas** pelo modelo de tentativas identificadas — **não** por afirmação sobre limites da plataforma (que permanecem **não verificados**).

### B2A-D4 — Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada

Direção de schema **fixada antes do planejamento** (sem questão aberta):

- Cada tentativa recebe **identidade**: `attempt_seq` (1..6) + `attempt_token`.
- `product_1_1_copy_state` passa a **uma linha por tentativa** (`campaign_id, operation_id, attempt_seq`); o **estado corrente** é a tentativa de maior `attempt_seq`.
- Terminal **por tentativa** e **entre tentativas**: `completed` em **qualquer** tentativa é **terminal para a entrega**; nunca é sobrescrito.
- `product_1_1_apply_copy_state`/`product_1_1_cancel_copy` passam a exigir `attempt_seq`+`attempt_token`; tentativa **superada** é **rejeitada** (`stale_attempt`) → proteção contra atraso.
- **Compatibilidade:** `readCopyState`/`readCopyDelivery` leem a linha de **maior `attempt_seq`** (tentativa única da b1b ≡ `attempt_seq = 1`); o contrato de envelope e o terminal protegido são preservados.

*Alternativa rejeitada (decisão fechada):* tabela append-only separada + projeção (custo maior sem ganho).

### B2A-D5 — Escopo restrito e segurança

A recuperação SHALL exigir **autenticação** e **ownership** da campanha/loja; sem ownership, é negada **sem** chamada de IA. A tentativa SHALL abranger **somente os textos** (`campaign_copy`), SHALL NOT regenerar/alterar a imagem, SHALL NOT consumir crédito adicional (débito inalterado) e SHALL registrar o **custo interno**.

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

## Migration Plan

1. Implementar identidade de tentativa/histórico/anti-duplicação e a política; typecheck/lint/build/testes locais.
2. Rodar testes de contrato, Postgres isolado e navegador (provider simulado); nenhuma chamada paga.
3. **Checkpoint humano** desta fatia; submeter B2.1 à revisão.

Rollback: desabilitar a ação/recuperação não afeta o core nem o legado.

## Open Questions

- **Limiares exatos de `transient × definitive`** — fechados na implementação, sem reduzir as garantias desta especificação.
- Nenhuma questão aberta de schema (direção fixada em B2A-D4).
