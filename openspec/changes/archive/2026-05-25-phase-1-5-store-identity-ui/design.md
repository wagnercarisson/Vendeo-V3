## Context

The Store Identity Foundation (Phase 1) implemented the data schema, CRUD API, `resolveStoreIdentity` utility, and `VALID_SEGMENTS` constant. The current landing page at `src/app/page.tsx` is an empty `<main />`. Lojistas need a visual form to input and edit their store identity before proceeding to campaign creation.

The design system (`openspec/design-system/MASTER.md` and `pages/store-identity.md`) defines the visual and UX direction for this page, including Dark Mode palette, typography (Poppins + Open Sans), form validation patterns, and the store identity layout.

**Tailwind CSS is not yet installed.** The project needs `tailwindcss`, `postcss`, and `autoprefixer` as dev dependencies plus config files before any UI can be built. Since the Vendeo visual direction is based on Tailwind (design system tokens, color palette from MASTER.md), this phase includes Tailwind setup.

The MASTER.md also defines a V1 flow with step navigation (`src/app/(flow)/`) for multi-page navigation. For this initial UI-only phase, we bypass the flow layout and build the form directly on `src/app/page.tsx` since step navigation between pages comes in a later integration phase. The component structure, however, follows the MASTER.md file organization conventions (`src/components/ui/` and `src/components/flow/`).

## Goals / Non-Goals

**Goals:**
- Single-page form for creating/editing store identity at `src/app/page.tsx`
- Fields: Nome da Loja, Segmento (dropdown), Cor da Marca (color picker), Cidade, Estado (select)
- Consume `POST /api/store` (create), `GET /api/store/[id]` (load), `PATCH /api/store/[id]` (update)
- Persist `store_id` in `localStorage` as temporary MVP mechanism (until auth exists)
- Auto-load existing store on page load if `store_id` exists in localStorage
- Handle invalid/deleted store_id (GET returns 404): clear localStorage, show create mode with warning
- Normalize optional fields: empty string → null for `city`, `state`, `brand_color`
- Brand color rule: send `brand_color` as null if user never interacted with picker; only send hex if user explicitly chose
- Show loading, saving, success, and error states
- Show simple visual preview card of (name, segment badge, brand color swatch)
- Client-side validation: name 2-60 chars, segment in VALID_SEGMENTS, brand_color valid hex
- Install and configure Tailwind CSS (dev dependencies + config files + globals.css)
- Follow design system tokens and store-identity page override

**Non-Goals:**
- Logo upload / Supabase Storage
- Multi-page step navigation (`(flow)/layout.tsx`)
- Campaign creation or product input
- Auth, multitenancy, dashboard
- Subsegmentos or schema changes
- New API routes, database changes, or third-party dependencies beyond Tailwind
- Automated unit/integration tests

## Decisions

### Decision 1: Tailwind CSS setup included in scope
- **Choice**: Install `tailwindcss`, `postcss`, `autoprefixer` as dev dependencies; create `tailwind.config.ts` and `postcss.config.mjs`; create `src/app/globals.css` with Tailwind directives and design system CSS custom properties from MASTER.md
- **Rationale**: The Vendeo design system is expressed in Tailwind tokens. Without it, the design rules from MASTER.md have no equivalent in code. This is the single setup cost — no further third-party dependencies beyond this.
- **Alternatives considered**: Skip Tailwind, use plain CSS with the custom properties — but this would drift from the design system conventions and make future phases harder to integrate.

### Decision 2: Client Component with component decomposition
- **Choice**: Split into 4 files instead of putting everything in `page.tsx`:
  - `src/app/page.tsx` — composition only (imports and renders form + preview)
  - `src/components/flow/store-identity-form.tsx` — form markup with field components
  - `src/components/flow/store-preview.tsx` — visual preview card
  - `src/components/flow/use-store-form.ts` — hook with all state logic, API calls, localStorage
- **Rationale**: Keeps each file focused. When step navigation arrives, `page.tsx` is replaced by a flow layout; the other 3 files move unchanged.
- **Alternatives considered**: Monolithic `page.tsx` — simpler now but creates a refactor bottleneck for the integration phase.

### Decision 3: Form state hook with clear rules for optional fields
- **Choice**: The hook tracks whether the user has touched the color picker. If untouched, `brand_color` is sent as `null` even if the picker shows a default. City and state empty strings are normalized to `null` before API calls.
- **Rationale**: Prevents the UI from accidentally making optional fields required. Matches the API contract where `null` means "not provided."
- **Alternatives considered**: Letting the native color picker always emit a value — would require extra logic to distinguish "user chose black" from "user didn't choose anything."

### Decision 3a: Preview color fallback reuses existing foundation map
- **Choice**: The preview component uses `brand_color ?? resolveStoreIdentity(store).color` — which reads the existing fallback map from `src/lib/store.ts`. No duplicate color map is created in UI code.
- **Rationale**: Keeps the fallback logic in a single source of truth. If the fallback map changes, the preview updates automatically without touching UI code.

### Decision 4: Handle invalid/deleted store_id at load
- **Choice**: On page load, if `store_id` exists in localStorage, call `GET /api/store/[id]`. If 404, remove `store_id` from localStorage, set form to create mode, and show a dismissible warning banner: "Loja não encontrada. Cadastre novamente."
- **Rationale**: Prevents the UI from being stuck in edit mode for a nonexistent store. The warning gives the user context for why their data was cleared.
- **Alternatives considered**: Silently switching to create mode — user would wonder why their data disappeared.

### Decision 5: Color picker as native input + hex companion
- **Choice**: Use `<input type="color">` with a companion hex text input for manual entry. Both bound to same state.
- **Rationale**: Native color picker requires no dependencies. Hex input gives power users precise control.
- **Alternatives considered**: Custom color picker library — adds dependency for marginal UX gain at this stage.

### Decision 6: State select constants in shared file
- **Choice**: Add `BRAZILIAN_STATES` to `src/lib/constants.ts` alongside the existing `VALID_SEGMENTS`.
- **Rationale**: Centralizes UI constants in one place. Avoids mixing data constants with hook logic. Easy to reuse if other parts of the app need state selection.

### Decision 7: Error handling with inline + top banner
- **Choice**: Inline field errors (on blur) for field-level validation. API/network errors rendered as a dismissible banner at the top of the form.
- **Rationale**: Follows MASTER.md section 9 (Error States). No toast library needed — a state-driven banner suffices for V1.

### Decision 8: Single submit button for create/update
- **Choice**: One "Salvar" button. Calls `POST` if no `store_id` exists, `PATCH` if editing. Show spinner + "Salvando..." while request is in flight.
- **Rationale**: Simpler UX (one action). The hook determines method based on internal state.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| `localStorage` is ephemeral — cleared on browser data wipe | Documented as MVP mechanism. Auth will replace this. The form is always re-creatable from scratch. |
| No optimistic updates — user waits for API before seeing saved state | Acceptable for V1. Add optimistic UI when latency becomes an issue. |
| Native `<input type="color">` has inconsistent browser rendering | Hex text input companion works on all browsers. Color swatch preview is always accurate. |
| No automated tests for this phase | Manual validation is required before closing: `npm run typecheck`, `npm run lint`, manual create/load/edit/invalid-id flows. |

## Validation Criteria (Manual)

Before closing this phase, verify these manual flows pass:

1. `npm run typecheck` — zero TypeScript errors
2. `npm run lint` — zero lint errors
3. **Criar loja**: Fill all fields, save → HTTP 201 → store_id saved to localStorage → preview updates
4. **Recarregar página**: F5 → form pre-filled with saved store data → preview matches
5. **Editar loja**: Change name, save → PATCH succeeds → reload → changes persist
6. **Store_id inválido**: Manually corrupt localStorage store_id → load → 404 → localStorage cleared → form in create mode with warning banner
7. **Campos opcionais vazios**: Save with empty city/state → API receives null → no validation errors
8. **Cor não selecionada**: Save without touching color picker → brand_color is null in DB (uses segment fallback in preview)
