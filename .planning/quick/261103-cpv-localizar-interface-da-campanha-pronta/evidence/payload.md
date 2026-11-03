# Payload — campanha pronta (Gate 2)

**Data:** 2026-11-03
**Build local:** exit 0, 95/95 páginas

## Entrega final

| Rota / chunk | Tamanho da rota | First Load JS |
|---|---:|---:|
| `/campanhas/[id]` | 11,4 kB | 117 kB |
| shared | — | 102 kB |

## Baseline

Não foi produzido baseline por troca de branch, rebuild retroativo ou reinício da aplicação, conforme o plano. A entrega final é registrada isoladamente.

## Isolamento

- Teste estático prova que `src/lib/i18n/index.ts`, `src/lib/i18n/messages.ts`, `src/lib/i18n/get-catalog.ts`, `(app)/layout.tsx` e `app-shell.tsx` não importam `campaign-detail`.
- Nenhum arquivo de `src/app/(app)/admin/**` importa o namespace.
- O namespace é client-safe (sem `server-only`).
- O cliente importa apenas **tipos** do namespace; as mensagens chegam serializadas do Server Component.

## Não executado

- Conferência de HTML/RSC entregue no homolog (prevista para o Gate 3).
- Medição de rede/performance.
