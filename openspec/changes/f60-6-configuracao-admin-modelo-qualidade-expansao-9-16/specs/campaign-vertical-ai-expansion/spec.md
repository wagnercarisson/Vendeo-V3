## ADDED Requirements

### Requirement: Seleção de modelo e qualidade congelada, resolvida pelo catálogo e sem fallback

A expansão SHALL usar a seleção de modelo e qualidade **congelada na operação** e fornecida pelo servidor, restrita a `gpt-image-2.5-flare` ou `gpt-image-2.5-sunburst` em `low` ou `medium`. O identificador efetivo do modelo SHALL ser confirmado por uma linha ativa do catálogo existente na capability `campaign_product_image`, provider `openai`, protocolo `images`; a qualidade SHALL ser validada contra a lista fechada. Se a linha não existir, estiver inativa, tiver protocolo incompatível ou a seleção for ausente/inválida, o módulo SHALL falhar antes de qualquer chamada paga. O módulo SHALL NOT aceitar modelo ou qualidade do chamador público, SHALL NOT usar fallback, par principal/fallback do 1:1 ou seletor administrativo vigente durante uma operação já congelada.

#### Scenario: Seleção congelada resolve o alvo efetivo

- **WHEN** a operação possui uma seleção congelada válida de Flare ou Sunburst em `low`/`medium`
- **THEN** o módulo SHALL usar o modelo e a qualidade congelados
- **AND** SHALL confirmar a linha ativa correspondente no catálogo
- **AND** SHALL NOT consultar a configuração administrativa vigente nem fallback

#### Scenario: Cada combinação chega ao transporte

- **WHEN** a seleção congelada é Flare low, Flare medium, Sunburst low ou Sunburst medium
- **THEN** o request `images.edit` SHALL usar exatamente o modelo e a qualidade selecionados
- **AND** o tamanho SHALL permanecer `1152x2048`

#### Scenario: Catálogo ausente ou inativo bloqueia antes da chamada

- **WHEN** a linha ativa do modelo congelado não existe, está inativa ou o protocolo é incompatível
- **THEN** o módulo SHALL devolver `model_unavailable`
- **AND** SHALL NOT executar chamada paga

#### Scenario: Qualidade fora da lista elegível é recusada

- **WHEN** a qualidade congelada não pertence a `low`/`medium`
- **THEN** o módulo SHALL recusar antes da chamada
- **AND** SHALL NOT substituir silenciosamente por outra qualidade

## REMOVED Requirements

### Requirement: Modelo e qualidade fixos, resolvidos pelo catálogo existente e sem fallback

**Reason**: O alvo fixo Sunburst low é substituído pela seleção administrativa congelada por operação, que pode ser Flare ou Sunburst em low/medium.

**Migration**: Operações novas usam a seleção congelada; operações anteriores à F60.6 mantêm explicitamente Sunburst low como origem `legacy_sunburst_low`, sem backfill. O módulo continua recusando modelo/qualidade enviados pelo chamador e continua sem fallback.

## MODIFIED Requirements

### Requirement: Uma chamada paga por invocação, sem retry oculto e sem política paralela de tentativas

Cada invocação do módulo SHALL executar no máximo uma chamada real ao provider, com o tamanho 1152×2048 e a qualidade congelada da seleção (`low` ou `medium`). O transporte SHALL ser configurado sem retries automáticos do SDK. O módulo SHALL NOT implementar fallback, segunda chamada, loop, fila ou repetição automática. Falhas transitórias, definitivas e desconhecidas SHALL ser devolvidas ao chamador com motivo e evidência de envio; somente o chamador SHALL decidir repetição/autorização.

#### Scenario: Sucesso executa exatamente uma chamada

- **WHEN** todas as condições estão satisfeitas
- **THEN** o módulo SHALL executar exatamente uma chamada `images.edit`
- **AND** SHALL usar uma única imagem de referência, tamanho 1152×2048 e a qualidade congelada da seleção

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

### Requirement: Telemetria por chamada e custo com origem, sem duplicação

O módulo SHALL emitir exatamente um evento de chamada por chamada real para o mecanismo existente de telemetria/custo, com `operationId`, `callId`, etapa `expansion`, provider, modelo/qualidade efetivos, `configVersionId` da seleção, origem da seleção (`configured` ou `legacy_sunburst_low`), tamanho solicitado/recebido, duração, resultado, usage disponível e custo com sua origem. Antes da chamada, o módulo SHALL exigir a cobertura das tarifas **aplicáveis ao cálculo por usage** para o modelo e a qualidade selecionados — entrada textual, entrada de imagem, saída de imagem e cache textual/imagem. `outputCostUsd` (saída textual) SHALL ser exigida apenas quando o protocolo/modelo pode produzir tokens textuais de saída positivos e NÃO é aplicável ao protocolo `images`. `image_unit_usd` SHALL NOT compor a cobertura de usage: ele é apenas a estimativa pré-chamada (teto/auditoria) e sua ausência SHALL deixar a estimativa explicitamente indisponível (`null`), nunca zero, cópia de outra linha, valor inventado ou custo efetivo. Cobertura incompleta das tarifas de usage SHALL bloquear antes da chamada, e `image_unit_usd` isolado SHALL NOT comprovar cobertura. A autorização de gasto do fluxo 9:16 permanece a reserva de 1 crédito; a estimativa ausente SHALL NOT ser convertida em gate de gasto por heurística. A ausência de `image_unit_usd` continua sendo sinalizada pela verificação/painel de pricing existente, sem alterar essa verificação. O custo SHALL usar o mecanismo existente de custo calculado/reportado; custo desconhecido SHALL ser `null` e `not_available`, nunca zero. Custo conhecido SHALL ser registrado mesmo quando a saída for inválida ou a chamada falhar com usage disponível. O módulo SHALL manter a correlação necessária para agregar custo de base + expansão posteriormente e SHALL NOT duplicar o evento da chamada. O flush SHALL ocorrer também quando decode, exportação, persistência ou readback falharem, ou quando ocorrer exceção inesperada após a chamada. A gravação durável SHALL ser a do mecanismo existente, best-effort por contrato, sem um segundo evento de compensação; falha do flush SHALL NOT provocar outra geração paga.

#### Scenario: Chamada bem-sucedida emite um único evento

- **WHEN** a chamada paga ocorre
- **THEN** exatamente um evento de chamada SHALL ser emitido ao mecanismo existente
- **AND** SHALL conter operação, chamada, etapa, provider, modelo, qualidade, `configVersionId`, origem da seleção, tamanhos, duração, resultado e usage

#### Scenario: Saída inválida preserva custo conhecido

- **WHEN** o provider devolve usage, mas a saída é inválida, truncada ou ausente
- **THEN** o custo calculado/reportado SHALL ser registrado
- **AND** o desfecho do módulo SHALL ser registrado como saída inválida, sem um segundo evento

#### Scenario: Cobertura incompleta de tarifas bloqueia antes da chamada

- **WHEN** a linha de pricing do modelo/qualidade selecionados cobre `image_unit_usd`, mas falta qualquer tarifa **aplicável** ao cálculo por usage
- **THEN** o módulo SHALL devolver `pricing_unavailable` (`incomplete_coverage`)
- **AND** SHALL NOT executar chamada paga

#### Scenario: Tarifa de saída textual não aplicável ao protocolo `images`

- **WHEN** a linha de pricing cobre as tarifas de imagem e entrada/cache aplicáveis, mas não tem `output_token_usd_per_1m`, e o protocolo é `images.edit`
- **THEN** a cobertura SHALL ser considerada completa para as dimensões aplicáveis
- **AND** a ausência da tarifa textual SHALL NOT ser mascarada: se o pós-chamada reportar tokens textuais positivos, o custo SHALL permanecer desconhecido (`not_available`)

#### Scenario: Tarifas de usage completas com `image_unit_usd` nulo não bloqueiam

- **WHEN** a linha de pricing do alvo cobre todas as tarifas de usage aplicáveis ao protocolo `images.edit`, mas `image_unit_usd` é `NULL`
- **THEN** a cobertura de usage SHALL ser considerada completa e a chamada paga SHALL ser autorizada
- **AND** a estimativa pré-chamada SHALL permanecer explicitamente indisponível (`null`), sem virar zero, valor inventado ou custo efetivo
- **AND** o custo SHALL ser o de usage real × tarifas, e sem usage SHALL permanecer `null`/`not_available`

#### Scenario: Estimativa ausente é distinta de tarifa de usage ausente

- **WHEN** falta qualquer tarifa de usage aplicável
- **THEN** o módulo SHALL devolver `pricing_unavailable` (`incomplete_coverage`) com os campos ausentes
- **AND** SHALL NOT executar chamada paga
- **AND** a ausência de `image_unit_usd`, isoladamente, SHALL NOT ser reportada como falta de cobertura

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
- **AND** a seleção congelada e sua versão SHALL distinguir a expansão das demais etapas
