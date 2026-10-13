# Product 1:1 Campaign Credit Billing

> F56.2b2 — estorno por **gatilho persistido** (ausência confirmada **+** **falha FINAL da operação, sem retry/fallback pendente**, **sem** `in_progress`), estorno idempotente e isolamento de resultado atrasado. Operação não terminal + arte ausente são **necessárias, mas não suficientes**; `failed` por tentativa com retry/fallback pendente **não** estorna. Preserva a operação atômica da b1a/b1b (`reserved → art_uploaded → delivered | refunded`; `delivered` terminal; `delivered_not_refundable`) e a identidade `campaignId + operation_id`.

## MODIFIED Requirements

### Requirement: Falha confirmada e resultado desconhecido

Falha **confirmada** sem arte utilizável SHALL gerar `refunded` **uma vez**. Resultado **desconhecido** (ex.: timeout) SHALL deixar a operação **pendente/limitada**, sem estorno baseado apenas em timeout e sem nova chamada cega, e **sem retomada** — nem automática, nem por reenvio do lojista. Timeout ou estado `reserved` isolados SHALL NOT autorizar estorno. A operação SHALL ser resolvida por **recuperação server-side** que consulta o Storage privado: **arte íntegra** → conclusão da entrega sem regenerar. Operação não terminal **e** arte ausente são **necessárias, mas NÃO suficientes** para estorno — essa é **também** a situação normal durante a geração; **consulta/reload durante a geração normal SHALL NOT autorizar estorno**. O **gatilho** que autoriza o **encerramento LOCAL** com `refunded` **uma única vez** (sem encerramento externo do provider e **sem** exigir o marcador `generation_outcomes` pré-salvo) SHALL ser: **(a)** **falha FINAL para a operação, sem retry/fallback pendente** — persistida como `outcome = 'failed'` de operação **ou** estado persistido que prove que **nenhuma tentativa adicional pode ser iniciada**; **(b)** **nenhum** claim `in_progress` para a operação; **e (c)** arte `absent` confirmada com operação não terminal. Um claim `failed` de uma tentativa que **ainda admite retry/fallback SHALL NOT** ser gatilho (o orquestrador grava `failed` e só depois decide a próxima tentativa). A recuperação financeira SHALL limitar-se a operações **não terminais** (`reserved`/`art_uploaded`); `delivered` e `refunded` são **terminais**, e `refunded` SHALL NOT retornar a `delivered`. **Sem sinal confiável** (nenhum claim persistido, ou estado `in_progress`/`abandoned`/`unknown`), o encerramento local SHALL ser **explicitamente autorizado e auditado** (motivo obrigatório + evidência), registrando a resolução (append-only, idempotente); **nunca** se infere erro da mera ausência. Quando o resultado permanecer **indeterminado**, a resolução SHALL ocorrer por **administrador autorizado**, com **motivo obrigatório** e **registro auditável das evidências e da transição** (sem dois aprovadores nesta versão), **sem re-queue** e **sem nova geração administrativa**. A “fila de atendimento” é **somente lista de pendências, sem execução automática**.

#### Scenario: Falha confirmada estorna uma vez

- **WHEN** a operação encerra por falha confirmada sem arte utilizável
- **THEN** o crédito reservado é devolvido uma única vez
- **AND** nenhuma cobrança final permanece

#### Scenario: Exceção reconhecida pelo gatilho persistido estorna uma vez

- **WHEN** a operação é não terminal e a arte está `absent` confirmada
- **AND** a falha é **FINAL para a operação** (`outcome = 'failed'` de operação, ou nenhuma tentativa adicional possível), **sem retry/fallback pendente**
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

O encerramento de uma operação sem arte SHALL ser **local** ao servidor e SHALL NOT depender de comprovar que o provider encerrou **nem** de o marcador `generation_outcomes` já estar gravado. Operação não terminal **e** arte ausente são **necessárias, mas NÃO suficientes** para o encerramento. O encerramento SHALL exigir o **gatilho persistido** de **falha FINAL para a operação, sem retry/fallback pendente**: **(a)** `outcome = 'failed'` de operação **ou** estado persistido que prove que **nenhuma tentativa adicional pode ser iniciada**; **e (b)** **nenhum** claim `in_progress` para a operação; **e (c)** arte `absent` confirmada com operação não terminal. **Sem sinal de finalidade** (nenhum claim persistido, `in_progress`/`abandoned`/`unknown`, retry/fallback pendente, ou finalidade não provável), o encerramento SHALL ser **explicitamente autorizado e auditado** (motivo obrigatório + evidência), registrando a resolução (append-only, idempotente). O encerramento (automático ou autorizado) SHALL ocorrer sob a **mesma trava** da linha de crédito e transitar a operação para **terminal**, de modo que **qualquer tentativa posterior seja impedida atomicamente**. O estorno SHALL ser persistido antes de qualquer anúncio. A recuperação financeira SHALL limitar-se a operações **não terminais**; `refunded` SHALL NOT retornar a `delivered`.

#### Scenario: Geração normal não estorna

- **WHEN** a operação é não terminal e a arte ainda não existe, com claim `in_progress`
- **THEN** consulta/reload não encerra nem estorna
- **AND** a geração continua

#### Scenario: Falha final sem marcador prévio

- **WHEN** o marcador `generation_outcomes` não foi salvo, mas a finalidade da falha é provável server-side (nenhuma tentativa adicional possível)
- **AND** não há claim `in_progress` e a sonda confirma `absent`
- **THEN** a recuperação reconhece a exceção pelo **gatilho persistido**
- **AND** encerra localmente com estorno confirmado uma vez
- **AND** a decisão é server-side, não confiando apenas no cliente

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
