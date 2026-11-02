## ADDED Requirements

### Requirement: Namespace próprio de textos do dashboard

O sistema SHALL criar um namespace `dashboard` de textos de interface com catálogos completos em `pt-BR` e `es-419`. O namespace SHALL ser carregado somente pela rota do dashboard e NÃO SHALL ser incorporado ao catálogo global do shell nem ao payload enviado por `AppShell`.

O namespace SHALL cobrir, no mínimo, títulos, botões, rótulos, estados vazios, estados de carregamento, dicas, mensagens de falha, indisponibilidade, textos acessíveis e textos dos avisos de verificação e prontidão introduzidos ou consumidos pela F58.

#### Scenario: Dashboard em pt-BR recebe somente o namespace necessário
- **WHEN** um usuário com `uiLocale = "pt-BR"` acessa o dashboard
- **THEN** os textos fixos do dashboard SHALL vir do catálogo `pt-BR` do namespace `dashboard`
- **AND** o catálogo global do shell NÃO SHALL conter as chaves exclusivas do dashboard

#### Scenario: Dashboard em es-419 recebe textos traduzidos
- **WHEN** um usuário com `uiLocale = "es-419"` acessa o dashboard
- **THEN** os textos fixos do dashboard SHALL ser renderizados em `es-419`
- **AND** os mesmos cenários funcionais do dashboard SHALL permanecer disponíveis

#### Scenario: Payload global do shell não aumenta com o dashboard
- **WHEN** o shell é renderizado para qualquer rota
- **THEN** os catálogos do dashboard NÃO SHALL ser importados pelo módulo de catálogo global do shell
- **AND** a medição de payload SHALL comprovar que o namespace do dashboard não é entregue globalmente

### Requirement: Paridade de chaves e placeholders entre pt-BR e es-419

Os catálogos do dashboard SHALL ter exatamente as mesmas chaves nos dois idiomas. A paridade estrutural SHALL ser garantida em compilação pelo `satisfies DashboardMessages`, que exige as mesmas propriedades string e quebra o typecheck quando uma chave falta ou sobra.

Os placeholders de interpolação NÃO SHALL ser considerados garantidos pelo TypeScript, porque o tipo propõe apenas `string`. A equivalência de placeholders como `{name}` e `{count}` SHALL ser verificada por teste automatizado que compara cada string equivalente nos dois catálogos. Nenhuma das duas garantias substitui a outra.

#### Scenario: Paridade estrutural é garantida em compilação
- **WHEN** o catálogo `es-419` é declarado com `satisfies DashboardMessages`
- **THEN** uma chave ausente ou uma propriedade incompatível SHALL falhar no typecheck
- **AND** todas as chaves estruturais SHALL existir nos dois idiomas

#### Scenario: Placeholders são equivalentes por teste
- **WHEN** uma string contém placeholders como `{name}` ou `{count}`
- **THEN** um teste automatizado SHALL comparar os placeholders com a string equivalente no outro idioma
- **AND** SHALL falhar quando os conjuntos de placeholders divergirem

#### Scenario: Strings vazias são rejeitadas por teste
- **WHEN** uma chave do catálogo contém string vazia
- **THEN** o teste de cobertura SHALL falhar

### Requirement: Reutilização da resolução server-first de idioma da F57.4

O dashboard SHALL resolver o idioma da interface exclusivamente pela fundação existente da F57.4, incluindo `getUiRenderContext`, preferência persistida, catálogos versionados e fallback `pt-BR` para falhas conhecidas. O dashboard NÃO SHALL criar seletor, detector, preferência, provider, contexto paralelo ou serviço de idioma concorrente.

#### Scenario: Preferência persistida é reutilizada
- **WHEN** o usuário possui preferência explícita `es-419`
- **THEN** o dashboard SHALL usar `es-419` sem nova leitura de preferência no cliente
- **AND** NÃO SHALL existir seletor de idioma dentro do dashboard

#### Scenario: Preferência legada permanece em pt-BR
- **WHEN** a preferência do usuário é `legacy_br`
- **THEN** o dashboard SHALL renderizar em `pt-BR` conforme o contrato existente

#### Scenario: Preferência resolvida não troca visualmente em rede lenta
- **WHEN** a preferência do usuário é resolvida dentro do limite existente em uma conexão lenta
- **THEN** o dashboard SHALL renderizar diretamente no idioma escolhido
- **AND** NÃO SHALL exibir troca visual de português para espanhol após o carregamento

#### Scenario: Timeout ou falha conhecida usa fallback legítimo em pt-BR
- **WHEN** `getUiRenderContext` retorna timeout ou falha conhecida
- **THEN** o dashboard SHALL renderizar em `pt-BR`, consistente com o shell
- **AND** NÃO SHALL ser exigido espanhol quando a preferência não pôde ser obtida
- **AND** NÃO SHALL introduzir um segundo resolvedor ou timeout de idioma

### Requirement: Saudação usa uiLocale, timeZone e nome da loja sem inferência

A redação da saudação SHALL vir do namespace do dashboard no `uiLocale` do usuário. O período do dia SHALL usar o `timeZone` da loja obtido pelo contrato canônico existente. O nome SHALL vir do cadastro da loja. O dashboard NÃO SHALL inferir fuso ou idioma por IP, navegador, ambiente do servidor, mercado da campanha ou país da loja.

#### Scenario: Saudação em es-419 usa o idioma da interface
- **WHEN** `uiLocale = "es-419"` e a loja tem fuso `America/Asuncion`
- **THEN** a saudação SHALL usar a redação `es-419`
- **AND** o período SHALL ser calculado em `America/Asuncion`

#### Scenario: Idioma da interface não altera o fuso
- **WHEN** `uiLocale = "es-419"` e a loja tem fuso `America/Sao_Paulo`
- **THEN** o período SHALL continuar sendo calculado em `America/Sao_Paulo`
- **AND** NÃO SHALL usar o fuso associado ao idioma da interface

#### Scenario: Falha de fuso não infere Brasília
- **WHEN** a leitura do fuso da loja falha
- **THEN** a saudação SHALL ser neutra no idioma da interface
- **AND** NÃO SHALL usar `America/Sao_Paulo` como substituto silencioso

### Requirement: Separação entre idioma da interface e conteúdo comercial

O idioma da interface NÃO SHALL traduzir, reescrever ou alterar nomes e conteúdos da loja, campanhas ou novidades. O dashboard NÃO SHALL alterar moeda, valores, créditos ou conteúdo comercial com base no `uiLocale`.

#### Scenario: Nome da loja e produto permanecem intactos
- **WHEN** o dashboard é exibido em `es-419`
- **THEN** o nome da loja e os nomes dos produtos SHALL permanecer exatamente como cadastrados
- **AND** NÃO SHALL passar por tradução automática

#### Scenario: Créditos e conteúdo comercial não são convertidos
- **WHEN** o dashboard é exibido em `es-419`
- **THEN** valores de créditos, datas e conteúdo comercial SHALL manter o mesmo significado e valor
- **AND** NÃO SHALL haver conversão de moeda ou regra comercial baseada no idioma

#### Scenario: Conteúdo editorial de novidades não é traduzido
- **WHEN** o anúncio compacto exibe uma entry editorial em português
- **THEN** título, data e trecho SHALL permanecer em português
- **AND** o sistema NÃO SHALL gerar tradução ou resumo por IA

### Requirement: Adequação de lang ao conteúdo efetivamente traduzido

O documento base SHALL permanecer em `pt-BR` conforme a fundação existente. A região do dashboard efetivamente traduzida para `es-419` SHALL declarar `lang="es-419"`. A marcação SHALL ser aplicada ao menor bloco correto, sem contaminar textos de interface:

- na saudação, apenas o nome da loja SHALL receber `lang=""`; a frase de saudação e o restante do cabeçalho SHALL permanecer no idioma da interface;
- nos cartões de campanha, apenas o nome do produto SHALL receber `lang=""`;
- no anúncio compacto, apenas o título e o trecho editorial em português SHALL receber `lang="pt-BR"`;
- botões, rótulos, ações, datas e textos acessíveis traduzidos SHALL permanecer no idioma da interface, sem herdar `lang="pt-BR"`.

#### Scenario: Região traduzida declara es-419
- **WHEN** o dashboard é renderizado em `es-419`
- **THEN** a região traduzida do dashboard SHALL declarar `lang="es-419"`

#### Scenario: Dashboard em pt-BR herda o documento
- **WHEN** o dashboard é renderizado em `pt-BR`
- **THEN** NÃO SHALL declarar `lang="es-419"` em nenhuma região do dashboard

#### Scenario: Saudação marca somente o nome da loja
- **WHEN** o dashboard está em `es-419` e exibe “Buenos días, Loja Exemplo”
- **THEN** apenas “Loja Exemplo” SHALL receber `lang=""`
- **AND** “Buenos días” SHALL permanecer no idioma da interface

#### Scenario: Título e trecho editorial são marcados, ações não
- **WHEN** o anúncio de novidades em português aparece no dashboard em `es-419`
- **THEN** somente o título e o trecho editorial SHALL declarar `lang="pt-BR"`
- **AND** os botões “Ver novedades” e “Cerrar anuncio” SHALL permanecer no idioma da interface, sem `lang="pt-BR"`

#### Scenario: Nome de produto não herda espanhol
- **WHEN** o dashboard está em `es-419` e exibe nome de produto
- **THEN** esse nome SHALL usar `lang=""`

### Requirement: Localização dos avisos de verificação e prontidão

O dashboard SHALL exibir os avisos `VerificationBanners` e `ReadinessBanner` com textos do namespace do dashboard, por props opcionais de mensagens. A localização SHALL cobrir títulos, descrições, rótulos de itens pendentes, CTA, textos de acessibilidade e ação de fechar.

Os componentes existentes SHALL manter o português como padrão quando nenhuma prop de mensagens for fornecida, preservando os demais consumidores e o admin. Preservar o componente NÃO SHALL deixar os avisos em português fixo no dashboard em `es-419`.

#### Scenario: Avisos são traduzidos no dashboard em es-419
- **WHEN** o dashboard é renderizado em `es-419` e há aviso de verificação ou prontidão aplicável
- **THEN** título, descrição, itens pendentes, CTA e textos acessíveis do aviso SHALL ser exibidos em `es-419`

#### Scenario: Avisos mantêm português como padrão fora do dashboard
- **WHEN** `VerificationBanners` ou `ReadinessBanner` é usado sem props de mensagens
- **THEN** os textos padrão SHALL permanecer em português
- **AND** o comportamento existente do consumidor NÃO SHALL regredir

#### Scenario: Ação de fechar e CTA são localizados
- **WHEN** o aviso é exibido em `es-419`
- **THEN** o rótulo acessível da ação de fechar e o CTA de configuração SHALL vir do namespace do dashboard
- **AND** NÃO SHALL permanecer em português fixo

### Requirement: Admin permanece em português ao compartilhar componentes

Consumidores do admin SHALL continuar renderizando em `pt-BR`, mesmo quando compartilharem componentes visuais com o dashboard. O namespace do dashboard NÃO SHALL ser importado pelo admin, e componentes compartilhados SHALL receber textos localizados apenas quando usados no dashboard.

#### Scenario: Admin não herda es-419
- **WHEN** um usuário com `uiLocale = "es-419"` acessa `/admin`
- **THEN** a interface administrativa SHALL continuar em `pt-BR`
- **AND** NÃO SHALL exibir textos do namespace do dashboard

#### Scenario: Componente compartilhado mantém padrão português no admin
- **WHEN** um componente compartilhado é usado no admin sem textos do dashboard
- **THEN** seus rótulos padrão SHALL permanecer em português
- **AND** o comportamento existente do admin NÃO SHALL regredir
