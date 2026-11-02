## 1. Contratos e composição de dados

- [ ] 1.1 Criar a consulta dedicada do dashboard para até 3 campanhas `ready`, ordenadas por `created_at` desc, selecionando somente `id`, `product_name`, `created_at` e `storage_path`; não selecionar `input_snapshot` e não incluir `error`/`generating`.
- [ ] 1.2 Reutilizar `generateBatchThumbnailUrls` para gerar as miniaturas assinadas e retornar `thumbnailUrl: string | null`, sem expor `storage_path` ao cliente.
- [ ] 1.3 Usar `countReadyCampaigns` como “Campanhas disponíveis”; não alterar `countCampaigns`, `countReadyCampaigns`, `getRecentCampaigns` nem `getUserOnboardingState`.
- [ ] 1.4 Formalizar e implementar a extensão aditiva `getBalanceBreakdown(storeId, { throwOnError?: boolean })`, com default `false`, propagação de erro apenas quando solicitada e `PGRST116` tratado como zeros; adicionar testes do default, do modo estrito e da ausência de linha.
- [ ] 1.5 Criar a composição segura de créditos com estados `available`, `zero` e `unavailable`, usando `getBalanceBreakdown(..., { throwOnError: true })`; falha não pode virar `0`.
- [ ] 1.6 Criar a função pura de saudação com `storeName`, `timeZone`, `locale`, `now` injetável e fallback neutro para fuso nulo/inválido/falha; não usar fuso do servidor nem Brasília como substituto de erro.
- [ ] 1.7 Adicionar testes unitários da consulta elegível (filtro `ready`, limite 3, exclusão de erro/geração, miniatura nula), da extensão de crédito, da composição `available/zero/unavailable` e da saudação nos fusos `America/Sao_Paulo`/`America/Asuncion` com servidor em UTC, além de falha de fuso.

## 2. Namespace de localização do dashboard

- [ ] 2.1 Criar os tipos `DashboardMessages` sem index signature/`any`, com chaves para cabeçalho, saudação, saldo, campanhas, miniaturas, estados vazios, falhas, anúncio e textos acessíveis.
- [ ] 2.2 Criar o catálogo `pt-BR` do dashboard como fonte de verdade, incluindo formas de crédito zero/singular/plural.
- [ ] 2.3 Criar o catálogo `es-419` com paridade estrutural garantida por `satisfies DashboardMessages`; não atribuir ao tipo a garantia de placeholders, que será feita por teste.
- [ ] 2.4 Criar o resolvedor `getDashboardMessages(locale)` reutilizando `SupportedUiLocale` e a fundação F57.4; não criar seletor, detector, provider ou serviço paralelo.
- [ ] 2.5 Garantir que o namespace do dashboard não seja adicionado ao tipo `Messages`, ao `getCatalog` global nem aos imports de `AppShell`/admin.
- [ ] 2.6 Adicionar testes de equivalência de placeholders, strings não vazias e isolamento de imports; comprovar que o catálogo global do shell não contém chaves exclusivas do dashboard. A paridade estrutural continua garantida pelo `satisfies` no typecheck.

## 3. Componentes visuais do dashboard

- [ ] 3.1 Criar o cabeçalho compacto com saudação como `h1`, nome da loja e espaço para avisos; remover o `PageHeader` “Dashboard” duplicado.
- [ ] 3.2 Criar o cartão de campanha com miniatura, nome do produto, data, link para `/campanhas/[id]` e fallback visual quando a URL assinada for nula ou falhar; o link deve continuar funcional.
- [ ] 3.3 Criar o bloco de créditos com valor legível, link para `/conta` e estados distintos de disponível, zero e indisponível.
- [ ] 3.4 Criar os estados vazio/falha da área de campanhas: `no_eligible_campaigns` com CTA para `/campanhas/nova` e falha de consulta com link para `/campanhas`.
- [ ] 3.5 Estender `ChangelogAnnouncement` com modo compacto, trecho e rótulos opcionais, preservando o modo completo e os defaults em português.
- [ ] 3.6 Implementar a derivação do trecho compacto a partir do primeiro parágrafo não vazio do conteúdo existente, sem tradução, sem IA e sem inventar texto.
- [ ] 3.7 Garantir alvos de toque de 44 px, foco visível, hierarquia de títulos, contraste pelos tokens e nomes acessíveis de miniaturas/ações.
- [ ] 3.8 Adicionar props opcionais de mensagens a `VerificationBanners` e `ReadinessBanner` para título, descrição, itens pendentes, CTA e rótulos acessíveis, mantendo português como padrão quando as props não forem fornecidas.
- [ ] 3.9 Passar as mensagens do namespace do dashboard aos avisos e testar os dois idiomas no dashboard e o fallback em português nos demais consumidores/admin.

## 4. Integração da página e estados

- [ ] 4.1 Reescrever `src/app/(app)/dashboard/page.tsx` como Server Component autenticado usando `getCurrentStore`, `getUiRenderContext`, `getStoreMarketSettings`, composição de campanhas, créditos e anúncio.
- [ ] 4.2 Remover as métricas “Total de Campanhas”, “Campanhas Prontas” e “Taxa de Sucesso” e o cartão adaptativo de próximo passo.
- [ ] 4.3 Preservar `VerificationBanners`, `ReadinessCheckBanner`, acesso a criar campanha, configurar loja e navegação do shell.
- [ ] 4.4 Isolar falhas de campanhas, créditos e novidades para permitir dados parcialmente disponíveis, sem transformar falha de seção em erro de página.
- [ ] 4.5 Implementar a ordem responsive: no mobile saldo → campanhas → novidades; no desktop campanhas na coluna principal e saldo/novidades na secundária.
- [ ] 4.6 Atualizar `src/app/(app)/dashboard/loading.tsx` com esqueletos proporcionais ao cabeçalho, saldo, campanhas e novidades.
- [ ] 4.7 Aplicar `lang="es-419"` na região traduzida quando aplicável; na saudação, marcar somente o nome da loja com `lang=""`; nos cartões, somente o nome do produto; no anúncio, somente título e trecho editorial com `lang="pt-BR"`, mantendo botões e rótulos acessíveis no idioma da interface. Não alterar `document.documentElement.lang`.
- [ ] 4.8 Adicionar/atualizar testes de página para `no_store`, `no_eligible_campaigns`, `has_eligible_campaigns`, erro-only, limite de 3, link `/campanhas`, falha de créditos, falha de campanhas, saldo zero versus indisponível e ausência de taxa de sucesso.

## 5. Localização e preservação do admin

- [ ] 5.1 Renderizar os mesmos cenários funcionais do dashboard em `pt-BR` e `es-419` com os textos do namespace correto.
- [ ] 5.2 Testar que nomes de loja/produto e conteúdo editorial permanecem intactos nos dois idiomas.
- [ ] 5.3 Testar a saudação em `es-419` com fuso da loja diferente do servidor e fallback neutro em falha de fuso.
- [ ] 5.4 Confirmar que `/admin` permanece em `pt-BR` e que o namespace do dashboard não é importado pelo admin.
- [ ] 5.5 Confirmar que o modo não compacto do `ChangelogAnnouncement` continua com o comportamento anterior e que o admin não regride.

## 6. Validação automatizada

- [ ] 6.1 Executar os testes focados de dashboard, i18n, avisos de verificação/prontidão, changelog, admin e serviços reutilizados, incluindo explicitamente os testes da extensão `throwOnError` de `getBalanceBreakdown`; corrigir regressões relacionadas.
- [ ] 6.2 Executar `npm run typecheck`.
- [ ] 6.3 Executar `npm run lint`, registrando a limitação conhecida de cobertura de TypeScript.
- [ ] 6.4 Executar `npm run build` e `git diff --check`.
- [ ] 6.5 Medir o First Load JS de `/dashboard` e o tamanho dos catálogos; confirmar que o namespace do dashboard não aumenta o payload global do shell.
- [ ] 6.6 Executar `openspec validate fase-58-composicao-operacional-do-dashboard --strict`.
- [ ] 6.7 Confirmar por inspeção que não houve migration, nova API, nova dependência, alteração de schema, regra de crédito, geração ou admin. A única exceção autorizada em serviço compartilhado é a opção aditiva `throwOnError` em `getBalanceBreakdown`, com default `false`, `PGRST116` como zero e testes próprios na revalidação final.

## 7. Validação manual e visual

- [ ] 7.1 Validar `pt-BR` e `es-419` em mobile, tablet e desktop, com a ordem mobile saldo → campanhas → novidades e com avisos de verificação/prontidão localizados quando aplicáveis.
- [ ] 7.2 Validar conteúdo misto: interface em `es-419`, nomes de loja/produto e novidades em português, com `lang` correto por bloco.
- [ ] 7.3 Validar fuso da loja diferente do servidor e falha de leitura do fuso, confirmando saudação correta ou neutra e ausência de fallback silencioso para Brasília.
- [ ] 7.4 Validar campanhas com erro fora do dashboard e ainda acessíveis em `/campanhas`; validar miniaturas presentes, ausentes e com falha de carregamento.
- [ ] 7.5 Validar saldo zero, saldo disponível e saldo indisponível, com acesso aos detalhes em `/conta`.
- [ ] 7.6 Validar conexão lenta (Slow 4G) com preferência resolvida dentro do limite: carregamento, ausência de requisição de tradução, idioma escolhido já na renderização e ausência de troca visual posterior.
- [ ] 7.7 Validar conexão lenta com timeout/falha conhecida de preferência: fallback legítimo em `pt-BR`, consistente com o shell, sem exigir espanhol quando a preferência não pôde ser obtida e sem recalibrar o timeout de 1000 ms.
- [ ] 7.8 Validar acessibilidade manual: teclado, foco visível, contraste, truncamento de nomes longos, leitura de `lang` por bloco e ações do anúncio.
- [ ] 7.9 Validar preservação do shell, da identidade aprovada, da navegação e do admin.

## 8. Gates de publicação e encerramento

- [ ] 8.1 Registrar evidências separadas de: testes automatizados, validação visual humana e gates de publicação.
- [ ] 8.2 Não declarar produção aprovada com base em testes locais; documentar que deploy e smoke autenticado são gates separados e exigem autorização.
- [ ] 8.3 Executar publicação/deploy e smoke somente após autorização específica, registrando evidência própria; nenhum push, merge, deploy ou alteração de produção faz parte da implementação local.
- [ ] 8.4 Reconciliar OpenSpec, GSD, STATE/ROADMAP e summaries somente após as etapas de verificação e aprovação.
