## ADDED Requirements

### Requirement: Módulo server-only com contrato explícito e sem efeitos colaterais de entrega

O sistema SHALL oferecer uma única entrada server-only para expandir um `square_prepared` em `vertical`, recebendo identidade de origem, identidade de destino, tentativa e autorização derivada pelo servidor. O módulo SHALL NOT aceitar path, bucket, URL, bytes, modelo, qualidade, prompt ou tamanho enviados pelo chamador. O resultado SHALL ser o artefato persistido ou uma falha tipada, sem reservar, cobrar, confirmar ou estornar crédito, sem alterar `campaigns.status`/`storage_path`, sem liberar download e sem marcar entrega.

#### Scenario: Expansão bem-sucedida devolve apenas o artefato persistido

- **WHEN** a entrada é válida e a expansão conclui com vertical íntegro
- **THEN** o módulo SHALL devolver o artefato `vertical` persistido, seus bytes e a evidência da chamada
- **AND** SHALL NOT alterar campanha, crédito, entrega ou download

#### Scenario: Entrada com path, URL, bytes ou parâmetro de modelo é recusada

- **WHEN** o chamador envia path, bucket, URL, bytes, modelo, qualidade, prompt ou tamanho
- **THEN** o módulo SHALL recusar com falha de entrada tipada
- **AND** SHALL NOT executar I/O de Storage, banco ou provider

#### Scenario: Falha não produz sucesso fictício

- **WHEN** qualquer etapa falha antes de existir vertical persistido e íntegro
- **THEN** o módulo SHALL devolver falha tipada
- **AND** SHALL NOT devolver artefato, sucesso, entrega ou crédito confirmado

### Requirement: Fonte `square_prepared` recuperada e validada exclusivamente pela F60.1

O módulo SHALL recuperar a fonte por identidade `(storeId, campaignId, operationId, "square_prepared")` usando a F60.1, com autorização server-side e vínculo loja↔campanha. A fonte SHALL ser validada por conteúdo como JPEG 1152×1152. O módulo SHALL NOT escrever, copiar, reclassificar ou apagar o `square_original` ou o `square_prepared`.

#### Scenario: Fonte íntegra é aceita

- **WHEN** a fonte existe, pertence à loja/campanha e é JPEG 1152×1152 íntegro
- **THEN** o módulo SHALL prosseguir com os bytes recuperados
- **AND** SHALL manter original e preparado inalterados

#### Scenario: Fonte ausente, inválida ou divergente é recusada

- **WHEN** a fonte está ausente, truncada, não é JPEG, tem dimensão diferente de 1152×1152 ou seus metadados divergem dos bytes
- **THEN** o módulo SHALL devolver falha tipada de fonte indisponível
- **AND** SHALL NOT chamar o provider

#### Scenario: Autorização de outra loja é recusada

- **WHEN** a autorização não corresponde ao dono da loja ou ao vínculo campanha↔loja
- **THEN** o módulo SHALL recusar com autorização negada
- **AND** SHALL NOT ler bytes nem chamar o provider

### Requirement: Modelo e qualidade fixos, resolvidos pelo catálogo existente e sem fallback

Nesta fatia, o modelo SHALL ser Sunburst low. O identificador efetivo SHALL ser resolvido por uma linha ativa do catálogo existente, e a qualidade `low` SHALL ser validada contra a lista fechada de qualidades elegíveis. Se a linha não existir, estiver inativa, tiver protocolo incompatível ou a qualidade não for elegível, o módulo SHALL falhar antes de qualquer chamada paga. O módulo SHALL NOT usar seletor administrativo, fallback de modelo, par principal/fallback do 1:1 ou nome de modelo montado por suposição.

#### Scenario: Linha ativa resolve o modelo efetivo

- **WHEN** o catálogo contém uma linha ativa compatível com Sunburst low
- **THEN** o módulo SHALL usar provider, modelo e protocolo da linha, com qualidade `low`
- **AND** SHALL NOT consultar seletor administrativo nem fallback

#### Scenario: Catálogo ausente ou inativo bloqueia antes da chamada

- **WHEN** a linha ativa não existe, está inativa ou o protocolo é incompatível
- **THEN** o módulo SHALL devolver `model_unavailable`
- **AND** SHALL NOT executar chamada paga

#### Scenario: Qualidade fora da lista elegível é recusada

- **WHEN** a qualidade resolvida não pertence à lista fechada de qualidades elegíveis
- **THEN** o módulo SHALL recusar antes da chamada
- **AND** SHALL NOT substituir silenciosamente por outra qualidade

### Requirement: Reutilização antes de chamada paga com proveniência e evidência durável

Antes de resolver modelo/pricing ou chamar o provider, o módulo SHALL inspecionar o artefato `vertical` de destino. A **linha** SHALL ser consultada explicitamente pela identidade, separada da consulta ao **objeto**; um `absent` do retrieve SHALL NOT ser interpretado como linha ausente. Reutilização SHALL exigir linha íntegra, bytes compatíveis, proveniência compatível com a fonte e evidência durável verificada no objeto — path encontrado, sozinho, SHALL NOT ser suficiente. Se já existir linha/objeto incompatível, inválido ou com evidência não verificável, o módulo SHALL bloquear sem chamada paga. Linha encontrada com objeto desaparecido SHALL bloquear sem chamada paga (`row_object_missing`). Um objeto órfão íntegro, com evidência compatível, SHALL ser adotado pela F60.1 sem nova chamada. Somente **linha ausente + objeto comprovadamente ausente** SHALL permitir a chamada paga. Estado indeterminado do probe SHALL bloquear a chamada.

#### Scenario: Vertical íntegro e compatível é reutilizado sem chamada

- **WHEN** existe vertical com linha integral, bytes compatíveis, proveniência da mesma fonte e evidência durável verificada
- **THEN** o módulo SHALL devolver `reused` com o artefato e seus bytes
- **AND** SHALL NOT executar chamada paga nem upload

#### Scenario: Vertical existente incompatível bloqueia sem chamada

- **WHEN** existe vertical para a mesma identidade, mas a fonte, o checksum, a proveniência ou a evidência não são compatíveis
- **THEN** o módulo SHALL devolver conflito de artefato existente
- **AND** SHALL NOT chamar o provider nem sobrescrever a linha/objeto

#### Scenario: Linha existente com objeto desaparecido bloqueia sem chamada

- **WHEN** a linha `vertical` existe para a identidade, mas o objeto desapareceu do bucket
- **THEN** o módulo SHALL devolver conflito `row_object_missing`
- **AND** SHALL NOT chamar o provider, regravar o objeto ou apagar a linha

#### Scenario: Linha ausente e objeto ausente permitem a chamada

- **WHEN** a linha está comprovadamente ausente e o objeto também está comprovadamente ausente
- **THEN** o módulo SHALL prosseguir para a resolução de modelo/pricing e para a chamada única

#### Scenario: Órfão íntegro é adotado sem chamada

- **WHEN** a linha está ausente, o objeto vertical existe, é JPEG 1080×1920 íntegro e sua evidência durável corresponde à fonte
- **THEN** o módulo SHALL persistir/adotar o objeto pela F60.1
- **AND** SHALL devolver `reused` sem chamada paga

#### Scenario: Órfão sem evidência ou inválido é bloqueado

- **WHEN** o objeto vertical existe, mas a evidência está ausente, malformada, divergente ou os bytes são inválidos
- **THEN** o módulo SHALL bloquear sem chamada paga
- **AND** SHALL NOT apagar, corrigir ou sobrescrever o objeto

#### Scenario: Probe indeterminado não autoriza gasto

- **WHEN** a leitura da linha ou do objeto termina em erro, timeout ou resposta ambígua
- **THEN** o módulo SHALL devolver estado indeterminado
- **AND** SHALL NOT chamar o provider

### Requirement: Uma chamada paga por invocação, sem retry oculto e sem política paralela de tentativas

Cada invocação do módulo SHALL executar no máximo uma chamada real ao provider, com o tamanho 1152×2048 e a qualidade resolvida. O transporte SHALL ser configurado sem retries automáticos do SDK. O módulo SHALL NOT implementar fallback, segunda chamada, loop, fila ou repetição automática. Falhas transitórias, definitivas e desconhecidas SHALL ser devolvidas ao chamador com motivo e evidência de envio; somente o chamador SHALL decidir repetição/autorização.

#### Scenario: Sucesso executa exatamente uma chamada

- **WHEN** todas as condições estão satisfeitas
- **THEN** o módulo SHALL executar exatamente uma chamada `images.edit`
- **AND** SHALL usar uma única imagem de referência, tamanho 1152×2048 e qualidade `low`

#### Scenario: Transporte sem retry oculto

- **WHEN** o cliente do provider é criado pelo módulo
- **THEN** a configuração efetiva SHALL desabilitar retries automáticos do SDK
- **AND** nenhuma segunda requisição HTTP SHALL ocorrer por iniciativa do módulo ou do SDK

#### Scenario: Timeout padrão de 180 s respeita prazo menor

- **WHEN** o chamador não informa `timeoutMs`
- **THEN** o módulo SHALL aplicar 180 s
- **AND** quando o chamador informa um prazo menor, o módulo SHALL usar o menor prazo
- **AND** o módulo SHALL NOT alongar um deadline mais curto do chamador

#### Scenario: Timeout, abort ou perda após possível envio é desconhecido

- **WHEN** a chamada termina em timeout, abort ou perda de comunicação após possível envio
- **THEN** o módulo SHALL classificar o resultado como desconhecido
- **AND** SHALL NOT repetir a chamada
- **AND** SHALL NOT registrar falha definitiva nem persistir vertical

#### Scenario: Falha transitória ou definitiva é devolvida sem decisão de retry

- **WHEN** a chamada falha com classificação transitória ou definitiva
- **THEN** o módulo SHALL devolver a classificação, o motivo e a evidência de envio
- **AND** SHALL NOT iniciar nova tentativa nem acionar fallback

### Requirement: Validação por conteúdo do retorno e exportação 1080×1920 sem crop

O módulo SHALL validar o retorno do provider por decodificação completa, exigindo imagem decodificável com dimensão exata 1152×2048 e proporção 9:16 por inteiros. O tamanho devolvido SHALL ser medido dos bytes reais, nunca copiado do tamanho solicitado. O módulo SHALL exportar JPEG 1080×1920 pelo pipeline vertical existente, por redução proporcional de fator único, sem crop, pad, extensão, upscale ou segundo redimensionamento. O bruto 1152×2048 SHALL NOT ser armazenado de forma durável nesta fatia. Saída inválida ou truncada SHALL NOT ser persistida como vertical.

#### Scenario: Retorno válido é exportado e verificado

- **WHEN** o provider devolve imagem decodificável 1152×2048
- **THEN** o módulo SHALL exportar JPEG 1080×1920
- **AND** SHALL verificar a saída por decodificação completa

#### Scenario: Dimensão divergente é recusada

- **WHEN** o retorno tem dimensão diferente de 1152×2048 ou proporção diferente de 9:16
- **THEN** o módulo SHALL devolver saída inválida
- **AND** SHALL NOT exportar nem persistir vertical

#### Scenario: Retorno truncado ou não-imagem é recusado

- **WHEN** o retorno não decodifica por completo ou não é uma imagem válida
- **THEN** o módulo SHALL devolver saída inválida
- **AND** SHALL NOT persistir vertical

#### Scenario: Exportação não usa crop nem armazena o bruto

- **WHEN** a exportação ocorre
- **THEN** o módulo SHALL usar redução proporcional sem crop
- **AND** SHALL NOT criar armazenamento durável do bruto 1152×2048

### Requirement: Persistência `vertical` com origem `ai_expansion` e proveniência revalidada pela F60.1

O módulo SHALL persistir o resultado como papel `vertical`, formato 9:16, `origin: "ai_expansion"`, na identidade de destino, referenciando a fonte interna. A F60.1 SHALL revalidar a fonte e derivar checksum, bytes e proveniência dos bytes gravados. O módulo SHALL fazer readback pela F60.1 e devolver os bytes autoritativos lidos. Conflito, falha de persistência ou falha de readback SHALL ser tipados e SHALL NOT causar sobrescrita, delete ou correção automática.

#### Scenario: Vertical é persistido com proveniência correta

- **WHEN** a exportação produz JPEG 1080×1920 válido
- **THEN** o módulo SHALL persistir `vertical` com `origin: "ai_expansion"` e vínculo à fonte
- **AND** SHALL devolver o artefato lido no readback

#### Scenario: Conflito não sobrescreve

- **WHEN** a persistência detecta conflito de conteúdo, identidade, metadados ou proveniência
- **THEN** o módulo SHALL devolver conflito tipado
- **AND** SHALL NOT sobrescrever a linha/objeto existente

#### Scenario: Corrida de persistência após chamada paga preserva a evidência

- **WHEN** outra execução persiste o vertical primeiro e a F60.1 devolve `reused` após a chamada paga
- **THEN** o módulo SHALL devolver `reused` com a evidência da chamada realizada
- **AND** SHALL NOT executar uma segunda chamada nem descartar o custo conhecido

#### Scenario: Falha de persistência após chamada paga não repete a chamada

- **WHEN** a chamada paga teve sucesso, mas a persistência falhou
- **THEN** o módulo SHALL devolver falha de persistência com a evidência da chamada
- **AND** SHALL NOT executar nova chamada paga automaticamente

#### Scenario: Readback falha após persistência

- **WHEN** a persistência concluiu, mas o readback não devolveu artefato íntegro
- **THEN** o módulo SHALL devolver falha de readback tipada
- **AND** uma repetição posterior SHALL poder reutilizar o vertical sem nova chamada paga

### Requirement: Falhas tipadas, resultado desconhecido seguro e ausência de crédito/campanha/entrega

O módulo SHALL distinguir falha definitiva, transitória e desconhecida, sem converter resultado desconhecido em falha definitiva. Falhas de autenticação, quota, faturamento, capacidade da requisição, conteúdo/segurança e entrada inválida SHALL ser definitivas e SHALL NOT ser tratadas como falha de modelo elegível a repetição. Resultado desconhecido SHALL permanecer desconhecido e SHALL NOT autorizar repetição ou estorno automático. O módulo SHALL NOT reservar, confirmar, estornar ou comprar crédito; SHALL NOT alterar `campaigns`; SHALL NOT criar URL assinada/pública; SHALL NOT liberar download; SHALL NOT marcar entrega.

#### Scenario: Resultado desconhecido permanece desconhecido

- **WHEN** a chamada termina sem confirmação de sucesso ou falha
- **THEN** o resultado SHALL ser desconhecido
- **AND** SHALL NOT ser registrado como falha definitiva
- **AND** SHALL NOT produzir estorno, entrega ou repetição automática

#### Scenario: Falha de configuração ou entrada é definitiva

- **WHEN** o erro é de autenticação, quota, faturamento, capacidade da requisição, conteúdo/segurança ou entrada inválida
- **THEN** o módulo SHALL devolver falha definitiva com motivo fechado
- **AND** SHALL NOT classificá-la como falha transitória de modelo nem acionar repetição/fallback

#### Scenario: Nenhum efeito financeiro ou de campanha

- **WHEN** o módulo executa com sucesso ou falha
- **THEN** SHALL NOT chamar RPC/serviço de crédito
- **AND** SHALL NOT escrever em `campaigns`
- **AND** SHALL NOT criar URL assinada/pública nem liberar download

#### Scenario: Chamador decide a repetição

- **WHEN** o módulo devolve falha transitória ou definitiva
- **THEN** a decisão de repetir, aguardar ou encerrar SHALL ser do chamador/F60
- **AND** o módulo SHALL NOT manter contador ou política paralela de tentativas

### Requirement: Telemetria por chamada e custo com origem, sem duplicação

O módulo SHALL emitir exatamente um evento de chamada por chamada real para o mecanismo existente de telemetria/custo, com `operationId`, `callId`, etapa `expansion`, provider, modelo/qualidade efetivos, tamanho solicitado/recebido, duração, resultado, usage disponível e custo com sua origem. Antes da chamada, o módulo SHALL exigir a cobertura das tarifas necessárias ao cálculo por usage — entrada/saída textual, entrada/saída de imagem e cache textual/imagem — além de `image_unit_usd`; `image_unit_usd` sozinho SHALL NOT comprovar cobertura e cobertura incompleta SHALL bloquear antes da chamada. O custo SHALL usar o mecanismo existente de custo calculado/reportado; custo desconhecido SHALL ser `null` e `not_available`, nunca zero. Custo conhecido SHALL ser registrado mesmo quando a saída for inválida ou a chamada falhar com usage disponível. O módulo SHALL manter a correlação necessária para agregar custo de base + expansão posteriormente e SHALL NOT duplicar o evento da chamada. O flush SHALL ocorrer também quando decode, exportação, persistência ou readback falharem, ou quando ocorrer exceção inesperada após a chamada. A gravação durável SHALL ser a do mecanismo existente, best-effort por contrato, sem um segundo evento de compensação; falha do flush SHALL NOT provocar outra geração paga.

#### Scenario: Chamada bem-sucedida emite um único evento

- **WHEN** a chamada paga ocorre
- **THEN** exatamente um evento de chamada SHALL ser emitido ao mecanismo existente
- **AND** SHALL conter operação, chamada, etapa, provider, modelo, qualidade, tamanhos, duração, resultado e usage

#### Scenario: Saída inválida preserva custo conhecido

- **WHEN** o provider devolve usage, mas a saída é inválida, truncada ou ausente
- **THEN** o custo calculado/reportado SHALL ser registrado
- **AND** o desfecho do módulo SHALL ser registrado como saída inválida, sem um segundo evento

#### Scenario: Cobertura incompleta de tarifas bloqueia antes da chamada

- **WHEN** a linha de pricing de Sunburst low cobre `image_unit_usd`, mas falta qualquer tarifa necessária ao cálculo por usage
- **THEN** o módulo SHALL devolver `pricing_unavailable` (`incomplete_coverage`)
- **AND** SHALL NOT executar chamada paga

#### Scenario: Custo desconhecido não vira zero

- **WHEN** o pós-chamada não tem usage ou tarifa suficiente para calcular o custo
- **THEN** o custo SHALL ser `null` com origem `not_available`
- **AND** SHALL NOT registrar zero nem valor fixo de 0,05

#### Scenario: Registro da chamada é protegido em falha posterior

- **WHEN** a chamada paga teve sucesso, mas decode, exportação, persistência, readback ou uma exceção inesperada falha depois
- **THEN** o módulo SHALL realizar o flush único com o desfecho real da falha
- **AND** SHALL NOT executar uma segunda chamada paga
- **AND** falha do flush SHALL NOT alterar o resultado nem provocar nova geração

#### Scenario: Base e expansão são correlacionáveis

- **WHEN** a base e a expansão pertencem à mesma operação 9:16
- **THEN** ambas SHALL compartilhar a chave de correlação de operação
- **AND** a etapa `expansion` SHALL ser distinguível no evento

### Requirement: Testes offline primeiro e prova real em gate separado

O módulo SHALL ser validado primeiro offline, com provider/DB/Storage simulados nas fronteiras, Sharp/decoder reais e fixtures determinísticas, exercitando o módulo real. A prova real SHALL ocorrer somente em etapa separadamente autorizada, reutilizando o homolog existente e a infraestrutura validada, sem criar ambiente descartável, resetar, reinstalar ou reaplicar migrations existentes. Antes de qualquer chamada paga, ambiente, credenciais e modelo SHALL ser confirmados de forma não paga. A prova SHALL solicitar quantidade máxima de chamadas e orçamento, SHALL NOT usar retry automático pago e SHALL parar em caso de falha preservando a evidência.

#### Scenario: Offline não usa rede, banco, Storage real ou IA

- **WHEN** a suíte offline executa
- **THEN** provider, banco e Storage SHALL ser simulados nas fronteiras
- **AND** Sharp/decoder reais SHALL processar fixtures determinísticas
- **AND** nenhuma chamada paga, rede, banco ou Storage real SHALL ocorrer

#### Scenario: Prova real exige autorização e preflight não pago

- **WHEN** a prova real é considerada
- **THEN** ambiente, credenciais, migration/bucket da F60.1, catálogo, pricing e fonte controlada SHALL ser confirmados antes da chamada
- **AND** quantidade máxima de chamadas e orçamento SHALL estar autorizados
- **AND** nenhuma chamada paga SHALL ocorrer sem essa confirmação

#### Scenario: Falha na prova real para sem retry

- **WHEN** a chamada paga da prova falha
- **THEN** a evidência SHALL ser preservada
- **AND** a execução SHALL parar para diagnóstico
- **AND** SHALL NOT haver retry automático pago

#### Scenario: Migration existente não é reaplicada

- **WHEN** a infraestrutura da F60.1 já está aplicada no ambiente autorizado
- **THEN** a prova SHALL reutilizá-la
- **AND** SHALL NOT resetar, reinstalar ou reaplicar migrations existentes
