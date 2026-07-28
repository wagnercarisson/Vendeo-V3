# Phase 33: Verificação CNPJ Freemium - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-33-verificacao-cnpj-freemium/`)

<domain>
## Phase Boundary

A F32 estabeleceu a fundação do freemium por raiz de CNPJ com validação de dígitos, hash HMAC-SHA256, tabela de entitlements e grant condicionado, mas **não consulta APIs externas** — a validação cadastral se limita a similaridade textual entre os nomes informados.

A F33 avança para a **próxima camada de integridade cadastral**: consultar fontes oficiais (BrasilAPI com fallback CNPJá) para obter dados cadastrais reais, cruzá-los com as informações fornecidas pelo lojista, e decidir se o freemium é liberado automaticamente ou se a loja requer revisão manual.

**Dependências:** F32 (cnpj validation, freemium entitlements, store route, admin), F30 (legal clearance, document versions, admin_audit_log), F24 (credit_transactions)
</domain>

<decisions>
## Implementation Decisions

### D1 — Dois status separados: verificação de CNPJ ≠ elegibilidade do freemium
- `verification_status` (coluna real em stores) controla o estado da verificação cadastral: `unverified | pending | approved | review | rejected | defer`
- `freemium_granted` é derivado da existência de `freemium_entitlements` com `benefit_type = 'onboarding'` (já existe na F32)
- `verification_status` NÃO é "onboarding completo" — controla exclusivamente a elegibilidade dos créditos

### D2 — Consulta externa: provedor primário + fallback + cache
- `BrasilApiProvider` (primário) — GET `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
- `CnpjaProvider` (fallback) — GET `https://api.cnpja.com.br/companies/{cnpj}`
- Timeout 5s por provedor, retry 1x, rate limit propaga como `unavailable`
- Tabela `cnpj_lookup_cache` com TTL 24h, chave `cnpj_normalized` (14 dígitos)
- Cache hit → não consulta API. `not_found` é cacheado. `unavailable` NÃO é cacheado

### D3 — Retorno do lookup: dados oficiais completos
- `CnpjLookupData` com razao_social, nome_fantasia, situacao_cadastral, endereço completo, CNAE, data_abertura, porte

### D4 — Cross-check determinístico baseado em regras
- Regras de APPROVE: cnpjExists=true, situacaoCadastral='ATIVA', rootEligible=true, nameSimilarity>=0.6, cityMatch=true, stateMatch=true
- Regras de REJECT: not_found (bloqueia criação), BAIXADA/NULA (cria sem créditos), root esgotado
- Regras de REVIEW: SUSPENSA, divergência de nome/cidade/UF
- Regras de DEFER: API indisponível em ambos provedores
- CNAE armazenado como sinal fraco (não usado na decisão F33)

### D5 — Lookup assíncrono no formulário (onBlur, não no submit)
- Consulta dispara no onBlur do campo CNPJ (após validação local de dígitos)
- Frontend exibe loading "Consultando dados cadastrais..."
- Backend não confia no estado do client — resolve server-side no submit se necessário

### D6 — Store identity form com campos bloqueados
- Razão social: pré-preenchida e bloqueada (read-only)
- Nome fantasia: pré-preenchido e bloqueado (read-only)
- Botões "Usar nome fantasia" / "Usar razão social" para copiar ao nome da loja
- Endereço: pré-preenchido e editável
- Tooltip CNPJ: "Verificamos os dados do CNPJ para liberar os créditos gratuitos."

### D7 — Admin review mínima mas operacional
- `/admin/reviews` com abas: Pendentes (REVIEW) | Adiados (DEFER) | Recusados (REJECTED) | Aprovados (APPROVED)
- Ações: Aprovar (onboarding normal), Recusar (mantém rejected), Exceção (admin_exception bypassa regras)
- CNPJ mascarado `**.***.***/0001-**` na listagem, revelação auditada na página de detalhe
- Todas as ações registradas em `admin_audit_log` (padrão F30/F26)

### D8 — Privacidade e termos
- Política de Privacidade v1.1 já documenta a finalidade (legítimo interesse, art. 7, IX, LGPD)
- Consulta cadastral externa se enquadra na finalidade existente — não exige nova versão
- Mensagens ao usuário servem como transparência no momento da coleta

### D9 — Mensagens ao usuário por estado
- Lookup em andamento: "Consultando dados cadastrais..." (spinner)
- Lookup concluído: "Dados carregados da Receita Federal." (check verde)
- Lookup falhou (DEFER): aviso amarelo
- Submit APPROVE: "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados."
- Submit REVIEW: "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral."
- Submit REJECT (inexistente): bloqueia — "CNPJ não encontrado na Receita Federal."
- Submit REJECT (baixado/inativo): "Este CNPJ está com situação cadastral inativa."
- Submit DEFER: "Não foi possível verificar os dados cadastrais agora."
- Dashboard REVIEW: banner amarelo "Seus créditos de boas-vindas estão em verificação cadastral."
- Dashboard APPROVE: banner verde one-time dismissível

### D10 — Store de teste (admin)
- Admin cria com CNPJ fictício (validação local de dígitos, sem consulta externa)
- `is_test_store = true`, `verification_status = 'approved'` (bypassa consulta)
- Sem freemium automático — nenhum entitlement inserido
- Badge "TESTE" no admin. Excluída de métricas e relatórios
- Não pode ser convertida para store real na F33

### D11 — Revelação de CNPJ auditada no admin
- Listagens: CNPJ mascarado
- Página de detalhe: botão "Revelar CNPJ" registra em admin_audit_log (action='reveal_cnpj')
- Botão "Consultar na Receita": abre BrasilAPI/CNPJá em nova aba

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Fundação F32
- `.planning/phases/32-freemium-anti-abuso-cnpj/32-CONTEXT.md` — Decisões de arquitetura de CNPJ, hash, entitlements, store route
- `.planning/phases/32-freemium-anti-abuso-cnpj/32-01-PLAN.md` — Migration SQL + Core Library (validate, normalize, hash, mask, similarity)
- `.planning/phases/32-freemium-anti-abuso-cnpj/32-02-PLAN.md` — Freemium Core Library + Store Route + RPC

### Fundação F30 (admin_audit_log, legal)
- `.planning/phases/30-legal-foundation/30-CONTEXT.md` — admin_audit_log structure, document versions, legal acceptance patterns

### Créditos (F24)
- `.planning/phases/24-creditos-schema-saldo-transacoes/24-CONTEXT.md` — credit_balances, credit_transactions, grant_credits RPC

### OpenSpec Source
- `openspec/changes/fase-33-verificacao-cnpj-freemium/proposal.md` — Why / What Changes / Impact
- `openspec/changes/fase-33-verificacao-cnpj-freemium/design.md` — Full design decisions D1-D11
- `openspec/changes/fase-33-verificacao-cnpj-freemium/tasks.md` — Complete task breakdown (3 waves + tests)
- `openspec/changes/fase-33-verificacao-cnpj-freemium/specs/` — Per-component specs with scenarios

</canonical_refs>

<specifics>
## Specific Ideas

- **Migration única:** `20260728000001_f33_cnpj_verification.sql` com ALTER TABLE stores, CREATE TABLE cnpj_lookup_cache, RPCs update/admin/store-test
- **6+ RPCs novas/modificadas:** update_store_verification, admin_approve_store_verification, admin_reject_store_verification, admin_create_test_store, admin_exception_store_verification, create_store_with_cnpj modificada
- **Interface `CnpjLookupProvider`** com `lookup(cnpj): Promise<LookupResult>` — três outcomes: resolved/not_found/unavailable
- **`CnpjVerificationService.resolve()`** — orquestra cache → BrasilAPI → CNPJá
- **`FreemiumRiskService.evaluateFreemiumEligibility()`** — motor determinístico com 4 decisões
- **Endpoint `GET /api/cnpj/lookup?cnpj=`** — chamada server-side onBlur
- **Banners dashboard:** REVIEW (amarelo) e APPROVED (verde dismissível)
- **Fila admin:** `/admin/reviews` com abas e ações Aprovar/Recusar/Exceção
- **Store de teste:** `/admin/users/[id]/create-test-store`

</specifics>

<deferred>
## Deferred Ideas

- CNAE → segmento automático (exige manutenção contínua de mapping; armazenado como sinal fraco)
- Logo hash / comparação de logotipos
- Device fingerprint
- E-mail corporativo vs gratuito
- IA antifraude / scoring comportamental (F33 usa regras determinísticas)
- Bloqueio por IP
- Organização / conta multiusuário
- Reativação de CNPJ defer após cron (reprocessamento manual ou via trigger)
- Notificação por e-mail de revisão pendente
- Suporte a CPF (MEI tem CNPJ; fase futura se necessário)

</deferred>

---

*Phase: 33-verificacao-cnpj-freemium*
*Context gathered: 2026-07-28 via OpenSpec artifacts*
