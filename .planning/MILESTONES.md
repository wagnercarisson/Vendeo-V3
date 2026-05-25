# Milestones

## 1.0 MVP (Shipped: 2026-05-25)

**Phases completed:** 2 phases (Foundation, Campaign Input), 3 plans, 25 tasks

**Key accomplishments:**

- Store identity CRUD (name, segment, brand color, city/state) with Supabase persistence and localStorage
- Campaign input form with product name, BRL currency mask, description, badge selection, and image upload
- Route split: `/` for campaign input, `/store` for store identity, with bidirectional navigation
- Client-side validation on all fields with inline errors, BRL mask with raw-digit extraction, and local submit success state
- Read-only store identity card on campaign page using `resolveStoreIdentity` fallback colors

**Known deferred items at close:** 0

**Known gaps:**
- INPT-04 (logo upload): Intentionally deferred per Phase 1 specs. Name-based visual identity fallback works via `resolveStoreIdentity`.

---
