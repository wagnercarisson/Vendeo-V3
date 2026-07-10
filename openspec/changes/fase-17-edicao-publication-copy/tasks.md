## 1. Plano 17-01 — Migration + Display Contract + Validação

- [ ] 1.1 Criar migration `supabase/migrations/_<timestamp>_add_publication_copy_current.sql` — `ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS publication_copy_current JSONB;` com `COMMENT ON COLUMN`
- [ ] 1.2 Modificar `src/lib/campaign/types.ts` — adicionar `publication_copy_current: Record<string, unknown> | null` opcional em `CampaignRecord`
- [ ] 1.3 Implementar `getEffectivePublicationCopy(campaign)` em `display.ts` — função auxiliar com fallback `current > snapshot > vazio`, critério de shape/tipo (não truthiness)
- [ ] 1.4 Modificar `mapCampaignToProps` em `display.ts` — usar `getEffectivePublicationCopy`, adicionar `campaignId: string` e `isPublicationCopyEdited: boolean` ao retorno
- [ ] 1.5 Criar `src/lib/campaign/publication-copy.ts` com `validatePublicationCopy(body)` — valida caption (1–2200), hashtags (0–30, formato `#`, sem espaços), cta_post (0–200), restore: true
- [ ] 1.6 Definir `PublicationCopyUpdate` (union: edição normal | restore) e `ValidationIssue` em `publication-copy.ts`
- [ ] 1.7 Criar testes de `validatePublicationCopy` (8 cenários: válido, restore, caption longo, hashtag sem #, >30 hashtags, hashtag com espaço, cta longo, body vazio) em `src/__tests__/lib/campaign/publication-copy.test.ts`
- [ ] 1.8 Criar testes de `getEffectivePublicationCopy` (4 cenários: current existe, current null, current incompleto, ambos null) em `src/__tests__/lib/campaign/display.test.ts`

## 2. Plano 17-02 — Rota PATCH + UI de Edição

- [ ] 2.1 Criar `src/app/api/campaign/[id]/publication-copy/route.ts` — estrutura do route handler com `export const dynamic = "force-dynamic"`
- [ ] 2.2 Implementar guards: `requireSameOrigin(request)`, `requireApiUser()`, validar UUID v4 (404 se inválido), `getCampaign(id)`, `requireOwnership(campaign.store_id, user.userId)` com retorno 404
- [ ] 2.3 Implementar validação do body via `validatePublicationCopy` — se inválido, 400 com `{ error, issues }`
- [ ] 2.4 Implementar `restore: true` — `supabaseAdmin.from("campaigns").update({ publication_copy_current: null })` + resposta 200 com `{ restored: true, publication_copy_snapshot }`
- [ ] 2.5 Implementar edição normal — `supabaseAdmin.from("campaigns").update({ publication_copy_current: { caption, hashtags, cta_post } })` + resposta 200 com `{ publication_copy_current: {...} }`
- [ ] 2.6 Modificar `src/app/campanha/[id]/page.tsx` — passar `effectiveCopy` pré-computado via `getEffectivePublicationCopy` ao Client Component, incluindo `campaignId` e `isPublicationCopyEdited`
- [ ] 2.7 Modificar `src/app/campanha/[id]/client.tsx` — receber `campaignId` e `isPublicationCopyEdited` das props; adicionar estado de edição (visualização vs edição); badge "Editado" condicionado a `isPublicationCopyEdited`
- [ ] 2.8 Implementar modo edição: textarea para caption, textarea "uma por linha" para hashtags (normalizado como array no save), input para cta_post, preenchidos com valores atuais
- [ ] 2.9 Implementar botão "Salvar" — PATCH para `/api/campaign/${campaignId}/publication-copy` com dados, loading state ("Salvando..."), feedback de sucesso/erro, volta ao modo visualização em caso de sucesso
- [ ] 2.10 Implementar botão "Restaurar original" — confirmação "Restaurar texto original da IA?" → PATCH `{ restore: true }` para `/api/campaign/${campaignId}/publication-copy` → atualiza UI com snapshot retornado
- [ ] 2.11 Implementar botão "Cancelar" — descarta alterações locais, volta ao modo visualização sem chamar API
- [ ] 2.12 Criar testes do PATCH route (8 cenários: sucesso, validação, 404 inexistente, 404 UUID inválido, 404 outro tenant, restore, CSRF inválido, sem auth) em `src/__tests__/api/publication-copy-route.test.ts`
- [ ] 2.13 Criar testes da UI de edição (9 cenários: visualização, badge, edição, campaignId na URL, salvar, restaurar, cancelar, loading, erro) em `src/__tests__/app/campanha/[id]/client.test.tsx`

## 3. Verificação Final

- [ ] 3.1 Rodar `npm run typecheck` — zero erros
- [ ] 3.2 Rodar `npm run lint` — zero erros
- [ ] 3.3 Rodar `npx vitest run` — todos os testes passando
- [ ] 3.4 Rodar `npm run build` — build bem-sucedido
