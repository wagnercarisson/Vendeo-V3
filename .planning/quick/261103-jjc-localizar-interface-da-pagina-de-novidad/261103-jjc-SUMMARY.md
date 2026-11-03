---
status: complete
phase: quick
plan: 261103-jjc
date: 2026-11-03
branch: feature/traducao-da-listagem-de-novidades
execution: local_complete
review: pending
homolog: not_executed
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

- **Gate 3 não executado:** homolog, prova visual/navegação, HTML/RSC entregue
  e restauração de preferência/estado de leitura dependem de autorização específica.
- **Sem baseline específico de `/novidades`:** mediu-se apenas a entrega atual;
  `shared` segue em 102 kB.
- **Cenário sem entradas** pode não existir no homolog: se ausente, registrar
  como não observado e citar o teste automatizado.
- **Leitor de tela real** não executado; foco por teclado será verificado no Gate 3.
- `ChangelogAnnouncement` no modo completo mantém rótulos pt-BR fixos; não é
  renderizado por `/novidades` e ficou fora do recorte.
- `sync`/`archive` não executados; o main spec foi atualizado diretamente.

## Artefatos

- Plano: `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/261103-jjc-PLAN.md`
- Evidências: `.planning/quick/261103-jjc-localizar-interface-da-pagina-de-novidad/evidence/`
- Resumo: este arquivo.

## Próximo gate

Revisão do usuário/Codex sobre a implementação local (Gate 2). Nenhuma ação de
homolog, sessão, preferência, push, merge ou deploy foi realizada.
