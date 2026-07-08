# Alinhamento Fase 12 — Fundação DB/Storage (v1.3)

## Contexto

```
v1.3 — Persistência e Entrega da Campanha  (milestone)
  ├── Fase 1 / Phase 12 — Fundação DB/Storage                 ← esta fase
  ├── Fase 2 / Phase 13 — Serviço de Persistência e Download  (pendente)
  ├── Fase 3 / Phase 14 — Integração no generate-image        (pendente)
  ├── Fase 4 / Phase 15 — /campanha/[id]                      (pendente)
  ├── Fase 5 / Phase 16 — /minhas-campanhas + limpeza         (pendente)
  └── Fase 6 / Phase 17 (cond) — Edição Publication Copy      (condicional)
```

Esta fase cria a infraestrutura de banco e Storage para a milestone v1.3: tabela `campaigns`, bucket `campaign-images`, RLS e políticas de acesso. **Não toca o fluxo de geração existente** — é puramente fundacional, reversível e testável isoladamente.

**Dependências:** Fases 7–11 (v1.2) — `stores` com `user_id`, RLS em tabelas filhas, `requireOwnership`, `requireApiUser`, padrão de auth consolidado.

---

## Propósito

1. Criar a tabela `public.campaigns` com DDL, constraints, índices e trigger de `updated_at`
2. Adicionar RLS na tabela `campaigns` — SELECT do owner via subquery `stores.user_id`
3. Criar o bucket privado `campaign-images` com limites de tamanho e MIME
4. Configurar Storage policies: SELECT do owner prefix + INSERT/DELETE para service_role
5. Fornecer scripts de verificação (smoke SQL + testes automatizados onde houver Supabase local)

**Entrega verificável:**
- `campaigns` existe com RLS ativa, CHECK constraints, trigger `updated_at`
- Bucket `campaign-images` é privado (10MB, PNG/JPEG/WEBP)
- Owner vê suas campaigns via RLS; outro tenant não vê nada (0 resultados, sem vazamento)
- `status='error'` exige `error_message` (CHECK falha se omitido)
- `updated_at` atualiza automaticamente em UPDATE
- Upload client-side em `campaign-images` falha
- Service_role consegue inserir e deletar objetos no bucket
- Signed URL gerada por service_role permite leitura; URL pública direta não funciona

---

## Estado Atual

```
                                   ANTES (Fase 11)                  DEPOIS (Fase 12)
═══════════════════════════════════════════════════════════════════════════════════════
campaigns table                    ✗ não existe                    ✓ EXISTS, RLS, trigger, checks
bucket campaign-images             ✗ não existe                    ✓ privado, 10MB, image/png+jpeg+webp
RLS campaigns                      ✗ não existe                    ✓ FOR SELECT TO authenticated (owner)
Storage SELECT policy              ✗ não existe                    ✓ FOR SELECT TO authenticated (owner prefix)
Storage INSERT/DELETE policies     ✗ não existe                    ✓ FOR INSERT/DELETE TO service_role
Storage UPDATE policy              ✗ não existe (intencional)      ✗ omitido — reforça imutabilidade
updated_at trigger                 padrão em 3 tabelas filhas      ✓ campaigns segue padrão do repo
error_message CHECK                ✗ não existe                    ✓ (status = 'error') → mensagem não vazia
Fluxo de geração                   intacto                         ✓ intacto — nada mudou
```

---

## Decisões de Arquitetura

### D1 — `updated_at` trigger (padrão do repositório)

`CONFIRMADO`

O repositório já utiliza o padrão de **função PL/pgSQL scoped + trigger nomeado por tabela** em `store_visual_signatures`, `store_brand_assets` e `store_brand_profiles`. Não existe função genérica reaproveitável — cada tabela tem sua própria função e trigger.

A `campaigns` segue o mesmo padrão:

```sql
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaigns_updated_at();
```

**Motivo:** A invariante 10 da milestone (stale `generating`) depende de `updated_at` para detectar registros mais antigos que o timeout global + margem. Sem trigger, o campo só reflete o INSERT e nunca é atualizado.

---

### D2 — `error_message` CHECK constraint

`CONFIRMADO`

```sql
CONSTRAINT chk_campaigns_error_message
  CHECK (status <> 'error' OR nullif(trim(error_message), '') IS NOT NULL)
```

**Motivo:** Proteção de integridade. Se um erro de código gerar UPDATE `status='error'` sem preencher `error_message`, a UI não teria o que exibir. O CHECK previne dados inconsistentes no banco. Custo negligible.

---

### D3 — Storage policies (Opção B: sem UPDATE)

`CONFIRMADO`

O bucket `campaign-images` é **privado** e recebe 3 políticas, não 4:

| Policy | Scope | Motivo |
|--------|-------|--------|
| `FOR SELECT TO authenticated` | Owner path prefix | Inspeção/diagnóstico; coerente com RLS das tabelas |
| `FOR INSERT TO service_role` | `bucket_id = 'campaign-images'` | Upload server-side após geração da imagem |
| `FOR DELETE TO service_role` | `bucket_id = 'campaign-images'` | Cleanup técnico futuro, falhas parciais, manutenção |
| `FOR UPDATE TO service_role` | **omitido** | Arte imutável — sem overwrite planejado |

**Motivo da omissão de UPDATE:** A milestone declara a imagem final como soberana e imutável (invariante #1). Se um overwrite técnico for necessário no futuro, uma migration pequena adiciona a policy. Não incluir UPDATE agora reforça a invariante no nível de infraestrutura.

**Trade-off:** Se o upload do arquivo for bem-sucedido no Storage mas o UPDATE no banco falhar (ou vice-versa), um retry no mesmo `storage_path` não pode usar upsert/overwrite — precisa deletar e reenviar, ou gerar novo `campaignId`. Isso é consistente com a imutabilidade, mas toda lógica de resiliência em F2/F3 deve tratar esse caminho explicitamente em vez de depender de `upsert: true`.

Os buckets existentes (`store-brand-assets`, `visual-signatures`) têm 4 policies porque suportam substituição de assets (ex: novo upload de logo substitui o anterior). `campaign-images` não tem esse requisito.

---

### D4 — RLS: SELECT do owner sem escrita

`CONFIRMADO`

```sql
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.campaigns TO authenticated;
```

INSERT/UPDATE/DELETE são exclusivos do `supabaseAdmin` (service_role), sempre precedidos por `requireOwnership` verificado no backend. Mesmo padrão das demais tabelas do sistema.

---

### D5 — Thumbnails e imagens via `storage_path` + signed URL, não via listagem do bucket

`CONFIRMADO`

A UI nunca depende de `storage.objects` SELECT para obter imagens. O fluxo é sempre:

```
campaigns.storage_path
  → supabaseAdmin.storage.from('campaign-images').createSignedUrl(path, 3600)
  → URL temporária para <img> ou download
```

Isso vale para:
- `/campanha/[id]` — imagem principal via signed URL
- `/minhas-campanhas` — thumbnail via signed URL (uma chamada `createSignedUrl` por item)
- `/api/campaign/[id]/download` — signed URL + redirect 302

A policy `FOR SELECT TO authenticated` no Storage existe para diagnóstico e inspeção, não como fonte de dados da UI.

---

### D6 — Eager vs Lazy signed URL

`ADIADO PARA F4/F5`

Não foi definido se a signed URL é gerada:
- **Eager:** durante o Server Component render — N signed URLs geradas em paralelo, clique instantâneo
- **Lazy:** apenas no clique do usuário — SSR mais rápido, micro-delay na interação

A decisão não bloqueia F1 (não toca app code) nem F2 (rota de download lida com signed URL sob demanda). Fica como trade-off a resolver no design de F4 ou F5.

---

### D7 — `store-logos` fora do escopo desta fase

`CONFIRMADO`

O bucket legado `store-logos` permanece intocado. Já inventariado (0 objetos) pela Fase 11. Remoção ou desativação é cleanup separado, pós-v1.3.

---

### D8 — `publication_copy_snapshot` e `render_snapshot` shapes

`ADIADO PARA F3`

Os campos são `JSONB` no schema. A shape exata de cada um (tipos, campos obrigatórios) será definida no design da Fase 3 ou da Fase 4, quando houver implementação concreta. F1 registra apenas a coluna.

---

## Migrations

A fase produz duas migrations SQL sequenciais:

```
20260708000001_create_campaigns_table.sql
20260708000002_create_campaign_images_bucket.sql
```

### Migration 1 — `create_campaigns_table.sql`

```sql
-- Create campaigns table for v1.3 — Persistência e Entrega da Campanha
-- Artefato imutável: status='ready' não deve mais ser alterado.
-- Segue o padrão de trigger scoped (não genérico) do repositório.

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_campaigns_error_message
    CHECK (status <> 'error' OR nullif(trim(error_message), '') IS NOT NULL)
);

-- Trigger scoped (padrão do repositório)
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_campaigns_updated_at();

-- Row Level Security
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.campaigns TO authenticated;

-- Índices
CREATE INDEX IF NOT EXISTS idx_campaigns_store_id
  ON public.campaigns (store_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_at
  ON public.campaigns (created_at DESC);

-- REVERT:
-- DROP INDEX IF EXISTS idx_campaigns_created_at;
-- DROP INDEX IF EXISTS idx_campaigns_store_id;
-- REVOKE SELECT ON TABLE public.campaigns FROM authenticated;
-- DROP POLICY IF EXISTS "owner_select_campaigns" ON public.campaigns;
-- ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
-- DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
-- DROP FUNCTION IF EXISTS public.update_campaigns_updated_at();
-- DROP TABLE IF EXISTS public.campaigns;
```

### Migration 2 — `create_campaign_images_bucket.sql`

```sql
-- Create campaign-images bucket (privado) com policies para v1.3
-- Estratégia: 3 policies (sem UPDATE por imutabilidade)
-- NOTA: As CREATE POLICY abaixo NÃO são idempotentes por design.
-- Seguem o padrão do repositório: cada policy é criada uma única vez
-- na migration original. DROP POLICY IF EXISTS antes de CREATE POLICY
-- poderia mascarar uma migration parcialmente aplicada.
-- O revert commands ao final documenta como desfazer.

-- Bucket: privado, 10MB, PNG/JPEG/WEBP
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-images',
  'campaign-images',
  false,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: owner pode listar objetos do próprio prefixo (diagnóstico)
CREATE POLICY "owner_select_campaign_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-images'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.stores WHERE user_id = (SELECT auth.uid())
    )
  );

-- Policy 2: service_role insere objetos (upload após geração)
CREATE POLICY "service_insert_campaign_images" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'campaign-images');

-- Policy 3: service_role deleta objetos (cleanup técnico futuro)
CREATE POLICY "service_delete_campaign_images" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'campaign-images');

-- NOTA: UPDATE está intencionalmente ausente.
-- A milestone declara a arte imutável (invariante #1).
-- Se houver necessidade de sobrescrita técnica futura,
-- uma migration pequena adiciona FOR UPDATE TO service_role.

-- REVERT:
-- DROP POLICY IF EXISTS "service_delete_campaign_images" ON storage.objects;
-- DROP POLICY IF EXISTS "service_insert_campaign_images" ON storage.objects;
-- DROP POLICY IF EXISTS "owner_select_campaign_images" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'campaign-images';
```

---

## Verificação

Duas camadas, sem infraestrutura nova de teste:

### Camada 1 — Smoke SQL (manual, script executável)

Script `scripts/verify-phase12.sql` com blocos `DO $$` usando `RAISE EXCEPTION` (mais confiável que `ASSERT`, que depende de configuração PL/pgSQL):

```sql
-- 1. Tabela existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'campaigns'
  ) THEN
    RAISE EXCEPTION 'FAIL: campaigns table does not exist';
  END IF;
  RAISE NOTICE 'PASS: campaigns table exists';
END $$;

-- 2. RLS ativa
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'campaigns'
      AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS is not enabled on campaigns';
  END IF;
  RAISE NOTICE 'PASS: RLS enabled on campaigns';
END $$;

-- 3. CHECK constraint error_message
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_campaigns_error_message'
  ) THEN
    RAISE EXCEPTION 'FAIL: chk_campaigns_error_message not found';
  END IF;
  RAISE NOTICE 'PASS: chk_campaigns_error_message exists';
END $$;

-- 4. Trigger updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.triggers
    WHERE trigger_name = 'trg_campaigns_updated_at'
  ) THEN
    RAISE EXCEPTION 'FAIL: trg_campaigns_updated_at not found';
  END IF;
  RAISE NOTICE 'PASS: trg_campaigns_updated_at exists';
END $$;

-- 5. Bucket existe e é privado
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM storage.buckets
    WHERE id = 'campaign-images' AND public = false
  ) THEN
    RAISE EXCEPTION 'FAIL: campaign-images bucket missing or not private';
  END IF;
  RAISE NOTICE 'PASS: campaign-images bucket is private';
END $$;

-- 6. Policies de storage existem
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname = 'owner_select_campaign_images'
  ) THEN
    RAISE EXCEPTION 'FAIL: owner_select_campaign_images policy missing';
  END IF;
  RAISE NOTICE 'PASS: owner_select_campaign_images exists';

  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname = 'service_insert_campaign_images'
  ) THEN
    RAISE EXCEPTION 'FAIL: service_insert_campaign_images policy missing';
  END IF;
  RAISE NOTICE 'PASS: service_insert_campaign_images exists';

  IF NOT EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname = 'service_delete_campaign_images'
  ) THEN
    RAISE EXCEPTION 'FAIL: service_delete_campaign_images policy missing';
  END IF;
  RAISE NOTICE 'PASS: service_delete_campaign_images exists';

  -- Verificar que UPDATE NÃO existe
  IF EXISTS (
    SELECT FROM pg_policies
    WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE 'service_update_campaign%'
  ) THEN
    RAISE EXCEPTION 'FAIL: UPDATE policy should NOT exist';
  END IF;
  RAISE NOTICE 'PASS: UPDATE policy correctly absent';
END $$;
```

### Camada 2 — Testes automatizados (condicionais ao ambiente)

Se o Supabase local estiver configurado e rodando, adicionar testes Jest que validam comportamento real de RLS e Storage. Caso contrário, as verificações abaixo devem ser executadas como **UAT técnico manual** — o checklist de revisão considera a verificação cumprida de qualquer forma (automatizada ou manual).

| # | Verificação | Como testar |
|---|-------------|-------------|
| 1 | Owner vê próprias campaigns | `createServerClient(asOwner)` → SELECT campaigns → retorna registros |
| 2 | Outro tenant não vê campaigns alheias | `createServerClient(asOther)` → SELECT mesma store → 0 resultados |
| 3 | `updated_at` muda no UPDATE | `supabaseAdmin` UPDATE → `updated_at` > `created_at` |
| 4 | `status='error'` sem mensagem rejeita | `supabaseAdmin` UPDATE → viola CHECK → erro |
| 5 | Bucket é privado | GET URL pública → 404/403 |
| 6 | Upload client-side falha | `createServerClient` → upload → 401/403 |
| 7 | Service_role consegue upload | `supabaseAdmin.storage.from('campaign-images').upload()` → ok |
| 8 | Signed URL permite leitura | `createSignedUrl` → fetch → 200 |
| 9 | URL pública não funciona | GET `{supabaseUrl}/storage/v1/object/public/campaign-images/...` → erro |

Nota: as verificações #1–#9 são o mesmo conjunto listado no checklist de revisão. A diferença é apenas o meio de execução: automatizado (Jest) se o ambiente suportar, manual (UAT técnico) caso contrário. **O critério de aceite é o mesmo nos dois casos.**

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Serviço `persistence.ts` e helpers de escrita | Fase 2 / Phase 13 |
| Rota `GET /api/campaign/[id]/download` | Fase 2 / Phase 13 |
| Modificação do fluxo `generate-image` | Fase 3 / Phase 14 |
| Página `/campanha/[id]` | Fase 4 / Phase 15 |
| Página `/minhas-campanhas` + limpeza | Fase 5 / Phase 16 |
| Edição publication copy | Fase 6 condicional |
| `store-logos` cleanup | Pós-v1.3 |
| Shape de `publication_copy_snapshot` e `render_snapshot` | Design diferido para F3/F4 |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Bucket privado `campaign-images` com `public=false` pode ter comportamento inesperado em diferentes versões do Supabase | Testar com signed URL + URL pública (verificações #5, #8 e #9). Alternativa: bucket público + policies restritivas (não necessário se signed URL funcionar) |
| `storage.foldername()` retorna array vazio se path não tiver `/` | Path pattern `{storeId}/{campaignId}.png` sempre tem `/`. Política usa `(storage.foldername(name))[1]` que é o primeiro segmento |
| Trigger `updated_at` com UPDATE explícito de `updated_at` via app layer pode conflitar | Trigger usa `NEW.updated_at = now()` sem condicional — sempre sobrescreve. O app layer não deve setar `updated_at` manualmente |

---

## Checklist de Revisão

### Migration 1 — campaigns table
- [ ] `campaigns` criada com todos os campos, defaults, NOT NULLs conforme schema
- [ ] `chk_campaigns_error_message` CHECK presente
- [ ] `update_campaigns_updated_at()` function criada (scoped, não genérica)
- [ ] `trg_campaigns_updated_at` trigger criado (BEFORE UPDATE, FOR EACH ROW)
- [ ] RLS habilitado em `campaigns`
- [ ] Policy `owner_select_campaigns` criada (subquery `stores.user_id = auth.uid()`)
- [ ] `GRANT SELECT TO authenticated` executado
- [ ] Índices `idx_campaigns_store_id` e `idx_campaigns_created_at` criados
- [ ] Revert commands documentados no final da migration

### Migration 2 — campaign-images bucket
- [ ] Bucket `campaign-images` criado (privado, 10MB, PNG/JPEG/WEBP)
- [ ] `ON CONFLICT (id) DO NOTHING` para idempotência
- [ ] Policy `owner_select_campaign_images` criada (path prefix, owner)
- [ ] Policy `service_insert_campaign_images` criada (INSERT TO service_role)
- [ ] Policy `service_delete_campaign_images` criada (DELETE TO service_role)
- [ ] NENHUMA policy `service_update_campaign_images` criada (verificar ausência)
- [ ] Revert commands documentados

### Verificação
- [ ] Smoke SQL executa sem erro (todos os blocos RAISE NOTICE sem RAISE EXCEPTION)
- [ ] Owner vê suas campaigns via RLS
- [ ] Outro tenant vê 0 resultados (dados não vazam)
- [ ] `updated_at` atualiza em UPDATE
- [ ] `error_message` obrigatório quando `status='error'`
- [ ] Bucket `campaign-images` é privado (URL pública falha)
- [ ] Upload client-side falha
- [ ] Service_role consegue upload + delete
- [ ] Signed URL permite leitura da imagem
- [ ] `npx tsc --noEmit` — zero erros (se houver tipos gerados)
- [ ] `npm run lint` — zero erros
- [ ] `npx next build` — build bem-sucedido
- [ ] Nenhum arquivo de app code foi modificado (fluxo de geração intacto)

---

*Documento criado: 2026-07-08*
*Baseado no alinhamento da milestone v1.3 (D1–D6) e no padrão de alinhamento das Fases 7–11*
*Próximo passo: revisão do time, ajustes, então gerar change proposal + plano GSD da Phase 12*
