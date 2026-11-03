---
status: complete
phase: quick
plan: 261103-hlq
date: 2026-11-03
branch: feature/traducao-da-listagem-de-campanhas
execution: local_complete
review: pending
homolog: not_executed
publication: not_authorized
production_acceptance: pending
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

- **Gate 3 não executado:** prova funcional em homolog, conferência de HTML/RSC e
  restauração da preferência inicial (DTO + API) dependem de autorização específica.
- **Sem baseline de payload específico de `/campanhas`:** não houve troca de branch
  nem rebuild de aplicação em execução; mediu-se apenas a entrega final.
- **OpenSpec global não-verde:** 210 passed / 69 failed, dívida pré-existente;
  os quatro specs alterados foram avaliados individualmente.
- **Cobertura fora do recorte:** `campanhas/error.tsx` inexistente (boundary
  compartilhado segue em pt-BR) e skeleton de loading com layout pré-existente.
- **`microcopy.ts`:** constantes `CAMPAIGNS_*` preservadas sem uso na rota.
- **Publicação e smoke curto:** não autorizados; permanecem no Gate 5.

## Artefatos

- Plano: `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/261103-hlq-PLAN.md`
- Evidências: `.planning/quick/261103-hlq-traduzir-listagem-de-campanhas/evidence/`
- Resumo: este arquivo.

## Próximo gate

Revisão do usuário/Codex sobre a implementação local (Gate 2). Nenhuma ação de
homolog, merge, push ou deploy foi realizada.
