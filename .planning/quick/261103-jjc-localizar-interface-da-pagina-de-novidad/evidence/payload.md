# Payload — quick 261103-jjc

**Data:** 2026-11-03
**Build:** `npm.cmd run build` exit 0 (local; sem homolog/produção)

## Medição final

| Rota / chunk | First Load JS (build) |
|---|---|
| `/novidades` | **1,31 kB** (rota) / **107 kB** (First Load) |
| `/dashboard` | 4,57 kB / 110 kB (contexto secundário) |
| `/campanhas` | 4,58 kB / 110 kB (contexto secundário) |
| Shared por todas as rotas | **102 kB** |

## Baseline

Não foi localizada medição anterior específica de `/novidades` em `.planning/`. Conforme o plano:

- não houve troca de branch, checkout do commit-base ou rebuild sobre aplicação em execução;
- `shared` permanece **102 kB**, o mesmo valor dos builds recentes;
- sem baseline utilizável, registra-se a limitação e vale apenas a medição final acima.

## Conferência de HTML/RSC

Executada no Gate 3 (homolog local):

| Medida | pt-BR | es-419 |
|---|---|---|
| HTML de `/novidades` | 95.586 B | 96.535 B |
| `encodedBodySize` da navegação | 29.592 B | 29.821 B |
| `decodedBodySize` da navegação | 96.008 B | 96.857 B |

- Strings exclusivas do dashboard ausentes em `/novidades`.
- `/dashboard` e `/conta` não contêm `Nueva funcionalidad`, `Corrección` ou `Aún no hay novedades`.
- Shell em espanhol presente no dashboard, como esperado (pertence ao shell/F58).
- Detalhes em `gate3-homolog.md` e `gate3-results.json`.
