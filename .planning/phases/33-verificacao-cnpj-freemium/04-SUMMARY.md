# Plan 33-04 — Admin Reviews + Test Stores + Privacy

**Status:** ✅ Complete
**Wave:** 3

## Deliverables

- **/admin/reviews** page with tabs (Pendentes/Adiados/Recusados/Aprovados)
- **6 admin API endpoints**: list, detail, approve, reject, exception, reveal-cnpj
- **Test store creation**: /api/admin/stores/create-test + form page
- Admin layout: "Revisão" nav link added
- /admin/users: verification_status column + filter
- /admin/users/[id]: verification card with status, official data, reveal CNPJ button
- Privacy policy v1.1 confirmed sufficient (external CNPJ query fits existing LGPD legitimate interest)
- Audit trail: approve/reject/exception within RPCs, reveal-cnpj in endpoint

**Tests:** 7 admin tests (4 reviews list + 3 test store)
