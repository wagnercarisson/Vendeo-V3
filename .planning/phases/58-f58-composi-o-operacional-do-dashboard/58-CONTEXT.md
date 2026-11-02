# Phase 58: F58 — Composição operacional do dashboard - Context

**Gathered:** 2026-11-02
**Status:** Ready for planning
**Source:** OpenSpec change `openspec/changes/fase-58-composicao-operacional-do-dashboard/` (aprovada pelo usuário)

<domain>
## Phase Boundary

Reorganizar o dashboard existente como composição operacional do lojista:

- cabeçalho compacto com saudação;
- saldo de créditos legível, com detalhes e estados distintos;
- até três campanhas disponíveis com miniatura real assinada e acesso à listagem completa;
- anúncio compacto e dispensável de novidades;
- estados sem loja, sem campanhas elegíveis, carregamento, falha e indisponibilidade parcial;
- localização completa dos textos novos em `pt-BR`/`es-419`, por namespace próprio do dashboard;
- preservação de avisos, navegação, acessibilidade, responsividade, admin, shell e identidade aprovada.

Não faz parte: redesenho do shell, recomendações, matriz de prioridades, novas regras comerciais, tradução de conteúdo, migrations, APIs novas, dependências novas, publicação ou deploy.
</domain>

<decisions>
## Implementation Decisions

### D-01 — Elegibilidade de campanhas
- Campanha elegível é somente `status = "ready"`.
- `generating` e `error` não entram nas consultas de conteúdo, cartões ou contagens do dashboard.
- `/campanhas` continua acessível com o contrato existente de `ready` + `error`.
- Não alterar a semântica de `countCampaigns`, `countReadyCampaigns`, `getRecentCampaigns` nem `getUserOnboardingState`.

### D-02 — Derivação de estado
- `no_store` quando `getCurrentStore` retorna `null`.
- `no_eligible_campaigns` quando a loja existe e a contagem `ready` é 0.
- `has_eligible_campaigns` quando existe ao menos uma campanha `ready`.
- O dashboard não usa `getUserOnboardingState` para transformar lojas com apenas campanhas com erro em “com campanhas”.

### D-03 — Consulta e miniaturas
- Nova composição server-only específica do dashboard consulta no máximo 3 campanhas `ready`, ordenadas por `created_at` desc.
- Selecionar somente `id`, `product_name`, `created_at`, `storage_path`.
- Reutilizar `generateBatchThumbnailUrls` para URLs assinadas do bucket `campaign-images`.
- `thumbnailUrl: null` ou erro de carregamento usa fallback visual; o link para `/campanhas/[id]` permanece funcional.
- Não expor `storage_path` ao cliente.
- Datas dos cartões usam o idioma da interface e o `timeZone` da loja quando disponível, evitando deslocamento de dia; sem fuso disponível, usar formatação estável sem inventar fuso.

### D-04 — Créditos
- **Decisão confirmada pelo responsável em 2026-11-02:** a extensão aditiva abaixo é a exceção autorizada em serviço compartilhado.
- Usar `CreditService.getBalanceBreakdown`.
- **Lacuna confirmada na pesquisa:** o método atual ignora `error` do Supabase e devolve zeros; `try/catch` no dashboard não detecta falha. Adicionar opção aditiva `getBalanceBreakdown(storeId, { throwOnError?: boolean })`, com default `false` para preservar todos os consumidores, e o dashboard usa `true`.
- A opção aditiva não altera regras de crédito, cálculo de saldo, demo, bônus ou comprado; apenas propaga erro de leitura quando solicitado. `PGRST116` (nenhuma linha) continua sendo tratado como zeros, preservando o comportamento atual; demais erros são propagados quando `throwOnError: true`.
- Sucesso: saldo disponível legível no idioma da interface + acesso a `/conta`.
- Zero: exibir `0` créditos, nunca “indisponível”.
- Falha: exibir “saldo indisponível” no idioma da interface, nunca `0`.
- Não alterar `BalanceDisplay`; o dashboard usa bloco próprio para distinguir indisponível de zero.

### D-05 — Anúncio de novidades
- Estender `ChangelogAnnouncement` com modo compacto retrocompatível, trecho e rótulos opcionais.
- Padrão sem modo compacto preserva o comportamento atual em português.
- Modo compacto: título, data, trecho do conteúdo editorial existente, ação para `/novidades` e dispensa.
- O trecho é o primeiro bloco textual não vazio, aceitando parágrafo ou primeiro item de lista; remover marcação simples e limitar caracteres.
- Não renderizar o corpo markdown completo no dashboard.
- No estado `no_store`, o anúncio é omitido, preservando o comportamento atual do dashboard sem loja.
- Não traduzir título/trecho, não gerar resumo por IA e não alterar `lastSeenId` ao dispensar.
- Preservar `card`/`modal` conforme o anúncio original.

### D-06 — Saudação
- Função pura com `storeName`, `timeZone`, `locale`, `now` injetável e mensagens.
- Período calculado no `timeZone` resolvido por `getStoreMarketSettings`.
- Texto no `uiLocale` via namespace do dashboard.
- Falha de fuso: saudação neutra; não substituir silenciosamente por `America/Sao_Paulo`.
- Default legado do contrato continua válido quando resolvido como tal.
- Sem loja: boas-vindas neutras.

### D-07 — Namespace de localização
- Criar namespace `dashboard` próprio, com `DashboardMessages`, catálogos `pt-BR`/`es-419` e resolvedor.
- `satisfies DashboardMessages` garante paridade estrutural em compilação; placeholders são comparados por teste automatizado.
- Não adicionar ao tipo `Messages`, ao `getCatalog` global nem aos imports de `AppShell`/admin.
- Reutilizar `getUiRenderContext` e a preferência da F57.4; nenhum seletor, detector, provider ou serviço paralelo.
- Preferência resolvida: renderizar no idioma escolhido, sem troca visual posterior.
- Timeout/falha conhecida: fallback legítimo `pt-BR`, consistente com o shell; não exigir espanhol.
- Não recalibrar o timeout de 1000 ms.

### D-08 — Avisos localizados
- `VerificationBanners` e `ReadinessBanner` recebem props opcionais de mensagens: título, descrição, itens pendentes, CTA e rótulos acessíveis.
- Sem props, mantêm português como padrão para demais consumidores e admin.
- No dashboard em `es-419`, os avisos são traduzidos.

### D-09 — `lang` por bloco
- Região traduzida do dashboard em `es-419`: `lang="es-419"`.
- Saudação: somente o nome da loja recebe `lang=""`.
- Cartões: somente o nome do produto recebe `lang=""`.
- Anúncio: somente título e trecho editorial em português recebem `lang="pt-BR"`.
- Botões, rótulos, ações, datas e textos acessíveis traduzidos permanecem no idioma da interface.
- Documento base continua `pt-BR`; não alterar `document.documentElement.lang`.

### D-10 — Falhas parciais e carregamento
- Buscar dados independentes em paralelo quando possível.
- Falha de campanhas: estado de falha da seção + link `/campanhas`; saldo e novidades continuam.
- Falha de créditos: indisponibilidade + link `/conta`; campanhas e novidades continuam.
- Falha/ausência de novidades: bloco omitido.
- Erro de autenticação/inesperado: error boundary existente.
- `loading.tsx` com esqueletos na ordem final.

### D-11 — Layout e prioridade mobile
- Cabeçalho compacto com `h1` de saudação; sem `PageHeader` “Dashboard” duplicado.
- Mobile: saldo → campanhas → novidades.
- Desktop: campanhas na coluna principal; saldo e novidades na secundária.
- Cartões 1/2/3 colunas; alvos de 44 px; truncamento seguro.
- Preservar ações de criar campanha, configurar loja e acessar `/campanhas`.

### D-12 — Escopo e gates
- Preservar shell, identidade, navegação, admin e acessibilidade.
- Remover taxa de sucesso e cartão adaptativo de próximo passo.
- Não criar recomendações, novas regras comerciais ou serviços para preencher espaço.
- Validação separada: automatizada, visual humana e gates de publicação.
- Testes locais não provam produção; deploy/smoke exigem autorização específica.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contrato técnico
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/proposal.md` — escopo, limites e impactos.
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/design.md` — decisões, alternativas, riscos e plano de migração.
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/tasks.md` — tarefas e validações de referência.
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/specs/dashboard-operational-composition/spec.md` — composição e estados.
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/specs/dashboard-localization/spec.md` — idioma, `lang`, avisos e admin.
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/specs/dashboard-inteligente/spec.md` — delta do dashboard existente.
- `openspec/changes/fase-58-composicao-operacional-do-dashboard/specs/changelog-ui/spec.md` — variante compacta do anúncio.

### Design
- `openspec/design-system/MASTER.md` — tokens, tipografia, dark mode e acessibilidade.
- `openspec/design-system/pages/dashboard.md` — referência histórica; regras incompatíveis com a F58 não prevalecem.

### Código e contratos existentes
- `src/app/(app)/dashboard/page.tsx` — dashboard atual.
- `src/app/(app)/dashboard/loading.tsx` — loading atual.
- `src/lib/campaign/metrics.ts` — `countCampaigns`, `countReadyCampaigns`, `getRecentCampaigns`.
- `src/lib/campaign/list.ts` — `generateBatchThumbnailUrls`.
- `src/lib/campaign/types.ts` — `CampaignStatus`.
- `src/lib/auth/store-ownership.ts` — `getCurrentStore`.
- `src/lib/store.ts` — `Store`.
- `src/lib/credit/credit-service.ts` — `getBalanceBreakdown`.
- `src/lib/market-preferences/store-market-settings-service.ts` — `getStoreMarketSettings` e `timeZone`.
- `src/lib/i18n/server.ts` — `getUiRenderContext`, timeout e fallback.
- `src/lib/i18n/messages.ts` e `src/lib/i18n/catalogs/*` — padrão de catálogo tipado.
- `src/lib/changelog/get-changelog.ts` — `getLatestAnnouncement`.
- `src/hooks/use-changelog-state.ts` — dispensa e `lastSeenId`.
- `src/components/changelog/changelog-announcement.tsx` — anúncio atual.
- `src/components/verification/verification-banners.tsx` — aviso de verificação.
- `src/components/readiness/readiness-check-banner.tsx` e `src/components/readiness/readiness-banner.tsx` — aviso de prontidão.
- `src/components/credit/balance-display.tsx` — referência do crédito compartilhado; não alterar.
- `src/components/ui/empty-state.tsx`, `card.tsx`, `badge.tsx` — componentes base.
- `src/app/(app)/conta/page.tsx` — destino dos detalhes de créditos.
- `src/app/(app)/campanhas/page.tsx` e `src/lib/campaign/list.ts` — listagem que preserva campanhas com erro.

### Tracking
- `.planning/ROADMAP.md` — fase 58 registrada.
- `.planning/REQUIREMENTS.md` — `REQ-58-01..12`.
- `.planning/STATE.md` — estado do milestone.
</canonical_refs>

<specifics>
## Specific Ideas

- Contagem “Campanhas disponíveis” substitui as três métricas técnicas.
- Anúncio compacto usa trecho do primeiro parágrafo não vazio do conteúdo existente; não inventa texto.
- Créditos detalhados permanecem em `/conta`; não adicionar nova rota.
- O dashboard não renderiza `BalanceDisplay` para o estado indisponível.
- Testes de fuso devem injetar `now` e comparar servidor UTC com `America/Sao_Paulo`/`America/Asuncion`.
- Testes de `lang` devem verificar o elemento específico, não apenas o texto renderizado.
- Medição de payload deve comprovar que o namespace do dashboard não entra no shell global.
- Admin deve ser coberto por regressão mesmo sem compartilhar o catálogo do dashboard.
</specifics>

<deferred>
## Deferred Ideas

- Recomendações contextuais, matriz de prioridades e próximo passo adaptativo.
- Tradução de conteúdo editorial de novidades, nomes de loja/campanha e idiomas regionais de campanha.
- Alterações de crédito, geração, onboarding, admin ou schema.
- Variante canônica de `getStoreMarketSettings` por `storeId` para eliminar o lookup duplicado.
- Recalibrar timeout de preferência.
- Publicação, deploy e smoke de produção.
</deferred>

---

*Phase: 58-f58-composi-o-operacional-do-dashboard*
*Context gathered: 2026-11-02 via OpenSpec approved base*
