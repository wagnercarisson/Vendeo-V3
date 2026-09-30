# Lab Bench Identity Transport

## ADDED Requirements

### Requirement: Ordem documentada das referências enviadas ao modelo

O adapter `Images` dedicado da bancada SHALL enviar as referências ao modelo na ordem documentada e fixa: (1) imagem principal do produto; (2) imagens adicionais do produto; (3) referência canônica de identidade, quando aplicável. A orientação textual SHALL exigir reprodução fiel da identidade, sem redesenhar, distorcer, completar ou reinterpretar, mantendo-a **secundária** à comunicação comercial e **sem posição fixa**.

#### Scenario: Ordem das referências é respeitada

- **WHEN** a geração é executada
- **THEN** as referências são enviadas na ordem principal → adicionais → identidade canônica
- **AND** a identidade, quando aplicável, é a última referência

#### Scenario: Identidade permanece secundária e sem posição fixa

- **WHEN** a identidade é transportada
- **THEN** a orientação textual exige reprodução fiel sem redesenhar, distorcer, completar ou reinterpretar
- **AND** a identidade permanece secundária à comunicação comercial e sem posição fixa

### Requirement: Referência canônica resolvida por identity_state

A referência de identidade SHALL ser **exclusivamente** o resultado canônico já resolvido por `identity_state`: `logo` → o logo canônico selecionado pelo resolver; `visual_signature` → a assinatura visual selecionada; `text_only` → nenhuma imagem de identidade. A bancada SHALL NOT escolher o primeiro asset disponível, SHALL NOT substituir silenciosamente logo por assinatura (ou vice-versa) e SHALL NOT inventar identidade ausente.

#### Scenario: logo envia somente o logo canônico

- **WHEN** `identity_state` é `logo`
- **THEN** somente o logo canônico selecionado pelo resolver é enviado
- **AND** nenhuma assinatura é enviada

#### Scenario: visual_signature envia somente a assinatura

- **WHEN** `identity_state` é `visual_signature`
- **THEN** somente a assinatura visual selecionada é enviada
- **AND** nenhum logo é enviado

#### Scenario: text_only não envia imagem de identidade

- **WHEN** `identity_state` é `text_only`
- **THEN** nenhuma imagem de identidade é enviada
- **AND** apenas as imagens do produto são referências

#### Scenario: Nenhum asset é escolhido por conveniência

- **WHEN** a referência de identidade é resolvida
- **THEN** nenhum asset é escolhido pelo critério de "primeiro disponível"
- **AND** nenhuma identidade ausente é inventada

### Requirement: Falha antes da chamada paga quando a identidade está indisponível

Para `logo` e `visual_signature`, se o arquivo esperado ou a sua URL assinada não estiver disponível, a execução SHALL falhar **antes da chamada paga**, com erro determinístico, sem fallback para outra variante ou outro tipo de identidade.

#### Scenario: Referência indisponível falha antes da chamada paga

- **WHEN** a referência canônica esperada não está disponível (arquivo ou URL assinada)
- **THEN** a execução falha antes de qualquer chamada paga
- **AND** nenhum fallback de identidade é aplicado

### Requirement: URL assinada transitória e não persistida

A URL assinada da identidade SHALL ser **transitória** e SHALL NOT ser persistida no snapshot. O snapshot SHALL registrar apenas o descritor canônico (`kind`, `variantType`, `storagePath`), sem URL assinada, token ou secret.

#### Scenario: URL assinada não é persistida

- **WHEN** a evidência da geração é persistida
- **THEN** o snapshot contém apenas o descritor canônico da identidade
- **AND** nenhuma URL assinada é persistida

### Requirement: Adapter Images isolado da bancada

O transporte da identidade SHALL ocorrer **somente** no adapter `Images` dedicado da bancada e no runtime da bancada. O adapter `Images` produtivo, o caminho `Responses` produtivo e o registry padrão SHALL permanecer intocados.

#### Scenario: Adapter da bancada transporta a identidade

- **WHEN** o adapter da bancada é invocado
- **THEN** ele anexa a referência canônica de identidade como última referência
- **AND** o adapter produtivo e o registry padrão permanecem inalterados

#### Scenario: Produção não é alterada

- **WHEN** o transporte de identidade é implementado
- **THEN** o adapter `Images` produtivo, o caminho `Responses` produtivo e o registry padrão não mudam
- **AND** a suíte produtiva permanece verde
