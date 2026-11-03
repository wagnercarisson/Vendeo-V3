---
status: complete
phase: quick
plan: 261103-cpv
date: 2026-11-03
branch: feature/traducao-da-interface-da-campanha-pronta
execution: local_complete
review: awaiting_review
homolog: not_started
homolog_date: null
publication: not_started
publication_date: null
production_acceptance: not_requested
agent_production_smoke: not_executed
sync_archive: not_executed
---

# Quick 261103-cpv — localizar a interface da campanha pronta

## Escopo executado

Somente o **Gate 2**: implementação e validação local. A interface da entrega
pronta em `/campanhas/[id]` foi localizada em pt-BR/es-419 nos caminhos legado
(`ReadyView`) e novo fluxo (`NewFlowDeliveredView`), sem traduzir conteúdo
persistido e sem alterar arte, downloads, clipboard, handlers, polling, cobrança
ou estados fora do recorte.

## Entregue

**Namespace novo**
- `src/lib/i18n/campaign-detail/messages.ts` — tipos explícitos.
- `src/lib/i18n/campaign-detail/catalogs/pt-BR.ts` — textos atuais preservados.
- `src/lib/i18n/campaign-detail/catalogs/es-419.ts` — `satisfies`, com
  `¡Copiado!` e `texto de la publicación`.
- `src/lib/i18n/campaign-detail/get-messages.ts` — resolvedor por
  `SupportedUiLocale`.
- `src/lib/i18n/campaign-detail/index.ts` — barrel local, não reexportado pelo
  global.
- Testes de catálogo e isolamento.

**Rota**
- `page.tsx` resolve `getCurrentStore` + `getUiRenderContext` em `Promise.all` e
  passa `messages`/`locale` nos três retornos. Nenhuma query/gate/URL mudou.
- `client.tsx` extraiu `resolveDeliverySurface` das condições existentes de
  renderização. O mesmo resultado decide a tela e a localização:
  - novo fluxo `delivered` ⇒ localiza;
  - legado `ready` + `regenerating` ⇒ não localiza;
  - legado `ready` + `pending` **com** `candidateImageUrl` e
    `candidateVersionId` ⇒ `CampaignApprovalView`, não localiza;
  - legado `ready` + `pending` **sem** candidata ⇒ `ReadyView`, localiza;
  - demais estados ⇒ não localiza.
- `lang="es-419"` no contêiner externo (header/breadcrumb + view); `lang=""` no
  produto, imagem e blocos de copy; `lang="pt-BR"` no modo de edição,
  `CopyRecoveryPanel`/`actionError` e feedback de falha/cancelamento da copy.
- `PageHeader` ganhou `titleLang?` e `Breadcrumb.lang?` opcionais, sem alterar o
  DOM dos demais consumidores.

**Preservações**
- Nome do produto, caption, hashtags, CTA, título da copy, data, imagem e arquivo
  intactos.
- `navigator.clipboard.writeText(text)` recebe exatamente o conteúdo original.
- `downloadUrl` e handlers inalterados.
- Modo de edição, aprovação, regeneração, recuperação, refunded, unknown, running,
  stale e error sem tradução.
- Contrato `copy-wiring-gaps` atualizado de `"Kit de Publicação"` para
  `publicationKit`, mantendo a intenção e sem enfraquecer asserções.

## Decisões aplicadas

- P1 aprovado: edição de conteúdo fora desta quick, com `lang="pt-BR"`.
- P2 aprovado: aviso fixo incluído com significado integral.
- Data mantida em `dd/mm/aaaa`; formatador intocado.
- Namespace isolado; nenhuma fase, REQ-ID, change OpenSpec, migration ou
  dependência criada.

## Gates reais (2026-11-03)

- Focados: **17 arquivos / 269 testes PASS**.
- Regressão dirigida (publication-copy/copy-recovery): **6 arquivos / 210 testes
  PASS**.
- Typecheck: **0**.
- Lint: **0** (limitação conhecida: ESLint sem cobertura de `.ts`).
- Build: **0**, 95/95 páginas; `/campanhas/[id]` **11,4 kB / 117 kB**; shared
  **102 kB**.
- `git diff --check`: limpo (apenas aviso LF→CRLF do Git).
- OpenSpec: `campaign-page-ui` e `campaign-page-tests` strict **válidos**;
  `ui-base-components` com falha estrutural **preexistente** (usa
  `> **Propósito**`, sem `## Purpose`), não corrigida por estar fora do recorte.

Evidências: `evidence/local-gates.md` e `evidence/payload.md`.

## Limitações e pendências

- **Gate 3 não iniciado.** Nenhum acesso a homolog/produção, sessão, preferência,
  banco, app em execução, merge, push ou deploy.
- Sem baseline de payload específico: mediu-se apenas a entrega final, sem troca
  de branch ou rebuild retroativo.
- `ui-base-components` continua estruturalmente inválida no OpenSpec (preexistente).
- Modo de edição e `confirm()` nativo permanecem em pt-BR; o `confirm()` não
  aceita marcação de idioma.
- Recuperação de copy e feedback de falha/cancelamento permanecem em pt-BR,
  marcados com `lang="pt-BR"`.
- Homolog deve escolher campanha pronta **sem recuperação pendente/ativa**
  (`newFlow.recovery` nulo ou `concluida`); se não houver exemplo seguro,
  registrar limitação e usar os testes automatizados.
- Suíte global completa e integrações PostgreSQL/Produto 1:1 não executadas; não
  são gates desta quick.
- Nenhuma prova com geração, aprovação, recuperação, edição de copy ou cobrança
  foi executada.

## Próximo gate

Gate 3 — homolog existente, com autorização específica. Nenhum resultado desta
entrega autoriza o Gate 3, publicação ou smoke.
