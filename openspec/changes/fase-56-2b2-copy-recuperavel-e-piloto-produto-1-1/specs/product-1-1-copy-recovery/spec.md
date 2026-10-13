# Product 1:1 Copy Recovery

> F56.2b2 — recuperação de copy como **falha de entrega** sobre a entrega não bloqueante da F56.2b1b. Substitui o "retry único/genérico" por tentativas identificadas, histórico preservado e proteção contra conclusão atrasada. A copy **entregue encerra** a recuperação; texto mal elaborado é **editável pelo lojista** e **não** autoriza nova geração. `COPY_BUDGET_MS = 30s`; `completed`/`failed` são **terminais protegidos**.

## MODIFIED Requirements

### Requirement: Falha de copy não bloqueia arte entregue

Falha apenas da copy SHALL ser persistida sem bloquear download da arte entregue; não SHALL gerar crédito adicional. A recuperação de copy SHALL ser oferecida **somente** quando a copy estiver pendente/falha, SHALL NOT regenerar nem alterar a imagem, e a imagem `delivered` SHALL permanecer **acessível** durante toda a recuperação.

#### Scenario: Copy falha

- **WHEN** arte é íntegra e operação `delivered`, mas copy falha
- **THEN** arte permanece baixável, estado de falha persiste e reserva é finalizada uma vez

#### Scenario: Recuperação não bloqueia a arte

- **WHEN** a copy está em recuperação sobre uma arte `delivered`
- **THEN** a imagem entregue permanece baixável durante toda a recuperação
- **AND** a imagem não é regenerada nem modificada

### Requirement: Estados persistidos e feedback seguro

Os estados da copy (pendente, concluída, falha) e as **tentativas identificadas** SHALL ser persistidos e exibidos ao lojista com **feedback seguro** (sem motivo interno). Cancelamentos SHALL ser tratados separadamente do estado de copy e não SHALL ser confundidos com falha de geração. Esta change SHALL NOT prometer **retomada automática**: se o navegador for fechado, o ciclo automático não continua e a retomada é **manual**. Após esgotar as tentativas automáticas, SHALL ser ofertada **ação manual e suporte**.

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

## ADDED Requirements

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

A recuperação SHALL exigir autenticação e verificação de **ownership** da campanha/loja.

#### Scenario: Sem ownership a ação é negada

- **WHEN** um usuário sem ownership tenta acionar a recuperação
- **THEN** a ação é negada
- **AND** nenhuma chamada de IA é executada

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

### Requirement: Tentativas identificadas, histórico preservado e proteção contra conclusão atrasada

Cada tentativa SHALL ter **identidade** própria (sequência + token) e SHALL ser registrada **sem sobrescrever** tentativas anteriores. A conclusão/terminal **atrasado** de uma tentativa **superada** SHALL ser **rejeitado** e SHALL NOT sobrescrever o estado persistido. Linhas terminais (`completed`/`failed`) SHALL NOT ser reabertas nem sobrescritas. A persistência SHALL preservar o **histórico** das tentativas.

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

### Requirement: Anti-duplicação e contabilização de chamadas

Cliques duplicados, reload e reenvio SHALL NOT duplicar chamadas nem reiniciar contadores. As chamadas técnicas/fallback SHALL ser **contabilizadas no limite**, sem tentativas escondidas.

#### Scenario: Clique duplo e reload não duplicam

- **WHEN** a mesma recuperação é acionada duas vezes (clique duplo/reload/reenvio)
- **THEN** apenas uma execução efetiva ocorre
- **AND** nenhum contador é reiniciado

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
