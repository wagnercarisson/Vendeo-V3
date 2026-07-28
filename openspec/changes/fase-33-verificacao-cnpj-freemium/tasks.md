## Onda 1 — Lookup + Cache + Serviço de Decisão

### 1. Migration — Verificação CNPJ

- [ ] 1.1 Criar `supabase/migrations/20260728000001_f33_cnpj_verification.sql`: ALTER TABLE stores (verification_status, verification_data, cnpj_official_data, cnpj_lookup_hash, verification_requested_at, verification_decided_at, verification_reasons) + check constraint + índices
- [ ] 1.2 Adicionar coluna `is_test_store BOOLEAN NOT NULL DEFAULT false` em stores + índice parcial
- [ ] 1.3 Criar tabela `cnpj_lookup_cache` (cnpj_normalized PK, outcome, result_data, provider, created_at, expires_at) + RLS service_role + índice por expires_at
- [ ] 1.4 Criar RPC `update_store_verification(p_store_id, p_verification_status, p_verification_data, p_cnpj_official_data, p_verification_reasons)` — atualiza status, dados, e `verification_decided_at`
- [ ] 1.5 Configurar variável de ambiente `CNPJ_PEPPER` (já existe da F32)
- [ ] 1.6 Executar migration localmente e verificar schema

### 2. Core Library — Lookup Providers

- [ ] 2.1 Criar `src/lib/cnpj/lookup-providers/types.ts`: interface `CnpjLookupProvider { lookup(cnpj): Promise<LookupResult> }` e tipos `LookupResult { status: 'resolved' | 'not_found' | 'unavailable', data?: CnpjLookupData }`
- [ ] 2.2 Criar `src/lib/cnpj/lookup-providers/brasil-api.ts`: `BrasilApiProvider` — GET `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`, timeout 5s, retry 1x, mapeamento de resposta para `CnpjLookupData`
- [ ] 2.3 Criar `src/lib/cnpj/lookup-providers/cnpja.ts`: `CnpjaProvider` — GET `https://api.cnpja.com.br/companies/{cnpj}`, timeout 5s, retry 1x, mapeamento de resposta para `CnpjLookupData`
- [ ] 2.4 Criar `src/lib/cnpj/types.ts`: adicionar `CnpjLookupResult` (razao_social, nome_fantasia, situacao_cadastral, cep, logradouro, numero, complemento, bairro, cidade, uf, cnae_principal, cnae_descricao, data_situacao, data_abertura, porte)

### 3. Verification Service (orquestrador)

- [ ] 3.1 Criar `src/lib/cnpj/verification-service.ts`: classe `CnpjVerificationService` com método `resolve(cnpj)` — orquestra cache → BrasilAPI → CNPJá → cache
- [ ] 3.2 Implementar cache hit/miss: consulta `cnpj_lookup_cache` por `cnpj_normalized`, verifica `expires_at`
- [ ] 3.3 Implementar lógica de fallback: primary unavailable → tenta fallback, ambos unavailable → retorna `unavailable`
- [ ] 3.4 Implementar cache de `not_found`: CNPJ inexistente é cacheado para evitar reconsulta
- [ ] 3.5 `unavailable` NÃO é cacheado (pode ser transitório)
- [ ] 3.6 Cache expirado → consulta novamente provedores

### 3a. API Route — GET /api/cnpj/lookup

- [ ] 3a.1 Criar `src/app/api/cnpj/lookup/route.ts`: endpoint que recebe `?cnpj=...`, valida autenticação, normaliza CNPJ, chama `CnpjVerificationService.resolve()`, retorna `{ status, data?, message }`
- [ ] 3a.2 Mapear retorno: `resolved` → dados oficiais + mensagem sucesso; `not_found` → mensagem CNPJ inexistente; `unavailable` → mensagem temporária
- [ ] 3a.3 Response 400 para CNPJ sem validação de dígitos; 401 para usuário não autenticado

### 4. Freemium Risk Service (motor de decisão)

- [ ] 4.1 Criar `src/lib/freemium/types.ts`: adicionar `FreemiumEligibilityInput` (com `lookupOutcome: 'resolved' | 'not_found' | 'unavailable'`), `FreemiumEligibilityOutput`, `Signals`, `Decision` (`approve` | `review` | `reject` | `defer`)
- [ ] 4.2 Criar `src/lib/freemium/freemium-risk-service.ts`: função `evaluateFreemiumEligibility(input)` — computa sinais (nameSimilarity, cityMatch, stateMatch, cnpjExists, situacaoCadastral, rootEligible), aplica regras determinísticas de approve/review/reject/defer
- [ ] 4.3 Implementar similaridade de nome com threshold 0.6 (Levenshtein/Jaro-Winkler, reusa função da F32)
- [ ] 4.4 Implementar cityMatch ignorando acentos e case
- [ ] 4.5 Implementar stateMatch (case-insensitive)
- [ ] 4.6 CNAE é armazenado mas NÃO usado na decisão (cnaeCompatible = null)

## Onda 2 — Onboarding Modificado + Grant Condicional

### 5. Store Route — POST /api/store (modificado)

- [ ] 5.1 Modificar rota para usar `CnpjVerificationService.resolve()` após validação local de dígitos (server-side, no submit)
- [ ] 5.2 Se lookup retornar `not_found` → bloqueia criação → 400 com mensagem "CNPJ não encontrado na Receita Federal"
- [ ] 5.3 Se lookup retornar `unavailable` → estado DEFER, cria loja sem grant
- [ ] 5.4 Se lookup retornar `resolved` → usa `FreemiumRiskService.evaluate()` para decidir elegibilidade
- [ ] 5.5 Passa `verification_status` + `verification_data` para RPC `create_store_with_cnpj` (modificada)
- [ ] 5.6 Condiciona grant de onboarding: apenas se `decision = 'approve'`
- [ ] 5.7 Response inclui: `onboardingGranted`, `verificationStatus`, mensagem apropriada

### 6. RPC create_store_with_cnpj (modificada)

- [ ] 6.1 Modificar RPC para receber `p_verification_status`, `p_verification_data`, `p_cnpj_official_data` como parâmetros
- [ ] 6.2 Inserir `verification_status`, `verification_data`, `cnpj_official_data`, `cnpj_lookup_hash` no INSERT da store
- [ ] 6.3 Só concede `grant_credits(10)` se `p_verification_status = 'approved'`
- [ ] 6.4 Inserir legal_acceptances inalterado (sempre, independente da decisão). Condicionar `INSERT INTO freemium_entitlements (benefit_type = 'onboarding')` + `grant_credits(10)` apenas quando `p_verification_status = 'approved'`
- [ ] 6.5 Response inclui: `{ onboardingGranted: boolean, verificationStatus: string }`

### 7. Store Identity Form — CNPJ Lookup Assíncrono

- [ ] 7.1 Modificar `src/components/flow/store-identity-form.tsx`: adicionar lookup assíncrono no evento onBlur do campo CNPJ (após validação local de dígitos)
- [ ] 7.2 Exibir loading state "Consultando dados cadastrais..." durante lookup
- [ ] 7.3 Razão social: bloqueada e pré-preenchida quando dados resolvidos
- [ ] 7.4 Nome fantasia: bloqueado e pré-preenchido quando dados resolvidos
- [ ] 7.5 Botão "Usar nome fantasia": copia nome fantasia para "Nome da Loja"
- [ ] 7.6 Botão "Usar razão social": copia razão social para "Nome da Loja" (exibido apenas se não houver nome fantasia)
- [ ] 7.7 Endereço: pré-preenchido (CEP, rua, bairro, cidade, UF) quando disponível, mantendo campos editáveis
- [ ] 7.8 Tooltip no campo CNPJ: "Verificamos os dados do CNPJ para liberar os créditos gratuitos."
- [ ] 7.9 Mensagens de status do lookup: sucesso (check verde), falha (aviso amarelo)
- [ ] 7.10 Mensagens de submit conforme decisão (approve/review/reject/defer) — ver D9 do design
- [ ] 7.11 Banner no dashboard para lojas em REVIEW: "Seus créditos de boas-vindas estão em verificação cadastral."
- [ ] 7.12 Banner no dashboard após admin APPROVE: "Seus créditos de boas-vindas foram liberados!" (one-time, dismissível)

## Onda 3 — Admin Review + Test Stores + Privacidade

### 8. Admin — Página de Revisão (/admin/reviews)

- [ ] 8.1 Criar `src/app/(app)/admin/reviews/page.tsx`: fila de revisão com abas (Pendentes/Adiados/Recusados/Aprovados), paginação, filtro por motivo
- [ ] 8.2 Listar lojas com: nome, CNPJ mascarado, email do usuário, data, motivos (tags), decisão do sistema
- [ ] 8.3 Dados oficiais expansíveis (razão social, endereço, CNAE, situação cadastral)
- [ ] 8.4 Botão "Revelar CNPJ" na página de detalhe: mostra CNPJ completo, registra em admin_audit_log
- [ ] 8.5 Botão "Consultar na Receita": abre BrasilAPI/CNPJá em nova aba
- [ ] 8.6 Ação "Aprovar": chama RPC `admin_approve_store_verification`, tenta onboarding normal, audit trail
- [ ] 8.7 Ação "Recusar": chama RPC `admin_reject_store_verification`, status REJECTED, audit trail
- [ ] 8.8 Ação "Conceder Exceção": grant manual com `benefit_type = 'admin_exception'`, bypassa elegibilidade, audit trail
- [ ] 8.9 CNPJ inexistente (not_found) NÃO entra na fila de revisão (bloqueia criação pública)
- [ ] 8.10 Registro de todas as ações em `admin_audit_log` (padrão F30/F26)

### 9. Admin API — Endpoints de Revisão

- [ ] 9.1 Criar `GET /api/admin/reviews` — lista lojas em REVIEW (ou APPROVED/REJECTED com filtro)
- [ ] 9.2 Criar `GET /api/admin/reviews/[id]` — detalhe de uma revisão (dados oficiais, sinais, motivos)
- [ ] 9.3 Criar `POST /api/admin/reviews/[id]/approve` — aprova verificação + concede onboarding + audit log
- [ ] 9.4 Criar `POST /api/admin/reviews/[id]/reject` — recusa verificação + audit log
- [ ] 9.5 Criar `POST /api/admin/reviews/[id]/exception` — concede exceção manual + audit log
- [ ] 9.6 Criar `POST /api/admin/reviews/[id]/reveal-cnpj` — revela CNPJ completo + registra em audit log

### 10. Admin — Store de Teste

- [ ] 10.1 Criar RPC `admin_create_test_store(p_user_id, p_admin_id, p_name, p_segment, p_cnpj_normalized, p_razao_social, p_nome_fantasia, p_city, p_state)` na migration
- [ ] 10.2 Criar `POST /api/admin/stores/create-test` — endpoint que chama a RPC
- [ ] 10.3 Store de teste criada com `is_test_store = true`, `verification_status = 'approved'`, sem entitlement automático
- [ ] 10.4 Criação de store de teste registrada em admin_audit_log com metadata
- [ ] 10.5 Lojas de teste identificáveis por badge "TESTE" no admin
- [ ] 10.6 Lojas de teste excluídas de métricas comerciais e relatórios antifraude

### 11. Admin — Páginas Modificadas

- [ ] 11.1 Modificar `src/app/(app)/admin/users/page.tsx`: adicionar coluna `verification_status` + filtro
- [ ] 11.2 Modificar `src/app/(app)/admin/users/[id]/page.tsx`: adicionar card "Verificação Cadastral" com status, dados oficiais, botão "Revelar CNPJ", botão de reprocessar (para DEFER)
- [ ] 11.3 Adicionar link "Revisão" no menu admin apontando para `/admin/reviews`

### 12. Privacidade e Termos

- [ ] 12.1 Confirmar que consulta cadastral externa e cross-check se enquadram na finalidade já documentada na Política de Privacidade v1.1 (legítimo interesse, art. 7, IX, LGPD)
- [ ] 12.2 Opcional: publicar errata ou adendo na política explicitando consulta via BrasilAPI/CNPJá com dados da Receita Federal

## Testes

### 13. Testes — Onda 1 (Lookup + Verificação)

- [ ] 13.1 Criar `src/lib/cnpj/lookup-providers/__tests__/brasil-api.test.ts`: 5+ testes — sucesso, not_found, timeout, rate limit (429), erro 5xx, malformed response
- [ ] 13.2 Criar `src/lib/cnpj/lookup-providers/__tests__/cnpja.test.ts`: 5+ testes — sucesso, not_found, timeout, erro, malformed response
- [ ] 13.3 Criar `src/lib/cnpj/__tests__/verification-service.test.ts`: 8+ testes — cache hit, cache miss → primary sucesso, primary fallback, ambos unavailable → defer, not_found cacheado, not_found → reject, cache expirado → reconsulta, retry 1x
- [ ] 13.4 Criar `src/lib/freemium/__tests__/freemium-risk-service.test.ts`: 10+ testes — approve (todos sinais OK), approve via nome fantasia, reject cnpj_not_found, reject baixada, reject nula, reject root_esgotado, review situacao_suspensa, review nome_divergente, review cidade_divergente, review uf_divergente, defer (officialData null)

### 14. Testes — Onda 2 (Onboarding + Formulário)

- [ ] 14.1 Testes de store route: 8+ testes — approve + grant, review sem grant, reject cnpj_inexistente bloqueia, reject baixado cria sem grant, reject raiz cria sem grant, defer cria sem grant, CNPJ sem dados oficiais no submit tenta resolve server-side
- [ ] 14.2 Testes de formulário: 3+ testes — lookup blur dispara consulta, campos bloqueados após lookup, botões "usar nome fantasia/razão social" funcionam
- [ ] 14.3 Testes do endpoint /api/cnpj/lookup: 5+ testes — resolved retorna dados, not_found retorna status, unavailable retorna status, CNPJ inválido retorna 400, não autenticado retorna 401

### 15. Testes — Onda 3 (Admin)

- [ ] 15.1 Testes de admin reviews: 7+ testes — lista pendentes (REVIEW), lista adiados (DEFER), lista recusados (REJECTED), aprovar concede onboarding, recusar mantém rejected, exceção bypassa elegibilidade, revelar CNPJ audita
- [ ] 15.2 Testes de store de teste: 4+ testes — criar store de teste, badge TESTE visível, excluída de métricas, audit trail
- [ ] 15.3 Testes de admin_audit_log: 2+ testes — ações de approve/reject/reveal registradas corretamente

### 16. Testes — Integração

- [ ] 16.1 Fluxo feliz completo: CNPJ válido → lookup → dados oficiais → approve → grant
- [ ] 16.2 Fluxo review: CNPJ com nome divergente → review → loja criada sem grant → admin aprova → grant
- [ ] 16.3 Fluxo reject inexistente: CNPJ falso → reject → bloqueia criação → mensagem erro
- [ ] 16.4 Fluxo defer: provador indisponível → defer → loja sem grant → reprocessamento
- [ ] 16.5 Fluxo admin exception: CNPJ baixado → reject → admin concede exceção → grant

## Verificação Final

- [ ] 17.1 Executar `npx vitest run src/lib/cnpj/__tests__/` — testes de lookup + verification passando
- [ ] 17.2 Executar `npx vitest run src/lib/freemium/__tests__/` — testes de risk service passando
- [ ] 17.3 Executar `npm run typecheck` — zero erros
- [ ] 17.4 Executar `npm run lint` — zero erros
- [ ] 17.5 Executar `npx vitest run` — novos + testes existentes passando
- [ ] 17.6 Executar `npm run build` — build bem-sucedido
- [ ] 17.7 Verificar: CNPJ não aparece cru em logs, URLs, listagens admin ou responses públicas desnecessárias; no client só aparece no fluxo do próprio usuário autenticado
- [ ] 17.8 Verificar: Root hash continua usando HMAC-SHA256 com pepper server-side
- [ ] 17.9 Verificar: Store de teste não recebe freemium automático
- [ ] 17.10 Verificar: Todas as ações admin registradas em admin_audit_log
