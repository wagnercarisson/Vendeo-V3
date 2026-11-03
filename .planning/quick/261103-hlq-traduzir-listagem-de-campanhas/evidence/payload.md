# Payload — quick 261103-hlq

**Data:** 2026-11-03
**Build:** `npm.cmd run build` exit 0 (local, fora de homolog)

## Medição final

| Rota / chunk | First Load JS (build) |
|---|---|
| `/campanhas` | **4,58 kB** (rota) / **110 kB** (First Load) |
| `/dashboard` | 4,57 kB / 110 kB (contexto secundário) |
| `/configuracoes` | 2,78 kB / 109 kB (contexto secundário) |
| Shared por todas as rotas | **102 kB** |

## Baseline

Não há medição anterior de `/campanhas` registrada em `.planning/` que servisse de comparação direta. Conforme o plano aprovado:

- **não** houve troca de branch, checkout do commit-base ou rebuild sobre aplicação em execução;
- `shared` permanece **102 kB**, o mesmo valor registrado nos gates da F57.4/F58, indicando que o catálogo da listagem não entrou no bundle compartilhado;
- sem baseline utilizável específico da rota, registra-se a limitação e vale apenas a medição final acima.

## Conferência de HTML/RSC

Executada no Gate 3 (homolog local):

| Medida | pt-BR | es-419 |
|---|---|---|
| HTML decodificado de `/campanhas` | 66.666 B | 67.601 B |
| `encodedBodySize` da navegação | 14.966 B | 15.180 B |
| `decodedBodySize` da navegação | 69.529 B | 70.464 B |

- Strings exclusivas do dashboard ausentes nos dois idiomas.
- `/conta` não contém nenhuma string exclusiva da listagem → namespace não vazou para o payload global do shell.
- Strings do shell em espanhol presentes, como esperado (pertencem ao shell).
- Detalhes em `gate3-homolog.md` e `gate3-shell-payload.json`.
