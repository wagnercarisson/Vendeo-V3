## Context

A F42 reabre o cadastro público do Vendeo de forma **controlada e reversível** (v1.5). Hoje o `/signup` está neutralizado ("Beta fechado", `src/app/(auth)/signup/page.tsx:13-30`), com **zero ocorrências de `auth.signUp` e de `signInWithOAuth`** no código; o acesso é por solicitação manual (landing → `access_requests` → admin aprova status → **usuário criado à mão no Supabase Dashboard**). O formulário original de signup existe no histórico git (commits `3bf01fc`/`41986f0`): email + senha (mín. 6) + confirmar, ciência da Privacidade (modal), consentimento opcional, `privacyPending` em `sessionStorage`, sempre `/check-email?type=signup` (anti-enumeração).

**Estado real explorado:**
- `/check-email` já suporta `type=signup` e `type=recovery` (`check-email/page.tsx:14-19`).
- Callback atual é só email/OTP: `src/app/auth/confirm/route.ts:8-23` lê `token_hash` + `type` e chama `verifyOtp`; **não processa `code` de OAuth** → a F42 cria `/auth/callback` separado para `exchangeCodeForSession` (PKCE).
- `getSiteUrl()` exige `NEXT_PUBLIC_SITE_URL` e lança erro se ausente (`site-url.ts:1-2`) — contrato formalizado pela F42.
- Config local divergente (`supabase/config.toml:176,182,226,213-217`): `enable_signup = true`, `minimum_password_length = 6`, `enable_confirmations = false`, captcha desligado, **sem provider Google** — a fase exige paridade (D13).
- Elegibilidade F32/F33 (`freemium-risk-service.ts:21-140`): ordem `not_found → BAIXADA → NULA → rootEligible → unavailable → SUSPENSA → nome → cidade → UF → approved`. **Lacuna:** `INAPTA` (e qualquer status ≠ ATIVA/BAIXADA/NULA) atravessa e pode ser aprovado. `cnaeCompatible` é hardcoded `null` (`:43`) — CNAE capturado pelos providers (`CnpjLookupData.cnae_principal`, `lookup-providers/types.ts:22-23`) mas **nunca entra na decisão**.
- `stores.city`/`stores.state` são TEXT nullable (`20260524210001_create_stores.sql:15-16`); `check_store_readiness` F34 **não** as verifica.
- Admin reviews (`admin/reviews/page.tsx`) mostra Loja/CNPJ mascarado/Email/Data/Motivos/Ações; `VERIFICATION_REASON_LABELS` (`admin/labels.ts:28-37`) tem 8 motivos; faltam os 4 novos (3 review + 1 defer).
- Legal: Terms v1.3 ("limitado a usuários convidados"), Privacy v1.2 ("beta, gratuita e fechada"), AUP v1.1; `legal_acceptances` com `acceptance_source IN ('onboarding','login_reacceptance','admin_invite')`; `getAcceptanceStatus` devolve `current/outdated/never`; PrivacyGate já montado no layout `(app)` (`layout.tsx:35`).
- Flag pattern: `launch-config/config.ts` usa `envBool("VENDEO_*", default)`.

A F42 não inventa novo mecanismo de seletividade — **preserva** a elegibilidade existente e a **endurece** (situação ≠ ATIVA, cidade/UF gate, CNAE determinístico), conectando o signup público a ela.

## Goals / Non-Goals

**Goals:**
- Reabrir o cadastro com **Google OAuth como entrada principal** (`signInWithOAuth`, callback PKCE `/auth/callback`, escopos `openid email profile`) + **email/senha como fallback** (formulário restaurado: senha mín. 8, confirmação, ciência da Privacidade via modal, consentimento opcional) — flag on/off com "Beta fechado" preservado (D2/D4/D15)
- Turnstile via integração nativa do Supabase Auth (`captchaToken`) em **email/senha (signup e login por senha) e recuperação**; **NÃO no Google OAuth**; componente reutilizável; falha bloqueia só a operação com mensagem genérica (D3)
- `/auth/callback` PKCE separado do `/auth/confirm`; allowlist de `next`; reuso do PrivacyGate do layout `(app)`; identity linking automático por email verificado testado (D16)
- Kill switch duplo: flag `VENDEO_PUBLIC_SIGNUP_ENABLED` (default false) controla landing/signup; "Allow new users to sign up" (`enable_signup`) server-side impede novas contas mantendo login de existentes; `/login` NÃO é controlado pela flag (D5)
- Invariantes de elegibilidade preservados e testados (conta ≠ loja ≠ benefício; só `approved` concede; raiz única; aprovação auditada) para email/senha **e** OAuth (D6)
- Cidade/UF como gate de elegibilidade: ausentes → pré-gate no caller/rota (draft, sem chamar o motor); sem oficial → review `localizacao_oficial_indisponivel`; divergentes → review cidade/uf_divergente; readiness F34 intocada (D7)
- Situação cadastral: qualquer ≠ ATIVA (exceto BAIXADA/NULA → reject) → review `situacao_nao_ativa` (corrige INAPTA); ausente/inválida em resposta resolvida → defer `dados_oficiais_incompletos`; `situacao_suspensa` legado (D8)
- Segmento × CNAE determinístico (D9): 4 conjuntos por segmento (classes/subclasses × compatível/incompatível), classe 4+DV × subclasse 7, precedência de subclasse exata, não-contradição em CI, nunca reject por CNAE
- Admin reviews mais rico: 4 novos labels + dados informados × oficiais (razão social, fantasia, similaridade, cidade/UF, CNAE, situação original, histórico de raiz) + visão de detalhe (D11)
- Terms v1.4 + Privacy v1.3 + AUP v1.1 mantida; reaceite via `login_reacceptance` com tolerância técnica; consentimento em `privacy_acknowledgements`/`consent_events` (nunca `user_metadata`), incluindo OAuth via PrivacyGate (D12)
- Renumeração de trackings (D1): F42 = Signup (v1.5), Stripe → F43 (v1.7); runbook 6 arquivos; pré-requisito de limpeza F41 confirmado
- Testes (~58 novos) + 4 gates verdes (`vitest`, `typecheck`, `lint`, `build`) + UAT em preview/produção (D13/D14)

**Non-Goals:**
- **Stripe / Monetização Pública** — F43 (v1.7, pós-beta) — renumeração D1
- **Provedores sociais adicionais** (GitHub/Facebook/Apple/Microsoft) — apenas Google na v1 (D15)
- **Vinculação manual de identidades** — `enable_manual_linking = false`; apenas automática por email verificado (D16)
- **`user_metadata.communicationsOptIn` como evidência legal** — fonte da verdade é `privacy_acknowledgements`/`consent_events` (D12)
- **Convites por token/link / prova documental / CNAEs secundários / denúncia-suspensão de contas** — fora do escopo (D14)
- **`NOT NULL` em `city`/`state`** — obrigatoriedade semântica, não constraint (D7)
- **Reescrita de histórico (`situacao_suspensa`)** — histórico imutável (D8)
- **Migração/alteração de schema do `access_requests`** — preservado como histórico/fila (D4)
- **Alteração da semântica de concessão** — nenhuma migration toca grants (D6)
- **Alteração do `check_store_readiness` F34** — intocado (D7)
- **Alteração do `/auth/confirm`** (email/OTP) e do `/check-email` — inalterados (D16)
- **F37 — Revisão e Aprovação da Arte** — fase própria, após F42

## Decisions

### D1 — Numeração: F42 = Signup Controlado e Elegibilidade Freemium (v1.5), Stripe → F43 (v1.7) + runbook de trackings

`DECIDIDO` (segue o precedente da F41 D1 / F40 D1 / F39 D1 / F37 D11)

| Antes | Depois |
|-------|--------|
| F42 = Stripe / Monetização Pública (v1.7, pós-beta) | **F42 = Signup Controlado e Elegibilidade Freemium** (nova, v1.5) |
| — | **F43 = Stripe / Monetização Pública** (v1.7, pós-beta) |

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 42 → "Signup Controlado e Elegibilidade Freemium \| v1.5 \| 0/0 \| ○ Pending"; adicionar linha 43 → "Stripe / Monetização Pública \| v1.7 \| 0/0 \| ○ Pending". Atualizar menções a "F42 (Stripe)" para "Stripe (F43)". Adicionar bullet da F42 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F42 = Signup Controlado e Elegibilidade Freemium (v1.5), F43 = Stripe/Monetização Pública (v1.7)". Linha da tabela Progress 42 → Signup; adicionar linha 43 → Stripe. Atualizar notas de renumeração e menções "Phase 42 (Stripe)" em Dependencies → F43. Atualizar Dependency Graph. Adicionar seção "### Phase 42 — Signup Controlado e Elegibilidade Freemium". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 42`. Tabela "Next Phases": F42 → "○ In progress — Signup Controlado e Elegibilidade Freemium (v1.5)"; F43 → "○ Future — Stripe / Monetização Pública (v1.7, pós-beta, renumerada de F42)". Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... F42 (v1.7)" → **F43**. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F42/v1.7" → **F43/v1.7** |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F42)" → **(F43)** |

**Regras gerais (padrão F41 D1 / F40 D1 / F39 D1 / F37 D11):** artefatos históricos não são reescritos; `openspec/changes/fase-42-signup-controlado-elegibilidade-freemium/` é a **fonte da verdade** da fase; renumeração de fases futuras segue a regra da fase conflitante incrementada.

**Pré-requisito de limpeza (F41):** a F41 está **arquivada e concluída** nos trackings (`openspec list` vazio, 13/13 plans, 2033 testes, UAT 6/6). Confirmar apenas que o rodapé de `.planning/ROADMAP.md` **não mantenha resíduo "F41 ... em PLANEJAMENTO"** antes de planejar a F42. Sem reescrever artefatos históricos.

### D2 — Signup email/senha (fallback): formulário restaurado, confirmação de email, anti-enumeração com mensagens genéricas, consentimento opcional

`DECIDIDO` (restaura e moderniza o formulário do commit 41986f0/3bf01fc, com senha mín. 8; complementa o OAuth de D15)

- **Formulário (`/signup`):** email + senha (mín. 8) + confirmar senha + declaração de ciência da Política de Privacidade (modal, mesmo componente `PrivacyAcknowledgeModal`) + consentimento **opcional** de comunicações comerciais. `privacyPending`/consentimento via `sessionStorage` (padrão original) preservado para o onboarding consumir. Tela apresenta links para Privacidade e Termos.
- **Chamada de auth:** `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm`, captchaToken } })` — confirmação de email **obrigatória** no caminho email/senha (Provider SMTP habilitado). OAuth (D15) **não** passa por segunda confirmação.
- **Anti-enumeração (matriz revisada):**
  - sucesso e **email já cadastrado** → **mesma resposta** (`/check-email?type=signup`);
  - **captcha falhou / indisponibilidade / erro operacional** → mensagem genérica "Não foi possível concluir. Tente novamente." sem revelar existência de conta;
  - nunca expor se o email existe.
- **Fluxo pós-confirmação:** `/auth/confirm` → sessão → PrivacyGate (se sem acknowledgment) → onboarding (F36) → draft → CNPJ → elegibilidade F33/F42.
- **Login:** `login-form.tsx` ganha "Continuar com Google" + link criar conta com email, sem "Solicitar acesso free" quando a flag estiver on.
- **Senha mín. 8** (era 6, `config.toml:182`) — validada no cliente, no Supabase (`minimum_password_length = 8`) e na paridade (D13).

### D3 — Turnstile para email/senha, login por senha e recuperação (NÃO para Google OAuth)

`DECIDIDO` (integração nativa Supabase Auth; sem rota própria de captcha; escopo explícito)

- **Integração nativa:** frontend obtém token Turnstile e envia como `captchaToken` nas operações de auth; Supabase valida server-side (secret no projeto).
- **Escopo:** **email/senha (signup e login por senha) e recuperação de senha**. **Google OAuth NÃO passa por Turnstile** — não há contrato de `captchaToken` no `signInWithOAuth`; proteção do OAuth é do provedor + controles server-side de criação (D5) + flag.
- **Sem rota própria de captcha** — evita manipulação de credenciais no backend; validação server-side fica com o Supabase Auth (tokens temporários/uso único).
- **Chaves:** site key no frontend/Vercel; secret no Supabase Dashboard (nunca no cliente); chaves de teste oficiais em local. `supabase/config.toml` ganha `[auth.captcha]` habilitado com provider `turnstile` (D13).
- **Componente reutilizável** `captcha-field.tsx` (widget + coleta do token) aplicado às telas de signup email/senha, login por senha e recuperação. **Atenção:** ativar CAPTCHA no Supabase alcança essas operações — token em todas as telas afetadas para não quebrar login/recuperação existentes.
- **Falha:** captcha indisponível/falha → **bloqueia apenas a tentativa** com mensagem genérica (D2); não degrada o restante.
- **Gate de abertura:** signup só liga com chaves de produção/preview validadas (D13/D14).
- **Testes:** token ausente, inválido, expirado e reutilizado (mock serviço / fluxo integrado); UAT em preview/produção (incluindo login/recuperação com captcha ativado).

### D4 — Landing pública e fallback: CTA "Continuar com Google" + "Continuar com email", com solicitação de acesso como histórico/fila

`DECIDIDO` (coerência com a abertura; `access_requests` **não** é mecanismo de autorização)

- **Flag on:** CTA principal "Continuar com Google" → `signInWithOAuth('google')`; secundário "Continuar com email" → `/signup`. Formulário de solicitação de acesso e tabela `access_requests` **preservados** como histórico, fila comercial e canal de contato/contingência (admin pode reativar).
- **`access_requests` NÃO autoriza tecnicamente nada:** com signup ligado qualquer um cria conta; com signup desligado o sistema não identifica o visitante pré-auth; sem token/allowlist, `approved` não concede privilégio.
- **Flag off (estado atual):** landing como hoje ("Solicitar acesso free" + formulário). Fallback determinístico pela flag.
- **Acesso a `/signup` com flag off:** mostra "Beta fechado" atual (comportamento preservado) — decisão de planejamento; sem alteração de schema; sem migração destrutiva em `access_requests`.

### D5 — Feature flag (UI/landing) + controle server-side de criação ("Allow new users to sign up")

`DECIDIDO` (barreira server-side real; a flag controla a exposição, não a criação)

- **Nova flag** `VENDEO_PUBLIC_SIGNUP_ENABLED` (`envBool` default **false**) — abertura explícita, padrão `launch-config/config.ts`. **Escopo — distinção landing/signup × login:**
  - **landing e `/signup`:** controlados pela flag — off → CTA/formulário de solicitação de acesso e "Beta fechado".
  - **`/login`:** **NÃO controlado pela flag** — após o primeiro rollout, continua mostrando "Continuar com Google" sempre, para usuários OAuth existentes acessarem mesmo com o signup desligado. `enable_signup=false` (server-side) bloqueia novas contas sem prender existentes.
  - Validação server-side da flag nas páginas/rotas que controla (não só cliente).
- **Kill switch duplo:**
  1. **Flag off** → landing/`/signup` escondem o cadastro; `/login` permanece com "Continuar com Google".
  2. **"Allow new users to sign up" (`enable_signup`) desligado** → impede criação de novas contas (email/senha e OAuth), mantendo login de existentes. **Substitui** o "desabilitar Provider de email" (que não impede criação de usuários não confirmados e não funciona com OAuth).
- **Compatibilidade:** com `enable_signup` off, `signInWithOAuth` continua funcionando para identidades existentes; nova identidade é bloqueada pelo Supabase.
- **Nunca alterar `enable_signup` a partir do código da app** — configuração do dashboard/projeto (D13).

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

Nenhuma migration que altere semântica de concessão. Trabalho de **testes e documentação** dos invariantes no contexto do signup público.

### D7 — Cidade/UF: gate de elegibilidade, não de geração

`DECIDIDO` (preserva `check_store_readiness` F34; sem bloqueio retroativo; ausência no formulário não gera review)

- **Três casos:**
  1. **Cidade/UF ausentes (não preenchidas)** → **pré-gate no caller/rota**: `evaluateFreemiumEligibility` **não é chamado**; formulário permanece **draft**; conclusão do cadastro fiscal bloqueada; **sem aprovação automática e sem concessão**; **sem item na fila de revisão admin** (omissão do usuário, não divergência). O motor **não** ganha um quinto retorno — contrato permanece `approved | review | reject | defer`.
  2. **Cidade/UF preenchidas, mas ausentes no provedor** (sem correspondência oficial) → **review `localizacao_oficial_indisponivel`**.
  3. **Cidade/UF preenchidas e presentes no provedor, porém diferentes** → **review `cidade_divergente`/`uf_divergente`**.
- **`check_store_readiness` F34 intocado** — elegibilidade decide o benefício; readiness decide a capacidade técnica de gerar.
- **Sem `NOT NULL`** agora (registros antigos e drafts incompletos) — obrigatoriedade de **semântica de conclusão**, não constraint.
- **Lojas antigas:** não perdem capacidade automaticamente; exigência entra quando solicitarem ou reprocessarem a elegibilidade.
- **Exceção:** concessão manual por admin (D6 #6).

### D8 — Situação cadastral não ativa (`situacao_nao_ativa`) corrige lacuna da F33

`DECIDIDO` (genérico novo; `situacao_suspensa` legado sem migração; admin mostra o valor original)

| Situação normalizada | Decisão | Motivo |
|---|---|---|
| `ATIVA` | Continua avaliação | — |
| `BAIXADA` | Reject | `cnpj_baixada` |
| `NULA` | Reject | `cnpj_nula` |
| Qualquer outra, ex. `SUSPENSA`, **`INAPTA`** | **Review** | **`situacao_nao_ativa`** |
| Ausente/vazia/não normalizável (em resposta resolvida) | **Defer** | **`dados_oficiais_incompletos`** |

- **Motor (`freemium-risk-service.ts:91-98`):** substitui o bloco `SUSPENSA` por "situação não-vazia ≠ `ATIVA` → review `situacao_nao_ativa`", com `BAIXADA`/`NULA` avaliados antes (rejeição). Corrige INAPTA que atravessava.
- **Situação ausente/inválida:** valor **não-vazio** ≠ `ATIVA`/`BAIXADA`/`NULA` → **review** `situacao_nao_ativa`; valor **ausente/vazio/não normalizável em resposta resolvida** → **defer `dados_oficiais_incompletos`** (nunca aprova, sem review ruidoso) — alinhado ao `api_unavailable`.
- **`situacao_suspensa`:** label mantido em `VERIFICATION_REASON_LABELS` (`labels.ts:32`) **exclusivamente para histórico** — sem migração nem reescrita; novas avaliações emitem `situacao_nao_ativa`.
- **Admin (D11):** exibe "Situação cadastral não ativa — SUSPENSA/INAPTA" com valor original do provedor (`signals.situacaoCadastral` / `cnpj_official_data`).

### D9 — Compatibilidade segmento × CNAE determinística

`DECIDIDO` (mapeamento versionado em código; sem IA; nunca rejeita só por CNAE)

- **Fonte:** apenas o **CNAE principal** do provedor (`cnae_principal`, em `CnpjLookupData`; legível de `cnpj_official_data`/`verification_data`). Sem coluna nova em `stores` — leitura do JSONB existente.
- **Normalização da subclasse (7 dígitos + DV):** `4781-4/00 → 4781400`; classe = 4 dígitos + DV. Granularidade explícita CNAE 2.0/IBGE: divisão (2), grupo (3), classe (4+DV), subclasse (7). **Códigos ilustrativos não devem ser copiados antes de validação na CONCLA/IBGE.**
- **Modelo:** `compatible | incompatible | unknown` (positiva / negativa explícita / fora de ambas → neutro).
- **Granularidade separada — 4 conjuntos por segmento:** `compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`. Classe (4+DV) cobre todas as subclasses dela; subclasse (7) cobre apenas ela.
- **Precedência de SUBCLASSE EXATA sobre CLASSE:** `negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown` — permite exceções finas (ex.: classe positiva + subclasse específica negativa).
- **Validação em build (CI):** mesmo código (string idêntica) não pode aparecer nas listas positiva e negativa do mesmo segmento (classe OU subclasse) — contradição é **erro de build**, não runtime. Overlap pai-filho (classe numa lista + subclasse dela em outra) é **permitido** e resolvido pela precedência.
- **Regra:** CNAE **nunca é motivo de rejeição** — `incompatible` é mais um sinal para **revisão** (`segmento_cnae_divergente`); `unknown` segue neutro.
- **Implementação:** módulo de mapeamento determinístico (função pura) com 4 conjuntos versionados por segmento — mesmo padrão de `compareBusinessName`/signals puros; sem chamada externa e sem custo. **Compatibilidade F40:** `segment` da loja já é enum validado em `stores` (CHECK).

### D10 — Motor de elegibilidade revisado: ordem + novos motivos

`DECIDIDO` (ordem explícita; novos motivos de revisão)

```
1. CNPJ existe (resolved)?  NÃO → reject cnpj_not_found / defer api_unavailable (sem dados)
2. Situação cadastral normalizada == 'ATIVA'?  (BAIXADA → reject cnpj_baixada;
   NULA → reject cnpj_nula; não-vazia e outro valor → review situacao_nao_ativa;
   ausente/inválida em resposta resolvida → defer dados_oficiais_incompletos)   [D8]
3. Raiz CNPJ já usada?  SIM → reject root_already_used
4. Similaridade nome (informado × oficial) ≥ 0.6?  NÃO → review nome_divergente
5. Cidade/UF da loja (sempre preenchidas aqui — **pré-gate no caller/rota**, D7):
   ausentes nunca chegam ao motor (loja permanece draft, sem avaliação/review);
   preenchidas mas sem correspondência oficial → review localizacao_oficial_indisponivel;
   preenchidas e divergentes → review cidade_divergente/uf_divergente  [D7]
6. Segmento × CNAE: incompatible → review segmento_cnae_divergente (nunca reject)  [D9]
7. Senão → approved
```

- **Score/signals preservados** (score final ≥ 60 para approved) com `cnaeCompatible` preenchido (hoje `null`).
- **Defer:** `api_unavailable` (sem dados) permanece como defer — usuário pode reprocessar. **`dados_oficiais_incompletos`** (situação ausente/inválida em resposta resolvida, D8) vira defer com motivo próprio — usuário pode reprocessar; fila admin exibe o label (D11).
- **`localizacao_oficial_indisponivel`:** **apenas** quando a loja preencheu cidade/UF mas o provedor não as fornece — não representa omissão do usuário (caso que mantém draft, D7).

### D11 — Admin de revisão mais rico

`DECIDIDO` (suporte à decisão com dados informados × oficiais)

- **Novos labels em `VERIFICATION_REASON_LABELS`:** `situacao_nao_ativa` ("Situação cadastral não ativa"), `localizacao_oficial_indisponivel` ("Localização oficial indisponível"), `segmento_cnae_divergente` ("Segmento incompatível com CNAE") e **`dados_oficiais_incompletos` ("Dados oficiais incompletos")** — este último para registros **defer** (D8/D10); `situacao_suspensa` permanece para histórico (D8). Fila admin exibe também defer — sem label o motivo apareceria cru.
- **Dados por revisão (`reviews/page.tsx` e/ou `review-detail.tsx`):**
  - informado × oficial: razão social, nome fantasia, similaridade (%);
  - cidade/UF informada × cidade/UF oficial;
  - CNAE principal + descrição (lidos de `cnpj_official_data`);
  - **situação cadastral original** do provedor (ex.: "SUSPENSA", "INAPTA");
  - histórico de raiz (entitlement/freemium_entitlements) e motivo(s) atuais.
- **Ações:** manter as existentes (approve/reject/defer/exception) — `admin_exception` continua auditável (D6 #6).
- **Filtros:** filtro por motivo já existe (`?reason=`); adicionar suporte aos novos motivos sem quebra.

### D12 — Contratos e transição legal

`DECIDIDO` (fim do "apenas convidados"; reaceite com tolerância técnica)

| Documento | Versão atual | Versão F42 | Mudança necessária |
|---|---|---|---|
| Termos de Serviço | v1.3 | **v1.4** | Cláusula 3.1: remover "limitado a usuários convidados"; descrever acesso público gratuito com elegibilidade e critérios de liberação; autenticação por terceiros (Google OAuth) |
| Política de Privacidade | v1.2 | **v1.3** | Remover "beta, gratuita e fechada"; descrever captcha (Turnstile), confirmação de email e **autenticação por terceiros**: dados recebidos do Google (identificador, email, nome e eventualmente avatar), finalidade exclusivamente autenticacional, **nenhuma permissão adicional sobre Gmail/Drive/outros produtos** |
| Uso Aceitável | v1.1 | v1.1 (mantida) | Sem mudança de escopo |

- **Versões controladas** em `legal_document_versions`; **reaceite obrigatório** via fluxo atual (`getAcceptanceStatus` → `outdated` → `login_reacceptance`) — mesma versão com `effective_at` futuro habilita o reaceite antes do go-live.
- **Tolerância técnica:** lojas convidadas existentes têm a nova versão como obrigatória (reaceite no próximo acesso), mas **nenhuma loja antiga perde acesso/capacidade** ao publicar as novas versões — bloqueio só para funcionalidades protegidas pelo clearance legal (padrão F30/fail-closed), sem retroatividade destrutiva.
- **Cobertura do OAuth (D15/D16):** o OAuth não passa pelo formulário tradicional — o fluxo legal não pode depender de checkbox/`sessionStorage`. O `PrivacyGate` (tela autenticada após `/auth/callback`) exige:
  1. Tela de login/signup apresenta **links para Privacidade e Termos**;
  2. OAuth retorna autenticado para `/auth/callback`;
  3. Usuário sem acknowledgment passa **obrigatoriamente** pelo `PrivacyGate`;
  4. Consentimento comercial opcional registrado nessa etapa autenticada;
  5. Só depois segue para onboarding.
- **Fonte da verdade do consentimento:** `privacy_acknowledgements` e `consent_events` (padrões existentes). **NÃO usar `user_metadata.communicationsOptIn` como evidência legal.**
- **Signup email/senha declara ciência da Privacidade** (modal) + consentimento opcional (restauração do comportamento original, D2).

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

- **Configuração obrigatória antes do go-live:** `NEXT_PUBLIC_SITE_URL`, chaves Turnstile, Google OAuth (client/secret), Provider de email (SMTP) e `enable_signup`. **Duas callback URLs distintas e não confundíveis:** (a) **Google Cloud** — redirect autorizado para o Supabase Auth (`https://<projeto>.supabase.co/auth/v1/callback`); (b) **Supabase Auth "Redirect URLs"** — para a app (`https://<domínio>/auth/callback`), em local/preview/produção.
- **Ambientes:** **chaves de teste do Turnstile** (oficiais de teste Cloudflare) em local; produção/preview com chaves **reais**. **Google OAuth NÃO tem chave de teste equivalente** — exige cliente OAuth de desenvolvimento real (Google Cloud Console) mesmo em local; produção/preview com cliente de produção. Secret do Turnstile e client secret do Google **nunca** no cliente.
- **Monitoramento:** taxa de criação de conta, confirmações, conversão para elegibilidade, fila de revisões (motivos novos), falhas de captcha, **falhas de callback OAuth (exchangeCodeForSession)**, identidades vinculadas; dashboard/observabilidade existente (F28) estendido se necessário.
- **Kill switch duplo (D5):** flag off → UI/landing escondem o cadastro; **"Allow new users to sign up" off → Supabase impede criação de novas contas** (email/senha e OAuth), mantendo login de existentes. Provider de email **não** é a barreira.

### D14 — Cautela e prontidão (decisões de segurança e escopo)

`DECIDIDO` (a abertura é reversível e não dá vantagem indevida)

- **Nada concede crédito por criar conta** — D6; seletividade preservada (para OAuth e email/senha).
- **Nenhum bloqueio retroativo** de lojas antigas (D7/D12).
- **Falha do captcha bloqueia só o cadastro/login/recuperação**, com mensagem genérica (D3); indisponibilidade da API CNPJ → defer, não falso negativo (D10).
- **Vinculação manual de contas desabilitada** (`enable_manual_linking = false`, `config.toml:180`) — apenas automática por email verificado (D15/D16).
- **Rotas de admin** (reviews/access-requests) protegidas por `requireAdmin` (padrão existente) — mantidas.
- **Escopo fechado:** não implementa Stripe, convites com token, prova documental, CNAEs secundários, denúncia/suspensão, reescrita de histórico, nem provedores sociais adicionais (Fora do Escopo).

### D15 — Autenticação social: Google OAuth como entrada principal; email/senha como fallback

`DECIDIDO` (um só provedor na v1; OAuth reduz fricção e elimina senha própria + segundo email de confirmação)

- **Entrada principal:** "Continuar com Google" via `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${getSiteUrl()}/auth/callback` } })`. Mesmo fluxo para **entrar e criar conta**. **Visibilidade conforme a flag (D5):** `/login` sempre; `/signup` apenas com `publicSignupEnabled = true`; landing apenas com a flag ligada.
- **Escopos mínimos:** `openid email profile`. **Nenhuma permissão adicional** (Gmail/Drive/outros) — Supabase recomenda limitar escopos (revisão de verificação pode ser exigida caso contrário).
- **Sem confirmação de email adicional** no OAuth — identidade validada pelo provedor. Confirmação de email obrigatória **apenas** no caminho email/senha (D2).
- **Sem Turnstile no OAuth** (D3): proteção do provedor + controles server-side de criação (D5) + feature flag.
- **Callback PKCE próprio:** `/auth/callback` executando `exchangeCodeForSession` (D16).
- **Dados recebidos do Google:** identificador, email, nome e eventualmente avatar — finalidade exclusivamente autenticacional, informada na Privacidade v1.3 (D12).
- **Vinculação automática por email verificado:** preservada e testada (D16); **vinculação manual fora do escopo** (`enable_manual_linking = false`).
- **Google OAuth só abre junto com o restante do rollout (D13)** — criação de novos usuários controlada server-side por "Allow new users to sign up".

### D16 — Callback OAuth `/auth/callback` (PKCE) + passagem pelo gate legal existente

`DECIDIDO` (rota separada do `/auth/confirm`; allowlist de `next`; reuso do `PrivacyGate` do layout autenticado)

- **Nova rota `src/app/auth/callback/route.ts`:** processa `code` e chama `supabase.auth.exchangeCodeForSession(code)` (PKCE). `/auth/confirm` (email/OTP, `verifyOtp`) permanece intacto (`auth/confirm/route.ts:8-23`).
- **Destino padrão:** redirecionar para rota **protegida** — **`/loja` ou `/dashboard`** — que atravessa o layout autenticado `(app)`, onde o **PrivacyGate já é montado** (`layout.tsx:35`). **`/onboarding` não existe** e `"/"` (landing pública) não passa pelo layout protegido — ambos descartados.
- **Validação de `next`:** allowlist (`["/loja", "/dashboard"]`) — redirect externo bloqueado (padrão do `VALID_NEXT` do confirm); padrão seguro = `/loja`.
- **Reuso do PrivacyGate — NÃO criar novo componente:** `src/components/legal/privacy-gate.tsx:18` (client, modal `PrivacyAcknowledgeModal`, redireciona para `/conta?privacy=pending` se fechado sem confirmar). Como o callback cai no layout `(app)`, o gate dispara automaticamente para quem não tem ciência vigente (`hasValidPrivacyAcknowledgement`). Nenhum novo `privacy-gate.tsx` em `components/auth/`.
- **Separação legal (dois momentos distintos):**
  - **Pós-auth (callback → layout `(app)`):** ciência da **Política de Privacidade** + opt-in comercial **opcional** → registrados em `privacy_acknowledgements`/`consent_events` (D12; fonte da verdade).
  - **Onboarding/criação da loja (F36):** aceite dos **Termos + Uso Aceitável** → registrados quando o **draft da loja** é criado (`acceptance_source = 'onboarding'`), vinculados à loja (padrão F30/F36).
  - A F42 **não altera** essa separação — o signup email/senha também só registra a ciência de privacidade; aceites contratuais continuam na criação da loja.
- **Fluxo pós-callback:**
  1. `exchangeCodeForSession` com sucesso → sessão → redirect **`/loja`** (protegida);
  2. layout `(app)` renderiza **PrivacyGate** para quem não tem acknowledgment vigente;
  3. onboarding (F36) → criação do draft → aceite de Termos + AUP;
  4. CNPJ → elegibilidade (D7/D8/D9/D10).
- **Identity linking (testado, não configurado manualmente):** Supabase vincula automaticamente identidades com **mesmo email verificado**:
  - conta email confirmada + Google mesmo email → **mesmo usuário** (sem duplicar `public.users`, lojas ou acknowledgments);
  - conta email não confirmada + Google → comportamento validado em teste;
  - `enable_manual_linking = false` permanece.
- **Anti-enumeração no callback:** `code` inválido/expirado → erro genérico `/login?error=oauth_failed`.
- **Testes obrigatórios:** tabela de testes OAuth/identity linking — identity linking e `enable_signup=false` como **testes integrados/UAT com Supabase real**, não só mocks Vitest.
- **Coordenação PrivacyGate × PrivacyRecovery (risco do alinhamento):** o layout `(app)` renderiza simultaneamente `PrivacyRecovery` e `PrivacyGate`, enquanto o fluxo email/senha mantém `privacyPending`/recovery de primeira autenticação — risco de modal duplicado ou "flash". Prever **uma única coordenação**: incorporar a recuperação de `privacyPending` ao próprio `PrivacyGate`, **ou** processar o pending antes de entrar no layout autenticado.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Abrir signup libera crédito indevidamente** | **D6**: invariantes preservados e testados (signup/draft nunca concedem — email/senha e OAuth; só `approved` concede); raiz única; concessão auditada |
| **Spam/bots no cadastro público** | **D3**: Turnstile nativo Supabase Auth (email/senha, login, recuperação) + confirmação de email (email/senha) + anti-enumeração + rate limit existente; OAuth protegido pelo provedor + `enable_signup` (D5) |
| **Kill switch ineficaz** (flag sozinha não impede criação) | **D5**: controle server-side "Allow new users to sign up" off impede novas contas (email/senha e OAuth) mantendo login de existentes; flag controla UI/landing |
| **OAuth cria contas não confirmadas / bypass do gate** | **D15/D16**: OAuth sem segundo email (identidade do provedor); **PrivacyGate obrigatório** pós-callback; consentimento registrado autenticado |
| **Callback OAuth quebra / open redirect** | **D16**: `/auth/callback` próprio com `exchangeCodeForSession` (PKCE); allowlist de `next`; `code` inválido → erro genérico |
| **Duplicação de contas por identity linking** | **D16**: vinculação automática por email verificado preservada e testada (testes 17-18); `enable_manual_linking=false` |
| **Ativar CAPTCHA quebra login/recuperação existentes** | **D3**: componente reutilizável + token em todas as operações afetadas (signup, login senha, recuperação); UAT obrigatória |
| **Turnstile aplicado ao OAuth por engano** | **D3**: escopo explícito — OAuth **não** envia `captchaToken` (sem contrato no `signInWithOAuth`); teste 9 |
| **Cidade/UF virarem gate de geração sem querer** | **D7**: readiness F34 intocada; sem `NOT NULL`; efeito só na elegibilidade; testes 26-28 |
| **Ausência de cidade/UF poluir a fila de revisão** | **D7**: formulário incompleto → **pré-gate no caller/rota** (loja fica draft, motor não é chamado, **sem review** — teste 26); só divergência/ausência de correspondência oficial gera review |
| **Lojas antigas bloqueadas retroativamente** | **D7/D12**: sem bloqueio retroativo de geração nem de acesso; exigência entra no reprocessamento de elegibilidade |
| **`situacao_suspensa` quebra histórico/auditoria** | **D8**: label mantido para exibição; sem migração nem reescrita; valor original preservado nos signals |
| **INAPTA atravessar e aprovar** (lacuna F33) | **D8**: situação ≠ ATIVA → review genérico; teste 22 |
| **Mapeamento CNAE errado rejeita loja legítima** | **D9**: nunca reject por CNAE; incompatible só revisão; unknown neutro; listas versionadas e validadas na CONCLA/IBGE (7 dígitos) |
| **Reaceite de versões legais bloqueia usuários na abertura** | **D12**: versões com `effective_at` controlado; reaceite no próximo acesso; sem retroatividade destrutiva |
| **OAuth sem cobertura legal/consentimento** | **D12/D16**: PrivacyGate + `privacy_acknowledgements`/`consent_events` (não `user_metadata`); Privacidade v1.3 descreve dados do Google |
| **Config local divergente (senha 6, confirmação off, sem provider)** | **D13**: paridade local/preview/produção (config.toml + dashboard) antes do go-live; smoke test |
| **Flag ligada sem chaves/configuração** | **D13**: ordem de deploy fail-closed; signup só abre com Turnstile + Google OAuth + SMTP + `NEXT_PUBLIC_SITE_URL` + `enable_signup` validados |
| **F41 resíduo de tracking** | **D1**: pré-requisito de limpeza — confirmar que o rodapé de `.planning/ROADMAP.md` não mantenha "F41 ... em PLANEJAMENTO" antes de planejar |
| **Disputa visual PrivacyGate × PrivacyRecovery no caminho email/senha** | **D16 (planejamento)**: coordenação única — incorporar a recuperação de `privacyPending` ao próprio `PrivacyGate`, ou processar o pending antes do layout autenticado |

## Migration Plan

**Migrations:** idempotentes e **não destrutivas** (D7/D14). Versões legais (Terms v1.4, Privacy v1.3) publicadas em `legal_document_versions` com `effective_at` controlado (D12) — `effective_at` futuro habilita o reaceite antes do go-live. Se necessário, RPCs/labels idempotentes. **SEM `NOT NULL` em `city`/`state`** (D7). **SEM migration que altere semântica de concessão** (D6). **SEM alteração de schema em `access_requests`** (D4). `situacao_suspensa` **sem migração/reescrita** — histórico imutável (D8).

**Configuração (D13):** `supabase/config.toml` — `minimum_password_length = 8`, `enable_confirmations = true`, `[auth.captcha]` turnstile habilitado, Google provider (client_id + secret), `enable_manual_linking = false`. Paridade local/preview/produção (dashboard): chaves Turnstile, Google OAuth (client/secret), SMTP, `enable_signup`. **Duas callback URLs** não confundíveis (Google Cloud redirect → Supabase Auth; Supabase "Redirect URLs" → app).

**Deploy (ordem fail-closed, D13):** (1) código com flag OFF (default) → (2) migrations/versões legais → (3) chaves Turnstile + Google + SMTP → (4) paridade config → (5) smoke flag OFF → (6) flag ON preview + UAT → (7) flag ON produção + monitorar. Rollback: flag OFF (UI/landing) e/ou `enable_signup` off (server-side) — reversível a qualquer momento (D14); reverter commit não altera schema de banco.

**Trackings (D1 — runbook):** aplicar atualizações em `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md` na ordem listada na D1, após confirmar o pré-requisito de limpeza da F41.

## Open Questions

- **Nenhuma bloqueante.** Decisões explícitas registradas no alinhamento F42: callback OAuth PKCE com allowlist de `next` e reuso do PrivacyGate existente (D16); `enable_manual_linking=false` (D14/D16); escopo do captcha explícito — OAuth sem `captchaToken` (D3/D15); `access_requests` como histórico/fila, não autorização (D4); senha mín. 8 e confirmação de email obrigatória só no caminho email/senha (D2); flag default false com `/login` fora do escopo da flag (D5); cidade/UF como gate de elegibilidade sem tocar readiness F34 (D7); `situacao_nao_ativa` genérico corrige INAPTA com `situacao_suspensa` legado (D8); mapeamento CNAE determinístico com 4 conjuntos por segmento e não-contradição em CI (D9); order D10 do motor; admin com informado × oficiais e labels dos 4 novos motivos (D11); Terms v1.4 + Privacy v1.3 com consentimento em `privacy_acknowledgements`/`consent_events` (D12); paridade e ordem de deploy fail-closed (D13); teste integrado/UAT com Supabase real para identity linking e `enable_signup=false` (D16).