---
phase: quick-29.2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql
  - src/components/credit/balance-card.tsx
  - src/app/api/store/__tests__/route.test.ts
  - src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx
  - openspec/specs/onboarding-grant/spec.md
autonomous: true
requirements: []
user_setup: []

must_haves:
  truths:
    - "Migration nova existe com DROP da assinatura antiga, p_initial_grant_amount INTEGER DEFAULT 10, REVOKE EXECUTE de PUBLIC/anon/authenticated e GRANT EXECUTE TO service_role, sem editar migrations antigas"
    - "Microcopy 'ganhar 5 créditos gratuitos' trocado para '10 créditos gratuitos' no balance-card.tsx"
    - "Testes de store route esperam balance 10 em vez de 5"
    - "Teste de dashboard com has_store_no_campaigns espera '10 créditos' em vez de '5 créditos'"
    - "Spec onboarding-grant reflete contrato 10, parametrização, beta manual sem backfill"
    - "Nenhuma referência viva de onboarding grant como 5 créditos no código modificado"
  artifacts:
    - path: supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql
      provides: "RPC parametrizada com default 10 + REVOKE/GRANT security"
      min_lines: 70
      exports: ["create_store_with_initial_grant"]
    - path: src/components/credit/balance-card.tsx
      provides: "Microcopy atualizada"
      contains: "10 créditos gratuitos"
    - path: src/app/api/store/__tests__/route.test.ts
      provides: "Testes atualizados com balance 10"
      contains: "balance: 10"
    - path: src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx
      provides: "Teste dashboard com onboarding grant 10"
      contains: "10 créditos"
    - path: openspec/specs/onboarding-grant/spec.md
      provides: "Spec atualizada com contrato 10"
      contains: "10 créditos"
  key_links:
    - from: src/app/api/store/route.ts
      to: supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql
      via: "supabase.rpc('create_store_with_initial_grant') — usa default 10 sem alterar caller"
      pattern: "create_store_with_initial_grant"
    - from: src/components/credit/balance-card.tsx
      to: openspec/specs/onboarding-grant/spec.md
      via: "Microcopy '10 créditos gratuitos' reflete spec"
      pattern: "10 créditos gratuitos"
---

<objective>
Alterar o crédito inicial concedido na criação de loja de 5 para 10 créditos, mantendo bônus beta como operação manual via admin existente.

**Purpose:** Ajustar o onboarding grant para 10 créditos com RPC parametrizável, sem editar migrations já aplicadas.
**Output:** Migration nova, microcopy atualizada, testes ajustados, spec refletida.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@openspec/specs/onboarding-grant/spec.md
@supabase/migrations/20260717000002_create_store_with_initial_grant.sql
@supabase/migrations/20260717000003_fix_create_store_with_initial_grant_balance.sql
@supabase/migrations/20260716000001_create_credit_tables.sql
@src/components/credit/balance-card.tsx
@src/app/api/store/__tests__/route.test.ts
@src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx

<interfaces>
**RPC contract (current, unchanged caller):**
`supabase.rpc("create_store_with_initial_grant", { p_name, p_segment, p_user_id, ... })` — chamado sem `p_initial_grant_amount`. A migration nova adiciona o parâmetro com default 10, então o caller não precisa ser alterado.

**BalanceCard no_store microcopy (src/components/credit/balance-card.tsx:46):**
```tsx
Crie sua loja para começar a gerar campanhas e ganhar 5 créditos gratuitos.
```
Trocar 5 → 10.

**Mock pattern (route.test.ts):**
```ts
mockRpc.mockResolvedValueOnce({
  data: { id: 'store-1', name: 'Minha Loja', segment: 'moda-calcados-acessorios', balance: 5 },
  error: null,
});
```
Trocar `balance: 5` → `balance: 10` em todas as ocorrências. Assert `expect(body.balance).toBe(5)` → `toBe(10)`.

**Mock pattern (dashboard-credits.test.tsx:89):**
```ts
mockGetBalance.mockResolvedValue(5);
expect(html).toContain("5 créditos");
```
Trocar mock para 10 e assert para "10 créditos".
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Criar migration V2 — RPC parametrizável com default 10</name>
  <files>
    supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql (NEW)
  </files>
  <action>
    Criar migration SQL com CREATE OR REPLACE FUNCTION `public.create_store_with_initial_grant` idêntica à versão atual (`20260717000003_fix_create_store_with_initial_grant_balance.sql`) com as seguintes modificações:

     1. **REMOVER a assinatura antiga explicitamente** com tipos explícitos antes do CREATE OR REPLACE:
        ```sql
        DROP FUNCTION IF EXISTS public.create_store_with_initial_grant(
          p_name TEXT, p_segment TEXT, p_user_id UUID,
          p_city TEXT, p_state TEXT, p_brand_color TEXT, p_logo_url TEXT,
          p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
          p_short_description TEXT, p_slogan TEXT
        );
        ```
        Motivo: `CREATE OR REPLACE FUNCTION` com novo parâmetro não remove a assinatura antiga de 12 parâmetros — Postgres identifica função por nome + tipos de argumento. Sem o DROP explícito, a assinatura antiga com 5 hardcoded continua existindo e a chamada sem `p_initial_grant_amount` pode cair nela via PostgREST.
      2. Adicionar parâmetro `p_initial_grant_amount INTEGER DEFAULT 10` como último parâmetro posicional.
      3. Substituir o valor hardcoded `5` na chamada a `public.grant_credits(...)` pelo valor parametrizado `p_initial_grant_amount`.
      4. Manter idempotência `'onboarding_' || store_id`.
      5. Manter SECURITY DEFINER, SET search_path = '', mesmo corpo de INSERT store + PERFORM grant + SELECT balance + RETURN jsonb_build_object.
      6. NÃO editar as migrations antigas existentes (`20260717000002_*` e `20260717000003_*`).
      7. Incluir REVERT comment no final (DROP CASCADE remove ambas as assinaturas):
        ```sql
        -- REVERT
        -- DROP FUNCTION IF EXISTS public.create_store_with_initial_grant CASCADE;
        ```
      8. **REVOKE/GRANT security** — Após o CREATE OR REPLACE (a função precisa existir primeiro), adicionar:
        ```sql
        REVOKE EXECUTE ON FUNCTION public.create_store_with_initial_grant(
          p_name TEXT, p_segment TEXT, p_user_id UUID,
          p_city TEXT, p_state TEXT, p_brand_color TEXT, p_logo_url TEXT,
          p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
          p_short_description TEXT, p_slogan TEXT,
          p_initial_grant_amount INTEGER
        ) FROM PUBLIC, anon, authenticated;

        GRANT EXECUTE ON FUNCTION public.create_store_with_initial_grant(
          p_name TEXT, p_segment TEXT, p_user_id UUID,
          p_city TEXT, p_state TEXT, p_brand_color TEXT, p_logo_url TEXT,
          p_subsegment TEXT, p_tone_of_voice TEXT, p_positioning TEXT,
          p_short_description TEXT, p_slogan TEXT,
          p_initial_grant_amount INTEGER
        ) TO service_role;
        ```
        Motivo: a rota usa `supabaseAdmin` (service_role), então o fluxo backend continua funcionando. Clientes anon/authenticated perdem acesso direto à RPC. Ordem SQL deve ser DROP → CREATE → REVOKE/GRANT (REVOKE antes do CREATE falharia porque a nova função ainda não existe).
      9. Nome do arquivo: `20260722000001_create_store_with_initial_grant_v2.sql`.
     10. **Nota operacional:** Após aplicar a migration, pode ser necessário forçar reload de schema do PostgREST no Supabase (Dashboard → API → Schema ou via `NOTIFY pgrst, 'reload schema'`) para que a nova assinatura da RPC seja detectada e a antiga removida do cache.

    A função deve continuar aceitando chamadas sem `p_initial_grant_amount` (default 10 aplicado). O caller em `src/app/api/store/route.ts` não precisa de alterações.
  </action>
  <verify>
    <automated>File exists: Test-Path -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql"</automated>
    <automated>SQL contém "p_initial_grant_amount INTEGER DEFAULT 10": Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "p_initial_grant_amount.*DEFAULT 10"</automated>
    <automated>SQL NÃO contém nenhum "5" solto fora de contexto (verifica arquivo inteiro): Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "\b5\b" | ForEach-Object { "FAIL: hardcoded 5 found at $($_.LineNumber)" }</automated>
    <automated>DROP da assinatura antiga presente: Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "DROP FUNCTION IF EXISTS public.create_store_with_initial_grant\("</automated>
    <automated>REVOKE EXECUTE presente: Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "REVOKE EXECUTE"</automated>
    <automated>GRANT EXECUTE ON FUNCTION presente: Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "GRANT EXECUTE ON FUNCTION public.create_store_with_initial_grant"</automated>
    <automated>TO service_role presente (linha separada): Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "TO service_role"</automated>
    <automated>REVERT section presente: Select-String -LiteralPath "supabase/migrations/20260722000001_create_store_with_initial_grant_v2.sql" -Pattern "DROP FUNCTION IF EXISTS public.create_store_with_initial_grant CASCADE"</automated>
  </verify>
  <done>
    Migration `20260722000001_create_store_with_initial_grant_v2.sql` criada com p_initial_grant_amount DEFAULT 10, sem hardcoded 5, sem editar migrations existentes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Atualizar microcopy no BalanceCard e spec do onboarding grant</name>
  <files>
    src/components/credit/balance-card.tsx (EDIT)
    openspec/specs/onboarding-grant/spec.md (EDIT)
  </files>
  <action>
    **balance-card.tsx** (linha 46):
    Trocar "ganhar 5 créditos gratuitos" por "ganhar 10 créditos gratuitos". Apenas esta linha no estado no_store.

    **onboarding-grant/spec.md**:
    Atualizar TODO o spec para refletir o novo contrato de 10 créditos:

    1. Linha 7: "Concessão automática de 5 créditos" → "Concessão automática de 10 créditos"
    2. Linha 11: "Onboarding grant de 5 créditos" → "Onboarding grant de 10 créditos"
    3. Linha 13: "conceder 5 créditos" → "conceder 10 créditos"
    4. Linha 15: "Criação de loja concede 5 créditos" → "Criação de loja concede 10 créditos"
    5. Linha 18: "5 créditos são concedidos" → "10 créditos são concedidos"
    6. Linha 19: "saldo inicial da loja é 5" → "saldo inicial da loja é 10"
    7. Adicionar seção (ou parágrafo) abaixo do Requirement existente documentando:
       - "A RPC `create_store_with_initial_grant` foi parametrizada em `v2` com `p_initial_grant_amount INTEGER DEFAULT 10`."
       - "Lojas existentes NÃO recebem backfill automático — o grant é apenas no onboarding."
       - "Bônus beta tester é concedido manualmente pelo admin via `CreditGrantForm` → `/api/admin/credits/grant` → `admin_grant_credits`, com motivo recomendado: 'Bônus beta tester - validação externa controlada'."
    8. Manter o Requirement de idempotência e rota POST /api/store intactos (apenas trocar valor).
  </action>
  <verify>
    <automated>Select-String -LiteralPath "src/components/credit/balance-card.tsx" -Pattern "10 créditos gratuitos"</automated>
    <automated>Select-String -LiteralPath "src/components/credit/balance-card.tsx" -Pattern "5 créditos gratuitos" | ForEach-Object { if ($_) { "FAIL: still has 5" } }</automated>
    <automated>Select-String -LiteralPath "openspec/specs/onboarding-grant/spec.md" -Pattern "10 créditos" | Select-Object -First 1</automated>
  </verify>
  <done>
    Microcopy alterada para "10 créditos gratuitos" e spec atualizada com contrato 10, parametrização v2, beta manual documentado.
  </done>
</task>

<task type="auto">
  <name>Task 3: Atualizar testes — route.store e dashboard-credits</name>
  <files>
    src/app/api/store/__tests__/route.test.ts (EDIT)
    src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx (EDIT)
  </files>
  <action>
    **route.test.ts** — Todas as ocorrências de onboarding grant com balance 5:

    1. Linha 32: comentário "grants 5 credits" → "grants 10 credits"
    2. Linha 34: `balance: 5` → `balance: 10`
    3. Linha 51: `expect(body.balance).toBe(5)` → `expect(body.balance).toBe(10)`
    4. Linha 58: `balance: 5` → `balance: 10`
    5. Linha 79: `expect(body1.balance).toBe(5)` → `expect(body1.balance).toBe(10)`

    **dashboard-credits.test.tsx** — Apenas o cenário de "has_store_no_campaigns":

    1. Linha 89: `mockGetBalance.mockResolvedValue(5)` → `mockGetBalance.mockResolvedValue(10)`
    2. Linha 97: `expect(html).toContain("5 créditos")` → `expect(html).toContain("10 créditos")`

    NÃO alterar:
    - `balance-display.test.tsx` — balance=5 é dado genérico para "normal balance (≥3)", não relacionado a onboarding grant.
    - Testes no route.test.ts onde 5 seja dado genérico não relacionado a onboarding grant (não há — todas as ocorrências de 5 são do grant).
  </action>
  <verify>
    <automated>npx vitest run src/app/api/store/__tests__/route.test.ts --reporter=verbose 2>&1 | Select-String -Pattern "PASS|FAIL|✓|✗"</automated>
    <automated>npx vitest run "src/app/(app)/dashboard/__tests__/dashboard-credits.test.tsx" --reporter=verbose 2>&1 | Select-String -Pattern "PASS|FAIL|✓|✗"</automated>
    <automated>npx vitest run src/components/credit/__tests__/balance-display.test.tsx --reporter=verbose 2>&1 | Select-String -Pattern "PASS|FAIL|✓|✗"</automated>
  </verify>
  <done>
    Testes de store route passam com balance 10, teste dashboard-credits com has_store_no_campaigns espera "10 créditos", balance-display test permanece inalterado e passa.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries
| Boundary | Description |
|----------|-------------|
| Migration SQL | Trusted input (committed code). Parameter default change introduces no new injection surface. |

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-29.2-01 | Tampering | Migration SQL | mitigate | p_initial_grant_amount é INTEGER com DEFAULT — sem injeção. Chamada existente no route.ts não expõe o parâmetro ao usuário. REVOKE EXECUTE de PUBLIC/anon/authenticated + GRANT ONLY to service_role na migration impede chamada direta maliciosa à RPC. |
</threat_model>

<verification>
- [ ] Migration V2 criada com DROP da assinatura antiga, p_initial_grant_amount DEFAULT 10, REVOKE/GRANT security, sem hardcoded 5
- [ ] Microcopy balance-card.tsx "10 créditos gratuitos"
- [ ] Spec onboarding-grant reflete contrato 10 + parametrização + beta manual
- [ ] Testes store route passam (balanço 10)
- [ ] Testes dashboard-credits passam ("10 créditos")
- [ ] Testes balance-display passam (inalterados)
- [ ] typecheck e lint limpos: `npm run typecheck && npm run lint`
</verification>

<success_criteria>
- Migration `20260722000001_create_store_with_initial_grant_v2.sql` criada com:
  - DROP da assinatura antiga de 12 parâmetros
  - p_initial_grant_amount INTEGER DEFAULT 10
  - REVOKE EXECUTE FROM PUBLIC, anon, authenticated
  - GRANT EXECUTE TO service_role
  - Chamada grant_credits usando p_initial_grant_amount (sem 5 hardcoded)
- Microcopy e spec atualizados para 10 créditos
- 3 suites de teste passando (route.store, dashboard-credits, balance-display)
- Nenhuma migration antiga editada
- Nenhuma referência viva de onboarding grant como 5 créditos nos arquivos modificados
</success_criteria>

<output>
`.planning/quick/260722-jwr-fase-29-2-onboarding-grant-10-cr-ditos-a/260722-jwr-SUMMARY.md`
</output>
