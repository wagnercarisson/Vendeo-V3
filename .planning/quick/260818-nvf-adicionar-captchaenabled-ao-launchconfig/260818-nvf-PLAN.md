---
phase: quick-260818-nvf-captchaenabled
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/launch-config/config.ts
  - src/lib/launch-config/__tests__/config.test.ts
  - src/app/(auth)/login/login-form.tsx
  - src/app/(auth)/login/__tests__/login-form.test.tsx
  - src/components/auth/signup-form.tsx
  - src/components/auth/__tests__/signup-form.test.tsx
  - src/app/(auth)/forgot-password/forgot-password-form.tsx
  - src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/__tests__/login-page.test.tsx
  - src/app/(auth)/signup/page.tsx
  - src/__tests__/auth/signup-page.test.tsx
  - src/app/(auth)/forgot-password/page.tsx
  - src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx
autonomous: true
requirements:
  - NVF-260818-captchaEnabled
user_setup: []

must_haves:
  truths:
    - "Com captchaEnabled=false (default), login por senha funciona sem resolver captcha: submit não é bloqueado sem token e captchaToken NÃO é enviado"
    - "Com captchaEnabled=false, signup email/senha submete sem captchaToken (emailRedirectTo preservado) e CaptchaField não é renderizado"
    - "Com captchaEnabled=false, recuperação de senha submete sem captchaToken e CaptchaField não é renderizado"
    - "Com captchaEnabled=true, comportamento F42 atual preservado: CaptchaField renderizado, token exigido (submit bloqueado sem ele) e captchaToken enviado nas 3 chamadas Supabase"
    - "As 3 pages server leem captchaEnabled de getLaunchConfig() e repassam via prop aos forms client"
  artifacts:
    - path: "src/lib/launch-config/config.ts"
      provides: "captchaEnabled na LaunchConfig (default false, fail-closed)"
      contains: "VENDEO_CAPTCHA_ENABLED"
    - path: "src/app/(auth)/login/login-form.tsx"
      provides: "Gate + options condicionais por captchaEnabled"
      contains: "captchaEnabled"
    - path: "src/components/auth/signup-form.tsx"
      provides: "Gate + options condicionais por captchaEnabled"
      contains: "captchaEnabled"
    - path: "src/app/(auth)/forgot-password/forgot-password-form.tsx"
      provides: "Gate + options condicionais por captchaEnabled"
      contains: "captchaEnabled"
    - path: "src/app/(auth)/forgot-password/page.tsx"
      provides: "Page server async lendo getLaunchConfig e repassando prop"
      contains: "getLaunchConfig"
    - path: "src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx"
      provides: "Teste de propagação da prop nas pages"
      min_lines: 30
  key_links:
    - from: "src/app/(auth)/login/page.tsx"
      to: "src/app/(auth)/login/login-form.tsx"
      via: "prop captchaEnabled"
      pattern: "captchaEnabled"
    - from: "src/app/(auth)/signup/page.tsx"
      to: "src/components/auth/signup-form.tsx"
      via: "prop captchaEnabled"
      pattern: "captchaEnabled"
    - from: "src/app/(auth)/forgot-password/page.tsx"
      to: "src/app/(auth)/forgot-password/forgot-password-form.tsx"
      via: "prop captchaEnabled"
      pattern: "captchaEnabled"
---

<objective>
Adicionar `captchaEnabled` ao LaunchConfig (env `VENDEO_CAPTCHA_ENABLED`, default **false** — fail-closed, paridade F41) e aplicá-lo nas 3 telas de auth (login, signup, recuperação de senha).

Purpose: O login F42 bloqueia o submit no client quando `captchaToken` é null — **incondicionalmente**, mesmo com captcha OFF no Supabase (runbook 42-ROLLBACK.md:21: "L2 conserta só o lado do servidor — não destrava o bloqueio client-side"). Não existe switch client-side de captcha; `publicSignupEnabled` só controla a UI do signup. Esta flag cria a gate correta no nível do form: **false → não renderiza CaptchaField, não exige token, não envia captchaToken** (comportamento F41); **true → comportamento F42 atual** (requer token). Alinha a app à sequência segura do runbook (linhas 43-48: captcha OFF deve deixar login funcional).

Output: Flag no LaunchConfig + 3 forms condicionais + 3 pages repassando a prop + testes co-migrados (7 arquivos de teste, 1 novo).
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260818-nvf-adicionar-captchaenabled-ao-launchconfig/../STATE.md
@.planning/phases/42-signup-controlado-elegibilidade-freemium/42-ROLLBACK.md
@src/lib/launch-config/config.ts
@src/app/(auth)/login/login-form.tsx
@src/components/auth/signup-form.tsx
@src/app/(auth)/forgot-password/forgot-password-form.tsx
@src/app/(auth)/login/page.tsx
@src/app/(auth)/signup/page.tsx
@src/app/(auth)/forgot-password/page.tsx

**Contrato da nova prop (criada na Task 1, consumida nas Tasks 2-3):**

`LaunchConfig.captchaEnabled: boolean` — `envBool("VENDEO_CAPTCHA_ENABLED", false)` em **ambas** as branches de `getLaunchConfig()` (branch `v15Enabled=false` e branch normal). Default **false**.

Props dos forms (obrigatórias, sem default — as pages SEMPRE passam):
```typescript
// login-form.tsx
interface LoginFormProps { redirect: string; captchaEnabled: boolean; }
// signup-form.tsx
interface SignupFormProps { captchaEnabled: boolean; }
// forgot-password-form.tsx
interface ForgotPasswordFormProps { captchaEnabled: boolean; }
```

Semântica nos forms (mesma nas 3):
- Gate de submit: `if (captchaEnabled && !captchaToken) return;` (bloqueio SÓ com captcha ativo)
- CaptchaField: renderizado apenas com `{captchaEnabled && <CaptchaField ... />}`
- Chamada Supabase: `captchaToken` incluído APENAS quando `captchaEnabled` (sem chave `options`/`captchaToken` quando false — nunca `options: undefined`; nunca `captchaToken: undefined`)
- Reset pós-submit (T-42-08b, tokens single-use): só quando `captchaEnabled` (sem widget, não há token a resetar)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Adicionar captchaEnabled ao LaunchConfig + testes de config</name>
  <files>src/lib/launch-config/config.ts, src/lib/launch-config/__tests__/config.test.ts</files>
  <action>
    Editar `src/lib/launch-config/config.ts`:
    - Na interface `LaunchConfig` (:3-14), adicionar após `publicSignupEnabled: boolean;` a linha `captchaEnabled: boolean;`.
    - Nas DUAS branches de `getLaunchConfig()` (branch `v15Enabled=false` :28-39 e branch normal :42-53), adicionar após a linha de `publicSignupEnabled` (default false) a linha:
      `captchaEnabled: envBool("VENDEO_CAPTCHA_ENABLED", false),`
      Default **false** (fail-closed — ausência de env nunca liga captcha client-side; paridade F41 onde login não exige token).

    Editar `src/lib/launch-config/__tests__/config.test.ts`:
    - No `beforeEach` (:5-18), adicionar `delete process.env.VENDEO_CAPTCHA_ENABLED;` junto aos demais deletes.
    - Adicionar novo bloco `describe("captchaEnabled (quick NVF-260818)", ...)` seguindo o padrão do bloco "Teste 11 - public signup flag (F42)" (:119-139) com 4 testes: (a) sem env var → `captchaEnabled === false`; (b) `VENDEO_CAPTCHA_ENABLED="true"` → `true`; (c) `"false"` → `false`; (d) valor inválido (ex. `"sim"`) → default false (contrato `envBool` config.ts:16-22).
  </action>
  <verify>
    <automated>npx vitest run src/lib/launch-config/__tests__/config.test.ts</automated>
  </verify>
  <done>Interface + ambas branches com `captchaEnabled`; 4 testes novos verdes; sem regressão nos testes existentes de config.</done>
</task>

<task type="auto">
  <name>Task 2: Forms condicionais por captchaEnabled (login, signup, forgot-password) + co-migração dos testes</name>
  <files>src/app/(auth)/login/login-form.tsx, src/components/auth/signup-form.tsx, src/app/(auth)/forgot-password/forgot-password-form.tsx, src/app/(auth)/login/__tests__/login-form.test.tsx, src/components/auth/__tests__/signup-form.test.tsx, src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx</files>
  <action>
    **`src/app/(auth)/login/login-form.tsx`** (estado atual: gate incondicional :26-28, options :41, CaptchaField :112-116, reset :58-59):
    - Props: `interface LoginFormProps { redirect: string; captchaEnabled: boolean; }` e desestruturar `captchaEnabled`.
    - Gate (:25-28): trocar para `if (captchaEnabled && !captchaToken) { return; }` mantendo o comentário D3 atualizado ("token exigido apenas quando captchaEnabled").
    - Chamada (:38-42): `signInWithPassword(captchaEnabled ? { email, password, options: { captchaToken } } : { email, password })` — quando false, SEM a chave `options` (nunca `options: undefined`).
    - `finally` (:54-60): envolver `setCaptchaToken(null)` + `setCaptchaResetKey(...)` em `if (captchaEnabled) { ... }` (T-42-08b só se aplica com widget; `setLoading(false)` permanece incondicional).
    - JSX (:112-116): envolver `<CaptchaField ... />` em `{captchaEnabled && ( ... )}`.

    **`src/components/auth/signup-form.tsx`** (estado atual: gate :71-74, options :83-86, CaptchaField :232-236, reset :109-111):
    - Props: `interface SignupFormProps { captchaEnabled: boolean; }` e `export function SignupForm({ captchaEnabled }: SignupFormProps)`. Ordem de validações preservada (privacy :52-55 → senha :62-69 → captcha :71-74).
    - Gate (:71-74): `if (captchaEnabled && !captchaToken) { return; }`.
    - Chamada (:80-87): `options: { emailRedirectTo: \`${getSiteUrl()}/auth/confirm\`, ...(captchaEnabled ? { captchaToken } : {}) }` — `emailRedirectTo` SEMPRE presente; `captchaToken` só quando ativo.
    - `finally` (:107-111): envolver reset do token/resetKey em `if (captchaEnabled) { ... }`.
    - JSX (:232-236): envolver `<CaptchaField ... />` em `{captchaEnabled && ( ... )}`.

    **`src/app/(auth)/forgot-password/forgot-password-form.tsx`** (estado atual: gate :19-22, options :31-34, CaptchaField :65-69, reset :38-40):
    - Props: `interface ForgotPasswordFormProps { captchaEnabled: boolean; }`.
    - Gate (:19-22): `if (captchaEnabled && !captchaToken) { return; }`.
    - Chamada (:31-34): `resetPasswordForEmail(email, { redirectTo: \`${getSiteUrl()}/auth/confirm\`, ...(captchaEnabled ? { captchaToken } : {}) })`.
    - `finally` (:37-42): envolver reset do token/resetKey em `if (captchaEnabled) { ... }`; `router.replace("/check-email?type=recovery")` permanece incondicional (anti-enumeração).
    - JSX (:65-69): envolver `<CaptchaField ... />` em `{captchaEnabled && ( ... )}`.

    **Co-migração dos 3 arquivos de teste** (a prop é OBRIGATÓRIA — todos os renders existentes precisam do prop):
    - `login-form.test.tsx`: adicionar `captchaEnabled={true}` a TODOS os `render(<LoginForm ... />)` existentes (os testes que usam `setCaptchaToken()` e o teste "bloqueia o submit sem captchaToken" :79-88 preservam o comportamento F42). Adicionar 2 testes novos: (a) `captchaEnabled={false}` + submit SEM token → `signInWithPassword` chamado com `{ email, password }` (sem `options`) e `mockReplace` com "/dashboard"; (b) `captchaEnabled={false}` → após render, `captchaMock.onVerify` permanece `null` (CaptchaField não montado — o mock de captcha-field :15-24 registra `onVerify` apenas se o componente renderizar).
    - `signup-form.test.tsx`: adicionar `captchaEnabled={true}` a TODOS os `render(<SignupForm />)` existentes (Teste 7 :196-204 "captcha token ausente → bloqueio" preserva o comportamento F42). Adicionar 2 testes novos: (a) `captchaEnabled={false}` + ciência de privacidade + submit SEM token → `mockSignUp` chamado com `options` contendo `emailRedirectTo` e SEM `captchaToken`, `mockReplace` para "/check-email?type=signup"; (b) `captchaEnabled={false}` → `captchaMock.onVerify` permanece `null`.
    - `forgot-password-form.test.tsx`: adicionar `captchaEnabled={true}` a TODOS os `render(<ForgotPasswordForm />)` existentes (incl. "bloqueia o submit sem captchaToken" :72-81). Adicionar 2 testes novos: (a) `captchaEnabled={false}` + submit SEM token → `resetPasswordForEmail` chamado com `{ redirectTo, }` SEM `captchaToken` e `mockReplace` com "/check-email?type=recovery"; (b) `captchaEnabled={false}` → `captchaMock.onVerify` permanece `null`.
    - NÃO alterar `captcha-field.test.tsx` nem `google-button.test.tsx` (D15: OAuth nunca envia captchaToken — inalterado).
  </action>
  <verify>
    <automated>npx vitest run "src/app/(auth)/login/__tests__/login-form.test.tsx" "src/app/(auth)/forgot-password/__tests__/forgot-password-form.test.tsx" "src/components/auth/__tests__/signup-form.test.tsx"</automated>
  </verify>
  <done>3 forms com gate/options/JSX/reset condicionais por `captchaEnabled`; testes existentes verdes com `captchaEnabled={true}`; 6 testes novos (2 por form) verdes com `captchaEnabled={false}`.</done>
</task>

<task type="auto">
  <name>Task 3: Pages server repassam captchaEnabled + testes de página (login, signup, forgot-password)</name>
  <files>src/app/(auth)/login/page.tsx, src/app/(auth)/login/__tests__/login-page.test.tsx, src/app/(auth)/signup/page.tsx, src/__tests__/auth/signup-page.test.tsx, src/app/(auth)/forgot-password/page.tsx, src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx</files>
  <action>
    **`src/app/(auth)/login/page.tsx`** (:15 desestrutura `publicSignupEnabled`): desestruturar também `captchaEnabled` do `getLaunchConfig()` e passar `<LoginForm redirect={safeRedirect} captchaEnabled={captchaEnabled} />` (:37).

    **`src/app/(auth)/signup/page.tsx`** (:15): desestruturar `captchaEnabled` e passar `<SignupForm captchaEnabled={captchaEnabled} />` (:71, branch flag on). A branch "Beta fechado" (:17-46) não renderiza form — sem mudança lá.

    **`src/app/(auth)/forgot-password/page.tsx`** (atual: componente síncrono sem config): converter em server component async:
    ```tsx
    import { getLaunchConfig } from "@/lib/launch-config/config";
    import { ForgotPasswordForm } from "./forgot-password-form";

    export default async function ForgotPasswordPage() {
      const { captchaEnabled } = await getLaunchConfig();
      return <ForgotPasswordForm captchaEnabled={captchaEnabled} />;
    }
    ```

    **Co-migração dos testes de página**:
    - `login-page.test.tsx`: o mock de `getLaunchConfig` (:10-14) deve passar a retornar TAMBÉM `captchaEnabled` — usar um segundo mock controlável no padrão `flagMock` (hoisted, ex. `captchaFlagMock.captchaEnabled`, default `false`), pois a page desestrutura a prop (sem ela o valor seria `undefined`). Atualizar o mock de `LoginForm` (:24-28) para `({ redirect, captchaEnabled })` renderizando `data-captcha-enabled={String(captchaEnabled)}` junto ao `data-redirect` existente. Adicionar 2 testes: captchaEnabled=false → form com `data-captcha-enabled="false"`; captchaEnabled=true → `"true"`. Testes existentes (D15 Google sempre visível, links) permanecem.
    - `src/__tests__/auth/signup-page.test.tsx`: mesmo padrão — mock de `getLaunchConfig` (:11-15) retorna também `captchaEnabled` (mock controlável, default false); mock de `SignupForm` (:27-34) aceita `{ captchaEnabled }` e renderiza `data-captcha-enabled={String(captchaEnabled)}`. Adicionar 2 testes (com `publicSignupEnabled=true`): captchaEnabled=false → form `data-captcha-enabled="false"`; captchaEnabled=true → `"true"`.
    - CRIAR `forgot-password-page.test.tsx` (novo, ~35-45 linhas) espelhando `login-page.test.tsx`: mock de `getLaunchConfig` retornando `{ captchaEnabled }` controlável; mock de `../forgot-password-form` aceitando `{ captchaEnabled }` e renderizando `<form data-testid="forgot-password-form" data-captcha-enabled={String(captchaEnabled)} />`; 2 testes: flag off → `"false"`; flag on → `"true"`. Importar a page com `render(await ForgotPasswordPage())` (server component async).
  </action>
  <verify>
    <automated>npx vitest run "src/app/(auth)/login/__tests__/login-page.test.tsx" "src/app/(auth)/forgot-password/__tests__/forgot-password-page.test.tsx" "src/__tests__/auth/signup-page.test.tsx"</automated>
  </verify>
  <done>3 pages repassam `captchaEnabled` ao form correspondente; mocks de config das pages atualizados (sem `undefined`); 6 testes novos de página verdes (2 por página) + testes existentes verdes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→Supabase Auth | captchaToken (quando ativo) atravessa do browser ao Supabase; quando inativo, nenhum token trafega |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-Q-01 | Spoofing | login/signup/forgot forms com captchaEnabled=false | accept | Comportamento F41 intencional: captcha é barreira opcional controlada pelo operador. A validação server-side continua existindo via Supabase Auth (se captcha ON no Dashboard, o Supabase rejeita requisição sem token) — a flag só remove a exigência client-side. Paridade com o runbook 42-ROLLBACK.md:43-48 (sequência segura: captcha OFF deixa login funcional). |
| T-Q-02 | DoS | LoginForm/CaptchaField com VENDEO_CAPTCHA_ENABLED=true sem NEXT_PUBLIC_TURNSTILE_SITE_KEY | mitigate | CaptchaField retorna null sem site key (captcha-field.tsx:139-141) → token permanece null → submit bloqueado (deadlock de login). Mitigação: default da flag é FALSE (fail-closed, env ausente nunca liga captcha); alavanca documentada no runbook — setar `VENDEO_CAPTCHA_ENABLED=false` restaura login sem redeploy de código. |
| T-Q-03 | Tampering | npm/pip/cargo installs | accept | Nenhum pacote novo é instalado neste plano (sem `npm install`, sem novas dependências). |
</threat_model>

<verification>
1. Suites direcionadas (Tasks 1-3) verdes — comandos de cada `<verify>`.
2. Typecheck completo: `npx tsc -p tsconfig.typecheck.json --noEmit` — sem erros (a prop obrigatória nos forms exige que TODOS os call sites e renders de teste passem `captchaEnabled`).
3. Regressão completa: `npm test` — todos os testes verdes (incl. `captcha-field.test.tsx` e `google-button.test.tsx` inalterados; os mocks parciais de `getLaunchConfig` nas rotas API não são afetados — `mockReturnValue` aceita objeto parcial).
</verification>

<success_criteria>
- `LaunchConfig.captchaEnabled` com default false nas duas branches; 4 testes de config novos.
- Login/signup/recuperação: com flag false → CaptchaField não renderizado, submit não bloqueado, `captchaToken` ausente nas chamadas Supabase; com flag true → comportamento F42 idêntico.
- 3 pages server repassam a prop (forgot-password/page.tsx agora async lendo `getLaunchConfig`).
- 14 arquivos tocados, 16 testes novos (4 config + 6 forms + 6 páginas) — sem regressão em typecheck/vitest.
</success_criteria>

<output>
Create `.planning/quick/260818-nvf-adicionar-captchaenabled-ao-launchconfig/260818-nvf-SUMMARY.md` when done
</output>