---
phase: quick-kqo
plan: 01
subsystem: image-generation
tags: [prompts, image-director, aviso-ilustrativo, semantica, vitest]

# Dependency graph
requires:
  - phase: 40-campos-comerciais-avisos-brief
    provides: "Constante única ILLUSTRATIVE_NOTICE_TEXT (constants.ts), checkbox IllustrativeNoticeField e bloco condicional do aviso nos prompts do diretor"
provides:
  - "Split determinístico server-side splitDirectorLegalText (montagem das variáveis do diretor): aviso fixo 'Imagem meramente ilustrativa' separado do texto obrigatório livre do lojista — mandatoryArtworkText (só texto livre) + illustrativeNotice (constante canônica ou vazio), sempre presentes no mapa"
  - "4 prompts do diretor com linha de tabela 'Aviso ilustrativo' {{illustrativeNotice}} e instrução curta (texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais); literal canônico removido dos .md (fonte única)"
affects: [F44, revisao-brief-pre-geracao]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separação semântica por prefixo determinístico da constante canônica no ÚNICO ponto de montagem das variáveis (buildPromptVariables) — sem nova superfície de input, sem regex/IA, sem inchaço nos prompts"
    - "Chave nova sempre presente no mapa de variáveis (valor vazio quando ausente) para PromptLoader/validatePrompts continuarem fail-fast"
    - "Literal canônico testado como AUSENTE nos arquivos de prompt (not.toContain) + placeholder presente — fonte única da constante em constants.ts"

key-files:
  created: []
  modified:
    - src/lib/image-generation/services/image-generation-service.ts
    - prompts/campaign-image-director.md
    - prompts/campaign-image-director-offer.md
    - prompts/campaign-image-director-spotlight.md
    - prompts/campaign-image-director-exclusive.md
    - src/lib/image-generation/services/__tests__/image-generation-service.test.ts
    - src/lib/campaign/__tests__/prompt-reframe.test.ts

key-decisions:
  - "Aprovado pelo usuário: chave nova illustrativeNotice no diretor + golden 38 → 39 keys"
  - "Wording enxuto aprovado: 'Quando houver aviso ilustrativo, exiba \"{{illustrativeNotice}}\" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.' — placeholder no lugar do literal (fonte única preservada; .md sem hardcode)"
  - "Frase do campo 'Texto obrigatório na arte' ({{mandatoryArtworkText}}) mantida byte a byte — sem expansão de regra (Amendment 2)"
  - "UI, contrato HTTP, schema público, snapshot/domínio (legalNotice.text integral) e revisor de imagem intocados — split acontece SOMENTE na montagem das variáveis do diretor"

patterns-established:
  - "Split de aviso fixo × texto livre em função pura de prefixo no ponto de montagem do diretor (splitDirectorLegalText), preservando o texto integral concatenado para UI/revisor/snapshot"

requirements-completed: [KQO-DIRECTOR-SPLIT, KQO-PROMPT-SEMANTIC, KQO-NO-UI-REGRESSION]

# Metrics
duration: ~20min
completed: 2026-09-02
---

# Quick 260902-kqo — Aviso ilustrativo separado no diretor Summary

**Split determinístico server-side (splitDirectorLegalText) que separa o aviso fixo "Imagem meramente ilustrativa" do texto obrigatório livre do lojista APENAS na montagem das variáveis do diretor (mandatoryArtworkText só com o texto livre + illustrativeNotice com a constante canônica, 38→39 keys), com linha de tabela e instrução curta novas nos 4 prompts do diretor (aviso mínimo, legível, discreto, separado, nas laterais) e literal canônico removido dos .md — fonte única em constants.ts**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-02T17:56:00Z (aprox.)
- **Completed:** 2026-09-02T18:15:00Z (aprox.)
- **Tasks:** 2
- **Files modified:** 7 (1 service + 4 prompts + 2 arquivos de teste)

## Accomplishments
- `splitDirectorLegalText` pura module-scope com 3 casos determinísticos (aviso-only → aviso isolado; prefixo canônico + `\n` → separa aviso × texto livre; free-only/legado → texto integral preservado byte a byte), comentário documentando que o split acontece SÓ na montagem das variáveis do diretor.
- `buildPromptVariables`: `mandatoryArtworkText` passa a carregar apenas o texto livre do lojista e a chave nova `illustrativeNotice` é adicionada **sempre presente** (vazia quando sem aviso) — `validatePrompts` (L613-684) continua fail-fast válido.
- 4 prompts do diretor ganharam a linha de tabela `| **Aviso ilustrativo** | {{illustrativeNotice}} |` após a linha do texto obrigatório e a instrução curta aprovada (substituindo a frase mista que fundia aviso legal × texto comercial); a frase do campo "Texto obrigatório na arte" permaneceu intocada.
- Literal canônico "Imagem meramente ilustrativa" removido dos 4 arquivos `.md` (grep 0) — o texto chega ao modelo via placeholder `{{illustrativeNotice}}` injetado server-side a partir de `ILLUSTRATIVE_NOTICE_TEXT` (constants.ts:1). Fonte única preservada.
- Golden tests co-migrados (38→39 keys, `toHaveLength(39)` ×5, testes 8.16/9.5 aviso-only com `mandatoryArtworkText=''` + `illustrativeNotice` canônico, 9.3 com ambas vazias, casos novos (a) aviso+texto livre, (b) free-only, (c) legado sem `\n`); `prompt-reframe.test.ts` co-migrado (`LINHA_AVISO_SEPARADO`, `LINHA_TABELA_AVISO`, check B invertido para `not.toContain` do literal + `toContain("{{illustrativeNotice}}")`; testes 16/check A/21 intactos).
- Zero alteração em UI, contrato HTTP, schema público, snapshot/domínio (`legalNotice.text` integral concatenado) e revisor de imagem — suítes dessas superfícies verdes SEM edição.

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Split semântico nas variáveis do diretor + co-migração dos golden tests** - `098ccf1c` (feat)
2. **Task 2: Linha de tabela + instrução curta nos 4 prompts do diretor + co-migração do prompt-reframe** - `e4cde72a` (feat)

**Plan metadata:** commit de docs (PLAN/SUMMARY/STATE) feito pelo orquestrador após a execução.

## Files Created/Modified
- `src/lib/image-generation/services/image-generation-service.ts` - Import de `ILLUSTRATIVE_NOTICE_TEXT` + helper `splitDirectorLegalText` (3 casos) + `buildPromptVariables` retornando `mandatoryArtworkText: merchantText` e `illustrativeNotice`
- `prompts/campaign-image-director.md` - Linha `| **Aviso ilustrativo** | {{illustrativeNotice}} |` + instrução curta do aviso
- `prompts/campaign-image-director-offer.md` - Idem
- `prompts/campaign-image-director-spotlight.md` - Idem
- `prompts/campaign-image-director-exclusive.md` - Idem
- `src/lib/image-generation/services/__tests__/image-generation-service.test.ts` - Golden 39 keys + asserts aviso-only + casos novos (a)(b)(c)
- `src/lib/campaign/__tests__/prompt-reframe.test.ts` - `LINHA_AVISO_SEPARADO`/`LINHA_TABELA_AVISO` + check B invertido

## Decisions Made
- Segui o plano com os amendments do usuário: chave `illustrativeNotice` + golden 38→39 aprovados; wording curto exato (Amendment 1); frase do texto obrigatório mantida byte a byte (Amendment 2); linha de tabela inserida (Amendment 3); decisão confirmada de usar placeholder `{{illustrativeNotice}}` no lugar do literal para manter fonte única (check B invertido).

## Deviations from Plan

None - plan executed exactly as written (com os amendments do usuário aplicados).

## Issues Encountered
- Console PowerShell 5.1 exibiu acentos como `�` no grep (codepage legada) — artefatos em disco confirmados UTF-8 corretos via `git diff` e leitura direta. Sem impacto no código.

## Verification Gates

| Gate | Result |
|------|--------|
| `npx vitest run src/lib/image-generation/services/__tests__/image-generation-service.test.ts` | ✅ 33/33 passed |
| Regressão 5 suítes (prompt-reframe, image-generation-service, image-review-service, use-campaign-form-notice, brief) | ✅ 105/105 passed |
| Rota `generate-image/route.test.ts` (extra, não editada) | ✅ 60/60 passed |
| `npm run typecheck` | ✅ Clean |
| `eslint` (arquivos alterados) | ✅ 0 erros |
| Grep: `Imagem meramente ilustrativa` em `prompts/campaign-image-director*.md` | ✅ 0 ocorrências (literal removido, fonte única) |
| Grep: `{{illustrativeNotice}}` por prompt | ✅ 2 ocorrências (tabela + instrução) |

## Next Phase Readiness
- O diretor de imagem agora recebe informação determinística sobre qual parte do texto é o aviso ilustrativo fixo (legal, mínimo, lateral) e qual é o texto comercial obrigatório do lojista — sem inferência dentro de string concatenada e sem inchaço nos prompts.
- Fora do escopo confirmado: revisor de imagem, snapshot/domínio, contrato HTTP, schema e UI permanecem consumindo o texto integral concatenado como antes; F44 (temas de campanha) segue preparado para o slot Tema.

---
*Phase: quick-kqo*
*Completed: 2026-09-02*

## Self-Check: PASSED

- Arquivos verificados no disco: 1 service + 4 prompts + 2 testes — todos FOUND.
- Commits verificados no git log: `098ccf1c` (feat) e `e4cde72a` (feat) — ambos FOUND.
- Gates: 198 testes (33 + 105 + 60), typecheck clean, eslint clean, grep 0× literal nos 4 prompts / 2× `{{illustrativeNotice}}` por arquivo.
