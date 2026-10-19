---
id: 261019-dl1
title: Corrigir a entrega do download do Produto 1:1 (attachment seguro, sem redirect de exibição)
status: done
workflow: gsd-quick
scope: product-1-1-download-delivery-attachment-safe-filename
approval:
  by: usuário
  date: 2026-10-19
  origin: achado UAT-56.2.6-01 durante o piloto N=1 da fase 56.2.6
  human_acceptance:
    scope: download local do novo fluxo (200 attachment, nome seguro, tipo correto)
    by: responsável (usuário)
    date: 2026-10-19
gates:
  typecheck: pass
  lint: pass
  build: pass
  unit_route_tests: pass (22/22)
  isolated_integration: pass (7/7, Postgres/Storage locais, provider simulado)
  result_states_contract: pass (21/21)
  legacy_frontier: pass (10/10; dois testes Luna reconciliados por caminho+commit 3d6e5763)
  paid_calls: none
  deploy: none
  feature_flags: unchanged
evidence:
  uat: .planning/phases/56.2.6-f56-2b2d-piloto-hospedado-do-produto-1-1-em-lojas-de-teste/56.2.6-UAT.md
related:
  - .planning/phases/56.2.6-f56-2b2d-piloto-hospedado-do-produto-1-1-em-lojas-de-teste/56.2.6-UAT.md
  - src/app/api/campaign/[id]/download/route.ts
  - src/lib/product-1-1/artifact/artifact-store.ts
  - src/lib/product-1-1/artifact/types.ts
  - src/lib/campaign/download-filename.ts
---

# Quick — 261019-dl1 — download do novo fluxo — SUMMARY

**Escopo:** corrigir a **entrega** do download do Produto 1:1 (achado UAT-56.2.6-01) sem
alterar autenticação, ownership, classificação persistida, exigência de `delivered`, arte
íntegra, URL de exibição ou o ramo legado.

## O que mudou

- `src/app/api/campaign/[id]/download/route.ts`
  - Após `decideNewFlowDownload` liberar, a rota **baixa os bytes** e responde `200` com
    `Content-Type: image/jpeg`, `Content-Disposition: attachment; filename="<seguro>.jpg"`
    e `Cache-Control: private, no-store`. **Não** há mais `302` para a URL de exibição.
  - Falha de Storage/integridade na entrega ⇒ `502` (fail-closed).
  - O ramo legado (F37 + `campaign-images.download`) permanece e passou a usar o mesmo
    helper de nome seguro — mesmo resultado de antes.
- `src/lib/product-1-1/artifact/artifact-store.ts`
  - Novo `downloadArtifact(storagePath)`: valida o caminho do novo fluxo, baixa do bucket
    privado, **revalida JPEG 1024×1024** e devolve bytes + `image/jpeg`. Sem assinatura.
- `src/lib/product-1-1/artifact/types.ts`
  - Novo código tipado `artifact_download_failed`.
- `src/lib/campaign/download-filename.ts` (novo)
  - `buildSafeDownloadFilename` reutilizado pelos dois ramos.
- Testes atualizados/novos: rota (permitido, `art_uploaded`, `unknown`, `refunded`,
  `absent`/`invalid`/`indeterminate`, Storage 502, marcador sem operação 503,
  classificação indeterminada 503, ownership 404, legado), integração real e contratos de
  estados/fronteira.

## Invariantes verificados

- Autenticação + ownership + isolamento entre lojas continuam antes de qualquer leitura de
  arte (404/401).
- `delivered` + arte `integral` é o **único** estado que libera; `art_uploaded` sozinho não.
- Classificação persistida manda: marcador presente sem operação ⇒ 503; nunca cai no legado.
- URL de exibição da página **não** foi tocada.
- Nenhum deploy, nenhuma flag, nenhuma chamada paga, nenhuma migration.

## Validação local

- Teste da rota com fixture no formato da campanha do N=1 (Adega/`51 Ice Maça Verde 275ml`,
  `created_at` de 2026-10-19), sem geração paga: **22/22**.
- Integração contra Postgres/Storage **locais reais** (campanha/artefato criados no banco
  isolado, provider simulado): **7/7** — inclui 200 attachment, 403 antes de `delivered`,
  404 de ownership e zero URL assinada para download.
- `tsc --noEmit`, `eslint .` e `next build`: **pass**.

## Guarda de fronteira (ajuste dirigido)

- O ramo legado da rota de download é comparado por **conteúdo do bloco completo**
  (gate F37 + storage privado + resposta + fechamento) contra o commit aprovado
  `e3fb664e`. A única diferença admitida é a extração **exata** do cálculo do nome para
  `buildSafeDownloadFilename`; qualquer outra alteração no bloco falha.
- Os dois testes Luna da quick `261018-k9c` foram adicionados à allowlist por **caminho e
  commit específicos** (`3d6e5763`), sem liberar diretórios ou prefixos amplos.

## Pendente de autorização

- Commit local autorizado pelo responsável; **sem push, deploy, alteração de flags ou
  chamada paga**.
- **Não** houve encerramento da fase 56.2.6.
