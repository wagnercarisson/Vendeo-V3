> **Propósito**: Drafts dos 3 documentos legais (Termos de Uso, Política de Privacidade, Uso Aceitável) + páginas públicas versionadas.

## Requirements

### Requirement: Legal document drafts

The system SHALL include three draft legal documents in `public/docs/legal/`:
- `terms-of-service-v1.md` — Termos de Uso v1.0 (inclui Política de Uso Aceitável por referência)
- `privacy-policy-v1.md` — Política de Privacidade v1.0 com bases legais LGPD mapeadas
- `acceptable-use-v1.md` — Política de Uso Aceitável v1.0 com restrições de conteúdo e conduta proibida

Each document SHALL include the following disclaimer:
> "Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar."

#### Scenario: All three draft documents exist

- **WHEN** reviewing `public/docs/legal/`
- **THEN** `terms-of-service-v1.md`, `privacy-policy-v1.md`, and `acceptable-use-v1.md` SHALL exist

#### Scenario: Each document contains the legal disclaimer

- **WHEN** reading any draft document
- **THEN** the document SHALL contain the ressalva about pending legal review

### Requirement: Public legal pages

The system SHALL render three public-facing legal pages outside the `(app)` auth-gated layout:

| Route | Document | Source |
|-------|----------|--------|
| `/termos` | Termos de Uso | `src/app/(marketing)/termos/page.tsx` |
| `/privacidade` | Política de Privacidade | `src/app/(marketing)/privacidade/page.tsx` |
| `/uso-aceitavel` | Política de Uso Aceitável | `src/app/(marketing)/uso-aceitavel/page.tsx` |

Each page SHALL:
- Be publicly accessible (no auth required)
- Render the full document content formatted for readability
- Display the current version number and effective date
- Include the legal disclaimer notice

#### Scenario: Public legal pages are accessible

- **WHEN** an unauthenticated user accesses `/termos`, `/privacidade`, or `/uso-aceitavel`
- **THEN** the page SHALL render the full document content

#### Scenario: Legal pages are free from middleware auth

- **WHEN** middleware processes requests to `/termos`, `/privacidade`, `/uso-aceitavel`
- **THEN** these routes SHALL pass without auth requirement
