# Image Generation Failure Policy

> Synced from `fase-56-1-contrato-produtivo-modelos-fallback` (ADDED).

## Purpose

Taxonomia de falhas e política de execução do novo fluxo de imagem: quantas tentativas são feitas no principal, quando o fallback é acionado, quando o atraso/erro é apenas repetido e quais falhas **nunca** acionam fallback ou geram cobrança.

## Requirements

### Requirement: Taxonomia de falhas elegíveis e não elegíveis

O sistema SHALL classificar cada falha de geração como **elegível** ou **não elegível** ao fallback, de forma explícita e testável, antes de qualquer ativação produtiva.

Falhas elegíveis SHALL incluir, no mínimo: `rate_limit` (limite de requisições), `timeout`, `network`, `provider_error` (erro 5xx do provider) e falha explícita de **disponibilidade/capacidade** do modelo.

Falhas não elegíveis SHALL incluir, no mínimo: **quota esgotada**, **erro de faturamento do provider**, erro de **autenticação/autorização**, **bloqueio de conteúdo/segurança** e erro de **entrada/validação**. Falhas de entrada, autorização, segurança ou conta SHALL NOT se tornar automaticamente falhas de modelo.

#### Scenario: Falha de rede é elegível

- **WHEN** a geração falha por `network`, `timeout` ou `provider_error`
- **THEN** a falha é classificada como elegível ao fallback

#### Scenario: Quota esgotada não é elegível

- **WHEN** o provider retorna quota esgotada
- **THEN** a falha é classificada como não elegível
- **AND** o fallback não é acionado

#### Scenario: Erro de faturamento não é elegível

- **WHEN** o provider retorna erro de faturamento
- **THEN** a falha é classificada como não elegível
- **AND** o fallback não é acionado

#### Scenario: Falha de entrada não vira falha de modelo

- **WHEN** a geração falha por entrada inválida, autorização ou bloqueio de segurança
- **THEN** a falha é classificada como não elegível
- **AND** ela não é tratada como falha do modelo nem aciona fallback

### Requirement: Política de execução com teto de chamadas

A execução SHALL realizar no máximo **duas tentativas reais no par principal** e, se a falha for elegível, **uma tentativa no par fallback**, totalizando no máximo **três chamadas reais por operação**. Nenhuma outra combinação de tentativas SHALL ocorrer.

#### Scenario: Duas tentativas no principal

- **WHEN** a primeira tentativa no principal falha de forma elegível
- **THEN** uma segunda tentativa real é feita no principal
- **AND** o total de tentativas no principal não excede duas

#### Scenario: Fallback após elegibilidade

- **WHEN** as tentativas no principal se esgotam com falha elegível
- **THEN** exatamente uma tentativa é feita no par fallback
- **AND** o total de chamadas da operação não excede três

#### Scenario: Teto global respeitado

- **WHEN** a operação atinge três chamadas reais
- **THEN** nenhuma nova tentativa é feita
- **AND** a operação é encerrada com o resultado disponível

### Requirement: Rate limit é transitório

`rate_limit` SHALL ser tratado como falha **transitória**: o sistema SHALL repetir **uma vez no principal** e, se o limite persistir, SHALL usar o **fallback**. Uma única ocorrência de `rate_limit` não SHALL consumir imediatamente a única tentativa de fallback sem a repetição no principal.

#### Scenario: Rate limit repete no principal

- **WHEN** a primeira tentativa no principal falha com `rate_limit`
- **THEN** o sistema repete uma vez no principal

#### Scenario: Rate limit persistente usa fallback

- **WHEN** o `rate_limit` persiste após a repetição no principal
- **THEN** o sistema aciona o fallback

### Requirement: Disponibilidade/capacidade aciona fallback sem repetição inútil

Uma falha explícita de **disponibilidade/capacidade** do modelo SHALL poder acionar o fallback **sem** gastar repetições inúteis no principal, desde que a classificação da falha seja elegível.

#### Scenario: Indisponibilidade aciona fallback diretamente

- **WHEN** o principal falha com indisponibilidade/capacidade explícita
- **THEN** o fallback é acionado sem repetição inútil no principal
- **AND** o teto de três chamadas por operação é respeitado

### Requirement: Falha técnica não é cobrada do lojista

Falhas técnicas SHALL NOT gerar cobrança ao lojista. A operação encerrada por falha técnica (elegível ou não elegível) SHALL NOT consumir crédito do lojista nem gerar nova cobrança adicional.

#### Scenario: Falha técnica não debita

- **WHEN** a operação termina por falha técnica após esgotar as tentativas
- **THEN** nenhum crédito do lojista é consumido pela tentativa falha
- **AND** nenhuma cobrança adicional é criada

#### Scenario: Fallback não consome cota do lojista

- **WHEN** o fallback é acionado dentro da mesma operação
- **THEN** a tentativa de fallback não é tratada como operação separada do lojista
