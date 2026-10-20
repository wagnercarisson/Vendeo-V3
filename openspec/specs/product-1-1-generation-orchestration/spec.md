# Product 1:1 Generation Orchestration

> Synced from `fase-56-2b1b-nucleo-entregavel-produto-1-1` (ADDED) and `fase-56-2b2b-recuperacao-de-imagem-estorno-e-d13-produto-1-1` (1 MODIFIED + 2 ADDED).

## Purpose

Orquestração do novo fluxo Produto 1:1 **dentro do ciclo da requisição**: preflight fail-closed, snapshot congelado, política 2+1, início de tentativa atômico no Postgres, tratamento de resultado desconhecido e resolução administrativa auditada — **sem** execução durável (diferida) e mantendo a limitação aceita da b1b como **gate obrigatório da b2**.

## Requirements

### Requirement: Preflight e execução da política

A execução SHALL resolver configuração fail-closed e exigir pricing `complete` para principal e fallback antes de reserva/provider. Política limita principal a duas tentativas e fallback a uma; rate_limit repete uma vez no principal; indisponibilidade explícita pode ir ao fallback; quota/faturamento não. O par principal é `gpt-image-2.5-sunburst / medium` e o fallback é `gpt-image-2 / medium`.

#### Scenario: Pricing incompleto bloqueia

- **WHEN** qualquer par tem pricing parcial/ausente
- **THEN** não reserva crédito nem chama provider

#### Scenario: Limite de tentativas respeitado

- **WHEN** tentativas falham conforme política
- **THEN** principal não excede duas e total não excede três chamadas

### Requirement: Snapshot congelado antes da reserva/provider

A execução SHALL persistir, antes da reserva e de qualquer chamada ao provider, um snapshot imutável que congela o briefing, as referências/seleções (intenção, direção de fundo, imagens) e as **versões de composição** (base, compositor, políticas), além do par principal/fallback modelo+qualidade com versão/origem. Falha ao persistir o snapshot SHALL bloquear a operação. A execução SHALL NOT reler configuração mutável.

#### Scenario: Snapshot persiste antes do crédito/provider

- **WHEN** a campanha elegível inicia
- **THEN** o snapshot congelado é gravado antes de reserva e provider
- **AND** nenhuma configuração mutável é lida depois do congelamento

#### Scenario: Correção reutiliza o snapshot original

- **WHEN** a mesma campanha é corrigida/regerada
- **THEN** o snapshot original congelado é reutilizado
- **AND** a configuração vigente não é adotada

### Requirement: Histórico append-only por tentativa

Cada tentativa SHALL ser registrada append-only, vinculada à campanha e ao snapshot, preservando `run_id`/`trace_id` e sem sobrescrever referências anteriores. O histórico SHALL permitir reconstruir o par modelo–qualidade e o alvo de cada tentativa.

#### Scenario: Tentativas sucessivas preservam histórico

- **WHEN** há múltiplas tentativas (principal e fallback)
- **THEN** cada tentativa é registrada sem sobrescrever as anteriores
- **AND** a sequência de tentativas é reconstruível

### Requirement: Execução no ciclo da requisição com limites

A orquestração SHALL executar **dentro do ciclo da requisição**, respeitando limites explícitos (teto de duração da função/rota, timeout próprio da chamada ao provider e política 2+1). As tentativas SHALL pertencer à mesma operação persistida (`campaignId + operation_id`), sem criar operações paralelas. **Não** SHALL existir fila/outbox, worker, cron/dispatcher, claim/lease/fencing, continuidade após fechar a página ou retomada automática nesta fatia.

#### Scenario: Tentativas pertencem à mesma operação

- **WHEN** a política executa principal e fallback
- **THEN** todas as tentativas atualizam a mesma operação
- **AND** nenhuma operação adicional é criada

#### Scenario: Reenvio apenas consulta a operação

- **WHEN** o lojista reenvia o mesmo pedido para a mesma `campaignId + operation_id`
- **THEN** o sistema **consulta** a operação existente
- **AND** se houver arte salva, recupera essa arte
- **AND** se o resultado continuar desconhecido, **não** chama o modelo novamente
- **AND** nenhuma tentativa nova, geração ou cobrança é iniciada

#### Scenario: Sem continuidade garantida

- **WHEN** a conexão cai durante a execução
- **THEN** não é garantido que o processamento continue
- **AND** também não é afirmado que a chamada já despachada ao provider seja necessariamente cancelada

### Requirement: Início de tentativa atômico no banco

Duas requisições simultâneas SHALL NOT chamar o provider duas vezes para a mesma operação. A reserva financeira idempotente, **isoladamente, não garante isso**. Um **controle atômico de início de tentativa no Postgres** SHALL garantir **um único início de tentativa por vez**, sem fila, cron ou worker. O teto 2+1 SHALL pertencer à **operação inteira** (persistido), não a cada reenvio.

#### Scenario: Duas requisições simultâneas

- **WHEN** duas requisições concorrentes tentam iniciar tentativa para a mesma operação
- **THEN** apenas uma adquire o início de tentativa
- **AND** a outra consulta/aguarda e **não** dispara chamada ao provider

#### Scenario: Teto por operação, não por reenvio

- **WHEN** reenvios ocorrem durante a operação
- **THEN** o teto 2+1 continua contado na operação inteira
- **AND** nenhum reenvio amplia o teto

### Requirement: Resultado desconhecido do provider

Quando o resultado da chamada ao provider é desconhecido (ex.: timeout), a operação SHALL ficar **pendente/limitada**. **Não** SHALL repetir cegamente, **não** SHALL estornar com base apenas em timeout e **não** SHALL retomar — nem automaticamente, **nem por reenvio do lojista** (que é somente consulta). A **UI** SHALL exibir **“Não foi possível confirmar a conclusão desta geração”** com a **referência de suporte**, e **não** SHALL oferecer **“Gerar novamente”** para essa mesma operação. A resolução SHALL ocorrer por **suporte/admin, com evidência** (requisito “Resolução de pendência por suporte/admin”), sem re-queue.

#### Scenario: Timeout não gera nova chamada cega

- **WHEN** a chamada ao provider não retorna resultado definitivo
- **THEN** nenhuma nova chamada automática é feita
- **AND** a operação fica pendente/limitada

#### Scenario: Timeout não estorna

- **WHEN** o único sinal é timeout
- **THEN** nenhum estorno é executado com base apenas no timeout
- **AND** a operação permanece pendente

#### Scenario: Reenvio não retoma

- **WHEN** o lojista reenvia uma operação com resultado desconhecido
- **THEN** o sistema apenas consulta a operação
- **AND** não chama o modelo novamente
- **AND** não oferece ação de “Gerar novamente” para essa operação

### Requirement: Resolução de pendência por suporte/admin

A resolução de uma operação pendente/limitada SHALL ser feita por **administrador autorizado**, com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem exigir dois aprovadores nesta versão): **entregar a arte existente** quando houver arte íntegra, ou **estornar uma vez** após confirmar **ausência de arte** e **encerramento da execução**. A “fila de atendimento” SHALL ser **somente uma lista de pendências, sem execução automática**. Permanecem **proibidos**: re-queue, nova geração administrativa e chamada automática ao provider.

#### Scenario: Evidência de arte entrega

- **WHEN** há arte íntegra persistida para a operação pendente
- **THEN** o administrador autorizado, com motivo, registra a evidência e a transição
- **AND** entrega a arte existente
- **AND** nenhuma nova geração ocorre

#### Scenario: Ausência comprovada estorna uma vez

- **WHEN** o administrador autorizado confirma ausência de arte e encerramento da execução
- **THEN** registra motivo, evidências e transição
- **AND** o estorno ocorre uma única vez
- **AND** nenhum re-queue, nova geração ou chamada automática é executado

#### Scenario: Fila de atendimento é somente lista

- **WHEN** existem operações pendentes
- **THEN** elas aparecem em uma lista de pendências
- **AND** nenhuma execução automática é disparada a partir da lista

### Requirement: Telemetria e falha segura

Cada tentativa SHALL registrar modelo/qualidade/alvo/número/run-trace/resultado/custo por par. Falha operacional retorna `IMG-001` + referência opaca e diagnóstico durável, sem motivo interno. O fluxo não invoca revisor automático.

#### Scenario: Falha correlacionável

- **WHEN** geração falha operacionalmente
- **THEN** diagnóstico recuperável por referência é persistido e mensagem pública sanitizada

### Requirement: Limitação aceita da b1b e gate obrigatório antes da b2

Na entrega **inativa** da b1b, quando **não** existir **fonte operacional comprovada** de que a execução **encerrou**, um claim residual **ou** ausência de arte SHALL **não** autorizar, **por si só**, encerramento nem estorno. A operação SHALL ser submetida à **estratégia substituta de recuperação** com **condições explícitas**: **arte íntegra** ⇒ conclusão da entrega **sem regenerar** e **sem novo upload**; **ausência CONFIRMADA** ⇒ encerramento **automático** `refunded` **somente** com o **predicado PF completo** (falha FINAL persistida + ausência **fresca** — epoch capturado **antes da sonda** — + nenhum claim `in_progress`) **e publicação não protegida** (sem `in_flight`/`result_unknown`/`published`); **caso inconclusivo** (claim/permanência, publicação ativa, resultado desconhecido, retry/fallback pendente) ⇒ encerramento **somente** pela **resolução autorizada e auditada** (motivo + evidência server-side), **sem** retomada de geração; **resultado/imagem tardio** SHALL NOT reabrir `refunded`; **sem exigir comprovação de encerramento externo do provider**. A b1b SHALL NOT declarar **recuperabilidade completa**. Testes com **evidência simulada** (harness/**fake**) SHALL NOT ser considerados **comprovação operacional** da estratégia. O piloto/habilitação de lojas na **b2** SHALL permanecer **bloqueado** até comprovar uma **estratégia operacional segura de resolução de claims residuais**; **evidência simulada SHALL NOT substituir comprovação operacional**; a confirmação do **plano e dos limites** da plataforma pode **sustentar** a estratégia, mas, **isoladamente, SHALL NOT satisfazer o gate**. A **b1b inativa** pode ser concluída mantendo a limitação documentada; o bloqueio recai sobre **piloto/habilitação**, sem impedir a **preparação documental da b2**. **D13 SHALL NOT ser declarado resolvido** antes de a estratégia substituta ser **implementada e comprovada** — **não** até resolver a antiga exigência de encerramento externo. Plano contratado informado: **Vercel Hobby / Supabase Free**; os **limites efetivos de execução permanecem não verificados**.

#### Scenario: Claim residual ou arte ausente não autorizam estorno por si sós

- **WHEN** existe claim `in_progress`/`abandoned` residual, **ou** a arte está ausente
- **THEN** nenhum estorno é executado por esse sinal isolado
- **AND** a operação é submetida à recuperação: arte íntegra conclui a entrega sem regenerar e sem novo upload
- **AND** o encerramento automático com estorno só ocorre com o predicado PF completo e publicação não protegida
- **AND** o caso inconclusivo só é encerrado pela exceção administrativa explicitamente reconhecida, autorizada e auditada
- **AND** retry/fallback pendente ou geração normal **não** são, por si sós, autorização para encerramento administrativo
- **AND** resultado/imagem tardio não reabre `refunded`

#### Scenario: Evidência simulada não é prova operacional

- **WHEN** a única evidência de resolução provém de harness/fake
- **THEN** isso não é aceito como comprovação operacional
- **AND** o gate permanece não satisfeito

#### Scenario: Gate obrigatório antes da b2

- **WHEN** se pretende pilotar ou habilitar lojas na b2
- **THEN** uma estratégia operacional segura de resolução de claims residuais precisa estar comprovada
- **AND** confirmar plano/limites, isoladamente, não satisfaz o gate
- **AND** evidência simulada não substitui comprovação operacional
- **AND** a b2 não é habilitada sem o gate (a preparação documental da b2 não é impedida)

#### Scenario: D13 não é declarado resolvido

- **WHEN** a estratégia substituta ainda não foi implementada e comprovada
- **THEN** D13 não é declarado resolvido
- **AND** o gate bloqueante permanece

### Requirement: Recuperação server-side de operação sem delivered

A orquestração SHALL oferecer uma **recuperação server-side** para operações **não terminais** (`reserved`/`art_uploaded`), **dentro do ciclo da requisição**, **sem** fila/worker/cron e **sem** retomada de geração. A recuperação SHALL usar a sonda **tipada** de arte: `integral` → concluir a entrega; `invalid`/`indeterminate` → reverificar e dar feedback honesto. Operação não terminal **e** arte ausente são **necessárias, mas NÃO suficientes** para encerrar: essa é **também** a situação normal durante a geração, e **consulta/reload durante a geração normal NÃO SHALL encerrar nem estornar**. O **encerramento local com estorno único** SHALL exigir o **gatilho persistido de falha FINAL para a operação, sem retry/fallback pendente**: **(a)** `outcome = 'failed'` de operação **gravado com sucesso** no ponto de decisão terminal; **e (b)** **nenhum** claim `in_progress`; **e (c)** arte `absent` confirmada — **sem** exigir marcador `generation_outcomes` pré-salvo (ele é gravado no **ponto de decisão terminal**, não antes) e **sem** encerramento externo do provider. **(a) exige gravação bem-sucedida**: se o marcador não puder ser gravado (erro) **ou** já existir um `unknown` imutável, **não** se trata como sucesso automático nem se sobrescreve — encaminha à **resolução autorizada**. **Um `failed` de tentativa com retry/fallback ainda pendente SHALL NOT ser gatilho** (o orquestrador grava `failed` antes de decidir a próxima tentativa). **Sem sinal de finalidade** (nenhum claim persistido, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou finalidade não provável), o encerramento SHALL ser **explicitamente autorizado e auditado** (motivo + evidência), registrando a resolução (idempotente); o encerramento SHALL ocorrer sob a **mesma trava** da linha de crédito e transitar a operação para **terminal**, **impedindo atomicamente** tentativa posterior. **O gatilho automático exige ausência de `in_progress` e SHALL NOT abandonar claim algum**; **finalizar um claim `in_progress` como `abandoned` pertence EXCLUSIVAMENTE ao encerramento autorizado**, sob a mesma trava, **com proteção contra o resultado atrasado**. A recuperação financeira SHALL limitar-se a operações **não terminais**; `delivered` não estorna e `refunded` SHALL NOT retornar a `delivered`. A autorização de recuperação/gratuidade SHALL decorrer do **estado server-side**, nunca de alegação do cliente.

#### Scenario: Recuperação dentro do ciclo e sem worker

- **WHEN** a recuperação é executada
- **THEN** ela ocorre no ciclo da requisição
- **AND** nenhuma fila, worker ou cron é criado
- **AND** nenhuma nova geração/retomada é iniciada

#### Scenario: Ausência confirmada encerra com estorno único

- **WHEN** a sonda confirma `absent` **e** há **falha FINAL da operação** (sem retry/fallback pendente) **e** nenhum claim `in_progress`
- **THEN** a operação é encerrada localmente como `refunded` uma única vez
- **AND** os dados do formulário são preservados para nova submissão

#### Scenario: Marcador de falha final (4a) no ponto de decisão

- **WHEN** a política não produz próxima tentativa e o orquestrador **grava `outcome='failed'` com sucesso** (marcador não pré-salvo)
- **AND** não há claim `in_progress` e a sonda confirma `absent`
- **THEN** o predicado PF é satisfeito e a operação é encerrada localmente como `refunded` uma única vez

#### Scenario: Marcador não gravado vai para resolução autorizada

- **WHEN** a gravação de `outcome='failed'` **falha** **ou** já existe um `unknown` **imutável**
- **THEN** o caso SHALL NOT ser tratado como sucesso automático nem sobrescrever o marcador
- **AND** a operação permanece **não terminal** e o caso é encaminhado à **resolução autorizada**

#### Scenario: Abandono de claim `in_progress` é exclusivo do caminho autorizado

- **WHEN** existe um claim `in_progress` e não há sinal de finalidade
- **THEN** o gatilho automático **não** o abandona (PF exige ausência de `in_progress`)
- **AND** somente o encerramento **autorizado** pode finalizá-lo como `abandoned`, sob a trava
- **AND** um resultado atrasado da chamada em voo **não** sobrescreve o estado terminal

#### Scenario: Formulário restaurado com limites honestos

- **WHEN** o estorno é persistido e confirmado
- **THEN** os **campos preenchidos** são restaurados a partir do estado persistido server-side (`input_snapshot`/`identitySnapshot`)
- **AND** a mensagem aprovada é exibida
- **AND** **não** se promete restauração de **imagem**/referências (client-only)

#### Scenario: Retry ou fallback pendente não estorna

- **WHEN** o `primary` falhou (claim `failed`), a arte está ausente e a próxima tentativa (retry/`fallback`) **ainda será iniciada**
- **THEN** a recuperação **não** estorna
- **AND** a geração continua pela próxima tentativa

#### Scenario: Geração normal não estorna

- **WHEN** a operação é não terminal, a arte ainda não existe e há claim `in_progress`
- **THEN** consulta/reload não encerra nem estorna
- **AND** a geração continua

#### Scenario: Indeterminado não estorna

- **WHEN** a sonda retorna `invalid`/`indeterminate`
- **THEN** nenhum encerramento por ausência é declarado
- **AND** a recuperação reverifica e informa o lojista honestamente

#### Scenario: Sem sinal de finalidade exige autorização auditada

- **WHEN** não há claim persistido (nem `in_progress`), ou o estado é `in_progress`/`abandoned`/`unknown`, **ou** há retry/fallback pendente, **ou** a finalidade não é provável
- **THEN** nenhum encerramento automático com estorno ocorre
- **AND** o encerramento exige autorização **explícita e auditada** (motivo + evidência)
- **AND** o cliente sozinho não autoriza o estorno

#### Scenario: Encerramento impede tentativa posterior

- **WHEN** o encerramento (automático ou autorizado) encerra a operação
- **THEN** ele ocorre sob a mesma trava da linha de crédito e a operação fica terminal
- **AND** qualquer tentativa posterior é recusada (`operation_terminal`)

#### Scenario: Autorização vem do servidor

- **WHEN** a recuperação é solicitada
- **THEN** a decisão de recuperação/gratuidade deriva do estado server-side persistido
- **AND** nenhuma alegação do cliente autoriza recuperação ou gratuidade

#### Scenario: Operação terminal não é recuperada financeiramente

- **WHEN** a operação está `delivered` ou `refunded`
- **THEN** nenhuma recuperação financeira é aplicada
- **AND** `refunded` não retorna a `delivered` mesmo com imagem atrasada

### Requirement: Resultado atrasado não libera nem sobrescreve

Um resultado/arte **atrasado** de operação encerrada (`refunded`) SHALL NOT reabrir cobrança, SHALL NOT sobrescrever o estado e SHALL NOT liberar a nova campanha. A nova campanha SHALL ser avaliada por seu próprio estado persistido.

#### Scenario: Resultado atrasado não sobrescreve

- **WHEN** um resultado atrasado chega após o encerramento `refunded`
- **THEN** o estado persistido não é sobrescrito
- **AND** a cobrança não é reaberta
- **AND** a nova campanha não é liberada por esse resultado

### Requirement: Encerramento pela plataforma e orçamento de tempo

A orquestração SHALL operar com timeout interno **estritamente menor** que o teto da função da plataforma (**300s**), compondo um **deadline global comprovado** com **margem para persistência cooperativa**. O sistema SHALL NOT prometer que a última escrita ocorre após um kill abrupto; nesse caso, o **estado durável anterior** SHALL permanecer recuperável, sem inventar `unknown` persistido nem ausência de arte. O encerramento pela plataforma SHALL NOT ser interpretado como prova de sucesso nem de ausência e **não autoriza, por si só, nenhuma via**: a **automática** exige probe fresco sob epoch e fence; a **administrativa** exige autorização/auditoria e suas precondições próprias.

#### Scenario: Deadline comprovado com margem
- **WHEN** a execução se aproxima do teto de 300s
- **THEN** o deadline global foi provado por teste e o timeout interno é menor que o teto
- **AND** há margem para persistência cooperativa

#### Scenario: Kill pode impedir a última escrita
- **WHEN** a plataforma encerra a função abruptamente
- **THEN** a última escrita pode não ocorrer
- **AND** o estado durável anterior permanece recuperável

#### Scenario: Kill não é prova de ausência nem autoriza via
- **WHEN** a plataforma encerra a função no meio da execução
- **THEN** a ausência de arte não é presumida
- **AND** nenhuma via de encerramento é autorizada apenas pelo kill
- **AND** a via automática exige probe fresco e a administrativa exige autorização/auditoria

#### Scenario: Resultado desconhecido é honesto
- **WHEN** a execução termina sem confirmação
- **THEN** o estado é `unknown`/inconclusivo, sem retomada automática
- **AND** nenhuma conclusão de sucesso ou ausência é inferida

## Pilot Scope and Deferred Items

The operational `test_stores` authorization was scoped to the **N=1 hosted pilot** in
56.2.6. Items **5.3** (hosted refund path) and **5.7** (post-redeploy replay) were
**deferred by responsible decision and not executed** at that time; that historical
record and the `DEFERRED.md` pointer are preserved in the archived 56.2.6 change.

In 56.2.7, **5.3 and 5.7 were executed and proven in the hosted environment**:
5.3 passed with a single refund and idempotent replay; 5.7 passed with a `delivered`
operation replayed after redeploy, unchanged artifact hash and no new generation,
upload, provider, event or credit transaction.

The general opening was authorized in 56.2.7. `all_stores` is active under the
**7-day monitoring transferred on 2026-10-19 and still in progress**; the flow is not
automatically shut down. D13 remains accepted only for the monitored opening; the real
platform kill remains **INCONCLUSIVE**. The 56.2.6 evidence and its deferral are not
rewritten.

Durable monitoring pointer: `.planning/phases/56.2.7-abertura-gradual-produto-1-1-luna/56.2.7-MONITORING-TRANSFER.md`.

Durable 56.2.6 deferral pointer: `openspec/changes/archive/2026-10-19-fase-56-2b2d-piloto-hospedado-produto-1-1-test-stores/DEFERRED.md`.
