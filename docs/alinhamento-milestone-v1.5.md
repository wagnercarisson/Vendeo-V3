# Alinhamento — Milestone v1.5 "Lançamento Externo Controlado"

**Status:** Discussão exploratória concluída. Decisões registradas abaixo.
**Data:** 2026-07-15
**Próximo passo:** Revisão do artefato pelo time. Após aprovação, decompor em fases com OpenSpecs e planos de execução.

> Este documento é o artefato de alinhamento da milestone. Ele registra as decisões tomadas, invariantes, arquitetura-alvo e critérios de aceite. **Não é roadmap nem plano de implementação.** O fatiamento em fases e o planejamento detalhado vêm depois, em documentos próprios.

---

## Objetivo da Milestone

Preparar o Vendeo para o primeiro público real controlado. A v1.4 entregou a experiência SaaS (app shell, dashboard, onboarding, histórico, mobile), mas o produto ainda não está pronto para operar com usuários reais em produção:

- O copy da campanha é determinístico e primitivo (concatena nome + descrição + CTA), sem inteligência de persuasão, tom de voz ou segmento
- A geração não tem controle de custos — cada chamada de IA custa dinheiro e não há limite por usuário
- Não existe sistema de créditos, então não há barreira de entrada nem monetização
- A página de conta é minimalista — sem saldo, extrato ou ações de autocomplete
- A operação carece de observabilidade mínima para detectar falhas, abusos ou degradação antes que afetem múltiplos usuários

Esta milestone resolve esses gaps para que possamos abrir o produto para um grupo controlado de lojistas reais com segurança financeira e operacional.

### Critério de conclusão

> Um lojista real (fora do time de desenvolvimento) consegue se cadastrar, receber créditos gratuitos, gerar uma campanha com copy inteligente via IA (título, legenda, hashtags, CTA), revisar o resultado, receber créditos adicionais via operação/admin durante o beta controlado, e repetir o ciclo — com a operação monitorada, custos controlados, dados retidos conforme política, falhas tratadas sem perder créditos, e experiência visual publicável.

### O que está no escopo

| Item | Descrição |
|------|-----------|
| Copy Director | Serviço de IA separado para geração de copy persuasivo: **título/gancho**, legenda (caption), CTA e hashtags — com tom de voz, segmento e conhecimento de marketing |
| Separação copy × geração visual | Copy Director e Image Director rodam em paralelo (copy não influencia a arte). Pipeline dividido desde a arquitetura |
| Sistema de créditos | Saldo por usuário, dedução por geração bem-sucedida, transações auditáveis, sem planos |
| Admin operacional | Console de suporte para o time operar o beta: convidar usuários, conceder créditos manualmente, visualizar saldo/extrato, investigar erros, auditar ações |
| Saldo visível | Saldo no app shell (topbar) e na página de conta |
| Extrato de créditos | Histórico de transações (ganhos, compras, gastos, reembolsos) na página de conta |
| Controle de custos | Rate limit por usuário, teto de gasto diário, aborto de gerações excessivamente longas |
| Observabilidade | Logging estruturado do pipeline de geração, telemetria de custo/duration/provedor, alertas de erro, dashboard operacional |
| Tratamento de falhas | Para o usuário: crédito só é debitado se a geração for bem-sucedida. Estados de falha claros na UI |
| Onboarding com créditos | Novo usuário ganha créditos gratuitos ao criar a loja. Experiência guiada até a primeira geração |
| Segurança revisada | RLS/policies verificadas, ownership em rotas de crédito, proteção de inputs críticos enviados à IA, revisão de uso de service role |
| Retenção de dados e assets | Política de retenção definida para campanhas, imagens no Storage, assets de marca, logs/telemetria, eventos de IA e transações financeiras |
| Refinamento visual e experiência publicável | Loading states, empty states, error states, bloqueio sem crédito, legibilidade da peça gerada, copy da interface, fluxo formulário → geração → revisão → exportação com acabamento de produto público |
| Deploy e operação | Checklist de deploy, variáveis de ambiente documentadas, processo de rollback, validação local e online, procedimentos de suporte (estorno manual, concessão de crédito), critérios de saúde do lançamento |
| Mobile hardening (v2) | Revisão de fluxos críticos em mobile (solicitação de créditos, geração, copy review) |
| Critérios de lançamento externo | Canal de feedback, métricas mínimas de saúde (sucesso de geração, custo médio, erro, solicitação/concessão manual de créditos, uso de créditos), decisão de ampliar ou pausar |

### O que está fora do escopo

| Item | Motivo |
|------|--------|
| Planos / assinaturas mensais | Uso livre + créditos avulsos é suficiente para lançamento controlado. Planos são milestone futura |
| Múltiplas lojas (1:N) | Relação 1:1 user→store mantida |
| Times / permissões multi-usuário | Single-user |
| Integração com Instagram (API) | Publicação é manual (baixar e postar). API de postagem automática é milestone futura |
| Analytics avançado (CTR, impressões, conversão) | Fora do core de geração |
| Editor visual livre (Canva-like) | Geração guiada, não livre |
| PWA / install prompt | Não prioritário para lançamento controlado |
| OAuth social / Magic link | Exclusão deliberada desde v1.2 |
| Campanhas multi-formato (Stories, Landscape) | Apenas 1080×1080 feed |
| Cache de prompts / otimização de tokens | Feature futura de redução de custo |
| Stripe Checkout / compra real de créditos | Reposicionado para F30/v1.6 — pós-beta. Durante v1.5, crédito é operado pelo time via admin | 
| Dashboard administrativo avançado / analytics de negócio (receita, LTV, cohorts) | Dashboard operacional mínimo (taxa de sucesso, custo médio, erro rate) está dentro do escopo. Analytics avançado é futuro |

---

## Invariantes

Estes invariantes são absolutos. Nenhuma fase pode violá-los. Reafirmam e estendem os invariantes da v1.4.

1. **Para o usuário, crédito só é perdido na geração bem-sucedida** — O contrato com o usuário: geração `ready` deduz 1 crédito; geração `error` não custa nada. **Internamente**, o sistema pode fazer reserva reversível antes da IA e estornar em caso de falha — isso é detalhe de implementação, não cobrança antecipada.
2. **Saldo nunca fica negativo** — Toda dedução verifica saldo antes de executar. Se saldo for insuficiente, a geração é recusada antes de qualquer chamada de IA paga.
3. **Copy Director é independente do Image Director** — Copy Director pode ser chamado sem gerar imagem. A imagem pode ser gerada sem chamar o Copy Director novamente. Na v1.5 rodam **em paralelo** porque o copy não influencia a arte.
4. **Observabilidade não afeta performance** — Métricas e logs são assíncronos (fire-and-forget ou batch). Nenhuma etapa do pipeline crítico espera por observabilidade.
5. **Falha não perde crédito (consistência interna)** — Se a geração falha após a reserva, o sistema estorna automaticamente. O saldo final visível ao usuário é sempre consistente com "só paga se der certo".
6. **Controle de custos precede geração** — Rate limit e teto de gasto são verificados antes de qualquer chamada de IA, não depois.
7. **Transações de crédito são imutáveis** — `credit_transactions` é append-only. Nenhuma transação é alterada ou deletada. Estornos criam novas transações com tipo `refund`.
8. **Copy Director segue o padrão director existente** — Prompt template em `prompts/`, serviço em `src/lib/copy/`, provider de IA compartilhado, sem acoplamento ao `ImageGenerationService`.
9. **Saldo visível em toda experiência autenticada** — O saldo de créditos aparece na topbar (app shell) e na página de conta. O usuário nunca precisa adivinhar quantos créditos tem.
10. **Gratuidade inicial** — Todo novo usuário recebe créditos gratuitos ao completar o onboarding. O produto nunca bloqueia o primeiro uso atrás de pagamento.
11. **Dados e assets têm retenção definida** — Toda entidade armazenada (campanha, imagem, asset, log, transação financeira) tem política de retenção explícita. Nada é retido indefinidamente sem critério.
12. **Segurança revisada antes do lançamento** — Toda rota nova, policy RLS, input submetido à IA e uso de service role é revisado e testado antes de abrir para usuários externos.

---

## Ledger de Decisões

### D1 — Copy Director como serviço de IA independente

`DECIDIDO`

- O Copy Director é um novo serviço (`CopyDirectorService`) no padrão dos diretores existentes
- Prompt template em `prompts/campaign-copy-director.md`
- Provider de IA compartilhado (mesma abstração de `ImageProvider`, mas para texto)
- Gera: `title` (título/gancho persuasivo), `caption` (legenda completa), `hashtags` (segmento + produto + oferta), `cta_post` (adaptado ao segmento)
- Input: `CampaignBrief` (productName, description, offer, storeName, segment, brandProfile, visualDirectives opcionais)
- Output: `CopyDirectorResult { title, caption, hashtags[], cta_post, toneDescription? }`
- Pode ser chamado standalone (sem gerar imagem) ou como etapa do pipeline completo
- Não substitui o snapshot original — o `publication_copy_snapshot` passa a vir do Copy Director em vez das funções determinísticas `buildCaption()`/`buildHashtags()`
- Edição manual do publication copy (existente desde v1.3) continua funcionando normalmente

### D2 — Separação do pipeline: Copy ∥ Visual (paralelo)

`DECIDIDO`

```
FLUXO ATUAL (v1.4):
  Brief --> [deterministic copy inline] --> Image Generation --> Persist --> Ready

FLUXO v1.5 (paralelo):
  Brief --> Copy Director (AI) ---+
                                  +---> Merge --> Persist --> Ready
         --> Image Director (AI)--+
```

**Justificativa do paralelismo:** No motor atual, o copy (texto) **não influencia** a arte (imagem). O Image Director recebe o brief do produto (nome, descrição, oferta, identidade visual), não o copy. Portanto, Copy Director e Image Director podem executar simultaneamente, cortando a latência total pela metade (o mais lento dos dois define o tempo).

- O pipeline divide em dois ramos independentes logo após auth + saldo check + reserva
- Cada ramo é assíncrono: uma promise para Copy Director, outra para Image Director
- Quando ambos completam, o `Pacote final` faz o merge (copia `copyDirectorResult` para `publication_copy_snapshot`, anexa a imagem)
- Se um ramo falha e o outro não, o ramo bem-sucedido é descartado e a geração inteira é tratada como erro (com estorno de crédito)
- A arquitetura permite no futuro: modo sequencial (se copy passar a influenciar a arte), ou "gerar copy hoje, revisar, gerar imagem amanhã"

Implicações no estado da campanha:

```
[Reserva] ──▶ GENERATING ──▶ [Copy ∥ Image] ──▶ MERGE ──▶ READY
                                                     │
                                                     └── ERROR (se qualquer ramo falhar)
```

Por decisão desta milestone: manter `generating` → `ready` / `error` como único estado de campanha visível ao usuário. Copy Director e Image Director executam antes do UPDATE `ready`. O estado `copy_pending` é interno (não exposto como status de campanha).

### D3 — Arquitetura de créditos: saldo, transação e dedução

`DECIDIDO`

**Modelo de dados (eixo `store_id`, conforme implementado na F24):**

```sql
-- Saldo atual da loja (materializado para leitura rápida)
CREATE TABLE credit_balances (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id),
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Histórico imutável de transações
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id),
  type TEXT NOT NULL CHECK (type IN ('grant', 'purchase', 'deduction', 'refund', 'adjustment')),
  amount INTEGER NOT NULL, -- positivo para grant/purchase/refund, negativo para deduction
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL, -- saldo após esta transação (para reconciliação)
  campaign_id UUID REFERENCES public.campaigns(id),
  reference TEXT, -- ID externo (ex: stripe_session_id, admin_note)
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_store ON credit_transactions(store_id, created_at DESC);
```

**Fluxo de dedução:**

```
1. Usuário solicita geração
2. Verifica saldo >= custo_da_geracao → se não, reject com 402
3. Reserva crédito: INSERT 'deduction' com balance_after = balance - cost
   (saldo materializado é atualizado, mas reversível até confirmação)
4. Executa pipeline de geração (Copy Director + Image Director)
5a. Sucesso → confirma (nenhuma ação extra — o saldo já reflete a dedução)
5b. Falha → estorno: INSERT 'refund' com amount = +cost, restaura saldo
5c. Aborto (timeout, cancelamento) → estorno como falha
```

Custo por geração: fixo em 1 crédito na v1.5 (variável por complexidade é futuro).

**Créditos iniciais:** 5 créditos gratuitos na criação da loja (INSERT `grant`).

**Transações visíveis ao usuário:** Todos os tipos, exceto `adjustment` (admin-only, oculto do extrato do usuário).

### D4 — Provedor de pagamento

`ADIADO / REPOSICIONADO`

> Stripe Checkout sai do caminho crítico da v1.5. Durante o beta controlado, 
> o saldo é operado pelo time via admin grant manual auditável. Stripe será 
> retomado como F30/v1.6 (Monetização Pública) após validação do beta.

**Status:** Stripe permanece como direção futura, mas **não fecha v1.5.** 
O `CreditService.grantCredits()` já está pronto e idempotente — a F30 usará 
o mesmo mecanismo, substituindo o admin manual pelo webhook Stripe.

- **Direção futura:** Stripe Checkout (mínimo viável)
- **Quando:** F30/v1.6, pós-beta controlado
- **Produto no Stripe:** Crédito avulso (pacotes de 10, 25, 50 créditos)
- **Mecanismo:** `CreditService.grantCredits()` já testado e funcional — será chamado pelo webhook Stripe
- **Fallback:** Asaas/Pix para mercado brasileiro (avaliar na F30)

| Pacote | Créditos | Preço sugerido (referência) |
|--------|----------|-----------------------------|
| Starter | 10 | R$ 19,90 |
| Pro | 25 | R$ 39,90 |
| Turbo | 50 | R$ 69,90 |

### D5 — Controle de custos e rate limiting

`DECIDIDO`

Três camadas de proteção:

1. **Rate limit por usuário:** Máximo de 10 gerações por hora por usuário. Implementado via Supabase ou Redis-like (na v1.5, controle via tabela `generation_events` com janela deslizante de 1h)
2. **Teto de gasto diário:** Máximo de 30 gerações por dia por usuário (independente de saldo)
3. **Timeout de geração:** Pipeline aborta após 120 segundos totais. Aborto trata como falha com estorno de crédito

Implementação: middleware/guard no início da rota `POST /api/campaign/generate-image`, antes de qualquer chamada de IA, depois da auth.

### D6 — Observabilidade mínima

`DECIDIDO`

Escopo inicial para lançamento controlado:

- **Logging estruturado:** Cada etapa do pipeline loga com `campaignId`, `storeId`, `userId`, `duration_ms`, `phase`, `status`
- **Telemetria de IA:** Provedor, modelo, tokens de input/output, custo estimado, duração — registrados em `generation_events` ou nova tabela de telemetria
- **Alertas:** Erro rate > 5% na última hora, custo outlier > 3σ, saldo baixo recorrente por loja, grants manuais anômalos
- **Dashboard de operação** (acesso admin/DEV apenas): taxa de sucesso, custo médio por geração, saldo médio por loja, grants manuais realizados, users ativos, taxa de estorno

> A decisão de ferramental (Grafana, Datadog, Planilha, logs do Vercel) é adiada — começa com logs estruturados no `console.*` + Vercel Logs, evolui conforme necessidade.

### D7 — Saldo visível no app shell

`DECIDIDO`

- A topbar do app shell exibe o saldo de créditos ao lado do menu de conta
- Formato: ícone (moeda/bolt) + número (ex.: "42 créditos")
- Ao clicar, pode abrir um dropdown rápido "Solicitar créditos" / "Fale com o time" que leva a `/conta#creditos`
- O saldo é server-side: o server component do layout busca `credit_balances.balance` para o usuário logado
- Fallback: se não encontrar saldo (novo usuário sem registro `credit_balances`), tratar como 0

### D8 — Copy Director usa texto, não imagem

`DECIDIDO`

- O Copy Director usa um **provider de texto** (OpenAI Chat Completion / Anthropic Messages), não o ImageProvider
- A camada de abstração de IA existente será estendida para suportar providers de texto:
  - `createTextProvider()` paralela a `createImageProvider()`
  - Contrato: `generateText(prompt, options?) → { content: string, usage: { promptTokens, completionTokens } }`
  - Permite swap OpenAI ↔ Anthropic sem mudar código do Copy Director
- Prompt do Copy Director é um template markdown em `prompts/campaign-copy-director.md`
- O prompt inclui: dados do produto, segmento da loja, tom de voz (do brand profile), regras de copywriting persuasivo

### D9 — Experiência sem crédito não é bloqueio

`DECIDIDO`

- Usuário com saldo zero NÃO é bloqueado de acessar o app
- O dashboard funciona normalmente, mostra histórico, permite revisar campanhas passadas
- O formulário de geração mostra aviso claro de saldo insuficiente com CTA para solicitar créditos
- O botão "Gerar campanha" fica desabilitado com tooltip: "Você precisa de créditos para gerar uma campanha"
- O CTA durante o beta é "Solicitar créditos" / "Fale com o time" — sem redirecionamento Stripe
- Zero blockers — o produto nunca fica inutilizável por falta de crédito, apenas o motor de geração é limitado

### D10 — Política de retenção de dados e assets

`DECIDIDO`

Toda entidade armazenada tem política de retenção explícita:

| Entidade | Retenção | Justificativa |
|----------|----------|---------------|
| **Campanhas (`campaigns`)** | Indefinida (vitalícia enquanto a conta existir) | O histórico é o portfólio do lojista. Remoção só por exclusão voluntária da conta |
| **Imagens geradas (`campaign-images`)** | Vinculada à campanha. Excluída se a campanha for excluída (CASCADE) | A imagem não faz sentido sem o registro |
| **Assets de marca (`store-brand-assets`)** | Indefinida (vitalícia) | Assets são configurados uma vez e reusados em todas as campanhas |
| **Logs de telemetria/IA** | 90 dias corridos | Suficiente para debugging e análise de custo. Após 90d, agregados estatísticos anonimizados podem ser mantidos |
| **Eventos de IA (`generation_events`)** | 90 dias | Mesma política da telemetria — janela de suporte e anomalia |
| **Transações financeiras (`credit_transactions`)** | Indefinida (vitalícia) | Obrigação fiscal e de auditoria. O usuário precisa ver o extrato completo |
| **Saldos (`credit_balances`)** | Indefinida (enquanto a conta existir) | Saldo corrente é estado ativo |
| **Sessões/logs de auth** | Gerenciado pelo Supabase Auth (política do provider) | Fora do controle da aplicação |

**Implementação:** A política de 90 dias para logs e eventos de IA pode ser implementada como job Supabase (pg_cron) ou função serverless agendada. Não precisa estar na v1.5 initial ship, mas a política deve estar documentada e o cleanup implementado dentro de 30 dias do lançamento.

### D11 — Revisão de segurança completa

`DECIDIDO`

Toda a superfície da v1.5 passa por revisão de segurança antes do lançamento:

1. **RLS/policies:** Verificar se as novas tabelas (`credit_balances`, `credit_transactions`) têm policies restritivas. Confirmar que tabelas existentes continuam com políticas adequadas
2. **Ownership em rotas de crédito:** Toda rota `/api/credits/*` valida que `userId = claims.sub` — ninguém mexe no saldo alheio
3. **Inputs críticos enviados à IA:** Brief do Copy Director contém dados do produto e da loja. Garantir que nenhum dado sensível (email, tokens, IDs internos) vaze no prompt
4. **Uso de service role:** Manter o padrão existente: service role só após ownership verificado. Crédito é exceção parcial (operações financeiras precisam de atomicidade que RLS não garante), mas toda chamada é precedida de validação de identidade
5. **Proteção de rotas admin:** Toda rota `/api/admin/*` protegida por `requireAdmin()` — sem exceção. Admin gate via `admin_users` table, não flag em `auth.users`
6. **Audit log obrigatório:** Toda ação administrativa sensível registrada em `admin_audit_log` (append-only). Grant sem audit trail é tratado como falha
7. **Rate limit como segurança:** Além de controle de custo, rate limit protege contra abuso (múltiplas contas, ataques de negação de serviço no pipeline de IA)
8. **Validação de input no Copy Director:** O prompt template sanitiza variáveis para evitar injection via dados do produto
9. **Proteção de webhook (Stripe):** Webhook Stripe validado por assinatura HMAC — implementação diferida para F30/v1.6

### D12 — Admin Operacional como pré-requisito do beta controlado

`DECIDIDO`

A F26 implementa um console operacional de suporte, não um dashboard analítico. O escopo é:

| O que é | O que não é |
|---------|-------------|
| Admin gate (`admin_users` table) | RBAC complexo |
| Listar e buscar usuários/lojas | CRUD destrutivo de usuários |
| Conceder créditos manualmente (motivo obrigatório) | Stripe Checkout |
| Visualizar saldo e extrato de qualquer loja | Métricas agregadas |
| Visualizar campanhas com erro para triagem | Analytics avançado |
| Audit log imutável de ações administrativas | Impersonation |

**Motivação:** Para operar um beta com 3-5 lojistas reais, o time precisa de capacidade operacional antes de automatizar a venda. Crédito continua no centro — a diferença é que o time opera a alavanca durante o beta.

### D13 — Convite Beta: MVP sem email convite

`DECIDIDO`

O fluxo de convite beta é o mínimo viável:

1. Usuário existe via fluxo normal de auth/Supabase (signup normal)
2. Admin vê usuário sem loja no diretório admin
3. Admin completa onboarding: cria loja + concede 5 créditos (RPC `create_store_with_initial_grant` já existe)
4. Usuário loga e encontra a loja pronta

**Fora do escopo da F26:**
- Envio de convite por email
- Criação de usuário pelo admin
- Magic link / aprovação formal de cadastro
- Link público de signup beta

### D14 — Admin Access Gate

`DECIDIDO`

- **Tabela:** `admin_users(user_id UUID PRIMARY KEY REFERENCES auth.users(id))` — simples, sem coluna em `auth.users`
- **Gate:** `requireAdmin()` = `requireApiUser()` + SELECT em `admin_users`
- **Login:** Mesmo login normal (sem `/admin/login` separado)
- **Middleware:** Protege rotas `/admin/*` com redirect se não admin
- **API routes:** Cada rota `/api/admin/*` chama `requireAdmin()` internamente (dupla proteção)



```
ARQUITETURA PÓS-V1.5
═══════════════════════════════════════════════════════════

                         ┌──────────────────────────┐
                         │        Browser           │
                         │  @supabase/ssr cookie    │
                         │  (sessão SSR)            │
                         └────────────┬─────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
         middleware.ts          Server Component         Route Handler
         (getClaims)            (getClaims)              (getClaims)
         renova sessão          resolve loja             valida ownership
         redirect auth          decide estado            executa operação
         rate limit guard       saldo via SC             controle custos
              │                       │                       │
              ▼                       ▼                       │
      ┌──────────────┐       ┌──────────────┐               │
      │ /login       │       │ Páginas:     │               │
      │ /signup      │       │ /dashboard   │               │
      │ /check-email │       │ /campanhas   │               │
      │ /auth/confirm│       │ /campanhas/  │               │
      │ (públicas)   │       │   nova       │               │
      └──────────────┘       │ /campanhas/  │               │
                             │   [id]       │               │
                             │ /loja        │               │
                             │ /conta       │               │
                             │   (créditos) │               │
                             └──────────────┘               │
                                                             │
              ┌──────────────────────────────────────────────┘
              │                    │
              ▼                    ▼
   ┌──────────────────┐   ┌──────────────────┐
   │ Cliente sessão   │   │ supabaseAdmin    │
   │ (createServer-   │   │ (service role)   │
   │  Client + RLS)   │   │ + ownership      │
   │                  │   │ verificado antes │
   │ SELECTs          │   │                  │
   │ (campaigns,      │   │ Mutations        │
   │  stores,         │   │ (generate-image, │
   │  credit_balances,│   │  download,       │
   │  credit_transact)│   │  admin-credits,  │
   │                  │   │  copy-director)  │
   └────────┬─────────┘   └────────┬─────────┘
            │                      │
            ▼                      ▼
   ┌──────────────────────────────────────────────────────┐
   │                    Supabase DB + Storage               │
   │                                                       │
   │  public.campaigns              (RLS: SELECT)           │
   │  public.credit_balances        (RLS: SELECT)           │
   │  public.credit_transactions    (RLS: SELECT)           │
   │  public.stores                 (RLS: SELECT)           │
   │  public.store_brand_assets     (RLS: SELECT)           │
   │  public.store_brand_profiles   (RLS: SELECT)           │
   │  public.store_visual_signatures(RLS: SELECT)           │
   │  public.generation_events      (default-deny)          │
   │                                                       │
   │  storage.buckets:                                      │
   │    campaign-images/   (privado + signed URLs)          │
   │    store-brand-assets (público + RLS SELECT)           │
   │    visual-signatures/ (público + RLS SELECT)           │
   └───────────────────────────────────────────────────────┘

                    ┌───────────────────────────────┐
                    │         Provider Layer          │
                    │                                 │
                    │  ┌─────────────────────────┐   │
                    │  │ ImageProvider           │   │
                    │  │ (OpenAI / Anthropic)    │   │
                    │  │ → generateImage()       │   │
                    │  └─────────────────────────┘   │
                    │                                 │
                    │  ┌─────────────────────────┐   │
                    │  │ TextProvider (NOVO)     │   │
                    │  │ (OpenAI / Anthropic)    │   │
                    │  │ → generateText()        │   │
                    │  └─────────────────────────┘   │
                    └───────────────────────────────┘

                    ┌───────────────────────────────┐
                    │     Serviços Internos           │
                    │                                 │
                    │  CopyDirectorService (NOVO)     │
                    │    → generateCopy(brief)        │
                    │    → usa TextProvider           │
                    │                                 │
                    │  ImageGenerationService (exist.) │
                    │    → generateImage(brief)        │
                    │    → usa ImageProvider           │
                    │                                 │
                    │  CreditService (NOVO)            │
                    │    → getBalance(storeId)         │
                    │    → reserveCredit(storeId)      │
                    │    → confirmCredit(txId)         │
                    │    → refundCredit(txId)          │
                    │    → getHistory(storeId)         │
                    └───────────────────────────────┘
```

### Pipeline de geração v1.5

```
FORMULÁRIO                    BACKEND                          SUPABASE / IA
──────────                    ───────                          ─────────────

[preenche dados]
       │
       ▼
POST /api/campaign/generate-image
       │
       ├── requireOwnership + rateLimit + saldoCheck
       │    (se saldo < 1 → 402 Payment Required)
       │
       ├── Gera campaignId + storage_path
       │
       ├── Reserva crédito: CreditService.reserve()
       │    INSERT credit_transactions (deduction) ──────►  créditos
       │    UPDATE credit_balances (balance - 1)
       │
       ├── INSERT campaigns ────────────────────────────►  campaigns (generating)
       │    (status='generating', input_snapshot, identity_snapshot)
       │
       ├── RAMO PARALELO
       │
       ├── Promise.all([ copyDirector, imageDirector ])
       │   ├── Copy Director              Image Director
       │   │   .generateCopy(brief)        .generateImage(brief)
       │   │   TextProvider                ImageProvider
       │   │   .generateText(prompt)       .generateImage(prompt)
       │   │   --> { title, caption,       --> imagem (buffer)
       │   │        hashtags, cta_post }
       │   │
       │   └── Ambas resolvem (ou qualquer uma falha --> ERROR)
       │
       ├── Merge: publication_copy_snapshot = copyDirectorResult
       │
       ├── Transcode + Upload Storage ──────────────────►  campaign-images/
       │
       ├── Confirma crédito: CreditService.confirm()
       │    (nenhuma ação — transação de deduction já é definitiva)
       │
       ├── UPDATE campaigns ────────────────────────────►  campaigns (ready)
       │    (status='ready', publication_copy_snapshot=copyDirectorResult,
       │     render_snapshot, generation_metadata)
       │
       └── NDJSON result { campaignId, campaignUrl }

EM CASO DE FALHA:
       │
       ├── CreditService.refund()
       │    INSERT refund ──────────────────────────────►  credit_transactions
       │    UPDATE credit_balances (balance + 1)
       │
       └── UPDATE campaigns ────────────────────────────►  campaigns (error)
            (status='error', error_message)
```

### Fluxo de admin grant (substitui compra na v1.5)

> O fluxo abaixo substitui a compra Stripe durante o beta controlado. Stripe será retomado na F30/v1.6.

```
ADMIN                          FRONTEND ADMIN              BACKEND                      SUPABASE
─────                          ──────────────              ───────                      ────────

[abre /admin/users]
       │
       ▼
[busca lojista]
       │
       ▼
[abre detalhe: saldo, extrato, campanhas]
       │
       ▼
[clica "Conceder créditos"]
       │
       ▼
[preenche: amount, motivo (obrigatório), operationId (gerado pelo client)]
       │
       ▼
POST /api/admin/credits/grant { storeId, amount, reason, operationId }
       │                          │
       │                          ├── requireAdmin()
       │                          ├── Valida motivo não vazio + operationId UUID
       │                          ├── RPC admin_grant_credits(actor_id, store_id,
       │                          │    amount, reason, operation_id)
       │                          │    ├── Checa operation_id existente (idempotência)
       │                          │    ├── grant_credits() ──────────────────►  crédito
       │                          │    ├── INSERT admin_audit_log ───────────►  trilha
       │                          │    └── Tudo na mesma transação
       │                          └── { transactionId, auditId, newBalance }
       │
       ▼
[redirect para admin/users/[id]]
     (saldo atualizado)
```

---

## Estados do Usuário (estendido)

```
ESTADOS DO USUÁRIO — v1.5
════════════════════════════════════════════════════════════

                    ┌──────────────────────┐
                    │     Não auth         │
                    └──────────┬───────────┘
                               │ signup
                               ▼
                    ┌──────────────────────┐
                    │  Autenticado         │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
           ┌──────────────────┐  ┌──────────────────┐
           │ Sem loja         │  │ Com loja         │
           │ (onboarding)     │  │                  │
           └────────┬─────────┘  └────────┬─────────┘
                    │                     │
                    │ POST /api/store     ├──────────────────────┐
                    ▼                     ▼                      ▼
           ┌──────────────────┐  ┌──────────────┐   ┌──────────────────┐
           │ Com loja         │  │ Com saldo    │   │ Saldo zero       │
           │ + grant 5 créd.  │  │ (≥1)         │   │ (0 créditos)     │
           └──────────────────┘  └──────┬───────┘   └────────┬─────────┘
                                        │                     │
                               ┌────────┴────────┐           │
                               ▼                  ▼          │
                      ┌──────────────┐  ┌──────────────┐     │
                      │ Gera         │  │ Gera (gasto) │     │
                      │ campanha     │  │ -1 crédito   │     │
                      │ -1 crédito   │  │              │     │
                      └──────────────┘  └──────────────┘     │
                                        │                     │
                                        │  ---> saldo 0       │
                                         ▼                     ▼
                                ┌──────────────────┐  ┌──────────────────┐
                                │ Solicitar        │◀─│ Não pode gerar   │
                                │ créditos         │  │ (aviso + CTA)    │
                                │ (admin grant)    │  │                  │
                                └────────┬─────────┘  └──────────────────┘
                                         │
                                         ▼
                                ┌──────────────────┐
                                │ Recebe créditos  │
                                │ (grant admin)    │
                                └────────┬─────────┘
                                         │
                                         ▼
                                ┌──────────────────┐
                                │ Com saldo (≥1)   │
                                └──────────────────┘
```

---

## Modelo de Dados — Novas Tabelas

### `credit_balances`

```sql
CREATE TABLE IF NOT EXISTS public.credit_balances (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_credit_balances" ON public.credit_balances
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.credit_balances TO authenticated;
```

### `credit_transactions`

```sql
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('grant', 'purchase', 'deduction', 'refund', 'adjustment')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  reference TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_store_id
  ON public.credit_transactions (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at
  ON public.credit_transactions (created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_credit_transactions" ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.credit_transactions TO authenticated;
```

### Nota sobre `campaigns` — colunas existentes

A tabela `campaigns` já possui `publication_copy_snapshot` (JSONB). Na v1.5, este campo passa a ser populado pelo Copy Director em vez das funções determinísticas. Nenhuma migração de schema necessária para campaigns.

---

## Retenção de Dados e Assets

A política de retenção da v1.5 (D10) define prazos para cada entidade. Abaixo, o esquema de responsabilidade e implementação:

```
ENTIDADE                RETENÇÃO            LIMPEZA              RESPONSÁVEL
──────────────────────  ──────────────────  ───────────────────  ───────────────────
campaigns               Vitalícia           Exclusão da conta    Aplicação (CASCADE)
campaign-images         Vitalícia (CASCADE) Exclusão da conta    Storage policy
store-brand-assets      Vitalícia           Exclusão da conta    Aplicação
credit_transactions     Vitalícia           N/A (fiscal)         N/A
credit_balances         Vitalícia           Exclusão da conta    FK CASCADE
generation_events       90 dias             Job agendado         pg_cron / serverless
Logs de telemetria/IA   90 dias             Job agendado         pg_cron / serverless
Sessões/auth            Provider policy     Supabase Auth        Fora do escopo
```

### Implementação do cleanup

Para entidades com retenção de 90 dias:

```sql
-- Job diário: limpa generation_events com mais de 90 dias
-- Pode ser executado via pg_cron ou função serverless Vercel
DELETE FROM public.generation_events
WHERE created_at < NOW() - INTERVAL '90 days';
```

A política de retenção é **parte do escopo obrigatório da v1.5**. O cleanup automático (job agendado) pode entrar até 30 dias após o início do lançamento controlado. **No ship inicial**, o cleanup manual via runbook (script SQL documentado) deve existir e ser testado — o time precisa conseguir executar a limpeza sob demanda. O acúmulo de 30 dias é tolerável para o volume esperado (dezenas a centenas de usuários).

### Nota sobre `store-logos`

Bucket legado `store-logos` (0 objetos desde o inventário da v1.2). Permanece como cleanup tracking separado. Não bloqueia v1.5.

---

## Mapa de Rotas (estendido)

### Rotas públicas (sem auth) — inalteradas

| Rota | Descrição |
|------|-----------|
| `/login` | Login |
| `/signup` | Cadastro |
| `/check-email` | Confirmação de email |
| `/forgot-password` | Recuperação de senha |
| `/update-password` | Atualização de senha |
| `/auth/confirm` | Callback de confirmação |

### Rotas autenticadas (dentro do app shell) — inalteradas

| Rota | Descrição |
|------|-----------|
| `/dashboard` | Landing pós-login (existente) |
| `/campanhas` | Lista com busca e filtros (existente) |
| `/campanhas/nova` | Formulário de geração (existente) |
| `/campanhas/[id]` | Página da campanha (existente) |
| `/loja` | Identidade da loja (existente) |
| `/conta` | Configurações da conta + **créditos (novo)** |

### Novas rotas (F26 — Admin)

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `/admin` | Dashboard admin operacional | requireAdmin |
| `/admin/users` | Diretório de usuários/lojas beta | requireAdmin |
| `/admin/users/[id]` | Detalhe: saldo, extrato, grant form, erros | requireAdmin |
| `/admin/campaigns/errors` | Campanhas com erro para triagem | requireAdmin |
| `/admin/audit-log` | Histórico de ações administrativas | requireAdmin |
| `POST /api/admin/credits/grant` | Concede créditos manualmente | requireAdmin |
| `GET /api/admin/users` | Lista paginada de usuários | requireAdmin |
| `GET /api/admin/users/[id]` | Detalhe completo de usuário/loja | requireAdmin |
| `GET /api/admin/campaigns/errors` | Lista de campanhas com erro | requireAdmin |
| `GET /api/admin/audit-log` | Histórico de ações | requireAdmin |

### Novas rotas (diferidas para F30/v1.6)

| Rota | Descrição | Proteção |
|------|-----------|----------|
| `POST /api/credits/create-checkout` | Stripe Checkout Session | Auth + ownership |
| `POST /api/webhooks/stripe` | Webhook Stripe | Assinatura HMAC |

### Rotas modificadas

| Rota | Mudança |
|------|---------|
| `POST /api/campaign/generate-image` | Rate limit, saldo check, reserva, Copy Director (F25) |
| `/conta` | Adiciona seção de créditos com saldo e extrato (F27) |

---

## Fronteiras: Cliente de Sessão vs Service Role

### Novas operações da v1.5

| Operação | Cliente | Auth exigida | Ownership |
|----------|---------|-------------|-----------|
| **Admin Operacional (novo F26)** | | | |
| `/admin/*` pages | Admin (service role ou sessão) | ✅ `requireAdmin()` | N/A (admin lê qualquer loja) |
| `POST /api/admin/credits/grant` | Admin | ✅ `requireAdmin()` | N/A (admin concede para qualquer loja) |
| `GET /api/admin/users` | Admin | ✅ `requireAdmin()` | N/A |
| `GET /api/admin/campaigns/errors` | Admin | ✅ `requireAdmin()` | N/A |
| `GET /api/admin/audit-log` | Admin | ✅ `requireAdmin()` | N/A |
| **Créditos** | | | |
| `GET /conta` (seção créditos, SC) | Sessão + RLS | ✅ `requireUser()` | ✅ Filtra por `store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())` |
| `GET /api/credits/balance` | Admin (preferencial) | ✅ `requireApiUser()` | ✅ `userId = claims.sub` |
| `GET /api/credits/history` | Admin (preferencial) | ✅ `requireApiUser()` | ✅ `userId = claims.sub` |
| `CreditService.reserve(storeId)` | Admin | Interno (handler já autenticou) | ✅ Ownership verificado pelo handler chamador |
| `CreditService.confirm(txId)` | Admin | Interno | N/A (já debitado) |
| `CreditService.refund(txId)` | Admin | Interno | N/A (estorno) |
| `CreditService.grant(storeId, amount)` | Admin | Interno (admin grant ou onboarding) | ✅ Admin gate validou |
| **Copy Director** | | | |
| `CopyDirectorService.generateCopy(brief)` | Admin | Interno | ✅ Ownership via handler chamador |
| **Geração (modificada)** | | | |
| `POST /api/campaign/generate-image` | Admin | ✅ `requireApiUser()` | ✅ + rate limit + saldo check |

### Estratégia de cliente

- **SELECT em `credit_balances` e `credit_transactions` (admin F26):** `supabaseAdmin` (service role) sem filtro de ownership — admin pode ver qualquer loja. A proteção é o gate `requireAdmin()`
- **SELECT em `credit_balances` e `credit_transactions` (usuário F27):** sessão + RLS — cada usuário vê apenas sua própria loja
- **Mutações de crédito (admin grant):** `supabaseAdmin` via RPC após `requireAdmin()`. `admin_audit_log` registra actor, ação e motivo
- **Mutações de crédito (pipeline F25):** `supabaseAdmin` via RPC após `requireOwnership()`
- **Copy Director:** Serviço interno chamado pelo handler de geração, nunca exposto como rota pública
- **Stripe Webhook:** Endpoint público validado por assinatura HMAC — diferido para F30/v1.6

---

## Estrutura de Diretórios (novos arquivos)

```
src/
  lib/
    copy/
      copy-director-service.ts     # CopyDirectorService
      types.ts                     # CopyDirectorInput, CopyDirectorResult
      __tests__/
        copy-director-service.test.ts
    credit/
      credit-service.ts            # CreditService (reserve, confirm, refund, grant, getBalance, getHistory)
      types.ts                     # CreditTransaction, CreditBalance
      __tests__/
        credit-service.test.ts
    text-provider/
      text-provider.ts             # createTextProvider() — abstração do provider de texto
      types.ts                     # TextProvider, TextProviderConfig
      openai-text.ts               # OpenAI implementation
      anthropic-text.ts            # Anthropic implementation
      __tests__/
        text-provider.test.ts

  app/
    api/
      admin/
        credits/
          grant/
            route.ts               # POST /api/admin/credits/grant
        users/
          route.ts                 # GET /api/admin/users
          [id]/
            route.ts               # GET /api/admin/users/[id]
        campaigns/
          errors/
            route.ts               # GET /api/admin/campaigns/errors
        audit-log/
          route.ts                 # GET /api/admin/audit-log
      webhooks/
        stripe/
          route.ts                 # DIFERIDO para F30/v1.6
    (app)/
      admin/
        layout.tsx                 # NOVO: requireAdmin() check
        page.tsx                   # NOVO: dashboard operacional
        users/
          page.tsx                 # NOVO: diretório de usuários
          [id]/
            page.tsx               # NOVO: detalhe + grant form
        campaigns/
          errors/
            page.tsx               # NOVO: triagem de erros
        audit-log/
          page.tsx                 # NOVO: histórico de ações
      conta/
        page.tsx                   # Modificado: seção créditos (F27)
        credit-section.tsx         # Novo: saldo + extrato (F27)

prompts/
  campaign-copy-director.md        # NOVO: prompt template do Copy Director

supabase/
  migrations/
    20260715000001_create_credit_tables.sql   # F24: credit_balances + credit_transactions
    20260717000003_create_admin_tables.sql    # F26: admin_users + admin_audit_log
```

---

## Fatiamento Macro Sugerido

> Abaixo, um fatiamento sugerido para decomposição. **Não é plano de implementação definitivo** — o detalhamento de cada fase, com tarefas, dependências e verificação, será feito nos planos de execução GSD. A ordem é indicativa e sequencial.

```
DEPENDÊNCIAS:  F23 → F24 → F25 → F26 → F27 → F28 → F29
                                       └── F30/v1.6 (futuro, não bloqueia v1.5)

Onde:
  F23 — TextProvider + Copy Director (fundação de IA de texto)
  F24 — Credit Tables + CreditService (fundação financeira)
  F25 — Integração no Pipeline (Copy Director + créditos no generate-image)
  F26 — Admin Operacional + Convites + Créditos Manuais (substitui Stripe na v1.5)
  F27 — Conta + Saldo Visível + Extrato (sem Stripe; CTA = "fale com o time")
  F28 — Observabilidade + Operação + Launch Controls
  F29 — Refinamento Visual + UAT + Launch Readiness
  F30 — Stripe / Monetização Pública (adiado para pós-beta)
```

---

### F23 — TextProvider + Copy Director

**O quê:**
- Abstração `createTextProvider()` paralela a `createImageProvider()`
- Implementação OpenAI Chat Completion
- Implementação Anthropic Messages (estrutura pronta, ativação por config)
- `CopyDirectorService.generateCopy(brief)` — serviço que usa TextProvider
- Prompt template `prompts/campaign-copy-director.md`
- Types: `CopyDirectorInput`, `CopyDirectorResult`
- Testes unitários do Copy Director (mocked provider)
- Copy Director chamável standalone (não integrado no pipeline ainda)

**Entrega:** IA de copy funcional e testável. TextProvider intercambiável. Copy Director produz title, caption, hashtags e CTA persuasivos.

**Dependências:** Provider existente (OpenAI/Anthropic config já existe)

---

### F24 — Credit Tables + CreditService

**O quê:**
- Migrations: `credit_balances` + `credit_transactions` (DDL, índices, RLS, grants)
- `CreditService` com (todos os métodos usam `storeId`, não `userId`):
  - `getBalance(storeId)` — saldo atual
  - `reserveCredit(storeId, amount)` — deduz saldo, registra transação
  - `confirmCredit(txId)` — confirma (no-op na v1.5 — reserva já é definitiva)
  - `refundCredit(txId, reason)` — estorna saldo, registra refund
  - `grantCredits(storeId, amount, reason)` — concede créditos (onboarding, ajuste manual/admin, futuro pagamento)
  - `getHistory(storeId, limit, offset)` — extrato paginado
- Validação: saldo nunca negativo, transações imutáveis, estorno cria nova transação
- SQL function para atomicidade (`reserve_credit`, `refund_credit`) ou transação na aplicação com retry
- Testes: 20+ testes (saldo, reserva, estorno, concorrência, grant, histórico)

**Entrega:** Sistema de créditos funcional e testável, sem UI. Créditos podem ser concedidos e consumidos programaticamente.

**Dependências:** Nenhuma (tabelas novas, sem dependência de fases anteriores)

---

### F25 — Integração no Pipeline de Geração

**O quê:**
- Modificar `POST /api/campaign/generate-image`:
  - Rate limit guard (10/hora, 30/dia) antes de qualquer operação paga
  - Saldo check antes de começar (`creditService.getBalance`)
  - Reserva de crédito após INSERT `generating`, antes da IA
  - Copy Director step: chamar `CopyDirectorService.generateCopy(brief)` antes do Image Director
  - Resultado do Copy Director vai para `publication_copy_snapshot` (substitui `buildCaption`/`buildHashtags`)
  - Falha → `CreditService.refund()` + UPDATE `error`
  - Sucesso → confirmação implícita (reserva já é definitiva)
- Ajustar NDJSON para incluir `copySnapshot` no resultado (junto com `campaignId`, `campaignUrl`)
- Testes: 25+ testes (fluxo com sucesso, saldo insuficiente 402, rate limit, falha com estorno, concorrência)

**Entrega:** Pipeline de geração completo com copy inteligente, controle de custos e proteção financeira.

**Dependências:** F23 (Copy Director) + F24 (CreditService)

---

### F26 — Admin Operacional + Convites + Créditos Manuais

**O quê:**

**Controle de acesso admin:**
- `admin_users(user_id UUID PK REFERENCES auth.users(id))` — tabela, sem flag em `auth.users`
- `requireAdmin()` gate: `requireApiUser()` + SELECT em `admin_users`
- Login normal, sem `/admin/login` separado
- Middleware + API routes com dupla proteção

**Diretório de usuários/lojas:**
- Listar e buscar beta users com: nome, email, segmento, data de criação, última campanha, total de campanhas, total de erros
- Detalhe de usuário/loja com saldo, extrato, campanhas recentes

**Concessão manual de créditos:**
- Formulário: `{ storeId, amount, reason, operationId }` — motivo **obrigatório** (Zod)
- Chama RPC `admin_grant_credits` atômica: `grant_credits` + `INSERT admin_audit_log` na mesma transação
- `operationId` gerado pelo client → idempotência real em retries (checagem no início da RPC)
- Grant sem audit trail é tratado como falha (ROLLBACK na RPC atômica)

**Visualização financeira (admin):**
- Saldo atual de qualquer loja
- Extrato completo de transações (todos os tipos)
- Filtro por período, tipo, campanha

**Triagem de erros:**
- Lista de campanhas com `status = 'error'`
- Colunas: `error_message`, `store_name`, `product_name`, `created_at`, `campaign_id`
- Link para página da campanha

**Audit log:**
- `admin_audit_log` imutável (trigger BEFORE UPDATE/DELETE)
- Colunas: `actor_id`, `action`, `target_type`, `target_id`, `reason`, `operation_id`, `metadata`, `created_at`
- Ações registradas: `credit_grant`, `store_create_invite`, `adjustment`, `manual_refund`
- RPC `admin_grant_credits` atômica: checa operation_id no início (idempotência), executa grant_credits + INSERT audit log na mesma transação

**Tabelas novas:**
- `admin_users` — gate de acesso
- `admin_audit_log` — trilha imutável

**Testes: 15+ testes** (gate admin, grant manual, audit log, listagem de usuários, visualização de erros)

**Entrega:** Time consegue operar o beta controlado sem depender de SQL manual, Supabase Dashboard ou Stripe.

**Dependências:** F24 (CreditService.grantCredits, getBalance, getHistory) + F25 (campaigns com error status e error_message)

---

### F27 — Conta + Saldo Visível + Extrato

**O quê:**
- Saldo de créditos na topbar do app shell (server component do layout busca `credit_balances`)
- Ícone + número + link opcional para `/conta`
- Seção de créditos em `/conta`:
  - Card de saldo atual com destaque visual
  - Extrato de transações na mesma página (tabela paginada, exceto `adjustment`)
  - Estados: saldo cheio, saldo baixo (<3), saldo zero
- **CTA de saldo insuficiente durante beta:** "Solicitar créditos" / "Fale com o time"
  - Sem redirecionamento Stripe, sem diálogo de compra
  - Botão ou link abre modal/mailto com contato de suporte
- Microcopy: "Créditos insuficientes", "Solicite créditos com o time", "Ganhe 5 créditos ao criar sua loja"
- Onboarding: grant de 5 créditos na criação da loja (já implementado na F25)
- Testes: 15+ testes (saldo na topbar, extrato, estados, microcopy)

**Entrega:** Usuário vê saldo, acompanha gastos e sabe como solicitar mais créditos durante o beta.

**Dependências:** F24 (CreditService.getBalance, getHistory) — sem dependência de Stripe ou F26.
F27 e F26 podem ser implementadas em paralelo: ambas leem os mesmos dados (credit_balances, credit_transactions),
F26 com lente de suporte (qualquer loja), F27 com lente do próprio usuário (apenas a própria loja).

---

### F28 — Observabilidade + Operação + Launch Controls

**O quê:**

**Observabilidade:**
- Logging estruturado no pipeline: `campaignId`, `phase`, `duration_ms`, `status` em cada etapa
- Telemetria de IA: tokens, custo estimado, modelo, provedor — registrados em `generation_events` (tabela existente, sem uso ativo)
- Rate limit e teto de gasto com logs de auditoria
- Dashboard de operação (complementa o admin operacional da F26, não o substitui):
  - Métricas agregadas: taxa de sucesso, custo médio/geração, créditos concedidos, users ativos, erro rate
  - Visualizações que o admin operacional (F26) **não** tem: tendências, séries temporais, agregações
- Alertas configurados para: erro rate > 5% na última hora, custo outlier > 3σ

**Deploy:**
- Checklist de deploy documentado (passos, verificação, rollback)
- Variáveis de ambiente documentadas (OPENAI_*, SUPABASE_*, etc.)
- Processo de rollback (código + banco: migrations reversíveis)
- Validação local (testes, typecheck, lint, build) + validação online (staging/production smoke tests)

**Operação:**
- Runbook de suporte atualizado: grant manual via admin (F26), estorno, verificação de saldo
- Política de retenção implementada (job de cleanup 90 dias para logs e generation_events)
- Critérios de saúde do lançamento documentados (ver seção "Critérios de Lançamento Externo Controlado")

**Hardening:**
- Testes de concorrência (dois usuários gerando simultaneamente, saldo consistente)
- Regressão geral (build, typecheck, lint, ~800+ testes existentes + novos)
- Mobile hardening: revisar fluxos de extrato e saldo em viewports 320–768px
- Touch targets nos novos componentes de crédito

**Entrega:** Operação pronta para lançamento externo controlado. Time consegue monitorar, diagnosticar e operar com segurança.

**Dependências:** F27

---

### F29 — Refinamento Visual + UAT + Launch Readiness

**O quê:**

**Refinamento visual:**
- Loading states consistentes em todas as telas (skeleton components existentes + novos para créditos e admin)
- Empty states revisados (incluindo estados novos: sem crédito, sem transações, sem campanhas com filtro)
- Error states: falha de geração com mensagem clara
- Bloqueio sem crédito: tooltips, disabled states, microcopy em todo o app
- Legibilidade da peça gerada: verificar contraste, tamanho de texto, hierarquia visual na campanha final
- Copy da interface revisado: mensagens em português claro, tom consistente, sem jargão técnico
- Fluxo completo: formulário → geração → revisão → exportação com acabamento de produto público

**Launch Readiness:**
- Canal de feedback definido (email de suporte, formulário in-app, Discord/WhatsApp)
- Métricas mínimas de saúde configuradas e visíveis (ver "Critérios de Lançamento Externo Controlado")
- Critérios de expansão/pausa documentados e acordados com o time
- Perfil de usuário inicial definido (convite manual, 3-5 lojistas, segmento variado)
- UAT externo com 1-2 lojistas reais validando:
  - Usuário convidado manualmente completa cadastro
  - Admin concede créditos → saldo atualizado
  - Usuário gera campanha → crédito deduzido no sucesso
  - Usuário gera campanha → estorno na falha (saldo restaurado)
  - Saldo visível na topbar e em `/conta`
  - Extrato mostra transações corretamente
  - Admin visualiza campanha com erro e identifica causa
  - Admin visualiza audit log e reconcilia ação
- Verificação cruzada: time testa o produto em dispositivos reais (desktop + mobile)

**Não faz:**
- Nova feature de produto (tudo que não está no escopo da v1.5)
- Redesign de páginas existentes (apenas polish e estados faltantes)
- Testes A/B ou otimização de conversão
- Stripe Checkout / compra real (diferido para F30/v1.6)

**Entrega:** Produto com acabamento visual de lançamento externo. Time confiante para abrir para usuários externos.

**Dependências:** F28 (operações precisam estar prontas antes do lançamento)

---

## Matriz de Componentes por Fase

| Componente/Serviço | F23 | F24 | F25 | F26 | F27 | F28 | F29 |
|-------------------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **TextProvider** | Criar | — | — | — | — | Revisar | — |
| **CopyDirectorService** | Criar | — | — | — | — | Revisar | — |
| **campaign-copy-director.md** | Criar | — | — | — | — | — | — |
| **CreditService** | — | Criar | — | — | — | Revisar | — |
| **Migrations crédito** | — | Criar | — | — | — | — | — |
| **generate-image (modificado)** | — | — | Integrar | — | — | Hardening | Revisar |
| **Rate limit guard** | — | — | Criar | — | — | Hardening | — |
| **admin_users table** | — | — | — | Criar | — | — | — |
| **admin_audit_log table** | — | — | — | Criar | — | — | — |
| **requireAdmin() gate** | — | — | — | Criar | — | — | — |
| **Admin user/store directory** | — | — | — | Criar | — | — | — |
| **Admin credit grant UI** | — | — | — | Criar | — | — | — |
| **Admin campaign error view** | — | — | — | Criar | — | — | — |
| **Admin audit log view** | — | — | — | Criar | — | — | — |
| **Saldo na topbar** | — | — | — | — | Criar | Hardening | Revisar |
| **Seção créditos /conta** | — | — | — | — | Criar | Hardening | Revisar |
| **Extrato de transações** | — | — | — | — | Criar | Hardening | Revisar |
| **CTA "Fale com o time"** | — | — | — | — | Criar | — | Verificar |
| **Onboarding grant** | — | — | ✓ | — | — | — | Verificar |
| **Dashboard métricas agregadas** | — | — | — | — | — | Criar | — |
| **Deploy checklist** | — | — | — | — | — | Criar | — |
| **Runbook operacional** | — | — | — | — | — | Criar | — |
| **Doc variáveis de ambiente** | — | — | — | — | — | Criar | — |
| **Logging pipeline** | — | — | — | — | — | Criar | Revisar |
| **Telemetria IA** | — | — | — | — | — | Criar | Revisar |
| **Cleanup 90 dias** | — | — | — | — | — | Manual (ship); job auto (D+30) | — |
| **Launch health metrics** | — | — | — | — | — | — | Criar |
| **Feedback channel** | — | — | — | — | — | — | Criar |
| **Loading states** | — | — | — | — | — | — | Criar |
| **Error states** | — | — | — | — | — | — | Criar |
| **Fluxo completo polish** | — | — | — | — | — | — | Executar |
| **UAT externo** | — | — | — | — | — | — | Executar |
| **Mobile hardening** | — | — | — | — | — | Criar | Verificar |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Estorno de crédito em race condition** | Média | Alto — usuário perde crédito | Transação atômica no banco (`reserve_credit` como função SQL). Testes de concorrência na F28 |
| **Admin concede crédito sem audit trail** | Média | Alto — ação sem rastro em sistema financeiro | Grant sem audit log é tratado como falha. `admin_audit_log` é append-only, imutável |
| **Copy Director gera copy de baixa qualidade** | Média | Médio — produto parece menos profissional | Iteração no prompt. Feedback loop: se usuário edita o copy, registrar para melhoria. Edição manual sempre disponível |
| **Custo de IA sem teto de gasto operacional** | Média | Alto — conta do provedor explode | Rate limit por usuário + teto diário. Monitoramento de custo total. Alerta em gasto anômalo |
| **Crédito zero: usuário desiste** | Alta | Médio — churn | Gratuidade inicial (5 créditos). Prévia de campanhas antigas visível. CTA "Solicitar créditos" com contato do time |
| **Abuso: múltiplas contas para mais créditos gratuitos** | Média | Médio — perda de receita | Rate limit e teto diário já mitigam. Verificação de email obrigatória (já existe). Feature flag desliga geração gratuita se necessário |
| **Retenção não implementada a tempo** | Média | Baixo — acúmulo de dados iniciais é tolerável | Cleanup não precisa estar no ship inicial, mas deve estar em 30 dias. Até lá, volume é baixo |
| **Qualidade visual insuficiente para público** | Média | Alto — primeira impressão negativa | F29 dedicada a polish. UAT externo antes de ampliar. Feedback canal primário captura problemas |
| **Lançamento ampliado antes da hora (pressa)** | Baixa | Alto — experiência quebrada para muitos usuários | Gatilhos de pausa documentados. Feature flag controla acesso. Decisão de ampliar exige aprovação do time |

---

## Pendências da Investigação

### Rate limit — implementação concreta

**Pergunta:** Rate limit deve ser em memória (Vercel Edge), banco (consulta Supabase) ou Redis?

**Resposta inicial:** Usar tabela `generation_events` (já existe) com consulta de janela deslizante de 1h. Simples, consistente, sem dependência externa. Se a carga crescer, migrar para Redis ou Vercel KV.

**Decisão na fase de design:** Confirmar viabilidade com Supabase (janela deslizante em SQL). Alternativa: Vercel KV (upstash Redis) se latência for problema.

### Stripe — decidido (deferido para F30/v1.6)

**Decisão:** Stripe Checkout (redirect) será implementado na F30/v1.6 — após validação do beta controlado. Durante a v1.5, o crédito é operado pelo time via admin grant manual auditável.

**Direção futura:** Stripe Checkout — mínimo viável, sem necessidade de compliance PCI. Payment Element é evolução pós-F30.

### Concorrência no saldo — abordagem

**Pergunta:** Como garantir que dois requests simultâneos não gastem o mesmo crédito?

**Resposta inicial:** Usar transação SQL atômica com `SELECT ... FOR UPDATE` ou função SQL `reserve_credit(store_id, amount)` que verifica e deduz em uma operação. A aplicação chama a função e verifica o resultado (sucesso/falha). Se falhar (saldo insuficiente), retorna 402.

### `publication_copy_snapshot` — compatibilidade retroativa

**Pergunta:** Campanhas existentes (v1.3/v1.4) têm `publication_copy_snapshot` gerado por funções determinísticas. O Copy Director da v1.5 gera um formato compatível?

**Resposta:** O schema do snapshot evolui para `{ title?, caption, hashtags[], cta_post }` — `title` é novo campo opcional. Campanhas antigas (v1.3/v1.4) têm snapshot sem `title`; a UI de exibição (`getEffectivePublicationCopy()`) trata `title` como opcional e mostra a legenda completa quando não há título separado. O campo `title` no `publication_copy_current` (edição manual) também é opcional.

---

## Critérios de Aceite

### Macro-critério

> Um lojista real (fora do time de desenvolvimento) consegue se cadastrar, receber créditos gratuitos, gerar uma campanha com copy inteligente via IA, revisar o resultado, receber créditos adicionais via operação/admin durante o beta controlado, e repetir o ciclo — com a operação monitorada, custos controlados e falhas tratadas sem perder créditos.

### Categorias de cenários

Os cenários exatos serão numerados durante o planejamento de cada fase. As categorias são:

| Categoria | Cobertura |
|-----------|-----------|
| **A — Copy Director** | Geração de copy por IA com `title`, `caption`, `hashtags`, `cta_post`. Qualidade mínima, fallback determinístico, paralelismo com Image Director |
| **B — Créditos** | Saldo inicial (grant), dedução no sucesso, estorno na falha, saldo nunca negativo, histórico de transações, reserva reversível |
| **C — Rate limit** | Bloqueio por hora, bloqueio por dia, liberação após janela, mensagem clara para o usuário |
| **D — Admin** | Admin access gate funcional, diretório de usuários, grant manual com motivo obrigatório, audit log imutável, visualização de erros |
| **E — UI de saldo** | Saldo visível na topbar, saldo zero com CTA, extrato correto, onboarding com grant, microcopy de bloqueio |
| **F — Falhas** | Geração abortada (timeout) → estorno, geração com erro → estorno, saldo insuficiente → 402 sem chamada IA |
| **G — Observabilidade** | Logs estruturados no pipeline, telemetria de IA registrada, alertas configurados, dashboard operacional |
| **H — Regressão** | Milestone não quebra funcionalidades existentes (v1.2–v1.4). Nenhum teste existente (713+) quebra |
| **I — Segurança** | RLS verificado nas novas tabelas, ownership em rotas de crédito, inputs sanitizados para IA, service role revisado, admin_users gate, audit log obrigatório |
| **J — Refinamento visual** | Loading states, empty states, error states, bloqueio sem crédito, legibilidade da peça, copy da interface, fluxo completo polido |
| **K — Launch readiness** | Canal de feedback funcional, métricas de saúde visíveis, runbook de suporte aprovado, UAT externo concluído, critérios de expansão documentados |

### Pirâmide de validação

```
                 ┌──────────┐
                 │ UAT      │  Convite manual + grant admin + geração +
                 │ manual   │  dedução + estorno + saldo + extrato + triagem
                 ├──────────┤
                 │ E2E      │  Geração → crédito deduzido, saldo atualizado
                 │ (mock)   │  Grant admin → saldo creditado → extrato reflete
                 ├──────────┤
                 │ Banco/   │  Saldo atômico, race condition, transações
                 │ SQL real │  imutáveis, RLS, admin audit log
                 ├──────────┤
                 │ Integr.  │  Rate limit, 402, admin gate, copy director
                 │ HTTP     │  integrado, estorno em falha
                 ├──────────┤
                 │ Unitários│  CreditService, CopyDirectorService,
                 │          │  TextProvider, requireAdmin, admin_audit_log
                 └──────────┘
```

### Condição de fechamento

> A milestone é considerada concluída quando todos os cenários de todas as categorias (A–K) estão VERDES, com evidências na respectiva camada da pirâmide. Cenários críticos (B — créditos, C — rate limit, D — admin, F — falhas, I — segurança) **devem** ter cobertura automatizada. UAT manual complementar com fluxo real de convite → grant admin → geração → saldo → extrato → triagem de erro. A categoria K (launch readiness) só fecha com aprovação explícita do time após UAT externo.

---

---

## Critérios de Lançamento Externo Controlado

A v1.5 é uma milestone de **lançamento externo controlado** — o primeiro contato de lojistas reais com o produto, em escala limitada. Não é GA irrestrito nem beta cego: é um grupo fechado e monitorado. Os critérios abaixo definem quando e como abrir para usuários externos, medir a saúde e decidir os próximos passos.

### Perfil do usuário inicial

- **Tipo:** Lojistas de lojas físicas reais, convidados manualmente pelo time
- **Número inicial:** 3–5 lojistas (grupo fechado, sem link público de signup)
- **Segmento:** Variado (alimentação, moda, serviços) para testar o Copy Director em diferentes nichos
- **Canal de onboarding:** Acompanhamento manual (time apresenta o produto, tira dúvidas, coleta feedback)

### Métricas mínimas de saúde

São monitoradas ativamente (dashboard operacional + alertas):

| Métrica | Alvo (mínimo) | Gatilho de atenção | Gatilho de pausa |
|---------|--------------|-------------------|-------------------|
| Taxa de sucesso de geração | > 85% | < 80% na última hora | < 70% no dia |
| Custo médio por geração | < R$ 0,50 | > R$ 1,00 | > R$ 2,00 |
| Tempo médio de geração | < 30s | > 45s | > 60s |
| Taxa de erro de IA (provider) | < 5% | > 10% | > 20% |
| Conversão de solicitação de crédito (users que pedem) | > 20% | < 10% | < 5% |
| Taxa de estorno (gerações com erro) | < 10% | > 15% | > 25% |
| Uso de crédito (médio/usuário/dia) | 1–3 | > 5 | > 10 (possível abuso) |
| NPS/satisfação (coletado após 1ª campanha) | > 7 | < 5 | < 3 |

### Canal de feedback

- **Canal primário:** Grupo de WhatsApp / Discord com os lojistas beta
- **Canal secundário:** Formulário in-app (feedback button no app shell) — opcional na v1.5, pode ser implementado na F29
- **Sinalizações automáticas:** Alertas de erro rate, estorno frequente por usuário, saldo baixo repetido

### Decisão de ampliar ou pausar

A ampliação do lançamento (mais usuários, link público, divulgação) está condicionada a:

1. **Todas as métricas acima no verde (acima do alvo mínimo)** por 7 dias consecutivos
2. **Nenhum incidente de segurança** (vazamento de dados, acesso cross-tenant, perda de crédito não estornada)
3. **Nenhum bug crítico** (geração quebra todo o app, grant sem crédito cair, saldo negativo, audit log perdido)
4. **Suporte operacional documentado e testado** (runbook verificado com pelo menos 1 estorno manual real)
5. **Aprovação do time** após revisão dos resultados do grupo inicial

Se qualquer gatilho de pausa for atingido, o lançamento é pausado automaticamente (novos signups bloqueados via middleware/feature flag) até investigação e resolução.

### Feature flag de lançamento

Toda a v1.5 opera atrás de uma feature flag (`v1.5-credits-enabled`). Enquanto a flag estiver DESLIGADA:
- O sistema de créditos existe no banco mas não é cobrado
- O Copy Director gera copy mas não substitui o fluxo determinístico
- Rate limit não é aplicado

A flag é ativada manualmente pelo time quando o lançamento controlado começar.

> **A conclusão da milestone exige a flag LIGADA em ambiente de UAT e no lançamento controlado.** A v1.5 não pode ser considerada concluída com a funcionalidade implementada mas desligada — o ciclo completo (geração com Copy Director + crédito + grant admin + saldo + extrato) precisa estar ativo e verificado com usuário real. A flag existe para rollout seguro (ativar para poucos, observar, escalar), não para shipping da milestone incompleta.

---

*Documento criado: 2026-07-15*
*Última atualização: 2026-07-17 — Realinhamento: F26 troca Stripe por Admin Operacional. Stripe adiado para F30/v1.6.*
*Próximo passo: revisão do artefato pelo time. Após aprovação, iniciar planejamento das fases via OpenSpec.*
