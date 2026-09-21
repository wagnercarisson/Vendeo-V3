---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 15
subsystem: storage
tags: [supabase-storage, signed-url, privacy, visual-signature]

requires:
  - phase: 50-01
    provides: "baseline + inventário de consumidores de storage"
provides:
  - "Buckets store-brand-assets/visual-signatures/store-logos privados"
  - "URLs assinadas derivadas no read-time; storage_path canônico; asset_url nullable/deprecated"
affects: [storage-privacy, visual-signature, store-identity]

tech-stack:
  added: []
  patterns:
    - "createSignedUrl com TTL de 3600s no read-time"

key-files:
  created:
    - "supabase/migrations/20260920000002_f50_storage_privacy.sql"
  modified:
    - "src/lib/store-identity-service.ts"
    - "src/lib/visual-signature/persistence.ts"
    - "src/lib/visual-signature/types.ts"
    - "src/lib/brand-assets/types.ts"
    - "src/app/api/store/[id]/logo/route.ts"
    - "src/app/api/store/[id]/visual-signature/route.ts"
    - "src/app/api/store/[id]/visual-signature/approve/route.ts"
    - "src/app/api/store/[id]/visual-signature/restore/route.ts"
    - "src/app/api/store/[id]/brand-profile/realign/route.ts"
    - "src/components/flow/store-identity-form.tsx"
    - "src/components/flow/store-visual-signature-section.tsx"

key-decisions:
  - "Nenhum getPublicUrl/URL pública em produção; testes legados permanecem apenas como mocks"
  - "asset_url não é mais persistido; storage_path é a referência durável"

requirements-completed: [storage-privacy]

duration: 1h 30min
completed: 2026-09-21
---

# Phase 50 Plan 15: Storage privacy Summary

**Buckets de identidade visual privados, consumidores migrados para URLs assinadas no read-time e `asset_url` tornado nullable/deprecated com `storage_path` canônico, sem migração para R2.**

## Accomplishments

- Migration `20260920000002_f50_storage_privacy.sql` remove policies públicas, define `public=false` nos três buckets e torna `store_visual_signatures.asset_url` nullable/deprecated.
- `store-identity-service`, listagem de assinaturas, aprovação, restore, realign, upload de logos e UI passaram a derivar URLs assinadas com TTL de 3600s.
- URLs temporárias não são persistidas; novos registros usam `asset_url: null`.
- Migration aplicada localmente e verificada: cinco buckets privados e `asset_url` nullable.
- `npm run typecheck` verde; grep de produção sem `getPublicUrl` ou `/storage/v1/object/public`.

## Deviations from Plan

Nenhuma mudança de escopo. A renovação é garantida pelo helper read-time, que cria uma nova assinatura a cada leitura; a suíte específica de integração/storage permanece prevista no plano 50-12.

## Next Phase Readiness

Storage hardening pronto para os testes de integração 50-12. Nenhum provider foi migrado.

---
*Phase: 50-demonstracao-gratuita-validade-creditos*
*Completed: 2026-09-21*
