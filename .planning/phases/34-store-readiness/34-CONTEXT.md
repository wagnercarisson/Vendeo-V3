# Phase 34: Store Readiness - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Source:** OpenSpec change artifacts (`openspec/changes/fase-34-store-readiness/`)

<domain>
## Phase Boundary

Dois problemas emergiram na operação controlada da v1.5: (1) o Step 2 do onboarding (logo/cores) é ignorável — usuários criam loja no Step 1 e vão direto para campanhas sem direção visual, e (2) lojas legacy (pré-F32) operam sem CNPJ, razão social ou nome fantasia. O problema raiz é a inexistência de um conceito de "loja pronta para gerar campanha" — os guards atuais verificam apenas existência da loja, clearance legal e saldo de créditos, ignorando completude cadastral e direção visual.

**Dependências:** F32 (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia nas stores), F33 (store_brand_profiles, verification_status), F30 (legal clearance)
</domain>

<decisions>
## Implementation Decisions

### D1 — Store Readiness centralizada no banco (RPC)
`DECIDIDO`

A função de readiness é implementada como RPC PostgreSQL (`check_store_readiness`) em vez de função TypeScript pura. Motivos: centralização da regra no banco para reuso futuro em admin, diagnósticos, crons e ferramentas internas sem depender do runtime Node.js. Consistência — a mesma lógica serve página, API, dashboard e consultas futuras.

A função TypeScript `getStoreReadiness()` no servidor faz apenas a chamada ao RPC e mapeia o resultado. Não aplica lógica de negócio própria.

```sql
CREATE OR REPLACE FUNCTION public.check_store_readiness(p_store_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SET search_path = '' AS $$
-- Verifica cadastro fiscal: cnpj_normalized, razao_social, nome_fantasia não nulos
-- Verifica brand profile: EXISTS store_brand_profiles com status = 'synced'
-- Retorna { ready: boolean, missing: [{ item, reason }] }
$$;
```

### D2 — Critério de readiness simplificado (2 itens)
`DECIDIDO`

| Item | Quando falta | Impacto |
|------|-------------|---------|
| Cadastro fiscal mínimo | `cnpj_normalized`, `razao_social` ou `nome_fantasia` ausentes | Bloqueia geração |
| Brand profile | Nenhum `store_brand_profiles` com `status = 'synced'` | Bloqueia geração |

**Fallback de nome_fantasia:** Se o CNPJ consultado não tiver nome fantasia oficial (ex: MEI), o sistema preenche automaticamente `nome_fantasia = razao_social` no cadastro — nunca deixa como null.

**O que NÃO é verificado:** `identity_state`, `logo_status`, `text_only_origin`, assets de logo/VS, drift, dados de billing/NFSe.

### D3 — Guarda dupla: página + API
`DECIDIDO`

Server component (`/campanhas/nova`): se `!ready`, redirect conforme primeira pendência (cadastro_fiscal → `/cadastro/cnpj?returnTo=/campanhas/nova`, brand_profile → `/loja?required=visual-direction`). API route (`generate-image/route.ts`): se `!ready`, retorna 412 com `{ error: { message, reasons, missing } }`. Guarda da API roda antes de rate limit e saldo check.

### D4 — Prioridade de resolução com redirect encadeado
`DECIDIDO`

Quando múltiplas pendências existem: cadastro fiscal primeiro, brand profile depois. O redirect segue essa ordem. Após completar cadastro fiscal, se brand profile ainda estiver ausente, o sistema redireciona para `/loja?required=visual-direction` em vez de voltar ao `returnTo` original.

### D5 — Step 2 com três caminhos, todos para brand profile synced
`DECIDIDO`

| Caminho | O que acontece | Brand profile |
|---------|----------------|---------------|
| Upload logo | Upload → análise → inferência de brand profile | Criado/synced ao final |
| Gerar VS | Geração → aprovação → inferência de brand profile | Criado/synced ao final |
| Text-only | Salvar escolha → inferência de brand profile text-only | Criado/synced ao final |

A tela só libera "Confirmar direção visual" quando o profile estiver synced. `identity_state` e `logo_status` continuam existindo para o pipeline de geração mas não são critérios de readiness.

### D6 — StoreBillingInfo em tabela separada com ownership check
`DECIDIDO`

Tabela `store_billing_info` separada de `stores` (relação 1:1) por isolamento de responsabilidade. RLS: `SELECT` para authenticated (owner), mutações via server-side service_role (client `supabaseAdmin`), com ownership check obrigatório antes de ler ou escrever via helpers server-side.

**Ownership check obrigatório:** `getStoreBillingInfo()` e `upsertStoreBillingInfo()` recebem `userId` e validam que `store_id` pertence ao usuário antes de ler ou escrever. Campos de billing não bloqueiam geração — o card no Step 1 é colapsável com pré-preenchimento via dados do CNPJ consultado e botão de confirmação próprio (`billing_data_confirmed_at`).

### D7 — UX mínima no onboarding (sem refactor)
`DECIDIDO`

Mudanças cirúrgicas no StoreIdentityForm: renomear "Logo e Cores" → "Direção Visual", badge "Necessário" no Step 2 do stepper, mensagem pós-Step 1 alterada, query param `?required=visual-direction` para abrir direto no Step 2, botão no dashboard "Configurar direção visual". Sem alteração na estrutura de 2 steps, layout, rota ou wrapper.

### D8 — Dashboard banner de prontidão
`DECIDIDO`

Banner condicional aparece apenas quando `getStoreReadiness()` retorna `ready: false`. Mostra pendências em checklist com links diretos para configuração. Botão "Configurar agora" aponta para a primeira pendência não resolvida. Legal clearance e saldo são verificados nos guards de geração, não no banner. Sem score de completude, sem gamificação.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Store Readiness Core
- `openspec/changes/fase-34-store-readiness/design.md` — Full architecture decisions D1-D8
- `openspec/changes/fase-34-store-readiness/specs/store-readiness/spec.md` — getStoreReadiness(), RPC check_store_readiness, MissingItem, StoreReadinessResult
- `openspec/changes/fase-34-store-readiness/specs/store-ownership-core/spec.md` — Store type CNPJ fields, cast removals
- `openspec/changes/fase-34-store-readiness/specs/store-billing-info/spec.md` — StoreBillingInfo type, get/upsert/prefill, ownership check
- `openspec/changes/fase-34-store-readiness/tasks.md` — Complete task breakdown (11 sections, ~80 tasks)

### UI and Guards
- `openspec/changes/fase-34-store-readiness/specs/store-identity-ui/spec.md` — Step 2 renaming, badge, billing card, dashboard CTA
- `openspec/changes/fase-34-store-readiness/specs/store-brand-profile/spec.md` — Three visual direction paths converging to brand profile synced
- `openspec/changes/fase-34-store-readiness/specs/campaign-input-ui/spec.md` — Server component guard in /campanhas/nova
- `openspec/changes/fase-34-store-readiness/specs/ai-image-generation/spec.md` — API guard in generate-image/route.ts (412)
- `openspec/changes/fase-34-store-readiness/specs/dashboard-inteligente/spec.md` — Dashboard readiness banner with checklist
- `openspec/changes/fase-34-store-readiness/specs/legacy-store-cnpj-update/spec.md` — Legacy store blocking, redirect chaining, microcopy

### Downstream Dependencies
- `.planning/phases/32-freemium-anti-abuso-cnpj/32-CONTEXT.md` — F32 CNPJ foundation (cnpj_normalized, razao_social, nome_fantasia)
- `.planning/phases/33-verificacao-cnpj-freemium/33-CONTEXT.md` — F33 brand profiles, verification_status
- `.planning/phases/30-legal-foundation/30-CONTEXT.md` — F30 legal clearance
</canonical_refs>

<specifics>
## Specific Ideas

- **Migration única:** `20260729000001_f34_store_readiness.sql` — CREATE TABLE store_billing_info + RPC check_store_readiness + triggers + índices
- **Novo módulo `src/lib/store-readiness.ts`:** getStoreReadiness(), tipos StoreReadinessResult, MissingItem com import "server-only"
- **Novo módulo `src/lib/billing/store-billing-info.ts`:** StoreBillingInfo, getStoreBillingInfo(), upsertStoreBillingInfo(), getPreFillFromCnpj(), StoreWithBillingInfo
- **Store type extendido:** Adicionar campos CNPJ tipados em src/lib/store.ts — eliminar casts `(store as unknown as Record<string, unknown>)`
- **Server component:** src/app/(app)/campanhas/nova/page.tsx — guarda de readiness antes de renderizar
- **API route:** src/app/api/campaign/generate-image/route.ts — guarda 412 antes de rate limit e saldo
- **StoreIdentityForm:** Step 2 renomeado, badge "Necessário", query param suportado, card billing colapsável
- **Dashboard:** Banner de prontidão com checklist, botão "Configurar agora"
- **Fluxo legacy:** Lojas sem cadastro fiscal bloqueadas com redirect encadeado e microcopy específica
</specifics>

<deferred>
## Deferred Ideas

- Refatoração do StoreIdentityForm (2035 linhas) — mudanças cirúrgicas apenas
- Dashboard gamificado com score de completude — apenas banner
- Drift como critério de bloqueio — drift é aviso/realinhamento voluntário
- Notificação proativa por email para lojas legacy — ação reativa no momento da geração
- Histórico de alterações de billing info — apenas estado atual
- Validação de IBGE — aceitar string livre
- Inscrição municipal, regime tributário, CNAE como dado de decisão — escopo futuro
</deferred>

---

*Phase: 34-store-readiness*
*Context gathered: 2026-07-29 via OpenSpec artifacts*
