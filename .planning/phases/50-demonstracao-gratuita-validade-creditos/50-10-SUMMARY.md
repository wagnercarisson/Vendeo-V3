---
phase: 50-demonstracao-gratuita-validade-creditos
plan: 10
subsystem: legal
tags: [legal, terms, privacy, aup, migration, reacceptance]

requires:
  - phase: 50-01
    provides: "baseline + inventário (âncoras de código legais)"
provides:
  - "3 documentos legais consolidados (Termos v1.5, Privacidade v1.4, AUP v1.2) com placeholders marcados"
    - "Template de publicação fora de supabase/migrations; migration efetiva criada/aplicada só no corte 50-14"
  - "Catálogo document-content.ts atualizado + verificação do reaceite/ciência"
affects: [legal-documents, legal-document-versions, privacy-acknowledgement, clearance]

tech-stack:
  added: []
  patterns:
    - "Template legal fora da fila automática; no corte, copiar para supabase/migrations, revisar e aplicar (ON CONFLICT DO UPDATE)"

key-files:
  created:
    - "openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md"
    - "openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/privacy-policy-v1-4.md"
    - "openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/acceptable-use-v1-2.md"
    - "openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-publication-template/20260920000003_f50_legal_publication.sql"
  modified:
    - "src/lib/legal/document-content.ts"
    - "openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-package.md"

key-decisions:
  - "Placeholders [RAZÃO SOCIAL]/[CNPJ]/[ENDEREÇO FÍSICO] permanecem marcados (PJ/validação jurídica = gates de corte 50-14)"
  - "Reaceite contratual (Terms+AUP) via requireLegalClearance; ciência de privacidade via PrivacyGate/privacy_acknowledgements"

patterns-established:
  - "Delta legal (legal-drafts) → consolidação (public/docs/legal) → migration de publicação separada"

requirements-completed: []  # Preparação técnica apenas — a publicação/reaceite efetivos ocorrem no corte (50-14).

duration: 1h 5min
completed: 2026-09-21
---

# Phase 50 Plan 10: Legal (3 documentos + migration de publicação + reaceite) Summary

**Termos v1.5, Privacidade v1.4 e Uso Aceitável v1.2 consolidados a partir das minutas delta + cláusulas inalteradas, com placeholders de identidade e datas marcados; template de publicação fora da fila automática + catálogo atualizado + mecanismo de reaceite/ciência verificado (read-only).**

## Performance

- **Duration:** 1h 5min
- **Started:** 2026-09-21
- **Completed:** 2026-09-21
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- **Termos v1.5**: remove bônus mensais, define Demonstração Gratuita (10 créditos, 168h, irrepetível por raiz), ausência de cobrança, ordem de consumo demo→bônus→comprado, expiração + graça 24h, reaceite obrigatório sem bloquear histórico, identificação do fornecedor (12.4) e conteúdo enviado/imagens de menores.
- **Privacidade v1.4**: identificação da PJ (Controlador e Contato), email operacional × marketing, eventos de produto sem nomes internos, WhatsApp opcional com descarte, papéis controlador/operador, inventário de fornecedores (Gemini condicional/lab) e retenção com janela de 30 dias.
- **Uso Aceitável v1.2**: terminologia "Demonstração Gratuita", proibição de conteúdo ilegal/abusivo/exploratório + imagens de menores sem autorização, reaceite substancial.
- **Template `legal-publication-template/20260920000003_f50_legal_publication.sql`** fora de `supabase/migrations`; no corte 50-14 será copiado para o diretório de migrations somente após preenchimento dos documentos e aprovação jurídica.
- **Catálogo** `document-content.ts` registra v1.5/v1.4/v1.2.
- **Reaceite/ciência verificados** (read-only): Terms+AUP via `requireLegalClearance` (outdated → 403); Privacidade via `PrivacyGate`/`privacy_acknowledgements`; sem bloquear histórico/downloads.

## Task Commits

1. **Tasks 10.1–10.3 (docs + template + catálogo)** - commit `356e5673` (feat)

**Plan metadata:** (commit `docs(50-10)`)

## Files Created/Modified

- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md` — Termos consolidados pendentes, não públicos.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/privacy-policy-v1-4.md` — Privacidade consolidada pendente, não pública.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/acceptable-use-v1-2.md` — Uso Aceitável consolidado pendente, não público.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-publication-template/20260920000003_f50_legal_publication.sql` — template fora da fila automática.
- `src/lib/legal/document-content.ts` — catálogo + v1.5/v1.4/v1.2.
- `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-package.md` — estados "pronto (consolidado)" + mecanismo de reaceite.

## Decisions Made

- Nenhuma decisão de produto além do plano; placeholders de identidade permanecem (gates de corte 50-14).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Pacote jurídico pronto para revisão preliminar do advogado; publicação/reaceite efetivos no corte (50-14).
- Próximo plano (wave 2): **50-15 (Storage privacy)** ou **50-17 (Backup/gates)**.

---
*Phase: 50-demonstracao-gratuita-validade-creditos*
*Completed: 2026-09-21*
