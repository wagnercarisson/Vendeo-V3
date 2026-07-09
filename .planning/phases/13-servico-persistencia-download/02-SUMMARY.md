# Plan 13-02: Download Route ✓

**Objective:** Create GET /api/campaign/[id]/download with full guard pipeline.

## Files Created

- `src/app/api/campaign/[id]/download/route.ts`

## Guard Pipeline

1. `requireApiUser()` — authentication first (401 on failure)
2. UUID v4 regex validation (400 on malformed)
3. `getCampaign(id)` — fetch via supabaseAdmin (404 if not found)
4. `requireOwnership(campaign.store_id, user.userId)` — 404 on mismatch (no existence leak)
5. `createSignedUrl(storagePath, 3600)` — signed URL generation (502 on failure)
6. `NextResponse.redirect(signedUrl, 302)` — final redirect

## Verification

- `npm run typecheck`: ✓
- `npm run lint`: ✓
