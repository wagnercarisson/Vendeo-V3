> **Purpose**: Delta spec for store-brand-profile capability — remove the deferred `/brand-profile/generate` requirement, replaced by the `logo-retry` endpoint.

## REMOVED Requirements

### Requirement: Regenerate brand profile — POST /api/store/[id]/brand-profile/generate [DEFERRED to 4.6.3+]

**Reason**: The `/brand-profile/generate` endpoint contract was deferred e o handler (`handleGenerate`) nunca foi exposto por uma rota Next.js válida — o dispatch interno `path.endsWith('/generate')` era código morto. O comportamento de retry é agora suprido pelo endpoint dedicado `POST /api/store/[id]/logo/retry-brand-director` (definido na spec `logo-retry`), que oferece preservação de perfil, snapshots de entrada e validação adequadas.

**Migration**: Replace any references to `/brand-profile/generate` with the new retry endpoint. The `handleGenerate` function in `brand-profile/route.ts` and its route registration SHALL be removed.
