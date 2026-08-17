---
phase: 42-signup-controlado-elegibilidade-freemium
plan: 03
subsystem: api
tags: [cnae, segmento, concla, ibge, determinístico, d9, build-check, typescript]

# Dependency graph
requires:
  - phase: fase-42-signup-controlado-elegibilidade-freemium
    provides: OpenSpec F42 source of truth (D9 — compatibilidade segmento × CNAE determinística; nunca-reject por CNAE; precedência de subclasse exata)
  - phase: 42-01
    provides: Trackings D1 (F42 = Signup, Stripe → F43)
  - phase: fase-40-campos-comerciais-avisos-brief
    provides: Enum real `stores.segment` (STORE_SEGMENTS em src/lib/constants.ts — 13 valores, incluindo `outros`)
provides:
  - `src/lib/cnpj/cnae-mapping.ts` — módulo determinístico D9: `normalizeCnaeSubclasse` (7 dígitos + DV, remove pontuação, null se ≠ 7), `deriveCnaeClasse` (5 primeiros = classe 4+DV), `CNAE_SEGMENT_MAP` (13 segmentos × 4 conjuntos), `cnaeCompatibilityFor` (precedência negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown), `assertNoCnaeContradictions` (build/CI)
  - Códigos CNAE 100% reais validados na CONCLA/IBGE (CNAE-Subclasses 2.3, busca online, 2026-08-17) — nenhum código ilustrativo do alinhamento foi copiado
  - `scripts/check-cnae.ts` + script npm `check:cnae` anexado ao `build` (npm run check:cnae && next build) — contradição = erro de build, nunca runtime
affects: [42-04 (motor de elegibilidade consome cnaeCompatibilityFor — D10), 42-05 (admin review segmento_cnae_divergente), 42-15 (testes 22-36 do motor), 42-20 (UAT)]

# Tech tracking
tech-stack:
  added: []
  patterns: [módulo helper puro em src/lib/cnpj (mesmo padrão de mask.ts/normalize.ts), validação de build via script tsx dedicado anexado ao comando build (não duplicado em runtime de produção), testes de formato/validação de dados de mapa (grep estrutural em teste, não só comportamento)]

key-files:
  created:
    - src/lib/cnpj/cnae-mapping.ts
    - src/lib/cnpj/__tests__/cnae-mapping.test.ts
    - scripts/check-cnae.ts
  modified:
    - package.json

key-decisions:
  - "Códigos CNAE reais da CONCLA/IBGE validados individualmente via busca online (CNAE-Subclasses 2.3) em 2026-08-17 — a validação revelou códigos que divergem do senso comum (ex.: 47.83-1 é joias e relógios, NÃO armarinho; petshop varejo = 4789004; banho/tosa pet = 9609208; lojas de conveniência = 4729602 subclasse de 47296; distribuidora de bebidas = atacado 46354)"
  - "Precedência exercitada com casos reais: (a) variedades-utilidades tem 47890 classe positiva + 4789009 (armas e munições) subclasse negativa → negative.subclasses vence positive.classes; (b) petshop tem 47717 classe negativa (farmácia) + 4771704 (medicamentos veterinários) subclasse positiva → positive.subclasses vence negative.classes — ambos os sentidos da precedência cobertos por testes com códigos reais"
  - "assertNoCnaeContradictions aceita mapa opcional (default CNAE_SEGMENT_MAP) — permite testar o lançamento sem mutar o mapa real; a assinatura pública sem argumentos preserva o contrato do build/CI"
  - "Overlap pai-filho (classe numa lista + subclasse dela em outra) é permitido no mapa e resolvido por precedência — validado por teste e pelo próprio mapa (47890/4789009 em variedades; 47717/4771704 em petshop)"
  - "check:cnae anexado ao script build (Vercel usa npm run build) — sem CI workflow file no repo; não duplicado em runtime de produção (validação de tempo de build)"

patterns-established:
  - "Validação de build via script tsx dedicado (scripts/check-cnae.ts) anexado ao comando build com && — contradição de dados de configuração = erro de build, nunca runtime"
  - "Teste estrutural de dados de mapa (formato 5/7 dígitos + não-contradição) além dos testes comportamentais — pega erro de digitação de código sem depender de caso de uso específico"

requirements-completed: ["cnae-segment-mapping"]

# Metrics
duration: 21min
completed: 2026-08-17
---

# Phase 42 Plan 03: CNAE — Mapeamento Determinístico Segmento × CNAE Summary

**Módulo `src/lib/cnpj/cnae-mapping.ts` com normalização de subclasse (7 dígitos + DV), derivação de classe (4+DV), 4 conjuntos por segmento para os 13 segmentos reais do enum `stores.segment`, `cnaeCompatibilityFor` com precedência de subclasse exata (negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown) e validação de não-contradição em build/CI — todos os códigos CNAE validados individualmente na CONCLA/IBGE (CNAE-Subclasses 2.3), zero códigos ilustrativos**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-17T17:15:00Z
- **Completed:** 2026-08-17T17:36:00Z
- **Tasks:** 2 (Task 1 TDD com RED+GREEN; Task 2 execute)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- **Módulo determinístico D9 completo** — `normalizeCnaeSubclasse("4781-4/00")` → `"4781400"` (remove pontuação, `null` se não 7 dígitos — CNAE malformado nunca falha hard, T-42-03 mitigada); `deriveCnaeClasse("4781400")` → `"47814"` (classe 4+DV); `cnaeCompatibilityFor` com a precedência exata do spec; `assertNoCnaeContradictions` lança `Error` em overlap idêntico pos+neg e **permite** overlap pai-filho (resolvido por precedência)
- **13 segmentos do enum `stores.segment` (F40)** com 4 conjuntos cada (`compatible.classes`, `compatible.subclasses`, `incompatible.classes`, `incompatible.subclasses`); `outros` com todos os conjuntos vazios → sempre `unknown` (nunca penaliza, T-42-03b); chave ausente → `unknown` neutro
- **Listas 100% validadas na CONCLA/IBGE** — cada código confirmado na hierarquia oficial (Seção → Divisão → Grupo → Classe → Subclasse) via busca online CNAE-Subclasses 2.3 em 2026-08-17; a validação corrigiu suposições comuns (ver Decisions)
- **Precedência exercitada com códigos reais nos dois sentidos:** (a) variedades-utilidades — classe positiva `47890` + subclasse negativa `4789009` (armas e munições) → `incompatible`, demais subclasses seguem a classe (granularidade fina); (b) petshop — classe negativa `47717` (farmácia) + subclasse positiva `4771704` (medicamentos veterinários) → `compatible`, enquanto `4771701` (farmácia humana) → `incompatible`
- **Não-contradição em build/CI** — `scripts/check-cnae.ts` via `tsx`, novo script npm `check:cnae`, anexado ao `build` (`npm run check:cnae && next build`); contradição → throw → exit 1 (verificado); **não duplicado em runtime de produção** (T-42-03a)
- **TDD RED→GREEN:** teste primeiro (falhou por módulo inexistente), implementação depois (19/19 verdes); o teste estrutural de formato pegou um erro real de implementação (códigos de classe escritos com 4 dígitos em vez de 5) — corrigido inline antes do commit GREEN
- Regressão completa: **223 files / 2059 testes passing** (F42-02 fechou com 222/2040; +19)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1 (TDD): Módulo cnae-mapping.ts**
   - `187ffb3` — `test(42-03)`: add failing tests 37-46 for cnae-mapping module (RED — 1 suite falha: `Cannot find module '../cnae-mapping'`)
   - `9dc2fa6` — `feat(42-03)`: implement cnae-mapping module (GREEN — 19/19, typecheck limpo)
   - _REFACTOR: não necessário — implementação mínima seguindo o padrão de helpers puros de lib/cnpj_
2. **Task 2: Não-contradição em build/CI** - `5d1540a` (`chore(42-03)`: wire assertNoCnaeContradictions into build/CI)

## Files Created/Modified

- `src/lib/cnpj/cnae-mapping.ts` - módulo determinístico D9: normalização, derivação, `CNAE_SEGMENT_MAP` (13 segmentos), `cnaeCompatibilityFor`, `assertNoCnaeContradictions`
- `src/lib/cnpj/__tests__/cnae-mapping.test.ts` - 19 testes cobrindo tests 37-46 da tasks.md (normalização, derivação, compatible/incompatible/unknown, granularidade, precedência nos dois sentidos, não-contradição, formato dos códigos, `outros`)
- `scripts/check-cnae.ts` - executa `assertNoCnaeContradictions()` via tsx no build (exit ≠ 0 em contradição)
- `package.json` - novo script `check:cnae`; `build` agora roda `npm run check:cnae && next build`

## Decisions Made

- **Códigos CNAE validados na CONCLA/IBGE em vez de copiados do alinhamento** (exigência do plan e do spec). Método: busca online CNAE-Subclasses 2.3 (`https://concla.ibge.gov.br/busca-online-cnae.html?view=classe&tipo=cnae&versao=10&classe=XXXXX`) com navegação pela hierarquia oficial. **Achados que corrigem suposições comuns:** `47.83-1` = joias e relógios (NÃO armarinho); varejo de animais/artigos pet = `4789004` (subclasse de `47890`); banho e tosa pet = `9609208` (subclasse de `96092`, "Higiene e embelezamento de animais domésticos"); lojas de conveniência = `4729602` (subclasse de `47296`); distribuidora de bebidas = atacado `46354` (não existe `46.38-7`); livros/papelaria = `47610`; lojas de variedades = `4713002`; brechó = `4785701`/`4785799`; cabeleireiros/estética = `9602501`/`9602502`; restaurantes = `5611201`/`5611203`/`5611204`/`5611205`; catering/bufê = `56201`; farmácia = `4771701-03`; óptica = `4774100`; móveis/colchoaria/iluminação = `4754701-03`; informática = `4751201`/`4751202`; telefonia = `4752100`; eletrodomésticos/áudio-vídeo = `4753900`; super/hipermercados = `4711301`/`4711302`; minimercados/mercearias = `4712100`; padaria/confeitaria/doces = `4721102-04`; atacado de bebidas = `4635401-03/99`; reparação de computadores = `9511800`; reparação de eletroeletrônicos = `9521500`; lavanderias = `9601701-03`
- **`assertNoCnaeContradictions(map = CNAE_SEGMENT_MAP)` com parâmetro opcional** — a assinatura pública sem argumentos preserva o contrato do build/CI; o parâmetro permite testar o lançamento com um mapa injetado (sem mutar o mapa real)
- **Overlap pai-filho permitido e exercitado** — `47890`/`4789009` (variedades) e `47717`/`4771704` (petshop) são casos reais de classe numa lista + subclasse dela em outra; o `assertNoCnaeContradictions` não os trata como contradição (spec: resolvido por precedência)
- **`check:cnae` anexado ao `build`** — não há CI workflow file no repo (Vercel executa `npm run build`); anexar ao script de build é o ponto único do pipeline; contradição → exit 1 (verificado via tsx com mapa injetado)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Códigos de classe escritos com 4 dígitos (grupo) em vez de 5 (classe 4+DV)**
- **Found during:** Task 1 (GREEN — teste estrutural de formato "mapa real só contém códigos com formato válido" falhou)
- **Issue:** Na primeira versão do `CNAE_SEGMENT_MAP`, os códigos de classe foram escritos com o formato de grupo (ex.: `"4712"`, `"4723"`, `"5611"`) em vez do formato de classe 4+DV (`"47121"`, `"47237"`, `"56112"`). O teste de formato (test 45) pegou 5 falhas; 3 códigos (`4721`, `5612`) também ficaram de fora da primeira correção e foram corrigidos em seguida. A causa raiz: derivação mental dos códigos sem conferir a hierarquia oficial — exatamente o risco que a validação CONCLA/IBGE e o teste estrutural existem para mitigar.
- **Fix:** Substituídos todos os códigos de classe pelo formato oficial de 5 dígitos com DV, conferidos na hierarquia da CONCLA/IBGE (mapeamento: `4711→47113`, `4712→47121`, `4713→47130`, `4721→47211`, `4723→47237`, `4729→47296`, `4635→46354`, `4751→47512`, `4752→47521`, `4753→47539`, `4754→47547`, `4757→47571`, `4759→47598`, `4761→47610`, `4771→47717`, `4772→47725`, `4773→47733`, `4774→47741`, `4781→47814`, `4782→47822`, `4785→47857`, `4789→47890`, `5611→56112`, `5612→56121`, `5620→56201`, `9511→95118`, `9512→95126`, `9521→95215`, `9529→95291`, `9601→96017`, `9602→96025`, `9609→96092`).
- **Files modified:** src/lib/cnpj/cnae-mapping.ts
- **Verification:** 19/19 testes passando (inclui o teste de formato); typecheck limpo
- **Committed in:** `9dc2fa6` (parte do commit GREEN)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - Bug)
**Impact on plan:** O auto-fix foi necessário para a correção dos códigos — exatamente o que o teste estrutural e a validação CONCLA/IBGE exigiam. Sem scope creep; nenhuma funcionalidade além do plano.

## Issues Encountered

- **`npm` via PowerShell engole a saída** (shim `.cmd`) — as verificações de build/check foram executadas via `cmd /c` para capturar a saída e o exit code de forma confiável; `npx tsx scripts/check-cnae.ts` direto também funciona e imprime o OK
- Docker/Supabase local não é necessário neste plan (nenhuma migração; módulo puro + script de build)

## User Setup Required

None — nenhuma configuração externa. O `check:cnae` roda automaticamente no `npm run build` (Vercel). Nenhuma env var nova.

## Next Phase Readiness

- **42-04 (motor de elegibilidade) pronto para consumir** `cnaeCompatibilityFor(segment, cnae_principal)` — o módulo é importável, determinístico, sem I/O, sem custo e nunca lança em runtime (malformado/desconhecido → `unknown` neutro); `incompatible` alimentará review `segmento_cnae_divergente` (D10)
- **42-05 (admin) e 42-15 (testes do motor)** podem referenciar o módulo diretamente; os testes 37-46 já existem e ficarão verdes em qualquer regressão
- A validação CONCLA/IBGE (método + data + achados) está registrada neste SUMMARY — 42-20 (UAT) pode citar como evidência da fonte dos códigos

## Self-Check: PASSED

- Files exist on disk — FOUND: `src/lib/cnpj/cnae-mapping.ts`, `src/lib/cnpj/__tests__/cnae-mapping.test.ts`, `scripts/check-cnae.ts`
- Commits in git log — FOUND: `187ffb3` (RED), `9dc2fa6` (GREEN), `5d1540a` (Task 2)
- Plan-level verification re-run:
  - `npx vitest run src/lib/cnpj/__tests__/cnae-mapping.test.ts` → 19/19 PASS
  - `npm run check:cnae` → exit 0, "check:cnae OK — no contradictions in CNAE_SEGMENT_MAP" PASS
  - Contradição simulada via tsx → exit 1 PASS
  - `npm run typecheck` → 0 errors PASS
  - `npm run build` → exit 0, `check:cnae OK` no início do log, "Compiled successfully in 11.8s", 57 static pages PASS
  - Regressão completa `npx vitest run` → 223 files / 2059 testes PASS

---
*Phase: 42-signup-controlado-elegibilidade-freemium*
*Completed: 2026-08-17*