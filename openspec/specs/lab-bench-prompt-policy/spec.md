# Lab Bench Prompt Policy

> Synced from `fase-48-2-4-experimento-deterministico-oferta-1-1` (ADDED).

## Purpose

Define o compositor determinístico multidimensional e extensível da bancada (núcleo + políticas independentes e versionadas de intenção/formato/conteúdo/estrutura/tema), a política Oferta, a política de formato 1:1, a resolução explícita das políticas habilitadas e a falha fail-closed para combinação não suportada antes da chamada paga.

## Requirements

### Requirement: Núcleo do compositor determinístico e extensível

A bancada SHALL compor o prompt por um **núcleo determinístico** que organiza os blocos canônicos, omite campos vazios, preserva o prompt-base e produz saída estável, e que SHALL NOT conter regra alguma específica de intenção, destaque, exclusivo, formato, tipo de conteúdo, estrutura ou tema. O núcleo SHALL ser **puro e sem IA** (sem I/O, sem provider, sem client de banco) e SHALL ser extensível por políticas, de modo que novas combinações sejam acrescentadas sem duplicar o compositor nem alterar o núcleo.

#### Scenario: Núcleo não contém regra específica de dimensão

- **WHEN** o núcleo do compositor é inspecionado
- **THEN** ele não contém regra específica de oferta, destaque, exclusivo, formato, conteúdo, estrutura ou tema
- **AND** apenas organiza blocos, omite vazios, preserva o prompt-base e serializa

#### Scenario: Núcleo é puro e sem IA

- **WHEN** o prompt é composto
- **THEN** nenhuma chamada de IA é realizada
- **AND** nenhum acesso a banco, provider ou rede ocorre

#### Scenario: Mesma entrada produz a mesma saída

- **WHEN** a mesma entrada estruturada, a mesma versão das políticas e o mesmo prompt-base são compostos novamente
- **THEN** o prompt compilado é exatamente o mesmo

### Requirement: Políticas independentes e versionadas

Cada dimensão do recorte SHALL ser governada por uma **política independente e versionada** (`intenção`, `formato`, `tipo de conteúdo`, `estrutura`, `tema`). Cada política SHALL declarar em quais blocos canônicos contribui e as linhas que produz, e SHALL expor um identificador e uma versão. O prompt compilado SHALL registrar as versões das políticas resolvidas.

#### Scenario: Cada dimensão tem sua política versionada

- **WHEN** as políticas do recorte são resolvidas
- **THEN** cada dimensão habilitada tem uma política com identificador e versão
- **AND** as versões resolvidas integram a evidência

#### Scenario: Política contribui para blocos declarados

- **WHEN** uma política produz conteúdo
- **THEN** ela contribui apenas para os blocos canônicos que declara
- **AND** o núcleo apenas coleta e ordena as contribuições

### Requirement: Resolução explícita e fail-closed das políticas

A bancada SHALL resolver **explicitamente** as políticas habilitadas a partir da configuração multidimensional. Se uma dimensão habilitada não possuir política implementada, ou se a combinação não for suportada, a composição SHALL falhar **antes de qualquer chamada paga**, sem fallback e sem improvisação. Nesta fase SHALL habilitar somente as políticas `oferta`, `1:1`, `produto`, `peca-unica` e tema neutro `nenhum`; Destaque, Exclusivo, 9:16, serviços, informativos, temas e carrossel SHALL permanecer desabilitados.

#### Scenario: Combinação não suportada falha antes da chamada paga

- **WHEN** a configuração referencia uma combinação não habilitada
- **THEN** a composição falha antes de qualquer chamada paga
- **AND** nenhum fallback ou composição improvisada é produzido

#### Scenario: Dimensão habilitada sem política falha

- **WHEN** uma dimensão habilitada não possui política implementada
- **THEN** a resolução falha de forma explícita
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Somente o recorte Oferta 1:1 é habilitado

- **WHEN** as políticas habilitadas são listadas
- **THEN** somente `oferta`, `1:1`, `produto`, `peca-unica` e `nenhum` estão habilitadas
- **AND** as demais combinações estão desabilitadas com motivo

### Requirement: Política Oferta orienta a hierarquia comercial sem posições fixas

A política `oferta` SHALL orientar, **sem fixar posições nem coordenadas**, a **hierarquia comercial**: o preço promocional com maior importância comercial; o preço original claramente secundário **quando informado**; selo, validade e textos comerciais com hierarquia adequada; leitura imediata; excelente legibilidade; acabamento comercial de alta qualidade; liberdade para o modelo encontrar o melhor arranjo; e a proibição de inventar **preço, desconto, validade ou textos comerciais**. A política `oferta` SHALL NOT declarar orientações de produto (produto como elemento principal, fidelidade de aparência/embalagem, uso das referências, proibição de inventar produto/benefícios), que pertencem **exclusivamente** à política `produto`. A política SHALL NOT impor regras como "logo à direita", "produto centralizado" ou coordenadas rígidas.

#### Scenario: Orientação comercial é gerada

- **WHEN** a política `oferta` contribui para o prompt
- **THEN** ela orienta a hierarquia de preços, selo, validade, textos comerciais, legibilidade e acabamento comercial
- **AND** proíbe inventar preço, desconto, validade ou textos comerciais
- **AND** não declara orientações de produto

#### Scenario: Nenhuma posição fixa é imposta

- **WHEN** a política `oferta` é aplicada
- **THEN** nenhuma posição fixa, coordenada ou regra de layout rígida é imposta
- **AND** o modelo permanece livre para encontrar o melhor arranjo

### Requirement: Política Produto orienta o foco no produto e o uso das referências

A política `produto` SHALL orientar, **sem fixar posições nem coordenadas**, o produto como elemento principal; a fidelidade de aparência, embalagem e características; o uso das imagens/referências do produto; e a proibição de inventar produto ou benefícios. A política `produto` SHALL NOT declarar orientações comerciais (hierarquia de preço, selo, validade, textos comerciais, legibilidade, invenção de preço/desconto/validade), que pertencem **exclusivamente** à política `oferta`. As políticas `oferta` e `produto` SHALL ter **propriedade exclusiva e disjunta**, de modo que nenhuma orientação seja emitida por ambas.

#### Scenario: Foco no produto é gerado

- **WHEN** a política `produto` contribui para o prompt
- **THEN** ela orienta o produto como elemento principal, a fidelidade de aparência/embalagem e o uso das referências
- **AND** proíbe inventar produto ou benefícios
- **AND** não declara orientações comerciais

#### Scenario: Propriedade exclusiva entre oferta e produto

- **WHEN** as políticas `oferta` e `produto` compõem o prompt
- **THEN** nenhuma orientação é emitida por ambas
- **AND** a não-duplicação semântica é verificada por um teste golden do prompt completo e por atribuição exclusiva por política

### Requirement: Política de formato 1:1 orienta composição quadrada sem congelar layout

A política `1:1` SHALL orientar composição **quadrada e equilibrada** em linguagem natural ("quadrado 1:1"), sem congelar layout nem impor posições. Formatos futuros SHALL ser acrescentados como novas políticas, sem alterar o núcleo.

#### Scenario: Formato quadrado é orientado

- **WHEN** a política `1:1` contribui para o prompt
- **THEN** ela orienta composição quadrada e equilíbrio espacial
- **AND** não impõe posições fixas

### Requirement: Prompt compilado em linguagem natural e sem redundância no conteúdo gerado

O prompt compilado SHALL apresentar valores técnicos em **linguagem natural** ("Oferta" em vez de `offer`; "quadrado 1:1") e SHALL omitir dimensões neutras que não acrescentam orientação (tema `nenhum`). A regra de não-duplicação SHALL aplicar-se **exclusivamente ao conteúdo gerado pelo compositor** (políticas e blocos): cada condição comercial e cada texto obrigatório SHALL aparecer **uma única vez** no conteúdo gerado, sem duplicação estrutural ou semântica entre políticas/blocos. O **prompt-base editado pelo operador SHALL ficar explicitamente fora dessa deduplicação** e ser preservado integralmente, inclusive suas repetições.

#### Scenario: Valores técnicos são traduzidos

- **WHEN** o prompt compilado é gerado
- **THEN** a intenção aparece como "Oferta" e o formato como "quadrado 1:1"
- **AND** valores internos crus não são expostos sozinhos

#### Scenario: Dimensão neutra é omitida

- **WHEN** o tema é `nenhum`
- **THEN** nenhuma linha de tema é incluída no prompt compilado

#### Scenario: Condição comercial não é duplicada no conteúdo gerado

- **WHEN** uma condição comercial ou um texto obrigatório é composto por políticas/blocos
- **THEN** ele aparece uma única vez no conteúdo gerado

#### Scenario: Prompt-base do operador fica fora da deduplicação

- **WHEN** o prompt-base editado contém repetições ou repete uma orientação das políticas
- **THEN** o prompt-base é preservado integralmente
- **AND** nenhuma deduplicação é aplicada sobre ele
