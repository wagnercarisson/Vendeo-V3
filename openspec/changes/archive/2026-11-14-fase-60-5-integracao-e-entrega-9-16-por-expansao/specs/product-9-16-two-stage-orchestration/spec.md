# Product 9:16 Two-Stage Orchestration

## Purpose

Define o percurso integrado do novo 9:16 por expansão: uma solicitação escolhe um único formato, abre uma operação `9_16_two_stage` com uma reserva de 1 crédito, executa base + preparação + expansão, continua a mesma operação entre requisições, distingue processamento de resultado desconhecido, confirma o crédito somente na entrega vertical e desliga novas gerações do 9:16 direto sem converter campanhas históricas.

## ADDED Requirements

### Requirement: Uma solicitação escolhe um único formato

O sistema SHALL associar cada solicitação ao formato escolhido pelo lojista. O formato `1:1` SHALL permanecer no caminho atual, sem mudança funcional de entrada, resposta, crédito ou entrega. O formato `9:16` SHALL usar o orquestrador de duas etapas. O sistema SHALL NOT gerar dois formatos na mesma solicitação, SHALL NOT adquirir o outro formato posteriormente e SHALL NOT converter uma campanha existente de um formato para o outro.

#### Scenario: 1:1 permanece no caminho atual

- **WHEN** uma solicitação é enviada com formato `1:1`
- **THEN** o sistema SHALL usar o orquestrador atual do Produto 1:1
- **AND** SHALL NOT abrir operação `9_16_two_stage`, reservar crédito vertical ou carregar o módulo de expansão

#### Scenario: 9:16 usa o orquestrador novo

- **WHEN** uma solicitação é enviada com formato `9:16` e o novo caminho está habilitado
- **THEN** o sistema SHALL abrir uma operação `9_16_two_stage`
- **AND** SHALL executar base, preparação, expansão e entrega vertical
- **AND** SHALL NOT chamar o orquestrador completo 1:1 para gerar a base

#### Scenario: Dois formatos são recusados

- **WHEN** uma solicitação tenta declarar ou adquirir mais de um formato
- **THEN** o sistema SHALL recusar sem abrir operação, reservar crédito ou chamar provider

### Requirement: Origem canônica persistida e verificável

O sistema SHALL persistir a origem do novo percurso em `campaigns.input_snapshot` com `generationOrigin = "9_16_two_stage"` e uma versão de contrato reconhecida, sem alterar o contrato de formato existente. A origem SHALL ser decidida por essas chaves persistidas mais a linha de controle `(campaign_id, operation_id)`; o sistema SHALL NOT inferir a origem pelo formato isoladamente, pelo path ou pela presença de uma imagem.

#### Scenario: Campanha nova grava a origem

- **WHEN** uma campanha 9:16 é criada pelo novo caminho
- **THEN** o snapshot persistido SHALL conter o par de origem/versão reconhecido
- **AND** o par SHALL participar da comparação de conteúdo idempotente da campanha

#### Scenario: Campanha histórica não é confundida

- **WHEN** uma campanha 9:16 existente não possui o par de origem nova
- **THEN** o sistema SHALL classificá-la como histórica
- **AND** SHALL NOT abrir operação `9_16_two_stage` para ela

#### Scenario: Marcador inconsistente falha fechado

- **WHEN** o marcador de origem está presente porém malformado, desconhecido ou sem linha de controle em uma leitura
- **THEN** o sistema SHALL classificar a origem como indeterminada
- **AND** SHALL NOT iniciar geração, entrega, estorno ou download

### Requirement: Abertura única com uma reserva de 1 crédito

O sistema SHALL abrir no máximo uma operação por identidade `(campaign_id, operation_id)`. A abertura SHALL reservar exatamente 1 crédito por meio da autoridade financeira existente e vincular a reserva à mesma identidade. Reenvios equivalentes SHALL reutilizar a operação e a reserva existentes. Nenhuma etapa, preparação, tentativa ou continuação SHALL criar nova reserva.

#### Scenario: Abertura reserva uma vez

- **WHEN** um pedido 9:16 é aberto pela primeira vez
- **THEN** exatamente 1 crédito SHALL ser reservado
- **AND** a reserva SHALL estar vinculada a `(campaign_id, operation_id)`

#### Scenario: Reenvio não reserva de novo

- **WHEN** o mesmo pedido é reenviado com a mesma identidade
- **THEN** o sistema SHALL resolver a operação e a reserva existentes
- **AND** SHALL NOT debitar outro crédito, abrir outra operação ou criar outra etapa

#### Scenario: Etapas não reservam

- **WHEN** base, preparação, expansão, retry ou entrega são executados
- **THEN** o sistema SHALL NOT chamar reserva de crédito
- **AND** o saldo reservado SHALL permanecer o da abertura

### Requirement: Base quadrada e copy como etapa interna

O sistema SHALL executar a etapa `base` por meio do módulo F60.4, fornecendo identidade, autorização, conteúdo congelado, tentativa F60 e orçamento. A conclusão da base SHALL persistir a arte quadrada e SHALL NOT entregar campanha, confirmar crédito ou encerrar a operação. A falha ou indisponibilidade da copy SHALL NOT impedir a conclusão da base nem a entrega do vertical.

#### Scenario: Base concluída sem entrega

- **WHEN** a etapa `base` termina com sucesso
- **THEN** a arte quadrada SHALL estar persistida e a etapa SHALL estar `done`
- **AND** o crédito SHALL permanecer reservado
- **AND** SHALL NOT haver entrega, confirmação de crédito ou vertical final
- **AND** a operação SHALL permanecer não terminal

#### Scenario: Copy falha e vertical continua

- **WHEN** a copy falha, fica pendente ou indisponível durante a base
- **THEN** a arte quadrada SHALL permanecer válida
- **AND** a operação SHALL poder seguir para preparação, expansão e entrega do vertical

#### Scenario: Copy concluída é reutilizada

- **WHEN** a copy da operação já está concluída
- **THEN** uma nova invocação SHALL reutilizar o texto persistido
- **AND** SHALL NOT gerar outra copy, outra imagem ou outro crédito

### Requirement: Primeira execução recuperável antes do congelado da F60.4

O sistema SHALL permitir retomar uma operação aberta e reservada mesmo quando a requisição inicial terminou antes de a F60.4 persistir o snapshot/evidência congelados. Nesse intervalo, a reconstrução SHALL usar somente dados duráveis da campanha e os arquivos de entrada persistidos, verificados por conteúdo, papel e índice. A reconstrução SHALL reproduzir a **string exata do data URL** (`dataUrlPrefix + base64(bytes)`) e verificar `sha256(dataUrl) === contentId`; o hash da F60.4 SHALL NOT ser alterado para hash de bytes. O sistema SHALL NOT ler dados atuais da loja para reconstruir o briefing/contexto e SHALL NOT aceitar um briefing novo do navegador como substituto. O estado congelado F60.4 permanece a autoridade: arte íntegra sozinha SHALL NOT concluir a base.

#### Scenario: Campanha reservada sem congelado F60.4

- **WHEN** a operação está reservada, a base está pendente e não existe snapshot/evidência F60.4
- **THEN** o sistema SHALL reconstruir briefing, contexto, intenção, direção, imagens e seleções a partir do snapshot durável da campanha e dos arquivos de entrada
- **AND** SHALL executar a primeira composição com `runSquareBase`
- **AND** SHALL NOT ler dados atuais da loja nem aceitar briefing novo do navegador

#### Scenario: Hash do data URL exato é reproduzido

- **WHEN** uma imagem é persistida e depois reconstruída
- **THEN** o sistema SHALL montar `dataUrlPrefix + base64(bytes)` preservando MIME/prefixo/encoding
- **AND** SHALL verificar `sha256(dataUrl) === contentId` e a igualdade com `frozenContentReferences`
- **AND** SHALL NOT usar hash dos bytes como substituto

#### Scenario: Data URL não reconstruível é recusado antes da reserva

- **WHEN** o data URL recebido não pode ser reproduzido exatamente por prefixo + base64 canônico
- **THEN** o sistema SHALL recusar a entrada antes de reservar crédito
- **AND** SHALL NOT alterar o contrato de hash da F60.4 nem persistir um hash divergente

#### Scenario: Arquivos de entrada são persistidos antes da reserva

- **WHEN** uma campanha 9:16 é criada
- **THEN** os arquivos originais de produto/identidade e os descritores de conteúdo (incluindo prefixo exato) SHALL ser persistidos antes de `reserveOperationOnce`
- **AND** falha comprovada de persistência SHALL impedir reserva/crédito
- **AND** os arquivos SHALL reproduzir o hash do data URL usado nas seleções congeladas
- **AND** depois da reserva, falha de requisição SHALL NOT removê-los

#### Scenario: Arquivos de entrada são verificados

- **WHEN** a reconstrução usa imagens de produto/identidade
- **THEN** cada arquivo SHALL ser verificado contra o hash do data URL exato, papel e índice persistidos
- **AND** um arquivo ausente, divergente ou extra SHALL bloquear a execução

#### Scenario: Contexto e snapshot econômico duráveis

- **WHEN** a copy ou a telemetria da primeira execução é reconstruída
- **THEN** o contexto de copy e o snapshot econômico SHALL vir do snapshot durável da campanha
- **AND** SHALL NOT ser recalculados a partir da loja atual

#### Scenario: Arte sem congelado admissível bloqueia

- **WHEN** existe `square_original` íntegro, mas não existe estado congelado `complete`/`repairable` com binding da mesma operação
- **THEN** o sistema SHALL bloquear (`artifact_without_frozen_state`/conflito)
- **AND** SHALL NOT concluir a base pela mera presença da imagem

#### Scenario: Reconstrução confirmada falha sem chamada paga

- **WHEN** um arquivo de entrada está comprovadamente ausente ou divergente, ou o contexto congelado necessário não existe
- **THEN** o sistema SHALL NOT chamar provider
- **AND** SHALL seguir o encerramento de falha sem entrega/estorno único quando não houver vertical

#### Scenario: Reconstrução indeterminada não cobra

- **WHEN** a leitura dos arquivos de entrada é indeterminada
- **THEN** o sistema SHALL devolver processamento para nova tentativa gratuita
- **AND** SHALL NOT chamar provider, confirmar ou estornar

#### Scenario: Congelado existente dispensa reconstrução

- **WHEN** o snapshot/evidência F60.4 já está `complete` ou `repairable` para a operação
- **THEN** o sistema SHALL usar o payload congelado
- **AND** SHALL NOT reconstruir a partir dos arquivos de entrada
- **AND** o gate do módulo SHALL decidir reutilização/bloqueio da arte

### Requirement: Preparação determinística antes da expansão paga

O sistema SHALL preparar o `square_prepared` 1152×1152 por meio do módulo F60.2 após a base concluída e antes de adquirir a tentativa paga de expansão. A preparação SHALL ser idempotente: um preparado íntegro já existente SHALL ser reutilizado sem transformação. Falha determinística de preparação SHALL encerrar a operação sem chamada paga; indeterminação de Storage sem chamada paga SHALL permitir continuação gratuita.

#### Scenario: Preparação segue para expansão

- **WHEN** a base está `done` e a preparação termina com sucesso
- **THEN** o `square_prepared` SHALL estar persistido
- **AND** a operação SHALL poder adquirir a etapa `expansion`

#### Scenario: Preparado existente é reutilizado

- **WHEN** o `square_prepared` íntegro já existe para a operação
- **THEN** o sistema SHALL reutilizá-lo sem executar transformação
- **AND** SHALL NOT criar novo artefato ou novo crédito

#### Scenario: Falha de preparação não chama provider

- **WHEN** a preparação falha de forma determinística
- **THEN** o sistema SHALL NOT adquirir tentativa de expansão nem chamar provider
- **AND** SHALL seguir o encerramento de falha sem entrega

### Requirement: Expansão com uma chamada por etapa e limite F60

O sistema SHALL executar a etapa `expansion` por meio do módulo F60.3, com a fonte `square_prepared`, a identidade da operação, o alvo e a tentativa informados pela F60. O sistema SHALL executar no máximo uma tentativa de imagem de `base` e uma de `expansion` por invocação. Em falha transitória com tentativa disponível, o sistema SHALL encerrar a invocação em processamento e deixar a repetição para uma continuação autorizada. Em falha definitiva, resultado desconhecido ou limite atingido, o sistema SHALL NOT autorizar repetição automática.

#### Scenario: Uma tentativa de expansão por invocação

- **WHEN** a etapa `expansion` é adquirida para execução
- **THEN** o sistema SHALL chamar o expansor no máximo uma vez naquela invocação
- **AND** SHALL usar o alvo e o número de tentativa devolvidos pela F60
- **AND** SHALL NOT escolher fallback, contar tentativas ou criar política paralela

#### Scenario: Falha transitória vira continuação

- **WHEN** a expansão falha com classificação transitória e ainda há tentativa permitida
- **THEN** o sistema SHALL finalizar a tentativa como falha transitória
- **AND** SHALL devolver processamento com a próxima etapa
- **AND** SHALL NOT iniciar a repetição na mesma invocação

#### Scenario: Limite preservado entre requisições

- **WHEN** a operação é retomada após uma tentativa de expansão já utilizada
- **THEN** o sistema SHALL ler o número de tentativas persistido
- **AND** SHALL NOT reiniciar a contagem nem autorizar tentativa além do limite

### Requirement: Reconciliação de artefato antes de finalizar a etapa

O sistema SHALL, antes de finalizar uma etapa como falha após uma chamada paga, reconciliar somente quando houver **prova compatível e vinculada**, nunca pela mera existência/integridade da imagem. Para `square_original`, a reconciliação SHALL exigir estado congelado F60.4 `complete` ou `repairable`, binding da mesma operação e aprovação do gate do módulo; arte íntegra com congelado `absent`/`unproven`/`corrupt`/`indeterminate`/de outra operação SHALL bloquear. Para `vertical`, a reconciliação SHALL exigir compatibilidade com a fonte `square_prepared`, origem `ai_expansion`, proveniência, vínculo, checksum e evidência durável do F60.3. O sistema SHALL NOT finalizar como falha uma etapa comprovadamente concluída, nem usar a reconciliação para repetir uma chamada paga.

#### Scenario: Base reconciliada com congelado compatível

- **WHEN** a falha pós-chamada deixou `square_original` íntegro, o congelado F60.4 está `complete`/`repairable` e o binding é da mesma operação
- **THEN** o sistema SHALL reconciliar pelo gate do módulo
- **AND** SHALL finalizar a etapa `base` como concluída
- **AND** SHALL NOT repetir a chamada paga nem estornar

#### Scenario: Base com arte íntegra, mas sem congelado admissível

- **WHEN** existe `square_original` íntegro, mas o congelado F60.4 está `absent`/`unproven`/`corrupt`/`indeterminate`
- **THEN** o sistema SHALL bloquear
- **AND** SHALL NOT finalizar a base como concluída
- **AND** SHALL NOT entregar, confirmar crédito ou repetir chamada paga

#### Scenario: Base com arte íntegra vinculada a outra operação

- **WHEN** existe `square_original` íntegro, mas o binding pertence a outra operação
- **THEN** o sistema SHALL tratar como conflito
- **AND** SHALL NOT reutilizar a arte nem concluir a base

#### Scenario: Expansão reconciliada com proveniência e evidência

- **WHEN** a falha pós-chamada deixou `vertical` íntegro e compatível com a fonte, origem, proveniência, vínculo, checksum e evidência durável
- **THEN** o sistema SHALL reconciliar
- **AND** SHALL finalizar a etapa `expansion` como concluída
- **AND** SHALL seguir para a entrega vertical
- **AND** SHALL NOT repetir a chamada paga nem estornar

#### Scenario: Vertical íntegro, porém incompatível ou sem evidência

- **WHEN** existe um `vertical` íntegro, mas a fonte/proveniência/evidência não comprova compatibilidade com esta operação
- **THEN** o sistema SHALL bloquear
- **AND** SHALL NOT finalizar a expansão como concluída nem entregar

#### Scenario: Artefato não íntegro não é reconciliado

- **WHEN** a falha pós-chamada não deixou artefato íntegro/compatível
- **THEN** o sistema SHALL aplicar a classificação de falha da etapa
- **AND** SHALL NOT tratar objeto presente, porém inválido, como sucesso

#### Scenario: Sonda de reconciliação indeterminada

- **WHEN** a falha pós-chamada ocorre e a sonda do artefato é indeterminada
- **THEN** o sistema SHALL persistir resultado desconhecido
- **AND** SHALL NOT repetir a chamada paga
- **AND** SHALL NOT estornar automaticamente
- **AND** SHALL encaminhar a resolução administrativa

#### Scenario: Desconhecido do provider não é convertido em entrega

- **WHEN** o módulo retorna resultado desconhecido após possível envio
- **THEN** o sistema SHALL persistir o desconhecido
- **AND** SHALL NOT entregar automaticamente por artefato encontrado
- **AND** SHALL NOT repetir a chamada nem estornar

#### Scenario: Reconciliação tardia não reabre etapa

- **WHEN** um artefato íntegro é observado somente após a etapa já ter sido finalizada como falha
- **THEN** o sistema SHALL NOT reabrir, reescrever ou finalizar novamente a etapa
- **AND** SHALL NOT forçar entrega automática
- **AND** SHALL encaminhar o caso para resolução administrativa

### Requirement: Identidade de aquisição distinta e estável por etapa

O sistema SHALL usar uma identidade de aquisição própria para cada etapa. A identidade da `base` e a da `expansion` SHALL ser UUIDs distintos e SHALL NOT ser reutilizada entre etapas. O mesmo par SHALL ser reutilizado somente em uma repetição idêntica da mesma invocação HTTP; uma nova continuação SHALL fornecer um novo par. O sistema SHALL NOT alterar a F60 nem sua unicidade de `request_id` por operação.

#### Scenario: Base e expansão têm identidades distintas

- **WHEN** uma invocação executa base e expansão
- **THEN** a aquisição da base SHALL usar o ID da base
- **AND** a aquisição da expansão SHALL usar o ID da expansão
- **AND** os dois IDs SHALL ser distintos

#### Scenario: Mesmo ID em etapas diferentes é recusado

- **WHEN** a expansão tenta usar o mesmo `requestId` já usado pela base
- **THEN** a F60 SHALL recusar a aquisição
- **AND** o orquestrador SHALL NOT executar o provider nem tratar como sucesso

#### Scenario: Repetição da mesma invocação é idempotente

- **WHEN** a mesma invocação HTTP é repetida com o mesmo par de IDs
- **THEN** uma aquisição já realizada SHALL devolver apenas o estado
- **AND** SHALL NOT criar nova tentativa, novo provider ou nova cobrança

#### Scenario: Nova continuação gera novo par

- **WHEN** uma nova continuação é iniciada após uma falha transitória
- **THEN** ela SHALL fornecer um novo par de IDs
- **AND** a repetição SHALL ser permitida apenas dentro do limite F60

### Requirement: Continuação explícita da mesma operação entre requisições

O sistema SHALL continuar a mesma operação a partir das etapas persistidas quando o trabalho não couber em uma requisição. Antes de adquirir uma etapa, o sistema SHALL verificar o orçamento restante do deadline único daquela requisição; se não couber, SHALL encerrar a requisição em processamento **sem** adquirir a etapa, sem claim residual e sem efeito financeiro. A continuação SHALL exigir autorização de execução F60, SHALL reutilizar a identidade e SHALL NOT reservar outro crédito, regenerar base concluída ou executar etapa concorrente.

#### Scenario: Orçamento insuficiente encerra antes da etapa

- **WHEN** o orçamento restante não cobre a próxima etapa
- **THEN** o sistema SHALL NOT adquirir a etapa
- **AND** SHALL devolver processamento com a próxima etapa e autorização de continuação
- **AND** SHALL NOT deixar claim `in_progress` nem confirmar/estornar crédito

#### Scenario: Continuação após base concluída

- **WHEN** a operação é continuada com `base` em `done` e `expansion` pendente
- **THEN** o sistema SHALL NOT executar novamente a base
- **AND** SHALL executar preparação/expansão conforme o orçamento
- **AND** SHALL NOT criar nova reserva

#### Scenario: Continuação não abre operação nova

- **WHEN** uma continuação é solicitada para operação sem linha de controle
- **THEN** o sistema SHALL recusar
- **AND** SHALL NOT abrir operação, reservar crédito ou chamar provider

#### Scenario: Mesma requisição de continuação é idempotente

- **WHEN** a mesma continuação é reenviada com o mesmo identificador de requisição
- **THEN** somente uma execução SHALL ser autorizada
- **AND** a repetição SHALL receber apenas o estado, sem nova tentativa ou cobrança

#### Scenario: Duas continuações concorrentes

- **WHEN** duas continuações concorrentes tentam executar a mesma etapa
- **THEN** a F60 SHALL autorizar no máximo uma
- **AND** a outra SHALL receber processamento sem executar o trabalho

### Requirement: Consulta de status é somente leitura

O sistema SHALL oferecer consulta de status da operação 9:16 sem iniciar execução. A consulta SHALL ler a autoridade financeira, as etapas, as tentativas e os desfechos persistidos sem adquirir etapa, sem `open`, sem `resume` com trava, sem reserva, sem provider e sem alterar qualquer registro.

#### Scenario: Status não executa etapa

- **WHEN** o status de uma operação não terminal é consultado
- **THEN** o sistema SHALL devolver o estado persistido
- **AND** SHALL NOT adquirir etapa, iniciar tentativa, reservar, confirmar, estornar ou chamar provider

#### Scenario: Status de operação entregue

- **WHEN** a operação está `delivered`
- **THEN** a consulta SHALL devolver estado terminal entregue
- **AND** SHALL NOT promover estado por presença de objeto ou por formato

#### Scenario: Status de operação desconhecida

- **WHEN** existe desfecho `unknown` persistido e a operação não é terminal
- **THEN** a consulta SHALL devolver estado desconhecido com referência de suporte
- **AND** SHALL NOT oferecer retry automático nem estorno presumido

### Requirement: Processamento e resultado desconhecido são distintos na experiência

O sistema SHALL distinguir, no contrato de eventos e na tela de processamento, o estado **processando/entre etapas** do estado **resultado desconhecido**. O evento de processamento SHALL indicar a próxima etapa e se a continuação é permitida. O evento desconhecido SHALL ser âmbar, com referência de suporte, sem prometer retomada e sem oferecer nova geração. O sistema SHALL reutilizar a tela de processamento existente.

#### Scenario: Processamento entre etapas

- **WHEN** uma requisição termina com trabalho persistido e etapas restantes
- **THEN** o sistema SHALL emitir um evento de processamento distinto de sucesso
- **AND** a tela SHALL permanecer em processamento e orientar a continuação/consulta
- **AND** SHALL NOT navegar para a campanha nem declarar falha

#### Scenario: Resultado desconhecido

- **WHEN** uma tentativa termina sem confirmação de sucesso ou falha
- **THEN** o sistema SHALL emitir evento desconhecido com referência de suporte
- **AND** a tela SHALL mostrar o estado âmbar
- **AND** SHALL NOT iniciar outra geração, cobrar outro crédito ou estornar automaticamente

#### Scenario: Etapa em execução por outra requisição

- **WHEN** o status indica uma etapa `in_progress` pertencente a outra execução
- **THEN** a tela SHALL mostrar processamento
- **AND** SHALL consultar o status antes de qualquer nova execução
- **AND** SHALL NOT adquirir a mesma etapa em paralelo

### Requirement: Confirmação somente na entrega vertical autorizada

O sistema SHALL confirmar o consumo definitivo de exatamente 1 crédito somente quando o vertical final estiver íntegro e a entrega estiver autorizada. A entrega SHALL exigir as etapas `base` e `expansion` concluídas, sonda vertical integral, token/fence de publicação e projeção consistente. Conclusão da base, preparação ou expansão sem entrega SHALL NOT confirmar o crédito.

#### Scenario: Expansão concluída sem entrega

- **WHEN** a expansão termina com sucesso
- **THEN** o crédito SHALL permanecer reservado até a entrega vertical
- **AND** SHALL NOT haver segunda confirmação ou segundo débito

#### Scenario: Entrega vertical confirma uma vez

- **WHEN** o vertical é íntegro e a entrega é autorizada
- **THEN** exatamente 1 crédito SHALL ser confirmado
- **AND** o estado financeiro SHALL ser `delivered`

#### Scenario: Vertical inválido não confirma

- **WHEN** a sonda vertical é inválida ou indeterminada
- **THEN** o sistema SHALL NOT confirmar o crédito nem entregar a campanha
- **AND** SHALL NOT estornar automaticamente

### Requirement: Falha definitiva sem entrega produz estorno único e idempotente

O sistema SHALL registrar exatamente um estorno quando uma falha definitiva ocorrer sem entrega vertical. Repetições da mesma falha, da mesma requisição ou da mesma resolução SHALL NOT gerar segundo estorno. Operação entregue SHALL NOT ser estornada. Resultado desconhecido SHALL NOT autorizar estorno automático.

#### Scenario: Falha definitiva estorna uma vez

- **WHEN** uma falha definitiva é registrada sem vertical íntegro
- **THEN** exatamente 1 estorno SHALL ser aplicado
- **AND** a operação SHALL ficar `refunded`

#### Scenario: Repetição não estorna de novo

- **WHEN** o mesmo encerramento por falha é solicitado novamente
- **THEN** o sistema SHALL responder de forma idempotente
- **AND** SHALL NOT registrar segundo estorno

#### Scenario: Estorno confirmado projeta campanha fechada

- **WHEN** o estorno é confirmado
- **THEN** a campanha SHALL ser projetada como fechada de forma idempotente
- **AND** o detalhe SHALL refletir o estado `refunded`
- **AND** falha dessa projeção SHALL NOT desfazer o estorno nem autorizar nova geração

#### Scenario: Desconhecido não estorna

- **WHEN** o resultado de uma etapa é desconhecido
- **THEN** o sistema SHALL manter o valor reservado
- **AND** SHALL NOT registrar estorno por timeout, ausência de confirmação ou retry

### Requirement: Respostas tardias e concorrência não produzem efeito duplicado

O sistema SHALL condicionar a finalização de uma tentativa ao token e ao estado esperado. A finalização tardia após entrega, estorno, desconhecido ou encerramento administrativo SHALL ser recusada sem produzir entrega, upload, confirmação, estorno ou cobrança. A execução concorrente SHALL ser limitada pela F60; o orquestrador SHALL NOT criar lock, contador ou política paralela.

#### Scenario: Resposta tardia após entrega

- **WHEN** uma resposta de tentativa chega após a operação estar `delivered`
- **THEN** o sistema SHALL recusar o efeito
- **AND** SHALL NOT entregar, cobrar ou estornar novamente

#### Scenario: Resposta tardia após desconhecido

- **WHEN** uma resposta de tentativa chega após o desfecho desconhecido persistido
- **THEN** o sistema SHALL recusar o efeito
- **AND** SHALL NOT reabrir a operação ou iniciar retry

#### Scenario: Concorrência no banco

- **WHEN** duas transações concorrentes tentam efeitos incompatíveis na mesma operação
- **THEN** o banco SHALL serializar os efeitos
- **AND** apenas um resultado consistente SHALL prevalecer

### Requirement: Ativação fail-closed e desligamento do 9:16 direto

O sistema SHALL governar novas solicitações 9:16 por uma flag própria, fail-closed, cuja ausência ou erro significa desligado. Com a flag desligada, o sistema SHALL bloquear novas solicitações 9:16 sem criar campanha, reservar crédito ou chamar provider, e SHALL NOT reativar automaticamente o caminho direto antigo. Na ativação, o sistema SHALL deixar de despachar novas gerações diretas de 9:16, incluindo qualquer recuperação que possa gerar outra imagem. O código do caminho direto SHALL ser preservado, e operações `9_16_two_stage` já iniciadas SHALL permanecer reconhecíveis, consultáveis e com resolução segura.

#### Scenario: Flag desligada bloqueia nova solicitação

- **WHEN** uma nova solicitação 9:16 chega com a flag desligada
- **THEN** o sistema SHALL responder indisponibilidade de formato
- **AND** SHALL NOT criar campanha, abrir operação, reservar crédito ou chamar provider
- **AND** SHALL NOT redirecionar para o caminho direto

#### Scenario: Nova geração direta não é despachada

- **WHEN** o novo caminho está ativo e uma nova solicitação 9:16 é aceita
- **THEN** o sistema SHALL usar somente o orquestrador de duas etapas
- **AND** SHALL NOT importar, invocar ou executar o entrypoint direto em nenhuma rota

#### Scenario: Operação nova já iniciada continua segura

- **WHEN** a flag é desligada com uma operação `9_16_two_stage` já iniciada
- **THEN** a operação SHALL continuar reconhecível e consultável
- **AND** a continuação que exigiria nova etapa paga SHALL ser bloqueada com estado de suspensão, sem provider e sem reserva
- **AND** a entrega/projeção de um vertical já comprovadamente íntegro/compatível SHALL poder ser concluída sem nova chamada paga
- **AND** a operação SHALL poder ser resolvida pela via administrativa sem abrir nova operação ou reservar novo crédito

### Requirement: Campanhas históricas permanecem legíveis e não são convertidas

O sistema SHALL manter campanhas 9:16 históricas legíveis e baixáveis quando entregues e íntegras. Operações históricas pendentes ou desconhecidas SHALL ser somente leitura no fluxo do lojista, sem nova geração, sem retry e sem conversão silenciosa para o novo formato. A resolução SHALL ocorrer pela via administrativa autorizada ou suporte.

#### Scenario: Histórico entregue continua acessível

- **WHEN** uma campanha 9:16 histórica está `delivered` e a arte é íntegra
- **THEN** o sistema SHALL permitir detalhe, visualização e download
- **AND** SHALL NOT exigir conversão para a origem nova

#### Scenario: Histórico pendente não gera outra imagem

- **WHEN** uma campanha 9:16 histórica está pendente ou desconhecida
- **THEN** o sistema SHALL mostrar estado seguro de atendimento
- **AND** SHALL NOT iniciar o gerador direto, retry automático ou nova reserva
- **AND** SHALL NOT converter a campanha para `9_16_two_stage`

### Requirement: Custos reais correlacionados por operação

O sistema SHALL correlacionar copy, base, expansão e tentativas pagas pela mesma identidade de operação. O sistema SHALL preservar modelos, qualidades, usage, pricing e eventos reais de cada chamada. Estorno de crédito SHALL NOT apagar custo interno. Custo desconhecido SHALL ser registrado como `null`/`not_available`, nunca como zero ou preço fixo aproximado.

#### Scenario: Base, copy e expansão compartilham a operação

- **WHEN** a operação executa base, copy e expansão
- **THEN** os eventos reais SHALL compartilhar o identificador de operação
- **AND** cada chamada SHALL preservar modelo, qualidade, usage e custo com origem

#### Scenario: Estorno preserva custo

- **WHEN** a operação é estornada
- **THEN** o crédito SHALL ser restituído
- **AND** os custos internos das chamadas SHALL permanecer registrados

#### Scenario: Custo desconhecido não vira zero

- **WHEN** o custo de uma chamada não puder ser determinado
- **THEN** o registro SHALL usar `null`/`not_available`
- **AND** SHALL NOT usar zero ou um preço fixo aproximado como custo real

### Requirement: Recuperação de copy da origem nova usa conteúdo congelado

O sistema SHALL recuperar a copy da origem `9_16_two_stage` a partir do briefing e contexto congelados da operação. A recuperação SHALL NOT usar dados atuais da loja, SHALL NOT regenerar imagem, SHALL NOT confirmar ou reservar crédito e SHALL respeitar o limite de tentativas existente. Se o conteúdo congelado estiver ausente, divergente ou indeterminado, a recuperação SHALL falhar fechada sem chamada de IA.

#### Scenario: Recuperação usa o congelado

- **WHEN** a copy de uma operação `9_16_two_stage` é recuperada
- **THEN** o runner SHALL usar briefing, contexto, intenção e versões congelados
- **AND** SHALL NOT usar preço, selo ou tom atuais da loja

#### Scenario: Dados atuais da loja não alteram a copy

- **WHEN** os dados da loja mudam após a criação da campanha
- **THEN** a recuperação da copy SHALL permanecer baseada no conteúdo congelado
- **AND** a imagem e o crédito SHALL permanecer intocados

#### Scenario: Conteúdo congelado indisponível

- **WHEN** o estado congelado está ausente, corrompido, vinculado a outra operação ou indeterminado
- **THEN** a recuperação SHALL recusar sem chamar IA
- **AND** SHALL NOT regenerar imagem ou cobrar outro crédito
