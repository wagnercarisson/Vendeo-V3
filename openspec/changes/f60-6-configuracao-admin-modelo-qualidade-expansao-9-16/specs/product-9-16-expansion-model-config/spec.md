## ADDED Requirements

### Requirement: Configuração administrativa própria e independente da expansão 9:16

O sistema SHALL prover uma configuração administrativa singleton, exclusiva da expansão 9:16, que seleciona **um** modelo e **uma** qualidade entre `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst` em `low` ou `medium`. A configuração SHALL ser independente da seleção legada, do par principal/fallback do Produto 1:1, da base quadrada e de qualquer operação em andamento. O sistema SHALL NOT oferecer fallback, par principal/fallback, modelo `gpt-image-2` ou valor fora das listas fechadas nesta configuração.

#### Scenario: Somente as quatro combinações são oferecidas

- **WHEN** o administrador abre a configuração da expansão 9:16
- **THEN** o sistema SHALL oferecer exatamente Flare e Sunburst em `low` e `medium`
- **AND** SHALL NOT oferecer `gpt-image-2`, fallback ou outra qualidade

#### Scenario: Salvar a expansão não altera o 1:1 nem a base quadrada

- **WHEN** o administrador altera a configuração da expansão
- **THEN** a seleção legada, o par do Produto 1:1 e o snapshot da base quadrada SHALL permanecer inalterados

#### Scenario: Configuração não reescreve operação em andamento

- **WHEN** existe uma operação 9:16 já aberta e o administrador muda a configuração
- **THEN** a operação existente SHALL continuar usando a seleção congelada na abertura
- **AND** somente novas operações SHALL usar a nova configuração

### Requirement: Autorização, motivo, idempotência e auditoria

A escrita da configuração SHALL ocorrer exclusivamente por RPC auditada, acessível apenas a `service_role`, invocada por rota protegida por `requireAdmin`. O ator SHALL ser derivado no servidor pela autoridade administrativa existente (`admin_users`) e SHALL NOT vir do corpo do navegador. A RPC SHALL revalidar que `p_actor_id` é um administrador existente antes de qualquer escrita/auditoria. A operação SHALL exigir motivo não vazio e `operationId` UUID. A gravação SHALL renovar a versão da configuração e registrar a auditoria na mesma transação, com ação e tipo de alvo próprios, sem alterar os valores de auditoria já aceitos. A idempotência SHALL ser estrita: mesmo `operationId` com o mesmo conteúdo devolve replay sem nova versão/auditoria; mesmo `operationId` com conteúdo diferente SHALL ser recusado como conflito, sem gravação e sem auditoria adicional.

#### Scenario: Salvamento válido é auditado com motivo

- **WHEN** o administrador salva uma combinação válida com motivo e `operationId`
- **THEN** a configuração SHALL ser persistida com nova versão
- **AND** a auditoria SHALL registrar ator, motivo, `operationId` e valores efetivos na mesma transação

#### Scenario: Motivo ausente é recusado

- **WHEN** o salvamento não informa motivo não vazio
- **THEN** a escrita SHALL ser recusada
- **AND** nenhuma configuração SHALL ser alterada

#### Scenario: Reenvio idempotente não duplica efeito

- **WHEN** o mesmo `operationId` é reenviado com o mesmo conteúdo
- **THEN** o sistema SHALL devolver o resultado idempotente
- **AND** SHALL NOT criar nova versão nem nova auditoria

#### Scenario: Mesmo operationId com conteúdo diferente é conflito

- **WHEN** o mesmo `operationId` é reenviado com modelo, qualidade, motivo ou outro conteúdo diferente
- **THEN** o sistema SHALL recusar como conflito de `operationId`
- **AND** SHALL NOT sobrescrever a configuração vigente
- **AND** SHALL NOT gravar nova versão ou auditoria adicional

#### Scenario: Ator não administrativo na RPC é recusado

- **WHEN** a RPC recebe `p_actor_id` nulo ou que não pertence a `admin_users`
- **THEN** a escrita SHALL ser recusada antes da configuração/auditoria
- **AND** o ator SHALL NOT ser aceito do corpo do navegador

#### Scenario: Usuário não administrador é recusado

- **WHEN** um usuário sem papel administrativo tenta ler ou salvar
- **THEN** o acesso SHALL ser negado antes da RPC
- **AND** nenhuma configuração SHALL ser lida ou alterada

### Requirement: Provisionamento inicial explícito e falha fechada

A migration SHALL provisionar explicitamente `gpt-image-2.5-sunburst` / `low` como configuração inicial, de forma idempotente e sem sobrescrever uma configuração humana existente. Essa linha SHALL ser uma configuração real, não um default em código. Ausência, remoção, valor inválido ou linha fora das listas fechadas SHALL impedir a geração nova, sem reserva de crédito e sem chamada paga; o sistema SHALL NOT cair silenciosamente em Sunburst low, em outro modelo ou em fallback.

#### Scenario: Instalação nova recebe Sunburst low explícito

- **WHEN** a migration é aplicada em ambiente sem configuração da expansão
- **THEN** SHALL existir uma linha vigente `gpt-image-2.5-sunburst` / `low` com versão e motivo de provisionamento
- **AND** a linha SHALL ser tratada como configuração efetiva, não como ausência

#### Scenario: Configuração ausente falha fechado

- **WHEN** a configuração da expansão está ausente ou foi removida
- **THEN** uma geração nova SHALL falhar como configuração indisponível
- **AND** SHALL NOT reservar crédito, adquirir tentativa ou chamar provider
- **AND** SHALL NOT usar Sunburst low por conveniência

#### Scenario: Configuração inválida não é corrigida silenciosamente

- **WHEN** a linha vigente aponta para modelo/qualidade fora das listas fechadas ou para catálogo inativo
- **THEN** a execução SHALL falhar fechado antes de qualquer gasto
- **AND** SHALL NOT substituir o valor por outro modelo ou qualidade

### Requirement: Leitura estrita, interface administrativa e cobertura de pricing

A leitura da configuração SHALL distinguir linha vigente, ausência comprovada e falha de leitura. A interface SHALL exibir a combinação vigente, versão, autor, data e motivo, permitir selecionar apenas as quatro combinações e apresentar a cobertura de pricing por combinação como aviso que não bloqueia o salvamento. A execução SHALL exigir cobertura completa das tarifas de usage aplicáveis ao modelo e à qualidade selecionados; `image_unit_usd` SHALL permanecer apenas estimativa opcional, nunca requisito de cobertura, e custo insuficiente SHALL permanecer `null`/`not_available`.

#### Scenario: Falha de leitura não vira configuração ausente

- **WHEN** a leitura da configuração falha por erro de banco ou resposta malformada
- **THEN** a interface e o preflight SHALL reportar falha de leitura
- **AND** SHALL NOT tratar o caso como ausência nem usar um valor padrão

#### Scenario: Cobertura incompleta é avisada, mas execução bloqueia

- **WHEN** a combinação selecionada não tem todas as tarifas de usage aplicáveis
- **THEN** a interface SHALL exibir a cobertura incompleta como aviso
- **AND** a geração nova SHALL bloquear antes de reservar ou chamar provider

#### Scenario: Estimativa de imagem ausente não bloqueia

- **WHEN** a linha de pricing cobre as tarifas de usage aplicáveis, mas `image_unit_usd` está ausente
- **THEN** a cobertura SHALL ser considerada completa
- **AND** a estimativa pré-chamada SHALL permanecer `null`, sem virar zero nem custo efetivo
