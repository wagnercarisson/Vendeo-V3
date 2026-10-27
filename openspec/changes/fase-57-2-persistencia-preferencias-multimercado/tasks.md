## 1. Preparação e migration aditiva

- [ ] 1.1 Conferir base: branch limpa e alinhada à `origin/main`; `src/lib/market-context/**` sem alterações pendentes; unicidade do timestamp `YYYYMMDDHHmmss` na branch, na `main` e em branches paralelas conhecidas. (30 min)
- [ ] 1.2 Criar `supabase/migrations/<UTC>_f57_2_market_preferences.sql`: `user_preferences` e `store_market_settings` com `CHECK`s de mercado/locale/moeda/fuso/fontes, `context_version`, versões de concorrência, FKs e triggers `updated_at`. (2 h)
- [ ] 1.3 Na mesma migration, criar `ensure_store_market_settings` (idempotente), `write_store_market_settings` (CAS por versão, país imutável quando a linha existe) e `write_user_locale_preference` (CAS), com `SECURITY DEFINER`, `search_path = ''`, `REVOKE` de `PUBLIC/anon/authenticated` e `GRANT` apenas `service_role`. (2 h)
- [ ] 1.4 Adicionar RLS: `user_preferences` **somente SELECT** do próprio usuário (sem escrita direta); `store_market_settings` SELECT por ownership da loja; `service_role` ALL para escrita/RPC. Incluir `COMMENT` explicitando que billing/endereço não definem país cadastral. (1 h)
- [ ] 1.5 Recriar `create_store_draft`, `create_store_with_cnpj`, `create_store_with_initial_grant` e `update_store_cnpj` copiando o corpo **vigente**, acrescentando a inicialização/atualização de configurações e preservando literalmente os ramos de crédito/entitlement existentes; `update_store_cnpj` trava a linha de configurações e incrementa `settings_version`. Incluir bloco `-- REVERT` com restauração prévia das RPCs. (2 h)

## 2. Contratos, DTOs e serviço do usuário

- [ ] 2.1 Criar `src/lib/market-preferences/errors.ts` e `dtos.ts` com allowlist explícita (`UserLocalePreferenceDTO`, `StoreMarketSettingsDTO`), sem spread de linha crua e sem campos internos/fiscais. (1 h)
- [ ] 2.2 Implementar `user-preferences-service.ts`: leitura (linha ausente ⇒ `legacy_br` sem escrita), escrita via `write_user_locale_preference` com `expectedVersion`, `null` = limpar, `uiLocale` omitido = inalterado, validação via `market-context`, mapeamento de erros 400/409/503/500. (2 h)
- [ ] 2.3 Testes unitários do serviço: ausência legada, valor explícito, limpeza, omitido com versão válida, inválido sem escrita, conflito de versão, falha de banco sem fallback, linha inválida fail-closed, independência de país/mercado. (2 h)
- [ ] 2.4 Criar `src/app/api/preferences/route.ts` (`GET`/`PATCH`) com `requireSameOrigin`, `requireApiUser`, schema estrito exigindo `expectedVersion` e aceitando `uiLocale` opcional, e DTO; testes de rota para 200/400/401/403/409/503, isolamento A/B e tentativa de escrita direta negada. (2 h)

## 3. Serviço e rota da loja

- [ ] 3.1 Implementar consulta dedicada `loadOwnedStoreForMarketSettings` (found/not_found/read_error, sem reutilizar helpers que engolem erro) e `store-market-settings-service.ts`: leitura por loja (linha ausente ⇒ legado BR), merge determinístico mercado → idioma/moeda → fuso, exceção de recomposição ao trocar mercado (fontes `default` e `legacy_br`; resultado passa a `default`), `resolveStoreMarketContext`/`parseStoreMarketContext`, CAS, preservação de fontes e proibição de país. (2 h)
- [ ] 3.2 Testes unitários: defaults BR, overrides explícitos, mudança de mercado recomputa derivados e legado, `null` recomputa para `default`, omitido preserva, inválidos, conflito, loja legacy sem linha e linha materializada, retorno PY→BR, `read_error → 503` e linha inválida 500. (2 h)
- [ ] 3.3 Criar `src/app/api/store/market-settings/route.ts` (`GET`/`PATCH`) com ownership dedicada, `requireSameOrigin`, schema estrito, `country_not_mutable`, `expectedVersion` obrigatório e DTO allowlisted; testes 404 para loja alheia/inexistente, 503 para falha de banco, 409, 400 e 200. (2 h)
- [ ] 3.4 Provar que `PublicStoreDTO`, `Store`, `store_billing_info` e respostas existentes não mudaram; documentar que as rotas novas são API autenticada e permanecem acessíveis sem UI. (1 h)

## 4. Integração com onboarding

- [ ] 4.1 Ajustar a chamada de `create_store_draft` em `POST /api/store` (se necessário) e cobrir com teste que a loja draft nasce com configurações BR `assumed_default`, aceites e `onboardingGranted=false` inalterados. (2 h)
- [ ] 4.2 Cobrir `create_store_with_cnpj` e `update_store_cnpj`: país `fiscal_confirmation`, escolhas explícitas preservadas, campos `default`/`legacy_br` recomputados, sem recriação; ramos de crédito vigentes preservados (marcador legado sem grant; demo condicional quando aprovado/habilitado); teste BR + mercado PY explícito mantendo `es-PY`/`PYG` e fuso BR. (2 h)
- [ ] 4.3 Cobrir `admin_create_store_for_user`: configurações BR presentes, `balance = 0` sem concessão, audit log inalterado, erro de loja existente preservado. (1 h)
- [ ] 4.4 Teste de idempotência: repetir inicialização/atualização não duplica linhas nem sobrescreve escolhas; falha simulada reverte loja + aceites + configurações + efeitos de crédito. (2 h)
- [ ] 4.5 Teste de concorrência entre confirmação fiscal e PATCH de preferências: confirmação incrementa `settings_version`; PATCH com versão antiga recebe 409 sem sobrescrever. Cobrir também **linha ausente**: `INSERT ... ON CONFLICT DO NOTHING` + `FOR UPDATE`/advisory lock; duas primeiras escritas ⇒ uma cria (v1) e a outra recebe 409. (2 h)

## 5. Testes de banco em ambiente isolado

- [ ] 5.1 Definir e documentar o harness descartável (PostgreSQL local isolado, porta própria, migrations aplicadas em transação, `TEST_DATABASE_URL` explícito, checkpoint de autorização, destruição ao final). (1 h)
- [ ] 5.2 Executar provas de RLS/grants: usuário A não lê/escreve B; `authenticated` **não** escreve diretamente em `user_preferences` nem em `store_market_settings`; `service_role` opera apenas pelas RPCs; país imutável na escrita genérica. (2 h)
- [ ] 5.3 Provar idempotência, concorrência (duas escritas independentes ⇒ 1 aceita + 409; retry preserva; confirmação fiscal incrementa versão; **primeira escrita sem linha** ⇒ insert+lock, uma cria v1 e a outra recebe 409) e rollback transacional da criação. (2 h)
- [ ] 5.4 Provar não regressão: contagens/hashes de `stores`, `store_billing_info`, créditos, `credit_transactions`, `freemium_entitlements`, campanhas e aceites iguais antes/depois; nenhuma loja PY criada; nenhum benefício criado/removido pelas preferências. (2 h)
- [ ] 5.5 Versionar evidências (SQL/JSON/txt) em `.planning/phases/<fase>/evidence/` e destruir o ambiente; registrar saída literal. (1 h)

## 6. Verificação, segurança e encerramento

- [ ] 6.1 Rodar testes focados de `market-preferences`, rotas, onboarding e `market-context` (72/72); typecheck, lint (registrar cobertura TS real) e build; registrar saídas literais. (2 h)
- [ ] 6.2 Revisar diff por caminho: nenhum arquivo de UI, catálogo, formatação, IA, campanha ou billing alterado; nenhuma migration aplicada fora do ambiente isolado; manifests/lockfile intactos. (1 h)
- [ ] 6.3 Verificação de segurança (ASVS L1): ownership, CSRF, service_role, RLS, ausência de vazamento em DTOs/erros e país ≠ autorização; registrar ameaças e disposição. (2 h)
- [ ] 6.4 Revisar migração e runbook de rollback para promoção: timestamp/ordem, `-- REVERT` restaurando **primeiro** as RPCs anteriores, dependências entre funções, ordem migration → código, rollback preferencial apenas do código preservando tabelas/dados, reversão de banco somente com autorização e sem perda presumida; documentar que as rotas são API autenticada ativa sem UI. (2 h)
- [ ] 6.5 Apresentar aceite técnico ao usuário/Codex; habilitação PY, telas, campanhas e cobrança permanecem explicitamente fora. (1 h)

## 7. Registro de requisitos futuros (não implementar)

- [ ] 7.1 Registrar nos artefatos de handoff: configurações pessoais de idioma; defaults de campanha da loja; seletores discretos antes do preenchimento; escolhas avulsas não persistem; moeda não converte preço; campanha entregue conserva contexto; cobrança separada das preferências com condições congeladas na contratação. (30 min)
