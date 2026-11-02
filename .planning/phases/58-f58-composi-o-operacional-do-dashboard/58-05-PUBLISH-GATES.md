# F58-05 — Separação entre validação local, validação humana e publicação

**Data:** 2026-11-02
**Estado:** validação local e UAT funcional executados; composição visual aprovada; publicação não executada e não autorizada.

## (a) Validação local

| Item | Status | Evidência |
|---|---|---|
| Suítes focadas do dashboard/crédito/i18n/changelog/avisos | **PASS** | `evidence/58-05-automated-gates.md` — 30 arquivos / 176 testes |
| Regressão de contratos de campanha/onboarding | **PASS** | 3 arquivos / 38 testes |
| Regressão shell/admin/configurações/localização | **PASS** | 37 arquivos / 396 testes |
| Typecheck | **PASS** | exit 0 |
| Lint | **PASS com limitação** | exit 0; ESLint sem cobertura TypeScript |
| Build | **PASS** | exit 0; 95/95 páginas; `/dashboard` 4,50 kB / 110 kB |
| `git diff --check 77cc9413..HEAD` | **PASS** | limpo após correção de whitespace |
| OpenSpec strict | **PASS** | `Change is valid` |
| Inspeção de escopo | **PASS** | sem migration/API/dependência/schema novos; exceção autorizada apenas em `CreditService.getBalanceBreakdown` |

Esses resultados são evidência local. Não comprovam produção, latência real, comportamento de leitor de tela ou integração externa.

## (b) Homologação / validação humana

| Cenário | Status | Observação |
|---|---|---|
| Composição pt-BR desktop/mobile | **PASS** | Capturas e aceite explícito do responsável |
| Composição es-419 desktop/mobile | **PASS** | Capturas e aceite explícito do responsável |
| Tablet 640–1023 px | **PASS** | Painel único com linhas verticais, ações legíveis e sem sobreposição |
| Slow 4G (preferência resolvida/timeout) | **PASS** | Resolvida em pt-BR/es-419; timeout caiu em pt-BR com log de timeout |
| Carregamento real com auth/preferência lentas | **PASS com ressalva** | Esqueleto localizado observado; atraso específico de auth não injetado |
| Fuso distinto e falha de fuso | **PASS** | Servidor TZ=Asia/Tokyo manteve fuso da loja; falha observada em harness neutro |
| Campanhas com erro / miniaturas / créditos zero-indisponível | **PASS** | Erros acessíveis em /campanhas; fallback de miniatura; zero real e indisponível em harness |
| Avisos de prontidão | **PASS** | Readiness pendente observado em pt-BR/es-419 em harness local |
| Teclado/foco/contraste/truncamento | **PASS com ressalva** | Tab, zoom, truncamento e contraste medidos; leitor de tela real não executado |
| Admin | **PASS** | `/admin` aberto manualmente com preferência es-419; permaneceu em pt-BR |

Detalhes em `evidence/58-05-human-visual.md`.

## (c) Publicação

**NÃO EXECUTADA E NÃO AUTORIZADA.**

- Nenhum push, merge, deploy ou smoke autenticado de produção.
- Nenhuma migration, alteração de schema ou de produção.
- A única escrita em dados foi a preferência de idioma do usuário de teste no homolog, autorizada, via fluxo de Configurações, com restauração confirmada para `pt-BR`/`explicit` (versão CAS 8).
- Testes locais e capturas de homolog **não** provam produção.
- Publicação, se desejada, exige autorização específica, janela própria e evidência de smoke.
