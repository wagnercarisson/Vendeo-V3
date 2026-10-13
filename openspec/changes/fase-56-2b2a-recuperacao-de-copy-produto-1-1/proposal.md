## Why

A **F56.2b2** foi reconciliada na change `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` e o responsável **aprovou a divisão em três bases independentes** (B2.1 copy, B2.2 imagem/estorno/D13, B2.3 autorização/teste real). Esta change formaliza **B2.1 — Recuperação de copy**, sem redesenhar decisões aprovadas.

A **F56.2b1b** (concluída/verificada/sincronizada/arquivada em 2026-10-12) deixou a copy **não bloqueante** com falha persistida, mas **sem retry**; o novo fluxo permanece **INATIVO** (chaves `false`, autorização `off`). Esta fatia acrescenta a **recuperação de copy como falha de entrega**, com tentativas identificadas, histórico preservado e proteção contra conclusão atrasada, **sem** depender da fatia de imagem/estorno.

A change agregadora `fase-56-2b2-copy-recuperavel-e-piloto-produto-1-1` é **substituída documentalmente** por B2.1+B2.2+B2.3 e **NÃO** é tratada como implementada (não deve ser sincronizada/arquivada como concluída).

## What Changes

- **Recuperação de copy é falha de entrega, não qualidade editorial.** Copy **entregue encerra** a recuperação; texto mal elaborado pode ser **editado pelo lojista** e **não autoriza nova geração**.
- **Política de tentativas:** 1ª até **30s**; falha **transitória** → espera **5s** → 2ª até **30s**; nova falha **transitória** → espera **10s** → 3ª até **30s**; após as três, ofertar **ação manual + suporte**. Máximo de **3 tentativas manuais adicionais (6 no total por entrega)**; cada clique manual inicia **somente uma** tentativa e **não reinicia** o ciclo automático. Sucesso **encerra**; falhas **definitivas** de configuração/permissão **não** recebem repetição cega.
- **Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada.** Direção de schema **fixada**: `product_1_1_copy_state` passa a **uma linha por tentativa** (`attempt_seq` + `attempt_token`), com **compatibilidade** dos leitores/RPCs atuais; terminal (`completed`/`failed`) **não** é reaberto/sobrescrito; conclusão atrasada de tentativa superada é **rejeitada** (`stale_attempt`).
- **Anti-duplicação e contabilização.** Cliques duplicados, reload e reenvio **não duplicam** chamadas nem reiniciam contadores; chamadas técnicas/fallback **contabilizadas** no limite, sem tentativas escondidas.
- **Escopo restrito.** A recuperação tenta **somente os textos** (`campaign_copy`), **não** altera/regera a imagem, **não** consome crédito adicional; a imagem `delivered` permanece **acessível**. Custo registrado **internamente**.
- **Execução no ciclo da requisição.** A política roda **dentro do ciclo** já escolhido pela b1b (sem fila/worker/cron) e **não pressupõe continuidade** após fechar o navegador; a retomada é **manual**.

**BREAKING:** nenhuma. O núcleo da b1b é preservado; as mudanças são aditivas.

## Capabilities

### Modified Capabilities

- `product-1-1-copy-recovery`: substitui o "retry único/genérico" pela **política de recuperação como falha de entrega**, com tentativas identificadas, histórico preservado, proteção contra conclusão atrasada, anti-duplicação, falhas definitivas sem repetição cega e custo interno contabilizado no limite.

## Critérios de Aceite Verificáveis

1. A recuperação só é oferecida quando a copy está **pendente/falha**; copy **entregue encerra** as tentativas, e texto entregue (mesmo ruim) **não** gera nova geração.
2. Política: 1ª até 30s; falha transitória → espera 5s → 2ª até 30s; nova falha transitória → espera 10s → 3ª até 30s; após as três, **ação manual + suporte**.
3. Máximo de **3 tentativas manuais** adicionais (**6 no total por entrega**); cada clique manual inicia **exatamente uma** tentativa e **não reinicia** o ciclo automático.
4. Cliques duplicados, reload e reenvio **não duplicam chamadas nem reiniciam contadores**; chamadas técnicas/fallback são **contabilizadas**.
5. Cada tentativa é **identificada**; o **histórico é preservado**; linhas terminais **não são sobrescritas**; conclusão **atrasada** de tentativa superada é **rejeitada**.
6. Falhas **definitivas** de configuração/permissão **não** são repetidas cegamente.
7. A recuperação **não regenera/altera a imagem**; a imagem `delivered` permanece **acessível**; **nenhum crédito adicional** é consumido; o custo é registrado **internamente**.
8. A recuperação exige **autenticação e ownership**; sem ownership, é negada sem chamada de IA.
9. A recuperação é **independente do estado da imagem** e funciona com a imagem já `delivered`.
10. **Nenhuma chamada paga** em CI; validação **local-primeiro** com **provider simulado**.

### Refinamentos de contrato (reconciliação 2026-10-13)

Os critérios 11–17 **fecham lacunas funcionais de execução** sem alterar o recorte B2.1. Eles **não** criam novos requirements: são **dobrados** nos 10 requirements normativos existentes do spec `product-1-1-copy-recovery` (a contagem **2 MODIFIED + 8 ADDED = 10** permanece) e nos REQ-IDs `REQ-56.2.3-01..10`.

11. A **aquisição de tentativa é atômica no servidor** (sob trava estável da operação) e ocorre **antes de qualquer chamada ao provider** (inclusive fallback); requisições concorrentes ⇒ **exatamente uma** tentativa adquirida e a perdedora **apenas acompanha**.
12. **Cada chamada efetiva** de provider é uma **tentativa identificada** que segue **integralmente** a política (**contadores, limites e esperas**); **NÃO** existe **fallback escondido dentro de uma tentativa/acionamento** — o fallback, quando aplicável, é a **tentativa seguinte** governada pela política.
13. `pending` **não** comprova **execução ativa**: o servidor distingue tentativa **ativa** de **interrompida** e as esperas (5s/10s) são verificadas **server-side** (anti-spinner-preso).
14. A recuperação respeita a **elegibilidade/não-ativação** e a **identidade do novo fluxo**: campanha do novo fluxo, `operationId` correspondente; com o fluxo **`off`**, nega **sem chamada de IA**; `mode`/sequência/token do cliente são **solicitações**, nunca autoridade.
15. A **migração dos registros** existentes da b1b é **transacional**, preserva o **vínculo da mesma tentativa** (estado↔cancelamento) e **restaura a imutabilidade** do cancelamento ao final; provada com **fixtures anteriores à B2.1**.
16. A **tentativa inicial** (drenagem da copy no ciclo da requisição da b1b) é integrada ao modelo de identidade/contabilização/classificação da falha.
17. As **provas de integração** cobrem **concorrência pela rota real**, **limites separados** (auto × manual), **esperas**, **fallback** e **tentativa inicial** (Postgres isolado; provider simulado; nenhuma chamada paga).

## Dependência explícita

Depende da **F56.2b1b** (arquivada em 2026-10-12) e, transitivamente, da **F56.2b1a** e da **F56.2a**. É a **primeira** das três fatias aprovadas; **não** depende de B2.2/B2.3.

## Fronteira com a F56.3

Aprovação, reprovação, correção, contador e bloqueio server-side de download de artes pendentes/reprovadas permanecem na **F56.3**.

## Migração e Compatibilidade

- **Aditivo/condicional.** A recuperação só existe com a copy pendente/falha; o core da b1b permanece inalterado.
- **Escopo da copy apenas.** A recuperação de copy **não** toca a operação financeira nem a arte; a **recuperação financeira de imagem** pertence a **B2.2**.
- **Rollback.** Desabilitar a ação/recuperação não afeta o core nem o legado.

## Tamanho estimado

**4–5 planos** (abaixo do limite de 8–10). Se exceder, **parar** e propor ajuste sem retirar segurança nem testes.

## Checkpoint Humano

Esta proposta **para para revisão humana antes de qualquer implementação**. Nenhum código, migration, `db push`, chamada paga, commit, `sync`/`archive` ou planejamento/execução GSD antes da aprovação do responsável.

## Impact

- **Banco (migration [BLOCKING])**: identidade/histórico de tentativas de copy e proteção de terminal por tentativa (local-only; autorada no GSD).
- **Código novo**: rota/handler da recuperação de copy (auth/ownership, tentativa identificada, anti-duplicação); UI da ação manual condicional.
- **Código alterado (aditivo)**: `copy-state`/drenador da b1b para tentativa identificada.
- **Design**: `openspec/design-system/MASTER.md` (dark OLED, sem emojis, sem light mode).
- **Rastreabilidade**: deriva da change agregadora substituída; ver `RECONCILIATION.md`.
- **Validação**: typecheck, lint, build, testes de contrato/Postgres isolado/navegador com provider simulado e `openspec validate --strict`; `git diff --check`.
