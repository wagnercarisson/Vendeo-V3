# Evidência local — quick 261103-hlq

**Data:** 2026-11-03
**Branch:** `feature/traducao-da-listagem-de-campanhas` (base `948ee3e9` = `origin/main`)
**Escopo:** implementação local do plano aprovado (Gate 2). Sem homolog, banco, push, merge ou deploy.

## Gates executados

| Gate | Comando | Resultado |
|---|---|---|
| Focados | `npm.cmd test -- src/lib/i18n/campaign-list src/__tests__/app/campanhas/campanhas-page.test.tsx src/__tests__/app/minhas-campanhas.test.tsx src/__tests__/app/minhas-campanhas-client.test.tsx src/__tests__/components/ui/pagination.test.tsx` | **7 arquivos / 64 testes PASS** |
| Regressão dirigida | `npm.cmd test -- src/__tests__/lib/campaign/list.test.ts src/__tests__/api/campaign-download.test.ts src/__tests__/lib/onboarding/microcopy.test.ts src/__tests__/app/campanhas src/__tests__/app/minhas-campanhas-client.test.tsx src/__tests__/app/minhas-campanhas.test.tsx src/__tests__/components/ui/pagination.test.tsx src/components/credit/__tests__/transaction-history.test.tsx src/lib/i18n` | **17 arquivos / 162 testes PASS** |
| Typecheck | `npm.cmd run typecheck` | **exit 0** |
| Lint | `npm.cmd run lint` | **exit 0** (limitação conhecida: ESLint sem cobertura de `.ts`) |
| Build | `npm.cmd run build` | **exit 0**; `/campanhas` **4,58 kB / 110 kB**; shared **102 kB** |
| Diff | `git diff --check` | **limpo (exit 0)** |

O runner local informou, antes e depois das suítes, que os gates de PostgreSQL/homolog, PostgreSQL local, F50.4, app-env e Produto 1:1 **não foram executados**. Nenhum desses ambientes foi acessado.

## OpenSpec

Validação individual dos quatro main specs alterados (`openspec validate <spec> --type spec --strict`):

| Spec | Resultado |
|---|---|
| `campaign-list-tests` | **válido** |
| `empty-states` | **válido** |
| `campaign-list-ui` | falha **pré-existente**: ausência de `## Purpose` (o requisito adicionado não gera erro) |
| `pagination-component` | falha **pré-existente**: requisitos 0 e 2 sem `SHALL`/cenários (o requisito adicionado não gera erro) |

`openspec validate --specs --strict` no conjunto do repositório continua não-verde (210 passed / 69 failed), consistente com dívida documental anterior; os arquivos alterados não introduziram novas categorias de erro.

## Preservações verificadas por teste

- Query, argumentos de `listCampaigns`, parâmetros/valores de URL, debounce, redirect de página vazia: inalterados.
- Status: `ready` → pronta; `error` + `flow === "new"` → não concluída; demais `error` → erro; cores inalteradas.
- Miniaturas: `.thumb-v1.webp`, `eager` nos 3 primeiros / `lazy` nos demais, `decoding="async"`, fallback pré/pós-hidratação e recuperação por troca de URL inalterados.
- `Abrir` → detalhe; `Baixar`/`Descargar` → `/api/campaign/{id}/download` apenas em `ready`.
- Paginação: consumidor sem `labels` continua em pt-BR; extrato de créditos sem alteração.
- `lang="es-419"` apenas na região traduzida; `lang=""` no nome do produto e no `alt` da miniatura.

## Payload

Ver `payload.md`. A conferência de HTML/RSC entregue depende do homolog (Gate 3) e **não foi executada**.
