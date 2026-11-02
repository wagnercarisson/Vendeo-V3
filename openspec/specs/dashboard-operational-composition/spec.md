# dashboard-operational-composition Specification

## Purpose
TBD - created by archiving change fase-58-composicao-operacional-do-dashboard. Update Purpose after archive.
## Requirements
### Requirement: Dashboard operacional com estados derivados da loja e das campanhas elegíveis

O sistema SHALL renderizar o dashboard como Server Component autenticado que resolve a loja do usuário e a composição operacional antes de renderizar. O dashboard SHALL distinguir:

- `no_store`: usuário sem loja cadastrada;
- `no_eligible_campaigns`: loja existente, mas nenhuma campanha com `status = "ready"`;
- `has_eligible_campaigns`: loja existente com pelo menos uma campanha `ready`.

O dashboard SHALL usar `getCurrentStore(user.userId)` para resolver a loja. A presença de campanhas com `status = "generating"` ou `status = "error"` NÃO SHALL alterar o estado para `has_eligible_campaigns`.

#### Scenario: Usuário sem loja recebe estado no_store
- **WHEN** `getCurrentStore` retorna `null`
- **THEN** o dashboard SHALL renderizar o estado `no_store` com boas-vindas neutras e CTA para `/loja`
- **AND** NÃO SHALL consultar créditos nem campanhas da loja

#### Scenario: Loja com apenas campanhas com erro recebe no_eligible_campaigns
- **WHEN** a loja existe e todas as suas campanhas têm `status = "error"` ou `status = "generating"`
- **THEN** o dashboard SHALL renderizar o estado `no_eligible_campaigns`
- **AND** NÃO SHALL exibir cartões, miniaturas ou contagens dessas campanhas

#### Scenario: Loja com campanha ready recebe has_eligible_campaigns
- **WHEN** a loja existe e possui pelo menos uma campanha com `status = "ready"`
- **THEN** o dashboard SHALL renderizar o estado `has_eligible_campaigns`

### Requirement: Consultas de campanhas do dashboard excluem erro e geração na origem

As consultas de campanhas usadas exclusivamente pelo dashboard SHALL filtrar `status = "ready"` na consulta ao banco. O dashboard NÃO SHALL carregar campanhas `error` ou `generating` para depois ocultá-las na renderização. A contagem exibida como “Campanhas disponíveis” SHALL contar somente campanhas `ready`.

As funções compartilhadas `countCampaigns`, `countReadyCampaigns` e `getRecentCampaigns` SHALL manter sua semântica atual para os demais consumidores; a seleção de campanhas elegíveis do dashboard SHALL ser feita por uma composição própria do dashboard.

#### Scenario: Campanhas com erro não entram na consulta do dashboard
- **WHEN** o dashboard carrega as campanhas recentes de uma loja
- **THEN** a consulta SHALL enviar filtro de status `ready`
- **AND** campanhas com status `error` NÃO SHALL ser retornadas para a composição do dashboard

#### Scenario: Campanhas em geração não entram na contagem
- **WHEN** a loja possui campanhas `generating` e `ready`
- **THEN** “Campanhas disponíveis” SHALL exibir apenas a quantidade de campanhas `ready`

#### Scenario: Campanhas com erro continuam acessíveis em Campanhas
- **WHEN** o dashboard exclui uma campanha com `status = "error"`
- **THEN** a rota `/campanhas` SHALL continuar listando essa campanha conforme o contrato existente da listagem

#### Scenario: Serviços compartilhados preservam a semântica
- **WHEN** outro consumidor usa `countCampaigns` ou `getRecentCampaigns`
- **THEN** o comportamento existente de contar ou listar `ready` + `error` SHALL permanecer inalterado

### Requirement: Painel único “Campanhas recentes” com contagem de disponíveis

O dashboard SHALL exibir as campanhas elegíveis em um único painel, com título “Campanhas recentes”, ação “Ver todas” no cabeçalho apontando para `/campanhas` e contagem secundária de campanhas disponíveis (“1 campanha disponível” / “{count} campanhas disponíveis”). O dashboard NÃO SHALL exibir a taxa técnica de sucesso nem os rótulos “Total de Campanhas” e “Campanhas Prontas” como métricas separadas.

#### Scenario: Rótulo e valor da contagem
- **WHEN** a loja possui 4 campanhas `ready` e 2 campanhas `error`
- **THEN** o painel SHALL exibir “Campanhas recentes” e a contagem secundária “4 campanhas disponíveis”
- **AND** NÃO SHALL exibir “Taxa de Sucesso”

#### Scenario: Contagem zero no estado sem campanhas elegíveis
- **WHEN** a loja existe e não possui campanhas `ready`
- **THEN** a área de campanhas SHALL exibir o estado vazio elegível
- **AND** a contagem exibida SHALL ser `0`, sem apresentar erro ou lista vazia sem explicação

#### Scenario: Ver todas fica no cabeçalho do painel
- **WHEN** o painel de campanhas é exibido
- **THEN** a ação “Ver todas” SHALL estar no cabeçalho do painel e apontar para `/campanhas`

### Requirement: Até três campanhas disponíveis em linhas com miniatura real

No estado `has_eligible_campaigns`, o painel SHALL exibir no máximo três campanhas `ready`, ordenadas por `created_at` decrescente, como linhas verticais separadas por divisórias. Cada linha SHALL conter miniatura real, nome do produto, data e uma ação visível “Abrir campanha” para `/campanhas/[id]`.

A ausência de `storage_path`, falha de assinatura ou miniatura indisponível SHALL renderizar um fallback visual. A ação “Abrir campanha” SHALL permanecer disponível mesmo sem miniatura. Linhas e ações NÃO SHALL aninhar links ou botões interativos.

#### Scenario: Três campanhas elegíveis são exibidas
- **WHEN** a loja possui mais de três campanhas `ready`
- **THEN** o painel SHALL exibir exatamente as três mais recentes
- **AND** SHALL exibir a ação “Abrir campanha” em cada linha
- **AND** SHALL exibir a ação “Ver todas” no cabeçalho

#### Scenario: Miniatura indisponível não bloqueia a campanha
- **WHEN** a URL assinada da miniatura é nula ou falha
- **THEN** a linha SHALL exibir o fallback de miniatura
- **AND** a ação “Abrir campanha” para `/campanhas/[id]` SHALL permanecer disponível e acessível

#### Scenario: Erro não gera linha de erro no dashboard
- **WHEN** as campanhas mais recentes incluem uma campanha `error`
- **THEN** o dashboard SHALL ignorar essa campanha na seleção das três
- **AND** NÃO SHALL renderizar badge ou linha de erro no painel

#### Scenario: Orientação dentro do painel
- **WHEN** o painel exibe campanhas
- **THEN** uma divisória SHALL anteceder a orientação “Abra uma campanha para visualizar o conteúdo completo e baixá-lo para publicar.”
- **AND** a orientação NÃO SHALL sugerir revisão, edição ou publicação direta pelo Vendeo

### Requirement: Saldo de créditos legível, com detalhes e sem confundir indisponível com zero

O dashboard SHALL exibir o saldo disponível de créditos em um bloco visualmente destacado, com título legível, ícone de créditos da identidade verde, valor numericamente destacado, descrição secundária do saldo e ação “Ver créditos e extrato” para `/conta`. Em mobile, o bloco SHALL ser compacto e horizontal. Falha de leitura do saldo SHALL produzir um estado explícito de indisponibilidade, distinto de saldo zero.

A leitura do dashboard SHALL usar a extensão aditiva `getBalanceBreakdown(storeId, { throwOnError: true })`. O default `false` SHALL preservar o comportamento dos demais consumidores, e `PGRST116` (nenhuma linha) SHALL continuar sendo tratado como zero, não como falha. Nenhuma regra de crédito, demo, bônus ou comprado SHALL ser alterada.

#### Scenario: Saldo disponível é exibido
- **WHEN** `getBalanceBreakdown` retorna `availableBalance = 7`
- **THEN** o dashboard SHALL exibir o valor `7` com o rótulo de créditos no idioma da interface
- **AND** SHALL exibir acesso aos detalhes em `/conta`

#### Scenario: Saldo zero é exibido como zero
- **WHEN** `getBalanceBreakdown` retorna `availableBalance = 0`
- **THEN** o dashboard SHALL exibir `0` créditos
- **AND** NÃO SHALL exibir “saldo indisponível”

#### Scenario: Falha de leitura exibe indisponibilidade
- **WHEN** a leitura do saldo lança erro
- **THEN** o dashboard SHALL exibir “saldo indisponível” no idioma da interface
- **AND** NÃO SHALL exibir `0` créditos
- **AND** SHALL manter o acesso aos detalhes em `/conta`

### Requirement: Anúncio compacto e dispensável de novidades

O dashboard SHALL exibir o anúncio de novidades em formato compacto quando houver entry com `announcement !== "none"` e o anúncio não tiver sido dispensado. O anúncio SHALL apresentar a identificação visual “Novidades”/“Novedades”, título, data e um trecho do conteúdo editorial existente, com ação para `/novidades` e ação de dispensa. O conteúdo editorial NÃO SHALL ser traduzido automaticamente nem substituído por resumo gerado por IA. Em desktop, o anúncio SHALL ficar diretamente abaixo dos créditos na coluna lateral; não SHALL haver atalho de criação entre eles.

#### Scenario: Anúncio compacto é exibido
- **WHEN** existe uma entry de anúncio não dispensada
- **THEN** o dashboard SHALL exibir o anúncio compacto com título, data e trecho do conteúdo existente
- **AND** SHALL exibir ação para `/novidades`

#### Scenario: Anúncio é dispensável
- **WHEN** o usuário aciona a dispensa do anúncio
- **THEN** o anúncio SHALL desaparecer
- **AND** a dispensa SHALL usar o contrato existente de `useChangelogState`
- **AND** NÃO SHALL marcar a entry como vista nem alterar `lastSeenId`

#### Scenario: Ausência de anúncio não quebra o dashboard
- **WHEN** não existe entry de anúncio ou o anúncio foi dispensado
- **THEN** o dashboard SHALL renderizar sem o bloco de novidades e sem erro

### Requirement: Cabeçalho compacto com saudação contextual

O dashboard SHALL renderizar um cabeçalho com saudação em destaque e subtítulo explicativo. A saudação SHALL usar o nome cadastrado da loja quando disponível e SHALL usar o `timeZone` retornado pelo contrato canônico de configurações da loja para determinar o período do dia. O texto da saudação SHALL usar o `uiLocale` do usuário. O subtítulo desktop SHALL ser “Suas campanhas e informações essenciais em um só lugar.” e o mobile poderá usar “Suas campanhas em um só lugar.”.

O cabeçalho interno do dashboard NÃO SHALL conter os botões “Nova campanha” nem “Configurar loja”; a ação de criação permanece na topbar/shell. Os estados sem loja e de prontidão SHALL manter seus CTAs próprios.

Falha na leitura do fuso SHALL produzir saudação neutra. O dashboard NÃO SHALL substituir silenciosamente o fuso por `America/Sao_Paulo`, nem inferir fuso por idioma, IP, ambiente do servidor ou mercado da campanha.

#### Scenario: Saudação usa o fuso da loja
- **WHEN** o servidor está em um fuso diferente do fuso configurado para a loja
- **THEN** o período da saudação SHALL ser calculado pelo fuso da loja
- **AND** NÃO SHALL usar o fuso do servidor

#### Scenario: Falha de leitura do fuso produz saudação neutra
- **WHEN** a leitura do fuso da loja falha
- **THEN** o dashboard SHALL exibir saudação neutra
- **AND** NÃO SHALL assumir `America/Sao_Paulo`

#### Scenario: Sem loja produz boas-vindas neutras
- **WHEN** o usuário não possui loja
- **THEN** o cabeçalho SHALL exibir boas-vindas neutras
- **AND** NÃO SHALL exibir nome de loja inventado

### Requirement: Faixa inferior fixa de criação

O dashboard SHALL exibir, abaixo do conjunto campanhas + lateral, uma faixa de largura total com o convite fixo “Que tal criar sua próxima campanha?” e a ação “Criar campanha” para `/campanhas/nova`. A faixa NÃO SHALL depender de saldo, histórico, status de campanha ou qualquer sinal personalizado, nem SHALL ser posicionada entre créditos e novidades na coluna lateral. Em mobile, a faixa SHALL aparecer após as novidades. Nos estados vazios, o CTA próprio do estado NÃO SHALL ser duplicado pela faixa.

#### Scenario: Faixa fixa é exibida abaixo do conjunto principal
- **WHEN** a loja tem campanhas elegíveis
- **THEN** a faixa “Que tal criar sua próxima campanha?” SHALL aparecer após o grid de campanhas + lateral
- **AND** a ação “Criar campanha” SHALL apontar para `/campanhas/nova`

#### Scenario: Faixa não é uma recomendação
- **WHEN** o saldo ou o histórico de campanhas muda
- **THEN** o texto e a ação da faixa SHALL permanecer os mesmos
- **AND** NÃO SHALL haver lógica adaptativa ou personalizada

#### Scenario: Mobile preserva a ordem principal
- **WHEN** o dashboard é renderizado em mobile
- **THEN** a ordem SHALL ser créditos → campanhas → novidades → faixa de criação

### Requirement: Preservação de avisos, navegação e ações existentes

O dashboard SHALL preservar `VerificationBanners` quando o status de verificação exigir aviso e `ReadinessCheckBanner` quando a loja não estiver pronta. Os avisos SHALL receber textos localizados do namespace do dashboard, preservando o português como padrão dos componentes quando usados sem props de mensagens. O dashboard SHALL manter acesso à criação de campanha, à configuração da loja e à navegação existente do shell.

#### Scenario: Avisos existentes são preservados e localizados
- **WHEN** a loja tem verificação em revisão ou prontidão incompleta
- **THEN** o dashboard SHALL renderizar os avisos correspondentes
- **AND** em `es-419`, título, descrição, itens, CTA e textos acessíveis SHALL vir do namespace do dashboard

#### Scenario: Ações existentes continuam disponíveis
- **WHEN** o dashboard renderiza uma loja com campanhas
- **THEN** SHALL haver acesso para criar nova campanha e para configurar a loja
- **AND** a navegação do shell SHALL permanecer inalterada

### Requirement: Estados de carregamento, falha e indisponibilidade parcial

O dashboard SHALL oferecer estado de carregamento compatível com a composição final e SHALL isolar falhas de dados por seção. Falha na leitura de campanhas, créditos ou novidades NÃO SHALL impedir a renderização das demais seções disponíveis.

#### Scenario: Carregamento exibe estrutura compatível
- **WHEN** o dashboard está carregando
- **THEN** SHALL exibir esqueletos proporcionais ao cabeçalho, saldo, campanhas e novidades
- **AND** NÃO SHALL deslocar a composição de forma grosseira ao concluir

#### Scenario: Falha de campanhas mantém o restante da página
- **WHEN** a consulta de campanhas falha
- **THEN** a área de campanhas SHALL exibir um estado de falha com acesso a `/campanhas`
- **AND** saldo e novidades SHALL continuar visíveis quando disponíveis

#### Scenario: Falha de créditos mantém campanhas e novidades
- **WHEN** a leitura de créditos falha
- **THEN** o bloco de créditos SHALL exibir indisponibilidade
- **AND** campanhas e novidades SHALL continuar visíveis quando disponíveis

### Requirement: Responsividade com prioridade mobile para saldo, campanhas e novidades

O dashboard SHALL ser responsivo em mobile, tablet e desktop, preservando alvos de toque de no mínimo 44 px e truncamento seguro de textos longos. No mobile, a ordem visual SHALL priorizar saldo, campanhas e novidades, nessa ordem. Em telas maiores, campanhas SHALL ocupar a área principal e saldo/novidades a coluna secundária.

#### Scenario: Ordem mobile prioriza saldo, campanhas e novidades
- **WHEN** o dashboard é renderizado em viewport mobile
- **THEN** o saldo SHALL aparecer antes das campanhas
- **AND** as campanhas SHALL aparecer antes do anúncio de novidades

#### Scenario: Layout desktop mantém campanhas como conteúdo principal
- **WHEN** o dashboard é renderizado em desktop
- **THEN** a seção de campanhas SHALL ocupar a área principal
- **AND** saldo e novidades SHALL ocupar a coluna secundária

#### Scenario: Nomes longos não quebram o layout
- **WHEN** o nome do produto ou da loja excede o espaço disponível
- **THEN** o texto SHALL truncar ou quebrar de forma segura, sem sobrepor ações ou miniaturas

### Requirement: Acessibilidade e escopo operacional preservado

O dashboard SHALL manter hierarquia de títulos, foco visível, teclado, contraste pelos tokens do design system e nomes acessíveis para miniaturas e ações. O dashboard NÃO SHALL introduzir motor de recomendações, matriz de prioridades, novas regras comerciais, taxa técnica de sucesso ou cartão de próximo passo.

#### Scenario: Navegação por teclado alcança ações principais
- **WHEN** o usuário navega por teclado
- **THEN** os cartões de campanha, o acesso a `/campanhas`, os detalhes de créditos, o anúncio e a dispensa SHALL ser alcançáveis com foco visível

#### Scenario: Miniatura tem nome acessível adequado
- **WHEN** uma campanha possui miniatura
- **THEN** a imagem SHALL ter texto alternativo ou nome acessível que identifique a campanha sem duplicar informação de forma confusa

#### Scenario: Escopo não introduz recomendação
- **WHEN** o dashboard é renderizado
- **THEN** NÃO SHALL existir motor de recomendação, matriz de prioridades, taxa de sucesso ou cartão adaptativo de próximo passo
