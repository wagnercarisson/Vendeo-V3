# Alinhamento Fase 42 — Signup Controlado e Elegibilidade Freemium (v1.5)

> **Renumeração (esta fase):** F42 = **Signup Controlado e Elegibilidade Freemium** (nova, v1.5). Stripe / Monetização Pública deslocada de **F42 para F43** (v1.7, pós-beta — segue o precedente de renumeração da F41 D1, que seguiu a F40 D1, a F39 D1 e a F37 D11: a fase conflitante é incrementada, não apagada). A atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) está documentada como runbook na seção **D1** deste documento.
>
> **Pré-requisito de limpeza (F41):** **resolvido** — a F41 foi arquivada e está concluída nos trackings (`openspec list` vazio, 13/13 plans, 2033 testes, UAT 6/6). Confirmar apenas que o rodapé de `.planning/ROADMAP.md` não mantenha resíduo "F41 ... em PLANEJAMENTO" antes de planejar a F42.
>
> **Decisão central (D2/D3/D15/D16):** a F42 reabre o **cadastro público** de forma controlada com **Google OAuth como entrada principal** (`signInWithOAuth`, callback PKCE `/auth/callback`) e **email/senha como fallback** (formulário de signup, confirmação de email, consentimento opcional). Email/senha, login por senha e recuperação são protegidos por **Cloudflare Turnstile via integração nativa do Supabase Auth** (`captchaToken` validado server-side); **OAuth não passa pelo Turnstile** (proteção do provedor + controles server-side de criação) e **não exige segundo email de confirmação**. O controle de criação de novas contas é **server-side no Supabase** ("Allow new users to sign up" / `enable_signup`), não apenas a flag da aplicação. Invariantes de elegibilidade preservados: **conta criada ≠ loja ≠ benefício** — apenas `verification_status='approved'` concede os 10 créditos de onboarding. Cidade/UF viram gate de **elegibilidade** (não de geração: `check_store_readiness` F34 intocado, sem bloqueio retroativo). O CNAE — capturado pelos providers mas nunca usado no motor — ganha avaliação determinística segmento×CNAE que **nunca rejeita exclusivamente por CNAE** (normalização da subclasse com **7 dígitos** + DV). O motor corrige a lacuna da F33 em que um CNPJ `INAPTA` poderia ser aprovado (hoje só `SUSPENSA` é revisado).

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                       ✓
  ├── F31.1 — Modelo Comercial — Formulário                      ✓
  ├── F31.2 — Diretores por Intenção                             ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                             ✓
  ├── F33 — Verificação CNPJ Freemium                            ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)     ✓
  ├── F35 — Changelog / Novidades                                ✓
  ├── F36 — Onboarding: Navegação por Abas                       ✓
  ├── F38 — Tabela de Custos por Operação                        ✓
  ├── F38.1 — Apuração de Custos de IA por Entrega               ✓
  ├── F38.2 — Admin de Custos + Config. Econômicas               ✓
  ├── F38.2.1 — Snapshot Econômico                               ✓
  ├── F39 — Brief Estruturado de Campanha                        ✓
  ├── F40 — Campos Comerciais e Avisos do Brief                  ✓ (9/9, UAT 6/6)
  ├── F41 — Mídia de Campanha Mobile                             ✓ (13/13, UAT 6/6)
  ├── F42 — Signup Controlado e Elegibilidade Freemium           ← esta fase (signup público)
  ├── F37 — Revisão e Aprovação da Arte                          ○ depois (experimento controlado beta)
  └── F43 — Stripe / Monetização Pública                         ○ v1.7, pós-beta (renumerada de F42)

Depois desta fase (sequenciamento recomendado):
  F41 (mídia) → F42 (signup controlado) → F37 (revisão/aprovação) → [catálogo — fase futura] → F43 (Stripe)
```

A F42 é a porta de entrada do produto: hoje o visitante que chega à landing **não consegue criar conta** — o `/signup` está neutralizado ("Beta fechado"), o fluxo é a solicitação de acesso manual (formulário na landing → tabela `access_requests` → admin aprova apenas mudando status → **criação de usuário feita à mão no Supabase Dashboard**). A F42 reabre o cadastro com **Google OAuth como método principal** (fricção baixa, aderência do público lojista) e **email/senha como fallback** — ambos com segurança (Turnstile para email/senha, callback PKCE para OAuth, confirmação de email para o caminho email/senha, feature flag de kill switch) — e conecta o novo usuário à elegibilidade freemium já existente (F32/F33), garantindo que **abrir a porta não libere crédito indevidamente**.

**Estado real em código (explorado nesta fase):**

- **Cadastro público inexistente hoje:**
  - `src/app/(auth)/signup/page.tsx` está **neutralizado** — mostra "Beta fechado" e encaminha para "Solicitar acesso free" (`:13-30`). **Zero ocorrências de `auth.signUp`** e **zero de `signInWithOAuth`** no código atual.
  - O formulário original de signup existe no histórico git (commit `3bf01fc` e seguintes, ex. `41986f0:src/app/(auth)/signup/signup-form.tsx`): email + senha (mín. 6) + confirmar senha, declaração de ciência da Política de Privacidade (modal), consentimento opcional de comunicações, `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm` } })`, grava `privacyPending` no `sessionStorage` e **sempre** redireciona para `/check-email?type=signup` (anti-enumeração — erro é silencioso).
  - `/check-email` já suporta `type=signup` e `type=recovery` (`src/app/(auth)/check-email/page.tsx:14-19`).
  - **Callback de auth atual é só de email/OTP:** `src/app/auth/confirm/route.ts` lê apenas `token_hash` + `type` e chama `verifyOtp` (`:8-23`); **não processa `code` de OAuth**. A F42 precisará de `/auth/callback` separado para `exchangeCodeForSession` (PKCE).
  - `getSiteUrl()` exige `NEXT_PUBLIC_SITE_URL` e **lança erro** se não estiver definida (`src/lib/supabase/site-url.ts:1-2`) — contrato de configuração que a F42 formaliza.
  - **Config local (Supabase CLI) divergente do contrato:** `supabase/config.toml` tem `enable_signup = true` (`:176`), `minimum_password_length = 6` (`:182`), `enable_confirmations = false` (`:226`), captcha descomentado **desligado** (`:213-217`) e **nenhum provider Google** configurado — o runbook da fase exige paridade local/preview/produção (D13).
- **Fluxo de acesso atual (convite manual):** landing → `POST /api/access-requests` → `access_requests(status='pending')` → admin em `/admin/access-requests` → RPC `admin_review_access_request` (muda status + `admin_audit_log` na mesma transação; **NÃO cria usuário, NÃO envia email**) → depois o operador cria a conta manualmente no Supabase Dashboard (documentado em `.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md`, decisão D13 "MVP sem email convite"). Índice único parcial `uq_access_requests_email_active` impede duplicatas pending/approved; rejected permite re-solicitação (`20260810010000_create_access_requests.sql:58-60`).
- **Elegibilidade freemium (F32/F33) — motor atual (`src/lib/freemium/freemium-risk-service.ts:21-140`):**
  - Ordem atual: `not_found` → reject `cnpj_not_found`; `BAIXADA` → reject `cnpj_baixada`; `NULA` → reject `cnpj_nula`; `rootEligible=false` → reject `root_already_used`; `unavailable`/sem dados → defer `api_unavailable`; `SUSPENSA` → review `situacao_suspensa`; similaridade nome < 0.6 → review `nome_divergente`; `cityMatch=false` → review `cidade_divergente`; `stateMatch=false` → review `uf_divergente`; senão approved.
  - **Lacuna confirmada:** apenas `SUSPENSA` é tratado explicitamente (`:91-98`); um CNPJ **`INAPTA`** (ou qualquer status ≠ ATIVA/BAIXADA/NULA) **atravessa todas as checagens e pode ser aprovado** — contraria a intenção do alinhamento F33.
  - `cnaeCompatible` é **hardcoded `null`** (`:43`) — o CNAE é capturado pelos providers (`cnae_principal`, `cnae_descricao` em `CnpjLookupData`, `src/lib/cnpj/lookup-providers/types.ts:22-23`) mas **não é persistido em `stores`** (fica em `cnpj_official_data`/`verification_data` JSONB) e **nunca entra na decisão**.
- **Onboarding (F36) e concessão:** loja nasce em **draft** (`create_store_draft`, sem créditos) → CNPJ no formulário → RPC F33 avalia e, se elegível, `try_grant_onboarding_entitlement` + `grant_credits(... 10, 'onboarding' ...)` (`20260728000001_f33_cnpj_verification.sql:159-166`, grant v2 `DEFAULT 10`). Aprovação admin de verificação também concede (auditada). `verification_status` CHECK = `('unverified','pending','approved','review','rejected','defer')`.
- **Cidade/UF:** `stores.city` e `stores.state` são **TEXT nullable** (`20260524210001_create_stores.sql:15-16`); o draft pode salvar sem elas; **`check_store_readiness` F34 NÃO as verifica** (só CNPJ/razão/nome fantasia + brand profile).
- **Admin reviews (`src/app/(app)/admin/reviews/page.tsx`):** tabela com Loja/CNPJ mascarado/Email/Data/Motivos/Ações; query em `stores` por `verification_status` com filtro por razão e join em `users` para email; mostra `verification_reasons` com `VERIFICATION_REASON_LABELS`. Não mostra razão social, nome fantasia, similaridade, cidade/UF informada × oficial, CNAE, situação cadastral original nem histórico de raiz.
- **Labels de razão (`src/lib/admin/labels.ts:28-37`):** `nome_divergente`, `cidade_divergente`, `uf_divergente`, `situacao_suspensa`, `api_unavailable`, `cnpj_baixada`, `cnpj_nula`, `root_already_used`. Falta `situacao_nao_ativa`, `localizacao_oficial_indisponivel`, `segmento_cnae_divergente` (review) e **`dados_oficiais_incompletos` (defer)**.
- **Feature flags (`src/lib/launch-config/config.ts`):** padrão `envBool("VENDEO_*", default)` — a F42 segue o mesmo padrão para `VENDEO_PUBLIC_SIGNUP_ENABLED`.
- **Legal:** docs publicados `terms-of-service-v1-3.md` (cláusula 3.1: "beta ... limitado a usuários convidados"), `privacy-policy-v1-2.md` ("beta, gratuita e fechada"), `acceptable-use-v1-1.md`. Aceite: `legal_acceptances` com `acceptance_source IN ('onboarding','login_reacceptance','admin_invite')`; `getAcceptanceStatus` devolve `current/outdated/never` (`src/lib/legal/acceptance-service.ts:43-62`); página de reaceite existe (`src/app/(app)/legal/reaccept/`); versões controladas por `legal_document_versions` (`src/lib/legal/document-versions.ts`). **O signup original também declarava ciência da Política de Privacidade** (commit 41986f0) — comportamento a restaurar.

---

## Propósito

1. **Reabrir o cadastro público de forma controlada (D2/D3/D4/D5/D15/D16)** — **Google OAuth como entrada principal** (`signInWithOAuth`, callback PKCE `/auth/callback`, escopos mínimos `openid email profile`), **email/senha como fallback** (formulário restaurado: email, senha mín. 8, confirmação, ciência da privacidade, consentimento opcional). Confirmação de email **obrigatória apenas para email/senha**; OAuth é validado pelo provedor (sem segundo email). Email/senha, login por senha e recuperação protegidos por **Turnstile via integração nativa do Supabase Auth**; **OAuth não passa por Turnstile**. Anti-enumeração com mensagens genéricas (sem revelar existência de conta). Criação de novas contas controlada **server-side** ("Allow new users to sign up") + flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (kill switch de UI/landing). Landing ganha CTA principal "Continuar com Google" com fallback para a solicitação de acesso quando a flag estiver off.
2. **Preservar e reforçar os invariantes de elegibilidade (D6)** — conta criada **não** concede crédito; loja draft **não** concede; apenas `verification_status='approved'` concede os 10 créditos de onboarding; raiz CNPJ única; aprovação idempotente e auditada. O fluxo atual (F33) já garante isso — a F42 o **mantém** ao abrir a porta (para **ambos** os caminhos: OAuth e email/senha), e adiciona testes explícitos desses invariantes.
3. **Cidade/UF como gate de elegibilidade (D7)** — obrigatórias para concluir o cadastro fiscal e para a avaliação automática; **ausência de cidade/UF do formulário mantém a loja em draft (conclusão bloqueada, sem ruído na fila admin)**; apenas cidade/UF preenchidas **sem correspondência oficial** ou **divergentes** encaminham para revisão. Sem alterar `check_store_readiness` F34 e sem bloqueio retroativo de geração.
4. **Situação cadastral não ativa corrige lacuna da F33 (D8)** — qualquer situação normalizada ≠ `ATIVA` (exceto `BAIXADA`/`NULA`, que permanecem rejeição) vai para revisão com motivo genérico **`situacao_nao_ativa`**; `situacao_suspensa` vira **legado** (exibição de histórico, sem novas emissões); admin passa a ver a situação cadastral original do provedor. Situação ausente/vazia/não normalizável em resposta resolvida **nunca aprova automaticamente** → **defer `dados_oficiais_incompletos`** (não gera review ruidoso).
5. **Compatibilidade segmento × CNAE determinística (D9)** — mapeamento versionado em código (sem IA, sem chamada externa): `compatible | incompatible | unknown` com **granularidade classe (4+DV) × subclasse (7) separada (4 conjuntos por segmento)** e validação de não-contradição em CI; apenas o **CNAE principal** é considerado; **nunca rejeita exclusivamente por CNAE** (incompatible é somente mais um sinal de revisão; unknown não penaliza).
6. **Revisão da elegibilidade e novos motivos (D10)** — ordem do motor revisada (CNPJ existe? → situação ATIVA exata → raiz única → nome ≥ 0.6 → cidade/UF → CNAE) com novos motivos (`situacao_nao_ativa`, `localizacao_oficial_indisponivel`, `segmento_cnae_divergente` para review; **`dados_oficiais_incompletos` para defer**).
7. **Admin de revisão mais rico (D11)** — comparação informado × oficial (razão social, nome fantasia, similaridade, cidade/UF, CNAE, situação cadastral original, histórico de raiz), novos labels de motivo e suporte às novas razões.
8. **Contratos e transição legal (D12)** — Terms v1.4 (fim do "apenas convidados"), Privacy v1.3 (fim do "beta fechado"), AUP v1.1 mantido; reaceite obrigatório via fluxo existente (`login_reacceptance`) e tolerância técnica para os convites beta ativos.
9. **Pronto para abrir (D13/D14)** — ordem de deploy fail-closed (código → migrations → versões legais → reaceite → config → smoke com signup off → ligar flag → monitorar), operação e UAT em preview/produção, kill switch Supabase (**"Allow new users to sign up" off** → bloqueia novas contas mantendo login de existentes) + flag de UI/landing.

**Entrega verificável:**
- Signup público restaurado com **Google OAuth (entrada principal) + email/senha (fallback)**, Turnstile (email/senha, login por senha, recuperação — não no OAuth), confirmação de email (email/senha), anti-enumeração com mensagens genéricas e consentimento opcional; feature flag off → comportamento atual preservado (landing com solicitação de acesso)
- 4 gates verdes (`vitest`, `typecheck`, `lint`, `build`) com cobertura dos novos motivos, do motor revisado e dos invariantes de concessão
- Motor: `INAPTA`/`SUSPENSA` → review `situacao_nao_ativa` (antes INAPTA passava); situação ausente → defer `dados_oficiais_incompletos`; CNAE avaliado sem rejeitar só por CNAE; cidade/UF ausentes no formulário → draft (sem review); preenchidas sem oficial → review `localizacao_oficial_indisponivel`; divergentes → review `cidade_divergente`/`uf_divergente`
- Admin reviews mostra dados informados × oficiais (incl. situação cadastral original e CNAE) e exibe labels para os 4 novos motivos (incl. defer `dados_oficiais_incompletos`)
- Trackings renumerados (F42 = Signup, F43 = Stripe) nos 6 arquivos

---

## Estado Atual / Base Para F42

```
                                    ESTADO ATUAL (pós-F41)               DEPOIS (F42)
═══════════════════════════════════════════════════════════════════════════════════════════════

Cadastro:
  /signup                           neutralizado ("Beta fechado")        Google OAuth (entrada principal) +
                                       → "Solicitar acesso free"            email/senha (fallback); formulário
  auth.signUp / signInWithOAuth     0 ocorrências de ambos                  email+senha mín. 8+confirmação+
                                                                           ciência privacidade+consentimento
  Callback OAuth                    — (só /auth/confirm com token_hash      /auth/callback (PKCE,
                                       e verifyOtp; sem exchangeCode)        exchangeCodeForSession, allowlist
                                                                           de next) + /auth/confirm (email/OTP)
  Confirmação de email              — (sem fluxo de signup)              obrigatória SÓ email/senha
                                                                           (emailRedirectTo + check-email?
                                                                           type=signup); OAuth sem 2º email
  Anti-enumeração                   n/a (sem formulário)                 mensagens genéricas (sucesso e email
                                                                           já cadastrado idênticas); captcha/
                                                                           erro operacional → "tente novamente"
  Captcha                           — (config.toml desligado)            Turnstile nativo Supabase Auth para
                                                                           email/senha, login senha e
                                                                           recuperação; OAuth NÃO passa por
                                                                           captcha (proteção do provedor)
  Criação de contas                 enable_signup = true (config.toml)   "Allow new users to sign up" (server-
                                                                           side) + VENDEO_PUBLIC_SIGNUP_ENABLED
                                                                           (UI/landing) — kill switch duplo
  Config local                      senha mín. 6; confirmação off;        paridade local/preview/prod: senha
                                       sem provider Google                 mín. 8; confirmação on; captcha;
                                                                           Google provider; URLs autorizadas;
                                                                           enable_signup; SMTP

Entrada de acesso:
  Landing CTA                       "Solicitar acesso free"              "Continuar com Google" (flag on,
                                                                           entrada principal) + "Continuar com
                                                                           email"; solicitação de acesso como
                                                                           fallback (flag off) e histórico
  Convite/access_requests           fluxo manual (approve só muda         preservado como HISTÓRICO + fila
                                       status; usuário criado à mão no      comercial + canal de contato/
                                       Dashboard)                           contingência operacional; NÃO é
                                                                           mecanismo de autorização (sem token/
                                                                           allowlist, aprovação não autoriza nada)

Elegibilidade (motor F33):
  Situação cadastral                só SUSPENSA → review (INAPTA          qualquer ≠ ATIVA (exceto BAIXADA/NULA)
                                      atravessa → pode aprovar)             → review situacao_nao_ativa;
                                                                           situação ausente → nunca aprova
  CNAE                              cnaeCompatible: null (não usado)      segmento × CNAE determinístico
                                                                           (compatible/incompatible/unknown);
                                                                           nunca rejeita só por CNAE
  Cidade/UF                         checadas quando presentes;            gate de conclusão: ausentes impedem
                                      ausência não bloqueia approval        approval automático e concessão;
                                                                           readiness F34 intocada
  Ordem do motor                    not_found/BAIXADA/NULA/root/          revisada (D10): situação ATIVA
                                      unavailable/SUSPENSA/nome/cidade/UF   exata → raiz → nome → cidade/UF → CNAE

Admin reviews:
  Conteúdo                          Loja/CNPJ mascarado/Email/Data/       dados informados × oficiais
                                      Motivos/Ações                         (razão social, fantasia, similaridade,
                                                                           cidade/UF, CNAE, situação original,
                                                                           histórico de raiz)
Motivos                           labels atuais (8) +                   + situacao_nao_ativa,
                                       situacao_suspensa                    localizacao_oficial_indisponivel,
                                                                            segmento_cnae_divergente,
                                                                            dados_oficiais_incompletos (defer)

Legal:
  Termos                            v1.3 (cláusula 3.1: "apenas            v1.4 (fim do "apenas convidados")
                                      convidados")
  Privacidade                       v1.2 ("beta, gratuita e fechada")      v1.3
  AUP                               v1.1                                  v1.1 (mantida)
  Reaceite                          fluxo existente (login_reacceptance)  usado p/ nova versão; tolerância
                                                                           técnica para convites beta ativos
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F42) |
|------|-------------------|------------------|
| **Numeração** | "F42 já era Stripe nos trackings" | **F42 = Signup Controlado e Elegibilidade Freemium; Stripe → F43 (D1)**; runbook de trackings |
| **Login social** | (não discutido na proposta inicial) | **Google OAuth como entrada principal + email/senha como fallback (D15)** — um só provedor na v1; `signInWithOAuth`, callback PKCE `/auth/callback`, escopos `openid email profile`; OAuth sem confirmação de email adicional e sem Turnstile |
| **Captcha** | "Cloudflare Turnstile ou captcha equivalente (mínimo recomendado)" | **Turnstile real via integração nativa do Supabase Auth (D3)** — `captchaToken` no `signUp`, validação server-side pelo Supabase; **aplicado a email/senha, login por senha e recuperação; NÃO ao Google OAuth**; chaves são requisito operacional; signup só abre com chaves validadas |
| **Kill switch** | "flag da app + desabilitar provider de email" | **Controle server-side real (D5)**: "Allow new users to sign up" (`enable_signup`) off impede novas contas mantendo login de existentes; flag da app controla UI/landing; provider de email não é a barreira |
| **Cidade/UF** | "não recebe crédito **nem gera campanha** enquanto incompleto" | **Gate de elegibilidade, NÃO de geração (D7)** — readiness F34 intocada; sem bloqueio retroativo; **ausência no formulário = draft bloqueado, sem ruído admin**; só divergência/ausência de correspondência oficial → review |
| **CNAE** | "nova camada de validação do segmento" | **Determinístico e versionado em código (D9)** — sem IA, sem rejeição exclusiva por CNAE; only main CNAE; unknown não penaliza; **normalização da subclasse com 7 dígitos + DV** |
| **situacao_suspensa vs nao_ativa** | "manter os dois no motor" | **Genérico `situacao_nao_ativa` + `situacao_suspensa` legado (D8)** — sem migração de histórico; admin mostra a situação cadastral original; corrige lacuna F33 (INAPTA atravessa) |
| **Senha mínima** | (histórico: 6) | **8** (D2) — coerente com o padrão de cadastro público |
| **access_requests** | "approved passa a poder criar conta em /signup" | **Sem privilégio técnico (D4)**: com signup ligado qualquer um cria; com signup desligado não há identificação pré-auth; sem token/allowlist a aprovação não autoriza nada — permanece apenas histórico, fila comercial e canal de contato/contingência |
| **Versão legal do signup** | "ciência de privacidade no signup" | **Restaura o comportamento do commit 41986f0 (D12) + cobre OAuth**: modal de ciência para email/senha; **PrivacyGate autenticado para OAuth**; consentimento registrado em `privacy_acknowledgements`/`consent_events` (não em `user_metadata`) |

---

## Decisões de Alinhamento

### D1 — Numeração: F42 = Signup Controlado e Elegibilidade Freemium (v1.5), Stripe → F43 (v1.7) + runbook de trackings

`DECIDIDO` (segue o precedente da F41 D1 / F40 D1 / F39 D1 / F37 D11)

| Antes | Depois |
|-------|--------|
| F42 = Stripe / Monetização Pública (v1.7, pós-beta) | **F42 = Signup Controlado e Elegibilidade Freemium** (nova, v1.5) |
| — | **F43 = Stripe / Monetização Pública** (v1.7, pós-beta) |

A fase conflitante é **incrementada** (não apagada).

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 42 → "Signup Controlado e Elegibilidade Freemium \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 43 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar menções a "F42 (Stripe)" para "Stripe (F43)". Adicionar bullet da F42 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F42 = Signup Controlado e Elegibilidade Freemium (v1.5), F43 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 42 → Signup; adicionar linha 43 → Stripe. Atualizar notas de renumeração e menções "Phase 42 (Stripe)" em Dependencies → F43. Atualizar Dependency Graph. Adicionar seção "### Phase 42 — Signup Controlado e Elegibilidade Freemium". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 42`. Tabela "Next Phases": F42 → "○ In progress — Signup Controlado e Elegibilidade Freemium (v1.5)"; F43 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F42)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... F42 (v1.7)" → **F43**. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F42/v1.7" → **F43/v1.7** |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F42)" → **(F43)** |

**Regras gerais (padrão F41 D1 / F40 D1 / F39 D1 / F37 D11):**
- Artefatos históricos (alinhamentos F26–F41, quick-plans, CONTEXT de fases concluídas) **não são reescritos** — refletem o estado da época.
- O `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/` será a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele.
- Renumeração de fases futuras segue a regra: a fase conflitante é incrementada (não apagada).

---

### D2 — Signup email/senha (fallback): formulário restaurado, confirmação de email, anti-enumeração com mensagens genéricas, consentimento opcional

`DECIDIDO` (restaura e moderniza o formulário original do commit 41986f0/3bf01fc, com senha mín. 8; **complementa o OAuth de D15**)

- **Formulário (`/signup`):** email + senha (mín. 8) + confirmar senha + declaração de ciência da Política de Privacidade (modal, mesmo componente `PrivacyAcknowledgeModal`) + consentimento **opcional** de comunicações comerciais. O estado `privacyPending`/consentimento via `sessionStorage` (padrão original) é preservado para o onboarding consumir. A tela de login/signup também apresenta **links para Privacidade e Termos**.
- **Chamada de auth:** `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, captchaToken } })` — confirmação de email **obrigatória no caminho email/senha** no Supabase (Provider SMTP habilitado). **Não é universal** — o OAuth (D15) não passa por segunda confirmação de email (identidade validada pelo provedor).
- **Anti-enumeração (matriz revisada):**
  - sucesso e **email já cadastrado** → **mesma resposta** (`/check-email?type=signup`), preservando anti-enumeração;
  - **captcha falhou / indisponibilidade / erro operacional** → mensagem **genérica** "Não foi possível concluir. Tente novamente." sem revelar existência de conta;
  - nunca expor se o email existe.
- **Fluxo pós-confirmação:** `/auth/confirm` → sessão criada → PrivacyGate (se sem acknowledgment) → onboarding (F36) → draft → CNPJ → elegibilidade F33/F42 (D6/D7/D9/D10).
- **Login:** `login-form.tsx` ganha "Continuar com Google" + link de criar conta com email, sem "Solicitar acesso free" quando a flag estiver on.
- **Senha mín. 8** (era 6 no histórico, `config.toml:182`) — validada no cliente, no Supabase (`minimum_password_length = 8`) e na paridade de ambiente (D13).

---

### D3 — Turnstile para email/senha, login por senha e recuperação (NÃO para Google OAuth)

`DECIDIDO` (requisito da primeira versão; sem rota própria de captcha — validação server-side pelo Supabase; **escopo claro de onde o captcha se aplica**)

- **Integração nativa:** o frontend obtém o token Turnstile e o envia como `captchaToken` nas operações de auth; o Supabase realiza a validação server-side (secret configurada no projeto). Documentação de referência: Supabase Auth CAPTCHA + Cloudflare Turnstile server-side.
- **Escopo de aplicação:** **email/senha (signup e login por senha) e recuperação de senha**. **Google OAuth NÃO passa por Turnstile** — não há contrato documentado de `captchaToken` no `signInWithOAuth`; a proteção do OAuth é do provedor (Google) somada aos controles server-side de criação (D5) e à feature flag.
- **Não criar rota própria** de captcha — evita manipulação de credenciais no backend; a validação server-side (obrigatória porque os tokens são temporários e de uso único) fica com o Supabase Auth.
- **Chaves:** `site key` pública configurada no frontend/Vercel; `secret key` no Supabase Dashboard (**nunca** no cliente); chaves de teste oficiais no ambiente local. `supabase/config.toml` ganha `[auth.captcha]` habilitado com provider `turnstile` (paridade, D13).
- **Componente reutilizável** de captcha (widget + coleta do token) aplicado às telas de signup email/senha, login por senha e recuperação. **Atenção:** ativar o CAPTCHA no Supabase pode alcançar essas operações — o planejamento confirma o comportamento da versão/configuração e adiciona o token a todas as telas afetadas para não quebrar login/recuperação existentes.
- **Comportamento de falha:** captcha indisponível/falha → **bloqueia apenas a tentativa de cadastro/login/recuperação** com **mensagem genérica** "Não foi possível concluir. Tente novamente." (D2 — sem revelar existência de conta); não degrada o restante do produto.
- **Gate de abertura:** o signup público só é ligado com as chaves de produção/preview **validadas** (D13/D14).
- **Testes:** token ausente, inválido, expirado e reutilizado (mock do serviço no backend / fluxo integrado do Supabase no ambiente de teste). **UAT em preview e produção** (incluindo login/recuperação com captcha ativado).

---

### D4 — Landing pública e fallback: CTA "Continuar com Google" + "Continuar com email", com solicitação de acesso como histórico/fila

`DECIDIDO` (coerência com a abertura; `access_requests` **não** é mecanismo de autorização)

- **Flag on:** CTA principal "Continuar com Google" → `signInWithOAuth('google')`; secundário "Continuar com email" → `/signup`. O formulário de solicitação de acesso e a tabela `access_requests` são **preservados** como **histórico, fila comercial e canal de contato/contingência operacional** (admin pode reativar).
- **`access_requests` NÃO autoriza tecnicamente nada:** com signup público ligado, qualquer pessoa pode criar conta; com signup desligado, o sistema não identifica o visitante antes da autenticação; sem token/allowlist, um registro `approved` não concede privilégio algum. Descrição correta: histórico + fila comercial + canal de contato/contingência (nunca "pode criar conta em /signup").
- **Flag off (estado atual):** landing continua exatamente como hoje ("Solicitar acesso free" + formulário). Fallback determinístico pela flag.
- **Acesso a `/signup` com flag off:** mostra a página de "Beta fechado" atual (comportamento preservado) ou redireciona para a landing — definido no planejamento.
- **Sem alteração de schema; sem migração destrutiva** em `access_requests`.

---

### D5 — Feature flag (UI/landing) + controle server-side de criação ("Allow new users to sign up")

`DECIDIDO` (barreira server-side real; a flag controla a exposição, não a criação)

- **Nova flag** `VENDEO_PUBLIC_SIGNUP_ENABLED` (`envBool` default **false** — abertura é explícita, seguindo o padrão do `launch-config/config.ts`). **Escopo de controle — distinção landing/signup × login:**
  - **landing e `/signup`:** controlados pela flag — off → CTA/formulário de solicitação de acesso e "Beta fechado" (estado atual).
  - **`/login`:** **NÃO é controlado pela flag** — após o primeiro rollout, a tela de login **continua mostrando "Continuar com Google"** sempre, para que usuários OAuth existentes acessem o sistema mesmo com o signup desligado. `enable_signup=false` (server-side) é o que efetivamente bloqueia novas contas, sem prender usuários existentes na porta.
  - Validação server-side da flag nas páginas/rotas que ela controla (não só no cliente).
- **Kill switch de emergência — duas alavancas complementares:**
  1. **Flag da app off** → landing e `/signup` escondem o cadastro (fallback para solicitação de acesso); **`/login` permanece com "Continuar com Google"** (acesso de existentes não é removido pela flag).
  2. **Supabase "Allow new users to sign up" (`enable_signup`) desligado** → **impede a criação de novas contas** (email/senha e OAuth), **mantendo login de usuários existentes** e providers disponíveis para identidades existentes. É a barreira server-side real. **Substitui o "desabilitar Provider de email" da versão anterior** — desligar apenas o email não impede a criação de usuários não confirmados e deixa de funcionar com OAuth.
- **Nota de compatibilidade:** com `enable_signup` off, `signInWithOAuth` continua funcionando para identidades já existentes; tentativa de nova identidade é bloqueada pelo Supabase.
- **Nunca alterar `enable_signup` a partir do código da app** — configuração do dashboard/projeto (D13).

---

### D6 — Invariantes de elegibilidade preservados (conta ≠ loja ≠ benefício)

`DECIDIDO` (regra central — o signup público NÃO é atalho para créditos)

| # | Invariante | Garantia atual (F33/F36) | Ação F42 |
|---|-----------|--------------------------|----------|
| 1 | Criar conta **não** concede crédito | `auth.signUp` não toca crédito; loja nasce draft sem crédito (`create_store_draft`) | Manter + teste explícito no caminho de signup |
| 2 | Loja draft **não** concede | RPCs de concessão exigem avaliação de elegibilidade | Manter |
| 3 | Apenas `verification_status='approved'` concede os 10 de onboarding | RPC F33: approved → `try_grant_onboarding_entitlement` + `grant_credits(... 10, 'onboarding' ...)`; idempotência via raiz | Manter + reforçar testes |
| 4 | Raiz CNPJ única (1 loja por raiz por benefício) | `try_grant_onboarding_entitlement` com hash de raiz | Manter |
| 5 | Aprovação idempotente e auditada | `admin_audit_log` + entitlement | Manter |
| 6 | Concessão manual de crédito = exceção admin explícita e auditável | `admin_grant_credits` + `admin_exception` | Manter (documentado no admin) |

Nenhuma migration que altere a semântica de concessão. O trabalho é de **testes e documentação** desses invariantes no contexto do signup público.

---

### D7 — Cidade/UF: gate de elegibilidade, não de geração

`DECIDIDO` (preserva `check_store_readiness` F34; sem bloqueio retroativo; **ausência no formulário não gera ruído de review**)

- **Três casos distintos:**
  1. **Cidade/UF da loja ausentes (não preenchidas)** → formulário permanece **draft**; conclusão do cadastro fiscal bloqueada; **sem aprovação automática e sem concessão**; **não cria item na fila de revisão admin** (omissão do próprio usuário, não divergência).
  2. **Cidade/UF preenchidas, mas ausentes no provedor** (sem correspondência oficial) → **review `localizacao_oficial_indisponivel`** — não há como validar correspondência.
  3. **Cidade/UF preenchidas e presentes no provedor, porém diferentes** → **review `cidade_divergente`/`uf_divergente`**.
- **`check_store_readiness` F34 intocado** — separação de conceitos: elegibilidade decide o benefício; readiness decide a capacidade técnica de gerar.
- **Sem `NOT NULL` no banco** agora (registros antigos e drafts incompletos) — a obrigatoriedade é de **semântica de conclusão**, não constraint.
- **Lojas antigas:** não perdem capacidade de geração automaticamente; a exigência de cidade/UF entra quando solicitarem ou reprocessarem a elegibilidade do benefício.
- **Exceção:** concessão manual de créditos por admin continua como exceção intencional e auditada (D6 #6).

---

### D8 — Situação cadastral não ativa (`situacao_nao_ativa`) corrige lacuna da F33

`DECIDIDO` (genérico novo; `situacao_suspensa` vira legado sem migração; admin mostra o valor original)

| Situação normalizada | Decisão | Motivo |
|---|---|---|
| `ATIVA` | Continua avaliação | — |
| `BAIXADA` | Reject | `cnpj_baixada` |
| `NULA` | Reject | `cnpj_nula` |
| Qualquer outra, ex. `SUSPENSA`, **`INAPTA`** | **Review** | **`situacao_nao_ativa`** |
| Ausente/vazia/não normalizável (em resposta resolvida) | **Defer** | **`dados_oficiais_incompletos`** |

- **Motor (`freemium-risk-service.ts:91-98`):** substitui o bloco `SUSPENSA` por "situação não-vazia ≠ `ATIVA` → review `situacao_nao_ativa`", com `BAIXADA`/`NULA` avaliados antes (rejeição). Isso corrige a lacuna em que `INAPTA` atravessava e podia ser aprovado.
- **Situação ausente/inválida:** valor **não-vazio** diferente de `ATIVA`/`BAIXADA`/`NULA` → **review** `situacao_nao_ativa`; valor **ausente/vazio/não normalizável em resposta resolvida** → **defer `dados_oficiais_incompletos`** (nunca aprova, não gera review ruidoso) — alinhado ao comportamento de `api_unavailable`.
- **`situacao_suspensa`:** label **mantido** em `VERIFICATION_REASON_LABELS` (`labels.ts:32`) **exclusivamente para exibição de registros históricos** — sem migração nem reescrita; novas avaliações passam a emitir `situacao_nao_ativa`.
- **Admin (D11):** exibe "Situação cadastral não ativa — SUSPENSA/INAPTA" usando o valor original do provedor (`signals.situacaoCadastral` / `cnpj_official_data`).

---

### D9 — Compatibilidade segmento × CNAE determinística

`DECIDIDO` (mapeamento versionado em código; sem IA; nunca rejeita só por CNAE)

- **Fonte do CNAE:** apenas o **CNAE principal** do provedor (`cnae_principal`, já capturado em `CnpjLookupData`; legível de `cnpj_official_data`/`verification_data`). Não persiste coluna nova em `stores` — leitura do JSONB já existente (evita migration e duplicidade).
- **Normalização da subclasse (7 dígitos + DV):** o código CNAE da subclasse possui **sete dígitos**, incluindo o dígito verificador; a classe possui quatro dígitos mais DV. O contrato de normalização deve remover pontuação e converter corretamente:
  ```
  4781-4/00 → 4781400   (subclasse: 7 dígitos)
  ```
  **Granularidade explícita** (estrutura oficial CNAE 2.0/IBGE): divisão = 2 dígitos; grupo = 3; classe = 4 + DV; subclasse = 7. O contrato decide em qual granularidade o mapeamento opera (recomendado: classe 4+DV ou subclasse 7, conforme a lista do segmento) — **os códigos ilustrativos deste documento NÃO devem ser copiados para implementação antes de validação na CONCLA/IBGE**.
- **Modelo:** `compatible | incompatible | unknown`:
  - `compatible` — CNAE principal **consta na lista positiva** (compatível com o segmento da loja);
  - `incompatible` — CNAE principal **consta na lista negativa explícita** (explicitamente incompatível);
  - `unknown` — CNAE ausente, inválido **ou fora de ambas as listas** → **não penaliza**.
- **Granularidade classe × subclasse EXPLÍCITA e separada:** cada lista guarda **quatro conjuntos por segmento** — `compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`. Uma **classe** (4+DV, ex.: `47814`) cobre **todas** as subclasses dela; uma **subclasse** (7, ex.: `4781400`) cobre **apenas ela**. Bloquear `4781400` na lista negativa NÃO afeta as demais subclasses da classe `47814` — para cobrir a classe inteira, lista-se `47814` em `incompatible.classes`.
- **Precedência de SUBCLASSE EXATA sobre CLASSE (regra explícita):** ordem de avaliação `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown`. Isso permite **exceções finas**: uma subclasse específica pode divergir do restante da classe (ex.: classe `47814` positiva + subclasse `4781400` negativa → `4781400` é `incompatible`, as demais subclasses seguem a classe). Sem essa regra, checar positivo antes de negativo tornaria a exceção impossível.
- **Validação em build (CI):** o **mesmo código** (string idêntica) não pode aparecer nas listas **positiva e negativa** do mesmo segmento (em classe OU subclasse) — contradição é erro de build, não runtime. **Overlap pai-filho** (classe em uma lista + subclasse dela em outra) é **permitido** e resolvido pela precedência de subclasse exata acima.
- **Regra:** CNAE **nunca é motivo de rejeição** — `incompatible` é apenas mais um sinal que, somado à avaliação, encaminha para **revisão** (`segmento_cnae_divergente`); `unknown` segue neutro.
- **Implementação:** módulo de mapeamento determinístico (função pura) com **quatro conjuntos versionados por segmento — `compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`** (mesmo padrão de `compareBusinessName`/signals puros), sem chamada externa e sem custo; comparação por subclasse (7) e/ou classe (4+DV) com granularidade exata e validação de não-contradição em CI.
- **Compatibilidade com a F40:** o `segment` da loja já é um dos segmentos validados em `stores` (CHECK) — o mapeamento usa esse enum.

---

### D10 — Motor de elegibilidade revisado: ordem + novos motivos

`DECIDIDO` (ordem explícita; novos motivos de revisão)

```
1. CNPJ existe (resolved)?  NÃO → reject cnpj_not_found / defer api_unavailable (sem dados)
2. Situação cadastral normalizada == 'ATIVA'?  (BAIXADA → reject cnpj_baixada;
   NULA → reject cnpj_nula; não-vazia e outro valor → review situacao_nao_ativa;
   ausente/inválida em resposta resolvida → defer dados_oficiais_incompletos)   [D8]
3. Raiz CNPJ já usada?  SIM → reject root_already_used
4. Similaridade nome (informado × oficial) ≥ 0.6?  NÃO → review nome_divergente
5. Cidade/UF da loja: **ausentes → draft (sem avaliação/review, conclusão bloqueada)**;
   preenchidas mas sem correspondência oficial → review localizacao_oficial_indisponivel;
   preenchidas e divergentes → review cidade_divergente/uf_divergente  [D7]
6. Segmento × CNAE: incompatible → review segmento_cnae_divergente (nunca reject)  [D9]
7. Senão → approved
```

- **Score/signals** preservados (score final ≥ 60 para approved) com adição de `cnaeCompatible` preenchido (hoje `null`).
- **Defer:** `api_unavailable` (sem dados do provedor) permanece como defer — usuário pode reprocessar depois. **`dados_oficiais_incompletos`** (situação cadastral ausente/inválida em resposta resolvida, D8) também vira defer com motivo próprio — usuário pode reprocessar; a fila admin exibe o label (D11).
- **`localizacao_oficial_indisponivel`:** **apenas** quando a loja preencheu cidade/UF mas o provedor não as fornece (não há como validar correspondência) — **não** representa omissão do usuário (caso que mantém draft, D7).

---

### D11 — Admin de revisão mais rico

`DECIDIDO` (suporte à decisão com dados informados × oficiais)

- **Novos labels em `VERIFICATION_REASON_LABELS`:** `situacao_nao_ativa` ("Situação cadastral não ativa"), `localizacao_oficial_indisponivel` ("Localização oficial indisponível"), `segmento_cnae_divergente` ("Segmento incompatível com CNAE") e **`dados_oficiais_incompletos` ("Dados oficiais incompletos")** — este último para registros **defer** (D8/D10); `situacao_suspensa` permanece para histórico (D8). Como a fila admin exibe também registros defer, sem o label o motivo apareceria cru.
- **Dados exibidos por revisão (`reviews/page.tsx` e/ou nova visão de detalhe):**
  - informado × oficial: razão social, nome fantasia, similaridade (%);
  - cidade/UF informada × cidade/UF oficial;
  - CNAE principal + descrição (lidos de `cnpj_official_data`);
  - **situação cadastral original** do provedor (ex.: "SUSPENSA", "INAPTA");
  - histórico de raiz (entitlement/freemium_entitlements) e motivo(s) atuais.
- **Ações:** manter as existentes (approve/reject/defer/exception) — a exceção admin (`admin_exception`) continua auditável (D6 #6).
- **Filtros:** filtro por motivo já existe (`?reason=`); adicionar suporte aos novos motivos sem quebra.

---

### D12 — Contratos e transição legal

`DECIDIDO` (fim do "apenas convidados"; reaceite com tolerância técnica)

| Documento | Versão atual | Versão F42 | Mudança necessária |
|---|---|---|---|
| Termos de Serviço | v1.3 | **v1.4** | Cláusula 3.1: remover "limitado a usuários convidados"; descrever acesso público gratuito com elegibilidade e critérios de liberação; autenticação por terceiros (Google OAuth) |
| Política de Privacidade | v1.2 | **v1.3** | Remover "beta, gratuita e fechada"; descrever captcha (Turnstile), confirmação de email e **autenticação por terceiros**: dados recebidos do Google (identificador, email, nome e eventualmente avatar), finalidade exclusivamente autenticacional, **nenhuma permissão adicional sobre Gmail/Drive/outros produtos** |
| Uso Aceitável | v1.1 | v1.1 (mantida) | Sem mudança de escopo |

- **Versões controladas** em `legal_document_versions` (padrão existente); **reaceite obrigatório** via fluxo atual (`getAcceptanceStatus` → `outdated` → `login_reacceptance`) — a mesma versão configurada com `effective_at` futuro habilita o reaceite antes do go-live.
- **Tolerância técnica para convites beta ativos:** lojas convidadas existentes têm a nova versão como obrigatória (reaceite no próximo acesso), mas **nenhuma loja antiga perde acesso/capacidade** ao publicar as novas versões — o bloqueio só vale para funcionalidades protegidas pelo clearance legal (padrão F30/fail-closed), sem retroatividade destrutiva.
- **Cobertura do OAuth no legal/consentimento (D15/D16):** o OAuth não passa pelo formulário tradicional — o fluxo legal não pode depender de checkbox/`sessionStorage`. O `PrivacyGate` (tela autenticada após `/auth/callback`) exige:
  1. Tela de login/signup apresenta **links para Privacidade e Termos**;
  2. OAuth retorna autenticado para `/auth/callback`;
  3. Usuário sem acknowledgment passa **obrigatoriamente** pelo `PrivacyGate`;
  4. Consentimento comercial opcional registrado nessa etapa autenticada;
  5. Só depois segue para onboarding.
- **Fonte da verdade do consentimento:** `privacy_acknowledgements` e `consent_events` (padrões existentes). **NÃO usar `user_metadata.communicationsOptIn` como evidência legal.**
- **Signup email/senha declara ciência da Privacidade** (modal) + consentimento opcional de comunicações (restauração do comportamento original, D2).

---

### D13 — Pronto para abrir (operação, configuração e paridade de ambiente)

`DECIDIDO` (ordem de deploy fail-closed; paridade local/preview/produção; runbook operacional)

```
1. Publicar código (OAuth + formulário + callback + motor + admin + landing) → flag OFF (default)
2. Migrations (não destrutivas; labels/RPCs idempotentes)
3. Publicar versões legais (v1.4/v1.3) + reaceite configurado   → clearance fail-closed
4. Configurar chaves Turnstile (Vercel + Supabase) + Google OAuth (client/secret) + Provider email/SMTP
5. Paridade local/preview/produção (config.toml / dashboard):
   - minimum_password_length = 8 (config.toml:182 hoje = 6)
   - enable_confirmations = true (config.toml:226 hoje = false)
   - [auth.captcha] turnstile habilitado (config.toml:213-217 hoje desligado)
   - Google provider configurado (client_id + secret) + **duas URLs de callback distintas**:
     - Google Cloud (OAuth 2.0, redirect autorizado): `https://<projeto>.supabase.co/auth/v1/callback`
     - Supabase Auth (Redirect URLs, redirect pós-auth): `https://<domínio>/auth/callback`
     - em local: usar EXATAMENTE o Callback URL apresentado pelo Supabase Dashboard/CLI
       (ex. Supabase CLI usa `http://127.0.0.1:54321/auth/v1/callback`) — não presumir host/porta;
       idem para `http://localhost:3000/auth/callback` na app; preview e produção idem
   - enable_signup / "Allow new users to sign up" = conforme o momento do rollout
   - SMTP (Provider de email) para confirmação/recuperação
6. Smoke test com flag OFF (estado atual preservado)
7. Ligar flag em preview → UAT (OAuth, email/senha, captcha, elegibilidade, legal)
8. Ligar flag em produção → monitorar (criação de conta, aprovações, suporte)
```

- **Configuração obrigatória antes do go-live:** `NEXT_PUBLIC_SITE_URL` (já exigida por `site-url.ts`), chaves Turnstile, Google OAuth (client/secret), Provider de email (SMTP) no Supabase e `enable_signup`. **Duas URLs de callback OAuth distintas e não confundíveis:** (a) **Google Cloud** — redirect autorizado aponta para o Supabase Auth (`https://<projeto>.supabase.co/auth/v1/callback`); (b) **Supabase Auth "Redirect URLs"** — aponta para a app (`https://<domínio>/auth/callback`), em local/preview/produção.
- **Ambientes:** **chaves de teste do Turnstile** (oficiais de teste da Cloudflare, `sitekey`/`secretkey` de test) no local; produção/preview com chaves **reais**. **Google OAuth NÃO tem chave de teste equivalente** — exige um cliente OAuth de desenvolvimento real (Google Cloud Console, credenciais reais) mesmo em local, com as Redirect URLs correspondentes; produção/preview com o cliente de produção. Secret do Turnstile e client secret do Google **nunca** no cliente.
- **Monitoramento:** taxa de criação de conta, confirmações, conversão para elegibilidade, fila de revisões (motivos novos), falhas de captcha, **falhas de callback OAuth (exchangeCodeForSession)**, identidades vinculadas; dashboard/observabilidade existente (F28) estendido se necessário.
- **Kill switch duplo (D5):** flag off → UI/landing escondem o cadastro; **"Allow new users to sign up" off → Supabase impede criação de novas contas** (email/senha e OAuth), mantendo login de existentes. Provider de email **não** é a barreira.

---

### D14 — Cautela e prontidão (decisões de segurança e escopo)

`DECIDIDO` (a abertura é reversível e não dá vantagem indevida)

- **Nada concede crédito por criar conta** — D6; seletividade preservada (para OAuth e email/senha).
- **Nenhum bloqueio retroativo** de lojas antigas (D7/D12).
- **Falha do captcha bloqueia só o cadastro/login/recuperação**, com mensagem genérica (D3); indisponibilidade da API CNPJ → defer, não falso negativo (D10).
- **Vinculação manual de contas fica desabilitada** (`enable_manual_linking = false`, `config.toml:180`) — apenas vinculação automática por email verificado (D15/D16).
- **Rotas de admin** (reviews/access-requests) protegidas por `requireAdmin` (padrão existente) — mantidas.
- **Escopo fechado:** esta fase **não** implementa Stripe, convites com token, prova documental, CNAEs secundários, denúncia/suspensão, reescrita de histórico, nem provedores sociais adicionais (GitHub/Facebook/Apple/Microsoft) (Fora do Escopo).

---

### D15 — Autenticação social: Google OAuth como entrada principal; email/senha como fallback

`DECIDIDO` (um só provedor na v1; OAuth reduz fricção e elimina senha própria + segundo email de confirmação)

- **Entrada principal:** "Continuar com Google" em `/signup` e `/login` via `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${getSiteUrl()}/auth/callback` } })`. O mesmo fluxo serve para **entrar e criar conta** (semântica do botão: "Continuar com Google").
- **Escopos mínimos:** `openid email profile`. **Nenhuma permissão adicional** (Gmail/Drive/outros produtos) — o Supabase recomenda limitar escopos (revisão de verificação pode ser exigida caso contrário).
- **Sem confirmação de email adicional** no OAuth: a identidade é validada pelo provedor. Confirmação de email permanece obrigatória **apenas** no caminho email/senha (D2).
- **Sem Turnstile no OAuth** (D3): proteção do provedor + controles server-side de criação (D5) + feature flag.
- **Callback PKCE próprio:** `/auth/callback` executando `exchangeCodeForSession` (D16).
- **Dados recebidos do Google:** identificador, email, nome e eventualmente avatar — finalidade exclusivamente autenticacional, informada na Privacidade v1.3 (D12).
- **Vinculação automática por email verificado:** preservada e testada (D16); **vinculação manual fica fora do escopo** (`enable_manual_linking = false`).
- **Google OAuth só abre junto com o restante do rollout (D13)** — a criação de novos usuários é controlada server-side por "Allow new users to sign up".

---

### D16 — Callback OAuth `/auth/callback` (PKCE) + passagem pelo gate legal existente

`DECIDIDO` (rota separada do `/auth/confirm`; allowlist de `next`; reuso do `PrivacyGate` já montado no layout autenticado)

- **Nova rota `src/app/auth/callback/route.ts`:** processa `code` do OAuth e chama `supabase.auth.exchangeCodeForSession(code)` (PKCE). O `/auth/confirm` (email/OTP, `verifyOtp`) permanece intacto para confirmação de email e recuperação (`src/app/auth/confirm/route.ts:8-23`).
- **Destino padrão após o callback:** redirecionar para uma rota **protegida** — **`/loja` ou `/dashboard`** — que atravessa o layout autenticado `src/app/(app)/layout.tsx`, onde o **PrivacyGate já é montado** (`layout.tsx:35`). **`/onboarding` NÃO existe** e `"/"` (landing pública) não passa pelo layout protegido — ambos descartados como destino.
- **Validação de `next`:** allowlist (ex.: `["/loja", "/dashboard"]`) — redirecionamento externo bloqueado (mesmo padrão do `VALID_NEXT` do confirm route); padrão seguro = `/loja`.
- **Reuso do PrivacyGate existente — NÃO criar novo componente:** o gate é `src/components/legal/privacy-gate.tsx:18` (client, modal `PrivacyAcknowledgeModal`, redireciona para `/conta?privacy=pending` se fechado sem confirmar). Como o callback cai no layout `(app)`, o gate dispara automaticamente para quem **não tem ciência de privacidade vigente** (`hasValidPrivacyAcknowledgement`). Nenhum novo `privacy-gate.tsx` em `components/auth/`.
- **Separação legal (dois momentos distintos — sem misturar):**
  - **Pós-auth (callback → layout `(app)`):** ciência da **Política de Privacidade** + opt-in comercial **opcional** → registrados em `privacy_acknowledgements`/`consent_events` (D12; fonte da verdade).
  - **Onboarding/criação da loja (F36):** aceite dos **Termos de Serviço + Uso Aceitável** → registrados quando o **draft da loja** é criado (`acceptance_source = 'onboarding'`), vinculados à loja (padrão F30/F36).
  - A F42 **não altera** essa separação — o signup email/senha também só registra a ciência de privacidade; os aceites contratuais (Termos/AUP) continuam na criação da loja.
- **Fluxo pós-callback:**
  1. `exchangeCodeForSession` com sucesso → sessão criada → redirect para **`/loja`** (rota protegida);
  2. layout `(app)` renderiza **PrivacyGate** para quem não tem acknowledgment vigente (ciência de privacidade + opt-in opcional);
  3. onboarding (F36) → criação do draft da loja → aceite de Termos + AUP;
  4. CNPJ → elegibilidade (D7/D8/D9/D10).
- **Identity linking (testado, não configurado manualmente):** o Supabase vincula automaticamente identidades com **mesmo email verificado**:
  - conta email confirmada + Google com mesmo email → **mesmo usuário** (sem duplicar `public.users`, lojas ou acknowledgments);
  - conta email não confirmada + Google → comportamento do Supabase validado em teste;
  - `enable_manual_linking = false` permanece.
- **Anti-enumeração no callback:** `code` inválido/expirado → erro genérico redirecionando para `/login?error=oauth_failed` (sem revelar estado da conta).
- **Testes obrigatórios:** ver tabela de testes OAuth/identity linking (D15/D16) — identity linking e `enable_signup=false` como **testes integrados/UAT com Supabase real**, não só mocks Vitest.

---

```
ARQUIVOS MODIFICADOS (principais — planejamento da fase):
═══════════════════════════════════════════════════════════════════

src/app/(auth)/signup/page.tsx                    ← formulário restaurado + Google OAuth (flag on) / "Beta fechado" (flag off)
src/components/auth/signup-form.tsx               ← (novo/restaurado) email+senha mín8+confirm+privacidade+consentimento
src/components/auth/google-button.tsx             ← (novo) "Continuar com Google" → signInWithOAuth (D15)
src/components/auth/captcha-field.tsx             ← (novo) widget Turnstile reutilizável + coleta do token (D3)
src/app/auth/callback/route.ts                    ← (novo) exchangeCodeForSession (PKCE) + allowlist de next (D16)
src/app/(auth)/check-email/page.tsx               ← (inalterado; já suporta type=signup)
src/app/auth/confirm/route.ts                     ← (inalterado — email/OTP verifyOtp permanece)
src/app/(auth)/login/login-form.tsx               ← "Continuar com Google" + criar conta (email/senha) conforme a flag
src/components/legal/privacy-gate.tsx              ← (REUSADO/evoluído — NÃO criar em components/auth/) gate legal autenticado
                                                      pós-OAuth; já montado no layout (app) (D12/D16)
src/components/landing/access-request-section.tsx ← CTA "Continuar com Google"/"Continuar com email" (flag on) / fallback (flag off)
src/lib/launch-config/config.ts                   ← + VENDEO_PUBLIC_SIGNUP_ENABLED (envBool default false)
src/lib/freemium/freemium-risk-service.ts         ← situação != ATIVA → situacao_nao_ativa; cidade/UF gate; cnaeCompatible
src/lib/freemium/types.ts                         ← sinal cnaeCompatible tipado (compatible/incompatible/unknown)
src/lib/cnpj/cnae-mapping.ts                      ← (novo) mapeamento determinístico segmento × CNAE (D9; 4 conjuntos por
                                                      segmento: classes/subclasses compatíveis E incompatíveis; validação CI)
src/lib/admin/labels.ts                           ← + situacao_nao_ativa, localizacao_oficial_indisponivel,
                                                      segmento_cnae_divergente, dados_oficiais_incompletos (defer)
src/app/(app)/admin/reviews/page.tsx              ← dados informados × oficiais (razão social, fantasia, similaridade,
                                                      cidade/UF, CNAE, situação original, histórico de raiz)
src/app/(app)/admin/reviews/review-detail.tsx     ← (novo) visão de detalhe da revisão (D11)
supabase/config.toml                              ← minimum_password_length=8; enable_confirmations=true; [auth.captcha]
                                                      turnstile; Google provider; enable_manual_linking=false
supabase/migrations/…f42_*.sql                    ← idempotente: RPCs/labels (se necessário); SEM NOT NULL em city/state

Testes (novos/co-migrados):
src/lib/freemium/__tests__/freemium-risk-service.test.ts ← INAPTA→review; situacao ausente→defer dados_oficiais_incompletos;
                                                              CNAE; cidade/UF
src/lib/cnpj/__tests__/cnae-mapping.test.ts               ← mapeamento determinístico segmento×CNAE (D9; 4 conjuntos
                                                              classe/subclasse, validação de não-contradição em CI)
src/app/(auth)/signup/__tests__/signup-form.test.tsx      ← validações, consentimento, anti-enumeração, captcha token
src/app/(auth)/signup/__tests__/signup-page.test.tsx      ← flag on/off (formulário vs "Beta fechado")
src/app/auth/callback/__tests__/route.test.ts             ← exchangeCodeForSession; next allowlist; code inválido
src/components/legal/__tests__/privacy-gate.test.tsx ← gate legal pós-OAuth; consentimento registrado (REUSO do existente)
src/components/auth/__tests__/google-button.test.tsx      ← signInWithOAuth com redirectTo correto
src/components/landing/__tests__/access-request-section.test.tsx ← CTA com flag on/off
src/app/(app)/admin/reviews/__tests__/page.test.tsx       ← novos motivos + dados informados × oficiais
src/lib/launch-config/__tests__/config.test.ts            ← VENDEO_PUBLIC_SIGNUP_ENABLED
```

---

## Contratos de Integração

```typescript
// src/lib/launch-config/config.ts — feature flag (D5)
export interface LaunchConfig {
  // ...campos atuais...
  publicSignupEnabled: boolean;   // NOVO
}

// getLaunchConfig(): publicSignupEnabled: envBool("VENDEO_PUBLIC_SIGNUP_ENABLED", false)
// Default FALSE — abertura é explícita (fail-closed).
```

```typescript
// src/app/(auth)/signup/signup-form.tsx (restaurado/novo, D2/D3)
// Campos: email, senha (mín. 8), confirmar senha, ciência da Privacidade (modal), consentimento opcional.
// validação local: password.length >= 8; password === confirm.

const token = await captchaField.getToken();      // componente reutilizável (D3)
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
    captchaToken: token,                          // integração nativa Supabase Auth (D3)
    // NOTA: consentimento NÃO é evidência legal em user_metadata. A escolha
    // (communicationsOptIn) é persistida em sessionStorage/privacyPending e
    // registrada AUTENTICADO em consent_events/privacy_acknowledgements (D12).
  },
});
// Anti-enumeração (D2): sucesso e "email já cadastrado" → /check-email?type=signup (mesma resposta);
// captcha/indisponibilidade/erro operacional → mensagem genérica "Não foi possível concluir.
// Tente novamente." — nunca revela existência de conta.
```

```typescript
// src/components/auth/google-button.tsx (D15)
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: `${getSiteUrl()}/auth/callback` },   // PKCE (D16)
  // Sem captchaToken — OAuth não passa por Turnstile (D3).
  // Escopos mínimos openid email profile (D15) — nenhuma permissão adicional.
});
```

```typescript
// src/app/auth/callback/route.ts (D16) — separado do /auth/confirm (email/OTP)
const code = searchParams.get("code");
const rawNext = searchParams.get("next");                      // allowlist (mesmo padrão do confirm)
const safeNext = rawNext && VALID_NEXT.includes(rawNext) ? rawNext : "/loja";  // padrão = rota protegida
const supabase = await createServerClient();
const { error } = await supabase.auth.exchangeCodeForSession(code); // PKCE
// erro → redirect /login?error=oauth_failed (genérico, anti-enumeração)
// sucesso → sessão criada → redirect /loja (layout (app)) → PrivacyGate para quem
//           não tem acknowledgment (ciência de Privacidade + opt-in opcional) → onboarding (F36)
// VALID_NEXT = ["/loja", "/dashboard"] — nunca "/" (landing pública) nem "/onboarding" (não existe)
```

```typescript
// src/lib/cnpj/cnae-mapping.ts — mapeamento determinístico segmento × CNAE (D9)
export type CnaeCompatibility = "compatible" | "incompatible" | "unknown";

// Granularidade CNAE 2.0: divisão (2), grupo (3), classe (4+DV → 5 chars), subclasse (7).
// O código chega com pontuação, ex. "4781-4/00" → normaliza para "4781400" (subclasse 7 dígitos).
// ATENÇÃO: os códigos ilustrativos abaixo NÃO devem ser copiados para
// implementação antes de validação na CONCLA/IBGE (estrutura oficial CNAE 2.0).

// Derivações a partir do CNAE informado (ex.: "4781-4/00"):
function normalizeCnaeSubclasse(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");            // remove pontuação (ex.: 4781-4/00 → 4781400)
  if (digits.length !== 7) return null;                // subclasse SEMPRE 7 dígitos
  return digits;                                        // ex.: "4781400"
}

function deriveCnaeClasse(subclasse: string): string { // "4781400" → "47814" (4 dígitos + DV)
  return subclasse.slice(0, 5);
}

// Granularidade EXPLÍCITA: cada lista distingue classes (4+DV, ex.: "47814") de
// subclasses (7, ex.: "4781400"). Uma classe listada cobre TODAS as subclasses dela;
// uma subclasse listada cobre APENAS ela (não a classe inteira).
type CnaeCodes = {
  classes: string[];     // ex.: "47814"
  subclasses: string[];  // ex.: "4781400"
};

// QUATRO conjuntos por segmento — compatíveis e incompatíveis, cada um com
// classes e subclasses separadas. Não pode haver o mesmo código nas listas
// positiva e negativa do mesmo segmento (validação em build, abaixo).
const CNAE_COMPATIBLE: Record<string, CnaeCodes> = {
  "moda-vestuario": {
    classes: ["47814"],                                // ILUSTRATIVO (cobre 4781-4/00 e todas as subclasses)
    subclasses: ["1411800", "1412601"],                // ILUSTRATIVO
  },
  "alimentacao-bebidas": {
    classes: ["56112", "47211"],                       // ILUSTRATIVO
    subclasses: [],
  },
  "beleza-estetica": {
    classes: ["96025", "47725"],                       // ILUSTRATIVO
    subclasses: [],
  },
  "saude-farmacia": {
    classes: ["47733"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "casa-decoracao": {
    classes: ["47547"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "eletronicos-tecnologia": {
    classes: ["47451"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "petshop": {
    classes: ["47781"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "servicos": {
    classes: ["96092"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "variedades": {
    classes: ["47121"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "outros": {
    classes: [],
    subclasses: [],
  },
};

const CNAE_INCOMPATIBLE: Record<string, CnaeCodes> = {
  "moda-vestuario": {
    classes: ["01113"],                                // ILUSTRATIVO (agricultura)
    subclasses: [],                                    // ex.: bloquear só "4781400" se desejado
  },
  "alimentacao-bebidas": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "beleza-estetica": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "saude-farmacia": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "casa-decoracao": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "eletronicos-tecnologia": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "petshop": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "servicos": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "variedades": {
    classes: ["01113"],                                // ILUSTRATIVO
    subclasses: [],
  },
  "outros": {
    classes: [],
    subclasses: [],
  },
};

// Validação em build (CI): o MESMO código não pode aparecer nas listas positiva e
// negativa do mesmo segmento (classe OU subclasse, string idêntica) — contradição
// é erro de build, não runtime.
// Overlap pai-filho (classe em uma lista + subclasse dela em outra) é PERMITIDO e
// resolvido pela precedência de subclasse exata (regra abaixo) — exceções finas.

export function cnaeCompatibilityFor(segment: string, cnaePrincipal: string | null): CnaeCompatibility {
  const normalized = cnaePrincipal ? normalizeCnaeSubclasse(cnaePrincipal) : null;
  if (!normalized) return "unknown";                 // ausente/inválido → neutro
  const classe = deriveCnaeClasse(normalized);
  const positive = CNAE_COMPATIBLE[segment];
  const negative = CNAE_INCOMPATIBLE[segment];
  // Precedência de SUBCLASSE EXATA sobre CLASSE (regra explícita — permite exceção
  // fina: uma subclasse específica pode divergir do restante da classe):
  //   negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown
  const negSub = negative?.subclasses.includes(normalized) ?? false;
  const posSub = positive?.subclasses.includes(normalized) ?? false;
  const negCls = negative?.classes.includes(classe) ?? false;
  const posCls = positive?.classes.includes(classe) ?? false;
  if (negSub) return "incompatible";                 // subclasse exata NEGATIVA prevalece
  if (posSub) return "compatible";                   // subclasse exata POSITIVA prevalece
  if (negCls) return "incompatible";                 // classe negativa cobre as subclasses dela
  if (posCls) return "compatible";                   // classe positiva cobre as subclasses dela
  return "unknown";                                  // não consta em nenhuma lista → neutro
}
// Regra (D9): compatible/incompatible são sinais de review/não-review; unknown é neutro.
// NUNCA reject por CNAE. Granularidade é exata: bloquear "4781400" NÃO afeta outras
// subclasses da classe "47814"; para cobrir a classe inteira, lista-se "47814" em .classes.
// Exceção fina: "47814" em .classes positivas + "4781400" em .subclasses negativas
// → "4781400" fica INCOMPATIBLE (subclasse exata vence); as demais subclasses seguem a classe.
```

```typescript
// src/lib/freemium/freemium-risk-service.ts — motor revisado (D8/D10)
// Antes (lacuna F33): if (signals.situacaoCadastral === "SUSPENSA") → review situacao_suspensa
// Depois (D8):
if (signals.situacaoCadastral === "BAIXADA") return { decision: "reject", reasons: ["cnpj_baixada"], ... };
if (signals.situacaoCadastral === "NULA")    return { decision: "reject", reasons: ["cnpj_nula"], ... };
// Situação NÃO-VAZIA e diferente de ATIVA/BAIXADA/NULA (ex.: SUSPENSA, INAPTA) → review
if (signals.situacaoCadastral && signals.situacaoCadastral !== "ATIVA")
  return { decision: "review", reasons: ["situacao_nao_ativa"], ... };
// Situação AUSENTE/inválida (null/""/não normalizável) em resposta resolvida
// → defer dados_oficiais_incompletos (não aprova, não gera review ruidoso)
if (signals.situacaoCadastralResolved && !signals.situacaoCadastral)
  return { decision: "defer", reasons: ["dados_oficiais_incompletos"], ... };

// Cidade/UF (D7):
//   city/state ausentes no FORMULÁRIO → draft, conclusão bloqueada, SEM review (sem ruído admin)
//   preenchidas mas oficiais ausentes (provedor sem dados) → review localizacao_oficial_indisponivel
//   informadas × oficiais divergentes → review cidade_divergente / uf_divergente
//   (impede approval automático; NÃO toca check_store_readiness)
// CNAE (D9):
//   signals.cnaeCompatible === "incompatible" → review segmento_cnae_divergente (nunca reject)
//   "unknown" → neutro (segue a avaliação)
```

```typescript
// src/lib/admin/labels.ts — novos motivos (D8/D10/D11)
export const VERIFICATION_REASON_LABELS: Record<string, string> = {
  // ...atuais...
  situacao_suspensa: "Situação suspensa",                     // LEGADO — histórico apenas (D8)
  situacao_nao_ativa: "Situação cadastral não ativa",         // NOVO (review)
  localizacao_oficial_indisponivel: "Localização oficial indisponível", // NOVO (review)
  segmento_cnae_divergente: "Segmento incompatível com CNAE", // NOVO (review)
  dados_oficiais_incompletos: "Dados oficiais incompletos",   // NOVO (defer)
};
```

```typescript
// Admin reviews (D11) — dados por revisão:
// stores.select("id, name, user_id, created_at, verification_status, verification_reasons,
//               verification_data, cnpj_normalized, cnpj_official_data")
// Exibe informado × oficial: razao_social/nome_fantasia (oficial, cnpj_official_data),
// similaridade, cidade/UF informada × oficial, cnae_principal + cnae_descricao,
// situacao_cadastral original, histórico de raiz (freemium_entitlements).
```

---

## Testes

Padrão do repositório (vitest + Testing Library). Suíte estimada ~58+ testes novos (13 + 8 + 15 + 10 + 7 + 5). Referências: D2–D16.

### Signup / flag / landing / OAuth — 13 testes
| # | Teste | Valida |
|---|-------|--------|
| 1 | Signup com flag on → formulário email/senha + "Continuar com Google"; flag off → "Beta fechado"/landing | D4/D5 |
| 2 | Validações: senha < 8 → erro; senha ≠ confirmação → erro | D2 |
| 3 | Ciência da Privacidade obrigatória (modal); consentimento de comunicações opcional | D2/D12 |
| 4 | `signUp` envia `emailRedirectTo` + `captchaToken` | D2/D3 |
| 5 | Anti-enumeração: sucesso e "email já cadastrado" → **mesma resposta** `/check-email?type=signup` | D2 |
| 6 | Anti-enumeração: captcha/indisponibilidade/erro operacional → mensagem **genérica** (não revela conta) | D2/D3 |
| 7 | Captcha: token ausente → bloqueio de cadastro (sem chamada de auth) | D3 |
| 8 | Captcha: token inválido/expirado/reutilizado → erro tratado pelo Supabase (fluxo integrado) | D3 |
| 9 | Google: `signInWithOAuth({ provider: 'google', redirectTo: /auth/callback })`; **sem** `captchaToken` | D15/D3 |
| 10 | Landing CTA: flag on → "Continuar com Google" + "Continuar com email"; flag off → "Solicitar acesso free" + formulário | D4 |
| 11 | `VENDEO_PUBLIC_SIGNUP_ENABLED` default false; parse correto | D5 |
| 12 | `approved` em `access_requests` não bloqueia novo signup do mesmo email (histórico, não autorização) | D4 |
| 13 | **UI: flag da app OFF + usuário Google existente → botão "Continuar com Google" CONTINUA visível no `/login`** (a flag esconde só landing/`/signup`, nunca o acesso de existentes) | D5 |

### Callback OAuth / identity linking — 8 testes
> **Classificação:** testes 14–16 (rota/callback) são Vitest com mocks; **testes 17–21 (identity linking e `enable_signup=false`) são integrados/UAT com Supabase real** (comportamento do Supabase Auth, não simulável em mock).

| # | Teste | Valida |
|---|-------|--------|
| 14 | `/auth/callback` com `code` válido → `exchangeCodeForSession` → sessão → PrivacyGate | D16 |
| 15 | Callback com `code` inválido/expirado → erro genérico `/login?error=oauth_failed` | D16 |
| 16 | Callback com `next` externo → **bloqueado** (allowlist) | D16 |
| 17 | Conta email confirmada + Google mesmo email → **mesmo usuário** (sem duplicar `public.users`, lojas, acknowledgments) | D16 |
| 18 | Conta email não confirmada + Google → comportamento do Supabase validado (sem duplicação) | D16 |
| 19 | Google novo → novo usuário; **sem crédito** (invariante D6) | D15/D6 |
| 20 | Google existente → login mesmo com "Allow new users to sign up" off | D5/D15 |
| 21 | Cancelar consentimento do Google → volta para login sem sessão criada | D15/D16 |

### Motor de elegibilidade — 15 testes
| # | Teste | Valida |
|---|-------|--------|
| 22 | `INAPTA` → review `situacao_nao_ativa` (corrige lacuna F33) | D8 |
| 23 | `SUSPENSA` → review `situacao_nao_ativa` (substitui `situacao_suspensa` no motor) | D8 |
| 24 | `BAIXADA`/`NULA` continuam reject (`cnpj_baixada`/`cnpj_nula`) | D8 |
| 25 | Situação não-vazia ≠ ATIVA/BAIXADA/NULA → review `situacao_nao_ativa`; **ausente/inválida em resposta resolvida → defer `dados_oficiais_incompletos`** (nunca aprova, sem review ruidoso) | D8/D10 |
| 26 | Cidade/UF ausentes na loja → **draft bloqueado, SEM review** (sem ruído na fila admin) | D7 |
| 27 | Cidade/UF preenchidas mas oficiais ausentes (provedor sem dados) → review `localizacao_oficial_indisponivel` | D7/D10 |
| 28 | Cidade/UF informadas × oficiais divergentes → review (`cidade_divergente`/`uf_divergente`) | D10 |
| 29 | CNAE compatible → segue avaliação (sem revisão por CNAE) | D9 |
| 30 | CNAE incompatible → review `segmento_cnae_divergente` (**nunca reject**) | D9 |
| 31 | CNAE unknown (ausente/inválido/fora das listas) → neutro | D9 |
| 32 | Ordem do motor: situação não ATIVA antes de raiz/nome/cidade/UF (regra D10) | D10 |
| 33 | `api_unavailable`/sem dados → defer (não falso negativo) | D10 |
| 34 | Invariante D6: signup/draft NUNCA concedem crédito (fluxo integrado, email/senha) | D6 |
| 35 | Invariante D6: signup **via Google** NUNCA concede crédito | D6/D15 |
| 36 | Invariante D6: raiz única e aprovação idempotente/auditada | D6 |

### Mapeamento CNAE — 10 testes
| # | Teste | Valida |
|---|-------|--------|
| 37 | `"4781-4/00"` → subclasse normalizada `"4781400"` (7 dígitos + DV) | D9 |
| 38 | `"4781400"` → classe derivada `"47814"` (4 dígitos + DV); representação separada classe × subclasse | D9 |
| 39 | CNAE **na lista positiva** (compatível) → compatible | D9 |
| 40 | CNAE **na lista negativa explícita** (incompatível) → incompatible | D9 |
| 41 | **Granularidade exata:** `"4781400"` em `incompatible.subclasses` NÃO torna as demais subclasses de `"47814"` incompatíveis (lista-se a classe `"47814"` para cobrir a inteira) | D9 |
| 42 | **Precedência de subclasse exata:** classe `"47814"` positiva + subclasse `"4781400"` negativa → `"4781400"` **incompatible** (exceção fina vence); demais subclasses seguem a classe | D9 |
| 43 | **Validação de não-contradição:** mesmo código (string idêntica) nas listas positiva e negativa (classe OU subclasse) → **erro de build/CI** | D9 |
| 44 | CNAE **fora de ambas as listas** → **unknown** (neutro); nulo/sem 7 dígitos → unknown | D9 |
| 45 | Segmento sem listas (`outros`) → unknown, sem penalizar | D9 |
| 46 | Lógica de match: subclasse exata (7) checada antes de classe (4+DV) — ordem `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown` | D9 |

### Admin — 7 testes
| # | Teste | Valida |
|---|-------|--------|
| 47 | Novo motivo `situacao_nao_ativa` exibido com label correto | D11 |
| 48 | `situacao_suspensa` permanece legível em registros antigos | D8/D11 |
| 49 | Revisão mostra dados informados × oficiais (razão social, fantasia, similaridade) | D11 |
| 50 | Revisão mostra CNAE principal + descrição e situação cadastral original | D11 |
| 51 | Filtro por motivo inclui os novos motivos sem quebra | D11 |
| 52 | Registro **defer** `dados_oficiais_incompletos` exibido com label "Dados oficiais incompletos" (sem aparecer cru na fila) | D8/D10/D11 |
| 53 | Exceção admin permanece auditável (`admin_exception`) | D6/D11 |

### Legal / transição — 5 testes
| # | Teste | Valida |
|---|-------|--------|
| 54 | Nova versão de Termos/Privacidade → `getAcceptanceStatus` retorna `outdated` para lojas antigas | D12 |
| 55 | Reaceite via `login_reacceptance` registra nova versão | D12 |
| 56 | Signup email/senha declara ciência da Privacidade (modal) **na primeira autenticação pós-confirmação** — aceite registrado autenticado em `privacy_acknowledgements`, **não "na criação"** | D2/D12 |
| 57 | **OAuth: sem acknowledgment → PrivacyGate obrigatório pós-callback; consentimento registrado em `privacy_acknowledgements`/`consent_events` (NÃO em `user_metadata`)** | D12/D16 |
| 58 | Clearance fail-closed: sem aceite da versão nova → funcionalidades protegidas bloqueadas | D12 |

### Regressão (obrigatória)
- Landing com flag off → comportamento idêntico ao atual (formulário de solicitação + CTA)
- `/signup` com flag off → "Beta fechado" (comportamento atual preservado)
- `/auth/confirm` (email/OTP) **inalterado** — continua processando `token_hash` + `verifyOtp` (callback novo não interfere)
- Login/recuperação de senha funcionam com o CAPTCHA ativado no Supabase (UAT)
- `freemium-risk-service` para casos approved/review/defer já cobertos (só o bloco SUSPENSA muda para o genérico)
- `reviews/page.tsx` com os 8 motivos atuais + novos (sem quebra de renderização/filtro)
- Co-migração de fixtures: `freemium-risk-service.test.ts` (novo defer `dados_oficiais_incompletos`), `labels.test.ts` (4 novos labels), `access-request-section` (novos CTAs), `login-form`, `launch-config` (novo campo)
- Paridade de `config.toml` (senha 8, confirmação on, captcha, Google provider, `enable_manual_linking=false`) não quebra o fluxo local
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Abrir signup libera crédito indevidamente** | **D6**: invariantes preservados e testados (signup/draft nunca concedem — email/senha e OAuth; só `approved` concede); entidade raiz única; concessão auditada |
| **Spam/bots no cadastro público** | **D3**: Turnstile nativo Supabase Auth (email/senha, login, recuperação) + confirmação de email (email/senha) + anti-enumeração + rate limit existente; OAuth protegido pelo provedor + `enable_signup` (D5) |
| **Kill switch ineficaz** (flag sozinha não impede criação) | **D5**: controle server-side "Allow new users to sign up" off impede novas contas (email/senha e OAuth) mantendo login de existentes; flag da app controla UI/landing |
| **OAuth cria contas não confirmadas / bypass do gate** | **D15/D16**: OAuth sem segundo email (identidade do provedor); **PrivacyGate obrigatório** pós-callback para quem não tem acknowledgment; consentimento registrado autenticado |
| **Callback OAuth quebra / open redirect** | **D16**: `/auth/callback` próprio com `exchangeCodeForSession` (PKCE); allowlist de `next`; `code` inválido → erro genérico |
| **Duplicação de contas por identity linking** | **D16**: vinculação automática por email verificado preservada e testada (testes 17-18); `enable_manual_linking=false` |
| **Ativar CAPTCHA quebra login/recuperação existentes** | **D3**: componente reutilizável + token em todas as operações afetadas (signup, login senha, recuperação); UAT obrigatória |
| **Turnstile aplicado ao OAuth por engano** | **D3**: escopo explícito — OAuth **não** envia `captchaToken` (sem contrato no `signInWithOAuth`); teste 9 |
| **Cidade/UF virarem gate de geração sem querer** | **D7**: readiness F34 intocada; sem `NOT NULL`; efeito só na elegibilidade; testes 26-28 |
| **Ausência de cidade/UF poluir a fila de revisão** | **D7**: formulário incompleto → draft, **sem review** (teste 26); só divergência/ausência de correspondência oficial gera review |
| **Lojas antigas bloqueadas retroativamente** | **D7/D12**: sem bloqueio retroativo de geração nem de acesso; exigência entra no reprocessamento de elegibilidade |
| **`situacao_suspensa` quebra histórico/auditoria** | **D8**: label mantido para exibição; sem migração nem reescrita; valor original preservado nos signals |
| **INAPTA atravessar e aprovar** (lacuna F33) | **D8**: situação ≠ ATIVA → review genérico; teste 22 |
| **Mapeamento CNAE errado rejeita loja legítima** | **D9**: nunca reject por CNAE; incompatible só revisão; unknown neutro; listas versionadas e validadas na CONCLA/IBGE (7 dígitos) |
| **Reaceite de versões legais bloqueia usuários na abertura** | **D12**: versões com `effective_at` controlado; reaceite no próximo acesso; sem retroatividade destrutiva |
| **OAuth sem cobertura legal/consentimento** | **D12/D16**: PrivacyGate + `privacy_acknowledgements`/`consent_events` (não `user_metadata`); Privacidade v1.3 descreve dados do Google |
| **Config local divergente (senha 6, confirmação off, sem provider)** | **D13**: paridade local/preview/produção (config.toml + dashboard) antes do go-live; smoke test |
| **Flag ligada sem chaves/configuração** | **D13**: ordem de deploy fail-closed; signup só abre com Turnstile + Google OAuth + SMTP + `NEXT_PUBLIC_SITE_URL` + `enable_signup` validados |
| **F41 ainda aberta** | **Resolvido** — F41 arquivada e concluída nos trackings (`openspec list` vazio, 13/13, 2033 testes, UAT 6/6); apenas confirmar que o rodapé de `.planning/ROADMAP.md` não mantenha resíduo "F41 ... em PLANEJAMENTO" antes de planejar (ver topo deste doc) |
| **Disputa visual PrivacyGate × PrivacyRecovery no caminho email/senha** | **D16 (planejamento)**: o layout `(app)` renderiza simultaneamente `PrivacyRecovery` e `PrivacyGate`, enquanto o fluxo email/senha mantém `privacyPending`/recovery de primeira autenticação — risco de modal duplicado ou "flash". Prever **uma única coordenação**: incorporar a recuperação de `privacyPending` ao próprio `PrivacyGate`, **ou** processar o pending antes de entrar no layout autenticado |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Stripe / Monetização Pública** | **F43** (v1.7, pós-beta) — renumeração D1 |
| **Provedores sociais adicionais** (GitHub/Facebook/Apple/Microsoft) | **D15** — apenas Google na v1 (aderência lojista; configuração/suporte/legal proporcionais só para o que agrega) |
| **Vinculação manual de identidades** | **D16** — `enable_manual_linking = false`; apenas vinculação automática por email verificado |
| **`user_metadata.communicationsOptIn` como evidência legal** | **D12** — fonte da verdade é `privacy_acknowledgements`/`consent_events` |
| **Convites por token/link** | Fluxo de convite atual (manual) é suficiente para o controle; tokens ficam para extensão futura |
| **Prova documental no cadastro** | Não requerida nesta fase — verificação CNPJ + revisão admin (D11) cobrem a seletividade |
| **CNAEs secundários** | Apenas o **CNAE principal** entra na avaliação (D9) |
| **Denúncia/suspensão de contas** | Fora do escopo — controle operacional futuro |
| **`NOT NULL` em `city`/`state`** | **D7** — obrigatoriedade semântica, não constraint (registros antigos e drafts) |
| **Reescrita de histórico (`situacao_suspensa`)** | **D8** — histórico imutável; label legado mantido |
| **F37 — Revisão e Aprovação da Arte** | Fase própria, após F42 |
| **Migração do `access_requests` ou alteração de schema** | **D4** — tabela preservada como histórico/fila; sem migração destrutiva |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Numeração: F42 = Signup Controlado e Elegibilidade Freemium (v1.5), Stripe → F43 (v1.7); runbook de trackings aplicado (6 arquivos); pré-requisito de limpeza da F41 verificado
- [ ] D2 — Signup restaurado (email, senha mín. 8, confirmação, ciência da privacidade, consentimento opcional), confirmação de email, anti-enumeração
- [ ] D3 — Turnstile via integração nativa do Supabase Auth (`captchaToken`) **aplicado a email/senha, login por senha e recuperação; NÃO ao Google OAuth**; componente reutilizável; chaves como requisito de abertura; falha bloqueia só a operação com mensagem genérica
- [ ] D4 — Landing CTA "Continuar com Google" + "Continuar com email" (flag on) com fallback para solicitação de acesso (flag off); `access_requests` preservado como histórico/fila (não autorização)
- [ ] D5 — Flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (default false) + **"Allow new users to sign up" server-side** (impede novas contas, mantém login de existentes); Provider de email **não** é a barreira
- [ ] D6 — Invariantes: conta ≠ loja ≠ benefício; só `approved` concede 10 créditos; raiz única; idempotência/auditoria (email/senha **e** OAuth)
- [ ] D7 — Cidade/UF como gate de elegibilidade; ausência no formulário → draft **sem review**; `check_store_readiness` F34 intocada; sem bloqueio retroativo
- [ ] D8 — Situação ≠ ATIVA → review `situacao_nao_ativa` (corrige INAPTA da F33); `situacao_suspensa` legado; situação ausente/inválida em resposta resolvida → **defer `dados_oficiais_incompletos`** (nunca aprova)
- [ ] D9 — Segmento × CNAE determinístico (compatible/incompatible/unknown); só CNAE principal; **subclasse 7 dígitos + DV e classe 4+DV representadas SEPARADAMENTE (4 conjuntos por segmento)**; **precedência de subclasse exata sobre classe** (`negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown`); validação de não-contradição em CI; nunca reject por CNAE; listas validadas na CONCLA/IBGE
- [ ] D10 — Motor revisado (ordem + novos motivos `localizacao_oficial_indisponivel`/`segmento_cnae_divergente`/**`dados_oficiais_incompletos` (defer)**)
- [ ] D11 — Admin reviews com dados informados × oficiais + novos labels (incl. **`dados_oficiais_incompletos` → "Dados oficiais incompletos"** para a fila de defer)
- [ ] D12 — Terms v1.4 + Privacy v1.3 (AUP v1.1); Privacy v1.3 cobre autenticação por terceiros (dados do Google, finalidade autenticacional); **consentimento em `privacy_acknowledgements`/`consent_events`**; reaceite via `login_reacceptance`; sem retroatividade destrutiva
- [ ] D13 — Ordem de deploy fail-closed + runbook operacional + **paridade local/preview/produção** (senha 8, confirmação, captcha, Google provider com as DUAS callback URLs, enable_signup, SMTP); local usa exatamente o Callback URL do Supabase CLI/Dashboard; Turnstile com chaves de teste, Google com cliente OAuth de desenvolvimento real
- [ ] D14 — Escopo fechado; reversível; seletividade preservada
- [ ] D15 — Google OAuth entrada principal; email/senha fallback; escopos `openid email profile`; sem confirmação adicional e sem Turnstile no OAuth
- [ ] D16 — Callback `/auth/callback` (PKCE) separado do `/auth/confirm`; allowlist de `next`; PrivacyGate obrigatório pós-OAuth; identity linking automático testado

### Fluxo (comportamento preservado + novos controles)
- [ ] Landing flag off → idêntico ao atual (solicitação de acesso + formulário)
- [ ] `/signup` flag off → "Beta fechado" (preservado)
- [ ] Signup flag on (email/senha) → criar conta → `/check-email?type=signup` → confirmar email → PrivacyGate (se preciso) → onboarding → CNPJ → elegibilidade
- [ ] Google OAuth → `/auth/callback` → `exchangeCodeForSession` → PrivacyGate (sem acknowledgment) → onboarding → CNPJ → elegibilidade
- [ ] OAuth NÃO exige segundo email de confirmação; NÃO passa por Turnstile
- [ ] Turnstile: token válido passa (email/senha, login senha, recuperação); ausente/inválido/expirado/reutilizado bloqueia com mensagem genérica
- [ ] "Allow new users to sign up" off → nova conta bloqueada (email/senha e OAuth), login de existentes funciona
- [ ] **Flag da app OFF → `/login` continua exibindo "Continuar com Google"** (botão visível para usuário Google existente; a flag não esconde acesso)
- [ ] Coordenação única PrivacyGate × PrivacyRecovery no caminho email/senha (sem modal duplicado / sem "flash")
- [ ] `INAPTA` → revisão `situacao_nao_ativa` (antes atravessava)
- [ ] Cidade/UF ausentes no formulário → draft sem review; sem crédito; sem geração gratuita; readiness F34 intocada; loja antiga não bloqueada
- [ ] CNAE incompatible → revisão; unknown → neutro; nenhuma rejeição por CNAE
- [ ] Admin reviews mostra informado × oficial (razão social, similaridade, cidade/UF, CNAE, situação original, raiz)
- [ ] Reaceite da v1.4/v1.3 funciona para lojas beta ativas sem perda de acesso

### Snapshot / auditoria
- [ ] Nenhuma migration destrutiva; `city`/`state` permanecem nullable (D7)
- [ ] Histórico de `situacao_suspensa` intacto e legível; novas avaliações usam `situacao_nao_ativa`
- [ ] Concessão de crédito apenas por RPCs auditados (F33/F32), nunca por signup (nem via OAuth)
- [ ] Sem duplicação de `public.users`, lojas ou acknowledgments no identity linking (testes 17-18)

### Renumeração (D1 — trackings)
- [ ] `ROADMAP.md` (raiz) — F42 = Signup; F43 = Stripe
- [ ] `.planning/ROADMAP.md` — phase numbering, tabela Progress, notas, deps, graph, seção Fase 42; rodapé apenas como confirmação de que **não há** resíduo "F41 ... em PLANEJAMENTO" (F41 já arquivada)
- [ ] `.planning/STATE.md` — frontmatter, Current Position, Next Phases, Last updated
- [ ] `.planning/PROJECT.md` — Stripe F42 → F43; rodapé
- [ ] `.planning/REQUIREMENTS.md` — v1.7 "F42" → "F43"
- [ ] `.planning/MILESTONES.md` — "v1.7 (F42)" → "(F43)"

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo co-migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] Flag off → landing/signup idênticos ao atual; **`/login` continua exibindo "Continuar com Google"** (acesso de existentes)
- [ ] Flag on → criar conta (email/senha): confirmar email, onboarding, CNPJ, elegibilidade (casos: ATIVA ok; INAPTA revisão; cidade/UF ausente sem crédito)
- [ ] Flag on → Google OAuth: `/auth/callback`, PrivacyGate, onboarding, CNPJ, elegibilidade; sem segundo email de confirmação
- [ ] Coordenação única PrivacyGate × PrivacyRecovery: primeira autenticação email/senha sem modal duplicado / sem "flash"
- [ ] Turnstile (chaves de teste): token válido e inválido (email/senha, login, recuperação); OAuth sem captcha
- [ ] Login/recuperação continuam funcionando com o CAPTCHA ativado no Supabase
- [ ] "Allow new users to sign up" off → nova conta bloqueada; login de existentes ok
- [ ] Identity linking: email/senha + Google mesmo email → mesma conta (sem duplicação)
- [ ] Admin: revisar loja com novo motivo e dados informados × oficiais; aprovar/rejeitar/deferir; exceção auditável
- [ ] Fila admin exibe label "Dados oficiais incompletos" para registro defer (sem motivo cru)
