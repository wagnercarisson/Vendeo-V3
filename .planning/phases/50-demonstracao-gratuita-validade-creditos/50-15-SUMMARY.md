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

**Buckets de identidade visual privados, consumidores migrados para URLs assinadas no read-time e Task 15.4 validada com smokes HTTP e testes focados.**

## Accomplishments

- Migration `20260920000002_f50_storage_privacy.sql` remove policies públicas, define `public=false` nos três buckets e torna `store_visual_signatures.asset_url` nullable/deprecated.
- `store-identity-service`, listagem de assinaturas, aprovação, restore, realign, upload de logos e UI passaram a derivar URLs assinadas com TTL de 3600s.
- URLs temporárias não são persistidas; novos registros usam `asset_url: null`.
- Migration aplicada localmente e verificada: cinco buckets privados e `asset_url` nullable.
- `npm run typecheck` verde; grep de produção sem `getPublicUrl` ou `/storage/v1/object/public`.
- Falhas de assinatura agora bloqueiam operações de IA com erro explícito, em vez de enviar `assetUrl: ""`.
- Teste unitário focado adicionado para URL assinada, renovação por nova leitura e ausência de URL vazia em falha.
- Smoke HTTP local PASS: upload service-role, acesso público negado, leitura assinada funcional, assinatura renovada e limpeza do objeto.
- Fluxos approve/realign e o helper de restore cobertos nos testes/smokes focados; 42 testes passaram.

## Deviations from Plan

15.4 foi reaberta após revisão e concluída nesta continuação com os smokes HTTP e testes focados.

## Next Phase Readiness

Storage hardening pronto. Nenhum provider foi migrado. O rollback que restaura `asset_url NOT NULL` exige backfill prévio e está documentado como parcial na migration.

---
*Phase: 50-demonstracao-gratuita-validade-creditos*
*Completed: 2026-09-21*
