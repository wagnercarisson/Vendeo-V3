## Context

A F58 parte de uma base já atualizada em `main` (`33c38702`), contendo F57.3, F57.4 e a correção do timeout de leitura de preferência para 1000 ms. O dashboard atual (`src/app/(app)/dashboard/page.tsx`) ainda:

- usa `getUserOnboardingState`, cuja contagem inclui campanhas `ready` + `error`;
- carrega 5 campanhas recentes com `ready` + `error`;
- exibe “Total de Campanhas”, “Campanhas Prontas” e “Taxa de Sucesso”;
- usa `BalanceDisplay` com fallback `—` para falha de saldo, confundindo indisponível com ausência de dado;
- renderiza o anúncio de novidades com o corpo editorial completo antes do conteúdo principal;
- usa textos fixos em português, sem saudação por fuso da loja.

Contratos existentes relevantes:

- `Store` e `getCurrentStore` em `src/lib/auth/store-ownership.ts` e `src/lib/store.ts`; o nome da loja vem do cadastro.
- `CampaignStatus = "generating" | "ready" | "error"` em `src/lib/campaign/types.ts`. Não há outro status persistido para campanha.
- `countReadyCampaigns` já conta exclusivamente `status = "ready"`.
- `generateBatchThumbnailUrls` em `src/lib/campaign/list.ts` assina URLs do bucket `campaign-images` via `supabaseAdmin`, com fallback `null` por item.
- `CreditService.getBalanceBreakdown` retorna `availableBalance`, demo, bônus e comprado. A implementação atual ignora o `error` do Supabase e devolve zeros; a F58 formaliza uma extensão aditiva para permitir que o dashboard distinga falha de saldo zero.
- `getStoreMarketSettings(userId)` retorna o `timeZone` resolvido e já trata configuração explícita, defaults e legado.
- `getUiRenderContext(userId)` é cacheado por requisição, usa `getUserLocalePreference` e faz fallback `pt-BR` para falhas conhecidas, com timeout de 1000 ms.
- `getLatestAnnouncement`/`useChangelogState` governam o anúncio, a dispensa e o badge de novidades.
- `VerificationBanners` e `ReadinessCheckBanner` já são usados no dashboard e devem ser preservados, recebendo textos opcionais do namespace do dashboard e mantendo português como default.
- A identidade do shell foi entregue e aprovada; `(app)/layout.tsx` e `AppShell` não fazem parte do redesenho.

**Lacuna de contrato registrada (não corrigida nesta fase):** não existe uma variante canônica de `getStoreMarketSettings` que receba `storeId` e devolva o fuso sem resolver a loja novamente. O dashboard precisa do nome da loja (`getCurrentStore`) e do fuso (`getStoreMarketSettings(userId)`), resultando em dois lookups da mesma loja. Não há duplicação da regra de fuso, e nenhum contrato compartilhado será alterado para atender apenas ao dashboard. Se a medição em rede lenta indicar custo relevante, a variante por `storeId` deve ser proposta em fase própria.

## Goals / Non-Goals

**Goals:**

- Tornar o dashboard uma composição operacional: saudação compacta, saldo, campanhas disponíveis e novidades compactas.
- Excluir campanhas com erro/em geração na origem das consultas exclusivas do dashboard.
- Reutilizar miniaturas assinadas existentes, com fallback que não bloqueia a abertura da campanha.
- Distinguir saldo zero, saldo disponível e saldo indisponível.
- Entregar os textos novos em `pt-BR`/`es-419` por namespace próprio, sem aumentar o payload global do shell.
- Resolver a saudação com nome da loja, fuso canônico e `uiLocale`, com fallback neutro em falha de fuso.
- Preservar avisos, navegação, acessibilidade, responsividade, admin e identidade aprovada, localizando os avisos no dashboard sem alterar seus defaults em português.
- Cobrir estados de carregamento, falha e indisponibilidade parcial com testes proporcionais.

**Non-Goals:**

- Redesenhar shell, sidebar, topbar, logo ou assinatura.
- Criar motor de recomendações, matriz de prioridades ou cartão adaptativo de próximo passo.
- Alterar regras de crédito, geração, conteúdo comercial, onboarding, admin ou schema.
- Traduzir conteúdo de loja, campanha ou novidades; criar detector/seletor/serviço paralelo de idioma.
- Alterar `countCampaigns`, `getRecentCampaigns`, `getUserOnboardingState` ou `BalanceDisplay` para atender apenas ao dashboard.
- Migrations, novas APIs, dependências ou alteração de env.
- Tratar homologação local como prova de produção.

## Decisions

### 1. Elegibilidade: apenas `status = "ready"`

Após inspecionar o modelo, `CampaignStatus` possui apenas `generating`, `ready` e `error`. Campanha “disponível” é a campanha persistida como `ready`, que possui arte final entregue. `approval_status` não é critério de elegibilidade nesta fase: a listagem existente já expõe campanhas `ready` independentemente de aprovação, e a F58 não altera o fluxo de aprovação.

- `generating`: não entrou na lista de conteúdo do dashboard.
- `error`: excluída na consulta, nos cartões e nas contagens do dashboard; continua em `/campanhas`.
- `ready`: única status elegível.

**Alternativas consideradas:** contar `ready` + `error` (comportamento atual) — rejeitado por poluir a operação com falhas; filtrar apenas na renderização — rejeitado porque a exigência é excluir na origem.

### 2. Composição própria do dashboard, sem mudar serviços compartilhados de campanha

Criar um módulo server-only de composição do dashboard (por exemplo `src/lib/dashboard/overview.ts`) que:

- recebe `storeId`;
- usa `countReadyCampaigns` para “Campanhas disponíveis”;
- executa uma consulta dedicada de até 3 campanhas `ready`, ordenadas por `created_at` desc, selecionando apenas `id`, `product_name`, `created_at`, `storage_path`;
- reutiliza `generateBatchThumbnailUrls` para assinar miniaturas;
- retorna itens com `thumbnailUrl: string | null`.

**Por que não alterar `getRecentCampaigns`:** a spec `campaign-metrics` define o contrato atual com `ready` + `error` e sem `storagePath`/thumbnail. Mudá-lo para o dashboard violaria a preservação de semântica compartilhada. A nova composição é pequena e explícita.

**Por que não alterar `countCampaigns`/`getUserOnboardingState`:** o estado de onboarding é um contrato compartilhado. O dashboard passa a derivar seu estado operacional por `getCurrentStore` + quantidade de campanhas `ready`, sem alterar o serviço existente. O fato de `countCampaigns` incluir erro deixa de influenciar o dashboard.

### 3. Estados operacionais derivados da loja e da contagem elegível

O dashboard resolve:

- `no_store` quando `getCurrentStore` retorna `null`;
- `no_eligible_campaigns` quando a loja existe e a contagem `ready` é 0;
- `has_eligible_campaigns` quando a contagem `ready` é maior que 0.

Campanhas `error`/`generating` não mudam o estado. O estado `no_eligible_campaigns` usa `EmptyState` existente com textos do namespace do dashboard; não reutiliza `DASHBOARD_NO_CAMPAIGNS` para não afirmar “primeira campanha” quando já existem campanhas com erro.

### 4. Busca paralela e falha isolada por seção

Após autenticar:

1. Em paralelo: `getCurrentStore`, `getStoreMarketSettings`, `getUiRenderContext`, `getLatestAnnouncement`.
2. Com a loja resolvida: em paralelo, contagem/lista de campanhas e `CreditService.getBalanceBreakdown`.

Cada seção não crítica é isolada com `try/catch` (ou `Promise.allSettled`):

- falha de campanhas → estado de falha na área de campanhas, com link para `/campanhas`; saldo e novidades continuam;
- falha de créditos → “saldo indisponível” com link `/conta`; campanhas e novidades continuam;
- falha de fuso → saudação neutra;
- falha/ausência de novidades → bloco omitido;
- erro de autenticação ou erro inesperado de página → error boundary existente.

**Alternativa considerada:** uma única Promise.all que derruba a página inteira em qualquer falha — rejeitada por contrariar “dados parcialmente indisponíveis”.

### 5. Namespace de i18n próprio, carregado apenas pelo dashboard

Criar um módulo de catálogo do dashboard (por exemplo `src/lib/i18n/dashboard/`) com:

- tipos `DashboardMessages` (sem index signature e sem `any`);
- `pt-BR.ts` como fonte de verdade;
- `es-419.ts` com `satisfies DashboardMessages`;
- `getDashboardMessages(locale)`.

O namespace NÃO entra no tipo `Messages`, no `getCatalog` global nem nos imports de `AppShell`. A página do dashboard importa apenas o catálogo do dashboard e passa os rótulos necessários aos componentes client. O catálogo global do shell continua com `common` + `shell`.

**Paridade:** o `satisfies DashboardMessages` garante paridade estrutural em compilação, mas não compara placeholders, porque o tipo declara apenas `string`. A equivalência de `{name}`, `{count}` e demais placeholders será garantida por teste automatizado que compara cada string equivalente. Nenhuma das duas verificações substitui a outra.

**Avisos incluídos no namespace:** `VerificationBanners` e `ReadinessBanner` recebem props opcionais de mensagens (título, descrição, itens pendentes, CTA e rótulos acessíveis) vindas do namespace do dashboard. Sem essas props, os componentes mantêm os textos atuais em português para os demais consumidores e para o admin. Preservar o componente não significa manter português fixo no dashboard em `es-419`.

**Por que não acrescentar ao catálogo global:** aumentaria o payload de todas as rotas do shell e misturaria o ciclo de vida do dashboard com o do shell. **Por que não criar provider:** a página é Server Component e pode resolver os textos no servidor; um provider adicionaria estado e bundle de cliente sem necessidade.

### 6. Saudação: função pura com fuso injetado

Criar uma função pura (por exemplo `resolveDashboardGreeting`) que recebe:

- `storeName: string | null`;
- `timeZone: string | null`;
- `locale`;
- `now: Date` (injetável em teste);
- mensagens do dashboard.

O período é calculado com `Intl.DateTimeFormat` usando o `timeZone` da loja. Se o fuso for nulo, inválido ou a formatação falhar, retorna saudação neutra. A função NÃO usa o fuso do servidor, o idioma, IP ou mercado como fallback. O valor `America/Sao_Paulo` só pode aparecer quando o contrato canônico de configurações o resolver como default legado, nunca como substituto de falha.

O nome da loja entra como conteúdo dinâmico e não é traduzido.

### 7. Créditos: bloco próprio do dashboard, não `BalanceDisplay`

`BalanceDisplay` é um componente compartilhado, formata “créditos” em português e não representa “indisponível”. Para evitar regressão em outros consumidores e permitir o estado indisponível, o dashboard usa um bloco próprio:

- sucesso: número legível + “créditos” no idioma da interface + link “Ver detalhes” para `/conta`;
- zero: `0` créditos, sem estado de erro;
- falha: “Saldo indisponível” + link para `/conta`, sem `0`;
- demo/bônus: nesta fase, exibir apenas o saldo disponível e o acesso aos detalhes; a composição detalhada de demo permanece em `/conta`. Isso evita novo serviço ou regra de crédito.

`formatCredits` existente não é reutilizado no `es-419`, pois é português. O namespace do dashboard fornece as formas singular/plural/zero.

#### 7.1 Extensão aditiva para detectar falha de crédito

O contrato atual de `getBalanceBreakdown` não distingue falha de leitura de saldo zero: em erro do Supabase, `data` fica nulo e o método devolve zeros. Para atender ao requisito sem alterar o comportamento dos consumidores existentes, a F58 formaliza:

- `getBalanceBreakdown(storeId: string, opts?: { throwOnError?: boolean })`;
- default `false`, preservando byte a byte o comportamento atual, inclusive o retorno de zeros;
- quando `opts.throwOnError === true`, erros de leitura são propagados;
- `PGRST116` (nenhuma linha) continua sendo tratado como zeros, pois ausência de linha não é falha de leitura;
- o dashboard chama com `{ throwOnError: true }` e mapeia a rejeição para `unavailable`, nunca para `0`;
- nenhuma regra de crédito, cálculo de `availableBalance`, demo, bônus ou comprado é alterada.

Essa exceção é a única alteração autorizada em serviço compartilhado nesta fase e deve constar da revalidação final, com testes do default, do modo estrito e de `PGRST116`.

### 8. Anúncio compacto: variante retrocompatível do componente existente

Estender `ChangelogAnnouncement` com props opcionais de apresentação compacta, trecho e rótulos, mantendo o comportamento atual quando não solicitadas:

- `compact?: boolean` (default `false`);
- `excerpt?: string | null`;
- `labels?: { view: string; close: string; dialogLabel?: string }`.

O modo compacto renderiza título, data, trecho e ações; não renderiza o corpo markdown completo. O modo não compacto mantém `renderMarkdown` e os textos atuais. O trecho é derivado no servidor do primeiro parágrafo não vazio do `body`, com remoção de marcação simples e limite de caracteres; não é tradução nem resumo gerado por IA. O link para `/novidades` e a dispensa continuam usando `useChangelogState`.

No modo compacto, somente o título e o trecho editorial recebem `lang="pt-BR"` quando a interface estiver em `es-419`. Os botões “Ver novidades” e fechar, a data e os rótulos acessíveis permanecem no idioma da interface, sem herdar a marcação do conteúdo editorial.

**Alternativa considerada:** criar um componente novo só para o dashboard — evitaria tocar no compartilhado, mas duplicaria dispensa, modal, foco e link. A variante retrocompatível concentra o contrato e permite testar o modo antigo.

### 9. Layout compacto e prioridade mobile

- Cabeçalho: `h1` com saudação; sem `PageHeader` “Dashboard” duplicado.
- Avisos existentes: `VerificationBanners` e `ReadinessCheckBanner` após o cabeçalho, com textos localizados recebidos do namespace do dashboard e defaults em português nos componentes.
- Grade principal:
  - mobile: saldo → campanhas → novidades;
  - desktop: campanhas na coluna principal (span vertical); saldo e novidades na coluna secundária.
- Cartões de campanha: 1 coluna no mobile, 2 no tablet e 3 no desktop; miniatura, nome, data, link para `/campanhas/[id]`; fallback de miniatura.
- Ações preservadas: criar nova campanha, configurar loja e acessar `/campanhas`.
- Sem novos blocos de recomendação, métricas técnicas ou próximo passo.

A ordem visual mobile é obtida com grid/flex e classes responsivas; a ordem de DOM mantém títulos e links em sequência lógica. A validação manual confirma foco e leitura.

### 10. `lang` e conteúdo misto

- Documento base continua `pt-BR` (fundação existente).
- Região traduzida do dashboard em `es-419` declara `lang="es-419"`.
- Na saudação, somente o nome da loja recebe `lang=""`; a frase de saudação permanece no idioma da interface.
- Nos cartões, somente o nome do produto recebe `lang=""` (idioma desconhecido; não herda espanhol).
- No anúncio compacto em português, somente título e trecho editorial recebem `lang="pt-BR"`; botões, ações e rótulos acessíveis traduzidos permanecem no idioma da interface.
- Em `pt-BR`, nenhuma região do dashboard declara `es-419`.
- Admin continua em `pt-BR`; nenhum catálogo do dashboard é importado pelo admin.

### 11. Miniaturas e segurança

As miniaturas continuam sendo URLs assinadas geradas no servidor por `generateBatchThumbnailUrls`, com TTL de 3600 s. O dashboard não expõe `storage_path`, não cria rota de imagem e não usa `next/image` com domínio novo. O componente de miniatura no cliente recebe apenas `src` assinado e `alt`; em erro de carregamento, troca para fallback local e mantém o link.

### 12. Loading e rede lenta

Atualizar `dashboard/loading.tsx` para esqueletos na mesma ordem da composição final: cabeçalho compacto, saldo, campanhas e novidades. A página evita cascata desnecessária; as consultas independentes rodam em paralelo. Não há requisição de tradução, provider ou API adicional.

A validação em rede lenta deve separar dois cenários: com a preferência resolvida dentro do limite existente, o dashboard já renderiza no idioma escolhido, sem troca visual posterior; com timeout ou falha conhecida, o fallback legítimo é `pt-BR`, consistente com o shell, e não se exige espanhol quando a preferência não pôde ser obtida. O timeout de 1000 ms da F57.4 não é recalibrado por esta fase.

## Risks / Trade-offs

- **Duas leituras da loja (`getCurrentStore` + `getStoreMarketSettings`)** → não há duplicação de regra, apenas de lookup; o volume é pequeno e o contrato é canônico. Se a medição em rede lenta indicar custo relevante, uma variante por `storeId` pode ser avaliada em fase própria, sem alterar esta composição.
- **Campanhas com erro deixam de aparecer no dashboard** → intencional; `/campanhas` continua acessível e o estado vazio explica a ausência de campanhas disponíveis.
- **Remoção do cartão de próximo passo** → pode reduzir orientação; a F58 preserva as ações de criar campanha, abrir campanha e configurar loja. Recomendações ficam para fase própria.
- **Trecho editorial pode cortar contexto** → usar primeiro parágrafo e limite generoso; `/novidades` permanece como fonte completa. Nenhum resumo é inventado.
- **URL assinada pode expirar ou falhar** → fallback visual e link independente. Testar nulo e erro de carregamento.
- **`lang=""` em conteúdo dinâmico** → evita herdar espanhol, mas não identifica o idioma real; é a opção segura porque o dashboard não recebe o locale de conteúdo na consulta de campanhas. A marcação é aplicada somente ao nome, não à saudação inteira.
- **Avisos compartilhados ainda em português** → as props opcionais localizam os avisos no dashboard sem alterar os defaults dos demais consumidores; testes cobrem ambos os caminhos.
- **Timeout de preferência pode exibir português para usuário de espanhol** → é o fallback existente e consistente com o shell; o aceite em rede lenta não exige espanhol quando a preferência não pôde ser obtida, apenas quando ela foi resolvida dentro do limite.
- **Media queries e leitor de tela não são totalmente cobertos por jsdom** → testes automatizados cobrem DOM/atributos; validação visual humana e teclado são gates separados.
- **Extensão do `ChangelogAnnouncement`** → risco de regressão no modo completo; mitigado por default retrocompatível, testes do modo antigo e teste do admin.
- **Falha de fuso** → saudação neutra; não há fallback silencioso para Brasília. O default legado do contrato continua válido quando resolvido como tal.
- **Admin compartilha componentes** → catálogo do dashboard não é importado pelo admin; componentes compartilhados mantêm defaults em português.

## Migration Plan

1. Sem migration de banco, sem alteração de API e sem dependência nova.
2. Implementar catálogo/funções puras, composição server-side, componentes visuais e atualização da página/loading.
3. Executar testes focados, typecheck, lint e build.
4. Validar manualmente `pt-BR` e `es-419`, mobile/tablet/desktop, rede lenta, fuso distinto, falha de fuso, saldo zero versus indisponível, miniaturas ausentes e admin.
5. Publicação/deploy e smoke autenticado são gates separados e exigem autorização; os testes locais não comprovam produção.
6. Rollback: reverter os arquivos de dashboard/catálogo; não há dados persistidos novos, migration reversa ou alteração de schema a desfazer.

## Open Questions

Nenhuma decisão bloqueante. A apresentação compacta preserva o tipo de anúncio existente (`card` ou `modal`) em vez de rebaixar modais; essa escolha mantém o contrato atual e pode ser revista em fase de design visual se o responsável preferir unificar tudo em card.
