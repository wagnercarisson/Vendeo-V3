## Why

A **F56.2b1b** foi concluída, verificada, sincronizada e arquivada em **2026-10-12**; o novo fluxo Produto 1:1 permanece **INATIVO** (chaves `false`, autorização `off`) e o deploy existe apenas em **preview**. A quick **`261013-hxm`** corrigiu as 18 falhas herdadas, o **ambiente isolado foi recuperado** e o **build + 54 testes reais** passaram. Os archives e as evidências históricas permanecem intocados.

A **F56.2b2** continua sendo a fatia da **recuperação de copy**, da **recuperação de imagem/estorno** e do **teste controlado** — mas a especificação original (um botão único de retry + piloto) **não cobre** as decisões agora aprovadas: recuperação de copy como **falha de entrega** (não qualidade editorial), **tentativas identificadas** com histórico e proteção contra conclusão atrasada, **reconciliação de D13** com **estorno idempotente comprovado**, validação **local-primeiro** e uma **autorização temporária estreita** para teste real isolado. Esta reconciliação **atualiza a change existente**; nenhuma change nova é criada.

## What Changes

- **Recuperação de copy é falha de entrega, não qualidade editorial.** Copy **entregue encerra** a recuperação; texto mal elaborado pode ser **editado pelo lojista** e **não autoriza nova geração**. Política: 1ª tentativa até 30s; falha transitória → espera 5s → 2ª até 30s; nova falha transitória → espera 10s → 3ª até 30s; após as três, ofertar **ação manual + suporte**. Máximo de **3 tentativas manuais adicionais (6 no total por entrega)**; cada clique manual inicia **somente uma** tentativa e **não reinicia** o ciclo automático. Cliques duplicados/reload/reenvio **não duplicam chamadas nem reiniciam contadores**. Chamadas técnicas/fallback são **contabilizadas no limite** (sem tentativas escondidas). **Sem crédito adicional** ao lojista (custo registrado **internamente**). **Não** regenera nem modifica a imagem; a imagem `delivered` permanece acessível durante a recuperação da copy. Falhas **definitivas** de configuração/permissão **não** recebem repetição cega.
- **Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada.** A implementação atual (`COPY_BUDGET_MS = 30s`; `completed`/`failed` **terminais protegidos**) **não** será reaberta/sobrescrita: a recuperação usa **identidade de tentativa** (sequência + token), **histórico preservado** e **rejeição de conclusão atrasada** de tentativa superada, com a **menor mudança necessária**. A política roda **dentro do ciclo de execução** já escolhido pela b1b (execução na requisição, sem fila/worker/cron) e **não pressupõe continuidade** após fechar o navegador.
- **Recuperação de imagem e reconciliação de D13.** Buscar a arte no **Storage privado**: arte **íntegra existente** → recuperar e **concluir a entrega sem regenerar**; **falha sem imagem após ausência confirmada e falha reconhecida pelo servidor** → **encerrar a operação LOCALMENTE com estorno confirmado uma única vez**, encerrar como `refunded` e **devolver o formulário preenchido com os dados preservados**. **Não** se depende de comprovar que o provider encerrou — o encerramento é **local**, ancorado no estado persistido do servidor. Somente **após confirmar o estorno persistido**, exibir exatamente: **“Não conseguimos concluir a comunicação desta geração. Seus dados foram preservados e o crédito foi estornado. Você pode gerar novamente.”** A nova submissão é uma **geração nova, com cobrança normal**. Se o estorno **não puder ser confirmado**, **não** anunciar crédito devolvido. **Erro/indisponibilidade ao consultar o Storage não é ausência confirmada**: reverificar e dar **feedback honesto**. Uma resposta/imagem **atrasada** de operação `refunded` **não** pode reabrir cobrança, sobrescrever estado ou liberar a nova campanha. A autorização de **recuperação/gratuidade** vem do **estado server-side**, nunca de alegação do cliente. **Não** estornar operação `delivered`. **D13 não é declarado resolvido** antes de implementar/comprovar a estratégia; o **gate bloqueante** de piloto/habilitação é **preservado** até essa comprovação — **não** até resolver a antiga exigência de encerramento externo. O **archive da b1b não é reescrito**.
- **Validação local-primeiro.** Testes no navegador no **ambiente Docker/Supabase isolado**, com **lojas de teste** e **provider simulado**, cobrindo formulário, geração, estados, persistência, copy, recuperação, créditos e download. **Depois**, teste **real controlado local** com **autorização humana específica** e **teto de gasto**. Preview restrito é **opcional e posterior**, exigindo configuração **isolada de dados/credenciais** (não apenas restrição de URL). Produção/main, migrations remotas e habilitação de lojas são **decisões posteriores e separadas**; **rollback de deploy não desfaz automaticamente** banco/ledger.
- **Autorização e fronteiras.** O mecanismo atual **recusa estágios habilitadores**: especificar uma **autorização temporária ESTREITA** para teste real isolado (instância e lojas autorizadas, **expiração**, **auditoria** e **revogação**), **sem remover a barreira global**. A **F56.3** continua responsável por aprovação/reprovação/correção da arte.

**BREAKING:** nenhuma. O núcleo da b1b é preservado; as mudanças são aditivas ou substituem explicitamente o tratamento anterior de D13 (que permanece **documentado como não resolvido**).

## Capabilities

### New Capabilities

- `product-1-1-controlled-real-test-authorization`: autorização **temporária estreita** para o **teste real isolado** (instância e lojas autorizadas, expiração, auditoria, revogação), **sem** remover a barreira global que hoje recusa estágios habilitadores.

### Modified Capabilities

- `product-1-1-copy-recovery`: substitui o "retry único/genérico" pela **política de recuperação como falha de entrega**, com tentativas identificadas, histórico preservado, proteção contra conclusão atrasada, anti-duplicação, falhas definitivas sem repetição cega e custo interno contabilizado no limite.
- `product-1-1-artifact-delivery`: acrescenta a **recuperação da arte no Storage privado** (íntegra → concluir sem regenerar) e remove a promessa de "nenhuma recuperação" quando há arte íntegra recuperável.
- `product-1-1-campaign-credit-billing`: acrescenta o **estorno único por ausência confirmada + falha reconhecida pelo servidor** (com **encerramento local**, sem depender de encerramento externo), o **estorno idempotente**, a **não-estorno de `delivered`** e o **isolamento de resultado atrasado** de operação `refunded`.
- `product-1-1-generation-orchestration`: substitui o tratamento de **D13** (claim residual permanentemente bloqueado) pela **estratégia substituta de recuperação + estorno confirmado**, mantendo o **gate bloqueante** até a comprovação e sem reescrever o archive da b1b.
- `product-1-1-flow-activation`: define a validação **local-primeiro**, o **teste real isolado** sob autorização humana/teto e a **não-remoção da barreira global**; habilitação de lojas de teste só após validação.

## Critérios de Aceite Verificáveis

1. A recuperação de copy só é oferecida quando a copy está **pendente/falha**; copy **entregue encerra** as tentativas, e texto entregue (mesmo ruim) **não** gera nova geração.
2. Política de tentativas: 1ª até 30s; falha transitória → espera 5s → 2ª até 30s; nova falha transitória → espera 10s → 3ª até 30s; após as três, **ação manual + suporte**.
3. Máximo de **3 tentativas manuais** adicionais (**6 no total por entrega**); cada clique manual inicia **exatamente uma** tentativa e **não reinicia** o ciclo automático.
4. Cliques duplicados, reload e reenvio **não duplicam chamadas nem reiniciam contadores**; chamadas técnicas/fallback são **contabilizadas** (sem tentativas escondidas).
5. Cada tentativa é **identificada**; o **histórico é preservado**; linhas terminais **não são sobrescritas**; conclusão **atrasada** de tentativa superada é **rejeitada**.
6. Falhas **definitivas** de configuração/permissão **não** são repetidas cegamente.
7. A recuperação de copy **não regenera/altera a imagem**; a imagem `delivered` permanece **acessível** durante a recuperação; **nenhum crédito adicional** é consumido; o custo é registrado **internamente**.
8. Arte **íntegra** no Storage privado → **recuperar e concluir** a entrega, **sem regenerar**.
9. **Ausência confirmada** e **falha reconhecida pelo servidor** → **encerrar a operação localmente**, **estornar uma única vez**, encerrar como `refunded` e devolver o **formulário preenchido** com os dados preservados (sem depender de encerramento externo do provider).
10. A mensagem exata de crédito estornado só é exibida **após o estorno persistido confirmado**; se o estorno **não** puder ser confirmado, **não** se anuncia crédito devolvido.
11. **Erro/indisponibilidade** do Storage **não** é ausência confirmada: reverificar e dar **feedback honesto** (sem estorno indevido).
12. Resposta/imagem **atrasada** de operação `refunded` **não** reabre cobrança, **não** sobrescreve estado e **não** libera a nova campanha; nova submissão é **geração nova com cobrança normal**.
13. A autorização de recuperação/gratuidade decorre do **estado server-side**, nunca de alegação do cliente; `delivered` **nunca** é estornado.
14. **D13 não é declarado resolvido**: o gate bloqueante de piloto/habilitação permanece até a **implementação e comprovação** da estratégia substituta (recuperação de arte + **encerramento local com estorno confirmado**) — **não** até resolver a antiga exigência de encerramento externo; **evidência simulada não satisfaz** o gate.
15. Validação **local-primeiro** cobre formulário, geração, estados, persistência, copy, recuperação, créditos e download no **ambiente isolado** com **provider simulado**; **nenhuma chamada paga** em CI.
16. O **teste real controlado local** exige **autorização humana específica** e **teto de gasto**, habilitado por **autorização temporária estreita** (instância e lojas, expiração, auditoria, revogação); a **barreira global não é removida**.
17. Preview restrito (opcional) exige configuração **isolada de dados/credenciais**; produção/main, migration remota e habilitação de lojas permanecem **decisões posteriores e separadas**.
18. A **F56.3** (aprovação/reprovação/correção) permanece **fora de escopo**.
19. A recuperação de **copy** é **independente do estado da imagem**: SHALL funcionar com a imagem já `delivered`, sem tocar a operação financeira nem a arte.
20. A recuperação **financeira** de imagem SHALL limitar-se a operações **não terminais** (`reserved`/`art_uploaded`); `delivered` **nunca** é estornado e `refunded` **não** retorna a `delivered`, mesmo com imagem atrasada.
21. Operação **não terminal** + **arte ausente** são **necessárias, mas NÃO suficientes** para estorno; **consulta/reload durante a geração normal NÃO estorna**.
22. O encerramento local exige **gatilho persistido de falha FINAL para a operação, sem retry/fallback pendente** (`outcome = 'failed'` de operação ou nenhuma tentativa adicional possível) + **nenhum** claim `in_progress` + arte `absent` confirmada; um `failed` de tentativa com retry/fallback pendente **não** estorna.
23. **Sem sinal de finalidade** (nenhum claim, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou finalidade não provável), o encerramento local é **explicitamente autorizado e auditado** (motivo + evidência); o cliente sozinho **não** autoriza estorno.
24. O encerramento (automático ou autorizado) ocorre sob a **mesma trava** da linha de crédito e **impede atomicamente** qualquer tentativa posterior (`operation_terminal`).

## Diff conceitual da reconciliação (b1b arquivada → b2 reconciliada)

| Dimensão | Especificação original da change | Especificação reconciliada |
| --- | --- | --- |
| Recuperação de copy | botão único "Tentar gerar copy novamente"; anti-repetição genérica | **falha de entrega**; 3 tentativas automáticas (30s + 5s + 30s + 10s + 30s) + até 3 manuais (máx. 6); **tentativas identificadas**; histórico; proteção contra conclusão atrasada; sucesso encerra; falha definitiva não repete |
| Qualidade editorial da copy | implícito: retry poderia "melhorar" a copy | copy **entregue encerra**; texto ruim é **editável pelo lojista**; **não** autoriza nova geração |
| Recuperação de imagem | ausente (D13 deixava o claim residual bloqueado) | buscar arte no Storage (**só operações não terminais**); **íntegra → concluir sem regenerar**; **ausência confirmada → encerramento local + estorno único** → `refunded` + formulário restaurado + mensagem exata; `refunded` **não** retorna a `delivered` |
| D13 | limitação aceita + gate bloqueante; resolução por admin | **estratégia substituta** (recuperação + **encerramento local com estorno confirmado**) com provas; exceção reconhecida por **gatilho persistido de falha FINAL** (sem retry/fallback pendente, sem `in_progress`), **sem exigir marcador prévio**; geração normal e retry/fallback pendente **não** estornam; encerramento **impede atomicamente** tentativa posterior; **gate PRESERVADO** até comprovação; **D13 não declarado resolvido**; archive b1b intocado |
| Validação | testes integrados/E2E + piloto "no ambiente isolado autorizado" | **local-primeiro** (Docker/Supabase, provider simulado) → **teste real local controlado** (autorização humana + teto) → preview restrito **opcional/posterior** |
| Autorização | "autorização habilitadora" na b2; flags nunca bastam | **autorização temporária estreita** para teste real isolado (instância + lojas, expiração, auditoria, revogação); **barreira global NÃO removida** |
| Fronteira F56.3 | aprovação/correção na F56.3 | **inalterada** |

## Dependência explícita

Depende da **F56.2b1b** (concluída/verificada/sincronizada/arquivada em 2026-10-12) e, transitivamente, da **F56.2b1a** e da **F56.2a**. A b1b especifica o core, o estado de falha da copy (`completed`/`failed` terminais protegidos, `COPY_BUDGET_MS = 30s`), a operação de crédito (`reserved → art_uploaded → delivered | refunded`) e a sonda de arte tipada; a b2 especifica a recuperação de copy, a recuperação de imagem/estorno e o teste controlado.

## Fronteira com a F56.3

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na **F56.3**.

## Migração e Compatibilidade

- **Dois caminhos independentes.** (a) **Recuperação de copy:** condicionada **somente** ao estado da copy (pendente/falha) — **independe do estado da imagem** e pode ocorrer com a imagem já `delivered`; **não** toca a operação financeira nem a arte. (b) **Recuperação financeira da imagem:** limitada a operações **não terminais** (`reserved`/`art_uploaded`); `delivered` **nunca** é estornado e `refunded` **não** retorna a `delivered`, mesmo com imagem atrasada.
- **D13 (gatilho server-side, sem marcador prévio).** Operação não terminal + arte ausente são **necessárias, mas não suficientes** (é a situação normal durante a geração). O encerramento local exige **falha FINAL para a operação, sem retry/fallback pendente** (`outcome = 'failed'` de operação ou nenhuma tentativa adicional possível), **sem** nenhum claim `in_progress`, com arte `absent` confirmada. **Um `failed` de tentativa com retry/fallback pendente não estorna.** **Sem sinal de finalidade**, exige **encerramento local explicitamente autorizado e auditado**, que **impede atomicamente** tentativa posterior. A mudança em `product-1-1-generation-orchestration` **substitui o tratamento de D13**, mantendo-o bloqueante até a comprovação; o core da b1b permanece inalterado.
- **Ordem.** (1) implementação + testes simulados locais sem provider pago; (2) **comprovação da recuperação** (provas de corrida entrega×estorno, estorno idempotente, resultado atrasado, falha de Storage/banco, formulário restaurado e **marcador de falha não persistido → encerramento local + estorno**); (3) **checkpoint humano** para autorizar o **teste real controlado local** com teto; (4) avaliação de preview restrito; (5) migration remota/deploy/habilitação em etapa posterior autorizada.
- **Rollback.** Desabilitar a ação/recuperação não afeta o core nem o legado. **Rollback de deploy não desfaz automaticamente** banco/ledger.

## Tamanho estimado e corte proposto (a aprovar)

Estimativa **antes do GSD**: **12–16 planos** se executada como fase única — **acima** do limite de 8–10 do fluxo. Propõe-se um **corte em três fatias**. Isto é uma **proposta a aprovar**, **não** o início automático de três fases GSD: cada fatia entra no GSD com **planejamento e aceite independentes**, e nenhuma começa sem aprovação própria.

| Fatia | Fronteira (o que entrega) | Depende de | Aceite independente |
| --- | --- | --- | --- |
| **B2.1 — Recuperação de copy** | Política 3 automáticas + 3 manuais; tentativas identificadas; histórico; anti-duplicação; `stale_attempt`; somente textos/sem novo crédito; UI da ação manual | F56.2b1b (arquivada) | Testes simulados da política (incl. teto de 6, terminal não sobrescrito, atraso, reload) verdes; typecheck/lint/build |
| **B2.2 — Recuperação de imagem e estorno (D13)** | Sonda no Storage; íntegra → concluir sem regenerar; ausência confirmada + falha reconhecida pelo servidor → **encerramento local + estorno único**; formulário restaurado; idempotência; corrida; resultado atrasado | B2.1 (não funcional; pode reusar harness) e b1b | **Provas exigidas** (corrida entrega×estorno, estorno idempotente, resultado atrasado, falha de Storage/banco, formulário restaurado) aprovadas; gate de D13 só então avaliado |
| **B2.3 — Autorização estreita e teste real controlado** | Autorização temporária por instância/lojas com expiração, auditoria e revogação; teste real local sob autorização humana + teto; barreira global preservada | B2.1 e B2.2 comprovadas | Checkpoint humano aprovado; teste real no recorte autorizado; nenhuma habilitação de loja |

O corte **não** antecipa migration remota, deploy, habilitação de lojas nem F56.3. O **gate de D13** permanece bloqueante até a fatia **B2.2** ser **implementada e comprovada**.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável. O teste real exige **autorização humana específica** e **teto de gasto**.

## Impact

- **Banco (migration [BLOCKING])**: identidade/histórico de tentativas de copy e proteção de terminal por tentativa; suporte ao **estorno confirmado** e à reconciliação de D13. Nenhuma migration é aplicada nesta etapa (local-only, autorada no GSD).
- **Código novo**: rota/handler da recuperação de copy (auth/ownership, tentativa identificada, anti-duplicação); recuperação de imagem no Storage privado; caminho de estorno confirmado com formulário restaurado; UI da ação manual condicional.
- **Código alterado (aditivo)**: copy da b1b (`copy-state`/drenador) para tentativa identificada; orquestrador para recuperação/estorno; autorização para o recorte temporário estreito.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode).
- **Reconciliação**: `RECONCILIATION.md` desta change; a change original segue reconciliada em b1a/b1b/b2 (`openspec/changes/archive/2026-10-06-fase-56-2-novo-fluxo-geracao-produto-1-1/RECONCILIATION.md`). **Archives e evidências históricas permanecem intocados.**
- **Validação**: typecheck, lint, build, testes locais simulados (sem chamada paga), provas de recuperação e `openspec validate --strict`; `git diff --check`.
