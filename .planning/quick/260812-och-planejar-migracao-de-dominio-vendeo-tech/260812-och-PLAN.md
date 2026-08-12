---
phase: quick-260812-och
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md
autonomous: true
requirements: [DOM-01, DOM-02, DOM-03, DOM-04, DOM-05]
must_haves:
  truths:
    - "O runbook define vendeo.tech como domínio canônico do Vendeo V3 (DOM-01)"
    - "O runbook preserva o beta fechado: landing / com CTA 'Solicitar acesso free', signup aberto desabilitado no Supabase Auth, login apenas para usuários liberados (DOM-02)"
    - "O runbook lista todas as callback/redirect URLs do Supabase Auth que devem permanecer válidas durante a transição e manda preservá-las (DOM-03)"
    - "O runbook documenta o impacto PWA: manifest com start_url /dashboard, instalação vinculada à origem, necessidade de reinstalação em vendeo.tech (DOM-04)"
    - "O runbook contém: checklist operacional numerado, checklist de rollback, checklist de UAT, decisões pendentes, COLLECT FIRST, ordem de execução e responsável (DOM-01..05)"
    - "Nenhum passo do runbook altera código, Vercel, DNS, Supabase Auth ou env vars — 100% plan-only (DOM-05)"
  artifacts:
    - path: ".planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md"
      provides: "Blueprint completo da migração de domínio (o runbook)"
      contains: "Checklist Operacional"
  key_links:
    - from: "260812-och-PLAN.md"
      to: ".planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md"
      via: "referência ao fechamento real do signup (Opção A: desabilitar 'Allow new users to sign up'; Opção B: hook allowlist)"
    - from: "260812-och-PLAN.md"
      to: "src/lib/supabase/site-url.ts + src/app/(auth)/forgot-password/forgot-password-form.tsx"
      via: "fato de código: NEXT_PUBLIC_SITE_URL é a única env derivada de domínio e é inlined em client component no build (redeploy obrigatório ao trocar)"
    - from: "260812-och-PLAN.md"
      to: "src/app/manifest.ts"
      via: "fato de código: PWA com start_url /dashboard, scope /, ícones em caminhos relativos — a instalação segue a origem (beta.vendeo.tech ≠ vendeo.tech)"
---

<objective>
Planejar — **sem executar nada** — a migração para que **vendeo.tech** se torne o domínio canônico do Vendeo V3, mantendo o beta fechado (landing pública em `/` com CTA "Solicitar acesso free", signup aberto desabilitado no Supabase Auth, login para usuários liberados) e sem quebrar login, callbacks de auth nem PWA.

**Purpose:** Hoje o produto roda sob o domínio de beta (beta.vendeo.tech) e há histórico de configuração Vercel/Supabase (projeto V1 antigo, página de manutenção, DNS) que precisa ser inventariado antes de qualquer troca. Este plano entrega o **runbook operacional completo** (checklists, ordem, rollback, UAT) que um humano seguirá manualmente em uma execução futura — este quick é **PLAN-ONLY**: o runbook é o entregável, nenhum passo toca produção.

**Output:** Este arquivo `260812-och-PLAN.md` contém o blueprint integral:
- Baseline de código (fatos confirmados) + inventário de domínios/config a preencher
- Definição de domínio canônico + decisões pendentes
- Mapeamento Vercel / Supabase Auth / PWA
- Checklist operacional numerado (runbook) com ordem de execução recomendada
- Checklist de rollback e checklist de UAT
- Lista COLLECT FIRST de informações manuais + responsável/quando executar

**Fora de escopo (declarado):** implementar código; aplicar mudanças na Vercel; alterar DNS; alterar Supabase Auth; remover/desvincular o projeto V1; deploy manual; Stripe/monetização; abrir signup público. Nenhuma task deste plano pode conter passo executável contra infra/código/env.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/260808-rqw-PLAN.md
@.planning/quick/260808-rqw-landing-p-blica-acesso-fechado-beta/SUPABASE-CLOSED-BETA.md
@.planning/quick/260808-udc-planejar-pwa-basico-clareza-no-card-de-c/260808-udc-planejar-pwa-basico-clareza-no-card-de-c-SUMMARY.md
@src/app/manifest.ts
@src/middleware.ts
@src/app/auth/confirm/route.ts
@src/lib/supabase/site-url.ts
@src/app/(auth)/forgot-password/forgot-password-form.tsx
@next.config.ts
@vercel.json
@.env.example

# O runbook abaixo é o entregável. As três tasks documentam suas seções; nenhuma executa mudança em infra.

## Baseline de código — fatos confirmados (fonte dos checklists)

- **Rotas públicas/protegidas:** `/` landing pública estática (header "Entrar" → `/login`, hero, CTA "Solicitar acesso free", formulário de acesso, footer `/termos`, `/privacidade`, `/uso-aceitavel`, `/login`); `/signup` = tela estática "Beta fechado" (sem formulário); `/login` → pós-login `router.replace(redirect && redirect !== "/" ? redirect : "/dashboard")`; `/dashboard` protegido pelo middleware; `/admin/access-requests` exige `requireAdmin`.
- **Middleware** (`src/middleware.ts`): `PUBLIC_ROUTES` = `/login /signup /check-email /forgot-password /termos /privacidade /uso-aceitavel`; `GUEST_ONLY_ROUTES` = autenticado em `/login`/`/signup` → `/dashboard`; `/auth/confirm` é `ALWAYS_PASSTHROUGH`; `/` não está no matcher → a landing é servida sem auth em qualquer domínio.
- **Callback de auth** (`src/app/auth/confirm/route.ts`): valida `token_hash` via `verifyOtp` para `type=signup|recovery`; sucesso → signup: `/`; recovery: `/update-password` ou `/`.
- **Env derivada de domínio — única:** `NEXT_PUBLIC_SITE_URL` (`.env.example`, validada em `src/lib/supabase/site-url.ts`, throw em load-time). Único consumidor: `forgot-password-form.tsx` → `resetPasswordForEmail(email, { redirectTo: `${getSiteUrl()}/auth/confirm` })`. Como é client component, o valor é **inlined no build** → trocar exige **redeploy**.
- **PWA** (`src/app/manifest.ts`): `/manifest.webmanifest` com `start_url: "/dashboard"`, `scope: "/"`, `display: standalone`, ícones em caminhos relativos (`/icons/*.png`, apple-touch-icon 180). Sem service worker. Instalação de PWA é **por origem** — quem instalou em beta.vendeo.tech tem o app vinculado àquela origem.
- **Vercel**: projeto `vendeo-v3` (`.vercel/repo.json`: `prj_Z001CZf0ChbczzwV7JEgAIlZVbGe`, org `team_2mDUcf5S4z27nZP7IUfEqIXg`), git integration `wagnercarisson/Vendeo-V3` (main → produção). `vercel.json` contém apenas crons (sem redirects de domínio).
- **Supabase**: fechamento real do signup é manual e documentado em `SUPABASE-CLOSED-BETA.md` (Opção A: desabilitar "Allow new users to sign up"; Opção B: Before User Created Hook). Estado presumido: Opção A aplicada (signup aberto desabilitado).
- **Código V1 / página de manutenção:** não há artefato no repo — é inventário externo (Vercel/DNS), coberto pelo COLLECT FIRST.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Seção A do runbook — inventário, baseline e decisões pendentes (COLLECT FIRST)</name>
  <files>
    - .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md
  </files>
  <action>
  Garantir que a seção A do runbook deste PLAN.md contenha, com os fatos de código acima, o seguinte (documentação apenas — nenhum passo altera infra):

  ### A1. Inventário de domínios (tabela a ser preenchida na execução — COLLECT FIRST)
  Tabela com linhas para cada domínio/projeto e colunas `Domínio/Projeto | Onde é usado hoje | Destino desejado | O que coletar`:
  - `vendeo.tech` — domínio raiz; uso atual desconhecido (suspeito: projeto V1 antigo / página de manutenção na Vercel) → **coletar** onde aponta hoje (DNS), se tem projeto Vercel vinculado, se serve manutenção; destino: **domínio canônico do V3**.
  - `beta.vendeo.tech` — produção atual do V3; destino: **alias temporário durante a janela de transição, depois 301 permanente para vendeo.tech (decisão D-1)**.
  - Domínio Vercel padrão (`vendeo-v3.vercel.app` ou similar) — URL preview/alias automática; destino: manter.
  - Projeto V1 antigo na Vercel (nome a descobrir no COLLECT FIRST) — destino: **ADIADA a remoção; apenas inventariar, não tocar**.
  - Página de manutenção existente — onde vive (projeto V1? subdomínio?), destino: registrar e **não alterar**.

  ### A2. Mapeamento Vercel (documentar os fatos + o que coletar)
  - Projeto correto do V3: `vendeo-v3` (id `prj_Z001CZf0ChbczzwV7JEgAIlZVbGe`, org `team_2mDUcf5S4z27nZP7IUfEqIXg`), git `wagnercarisson/Vendeo-V3` → main → produção.
  - Objetivo: adicionar `vendeo.tech` como domínio do projeto e torná-lo o **Production Domain**; `beta.vendeo.tech` **permanece** vinculado durante a janela de transição.
  - `vercel.json` atual: só crons — redirects de domínio, se desejados após a janela (301 beta → vendeo), devem ser aplicados só em fase futura (fora desta quick).
  - Remoção/desvinculação segura do projeto V1: **adiada**; nesta quick apenas inventariar (C-01) e registrar os passos de desvinculação segura como anexo para uma fase futura dedicada.

  ### A3. Mapeamento Supabase Auth (documentar fatos + o que coletar)
  - **Site URL** (Authentication → URL Configuration): hoje = a coletar (C-06); alvo = `https://vendeo.tech`; **manter `https://beta.vendeo.tech` válida durante a janela**.
  - **Redirect URLs permitidas** — lista a preservar integralmente durante a transição (todas abaixo devem permanecer válidas; nunca remover a antiga antes do fim da janela):
    - `https://vendeo.tech/auth/confirm`
    - `https://beta.vendeo.tech/auth/confirm`
    - `https://vendeo.tech/**` (callbacks PKCE/fragment — confirmar necessidade na config atual)
    - `https://beta.vendeo.tech/**`
    - URLs de preview `https://*.vercel.app/**` (se presentes hoje — anotar na C-06)
    - `http://localhost:3000/**` (dev)
  - **Confirmação de email:** com beta fechado, o caminho de cadastro está desligado; os fluxos vivos são `forgot-password` (redirectTo explícito = `NEXT_PUBLIC_SITE_URL/auth/confirm`, vindo do app) e convite manual via "Add user" (usa o **Site URL** do Supabase). Ambos dependem de Site URL + redirect URLs corretos no novo domínio.
  - **Signup aberto desabilitado:** verificar antes e depois que "Allow new users to sign up" continua desabilitado (C-07) — a migração NÃO deve alterar isso.
  - Templates de email: verificar se usam `{{ .SiteURL }}` literal (C-08) — se sim, serão atualizados na fase de execução (decisão D-6).

  ### A4. Mapeamento PWA (documentar fatos)
  - Manifest servido por origem (`/manifest.webmanifest`), `start_url "/dashboard"`, `scope "/"`, ícones em caminhos relativos → **nenhuma mudança de código é necessária** para servir o PWA em vendeo.tech.
  - Instalação é por origem: usuários que instalaram em `beta.vendeo.tech` têm o app vinculado à origem beta; ao migrar para vendeo.tech precisam **reinstalar** (comunicação = decisão D-4).
  - UAT deve confirmar manifest + ícones + instalação Android/iOS em vendeo.tech (U-09).

  ### A5. Decisões pendentes (para o humano decidir ANTES de executar; recomendação em destaque)
  - **D-1 — destino de beta.vendeo.tech:** (a) permanece alias temporário servindo o mesmo deploy por uma janela e depois vira 301 permanente para vendeo.tech [RECOMENDADO — preserva PWA instalado, emails pendentes e callbacks]; ou (b) 301 imediato após a troca [risco: quebra sessões/callbacks em trânsito].
  - **D-2 — janela de transição:** manter beta.vendeo.tech nos redirects do Supabase e vinculado na Vercel por quanto tempo? [RECOMENDADO: ≥ 30 dias — cobre reinstalação de PWA, emails pendentes e callbacks residuais].
  - **D-3 — ordem Supabase-primeiro vs Vercel-primeiro:** [RECOMENDADO: Supabase primeiro (Fase A) — os redirect URLs precisam aceitar vendeo.tech ANTES de o DNS passar a servir o app; evita a janela onde o app está no ar mas callbacks de auth são rejeitados].
  - **D-4 — comunicação aos usuários beta:** avisar que o app agora é acessado por `https://vendeo.tech` e que o PWA instalado (se houver) deve ser desinstalado/reinstalado na nova origem. Quem comunica e quando (ex.: antes do DNS, por email/whatsapp de suporte).
  - **D-5 — destino atual de vendeo.tech:** confirmar no COLLECT FIRST se vendeo.tech hoje aponta para o projeto V1 / página de manutenção; se sim, o DNS é a mudança crítica e o rollback precisa reverter exatamente o registro anotado.
  - **D-6 — templates de email do Supabase:** se usarem `{{ .SiteURL }}` literal (C-08), decidir se atualiza o template junto com o Site URL (recomendado: sim, na mesma janela).
  - **D-7 — NEXT_PUBLIC_SITE_URL por ambiente:** Production = `https://vendeo.tech` (após migração); Preview = URL de preview da Vercel; local = `http://localhost:3000`. Troca exige redeploy (build-time).

  ### A6. COLLECT FIRST — informações a coletar manualmente (checklist numerado, antes de qualquer mudança)
  - C-01 Vercel Dashboard (org `team_2mDUcf5S4z27nZP7IUfEqIXg`): listar TODOS os projetos; identificar o projeto V1 antigo e onde vive a página de manutenção.
  - C-02 Vercel → projeto `vendeo-v3` → Settings → Domains: domínios atuais, qual é o Production Domain, status de cada um.
  - C-03 Vercel → projeto `vendeo-v3` → Settings → Environment Variables: anotar TODAS as variáveis de Produção (em especial `NEXT_PUBLIC_SITE_URL` e as 3 do Supabase).
  - C-04 Vercel → projeto `vendeo-v3` → Deployments: anotar o último deploy estável (ID + commit).
  - C-05 DNS (registrar/nameserver): registros atuais de `vendeo.tech` e `beta.vendeo.tech` (A/AAAA/CNAME, TTL, provedor/registrar, onde cada um aponta hoje).
  - C-06 Supabase Dashboard → Authentication → URL Configuration: Site URL atual + lista completa de Redirect URLs.
  - C-07 Supabase Dashboard → Authentication → Sign In / Up: estado de "Allow new users to sign up" + providers habilitados.
  - C-08 Supabase Dashboard → Authentication → Email Templates: verificar se templates de confirmação/recovery/invite usam `{{ .SiteURL }}` ou `{{ .RedirectTo }}`.
  - C-09 Supabase → Authentication → Logs: baseline recente (erros de callback/OTP) para comparar após a migração.
  - C-10 Busca no repo/docs por referências a `beta.vendeo.tech` (ex.: `docs/boas-vindas-beta-vendeo.md`, changelog) para atualizar comunicações (D-4).
  </action>
  <verify>
    <automated>rg -c "COLLECT FIRST|Decisões pendentes|Redirect URLs permitidas|Projeto V1|Mapeamento PWA" .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md</automated>
  </verify>
  <done>
    Seção A presente no PLAN.md: inventário de domínios (tabela), mapeamentos Vercel/Supabase/PWA ancorados nos fatos de código, decisões pendentes D-1..D-7 com recomendação, e checklist COLLECT FIRST C-01..C-10. Nenhum passo executa mudança em infra.
  </done>
</task>

<task type="auto">
  <name>Task 2: Seção B do runbook — sequência operacional numerada + ordem + rollback</name>
  <files>
    - .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md
  </files>
  <action>
  Garantir que a seção B do runbook deste PLAN.md contenha (documentação apenas — passos a serem executados por HUMANO em fase futura):

  ### B1. Pré-checks (P-01..P-08) — executar antes de qualquer mudança
  - P-01 Todos os itens COLLECT FIRST C-01..C-10 coletados e anotados (registros de DNS, env vars, domains, Site URL/redirects atuais).
  - P-02 Decisões D-1..D-7 tomadas e registradas por escrito.
  - P-03 Registro do estado atual (backup): screenshots/export do Supabase URL Configuration + Redirect URLs, Vercel Domains + Environment Variables (Produção), registros DNS de `vendeo.tech` e `beta.vendeo.tech`. Salvar em um doc de execução (ex.: `docs/operations/domain-migration-2026-08-run.md`).
  - P-04 Confirmar no Supabase que "Allow new users to sign up" está DESABILITADO (C-07) e que isso não será tocado na migração.
  - P-05 Confirmar que o deploy em produção do projeto `vendeo-v3` é o esperado (C-04) e que beta.vendeo.tech está saudável (carrega landing, login OK).
  - P-06 Anotar o valor atual de `NEXT_PUBLIC_SITE_URL` em Produção (C-03).
  - P-07 Escolher a janela de baixo uso (horário/periodo) — sem UAT externo em andamento (ver `docs/launch-readiness/expansion-pause-criteria.md` se aplicável).
  - P-08 Preparar a mensagem de comunicação aos usuários (D-4) antes da troca.

  ### B2. Ordem recomendada de execução (justificada)
  **Supabase → Vercel → DNS → Env/Deploy → Validação → Monitoramento.** Razão: os redirect URLs do Supabase precisam aceitar `vendeo.tech` ANTES de o DNS passar a servir o app no novo domínio (senão callbacks de auth são rejeitados enquanto o app já está no ar). O DNS é o passo de corte visível — por isso é o último da fase de configuração, e o primeiro validado.
  Alternativa considerada (Vercel/DNS primeiro) é mais rápida mas abre janela de callbacks quebrados — não recomendada.

  ### B3. Checklist operacional numerado (runbook — humano executa)
  - R-01 Aplicar Fase A — Supabase: em Authentication → URL Configuration, ADICIONAR as Redirect URLs de `vendeo.tech` (mantendo `beta.vendeo.tech` e as demais da A3); definir Site URL = `https://vendeo.tech` (ou manter beta até o DNS, conforme D-6/D-3). Salvar. NÃO desabilitar/alterar "Allow new users to sign up".
  - R-02 Aplicar Fase B — Vercel: projeto `vendeo-v3` → Settings → Domains → adicionar `vendeo.tech`; seguir a instrução de validação DNS exibida (anotar o valor: A `76.76.21.21` ou CNAME `cname.vercel-dns.com`, conforme o painel). NÃO remover `beta.vendeo.tech`.
  - R-03 Aplicar Fase C — DNS: no registrar, criar/atualizar o registro de `vendeo.tech` conforme R-02 (se o registro antigo apontar para V1/manutenção, anotá-lo primeiro em C-05 para rollback). Aguardar propagação (TTL) e validar no Vercel (domínio → "Valid Configuration").
  - R-04 Fase D — Vercel: Settings → Environment Variables → Produção: `NEXT_PUBLIC_SITE_URL=https://vendeo.tech` (anotado antes em C-03); disparar deploy/promover build (valor é inlined no client `forgot-password-form.tsx`). Confirmar no Vercel que `vendeo.tech` é o Production Domain.
  - R-05 Fase E — Validação pós-deploy: executar o checklist UAT curto (U-01..U-10) em `https://vendeo.tech` e confirmar que `https://beta.vendeo.tech` continua íntegro (U-11).
  - R-06 Fase F — Monitoramento curto (48h): conferir Supabase Auth Logs (erros de OTP/callback), Vercel Logs do projeto (5xx em `/login`, `/auth/confirm`, `/api/access-requests`, `/dashboard`), execução do cron mensal de créditos (`/api/cron/monthly-credits`), e pelo menos 1 fluxo real de forgot-password + 1 login real.
  - R-07 Fase G — Pós-janela (após D-2, ex.: 30 dias): se D-1 = 301, configurar redirect permanente `beta.vendeo.tech` → `vendeo.tech` (Vercel Redirects ou Edge Config — fase futura dedicada, NÃO nesta quick); remover `beta.vendeo.tech` dos Redirect URLs do Supabase somente após confirmar zero emails pendentes e PWA migrado.
  - R-08 Atualizar a doc operacional (`docs/operations/deploy-checklist.md` + `environment-variables.md` + `SUPABASE-CLOSED-BETA.md` se citar domínios) com os novos valores, e registrar a execução no STATE/SUMMARY.

  ### B4. Checklist de rollback (RB-01..RB-08) — como voltar ao estado anterior
  - RB-01 Critérios de acionamento: falha em `/login`, `/auth/confirm`, callbacks de email, `/dashboard` protegido, `/admin/*`, ou landing em `vendeo.tech` — nas primeiras 48h, rollback imediato.
  - RB-02 Vercel: remover `vendeo.tech` como Production Domain (voltar `beta.vendeo.tech` como default) — beta nunca foi removido do projeto, então nada a restaurar.
  - RB-03 DNS: reverter o registro de `vendeo.tech` para o valor original anotado em C-05 (ex.: apontar de volta para o projeto V1/manutenção, se era esse o estado).
  - RB-04 Supabase: reverter Site URL para o valor anotado em C-06; manter `vendeo.tech` nos Redirect URLs (inócuo) ou removê-lo — nunca remover `beta.vendeo.tech` dos redirects.
  - RB-05 Env: reverter `NEXT_PUBLIC_SITE_URL` para `https://beta.vendeo.tech` + redeploy (rollback do valor build-time).
  - RB-06 Login preservado: sessões existentes em `beta.vendeo.tech` (cookies `sb-*`) não são afetadas pelo rollback — enquanto beta permanece no projeto Vercel e nos redirects Supabase, login e callbacks seguem funcionando na origem antiga.
  - RB-07 V1: nenhuma etapa da migração desvincula o V1; se `vendeo.tech` apontava para V1, o rollback de DNS (RB-03) restaura exatamente o estado original.
  - RB-08 Registro: anotar o rollback no doc de execução (motivo, horário, estado restaurado) — nunca deixar o estado intermediário sem registro.
  </action>
  <verify>
    <automated>rg -c "Checklist Operacional|RB-01|R-01|Ordem recomendada|Rollback" .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md</automated>
  </verify>
  <done>
    Seção B presente no PLAN.md: pré-checks P-01..P-08, ordem recomendada com justificativa (Supabase → Vercel → DNS → Env/Deploy → Validação → Monitoramento), checklist operacional R-01..R-08 e rollback RB-01..RB-08 cobrindo Vercel/DNS/Supabase/env/login/V1. Nenhum passo executável nesta quick.
  </done>
</task>

<task type="auto">
  <name>Task 3: Seção C do runbook — UAT pós-migração, monitoramento e responsabilidade</name>
  <files>
    - .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md
  </files>
  <action>
  Garantir que a seção C do runbook deste PLAN.md contenha (documentação apenas):

  ### C1. Checklist de UAT pós-migração (numerado; executado pelo humano em `https://vendeo.tech`)
  - U-01 `/` mostra a landing pública (wordmark "Vendeo", link "Entrar", hero "Campanhas profissionais para lojas físicas", CTA "Solicitar acesso free", formulário) — sem redirect para `/dashboard`.
  - U-02 `/signup` mostra "Beta fechado" (sem formulário de cadastro, sem input de senha).
  - U-03 `/login` com usuário beta real → cai em `/dashboard` (pós-login default).
  - U-04 Fluxo forgot-password: o email chega com link `https://vendeo.tech/auth/confirm` e o reset de senha conclui (valida `NEXT_PUBLIC_SITE_URL` build-time).
  - U-05 Callback `/auth/confirm` responde em `vendeo.tech` (token_hash signup e recovery) E continua respondendo em `beta.vendeo.tech` durante a janela (D-2).
  - U-06 `/dashboard` protegido: visitante não autenticado → `/login?redirect=/dashboard`.
  - U-07 `/admin/access-requests` funciona para admin (lista, aprovar/recusar).
  - U-08 Solicitação de acesso: `POST /api/access-requests` a partir da landing de `vendeo.tech` retorna `{ok:true}` 200.
  - U-09 PWA: `GET /manifest.webmanifest` 200 em `vendeo.tech` com `start_url: "/dashboard"`; ícones 192/512/maskable e apple-touch-icon 200; instalação Android (prompt Chrome) possível; "Adicionar à Tela de Início" no Safari iOS possível.
  - U-10 Links legais `/termos`, `/privacidade`, `/uso-aceitavel` carregam e voltam para a landing.
  - U-11 `beta.vendeo.tech` continua servindo o app (janela de transição ativa) — sem quebra para quem ainda usa a origem antiga.
  - U-12 Supabase Auth: "Allow new users to sign up" continua DESABILITADO; Site URL = `https://vendeo.tech`; Redirect URLs incluem `vendeo.tech` e `beta.vendeo.tech`.
  - U-13 Usuário com sessão ativa em `beta.vendeo.tech` continua logado lá (sessões por origem — não são migradas para vendeo.tech; novo login em vendeo.tech é o comportamento esperado).

  ### C2. Monitoramento curto (48h pós-migração)
  - M-01 Supabase → Authentication → Logs: zero erros novos de OTP/verification relacionados a domínio (comparar com C-09).
  - M-02 Vercel → projeto `vendeo-v3` → Logs: sem 5xx em `/login`, `/auth/confirm`, `/api/access-requests`, `/dashboard`.
  - M-03 Cron mensal de créditos (`/api/cron/monthly-credits`) executou sem erro no próximo disparo.
  - M-04 Sem relato de usuário beta com callback/email quebrado (canal de suporte, D-4).
  - M-05 Aos 48h: decisão de manter vendeo.tech canônico OU acionar rollback RB-01..RB-08, registrada no doc de execução.

  ### C3. Quem / quando executa
  - **Executante:** humano (owner/desenvolvedor responsável) — mudanças em Vercel/DNS/Supabase são manuais (dashboards/registrar); nenhuma é executável por agente.
  - **Quando:** após revisão deste plano e coleta completa (C-01..C-10), decisões D-1..D-7 registradas, em janela de baixo uso (P-07), com a mensagem aos usuários pronta (D-4).
  - **Checkpoints humanos:** obrigatórios entre Fases A→B (Supabase ok), B→C (domínio adicionado no Vercel), C→D (DNS validado), D→E (deploy ok) e E→F (UAT passou) — cada fase só avança com o checkpoint anterior aprovado.
  - **Comunicação:** avisar usuários beta sobre o novo domínio e reinstalação do PWA antes do DNS (D-4); registrar a execução completa no SUMMARY da quick e em `docs/operations/`.
  - **Fora do runbook:** desvinculação do V1, 301 definitivo de beta → vendeo e limpeza final são fases futuras dedicadas (apenas inventariadas aqui).

  ### C4. Regras de ouro da migração (proibições)
  - Esta quick é **plan-only**: nenhum passo deste arquivo pode ser executado contra Vercel/DNS/Supabase/env/código.
  - NUNCA remover `beta.vendeo.tech` do projeto Vercel nem dos Redirect URLs do Supabase antes do fim da janela D-2.
  - NUNCA alterar "Allow new users to sign up" (mantém desabilitado).
  - NUNCA desvincular/remover o projeto V1 (limpeza adiada).
  - NUNCA tocar em env vars além de `NEXT_PUBLIC_SITE_URL` (e sempre anotar o valor anterior).
  - NUNCA abrir signup público.
  </action>
  <verify>
    <automated>rg -c "UAT|U-01|M-01|Quem / quando executa|Regras de ouro" .planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-PLAN.md</automated>
  </verify>
  <done>
    Seção C presente no PLAN.md: UAT numerado U-01..U-13 cobrindo landing, signup fechado, login, forgot-password, callbacks, dashboard protegido, admin, PWA e links legais; monitoramento M-01..M-05; definição de quem/quando executa com checkpoints humanos; regras de ouro declarando o caráter plan-only.
  </done>
</task>

</tasks>

<verification>
```bash
# O runbook (este arquivo) deve conter todas as âncoras das seções A, B e C.
rg -c "COLLECT FIRST|Decisões pendentes|Mapeamento Vercel|Mapeamento Supabase Auth|Mapeamento PWA" 260812-och-PLAN.md
rg -c "Pré-checks|Checklist Operacional|Ordem recomendada|Rollback" 260812-och-PLAN.md
rg -c "Checklist de UAT|Monitoramento curto|Quem / quando executa|Regras de ouro" 260812-och-PLAN.md
# Garantia plan-only: o arquivo declara explicitamente o não-escopo e a proibição de execução.
rg -c "Fora de escopo|plan-only|NÃO EXECUTAR|não toca produção" 260812-och-PLAN.md
```
</verification>

<success_criteria>
- [ ] O runbook deixa claro que **vendeo.tech é o domínio canônico** do Vendeo V3 (DOM-01).
- [ ] O runbook **mantém o beta fechado**: landing `/`, CTA "Solicitar acesso free", signup aberto desabilitado no Supabase Auth preservado, login para usuários liberados (DOM-02).
- [ ] O runbook **protege os callbacks do Supabase Auth**: lista todas as redirect/callback URLs que devem permanecer válidas (vendeo.tech + beta.vendeo.tech + previews) e manda preservá-las durante toda a transição (DOM-03).
- [ ] O runbook **considera PWA**: manifest `start_url /dashboard`, origem da instalação e reinstalação em vendeo.tech documentadas (DOM-04).
- [ ] O runbook **não executa nenhuma mudança**: nenhuma task altera código, Vercel, DNS, Supabase Auth ou env vars — 100% documentação (DOM-05).
- [ ] O runbook é seguro para quem nunca fez essa migração: passos numerados, COLLECT FIRST, decisões pendentes com recomendação, ordem justificada, rollback completo e UAT passo a passo.
- [ ] Entregáveis do plano presentes: checklist operacional, checklist de rollback, checklist de UAT, decisões pendentes, COLLECT FIRST, ordem de execução, quem/quando executa.
</success_criteria>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Domínio vendeo.tech → app V3 | mudança de corte público (DNS) — tráfego real passa a bater no projeto vendeo-v3 |
| App V3 → Supabase Auth | callbacks/OTP dependem de Site URL + Redirect URLs do projeto Supabase |
| Origem PWA instalada | instalação de PWA é por origem; beta.vendeo.tech ≠ vendeo.tech |

## STRIDE Threat Register (riscos operacionais da migração — mitigados pelo runbook)

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-260812-01 | Spoofing/DNS | registro DNS de vendeo.tech | mitigate | COLLECT FIRST C-05 anota o registro atual; R-03 valida no Vercel antes de seguir; RB-03 reverte o registro anotado |
| T-260812-02 | Availability | janela de troca (downtime) | mitigate | janela de baixo uso (P-07), beta.vendeo.tech permanece ativo (R-02), rollback RB-01..RB-08 em 48h |
| T-260812-03 | Authentication | callbacks rejeitados pelo Supabase | mitigate | ordem Supabase-primeiro (D-3): redirect URLs de vendeo.tech adicionadas ANTES do DNS (R-01 antes de R-03); U-04/U-05 validam |
| T-260812-04 | Authentication | emails com redirectTo/{{ .SiteURL }} do domínio antigo | mitigate | beta.vendeo.tech mantido válido na janela (D-2); C-08 verifica templates; D-6 decide atualização |
| T-260812-05 | Availability/PWA | instalação PWA presa à origem beta | mitigate | D-4 comunica reinstalação; manifest relativo serve em qualquer origem (A4); U-09 valida install Android/iOS |
| T-260812-06 | Tampering (env) | NEXT_PUBLIC_SITE_URL build-time errado | mitigate | C-03 anota valor atual; R-04 troca + redeploy; RB-05 reverte; U-04 valida fluxo real |
| T-260812-07 | Availability | remoção acidental de beta.vendeo.tech / V1 | mitigate | regras de ouro C4 (nunca remover beta antes da janela; V1 intocável); RB-02/RB-07 preservam origem antiga |
</threat_model>

<output>
Create `.planning/quick/260812-och-planejar-migracao-de-dominio-vendeo-tech/260812-och-SUMMARY.md` when done
</output>
