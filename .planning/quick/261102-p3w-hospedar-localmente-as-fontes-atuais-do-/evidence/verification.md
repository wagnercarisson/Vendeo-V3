# Verificação — quick 261102-p3w (fontes locais)

Data: 2026-11-02. Branch `perf/fontes-locais`, base `b898f5817de88354698ff8b03f358136570fb922`.
Nenhum merge, push, deploy, tag, migration ou escrita em banco foi executado.

## 1. Gates automatizados

| Gate | Comando | Resultado |
|------|---------|-----------|
| Teste focado | `npm.cmd run test -- src/__tests__/fonts/local-fonts.test.ts --reporter=dot` | **13/13 passed**, 1 arquivo, exit 0 |
| Typecheck | `npm.cmd run typecheck` | **exit 0** |
| Lint | `npm.cmd run lint` | **exit 0** — limitação conhecida: `eslint .` não cobre arquivos `.ts`/`.tsx` neste projeto; não corrigido aqui |
| Build | `npm.cmd run build` | **exit 0**, `Compiled successfully`, **95/95 páginas** (igual ao baseline 95/95 de STATE) |

Observação: o build emite o aviso nativo do PowerShell para saída de stderr (Browserslist
desatualizado / `[seo/layout]`), mas termina com `BUILD_EXIT=0`.

## 2. Integridade de dependências

Hashes SHA-256 idênticos antes e depois (nenhuma dependência nova, nenhum `postinstall`):

```
32962946CAC89041490C06E611EB5E6FD7B05049303C69DD30D1F503FCC760F3  package.json
FCB6056F22D416721D4D8B5CBE4B8EF3CFE96B2E9808309B15B2BD029E3737F8  package-lock.json
```

## 3. Artefato de build

```
rg -n "fonts\.googleapis|fonts\.gstatic" .next/server .next/static   → 0 linhas
```

CSS gerado (`/ _next/static/css/73abdd1a92db2696.css`):

- `@font-face`: **18**
- `url(/fonts/...)`: **18**
- `url()` de fonte distintos: **10**
- ocorrências de `fonts.googleapis|fonts.gstatic`: **0**

## 4. Prova HTTP real (`next start -p 3123` sobre o build)

Servidor pronto; todas as requisições contra `http://localhost:3123`.

### Assets de fonte

| Caminho | Status | Content-Type | Bytes | SHA-256 confere |
|---------|--------|--------------|-------|-----------------|
| `/fonts/poppins/poppins-400-latin.woff2` | 200 | `font/woff2` | 7884 | sim |
| `/fonts/poppins/poppins-400-latin-ext.woff2` | 200 | `font/woff2` | 5644 | sim |
| `/fonts/poppins/poppins-500-latin.woff2` | 200 | `font/woff2` | 7748 | sim |
| `/fonts/poppins/poppins-500-latin-ext.woff2` | 200 | `font/woff2` | 5484 | sim |
| `/fonts/poppins/poppins-600-latin.woff2` | 200 | `font/woff2` | 8000 | sim |
| `/fonts/poppins/poppins-600-latin-ext.woff2` | 200 | `font/woff2` | 5524 | sim |
| `/fonts/poppins/poppins-700-latin.woff2` | 200 | `font/woff2` | 7816 | sim |
| `/fonts/poppins/poppins-700-latin-ext.woff2` | 200 | `font/woff2` | 5432 | sim |
| `/fonts/open-sans/open-sans-latin.woff2` | 200 | `font/woff2` | 48320 | sim |
| `/fonts/open-sans/open-sans-latin-ext.woff2` | 200 | `font/woff2` | 35156 | sim |

`FAILURES=0`. `Content-Length` igual a `bytes` do manifesto nos 10 casos.

### Páginas

| Rota | Status | `fonts.googleapis|fonts.gstatic` no HTML | CSS link(s) |
|------|--------|------------------------------------------|-------------|
| `/` | 200 | 0 | `/_next/static/css/73abdd1a92db2696.css`, `/_next/static/css/8ab933670b971eff.css` |
| `/login` | 200 | 0 | `/_next/static/css/73abdd1a92db2696.css` |

O CSS baixado via HTTP contém 18 `@font-face`, 10 `url(/fonts/...)` distintos e 0 origem externa.

### Downloads duplicados

O CSS declara 18 blocos com **10 `url()` distintos**: Open Sans compartilha 1 arquivo por
subset entre os 5 pesos (variável), e o navegador deduplica por URL idêntica. Poppins tem 1
arquivo por peso/subset.

## 5. Cobertura de glifos (best-effort)

Tentativas com Edge headless:

1. `document.fonts.check` numa página servida por `next start` → **404** (middleware do app
   bloqueia caminho fora de rota; probe descartado).
2. Probe `file://` com os próprios WOFF2 embutidos como `data:` URLs:
   `FACES=4` (as 4 faces carregaram), mas `document.fonts.check('16px "Open Sans Probe"', ...)`
   e `...('16px "Poppins Probe"', ...)` retornaram **false**. A API não é confiável nesse
   modo headless para múltiplas faces da mesma família.

**Limitação registrada.** A evidência primária de cobertura é **declarativa**: o teste
`src/__tests__/fonts/local-fonts.test.ts` expande os `unicode-range` oficiais e verifica
`U+00E1 U+00E3 U+00E7 U+00F1 U+00BF U+00A1 U+20B2 U+20AC U+0024` para as duas famílias.
Artefatos: `evidence/glyph-probe.html`, `evidence/glyph-probe-dom.html`.

## 6. Screenshots antes/depois

| Arquivo | Antes (SHA-256) | Depois (SHA-256) | Idêntico |
|---------|-----------------|------------------|----------|
| landing-1440.png | `9BC56AD817B82B48…` | `9BC56AD817B82B48…` | **sim** |
| login-1440.png | `CF1ABA83636BD756…` | `CF1ABA83636BD756…` | **sim** |
| landing-390.png | `8BE5CCBD7D834A6D…` | `8BE5CCBD7D834A6D…` | **sim** |
| login-390.png | `00891F03FD5E8F37…` | `00891F03FD5E8F37…` | **sim** |

As imagens before/after são **byte-idênticas** nas quatro capturas públicas. Consistente com
"nenhuma mudança visual" — ressalva: sem screenshot de rede, não se prova se o baseline usou
o download do Google ou um fallback; a comparação apenas mostra ausência de regressão visual
entre os dois estados.

## 7. Escopo do diff

`git diff --stat b898f58..HEAD -- src public`:

```
 public/fonts/... (10 WOFF2 + 2 OFL + PROVENANCE)
 src/__tests__/fonts/local-fonts.test.ts
 src/app/fonts.css
 src/app/layout.tsx            (9 linhas, remove head externo + import fonts.css)
 src/lib/fonts/font-manifest.ts
```

`globals.css`, `tailwind.config.ts`, `next.config.ts`, componentes, `package.json` e
`package-lock.json`: **sem diff**. `font-heading`/`font-body` e `body { font-family: "Open Sans", sans-serif }`
permanecem intocados.

## 8. Checklist de aceite visual humano

Telas autenticadas não são capturáveis sem sessão. Verificar manualmente em `next dev`/`next start`:

- [ ] `/login` e `/` (desktop) — títulos em **Poppins** e corpo em **Open Sans**, sem FOUC perceptível além do `font-display: swap`.
- [ ] `/login` e `/` (mobile 390px) — mesmas famílias, sem salto de layout.
- [ ] Shell autenticado (sidebar/topbar) — `font-heading`/`font-body` inalterados.
- [ ] `/dashboard` — pesos 400/500/600/700 de Poppins e 300–700 de Open Sans visualmente iguais ao estado anterior.
- [ ] `/configuracoes` e admin — nenhuma regressão de tipografia.
- [ ] Acentos/`ç`/`ñ`/`¿`/`¡`/`₲`/`R$`/`€` renderizam nos pontos onde aparecem.
- [ ] DevTools → Network: zero requisições a `fonts.googleapis.com`/`fonts.gstatic.com`; fontes vêm de `/fonts/**` com 200.

## 9. Status

**Aguardando aceite visual humano.** Não foi executado merge, push, deploy, tag, migration
ou qualquer escrita em banco. Nenhuma dependência nova.
