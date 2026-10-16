# Reconciliação — B2.2 (Recuperação de imagem, estorno e D13)

> Fatia **B2.2** da divisão aprovada da F56.2b2. Deriva da change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` (**substituída documentalmente; NÃO implementada**; movida para o histórico documental em `openspec/history/`). Matriz global em `openspec/history/fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1/SUPERSEDED.md`.

> **Rodada documental 2026-10-15 (esta):** realinhamento da base **existente** aos quatro pontos de precisão (A–D) exigidos **antes do planejamento GSD**. **Trabalho exclusivamente documental** — sem nova change, sem GSD, sem código/migration/ativação. Reaproveita os mecanismos existentes (sonda de arte tipada, claims de tentativa, marcador de outcome, resolução administrativa auditada) e **não** cria infraestrutura de execução durável. **B2.3** e **F56.3** permanecem **fora do escopo**.

## 1. Ponto de partida e estado

- **B2.1 / GSD `56.2.3`** concluída e **arquivada** em `openspec/changes/archive/2026-10-15-fase-56-2b2a-recuperacao-de-copy-produto-1-1/` (spec principal `product-1-1-copy-recovery` sincronizada; 46/46 tasks).
- Tracking reconciliado em **`025c3e11`**.
- Novo fluxo **INATIVO** (chaves `product_1_1_test_stores_enabled`/`product_1_1_all_stores_enabled` = `false`, autorização de stage `off`).
- **F56.2b1b** base contratual: operação de crédito `reserved → art_uploaded → delivered | refunded`; claim de tentativa atômico; marcador `product_1_1_generation_outcomes` (`unknown | failed`); sonda de arte **tipada**; resolução administrativa auditada `admin_resolve_product_1_1_pending`.
- **Uma fatia por vez.** B2.2 **não** redesenha copy (B2.1) nem antecipa autorização/teste real (B2.3).
- **Nenhum arquivo de `openspec/specs/**`, `archive/**`, código, migration ou `.opencode/**` é alterado por esta rodada.**

## 2. Diff conceitual do realinhamento (esta rodada)

| Dimensão | Base existente (antes) | Realinhada (esta rodada) |
| --- | --- | --- |
| **A. Predicado de falha final** | "`outcome='failed'` de operação **ou** estado persistido que prove que nenhuma tentativa adicional pode ser iniciada", com *"predicado exato fechado na implementação"* | Predicado **PF** exato, com **fonte de evidência por item**, cobertura explícita do **intervalo falha-do-principal → aquisição-do-fallback**, e **regra 4a aprovada** (marcador `failed` gravado no ponto de decisão terminal; **4b retirada**) |
| **B. Resolução autorizada / D13** | "admin/operador autorizado, motivo + evidência, append-only, idempotente" (genérico) | Quem/ção/motivo/evidência/auditoria **nomeados**, com **reuso explícito** de `admin_resolve_product_1_1_pending`; **bloqueio de novas aquisições** e **neutralização de resultados em voo** descritos; **sem** exigir encerramento externo do provider |
| **C. Experiência do lojista** | Mensagem exata + "devolver formulário preenchido" (sem detalhe) | **Quais dados** são restaurados (fonte server-side `input_snapshot`/`identitySnapshot`), **limitações** de imagem/referências (client-only), e feedback honesto **sem** confirmação do estorno |
| **D. Validação e gate D13** | "provas exigidas" + "evidência simulada não satisfaz o gate" (ambíguo) | Duas camadas: **(1) falhas raras por simulação controlada** × **(2) comprovação de efeitos reais em Postgres/Storage locais**; reconciliação do sentido de "evidência simulada"; **critérios objetivos** de "implementado e comprovado" × "bloqueia habilitação" |
| **UI-SPEC** | ausente | **Criado** `UI-SPEC.md` para o formulário restaurado, a mensagem aprovada e as ações — **aprovação humana PENDENTE** |
| **Nova infraestrutura** | — | **Nenhuma** fila/worker/cron/outbox/subsistema (proibido sem decisão explícita) |
| **Escopo / estimativa** | 5–7 planos | **Preservados** (5–7; teto 8–10) |

> **Nota (2026-10-16):** a linha **UI-SPEC** acima registra o estado da rodada documental de 2026-10-15. A **UI-SPEC foi aprovada** como **contrato pré-implementação** em 2026-10-15 (§9); a **validação da implementação** é checkpoint **posterior e distinto** (UAT `approved_with_limitations`). O estado implementado está no §11.

## 3. Precisões fechadas

> **Nota (2026-10-16):** as observações de **"código atual (inspecionado)"** nesta seção descrevem o estado **pré-implementação** (2026-10-15) e permanecem como **histórico**; onde dizem "hoje o orquestrador só grava `unknown`" / "hoje a RPC recusa `operation_in_progress` sempre", essas condições foram **superadas pela implementação** — ver §11.

### Precisão A — Reconhecimento de falha final (predicado server-side)

**Código atual (inspecionado):** `src/lib/product-1-1/orchestration/generation-orchestrator.ts`.

- O orquestrador grava `attempts.finish(status:'failed')` (linha ~1224) **antes** de decidir a próxima tentativa (`classifyImageGenerationFailure` + `nextImageGenerationAttempt`, linhas ~1231–1243). **Só** quando a política **não** produz próxima tentativa é que ele chama `settleConfirmedFailure` (linha ~1245), que estorna **in-process** quando a sonda confirma `absent`/`invalid`.
- `product_1_1_generation_outcomes` **já aceita** `outcome IN ('unknown','failed')` e a RPC `product_1_1_record_generation_outcome` **já aceita** `failed`; porém **hoje o orquestrador só grava `unknown`** (nunca `failed`).
- `product_1_1_acquire_attempt_start` recusa a próxima tentativa de forma **determinística e persistida** em: sem linha/terminal (`operation_terminal`), `unknown` persistido (`operation_unknown`), `art_uploaded` (`operation_art_uploaded`), qualquer `done` (`attempt_already_completed`), `attempt_number != total+1` (`out_of_sequence`), `total >= 3` / `primary >= 2` / `fallback` já usado (`attempt_limit_reached`), `primary_after_fallback`.
- Um claim `failed`, sozinho, **NÃO** prova finalidade: no **intervalo entre a falha do principal e a aquisição do fallback** o estado persistido é **idêntico** ao de "processo morreu após gravar `failed`" (último claim `failed`, nenhum `in_progress`, arte ausente). Sem uma prova persistida de finalidade, uma recuperação **não pode** distinguir esses casos.

**Predicado proposto de encerramento automático (PF)** — todos os itens exigidos, avaliados **server-side** sob a **trava C4** (mesma linha de crédito de `acquire`/resolução):

1. **Operação não terminal** (`reserved`/`art_uploaded`).
2. **Arte `absent` CONFIRMADA** pela sonda tipada (nunca `invalid`/`indeterminate`/erro → não é ausência).
3. **Nenhum claim `in_progress`** para a operação.
4. **Finalidade persistida (4a, regra única aprovada)** — linha `outcome='failed'` em `product_1_1_generation_outcomes`, **gravada com sucesso** no **ponto de decisão terminal** (quando a política não produz próxima tentativa), via a RPC existente `product_1_1_record_generation_outcome` (que **já aceita** `failed`).

**Regra fixada (aprovada 2026-10-15):** adota-se **somente (4a)**. A alternativa **(4b)** — exaustão estrutural por `attempt_number` máximo / recusas como `primary_after_fallback`/`attempt_already_completed`/`attempt_limit_reached` — foi **retirada**: **recusas isoladas NÃO comprovam, sozinhas, falha final da operação**.

**Cobertura do intervalo principal→fallback:** **nenhum** marcador `failed` existe até a decisão terminal; logo o intervalo **não satisfaz PF** ⇒ **não** há estorno automático durante retry/fallback pendente (Regra 3 / provas (f)/(g)).

**Preservação da saída quando o marcador não puder ser gravado:** se a gravação de `outcome='failed'` **falhar** (erro de escrita) **ou** já existir um `unknown` **imutável** (tabela imutável e única por operação), **não** se trata como sucesso automático **nem** se **sobrescreve** o marcador existente; a operação **permanece não terminal** e é encaminhada à **resolução autorizada e auditada** (Precisão B). **Nunca** se infere erro da ausência nem se força PF.

### Precisão B — Resolução autorizada do caso inconclusivo/D13

**Reuso do mecanismo existente `admin_resolve_product_1_1_pending`** (migration `20261009000002`, serviço `src/lib/product-1-1/pending/resolve-pending-operation.ts`, rota `src/app/api/admin/product-1-1-pending/route.ts`).

- **Quem autoriza:** administrador/operador **autorizado** (`requireAdmin` + `requireSameOrigin`; `actor_id` registrado). O **cliente/lojista apenas solicita** — nunca autoriza.
- **Ação executada:** `refund_once` (estorno único) para o caso inconclusivo; `deliver_existing_art` quando houver arte íntegra (sem regenerar).
- **Motivo/evidência:** `reason` **obrigatório**; evidência **server-derived** (`origin='server-derived'`, `art_kind ∈ {integral,absent,invalid,indeterminate}`, `execution_ended`). `refund_once` exige `art_kind='absent'`; `invalid`/`indeterminate` **bloqueiam**. **NÃO** se exige comprovar encerramento **externo** do provider.
- **Registro auditável:** `admin_audit_log.action='product_1_1_pending_resolution'`, `operation_id = resolution_operation_id` (**único global**), metadata (campanha/operação/ação/`art_kind`/status/motivo). Idempotente por `resolution_operation_id` (advisory lock + índice único); replay **equivalente** ⇒ idempotente; replay **divergente** ⇒ `operation_identity_conflict`; tudo na **mesma transação**.
- **Bloqueio de novas aquisições:** a resolução transita para **terminal** (`refunded`) sob a **trava C4**; o `acquire` do Plano 03 passa a recusar (`operation_terminal`) — nenhuma tentativa posterior é possível.
- **Neutralização de resultados de chamadas já iniciadas:** com a operação terminal, `product_1_1_record_generation_outcome` devolve `operation_terminal`; `product_1_1_deliver_campaign_credit_operation` só transita `art_uploaded → delivered` (recusa a partir de `refunded`); o `unknown` **não governa** terminal (precedência I2). Uma resposta/imagem atrasada **não** sobrescreve estado nem reabre cobrança.
- **Ponto de extensão necessário (exclusivo do caminho autorizado):** hoje a RPC **recusa** `operation_in_progress` **sempre** (sem fonte operacional de encerramento — D13). B2.2 deve permitir, **somente** no caminho **autorizado e auditado**, finalizar o claim **`in_progress` residual** como `abandoned` **na mesma transação sob a trava** — mantendo `invalid`/`indeterminate` bloqueando e **sem** exigir encerramento externo. Alteração **aditiva/condicional** da RPC existente.
- **Precisão (regra fixada):** **PF exige ausência de `in_progress`** ⇒ o **caminho automático NÃO abandona claim algum** e **não pode** autorizar abandonar um claim **ativo**. **Abandonar um claim `in_progress` pertence EXCLUSIVAMENTE ao caminho autorizado**, sob a trava, **com proteção contra o resultado atrasado** (claim já `abandoned` ⇒ `finish` recusa `invalid_transition`; `markArtUploaded`/`deliver` recusam a partir de `refunded`; estado terminal não é sobrescrito).

### Precisão C — Experiência do lojista

- **Mensagem exata** (somente após estorno **persistido e confirmado**):
  > "Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente."
- **Dados restaurados (fonte server-side):** o brief congelado persistido em `campaigns.input_snapshot` (produto, preço original/desconto, intenção, selo, validade, direção de fundo, texto obrigatório, oferta) + `identitySnapshot` (direção textual de identidade) + **seleções** de referência (`frozenContentReferences`). No cliente, reaproveita-se o rascunho em `sessionStorage` (`campaign_draft`, `campaign_draft_image`) **quando ainda existir**.
- **Limitações (não prometer o que não se sustenta):** o **arquivo de imagem do produto** e as **imagens de referência** **NÃO** são persistidos server-side (vivem apenas no cliente). Portanto: restaurar **os campos textuais/preenchidos** e **avisar** que a **imagem do produto** (e referências) pode precisar ser **re-adicionada**; **não** prometer restauração de imagem.
- **Sem confirmação do estorno:** feedback **honesto**, **sem** prometer crédito devolvido; reutiliza o estado de pendência já existente; a autorização de recuperação/gratuidade decorre do **estado server-side**, nunca do cliente.
- **Nova submissão** após estorno é **geração nova com cobrança normal**; o formulário restaurado é uma **nova submissão**, não a reabertura da operação estornada.

### Precisão D — Validação e gate D13

Separação de camadas de prova:

- **Camada 1 — falhas raras por simulação controlada (harness/fake):** força caminhos raros (falha de `storeArtifact`, sonda `indeterminate`, falha de gravação do marcador). Prova **controle de fluxo**. **Não** substitui a camada 2.
- **Camada 2 — comprovação de efeitos reais em Postgres/Storage locais (instância isolada e descartável):** prova, com efeitos observados, **estorno único**, **concorrência entrega×estorno**, **terminal protegido** (`delivered_not_refundable`), **resultado atrasado**, **formulário restaurado**, **encerramento pelo gatilho PF**, **encerramento autorizado/D13** e **impedimento de aquisição posterior** (`operation_terminal`).
- **Provider real/ativação** é reservado à **B2.3**; **não** se provoca falha rara em provider pago.

**Reconciliação de "evidência simulada não satisfaz o gate":** **simular a falha** (gatilho) **não** é o mesmo que **simular todos os efeitos da recuperação**. O gate exige **prova operacional dos efeitos** (Camada 2) em Postgres/Storage reais; a indução da falha rara por harness (Camada 1) é **permitida** para exercitar o controle de fluxo. O objeto do gate **não** é "provocar a falha num provider pago", mas "comprovar os **efeitos** da resolução".

**Critérios objetivos:**
- **"Implementado e comprovado"** ⇔ Camada 2 **PASS** em Postgres/Storage isolados **e** Camada 1 **PASS** para os caminhos raros.
- **Continua bloqueando habilitação:** (i) **teste com provider real / ativação** (B2.3); (ii) não depender de limites **não verificados** da plataforma.
- **D13 NÃO é declarado resolvido nesta rodada documental.**

## 4. Rastreabilidade (tarefa da agregadora → B2.2)

| Agregadora | B2.2 | Observação |
| --- | --- | --- |
| 1.1–1.4 (dependência/ambiente) | 1.1–1.4 | recorte de imagem |
| 3.1–3.20 (imagem/estorno/D13) | 2.1–2.4, 3.1–3.6, 4.1–4.8 | inclui gatilho de falha final (PF) e encerramento atômico |
| 4.4, 4.6–4.10 (testes de imagem) | 5.1, 5.7–5.11 | recorte de imagem |
| 5.1–5.5, 5.7–5.11 (provas) | 5.2–5.13 | provas em duas camadas (Precisão D) |
| 8.1–8.2, 8.4–8.5 (gate/rollback/validate) | 6.1–6.4 | gate D13 preservado |
| 8.6–8.7 (revisão/tracking) | 6.5–6.6 | sem GSD |

## 5. Decisões: fechadas × pendentes de aprovação

**Fechadas nesta rodada (não reabrir sem nova rodada):**

1. **Reuso** do marcador `generation_outcomes` e da resolução `admin_resolve_product_1_1_pending` (nada de subsistema novo).
2. **Necessário ≠ suficiente:** operação não terminal + arte ausente **não** bastam; consulta/reload na geração normal **não** estorna.
3. **Reuso da sonda tipada:** `invalid`/`indeterminate`/erro **nunca** colapsam em `absent`.
4. **Terminais:** `delivered` **nunca** estorna; `refunded` **não** volta a `delivered`; resultado atrasado não reabre.
5. **Atomicidade:** encerramento sob a **mesma trava C4**; aquisição posterior recusada (`operation_terminal`).
6. **Autorização:** cliente **apenas solicita**; administrador autoriza com **motivo + evidência** auditados.
7. **Mensagem exata** só após estorno **persistido e confirmado**.
8. **Provas em duas camadas** (Precisão D); **D13 não resolvido**; **gate preservado**.
9. **Nenhuma infraestrutura durável** (fila/worker/cron/outbox).
10. **Escopo/estimativa:** 5–7 planos (teto 8–10).

**A-1 — RESOLVIDA (aprovada 2026-10-15):** adotada **(4a)** como **regra única** — gravar `outcome='failed'` no ponto de decisão terminal, reusando a RPC/tabela existentes; **(4b) retirada** (recusas isoladas não comprovam falha final). Regra adicional: **se o marcador não puder ser gravado** (erro ou `unknown` imutável pré-existente), **não** há sucesso nem sobrescrita — encaminha à **resolução autorizada**.

**C-1 / B-1 — RESOLVIDAS (aprovadas 2026-10-15):** **abandonar um claim `in_progress`** pertence **exclusivamente** ao caminho **autorizado** (PF exige ausência de `in_progress` e não abandona claim), sob a trava e **com proteção contra o resultado atrasado**.

## 6. Fora de escopo / não duplicação

- **B2.1** detém a recuperação de **copy** e a independência copy×imagem; **a copy não será redesenhada** aqui.
- **B2.3** detém autorização estreita, validação local-primeiro (requisito de fluxo) e **teste com provider real**.
- A **F56.3** permanece fora (aprovação/reprovação/correção/contador/download de artes pendentes).

## 7. Resíduo documental do sign-off de segurança da B2.1 (sinalização separada)

> **Não corrigido silenciosamente nesta rodada.** Registrado apenas para rastreio.

A segurança da **B2.1** (`56.2.3-SECURITY.md`) está **`SECURED` com 0/69 ameaças abertas**, mas o **sign-off humano está PENDENTE** (registrado no tracking). Este resíduo é **da B2.1** e **não** é resolvido nem alterado por esta rodada documental. Sinalizado para decisão separada do responsável.

## 8. Estimativa e corte

- **Estimativa: 5–7 planos** (teto 8–10). Se exceder, **parar** e propor ajuste **sem** retirar segurança nem testes.
- **Sem prova desta rodada:** nenhuma migration é executada; nenhum provider pago; nenhuma ativação; nenhum `sync`/`archive`; nenhum GSD.

## 9. Checkpoint humano (aprovado)

**APROVADO em 2026-10-15, exclusivamente no escopo INATIVO.** O responsável aprovou a **base reconciliada** (precisões A–D; **A-1 = 4a** como regra única) e a **UI-SPEC** da B2.2 como **CONTRATO pré-implementação**. O checker da UI-SPEC aprovou com **0 BLOCK e 1 FLAG** (Dim 4 `Line Height`), **corrigido** — resultado original preservado em `UI-SPEC.md`.

- **O que esta aprovação cobre:** contrato/proposta/design/specs/tasks (todas as precisões) e o contrato de UI (pré-implementação).
- **O que ela NÃO cobre:** implementação, GSD, migration/`db push`, ativação, provider pago, **B2.3** e **F56.3**. A **validação do resultado implementado** é checkpoint **posterior e distinto** (UAT da B2.2).
- **Separado:** o sign-off de segurança pendente da **B2.1** (§7) permanece **fora** desta fatia.

## 10. Adendo de reconciliação de integração (2026-10-15) — cinco costuras

> **Natureza:** **coerência de implementação**, não mudança de escopo. Estas cinco costuras **não** criam novos requirements (seguem os **11** normativos), **não** criam novo REQ-ID e **não** declaram D13 resolvido. Elas fecham ligações entre componentes que o planejamento inicial tratava como isolados (mesma classe de problema da B2.1: peças verdes e uma ligação entre elas incompleta). Cada item mapeia uma decisão **já aprovada**.

### 10.1 — A resolução administrativa precisa ser ALCANÇÁVEL (B2B-D4)

Três bloqueios existentes impedem o caminho autorizado; devem ser alterados **exclusivamente** para ele, com confirmação e auditoria:

1. **Fast-path do serviço** `src/lib/product-1-1/pending/resolve-pending-operation.ts:~230-243`: hoje `state.processing` ⇒ `operation_in_progress` (e `!executionEnded` ⇒ `execution_not_ended`).
2. **RPC** `admin_resolve_product_1_1_pending` (`20261009000002:~230-257`): recusa `operation_in_progress` (linha ~240) **e** mantém `execution_not_ended` no ramo de estorno (linha ~257). Contornar apenas `operation_in_progress` **não basta**.
3. **Tela admin** `src/app/(app)/admin/product-1-1-pending/resolution-form.tsx:~262-270` (`resolvable = !item.processing && !item.terminal`) e o rótulo/estado (`~92`, `~412`, `~460`): hoje o suporte **não consegue acionar** a resolução de uma operação `processing`.

**Ajuste:** a ação autorizada (marca explícita `authorized_abandon`) é o gatilho — **nunca** `execution_ended` (que permanece apenas validaded quanto à forma; o valor autoritativo é derivado sob a trava). A alteração da tela é **funcional mínima** (habilitar a ação EXISTENTE sob a nova condição autorizada, com confirmação), **não** um redesenho; o contrato de UI da B2.2 (superfície do lojista, `UI-SPEC.md`) permanece inalterado.

### 10.2 — O marcador de falha final não cobre todos os caminhos (B2B-D3)

`src/lib/product-1-1/orchestration/generation-orchestrator.ts` chama `settleConfirmedFailure` em **três** pontos: `~1031` (`attempt_history_failed`), `~1145` (`artifact_store_failed`) e `~1245` (`generation_failed`, decidido após `nextImageGenerationAttempt`, quando a política **não** produz próxima tentativa). **Somente** o ponto de decisão terminal (`~1245`) grava `outcome='failed'`; os outros dois **permanecem inconclusivos** (PF exige marcador gravado) e seguem à **resolução autorizada**. Se `outcome='failed'` **já** estiver persistido e a sonda for inconclusiva (`invalid`/`indeterminate`), **não** sobrescrever o marcador **imutável** com `unknown`.

### 10.3 — Envelope único e contrato de interface (B2B-D3)

A RPC de encerramento local deve devolver um **envelope único** com **identidade** (`campaign_id`, `operation_id`, `action`, `status`, `success`, `idempotent`), espelhando `product_1_1_refund_campaign_credit_operation` (`20261008000002:~277-280`, `~303-305`) e a resolução auditada. A interface `ProductOneToOneCreditOps` (`generation-orchestrator.ts:~179-188`) ganha `closeFailedOperation(...)`; orquestrador, fakes e testes alinhados; a ordem das tarefas garante que o método exista **antes** do primeiro typecheck que o utiliza.

### 10.4 — Transporte e precedência do formulário restaurado (B2B-D9/D5)

O snapshot restaurado precisa chegar a `/campanhas/nova` por **transporte autenticado com ownership** (a página nova — `src/app/(app)/campanhas/nova/page.tsx` — hoje não recebe origem). A precedência de rascunho (`sessionStorage` `campaign_draft`/`campaign_draft_image`, hoje **chave global única** em `use-input-preservation.ts`/`use-campaign-form.ts`) deve ser **escopada à campanha correta**, sem restaurar rascunho de **outra** campanha. A restauração gera **novos** IDs de campanha/operação (nova submissão), **sem** reusar a operação estornada.

### 10.5 — Provas atravessando as costuras reais (B2B-D8)

A **Camada 2** deve provar pelos seams reais: **(a)** tela administrativa → serviço/RPC → **abandono + estorno**; **(b)** **orquestrador real** → **marcador** → **encerramento**; **(c)** **CTA** → **formulário preenchido** → **nova identidade de submissão**. Provider **simulado**; Postgres/Storage **locais**. Preservar um snapshot no banco **não** comprova que o clique na CTA restaura o formulário.

**Nenhum item acima altera os 11 requirements, o gate D13 (que permanece **NÃO resolvido**) ou o archive da b1b.**

## 11. Adendo de implementação (2026-10-16)

> **Natureza:** reconcilição **exclusivamente documental** do estado **implementado e comprovado** da B2.2 (GSD `56.2.4`, **10/10 planos**; checkpoint humano **`approved_with_limitations`**, escopo **INATIVO/local**). **Não** cria requirements, **não** altera o gate D13 (**NÃO resolvido**) e **não** executa lifecycle OpenSpec (`sync`/`archive`).

### 11.1 O que foi implementado e comprovado

- **Recuperação de arte (B2B-D1)** — `src/lib/product-1-1/artifact/artifact-recovery.ts`: `integral` ⇒ recupera e conclui a entrega sem regenerar (`confirm_existing_art`, sem novo upload); `invalid`/`indeterminate` ⇒ `unresolved` (nunca ausência); `absent` ⇒ devolvido (não fecha/estorna); terminais ⇒ `operation_terminal`.
- **PF + encerramento local (B2B-D3/D6)** — `supabase/migrations/20261015000001` (`product_1_1_close_failed_operation`, sob a trava C4) + `generation-orchestrator.ts` (marcador `outcome='failed'` **só** no ponto de decisão terminal, `:1384-1422`; `settleConfirmedFailure`, `:797-892`). **Retry/fallback pendente NÃO estorna.**
- **Resolução autorizada e auditada (B2B-D4)** — `pending/resolve-pending-operation.ts` + `20261015000002` (`authorized_abandon` condiciona **ambos** os `RAISE`; claim `in_progress` residual finalizado como `abandoned` **na mesma transação sob a trava**); tela admin com habilitação funcional mínima.
- **Estorno confirmado, formulário e mensagem (B2B-D5/D9)** — `src/components/flow/refunded-panel.tsx` (mensagem exata só com estorno **confirmado**; amber honesto sem confirmação); `display.ts`/`use-campaign-form.ts` (restauração server-side; imagem **nunca** prometida).
- **Neutralização de resultado atrasado (B2B-D6)** — `record_generation_outcome → operation_terminal`; `deliver` só `art_uploaded → delivered`; terminais não sobrescritos.

### 11.2 Protocolo final de publicação/token/epoch (recorte de integridade)

- **Estado por operação:** `publication_state ∈ {none, in_flight, published, failed_before_upload, result_unknown}` (separado do `status` do crédito), `publication_token`, `state_epoch`.
- **RPCs:** `begin_publication` (antes do upload, sob C4) / `abort_publication` (só `before_upload`) / `mark_result_unknown` / `confirm_existing_art` (recuperação sem novo upload) / `get_publication_epoch`.
- **Transições principais (caminho automático/ordinário):** `mark`/`deliver` exigem **token do dono**; `refund`/`close_failed_operation` exigem **`observed_epoch` fresco** (capturado **antes da sonda** — não "antes da recusa") e **bloqueiam `published`**; o **PF automático** fica bloqueado com publicação ativa (`in_flight`/`result_unknown`) ou publicada. **A exceção administrativa (11.3) NÃO depende de frescor de epoch.**
- **`result_unknown` bloqueia o encerramento, não a recuperação:** o resultado desconhecido preserva a proteção contra o **encerramento automático**, mas **não** impede a **recuperação** (sonda `integral` ⇒ confirmar e entregar o objeto existente **sem novo upload**). Objeto íntegro encontrado SHALL ser **entregue**.

### 11.3 Exceção administrativa auditada (estende B2B-D4)

`admin_resolve_product_1_1_pending` distingue: (i) **automático/PF bloqueado** com publicação ativa (`in_flight`/`result_unknown`) ou publicada; (ii) **administrativo excepcional** — **somente** via marca autorizada/auditada **`authorized_publication_closure`** (ao lado de `authorized_abandon`) — que **pode** encerrar um estado **genuinamente inconclusivo** tornando a operação **terminal**. **Não** é autorização genérica de estorno: exige **reconhecimento explícito, autorizado e auditado** do inconclusivo; **não** depende de frescor de epoch e **admite** resultado tardio **sem** reabrir `refunded`. **`published` nunca estorna** (nem por esta via); **não** se promete "arte íntegra sempre vence" no caminho inconclusivo. Autoridade **server-side**, nunca do cliente; `actor_id`/motivo/evidência auditados.

> **Mapeamento (REQ-IDs GSD, sem renumerar):** fence/token/epoch/`published` + exceção ⇒ **REQ-56.2.4-05/-06/-11**; recuperação sem novo upload ⇒ **REQ-56.2.4-10**; claim residual ⇒ **REQ-56.2.4-09**.

### 11.4 Migrations — LOCAL-ONLY, aplicadas SOMENTE no isolado

**Quatro** migrations B2.2 (apenas autoradas no repo; aplicadas **exclusivamente** em `vendeo-f562a-isolated`, nunca `db push`/`--linked`/remoto):

| Arquivo | Papel |
|---|---|
| `20261015000001_f56_2b2b_failure_closure.sql` | `product_1_1_close_failed_operation` (PF sob C4 + estorno idempotente) |
| `20261015000002_f56_2b2b_pending_abandon.sql` | `admin_resolve_product_1_1_pending` — abandono autorizado |
| `20261015000003_f56_2b2b_pending_read.sql` | Leitura de `outcome` persistido (`unknown`/`failed`) não terminal |
| `20261016000001_f56_2b2b_publication_fence.sql` | Fence de publicação (token/epoch) + recriação de transições |

### 11.5 Provas, limites e tracking

- **Provas (duas camadas):** Camada 1 (contrato/simulação) + **Camada 2** (efeitos reais em Postgres/Storage **locais**, provider **SIMULADO**) — efeitos (a)–(j) e seams (a)/(b)/(c), **0 skipped**; **nenhuma** chamada paga/ativação. Detalhe em `56.2.4-VERIFICATION.md`.
- **Checkpoint humano:** `approved_with_limitations` (2026-10-16, escopo INATIVO) — **inspeção visual adicional dos reparos NÃO realizada** (aceita a cobertura automatizada).
- **Lifecycle OpenSpec SEPARADO:** `sync`/`archive` **NÃO** executados; `openspec/specs/**` e archives intocados; change agregadora não sincronizada/arquivada. **B2.3/F56.3 NÃO antecipadas.**
- **Resíduo separado:** sign-off de segurança da **B2.1** permanece **PENDENTE** (§7), **sinalizado** — **não** aprovado nem encerrado aqui.
- **Tasks:** `tasks.md` reconciliado **individualmente** contra a evidência GSD (2026-10-16). **D13 NÃO resolvido.**
