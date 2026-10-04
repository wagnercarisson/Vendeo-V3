## MODIFIED Requirements

### Requirement: Resolução explícita e fail-closed das políticas

A bancada SHALL resolver explicitamente políticas habilitadas a partir da configuração multidimensional. Para o recorte Produto + quadrado 1:1, SHALL habilitar intenções `oferta`, `destaque` e `exclusivo`, conteúdo `produto`, formato `1:1`, estrutura `peca-unica` e tema neutro `nenhum`. Serviço, outros formatos, informativos, temas, carrossel e combinações não suportadas SHALL permanecer desabilitados com motivo. Dimensão sem política ou combinação não suportada SHALL falhar antes de qualquer chamada paga, sem fallback ou improvisação.

#### Scenario: Combinação não suportada falha antes da chamada paga
- **WHEN** a configuração referencia uma combinação não habilitada
- **THEN** a composição falha antes de qualquer chamada paga
- **AND** nenhum fallback ou composição improvisada é produzido

#### Scenario: Dimensão habilitada sem política falha
- **WHEN** uma dimensão habilitada não possui política implementada
- **THEN** a resolução falha de forma explícita
- **AND** nenhuma chamada paga é iniciada

#### Scenario: Três intenções habilitadas somente em Produto 1:1
- **WHEN** políticas habilitadas são listadas para Produto + 1:1
- **THEN** Oferta, Destaque e Exclusivo podem ser resolvidos com Produto, 1:1, peça única e tema neutro
- **AND** Serviço, outros formatos e demais combinações permanecem desabilitados com motivo

### Requirement: Política Oferta orienta a hierarquia comercial sem posições fixas

A política `oferta` SHALL usar a instrução concisa: “Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.” SHALL NOT impor posições fixas. Orientações próprias de Produto pertencem à política `produto`; orientações comerciais próprias de Destaque/Exclusivo pertencem às respectivas políticas, sem duplicação com Produto ou política geral. A validade informada em Oferta SHALL continuar incluída no prompt como dado comercial. A UI/backend controla as intenções que aceitam validade; nenhuma explicação dessas regras será acrescentada ao modelo.

#### Scenario: Instrução comercial de Oferta é concisa
- **WHEN** a política Oferta contribui para o prompt
- **THEN** usa exatamente a instrução concisa definida neste requisito
- **AND** validade informada continua como dado comercial do prompt
- **AND** nenhuma explicação sobre quais intenções aceitam validade é acrescentada ao modelo
- **AND** não duplica orientação de Produto ou das demais políticas de intenção

#### Scenario: Nenhuma posição fixa é imposta
- **WHEN** a política Oferta é aplicada
- **THEN** nenhuma posição fixa, coordenada ou regra de layout rígida é imposta
- **AND** o modelo permanece livre para encontrar o melhor arranjo

### Requirement: Rótulo comum do preço de venda é semanticamente neutro

A serialização compartilhada do valor `discountedPriceText` SHALL usar o rótulo `Preço de venda`, sem alterar o valor numérico ou as demais linhas comerciais. O compositor SHALL identificar essa alteração comum como `48.2.4-prompt-composer-v2`. O rótulo é apenas um campo de dado neutro; a interpretação promocional, quando aplicável, é responsabilidade exclusiva da política Oferta existente, cuja versão e texto SHALL permanecer inalterados.

#### Scenario: Destaque com preço único não recebe semântica de promoção pelo rótulo
- **WHEN** Destaque compõe um produto com `priceCents=1999` e sem `originalPriceCents`
- **THEN** o prompt contém `Preço de venda: R$ 19,99`
- **AND** o prompt não contém `Preço promocional` nem instrução/versão Oferta
- **AND** contém a instrução e versão Destaque existentes

#### Scenario: Oferta mantém a instrução promocional própria
- **WHEN** Oferta compõe os valores comerciais
- **THEN** a linha serializada usa `Preço de venda` com os valores numéricos preservados
- **AND** somente a política Oferta fornece a instrução promocional existente
- **AND** o texto e versão da política Oferta permanecem inalterados

### Requirement: Política Produto orienta o foco no produto e o uso das referências

A política `produto` SHALL orientar o produto como elemento principal, preservar fidelidade de aparência, embalagem e características e definir a primeira imagem enviada como variante protagonista. A instrução de imagem SHALL ser exatamente: “A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.” Referências auxiliares podem representar múltiplas representações, ângulos e variantes do produto anunciado; são opcionais e não têm garantia de aparição. O contrato técnico existente de limite, ordem e transporte permanece vigente. Isso não cria suporte a produtos independentes ou combos. A política SHALL NOT proibir absolutamente múltiplas representações nem declarar orientações comerciais, que pertencem às políticas de intenção cabíveis.

#### Scenario: Foco no produto é gerado
- **WHEN** a política Produto contribui para o prompt
- **THEN** orienta o produto como elemento principal e preserva aparência, embalagem e características
- **AND** não cria atributos do produto

#### Scenario: Instrução concisa de imagem substitui a antiga
- **WHEN** a política Produto orienta imagens
- **THEN** usa exatamente a instrução “A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.”
- **AND** não acrescenta proibição de duplicação de produto
- **AND** não promete aparição de auxiliares

#### Scenario: Variações do produto anunciado podem ser representadas
- **WHEN** imagens auxiliares mostram ângulos ou variantes do produto anunciado
- **THEN** são aceitas como referências do mesmo produto
- **AND** não implicam suporte a produtos independentes ou combos

#### Scenario: Contratos técnicos de imagem permanecem
- **WHEN** imagens são enviadas
- **THEN** limites, ordem principal → auxiliares → identidade e transporte seguem o contrato técnico existente
- **AND** instruções textuais não são confundidas com implementação de transporte

#### Scenario: Orientações comerciais pertencem às intenções
- **WHEN** políticas Produto e de intenção são compostas
- **THEN** Produto não emite orientações comerciais
- **AND** cada intenção emite somente suas orientações comerciais cabíveis

### Requirement: Política Produto preserva nome, contexto da descrição e textos obrigatórios

A política determinística `produto` SHALL usar instruções concisas: “Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.”; “Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.”; “Textos obrigatórios: exiba cada texto integralmente uma única vez.” O nome SHALL manter todas as palavras/conteúdo, sem abreviar, substituir, omitir ou corrigir silenciosamente; capitalização, quebras de linha e arranjo tipográfico podem variar. A descrição serve de apoio à arte/copy e pode ser melhorada, adaptada, resumida, parcialmente utilizada ou omitida sem desvirtuar contexto/significado nem inventar atributos, benefícios ou condições. Cada informação obrigatória SHALL ser reproduzida integralmente uma única vez conforme aprovada. Após decisão `keep_exactly`, a grafia aprovada SHALL ser preservada, inclusive possíveis erros. Presença/fidelidade na imagem são critérios humanos, não garantias técnicas. A regra de exibição única SHALL pertencer somente à política Produto; nenhuma outra política a SHALL duplicar. Os contratos existentes de revisão textual e `keep_exactly` permanecem inalterados.

O campo de nome serializado pelo compositor SHALL usar exatamente o rótulo `Nome do produto obrigatório` (linha compilada `Nome do produto obrigatório: {nome}`). Este rótulo não altera a liberdade de apresentação/capitalização da instrução de preservação acima. A versão vigente da política Produto SHALL ser `48.2.6-produto-v3`.

#### Scenario: Nome compilado recebe o rótulo obrigatório
- **WHEN** a composição serializa o nome de produto informado
- **THEN** a linha é exatamente `Nome do produto obrigatório: {nome}`
- **AND** a política Produto é identificada como `48.2.6-produto-v3`
- **AND** a instrução existente de preservar todas as palavras e permitir capitalização, quebras de linha e arranjo livres permanece inalterada

#### Scenario: Nome preserva palavras e conteúdo
- **WHEN** nome informado/aprovado é usado
- **THEN** todas as palavras e conteúdo são preservados
- **AND** capitalização, quebras e arranjo podem variar
- **AND** não há abreviação, substituição, omissão ou correção silenciosa

#### Scenario: Grafia aprovada por keep_exactly é preservada
- **WHEN** usuário escolhe “Manter exatamente como informado” após alerta
- **THEN** a grafia aprovada, inclusive possíveis erros, permanece
- **AND** não é corrigida nem substituída

#### Scenario: Descrição é apoio opcional à arte e copy
- **WHEN** descrição opcional é usada
- **THEN** pode ser adaptada, melhorada, resumida, parcialmente utilizada ou omitida
- **AND** preserva contexto/significado sem inventar atributos, benefícios ou condições

#### Scenario: Informação obrigatória é reproduzida integralmente
- **WHEN** há informação obrigatória aprovada
- **THEN** seu conteúdo integral é instruído para reprodução
- **AND** presença/fidelidade visual é avaliada por humano sem garantia técnica

#### Scenario: Critérios textuais são separados
- **WHEN** uma saída é avaliada
- **THEN** nome, descrição e textos obrigatórios são critérios humanos distintos
- **AND** ausência de evidência não é tratada como aprovação

### Requirement: Política geral de integridade do resultado visual

A composição determinística SHALL orientar português correto e natural, evitar caracteres, símbolos ou pontuação duplicados/anômalos e não corrigir silenciosamente textos de entrada. A política geral SHALL NOT definir a transformação/apresentação de nome ou descrição nem regras comerciais. Nome, descrição e textos obrigatórios pertencem à política `produto`; as orientações comerciais cabíveis pertencem exclusivamente à política da intenção correspondente. Políticas SHALL evitar duplicação semântica entre si e manter instruções gerais independentes de exemplos específicos.

#### Scenario: Integridade geral não duplica políticas
- **WHEN** conteúdo visual é criado a partir das entradas aprovadas
- **THEN** a política geral orienta português correto, natural e sem anomalias de caracteres/pontuação
- **AND** não corrige silenciosamente nem duplica regras textuais de Produto ou comerciais das intenções

#### Scenario: Política geral não contém regra comercial específica
- **WHEN** política geral é inspecionada
- **THEN** não define preço, validade, selo ou condição comercial
- **AND** essas instruções pertencem às políticas de intenção cabíveis

## ADDED Requirements

### Requirement: Políticas Destaque e Exclusivo usam instruções comerciais concisas

A política versionada Destaque SHALL permanecer usando: “Destaque: priorize a apresentação do produto; preço informado é secundário.” A política Exclusivo vigente `48.2.6-exclusivo-v3` SHALL usar exatamente: “Exclusivo: apresente o produto sem preço em uma composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais. Respeite os selos informados sem inventar informações.” A política SHALL NOT acrescentar qualquer outra orientação ou alterar as listas/permissões de selos existentes. Selos explicitamente selecionados pelo usuário são dados de entrada. As orientações SHALL NOT ser duplicadas em Produto, política geral ou prompt-base.

#### Scenario: Destaque prioriza produto e torna preço secundário
- **WHEN** intenção é Destaque
- **THEN** instrução de intenção corresponde exatamente ao texto conciso definido
- **AND** preço ausente não é inventado

#### Scenario: Exclusivo não cria alegações ou atributos
- **WHEN** intenção é Exclusivo
- **THEN** usa exatamente a instrução `Exclusivo: apresente o produto sem preço em uma composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais. Respeite os selos informados sem inventar informações.`
- **AND** a versão resolvida é `48.2.6-exclusivo-v3`
- **AND** nenhum texto adicional é acrescentado pela política
- **AND** as opções/permissões existentes de selos não são alteradas

#### Scenario: Exclusivo sem selo não inventa selo
- **WHEN** Exclusivo é composto sem selo
- **THEN** não é inventado nem serializado um selo
- **AND** a instrução v2 permanece literal

#### Scenario: Exclusivo preserva selos permitidos
- **WHEN** o usuário informa `Exclusivo` ou `Edição Limitada`, valores já permitidos
- **THEN** cada selo informado é preservado na composição
- **AND** nenhum novo valor ou permissão de selo é criado

#### Scenario: Orientações são disjuntas
- **WHEN** políticas de Produto, intenção e integridade geral são compostas
- **THEN** instruções específicas de intenção aparecem somente na política da intenção
- **AND** regra geral e política Produto não as repetem
