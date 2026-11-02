# Baseline — quick 261102-p3w (fontes locais)

Capturado em 2026-11-02, antes de qualquer alteração de código.

## Estado Git

```
$ git rev-parse HEAD
b898f5817de88354698ff8b03f358136570fb922

$ git rev-parse --abbrev-ref HEAD
perf/fontes-locais

$ git status --short
?? .planning/quick/261102-p3w-hospedar-localmente-as-fontes-atuais-do-/   (untracked, esperado: artefatos da própria quick)
```

HEAD e branch conferem com o baseline do plano. Worktree limpo fora dos artefatos da quick.

## Integridade de dependências (não podem mudar)

```
SHA256  32962946CAC89041490C06E611EB5E6FD7B05049303C69DD30D1F503FCC760F3  package.json
SHA256  FCB6056F22D416721D4D8B5CBE4B8EF3CFE96B2E9808309B15B2BD029E3737F8  package-lock.json
```

## Entrega externa atual (baseline)

`evidence/font-baseline-google.css` foi baixado de:

```
https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap
```

com User-Agent de Chrome desktop. Conferência (2026-11-02):

- Poppins: blocos `v24` em 400/500/600/700 × latin/latin-ext — 8 URLs distintas por peso/subset.
- Open Sans: blocos `v44` em 300/400/500/600/700 × latin/latin-ext — **1 URL por subset** repetida nos 5 pesos.
- `font-weight` com valor único em todos os blocos; `font-display: swap`.
- `font-stretch: 100%` presente **somente** em Open Sans.
- `unicode-range` de latin e latin-ext idêntico ao contrato do plano.
- URLs e versões conferem exatamente com a tabela do PLAN.md (`v24`/`v44`). Nenhuma divergência.

## Baseline visual (páginas públicas)

Dev server: `npm.cmd run dev -- -p 3124` (Next 15.5.18, pronto em 3 s). Capturas com Edge headless (`--headless=new`):

| Arquivo | Viewport | Página |
|---------|----------|--------|
| `before/landing-1440.png` | 1440×900 | `/` |
| `before/login-1440.png` | 1440×900 | `/login` |
| `before/landing-390.png` | 390×844 | `/` |
| `before/login-390.png` | 390×844 | `/login` |

Telas autenticadas (shell, `/configuracoes`, `/dashboard`, admin) não são capturáveis sem sessão — cobertas pelo checklist de aceite visual humano.

Log do servidor: `evidence/dev-server-baseline.log`. Servidor encerrado; porta 3124 liberada.
