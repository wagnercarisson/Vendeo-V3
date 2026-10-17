---
id: 261017-cdi
title: Priorizar a identidade da loja e a separação visual do produto em fundos recriados (Produto 1:1)
status: done
scope: product-1-1-prompt-composition
approval:
  by: responsável (owner)
  date: 2026-10-17
  origin: quick 261017-cdi (investigação read-only + duas rodadas de orientação do responsável)
evidence: .planning/quick/261017-cdi-investigar-dominancia-das-cores-do-produto-sobre-a-identidade-da-loja/261017-cdi-SUMMARY.md
files_modified:
  - src/lib/product-1-1/identity-context.ts (novo)
  - src/lib/product-1-1/background-direction.ts
  - src/lib/product-1-1/prompt-composition.ts
  - src/lib/product-1-1/policies/registry.ts
  - src/lib/product-1-1/orchestration/generation-orchestrator.ts
  - src/app/api/campaign/generate-image/route.ts
  - src/lib/product-1-1/__tests__/fixtures/prompt-composition.baseline.json
  - src/lib/product-1-1/__tests__/prompt-composition.contract.test.ts
  - src/lib/product-1-1/__tests__/prompt-composition.equivalence.test.ts
  - src/lib/product-1-1/__tests__/identity-context.contract.test.ts (novo)
  - src/lib/product-1-1/__tests__/orchestration.contract.test.ts
  - src/lib/product-1-1/__tests__/non-activation.contract.test.ts
  - src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts
  - openspec/specs/product-1-1-prompt-composition/spec.md
  - .planning/STATE.md
---

# Quick Plan — 261017-cdi (EXECUTADO — local, sem provider)

## Objetivo

Transportar a **identidade visual da loja** (paleta canônica resolvida) ao prompt do Produto 1:1 e orientar seu uso em **fundos recriados** (estúdio/ambientado) com poucas instruções, sem duplicações nem conflitos, preservando os contratos de produto, oferta, logo/assinatura e direção escolhida. Genérico (não exclusivo de Red Bull).

## Correções da revisão do responsável (2ª rodada)

1. **Cor de apoio alinhada à tela.** O acento passa a seguir `brand_colors_chosen[1]` → `safe_color_tokens.accent` (antes só `accent`). Reprodução do relato (#AABBCC escolhida → #445566 enviada) coberta por teste.
2. **Neutro restrito a fundos recriados.** A orientação neutra (sem paleta) é emitida **somente** em estúdio/ambientado; em `original` **não** é emitida (não conflita com a preservação do cenário). Texto: *“Sem paleta da loja definida, use cores neutras e discretas.”* Coberto pelo **prompt completo com identidade** nas 9 combinações.
3. **Versão da identidade registrada.** `PRODUCT_1_1_IDENTITY_CONTEXT_VERSION` entra em `policyVersions.identidade` (evidência `policy_versions`) e é coberta por teste de determinismo: mesma identidade ⇒ mesmo fingerprint; mudança de cor ⇒ fingerprint diferente (`computeContentFingerprint`).
4. **Proveniência do baseline corrigida.** A fixture v7 deixa de apontar para o commit documental `765fbe4d`: `sourceCommit: null`, `technicalBaseline: true`, `visualApproval.status: "pending"`, e `previousBaseline` = baseline de laboratório aprovado `99017f35`. **Expectativa técnica ≠ aprovação visual.**

## O que foi implementado

### A. Dados de identidade (`src/lib/product-1-1/identity-context.ts`, novo)
- **Paleta canônica resolvida**, emitida **uma única vez**, com precedência documentada e alinhada à tela: principal `brand_colors_chosen[0]` → `safe_color_tokens.primary` → `brand_color`; acento `brand_colors_chosen[1]` → `safe_color_tokens.accent`. Sem fonte válida ⇒ `null`.
- **Presença/ausência reconciliada**: reaproveita o texto legado de `deriveDirective` e **remove** a cláusula “perfil de marca … não obrigatório” (o legado permanece intacto; a reconciliação é só no novo fluxo).
- Sem paleta ⇒ **orientação neutra explícita, apenas em fundos recriados**.

### B. Redação de fundo (`background-direction.ts` + `prompt-composition.ts`)
- **Estúdio:** “Use um fundo de estúdio discreto **na paleta da loja**, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.”
- **Ambientado:** “Crie um cenário coerente com o produto, **incorporando a paleta da loja em elementos do ambiente**, sem prejudicar a leitura.”
- **Orientação comum de contraste**, emitida **uma única vez** e **somente** para estúdio/ambientado.
- **Original:** instrução mantida, **sem** paleta e **sem** orientação de contraste.
- Instruções antigas **substituídas** (sem acúmulo); sem proibição genérica de cores da embalagem; sem repetir fidelidade/comercial.

### C. Separação das referências (`generation-orchestrator.ts`)
- A composição recebe **apenas** referências de **produto**; a identidade não conta nem dispara a hierarquia de múltiplas imagens. Referências de produto adicionais continuam contando.

### D. Congelamento (`route.ts`)
- `input_snapshot.identityDirective` (bloco reconciliado) + `input_snapshot.identityContext`; `briefing.identity` na evidência; `policyVersions.identidade` registrada. **Histórica intocada** (sem migration).
- Alteração da rota é **aditiva** (nenhuma linha existente removida) — compatível com a guarda de fronteira.

### Versões
- `COMPOSER_VERSION`: `v6` → **`48.2.4-prompt-composer-v7`**.
- `PRODUCT_1_1_BACKGROUND_DIRECTION_VERSION`: `v1` → **`48.2.6-background-direction-v2`**.
- `PRODUCT_1_1_IDENTITY_CONTEXT_VERSION` = **`48.2.6-identity-context-v1`** (agora em `policyVersions.identidade`).
- Demais políticas inalteradas.

## Antes × Depois (caso real: Adega / Red Bull Morango & Pêssego, estúdio + oferta)

```diff
 [IDENTIDADE E DIREÇÃO VISUAL]
-Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.
+Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.
+Paleta da loja "Adega Mestre das Geladas": cor principal #242422; cor de apoio #828280.

 [PRODUTO E IMAGENS DE REFERÊNCIA]
-Imagens de referência: 2
-A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.
+Imagens de referência: 1
+Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.

 [CONDIÇÕES COMERCIAIS]
-Direção de fundo: Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.
+Direção de fundo: Use um fundo de estúdio discreto na paleta da loja, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.
+Garanta contraste para destacar o produto e manter legível o logo ou a assinatura da loja.
```
- `original`: bloco de identidade **sem** paleta e **sem** neutro; fundo inalterado.
- Sem paleta (recriado): a 2ª linha de identidade vira a orientação neutra.

## Guarda de fronteira (`legacy-frontier.guard`)

Reconciliação **direcionada**, preservando `BASE_SHA`, `LEGACY_FRONTIER_PATHS` e os testes negativos:
- `route.ts`: alteração **aditiva** (nenhuma linha removida) — o teste de preservação do fluxo legado permanece válido sem afrouxamento.
- Manifesto ganhou **entradas por caminho + commit + autorização** para mudanças de fronteira **já autorizadas** por quicks anteriores que ainda não constavam (gpt6-luna: `ai/gateway.ts`, `ai/model-registry.ts`, `ai/__tests__/gateway-prepared.test.ts`; quick 261017-ms4: `ai-cost/__tests__/homolog-image-pricing-readiness.test.ts`, `ai/__tests__/upstream-images-adapter.test.ts`) e o commit de `adapters/chat-completions.ts` foi atualizado (`6c2ebdb7` → `322809d0`). **Nenhum caminho liberado em bloco**; nenhum prefixo amplo.
- Teste negativo de caminho extra passou a usar um caminho **não** autorizado (`ai/adapters/images.ts`) — a semântica negativa é preservada.
- Resultado: guarda **10/10**.

## Validação executada (sem provider)

| Gate | Resultado |
|------|-----------|
| `tsc -p tsconfig.typecheck.json --noEmit` | **0** |
| Focados (compositor, identidade, equivalência 9 combinações, orquestração, non-activation, guarda) | **135/135** |
| `eslint .` | **0** |
| `next build` | **exit 0** |
| `openspec validate product-1-1-prompt-composition` | **valid** |
| Baseline | técnico (`sourceCommit null`, `technicalBaseline true`, `visualApproval pending`); `previousBaseline` = `99017f35`; `policyVersions.identidade` presente |

## Limites e continuidade

- **Sem** chamadas pagas/provider, **sem** flags, **sem** migrations, **sem** produção/deploy; contadores das fases encerradas intactos (B2.3/Luna não reaberta).
- **A prévia textual comprova a composição, não a melhoria visual.** A validação com produtos de cores diferentes e a geração real seguem para **autorização posterior**.
