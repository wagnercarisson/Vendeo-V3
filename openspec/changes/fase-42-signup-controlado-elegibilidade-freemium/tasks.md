## 1. Pré-requisito de limpeza + Trackings — Renumeração F42/F43 (D1 runbook)

- [ ] 1.1 **Pré-requisito F41:** confirmar que a F41 está arquivada/limpa — `openspec list` vazio, 13/13 plans, 2033 testes, UAT 6/6; confirmar que o rodapé de `.planning/ROADMAP.md` **não mantenha resíduo "F41 ... em PLANEJAMENTO"** — D1
- [ ] 1.2 `ROADMAP.md` (raiz): linha 42 → "Signup Controlado e Elegibilidade Freemium | v1.5 | 0/0 | ○ Pending"; adicionar linha 43 → "Stripe / Monetização Pública | v1.7 | 0/0 | ○ Pending"; menções "F42 (Stripe)" → "Stripe (F43)"; bullet da F42 no `<details open>` do v1.5 — D1
- [ ] 1.3 `.planning/ROADMAP.md`: nota "Phase numbering" (F42 = Signup v1.5, F43 = Stripe v1.7); linha da tabela Progress 42 → Signup; adicionar linha 43 → Stripe; notas de renumeração; menções "Phase 42 (Stripe)" em Dependencies → F43; Dependency Graph; seção "### Phase 42 — Signup Controlado e Elegibilidade Freemium"; rodapé "Last updated" — D1
- [ ] 1.4 `.planning/STATE.md`: frontmatter `current_phase: 42`; tabela "Next Phases" (F42 in progress Signup v1.5, F43 future Stripe v1.7 renumerada de F42); corpo "Current Position" + "Last updated" — D1
- [ ] 1.5 `.planning/PROJECT.md`: menção "Stripe ... F42 (v1.7)" → **F43**; rodapé "Last updated" — D1
- [ ] 1.6 `.planning/REQUIREMENTS.md`: seção v1.7 "Stripe... F42/v1.7" → **F43/v1.7** — D1
- [ ] 1.7 `.planning/MILESTONES.md`: "diferido para v1.7 (F42)" → **(F43)** — D1
- [ ] 1.8 Verificação de consistência: grep-consistência "F42 (Stripe)"/"Phase 42 (Stripe)" nos 6 trackings → zero resíduos (padrão F41-01) — D1

## 2. Config — feature flag e paridade de ambiente (D5/D13)

- [ ] 2.1 `src/lib/launch-config/config.ts`: adicionar `publicSignupEnabled: boolean` no tipo `LaunchConfig` + `envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false)` em `getLaunchConfig()` — **default false** — D5
- [ ] 2.2 Validação server-side da flag nas páginas/rotas controladas (landing e `/signup`) — não só no cliente — D5
- [ ] 2.3 `supabase/config.toml`: `minimum_password_length = 8` (hoje 6), `enable_confirmations = true` (hoje false), `[auth.captcha]` turnstile habilitado (hoje desligado), provider Google (client_id + secret), `enable_manual_linking = false` — D13
- [ ] 2.4 Confirmar contrato `NEXT_PUBLIC_SITE_URL` (obrigatória via `getSiteUrl()`, `site-url.ts:1-2`) — base para `emailRedirectTo` e `redirectTo` OAuth — D2/D13

## 3. Mapeamento CNAE — módulo determinístico (D9)

- [ ] 3.1 `src/lib/cnpj/cnae-mapping.ts`: `normalizeCnaeSubclasse(raw)` (remove pontuação; retorna `null` se não 7 dígitos) e `deriveCnaeClasse(subclasse)` (5 primeiros = classe 4+DV) — D9
- [ ] 3.2 Tipo `CnaeCompatibility = "compatible" | "incompatible" | "unknown"` + estrutura `CnaeCodes = { classes: string[]; subclasses: string[] }` — D9
- [ ] 3.3 **Quatro conjuntos por segmento:** `CNAE_COMPATIBLE` e `CNAE_INCOMPATIBLE` (cada um com `classes` e `subclasses`), por segmento do enum `stores.segment` (F40); segmento `outros` com conjuntos vazios — D9
- [ ] 3.4 `cnaeCompatibilityFor(segment, cnaePrincipal)`: ordem de precedência `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown` — D9
- [ ] 3.5 Validação de **não-contradição em build/CI**: mesmo código (string idêntica) não pode estar nas listas positiva e negativa do mesmo segmento (classe OU subclasse) — erro de build, não runtime — D9
- [ ] 3.6 Listas de CNAE **validadas na CONCLA/IBGE** antes de fechar o mapeamento (códigos ilustrativos do alinhamento não são copiados direto) — D9

## 4. Motor de elegibilidade — ordem revisada + novos motivos (D8/D10)

- [ ] 4.1 `src/lib/freemium/freemium-risk-service.ts`: substituir o bloco `SUSPENSA` por "situação não-vazia ≠ `ATIVA` → review `situacao_nao_ativa`", mantendo `BAIXADA`/`NULA` (reject `cnpj_baixada`/`cnpj_nula`) avaliados antes — D8
- [ ] 4.2 Situação ausente/vazia/não normalizável **em resposta resolvida** → **defer `dados_oficiais_incompletos`** (nunca aprova, não gera review ruidoso) — D8/D10
- [ ] 4.3 Cidade/UF **pré-gate no caller/rota** (D7): `city`/`state` ausentes → **NÃO chamar `evaluateFreemiumEligibility`**; loja permanece draft/unverified sem avaliação/review (motor nunca recebe nulos; sem quinto retorno); preenchidas sem oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente` — D7/D10
- [ ] 4.4 CNAE (D9): `cnaeCompatible` preenchido via `cnaeCompatibilityFor`; `incompatible` → review `segmento_cnae_divergente` (nunca reject); `unknown` neutro — D9/D10
- [ ] 4.5 Ordem D10 aplicada: CNPJ → situação ATIVA exata → raiz → nome ≥ 0.6 → cidade/UF → CNAE → approved (score ≥ 60) — D10
- [ ] 4.6 `src/lib/freemium/types.ts`: sinal `cnaeCompatible` tipado como `"compatible" | "incompatible" | "unknown" | null` (antes boolean/null); `city`/`state` do input tipados como `string | null` (representa ausência — D7); `decision` alinhado ao código real (`"approved" | "review" | "reject" | "defer"`) — D7/D9
- [ ] 4.7 `check_store_readiness` F34 **intocada** — nenhuma mudança de geração (separação de conceitos D7)

## 5. Labels admin + Admin reviews mais rico (D11)

- [ ] 5.1 `src/lib/admin/labels.ts`: novos labels em `VERIFICATION_REASON_LABELS` — `situacao_nao_ativa` ("Situação cadastral não ativa"), `localizacao_oficial_indisponivel` ("Localização oficial indisponível"), `segmento_cnae_divergente` ("Segmento incompatível com CNAE"), `dados_oficiais_incompletos` ("Dados oficiais incompletos", defer); `situacao_suspensa` mantido para histórico — D8/D11
- [ ] 5.2 `src/app/(app)/admin/reviews/page.tsx`: exibir dados **informados × oficiais** — razão social, nome fantasia, similaridade %, cidade/UF, CNAE principal + descrição, **situação cadastral original**, histórico de raiz — D11
- [ ] 5.3 `src/app/(app)/admin/reviews/review-detail.tsx` (novo): visão de detalhe da revisão com os dados informados × oficiais — D11
- [ ] 5.4 Filtro por motivo (`?reason=`) inclui os novos motivos sem quebra; fila admin exibe label para registro **defer** `dados_oficiais_incompletos` (sem motivo cru) — D11
- [ ] 5.5 Ações existentes (approve/reject/defer/exception) mantidas — `admin_exception` continua auditável (D6 #6)

## 6. Signup — formulário restaurado + flag on/off (D2/D4/D5/D15)

- [ ] 6.1 `src/app/(auth)/signup/page.tsx`: server component lê `publicSignupEnabled` (server-side) — flag on → formulário + "Continuar com Google"; flag off → "Beta fechado" atual preservado — D4/D5
- [ ] 6.2 `src/components/auth/signup-form.tsx` (restaurado/modernizado): email, senha (mín. 8), confirmar senha, ciência da Privacidade (modal `PrivacyAcknowledgeModal`), consentimento opcional de comunicações, links para Privacidade e Termos — D2/D12
- [ ] 6.3 `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, captchaToken } })`; `privacyPending`/consentimento via `sessionStorage` — D2/D3
- [ ] 6.4 Anti-enumeração: sucesso e "email já cadastrado" → **mesma resposta** `/check-email?type=signup`; captcha/indisponibilidade/erro operacional → mensagem genérica "Não foi possível concluir. Tente novamente." — D2
- [ ] 6.5 Validação local: `password.length >= 8`, `password === confirm` (mensagens PT-BR) — D2

## 7. Google OAuth — botão + callback PKCE (D15/D16)

- [ ] 7.1 `src/components/auth/google-button.tsx` (novo): "Continuar com Google" → `signInWithOAuth({ provider: "google", options: { redirectTo: `${getSiteUrl()}/auth/callback` } })`; **sem `captchaToken`** — D15/D3
- [ ] 7.2 `src/app/auth/callback/route.ts` (novo): lê `code` e chama `exchangeCodeForSession(code)` (PKCE); `/auth/confirm` (email/OTP `verifyOtp`) permanece intacto — D16
- [ ] 7.3 Allowlist de `next`: `VALID_NEXT = ["/loja", "/dashboard"]`; fallback padrão = `/loja`; redirect externo bloqueado; `"/"` e `/onboarding` nunca válidos — D16
- [ ] 7.4 Erro genérico anti-enumeração: `code` inválido/expirado → `/login?error=oauth_failed` — D16
- [ ] 7.5 Sucesso → redirect `/loja` (rota protegida, layout `(app)`) → **PrivacyGate reusado** (sem novo componente em `components/auth/`) — D16
- [ ] 7.6 Identity linking automático por email verificado preservado; `enable_manual_linking = false` — D16/D14

## 8. Turnstile — captcha-field reutilizável (D3)

- [ ] 8.1 `src/components/auth/captcha-field.tsx` (novo): widget Cloudflare Turnstile + coleta do token (`getToken()` ou equivalente) — D3
- [ ] 8.2 Aplicado a **signup email/senha, login por senha e recuperação de senha** (`captchaToken` nas operações); **NÃO no Google OAuth** — D3/D15
- [ ] 8.3 Falha/indisponibilidade do captcha → bloqueia só a operação com mensagem genérica (sem revelar existência de conta) — D2/D3
- [ ] 8.4 Chaves: site key no frontend/Vercel, secret no Supabase Dashboard (nunca no cliente); chaves de teste em local (D13); `[auth.captcha]` turnstile no `config.toml`

## 9. Login + Recuperação — Google, captcha e flag (D2/D3/D5/D15)

- [ ] 9.1 `src/app/(auth)/login/login-form.tsx`: "Continuar com Google" **sempre visível** (inclusive flag off — acesso de existentes preservado); flag on → link "criar conta com email" (→ `/signup`), sem "Solicitar acesso free" — D5/D15
- [ ] 9.2 Login por senha envia `captchaToken` (Turnstile) — D3
- [ ] 9.3 Recuperação de senha (`forgot-password`/`resetPasswordForEmail`) envia `captchaToken` — D3

## 10. Landing — CTA conforme a flag (D4/D5)

- [ ] 10.1 `src/components/landing/access-request-section.tsx`: flag on → "Continuar com Google" (principal) + "Continuar com email" (→ `/signup`); flag off → "Solicitar acesso free" + formulário (comportamento atual idêntico) — D4/D5
- [ ] 10.2 `access_requests` preservado como **histórico/fila comercial/canal de contato** — sem migração destrutiva; `approved` não concede privilégio técnico (sem token/allowlist) — D4
- [ ] 10.3 `src/app/(auth)/check-email/page.tsx` inalterado (já suporta `type=signup`) — D2

## 11. Legal — versões e PrivacyGate (D12/D16)

- [ ] 11.1 Publicar **Terms v1.4** em `legal_document_versions` (cláusula 3.1: remover "limitado a usuários convidados"; descrever acesso público gratuito com elegibilidade e autenticação por terceiros/Google) — D12
- [ ] 11.2 Publicar **Privacy v1.3** em `legal_document_versions` (remover "beta, gratuita e fechada"; descrever captcha, confirmação de email e autenticação por terceiros: dados do Google, finalidade exclusivamente autenticacional, nenhuma permissão sobre Gmail/Drive/outros) — D12
- [ ] 11.3 AUP v1.1 mantida; reaceite via fluxo existente (`getAcceptanceStatus` → `outdated` → `login_reacceptance`) com tolerância técnica — sem retroatividade destrutiva — D12
- [ ] 11.4 PrivacyGate (`src/components/legal/privacy-gate.tsx`) reusado/evoluído para o caminho OAuth: ciência + opt-in opcional registrados autenticados em `privacy_acknowledgements`/`consent_events` (fonte da verdade — **não `user_metadata`**) — D12/D16
- [ ] 11.5 **Coordenação única PrivacyGate × PrivacyRecovery** no caminho email/senha: sem modal duplicado nem "flash" (incorporar recuperação de `privacyPending` ao PrivacyGate OU processar o pending antes do layout autenticado) — D16

## 12. Migrations (idempotentes, não destrutivas)

- [ ] 12.1 Migrations F42 idempotentes para labels/RPCs (se necessário) — sem `NOT NULL` em `city`/`state` (D7); sem alteração de semântica de concessão (D6); sem alteração de schema em `access_requests` (D4) — D7/D14
- [ ] 12.2 Versões legais (Terms v1.4, Privacy v1.3) publicadas com `effective_at` controlado (futuro habilita reaceite antes do go-live) — D12
- [ ] 12.3 Verificar paridade `supabase/config.toml` (senha 8, confirmação on, captcha, Google provider, `enable_manual_linking=false`) não quebra o fluxo local — D13

## 13. Testes — Signup / flag / landing / OAuth (D2-D5/D12/D15) — 13 testes

- [ ] 13.1 Teste 1: signup flag on → formulário email/senha + "Continuar com Google"; flag off → "Beta fechado"/landing — D4/D5
- [ ] 13.2 Teste 2: validações — senha < 8 → erro; senha ≠ confirmação → erro — D2
- [ ] 13.3 Teste 3: ciência da Privacidade obrigatória (modal); consentimento de comunicações opcional — D2/D12
- [ ] 13.4 Teste 4: `signUp` envia `emailRedirectTo` + `captchaToken` — D2/D3
- [ ] 13.5 Teste 5: anti-enumeração — sucesso e "email já cadastrado" → **mesma resposta** `/check-email?type=signup` — D2
- [ ] 13.6 Teste 6: anti-enumeração — captcha/indisponibilidade/erro operacional → mensagem **genérica** (não revela conta) — D2/D3
- [ ] 13.7 Teste 7: captcha — token ausente → bloqueio de cadastro (sem chamada de auth) — D3
- [ ] 13.8 Teste 8: captcha — token inválido/expirado/reutilizado → erro tratado pelo Supabase (fluxo integrado) — D3
- [ ] 13.9 Teste 9: Google — `signInWithOAuth({ provider: 'google', redirectTo: /auth/callback })`; **sem** `captchaToken` — D15/D3
- [ ] 13.10 Teste 10: landing CTA — flag on → "Continuar com Google" + "Continuar com email"; flag off → "Solicitar acesso free" + formulário — D4
- [ ] 13.11 Teste 11: `VENDEO_PUBLIC_SIGNUP_ENABLED` default false; parse correto — D5
- [ ] 13.12 Teste 12: `approved` em `access_requests` não bloqueia novo signup do mesmo email (histórico, não autorização) — D4
- [ ] 13.13 Teste 13: **UI: flag da app OFF + usuário Google existente → botão "Continuar com Google" CONTINUA visível no `/login`** (a flag esconde só landing/`/signup`, nunca o acesso de existentes) — D5

## 14. Testes — Callback OAuth / identity linking (D16/D15/D6/D5) — 8 testes

> **Classificação:** testes 14–16 (rota/callback) são Vitest com mocks; **testes 17–21 (identity linking e `enable_signup=false`) são integrados/UAT com Supabase real**.

- [ ] 14.1 Teste 14: `/auth/callback` com `code` válido → `exchangeCodeForSession` → sessão → PrivacyGate — D16
- [ ] 14.2 Teste 15: callback com `code` inválido/expirado → erro genérico `/login?error=oauth_failed` — D16
- [ ] 14.3 Teste 16: callback com `next` externo → **bloqueado** (allowlist) — D16
- [ ] 14.4 Teste 17: conta email confirmada + Google mesmo email → **mesmo usuário** (sem duplicar `public.users`, lojas, acknowledgments) — D16
- [ ] 14.5 Teste 18: conta email não confirmada + Google → comportamento do Supabase validado (sem duplicação) — D16
- [ ] 14.6 Teste 19: Google novo → novo usuário; **sem crédito** (invariante D6) — D15/D6
- [ ] 14.7 Teste 20: Google existente → login mesmo com "Allow new users to sign up" off — D5/D15
- [ ] 14.8 Teste 21: cancelar consentimento do Google → volta para login sem sessão criada — D15/D16

## 15. Testes — Motor de elegibilidade (D6/D7/D8/D9/D10) — 15 testes

- [ ] 15.1 Teste 22: `INAPTA` → review `situacao_nao_ativa` (corrige lacuna F33) — D8
- [ ] 15.2 Teste 23: `SUSPENSA` → review `situacao_nao_ativa` (substitui `situacao_suspensa` no motor) — D8
- [ ] 15.3 Teste 24: `BAIXADA`/`NULA` continuam reject (`cnpj_baixada`/`cnpj_nula`) — D8
- [ ] 15.4 Teste 25: situação não-vazia ≠ ATIVA/BAIXADA/NULA → review `situacao_nao_ativa`; **ausente/inválida em resposta resolvida → defer `dados_oficiais_incompletos`** (nunca aprova, sem review ruidoso) — D8/D10
- [ ] 15.5 Teste 26: **pré-gate D7** — cidade/UF ausentes na loja → o caller/rota **NÃO chama `evaluateFreemiumEligibility`**; loja permanece draft, SEM review (sem ruído na fila admin), sem concessão — D7
- [ ] 15.6 Teste 27: cidade/UF preenchidas mas oficiais ausentes (provedor sem dados) → review `localizacao_oficial_indisponivel` — D7/D10
- [ ] 15.7 Teste 28: cidade/UF informadas × oficiais divergentes → review (`cidade_divergente`/`uf_divergente`) — D10
- [ ] 15.8 Teste 29: CNAE compatible → segue avaliação (sem revisão por CNAE) — D9
- [ ] 15.9 Teste 30: CNAE incompatible → review `segmento_cnae_divergente` (**nunca reject**) — D9
- [ ] 15.10 Teste 31: CNAE unknown (ausente/inválido/fora das listas) → neutro — D9
- [ ] 15.11 Teste 32: ordem do motor — situação não ATIVA antes de raiz/nome/cidade/UF (regra D10) — D10
- [ ] 15.12 Teste 33: `api_unavailable`/sem dados → defer (não falso negativo) — D10
- [ ] 15.13 Teste 34: invariante D6 — signup/draft NUNCA concedem crédito (fluxo integrado, email/senha) — D6
- [ ] 15.14 Teste 35: invariante D6 — signup **via Google** NUNCA concede crédito — D6/D15
- [ ] 15.15 Teste 36: invariante D6 — raiz única e aprovação idempotente/auditada — D6

## 16. Testes — Mapeamento CNAE (D9) — 10 testes

- [ ] 16.1 Teste 37: `"4781-4/00"` → subclasse normalizada `"4781400"` (7 dígitos + DV) — D9
- [ ] 16.2 Teste 38: `"4781400"` → classe derivada `"47814"` (4 dígitos + DV); representação separada classe × subclasse — D9
- [ ] 16.3 Teste 39: CNAE **na lista positiva** (compatível) → compatible — D9
- [ ] 16.4 Teste 40: CNAE **na lista negativa explícita** (incompatível) → incompatible — D9
- [ ] 16.5 Teste 41: **Granularidade exata:** `"4781400"` em `incompatible.subclasses` NÃO torna as demais subclasses de `"47814"` incompatíveis (lista-se a classe `"47814"` para cobrir a inteira) — D9
- [ ] 16.6 Teste 42: **Precedência de subclasse exata:** classe `"47814"` positiva + subclasse `"4781400"` negativa → `"4781400"` **incompatible** (exceção fina vence); demais subclasses seguem a classe — D9
- [ ] 16.7 Teste 43: **Validação de não-contradição:** mesmo código (string idêntica) nas listas positiva e negativa (classe OU subclasse) → **erro de build/CI** — D9
- [ ] 16.8 Teste 44: CNAE **fora de ambas as listas** → **unknown** (neutro); nulo/sem 7 dígitos → unknown — D9
- [ ] 16.9 Teste 45: segmento sem listas (`outros`) → unknown, sem penalizar — D9
- [ ] 16.10 Teste 46: lógica de match — subclasse exata (7) checada antes de classe (4+DV); ordem `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown` — D9

## 17. Testes — Admin (D8/D10/D11) — 7 testes

- [ ] 17.1 Teste 47: novo motivo `situacao_nao_ativa` exibido com label correto — D11
- [ ] 17.2 Teste 48: `situacao_suspensa` permanece legível em registros antigos — D8/D11
- [ ] 17.3 Teste 49: revisão mostra dados informados × oficiais (razão social, fantasia, similaridade) — D11
- [ ] 17.4 Teste 50: revisão mostra CNAE principal + descrição e situação cadastral original — D11
- [ ] 17.5 Teste 51: filtro por motivo inclui os novos motivos sem quebra — D11
- [ ] 17.6 Teste 52: registro **defer** `dados_oficiais_incompletos` exibido com label "Dados oficiais incompletos" (sem aparecer cru na fila) — D8/D10/D11
- [ ] 17.7 Teste 53: exceção admin permanece auditável (`admin_exception`) — D6/D11

## 18. Testes — Legal / transição (D12/D16) — 5 testes

- [ ] 18.1 Teste 54: nova versão de Termos/Privacidade → `getAcceptanceStatus` retorna `outdated` para lojas antigas — D12
- [ ] 18.2 Teste 55: reaceite via `login_reacceptance` registra nova versão — D12
- [ ] 18.3 Teste 56: signup email/senha declara ciência da Privacidade (modal) **na primeira autenticação pós-confirmação** — aceite registrado autenticado em `privacy_acknowledgements`, **não "na criação"** — D2/D12
- [ ] 18.4 Teste 57: **OAuth: sem acknowledgment → PrivacyGate obrigatório pós-callback; consentimento registrado em `privacy_acknowledgements`/`consent_events` (NÃO em `user_metadata`)** — D12/D16
- [ ] 18.5 Teste 58: clearance fail-closed — sem aceite da versão nova → funcionalidades protegidas bloqueadas — D12

## 19. Regressão e co-migração de fixtures (D2/D3/D5/D7/D8/D10/D11/D15/D16)

- [ ] 19.1 `freemium-risk-service.test.ts` co-migrado: bloco SUSPENSA → genérico; novos casos defer `dados_oficiais_incompletos`, `situacao_nao_ativa`, cidade/UF gate, CNAE — D8/D10
- [ ] 19.2 `labels.test.ts` co-migrado: 4 novos labels + `situacao_suspensa` legado — D11
- [ ] 19.3 `access-request-section` co-migrado: novos CTAs (flag on/off) — D4
- [ ] 19.4 `login-form` co-migrado: "Continuar com Google" + captcha no login por senha — D3/D5/D15
- [ ] 19.5 `launch-config` co-migrado: novo campo `publicSignupEnabled` — D5
- [ ] 19.6 Regressão: landing flag off → comportamento idêntico ao atual (formulário de solicitação + CTA) — D4
- [ ] 19.7 Regressão: `/signup` flag off → "Beta fechado" (comportamento atual preservado) — D4/D5
- [ ] 19.8 Regressão: `/auth/confirm` (email/OTP) **inalterado** — continua processando `token_hash` + `verifyOtp` (callback novo não interfere) — D16
- [ ] 19.9 Regressão: `freemium-risk-service` para casos approved/review/defer já cobertos (só o bloco SUSPENSA muda para o genérico) — D8/D10
- [ ] 19.10 Regressão: `reviews/page.tsx` com os 8 motivos atuais + novos (sem quebra de renderização/filtro) — D11
- [ ] 19.11 Verificar `npx vitest run` com suíte completa (novos + co-migrados passando) — D2–D16

## 20. Verificação (gates + UAT)

- [ ] 20.1 `npx vitest run` — zero falhas (novos + existentes + co-migrados) — D2–D16
- [ ] 20.2 `npm run typecheck` — zero erros
- [ ] 20.3 `npm run lint` — zero erros
- [ ] 20.4 `npm run build` — build bem-sucedido
- [ ] 20.5 UAT local flag off → landing/signup idênticos ao atual; **`/login` continua exibindo "Continuar com Google"** (acesso de existentes) — D4/D5
- [ ] 20.6 UAT local flag on → criar conta (email/senha): confirmar email, onboarding, CNPJ, elegibilidade (casos: ATIVA ok; INAPTA revisão; cidade/UF ausente sem crédito) — D2/D6/D7/D8
- [ ] 20.7 UAT local flag on → Google OAuth: `/auth/callback`, PrivacyGate, onboarding, CNPJ, elegibilidade; sem segundo email de confirmação — D15/D16
- [ ] 20.8 UAT local: coordenação única PrivacyGate × PrivacyRecovery — primeira autenticação email/senha sem modal duplicado / sem "flash" — D16
- [ ] 20.9 UAT local: Turnstile (chaves de teste) — token válido e inválido (email/senha, login, recuperação); OAuth sem captcha — D3
- [ ] 20.10 UAT local: login/recuperação continuam funcionando com o CAPTCHA ativado no Supabase — D3/D13
- [ ] 20.11 UAT local: "Allow new users to sign up" off → nova conta bloqueada; login de existentes ok — D5
- [ ] 20.12 UAT local: identity linking — email/senha + Google mesmo email → mesma conta (sem duplicação) — D16
- [ ] 20.13 UAT local: admin — revisar loja com novo motivo e dados informados × oficiais; aprovar/rejeitar/deferir; exceção auditável — D11
- [ ] 20.14 UAT local: fila admin exibe label "Dados oficiais incompletos" para registro defer (sem motivo cru) — D11
- [ ] 20.15 UAT preview/produção (D13): smoke com flag OFF → ligar flag → validar OAuth, email/senha, captcha, elegibilidade, legal → monitorar