---
phase: quick-rag-fiscal-atomicity
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260729000002_fix_cnpj_atomicity.sql
  - src/app/api/store/[id]/route.ts
  - src/components/flow/use-store-form.ts
  - src/app/api/store/[id]/__tests__/route.test.ts
  - src/app/api/store/__tests__/route.test.ts
autonomous: true
---

<objective>
Corrigir atomicidade do cadastro fiscal pós-F34: CNPJ, razão social e nome fantasia devem SEMPRE ser persistidos atomicamente — nunca razão/nome sem CNPJ.

Purpose: Eliminar estado incoerente onde `cnpj_normalized = null` mas `razao_social`/`nome_fantasia` estão preenchidos via PATCH comum.

Output:
- Migration de cleanup + CHECK constraint
- PATCH `/api/store/[id]` bloqueia razao_social/nome_fantasia sem CNPJ
- `use-store-form.ts` roteia CNPJ → update-cnpj (não PATCH)
- Testes de atomicidade, duplicidade e guarda
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/api/store/[id]/route.ts
@src/components/flow/use-store-form.ts
@src/app/api/store/[id]/__tests__/route.test.ts
@src/app/api/store/__tests__/route.test.ts
@src/app/api/store/update-cnpj/route.ts
@src/app/api/store/update-cnpj/__tests__/route.test.ts
@supabase/migrations/20260727000001_freemium_anti_abuso_cnpj.sql
@supabase/migrations/20260729000001_f34_store_readiness.sql
@src/app/(app)/cadastro/cnpj/cnpj-update-form.tsx
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Migration cleanup + CHECK constraint</name>
  <files>supabase/migrations/20260729000002_fix_cnpj_atomicity.sql</files>
  <behavior>
    - Migration deve converter `cnpj_normalized = ''` para NULL
    - Migration deve converter `cnpj_root_hash = ''` onde `cnpj_normalized IS NULL`
    - Deve adicionar CHECK constraint que impede `cnpj_normalized` inválido (não NULL e não 14 dígitos)
    - Deve ser segura para reexecução (idempotente)
  </behavior>
  <action>
    Criar migration em `supabase/migrations/20260729000002_fix_cnpj_atomicity.sql` com:

    1. **UPDATE cleanup** — Converte `cnpj_normalized = ''` para NULL (usando `WHERE cnpj_normalized = ''`). Também zera `cnpj_root_hash = ''` (default) onde `cnpj_normalized IS NULL`, pois sem CNPJ não faz sentido ter root hash. A coluna `cnpj_root_hash` é `NOT NULL DEFAULT ''` então manter string vazia é OK — mas onde `cnpj_normalized IS NULL` e `cnpj_root_hash != ''`, setar para ''.

    2. **CHECK constraint** — Adiciona `CONSTRAINT chk_stores_cnpj_atomic CHECK (
         (cnpj_normalized IS NULL AND cnpj_root_hash = '' AND razao_social IS NULL AND nome_fantasia IS NULL)
         OR
         (cnpj_normalized ~ '^\d{14}$' AND cnpj_root_hash != '')
       )`. Esta constraint garante atomicidade: ou todos os campos fiscais estão vazios, ou CNPJ é válido com root_hash.

    3. **NOTA**: A constraint precisa permitir transição durante operação — o CHECK é aplicado a CADA linha, não é temporal. A condição `cnpj_normalized IS NULL AND ... razao_social IS NULL AND nome_fantasia IS NULL` permite lojas sem CNPJ (caso normal de criação inicial). Mas a constraint permite `cnpj_normalized IS NOT NULL` com razao_social/nome_fantasia NULL? Sim, porque pode levar tempo até o usuário preencher. Mas o problema é o oposto: razao/nome sem CNPJ. A constraint deve permitir ambos nulos (loja nova sem CNPJ ainda) e CNPJ presente com ou sem razao/nome (pode ser preenchido depois). Mas NUNCA razao/nome sem CNPJ. Então a constraint é:

     - `(cnpj_normalized IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL AND cnpj_root_hash = '')` — tudo vazio ok
     - `(cnpj_normalized IS NOT NULL AND cnpj_normalized ~ '^\d{14}$' AND cnpj_root_hash != '')` — CNPJ presente e válido

    4. **Índice único parcial** já existe (`idx_stores_cnpj_normalized WHERE cnpj_normalized IS NOT NULL`) — não recriar.

    5. **Bloco REVERT** no final: DROP CONSTRAINT, mas manter dados corrigidos (operação de limpeza é irreversível por design).

    - Usar `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END; $$` para idempotência na constraint.
  </action>
  <verify>
    <automated>npx vitest run --reporter=verbose src/__tests__/integration/f33-verification-flows.test.ts 2&gt;&amp;1 | tail -20</automated>
  </verify>
  <done>
    Migration criada com cleanup + CHECK constraint. Typecheck passa. Build passa.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: PATCH guard + useStoreForm atomic routing</name>
  <files>
    src/app/api/store/[id]/route.ts,
    src/components/flow/use-store-form.ts,
    src/app/api/store/[id]/__tests__/route.test.ts,
    src/app/api/store/__tests__/route.test.ts
  </files>
  <behavior>
    - PATCH `/api/store/[id]` rejeita razaoSocial/nomeFantasia quando a store não tem `cnpj_normalized` (status 409)
    - `use-store-form.ts` `save()` detecta loja existente sem CNPJ + CNPJ preenchido no form → roteia para `POST /api/store/update-cnpj`
    - Testes existentes de PATCH para razaoSocial/nomeFantasia permanecem verdes para stores com CNPJ
    - Novo teste verifica que PATCH retorna 409 ao tentar razaoSocial sem CNPJ
    - Novo teste verifica que `use-store-form.ts` save chama `/api/store/update-cnpj` quando apropriado
  </behavior>
  <action>
    **Part A — PATCH `/api/store/[id]/route.ts`:**

    Antes dos handlers de `razaoSocial`/`nomeFantasia` (linhas ~156-180), adicionar:

    ```typescript
    // Se razaoSocial ou nomeFantasia foram enviados, verificar se store tem CNPJ
    if (body.razaoSocial !== undefined || body.nomeFantasia !== undefined) {
      const { data: storeCheck } = await supabase
        .from("stores")
        .select("cnpj_normalized")
        .eq("id", id)
        .single();

      if (!storeCheck?.cnpj_normalized) {
        return NextResponse.json(
          {
            error:
              "Razão social e nome fantasia só podem ser alterados após o cadastro do CNPJ. Use /api/store/update-cnpj para cadastrar os dados fiscais.",
          },
          { status: 409 }
        );
      }
    }
    ```

    **IMPORTANTE**: Esta consulta é extra (2 queries em vez de 1). Aceitável porque é rota de formulário (não é chamada em loop/hot-path).

    **Part B — `use-store-form.ts` `save()`:**

    Na função `save()` (linha ~189-260), modificar o bloco de edit mode (storeId existente, ~linhas 221-226):

    Substituir:
    ```
    if (storeId) {
      res = await fetch(`/api/store/${storeId}`, {
        method: "PATCH",
        ...
        body: JSON.stringify(body),
      });
    ```

    Por lógica que verifica se o form tem CNPJ preenchido E a loja atual não tem CNPJ:

    ```typescript
    if (storeId) {
      // Se loja existente SEM CNPJ e formulário tem CNPJ → rotear para update-cnpj
      if (formData.cnpj && !initialStore?.cnpj_normalized) {
        // Usa rota dedicada que persiste atomicamente CNPJ + razao + nome
        res = await fetch("/api/store/update-cnpj", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId,
            cnpjNormalized: formData.cnpj.replace(/\D/g, ""),
            razaoSocial: formData.razaoSocial,
            nomeFantasia: formData.nomeFantasia || formData.razaoSocial,
          }),
        });
      } else {
        // PATCH normal (já tem CNPJ ou não informou CNPJ)
        if (formData.cnpj) {
          body.cnpj = formData.cnpj.replace(/\D/g, "");
        }
        res = await fetch(`/api/store/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
    }
    ```

    **IMPORTANTE**: O `initialStore` não está disponível no hook `useStoreForm` diretamente como prop. Ele é passado como `initialStore?: Store | null` para o hook. Verificar se já tem acesso a ele:

    - `useStoreForm` recebe `{ initialStore }` e usa `initialStore?.cnpj_normalized ?? ""` em `formData.cnpj`
    - Podemos derivar: `const hasExistingCnpj = !!initialStore?.cnpj_normalized;`
    - Como `formData.cnpj` é preenchido de `initialStore.cnpj_normalized`, podemos verificar se o valor atual do form tem CNPJ digitado

    **Detalhe**: O `EMPTY_FORM` tem `cnpj: ""`, e quando `initialStore` existe:
    ```typescript
    cnpj: (initialStore as any).cnpj_normalized ?? "",
    ```

    Então podemos detectar: se `initialStore` existe, `storeId` não é null, `formData.cnpj` não está vazio, e `initialStore.cnpj_normalized` é null/falsy → significa que o usuário digitou CNPJ numa loja que não tem → usar update-cnpj.

    Mas precisamos de acesso ao `initialStore` no callback `save()`. Atualmente `save` depende de `formData, storeId, colorTouched`. Vamos adicionar `initialStore` à closure ou armazenar no estado. Mais simples: armazenar `hasExistingCnpj` como estado derivado no hook.

    Adicionar:
    ```typescript
    const hasExistingCnpj = !!initialStore?.cnpj_normalized;
    ```
    E incluir no callback `save`:
    ```typescript
    const save = useCallback(async (acceptedTerms?: boolean) => {
      ...
      if (storeId) {
        // Se loja não tem CNPJ ainda mas form tem CNPJ digitado → rota dedicada
        const cnpjDigits = formData.cnpj.replace(/\D/g, "");
        if (!hasExistingCnpj && cnpjDigits.length === 14) {
          res = await fetch("/api/store/update-cnpj", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storeId,
              cnpjNormalized: cnpjDigits,
              razaoSocial: formData.razaoSocial,
              nomeFantasia: formData.nomeFantasia || formData.razaoSocial,
            }),
          });
        } else {
          // PATCH normal
          if (formData.cnpj) body.cnpj = formData.cnpj.replace(/\D/g, "");
          ...
          res = await fetch(`/api/store/${storeId}`, { ... });
        }
      }
    }, [formData, storeId, colorTouched, hasExistingCnpj]);
    ```

    **Part C — Ajuste no save de formData.razaoSocial:**

    Atualmente na PATCH, `razaoSocial` é sempre adicionado ao body. Com a rota update-cnpj, ele já está incluso no body do update-cnpj. Para o PATCH normal, manter o comportamento existente mas remover `body.cnpj` (que não era usado de qualquer forma). Simplificar:

    ```typescript
    // Remover os blocos antigos de cnpj/razaoSocial/nomeFantasia do body do PATCH
    // (linhas 212-217 em use-store-form.ts) pois eles serão tratados:
    // - Se não tem CNPJ: rota update-cnpj (acima)
    // - Se tem CNPJ: PATCH normal pode aceitar razaoSocial/nomeFantasia (não CNPJ)
    ```

    Na branch PATCH, manter:
    ```typescript
    if (formData.razaoSocial) body.razaoSocial = formData.razaoSocial;
    const nomeFantasiaFinal = formData.nomeFantasia || formData.razaoSocial;
    if (nomeFantasiaFinal) body.nomeFantasia = nomeFantasiaFinal;
    ```
    Mas **remover** `body.cnpj` da branch PATCH (linha ~212-214: `if (formData.cnpj) { body.cnpj = ... }`) — não é processado pelo PATCH handler e não deve estar lá.

    **Part D — Testes:**

    Em `src/app/api/store/[id]/__tests__/route.test.ts`:

    1. NOVO teste: "rejects razaoSocial when store has no cnpj_normalized"
       - Mock `requireOwnership` retorna store com `cnpj_normalized: null`
       - Mock supabase SELECT chain para retornar `{ cnpj_normalized: null }`
       - Fazer PATCH com `{ razaoSocial: "Razao"}`
       - Verificar status 409 e mensagem de erro

    2. NOVO teste: "allows razaoSocial when store has cnpj_normalized"
       - Mock supabase SELECT chain para retornar `{ cnpj_normalized: "12345678000195" }`
       - Fazer PATCH com `{ razaoSocial: "Razao"}`
       - Verificar status 200 (update permitido)

    3. Manter testes existentes (precisam de ajuste mínimo para passar o guard):
       - O teste "persists razao_social and nome_fantasia" precisa mockar também a SELECT de verificação de CNPJ
       - O mock atual `mockSupabaseChain` só cuida do update. Adicionar mock para a SELECT anterior.

    **Part E — Ajustar mocks dos testes existentes:**

    No `beforeEach`, mockar supabase para retornar store COM cnpj_normalized, assim os testes existentes continuam passando. Os novos testes vão mockar sem cnpj_normalized para testar o guard.

    ```typescript
    // Modificar mockSupabaseChain para suportar encadeamento com select antes de update
    function mockSupabaseChain(supabaseResult: Record<string, unknown>, hasCnpj = true) {
      const mockSingle = vi.fn().mockResolvedValue({ data: supabaseResult, error: null });
      const mockSelect = vi.fn(() => ({ single: mockSingle }));
      const mockEq = vi.fn(() => ({ select: mockSelect }));
      const mockUpdate = vi.fn(() => ({ eq: mockEq }));
      const mockSelectFirst = vi.fn(() => ({ select: mockSelect, eq: mockEq }));
      // ... ajustar para 2 chamadas select diferentes
    }
    ```

    Na verdade, a primeira SELECT é para verificar CNPJ (`stores.select("cnpj_normalized").eq("id", id).single()`), que é chamada ANTES do update. A segunda é o update em si. Precisamos de um mock que lide com duas chamadas de `from("stores")`.

    Abordagem mais simples: usar `mockSupabaseFrom.mockReturnValueOnce(...)` para a primeira (SELECT guard) e `mockSupabaseFrom.mockReturnValueOnce(...)` para a segunda (UPDATE). Ou usar um contador.

    Abordagem prática: mockar usando `.mockImplementation` que alterna comportamento:

    ```typescript
    const mockFrom = vi.fn();
    mockSupabaseFrom.mockImplementation(mockFrom);
    
    function setupMockChain(selectResult: { cnpj_normalized: string | null }, updateResult: Record<string, unknown>) {
      // Primeira chamada: guard SELECT
      const mockSingle1 = vi.fn().mockResolvedValue({ data: selectResult, error: null });
      const mockSelect1 = vi.fn(() => ({ single: mockSingle1 }));
      const mockEq1 = vi.fn(() => ({ select: mockSelect1 }));
      
      // Segunda chamada: UPDATE
      const mockSingle2 = vi.fn().mockResolvedValue({ data: updateResult, error: null });
      const mockSelect2 = vi.fn(() => ({ single: mockSingle2 }));
      const mockEq2 = vi.fn(() => ({ select: mockSelect2 }));
      const mockUpdate = vi.fn(() => ({ eq: mockEq2 }));
      
      mockFrom
        .mockReturnValueOnce({ select: mockSelect1, eq: mockEq1 })  // Guard
        .mockReturnValueOnce({ update: mockUpdate, eq: mockEq2, select: mockSelect2 });  // Update
      
      return { mockUpdate, mockEq2 };
    }
    ```

    Em `src/app/api/store/__tests__/route.test.ts`:

    1. NOVO teste: "POST create store handles CNPJ fields atomically" (se não existir ainda)
    2. Verificar que create route persiste CNPJ atomicamente via RPC

  </action>
  <verify>
    <automated>npx vitest run --reporter=verbose src/app/api/store/\[id\]/__tests__/route.test.ts 2&gt;&amp;1 | tail -20</automated>
  </verify>
  <done>
    PATCH com guard de CNPJ. useStoreForm roteia para update-cnpj quando necessário. Testes existentes + novos passam. Typecheck/lint/build limpos.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→PATCH `/api/store/[id]` | Usuário autenticado envia dados fiscais. Store ownership verificado. |
| client→POST `/api/store/update-cnpj` | Usuário envia CNPJ. Rota dedicada com validação Zod + hash + RPC atômica. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-RAG-01 | Tampering | PATCH `/api/store/[id]` razaoSocial sem CNPJ | mitigate | Validar cnpj_normalized existente antes de permitir (Task 2) |
| T-RAG-02 | Spoofing | Loja sem CNPJ finge ter dados fiscais | mitigate | CHECK constraint no banco impede estado incoerente |
| T-RAG-03 | Data Exposure | cnpj_normalized vazio ('') tratado como dado válido | mitigate | Migration converte ''→NULL + constraint impede | | 
</threat_model>

<verification>
1. `npx vitest run src/app/api/store/\[id\]/__tests__/route.test.ts` — 4+ testes passando
2. `npx vitest run src/app/api/store/__tests__/route.test.ts` — testes existentes passando
3. `npx vitest run src/app/api/store/update-cnpj/__tests__/route.test.ts` — testes existentes passando
4. `npx tsc --noEmit` — sem erros
5. Simular fluxo: loja sem CNPJ → Step 1 com CNPJ → deve chamar update-cnpj não PATCH
</verification>

<success_criteria>
1. Migration converte cnpj_normalized vazio para NULL + adiciona CHECK constraint
2. PATCH retorna 409 se tentar salvar razaoSocial/nomeFantasia sem CNPJ na store
3. useStoreForm roteia CNPJ para /api/store/update-cnpj (nunca PATCH comum)
4. Testes de atomicidade, duplicidade (implícito via update-cnpj) e guarda passam
5. TypeScript, lint, build limpos
</success_criteria>
