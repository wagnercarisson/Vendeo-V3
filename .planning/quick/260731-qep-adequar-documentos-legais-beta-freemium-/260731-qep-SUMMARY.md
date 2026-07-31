---
phase: quick-qep
plan: 01
subsystem: legal
tags: [legal, terms-of-service, privacy-policy, acceptable-use, supabase, migration, beta-freemium]

requires:
  - phase: 30-legal-foundation
    provides: legal document versions infra, public pages, acceptance flow, DOCUMENT_CATALOG
provides:
  - "Termos de Uso v1.3 (beta freemium: créditos promocionais, funcionalidades futuras, raiz de CNPJ)"
  - "Política de Privacidade v1.2 (suboperadores por categoria, provedores de IA, transferência internacional, senha com hash)"
  - "Política de Uso Aceitável v1.1 (publicidade enganosa, estoque, de/por, categorias sensíveis)"
  - "Publicação das 3 versões em legal_document_versions (migration idempotente, effective_at now())"
  - "Remoção do aviso de draft de 6 markdowns públicos + 3 páginas de marketing"
  - "Microcopy de revisão pré-publicação nas telas de campanha"
affects: [fase-36-stripe, admin-legal-badges, legal-reaccept]

tech-stack:
  added: []
  patterns:
    - "DOCUMENT_CATALOG filePath mapping document_type+version -> markdown file"
    - "Migration INSERT ... ON CONFLICT DO UPDATE com bloco -- REVERT comentado"
    - "Cavê de revisão jurídica apenas em artefato .planning, nunca em código/banco/migrations"

key-files:
  created:
    - public/docs/legal/terms-of-service-v1-3.md
    - public/docs/legal/privacy-policy-v1-2.md
    - public/docs/legal/acceptable-use-v1-1.md
    - supabase/migrations/20260731000001_publish_legal_beta_freemium_versions.sql
    - .planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/legal-review-notes.md
  modified:
    - public/docs/legal/terms-of-service-v1.md
    - public/docs/legal/terms-of-service-v1-1.md
    - public/docs/legal/terms-of-service-v1-2.md
    - public/docs/legal/privacy-policy-v1.md
    - public/docs/legal/privacy-policy-v1-1.md
    - public/docs/legal/acceptable-use-v1.md
    - src/app/(marketing)/termos/page.tsx
    - src/app/(marketing)/privacidade/page.tsx
    - src/app/(marketing)/uso-aceitavel/page.tsx
    - src/lib/legal/document-content.ts
    - src/components/flow/campaign-input-form.tsx
    - src/app/(app)/campanhas/[id]/client.tsx

key-decisions:
  - "D1: cavê de revisão jurídica apenas em .planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/legal-review-notes.md, nunca em migration/código"
  - "D2: AUP v1.1 criada agora, aproveitando o ciclo de re-aceite dos Termos v1.3"
  - "D3: microcopy em campaign-input-form.tsx (perto de Criar Campanha) e campanhas/[id]/client.tsx (perto de Baixar Original)"
  - "D4: aviso de draft removido dos 6 markdowns + 3 páginas marketing"
  - "D5: effective_at = now() para as 3 novas versões"
  - "D6: citar por nome apenas Supabase, Vercel, OpenAI; categorias genéricas para email/observabilidade/IA; Anthropic e Resend não citados"

requirements-completed: [A, B, C, D, E, F, G]

duration: 47min
completed: 2026-07-31
---

# Quick Task 260731-qep: Adequar Documentação Legal para Beta Freemium — Summary

**Documentação legal pública adequada ao beta freemium: Termos de Uso v1.3, Política de Privacidade v1.2 e Política de Uso Aceitável v1.1 criadas e publicadas via migration idempotente, aviso de draft removido de todos os documentos e páginas públicas, e microcopy de revisão pré-publicação adicionada às telas de campanha.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-07-31T19:05:00Z
- **Completed:** 2026-07-31T19:52:00Z
- **Tasks:** 8/8 (waves 1-3)
- **Files modified:** 17 (9 editados + 5 criados, 3 páginas JSX)

## Accomplishments

- **Termos de Uso v1.3 (C1-C8 + G):** créditos como unidade interna/promocional do beta; "não é moeda, não é transferível, não gera resgate, não representa saldo financeiro"; consumo apenas após conclusão técnica; recreditamento por falha; raiz de CNPJ como critério técnico de elegibilidade promocional/antifraude (sem "grupo econômico"); declaração de autorização para cadastrar loja; responsabilidade do lojista; revisão obrigatória de campanhas geradas por IA; seção 8 substituída por "Funcionalidades Futuras" (sem cobrança no beta)
- **Política de Privacidade v1.2 (D1-D6):** suboperadores por categoria citando apenas provedores confirmados (Supabase, Vercel, OpenAI) + categorias genéricas (provedores de IA configurados pela Plataforma, email transacional, observabilidade/analytics); envio a provedores de IA; transferência internacional (LGPD art. 33); senha com hash (Vendeo nunca acessa texto claro); CNPJ tecnicamente correto (MEI/sócios/responsáveis); incidentes de segurança; cobrança/nota fiscal como finalidade futura
- **Política de Uso Aceitável v1.1:** publicidade enganosa, promoções sem estoque, "de/por" sem preço anterior real (CONAR), reforço de autorização de marcas/imagens, seção de categorias sensíveis (saúde, suplementos, bebidas, financeiro, falsificados, política/eleitoral, menores)
- **Aviso de draft removido** dos 6 markdowns públicos e do blockquote hardcoded nas 3 páginas de marketing (decisões A/D4)
- **DOCUMENT_CATALOG** atualizado com as 3 novas versões (v1.3 terms, v1.2 privacy, v1.1 acceptable_use)
- **Migration idempotente** `20260731000001_publish_legal_beta_freemium_versions.sql` publica as 3 versões com `effective_at = now()` (D5), sem qualquer comentário de revisão jurídica (D1)
- **Artefato interno** `legal-review-notes.md` com R1-R13 (D1) — nunca servido publicamente
- **Microcopy discreta** (D3, texto aprovado, ASCII sem em dash) em `campaign-input-form.tsx` (perto de "Criar Campanha") e `campanhas/[id]/client.tsx` (perto de "Baixar Original") — passiva, sem modal/checkbox (F)

## Task Commits

Cada tarefa foi commitada atomicamente:

1. **Task 1: Remover aviso de draft (6 markdowns + 3 páginas)** — `fa39434` (docs)
2. **Task 2: Termos de Uso v1.3** — `6ededdb` (docs)
3. **Task 3: Política de Privacidade v1.2** — `33113f3` (docs)
4. **Task 4: Política de Uso Aceitável v1.1** — `c9b946b` (docs)
5. **Task 5: Microcopy nas telas de campanha** — `7045c66` (feat)
6. **Task 6: DOCUMENT_CATALOG atualizado** — `49f13d6` (feat)
7. **Task 7: Migration de publicação + legal-review-notes.md** — `020e197` (chore; notes.md não commitado — orquestrador gerencia .planning)
8. **Task 8: Validação completa** — sem arquivos alterados (verificação)

## Files Created/Modified

- `public/docs/legal/terms-of-service-v1-3.md` — Termos v1.3 beta freemium (novo)
- `public/docs/legal/privacy-policy-v1-2.md` — Privacidade v1.2 com suboperadores e IA (novo)
- `public/docs/legal/acceptable-use-v1-1.md` — AUP v1.1 compliance comercial (novo)
- `supabase/migrations/20260731000001_publish_legal_beta_freemium_versions.sql` — publicação das 3 versões (novo)
- `.planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/legal-review-notes.md` — R1-R13, uso interno (novo, não commitado)
- `public/docs/legal/{terms-of-service-v1,terms-of-service-v1-1,terms-of-service-v1-2,privacy-policy-v1,privacy-policy-v1-1,acceptable-use-v1}.md` — linha 6 (aviso de draft) removida
- `src/app/(marketing)/{termos,privacidade,uso-aceitavel}/page.tsx` — blockquote de aviso removido
- `src/lib/legal/document-content.ts` — DOCUMENT_CATALOG + v1.3/v1.2/v1.1
- `src/components/flow/campaign-input-form.tsx` — microcopy perto de "Criar Campanha"
- `src/app/(app)/campanhas/[id]/client.tsx` — microcopy perto de "Baixar Original"

## Validation Results

### 5.1 Automática

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ sem erros (exit 0) |
| `npm run lint` | ✅ sem erros (exit 0) |
| `npm run build` | ✅ build completo, 49 páginas estáticas geradas (exit 0) |
| `npm test` | ✅ 1346 passed (170 files) — base sem regressão |
| `npx vitest run src/lib/legal` | ✅ 26 passed (6 files) — document-versions, acceptance-service, privacy, clearance, integration |

### 5.2 Grep gates

| Checagem | Resultado |
|----------|-----------|
| Sem "Aviso importante" em `public/docs/legal/` | ✅ 0 |
| Sem "draft preparado" em `public/docs/legal/` | ✅ 0 |
| Sem "Aviso importante" em `src/app/(marketing)/` | ✅ 0 |
| Sem "draft preparado" em `src/app/(marketing)/` | ✅ 0 |
| Sem "grupo econômico" em terms v1.3 + privacy v1.2 | ✅ 0 |
| Sem "Anthropic" / "Resend" na privacy v1.2 | ✅ 0 / 0 |
| Catálogo tem v1.3 / v1.2 / v1.1 | ✅ entradas presentes nos tipos corretos |
| Migration publica 3 versões | ✅ 3 linhas INSERT + 3 no REVERT |
| Migration sem cavê jurídico (jurídic/advogad/draft) | ✅ 0 |

### 5.3 Manual/visual — pendente de validação humana

Os passos 1-9 (renderização de `/termos`, `/privacidade`, `/uso-aceitavel`, fluxo de re-aceite, ciência de privacidade, novo signup, microcopy visível, legibilidade mobile) exigem ambiente em execução com Supabase e uma conta de lojista. Não executáveis em executor automatizado; as verdades estáticas correspondentes foram validadas por grep/build (páginas `/termos`, `/privacidade`, `/uso-aceitavel` prerenderizadas como estáticas no build, todas sem aviso).

## Decisions Made

- Todas as decisões D1-D7 do plano executadas conforme aprovado pelo usuário em 2026-07-31 (ver Seção 3 do plano e frontmatter key-decisions)

## Deviations from Plan

Nenhuma decisão de arquitetura divergiu do plano. Duas notas de interpretação de gates, sem mudança de artefato:

1. **Gate `rg -n "Versão: v1.3"`** — o padrão literal não casa com o cabeçalho exigido pelo próprio plano (`**Versão:** v1.3`, estrutura padrão dos documentos legais existentes). Verificado com o padrão equivalente `Versão:.*v1.3`, que casa com a linha 3 dos 3 novos documentos.
2. **Gate "migration publica 3 versões" (esperava 3 linhas)** — a migration contém 6 ocorrências de `'v1.3'|'v1.2'|'v1.1'`: 3 no INSERT (as publicações reais) + 3 no bloco `-- REVERT` obrigatório, mesmo padrão da migration de referência `20260724000003` (onde `'v1.1'` aparece 2x: INSERT + REVERT). Intento do gate (3 versões publicadas) satisfeito.

**Total de deviations:** 0 (sem auto-fixes de bugs/segurança necessários)
**Impact on plan:** nenhum — apenas ajustes de interpretação de gates de verificação.

## Known Stubs

Nenhum stub identificado nos arquivos criados/modificados. As 3 novas versões estão totalmente preenchidas; a tabela de suboperadores da privacidade usa categorias genéricas intencionais (decisão D6) e "A ser definido" para pagamento/emissão fiscal (futuro, explicitamente declarado como funcionalidade futura — F36).

## Threat Flags

Nenhum — as mudanças são conteúdo documental público, catálogo de conteúdo e migration idempotente de dados; nenhum endpoint, caminho de auth ou padrão de acesso a arquivo novo foi introduzido fora do `<threat_model>` do plano.

## Issues Encountered

- `npm` no PATH do PowerShell resolve para um shim quebrado (`C:\WINDOWS\system32\npm`) que falha em pipelines; contornado usando `npm.cmd` explicitamente. Nenhum impacto no código.
- Aviso de lint do Next.js "Next.js plugin was not detected in your ESLint configuration" durante o build — pré-existente, não relacionado a esta mudança, sem impacto no exit code.

## Next Phase Readiness

- Documentos legais prontos para o beta freemium; `acceptance-service` detectará automaticamente `outdated` para re-aceite dos beta testers (fluxo existente, sem mudança de código — atende B)
- F36 (Stripe/monetização pública) exigirá nova versão dos Termos + política comercial própria (R6/R13), e atualização da seção de pagamento/emissão fiscal da privacidade v1.2
- Roteiro manual 5.3 pendente de validação humana com ambiente em execução

---
*Phase: quick-qep (260731-qep-adequar-documentos-legais-beta-freemium-)*
*Completed: 2026-07-31*

## Self-Check: PASSED

- Todos os arquivos criados verificados (6/6 FOUND)
- Todos os commits verificados no git log (7/7 FOUND)
- Grep gates 5.2: 9/9 PASS
- typecheck/lint/build/testes: todos exit 0
