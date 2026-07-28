## Why

A F32 estabeleceu a fundação do freemium por raiz de CNPJ com validação de dígitos, hash HMAC-SHA256, tabela de entitlements e grant condicionado. No entanto, a F32 **não consulta APIs externas** — o lojista digita manualmente razão social e nome fantasia, e a validação cadastral se limita a similaridade textual entre os nomes informados (Levenshtein, score informativo). Isso mantém cinco vulnerabilidades:

1. Um CNPJ falso (que passe na validação de dígitos) pode ser usado sem barreira — não há verificação contra fonte oficial
2. Um CNPJ real mas de terceiro (sem autorização) pode ser cadastrado — a F32 só bloqueia duplicidade, não uso de CNPJ alheio
3. As informações cadastrais (endereço, nome, segmento) não são validadas contra dados oficiais da Receita Federal
4. O grant de onboarding (10 créditos) é concedido automaticamente se a raiz for elegível — sem qualquer checagem de verossimilhança entre dados informados e oficiais
5. Um agente malicioso pode criar um CNPJ que passa na validação de dígitos (ex: de empresa inativa ou de terceiro), informar dados fictícios e receber 10 créditos automaticamente

A F33 avança para a **próxima camada de integridade cadastral**: consultar fontes oficiais (BrasilAPI com fallback CNPJá) para obter dados cadastrais reais, cruzá-los com as informações fornecidas pelo lojista, e decidir se o freemium é liberado automaticamente ou se a loja requer revisão manual.

## What Changes

- **Consulta cadastral externa de CNPJ** — BrasilAPI como provedor primário, CNPJá como fallback, tratamento de timeout/erro/rate limit
- **Preenchimento automático de dados oficiais** — razão social (bloqueado), nome fantasia (bloqueado), endereço completo (editável), situação cadastral
- **Cross-check de verossimilhança** — nome da loja vs razão social/nome fantasia oficiais, cidade/UF informada vs dados oficiais
- **Armazenamento de CNAE** como dado de referência (sinal fraco para análise futura, sem decisão automática)
- **Motor de decisão de elegibilidade** — approve / review / reject / defer
- **Liberação condicional do freemium** — concede onboarding grant apenas se decisão = `approve`
- **Cache de consulta CNPJ com TTL** — tabela `cnpj_lookup_cache` com TTL 24h, evita consultas repetidas e reduz dependência de APIs externas
- **Fila de revisão admin** — `/admin/reviews` com abas Pendentes/Adiados/Recusados/Aprovados, ações Aprovar/Recusar/Exceção com audit trail
- **Nova migration SQL** — colunas de status de verificação e dados oficiais na loja, tabela de cache de lookup
- **Serviço reutilizável de verificação** — `cnpj/verification-service.ts` + `freemium/freemium-risk-service.ts`, desacoplados do onboarding
- **Criação de store de teste pelo admin** — CNPJ fictício com dados manuais, marcada como `is_test_store`, sem freemium automático, auditada
- **Revelação de CNPJ auditada no admin** — botão "Revelar CNPJ" registra em `admin_audit_log` com action `reveal_cnpj`
- **Mensagens ao usuário** por estado (lookup, approve, review, reject, defer) definidas por contexto

## Capabilities

### New Capabilities
- `cnpj-lookup-provider`: Interface `CnpjLookupProvider` + implementações BrasilAPI (primário) e CNPJá (fallback) com timeout 5s, retry 1x, tratamento de erro/rate limit
- `cnpj-verification-service`: Orquestrador `CnpjVerificationService.resolve()` que coordena cache → provedor primário → fallback, com cache de `not_found` para evitar reconsulta
- `freemium-risk-service`: Motor de decisão `evaluateFreemiumEligibility()` com regras determinísticas (approve/review/reject/defer) baseadas em sinais de verossimilhança
- `admin-reviews`: Página `/admin/reviews` com abas Pendentes/Adiados/Recusados/Aprovados, paginação, ações Aprovar/Recusar/Exceção, CNPJ mascarado com revelação auditada, consulta externa
- `admin-test-store`: Criação de store de teste com CNPJ fictício, `is_test_store=true`, sem freemium automático, auditada, excluída de métricas/relatórios

### Modified Capabilities
- `store-route`: POST /api/store condiciona grant de onboarding à decisão do `freemium-risk-service`; passa `verification_status` + `verification_data` para RPC
- `store-identity-form`: Store identity form ganha lookup assíncrono de CNPJ onBlur, campos bloqueados (razão social, nome fantasia), botões "Usar nome fantasia" / "Usar razão social", endereço pré-preenchido, mensagens de status por estado
- `admin-user-directory`: Página de detalhe do usuário ganha card "Verificação Cadastral" com status, dados oficiais, botão "Revelar CNPJ"; listagem ganha filtro por `verification_status`
- `database-schema`: Migration adiciona colunas de verificação em `stores`, tabela `cnpj_lookup_cache`, RPCs de verificação, RPCs admin, atualiza RPC `create_store_with_cnpj`

## Impact

- **Migration**: 1 nova migration SQL com 7+ colunas em `stores`, 1 nova tabela (`cnpj_lookup_cache`), 4+ RPCs novas/modificadas (`update_store_verification`, `admin_approve_store_verification`, `admin_reject_store_verification`, `admin_create_test_store`), RPC `create_store_with_cnpj` modificada
- **Novo módulo `src/lib/cnpj/lookup-providers/`**: `types.ts`, `brasil-api.ts`, `cnpja.ts` + testes
- **Novo módulo `src/lib/cnpj/`**: `verification-service.ts` (orquestrador lookup + cache) + testes
- **Novo módulo `src/lib/freemium/`**: `freemium-risk-service.ts` + testes
- **Store route modificada**: `src/app/api/store/route.ts` — verificação server-side, condiciona grant à decisão
- **Store identity form modificado**: `src/components/flow/store-identity-form.tsx` — lookup assíncrono, campos bloqueados, botões de atalho
- **Página admin nova**: `src/app/(app)/admin/reviews/page.tsx` — fila de revisão
- **Admin pages modificadas**: `src/app/(app)/admin/users/page.tsx` (filtro), `src/app/(app)/admin/users/[id]/page.tsx` (card verificação)
- **API admin nova**: 6 endpoints em `/api/admin/reviews/` + `/api/admin/stores/create-test`
- **Dependências**: F32 (cnpj validation, freemium entitlements, store route, admin), F30 (legal clearance, document versions, admin_audit_log), F24 (credit_transactions)
- **Nenhum prompt de IA alterado**
- **Nenhuma dependência de nova biblioteca externa** além de fetch nativo para APIs de CNPJ
