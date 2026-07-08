## Context

O Vendeo gera campanhas visuais mas não as persiste. Após a renderização, a imagem é exibida no preview e descartada. A milestone v1.3 introduz persistência e entrega em 6 fases. Esta fase (Fase 12) estabelece a infraestrutura fundacional: schema da tabela `campaigns`, bucket Storage `campaign-images`, RLS e políticas de acesso.

A fase é puramente de banco + Storage: não cria services, não modula app code, não altera fluxo de geração. Depende das Fases 7–11 — `stores` com `user_id`, RLS em tabelas filhas, `requireOwnership`, `requireApiUser`, padrão de auth consolidado.

Schema atual: 3 tabelas filhas com RLS (`store_brand_assets`, `store_brand_profiles`, `store_visual_signatures`), 3 buckets Storage (públicos: `store-brand-assets`, `visual-signatures`, `store-logos`), padrão de trigger `updated_at` scoped por tabela.

## Goals / Non-Goals

**Goals:**
- Criar tabela `public.campaigns` com DDL, CHECK constraints, trigger scoped `update_campaigns_updated_at`, RLS `owner_select_campaigns`, índices `store_id` e `created_at DESC`
- Criar bucket privado `campaign-images` (10MB, PNG/JPEG/WEBP) com 3 Storage policies
- Garantir imutabilidade: sem Storage UPDATE policy
- Fornecer smoke SQL de verificação (`scripts/verify-phase12.sql`)
- Checklist de revisão para UAT técnico: 10 verificações de RLS + Storage + integridade

**Non-Goals:**
- Serviço `persistence.ts` e helpers de escrita — Fase 13
- Rota `GET /api/campaign/[id]/download` — Fase 13
- Modificação do fluxo `generate-image` — Fase 14
- Página `/campanha/[id]` — Fase 15
- Página `/minhas-campanhas` + limpeza — Fase 16
- Edição publication copy — Fase 6 condicional
- Shape exato de `publication_copy_snapshot` e `render_snapshot` — design diferido para F3/F4
- `store-logos` cleanup — pós-v1.3
- Tipos TypeScript gerados por `supabase gen types` — opcional nesta fase
- Testes automatizados com Jest (não obrigatórios nesta fase; podem ser executados manualmente como UAT técnico se Supabase local não estiver disponível)

## Decisions

### D1 — Trigger `updated_at` scoped (padrão do repositório)

O repositório usa função PL/pgSQL + trigger nomeado por tabela (não função genérica). `campaigns` segue o mesmo padrão de `store_visual_signatures`, `store_brand_assets`, `store_brand_profiles`:

```sql
CREATE OR REPLACE FUNCTION public.update_campaigns_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_campaigns_updated_at();
```

**Motivo:** Invariante da milestone — detecção de stale `generating` depende de `updated_at` para identificar registros mais antigos que o timeout global + margem.

### D2 — `error_message` CHECK constraint

```sql
CONSTRAINT chk_campaigns_error_message
  CHECK (status <> 'error' OR nullif(trim(error_message), '') IS NOT NULL)
```

**Motivo:** Proteção de integridade. Se UPDATE `status='error'` sem `error_message`, a UI não teria o que exibir. CHECK previne dados inconsistentes no banco.

### D3 — Storage policies: Opção B (sem UPDATE)

Bucket `campaign-images` é privado com 3 políticas:

| Policy | Scope | Motivo |
|--------|-------|--------|
| `FOR SELECT TO authenticated` | Owner path prefix `(storage.foldername(name))[1] IN (stores.id)` | Inspeção/diagnóstico |
| `FOR INSERT TO service_role` | `bucket_id = 'campaign-images'` | Upload server-side pós-geração |
| `FOR DELETE TO service_role` | `bucket_id = 'campaign-images'` | Cleanup técnico, falhas parciais |
| `FOR UPDATE` | **omitido** | Imutabilidade da arte final |

**Motivo da omissão:** A milestone declara a imagem final como soberana e imutável (invariante #1). Buckets existentes (`store-brand-assets`, `visual-signatures`) têm 4 policies porque suportam substituição de assets. `campaign-images` não.

**Trade-off:** Se upload for bem-sucedido no Storage mas UPDATE no banco falhar, retry no mesmo `storage_path` requer deletar e reenviar (não upsert/overwrite). Consistente com imutabilidade, mas fases 13-14 devem tratar esse caminho explicitamente.

### D4 — RLS: SELECT do owner sem escrita

```sql
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (store_id IN (
    SELECT id FROM public.stores WHERE user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON TABLE public.campaigns TO authenticated;
```

INSERT/UPDATE/DELETE exclusivos do `supabaseAdmin` (service_role), sempre precedidos por `requireOwnership` no backend. Mesmo padrão das demais tabelas do sistema.

### D5 — Imagens via `storage_path` + signed URL, não via listagem

A UI nunca depende de `storage.objects` SELECT para obter imagens. O fluxo é:

```
campaigns.storage_path
  → supabaseAdmin.storage.from('campaign-images').createSignedUrl(path, 3600)
  → URL temporária para <img> ou download
```

Vale para `/campanha/[id]`, `/minhas-campanhas` (thumbnail via signed URL por item), `/api/campaign/[id]/download` (signed URL + redirect 302). A policy `FOR SELECT TO authenticated` existe para diagnóstico, não como fonte de dados da UI.

### D6 — Migrations sequenciais com revert commands

Duas migrations numeradas sequencialmente:

```
supabase/migrations/
  20260708000001_create_campaigns_table.sql
  20260708000002_create_campaign_images_bucket.sql
```

Ambas incluem revert commands comentados ao final. A migration 2 usa `ON CONFLICT (id) DO NOTHING` para idempotência do bucket. As Storage policies **não** são idempotentes por design — `DROP POLICY IF EXISTS` antes de `CREATE POLICY` poderia mascarar migration parcialmente aplicada.

## Risks / Trade-offs

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Bucket privado `campaign-images` com `public=false` pode ter comportamento inesperado em versões do Supabase | Signed URL pode falhar | Testar signed URL + URL pública (verificações #5, #8, #9). Alternativa: bucket público + policies restritivas |
| `storage.foldername()` retorna array vazio se path sem `/` | Policy não match | Path pattern `{storeId}/{campaignId}.png` sempre tem `/`. Política usa `(storage.foldername(name))[1]` |
| Trigger `updated_at` sobrescreve UPDATE explícito via app layer | App não deve setar `updated_at` manualmente | Trigger usa `NEW.updated_at = now()` sem condicional. Documentar que app layer não deve setar o campo |
| Retry de upload em falha parcial não pode usar upsert | Precisa deletar e reenviar | Fases 13-14 devem tratar esse fluxo explicitamente |
| `ON CONFLICT DO NOTHING` pode mascarar erro em migration | Bucket não criado como esperado | Smoke SQL verifica existência do bucket após migration |
| Supabase local ausente impede testes automatizados | Verificação apenas manual | Smoke SQL + UAT técnico manual como fallback. Critério de aceite é o mesmo |
