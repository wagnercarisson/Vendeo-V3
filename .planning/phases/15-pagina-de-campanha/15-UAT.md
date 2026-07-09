---
status: complete
phase: 15-pagina-de-campanha
source: 15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md
started: 2026-07-09T19:42:00Z
updated: 2026-07-09T19:49:00Z
---

## Current Test

[testing complete — 14/14 auto-verificado]

## Tests

### 1. Verificação automatizada — gates
expected: typecheck, lint, tests (524), build — tudo verde
result: pass
verified: "npm run typecheck → clean, npm run lint → clean, npx vitest run → 60 files 524 passing, npm run build → clean"

### 2. Middleware — sessão renovada em /campanha/:path*
expected: config.matcher contém "/campanha/:path*" para renovação de sessão via updateSession
result: pass
verified: "src/middleware.ts:85 contém \"/campanha/:path*\" no array config.matcher. Teste campaign-matcher.test.ts confirma via import de config."

### 3. Server Component — 404 para campanha inexistente
expected: getCampaignForDisplay(id) retorna null → notFound() é chamado
result: pass
verified: "Teste campaign-page-server.test.tsx: mock getCampaignForDisplay retorna null → notFoundFn chamado e throw NEXT_CONTROL."

### 4. Server Component — redirect /store quando sem loja
expected: getCurrentStore() retorna null → redirect("/store") é chamado
result: pass
verified: "Teste campaign-page-server.test.tsx: mock getCurrentStore retorna null → redirectFn chamado com \"/store\" e throw NEXT_CONTROL."

### 5. Client Component — estado ready
expected: displayStatus="ready" renderiza imagem, caption, hashtags, cta_post, botão "Baixar Original" com downloadUrl
result: pass
verified: "Teste campaign-page.test.tsx: render com props ready → screen.getByRole('img'), getByText('Oferta!'), getByText('#promo'), getByRole('link', {name: /baixar/i}) com href /api/campaign/123/download."

### 6. Client Component — estado generating + polling
expected: displayStatus="generating" renderiza spinner + mensagem + router.refresh a cada 5s, cleanup no unmount
result: pass
verified: "Teste campaign-page.test.tsx: render generating → getByText('Sua campanha está sendo gerada...'). vi.advanceTimersByTime(5000) → mockRefresh chamado 1x. Unmount → advance 10000 → mockRefresh não chamado."

### 7. Client Component — estado stale
expected: displayStatus="stale" renderiza "Geração interrompida. Tente novamente." + CTA "Criar Nova Campanha"
result: pass
verified: "Teste campaign-page.test.tsx: render stale → getByText('Geração interrompida...') + getByRole('button', {name: /criar nova campanha/i})."

### 8. Client Component — estado error
expected: displayStatus="error" renderiza "Não foi possível gerar sua campanha." + CTA "Criar Nova Campanha"
result: pass
verified: "Teste campaign-page.test.tsx: render error → getByText('Não foi possível gerar sua campanha.') + getByRole('button', {name: /criar nova campanha/i})."

### 9. display.ts — RLS via createServerClient
expected: getCampaignForDisplay usa createServerClient() (sessão do usuário + RLS), não supabaseAdmin
result: pass
verified: "display.ts:25: const supabase = await createServerClient(); → supabase.from('campaigns').select('*').eq('id', id).maybeSingle(). Teste confirma createServerClient chamado."

### 10. display.ts — UUID validation
expected: getCampaignForDisplay("not-a-uuid") retorna null sem consultar o banco
result: pass
verified: "display.ts:21-22: regex UUID v4, retorna null se não match. Teste: createServerClient não chamado quando UUID inválido."

### 11. display.ts — signed URL condicionada
expected: generateSignedPreviewUrl(storagePath) usa supabaseAdmin.storage.createSignedUrl com expiresIn 3600, retorna null para path vazio
result: pass
verified: "display.ts:39-53: retorna null se !storagePath. Usa supabaseAdmin.storage.from('campaign-images').createSignedUrl(storagePath, 3600). Testes confirmam ambos comportamentos."

### 12. display.ts — computeDisplayStatus
expected: ready→"ready", error→"error", generating recent→"generating", generating antigo→"stale"
result: pass
verified: "display.ts:56-70. Teste display.test.ts: 4 cenários confirmam cada transição. Stale detectado quando elapsed > IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30000."

### 13. display.ts — snapshot fallback
expected: mapCampaignToProps com publication_copy_snapshot=null retorna caption="", hashtags=[], ctaPost=""
result: pass
verified: "display.ts:72-85: type guard typeof snap?.caption === 'string' ? ... : '', Array.isArray(snap?.hashtags) ? ... : []. Teste confirmado via typecheck."

### 14. display.ts — CampaignPageProps exportado
expected: CampaignPageProps exportado de @/lib/campaign/display com imageUrl: string | null, usado como contrato page.tsx ↔ client.tsx
result: pass
verified: "display.ts:8-18: interface CampaignPageProps exportada. client.tsx:5 importa de @/lib/campaign/display. page.tsx importa mapCampaignToProps que retorna CampaignPageProps."

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
