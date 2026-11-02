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

**Limitação do probe em `file://` registrada.** A evidência declarativa permanece: o teste
`src/__tests__/fonts/local-fonts.test.ts` expande os `unicode-range` oficiais e verifica
`U+00E1 U+00E3 U+00E7 U+00F1 U+00BF U+00A1 U+20B2 U+20AC U+0024` para as duas famílias.
Artefatos: `evidence/glyph-probe.html`, `evidence/glyph-probe-dom.html`.

### 5.1 Verificação elementar da fonte realmente rasterizada (CDP)

Correção de escopo: a primeira sondagem usou `document.querySelector('h1')` e acabou lendo o
`<h1>Vendeo</h1>` do shell de autenticação, não o título do formulário. A verificação correta
usa seletores explícitos e `CSS.getPlatformFontsForNode` (equivalente a *Rendered Fonts* no
DevTools), que informa a família e a contagem de glifos efetivamente desenhados:

| Elemento | Texto | `font-family` computada | Fonte rasterizada (`CSS.getPlatformFontsForNode`) |
|---|---|---|---|
| `h1.font-heading` (login) | “Entrar na sua conta” | `Poppins, sans-serif` | `Poppins` / `Poppins-Bold`, 19 glifos |
| `h1.font-heading + p` (login) | “Acesse para gerar suas campanhas.” | `"Open Sans", sans-serif` | `Open Sans` / `Open-Sans`, 33 glifos |
| `main h1` (landing) | “O que seu negócio quer divulgar…” | `Poppins, sans-serif` | `Poppins` / `Poppins-Bold`, 67 glifos |
| `main p` (landing) | “Beta fechado — acesso liberado…” | `"Open Sans", sans-serif` | `Open Sans` / `Open-Sans-Medium`, 69 glifos |

O mesmo resultado foi obtido **antes e depois** (baseline com Google Fonts × entrega local),
com `isCustomFont: true` nos dois estados. Isso prova que o texto foi desenhado com as fontes
webfont, não com fallback do sistema. `document.fonts.check` continua registrado como
evidência complementar: **true** para Open Sans (`áãçñ¿¡₲R$€`) e Poppins (`áãçñ¿¡`); zero
requisições a `fonts.googleapis.com`/`fonts.gstatic.com`; zero downloads duplicados por URL.
Telas autenticadas continuam dependentes do aceite humano (seção 8).

Artefatos: `evidence/viewport/before|after/{login,landing}-evidence.json`.

## 6. Screenshots e viewport medido

As capturas antigas feitas com `--window-size` foram **substituídas** como evidência de
apresentação mobile, porque a janela do Edge headless não correspondia ao viewport de layout
e a imagem de 390 px parecia cortada à direita. As novas capturas usam
`Emulation.setDeviceMetricsOverride` (390×844, DPR 1, mobile) e registram o viewport efetivo.

### 6.1 Mobile 390 — medições efetivas

| Estado | Página | `innerWidth` | `clientWidth` | `scrollWidth` | `body.scrollWidth` | DPR | `visualViewport.width` | Overflow horizontal |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| antes | landing | 390 | 390 | 390 | 390 | 1 | 390 | **não** |
| antes | login | 390 | 390 | 390 | 390 | 1 | 390 | **não** |
| depois | landing | 390 | 390 | 390 | 390 | 1 | 390 | **não** |
| depois | login | 390 | 390 | 390 | 390 | 1 | 390 | **não** |

Não há overflow horizontal real em 390 px, nem antes nem depois; o corte anterior era
artefato da captura. Desktop: landing `innerWidth=1440`, `clientWidth=1425`,
`scrollWidth=1425` (barra de rolagem de 15 px) e login `1440/1440/1440`, também sem overflow.

Arquivos: `evidence/viewport/before|after/{landing,login}-390-viewport.png` (viewport real) e
`…-390-full.png` (conteúdo completo com a largura de layout), além de `…-1440.png`. As
capturas antigas `evidence/before|after/*-390.png` permanecem apenas como histórico.

### 6.2 Comparação visual

As capturas públicas de desktop e mobile não mostram mudança de composição entre os estados;
a tipografia e os pesos são os mesmos (seção 5.1). A verificação é visual/manual; não há
pixel-diff automatizado nem dependência adicionada.

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

## 9. Comparação de carregamento antes/depois (laboratório local)

Baseline reconstruído em worktree temporária no commit `b898f581` (build próprio, mesma
`node_modules` por junction, `.env.local` copiado localmente e removido com a worktree).
Depois medido no build atual. Servidores `next start` em portas dedicadas, Edge headless,
3 execuções por página, cache limpo entre execuções.

| Métrica (mediana de 3) | Landing antes | Landing depois | Login antes | Login depois |
|------------------------|---------------|----------------|-------------|--------------|
| FCP | 152 ms | 140 ms | 152 ms | 92 ms |
| LCP | 152 ms | 140 ms | 152 ms | 92 ms |
| CLS | 0,00213 | 0,00217 | 0,00215 | 0,00243 |
| Transferência total medida | 305.691 B | 377.236 B | 220.202 B | 275.129 B |
| Requisições a origem Google | 1 (CSS) | **0** | 1 (CSS) | **0** |
| WOFF2 visíveis no Resource Timing | 0 (cross-origin) | 4 | 0 (cross-origin) | 2 |

**Leitura correta:** as faces do Google **carregaram** no baseline (status `loaded` em
`document.fonts`), mas os WOFF2 cross-origin não aparecem no `PerformanceResourceTiming`
sem `Timing-Allow-Origin`; por isso a transferência do baseline parece menor. Somando os
mesmos arquivos (hashes idênticos, §1/§4) ao baseline, a transferência fica praticamente
igual: ~378,7 KB antes × 377,2 KB depois na landing. O CSS local cresce ~6,1 KB
descomprimido (18 `@font-face`) e deixa de baixar o CSS do Google (~2,45 KB). FCP/LCP/CLS
são medições de laboratório em `localhost`, com variância entre execuções; **não** são
promessa de ganho de ranking nem representam produção (latência DNS/TLS e rede reais
ausentes). O ganho verificável é a remoção da dependência externa e das conexões a
`fonts.googleapis.com`/`fonts.gstatic.com`.

## 10. Status

**Aguardando aceite visual humano.** Não foi executado merge, push, deploy, tag, migration
ou qualquer escrita em banco. Nenhuma dependência nova.
