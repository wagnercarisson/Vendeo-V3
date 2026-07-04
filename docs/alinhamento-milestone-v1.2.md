# Alinhamento — Milestone v1.2 "Contas e Propriedade"

**Status:** Alinhamento consolidado. Decisões D1–D11 fechadas.
**Data:** 2026-07-03
**Próximo passo:** Iniciar alinhamento técnico da Phase 7 (Sessão e Login Vertical) via OpenSpec Explore. Após aprovação dos artefatos, planejar execução.

> Este documento é o artefato de alinhamento da milestone. Ele registra as decisões tomadas, invariantes, arquitetura-alvo e critérios de aceite. **Não é roadmap nem plano de implementação.** O fatiamento em fases e o planejamento detalhado vêm depois, em documentos próprios.

---

## Objetivo da Milestone

Preparar o terreno para a estrutura SaaS do Vendeo. O core de geração de campanhas está validado (v1.1), mas o produto ainda não é uma versão pública utilizável — falta identificar o usuário, proteger os dados e garantir que cada lojista acesse apenas sua própria loja.

Esta milestone estabelece a camada fundacional de contas e propriedade para que as milestones seguintes construam sobre ela.

### O que está no escopo

- Autenticação (Supabase Auth, email + senha)
- Sessão SSR com `@supabase/ssr` e cookies
- Vínculo user → store (relação 1:1, `stores.user_id`)
- RLS em 5 tabelas para isolamento de propriedade
- Ownership validado em todas as operações
- Rotas protegidas (middleware + server component)
- Páginas mínimas de signup, login e onboarding
- Reset dos dados existentes (pré-auth)

### O que está fora do escopo

| Item | Motivo |
|------|--------|
| Campanhas persistidas | Escopo é auth + ownership |
| Export PNG/JPG | Decisão MC-03 da v1.1, adiado novamente |
| Dashboard completo | Exige mais definição de produto |
| Planos e cobrança | Uso livre durante validação |
| Histórico de campanhas | Depende de persistência |
| Regeneração | Redefinida como "novo briefing" (MC-02) |
| Múltiplas lojas | Relação 1:1 nesta milestone |
| Ajustes de arte | Motor valida geração, não edição (MC-01) |
| OAuth social / Magic link | Exclusão deliberada para v1.2 |
| Bucket legado `store-logos` | Inventário está dentro do escopo. Remoção/migração condicionada ao resultado |

---

## Invariantes de Segurança

Estes invariantes são absolutos. Nenhuma fase pode violá-los.

1. **Sessão como fonte de identidade** — `claims.sub` (JWT validado) é a única fonte confiável de `user_id`. `getSession()` não é usado para autorização.
2. **user_id sempre do servidor** — Nenhuma rota aceita `user_id` vindo do cliente. O servidor extrai das claims.
3. **Ownership precede operação** — Toda mutação com `supabaseAdmin` verifica `stores.user_id === claims.sub` **antes** de executar.
4. **404, não 403** — Acesso a loja alheia ou inexistente retorna 404 (não revela existência de recursos de outro tenant).
5. **APIs não redirecionam** — Rotas `/api/*` retornam JSON 401/404, nunca redirect HTML.
6. **Dados inexistentes = não autorizado** — Com RLS, uma `SELECT` que não retorna linhas é indistinguível de "não existe" vs "não é seu".
7. **`localStorage("store_id")` deixa de existir** — Nenhum fluxo usa localStorage para descobrir ou autorizar loja.
8. **Service role nunca descobre ownership** — `supabaseAdmin` só é chamado **depois** que o ownership foi verificado com cliente de sessão + RLS.
9. **Logout limpa dados de sessão anterior** — Preview e drafts de campanha são limpos ao deslogar.
10. **Redirect validation** — `?redirect=` aceita apenas caminhos internos de uma allowlist.
11. **Exceção: criação da primeira loja** — `POST /api/store` usa `supabaseAdmin` sem ownership prévio (a loja ainda não existe). Exige `requireUser()`. `user_id` vem exclusivamente de `claims.sub`. A constraint `UNIQUE(user_id)` impede duplicidade.

---

## Ledger de Decisões D1–D11

### D1 — Ownership canônico da loja

`CONFIRMADO`

- `stores.user_id` é a fonte canônica de ownership.
- `stores.user_id` será `UUID NOT NULL REFERENCES auth.users(id) UNIQUE`.
- Tabelas dependentes herdam ownership por `store_id`.
- `user_id` não será duplicado nas tabelas dependentes.
- Buckets permanecem public-read.
- Escritas server-side com service role exigem autenticação e validação explícita de ownership antes da operação.
- `store_id` vindo do cliente nunca é evidência de autorização.

### D2 — Autenticação e verificação de email

`CONFIRMADO`

- Provider: Supabase Auth.
- Método v1.2: email + senha.
- OAuth e magic link: fora do escopo.
- Desenvolvimento e testes internos: auto-confirm permitido.
- Beta externo e produção: confirmação de email obrigatória.
- Antes do beta externo: configurar SMTP próprio (Resend, SendGrid, Postmark — escolha em aberto).
- Sessão SSR: `@supabase/ssr` com cookies.
- Fluxo "esqueci minha senha": escopo a definir (pendência "antes do roadmap").

### D3 — Estado do usuário sem loja e momento da criação

`CONFIRMADO`

- A loja **não** é criada automaticamente no signup.
- Usuário autenticado sem loja é um estado válido e temporário de onboarding.
- `/store` opera em dois modos: **create** (sem loja) e **edit** (com loja).
- Usuário sem loja não acessa o fluxo de campanha (`/` e `/campaign/preview` redirecionam para `/store`).
- Ao retornar ou fazer novo login, usuário sem loja volta ao onboarding.
- `stores.user_id` vem exclusivamente da sessão — o servidor ignora qualquer `user_id` enviado pelo cliente.
- `localStorage("store_id")` deixa de ser fonte de identidade.
- Após criar a loja, o servidor passa a resolvê-la por `claims.sub → stores.user_id → stores.id`.
- Middleware protege autenticação; páginas e handlers validam loja e ownership.

### D4 — Fonte autoritativa do store_id

`CONFIRMADO`

- A identidade autoritativa vem de **claims validadas** da sessão (`getClaims()` ou `getUser()`).
- `stores.user_id` resolve a loja pertencente ao usuário.
- `localStorage("store_id")` será removido completamente.
- `store_id` pode aparecer em props, estado e URLs, mas **não autoriza acesso**.
- Rotas `/api/store/:id` serão preservadas para reduzir migração.
- Todo handler valida autenticação e ownership.
- Operações com service role validam ownership antes do acesso privilegiado.
- Middleware protege/renova autenticação, mas **não consulta existência da loja**.
- `/store` aceita usuário autenticado sem loja; `/` e `/campaign/preview` exigem loja existente.

### D5 — Cliente vinculado à sessão vs service role

`CONFIRMADO`

- Cliente Supabase vinculado à sessão (`@supabase/ssr` + `createServerClient`) é o **padrão**.
- RLS cobre operações realizadas pelo cliente de sessão. Na v1.2, usuários autenticados recebem somente SELECT; escritas permanecem nos handlers privilegiados.
- Service role é uma **capacidade excepcional**, não o cliente padrão.
- Service role permanece nos pipelines server-side que exigem Storage ou preservação temporária da arquitetura existente.
- Toda operação privilegiada exige autenticação e ownership prévios.
- Ownership é validado **com cliente de sessão + RLS** antes de qualquer chamada `supabaseAdmin`.
- Server Actions validam autenticação internamente (são entry points).
- Acesso a store inexistente ou alheia retorna 404.
- Cliente de sessão e cliente admin permanecem instâncias separadas.
- Service role **não** é justificado como mecanismo de atomicidade.

### D6 — RLS: tabelas, buckets e políticas

`CONFIRMADO`

- RLS será habilitado nas cinco tabelas públicas.
- Políticas serão específicas por operação; **não haverá `FOR ALL`**.
- `stores`, `store_brand_assets`, `store_brand_profiles` e `store_visual_signatures` terão `SELECT` para o owner.
- `generation_events` será **default-deny** para usuários (nenhum SELECT concedido a `authenticated`).
- Escritas permanecem nos handlers privilegiados após ownership validado.
- Políticas filhas usarão subquery direta:
  ```sql
  store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  )
  ```
- Não será criada função dentro do schema `auth`.
- Buckets permanecem públicos para download por URL conhecida.
- Políticas amplas de `SELECT` em `storage.objects` (que permitem listagem) serão removidas ou restringidas.
- Escritas de Storage permanecem server-side com ownership prévio.
- Políticas `TO service_role` não são tratadas como proteção (service role ignora RLS).

### D7 — Proteção de páginas, route handlers e operações administrativas

`CONFIRMADO`

- Next.js 15 usará `middleware.ts` para renovação e proteção de páginas.
- Middleware valida identidade com `getClaims()`, não `getSession()`.
- Middleware **não consulta** existência da loja.
- `/api/*` retornam 401/404; não redirecionam para páginas HTML.
- `/store` exige auth, mas aceita ausência de loja.
- `/` e `/campaign/preview` exigem auth **e** loja.
- Usuário autenticado em `/login` ou `/signup` segue para `/` (que redireciona para `/store` se não houver loja).
- Páginas server-side resolvem loja e aplicam redirects.
- `POST /api/store` usa admin após `requireUser()` — `user_id` da criação vem exclusivamente das claims.
- `GET /api/store/:id` usa sessão + RLS.
- Mutações usam ownership (com sessão + RLS) + admin (para executar).
- Todas as rotas de IA (`/api/campaign/generate`, `/api/campaign/generate-image`) exigem autenticação e loja.
- Server Actions autenticam como entry points.
- Serviços internos **não** releem cookies — recebem `AuthorizedStoreContext`.
- Redirects preservados aceitam somente destinos internos válidos (allowlist).

### D8 — Cenários de segurança como critério de aceite

`CONFIRMADO`

- Cenários binários (passa/falha) serão o critério formal de aceite.
- Todo isolamento cross-tenant terá cobertura automatizada.
- RLS será testado contra banco real/local, não somente com mocks.
- Todas as rotas store-scoped compartilharão testes parametrizados.
- Storage terá testes de download público, listagem e mutação.
- Logout impedirá vazamento de preview/drafts entre usuários.
- Auto-confirm e confirmação real terão cenários separados.
- APIs retornarão 401/404 consistentes.
- UAT manual complementará, mas não substituirá, testes de segurança.
- A milestone só fecha com todos os cenários obrigatórios aprovados.

> **Nota:** O catálogo final de cenários será numerado durante o planejamento das fases. O número exato será definido naquele momento.

### D9 — CSRF / validação de origem

`CONFIRMADO`

- POST, PATCH, PUT e DELETE dos Route Handlers autenticados exigem mesma origem (`Origin` === `Host` ou `X-Forwarded-Host`).
- GET/HEAD não usam esse guard.
- `/auth/confirm` fica fora (token assinado).
- Server Actions usam proteção nativa do Next.js (compara Origin com Host/X-Forwarded-Host) — não configurar `allowedOrigins` sem necessidade.
- O helper central (`requireTrustedOrigin()`) pode ser criado futuramente; a política de same-origin é suficiente para v1.2.

### D10 — Fluxo "esqueci minha senha"

`CONFIRMADO`

- O fluxo mínimo de recuperação de senha entra na v1.2 como gate para beta externo:
  - `/forgot-password` — formulário de solicitação
  - Envio de email pelo Supabase Auth
  - Confirmação do token (reutiliza `/auth/confirm`)
  - `/update-password` — formulário de nova senha
- Sem configurações de conta, troca de email ou administração de perfil.
- Aproveita o SMTP que já será necessário para confirmação de email.

### D11 — Classificação das Server Actions

`CONFIRMADO`

- `resolveStoreIdentity()`, `validateIdentityReference()`, `buildCampaignBrief()` — **serviços internos**. O componente client que chama `resolveStoreIdentity` deve ser substituído por dados vindos de página/endpoint protegido.
- `generateVariations()`, `generateAutomatic()`, `activateSignature()`, `listSignatures()` — **entrypoints autenticados**. Precisam executar `requireUser()` e `requireOwnership(storeId)` antes de usar service role. `listSignatures()` pode ser migrado para leitura via Route Handler futuramente.

---

## Estados do Usuário

```
┌─────────────────────────────────────────────────────────────┐
│                  MÁQUINA DE ESTADOS — v1.2                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐                                          │
│   │ Não auth     │                                          │
│   └──────┬───────┘                                          │
│          │ /login ou /signup                                │
│          ▼                                                   │
   │   ┌──────────────┐      ┌──────────────────┐                │
   │   │ Signup       │──────▶ Aguardando       │ (UX state —   │
   │   │ (email+senha)│      │ confirmação      │  sem sessão)  │
   │   └──────┬───────┘      │ /check-email     │                │
   │          │              └────────┬─────────┘                │
   │          │ (auto-confirm)       │ /auth/confirm            │
   │          │                      │ (/check-email público)   │
│          ▼                       ▼                          │
│   ┌─────────────────────────────────────┐                   │
│   │         Autenticado                 │                   │
│   └──────────────────┬──────────────────┘                   │
│                      │                                      │
│         ┌────────────┴────────────┐                         │
│         ▼                         ▼                         │
│   ┌──────────────┐         ┌──────────────┐                 │
│   │ Sem loja     │         │ Com loja     │                 │
│   │ /store       │         │ / (campaign) │                 │
│   │ (create)     │         │ /store (edit)│                 │
│   │ / → redirect │         │ /campaign/*  │                 │
│   └──────┬───────┘         └──────────────┘                 │
│          │                                                   │
│          │ POST /api/store (onboarding)                      │
│          ▼                                                   │
│   ┌──────────────┐                                          │
│   │ Com loja     │                                          │
│   └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Transições:**

| De | Para | Gatilho |
|----|------|---------|
| Não auth → Autenticado | Signup (auto-confirm) ou Login |
| Não auth (pós-signup) → Aguardando confirmação | Signup com confirmação — estado de UX, sem sessão |
| Aguardando → Autenticado | `/auth/confirm` com token válido |
| Autenticado (sem loja) → Autenticado (com loja) | Onboarding completo (`POST /api/store`) |
| Autenticado → Não auth | Logout |

**Mapa de rotas por estado:**

> "Aguardando confirmação" é estado de UX, não identidade autenticada. Antes da confirmação não existe sessão; o servidor e o middleware veem o mesmo que um visitante não autenticado. Após signup, o cliente navega para `/check-email`. Acesso direto a rota protegida sem sessão sempre vai para `/login`. `/check-email` é público e exibe instrução genérica (não revela se o email existe ou não).

| Rota | Não autenticado (inclui aguardando) | Auth sem loja | Auth com loja |
|------|--------------------------------------|---------------|---------------|
| `/login` | ✅ formulário | ➡ redirect `/` | ➡ redirect `/` |
| `/signup` | ✅ formulário | ➡ redirect `/` | ➡ redirect `/` |
| `/check-email` | ✅ instrução genérica | ➡ redirect `/` | ➡ redirect `/` |
| `/auth/confirm` | ✅ processa token | ➡ redirect `/` | ➡ redirect `/` |
| `/store` | ➡ redirect `/login` | ✅ create | ✅ edit |
| `/` | ➡ redirect `/login` | ➡ redirect `/store` | ✅ campaign |
| `/campaign/preview` | ➡ redirect `/login` | ➡ redirect `/store` | ✅ preview |

---

## Arquitetura-Alvo

```
ARQUITETURA PÓS-V1.2
═══════════════════════════════════════════════════════════

                     ┌──────────────────────────┐
                     │        Browser           │
                     │  @supabase/ssr cookie    │
                     │  (sessão SSR)            │
                     └────────────┬─────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
         middleware.ts      Server Component     Route Handler
         (getClaims)        (getClaims)          (getClaims)
         renova sessão      resolve loja         valida ownership
         redirect páginas   decide estado        executa operação
              │                   │                   │
              ▼                   ▼                   │
      ┌──────────────┐    ┌──────────────┐           │
      │ /login       │    │ Páginas:     │           │
      │ /signup      │    │ /            │           │
      │ /check-email │    │ /store       │           │
      │ /auth/confirm│    │ /campaign/*  │           │
      │ (públicas)   │    └──────────────┘           │
      └──────────────┘                               │
                                                     │
              ┌──────────────────────────────────────┘
              │                    │
              ▼                    ▼
   ┌──────────────────┐   ┌──────────────────┐
   │ Cliente sessão   │   │ supabaseAdmin    │
   │ (createServer-   │   │ (service role)   │
   │  Client + RLS)   │   │ + ownership      │
   │                  │   │ verificado antes │
   │ SELECTs          │   │                  │
   │ (stores, assets, │   │ POST /api/store  │
   │  profiles, VS)   │   │ PATCH /store/:id │
   │                  │   │ POST/DELETE /logo│
   │                  │   │ POST /brand-*    │
   │                  │   │ POST /vs/*       │
   │                  │   │ POST /campaign/* │
   └────────┬─────────┘   │ IA pipelines     │
            │             │ Storage up/del   │
            ▼             └────────┬─────────┘
   ┌──────────────────────────────────────────────┐
   │              Supabase DB + Storage            │
   │                                                │
   │  public.stores              (RLS: SELECT)      │
   │  public.store_brand_assets  (RLS: SELECT)      │
   │  public.store_brand_profiles(RLS: SELECT)      │
   │  public.store_visual_signatures(RLS: SELECT)   │
   │  public.generation_events   (default-deny)     │
   │                                                │
   │  storage.buckets:                               │
   │    store-brand-assets/  (public read URL)       │
   │    visual-signatures/   (public read URL)       │
   │    store-logos/         (legado — pendente)     │
   └────────────────────────────────────────────────┘
```

---

## Fronteiras: Cliente de Sessão vs Service Role

### Princípio

> Cliente vinculado à sessão + RLS por padrão. Service role somente por necessidade demonstrada.

### Matriz por operação

| Operação | Cliente | Auth exigida | Ownership |
|----------|---------|-------------|-----------|
| | **Store CRUD** | | |
| `POST /api/store` (criar loja) | Admin (`supabaseAdmin`) | ✅ `requireUser()` | N/A (exceção invariante #11) — UNIQUE(user_id) protege |
| `GET /api/store/:id` | Sessão + RLS | ✅ RLS filtra | RLS: `stores.user_id = auth.uid()` |
| `PATCH /api/store/:id` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| | **Logo** | | |
| `GET /api/store/:id/logo` | Sessão + RLS | ✅ RLS filtra | RLS via subquery |
| `POST /api/store/:id/logo` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `DELETE /api/store/:id/logo` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/logo/retry-brand-director` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| | **Brand Profile** | | |
| `GET /api/store/:id/brand-profile` | Sessão + RLS | ✅ RLS filtra | RLS via subquery |
| `PATCH /api/store/:id/brand-profile` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/brand-profile` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/brand-profile/infer` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/brand-profile/realign` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `PATCH /api/store/:id/brand-profile/metadata` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/brand-profile/generate-without-logo` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| | **Visual Signature** | | |
| `GET /api/store/:id/visual-signature` | Sessão + RLS | ✅ RLS filtra | RLS via subquery |
| `DELETE /api/store/:id/visual-signature` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/visual-signature/approve` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/visual-signature/reject` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/visual-signature/restore` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/visual-signature/generate-without-logo` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `POST /api/store/:id/visual-signature/dismiss-critical-drift` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| `DELETE /api/store/:id/visual-signature/dismiss-critical-drift` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(id)` |
| | **Campaign** | | |
| `POST /api/campaign/generate` | Admin | ✅ `requireUser()` | ✅ `getCurrentStore()` (loja obrigatória) |
| `POST /api/campaign/generate-image` | Admin | ✅ `requireUser()` | ✅ `requireOwnership(storeId)` |
| | **Server Actions (classificação D11)** | | |
| `resolveStoreIdentity()` | `src/lib/actions/store.ts` | Serviço interno | Substituir chamada client por dados de página/endpoint protegido |
| `validateIdentityReference()` | `src/lib/actions/store.ts` | Serviço interno | Remover `"use server"`, receber `AuthorizedStoreContext` |
| `buildCampaignBrief()` | `src/lib/actions/store.ts` | Serviço interno | Remover `"use server"`, receber `AuthorizedStoreContext` |
| `generateVariations()` | `src/lib/visual-signature/server-actions.ts` | Entrypoint autenticado | ✅ `requireUser()` + `requireOwnership(storeId)` |
| `generateAutomatic()` | `src/lib/visual-signature/server-actions.ts` | Entrypoint autenticado | ✅ `requireUser()` + `requireOwnership(storeId)` |
| `activateSignature()` | `src/lib/visual-signature/server-actions.ts` | Entrypoint autenticado | ✅ `requireUser()` + `requireOwnership(storeId)` |
| `listSignatures()` | `src/lib/visual-signature/server-actions.ts` | Entrypoint autenticado | ✅ `requireUser()` + `requireOwnership(storeId)` + RLS; candidato a migração futura para Route Handler |
| | **Sessão** | | |
| Logout | Sessão (client-side) | ✅ sessão existente | N/A |

> **Nota — Server Actions (D11):** A classificação das 7 Server Actions está fechada. Três (`resolveStoreIdentity`, `validateIdentityReference`, `buildCampaignBrief`) são serviços internos — devem perder o `"use server"` e receber `AuthorizedStoreContext`. Quatro (`generateVariations`, `generateAutomatic`, `activateSignature`, `listSignatures`) permanecem entrypoints autenticados e precisam executar `requireUser()` e `requireOwnership(storeId)` antes de usar service role.

---

## Matriz de RLS e Storage

### RLS — Tabelas

| Tabela | RLS | Operações permitidas a `authenticated` | Policy |
|--------|-----|----------------------------------------|--------|
| `stores` | ✅ Habilitado | `SELECT` | `user_id = (SELECT auth.uid())` |
| `store_brand_assets` | ✅ Habilitado | `SELECT` | `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))` |
| `store_brand_profiles` | ✅ Habilitado | `SELECT` | `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))` |
| `store_visual_signatures` | ✅ Habilitado | `SELECT` | `store_id IN (SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid()))` |
| `generation_events` | ✅ Habilitado | **Nenhuma** (default-deny) | N/A — `authenticated` não recebe permissão |

> **Nota:** As políticas `FOR SELECT` garantem que `authenticated` veja apenas dados de sua própria loja. Escritas (INSERT, UPDATE, DELETE) não são concedidas a `authenticated` — permanecem em handlers privilegiados com service role, precedidos de validação de ownership.

### RLS — Storage (Buckets)

| Bucket | Público | Leitura via URL | Listagem de objetos | Escrita |
|--------|---------|----------------|-------------------|---------|
| `store-brand-assets` | `public = true` | ✅ Qualquer um com URL | ❌ Policy de SELECT ampla será removida/restringida | ❌ Client-side negado. Apenas server-side com ownership |
| `visual-signatures` | `public = true` | ✅ Qualquer um com URL | ❌ Policy de SELECT ampla será removida/restringida | ❌ Client-side negado. Apenas server-side com ownership |
| `store-logos` | Legado — pendente de inventário | ? | ? | ? |

> **Implicação:** Arquivos são publicáveis por URL (necessário para renderização de campanhas). A descoberta (listagem de objetos) e mutação (upload/delete) são protegidas — a primeira por remoção de policies amplas de SELECT, a segunda por validação de ownership no backend antes de usar service role.

---

## Critérios de Aceite

### Macro-critério

> Um usuário entra no Vendeo e acessa exclusivamente sua própria loja e identidade.

### Categorias de cenários

Os cenários exatos serão numerados durante o planejamento de cada fase. As categorias são:

| Categoria | Cobertura |
|-----------|-----------|
| **A — Barreira de autenticação** | Redirecionamentos de páginas públicas/protegidas, acesso a APIs sem sessão |
| **B — Criação de conta** | Signup (auto-confirm e com confirmação), login, logout, validações |
| **C — Onboarding** | Estado sem loja, criação de loja, redirects, segunda loja (409) |
| **D — Isolamento cross-tenant** | GET/PATCH de loja alheia, todas as sub-rotas (`/logo/*`, `/brand-profile/*`, `/visual-signature/*`, `/campaign/generate-image`) parametrizadas |
| **E — Sessão** | Persistência (F5, navegação), renovação de token, cookie inválido, logout |
| **F — Perímetro de APIs** | 401 consistente, 404 consistente, redirect validation, generate-image com store alheia |
| **G — Storage** | Download público via URL, listagem bloqueada, upload direto negado, pipeline do owner funciona, pipeline alheio 404 |
| **H — Vazamento entre sessões** | Logout limpa preview/drafts, usuário B não vê dados do usuário A, preview valida store atual |
| **RLS — Banco** | `generation_events` inacessível, escrita direta negada, `user_id` do cliente ignorado |

### Pirâmide de validação

```
                ┌──────────┐
                │ UAT      │  Experiência, mensagens,
                │ manual   │  entrega real de email
                ├──────────┤
                │ E2E      │  Signup, confirmação,
                │ browser  │  onboarding, cookies, logout
                ├──────────┤
                │ Banco/   │  Isolamento, grants,
                │ RLS real │  default-deny (Supabase real/local)
                ├──────────┤
                │ Integr.  │  401/404, criação, ownership,
                │ HTTP     │  APIs privilegiadas
                ├──────────┤
                │ Unitários│  Validação, redirect allowlist,
                │          │  helpers de autorização
                └──────────┘
```

### Condição de fechamento

> A milestone é considerada concluída quando todos os cenários de todas as categorias estão VERDES, com evidências na respectiva camada da pirâmide. Cenários críticos de segurança (D, G, RLS) **devem** ter cobertura automatizada; UAT manual é complementar.

---

## Pendências Classificadas

### Design de fase (resolvidas durante o planejamento de cada fase)

| Pendência | Fase |
|-----------|------|
| `requireUser()` | Phase 7 (Sessão e Login) |
| Matcher exato do `middleware.ts` | Phase 7 |
| Estratégia de redirect preserve (`?redirect=`) com allowlist | Phase 7 |
| `getCurrentStore()` e `requireOwnership()` | Phase 9 (Cutover de Ownership) |
| Semântica 404 vs estado explícito "sem loja" | Phase 9 |
| Props vs React Context para `storeId` | Phase 9 |
| `GET /api/store` como atalho para loja corrente | Phase 9 |
| `AuthorizedStoreContext` (formato) | Phase 10 (Perímetro) |
| Três Server Actions viram serviços internos | Phase 10 |
| Quatro Server Actions ganham auth + ownership | Phase 10 |

### Release gates (necessários antes de abrir para beta externo)

| Gate | Critério |
|------|----------|
| SMTP configurado (Resend, SendGrid, Postmark) | Confirmação de email funcional em produção |
| Ambientes Supabase separados (dev / prod) | Auto-confirm em dev, confirmação em prod |

### Legado (inventariar durante a milestone)

| Item | Ação |
|------|------|
| Bucket `store-logos` | Inventariar (entra na Fase 5). Remoção/migração condicionada ao resultado |

### Futuro / Fora de escopo da v1.2

| Item | Destino |
|------|---------|
| Export PNG/JPG | Milestone futura |
| Dashboard completo | Milestone futura |
| Múltiplas lojas (1:N) | Decisão futura de produto |
| OAuth social / Magic link | Milestone futura |

---

## Fases da Milestone

```
DEPENDÊNCIAS:   F1 → F2 → F3 → F4 → F5
Sequencial. Cada fase termina com comportamento verificável.

Legenda: F1 = Phase 7 · F2 = Phase 8 · F3 = Phase 9 · F4 = Phase 10 · F5 = Phase 11
```

### Fase 1 (Phase 7) — Sessão e Login Vertical

**O quê:**
- Instalar `@supabase/ssr`
- Criar clientes browser (`createBrowserClient`) e server (`createServerClient`)
- Helper `requireUser()` (valida claims, retorna 401/redirect)
- `middleware.ts` — renovar sessão, redirecionar páginas protegidas
- `/login` — formulário de entrada
- Logout — destruir sessão
- Validação de ambiente (ENV vars, Supabase Auth habilitado)

**Entrega:** Usuário previamente criado consegue entrar, manter sessão e sair. Páginas protegidas funcionam (redirecionam não autenticados).

**Dependências:** Nenhuma.

---

### Fase 2 (Phase 8) — Ciclo de Conta

**O quê:**
- `/signup` — formulário de cadastro (email + senha)
- `/check-email` — instrução genérica pós-signup
- `/auth/confirm` — processar token de confirmação
- `/forgot-password` — solicitação de redefinição
- `/update-password` — nova senha
- Auto-confirm em dev, confirmação habilitada como release gate de produção
- Integração com Supabase Auth para envio de email

**Entrega:** Ciclo completo de credenciais — criar conta, confirmar email, recuperar senha.

**Dependências:** Fase 1 (precisa de `requireUser()`, middleware, login para teste).

---

### Fase 3 (Phase 9) — Cutover de Ownership e Onboarding

**O quê:**
- Migration: `ALTER TABLE stores ADD COLUMN user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id)` + reset de dados
- `getCurrentStore()` — resolve loja por `claims.sub`
- `requireOwnership(storeId)` — valida que store pertence ao user
- `POST /api/store` usando `claims.sub` (ignora user_id do cliente)
- `/store` em modo create (sem loja) e edit (com loja)
- Remover `localStorage("store_id")` dos 3 arquivos
- Resolver e propagar `storeId` por props/server components
- RLS em `stores` (`user_id = auth.uid()`)

**Entrega:** Usuário autenticado cria loja, retorna e acessa exclusivamente sua própria loja. Banco e aplicação mudam juntos, sem quebra intermediária.

**Dependências:** Fase 1 + Fase 2.

---

### Fase 4 (Phase 10) — Perímetro Multi-tenant

**O quê:**
- RLS nas 4 tabelas restantes (`store_brand_assets`, `store_brand_profiles`, `store_visual_signatures` com SELECT do owner; `generation_events` default-deny)
- Storage: remover políticas amplas de SELECT (listagem) em `store-brand-assets` e `visual-signatures`
- `requireOwnership()` em todos os 20+ route handlers de identidade e IA
- Três Server Actions viram serviços internos (remover `"use server"`, receber `AuthorizedStoreContext`)
- Quatro Server Actions permanecem entrypoints autenticados (ganham `requireUser()` + `requireOwnership()`)
- CSRF/same-origin nas mutações POST/PATCH/PUT/DELETE
- Testes parametrizados por endpoint (cobrindo todas as rotas store-scoped)

**Entrega:** Toda superfície existente respeita o tenant — handlers, storage e Server Actions autenticam e autorizam.

**Dependências:** Fase 3 (ownership testável só depois que store está vinculada ao user).

---

### Fase 5 (Phase 11) — Verificação e Hardening

**O quê:**
- Testes RLS contra banco real/local (não mock)
- Testes cross-tenant automatizados (usuário A vs loja do B)
- E2E de sessão, onboarding e recuperação de senha
- Vazamento de `sessionStorage` entre usuários (logout limpa preview/drafts)
- Inventário do bucket `store-logos`
- Regressão dos 297 testes afetados pela migração de auth
- UAT manual complementar
- Fechamento do catálogo de cenários D8

**Entrega:** Evidência formal de conclusão da milestone — todos os cenários de segurança VERDES.

**Dependências:** Fase 4 (perímetro precisa estar implementado para ser verificado).



---

*Documento criado: 2026-07-03*
*Última atualização: 2026-07-03*
*Próximo passo: iniciar alinhamento técnico da Phase 7 (Sessão e Login Vertical) via OpenSpec Explore.*
