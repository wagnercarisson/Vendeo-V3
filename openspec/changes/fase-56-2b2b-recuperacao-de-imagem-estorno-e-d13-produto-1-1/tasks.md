# Tasks — B2.2 Recuperação de imagem, estorno e D13 (Produto 1:1)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. Esta fatia **não** implementa copy (B2.1) nem autorização/teste real (B2.3).

> **Dependência:** **F56.2b1b** (arquivada em 2026-10-12) e **B2.1** (dependência **não funcional**; harness reutilizável). Deriva da change agregadora substituída (`RECONCILIATION.md`).

> **D13 NÃO é declarado resolvido** nesta fatia até a comprovação; o **gate bloqueante** permanece. **Evidência simulada não satisfaz** o gate.

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
- [ ] 3.2 Definir o **gatilho server-side** de encerramento local: **falha FINAL para a operação, sem retry/fallback pendente** (`outcome = 'failed'` de operação ou nenhuma tentativa adicional possível); **nenhum** claim `in_progress`; arte `absent` confirmada — **sem** exigir marcador `generation_outcomes` pré-salvo
- [ ] 3.3 Garantir que **`failed` de tentativa com retry/fallback pendente NÃO estorna** (o orquestrador grava `failed` antes de decidir a próxima tentativa)
- [ ] 3.4 **Sem sinal de finalidade** (nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente ou finalidade não provável) → **encerramento local explicitamente autorizado e auditado** (motivo + evidência); o cliente **não** autoriza sozinho
- [ ] 3.5 Garantir que o encerramento (automático ou autorizado) ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** tentativa posterior (`operation_terminal`)

## 4. Estorno confirmado, formulário e mensagem

- [ ] 4.1 **Ausência confirmada + gatilho** → **estorno único**, encerrar como `refunded`
- [ ] 4.2 Garantir **estorno idempotente** por `campaignId + operation_id` e **corrida entrega × estorno** (arte/`delivered` vence; estorno só sem arte)
- [ ] 4.3 Exibir a mensagem exata **somente após o estorno persistido confirmado**; se não confirmado, não anunciar crédito
- [ ] 4.4 Devolver o **formulário preenchido** com os dados preservados
- [ ] 4.5 Garantir que **`delivered` nunca é estornado** e que **`refunded` não retorna a `delivered`** (imagem atrasada não reabre)
- [ ] 4.6 Isolar **resultado atrasado** de `refunded`: não reabre cobrança, não sobrescreve, não libera a nova campanha; nova submissão é geração nova com cobrança normal
- [ ] 4.7 Garantir que a autorização de recuperação/gratuidade vem do **estado server-side**, nunca do cliente
- [ ] 4.8 Registrar internamente falhas, tentativas, correlação e custos; não apresentar geração extra cobrada ao lojista

## 5. Testes e provas exigidas

- [ ] 5.1 Rodar no **ambiente isolado** com **provider simulado**; nenhuma chamada paga
- [ ] 5.2 Provar a **corrida entrega × estorno**
- [ ] 5.3 Provar o **estorno idempotente**
- [ ] 5.4 Provar o tratamento de **resultado atrasado**
- [ ] 5.5 Provar o comportamento sob **falha de Storage/banco**
- [ ] 5.6 Provar o **formulário restaurado** com dados preservados
- [ ] 5.7 Provar **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna**
- [ ] 5.8 Provar **principal falhou, fallback ainda será iniciado → recuperação NÃO estorna**
- [ ] 5.9 Provar **falha final sem marcador prévio** → **encerra e estorna uma vez**, decisão **server-side**
- [ ] 5.10 Provar **sem sinal de finalidade → exige encerramento local explicitamente autorizado e auditado**
- [ ] 5.11 Provar que o **encerramento impede atomicamente** tentativa posterior (`operation_terminal`)
- [ ] 5.12 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)

## 6. Gate D13 e checkpoint final

- [ ] 6.1 Manter o **gate bloqueante** até a **implementação e comprovação** da estratégia — **não** até resolver a antiga exigência de encerramento externo
- [ ] 6.2 Confirmar que **evidência simulada não satisfaz** o gate e **não** declarar D13 resolvido
- [ ] 6.3 Separar o fechamento local de migration remota, deploy e habilitação (rollback de deploy não desfaz banco/ledger)
- [ ] 6.4 Rodar `openspec validate --strict` desta change e `git diff --check`
- [ ] 6.5 Submeter a B2.2 à **revisão humana**; confirmar que B2.3 e a F56.3 não foram antecipadas
- [ ] 6.6 Registrar o resultado sem iniciar GSD
