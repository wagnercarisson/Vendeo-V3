# Product 1:1 Generation Orchestration

> B2.2 — estratégia substituta de D13: recuperação server-side (arte no Storage) + estorno confirmado por **gatilho de falha FINAL**. O **gate bloqueante** de piloto/habilitação é **preservado** até a **implementação e comprovação** da estratégia; a b1b **não** declara recuperabilidade completa e o **archive da b1b não é reescrito**. `COPY_BUDGET_MS = 30s`; execução **dentro do ciclo da requisição**, sem fila/worker/cron.

## MODIFIED Requirements

### Requirement: Limitação aceita da b1b e gate obrigatório antes da b2

Na entrega **inativa** da b1b, quando **não** existir **fonte operacional comprovada** de que a execução **encerrou**, um claim residual SHALL **não** ser tratado como entregável nem como estornável de imediato: ele SHALL ser submetido à **estratégia substituta de recuperação** (consultar o Storage privado; **arte íntegra → concluir a entrega sem regenerar**; **ausência CONFIRMADA + gatilho persistido de falha FINAL, sem `in_progress`, sem retry/fallback pendente → encerramento LOCAL, estornar uma única vez**), sem retomada de geração e **sem exigir comprovação de encerramento externo do provider**. A b1b SHALL NOT declarar **recuperabilidade completa**. Testes com **evidência simulada** (harness/**fake**) SHALL NOT ser considerados **comprovação operacional** da estratégia. O piloto/habilitação de lojas na **b2** SHALL permanecer **bloqueado** até comprovar uma **estratégia operacional segura de resolução de claims residuais**; **evidência simulada SHALL NOT substituir comprovação operacional**; a confirmação do **plano e dos limites** da plataforma pode **sustentar** a estratégia, mas, **isoladamente, SHALL NOT satisfazer o gate**. A **b1b inativa** pode ser concluída mantendo a limitação documentada; o bloqueio recai sobre **piloto/habilitação**, sem impedir a **preparação documental da b2**. **D13 SHALL NOT ser declarado resolvido** antes de a estratégia substituta ser **implementada e comprovada** — **não** até resolver a antiga exigência de encerramento externo. Plano contratado informado: **Vercel Hobby / Supabase Free**; os **limites efetivos de execução permanecem não verificados**.

#### Scenario: Claim residual é submetido à recuperação

- **WHEN** existe claim `in_progress` residual
- **THEN** a operação é submetida à recuperação no Storage privado
- **AND** não ocorre retomada de geração
- **AND** arte íntegra conclui a entrega sem regenerar

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

## ADDED Requirements

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
