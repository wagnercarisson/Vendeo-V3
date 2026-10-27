## Context

A F57.1 entregou apenas contratos puros (`src/lib/market-context/**`): perfis BR/PY, resolução de
contexto da loja/campanha, proveniência (`configured` / `legacy_br`), parsers estritos e leitura de
campanha entregue. Nada é persistido. Hoje:

- `public.stores` não tem país, mercado, idioma, moeda ou fuso; o Brasil é implícito.
- Não existe preferência de usuário (idioma do app) persistida; `auth.users` é a única fonte.
- `store_billing_info.billing_address_country` é dado de **cobrança**, não país cadastral.
- `create_store_draft`, `create_store_with_cnpj`, `create_store_with_initial_grant` (usado por
  `admin_create_store_for_user`) e `update_store_cnpj` criam/atualizam lojas sem qualquer
  contexto de mercado.
- Leitura/escrita autenticada usa `requireApiUser` + ownership explícito; escritas HTTP usam
  `requireSameOrigin` (CSRF) e `apiHandler`.
- A biblioteca pura já valida mercados `BR`/`PY`, locales `pt-BR`/`es-PY`, moedas `BRL`/`PYG` e
  fusos `America/Sao_Paulo`/`America/Asuncion`, com fontes por campo.

Restrições: banco compartilhado por ambiente, isolamento por usuário/loja, país ≠ autorização;
lojas/usuários legados continuam operando; campanhas entregues são imutáveis; Paraguai não pode
ficar operacional nesta fatia.

## Goals / Non-Goals

**Goals:**

- Persistir, por usuário, o idioma do aplicativo; por loja, país cadastral, mercado padrão,
  idioma padrão do conteúdo, moeda anunciada e fuso.
- Reutilizar exclusivamente os resolvedores/parsers de `market-context` para validar o contexto
  completo antes de qualquer escrita.
- Distinguir, de forma durável, **escolha explícita** de **padrão assumido** e de **legado**.
- Leitura/escrita autenticadas, com ownership, CSRF, DTO allowlisted e erros tipados.
- Atualização parcial sem apagar campos omitidos e sem perder escolhas independentes sob
  concorrência.
- Inicialização idempotente nos caminhos de criação/confirmação fiscal, sem sobrescrever escolha
  explícita e sem backfill amplo.
- Manter o Paraguai inerte: o modelo aceita `PY`, mas nenhum fluxo operacional o habilita.

**Non-Goals:**

- Telas, seletores, navegação, tradução de UI, catálogos de mensagens, parsing/formatação
  monetária e de datas.
- Conectar preferências a prompts, IA, arte, legenda ou geração.
- Persistir/snapshot do contexto de campanha; alterar campanhas entregues.
- RUC, elegibilidade paraguaia, cobrança, assinatura, benefícios ou país fiscal editável.
- Alterar configuração global de ESLint, dependências ou env.

## Decisions

### 1. Duas tabelas aditivas, sem tocar `stores` nem billing

`public.user_preferences` (1:1 com usuário) e `public.store_market_settings` (1:1 com loja).

**Por que não colunas em `stores`:** país/mercado/idioma/moeda/fuso têm proveniência e versão
próprias, e a loja já é uma tabela larga usada por DTOs, readiness e administração. Uma tabela
dedicada evita alargar `Store`/`PublicStoreDTO` e permite evolução sem `ALTER` em tabela central.

**Por que não uma tabela genérica de perfil:** não há necessidade de chave-valor arbitrário;
colunas tipadas com `CHECK` são auditáveis e impedem valores não suportados.

`country_code` fica **em `store_market_settings`**, não em `stores`, para não duplicar a fonte de
verdade com dados fiscais (CNPJ) nem com `store_billing_info`. `billing_address_country`
permanece exclusivamente de cobrança e **não** é lido para derivar país cadastral.

### 2. Proveniência explícita por campo, não inferida

Cada campo padrão (`default_campaign_market`, `default_content_locale`, `default_currency`,
`time_zone`) guarda valor + `*_source ∈ {'explicit','default','legacy_br'}`.
`country_code` guarda `country_source ∈ {'assumed_default','fiscal_confirmation','legacy_br'}`.

Alternativas descartadas:
- **Só overrides explícitos, defaults calculados na leitura:** simples, mas não responde "esta
  escolha foi do usuário ou assumida?" sem comparar com o perfil atual — e muda de resposta se o
  perfil mudar. Guardar fonte é mais honesto e prepara telas/auditoria.
- **JSONB único de settings:** menos colunas, porém perde `CHECK`, tipagem e legibilidade em
  consultas/admin.

### 3. Ausência de linha é estado legítimo, não erro

- Usuário sem linha ⇒ `uiLocale = pt-BR`, `source = legacy_br`; GET não escreve.
- Loja sem linha ⇒ contexto BR resolvido com proveniência `legacy_br`; GET não escreve.
- A primeira escrita **explícita** materializa a linha (loja: país BR `legacy_br`, campos não
  tocados com fonte `legacy_br`; usuário: locale escolhido como `explicit`).
- **Sem backfill:** não há `INSERT ... SELECT` para todas as lojas/usuários existentes. Isso
  evita escrita ampla em dados existentes e mantém ausência distinguível.
- Falha de leitura do banco **não** vira legado: retorna `503 preferences_unavailable`.
  Linha existente com valor fora do contrato retorna `500 stored_preferences_invalid`
  (fail-closed), nunca BR silencioso.

### 4. Contratos e rotas

Novo módulo `src/lib/market-preferences/` (não dentro de `market-context`, que permanece puro):

- `user-preferences-service.ts`, `store-market-settings-service.ts`
- `dtos.ts` (allowlist explícita), `errors.ts`
- `src/app/api/preferences/route.ts` (GET/PATCH do idioma do app)
- `src/app/api/store/market-settings/route.ts` (GET/PATCH da loja)

`GET /api/preferences` → `{ uiLocale, source, version }`. PATCH aceita **somente** `uiLocale`
(string suportada, `null` ou omitido) e `expectedVersion` obrigatório, com `requireSameOrigin` +
`requireApiUser`; a escrita ocorre pela RPC `write_user_locale_preference`.

`GET /api/store/market-settings` e `PATCH` usam a consulta dedicada
`loadOwnedStoreForMarketSettings` (§10) — **não** `getCurrentStore`/`requireOwnership`, que
descartam o erro da consulta. PATCH aceita somente
`defaultCampaignMarket | defaultContentLocale | defaultCurrency | timeZone` (+ `expectedVersion`)
e **rejeita** `country` com `400 country_not_mutable`.

DTOs novos e dedicados; `PublicStoreDTO`/`Store` **não** são alterados nesta fatia. Nenhum campo
interno (IDs fiscais, hashes, billing) sai nas respostas.

### 5. Semântica de PATCH: omitido ≠ null ≠ inválido

- **Omitido:** campo e fonte permanecem idênticos — **exceto** a recomposição derivada descrita
  abaixo quando o mercado padrão muda.
- **`null`:** remove override explícito, recomputa o padrão e grava fonte `default`
  para o padrão vigente e grava fonte `default`.
- **Valor inválido:** `400` com `fieldErrors`, nenhuma escrita.
- **Chave desconhecida:** `400` (schema estrito).
- **Exceção explícita — mudança de `defaultCampaignMarket`:** quando o mercado padrão muda,
  `defaultContentLocale` e `defaultCurrency` com fonte `default` **ou `legacy_br`** são
  recomputados para o padrão do novo mercado e passam a fonte `default` (deixam de representar o
  padrão brasileiro legado). Campos com fonte `explicit` **nunca** são alterados por essa mudança.
  `timeZone` não depende do mercado e só muda se enviado explicitamente ou se o país cadastral
  mudar.
- **Loja legada sem escolha:** permanece BR/`pt-BR`/`BRL`/`America/Sao_Paulo` com fonte
  `legacy_br` enquanto o mercado não muda. Ao escolher outro mercado (ex.: PY), idioma/moeda não
  explícitos acompanham o destino (`es-PY`/`PYG`, fonte `default`); voltar para BR recomputa
  `pt-BR`/`BRL`.
- Ordem determinística de recomposição: mercado → idioma/moeda derivados (fontes `default` e
  `legacy_br`) → fuso (dependente do país). O contexto completo é validado com
  `resolveStoreMarketContext`/`parseStoreMarketContext` antes da escrita; o banco revalida com
  `CHECK`s.

Exemplo canônico: loja BR com `defaultCampaignMarket = "PY"` explícito e idioma/moeda ainda
derivados (`default`) resolve `es-PY`/`PYG`. A confirmação de CNPJ (país fiscal BR) **mantém**
`es-PY`/`PYG` e `America/Sao_Paulo`; não “corrige” idioma/moeda para o país cadastral.

### 6. Concorrência por versão (CAS), sem lost update

`store_market_settings.settings_version BIGINT` e `user_preferences.version BIGINT` incrementam a
cada escrita. PATCH exige `expectedVersion` (0 quando a linha não existe). O serviço lê, aplica o
merge, resolve o contexto completo e chama uma RPC que grava o **tuplo resolvido** apenas se a
versão ainda for a esperada. Divergência ⇒ `409 settings_version_conflict` (loja) ou
`409 preferences_version_conflict` (usuário), com a versão atual.

Nenhuma escrita direta nas tabelas é permitida ao cliente autenticado:

- `user_preferences`: RLS apenas `SELECT` do próprio usuário; `INSERT`/`UPDATE` diretos são
  negados. Toda escrita passa por `write_user_locale_preference(p_user_id, p_ui_locale,
  p_expected_version)`, `SECURITY DEFINER`, `service_role`-only, com CAS.
- `store_market_settings`: RLS apenas `SELECT` por ownership; escrita somente por
  `write_store_market_settings(...)` (`service_role`-only).

Duas atualizações independentes concorrentes: uma vence; a outra recebe 409 e, ao repetir com a
nova versão, preserva o campo da primeira. Nada é sobrescrito silenciosamente.

A confirmação fiscal também participa do controle de versão: `update_store_cnpj` trava a linha de
configurações (`FOR UPDATE`), aplica a recomposição de país/campos derivados e incrementa
`settings_version` na mesma transação. Um PATCH concorrente com versão antiga recebe 409, sem
sobrescrever a confirmação nem perder a escolha explícita.

**Linha ausente:** `FOR UPDATE` não protege o que ainda não existe. As RPCs de escrita executam
`INSERT ... ON CONFLICT (store_id | user_id) DO NOTHING` e só então `SELECT ... FOR UPDATE` antes
de comparar versões (ou usam advisory lock pela chave). Duas primeiras escritas concorrentes:
apenas uma cria a linha (versão 1); a outra observa versão 1 ≠ 0 e recebe 409. A confirmação
fiscal segue o mesmo padrão `ensure` + lock quando a linha não existe.

RPC de escrita: `write_store_market_settings(...)` (SECURITY DEFINER, `service_role` apenas),
verifica existência da loja, versão esperada e imutabilidade do país quando a linha já existe.
`ensure_store_market_settings(p_store_id, p_country_code, p_country_source)` é idempotente
(`ON CONFLICT DO NOTHING`) e deriva defaults dos perfis.

### 7. Inicialização nos caminhos existentes (sem duplicar lógica de negócio)

- `create_store_draft`: cria a loja e chama `ensure_store_market_settings(id, 'BR',
  'assumed_default')` na mesma transação.
- `create_store_with_cnpj`: idem com `('BR','fiscal_confirmation')`.
- `create_store_with_initial_grant` (admin): `('BR','assumed_default')`.
- `update_store_cnpj` (confirmação fiscal de loja legada/draft): atualiza
  `country_code='BR'`, `country_source='fiscal_confirmation'` e recomputa **somente** campos com
  fonte `default`/`legacy_br`; campos `explicit` são preservados.
- Repetir onboarding/atualização é idempotente; nada sobrescreve escolha explícita.
- Endereço, cidade, IP, navegador e idioma **não** definem país cadastral. `billing_address_country`
  não participa.

O Paraguai não é habilitado: os caminhos atuais só recebem CNPJ (BR). O modelo aceita `PY` para
preparar o futuro, mas nenhuma rota/fluxo cria loja PY nesta fatia.

### 8. Autorização e RLS

- `user_preferences`: RLS **somente `SELECT`** para o próprio `user_id = auth.uid()`;
  `INSERT`/`UPDATE` diretos de `authenticated` são negados; escrita apenas pela RPC
  `write_user_locale_preference` (`service_role`-only), sempre com o `user_id` autenticado
  fornecido pelo servidor.
- `store_market_settings`: RLS `SELECT` via `store_id IN (SELECT id FROM stores WHERE user_id =
  auth.uid())`; `service_role` ALL para escrita/RPC; nenhuma escrita direta pelo cliente.
- RPCs: `REVOKE` de `PUBLIC/anon/authenticated`, `GRANT EXECUTE` apenas `service_role`.
- Rotas: `requireSameOrigin` em PATCH; `requireApiUser` + ownership; 404 para loja alheia
  (não vaza existência); 401 sem sessão; 403 CSRF.
- Nenhuma autorização deriva de `country_code`.

### 9. Migrations: uma entrega aditiva

Uma migration `YYYYMMDDHHmmss_f57_2_market_preferences.sql` (timestamp UTC real na execução):

1. `CREATE TABLE user_preferences` + checks + trigger `updated_at`.
2. `CREATE TABLE store_market_settings` + checks + trigger `updated_at`.
3. `ensure_store_market_settings`, `write_store_market_settings` e
   `write_user_locale_preference` + grants.
4. `CREATE OR REPLACE` de `create_store_draft`, `create_store_with_cnpj`,
   `create_store_with_initial_grant`, `update_store_cnpj` com a chamada de inicialização,
   preservando literalmente os ramos de crédito/entitlement vigentes.
5. RLS/policies/grants.
6. Bloco `-- REVERT` com drops e referência às definições anteriores.

Sem alterar tabelas existentes, sem backfill, sem renomear migrations aplicadas.

### 10. Consulta dedicada de loja: inexistente ≠ falha de banco

Os helpers atuais (`getCurrentStore`, `requireOwnership`) descartam o erro da consulta; reutilizá-los
transformaria indisponibilidade em “loja não encontrada”. Esta fatia cria uma consulta dedicada
(`loadOwnedStoreForMarketSettings`) que retorna explicitamente:

- `found` (loja + id do dono);
- `not_found` (sem linha com `id`/`user_id`);
- `read_error` (erro do banco).

O mapeamento é `not_found → 404` e `read_error → 503 preferences_unavailable`. Rotas vizinhas e
helpers existentes **não** são refatorados nesta fatia.

### 11. Benefícios e créditos: comportamento vigente preservado

Esta fatia **não cria, remove ou modifica** benefícios. O comportamento atual difere entre
caminhos e deve permanecer idêntico:

| Caminho | Comportamento vigente |
|---|---|
| `create_store_draft` | sem grant; `onboardingGranted=false` |
| `create_store_with_initial_grant` (admin) | cria loja com `balance: 0`; **sem concessão** |
| `create_store_with_cnpj` | grant demo condicional quando `verification_status='approved'`, via `grant_demo_credits` e flag existente |
| `update_store_cnpj` | marcador `legacy_pre_f32_onboarding_consumed` quando há benefício anterior; caso contrário grant demo condicional quando aprovado e habilitado |

A alteração de preferências apenas adiciona inicialização/atualização de configurações; nenhum
ramo de crédito é reescrito, e os testes devem comparar transações/entitlements antes e depois.

## Risks / Trade-offs

- **[Migration recria RPCs grandes e pode divergir do corpo atual]** → copiar o corpo vigente
  (não o histórico), provar com testes de banco isolado que criação/legal/grant/auditoria
  continuam idênticos; revisão dedicada do diff SQL.
- **[Escrita parcial e concorrência]** → CAS obrigatório + 409; teste com duas escritas
  simultâneas em campos diferentes e repetição.
- **[Linha ausente confundida com erro]** → taxonomia explícita: ausência = legado (200),
  erro de leitura = 503, linha inválida = 500; testes por camada.
- **[Defaults persistidos ficam defasados se o perfil mudar]** → perfis são versionados
  (`profileVersion`); `context_version` registra a versão do contrato; migração futura decide
  re-derivação — nada é recalculado silenciosamente.
- **[Duplicação com billing/fiscal]** → país cadastral só em `store_market_settings`;
  `billing_address_country` intocado e não lido; documentado no SQL (`COMMENT`).
- **[PY parecer habilitado]** → nenhum caminho de criação aceita PY; testes negativos garantem
  que apenas BR é inicializado; RUC/legal fora do escopo.
- **[Rollback do banco remove preferências novas]** → rollback preferencial é só do código,
  preservando tabelas/dados; reversão do banco exige autorização, restauração prévia das RPCs
  anteriores e backup/export quando houver dados. Nenhuma perda é presumida aceitável.

## Migration Plan

1. Revisão desta proposta e do design pelo usuário/Codex.
2. Planejamento GSD (`/gsd-plan-phase`), com planos pequenos e checkpoints.
3. Implementação local + testes unitários/rotas + testes de banco em **PostgreSQL descartável
   isolado** (criar, migrar, provar, destruir), com evidência versionada.
4. Aplicação da migration no ambiente alvo **antes** do deploy do código; conferir unicidade do
   timestamp na branch, na `main` e no conjunto integrado.
5. Deploy do código. As rotas novas são **superfície de API autenticada**: mesmo sem UI, ficam
   acessíveis a chamadas autenticadas. Não são “inertes”. O deploy exige revisão explícita de
   contrato; não há flag/env nesta fatia.
6. Rollback: preferencialmente **apenas o código**, preservando tabelas e dados (as RPCs antigas
   continuam compatíveis com o schema aditivo). Reversão do banco é operação separada, **somente
   com autorização**, e deve restaurar primeiro as definições anteriores das RPCs
   (`create_store_draft`, `create_store_with_cnpj`, `create_store_with_initial_grant`,
   `update_store_cnpj`) e só então remover tabelas/funções. Perda de preferências **não** é
   tratada como automaticamente aceitável; exige decisão explícita e backup/export se houver
   dados. Nunca renomear/reescrever migrations já aplicadas.

## Open Questions

Nenhuma pendência bloqueante após a revisão de 2026-10-27. Decisões fechadas:

- `expectedVersion` **obrigatório** em PATCH de loja e de usuário.
- Loja draft nasce com país BR `assumed_default` e procedência registrada.
- Nomes mantidos: `src/lib/market-preferences/`, `/api/preferences`,
  `/api/store/market-settings`.
- País fiscal divergente em `update_store_cnpj` **falha** com erro tipado; não sobrescreve.
- Nenhuma loja PY é criada nesta fatia; o modelo apenas aceita os valores.
