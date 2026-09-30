# Lab Admin UI — delta (F48.2.4)

## MODIFIED Requirements

### Requirement: Preflight visível: compor, editar e aprovar

A tela da bancada SHALL oferecer a etapa de preflight — "Compor prompt", exibição do prompt compilado (com os blocos canônicos, a direção tipográfica e as **versões das políticas e do prompt-base padrão**), edição manual e **aprovação explícita** — antes de habilitar a estimativa/confirmação da geração. A tela SHALL exibir a **referência canônica de identidade** que será transportada. Qualquer mudança nas entradas (incluindo prompt-base, configuração multidimensional e modelo/qualidade) ou no prompt após a aprovação SHALL invalidar a aprovação na UI. A confirmação financeira SHALL permanecer separada da aprovação do prompt.

#### Scenario: Prompt compilado é exibido e editável

- **WHEN** o administrador aciona "Compor prompt"
- **THEN** o prompt compilado é exibido com os blocos canônicos e as versões
- **AND** pode ser editado manualmente

#### Scenario: Aprovação habilita a geração

- **WHEN** o administrador aprova o prompt
- **THEN** o caminho de estimativa/confirmação é habilitado
- **AND** a confirmação financeira permanece um passo separado

#### Scenario: Mudança invalida a aprovação

- **WHEN** um dado de entrada (incluindo prompt-base, configuração ou modelo/qualidade) ou o prompt muda após a aprovação
- **THEN** a aprovação é invalidada
- **AND** uma nova composição e aprovação é exigida

#### Scenario: Identidade transportada é visível

- **WHEN** a loja possui identidade canônica
- **THEN** a referência de identidade que será transportada é exibida
- **AND** nenhuma URL assinada é persistida pela UI

## ADDED Requirements

### Requirement: Políticas, versões e prompt-base padrão visíveis

A tela da bancada SHALL exibir as políticas habilitadas do recorte (com versão), a **versão do prompt-base padrão** e o conteúdo do prompt-base carregado, permitindo editá-lo antes da composição.

#### Scenario: Políticas e prompt-base padrão são exibidos

- **WHEN** a bancada é carregada
- **THEN** as políticas habilitadas, suas versões e o prompt-base padrão versionado são exibidos
- **AND** o prompt-base pode ser editado

### Requirement: Tentativas anteriores e nova tentativa

A tela da bancada SHALL apresentar o resultado, as evidências e as **tentativas anteriores** de forma enxuta (desktop-only) e SHALL oferecer a ação **"Nova tentativa"**, que cria um novo run reaproveitando as entradas sem reupload manual. A tela SHALL NOT oferecer comparação lado a lado, votação, ranking ou avaliação automática.

#### Scenario: Tentativas anteriores são listadas

- **WHEN** a bancada exibe uma campanha com tentativas
- **THEN** as tentativas anteriores são listadas com seu resultado
- **AND** nenhuma comparação lado a lado ou votação é oferecida

#### Scenario: Nova tentativa é iniciada

- **WHEN** o administrador aciona "Nova tentativa"
- **THEN** um novo run é criado reaproveitando as entradas
- **AND** o operador pode editar, recompor e aprovar um novo prompt

#### Scenario: Desktop-only

- **WHEN** a bancada com tentativas é renderizada
- **THEN** ela permanece desktop-only
- **AND** não exige layout mobile
