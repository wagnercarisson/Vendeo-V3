# Alinhamento — Milestone v1.3 "Persistência e Entrega da Campanha"

**Status:** Alinhamento consolidado. Decisões D1–D4 e D6 confirmadas; D5 confirmada para snapshot, edição manual condicional.
**Data:** 2026-07-08
**Próximo passo:** Revisão do artefato pelo time. Após aprovação, decompor em fases com planos de execução.

> Este documento é o artefato de alinhamento da milestone. Ele registra as decisões tomadas, invariantes, arquitetura-alvo e critérios de aceite. **Não é roadmap nem plano de implementação.** O fatiamento em fases e o planejamento detalhado vêm depois, em documentos próprios.

---

## Objetivo da Milestone

Persistir a campanha gerada como artefato imutável no banco e no Storage, substituindo o armazenamento volátil em `sessionStorage` por rotas persistentes e autenticadas.

O lojista gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

### Critério de conclusão

> O usuário gera uma campanha, sai do sistema, volta depois e consegue encontrá-la e baixá-la.

### O que está no escopo

| Item | Descrição |
|------|-----------|
| Tabela `campaigns` | Registro imutável da campanha no banco |
| Bucket `campaign-images` | Imagem final da campanha no Storage |
| Persistência automática | Campaign é salva durante o fluxo de geração |
| Estados mínimos | `generating` → `ready` / `error` |
| `/campanha/[id]` | Página persistida do artefato gerado |
| `/minhas-campanhas` | Lista simples das campanhas da loja |
| Download do original | Proxy autenticado ou signed URL |
| Publication copy | Geração e persistência do kit de publicação (texto, hashtags, CTA de legenda) |
| Imutabilidade da arte | Imagem final não é editada após `ready` |

### O que está fora do escopo

| Item | Motivo |
|------|--------|
| Edição da arte gerada | Arte soberana e imutável — nova geração para mudar |
| Rascunho / publicado / arquivado | Estado binário generating/ready/error é suficiente |
| Versionamento (múltiplas versões da mesma campanha) | Milestone futura |
| Filtros / paginação avançada na lista | Lista simples, ordenada por data |
| Analytics / métricas de campanha | Fora do ciclo de persistência |
| Múltiplos formatos de exportação | Apenas 1080×1080 nesta milestone |
| Compartilhamento público (link público) | Exigiria autenticação ou signed URL |
| Regeneração a partir de campanha antiga | Feature futura — "duplicar briefing" |
| Edição manual do publication copy | Geração e snapshot sim; edição condicional |
| store-logos cleanup | Inventário já feito (0 objetos). Remoção é tarefa separada, não bloqueia v1.3 |
| Bucket legado `store-logos` reaproveitado | **Decisão D1:** bucket novo `campaign-images` |

---

## Invariantes

Estes invariantes são absolutos. Nenhuma fase pode violá-los. Reafirmam e estendem os invariantes da v1.2.

1. **Arte soberana e imutável** — Após `ready`, a imagem gerada nunca é editada. Mudar conteúdo visual = nova geração.
2. **Campanha pertence a uma loja** — `store_id` é chave estrangeira obrigatória. Toda consulta filtra por `store_id` com ownership.
3. **Ownership precede operação** — Toda mutação com `supabaseAdmin` verifica ownership **antes** de executar.
4. **404, não 403** — Campanha de outro tenant ou inexistente retorna 404.
5. **Registro antes da execução da IA** — O registro `generating` existe antes de qualquer chamada paga/lenta ao provider. O UPDATE para `ready`/`error` reflete o resultado. A validação de input antecede o INSERT para evitar persistir tentativas inválidas.
6. **CampaignId e storage_path pré-gerados** — A aplicação gera `campaignId` (UUID v4) e deriva `storage_path = "{storeId}/{campaignId}.png"` antes do INSERT, permitindo `storage_path NOT NULL` desde o registro `generating`.
7. **Persistência automática no backend** — O backend persiste a campanha durante o fluxo de geração. Não há step "salvar" no cliente.
8. **Publication copy é snapshot imutável (na v1.3)** — Gerado junto da campanha, persiste como `publication_copy_snapshot`. Edição futura usa coluna separada (ex.: `publication_copy_current` ou tabela própria).
9. **SessionStorage deixa de ser fonte de verdade** — Nenhum dado crítico de campanha vive em sessionStorage após a geração.
10. **Stale generating é tratável** — Registros `generating` com `updated_at` mais antigo que o timeout global de geração + margem podem ser tratados como erro técnico na UI (e por job/cleanup manual futuro).

---

## Ledger de Decisões D1–D6

### D1 — Bucket de imagens de campanha

`CONFIRMADO`

- Bucket novo: `campaign-images`
- Bucket legado `store-logos` **não** é reutilizado
- Motivos: semântica errada, limite baixo (2MB), políticas legadas/public-read amplas, inventário já documenta 0 objetos
- store-logos vira cleanup tracking separado — não bloqueia v1.3

### D2 — Persistência automática no backend

`CONFIRMADO`

- A campanha é persistida durante o fluxo de `POST /api/campaign/generate-image`
- Não existe step "salvar" no cliente
- O critério de conclusão ("gerou, saiu, voltou, encontrou") só é garantido com persistência no backend
- Se o usuário fecha o navegador durante o NDJSON, a campanha já existe no banco como `generating`

### D3 — Registro antes da execução da IA (estados mínimos)

`CONFIRMADO`

```
valida input → gera campaignId + storage_path
INSERT campaigns (id, store_id, status='generating', storage_path, ...)
  → Geração da imagem via provider
  → Upload ao Storage
UPDATE campaigns (status='ready', generation_metadata, render_snapshot, ...)
  ou
UPDATE campaigns (status='error', error_message)
```

A aplicação gera `campaignId` (UUID v4) e deriva `storage_path = "{storeId}/{campaignId}.png"` antes do INSERT, permitindo `storage_path NOT NULL` desde o registro `generating`. O INSERT só ocorre após validação de input, evitando persistir tentativas inválidas.

### D4 — Imutabilidade da arte gerada

`CONFIRMADO`

- A imagem final é soberana e imutável
- Não existe edição da arte após `ready`
- Se o usuário quer mudar algo que aparece na imagem (preço, produto, badge, texto) → **nova geração**
- Futuro "duplicar campanha" é atalho para preencher formulário com dados antigos, não edição
- Publication copy (texto de legenda, hashtags, CTA de post) é conceitualmente separado — pode ser editável sem violar a imutabilidade da imagem

### D5 — Publication copy: geração e persistência

`CONFIRMADA (snapshot) / CONDICIONAL (edição manual)`

- **Geração e snapshot:** entram na v1.3. A milestone deve produzir um `publication_copy_snapshot` estruturado (caption, hashtags, cta_post) por serviço de copy/publicação a ser definido no design. Pode reutilizar ou expandir o `CampaignIntelligenceService`, mas o alinhamento não acopla a decisão à implementação atual.
- **Edição manual:** condicional — só entra se couber sem atrasar o core (F1–F4).
- **Fora de escopo:** edição da arte, edição de preço/produto dentro da imagem.

### D6 — Download: proxy autenticado via signed URL

`CONFIRMADO`

- Via `GET /api/campaign/[id]/download`
- `requireApiUser` + busca campanha por id → `requireOwnership(campaign.store_id)` → 404 se não existir ou não pertencer
- Gera signed URL via `supabase.storage.from('campaign-images').createSignedUrl(path, expiresIn)` e redireciona (302) ou faz proxy do blob
- `createSignedUrl` ([doc](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)) aceita `path` e `expiresIn` em segundos. `expiresIn` é `number` sem limite máximo documentado.
- Para v1.3, usar `expiresIn` de 1 hora (3600s) — URL gerada no momento do clique, tempo suficiente para o download completar
- Signed upload URLs (`createSignedUploadUrl`, [doc](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)) são outro recurso — validade fixa de 2h, não usado neste fluxo
- Alternativa de fallback: `supabase.storage.from(...).download()` + `new Response(blob)` — proxy direto do blob

---

## Arquitetura-Alvo

```
ARQUITETURA PÓS-V1.3
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
          │ /auth/confirm│    │ /campanha/[id]           │
          │ (públicas)   │    │ /minhas-campanhas        │
          └──────────────┘    └──────────────┘           │
                                                         │
                 ┌───────────────────────────────────────┘
                 │                    │
                 ▼                    ▼
      ┌──────────────────┐   ┌──────────────────┐
      │ Cliente sessão   │   │ supabaseAdmin    │
      │ (createServer-   │   │ (service role)   │
      │  Client + RLS)   │   │ + ownership      │
      │                  │   │ verificado antes │
      │ SELECTs          │   │                  │
      │ (campaigns,      │   │ POST /campaign/  │
      │  stores, etc.)   │   │   generate-image │
      │                  │   │ POST /campaign/  │
      │                  │   │   [id]/download  │
      │                  │   │ Storage up/down  │
      └────────┬─────────┘   └────────┬─────────┘
               │                      │
               ▼                      ▼
      ┌──────────────────────────────────────────────┐
      │              Supabase DB + Storage            │
      │                                                │
      │  public.stores              (RLS: SELECT)      │
      │  public.campaigns           (RLS: SELECT)      │
      │  public.store_brand_assets  (RLS: SELECT)      │
      │  public.store_brand_profiles(RLS: SELECT)      │
      │  public.store_visual_signatures(RLS: SELECT)   │
      │  public.generation_events   (default-deny)     │
      │                                                │
      │  storage.buckets:                               │
      │    campaign-images/  (privado + signed URLs)    │
      │    store-brand-assets/  (público + RLS SELECT)  │
      │    visual-signatures/   (público + RLS SELECT)  │
      │    store-logos/         (legado — pendente)      │
      └────────────────────────────────────────────────┘
```

### Fluxo de geração com persistência

```
FORMULÁRIO                    BACKEND                          SUPABASE
──────────                    ───────                          ────────

[preenche dados]
       │
       ▼
POST /api/campaign/generate-image
       │
       ├── requireOwnership
       ├── Resolve store identity
       ├── Valida input
       │    (se falhar → response 4xx, sem registro)
       │
       ├── Gera campaignId + storage_path
       ├── INSERT campaigns ────────────────────────────→  campaigns (generating)
       │    (id, store_id, status='generating',
       │     product_name, storage_path,
       │     input_snapshot, identity_snapshot)
       │
       ├── Gera imagem via provider IA
       │
       ├── Upload buffer ────────────────────────────────→  campaign-images/{storeId}/{campaignId}.png
       │    (supabaseAdmin.storage.from('campaign-images').upload)
       │
        ├── UPDATE campaigns ──────────────────────────────→  campaigns (ready)
        │    (status='ready',
        │     generation_metadata, render_snapshot,
        │     publication_copy_snapshot)
        │
        └── NDJSON result { campaignId, campaignUrl }
                │
                ▼
          redirect → /campanha/[campaignId]
```

### Fluxo de geração com falha

```
       ┌── INSERT campaigns (generating)
       │
       ├── (alguma etapa falha)
       │
       └── UPDATE campaigns ──────────────────────────────→  campaigns (error)
            (status='error', error_message)
            NDJSON result { type: "error", campaignId, ... }
```

---

## Fronteiras: Cliente de Sessão vs Service Role

### Novas operações da v1.3

| Operação | Cliente | Auth exigida | Ownership |
|----------|---------|-------------|-----------|
| **Campaign** | | | |
| `POST /api/campaign/generate-image` (modificado) | Admin | ✅ `requireApiUser()` | ✅ `requireOwnership(storeId)` |
| `GET /campanha/[id]` (página) | Sessão + RLS | ✅ RLS filtra | RLS via subquery |
| `GET /minhas-campanhas` (página) | Sessão + RLS | ✅ RLS filtra | RLS via subquery |
| `GET /api/campaign/[id]/download` | Admin | ✅ `requireApiUser()` | ✅ Busca campanha → `requireOwnership(campaign.store_id)` → 404 se não encontrar ou não pertencer |
| `GET /api/campaign/[id]` (opcional) | Admin → sessão + RLS | ✅ | RLS filtra (só se cliente JS precisar) |
| `GET /api/campaign/list` (opcional) | Sessão + RLS | ✅ | RLS via subquery (só se SPA precisar) |

### Estratégia de cliente

- **SELECT em `campaigns`:** Cliente de sessão + RLS (SELECT policy para owner)
- **INSERT/UPDATE em `campaigns`:** `supabaseAdmin` (service role) com ownership verificado antes
- **Storage upload:** `supabaseAdmin` (service role) com ownership verificado antes
- **Storage download (signed URL):** `supabaseAdmin` (service role) com ownership verificado antes

---

## Esquema da Tabela `campaigns`

```sql
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'ready', 'error')),
  product_name TEXT NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  identity_snapshot JSONB,
  generation_metadata JSONB,
  render_snapshot JSONB,
  publication_copy_snapshot JSONB,
  storage_path TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_store_id
  ON public.campaigns (store_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at
  ON public.campaigns (created_at DESC);
```

### Campos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK gerada pelo banco |
| `store_id` | UUID FK → stores | Dono da campanha |
| `status` | TEXT | `generating` → `ready` ou `error` |
| `product_name` | TEXT | Nome do produto no momento da geração (denormalizado para listas) |
| `input_snapshot` | JSONB | Dados do formulário congelados (productName, prices, badge, description) |
| `identity_snapshot` | JSONB | Snapshot da identidade da loja usada na geração (storeName, segment, brandColor, identityState, signature) |
| `generation_metadata` | JSONB | Metadados da geração (provider, model, duration_ms, generated_at) |
| `render_snapshot` | JSONB | Parâmetros visuais/diretivas usados na geração (layout_preset, palette, badge_style). Se a imagem for 100% provider-generated sem renderer programático final, registra as diretivas visuais aplicadas — não necessariamente um layout reexecutável. |
| `publication_copy_snapshot` | JSONB | Kit de publicação gerado (caption, hashtags, cta_post) — snapshot imutável. Edição futura usaria coluna separada `publication_copy_current` ou tabela própria |
| `storage_path` | TEXT | Path no Storage (`{storeId}/{campaignId}.png`) — fonte de verdade para o arquivo |
| `error_message` | TEXT | Mensagem de erro se status = `error` |

### RLS

```sql
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.campaigns TO authenticated;
```

---

## Bucket `campaign-images`

### Configuração

- Nome: `campaign-images`
- Tipo: **Privado** (não público)
- Path pattern: `{storeId}/{campaignId}.png`
- File size limit: 10MB
- MIME types permitidos: `image/png`, `image/jpeg`, `image/webp`

### RLS — Storage

```sql
-- Policy: owner pode SELECT (listar) seus próprios objetos
CREATE POLICY "owner_select_campaign_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
    )
  );

-- Upload e delete: apenas service_role (backend com ownership verificado)
```

### Download

O acesso ao arquivo é feito via proxy autenticado:

```
GET /api/campaign/[id]/download
  → requireApiUser
  → Busca campanha por id (supabaseAdmin.from('campaigns').select('store_id, storage_path').eq('id', id).single())
  → Se não existir → 404
  → requireOwnership(campaign.store_id)
  → Se não pertencer ao usuário → 404
  → signed URL via supabase.storage.from('campaign-images').createSignedUrl(storage_path, 3600)
  → redirect 302 para signed URL
```

**Nota da investigação:** `createSignedUrl` do Supabase ([doc oficial](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)) aceita `path` e `expiresIn` em segundos. O parâmetro `expiresIn` é do tipo `number` sem limite máximo documentado. Para v1.3, usamos 3600s (1h) — a signed URL é gerada no momento do clique, tempo suficiente para o download. Alternativa de fallback: `supabase.storage.from(...).download()` para proxy direto do blob.

---

## Matriz de RLS — Storage

| Bucket | Tipo | Leitura via URL | Listagem de objetos | Upload | Download |
|--------|------|----------------|-------------------|--------|----------|
| `campaign-images` | Privado | ❌ Apenas signed URL | ✅ Owner via RLS SELECT | ❌ Client-side negado. Apenas server-side com ownership | ✅ Proxy autenticado (signed URL) |
| `store-brand-assets` | Público | ✅ Qualquer um com URL | ✅ Owner via RLS SELECT (policy tenant_isolation) | ❌ Client-side negado | ✅ URL pública direta |
| `visual-signatures` | Público | ✅ Qualquer um com URL | ✅ Owner via RLS SELECT (policy tenant_isolation) | ❌ Client-side negado | ✅ URL pública direta |
| `store-logos` | Legado | ? | ? | ? | ? |

---

## Estados da Campanha

```
ESTADOS DA CAMPANHA
════════════════════════════════════════════════════════════

                  ┌──────────────┐
                  │  generating  │
                  └──────┬───────┘
                         │
           ┌─────────────┴─────────────┐
           │                           │
           ▼                           ▼
    ┌──────────────┐           ┌──────────────┐
    │    ready     │           │    error     │
    │  (imutável)  │           └──────────────┘
    └──────────────┘
```

| Estado | Descrição | Ações do usuário |
|--------|-----------|------------------|
| `generating` | Campanha sendo processada. Pode ter sido interrompida. | Aguardar ou ignorar (não exibir em lista normal). `generating` com `updated_at` mais antigo que o timeout global de geração + margem pode ser tratado como erro técnico/stale na UI (job/cleanup futuro). |
| `ready` | Concluída com sucesso. Artefato imutável. | Visualizar, baixar, gerar nova |
| `error` | Falha na geração. `error_message` preenchido. | Tentar novamente (nova geração) |

---

## Mapa de Rotas

| Rota | Proteção | Comportamento |
|------|----------|---------------|
| `/` | Auth + loja | Formulário de geração (existente) |
| `/campaign/preview` | Deixa de ser destino pós-geração | Permanece como rota existente; remoção física na fase que redireciona para `/campanha/[id]` |
| `/campanha/[id]` | Auth + ownership | Página persistida da campanha (Server Component com SELECT direto via RLS) |
| `/minhas-campanhas` | Auth + loja | Lista de campanhas da loja (Server Component com SELECT direto via RLS) |
| `/api/campaign/generate-image` | Auth + ownership | Geração + persistência automática (rota obrigatória) |
| `/api/campaign/[id]/download` | Auth + ownership | Download do original via signed URL (rota obrigatória) |
| `/api/campaign/[id]` | Opcional | API JSON para polling/SPA — só implementar se houver necessidade de cliente JS consumir campanha |
| `/api/campaign/list` | Opcional | API JSON para listagem SPA — Server Component consulta direto via RLS, sem necessidade de API |

---

## Fatiamento Macro Sugerido

> Abaixo, um fatiamento sugerido para decomposição. **Não é plano de implementação definitivo** — o detalhamento de cada fase, com tarefas, dependências e verificação, será feito nos planos de execução GSD. A ordem é indicativa e sequencial.
>
> **Nota:** A milestone mexe em banco, Storage, rota crítica de geração, fluxo de UI e segurança multi-tenant. Este fatiamento granular reduz risco de quebrar o fluxo principal e facilita rollback mental — cada fase é autossuficiente e testável isoladamente.

```
DEPENDÊNCIAS:   F1 → F2 → F3 → F4 → F5 → (F6 condicional)
```

### F1 — Fundação DB/Storage

**O quê:**
- Migration: tabela `campaigns` (DDL, índices, constraints)
- Migration: bucket `campaign-images` (privado, file size limit)
- Migration: RLS + policies + grants
- Testes de migration (SQL seco, criação, RLS funcional com auth)

**Entrega:** Tabela e bucket existem, RLS configurado, policies testadas. Fluxo atual não é tocado.

---

### F2 — Serviço de Persistência e Download

**O quê:**
- Serviço `src/lib/campaign/persistence.ts` com helpers de escrita:
  - `createCampaign(storeId, input)` → INSERT `generating`
  - `uploadCampaignImage(storeId, campaignId, buffer)` → Storage (conversão dataUrl → buffer)
  - `updateCampaignReady(campaignId, data)` → UPDATE `ready`
  - `updateCampaignError(campaignId, errorMessage)` → UPDATE `error`
- Rota `GET /api/campaign/[id]/download`:
  - `requireApiUser` + busca campanha + `requireOwnership(campaign.store_id)` → 404 se não existir ou não pertencer
  - Gera signed URL via `createSignedUrl` e redireciona (302) ou faz proxy do blob
- Testes unitários do serviço e da rota de download

**Entrega:** Camada de persistência testável, download funcional via URL assinada, sem ainda alterar o fluxo de geração.

---

### F3 — Integração no generate-image

**O quê:**
- Modificar `POST /api/campaign/generate-image`:
  - Pré-gerar `campaignId` (UUID v4) e `storage_path = "{storeId}/{campaignId}.png"`
  - INSERT `generating` antes de qualquer chamada IA (após validação de input, auth e ownership)
  - Upload ao Storage após imagem gerada
  - UPDATE `ready` com todos os dados (incluindo `publication_copy_snapshot`)
  - UPDATE `error` em caso de falha controlada
  - NDJSON final retorna `campaignId` + `campaignUrl`
- Geração do `publication_copy_snapshot` — serviço de copy/publicação a ser definido no design (pode reutilizar ou expandir `CampaignIntelligenceService`)
- Ajustar `use-campaign-form.ts` consumer para receber `campaignId` e redirecionar para `/campanha/[id]`
- Testes de integração do fluxo completo

**Entrega:** Nova campanha já nasce persistida. Geração → redirect para URL persistida. Rollback possível mantendo F2 intacta.

---

### F4 — Página Persistida `/campanha/[id]`

**O quê:**
- Server component em `src/app/(protected)/campanha/[id]/page.tsx`
- `requirePageUser` + `getCurrentStore` + SELECT da campanha com ownership
- Helper de leitura `getCampaign(id)` (SELECT com ownership via RLS)
- Renderização da imagem final (signed URL gerada a partir de `storage_path`)
- Exibição de metadados: produto, data, status
- Exibição do `publication_copy_snapshot` (caption, hashtags)
- Botão de download → reusa rota da F2
- Tratamento de estados: `generating` (poll/mensagem), `error` (mensagem + link nova geração)
- Estado vazio/404 para campanha inexistente ou de outro tenant

**Entrega:** Usuário acessa campanha persistida por URL, vê imagem e metadados, baixa o original.

---

### F5 — Histórico `/minhas-campanhas` + limpeza do destino antigo

**O quê:**
- Server component em `src/app/(protected)/minhas-campanhas/page.tsx`
- `requirePageUser` + `getCurrentStore` + helper `listCampaigns(storeId)` (SELECT paginado DESC via RLS)
- Lista simples: thumbnail (miniatura), nome do produto, data, status
- CTA: "Abrir" → `/campanha/[id]`, "Baixar" → download
- Estado vazio: "Nenhuma campanha encontrada" + link para gerar
- Remover ou desativar `/campaign/preview` como rota relevante (redirecionar ou ocultar)
- Ordenação: `created_at DESC`

**Entrega:** Lojista sai, volta, encontra e baixa campanhas. Critério de conclusão da milestone fechado.

---

### F6 (condicional) — Edição do Publication Copy

**O quê:**
- Adicionar coluna `publication_copy_current` (JSONB) ou tabela própria para a versão editada
- `publication_copy_snapshot` permanece imutável — a edição cria/altera `publication_copy_current`
- UI inline edit na página `/campanha/[id]` para caption, hashtags, cta_post
- Não altera a imagem — apenas metadados de publicação
- Server Action ou Route Handler `PATCH /api/campaign/[id]/publication-copy`

**Condição de entrada:** Só implementar se F1–F5 estiverem verdes e couber no sprint sem atraso.

---

## Decisões de Design Futuras (pós-v1.3)

| Item | Contexto |
|------|----------|
| Duplicar campanha | Atalho para preencher formulário com dados antigos |
| Regeneração | Nova geração a partir de campanha existente |
| Múltiplos formatos (Stories, feed, landscape) | Expansão de output |
| Compartilhamento público | Link público com expiração |
| store-logos cleanup | Remoção do bucket e migrations |

---

## Pendências da Investigação

### Supabase `createSignedUrl` — Resultado

**Pergunta:** Signed URLs do Supabase têm limite de `expiresIn`?

**Resposta:** A [documentação oficial do Supabase](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) define `createSignedUrl(path, expiresIn, options?)` onde `expiresIn` é o número de segundos de validade. Não há limite máximo documentado — o tipo é `number` sem restrição superior. Signed upload URLs (`createSignedUploadUrl`) são um recurso distinto com validade fixa de 2h ([doc](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)), mas não são usados neste fluxo.

**Decisão para v1.3:** Usar `expiresIn: 3600` (1 hora) — signed URL gerada no momento do clique em "Baixar". Se o download demorar mais que 1h, o usuário clica novamente e ganha nova URL.

**Fallback:** `supabase.storage.from('campaign-images').download(path)` — retorna o blob diretamente para proxy server-side.

---

*Documento criado: 2026-07-08*
*Última atualização: 2026-07-08*
*Próximo passo: revisão do artefato pelo time. Após aprovação, iniciar planejamento das fases.*
