---
status: complete
phase: quick
plan: 261103-jjc
date: 2026-11-03
branch: feature/traducao-da-listagem-de-novidades
execution: local_complete
review: pending
homolog: executed_pass_with_limitations
homolog_date: 2026-11-03
publication: not_authorized
production_acceptance: pending
sync_archive: not_executed
---

# Quick 261103-jjc — localizar a interface de `/novidades`

## Escopo executado

Localização dos textos fixos da página `/novidades` em pt-BR e es-419, com
namespace isolado por rota e resolução server-first do idioma. Sem tradução de
conteúdo editorial, sem alterar o formatador de datas, a landing ou a
localização F58 do dashboard. Sem homolog, sessão, preferência, banco,
migrations, dependências, push, merge ou deploy.

## Entregue

**Namespace novo**
- `src/lib/i18n/novidades/messages.ts` — tipos explícitos e `NovidadesMessages`.
- `src/lib/i18n/novidades/catalogs/pt-BR.ts` — textos atuais.
- `src/lib/i18n/novidades/catalogs/es-419.ts` — `satisfies NovidadesMessages`.
- `src/lib/i18n/novidades/get-messages.ts` — resolvedor por `SupportedUiLocale`.
- `src/lib/i18n/novidades/index.ts` — barrel local, não reexportado pelo global.
- Testes de catálogo e isolamento.

**Página**
- `src/app/(app)/novidades/page.tsx` — `requirePageUser` + `getUiRenderContext`,
  `lang="es-419"` escopado, título/breadcrumb/empty state localizados e
  `ChangelogList` com rótulos e `emptyLabel`.
- `NovidadesClient`, `latestEntryId`, `latestAnnouncementId` e o efeito de
  visto/dispensa preservados.

**Componentes compartilhados**
- `src/components/changelog/changelog-list.tsx` — `labels`/`emptyLabel`
  opcionais, default pt-BR.
- `src/components/changelog/changelog-card.tsx` — rótulos de categoria e
  `Importante` por props; data inalterada; `lang="pt-BR"` no título/body
  editorial e `lang=""` no milestone.
- Landing sem props continua em pt-BR; dashboard preserva a localização F58.

**Spec**
- `openspec/specs/changelog-ui/spec.md` — requisito de localização da interface
  de `/novidades`, separação UI × editorial, `lang`, data atual e defaults pt-BR.

## Decisões aplicadas

- Namespace isolado, sem entrada no payload global.
- Dashboard preserva a localização existente da F58 e seus textos editoriais.
- `milestone` com `lang=""`; título/body editoriais com `lang="pt-BR"` sempre.
- Formatador de data **intocado** (`dd/mm/aaaa`, sem `Date`/`Intl`/timezone).
- Nenhuma fase F57.5/F57.6 ou REQ-ID de fase criada.

## Gates

- Focados: **4 arquivos / 22 testes PASS**.
- Regressão dirigida: **12 arquivos / 93 testes PASS** (exit 0).
- Typecheck: **0**.
- Lint: **0** (limitação conhecida: sem cobertura de `.ts`).
- Build: **0**; `/novidades` **1,31 kB / 107 kB**; shared **102 kB**.
- `git diff --check`: **limpo**.
- `openspec validate changelog-ui --type spec --strict`: **válido**.

Evidências: `evidence/local-gates.md` e `evidence/payload.md`.

## Limitações e pendências

- **Gate 3 executado no homolog local** em 2026-11-03: PASS com limitações em `evidence/gate3-homolog.md`.
- **Sem baseline específico de `/novidades`:** mediu-se apenas a entrega atual; `shared` segue em 102 kB.
- **`Correção`/`Corrección` não observada** (não há entrada `fix` no conteúdo atual); coberta pelo teste automatizado.
- **Cenário sem entradas** não observado (há 14 entradas); coberto pelo teste automatizado, sem remover conteúdo.
- **Leitor de tela real** não executado; foco por teclado e Escape do modal da landing verificados.
- `ChangelogAnnouncement` no modo completo mantém rótulos pt-BR fixos; não é renderizado por `/novidades` e ficou fora do recorte.
- `sync`/`archive` não executados; o main spec foi atualizado diretamente.

## Gate 3 — homolog local

- App reiniciado sobre o build atual (`tLGQjcPHxHdtHGx2mxsdu`), sem rebuild/troca de branch.
- Preferência: `pt-BR`/`explicit` v12 → `es-419` v13 → restaurada `pt-BR`/`explicit` **v14**.
- pt-BR: título/breadcrumb, `Melhoria`/`Nova funcionalidade`, 11 `Importante`, datas `02/11/2026` etc., editorial intacto.
- es-419: `Novedades`, `Panel`, `Mejora`/`Nueva funcionalidad`, `Importante`, mesmas datas; editorial em `lang="pt-BR"`, milestone `v1.5` com `lang=""`, região `lang="es-419"` e documento `pt-BR`.
- Badge: visível antes da visita; removido após `/novidades`, com `last_seen_changelog_id` e `dismissed_changelog_announcement_id` atualizados.
- Landing pt-BR: modal mantém categorias/datas em português, fecha com Escape e devolve foco ao botão.
- Dashboard es-419 mantém localização F58; `/dashboard` e `/conta` sem catálogo de novidades.
- Desktop/mobile sem overflow; payload em `evidence/payload.md`.
- Sessão descartada (`/auth/signout`, 401) e perfil temporário removido.

## Artefatos

- Plano: `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/261103-jjc-PLAN.md`
- Evidências: `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/evidence/`
  - `gate3-homolog.md`, `gate3-results.json`, `local-gates.md`, `payload.md`
  - capturas `gate3-novidades-pt-desktop.png`, `gate3-novidades-es-desktop.png`, `gate3-novidades-pt-mobile.png`, `gate3-novidades-es-mobile.png`, `gate3-landing-pt-modal.png`
- Resumo: este arquivo.

## Próximo gate

Revisão do usuário/Codex e aceite visual do Gate 3. Publicação e smoke de produção
não iniciados; nenhum push, merge ou deploy foi realizado.
