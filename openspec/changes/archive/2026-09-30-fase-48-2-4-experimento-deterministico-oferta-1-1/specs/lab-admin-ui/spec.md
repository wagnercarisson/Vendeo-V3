# Lab Admin UI — delta (F48.2.4)

## MODIFIED Requirements

### Requirement: Preflight visível: compor, editar e aprovar

A tela da bancada SHALL oferecer a etapa de preflight — "Compor prompt", exibição do prompt compilado (com os blocos canônicos, a direção tipográfica e as **versões das políticas e do prompt-base padrão**), edição manual e **aprovação explícita** — antes de habilitar a estimativa/confirmação da geração. A tela SHALL exibir a **referência canônica de identidade** que será transportada. Qualquer mudança nas entradas que **componham o texto ou as referências** (incluindo prompt-base, branding/identidade, produto/campanha, imagens, condições comerciais, intenção/formato/tipo de conteúdo/estrutura/tema e textos obrigatórios) ou no prompt após a aprovação SHALL invalidar a aprovação na UI. A **configuração de execução** (`modelo`/`preset`/`qualidade`) SHALL NOT invalidar a aprovação: alterá-la SHALL invalidar **somente** a estimativa e a confirmação financeira, mantendo o mesmo prompt aprovado. A confirmação financeira SHALL permanecer separada da aprovação do prompt.

#### Scenario: Prompt compilado é exibido e editável

- **WHEN** o administrador aciona "Compor prompt"
- **THEN** o prompt compilado é exibido com os blocos canônicos e as versões
- **AND** pode ser editado manualmente

#### Scenario: Aprovação habilita a geração

- **WHEN** o administrador aprova o prompt
- **THEN** o caminho de estimativa/confirmação é habilitado
- **AND** a confirmação financeira permanece um passo separado

#### Scenario: Mudança de entrada que compõe o texto invalida a aprovação

- **WHEN** um dado de entrada que compõe o texto/referências (incluindo prompt-base) ou o prompt muda após a aprovação
- **THEN** a aprovação é invalidada
- **AND** uma nova composição e aprovação é exigida

#### Scenario: Mudança de modelo/qualidade não invalida a aprovação

- **WHEN** o modelo, o preset ou a qualidade muda após a aprovação
- **THEN** a aprovação do prompt permanece válida
- **AND** somente a estimativa e a confirmação financeira são invalidadas

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

### Requirement: Seleção explícita de imagem principal e imagens adicionais

O uploader da bancada SHALL oferecer um campo explícito e **obrigatório** para a **imagem principal** e um campo **separado** para **até três imagens adicionais opcionais**. O operador SHALL poder selecionar a principal e depois acrescentar adicionais **sem substituir silenciosamente** a seleção anterior, e SHALL poder **remover ou substituir** qualquer imagem antes do envio. A UI SHALL exibir claramente qual imagem é a principal, quais são as adicionais e a **ordem** das adicionais.

No envio, o uploader SHALL construir **um único multipart ordenado** — (1) principal; (2) adicionais na ordem exibida — preservando o contrato atual da rota (`operationId` + `files`), sem criar endpoint adicional e sem append mutável em run já enviado. O servidor SHALL persistir a principal no índice 0 e as adicionais nos índices seguintes, na ordem recebida. A identidade canônica continua sendo anexada **posteriormente pelo runtime** como a última referência.

Alterar a seleção após um upload SHALL exigir **novo envio do conjunto completo** para um **novo `draft`/operação** (preservando os runs anteriores). O fingerprint da operação SHALL representar `storeId + principal + adicionais em ordem` (não uma ordenação alfabética), de modo que trocar principal por adicional, remover uma imagem ou mudar a ordem produza fingerprint/operação diferente; reenviar exatamente o mesmo conjunto, com os mesmos papéis e ordem, SHALL permanecer idempotente. Alterações nas imagens SHALL continuar invalidando o prompt compilado/aprovado.

Limites preservados: uma principal; até três adicionais; apenas MIME já aceitos pela bancada; limite de tamanho já definido pelo projeto. Nenhum tipo, bucket ou política de storage é ampliado.

#### Scenario: Segunda imagem não substitui a principal

- **WHEN** o operador seleciona a imagem principal e depois uma segunda imagem
- **THEN** ambas permanecem selecionadas (principal + adicional)
- **AND** a seleção anterior não é substituída silenciosamente

#### Scenario: Adicionais não apagam a principal

- **WHEN** o operador adiciona imagens adicionais em uma ação posterior
- **THEN** a imagem principal permanece selecionada

#### Scenario: Remover e substituir antes do envio

- **WHEN** o operador remove ou substitui uma imagem antes do envio
- **THEN** a seleção é atualizada sem enviar nada
- **AND** o envio posterior usa a seleção atual

#### Scenario: Mais de três adicionais é recusado

- **WHEN** o operador tenta selecionar mais de três imagens adicionais
- **THEN** a UI recusa a seleção excedente
- **AND** nenhum envio é feito

#### Scenario: Multipart preserva a ordem principal → adicionais

- **WHEN** o operador envia a seleção
- **THEN** um único multipart é construído na ordem principal → adicionais
- **AND** a resposta produz `references` nessa mesma ordem
- **AND** nenhum endpoint adicional é criado

#### Scenario: Fingerprint representa papéis e ordem

- **WHEN** o operador troca a principal por uma adicional, remove uma imagem ou muda a ordem
- **THEN** o fingerprint/operação é diferente
- **AND** reenviar o mesmo conjunto, com os mesmos papéis e ordem, permanece idempotente

#### Scenario: Alterar imagens invalida o prompt aprovado

- **WHEN** a seleção de imagens muda após a aprovação
- **THEN** o prompt compilado/aprovado é invalidado
