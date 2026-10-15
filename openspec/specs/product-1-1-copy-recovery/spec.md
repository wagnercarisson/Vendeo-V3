# Product 1:1 Copy Recovery

> Synced from `fase-56-2b1b-nucleo-entregavel-produto-1-1` (ADDED) and `fase-56-2b2a-recuperacao-de-copy-produto-1-1` (2 MODIFIED + 8 ADDED).

## Purpose

Tratamento da **copy** no novo fluxo Produto 1:1: falha de copy não bloqueia a arte entregue, copy pendente não prolonga a entrega da imagem, estados persistidos com feedback seguro e **recuperação de copy como falha de entrega** — tentativas identificadas (3 automáticas + 3 manuais), histórico preservado e proteção contra conclusão atrasada.

## Requirements

### Requirement: Falha de copy não bloqueia arte entregue

Falha apenas da copy SHALL ser persistida sem bloquear download da arte entregue; não SHALL gerar crédito adicional. A recuperação de copy SHALL ser oferecida **somente** quando a copy estiver pendente/falha, SHALL NOT regenerar nem alterar a imagem, e a imagem `delivered` SHALL permanecer **acessível** durante toda a recuperação.

#### Scenario: Copy falha

- **WHEN** arte é íntegra e operação `delivered`, mas copy falha
- **THEN** arte permanece baixável, estado de falha persiste e reserva é finalizada uma vez

#### Scenario: Recuperação não bloqueia a arte

- **WHEN** a copy está em recuperação sobre uma arte `delivered`
- **THEN** a imagem entregue permanece baixável durante toda a recuperação
- **AND** a imagem não é regenerada nem modificada

### Requirement: Copy pendente não prolonga a entrega da imagem

A entrega da imagem SHALL ser independente do estado da copy. Copy pendente SHALL NOT prolongar indefinidamente a entrega da imagem; a operação de imagem SHALL ser finalizada (`delivered`) segundo suas próprias evidências, sem aguardar a conclusão da copy.

#### Scenario: Imagem entrega com copy pendente

- **WHEN** a arte está íntegra e entregável, mas a copy ainda está pendente
- **THEN** a entrega da imagem é finalizada como `delivered`
- **AND** a pendência de copy não bloqueia nem adia indefinidamente a imagem

#### Scenario: Arte pendente não é liberada por copy

- **WHEN** a copy foi concluída mas a arte não está íntegra/`delivered`
- **THEN** o download da imagem permanece recusado

### Requirement: Estados persistidos e feedback seguro

Os estados da copy (pendente, concluída, falha) e as **tentativas identificadas** SHALL ser persistidos e exibidos ao lojista com **feedback seguro** (sem motivo interno). Cancelamentos SHALL ser tratados separadamente do estado de copy e não SHALL ser confundidos com falha de geração. Esta change SHALL NOT prometer **retomada automática**: se o navegador for fechado, o ciclo automático não continua e a retomada é **manual**. Após esgotar as tentativas automáticas, SHALL ser ofertada **ação manual e suporte**.

O estado `pending` SHALL NOT, por si só, comprovar **execução ativa**: o servidor SHALL distinguir tentativa **ativa** de tentativa **interrompida** (ex.: por posse/lease da tentativa confirmada server-side), SHALL verificar as esperas (5s/10s) **server-side** e SHALL classificar como **interrompida** uma tentativa cuja atividade não seja comprovada — exibindo-a **sem spinner** e permitindo retomada **manual**, sem aceitar a conclusão **atrasada** de tentativa superada.

#### Scenario: Estado exibido ao retornar

- **WHEN** o lojista retorna ao aplicativo
- **THEN** o estado persistido da copy é exibido
- **AND** o feedback ao lojista não expõe motivo interno

#### Scenario: Cancelamento separado

- **WHEN** a operação é cancelada pelo lojista
- **THEN** o cancelamento é registrado separadamente do estado de copy
- **AND** não é classificado como falha de geração

#### Scenario: Sem retomada após fechar o navegador

- **WHEN** o navegador é fechado durante a recuperação
- **THEN** o ciclo automático não continua
- **AND** a UI não promete retomada automática
- **AND** a retomada ocorre por tentativa manual

#### Scenario: Tentativa interrompida não é ativa

- **WHEN** existe um registro `pending` cuja atividade NÃO é comprovada pelo servidor (ex.: requisição encerrada sem gravação final)
- **THEN** o servidor classifica a tentativa como **interrompida** (não ativa)
- **AND** a UI não mantém spinner e oferece retomada **manual**
- **AND** nenhuma espera automática é tomada como em curso

#### Scenario: Outra aba apenas acompanha

- **WHEN** uma segunda aba/`reload` abre enquanto há uma espera automática persistida
- **THEN** ela **apenas acompanha** o estado do servidor
- **AND** **não** retoma automaticamente o ciclo a partir da espera persistida
- **AND** somente a aba que **dirige** o acionamento mantém o ciclo

#### Scenario: Ligação da aba iniciadora com o ciclo

- **WHEN** uma geração é iniciada
- **THEN** a aba **iniciadora** registra um **handle de condução** (client-side, efêmero, por aba) lido pela página de resultado
- **AND** o fluxo **geração inicial → resultado → espera → 2ª automática** é dirigido por esse handle
- **AND** `reload`/outra aba, sem o handle, **apenas acompanham** (retomada manual)

#### Scenario: Espera verificada pelo servidor

- **WHEN** o estado persistido indica espera entre tentativas automáticas (5s/10s)
- **THEN** o servidor é a fonte da verdade sobre a espera vigente
- **AND** a interface apenas reflete o que o servidor reporta
- **AND** a conclusão atrasada de uma tentativa superada é rejeitada

### Requirement: Ação de nova tentativa somente no estado pendente/falha

A recuperação SHALL ser exposta **somente** quando a copy estiver pendente/falha. Copy **entregue** SHALL encerrar a recuperação.

#### Scenario: Ação exibida apenas no estado pendente/falha

- **WHEN** a copy está pendente/falha
- **THEN** a ação de recuperação é exibida
- **AND** em qualquer outro estado a ação não é exibida

#### Scenario: Copy entregue encerra a recuperação

- **WHEN** a copy está `completed` com conteúdo entregável
- **THEN** nenhuma tentativa nova é oferecida
- **AND** a recuperação é encerrada

### Requirement: Ação autenticada com ownership

A recuperação SHALL exigir autenticação e verificação de **ownership** da campanha/loja. A ação SHALL também exigir que a campanha pertença ao **novo fluxo**, que o `operationId` **corresponda** à campanha e que a **elegibilidade/autorização vigente** seja respeitada; com o fluxo **desligado** (`off`), a ação SHALL ser **negada sem chamada de IA**. `mode`, sequência e token enviados pelo cliente SHALL ser tratados como **solicitações**, nunca como **autoridade** (a autorização e a identidade corrente são decididas **server-side**).

#### Scenario: Sem ownership a ação é negada

- **WHEN** um usuário sem ownership tenta acionar a recuperação
- **THEN** a ação é negada
- **AND** nenhuma chamada de IA é executada

#### Scenario: Fluxo desligado nega a ação sem IA

- **WHEN** o novo fluxo está desligado (elegibilidade/autorização `off`)
- **THEN** a recuperação é negada
- **AND** nenhuma chamada de IA é executada

#### Scenario: Identidade divergente é negada

- **WHEN** a campanha não pertence ao novo fluxo ou o `operationId` enviado diverge da campanha
- **THEN** a recuperação é negada
- **AND** nenhuma chamada de IA é executada
- **AND** valores enviados pelo cliente não são aceitos como autoridade

### Requirement: A recuperação tenta somente os textos e não regenera a imagem

A recuperação SHALL tentar **apenas** os textos (`campaign_copy`), SHALL NOT alterar/regerar a imagem e SHALL NOT consumir outro crédito do lojista. O débito da campanha permanece o mesmo.

#### Scenario: Somente textos

- **WHEN** a recuperação é executada com sucesso
- **THEN** apenas os textos de copy são gerados novamente
- **AND** a imagem não é alterada nem regerada

#### Scenario: Sem novo crédito

- **WHEN** a recuperação é executada
- **THEN** nenhum crédito adicional é consumido
- **AND** o débito da campanha permanece o mesmo

### Requirement: Política de recuperação de copy por tentativas

A recuperação SHALL seguir: 1ª tentativa até **30 segundos**; em falha **transitória**, esperar **5 segundos** e 2ª tentativa até **30 segundos**; em nova falha **transitória**, esperar **10 segundos** e 3ª tentativa até **30 segundos**; após falhar nas três, SHALL ofertar **ação manual e suporte**. SHALL ser permitido no máximo **3 tentativas manuais** adicionais, totalizando **6 tentativas por entrega**. Cada clique manual SHALL iniciar **somente uma** tentativa e SHALL NOT reiniciar o ciclo automático. O sucesso SHALL encerrar as tentativas. Falhas **definitivas** de configuração/permissão SHALL NOT receber repetição cega.

A aquisição de cada tentativa SHALL ser decidida **atomicamente pelo servidor**, sob uma **trava estável da operação**, **antes de qualquer chamada ao provider** (inclusive fallback): o servidor decide se há tentativa **ativa**, o próximo `attempt_seq`, os **limites** (3 automáticas + 3 manuais = 6) e se a entrega **já obteve sucesso**. Requisições concorrentes SHALL resultar em **exatamente uma** tentativa adquirida; as requisições **perdedoras** SHALL apenas acompanhar. **Cada chamada efetiva de provider** (primária **ou** fallback) SHALL ocupar **uma única** tentativa identificada e seguir esta política (orçamento/esperas/limites); **NÃO** SHALL existir **fallback escondido** dentro de um acionamento. As **transições de `mode`** SHALL ser validadas **server-side**: **NÃO** SHALL haver nova tentativa **automática** após uma falha **definitiva** nem após o início da recuperação **manual**; alterar o `mode` no corpo da requisição SHALL NOT reabrir o ciclo **automático**.

#### Scenario: Ciclo automático com esperas

- **WHEN** a 1ª tentativa falha de forma transitória
- **THEN** o sistema aguarda 5 segundos antes da 2ª tentativa
- **AND** em nova falha transitória aguarda 10 segundos antes da 3ª tentativa
- **AND** cada tentativa respeita o teto de 30 segundos

#### Scenario: Esgotamento das três automáticas oferta ação manual

- **WHEN** as três tentativas automáticas falham
- **THEN** é ofertada ação manual e suporte

#### Scenario: Limite de 6 tentativas por entrega

- **WHEN** o lojista aciona tentativas manuais
- **THEN** no máximo 3 tentativas manuais adicionais ocorrem
- **AND** o total não excede 6 tentativas por entrega

#### Scenario: Clique manual inicia uma tentativa e não reinicia o ciclo

- **WHEN** o lojista clica na ação manual
- **THEN** exatamente uma tentativa é iniciada
- **AND** o ciclo automático não é reiniciado

#### Scenario: Sucesso encerra as tentativas

- **WHEN** uma tentativa entrega a copy
- **THEN** as tentativas são encerradas
- **AND** nenhuma nova tentativa é iniciada

#### Scenario: Falha definitiva não repete cegamente

- **WHEN** a falha é definitiva (configuração/permissão)
- **THEN** nenhuma repetição cega é executada
- **AND** o lojista recebe ação manual e suporte

#### Scenario: Aquisição atômica concorrente

- **WHEN** duas requisições de recuperação chegam simultaneamente para a mesma entrega
- **THEN** o servidor adquire **exatamente uma** tentativa sob a trava da operação
- **AND** a requisição perdedora apenas **acompanha**, sem iniciar outra chamada
- **AND** nenhum contador é reiniciado e o teto de 6 não é excedido

#### Scenario: Fallback é tentativa própria

- **WHEN** a produção da copy sofreria uma falha transitória na primária
- **THEN** **NENHUMA** segunda chamada é executada **dentro da MESMA tentativa/acionamento**
- **AND** a tentativa **seguinte** (que PODE usar um alvo de fallback) é **adquirida** e segue a política — **contadores, limites e esperas**
- **AND** cada chamada efetiva corresponde a **uma** tentativa identificada e é **contabilizada** (nenhuma oculta)
- **AND** a decisão de adquirir a tentativa ocorre **antes** da chamada ao provider

#### Scenario: Modo automático não é reaberto

- **WHEN** houve uma falha **definitiva** ou o lojista migrou para a recuperação **manual**
- **THEN** o servidor **recusa** nova tentativa **automática**
- **AND** alterar o `mode` no corpo da requisição **não** reabre o ciclo automático
- **AND** apenas o acionamento **manual** (dentro do limite) permanece disponível

### Requirement: Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada

Cada tentativa SHALL ter **identidade** própria (sequência + token) e SHALL ser registrada **sem sobrescrever** tentativas anteriores. A conclusão/terminal **atrasado** de uma tentativa **superada** SHALL ser **rejeitado** e SHALL NOT sobrescrever o estado persistido. Linhas terminais (`completed`/`failed`) SHALL NOT ser reabertas nem sobrescritas. A persistência SHALL preservar o **histórico** das tentativas. A **migração de registros existentes** (produzidos pela b1b) SHALL preservar o **vínculo da MESMA tentativa** entre estado e cancelamento e SHALL **restaurar a proteção de imutabilidade** ao final da migração. Uma tentativa **expirada** (`pending` com posse/**lease** vencido) SHALL ser encerrada **atomicamente** e a **próxima** tentativa adquirida na **mesma** transação, preservando o histórico e rejeitando a conclusão **atrasada** da tentativa expirada (`stale_attempt`). A tentativa **histórica** da b1b SHALL ser atribuída ao contador **automático** (`attempt_seq = 1`, `kind='auto'`).

#### Scenario: Histórico preservado

- **WHEN** há múltiplas tentativas para a mesma entrega
- **THEN** cada tentativa é registrada sem sobrescrever as anteriores
- **AND** a sequência de tentativas é reconstruível

#### Scenario: Conclusão atrasada rejeitada

- **WHEN** uma tentativa superada tenta persistir sua conclusão depois do início de outra tentativa
- **THEN** a escrita é rejeitada
- **AND** o estado persistido permanece inalterado

#### Scenario: Terminal não sobrescrito

- **WHEN** uma linha terminal já está persistida
- **THEN** ela não é reaberta nem sobrescrita por uma transição não-terminal
- **AND** um `completed` persistido nunca é substituído

#### Scenario: Migração preserva vínculo e imutabilidade

- **WHEN** registros existentes da b1b (estado e cancelamento) são migrados para o modelo por tentativa
- **THEN** o vínculo da **mesma tentativa** entre estado e cancelamento é preservado
- **AND** a proteção de **imutabilidade** do cancelamento é **restaurada** ao final da migração
- **AND** um `UPDATE`/`DELETE` posterior no cancelamento é **negado**

#### Scenario: Tentativa expirada é encerrada e a próxima é adquirida

- **WHEN** a tentativa corrente está `pending` com o **lease vencido**
- **THEN** o servidor encerra essa tentativa **atomicamente** (terminal, `stale_attempt`) e adquire a **próxima** na MESMA transação
- **AND** a conclusão **atrasada** da tentativa expirada é **rejeitada**
- **AND** o histórico é preservado

#### Scenario: Tentativa histórica conta como automática

- **WHEN** existe a tentativa histórica da b1b para a entrega
- **THEN** ela é atribuída ao contador **automático** (`attempt_seq = 1`, `kind='auto'`)
- **AND** as tentativas subsequentes respeitam o teto restante (5)

#### Scenario: Backfill aplicado pelo CLI registra a versão

- **WHEN** a migration de backfill é aplicada
- **THEN** ela é aplicada **pelo CLI** (`migration up --local`), **registrando a versão** em `supabase_migrations.schema_migrations`
- **AND** a **prova de migração** é **separada** da execução **recorrente** das suítes
- **AND** se a `0003` **ainda não** estiver aplicada, as fixtures são preparadas e a migração é provada na **instância ATUAL**, **SEM RESET**
- **AND** se a `0003` **já** estiver aplicada, o executor **PARA** e solicita uma **instância de prova SEPARADA**, **sem destruir** a existente

### Requirement: Anti-duplicação e contabilização de chamadas

Cliques duplicados, reload e reenvio SHALL NOT duplicar chamadas nem reiniciar contadores. As chamadas técnicas/fallback SHALL ser **contabilizadas no limite**, sem tentativas escondidas. Cada **chamada efetiva** SHALL corresponder a **uma** tentativa identificada. A **idempotência** SHALL valer para o **MESMO acionamento** ao **longo do tempo** (reenvio atrasado), não apenas para chamadas **simultâneas**: um reenvio do mesmo acionamento SHALL NOT adquirir uma **nova** tentativa nem consumir outro slot. A identidade enviada pelo cliente SHALL funcionar como **condição validada** (dedupe) — **nunca** como **autoridade** nem como escolha do **vencedor**.

A identidade de acionamento (`request_token`) SHALL identificar **um acionamento (uma tentativa)**: cada **nova** tentativa — as **automáticas 2 e 3** e cada **clique manual** — SHALL receber um **token próprio**; **somente** o **reenvio do MESMO acionamento** SHALL reutilizar o token (⇒ `already_acquired`, sem dupla contagem). O **handle de condução** da aba SHALL identificar o **ciclo/aba**, **nunca** impor um único token a todas as tentativas.

#### Scenario: Clique duplo e reload não duplicam

- **WHEN** a mesma recuperação é acionada duas vezes (clique duplo/reload/reenvio)
- **THEN** apenas uma execução efetiva ocorre
- **AND** nenhum contador é reiniciado

#### Scenario: Reenvio atrasado não adquire nova tentativa

- **WHEN** um reenvio do MESMO acionamento (mesmo `request_token`) chega **depois** de a tentativa anterior já ter falhado
- **THEN** o reenvio **não** adquire uma **nova** tentativa nem consome outro slot
- **AND** a identidade enviada pelo cliente é usada apenas como **condição validada** (dedupe), sem autorizar nem escolher o vencedor

#### Scenario: Cada automática recebe token próprio

- **WHEN** o ciclo automático avança da 1ª para a 2ª e a 3ª tentativa
- **THEN** **cada** tentativa recebe um **token próprio** (diferente das demais)
- **AND** **somente** o reenvio do **mesmo** acionamento reutiliza o token (⇒ `already_acquired`)
- **AND** nenhuma automática é bloqueada por reutilizar o token de uma tentativa anterior

#### Scenario: Acionamento sem identidade é recusado

- **WHEN** a API de acionamento recebe uma requisição **sem** a identidade de acionamento (`request_token`)
- **THEN** a requisição é **recusada** (`missing_request_token`)
- **AND** nenhuma aquisição de tentativa nem chamada de IA é executada
- **AND** a tentativa **inicial interna** (drenagem no ciclo da b1b) pode gerar o **próprio** token server-side

#### Scenario: Chamada técnica/fallback contabilizada

- **WHEN** a produção da copy envolve chamada técnica ou fallback
- **THEN** a chamada é contabilizada no limite
- **AND** nenhuma tentativa é escondida do contador

### Requirement: Registro de custo interno sem crédito ao lojista

A recuperação SHALL registrar o **custo interno** da chamada, sem convertê-lo em crédito do lojista.

#### Scenario: Custo interno registrado

- **WHEN** a chamada de copy é executada
- **THEN** o custo interno é registrado
- **AND** não é convertido em crédito do lojista

### Requirement: Recuperação de copy independente do estado da imagem

A recuperação de copy SHALL funcionar com a imagem já `delivered` e SHALL NOT tocar a operação financeira nem a arte. O **terminal financeiro** da imagem (`delivered`/`refunded`) **NÃO** é o terminal da **copy**: uma imagem `delivered` (ou operação financeira terminal) SHALL NOT encerrar nem bloquear a recuperação dos **textos**, e a aquisição de tentativa SHALL NOT recusar por o crédito/operação estar `delivered`/`refunded`.

#### Scenario: Copy recuperada com imagem entregue

- **WHEN** a imagem está `delivered` e a copy está pendente/falha
- **THEN** a recuperação de copy é executada
- **AND** a operação financeira e a arte permanecem inalteradas

#### Scenario: Imagem delivered não bloqueia a recuperação

- **WHEN** a operação financeira está terminal (`delivered`/`refunded`) e a copy está pendente/falha
- **THEN** a aquisição de tentativa de recuperação é **admitida** (não recusada por `operation_terminal`)
- **AND** apenas o **terminal da copy** (`completed`) encerra a recuperação
