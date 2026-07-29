## Context

A v1.5 está em operação controlada. Dois problemas emergiram na interseção entre onboarding e geração: (1) o Step 2 (logo/cores) é ignorável — usuários criam loja no Step 1 e vão direto para campanhas sem direção visual, e (2) lojas legacy (pré-F32) operam sem CNPJ, razão social ou nome fantasia. O sistema atual verifica apenas existência da loja, clearance legal e saldo — não há completude cadastral nem direção visual como requisito de geração.

**Dependências:** F32 (cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia nas stores), F33 (store_brand_profiles, verification_status), F30 (legal clearance)

## Goals / Non-Goals

**Goals:**
- Criar `getStoreReadiness(storeId)` — função server-side que retorna `{ ready: boolean, missing: MissingItem[] }`
- Critério de readiness: cadastro fiscal mínimo (CNPJ + razão social + nome fantasia) + ao menos um `store_brand_profiles.status = 'synced'`
- Guarda dupla: server component `/campanhas/nova` (redirect) + API `generate-image/route.ts` (412)
- Legado sem cadastro fiscal: redirecionar para `/cadastro/cnpj?returnTo=` com encadeamento para brand profile
- Step 2 renomeado para "Direção Visual" com badge "Necessário" e query param `?required=visual-direction`
- Três caminhos de direção visual (logo upload, VS gerada, text-only) todos convergindo para brand profile synced
- Store type com campos CNPJ tipados (eliminar casts `as unknown as Record<string, unknown>`)
- StoreBillingInfo type e tabela separada para dados de NFSe (não bloqueante)
- Card colapsável de billing no Step 1 com pré-preenchimento via BrasilAPI/CNPJá e botão de confirmação próprio
- Dashboard banner de prontidão com checklist de pendências
- Migration SQL: tabela `store_billing_info` + RPC `check_store_readiness()`
- `upsertStoreBillingInfo()` com verificação de ownership: upsert valida que o `store_id` pertence ao `userId` antes de escrever (mutations via service_role exigem essa checagem explícita)

**Non-Goals:**
- Refatoração do StoreIdentityForm (2035 linhas) — mudanças cirúrgicas apenas
- Dashboard gamificado com score de completude — apenas banner
- Drift como critério de bloqueio — drift é aviso/realinhamento voluntário
- Notificação proativa por email para lojas legacy — ação reativa no momento da geração
- Histórico de alterações de billing info — apenas estado atual
- Validação de IBGE — aceitar string livre
- Inscrição municipal, regime tributário, CNAE como dado de decisão — escopo futuro

## Decisions

### D1 — Store Readiness centralizada no banco (RPC)

`DECIDIDO`

A função de readiness é implementada como RPC PostgreSQL (`check_store_readiness`) em vez de função TypeScript pura. Motivos:
1. Centralização da regra no banco — reuso futuro em admin, diagnósticos, crons e ferramentas internas sem depender do runtime Node.js
2. Consistência — a mesma lógica serve página, API, dashboard e consultas futuras, eliminando risco de versões diferentes da regra

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

A readiness verifica exatamente dois itens, nesta ordem de prioridade:

| Item | Quando falta | Impacto |
|------|-------------|---------|
| Cadastro fiscal mínimo | `cnpj_normalized`, `razao_social` ou `nome_fantasia` ausentes | Bloqueia geração |
| Brand profile | Nenhum `store_brand_profiles` com `status = 'synced'` | Bloqueia geração |

**Fallback de nome_fantasia:** Se o CNPJ consultado não tiver nome fantasia oficial (ex: MEI), o sistema preenche automaticamente `nome_fantasia = razao_social` no cadastro — nunca deixa como null.

**O que NÃO é verificado:** `identity_state`, `logo_status`, `text_only_origin`, assets de logo/VS, drift, dados de billing/NFSe.

### D3 — Guarda dupla: página + API

`DECIDIDO`

```typescript
// Server component (/campanhas/nova):
const readiness = await getStoreReadiness(store.id);
if (!readiness.ready) {
  const firstMissing = readiness.missing[0].item;
  const redirectUrl = firstMissing === "cadastro_fiscal"
    ? "/cadastro/cnpj?returnTo=/campanhas/nova"
    : "/loja?required=visual-direction";
  redirect(redirectUrl);
}

// API route (generate-image/route.ts):
const readiness = await getStoreReadiness(storeId);
if (!readiness.ready) {
  return Response.json({
    error: { message: "Loja não está pronta para gerar campanhas.", reasons, missing },
  }, { status: 412 });
}
```

A guarda da API roda antes de rate limit e saldo check. O guard da página substitui o redirect atual de "store não existe" que já redireciona para `/loja` — readiness só é verificado quando store existe.

### D4 — Prioridade de resolução com redirect encadeado

`DECIDIDO`

Quando múltiplas pendências existem:
1. Cadastro fiscal primeiro (sem ele não há loja formalizada)
2. Brand profile / direção visual depois

O redirect segue essa ordem. Após completar cadastro fiscal, se brand profile ainda estiver ausente, o sistema redireciona para `/loja?required=visual-direction` em vez de voltar ao `returnTo` original.

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

Tabela `store_billing_info` separada de `stores` (relação 1:1) por isolamento de responsabilidade. RLS: `SELECT` para authenticated (owner), mutações via server-side service role (client `supabaseAdmin`), com ownership check obrigatório antes de ler ou escrever via helpers server-side.

**Ownership check obrigatório:** `getStoreBillingInfo()` e `upsertStoreBillingInfo()` recebem `userId` e validam que `store_id` pertence ao usuário antes de ler ou escrever. A verificação consulta `SELECT id FROM stores WHERE id = p_store_id AND user_id = p_user_id` e só prossegue se encontrar a store.

Campos de billing não bloqueiam geração — o card no Step 1 é colapsável com pré-preenchimento via dados do CNPJ consultado e botão de confirmação próprio (`billing_data_confirmed_at`).

### D7 — UX mínima no onboarding (sem refactor)

`DECIDIDO`

Mudanças cirúrgicas no StoreIdentityForm:
- Renomear "Logo e Cores" → "Direção Visual"
- Badge "Necessário" no Step 2 do stepper
- Mensagem pós-Step 1: "Loja salva. Agora configure a direção visual."
- Query param `?required=visual-direction` para abrir direto no Step 2
- Botão no dashboard: "Configurar direção visual"
- Sem alteração na estrutura de 2 steps, layout, rota ou wrapper

### D8 — Dashboard banner de prontidão

`DECIDIDO`

Banner condicional aparece apenas quando `getStoreReadiness()` retorna `ready: false`. Mostra:
- Pendências de readiness em checklist (CNPJ: ❌, direção visual: ❌)
- Cada item pendente é link direto para configuração
- Botão "Configurar agora" aponta para a primeira pendência não resolvida
- Legal clearance e saldo são verificados nos guards de geração, não no banner
- Sem score de completude, sem gamificação

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Lojista legacy bloqueado ao gerar campanha sem entender** | Mensagens claras no redirect + `returnTo` para retornar ao fluxo original após completar cadastro |
| **Loop redirect (sem cadastro fiscal e sem brand profile)** | Após atualizar cadastro, verificar readiness e redirecionar para `/loja?required=visual-direction` se brand profile ausente, não para returnTo |
| **Brand profile falha na inferência (text-only ou análise de logo)** | Step 2 aguarda profile synced. Se falhar, exibe erro com opção de tentar novamente |
| **Nome_fantasia oficial ausente no CNPJ consultado** | Fallback explícito: preencher `nome_fantasia = razao_social` automaticamente, nunca null |
| **Drift detectado mas não bloqueia** | Correto — drift é aviso/realinhamento voluntário em fluxo separado, fora da readiness |
| **Aumento de redirects em /campanhas/nova** | Guarda é validação barata (RPC STABLE). Custo desprezível comparado ao pipeline de geração |
| **Mutation service_role sem ownership check** | `upsertStoreBillingInfo()` recebe `userId` e valida `store_id` pertence ao usuário antes de escrever |
| **Tabela separada store_billing_info adiciona complexidade** | Relação 1:1 clara com índice único em store_id. JOIN simples. Isolamento de responsabilidade vale o custo |
| **Dados de billing pré-preenchidos mas desatualizados** | Usuário pode editar livremente. `billing_data_source` registra origem. Nenhum dado usado sem confirmação explícita |

## Migration Plan

Migration única: `20260729000001_f34_store_readiness.sql`

1. `CREATE TABLE store_billing_info` — billing_id, store_id (FK stores, UNIQUE), billing_email, billing_phone, billing_address_*, billing_data_source, billing_data_last_prefilled_from, billing_data_confirmed_at, created_at, updated_at
2. `ALTER TABLE store_billing_info ENABLE ROW LEVEL SECURITY` — policy SELECT para owner, policy ALL para service_role
3. `CREATE FUNCTION update_store_billing_info_updated_at()` + trigger
4. `CREATE FUNCTION check_store_readiness(p_store_id UUID) RETURNS JSONB` — RPC que verifica cadastro fiscal mínimo + brand profile synced
5. Índices: `idx_store_billing_info_store_id` (UNIQUE)

**Rollback:** Dropar RPC `check_store_readiness`, dropar tabela `store_billing_info`, dropar funções auxiliares.

## Open Questions

Nenhuma. Todas as decisões de arquitetura estão documentadas e alinhadas (D1-D8 no documento de alinhamento da F34).
