# Plan 33-03 — Store Identity Form + Dashboard Banners

**Status:** ✅ Complete
**Wave:** 2

## Deliverables

- CNPJ onBlur triggers GET /api/cnpj/lookup (after digit validation)
- Lookup status display: loading spinner, resolved (green check), not found (red), unavailable (amber)
- Razão social and nome fantasia locked (read-only) after successful lookup
- "Usar nome fantasia" / "Usar razão social" shortcut buttons
- Address fields pre-filled from official data (still editable)
- Tooltip on CNPJ field explaining verification purpose
- Dashboard: yellow banner for review, green one-time dismissible banner for approved

**Tests:** 7 banner logic tests
