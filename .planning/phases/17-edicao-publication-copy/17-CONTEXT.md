# Phase 17: Edição de Publication Copy — Context

**Gathered:** 2026-07-10
**Status:** Ready for planning
**Source:** OpenSpec change (`openspec/changes/fase-17-edicao-publication-copy/`)

<domain>
## Phase Boundary

A milestone v1.3 foi concluída com sucesso (F12–F16). O lojista gera, persiste, encontra e baixa campanhas. O publication copy (caption, hashtags, cta_post) é gerado pela IA e armazenado como snapshot imutável em `publication_copy_snapshot`.

**Problema:** O lojista não pode ajustar o texto de publicação sem regerar a campanha inteira. Se a IA sugeriu um caption que não reflete a oferta real, ou se o lojista quer adicionar hashtags sazonais, ele precisa editar apenas o texto — sem alterar a imagem, sem nova geração.

**Critério de conclusão:** O lojista visualiza o publication copy na página `/campanha/[id]`, clica "Editar", altera caption/hashtags/cta_post, salva, e vê os dados atualizados sem recarregar a página. Pode restaurar o texto original da IA com um clique.

Depende da F12: tabela `campaigns` com `publication_copy_snapshot`.
Depende da F15: página `/campanha/[id]`, display contract em `display.ts`, client component `client.tsx`.
Depende da F13: padrão apiHandler de route handlers.

</domain>

<decisions>
## Implementation Decisions

### D1 — `publication_copy_current` como coluna JSONB direta em `campaigns`

CONFIRMADO

```
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS publication_copy_current JSONB;

COMMENT ON COLUMN public.campaigns.publication_copy_current IS
  'Versão editada pelo usuário do publication copy. Se null, usar publication_copy_snapshot como fallback.';
```

**Motivos:**
- Migração mínima: não cria tabela nova, não quebra existente
- Leitura sem JOIN: o Server Component busca `campaigns.*` e decide no display layer qual usar
- `publication_copy_snapshot` permanece imutável — nunca é tocado por escrita do usuário
- Se `current` for null, o fallback usa o snapshot — sem lógica condicional complexa

### D2 — Fallback no display layer: `current > snapshot > vazio`

CONFIRMADO

Criar `getEffectivePublicationCopy(campaign)` em `display.ts`. Regra:
- Se `publication_copy_current` não é null, é um objeto, e contém `caption: string`, `hashtags: string[]`, `cta_post: string` → usa current
- Caso contrário → fallback para `publication_copy_snapshot`
- Se nem current nem snapshot têm dados → string vazia / array vazio
- **Critério é de shape/tipo, não de truthiness.** `cta_post` vazio (`""`) é um valor válido e não causa fallback indevido para o snapshot.

`mapCampaignToProps` passa a usar `getEffectivePublicationCopy` em vez de ler diretamente o snapshot.

**Novos campos no contrato:**
- `campaignId: string` — ID da campanha, usado pelo Client Component para montar a URL do PATCH (`/api/campaign/${campaignId}/publication-copy`)
- `isPublicationCopyEdited: boolean` — derivado de `publication_copy_current !== null`, usado pelo Client Component para exibir o badge "Editado" sem precisar acessar o snapshot diretamente

### D3 — Rota PATCH com validação no backend

CONFIRMADO

```
PATCH /api/campaign/[id]/publication-copy

Body (edição normal):
{ caption: "Novo texto", hashtags: ["#promocao", "#oferta"], cta_post: "Compre agora" }

Body (restaurar original):
{ restore: true }
```

**Fluxo:**
```
request → requireSameOrigin (CSRF) → requireApiUser → validar UUID v4 (se inválido → 404) → busca campaign por id
  → se não existir → 404
  → requireOwnership(campaign.store_id) → se falhar → 404
  → validar body
    → se restore === true:
        supabaseAdmin.from("campaigns").update({ publication_copy_current: null }).eq("id", id)
        → ler snapshot do banco
        → response 200 { restored: true, publication_copy_snapshot: { caption, hashtags, cta_post } }
    → se caption, hashtags, cta_post presentes:
        validar caption (string, max 2200)
        validar hashtags (array de strings, max 30, cada uma começa com #)
        validar cta_post (string, max 200)
        supabaseAdmin.from("campaigns").update({
          publication_copy_current: { caption, hashtags, cta_post }
        }).eq("id", id)
        → response 200 { publication_copy_current: { caption, hashtags, cta_post } }
    → se validação falhar → 400 { error: "...", issues: [...] }
```

### D4 — UI: edição inline em `/campanha/[id]`

CONFIRMADO

| Ação | Comportamento |
|------|--------------|
| Clicar "Editar" | Entra em modo edição: campos viram inputs preenchidos com valores atuais (current ou snapshot) |
| Clicar "Salvar" | Chama PATCH com dados → se 200, atualiza estado local → volta ao modo visualização |
| Clicar "Restaurar original" | Confirmação → chama PATCH `{ restore: true }` → resposta retorna snapshot → cliente atualiza estado → volta ao modo visualização sem recarregar |
| Clicar "Cancelar" | Descarta alterações locais, volta ao modo visualização sem chamar API |

**Badge "Editado":** Exibido ao lado do título "Kit de Publicação" quando `publication_copy_current` não é null.

### D5 — Dois planos de execução

CONFIRMADO

| Plano | Foco | Arquivos |
|-------|------|----------|
| **17-01** | Migration + Display contract + Validação | Migration column, `display.ts` (`getEffectivePublicationCopy`), `types.ts` (campo opcional), `publication-copy.ts` (validação) |
| **17-02** | Rota PATCH + UI de edição | `route.ts` (PATCH), `client.tsx` (modo edição inline) |

```
17-01 ──► 17-02
(contrato)  (rota + UI)
```

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 — Fundação DB/Storage
- `src/lib/campaign/types.ts` — CampaignRecord, PublicationCopySnapshot
- `supabase/migrations/20260708000001_create_campaigns_table.sql` — DDL da tabela campaigns

### Phase 13 — Serviço de Persistência
- `src/lib/campaign/persistence.ts` — getCampaign, padrão supabaseAdmin

### Phase 15 — Página de Campanha
- `.planning/phases/15-pagina-de-campanha/15-CONTEXT.md` — Context and decisions
- `.planning/phases/15-pagina-de-campanha/15-01-PLAN.md` — display.ts pattern
- `.planning/phases/15-pagina-de-campanha/15-02-PLAN.md` — page + client pattern
- `src/lib/campaign/display.ts` — Display contract pattern (getCampaignForDisplay, mapCampaignToProps, computeDisplayStatus)
- `src/app/campanha/[id]/page.tsx` — Server Component pattern
- `src/app/campanha/[id]/client.tsx` — Client Component pattern

### Auth patterns
- `src/lib/auth/require-user.ts` — `requirePageUser()`, `requireApiUser()`
- `src/lib/auth/store-ownership.ts` — `requireOwnership(storeId, userId)`
- `src/lib/supabase/server.ts` — `createServerClient()` (RLS-aware), `supabaseAdmin`

### CSRF
- `src/lib/auth/csrf.ts` — `requireSameOrigin(request)`

### OpenSpec change artifacts (source of truth)
- `openspec/changes/fase-17-edicao-publication-copy/proposal.md` — Why, What Changes, Impact
- `openspec/changes/fase-17-edicao-publication-copy/design.md` — Goals, Non-Goals, Decisions D1-D5
- `openspec/changes/fase-17-edicao-publication-copy/tasks.md` — Task breakdown per plan
- `openspec/changes/fase-17-edicao-publication-copy/specs/publication-copy-migration/spec.md` — Migration spec
- `openspec/changes/fase-17-edicao-publication-copy/specs/campaign-types/spec.md` — Types delta spec
- `openspec/changes/fase-17-edicao-publication-copy/specs/campaign-display-contract/spec.md` — Display contract delta spec
- `openspec/changes/fase-17-edicao-publication-copy/specs/publication-copy-validation/spec.md` — Validation spec
- `openspec/changes/fase-17-edicao-publication-copy/specs/publication-copy-route/spec.md` — Route spec
- `openspec/changes/fase-17-edicao-publication-copy/specs/campaign-page-ui/spec.md` — UI delta spec
- `openspec/changes/fase-17-edicao-publication-copy/specs/publication-copy-tests/spec.md` — Test spec

### Files to be created
- `supabase/migrations/<timestamp>_add_publication_copy_current.sql` — ADD COLUMN migration
- `src/lib/campaign/publication-copy.ts` — validatePublicationCopy, PublicationCopyUpdate, ValidationIssue
- `src/app/api/campaign/[id]/publication-copy/route.ts` — PATCH route handler
- `src/__tests__/lib/campaign/publication-copy.test.ts` — Validation tests (8 cenários)
- `src/__tests__/api/publication-copy-route.test.ts` — Route tests (8 cenários)
- `src/__tests__/app/campanha/[id]/client.test.tsx` — UI edit mode tests (9 cenários)

### Files to be modified
- `src/lib/campaign/types.ts` — Add `publication_copy_current: Record<string, unknown> | null`
- `src/lib/campaign/display.ts` — Add `getEffectivePublicationCopy`, modify `mapCampaignToProps`
- `src/app/campanha/[id]/page.tsx` — Pass `campaignId`, `isPublicationCopyEdited` to client
- `src/lib/campaign/display.test.ts` — Add tests for `getEffectivePublicationCopy` (4 cenários)

### Middleware
- `src/middleware.ts` — Not modified (rota é `/api/campaign/[id]/publication-copy`, já coberta por `/api/:path*`)

</canonical_refs>

<specifics>
## Specific Ideas

### Migration SQL
```sql
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS publication_copy_current JSONB;

COMMENT ON COLUMN public.campaigns.publication_copy_current IS
  'Versão editada pelo usuário do publication copy. Se null, usar publication_copy_snapshot como fallback.';
```

### `types.ts` — CampaignRecord delta
Adicionar `publication_copy_current: Record<string, unknown> | null` opcional entre `publication_copy_snapshot` e `storage_path`.

### `publication-copy.ts` — validatePublicationCopy
```typescript
export type PublicationCopyUpdate =
  | { caption: string; hashtags: string[]; cta_post: string }
  | { restore: true };

export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}

export function validatePublicationCopy(body: unknown):
  { valid: true; data: PublicationCopyUpdate }
  | { valid: true; data: { restore: true } }
  | { valid: false; issues: ValidationIssue[] }
```

Regras:
- caption: string, 1–2200 chars
- hashtags: string[], 0–30 itens, cada: 2–100 chars, começa com `#`, sem espaços, apenas `\w` após `#`
- cta_post: string, 0–200 chars (opcional, pode ser vazio)
- restore: boolean — se true, ignora outros campos
- Body vazio (`{}`): rejeitar

### `display.ts` — getEffectivePublicationCopy
```typescript
export function getEffectivePublicationCopy(campaign: CampaignRecord): {
  caption: string;
  hashtags: string[];
  cta_post: string;
}
```

Critério de fallback por shape (não truthiness):
- `publication_copy_current` não null, objeto, com `caption: string`, `hashtags: string[]`, `cta_post: string` → usa current
- Senão → tenta `publication_copy_snapshot` com mesmo critério
- Senão → `{ caption: "", hashtags: [], cta_post: "" }`

### `mapCampaignToProps` — novos campos
- Substituir leitura direta de `publication_copy_snapshot` por `getEffectivePublicationCopy(campaign)`
- Adicionar `campaignId: id` (string)
- Adicionar `isPublicationCopyEdited: campaign.publication_copy_current !== null` (boolean)

### PATCH route — fluxo completo
`requireSameOrigin(request)` → `requireApiUser()` → validar UUID → `getCampaign(id)` → `requireOwnership(campaign.store_id, user.userId)` → `validatePublicationCopy(body)` → persistir → 200

### UI — Edição inline em `client.tsx`
- Novo estado `editing: boolean` (default false)
- Novo estado `editData: { caption, hashtags, cta_post }` preenchido com valores atuais ao entrar em edição
- Novo estado `saving: boolean` e `saveError: string | null`
- Modalidade "hashtags uma por linha": o textarea mostra hashtags separadas por newline no modo edição; no save, faz `.split("\n").map(s => s.trim()).filter(Boolean)`
- Botão "Editar" → editing=true, editData preenchido
- Botão "Salvar" → saving=true → PATCH fetch → se ok → atualiza props locais → editing=false
- Botão "Restaurar original" → confirm → PATCH restore → atualiza UI com snapshot
- Botão "Cancelar" → editing=false, descarta editData

</specifics>

<deferred>
## Deferred Ideas

- Histórico de edições (versionamento) — exigiria tabela separada
- Preview visual estilo post (Instagram mock) — fora do escopo
- Indicador "editado" no dashboard `/minhas-campanhas` — futuro
- Duplicar campanha reusando copy editado
- Edição com IA (regenerar caption)
- Auto-save
- Supabase gen types — pós-v1.3
- Validação no frontend (apenas backend por enquanto)

</deferred>

---

*Phase: 17-edicao-publication-copy*
*Context gathered: 2026-07-10 via OpenSpec change (fase-17-edicao-publication-copy)*
