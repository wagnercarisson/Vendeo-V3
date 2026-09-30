## MODIFIED Requirements

### Requirement: Política Produto orienta o foco no produto e o uso das referências

A política `produto` SHALL orientar, sem fixar posições nem coordenadas, o produto como elemento principal; a fidelidade de aparência, embalagem e características; e os papéis distintos das imagens: principal obrigatória, canônica e protagonista; até três adicionais opcionais do mesmo produto como referências auxiliares. A política SHALL instruir o modelo a usar a principal como protagonista visível, mas sua aparição é critério de avaliação humana, não garantia da bancada. As adicionais podem mostrar ângulos, detalhes, embalagem ou contexto e contribuir à fidelidade/composição, mas SHALL NOT duplicar o produto, competir com a principal ou criar outro protagonista; não existe garantia de que todas apareçam na arte final. A orientação SHALL ser simples e equivalente a: “Use a imagem principal como representação obrigatória e protagonista do produto. As imagens adicionais são referências auxiliares do mesmo produto; utilize-as quando contribuírem para fidelidade ou composição, sem duplicar o produto nem competir com a imagem principal.” A política SHALL proibir inventar produto ou benefícios. Ela SHALL NOT declarar orientações comerciais, que pertencem exclusivamente à política `oferta`.

#### Scenario: Política descreve os papéis de imagens
- **WHEN** a política `produto` contribui para o prompt
- **THEN** instrui o modelo a tratar a principal como obrigatória/protagonista e as adicionais como auxiliares/opcionais do mesmo produto
- **AND** preserva fidelidade e não inventa produto/benefícios
- **AND** a presença/fidelidade visual da principal é avaliada por humano, sem garantia técnica

#### Scenario: Adicionais não concorrem com a principal
- **WHEN** existem referências auxiliares
- **THEN** a política proíbe duplicar o produto ou criar protagonista concorrente
- **AND** não promete que todas aparecerão visualmente

#### Scenario: Política de produto não assume orientação comercial
- **WHEN** políticas `oferta` e `produto` são compostas
- **THEN** preço, selo, validade e integridade comercial permanecem atribuídos a `oferta`
- **AND** não há orientação duplicada entre as políticas

### Requirement: Política Produto preserva nome, contexto da descrição e textos obrigatórios

A política determinística `produto` SHALL orientar o modelo a exibir o nome do produto por inteiro e exatamente como informado e aprovado pelo usuário, sem abreviar, omitir, parafrasear ou corrigir silenciosamente. Se o usuário tiver escolhido “Manter exatamente como informado” após alertas, a grafia aprovada, inclusive possíveis erros, SHALL ser preservada. A descrição SHALL ser tratada como texto complementar: o modelo MAY selecionar, resumir ou adaptar sua redação para a peça, desde que preserve contexto e significado; SHALL NOT inventar características, benefícios, condições ou usos não informados. Informações explicitamente obrigatórias na arte SHALL ser reproduzidas literalmente. Presença e fidelidade desses conteúdos na imagem são critérios de avaliação humana, não garantia técnica da bancada.

#### Scenario: Nome do produto é íntegro e literal
- **WHEN** nome informado e aprovado é usado para compor a campanha
- **THEN** a política instrui o modelo a exibi-lo inteiro e exatamente como aprovado
- **AND** proíbe abreviar, omitir, parafrasear ou corrigir silenciosamente

#### Scenario: Nome mantido após alerta preserva grafia aprovada
- **WHEN** o usuário escolhe “Manter exatamente como informado” para o nome
- **THEN** a política usa a grafia aprovada inclusive se houver possível erro
- **AND** não substitui o nome por uma versão corrigida

#### Scenario: Descrição pode ser adaptada sem mudar significado
- **WHEN** a descrição alimenta a peça
- **THEN** o modelo pode selecionar, resumir ou adaptar sua redação
- **AND** preserva contexto e significado sem inventar características, benefícios, condições ou usos

#### Scenario: Texto obrigatório é literal
- **WHEN** há informação explicitamente obrigatória na arte
- **THEN** a política instrui reprodução literal
- **AND** a avaliação humana verifica presença e fidelidade sem supor garantia técnica

#### Scenario: Tipos textuais têm critérios separados no UAT
- **WHEN** uma saída é avaliada
- **THEN** nome integral/literal, descrição/contexto e texto obrigatório literal são registrados como critérios distintos

### Requirement: Política geral de integridade do resultado visual

A composição determinística SHALL orientar o conteúdo criado pelo modelo a usar português correto e natural, evitar caracteres, símbolos ou pontuação duplicados/anômalos e não corrigir silenciosamente textos de entrada. Esta orientação geral SHALL NOT definir a transformação/apresentação do nome ou da descrição do produto, nem mencionar preços, datas, selos, descontos, condições comerciais ou proibição comercial de invenção/interpretação. Nome, descrição e textos obrigatórios pertencem à política `produto`; integridade comercial pertence exclusivamente à política da intenção Oferta. As orientações SHALL ser gerais e independentes de exemplos numéricos ou strings específicas.

#### Scenario: Resultado respeita integridade textual e comercial
- **WHEN** o conteúdo visual é criado a partir das entradas aprovadas
- **THEN** orienta português correto, ausência de caracteres ou pontuação duplicados e ausência de correção silenciosa
- **AND** não duplica orientações comerciais da política Oferta
- **AND** não duplica os contratos de nome, descrição e texto obrigatório da política `produto`

#### Scenario: Regra não codifica exemplo específico
- **WHEN** a política de integridade é inspecionada
- **THEN** suas instruções são gerais para textos, números, símbolos e pontuação
- **AND** regras de preços, datas, selos e condições pertencem exclusivamente à política Oferta
- **AND** não contém regra específica para um erro numérico exemplificativo
