## 1. Catálogos e fundação de tradução

- [ ] 1.1 Criar `src/lib/i18n/locales.ts` reutilizando `SUPPORTED_UI_LOCALES`/`SupportedUiLocale` da F57.3, com `DEFAULT_UI_LOCALE = "pt-BR"` e labels endônimos das opções.
- [ ] 1.2 Criar `src/lib/i18n/messages.ts` com os tipos dos namespaces `common`, `shell` e `settings` e o tipo agregado `Messages`.
- [ ] 1.3 Criar `src/lib/i18n/catalogs/pt-BR.ts` como fonte de verdade das chaves e textos.
- [ ] 1.4 Criar `src/lib/i18n/catalogs/es-419.ts` com paridade exata de chaves e placeholders.
- [ ] 1.5 Criar `src/lib/i18n/translate.ts` com interpolação `{nome}`, fallback para `pt-BR` e retorno da chave apenas em último caso.
- [ ] 1.6 Criar `src/lib/i18n/index.ts` exportando catálogos, tipos e helpers sem importar módulos `server-only` em código cliente.
- [ ] 1.7 Adicionar teste de cobertura dos catálogos (chaves, namespaces, strings não vazias e placeholders).
- [ ] 1.8 Adicionar teste do helper de interpolação e do fallback de chave ausente.

## 2. Resolução server-side e payload

- [ ] 2.1 Criar `src/lib/i18n/server.ts` com `getUiRenderContext(userId)` usando `cache()` do React, `getUserLocalePreference` existente e timeout de 200 ms via `Promise.race`.
- [ ] 2.2 Implementar fallback para `PreferencesUnavailableError`/`StoredPreferencesInvalidError`/timeout, com aviso sem PII; erros desconhecidos permanecem propagados e a promise isolada não gera unhandled rejection.
- [ ] 2.3 Atualizar `src/app/(app)/layout.tsx` para resolver o contexto e passar `locale`, `commonMessages`, `shellMessages` (pt-BR sempre; es-419 apenas se o usuário estiver em espanhol).
- [ ] 2.4 Garantir uma única leitura por requisição entre layout e `/configuracoes`; adicionar teste de isolamento entre dois usuários e de timeout.
- [ ] 2.5 Atualizar `AppShell` para receber locale/mensagens, manter o documento em `pt-BR` e declarar `lang` apenas nas regiões traduzidas (sem alterar `document.documentElement.lang`).
- [ ] 2.6 Garantir que o payload do shell contenha apenas `common` + `shell` e que usuários em pt-BR não recebam o catálogo espanhol; medir os bytes dos namespaces.

## 3. Shell traduzido e menu do usuário

- [ ] 3.1 Traduzir labels e `aria-label` da sidebar desktop, mantendo os cinco itens e nenhum item de configurações.
- [ ] 3.2 Traduzir labels e `aria-label` do drawer mobile, preservando foco, Escape, overlay, scroll lock e retorno de foco.
- [ ] 3.3 Traduzir CTA, hamburger e `aria-label` da topbar; preservar “Vendeo” sem tradução.
- [ ] 3.4 Reordenar o menu da conta para Conta → Novidades → Configurações → Sair, renomear o link de `/conta` para Conta e criar o link para `/configuracoes`.
- [ ] 3.5 Adicionar prop de rótulo ao `LogoutButton` (padrão “Sair”), passar o valor do catálogo pelo shell e preservar logout/limpeza de rascunhos nos usos de `/conta` e admin.
- [ ] 3.6 Traduzir `aria-label` do menu da conta, fallback de usuário e rótulos dos itens.
- [ ] 3.7 Traduzir `aria-label`/`title` do `SidebarBadge` e os rótulos do sino de notificações, preservando contagem e destino.
- [ ] 3.8 Implementar a exceção de `/admin`: shell em `pt-BR`, menu legado “Configurações” → `/conta` e ausência de link para `/configuracoes`.
- [ ] 3.9 Atualizar os testes existentes de shell, account menu, drawer, badge, sino e logout para os dois idiomas e para o admin.

## 4. Página `/configuracoes`

- [ ] 4.1 Criar `src/app/(app)/configuracoes/page.tsx` autenticada, sem dependência de loja e com leitura server-side do contexto.
- [ ] 4.2 Criar estado de erro traduzido com ação de recarregar quando a leitura inicial falhar; não renderizar formulário nesse estado.
- [ ] 4.3 Criar `src/app/(app)/configuracoes/loading.tsx` compatível com o padrão existente.
- [ ] 4.4 Criar `SettingsLanguageForm` client com `fieldset`/`legend`, radios nativos e seleção inicial persistida.
- [ ] 4.5 Implementar `PATCH /api/preferences` com `uiLocale` + `expectedVersion`, sem PATCH no mount e sem expor `null`/omitido.
- [ ] 4.6 Implementar estados de carregamento, sucesso, 400, 401, 403, 409, 500/503, falha de rede/timeout e nova tentativa; encerrar “salvando” em `finally`, manter a seleção e reabilitar os controles.
- [ ] 4.7 Após 200, atualizar DTO/versão locais, marcar confirmação real e chamar `router.refresh()` para atualizar shell e página juntos, sem `?saved=1` e sem reload completo.
- [ ] 4.8 Adicionar testes da página e do formulário: usuário sem loja, sem escrita no mount, sucesso, trocas repetidas, conflito + recarga sincronizada, 403, rede, indisponibilidade, sessão e ausência de `null`.

## 5. Validação funcional e de escopo

- [ ] 5.1 Testar o percurso completo em `pt-BR`: menu → Conta → Novidades → Configurações → salvar → shell traduzido → retorno em nova sessão.
- [ ] 5.2 Testar o mesmo percurso em `es-419`, incluindo persistência após novo acesso e ausência de flash de português.
- [ ] 5.3 Confirmar trocas repetidas `pt-BR → es-419 → pt-BR`, com shell e formulário sincronizados em cada salvamento.
- [ ] 5.4 Confirmar que loja, campanhas, conteúdo, moeda e país permanecem inalterados após a troca de idioma.
- [ ] 5.5 Confirmar que admin permanece em português, sem seletor e sem link para `/configuracoes`.
- [ ] 5.6 Confirmar acessibilidade por teclado/leitor de tela no menu, drawer e formulário (foco, Escape, labels, `aria-live`), e que `lang="es-419"` aparece apenas nas regiões traduzidas.
- [ ] 5.7 Confirmar que dashboard, conta e campanhas continuam com documento em `pt-BR` e não são marcados como espanhóis.
- [ ] 5.8 Confirmar que visitar `/configuracoes` não cria linha e que a leitura inicial não dispara PATCH.

## 6. Gates e promoção

- [ ] 6.1 Executar testes focados de i18n, shell, configurações e admin; corrigir regressões da suíte relacionada.
- [ ] 6.2 Executar `npm run typecheck`, `npm run lint` (limitação conhecida: não cobre TS), `npm run build` e `git diff --check`.
- [ ] 6.3 Medir First Load JS de `/configuracoes` e o tamanho dos catálogos; confirmar que usuários em pt-BR não recebem o shell espanhol e registrar o orçamento.
- [ ] 6.4 Validar em rede limitada (Slow 4G) que não há requisição de tradução, flash de português, atraso acima de 200 ms por preferência ou bloqueio de página.
- [ ] 6.5 Validar no homolog com usuário de teste com loja e sem loja; registrar evidências sem dados pessoais.
- [ ] 6.6 Revisar e aprovar os textos `es-419` com revisor humano antes da publicação.
- [ ] 6.7 Publicar somente após autorização separada; executar smoke autenticado em produção e registrar evidência.
- [ ] 6.8 Confirmar rollback documentado: reverter código mantém preferências persistidas e não exige migration reversa.
