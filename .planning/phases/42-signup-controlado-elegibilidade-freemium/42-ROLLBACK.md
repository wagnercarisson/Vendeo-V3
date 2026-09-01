# Phase 42: Runbook de Rollback e Recuperação — Signup Controlado

**Objetivo:** manter o site funcional se o deploy da F42 quebrar o fluxo em produção, com o menor tempo de indisponibilidade e o menor escopo de mudança possível.

**Contexto crítico (verificado no código):**
- O `CaptchaField` entrou no **login** apenas na F42 (`39ba00ed`). A produção atual (F41) **não exige captcha** no login.
- O login da F42 bloqueia o submit **no client** se não houver token Turnstile (`login-form.tsx:26-28`: `if (!captchaToken) return;`). **Não passa pelo servidor.**
- O Supabase só valida `captchaToken` se o captcha estiver **ON no Dashboard**. Aplicação não tem rota própria de captcha.
- `VENDEO_PUBLIC_SIGNUP_ENABLED` (default `false`) controla **somente a UI** do signup (abrir/fechar o formulário). Não afeta login nem captcha.

---

## 1. Alavancas de recuperação

| # | Alavanca | O que controla | Tempo | Onde |
|---|----------|----------------|-------|------|
| L1 | `VENDEO_PUBLIC_SIGNUP_ENABLED=false` (ou remover) | **Só a UI do signup** (volta "Beta fechado") | env var + redeploy (~2-3 min) | Vercel → Project → Environment Variables |
| L2 | Captcha **OFF** no Supabase Dashboard | **Validação server-side** do token (login/signup/recovery por senha deixam de exigir token) | **Instantâneo** (~30s) | Supabase → Auth → Settings → captcha |
| L3 | Rollback para o deploy F41 anterior | **App inteiro** volta para F41 (login sem captcha, signup fechado) | ~1-2 min | Vercel → Deployments → ... → Rollback (ou `vercel rollback`) |

**Regra de ouro:** L1 **não** conserta login. L2 conserta só o lado do servidor — **não** destrava o bloqueio client-side da F42 se o widget falhar. Para restaurar login completo, use **L3**.

---

## 2. Matriz de falha → ação

| Sintoma | Causa provável | Ação (mais rápido primeiro) |
|---------|----------------|-----------------------------|
| Signup aberto quando não deveria / formulário exposto | Flag ON por engano | **L1** (flag off) — resolve na hora, sem tocar no resto |
| Login por senha retorna erro genérico / `captcha_failed` | Captcha ON no Supabase exigindo token que o client não envia | **L2** (captcha OFF) — instantâneo. Se o widget renderiza, a F42 manda token e também funciona; desligar cobre o caso F41 |
| Login "nada acontece" (submit mudo) | Widget Turnstile não renderizou → token `null` → bloqueio client-side da F42 | **L3** (rollback F41) — L1/L2 **não** resolvem. Alternativa de longo prazo: corrigir widget/sitekey |
| Signup email/senha falha ao confirmar | Redirect/site key/email SMTP | **L2** se for captcha; senão **L3** para restaurar |
| Google OAuth quebrado | Callback/URL config | **L3** (mais rápido) ou ajustar URL config se F41 já tinha OAuth funcional |

**Decisão rápida:** se qualquer coisa do **login** quebrar em produção, não tente consertar por alavanca parcial — vá direto para **L3** (rollback F41) e depois investigue. Login funcional > recurso novo.

---

## 3. Sequência segura de produção (para não precisar de rollback)

Sempre **uma alavanca por vez**, validando após cada passo:

1. **Deploy F42 com captcha OFF e flag OFF** → valida login (widget renderiza no domínio real), signup continua fechado.
2. **L1: flag ON** → valida signup aberto (formulário, captcha, confirmação, Google).
3. **L2: captcha ON no Supabase** → valida login + signup + recovery com token real.
4. Se quebrar no passo 3 → **L2 OFF** (instantâneo) e investiga. Não precisa desfazer deploy.

> **Nunca ligar o captcha no Supabase antes do deploy da F42.** F41 não envia token → todo login por senha de produção quebra.

---

## 4. Procedimento de rollback completo (L3) — passo a passo

```powershell
# 1. Listar deployments de produção para pegar o ID do F41 (o anterior ao F42)
npx vercel ls

# 2. Rollback para o deployment F41 (ex. https://vendeo-v3-ac4oep3xt-wagnercarissons-projects.vercel.app)
npx vercel rollback https://vendeo-v3-ac4oep3xt-wagnercarissons-projects.vercel.app --yes

# 3. Garantir captcha OFF no Supabase (se tiver sido ligado) — Dashboard → Auth → Settings
#    (F41 não manda token; com captcha ON o login de produção quebra)

# 4. Garantir flag OFF/removida — Vercel → Environment Variables (L1)
#    (F41 não lê essa flag; remover não causa efeito, mas evita confusão)

# 5. Validar: /login por senha + Google, / (landing beta fechado), /signup (beta fechado)
```

**Vantagens do L3:** restaura exatamente o comportamento F41 já aprovado em UAT humano 6/6; independe de estado do Supabase/Dashboard; é o mesmo fluxo de sempre (deploy anterior já validado).

---

## 5. Checklist pós-deploy F42 (guardar junto ao deploy)

- [ ] Migração `20260817000001` aplicada no remoto (confirmar em `supabase migration list`).
- [ ] Site key Turnstile real no Vercel (Preview + Production) — `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- [ ] Domínio de produção **na allowlist de hostnames** do widget Turnstile no Cloudflare (senão erro `400020`).
- [ ] `NEXT_PUBLIC_SITE_URL` = domínio de produção (OAuth/confirmação de email).
- [ ] Captcha **OFF** no Supabase até o passo 3 da sequência segura.
- [ ] Google OAuth: redirect URIs de produção registrados (Supabase + Google Cloud Console).
- [ ] Após rollback de teste, revalidar o checklist antes de religar captcha.