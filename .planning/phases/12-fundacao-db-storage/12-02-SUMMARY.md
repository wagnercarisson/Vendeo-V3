---
phase: 12
plan: 12-02
subsystem: storage
tags:
  - migration
  - storage
  - campaign-images
  - bucket
  - rls
requires:
  - phases 7-11 (stores with user_id, Storage policies pattern)
  - 12-01 (dependent via depends_on)
provides:
  - campaign-images bucket (private, 10MB, PNG/JPEG/WEBP)
  - 3 Storage policies (owner SELECT, service_role INSERT/DELETE)
affects: []
tech-stack:
  added: []
  patterns:
    - private bucket with service_role-only writes
    - NO UPDATE policy for immutability
    - storage.foldername() for path prefix verification
key-files:
  created:
    - supabase/migrations/20260708000002_create_campaign_images_bucket.sql
  modified: []
key-decisions:
  - D3: No UPDATE policy — campaign images are immutable (invariante #1)
  - D5: Images accessed via signed URL, not public URL or list
  - D6: ON CONFLICT DO NOTHING for bucket idempotency
requirements-completed:
  - REQ-BUCKET-CAMPAIGN-IMAGES
  - REQ-SELECT-POLICY
  - REQ-INSERT-POLICY
  - REQ-DELETE-POLICY
  - REQ-NO-UPDATE-POLICY
duration: "2 min"
completed: 2026-07-08
---

# Phase 12 Plan 02: Migration 2 — Campaign-Images Bucket Summary

Migration `20260708000002_create_campaign_images_bucket.sql` with private bucket `campaign-images` (10MB limit, PNG/JPEG/WEBP only), 3 Storage policies (owner SELECT by store prefix, service_role INSERT, service_role DELETE), and intentional absence of UPDATE policy for image immutability.

## Tasks

### Task 12-02a: Write Storage bucket migration
- **Status:** Complete
- **Commit:** 412c427
- Private bucket with `public=false`, `file_size_limit=10485760`, `allowed_mime_types` for PNG/JPEG/WEBP
- 3 policies: `owner_select_campaign_images` (path prefix), `service_insert_campaign_images`, `service_delete_campaign_images`
- `ON CONFLICT (id) DO NOTHING` for idempotency

### Task 12-02b: Validate no UPDATE policy
- **Status:** Complete
- Confirmed: no `FOR UPDATE` policy definition exists
- Confirmed: no policy named `service_update_campaign_*` exists
- Documented: comment explaining intentional absence for immutability

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
