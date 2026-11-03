# Evidência local — quick 261103-jjc

**Data:** 2026-11-03
**Branch:** `feature/traducao-da-listagem-de-novidades`
**Escopo:** implementação local do plano aprovado (Gate 2). Sem homolog, sessão, preferência, reinício, merge, push ou deploy.

## Gates executados

| Gate | Comando | Resultado |
|---|---|---|
| Focados | `npm.cmd test -- src/lib/i18n/novidades src/components/changelog/__tests__/changelog-list.test.tsx src/__tests__/app/novidades/novidades-page.test.tsx` | **4 arquivos / 22 testes PASS** |
| Regressão dirigida | `npm.cmd test -- src/lib/i18n/novidades src/components/changelog src/__tests__/app/novidades src/components/landing/__tests__/landing-page.test.tsx src/components/dashboard/__tests__/dashboard-news.test.tsx src/__tests__/app/dashboard/dashboard-localization.test.tsx src/__tests__/components/shell/shell-localization.test.tsx src/__tests__/app/home-metadata.test.ts src/__tests__/app/sitemap.test.ts` | **12 arquivos / 93 testes PASS** (exit 0) |
| Typecheck | `npm.cmd run typecheck` | **exit 0** |
| Lint | `npm.cmd run lint` | **exit 0** (limitação conhecida: ESLint sem cobertura de `.ts`) |
| Build | `npm.cmd run build` | **exit 0**; `/novidades` **1,31 kB / 107 kB**; shared **102 kB** |
| Diff | `git diff --check` | **limpo** |
| OpenSpec | `openspec validate changelog-ui --type spec --strict` | **válido** |

Observação: o aviso de `Browserslist/caniuse-lite` apareceu em stderr no PowerShell e não afetou o runner; a reexecução via `cmd /c` confirmou **exit 0**.

O runner local informou, antes e depois, que os gates de PostgreSQL/homolog, PostgreSQL local, F50.4, app-env e Produto 1:1 **não foram executados**. Nenhum ambiente externo foi acessado.

## Preservações comprovadas por teste

- Título/breadcrumb/empty state/categorias/`Importante` localizados em es-419.
- Título, corpo, milestone e data editoriais inalterados.
- `lang="pt-BR"` no título/body editoriais e `lang=""` no milestone; `lang="es-419"` apenas na região traduzida.
- Data mantida `dd/mm/aaaa`, sem alteração do formatador.
- `ChangelogList`/`ChangelogCard` sem rótulos continuam em pt-BR (landing).
- `ChangelogAnnouncement` compacto e `SidebarBadge` sem regressão.
- Nenhuma mudança em `content/changelog/**`, IDs de localStorage, ordenação, anúncio, visto, dispensa, links ou Markdown.

## Payload

Ver `payload.md`. A conferência de HTML/RSC entregue depende do Gate 3 e **não foi executada**.
