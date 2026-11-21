# Phase 61 — Padrões existentes e análogos

Mapa de padrões já estabelecidos que os planos devem seguir. Não substitui as specs; evita exploração repetida durante a execução.

## 1. Catálogo i18n por namespace de rota

**Análogos:** `src/lib/i18n/campaign-list/**`, `src/lib/i18n/dashboard/**`, `src/lib/i18n/campaign-detail/**`.

Padrão:

- `messages.ts` com interfaces explícitas (`readonly`, sem index signature, sem `any`).
- `catalogs/pt-BR.ts` como fonte de verdade; `catalogs/es-419.ts` tipado contra a **mesma** interface (chave faltante quebra o typecheck).
- `Object.freeze` em todos os níveis.
- `get-messages.ts` consome `SupportedUiLocale` e retorna um catálogo; sem resolvedor paralelo.
- `__tests__/catalogs.test.ts` achata o objeto e compara conjuntos de chaves + placeholders (`{count}` etc.).
- `__tests__/isolation.test.ts` prova estaticamente que o namespace da rota não é reexportado pelo catálogo global nem importado por shell/layout/admin.

Uso na fase: `src/lib/i18n/campaign-formats/` replica esse padrão, mas é **compartilhado** e referenciado por três namespaces via propriedade `formats` (mesma referência de objeto por locale).

## 2. Modelo puro sem I/O

**Análogos:** `src/lib/campaign/format-resolution.ts`, `src/lib/product-two-format/types.ts`, `src/lib/campaign/two-format-outcome.ts`.

Padrão:

- Sem `server-only`, sem cliente Supabase, sem `fetch`, sem `react`.
- Resultados discriminados, `Object.freeze`, nunca lançam.
- Comentário de cabeçalho declara a autoridade e o que o módulo **não** faz.
- Testes em `src/lib/<área>/__tests__/*.test.ts`, ambiente `node` (default), tabela de casos.

Uso na fase: `src/lib/campaign/format-presentation.ts` importa apenas `import type` de `./format-resolution`; o estado conjunto é uma união local estruturalmente idêntica (`CampaignFormatDeliveryState`), sem import de `product-two-format`.

## 3. DTOs server-side para a UI

**Análogos:** `src/lib/campaign/list.ts` (`CampaignListItem`), `src/lib/dashboard/campaigns.ts` (`EligibleCampaignCard`), `src/lib/campaign/display.ts` (`CampaignPageProps`).

Padrão:

- `import "server-only"` no módulo de leitura.
- O cliente recebe apenas campos de apresentação; `input_snapshot` e `storage_path` **não** cruzam a fronteira (o dashboard já documenta `T-58-01`).
- Classificação persistida é feita no servidor (`classifyCampaignFlow`, `resolveCampaignFormat`, `classifyTwoFormatCampaign`).
- Leitura conjunta em lote: `readTwoFormatListSummaries` (lista/dashboard) e `readTwoFormatDelivery` (detalhe) são as autoridades; não duplicar derivação.

Uso na fase: adicionar `formatPresentation` ao DTO; builders são chamados no servidor; campos legados (`format`, `joint`, `formats`, `preferredFormat`) permanecem para miniatura e `?format=` das ações atuais.

## 4. Componentes de UI

**Análogos:** `src/components/dashboard/available-campaign-card.tsx`, `src/components/ui/button.tsx`, `src/components/ui/card.tsx`, `src/components/ui/empty-state.tsx`.

Padrão:

- Client Components declaram `"use client"` no topo.
- Classes Tailwind com tokens do design system (`bg-bg-surface`, `bg-bg-elevated`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `text-accent-green`, `accent-green/10`).
- Alvo mínimo de toque `min-h-[44px]` (ou `min-h-11`).
- Foco visível: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep`.
- Ícones `lucide-react` com `aria-hidden="true"`; nunca emojis.
- Conteúdo persistido (nome do produto, copy) marcado `lang=""`; região traduzida `lang="es-419"` quando aplicável.
- Sem light mode; sem `dangerouslySetInnerHTML`.
- Layout responsivo: `flex flex-wrap`, `min-w-0`, `break-words`; evitar larguras fixas que empurrem ações/miniatura.

## 5. Testes de componente e de página

**Análogos:**

- Componente: `src/components/dashboard/__tests__/available-campaign-card.test.tsx` (`// @vitest-environment jsdom`, `@testing-library/jest-dom/vitest`, mock de `next/link`).
- Página server: `src/__tests__/app/campanhas/campaign-detail-joint.test.tsx` (`// @vitest-environment node`, `vi.hoisted` para fixtures, mocks de auth/i18n/display, contador de chamadas).
- Lista/dashboard: `src/lib/campaign/__tests__/campaign-list-joint.test.ts` (mock de `readTwoFormatListSummaries` e de `supabaseAdmin.storage` com `createSignedUrl(s)` espionados).

Padrão:

- Nome do arquivo descreve o comportamento; `describe` por contrato.
- Asserções de ausência são explícitas (`queryByText("Não gerado")` nulo, `querySelectorAll("a")` contagem).
- Contagem de chamadas por `vi.fn()` + `toHaveBeenCalledTimes`.
- Não usar snapshot amplo; preferir consultas por papel/texto.

## 6. Parser estrito de `?format=`

**Análogo:** `parseJointFormatRequest` em `src/app/(app)/campanhas/[id]/page.tsx` (`absent` | `invalid` | `valid`; duplicado chega como array ⇒ `invalid`).

Uso na fase: **não alterar**. Os chips apenas consomem `props.joint.previewFormat`/`requestedFormatInvalid` já calculados.

## 7. Padrão de "estado honesto"

**Análogos:** `NonActivationBanner`, `UnknownResultPanel`, `StaleView`, mensagens de `dashboard.failure*`.

Padrão: estados indeterminados exibem linguagem de indisponibilidade/verificação; nunca convertem erro em ausência; nunca prometem recuperação automática.

Uso na fase: `unknown` → “Não foi possível confirmar”; `unavailable` → “Indisponível”; proibido “Não gerado”.

## 8. Comandos de verificação do projeto

- Typecheck: `npm.cmd run typecheck`
- Lint: `npm.cmd run lint`
- Teste dirigido: `npx vitest run <arquivo...>` (Windows: `npx.cmd` se o shim falhar)
- Suíte global: `npm.cmd run test` (script `scripts/testing/run-local-suite.mjs`)
- Build: `npm.cmd run build` (inclui `check:cnae`)
- Diff: `git diff --check` / `git status --porcelain`
