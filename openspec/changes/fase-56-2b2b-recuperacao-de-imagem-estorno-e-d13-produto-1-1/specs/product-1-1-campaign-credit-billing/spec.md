# Product 1:1 Campaign Credit Billing

> B2.2 — estorno por **gatilho persistido** (ausência confirmada **+** **falha FINAL da operação, sem retry/fallback pendente**, **sem** `in_progress`), estorno idempotente e isolamento de resultado atrasado. Operação não terminal + arte ausente são **necessárias, mas não suficientes**; `failed` por tentativa com retry/fallback pendente **não** estorna. Preserva a operação atômica da b1a/b1b (`reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `delivered_not_refundable`) e a identidade `campaignId + operation_id`.

## MODIFIED Requirements

### Requirement: Falha confirmada e resultado desconhecido

Falha **confirmada** sem arte utilizável SHALL gerar `refunded` **uma vez**. Resultado **desconhecido** (ex.: timeout) SHALL deixar a operação **pendente/limitada**, sem estorno baseado apenas em timeout e sem nova chamada cega, e **sem retomada** — nem automática, nem por reenvio do lojista. Timeout ou estado `reserved` isolados SHALL NOT autorizar estorno. A operação SHALL ser resolvida por **recuperação server-side** que consulta o Storage privado: **arte íntegra** → conclusão da entrega sem regenerar. Operação não terminal **e** arte ausente são **necessárias, mas NÃO suficientes** para estorno — essa é **também** a situação normal durante a geração; **consulta/reload durante a geração normal SHALL NOT autorizar estorno**. O **gatilho** que autoriza o **encerramento LOCAL** com `refunded` **uma única vez** (sem encerramento externo do provider e **sem** exigir o marcador `generation_outcomes` **pré-salvo** — ele é gravado no **ponto de decisão terminal**, não antes) SHALL ser: **(a)** **falha FINAL para a operação, sem retry/fallback pendente** — persistida como `outcome = 'failed'` de operação **gravado com sucesso** no ponto de decisão terminal; **(b)** **nenhum** claim `in_progress` para a operação; **e (c)** arte `absent` confirmada com operação não terminal. Recusas isoladas (`primary_after_fallback`/`attempt_already_completed`/`attempt_limit_reached`/`attempt_number` máximo) SHALL NOT ser gatilho: **não comprovam, sozinhas, falha final da operação**. Se o marcador `outcome='failed'` **não puder ser gravado** (erro de escrita) **ou** já existir um `unknown` **imutável**, o encerramento SHALL NOT ser tratado como sucesso automático **nem** sobrescrever o marcador: a operação permanece **não terminal** e o caso SHALL ser encaminhado à **resolução autorizada** (abaixo). Um claim `failed` de uma tentativa que **ainda admite retry/fallback SHALL NOT** ser gatilho (o orquestrador grava `failed` e só depois decide a próxima tentativa). A recuperação financeira SHALL limitar-se a operações **não terminais** (`reserved`/`art_uploaded`); `delivered` e `refunded` são **terminais**, e `refunded` SHALL NOT retornar a `delivered`. **Sem sinal de finalidade** (nenhum claim persistido, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente ou finalidade não provável), o encerramento local SHALL ser **explicitamente autorizado e auditado** (motivo obrigatório + evidência), registrando a resolução (append-only, idempotente); **nunca** se infere erro da mera ausência. Quando o resultado permanecer **indeterminado**, a resolução SHALL ocorrer por **administrador autorizado**, com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem dois aprovadores nesta versão), **sem re-queue** e **sem nova geração administrativa**. A “fila de atendimento” é **somente lista de pendências, sem execução automática**.

#### Scenario: Falha confirmada estorna uma vez

- **WHEN** a operação encerra por falha confirmada sem arte utilizável
- **THEN** o crédito reservado é devolvido uma única vez
- **AND** nenhuma cobrança final permanece

#### Scenario: Exceção reconhecida pelo gatilho persistido estorna uma vez

- **WHEN** a operação é não terminal e a arte está `absent` confirmada
- **AND** a falha é **FINAL para a operação** (`outcome = 'failed'` de operação **gravado com sucesso** no ponto de decisão terminal), **sem retry/fallback pendente**
- **AND** não há claim `in_progress` para a operação
- **THEN** a operação transita para `refunded` uma única vez
- **AND** a operação é encerrada localmente como `refunded`

#### Scenario: Retry ou fallback pendente não estorna

- **WHEN** o `primary` falhou (claim `failed`), a arte está ausente e a próxima tentativa (retry/`fallback`) **ainda será iniciada**
- **THEN** a recuperação **não** estorna
- **AND** a geração continua pela próxima tentativa

#### Scenario: Tempo limite não estorna

- **WHEN** o único sinal é timeout/resultado desconhecido
- **THEN** nenhum estorno é executado com base apenas nesse sinal
- **AND** a operação permanece pendente até resolução por recuperação ou administrador autorizado com evidência

#### Scenario: Suporte entrega arte existente

- **WHEN** o administrador autorizado verifica arte íntegra existente para a operação pendente
- **THEN** registra motivo, evidência e transição
- **AND** entrega a arte existente, sem nova geração

#### Scenario: Suporte estorna após ausência comprovada

- **WHEN** o administrador autorizado confirma ausência de arte e falha reconhecida
- **THEN** registra motivo, evidência e transição
- **AND** estorna uma única vez, sem re-queue

## ADDED Requirements

### Requirement: Encerramento local com estorno confirmado

O encerramento de uma operação sem arte SHALL ser **local** ao servidor e SHALL NOT depender de comprovar que o provider encerrou **nem** de o marcador `generation_outcomes` já estar gravado. Operação não terminal **e** arte ausente são **necessárias, mas NÃO suficientes** para o encerramento. O encerramento SHALL exigir o **gatilho persistido** de **falha FINAL para a operação, sem retry/fallback pendente**: **(a)** `outcome = 'failed'` de operação **gravado com sucesso** no ponto de decisão terminal; **e (b)** **nenhum** claim `in_progress` para a operação; **e (c)** arte `absent` confirmada com operação não terminal. **(a) exige gravação bem-sucedida do marcador**: se o marcador não puder ser gravado (erro) ou já existir um `unknown` imutável, **não** se trata como sucesso automático nem se sobrescreve — o caso SHALL ser encaminhado à resolução autorizada. Recusas isoladas (`primary_after_fallback`/`attempt_already_completed`/`attempt_limit_reached`) SHALL NOT ser gatilho. **Sem sinal de finalidade** (nenhum claim persistido, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou finalidade não provável), o encerramento SHALL ser **explicitamente autorizado e auditado** (motivo obrigatório + evidência), registrando a resolução (append-only, idempotente). O encerramento (automático ou autorizado) SHALL ocorrer sob a **mesma trava** da linha de crédito e transitar a operação para **terminal**, de modo que **qualquer tentativa posterior seja impedida atomicamente**. **O gatilho automático exige ausência de `in_progress` e SHALL NOT abandonar claim algum**; **finalizar um claim `in_progress` como `abandoned` pertence EXCLUSIVAMENTE ao encerramento autorizado**, sob a mesma trava, **com proteção contra o resultado atrasado**. O estorno SHALL ser persistido antes de qualquer anúncio. A recuperação financeira SHALL limitar-se a operações **não terminais**; `refunded` SHALL NOT retornar a `delivered`.

#### Scenario: Geração normal não estorna

- **WHEN** a operação é não terminal e a arte ainda não existe, com claim `in_progress`
- **THEN** consulta/reload não encerra nem estorna
- **AND** a geração continua

#### Scenario: Falha final com marcador gravado no ponto de decisão

- **WHEN** o marcador `generation_outcomes` **não** foi pré-salvo, mas o orquestrador **grava `outcome='failed'` com sucesso** no ponto de decisão terminal (sem próxima tentativa)
- **AND** não há claim `in_progress` e a sonda confirma `absent`
- **THEN** a recuperação reconhece a exceção pelo **gatilho persistido (4a)**
- **AND** encerra localmente com estorno confirmado uma vez
- **AND** a decisão é server-side, não confiando apenas no cliente

#### Scenario: Marcador não gravado vai para resolução autorizada

- **WHEN** a gravação de `outcome='failed'` **falha** (erro de escrita) **ou** já existe um `unknown` **imutável** para a operação
- **THEN** o caso SHALL NOT ser tratado como sucesso automático nem sobrescrever o marcador existente
- **AND** a operação permanece **não terminal**
- **AND** o caso SHALL ser encaminhado à **resolução autorizada e auditada** (`refund_once`)

#### Scenario: Recusas isoladas não comprovam falha final

- **WHEN** o único sinal é uma recusa de `acquire` (`primary_after_fallback`/`attempt_already_completed`/`attempt_limit_reached`) ou o `attempt_number` máximo de tentativa, **sem** marcador `outcome='failed'`
- **THEN** o predicado PF **não** é satisfeito
- **AND** nenhum encerramento nem estorno automático ocorre

#### Scenario: Sem sinal de finalidade exige autorização auditada

- **WHEN** não há claim persistido (nem `in_progress`), ou o estado é `in_progress`/`abandoned`/`unknown`, **ou** há retry/fallback pendente, **ou** a finalidade não é provável
- **THEN** nenhum estorno automático é executado
- **AND** o encerramento local exige autorização **explícita e auditada** (motivo + evidência)
- **AND** o cliente sozinho não autoriza o estorno

#### Scenario: Encerramento impede tentativa posterior

- **WHEN** o encerramento (automático ou autorizado) encerra a operação
- **THEN** ele ocorre sob a mesma trava da linha de crédito e a operação fica terminal
- **AND** qualquer tentativa posterior é recusada (`operation_terminal`)

#### Scenario: Encerramento local sem depender do provider

- **WHEN** a arte está ausente e o **gatilho persistido** está presente (falha **FINAL**, sem `in_progress`, sem retry/fallback pendente)
- **THEN** a operação é encerrada localmente como `refunded`
- **AND** nenhuma confirmação de encerramento do provider é exigida
- **AND** o estorno persistido é confirmado antes do anúncio

#### Scenario: Operação não fica presa por falta de encerramento externo

- **WHEN** não existe fonte externa comprovando o encerramento do provider
- **THEN** a operação não fica indefinidamente bloqueada por esse motivo
- **AND** o encerramento local com estorno confirmado é aplicado quando o gatilho persistido está presente

#### Scenario: Janela principal→fallback não satisfaz o gatilho

- **WHEN** o `primary` falhou (claim `failed`) e a próxima tentativa (retry/fallback) **ainda pode ser iniciada**
- **AND** **nenhum** marcador `outcome='failed'` foi gravado (a decisão terminal ainda não ocorreu)
- **THEN** o predicado PF **não** é satisfeito
- **AND** nenhum encerramento nem estorno automático ocorre

#### Scenario: Resolução autorizada reutiliza a resolução administrativa existente

- **WHEN** não há sinal de finalidade persistido (nenhum claim, `in_progress`/`abandoned`/`unknown`, ou finalidade não provável)
- **THEN** o encerramento SHALL ser **explicitamente autorizado e auditado** por **administrador autorizado** (motivo obrigatório + evidência server-derived)
- **AND** SHALL reutilizar `admin_resolve_product_1_1_pending` (ação `refund_once`; `invalid`/`indeterminate` bloqueiam)
- **AND** **somente** neste caminho autorizado o claim `in_progress` SHALL ser finalizado como `abandoned` na **mesma transação sob a trava** (o gatilho automático **não** abandona claim)
- **AND** um resultado **atrasado** da chamada já iniciada SHALL NOT sobrescrever o estado terminal (`finish` recusa `invalid_transition`; `deliver` recusado a partir de `refunded`)
- **AND** **nenhuma** confirmação de encerramento externo do provider é exigida
- **AND** o cliente **não** autoriza o estorno

#### Scenario: Recuperação financeira não toca operação terminal

- **WHEN** a operação está `delivered` ou `refunded`
- **THEN** nenhum estorno é aplicado
- **AND** `refunded` não retorna a `delivered`, mesmo que apareça imagem atrasada

### Requirement: Estorno idempotente e corrida entrega × estorno

O estorno SHALL ser **idempotente** por `campaignId + operation_id` e SHALL usar CAS/transição protegida. Na **corrida entrega × estorno**, se `delivered`/arte íntegra estiver comprovada, o estorno SHALL ser **recusado**; o estorno SHALL ocorrer apenas na ausência de arte.

#### Scenario: Corrida entrega × estorno

- **WHEN** a entrega e o estorno competem pela mesma operação
- **THEN** se a entrega for comprovada, o estorno é recusado
- **AND** há no máximo um efeito de ledger

#### Scenario: Estorno idempotente

- **WHEN** o estorno é solicitado mais de uma vez para a mesma operação
- **THEN** a reserva é devolvida uma única vez
- **AND** nenhuma devolução duplicada é registrada

#### Scenario: Entrega não pode ser estornada

- **WHEN** a operação está `delivered`
- **THEN** o estorno é recusado
- **AND** o consumo final é mantido

### Requirement: Resultado atrasado de operação estornada não reabre nem libera

Uma resposta/imagem **atrasada** de operação `refunded` SHALL NOT reabrir cobrança, SHALL NOT sobrescrever o estado e SHALL NOT liberar a nova campanha. A nova submissão SHALL ser uma **geração nova, com cobrança normal**.

#### Scenario: Resultado atrasado não reabre cobrança

- **WHEN** um resultado/imagem atrasado chega para uma operação `refunded`
- **THEN** nenhuma cobrança é reaberta
- **AND** o estado `refunded` permanece
- **AND** a operação não retorna a `delivered` mesmo com imagem atrasada

#### Scenario: Nova submissão é geração nova

- **WHEN** o lojista gera novamente após o estorno
- **THEN** a nova submissão é uma operação nova
- **AND** a cobrança é normal
- **AND** a operação estornada não libera nem bloqueia a nova campanha

#### Scenario: Chamada em voo neutralizada pelo encerramento

- **WHEN** uma chamada ao provider já iniciada retorna após o encerramento `refunded`
- **THEN** `recordOperationOutcome` devolve `operation_terminal`
- **AND** a entrega só transita `art_uploaded → delivered` (recusada a partir de `refunded`)
- **AND** o estado terminal `refunded` não é sobrescrito nem reabre cobrança

### Requirement: Falha de Storage/banco não autoriza estorno nem anúncio de crédito

Erro ou indisponibilidade ao consultar o Storage ou o banco SHALL NOT ser tratado como ausência confirmada. A operação SHALL reverificar e dar **feedback honesto**; se o estorno **não puder ser confirmado**, a UI SHALL NOT anunciar crédito devolvido.

#### Scenario: Indisponibilidade não estorna

- **WHEN** a consulta ao Storage/banco falha ou é ambígua
- **THEN** nenhum estorno é executado
- **AND** a operação é reverificada
- **AND** nenhum anúncio de crédito devolvido é feito

#### Scenario: Estorno não confirmado não é anunciado

- **WHEN** o estorno não pôde ser confirmado como persistido
- **THEN** a UI não anuncia crédito devolvido
- **AND** a autorização de recuperação/gratuidade permanece determinada pelo estado server-side
