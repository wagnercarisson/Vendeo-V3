# Tasks — F56.2b2 Copy recuperável, recuperação de imagem/estorno e teste controlado (reconciliada)

> **Checkpoint humano obrigatório antes da implementação.** Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. O teste real exige **autorização humana específica** e **teto de gasto**.

> **Dependência:** esta fatia depende da **F56.2b1b** (concluída/verificada/sincronizada/arquivada em 2026-10-12) e, transitivamente, da F56.2b1a e F56.2a.

> **Separação explícita (mapa dos grupos):** (A) **implementação** = grupos **1–3**; (B) **testes simulados locais** = grupo **4**; (C) **comprovação da recuperação** (provas) = grupo **5**; (D) **autorização estreita** = grupo **6**; (E) **checkpoint + teste real controlado** = grupo **7**; (F) **gate/sequenciamento/checkpoint final** = grupo **8**. **D13 NÃO é declarado resolvido** nesta fatia até a comprovação; o gate permanece.

> **Corte proposto (a aprovar — NÃO iniciar três fases GSD automaticamente):** B2.1 (copy) → B2.2 (imagem/estorno/D13) → B2.3 (autorização + teste real). Fronteiras, dependências e **aceite independente** de cada fatia estão na tabela de `proposal.md`. Cada fatia entra no GSD com **planejamento próprio** e só começa após aprovação.

> **Tamanho estimado (antes do GSD):** **12–16 planos** se executada como fase única — **acima** do limite de 8–10. Sequenciamento proposto: **B2.1** recuperação de copy; **B2.2** recuperação de imagem/estorno/D13; **B2.3** autorização estreita + teste real controlado. Checkpoint humano entre as fatias.

## 1. Reconciliação, dependência e ambiente

- [ ] 1.1 Confirmar por escrito a dependência da F56.2b1b e o mapeamento a/b1a/b1b/b2
- [ ] 1.2 Confirmar que a b1b está arquivada, que o deploy é apenas preview e que o novo fluxo permanece inativo (chaves `false`, autorização `off`)
- [ ] 1.3 Confirmar que os archives/evidências históricas permanecem intocados e que o archive da b1b não será reescrito
- [ ] 1.4 Confirmar a instância Supabase/Docker isolada e registrar sua identidade (lojas de teste; provider simulado)

## 2. Recuperação de copy — política e identidade de tentativa

- [ ] 2.1 Confirmar a implementação atual: `COPY_BUDGET_MS = 30s`; `completed`/`failed` terminais protegidos; sem reabertura/sobrescrita de terminal
- [ ] 2.2 Implementar identidade de tentativa (`attempt_seq` + `attempt_token`) preservando histórico e sem reabrir/sobrescrever linha terminal
- [ ] 2.3 Implementar a política: 1ª até 30s; falha transitória → espera 5s → 2ª até 30s; nova falha transitória → espera 10s → 3ª até 30s
- [ ] 2.4 Após as três falhas automáticas, ofertar **ação manual + suporte**
- [ ] 2.5 Limitar a **3 tentativas manuais** (6 no total por entrega); cada clique inicia **uma** tentativa e não reinicia o ciclo automático
- [ ] 2.6 Encerrar as tentativas no sucesso; não repetir cegamente falhas **definitivas** (configuração/permissão)
- [ ] 2.7 Garantir anti-duplicação: clique duplo, reload e reenvio não duplicam chamadas nem reiniciam contadores
- [ ] 2.8 Preservar o histórico por tentativa (sequência reconstruível) e rejeitar conclusão **atrasada** de tentativa superada (`stale_attempt`)
- [ ] 2.9 Contabilizar chamadas técnicas/fallback no limite (sem tentativas escondidas)
- [ ] 2.10 Garantir que a recuperação tenta **somente os textos** (`campaign_copy`), não regenera/altera a imagem e mantém a imagem `delivered` acessível
- [ ] 2.11 Garantir que **nenhum crédito adicional** é consumido e que o **custo interno** é registrado
- [ ] 2.12 Exigir autenticação e verificação de **ownership**; negar sem chamada de IA
- [ ] 2.13 Exibir a ação manual condicional conforme `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode) e `openspec/design-system/pages/campaign-preview.md`

## 3. Recuperação de imagem, estorno e reconciliação de D13

- [ ] 3.1 Consultar o **Storage privado** pela sonda tipada existente (`integral | absent | invalid | indeterminate`), sem colapsar erro com ausência
- [ ] 3.2 **Arte íntegra** → recuperar e concluir a entrega **sem regenerar**
- [ ] 3.3 **Ausência confirmada + falha reconhecida pelo servidor** → **encerramento local** com **estorno único**, encerrar como `refunded` (sem depender de encerramento externo do provider)
- [ ] 3.4 Exibir a mensagem exata **somente após o estorno persistido confirmado**; se não confirmado, não anunciar crédito
- [ ] 3.5 Devolver o **formulário preenchido** com os dados preservados
- [ ] 3.6 **Erro/indisponibilidade** → reverificar e dar **feedback honesto** (sem estorno, sem anúncio de crédito)
- [ ] 3.7 Garantir que **`delivered` nunca é estornado**
- [ ] 3.8 Tratar a **corrida entrega × estorno** (arte/`delivered` comprovada vence; estorno só sem arte)
- [ ] 3.9 Garantir **estorno idempotente** por `campaignId + operation_id`
- [ ] 3.10 Isolar **resultado atrasado** de operação `refunded`: não reabre cobrança, não sobrescreve, não libera a nova campanha
- [ ] 3.11 Garantir que a **nova submissão** é geração nova, com cobrança normal
- [ ] 3.12 Garantir que a autorização de recuperação/gratuidade vem do **estado server-side**, nunca do cliente
- [ ] 3.13 Registrar internamente falhas, tentativas, correlação e custos; não apresentar geração extra cobrada ao lojista
- [ ] 3.14 Documentar a **estratégia substituta de D13** sem declarar D13 resolvido
- [ ] 3.15 Definir o **gatilho server-side** de encerramento local: **falha FINAL para a operação, sem retry/fallback pendente** (`outcome = 'failed'` de operação ou nenhuma tentativa adicional possível); **nenhum** claim `in_progress`; arte `absent` confirmada — **sem** exigir marcador `generation_outcomes` pré-salvo
- [ ] 3.16 Garantir que **geração normal** (claim `in_progress`) **não encerra nem estorna**; consulta/reload durante a geração não autoriza estorno
- [ ] 3.17 Garantir que **`failed` de tentativa com retry/fallback pendente NÃO estorna** (o orquestrador grava `failed` antes de decidir a próxima tentativa)
- [ ] 3.18 **Sem sinal de finalidade** (nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente ou finalidade não provável) → **encerramento local explicitamente autorizado e auditado** (motivo + evidência); o cliente **não** autoriza sozinho
- [ ] 3.19 Garantir que o encerramento (automático ou autorizado) ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** tentativa posterior (`operation_terminal`)
- [ ] 3.20 Limitar a recuperação **financeira** a operações **não terminais**; `refunded` **não** retorna a `delivered` mesmo com imagem atrasada

## 4. Testes simulados locais (local-primeiro)

- [ ] 4.1 Rodar no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**; nenhuma chamada paga
- [ ] 4.2 Cobrir pelo navegador: formulário, geração, estados, persistência, copy, recuperação, créditos e download
- [ ] 4.3 Cobrir a política de copy: 30s/5s/10s, teto de 6, clique duplo/reload/reenvio, terminal não sobrescrito, `stale_attempt`, falha definitiva
- [ ] 4.4 Cobrir a recuperação de imagem: `integral`, `absent`, `invalid`/`indeterminate`, sem regeneração
- [ ] 4.5 Cobrir a **independência copy × imagem**: recuperação de copy com a imagem já `delivered`
- [ ] 4.6 Cobrir **geração normal sem arte** (claim `in_progress`): consulta/reload **não** estorna
- [ ] 4.7 Cobrir **principal falhou, fallback ainda será iniciado** → recuperação **não** estorna
- [ ] 4.8 Cobrir **falha final sem marcador prévio** (finalidade provável server-side) → encerra e estorna **uma vez**
- [ ] 4.9 Cobrir **sem sinal de finalidade** → exige **encerramento local autorizado e auditado**; cliente sozinho não estorna
- [ ] 4.10 Cobrir que o **encerramento impede atomicamente** tentativa posterior
- [ ] 4.11 Rodar typecheck, lint, build e suíte local (nenhuma chamada paga)

## 5. Comprovação da recuperação (provas exigidas)

- [ ] 5.1 Provar a **corrida entrega × estorno**
- [ ] 5.2 Provar o **estorno idempotente**
- [ ] 5.3 Provar o tratamento de **resultado atrasado**
- [ ] 5.4 Provar o comportamento sob **falha de Storage/banco**
- [ ] 5.5 Provar o **formulário restaurado** com dados preservados
- [ ] 5.6 Provar a **independência copy × imagem** (recuperação de copy com imagem `delivered`)
- [ ] 5.7 Provar **geração normal sem arte (claim `in_progress`) → consulta/reload NÃO estorna**
- [ ] 5.8 Provar **principal falhou, fallback ainda será iniciado → recuperação NÃO estorna**
- [ ] 5.9 Provar **falha final sem marcador prévio** → **encerra e estorna uma vez**, decisão **server-side**
- [ ] 5.10 Provar **sem sinal de finalidade → exige encerramento local explicitamente autorizado e auditado** (cliente não autoriza sozinho)
- [ ] 5.11 Provar que o **encerramento impede atomicamente** tentativa posterior (`operation_terminal`)
- [ ] 5.12 Registrar evidências; **não** declarar D13 resolvido com base em evidência simulada

## 6. Autorização temporária estreita (recorte de teste real)

- [ ] 6.1 Especificar/implementar a autorização restrita a **instância e lojas autorizadas**
- [ ] 6.2 Implementar **expiração**
- [ ] 6.3 Implementar **auditoria** (concessor, motivo, `operation_id`, escopo, instância)
- [ ] 6.4 Implementar **revogação**
- [ ] 6.5 Revalidar a decisão **server-side** a cada uso; nunca a partir do cliente
- [ ] 6.6 Preservar a **barreira global** (não remover a recusa de estágios habilitadores de escopo geral)
- [ ] 6.7 Cobrir com testes negativos: escopo geral continua recusado; recorte autorizado é o único permitido

## 7. Checkpoint humano e teste real controlado

- [ ] 7.1 **Checkpoint humano**: obter autorização humana específica e definir o **teto de gasto**
- [ ] 7.2 Executar o **teste real controlado local** apenas no recorte autorizado
- [ ] 7.3 Registrar evidências do teste real; sem deploy, sem migration remota, sem habilitação de lojas
- [ ] 7.4 Avaliar preview restrito (opcional/posterior) **somente** com configuração isolada de dados/credenciais

## 8. Gate D13, sequenciamento e checkpoint final

- [ ] 8.1 Manter o **gate bloqueante** de piloto/habilitação até a **implementação e comprovação** da estratégia substituta (recuperação + **encerramento local com estorno confirmado**) — **não** até resolver a antiga exigência de encerramento externo
- [ ] 8.2 Confirmar que **evidência simulada não satisfaz** o gate
- [ ] 8.3 Registrar a estimativa de tamanho (12–16 planos) e o **corte proposto** B2.1/B2.2/B2.3 (com fronteiras, dependências e aceite independente; **a aprovar**, sem iniciar três fases GSD automaticamente)
- [ ] 8.4 Separar o fechamento local de migration remota, deploy e abertura geral (rollback de deploy não desfaz banco/ledger)
- [ ] 8.5 Rodar `openspec validate --strict` e `git diff --check`; registrar a verificação
- [ ] 8.6 Submeter a F56.2b2 à **revisão humana**; confirmar que a **F56.3** não foi antecipada
- [ ] 8.7 Atualizar o tracking com o resultado, **sem iniciar GSD**
