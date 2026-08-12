---
phase: quick-260808-rqw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260808010000_create_access_requests.sql
  - src/app/api/access-requests/route.ts
  - src/app/api/access-requests/__tests__/route.test.ts
  - src/app/page.tsx
  - src/components/landing/access-request-form.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/(auth)/signup/signup-form.tsx (deletar)
  - src/app/(auth)/login/login-form.tsx
  - next.config.ts
  - src/__tests__/next.config.test.ts
  - src/__tests__/auth/login-form.test.tsx
  - src/__tests__/auth/signup-form.test.tsx (substituir por signup-page.test.tsx)
  - src/__tests__/app/landing-page.test.tsx
  - src/app/(app)/admin/access-requests/page.tsx
  - src/app/(app)/admin/access-requests/__tests__/page.test.tsx
  - src/components/admin/access-request-actions.tsx
  - src/app/api/admin/access-requests/[id]/route.ts
  - src/app/api/admin/access-requests/__tests__/route.test.ts
  - src/lib/admin/labels.ts
  - src/app/(app)/admin/layout.tsx
  - .planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md
autonomous: true
requirements: [ACC-01, ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, ACC-07, ACC-08]
must_haves:
  truths:
    - "Visitante acessa / e vê landing pública, sem redirect para /dashboard"
    - "Visitante envia solicitação de acesso e recebe confirmação de sucesso"
    - "Email duplicado (pending/approved) não cria segundo registro"
    - "Visitante não consegue criar conta aberta pelo fluxo visual de /signup"
    - "Usuário existente entra por /login; link de login não aponta mais para criar conta"
    - "Usuário existente que loga sem redirect cai em /dashboard (não na landing)"
    - "Usuário autenticado que acessa /login ou /signup continua sendo redirecionado para /dashboard"
    - "Admin vê solicitações pendentes e pode aprovar/recusar com trilha em admin_audit_log"
  artifacts:
    - path: "supabase/migrations/20260808010000_create_access_requests.sql"
      provides: "Tabela access_requests (status pending|approved|rejected, source, review fields) + RLS/GRANTs service_role + índice único parcial lower(email) anti-duplicidade + RPC atômico admin_review_access_request (status + admin_audit_log na mesma transação) + extensão dos CHECKs de admin_audit_log"
      contains: "CREATE TABLE IF NOT EXISTS public.access_requests"
    - path: "src/app/api/access-requests/route.ts"
      provides: "POST público com validação zod, anti-duplicidade e resposta anti-enumeração idêntica"
      exports: ["POST"]
    - path: "src/app/page.tsx"
      provides: "Landing pública (hero, CTA 'Solicitar acesso free', CTA secundário 'Entrar', formulário)"
      contains: "access-request-form"
    - path: "src/app/(auth)/signup/page.tsx"
      provides: "Tela beta fechado com instrução de solicitar acesso (sem cadastro aberto)"
    - path: "src/app/(app)/admin/access-requests/page.tsx"
      provides: "Listagem admin de solicitações com filtro de status e ações de aprovação/recusa"
      contains: "requireAdmin"
    - path: "src/app/api/admin/access-requests/[id]/route.ts"
      provides: "POST admin que muda status via RPC atômico admin_review_access_request (status + admin_audit_log na mesma transação)"
      exports: ["POST"]
  key_links:
    - from: "src/components/landing/access-request-form.tsx"
      to: "POST /api/access-requests"
      via: "fetch POST com JSON"
      pattern: "fetch\\(.*api/access-requests"
    - from: "src/components/admin/access-request-actions.tsx"
      to: "POST /api/admin/access-requests/[id]"
      via: "fetch POST com action approve|reject"
      pattern: "api/admin/access-requests/"
    - from: "src/app/api/admin/access-requests/[id]/route.ts"
      to: "public.admin_review_access_request"
      via: "supabaseAdmin.rpc com action approve|reject — atualiza status e insere admin_audit_log na mesma transação"
      pattern: "admin_review_access_request"
---

<objective>
Substituir a raiz atual do Vendeo por uma landing pública de beta fechado, mantendo o app protegido e preparando o caminho para migrar depois de beta.vendeo.tech para vendeo.tech.

**Purpose:** Visitantes interessados chegam a uma landing profissional, solicitam acesso free (persistido em `access_requests`), usuários já liberados continuam entrando por `/login`, o cadastro público em `/signup` é neutralizado no fluxo visual, e o admin ganha visibilidade mínima das solicitações com trilha de auditoria. O fechamento real do Supabase Auth (desabilitar signup ou allowlist/hook) fica documentado como operação manual.

**Output:**
- Migration `20260808010000_create_access_requests.sql` (tabela + RLS/GRANTs + índice anti-duplicidade `lower(email)` + RPC atômico `admin_review_access_request` + extensão dos CHECKs do `admin_audit_log`)
- `POST /api/access-requests` público (zod + anti-duplicidade + anti-enumeração)
- Landing `/` (server component + client form `access-request-form.tsx`)
- `/signup` → tela beta fechado; link "Criar conta" do login → "Solicitar acesso free"
- Remoção do redirect 301 `/` → `/dashboard` em `next.config.ts`
- `/admin/access-requests` protegido por `requireAdmin` com aprovação/recusa via RPC atômico (status + audit log na mesma transação)
- Doc `SUPABASE-CLOSED-BETA.md` com o ajuste operacional real (desabilitar signup / allowlist / hook)

**Não escopo:** PWA, migração Vercel/domínio, remoção da V1, card de créditos, envio real de convite por email (apenas mudança de status + doc de operação manual).
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/app/page.tsx
@src/middleware.ts
@src/app/(auth)/signup/page.tsx
@src/app/(auth)/login/login-form.tsx
@src/app/(app)/admin/layout.tsx
@src/lib/admin/require-admin.ts
@supabase/migrations/20260718000001_create_admin_tables.sql
@supabase/migrations/20260728000002_fix_f33_audit_log.sql
@src/lib/auth/api-handler.ts
@src/lib/auth/csrf.ts
@next.config.ts
@src/lib/admin/labels.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — Migration access_requests + POST /api/access-requests</name>
  <files>
    - Create: supabase/migrations/20260808010000_create_access_requests.sql
    - Create: src/app/api/access-requests/route.ts
    - Create: src/app/api/access-requests/__tests__/route.test.ts
  </files>
  <action>
    **Migration `supabase/migrations/20260808010000_create_access_requests.sql`** (seguir padrão de `20260723000002_create_privacy_acknowledgements.sql` + `20260728000002_fix_f33_audit_log.sql`):

    1. `CREATE TABLE IF NOT EXISTS public.access_requests`:
       - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
       - `email TEXT NOT NULL`
       - `name TEXT`, `store_name TEXT`, `segment TEXT`, `whatsapp TEXT` (todos nullable)
       - `status TEXT NOT NULL DEFAULT 'pending'` com `CHECK (status IN ('pending','approved','rejected'))`
       - `source TEXT NOT NULL DEFAULT 'landing'`
       - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
       - `reviewed_at TIMESTAMPTZ`, `reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL`, `notes TEXT` (nullable)
    2. `ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;` + policy `FOR ALL TO service_role USING (true) WITH CHECK (true)` (não conceder a anon/authenticated — escrita só via `supabaseAdmin` server-side). **GRANTs explícitos** (padrão `20260723000008_grant_service_role_on_legal_tables.sql`): `GRANT SELECT, INSERT, UPDATE ON TABLE public.access_requests TO service_role;`
    3. Índices: `idx_access_requests_status` em `(status, created_at DESC)` e **índice único parcial anti-duplicidade com `lower(email)`** (blinda inserções manuais/admin com case variado): `CREATE UNIQUE INDEX IF NOT EXISTS uq_access_requests_email_active ON public.access_requests (lower(email)) WHERE status IN ('pending','approved');` (permite re-solicitação após rejected).
    4. **RPC atômico `public.admin_review_access_request(p_request_id UUID, p_action TEXT, p_actor_id UUID, p_notes TEXT DEFAULT NULL)`** — padrão `admin_approve_store_verification` (`LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = ''`, `RETURNS JSONB`). Atualiza status + insere `admin_audit_log` **na mesma transação** (auditoria atômica: se algo falhar, nada é aplicado):
       - Valida `p_action IN ('approve','reject')` (senão `RAISE EXCEPTION 'invalid_action'`).
       - `SELECT status, email INTO ... FROM public.access_requests WHERE id = p_request_id; IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found';` (→ API mapeia para 404).
       - Guarda de re-revisão: se `status <> 'pending'` → `RAISE EXCEPTION 'already_reviewed';`.
       - `UPDATE public.access_requests SET status = 'approved'|'rejected', reviewed_at = now(), reviewed_by = p_actor_id, notes = COALESCE(p_notes, notes) WHERE id = p_request_id;`
       - `INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, metadata) VALUES (p_actor_id, 'access_request_approve'|'access_request_reject', 'access_request', p_request_id, COALESCE(p_notes, 'Aprovado via admin'|'Recusado via admin'), jsonb_build_object('email', v_email, 'action', p_action));`
       - Retorna `jsonb_build_object('success', true, 'status', ..., 'email', v_email)`.
       - `GRANT EXECUTE ON FUNCTION public.admin_review_access_request(UUID, TEXT, UUID, TEXT) TO service_role;`
    5. **Estender CHECKs do `admin_audit_log`** (padrão F33): `DROP CONSTRAINT IF EXISTS admin_audit_log_action_check` + `ADD CONSTRAINT admin_audit_log_action_check CHECK (action IN (... lista atual de `20260728000002` ... , 'access_request_approve', 'access_request_reject'))` e idem para `admin_audit_log_target_type_check` incluindo `'access_request'`.
    6. Comentar bloco REVERT no fim (tabela, índices, RPC, policy, grants, CHECKs). Observação no topo: escrita apenas via API/`supabaseAdmin` (service_role); nenhuma RLS para anon.
    7. **Timestamp no merge:** confirmar que `20260808010000` não colide com migrations de outras branches (ex.: F38.1 = `20260807000001_f38_create_credit_operation_costs.sql` já mergeada). Se houver conflito, renumerar para timestamp posterior à última migration mergeada antes de submeter.

    **Rota `src/app/api/access-requests/route.ts`** (público, sem requireUser; padrão de `apiHandler` + `requireSameOrigin`):
    - `export const POST = apiHandler(async (request: NextRequest) => { requireSameOrigin(request); ... })`
    - Zod inline: `AccessRequestSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), name: z.string().trim().max(100).optional(), store_name: z.string().trim().max(100).optional(), segment: z.string().trim().max(50).optional(), whatsapp: z.string().trim().max(20).optional() })`. `safeParse` → 400 genérico `{ error: "Dados inválidos" }` (sem detalhar campo — anti-enumeração).
    - Anti-duplicidade: `supabaseAdmin.from("access_requests").select("id").eq("email", parsed.data.email).in("status", ["pending","approved"]).maybeSingle()`; se existir → **retorna `{ ok: true }` status 200 sem inserir** (resposta idêntica ao sucesso — não revela existência).
    - Insert via `supabaseAdmin.from("access_requests").insert({ email, name, store_name, segment, whatsapp, source: "landing" })`. Em erro → `{ error: "Erro ao registrar solicitação" }` 500.
    - Sucesso → `NextResponse.json({ ok: true }, { status: 200 })` (mesmo corpo/status do caso duplicado).
    - Não chamar `requireSameOrigin` antes de parse — ordem: origin → parse → dedupe → insert.
  </action>
  <verify>
    <automated>npx vitest run src/app/api/access-requests/__tests__/route.test.ts -t "access-requests"</automated>
  </verify>
  <done>
    Migration criada com tabela + RLS + GRANTs service_role + índice único parcial lower(email) + RPC atômico admin_review_access_request + CHECKs estendidos (action: access_request_approve/reject; target_type: access_request). POST público retorna `{ ok: true }` 200 para novo e para duplicado; 400 genérico para inválido; 500 em falha de DB; 403 sem Origin correto. Testes verdes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Frontend — Landing /, signup fechado, login link, remover redirect 301</name>
  <files>
    - Edit: src/app/page.tsx
    - Create: src/components/landing/access-request-form.tsx
    - Edit: src/app/(auth)/signup/page.tsx
    - Delete: src/app/(auth)/signup/signup-form.tsx
    - Edit: src/app/(auth)/login/login-form.tsx
    - Edit: next.config.ts
    - Edit: src/__tests__/next.config.test.ts
    - Edit: src/__tests__/auth/login-form.test.tsx
    - Delete: src/__tests__/auth/signup-form.test.tsx
    - Create: src/__tests__/auth/signup-page.test.tsx
    - Create: src/__tests__/app/landing-page.test.tsx
  </files>
  <action>
    **`src/app/page.tsx`** — substituir o redirect por landing server component:
    - Exportar `metadata` com `title: "Vendeo — Campanhas profissionais para sua loja"` e description de beta fechado.
    - Estrutura sobria profissional (tokens existentes: `bg-bg-deep`, `font-heading` Poppins, `font-body` Open Sans, `accent-green` como CTA primário — padrão visual do dashboard/admin): header discreto com wordmark "Vendeo" e link "Entrar" → `/login`; hero com headline curta (ex.: "Campanhas profissionais para lojas físicas") + sublinha de beta fechado ("Acesso liberado por convite — solicite seu acesso"); seção de formulário; rodapé com links `/termos`, `/privacidade`, `/uso-aceitavel` e "/login".
    - CTA primário visível "Solicitar acesso free" (âncora até o formulário) + CTA secundário "Entrar" (link `/login`).
    - Renderizar `<AccessRequestForm />` (client) na seção do formulário.

    **`src/components/landing/access-request-form.tsx`** — client component ("use client"):
    - Campos: Email (obrigatório, `type="email"`), Nome da loja, Segmento (select com os 13 valores de `20260611000001_update_stores_segment_check.sql` + opção "Prefiro não informar" vazia), WhatsApp (opcional). Usar `Input` de `@/components/ui/input` e `Button` de `@/components/ui/button` (variante primary = accent-green).
    - Submit → `fetch("/api/access-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...}) })`. Sucesso (res.ok) → estado de sucesso: painel `role="status"` "Recebemos sua solicitação. A liberação é por convite — avisaremos por email." (não distinguir duplicado — anti-enumeração). Erro → mensagem inline de erro, sem redirect.
    - Estados: idle | submitting | success | error. Botão desabilitado durante submit com Loader2.
    - Não usar `requireSameOrigin` no client — apenas POST same-origin normal.

    **`src/app/(auth)/signup/page.tsx`** — substituir por server component estático de beta fechado:
    - Sem client form, sem `supabase.auth.signUp`. Título "Beta fechado", texto: "O Vendeo está em beta fechado. Para participar, solicite seu acesso free." CTA primário link `/` ("Solicitar acesso free") e secundário link `/login` ("Já tenho acesso — Entrar").
    - **Deletar `signup-form.tsx`** (fica sem referência).

    **`src/app/(auth)/login/login-form.tsx`**:
    - **Bug pós-login** (`login-form.tsx:39`): `router.replace(redirect || "/")` → **`router.replace(redirect || "/dashboard")`** — usuário existente que loga sem `redirect` cai no app, não na landing. (Middleware `GUEST_ONLY_ROUTES` já manda autenticados de `/login` → `/dashboard`, então o fluxo visual de login para autenticado nunca passa pela landing.)
    - No bloco final (`login-form.tsx:108-113`): trocar "Não tem uma conta? **Criar conta**" (href `/signup`) por "Ainda não tem acesso? **Solicitar acesso free**" com `href="/"`.

    **`next.config.ts`** — remover a entrada `{ source: "/", destination: "/dashboard", statusCode: 301 }` (mantendo as outras 4).

    **Testes:**
    - `next.config.test.ts`: "has 5 redirect entries" → 4; remover o teste "redirects / to /dashboard".
    - `login-form.test.tsx`: o teste "includes link to /signup" vira "includes link to request access": `getByRole("link", { name: "Solicitar acesso free" })` com `href === "/"`. Ajustar/adicionar o caso de sucesso do submit para garantir `router.replace("/dashboard")` quando `redirect` é vazio (default pós-login — bug crítico) e `router.replace(redirect)` mantém o valor quando informado.
    - **Deletar `signup-form.test.tsx`** e criar `src/__tests__/auth/signup-page.test.tsx` (jsdom): renderiza título "Beta fechado", link "Solicitar acesso free" → `/`, link "Entrar" → `/login`, e NÃO contém formulário com "Criar conta" nem input de senha.
    - Criar `src/__tests__/app/landing-page.test.tsx` (jsdom): renderiza `<Home/>` (server component renderiza o form client em HTML inicial) e verifica hero, CTA "Solicitar acesso free", link "Entrar" → `/login`, e a presença do formulário (input email). Mock apenas se necessário (o page.tsx não deve chamar supabase — manter estático).
  </action>
  <verify>
    <automated>npx vitest run src/__tests__/app/landing-page.test.tsx src/__tests__/auth/signup-page.test.tsx src/__tests__/auth/login-form.test.tsx src/__tests__/next.config.test.ts</automated>
  </verify>
  <done>
    `/` renderiza landing sem redirect (verificado por teste); CTA "Solicitar acesso free" e "Entrar" presentes; `/signup` mostra beta fechado sem cadastro; login aponta "Solicitar acesso free"; redirect 301 `/` removido com teste atualizado; suíte de testes da task verde.
  </done>
</task>

<task type="auto">
  <name>Task 3: Admin — /admin/access-requests + API de status + audit log + labels + docs</name>
  <files>
    - Create: src/app/api/admin/access-requests/[id]/route.ts
    - Create: src/components/admin/access-request-actions.tsx
    - Create: src/app/(app)/admin/access-requests/page.tsx
    - Create: src/app/api/admin/access-requests/__tests__/route.test.ts
    - Create: src/app/(app)/admin/access-requests/__tests__/page.test.tsx
    - Edit: src/lib/admin/labels.ts
    - Edit: src/app/(app)/admin/layout.tsx
    - Create: .planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md
  </files>
  <action>
    **API `src/app/api/admin/access-requests/[id]/route.ts`** (padrão de `reviews/[id]/approve`):
    - `export const POST = apiHandler(async (request: NextRequest, { params }) => { const admin = await requireAdmin(); requireSameOrigin(request); ... })`
    - `const { id } = await params;` — zod inline `{ action: z.enum(["approve","reject"]), notes: z.string().trim().max(500).optional() }` (400 em inválido).
    - **Chamar o RPC atômico em vez de UPDATE + INSERT separados** (auditoria atômica — se falhar, nada é aplicado):
      `const { data, error } = await supabaseAdmin.rpc("admin_review_access_request", { p_request_id: id, p_action: action, p_actor_id: admin.userId, p_notes: notes ?? null })`.
    - Mapeamento de erro: mensagem contendo `request_not_found` ou `already_reviewed` (vinda do `RAISE EXCEPTION` no RPC) → 404 `{ error: "Solicitação não encontrada ou já revisada" }`; qualquer outro erro → 500 `{ error: "Erro ao revisar solicitação" }` + `console.error`.
    - Retorno: `{ success: true, status: action === "approve" ? "approved" : "rejected" }`.
    - **Nota:** o insert em `admin_audit_log` acontece dentro do RPC na mesma transação — a rota NÃO faz insert direto em `admin_audit_log`.

    **`src/components/admin/access-request-actions.tsx`** — client component espelhando `review-actions.tsx`:
    - Props `{ requestId: string; status: string }`. Botões "Aprovar" e "Recusar" (text-accent-green / text-accent-red), desabilitados quando `status !== "pending"`. `fetch("/api/admin/access-requests/{id}", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action }) })` → `router.refresh()` em ok; erro inline em failure.

    **Página `src/app/(app)/admin/access-requests/page.tsx`** — server component (padrão `reviews/page.tsx`):
    - `await requireAdmin();` no topo.
    - Tabs por status via searchParams `?tab=pending|approved|rejected` (default `pending`), `page` com paginação (range, 20/página, `Pagination`-style links como em `audit-log/page.tsx`).
    - Query `supabaseAdmin.from("access_requests").select("*", { count: "exact" }).eq("status", tab).order("created_at", { ascending: false }).range(...)`.
    - Tabela: Email, Nome, Loja, Segmento, WhatsApp, Fonte, Criado em (`formatDateTimeBR`), Status (Badge colorido: pending amber / approved green / rejected red) e coluna Ações com `<AccessRequestActions requestId status />`.
    - Empty state (`EmptyState`) quando não houver registros. Erro de query → `<div className="text-destructive">Erro ao carregar solicitações: {error.message}</div>`.

    **Labels `src/lib/admin/labels.ts`**: adicionar em `AUDIT_ACTION_LABELS`: `access_request_approve: "Aprovar Solicitação de Acesso"`, `access_request_reject: "Recusar Solicitação de Acesso"`; em `TARGET_TYPE_LABELS`: `access_request: "Solicitação de Acesso"`.

    **Admin layout `src/app/(app)/admin/layout.tsx`**: adicionar nav link `<Link href="/admin/access-requests">Solicitações de acesso</Link>` (após "Revisão").

    **Doc `SUPABASE-CLOSED-BETA.md`** (na pasta da quick): explicar que a neutralização em `/signup` é visual/rotas e que o **fechamento real** exige configuração no Supabase Dashboard: (a) `Authentication → Sign In / Up → Allow new users to sign up` desabilitado, OU (b) Before User Created Hook (Edge Function allowlist de emails liberados) — com passos concretos, nota de que `access_requests` é a fonte de aprovações, e fluxo manual de convite (criar usuário via admin quando liberar).

    **Testes:**
    - `route.test.ts` (padrão `users.test.ts`): mock `requireAdmin` (+`apiHandler`), mock `supabaseAdmin.rpc` (vi.mock do módulo), mock `requireSameOrigin`. Casos: approve chama `admin_review_access_request` com `p_action: "approve"` e `p_actor_id` do admin, retorna `{success:true}`; reject idem com `"reject"`; erro `request_not_found` → 404; erro genérico do RPC → 500; 400 com action inválida (antes de chamar RPC); sem `requireAdmin` → 403. Garantir que a rota NÃO faz insert direto em `admin_audit_log` (auditoria só via RPC).
    - `page.test.tsx` (padrão `operation-costs/__tests__/page.test.tsx`, `renderToString`): `requireAdmin` rejeita → "Acesso negado"; com data mock → renderiza emails, status e botões de ação; tab default pending.
  </action>
  <verify>
    <automated>npx vitest run src/app/api/admin/access-requests src/app/(app)/admin/access-requests/__tests__/page.test.tsx</automated>
  </verify>
  <done>
    Admin lista solicitações por status com paginação; aprovar/recusar via RPC atômico `admin_review_access_request` (status + reviewed_by/reviewed_at + `admin_audit_log` na mesma transação); labels e nav atualizados; doc SUPABASE-CLOSED-BETA.md escrito; testes verdes.
  </done>
</task>

</tasks>

<verification>
```bash
npx tsc -p tsconfig.typecheck.json --noEmit
npm run lint
npx vitest run
npm run build
```
</verification>

<success_criteria>
- Visitante acessa `/` e vê landing (sem redirect para dashboard)
- Visitante envia solicitação e recebe confirmação; email duplicado não cria spam de registros
- Visitante não cria conta aberta pelo fluxo visual de `/signup`
- Usuário existente entra por `/login` e é direcionado a `/dashboard` (default pós-login sem `redirect` — não cai na landing); autenticado em `/login` ou `/signup` vai para `/dashboard` (middleware inalterado)
- Admin vê solicitações pendentes em `/admin/access-requests` e muda status com trilha em `admin_audit_log`
- Typecheck, lint, testes e build passam
- `SUPABASE-CLOSED-BETA.md` documenta o fechamento real do Supabase Auth (desabilitar signup / allowlist / hook)
</success_criteria>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| visitante → POST /api/access-requests | input não autenticado, público na internet |
| admin browser → POST /api/admin/access-requests/[id] | sessão admin com mutação de status |
| supabaseAdmin (server) → access_requests | escrita/leitura via service role apenas |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260808-01 | Spoofing | POST /api/access-requests | mitigate | zod strict (email válido, max lengths, trim/lowercase); sem campos derivados do client |
| T-260808-02 | Information Disclosure | POST /api/access-requests | mitigate | resposta idêntica `{ok:true}` 200 para novo e duplicado (anti-enumeração); 400 genérico sem detalhe de campo |
| T-260808-03 | Repudiation | admin status mutation | mitigate | RPC `admin_review_access_request` atualiza status + insere `admin_audit_log` (actor_id, action, target_type, target_id, reason, metadata) na MESMA transação (atômico — sem mutação sem trilha); tabela append-only por trigger |
| T-260808-04 | Tampering | POST /api/access-requests, admin routes | mitigate | `requireSameOrigin` (csrf.ts) em ambas as rotas de mutação |
| T-260808-05 | Elevation of Privilege | /admin/access-requests | mitigate | `requireAdmin()` (admin_users) na página e na API; page fora do alcance de non-admin |
| T-260808-06 | Tampering | access_requests rows | mitigate | RLS habilitado; policy apenas para service_role; anon/authenticated sem acesso direto; índice único parcial impede duplicatas pending/approved |
| T-260808-07 | Information Disclosure | acesso admin à lista | accept | emails de interessados são acessíveis apenas a admins via `requireAdmin`; baixo valor, sem dados sensíveis de pagamento |
</threat_model>

<output>
Create `.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/260808-rqw-SUMMARY.md` when done
</output>
