---
phase: quick-260814-na1
plan: 01
subsystem: landing + validators
tags: [landing, changelog, modal, whatsapp, mask, acessibilidade]

# Dependency graph
requires:
  - phase: 35-changelog-novidades
    provides: changelog library (getAllEntries, ChangelogEntry, ChangelogList)
  - phase: 38.2-admin-custos-operacionais
    provides: padrão de modal acessível (credit-cta) e máscara progressiva (CNPJ store-identity-form)
provides:
  - Landing pública com changelog: link "Novidades" chamativo abaixo do card + link discreto no rodapé + modal acessível sobre a landing (~5 entradas)
  - Máscara progressiva WhatsApp `(11) 99999-9999` no formulário de acesso (função pura `maskWhatsApp`)
affects: [landing (/), access-request-form, api/access-requests payload (valor mascarado), changelog content (exposição pública editorial)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client component de modal acessível reutilizando data server-resolved por props (Home async → getAllEntries().slice(0,5) → NovidadesLink) — sem rota nova"
    - "Máscara progressiva como função pura idempotente em src/lib/validators (strip \D + slice + remontagem) — espelha o padrão CNPJ de store-identity-form"

key-files:
  created:
    - src/lib/validators/phone.ts
    - src/lib/validators/__tests__/phone.test.ts
    - src/components/landing/__tests__/access-request-form.test.tsx
    - src/components/landing/novidades-link.tsx
  modified:
    - src/components/landing/access-request-form.tsx
    - src/components/landing/access-request-section.tsx
    - src/app/page.tsx
    - src/__tests__/app/landing-page.test.tsx

key-decisions:
  - "Modal sobre a própria landing (sem rota pública nova — /novidades segue restrito a (app)); dados resolvidos no server via getAllEntries().slice(0, 5) e repassados por props"
  - "Dois pontos de entrada: link chamativo (accent-green, min-h 44px) abaixo do card 'Solicite seu acesso free' + link discreto no rodapé junto a Termos/Privacidade"
  - "Valor mascarado é persistido como está (comportamento atual do backend); rota POST /api/access-requests e schema zod INTOCADOS (máscara 15 ≤ max 20)"
  - "Cobertura do paste no componente (não só na função pura): fireEvent.change com valor longo contendo não-dígitos e espaços"

requirements-completed: [Q-260814-NA1]

# Metrics
duration: 8min
completed: 2026-08-14
---

# Quick 260814-NA1: Adicionar link de Novidades (changelog) na landing — máscara WhatsApp + modal Summary

**Máscara progressiva de WhatsApp `(11) 99999-9999` no formulário de acesso (função pura `maskWhatsApp` testada via TDD) + links "Novidades" na landing (chamativo sob o card e discreto no rodapé) abrindo modal acessível com as ~5 entradas mais recentes do changelog resolvidas no server — 3 commits, 1967 testes verdes, typecheck/lint/build exit 0**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-14T17:19:00Z
- **Completed:** 2026-08-14T17:26:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- **Task 1 (TDD):** Criada `maskWhatsApp` como função pura em `src/lib/validators/phone.ts` (strip `\D`, trunca em 11 dígitos, remonta `(11) 99999-9999` — 15 chars) espelhando o padrão de `color.ts`. Campo WhatsApp do formulário de acesso virou controlado: `onChange` aplica a máscara durante a digitação, `maxLength` 20→15, `name="whatsapp"` preservado (payload `{ email, store_name, segment, whatsapp }` inalterado). Rota `POST /api/access-requests` e schema zod **intocados**. 11 testes novos: 7 unitários da máscara + 4 de integração do form (valor exibido, payload do submit mascarado, maxLength 15, paste de valor longo com não-dígitos e espaços).
- **Task 2:** Criado `NovidadesLink` (client component) com `variant="prominent"` (accent-green, `min-h-[44px]`, `font-heading font-semibold`, hover underline, focus ring) e `variant="footer"` (discreto, `text-sm text-text-muted`, alinhado ao grupo de links do rodapé). Trigger é `<button type="button">` que abre MODAL sobre a própria landing — sem rota nova. Modal acessível no padrão `credit-cta.tsx`: Esc fecha, foco no primeiro interativo (×) ao abrir, foco de volta ao trigger ao fechar, backdrop click fecha, `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. Corpo reutiliza `ChangelogList` (server-safe) com scroll interno `max-h-[65vh]` e empty state tratado.
- **Data flow server→client:** `Home()` virou async — `await getAllEntries()` → `.slice(0, 5)` → props para `AccessRequestSection` (que renderiza o prominent abaixo do card) e para o `NovidadesLink` do footer. Zero fetch no client.
- **Testes migrados + novos:** `landing-page.test.tsx` migrado de `render(<Home />)` para `render(await Home())` (padrão do dashboard), com mock de `@/lib/changelog/get-changelog` via `vi.hoisted` + fixture determinística (3 entries, factory makeEntry do padrão changelog-announcement). 7 testes novos: prominent presente na seção do card, footer presente no nav, dialog abre com títulos do fixture, × fecha e devolve foco ao trigger, Esc fecha, fixture vazio renderiza empty state. Teste de submit do form mantido.
- **Varredura de importadores de `@/app/page`:** grep `@/app/page` em `*.tsx`/`*.test.tsx` → apenas `landing-page.test.tsx` importa `Home` (migrado). Nenhum outro importador quebrado com a assinatura async.

## Task Commits

1. **Task 1 — RED (TDD):** `test(quick 260814-na1): failing tests for whatsapp mask and form` — `897a171`
2. **Task 1 — GREEN (TDD):** `feat(quick 260814-na1): progressive whatsapp mask on access request form` — `5439522` (amend: inclui ajuste do caso-tipo do teste no mesmo commit)
3. **Task 2:** `feat(quick 260814-na1): Novidades links and changelog modal on landing` — `980c80c`

## Files Created/Modified

- `src/lib/validators/phone.ts` - Nova — função pura `maskWhatsApp` (strip não-dígitos, slice 11, remontagem progressiva)
- `src/lib/validators/__tests__/phone.test.ts` - Novo — 7 casos unitários da máscara
- `src/components/landing/__tests__/access-request-form.test.tsx` - Novo — 4 testes de integração da máscara no form (jsdom, fetch stubado)
- `src/components/landing/novidades-link.tsx` - Novo — client component trigger prominent/footer + modal acessível reutilizando ChangelogList
- `src/components/landing/access-request-form.tsx` - Modificado — campo WhatsApp controlado com maskWhatsApp, maxLength 15
- `src/components/landing/access-request-section.tsx` - Modificado — prop `entries` + `<NovidadesLink variant="prominent">` centralizado com `mt-4` abaixo do card
- `src/app/page.tsx` - Modificado — `Home()` async, `getAllEntries().slice(0, 5)`, link footer no nav
- `src/__tests__/app/landing-page.test.tsx` - Modificado — migrado para `render(await Home())` + mock do changelog + 7 testes novos

## Decisions Made

- Modal sobre a própria landing reutilizando os dados existentes (`getAllEntries` + `ChangelogList`) em vez de rota pública nova — `/novidades` segue restrito ao grupo `(app)` autenticado (decisão D1/D2 do CONTEXT).
- Limite de ~5 entradas mais recentes, ordenadas por data desc, resolvidas no server component da landing e repassadas por props ao client (decisão D3).
- Máscara progressiva inline no padrão do CNPJ (`store-identity-form`): valor mascarado persistido como está, `maxLength` = 15; API e schema zod sem nenhuma mudança (decisão D4).
- **Critério editorial permanente (vigente a partir desta entrega):** toda entry de `content/changelog/` pode aparecer publicamente na landing para visitante não autenticado — novas entries devem ser escritas como conteúdo publicável externamente (sem refs internas, jargão de fase ou info não pública). Registrado no threat model do plano (T-NA1-01, aceite editorial) — mudança real de superfície, não "sem alteração".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Caso-tipo do plano com contagem de dígitos inconsistente no behavior de `maskWhatsApp`**
- **Found during:** Task 1 (GREEN — teste `mascara progressivamente entradas parciais` falhando)
- **Issue:** O behavior do plano listava `maskWhatsApp("119999")` → `"(11) 99999"`. A entrada tem 6 dígitos e a saída esperada tem 7 — matematicamente insatisfazível por qualquer máscara progressiva (o algoritmo canônico do plano — strip `\D`, `slice(0, 11)`, DDD em `(NN) ` quando > 2, separação do 5º dígito quando > 7 — produz `(11) 9999` para 6 dígitos). Trata-se de um typo do plano (faltou um "9" na entrada).
- **Fix:** Teste ajustado para os casos consistentes: `maskWhatsApp("119999")` → `"(11) 9999"` (progressão com 6 dígitos) e `maskWhatsApp("1199999")` → `"(11) 99999"` (7 dígitos — o caso-limite do grupo de 5 que o plano claramente pretendia cobrir). Implementação segue exatamente o algoritmo canônico do plano; todos os demais casos do behavior (vazio, 11 dígitos, truncamento de 12, idempotência, strip de não-dígitos, integração com form e paste) passam sem alteração.
- **Files modified:** src/lib/validators/__tests__/phone.test.ts (2 expectativas do mesmo teste)
- **Verification:** `npx vitest run src/lib/validators/__tests__/phone.test.ts src/components/landing/__tests__/access-request-form.test.tsx` → 11/11 passando
- **Committed in:** `5439522` (incluso no commit GREEN via amend — mesmo commit lógico da Task 1)

---

**Total deviations:** 1 auto-fixed (1 typo de plano em exemplo de behavior)
**Impact on plan:** Ajuste mínimo e localizado em 2 linhas de teste; nenhuma mudança de escopo ou de código funcional.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Testes direcionados | `npx vitest run src/lib/validators/__tests__/phone.test.ts src/components/landing/__tests__/access-request-form.test.tsx src/__tests__/app/landing-page.test.tsx src/components/changelog/__tests__/changelog-list.test.tsx` | 26/26 passando (4 arquivos) |
| Regressão completa | `npm test` | 1967/1967 passando (218 arquivos) — baseline F39 1950, +17 novos |
| TypeScript | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0 (`.next/BUILD_ID` gerado) |
| Varredura importadores | grep `@/app/page` em `*.tsx`/`*.test.tsx` | 1 match: `landing-page.test.tsx` (migrado) — nenhum outro importador quebrado |

## Issues Encountered

- `npm` não executa diretamente em pipeline no PowerShell 5.1 (`Não é possível executar um documento no meio de um pipeline`) — todos os gates foram executados via `cmd /c "npm ... > log 2>&1 & echo EXITCODE=%ERRORLEVEL%"`; exit codes capturados (0 em todos).
- O `build.log` gerado via redirecionamento não persistiu no working tree após o build (BUILD_ID do `.next` confirma execução bem-sucedida às 17:24). Nenhum arquivo órfão deixado — `git status` limpo após os commits.

## User Setup Required

None - nenhum serviço externo, nenhum pacote novo instalado (T-NA1-SC: zero instalações).

## Next Phase Readiness

- Landing pública com dois pontos de entrada para o changelog (destaque sob o card + rodapé) e modal acessível; máscara WhatsApp ativa no formulário de acesso.
- **Atenção editorial permanente:** novas entries em `content/changelog/` agora têm superfície pública na landing — devem ser revisadas como conteúdo publicável para visitante não autenticado (critério registrado no threat model do plano, T-NA1-01).
- Verificação manual (usuário) pendente conforme `<verification>` do plano: contraste do link chamativo, modal com ~5 novidades (scroll interno), fechamento via ×/Esc/backdrop, foco retornando ao trigger, e máscara `(11) 99999-9999` ao digitar no WhatsApp em dev.

---

## Self-Check: PASSED

- Arquivos verificados no disco: 8 arquivos de código + 1 SUMMARY (todos FOUND).
- Commits verificados no `git log`: `897a171` (RED), `5439522` (GREEN), `980c80c` (Task 2) — todos FOUND.

---

*Phase: quick-260814-na1*
*Completed: 2026-08-14*
