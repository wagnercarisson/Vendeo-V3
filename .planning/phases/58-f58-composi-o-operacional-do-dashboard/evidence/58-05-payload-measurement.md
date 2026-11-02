# F58-05 — Medição de payload e isolamento do namespace do dashboard

- **Fase:** 58 — Composição operacional do dashboard
- **Plano:** 58-05 (Task 1)
- **Data:** 2026-11-02
- **Build medido:** `npm.cmd run build` — exit **0**, `✓ Generating static pages (95/95)`, `✓ Compiled successfully in 19.0s`
- **Natureza da evidência:** a medição numérica deste documento é **evidência manual** (uma execução de build no working tree atual). A prova **determinística** de que o shell não passou a carregar o namespace do dashboard é o teste estático `src/lib/i18n/dashboard/__tests__/isolation.test.ts` (§4).

> Nenhum deploy, push, merge ou smoke de produção foi executado. Números abaixo não comprovam produção.

## 1. First Load JS — `/dashboard` antes × depois

| Momento | Build | `/dashboard` (route size) | `/dashboard` (First Load JS) | First Load JS compartilhado | Páginas |
|---------|-------|---------------------------|------------------------------|-----------------------------|---------|
| **Antes da F58** (baseline documentado, build de 2026-10-29) | F57.4, árvore anterior às alterações da F58 | 4,49 kB | **110 kB** | 102 kB | 94/94 |
| **Depois da F58** (este build, 2026-11-02) | F58 (`58-01`…`58-04` aplicados) | **4,27 kB** | **110 kB** | **102 kB** | **95/95** |

Fonte do baseline: `.planning/phases/57.4-f57-4-base-de-tradu-o-da-interface-e-configura-es/evidence/57.4-local-gates.md`, linha 128 (`/dashboard   4.49 kB   110 kB`) e linha 256 (build exit 0, 94/94 páginas). O baseline **não foi re-executado** neste working tree nesta Task 1 (o que exigiria checkout/limpeza destrutiva, não autorizada); por isso é citado como evidência documental anterior, não como medição atual.

Trecho real do build atual:

```
├ ƒ /dashboard                                               4.27 kB         110 kB
+ First Load JS shared by all                                 102 kB
  ├ chunks/1255-b28ea36bf0cdbd65.js                          46.2 kB
  ├ chunks/4bd1b696-f785427dddbba9fb.js                      54.2 kB
  └ other shared chunks (total)                              2.01 kB
```

**Leitura:** o First Load JS de `/dashboard` permanece **110 kB** e o compartilhado permanece **102 kB**. O route size caiu de 4,49 kB para 4,27 kB. Não houve aumento de payload global.

## 2. Tamanho gzip dos catálogos do dashboard

Medido com `zlib.gzipSync` sobre os arquivos-fonte reais (`node`), portanto é tamanho de **fonte**, não de chunk compilado:

| Arquivo | Tamanho bruto | gzip |
|---------|---------------|------|
| `src/lib/i18n/dashboard/messages.ts` (contrato/tipos) | 2.285 B | **632 B (0,62 KB)** |
| `src/lib/i18n/dashboard/catalogs/pt-BR.ts` | 2.330 B | **981 B (0,96 KB)** |
| `src/lib/i18n/dashboard/catalogs/es-419.ts` | 2.433 B | **1.041 B (1,02 KB)** |
| `src/lib/i18n/dashboard/index.ts` | 659 B | 315 B (0,31 KB) |
| `src/lib/i18n/dashboard/get-messages.ts` | 582 B | 306 B (0,30 KB) |

Por requisição, o servidor resolve **um** locale por vez (`pt-BR` **ou** `es-419`), então o custo de catálogo por renderização é da ordem de **≤1 KB gzip** mais o contrato. Ambos permanecem no bundle **server-side** da página do dashboard, não no shell (§3).

## 3. Verificação em `.next/app-build-manifest.json`

Manifest inspecionado após o build (`pages` = 177 entradas: 76 páginas não-API + rotas de API).

Chunks da rota `/(app)/dashboard/page` + `/(app)/dashboard/loading`:

```
webpack-ec0c7db9ca3a28fe.js
4bd1b696-f785427dddbba9fb.js      ← framework compartilhado (54.2 kB)
1255-b28ea36bf0cdbd65.js          ← framework compartilhado (46.2 kB)
main-app-9ae025707df18d09.js      ← runtime app-router
2619-3c9e02e22d10480a.js          ← utilitários internos do Next
page-c61820456defbf79.js          ← chunk exclusivo da página do dashboard
loading-fe02d39a11404ea5.js       ← chunk genérico de loading
```

Comparação com as 48 rotas de shell/admin/irmãs do grupo `(app)` (`/layout`, `/(app)/layout`, `/(app)/admin/**`, `/(app)/campanhas/**`, `/(app)/configuracoes/**`, `/(app)/conta/**`):

| Chunk do dashboard | Também presente em rotas de shell/admin? | Natureza | Conclusão |
|--------------------|------------------------------------------|----------|-----------|
| `webpack-…`, `4bd1b696-…`, `1255-…`, `main-app-…` | sim | framework/runtime preexistentes | esperado |
| `2619-3c9e02e22d10480a.js` (8.538 B) | **sim** (48 rotas) | utilitários internos do Next (`DecodeError`, `WEB_VITALS`, `execOnce`…) — **nenhuma string do dashboard** | preexistente, não é namespace do dashboard |
| `loading-fe02d39a11404ea5.js` (743 B) | **sim** (13 rotas de `loading`) | chunk genérico de loading compartilhado por todas as rotas de loading | preexistente, sem conteúdo do dashboard |
| `page-c61820456defbf79.js` (12.911 B bruto / **4.274 B gzip**) | **não** | chunk exclusivo da página | contém apenas a árvore/código da página; rótulos vêm do servidor |

Verificações complementares:

- Busca por strings do dashboard (`Campanhas disponíveis`, `Buenos días`, `Saldo indisponível`, `Ver todas as campanhas`) **nos chunks compartilhados** de `.next/static/chunks/*.js`: **nenhuma ocorrência**.
- Inspeção textual de `page-c61820456defbf79.js`: **não** contém nenhum desses rótulos — o texto chega por props de Server Component, não embutido no chunk cliente.

**Conclusão:** nenhum chunk compartilhado novo do namespace do dashboard aparece nas rotas de shell/admin. O shell continua com 102 kB compartilhados.

## 4. Prova determinística de isolamento (teste estático)

```
npx vitest run src/lib/i18n/dashboard/__tests__/isolation.test.ts
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

Exit code: **0**. O teste cobre que `src/lib/i18n/index.ts`, `messages.ts`, `get-catalog.ts`, `src/app/(app)/layout.tsx`, `src/components/shell/app-shell.tsx` e `src/app/(app)/admin/**` não importam `i18n/dashboard`, e que o catálogo global não contém chaves `dashboard.*`.

Verificação direta complementar:

```
Select-String -Path "src/lib/i18n/index.ts","src/lib/i18n/messages.ts","src/lib/i18n/get-catalog.ts","src/app/(app)/layout.tsx","src/components/shell/app-shell.tsx" -Pattern "i18n/dashboard"
```

Saída: **vazia**.

## 5. Conclusão

- `/dashboard` **antes**: 4,49 kB / 110 kB (baseline documentado de 2026-10-29).
- `/dashboard` **depois**: 4,27 kB / 110 kB (build desta Task 1).
- First Load JS compartilhado: **102 kB → 102 kB** (sem aumento).
- Catálogos do dashboard: **0,96 KB gzip (pt-BR)** e **1,02 KB gzip (es-419)** em fonte, server-side.
- Nenhum chunk compartilhado novo do dashboard nas rotas de shell/admin.
- Isolamento do namespace provado de forma determinística pelo teste estático; a medição numérica acima é evidência **manual**, não prova de produção.
