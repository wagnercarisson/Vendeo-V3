# Tasks — B2.2 Recuperação de imagem, estorno e D13 (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. Esta fatia **não** implementa copy (B2.1) nem autorização/teste real (B2.3).

> **Dependência:** **F56.2b1b** (arquivada em 2026-10-12) e **B2.1** (dependência **não funcional**; harness reutilizável). Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **D13 NÃO é declarado resolvido** nesta fatia até a comprovação; o **gate bloqueante** permanece. **Simular a falha (Camada 1) não substitui comprovar os efeitos (Camada 2).**

> **Precisões fechadas nesta rodada documental (2026-10-15):** predicado **PF** com **(4a) aprovada como regra única** (**4b retirada**) (A), resolução autorizada com **reuso** da RPC existente e **abandono de claim exclusivo desse caminho** (B), **formulário restaurado com limites** (C) e **provas em duas camadas** (D). **UI-SPEC** criado com aprovação **pendente**.

> **Tamanho estimado:** **5–7 planos**. Se exceder 8–10, **parar** e propor ajuste sem retirar segurança/testes.

## 1. Preparação, dependência e ambiente

- [ ] 1.1 Confirmar por escrito a dependência da F56.2b1b e de B2.1 (não funcional) e o recorte B2.2 (imagem/estorno/D13)
- [ ] 1.2 Confirmar que o novo fluxo permanece inativo (chaves `false`, autorização `off`) e que a b1b está arquivada
- [ ] 1.3 Confirmar a instância Supabase/Docker isolada e registrar sua identidade (provider simulado)
- [ ] 1.4 Confirmar que archives/specs principais permanecem intocados e que a agregadora **não** é sincronizada/arquivada

## 2. Recuperação de arte (sem regenerar)

- [ ] 2.1 Consultar o **Storage privado** pela sonda tipada existente (`integral | absent | invalid | indeterminate`), sem colapsar erro com ausência
- [ ] 2.2 **Arte íntegra** → recuperar e concluir a entrega **sem regenerar**
- [ ] 2.3 Limitar a recuperação **financeira** a operações **não terminais** (`reserved`/`art_uploaded`)
- [ ] 2.4 **Erro/indisponibilidade** → reverificar e dar **feedback honesto** (sem estorno, sem anúncio de crédito)

## 3. Gatilho de falha final e encerramento local

- [ ] 3.1 Garantir que **operação não terminal + arte ausente** são **necessárias, mas NÃO suficientes**; **consulta/reload durante a geração normal NÃO estorna**
- [ ] 3.2 Definir o **predicado PF** de encerramento local (fechado, `design.md` B2B-D3): operação **não terminal** **E** arte `absent` **confirmada** **E** **nenhum** claim `in_progress` **E** **finalidade persistida (4a)** — `outcome='failed'` **gravado com sucesso** no **ponto de decisão terminal** (RPC existente `product_1_1_record_generation_outcome`, que já aceita `failed`) — avaliado **sob a trava C4**; **(4b) retirada** (recusas isoladas **não** comprovam falha final); **sem** exigir marcador `generation_outcomes` **pré-salvo**
- [ ] 3.3 Garantir que **`failed` de tentativa com retry/fallback pendente NÃO estorna**: a **janela principal→fallback** (após `finish('failed')`, antes da próxima aquisição) **não** satisfaz PF (nenhum marcador `failed` existe antes da decisão); o orquestrador grava `failed` antes de decidir a próxima tentativa
- [ ] 3.4 **Sem sinal de finalidade** (nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente ou finalidade não provável) → **encerramento local explicitamente autorizado e auditado** — **reusar** `admin_resolve_product_1_1_pending` (administrador autorizado; ação `refund_once`; motivo + evidência server-derived; `invalid`/`indeterminate` bloqueiam; **sem** exigir encerramento externo do provider); o cliente **não** autoriza sozinho
- [ ] 3.5 Garantir que o encerramento (automático ou autorizado) ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** tentativa posterior (`operation_terminal`); **estender** a RPC existente **somente no caminho autorizado** para finalizar o claim **`in_progress` residual** como `abandoned` na **mesma transação sob a trava**; **PF NÃO abandona claim** (exige ausência de `in_progress`)
- [ ] 3.6 **Preservar a saída quando o marcador não puder ser gravado:** falha de escrita de `outcome='failed'` **ou** `unknown` imutável pré-existente ⇒ **não** tratar como sucesso nem **sobrescrever**; permanecer não terminal e encaminhar à **resolução autorizada** (3.4)
- [ ] 3.7 **Neutralizar resultados de chamadas já iniciadas:** com a operação terminal, `recordOperationOutcome` → `operation_terminal`; `deliver` só transita `art_uploaded → delivered`; `unknown` não governa terminal (I2); no abandono autorizado de claim ativo, `finish` recusa `invalid_transition` e o estado terminal não é sobrescrito

## 4. Estorno confirmado, formulário e mensagem

- [ ] 4.1 **Ausência confirmada + gatilho** → **estorno único**, encerrar como `refunded`
- [ ] 4.2 Garantir **estorno idempotente** por `campaignId + operation_id` e **corrida entrega × estorno** (arte/`delivered` vence; estorno só sem arte)
- [ ] 4.3 Exibir a mensagem exata **somente após o estorno persistido confirmado**; se não confirmado, não anunciar crédito
- [ ] 4.4 Devolver o **formulário preenchido** com os dados preservados (fonte server-side `input_snapshot`/`identitySnapshot`/`frozenContentReferences`); **não** prometer restauração de **imagem**/referências (client-only) — restaurar campos e **avisar** que a imagem do produto pode precisar ser re-adicionada
- [ ] 4.5 Garantir que **`delivered` nunca é estornado** e que **`refunded` não retorna a `delivered`** (imagem atrasada não reabre)
- [ ] 4.6 Isolar **resultado atrasado** de `refunded`: não reabre cobrança, não sobrescreve, não libera a nova campanha; nova submissão é geração nova com cobrança normal
- [ ] 4.7 Garantir que a autorização de recuperação/gratuidade vem do **estado server-side**, nunca do cliente
- [ ] 4.8 Registrar internamente falhas, tentativas, correlação e custos; não apresentar geração extra cobrada ao lojista

## 5. Testes e provas exigidas (duas camadas — Precisão D)

> **Camada 1:** falhas raras por **simulação controlada** (harness/fake) — prova **controle de fluxo**; **não** substitui a Camada 2.
> **Camada 2:** **efeitos reais** comprovados em **Postgres/Storage locais** (instância isolada e descartável). **Nenhum** provider pago.

- [ ] 5.1 Rodar no **ambiente isolado** com **provider simulado**; nenhuma chamada paga
- [ ] 5.2 Provar a **corrida entrega × estorno** (Camada 2)
- [ ] 5.3 Provar o **estorno idempotente** (Camada 2)
- [ ] 5.4 Provar o tratamento de **resultado atrasado** (Camada 2)
- [ ] 5.5 Provar o comportamento sob **falha de Storage/banco** (Camada 1 exercita o caminho; Camada 2 observa os efeitos)
- [ ] 5.6 Provar o **formulário restaurado** com dados preservados (Camada 2)
- [ ] 5.7 Provar **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna** (Camada 2)
- [ ] 5.8 Provar **principal falhou, fallback ainda será iniciado → recuperação NÃO estorna** (janela principal→fallback; Camada 2)
- [ ] 5.9 Provar **falha final (PF) → encerra e estorna uma vez**, decisão **server-side** (Camada 2)
- [ ] 5.10 Provar **sem sinal de finalidade → exige encerramento local explicitamente autorizado e auditado** (Camada 2)
- [ ] 5.11 Provar que o **encerramento impede atomicamente** tentativa posterior (`operation_terminal`) (Camada 2)
- [ ] 5.12 Rodar **Camada 1** (harness/fake) para as **falhas raras** (falha de `storeArtifact`, sonda `indeterminate`, falha de gravação do marcador)
- [ ] 5.13 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)

## 6. Gate D13 e checkpoint final

- [ ] 6.1 Manter o **gate bloqueante** até a **implementação e comprovação** da estratégia — **não** até resolver a antiga exigência de encerramento externo
- [ ] 6.2 Confirmar a reconciliação: **simular a falha** (Camada 1) **não** substitui **comprovar os efeitos** (Camada 2); **não** declarar D13 resolvido
- [ ] 6.3 Separar o fechamento local de migration remota, deploy e habilitação (rollback de deploy não desfaz banco/ledger)
- [ ] 6.4 Rodar `openspec validate --strict` desta change e `git diff --check`
- [ ] 6.5 Submeter a B2.2 à **revisão humana**; confirmar que B2.3 e a F56.3 não foram antecipadas
- [ ] 6.6 Registrar o resultado sem iniciar GSD
- [ ] 6.7 Registrar que a **decisão A-1 está RESOLVIDA**: **(4a) aprovada como regra única**; **(4b) retirada**; **abandono de claim `in_progress` exclusivo do caminho autorizado**
- [ ] 6.8 Submeter o **UI-SPEC** (formulário restaurado, mensagem, ações) à **aprovação humana** (pendente)
- [ ] 6.9 Sinalizar **separadamente** o **sign-off de segurança PENDENTE da B2.1** (não corrigir silenciosamente)
