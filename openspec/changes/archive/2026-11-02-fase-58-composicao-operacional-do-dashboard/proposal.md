## Why

O dashboard atual mistura métricas técnicas, campanhas com erro e um bloco editorial extenso, o que dificulta a leitura operacional do lojista. A F57.4 já entregou a fundação server-first de idioma da interface; falta aplicar essa base ao dashboard para que a tela seja útil, clara e disponível em `pt-BR` e `es-419`, sem alterar o shell aprovado.

## What Changes

- Reorganizar o dashboard em uma composição operacional compacta: saudação no topo, saldo de créditos, até três campanhas disponíveis com miniatura real e acesso à listagem completa, e um anúncio compacto de novidades.
- Definir como campanhas elegíveis apenas as campanhas persistidas com `status = "ready"`. Campanhas `generating` e `error` não entram nas consultas de conteúdo, nos cartões nem nas contagens do dashboard; continuam acessíveis em `/campanhas`.
- Usar “Campanhas disponíveis” para a contagem de campanhas elegíveis e remover a taxa técnica de sucesso.
- Reutilizar a infraestrutura existente de URLs assinadas para miniaturas. Miniatura indisponível renderiza fallback e nunca impede abrir a campanha.
- Distinguir saldo zero, saldo indisponível e falha de leitura. Saldo indisponível não é exibido como zero; os detalhes ficam acessíveis em `/conta`.
- Substituir o bloco editorial extenso por uma variante compacta e dispensável do anúncio de novidades, com trecho do conteúdo editorial existente e link para `/novidades`, sem traduzir nem gerar novo resumo por IA.
- Preservar `VerificationBanners` e `ReadinessCheckBanner` quando aplicáveis, com textos do namespace do dashboard via props opcionais e português como padrão para os demais consumidores.
- Entregar todos os textos novos do dashboard em `pt-BR` e `es-419` por um namespace próprio do dashboard, carregado apenas pela rota, sem aumentar o payload global do shell.
- Resolver a saudação com o nome cadastrado da loja, o `timeZone` do contrato canônico de configurações da loja e o `uiLocale` do usuário. Falha na leitura do fuso produz saudação neutra; nunca assume Brasília silenciosamente.
- Adequar `lang` às regiões efetivamente traduzidas, marcar somente o nome da loja na saudação, e no anúncio limitar `pt-BR` ao título e ao trecho editorial, mantendo ações no idioma da interface.
- Cobrir estados sem loja, sem campanhas elegíveis, carregamento, falha e indisponibilidade parcial, com prioridade mobile para saldo, campanhas e novidades.

Não faz parte desta mudança: redesenhar a identidade visual do shell, criar motor de recomendações, novas regras comerciais, seletor/detector/serviço paralelo de idioma, tradução de conteúdo de loja/campanha/novidades, alterações em créditos, geração, admin ou migrations.

## Capabilities

### New Capabilities

- `dashboard-operational-composition`: composição do dashboard orientada à operação, com saudação, saldo, campanhas disponíveis, miniaturas, anúncio compacto, estados de carregamento/falha/indisponibilidade parcial e prioridade responsive.
- `dashboard-localization`: namespace próprio de textos do dashboard em `pt-BR`/`es-419`, resolução server-first reutilizando a F57.4, separação entre idioma da interface e conteúdo comercial e adequação de `lang`.

### Modified Capabilities

- `dashboard-inteligente`: substitui o cabeçalho, as três métricas técnicas, a lista de 3–5 campanhas (incluindo erro), o cartão de próximo passo e a exigência de anúncio extenso pela composição operacional da F58, preservando estados sem loja e avisos existentes.
- `changelog-ui`: adiciona uma apresentação compacta e dispensável para o anúncio do dashboard, mantendo `/novidades`, o conteúdo editorial e o contrato de dispensa.

## Impact

- **Rotas:** `src/app/(app)/dashboard/page.tsx` e `src/app/(app)/dashboard/loading.tsx`.
- **Componentes:** novos componentes de dashboard para cabeçalho, campanhas, créditos e miniatura; variante compacta do anúncio de novidades; props opcionais de mensagens em `VerificationBanners` e `ReadinessBanner`. O shell, a sidebar e a identidade visual não mudam.
- **Dados:** nova composição server-side do dashboard reutilizando `getCurrentStore`, `countReadyCampaigns`, `generateBatchThumbnailUrls`, `CreditService.getBalanceBreakdown`, `getStoreMarketSettings`, `getUiRenderContext` e `getLatestAnnouncement`.
- **i18n:** novo módulo de catálogo do dashboard, sem inclusão no catálogo global `Messages` do shell. Nenhum seletor, detector ou serviço de idioma novo.
- **Admin:** permanece em `pt-BR`; componentes compartilhados não passam a depender do catálogo do dashboard.
- **Banco/API/dependências:** sem migration, sem nova rota de API, sem nova dependência e sem alteração de schema.
- **Validação:** testes unitários e de página, typecheck, lint, build e validação manual em `pt-BR`/`es-419`, mobile/tablet/desktop, rede lenta, fuso distinto do servidor, falha de fuso, saldo zero versus indisponível, miniaturas ausentes e admin.
