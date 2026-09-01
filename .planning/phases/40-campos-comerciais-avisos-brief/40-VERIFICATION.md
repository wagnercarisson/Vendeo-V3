# Phase 40: Campos Comerciais e Avisos do Brief — Verification

**Verificado em:** 2026-08-14
**Fonte da verdade:** `openspec/changes/fase-40-campos-comerciais-avisos-brief/`
**Context:** `.planning/phases/40-campos-comerciais-avisos-brief/40-CONTEXT.md`

---

## 1. Gates Automáticos

| Gate | Comando | Exit | Evidência |
|------|---------|------|-----------|
| Testes | `npx vitest run` | 0 | **221 files / 1997 tests passed** (F39 base: 1950 → +47 na F40) |
| Typecheck | `npm run typecheck` (`tsc -p tsconfig.typecheck.json --noEmit`) | 0 | Sem erros |
| Lint | `npm run lint` (`eslint .`) | 0 | Sem erros |
| Build | `npm run build` (`next build`) | 0 | "Compiled successfully in 8.1s"; rotas pré-renderizadas OK |

## 2. Matriz Planos × Gates

| Plan | O que construiu | Testes associados | Typecheck | Lint |
|------|-----------------|-------------------|-----------|------|
| 40-01 | Verificação D1 (trackings F40/F41, zero resíduos) | grep (não-vitest) | ✓ | ✓ |
| 40-02 | `constants.ts` + `IllustrativeNoticeField` + placeholder | `brief.test.ts` 21/21 | ✓ | ✓ |
| 40-03 | Reframe dos 4 prompts (hardcode → bloco condicional) | `prompt-reframe.test.ts` (40-07) | ✓ | ✓ |
| 40-04 | Form state + helpers + body assembly + migração legada | `use-campaign-form-navigation.test.ts` 5/5 | ✓ | ✓ |
| 40-05 | `ValidityField` + seções D8 + wiring | `campaign-flow-credits.test.tsx` 3/3 | ✓ | ✓ |
| 40-06 | Testes 1-8 validade + 9-15 aviso + 8.8 brief | 43/43 (3 arquivos) | ✓ | ✓ |
| 40-07 | Testes 16-21 + fixtures co-migradas | 49/49 (3 arquivos) | ✓ | ✓ |
| 40-08 | route fixtures + regressão completa | 1997/1997 (221 files) | ✓ | ✓ |

## 3. Matriz de Cobertura F40-01..F40-18

| Requisito | Cobertura (plano/teste) |
|-----------|-------------------------|
| F40-01 Checkbox controle real default marcado | 40-02 (`IllustrativeNoticeField`), 40-04 (EMPTY_FIELDS `showIllustrativeNotice: true`), 40-06 Teste 13 |
| F40-02 Constante única singular + placeholders/fixtures | 40-02 (`constants.ts`), 40-06 Teste 14 (zero divergência), 40-07/40-08 (fixtures co-migradas) |
| F40-03 Form state separado checkbox/texto | 40-04 (6 campos novos), 40-06 Testes 9-15 |
| F40-04 Transporte normalizado (concatenação) | 40-04 (body), 40-06 Testes 9-12 |
| F40-05 Validade 6 modos → displayText dd/mm | 40-04 (`buildValidityDisplayText`), 40-06 Testes 1-7 |
| F40-06 displayText nu sem prefixo | 40-04 (helper), 40-06 Testes 2-7, 40-07 check A |
| F40-07 validity só para offer; troca preserva | 40-04 (gate no body), 40-06 Teste 8 + bônus D4 |
| F40-08 Custom normaliza prefixo | 40-04 (helper), 40-06 Teste 7 |
| F40-09 UI agrupada Produto/Oferta/Avisos | 40-05 (3 seções D8) |
| F40-10 Seção validade só offer (ValidityField) | 40-05 (condicional `campaignIntent === "offer"`) |
| F40-11 4 prompts sem instrução SEMPRE | 40-03 (reframe), 40-07 Teste 16 |
| F40-12 Linha condicional {{mandatoryArtworkText}} mantida | 40-03, 40-07 Teste 17 |
| F40-13 Golden EXPECTED_KEYS = 38 | 40-07 Teste 20 (38 keys com novos campos) |
| F40-14 legalNotice.enabled=false → vazio | 40-07 Teste 18 (prompt-side) + blocos revisor (:225-240, :252-260) |
| F40-15 Testes (~21+ novos) | 40-06 (1-15 + 8.8), 40-07 (16-21) |
| F40-16 Mocks co-migrados | 40-04 (nav test), 40-05 (credits test) |
| F40-17 Trackings D1 | 40-01 (grep-verificação) |
| F40-18 Verificação + UAT | 40-09 (este documento + `40-UAT.md`) |

## 4. Contagens

- **Testes:** 1997 passing (221 arquivos) — +47 vs F39 (1950)
- **Arquivos novos na F40:** `src/lib/campaign/constants.ts`, `src/components/campaign/illustrative-notice-field.tsx`, `src/components/campaign/validity-field.tsx`, `src/lib/campaign/__tests__/prompt-reframe.test.ts`, `src/components/flow/__tests__/use-campaign-form-validity.test.ts`, `src/components/flow/__tests__/use-campaign-form-notice.test.ts`
- **Migrations SQL:** nenhuma (D9 — snapshot `campaign_brief_v1` tolerante via `jsonb`)
- **Strings plurais divergentes em `src/`:** 0 (únicas ocorrências de "Imagens meramente ilustrativas" são asserts negativos `not.toContain` dos testes 14/16)

## 5. Pendências

- **UAT humana** — roteiro no `40-UAT.md`, aguardando validação manual (checkpoint)
