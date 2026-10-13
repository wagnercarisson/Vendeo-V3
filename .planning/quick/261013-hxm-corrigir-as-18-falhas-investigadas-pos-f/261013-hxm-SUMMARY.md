---
id: 261013-hxm
title: Corrigir as 18 falhas investigadas após o fechamento da F56.2b1b
status: complete
date: 2026-10-13
branch: feature/fase-56-1-contrato-produtivo-modelos-e-fallback
scope: post-b1b-test-failures-burndown
---

# Quick Summary — 261013-hxm

## Resultado

As **18 falhas** do escopo foram **corrigidas e reproduzidas** na branch atual. Nenhuma schema,
prompt, composer, política, versão, baseline aprovado, mapper legado ou runtime produtivo foi alterado.
**Nada de b2/b1b, banco, migrations, provider pago, instalação, ativação, deploy, push ou lifecycle
OpenSpec.** As alterações ambientais de `.opencode/**` foram preservadas (não tocadas).

Fora do escopo, a validação ampla levantou: (a) a guarda congelada `legacy-frontier` sinalizava os
caminhos `lab/bench` alterados — **resolvida com autorização explícita do responsável** (recorte 5,
`afe4cdbf`, sem afrouxar `BASE_SHA`/`LEGACY_FRONTIER_PATHS`/comparação de conteúdo/testes negativos);
(b) o `build` não conclui o export estático das páginas legais por o Supabase isolado
(`127.0.0.1:56321`) aceitar TCP mas não responder ao REST — **ambiental**, fora do import graph
alterado (ver §Pendências).

## Causas (confirmadas por reprodução antes de editar)

1. **13 fixtures (lab/bench)** — `BenchRunInputSchema.superRefine` (`schemas.ts:354`) e
   `buildBenchCampaignSnapshot` (`campaign-snapshot.ts:131`) passaram a exigir
   `offer.backgroundDirection`; fixtures antigas não informavam a direção.
2. **Snapshot (lab/bench)** — `snapshot.preserveImageContext` derivava de
   `backgroundDirection === "original"`, mas `briefSnapshot.creativeContext.preserveImageContext` vinha
   do mapper legado `buildCampaignBriefFromFlat`, que fixa `false` para `offer` e ignora a direção →
   divergência em `original`.
3. **3 timeouts de 5s** — `defaultAiModelResolver` (catálogo/seleção no Supabase) vazava para o teste:
   `providers/openai.ts:202` (`fallbackToImageApi`) e
   `services/image-generation-service.ts:158-165` (`generateImage`) consultavam o resolver real; em
   `visual-signature/ai-image-generator.test.ts` o `defaultAiGateway` real era usado no `invoke`.
4. **Teste legal** — `legal-document-versions.test.ts:14` lia a change **ativa** da F50, já arquivada.

## Recortes e arquivos (commits explícitos, sem `git add .`)

| Recorte | Commit | Arquivos |
|---|---|---|
| 1. Fixtures do laboratório (13) | `e13732a2` | `intent-schema.contract.test.ts`, `branding-service.test.ts`, `prompt-base.contract.test.ts`, `form-parity.contract.test.ts`, `run-history.contract.test.ts` |
| 2. Consistência do snapshot | `af28dc7e` | `domain/campaign-snapshot.ts`, `campaign-snapshot.test.ts` |
| 3. Timeouts de provider/resolver | `f3c96912` | `visual-signature/__tests__/ai-image-generator.test.ts`, `image-generation/providers/__tests__/openai-provider.test.ts`, `image-generation/services/__tests__/image-generation-service.test.ts` |
| 4. Teste legal | `08e6f0f2` | `legal/__tests__/legal-document-versions.test.ts` |
| 5. Reconciliação da guarda congelada | `afe4cdbf` | `product-1-1/__tests__/legacy-frontier.guard.test.ts` (7 caminhos `lab/bench` autorizados + commit) |

### Detalhe por recorte
- **1:** `backgroundDirection` explícita por cenário (`"studio"` nas fixtures de oferta; `"studio"` no
  `base` de `run-history`, pois há 2 referências e `original` exige exatamente 1). No `run-history`,
  produto/oferta receberam preço/intenção válidos (`originalPriceCents 1000 > priceCents 500`,
  `campaignIntent "offer"`) preservando a asserção de isolamento de paths
  (`invalid_bench_reference_path`). Asserções originais intactas.
- **2:** em `buildBenchCampaignSnapshot`, `preserveImageContext` é calculado **uma vez** a partir de
  `offer.backgroundDirection` e aplicado **tanto** ao snapshot quanto a
  `briefSnapshot.creativeContext.preserveImageContext` (mapper legado intocado). Adicionado teste
  matricial Original/Estúdio/Ambientado × Oferta/Destaque/Exclusivo (9 combinações) em
  `campaign-snapshot.test.ts`.
- **3:** `ai-image-generator.test.ts` injeta `invoker` fake (seam de construtor já existente);
  `openai-provider.test.ts` e `image-generation-service.test.ts` mockam `defaultAiModelResolver`
  (`vi.mock('@/lib/ai', importOriginal)`) de forma determinística, preservando `AiGateway`,
  `ModelRegistry` e `AiInvocationError` reais e as verificações de tentativa, fallback, envelopes e
  modelo efetivo. Sem elevar timeout, sem retries, sem conexão real.
- **4:** caminho passa a `openspec/changes/archive/2026-09-23-fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/`;
  verificações de não publicação e separação dos gates legais preservadas.
- **5:** reconciliação **autorizada** da guarda `legacy-frontier` (ver §Pendências item 1) — apenas os 7
  caminhos `lab/bench`, com commit por entrada, sem afrouxar `BASE_SHA`, `LEGACY_FRONTIER_PATHS`,
  comparação de conteúdo e testes negativos.

## Resultados reais

- **Focados:**
  - `src/lib/lab/bench` → **550 passed / 1 failed** após o recorte 1; **596 passed / 0 failed** (32
    arquivos) após o recorte 2 (inclui `campaign/brief-mapper` e `campaign/brief`).
  - 3 testes de timeout → **65 passed / 0 failed** em **0,7s** (sem timeout).
  - `src/lib/legal` → **39 passed / 0 failed** (8 arquivos).
- **Suíte completa (`npx vitest run`), após o recorte 5:** `Tests 5590 passed | 0 failed | 115 skipped
  (5705)`; `Test Files 16 failed | 448 passed | 2 skipped (466)`.
  - **Nenhuma falha de teste.** Os **16 arquivos** falham **apenas na coleta** por ausência do runner
    isolado (`isolated_integration_requires_runner_and_redacted_preflight` / `[ ... ]`) — **ausência de
    ambiente**, não falha de implementação; não executáveis sem autorização.
  - Guarda `legacy-frontier` **10/10** após a reconciliação autorizada.
- **Typecheck:** `tsc -p tsconfig.typecheck.json --noEmit` → **exit 0**.
- **Lint:** `eslint .` → **exit 0**.
- **Build:** `check:cnae` OK e `Compiled successfully`; falha no **export estático** de
  `/(marketing)/termos`, `/privacidade`, `/uso-aceitavel` (timeout >60s, 3 tentativas) → exit 1.
  **Ambiental** (ver §Pendências). O `build` constatou que não havia `next dev` ativo na mesma `.next`.

## Pendências

1. **Guarda congelada `legacy-frontier` — RESOLVIDA (recorte 5, `afe4cdbf`).**
   A guarda sinalizava 7 caminhos `src/lib/lab/bench/**` alterados como não autorizados
   (`expect(extra).toEqual([])`, linha 224). Com **autorização explícita do responsável**, foram
   acrescentadas exatamente 7 entradas em `AUTHORIZED_FRONTIER_CHANGES`, vinculadas aos commits de
   origem e com a descrição `"quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório"`:
   `e13732a2` para as 5 fixtures e `af28dc7e` para `domain/campaign-snapshot.ts` e
   `campaign-snapshot.test.ts`. **Preservados** `BASE_SHA`, `LEGACY_FRONTIER_PATHS`, a comparação de
   conteúdo com o commit aprovado e os testes negativos. Guarda **10/10**.

2. **Build bloqueado por ambiente.** As páginas `/(marketing)/termos|privacidade|uso-aceitavel` chamam
   `getCurrentVersion()` → `supabaseAdmin` em tempo de export estático. `.env.local` aponta para o
   Supabase **isolado** `http://127.0.0.1:56321`, cujo REST **aceita TCP mas não responde** (probe REST
   → timeout). Nenhum arquivo alterado por este quick participa desse caminho de import. Corrigir exige
   o stack isolado operacional (banco) — fora do escopo autorizado. Não é regressão das correções.

## Reprodução dos comandos

- `npx vitest run src/lib/lab/bench src/lib/campaign/__tests__/brief-mapper.test.ts src/lib/campaign/__tests__/brief.test.ts`
- `npx vitest run src/lib/visual-signature/__tests__/ai-image-generator.test.ts src/lib/image-generation/providers/__tests__/openai-provider.test.ts src/lib/image-generation/services/__tests__/image-generation-service.test.ts`
- `npx vitest run src/lib/legal`
- `npx vitest run` · `npm.cmd run typecheck` · `npm.cmd run lint` · `npm.cmd run build`

## Proibições respeitadas

Sem banco/migrations/reset/`db push`; sem provider pago; sem instalação de dependências; sem ativação;
sem deploy; sem push; sem lifecycle OpenSpec; sem início da b2. `.opencode/**` preservado.
**Parado para revisão final.**
