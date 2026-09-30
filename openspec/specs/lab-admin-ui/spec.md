# Lab Admin UI

> Synced from `fase-48-1-laboratorio-ia-minimo` (ADDED), `fase-48-2-2-fundacao-bancada-geracao` (ADDED), `fase-48-2-3-fidelidade-experimental-bancada` (ADDED) and `fase-48-2-4-experimento-deterministico-oferta-1-1` (MODIFIED/ADDED).

## Purpose

Define a superfície visual do laboratório sob `/admin/laboratorio` com navegação interna própria.

## Requirements

### Requirement: Entrada única e navegação interna

A administração SHALL expor o laboratório em `/admin/laboratorio` com um único link na navegação principal do admin e uma navegação interna própria (Experimentos, Cenários, Avaliações), sem espalhar múltiplos links pela navegação principal.

#### Scenario: Link único na navegação principal

- **WHEN** um admin abre a área administrativa
- **THEN** existe um único link para o laboratório
- **AND** os demais itens do laboratório não aparecem na navegação principal

#### Scenario: Navegação interna própria

- **WHEN** o admin está dentro do laboratório
- **THEN** a navegação interna permite acessar experimentos, cenários e avaliações

### Requirement: Página inicial funcional

A página inicial do laboratório SHALL mostrar experimentos e avaliações pendentes de maneira funcional, sem dashboard sofisticado.

#### Scenario: Experimentos e pendências são exibidos

- **WHEN** o admin abre `/admin/laboratorio`
- **THEN** os experimentos recentes e as avaliações pendentes são exibidos
- **AND** cada item permite navegar ao detalhe correspondente

#### Scenario: Estado vazio é claro

- **WHEN** não há experimentos
- **THEN** um estado vazio com ação de criar experimento é exibido

### Requirement: Estado de ambiente desabilitado

Quando a guarda de ambiente recusar a superfície, as páginas SHALL exibir um estado claro de laboratório desabilitado com o motivo, sem acessar as tabelas `lab_*`, o storage do laboratório ou os providers.

#### Scenario: Ambiente bloqueado mostra aviso

- **WHEN** o laboratório está desabilitado no ambiente atual
- **THEN** a página exibe um aviso de indisponibilidade com o motivo
- **AND** nenhuma tabela `lab_*`, storage do laboratório ou provider é acessado

### Requirement: Criação e detalhe de experimento

A UI SHALL permitir criar um experimento (nome, objetivo, hipótese, tipo de campanha obrigatório, programa obrigatório, cenário(s), baseline, candidata, repetições e teto) e visualizar o detalhe com variantes, runs, budget restante e ação de executar run. A UI SHALL exibir o prompt sob teste correspondente ao tipo de campanha e manter a dimensão alterada `prompt` com o modelo fixo exibido como não editável. A UI SHALL permitir que a candidata seja **inserida ou colada manualmente** e SHALL exibir, de forma integrada na tela relevante, o orçamento **autorizado, reservado, consumido e o saldo restante**, além de oferecer a ação explícita **"Encerrar programa / revogar autorização"** com confirmação humana.

#### Scenario: Formulário cria experimento

- **WHEN** o admin preenche e submete o formulário válido
- **THEN** o experimento é criado e o detalhe é exibido

#### Scenario: Candidata é inserida manualmente

- **WHEN** o admin prepara um experimento
- **THEN** ele insere ou cola manualmente a candidata
- **AND** a UI não gera candidatas automaticamente

#### Scenario: Tipo de campanha e programa são obrigatórios

- **WHEN** o admin preenche o formulário
- **THEN** o tipo de campanha e o programa são exigidos
- **AND** o formulário não permite submeter sem ambos

#### Scenario: Prompt do Diretor é selecionável por tipo de campanha

- **WHEN** o admin escolhe o tipo de campanha
- **THEN** a UI exibe o prompt sob teste correspondente (`campaign-image-director-offer`, `-spotlight` ou `-exclusive`)
- **AND** impede combinar um prompt com o tipo errado

#### Scenario: Dimensão é prompt e modelo é fixo

- **WHEN** o admin preenche o formulário de experimento
- **THEN** a dimensão alterada é `prompt` e o modelo é exibido como fixo (não editável por variante)
- **AND** o formulário não oferece comparação de modelo nesta fase

#### Scenario: Execução exige estimativa e confirmação

- **WHEN** o admin aciona “Executar run”
- **THEN** a UI exibe a estimativa de custo e exige confirmação explícita
- **AND** só então dispara a execução, exibindo o progresso
- **AND** quando a cobertura de pricing é parcial, o custo é apresentado como faixa ("a partir de US$ X") e nunca como total exato
- **AND** quando a cobertura é ausente, o custo é apresentado como "indisponível"
- **AND** a mesma representação de custo aparece no diálogo de confirmação

#### Scenario: Budget restante é visível

- **WHEN** o detalhe do experimento é exibido
- **THEN** o número de execuções restantes é mostrado

#### Scenario: Orçamento completo é exibido e integrado

- **WHEN** a tela relevante é exibida
- **THEN** o orçamento autorizado, reservado, consumido e o saldo restante são mostrados
- **AND** o painel de orçamento está integrado à tela (não órfão)

#### Scenario: Encerrar programa exige confirmação humana

- **WHEN** o admin aciona "Encerrar programa / revogar autorização"
- **THEN** a UI exige confirmação humana antes de concluir
- **AND** após confirmar, o programa fica `closed` e novas reservas passam a ser recusadas

### Requirement: Conformidade com o design system

As telas do laboratório SHALL seguir `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis e sem light mode) e usar os primitivos de UI existentes.

#### Scenario: Estilo consistente

- **WHEN** as telas do laboratório são renderizadas
- **THEN** elas usam os tokens e componentes do design system
- **AND** não introduzem emojis, light mode ou ícones fora do `lucide-react`

#### Scenario: Acessibilidade básica

- **WHEN** os formulários e ações são usados
- **THEN** rótulos, foco e mensagens de erro acessíveis são aplicados
- **AND** os alvos de toque respeitam o mínimo do design system

### Requirement: Formulário de rubrica humana

A UI SHALL oferecer um formulário de avaliação humana que apresente os nove critérios com estado estruturado (`adequate`/`minor_defect`/`critical_defect`/`not_applicable`) e observação opcional. O formulário SHALL preservar a comparação cega, reiniciar quando o par comparado muda e SHALL NOT exibir nota automática.

#### Scenario: Rubrica é apresentada

- **WHEN** o admin avalia um par
- **THEN** os nove critérios são apresentados com estado estruturado e observação opcional
- **AND** nenhum score automático é exibido

#### Scenario: Formulário reinicia com o par

- **WHEN** o admin troca o cenário ou a repetição depois de preencher a rubrica
- **THEN** o formulário é reiniciado
- **AND** a avaliação registrada corresponde ao par exibido no momento do envio

### Requirement: Tela da bancada e navegação interna

A administração SHALL expor a bancada em `/admin/laboratorio/bancada` acessível pela navegação interna do laboratório, sem adicionar um segundo link na navegação principal do admin. A bancada SHALL ser desktop-only e SHALL NOT exigir responsividade mobile.

#### Scenario: Bancada é acessível pela navegação interna

- **WHEN** o admin está dentro do laboratório
- **THEN** a navegação interna permite acessar a bancada
- **AND** não há novo link na navegação principal

#### Scenario: Bancada é desktop-only

- **WHEN** a bancada é renderizada
- **THEN** ela não requer layout mobile

### Requirement: Fluxo mínimo da bancada

A tela SHALL oferecer: seleção de loja de teste local; visualização do branding completo; formulário mínimo compatível com campanha de produto/oferta; upload de imagens; editor de prompt manual; formato, modelo e qualidade; dimensões `intenção`, `tipo de conteúdo`, `estrutura` e `tema` travadas no primeiro recorte; estimativa; confirmação explícita; estado de execução; resultado; download; e evidências (prompt, configuração, latência, usage, custo e erro). A tela SHALL NOT oferecer comparação lado a lado nem votação.

#### Scenario: Formulário mínimo é preenchido

- **WHEN** o admin seleciona a loja, envia imagens, escreve o prompt e escolhe formato/modelo/qualidade
- **THEN** a configuração do primeiro recorte é aplicada às demais dimensões
- **AND** a tela não oferece comparação lado a lado nem votação

#### Scenario: Branding completo é exibido

- **WHEN** a loja é selecionada
- **THEN** o branding completo é exibido, incluindo a direção tipográfica

#### Scenario: Estimativa e confirmação antes de gerar

- **WHEN** o admin aciona "Gerar"
- **THEN** a UI exibe a estimativa e exige confirmação explícita
- **AND** quando a cobertura de pricing é parcial, o custo é apresentado como faixa ("a partir de US$ X")
- **AND** quando a cobertura é ausente, o custo é apresentado como "indisponível"

#### Scenario: Resultado, download e evidências

- **WHEN** a geração conclui
- **THEN** o resultado é exibido com download
- **AND** as evidências (prompt, configuração, latência, usage, custo e erro) são exibidas

### Requirement: Estado de ambiente desabilitado

Quando a guarda de ambiente recusar a superfície, a tela da bancada SHALL exibir um estado claro de indisponibilidade com o motivo, sem acessar as tabelas `lab_*`, as tabelas de loja/branding, o storage do laboratório ou os providers.

#### Scenario: Ambiente bloqueado mostra aviso

- **WHEN** a bancada está desabilitada no ambiente atual
- **THEN** a tela exibe um aviso de indisponibilidade com o motivo
- **AND** nenhuma tabela, storage ou provider é acessado

### Requirement: Conformidade com o design system

A tela da bancada SHALL seguir `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis e sem light mode) e SHALL usar os primitivos de UI existentes.

#### Scenario: Estilo consistente

- **WHEN** a tela da bancada é renderizada
- **THEN** ela usa os tokens e componentes do design system
- **AND** não introduz emojis, light mode ou ícones fora do `lucide-react`

#### Scenario: Acessibilidade básica

- **WHEN** os formulários e ações são usados
- **THEN** rótulos, foco e mensagens de erro acessíveis são aplicados

### Requirement: Formulário fiel na bancada

A tela da bancada SHALL oferecer os campos fiéis do formulário produtivo (nome, descrição, imagem principal e até três adicionais, preços de/por, selo promocional, intenção, preservação da imagem original, validade, aviso ilustrativo e informações obrigatórias na arte), mantendo-se desktop-only e sem comparação lado a lado ou votação.

#### Scenario: Campos fiéis são oferecidos

- **WHEN** o administrador preenche a bancada
- **THEN** os campos fiéis do formulário produtivo são oferecidos
- **AND** a tela permanece desktop-only

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

### Requirement: Resolução cromática visível e idêntica à produtiva

A tela da bancada SHALL exibir o `brandColor` resolvido, idêntico ao produtivo, sem oferecer nova precedência de cores nem expansão automática de paleta.

#### Scenario: brandColor resolvido é exibido

- **WHEN** o branding da loja é carregado
- **THEN** o `brandColor` resolvido é exibido
- **AND** corresponde ao valor produtivo
