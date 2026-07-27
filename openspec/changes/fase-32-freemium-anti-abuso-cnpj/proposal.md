## Why

O modelo de freemium atual é vulnerável a abuso por multiplicação de contas: um agente malicioso pode criar N contas com N emails distintos, cada uma recebendo 10 créditos de onboarding + 5 créditos mensais, sem qualquer barreira de correlação. A unidade econômica do freemium é `store_id`, mas `auth.users` não tem barreira por pessoa física — um mesmo grupo econômico pode pulverizar cadastros em N contas e multiplicar o benefício gratuito. A F32 resolve isso trocando a unidade econômica do freemium de `store_id` para **raiz de CNPJ** (8 primeiros dígitos).

## What Changes

- **CNPJ obrigatório na criação da loja** — formulário e backend validam dígitos verificadores + formato
- **`stores.cnpj_normalized` + `stores.cnpj_root_hash`** — CNPJ normalizado (14 dígitos), hash HMAC-SHA256 da raiz com pepper server-side
- **`stores.razao_social` + `stores.nome_fantasia`** — campos opcionais para validação cadastral futura
- **`freemium_entitlements`** — nova tabela de controle: root_hash, benefício (`onboarding`/`monthly`/`admin_exception`), ciclo, grant_transaction_id, com idempotência via `INSERT ... ON CONFLICT DO NOTHING`
- **Onboarding** — grant de 10 créditos concedido **uma única vez por raiz de CNPJ** (entitlement-first, grant-second)
- **Créditos mensais** — 5 créditos concedidos **uma única vez por raiz de CNPJ por ciclo**
- **Filiais (mesma raiz, CNPJ diferente)** — loja criada, sem grant, mensagem informativa
- **Compra de créditos** — permitida para qualquer loja cadastrada, sem restrição de raiz
- **Admin** — CNPJ mascarado (`**.***.***/YYYY-**`) no detalhe da loja + badge de status freemium + exceção manual auditável
- **Lojas legadas** — banner de atualização cadastral obrigatória + RPC `update_store_cnpj()` sem concessão de créditos, mas com inserção de entitlement `onboarding` sem grant para marcar a raiz como já consumida
- **Termos de Uso v1.2** — cláusulas de CNPJ obrigatório, freemium por raiz, sanções, reaceite obrigatório
- **Política de Privacidade v1.1** — finalidades documentadas do CNPJ (cobrança, NF, antifraude, freemium, segurança)
- **Validação cadastral** — cruzamento nome fantasia/razão social com CNPJ como camada de score (não bloqueio cego)
- **Migration SQL única** — `20260728000001_freemium_anti_abuso_cnpj.sql` com todas as alterações de schema
- **CNPJ nunca exposto cru** — mascarado em UI, APIs e logs; apenas `root_hash` em logs estruturados

## Capabilities

### New Capabilities
- `cnpj-validation`: Validação de CNPJ (dígitos verificadores, formato, sequências inválidas), normalização e hash HMAC-SHA256 da raiz com pepper server-side, mascaramento e similaridade textual
- `freemium-entitlement`: Tabela `freemium_entitlements` com controle de benefício por raiz de CNPJ, idempotência via INSERT ... ON CONFLICT, onboarding e monthly grant condicionados à raiz, histórico de entitlements
- `admin-cnpj-display`: CNPJ mascarado no admin, badge de status freemium (ativo/usado/esgotado/sem CNPJ), exceção manual auditável com reason obrigatório
- `legal-documents-v1-2`: Termos de Uso v1.2 (CNPJ obrigatório, freemium por raiz, sanções, compra permitida) + Política de Privacidade v1.1 (finalidades do CNPJ) + reaceite contratual obrigatório
- `legacy-store-cnpj-update`: Atualização cadastral de lojas legadas sem CNPJ — banner, formulário, RPC `update_store_cnpj()` sem concessão de créditos, com entitlement `onboarding` legacy sem grant para marcar raiz consumida

### Modified Capabilities
- `store-ownership-api`: POST /api/store passa a exigir `cnpj` obrigatório, validar dígitos, passar cnpj_normalized para RPC (que calcula cnpj_root_hash internamente), e condicionar onboarding grant à elegibilidade da raiz. Response inclui `onboardingGranted` boolean.
- `store-identity-ui`: Store identity form ganha campos de CNPJ (com máscara e validação), razão social e nome fantasia
- `onboarding-grant`: Grant de onboarding condicionado à raiz de CNPJ — entitlement-first, grant-second. Lojas legadas sem CNPJ não recebem grant na atualização.
- `monthly-credits-cron`: Cron mensal passa a verificar entitlement por raiz — 1 grant por raiz por ciclo. Lojas sem `cnpj_root_hash` são ignoradas.
- `admin-user-directory`: Página de detalhe do usuário ganha CNPJ mascarado, badge de status freemium, histórico de entitlements e botão de exceção manual
- `legal-acceptance-service`: Reaceite de Termos de Uso v1.2 integrado ao pipeline guard
- `privacy-acknowledgement`: Publicação da Política de Privacidade v1.1 com finalidades documentadas do CNPJ
- `transactional-pipeline`: Guard de reaceite da v1.2 adicionado ao pipeline de geração (reutilizando padrão F30)

## Impact

- **Migration**: 1 nova migration SQL com 4 novas colunas em `stores`, 1 nova tabela (`freemium_entitlements`), 2 RPCs novas/substituídas (`create_store_with_cnpj`, `update_store_cnpj`), alteração em `grant_monthly_credits`, publicação de versões legais v1.1/v1.2
- **Novo módulo `src/lib/cnpj/`**: `validate.ts`, `normalize.ts`, `hash.ts`, `mask.ts`, `similarity.ts`, `types.ts` + testes
- **Novo módulo `src/lib/freemium/`**: `entitlement-service.ts`, `types.ts` + testes
- **Store route modificada**: `src/app/api/store/route.ts` — CNPJ obrigatório, validação, entitlement check
- **Admin modificado**: `src/app/(app)/admin/users/[id]/page.tsx` e `page.tsx` — CNPJ mascarado, badge freemium, exceção
- **Store identity form modificado**: `src/components/flow/store-identity-form.tsx` — campo CNPJ com máscara
- **Documentos legais novos**: `public/docs/legal/privacy-policy-v1-1.md`, `public/docs/legal/terms-of-service-v1-2.md`
- **Catálogo legal atualizado**: `document-content.ts` — `privacy_policy` → v1.1, `terms_of_service` → v1.2
- **Nenhum prompt de IA alterado** — CNPJ não entra no pipeline de geração
- **30+ testes novos**: validação CNPJ (10+), entitlement service (8), store route (7+), lojas legadas (3+), integração (2+)
- **Dependências**: F30 (estrutura legal, reaceite), F24 (credit_transactions), F29.3 (monthly credits cron)