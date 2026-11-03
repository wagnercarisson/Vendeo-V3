---
status: complete
phase: quick
plan: 261103-hlq
date: 2026-11-03
branch: feature/traducao-da-listagem-de-campanhas (integrada e enviada; worktree atual em main, HEAD dd82d5d6)
execution: local_complete
review: accepted_by_owner
homolog: executed_pass_with_limitations
homolog_date: 2026-11-03
publication: executed_by_responsible
publication_date: 2026-11-03
production_acceptance: confirmed_reported_by_owner
agent_production_smoke: not_executed
sync_archive: not_executed
---

# Quick 261103-hlq — traduzir a listagem de campanhas para pt-BR e es-419

## Escopo executado

Localização da listagem `/campanhas` com namespace isolado por rota, resolução
server-first do idioma e paridade pt-BR/es-419. Sem `/campanhas/[id]`, criação,
dashboard, conta, admin, shell, banco, migrations, dependências, homolog, push,
merge ou deploy.

## Entregue

**Namespace novo**
- `src/lib/i18n/campaign-list/messages.ts` — tipos explícitos, sem `any`.
- `src/lib/i18n/campaign-list/catalogs/pt-BR.ts` — strings idênticas às anteriores.
- `src/lib/i18n/campaign-list/catalogs/es-419.ts` — `satisfies CampaignListMessages`.
- `src/lib/i18n/campaign-list/get-messages.ts` — resolvedor por `SupportedUiLocale`.
- `src/lib/i18n/campaign-list/format-date.ts` — data por `Intl` no idioma, sem `timeZone`.
- `src/lib/i18n/campaign-list/index.ts` — barrel local, não reexportado pelo global.
- Testes: `catalogs.test.ts`, `isolation.test.ts`, `format-date.test.ts`.

**Rota**
- `src/app/(app)/campanhas/page.tsx` — `getCurrentStore` + `getUiRenderContext` em
  paralelo; `lang="es-419"` escopado; textos do namespace; passa `messages` e
  `locale` ao cliente. Query, argumentos de `listCampaigns`, redirect e
  `URLSearchParams` inalterados.
- `src/app/(app)/campanhas/client.tsx` — título, busca (placeholder + `aria-label`),
  filtros de status/período, ordenação, empty states, status do card, ações e
  paginação localizados; data por locale; `lang=""` no nome do produto e no `alt`;
  `aria-label` em período/ordenação. Busca, debounce, valores de URL, miniaturas,
  fallback e Abrir/Baixar preservados.

**Compartilhado**
- `src/components/ui/pagination.tsx` — `labels?: Partial<PaginationLabels>`, com
  padrão exato `"<< Anterior"` / `"Próximo >>"`; consumidores sem `labels`
  (extrato de créditos) inalterados.

**Testes atualizados**
- `src/__tests__/app/campanhas/campanhas-page.test.tsx` (mock de `getUiRenderContext`,
  casos es-419, sem loja, pt-BR sem `lang`).
- `src/__tests__/app/minhas-campanhas.test.tsx` (mock do contexto i18n).
- `src/__tests__/app/minhas-campanhas-client.test.tsx` (props novas, casos es-419,
  nomes acessíveis, `lang=""`, estados vazios; data comparada aos componentes locais).
- `src/__tests__/components/ui/pagination.test.tsx` (rótulos localizados e merge parcial).

**Specs principais**
- `openspec/specs/campaign-list-ui/spec.md` — localização da listagem e rótulos acessíveis.
- `openspec/specs/pagination-component/spec.md` — rótulos opcionais com padrão pt-BR.
- `openspec/specs/campaign-list-tests/spec.md` — testes de localização.
- `openspec/specs/empty-states/spec.md` — empty states de `/campanhas` por idioma.

## Decisões aplicadas

- P1 aprovada: `aria-label` traduzido em busca, período e ordenação; chips sem grupo.
- P2: quick isolada, sem F57.5 ou registro de fase.
- R3: política atual de fuso mantida; `Intl` sem `timeZone` e teste independente do fuso.
- R4: `Lista/Listas` e `No completada` adotados.
- Datas formatadas no cliente, preservando a semântica local anterior.

## Gates

- Focados: **7 arquivos / 64 testes PASS**.
- Regressão dirigida: **17 arquivos / 162 testes PASS**.
- Typecheck: **exit 0**.
- Lint: **exit 0** (limitação conhecida: sem cobertura de `.ts`).
- Build: **exit 0**; `/campanhas` **4,58 kB / 110 kB**; shared **102 kB**.
- `git diff --check`: **limpo**.
- OpenSpec individual: `campaign-list-tests` e `empty-states` válidos;
  `campaign-list-ui` e `pagination-component` mantêm falhas estruturais
  pré-existentes (sem `## Purpose`; requisitos antigos sem `SHALL`/cenários),
  sem novo erro nos requisitos adicionados.

Evidências: `evidence/local-gates.md` e `evidence/payload.md`.

## Preservações comprovadas

- Mesmas campanhas, contagens, filtros, ordenação, valores de URL e redirect.
- Identificadores de status e regra `ready` / erro de novo fluxo / demais erro.
- Miniaturas `.thumb-v1.webp`, `eager`/`lazy`, `decoding`, fallback pré/pós-hidratação
  e recuperação por troca de URL.
- `Abrir` e `Baixar`/`Descargar` com destinos e visibilidade inalterados.
- Nome de produto, dados persistidos, textos comerciais e artes não traduzidos.
- Extrato de créditos e admin permanecem em pt-BR.

## Limitações e pendências

- **Gate 3 executado no homolog local** em 2026-11-03: PASS com limitações registradas em `evidence/gate3-homolog.md`.
- **Sem baseline antigo de payload:** não houve troca de branch nem rebuild retroativo; mediu-se apenas a entrega atual (build + HTML/RSC).
- **OpenSpec global não-verde:** 210 passed / 69 failed, dívida pré-existente;
  os quatro specs alterados foram avaliados individualmente.
- **Cobertura fora do recorte:** `campanhas/error.tsx` inexistente (boundary
  compartilhado segue em pt-BR) e skeleton de loading com layout pré-existente.
- **`microcopy.ts`:** constantes `CAMPAIGNS_*` preservadas sem uso na rota.
- **Publicação:** realizada pelo responsável (merge/push/deploy informados). O **smoke de produção não foi executado pelo agente**; os cenários não revalidados permanecem com prova local/homolog.

## Gate 3 — homolog local

- Build e start locais no HEAD então vigente (`96e4ef1b`), app em `127.0.0.1:3000`, Supabase local `57781`.
- Sessão temporária via Admin API local; nenhum cookie/token impresso ou versionado; sessão descartada (`/auth/signout`, verificação 401).
- Preferência: `pt-BR`/`explicit` v10 → `es-419` v11 → restaurada `pt-BR`/`explicit` **v12**.
- Paridade pt-BR × es-419 em URL, contagem, ordem/produtos e status equivalentes nos 8 cenários.
- `lang="es-419"` apenas na região traduzida; produto/alt com `lang=""`; documento em `pt-BR`.
- `Abrir` navegou para campanha existente; download original `image/jpeg` 251.525 B × miniatura `image/webp` 15.678 B.
- Miniaturas: eager nos 3 primeiros, lazy nos demais; fallback simulado no DOM (não natural).
- Desktop 1440×900 e mobile 390×844 sem overflow; controles empilhados.
- Payload: HTML pt 66.666 B / es 67.601 B; `/conta` sem strings exclusivas da listagem.
- Limitações: `Não concluída` não observada nos dados (coberta por teste), empty state sem campanhas não observável, fallback simulado, leitor de tela real não executado.

## Aceite de produção (relato do responsável)

O responsável informou em 2026-11-03:

- **merge, push e deploy realizados**;
- **produção validada** para textos, busca, filtros, navegação e idiomas pt-BR/es-419;
- **visual desktop/mobile aprovado anteriormente no homolog**.

**Distinção de autoria das provas**

- O agente **não executou** smoke, navegação ou medição em produção.
- Não foram revalidados em produção: download da arte original, miniaturas/fallback, paginação, estado `Não concluída`/`No completada`, payload entregue e restauração de preferência. Essas provas permanecem **local/homolog** (`gate3-homolog.md`, `gate3-results.json`, `local-gates.md`).
- Nenhum SHA de deploy ou identificador de deployment foi informado; não foram inferidos.
- Nenhum novo teste foi executado nesta etapa; nenhum código foi alterado.

**Fechamento:** quick **261103-hlq concluída**. Não foi criada fase F57.5. `sync`/`archive` **não executados** — os main specs foram atualizados diretamente na implementação.

## Artefatos

- Plano: `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/261103-hlq-PLAN.md`
- Evidências: `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/evidence/`
  - `gate3-homolog.md`, `gate3-results.json`, `gate3-shell-payload.json`
  - `production-acceptance.md` (relato do responsável)
  - capturas `gate3-pt-desktop.png`, `gate3-es-desktop.png`, `gate3-es-desktop-empty.png`, `gate3-pt-mobile.png`, `gate3-es-mobile.png`
  - `local-gates.md`, `payload.md`
- Resumo: este arquivo.

## Próximo gate

Nenhum gate automático pendente. Publicação, aceite funcional e visual foram
informados pelo responsável; o agente não executou smoke de produção.
