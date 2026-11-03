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

Pendente do Gate 3 (homolog, autorização específica). O roteiro exige:

- HTML/RSC de `/novidades` em pt-BR e es-419;
- somente textos do namespace da rota, sem catálogo global adicional;
- editorial em `lang="pt-BR"` e região traduzida em `lang="es-419"`;
- `/dashboard` e `/conta` sem o catálogo de novidades.
