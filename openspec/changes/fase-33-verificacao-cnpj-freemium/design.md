## Context

A F32 (concluída em 2026-07-27) estabeleceu a fundação do freemium por raiz de CNPJ: validação de dígitos, hash HMAC-SHA256 da raiz, tabela de entitlements com idempotência, e condicionamento do grant de onboarding + mensal à raiz. A F32 **não consulta APIs externas** — o lojista digita manualmente razão social e nome fantasia, e a validação cadastral se limita a similaridade textual entre o nome informado e os dados digitados (Levenshtein, score informativo).

A F33 avança para a **próxima camada de integridade cadastral**: consultar fontes oficiais (BrasilAPI com fallback CNPJá) para obter dados cadastrais reais, cruzá-los com as informações fornecidas pelo lojista, e decidir se o freemium é liberado automaticamente ou se a loja requer revisão manual.

**Dependências:** F32 (cnpj validation, freemium entitlements, store route, admin), F30 (legal clearance, document versions, admin_audit_log), F24 (credit_transactions)

## Goals / Non-Goals

**Goals:**
- Consulta cadastral externa de CNPJ — BrasilAPI como provedor primário, CNPJá como fallback
- Preenchimento automático com dados oficiais (razão social, nome fantasia bloqueados; endereço pré-preenchido editável)
- Motor de decisão determinístico: approve / review / reject / defer
- Liberação condicional do freemium — apenas se `decision = 'approve'`
- Cache de consulta CNPJ com TTL 24h (tabela `cnpj_lookup_cache`)
- Fila de revisão admin com ações Aprovar/Recusar/Exceção + audit trail
- Store de teste pelo admin com CNPJ fictício (`is_test_store`)
- Mensagens ao usuário específicas por estado/contexto
- Colunas de verificação em `stores`: `verification_status`, `verification_data`, `cnpj_official_data`, `cnpj_lookup_hash`
- CNAE armazenado como sinal fraco (sem decisão automática)
- Tratamento de timeout (5s), rate limit, retry (1x), fallback entre provedores
- CNPJ mascarado na listagem admin, revelação auditada na página de detalhe
- Lojas de teste excluídas de métricas, relatórios e freemium automático

**Non-Goals:**
- CNAE → segmento automático (exige manutenção contínua de mapping; CNAE é armazenado como sinal fraco para consulta futura)
- Logo hash / comparação de logotipos (complexidade visual desnecessária)
- Device fingerprint (camada adicional independente, pode vir depois)
- E-mail corporativo vs gratuito (sinal auxiliar fora do escopo cadastral)
- IA antifraude / scoring comportamental (F33 usa regras determinísticas)
- Bloqueio por IP (sinal auxiliar, não substituto de validação cadastral)
- Organização / conta multiusuário (fora do roadmap)
- Reativação de CNPJ defer após cron (reprocessamento é manual ou via trigger no momento da próxima tentativa)
- Notificação por e-mail de revisão pendente (admin vê na fila; pode ser adicionada depois)
- Suporte a CPF (MEI tem CNPJ; se necessidade surgir, fase futura)

## Decisions

### D1 — Dois status separados: verificação de CNPJ ≠ elegibilidade do freemium

`DECIDIDO`

A loja tem dois conceitos ortogonais que NÃO devem ser confundidos:

```
verification_status (coluna real em stores)
  → controla o estado da verificação cadastral do CNPJ
  valores: unverified | pending | approved | review | rejected | defer

freemium_granted (derivado, NÃO é coluna)
  → existência de freemium_entitlements com benefit_type = 'onboarding'
  → consultado via LEFT JOIN ou subquery (já existe na F32)
```

`verification_status` NÃO é "onboarding completo". Ele controla exclusivamente a elegibilidade dos créditos. Uma loja pode estar `verification_status = approved` sem ter recebido grant (ex: filial de raiz já usada), ou `verification_status = review` com loja funcionando normalmente (apenas sem créditos).

### D2 — Consulta externa: provedor primário + fallback + cache

`DECIDIDO`

```
LookupProvider (interface):
  lookup(cnpj: string): Promise<LookupResult>
  Resultado: { status: 'resolved', data: CnpjLookupData }
           | { status: 'not_found' }
           | { status: 'unavailable' }

Provedores:
  - BrasilApiProvider (primário) — GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}
  - CnpjaProvider (fallback) — GET https://api.cnpja.com.br/companies/{cnpj}

Timeout: 5s por provedor
Retry: 1 tentativa por provedor

Cache:
  - Tabela cnpj_lookup_cache
  - Chave: cnpj_normalized (14 dígitos)
  - TTL: 24 horas (configurável)
  - Cache hit → não consulta API
  - Cache miss → consulta sequencial BrasilAPI → CNPJá → atualiza cache
  - not_found também é cacheado (evita reconsulta de CNPJ inexistente)
  - unavailable NÃO é cacheado (pode ser transitório)
```

Cache é **obrigatório desde a primeira versão**. Sem cache, BrasilAPI/CNPJá viram gargalo e fonte de instabilidade no onboarding.

### D3 — Retorno do lookup: dados oficiais completos

`DECIDIDO`

```typescript
interface CnpjLookupResult {
  cnpj_normalized: string;
  razao_social: string;
  nome_fantasia: string | null;
  situacao_cadastral: string; // "ATIVA" | "SUSPENSA" | "BAIXADA" | "NULA" | etc.
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  data_situacao: string | null;
  data_abertura: string | null;
  porte: string | null; // "ME" | "EPP" | "DEMAIS" | etc.
}
```

### D4 — Cross-check: determinístico, baseado em regras

`DECIDIDO`

O motor de decisão usa regras determinísticas (não ML, não IA). Input e output tipados:

```typescript
interface FreemiumEligibilityInput {
  cnpj: string;
  storeName: string;
  city: string;
  state: string;
  segment: string;
  officialData: CnpjLookupResult | null;
  lookupOutcome: 'resolved' | 'not_found' | 'unavailable';
  userId: string;
  storeId?: string;
  rootHash: string;
}

interface FreemiumEligibilityOutput {
  decision: "approve" | "review" | "reject" | "defer";
  reasons: string[];
  score: number;
  signals: {
    nameSimilarity: number | null;
    cityMatch: boolean | null;
    stateMatch: boolean | null;
    cnpjExists: boolean | null;
    situacaoCadastral: string | null;
    rootEligible: boolean | null;
    cnaeCompatible: boolean | null; // sinal fraco, sempre nulo nesta fase
  };
}
```

**Regras de aprovação (APPROVE):**
- `cnpjExists = true`
- `situacaoCadastral = 'ATIVA'`
- `rootEligible = true`
- `nameSimilarity >= 0.6` (com razão social OU nome fantasia)
- `cityMatch = true` (cidade informada ≈ cidade oficial, ignorando acentos e case)
- `stateMatch = true` (UF informada = UF oficial)

**Regras de rejeição (REJECT):**
- `cnpjExists = false` → **bloqueia criação**
- `situacaoCadastral = 'BAIXADA'` ou `'NULA'` → loja criada sem créditos
- `rootEligible = false` → bloqueia freemium (tratado na F32)

**Regras de revisão (REVIEW):**
- `situacaoCadastral = 'SUSPENSA'` ou demais não-ATIVA
- Divergência de nome, cidade ou UF que não seja rejeição pura

**Regras de adiamento (DEFER):**
- `officialData = null` (API indisponível, timeout, rate limit em ambas)

**Sobreposição admin:** Para CNPJ existente mas rejeitado (baixada, nula, raiz esgotada) ou defer, admin pode conceder créditos via ação "Exceção" na fila de revisão, que usa `benefit_type = 'admin_exception'` e bypassa as regras de elegibilidade. **CNPJ inexistente não pode ser criado pelo onboarding público** — não há dados oficiais para preencher. Para testes, admin usa fluxo específico de criação de store de teste (ver D10).

### D5 — Lookup assíncrono no formulário

`DECIDIDO`

A consulta à API acontece **no evento de blur/validação do campo CNPJ**, após validação local de dígitos. Não no submit do formulário. Isso permite:
1. Feedback imediato ao usuário ("Buscando dados...")
2. Pré-preenchimento antes do usuário preencher o resto
3. Submit usa dados oficiais já resolvidos ou estado DEFER

O **frontend** não dispara consulta externa no submit — ela ocorre no blur. O **backend** não confia no estado vindo do client: se o `verification_service` não encontrar dados em cache ou resolvidos no momento do submit, ele tenta resolver server-side. Se os providers retornarem `not_found`, a criação é bloqueada. Se os providers estiverem indisponíveis (`unavailable`), marca como `defer` e cria a loja sem créditos. A política de resolução é controlada no servidor, não no cliente.

### D6 — CNAE armazenado como sinal fraco

`DECIDIDO`

O CNAE principal é armazenado em `stores.cnpj_official_data` (JSONB) para:
1. Consulta futura pelo admin durante revisão manual
2. Sinal auxiliar em regras futuras de compatibilidade
3. Análise de distribuição de segmentos vs CNAEs reais

**Não** é usado para decisão automática de approve/review/reject na F33.

### D7 — Admin review mínima, mas operacional

`DECIDIDO`

A fila de revisão admin é uma página nova em `/admin/reviews`. Ela cobre REVIEW, DEFER e REJECTED com abas/filtros — permitindo que o admin atue também em lojas com CNPJ baixado/nulo (rejected) ou com consulta falha (defer). **CNPJ inexistente não entra na fila** — bloqueia a criação pública, então não há store para revisar.

```
/admin/reviews
  Abas: Pendentes (REVIEW) | Adiados (DEFER) | Recusados (REJECTED) | Aprovados (APPROVED)
  Cada item:
    - Loja (nome + CNPJ mascarado: **.***.***/0001-**)
    - Usuário (email)
    - Motivos (tags: nome_divergente, cidade_divergente, cnpj_inativo, etc.)
    - Decisão do sistema
    - Dados oficiais + [Revelar CNPJ] [Consultar na Receita]
    - [Aprovar] [Recusar] [Conceder Exceção]
  Paginação simples
  Filtro por motivo de revisão
  Todas as ações registradas em admin_audit_log
```

Três ações de decisão com semântica distinta:
- **Aprovar**: tenta conceder `onboarding` normal (se raiz elegível)
- **Recusar**: mantém rejeitado, sem créditos
- **Exceção**: concede via `admin_exception` (reusa fluxo F32, bypassa elegibilidade)

### D8 — Privacidade e termos

`DECIDIDO`

A Política de Privacidade v1.1 (publicada na F32) já documenta a finalidade "prevenir abuso, fraude e múltiplos cadastros promocionais" com base legal em legítimo interesse (art. 7, IX, LGPD). A F33 deve:
1. **Confirmar** que consulta cadastral externa e cross-check automatizado se enquadram nesta finalidade
2. **Não exige** nova versão de privacidade se o jurídico confirmar o enquadramento
3. **Opcional:** publicar errata ou adendo na política deixando explícito que a consulta é feita via BrasilAPI/CNPJá com dados da Receita Federal
4. A mensagem ao usuário serve como transparência no momento da coleta

### D9 — Mensagens ao usuário

`DECIDIDO`

| Contexto | Mensagem |
|----------|----------|
| **Campo CNPJ (ao digitar)** | "Verificamos os dados do CNPJ para liberar os créditos gratuitos." (tooltip) |
| **Lookup em andamento** | "Consultando dados cadastrais..." (spinner) |
| **Lookup concluído (dados resolvidos)** | "Dados carregados da Receita Federal." (check verde) |
| **Lookup falhou (DEFER)** | "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'." (aviso amarelo) |
| **Submit — APPROVE** | "Loja criada com sucesso! Seus créditos de boas-vindas foram liberados." |
| **Submit — REVIEW** | "Loja criada. Seus créditos de boas-vindas serão liberados após verificação cadastral." |
| **Submit — REJECT (CNPJ inexistente)** | "Não foi possível criar a loja. O CNPJ informado não foi encontrado na Receita Federal. Verifique o número e tente novamente." |
| **Submit — REJECT (CNPJ baixado)** | "Loja criada. Este CNPJ está com situação cadastral baixada/inativa. Não é possível liberar créditos gratuitos para CNPJs inativos." |
| **Submit — REJECT (raiz já usou)** | "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas." (já implementado na F32) |
| **Submit — DEFER** | "Loja criada. Não foi possível verificar os dados cadastrais agora. Você pode tentar novamente em 'Dados da Loja'." |
| **Dashboard (loja em REVIEW)** | "Seus créditos de boas-vindas estão em verificação cadastral." (banner amarelo) |
| **Dashboard (após admin APPROVE)** | "Seus créditos de boas-vindas foram liberados!" (banner verde, one-time, dismissível) |

### D10 — Store de teste (admin)

`DECIDIDO`

Para viabilizar QA, staging e demonstrações sem depender de CNPJ real, o admin pode criar stores de teste com CNPJ fictício:

```
/admin/users/[id]/create-test-store

Admin informa:
  - CNPJ (fictício, 14 dígitos que passam na validação local — não consultado em API externa)
  - Razão social (manual)
  - Nome fantasia (manual, opcional)
  - Nome da loja
  - Segmento

A loja é criada com:
  - is_test_store = true
  - verification_status = 'approved' (bypassa consulta)
  - Sem freemium automático (entitlement não é inserido)
  - Registro em admin_audit_log com metadata de teste
```

**Regras:**
- Store de teste **não substitui** o fluxo público de onboarding
- `grant_monthly_credits` (cron) e `grant_onboarding` devem ignorar `is_test_store = true`
- Admin pode conceder créditos manuais (admin_grant) para viabilizar testes
- `is_test_store` é coluna booleana em `stores`, indexada, default `false`
- Nenhuma store de teste entra em fila de revisão admin
- Store de teste **não pode ser convertida para real** na F33

### D11 — Revelação de CNPJ no admin

`DECIDIDO`

Para que o admin possa revisar casos sem pedir documento ao usuário, o CNPJ completo precisa ser acessível em contexto controlado:

- **Listagens** (`/admin/users`, `/admin/reviews`): CNPJ mascarado `**.***.***/0001-**`
- **Página de detalhe/revisão**: CNPJ mascarado por padrão + botão "Revelar CNPJ" que:
  - Exige permissão admin (já verificada por `requireAdmin()`)
  - Registra em `admin_audit_log`: `action = 'reveal_cnpj', target = store_id`
  - Mostra CNPJ completo (14 dígitos)
  - Mantém visível até navegar para outra página
- Botão "Consultar na Receita": abre BrasilAPI ou CNPJá em nova aba com CNPJ normalizado

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **BrasilAPI fora do ar** | Fallback CNPJá + cache. Se ambos falharem, DEFER (loja criada sem créditos) |
| **Rate limit em ambas APIs** | Cache reduz chamadas repetidas. DEFER com reprocessamento manual |
| **Falso positivo no cross-check** — lojista legítimo com endereço desatualizado na Receita | Approve é tolerante: nome ≥ 0.6, cidade case-insensitive. Divergência vira REVIEW (não bloqueio) |
| **Falso negativo** — lojista com nome de loja muito diferente da razão social | APPROVE aceita nome fantasia também. Se não houver match, vai para REVIEW (não REJECT) |
| **Custo de consulta** (se CNPJá for paga) | Cache reduz chamadas. BrasilAPI é gratuita |
| **Performance do onboarding** — lookup adiciona latência | Lookup é assíncrono no blur, não no submit. Cache reduz latência nas repetições |
| **Admin review vira gargalo** | Regras de APPROVE são tolerantes para minimizar falsos positivos. Se necessário, ajustar thresholds |
| **Loja em DEFER permanente** | Reprocessamento manual via botão "Tentar novamente". Admin pode conceder exceção |
| **CNPJ mudou de situação depois da verificação** | Verificação é snapshot no momento do cadastro. Re-verificação não é automática na F33 |

## Migration Plan

Migration única: `20260728000001_f33_cnpj_verification.sql`

1. ALTER TABLE stores — adiciona colunas: `verification_status` (default 'unverified'), `verification_data` (JSONB), `cnpj_official_data` (JSONB), `cnpj_lookup_hash` (TEXT), `verification_requested_at` (TIMESTAMPTZ), `verification_decided_at` (TIMESTAMPTZ), `verification_reasons` (TEXT[]), `is_test_store` (BOOLEAN default false) + índices parciais + check constraint
2. CREATE TABLE `cnpj_lookup_cache` — colunas: `cnpj_normalized` (PK), `outcome` (resolved/not_found), `result_data` (JSONB), `provider` (TEXT), `created_at`, `expires_at` (TTL 24h) + RLS (service_role only)
3. CREATE OR REPLACE RPC `update_store_verification` — atualiza status + dados de verificação
4. CREATE OR REPLACE RPC `admin_approve_store_verification` — aprova + tenta onboarding normal + audit log
5. CREATE OR REPLACE RPC `admin_reject_store_verification` — recusa + audit log
6. CREATE OR REPLACE RPC `admin_create_test_store` — cria store de teste + audit log
7. Modificar RPC `create_store_with_cnpj` — recebe `verification_status` como parâmetro, condiciona grant à decisão

**Rollback:** Reverter migration `20260728000001`, restaurar RPC `create_store_with_cnpj` original, remover colunas, dropar tabela `cnpj_lookup_cache`.

## Open Questions

Nenhuma. Todas as decisões de arquitetura estão documentadas e alinhadas (D1-D11 no documento de alinhamento da F33).
