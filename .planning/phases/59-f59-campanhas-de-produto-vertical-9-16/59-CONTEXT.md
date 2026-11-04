# Phase 59: F59 - Campanhas de Produto vertical 9:16 - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Source:** OpenSpec aprovada `openspec/changes/fase-59-campanhas-produto-vertical-9-16/`
**Language:** pt-BR

<domain>

## Phase Boundary

Adicionar campanhas de Produto no formato vertical 9:16 ao **fluxo NOVO**, com entrega JPEG sRGB 1080 × 1920. A fase cobre:

- escolha de exatamente um formato na criação (`1:1` ou `9:16`);
- formato e versão congelados no snapshot, sem conversão posterior;
- composição vertical própria, com política versionada de áreas seguras;
- geração 1152 × 2048 no provider real (`images.edit`) e redução proporcional para 1080 × 1920;
- paths, metadados, miniatura, download, recuperação, resolução administrativa e projeção;
- crédito atual (1 por entrega), idempotência e estados de falha/desconhecido;
- flag global que limita apenas novas gerações;
- prova de provider e validação em homolog, com produção como gate posterior.

Fora do escopo: fluxo antigo, Serviços/Informativos, geração simultânea dos dois formatos, conversão de campanhas, novo Copy Director/copy por plataforma, vídeo, carrossel, publicação em redes e redesenho de cards.

</domain>

<decisions>

## Implementation Decisions (locked)

### D-01 — Isolamento e engine compartilhada
- Criar `src/lib/product-vertical-9-16/**` e manter o fluxo antigo excluído.
- O runtime 1:1 não importa o vertical. O vertical pode usar a engine existente com perfil explícito.
- A engine recebe `composePrompt`, `imageSize` e `beforeReservation` opcionais, com defaults que preservam o comportamento 1:1. `beforeReservation` é a guarda pré-reserva que exige estimativa vertical e teto de gasto antes da reserva/provider; default `undefined` mantém a sequência 1:1 idêntica.
- **REQ:** REQ-59-02.

### D-02 — Formato e versão congelados
- `campaigns.input_snapshot` recebe `campaignFormat: "9:16"` e `formatContractVersion: "f59-vertical-9-16-v1"` no vertical.
- Ausência das duas chaves em campanha do fluxo novo = contrato histórico `1:1`.
- O `1:1` novo não ganha chaves novas; payload, prompt, arte e hash permanecem como hoje.
- Formato/versão são validados em conjunto; versão ausente, inválida ou não suportada = indisponibilidade explícita, sem fallback.
- **REQ:** REQ-59-01.

### D-03 — Seleção, flag e restauração
- Seletor com `Quadrado 1:1 — feed` e `Vertical 9:16 — Stories e Reels (imagem estática)`, default `1:1`.
- Seletor só existe no fluxo novo elegível e com `product_9_16_enabled` ON; o `1:1` não envia campo novo.
- `CampaignFormRestore` carrega formato/versão; rascunho, revisão e nova tentativa preservam a escolha.
- Com a flag OFF, a restauração vertical permanece visível e a submissão é bloqueada, sem troca silenciosa para `1:1`.
- **REQ:** REQ-59-01, REQ-59-11, REQ-59-12.

### D-04 — Despacho e idempotência
- A rota valida o formato antes da reserva e despacha para o entrypoint vertical por `import()` dinâmico.
- Divergência de formato para a mesma identidade = HTTP 409, sem segunda campanha/crédito/provider.
- Reenvio é consulta pura; a identidade é `campaignId + operationId`.
- **REQ:** REQ-59-01, REQ-59-08.

### D-05 — Provider, estimativa e teto
- O vertical usa `openai.images.edit` via `UpstreamImagesAdapter`, com `size: "1152x2048"` e qualidade do par. A configuração de modelos é a MESMA do fluxo 1:1 (`image_model_pair_config`, principal/fallback); a prova não cria catálogo, seleção, tabela de preços ou tarifa exclusiva de 9:16.
- A prova usa o par principal/fallback efetivo e a fonte de pricing compartilhada (`ai_model_pricing` por modelo+qualidade), com 3 amostras por par único + 1 controle 1024 × 1024 por par; o número de chamadas é derivado da configuração. Teto de US$ 3,00. Se uma combinação não suportar 1152 × 2048, a prova para e apresenta a evidência, sem trocar modelos/configuração.
- A estimativa conservadora vertical deve existir **antes da primeira chamada paga**; a calibração posterior só confirma/ajusta.
- Teto de US$ 3,00; a matriz é condicionada ao saldo; retries e fallback contam; combinações não executadas ficam pendentes. O loader da prova usa `maxRetries: 0` e a credencial validada; dimensão divergente (`dimension_mismatch`) e custo não apurado (`cost_unverified`) reprovam/param a prova.
- Orçamento da prova separado do orçamento da UAT.
- A prova antecede a consolidação do pipeline.
- **REQ:** REQ-59-05.

### D-06 — Arte final e paths
- Reduzir 1152 × 2048 por fator único 0,9375 para 1080 × 1920, sRGB, JPEG qualidade 90.
- Verificar dimensões reais por decode completo; sem crop, distorção, faixas ou upscale.
- Path: `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`, bucket privado, `upsert:false`.
- Reutilizar `product_1_1_campaign_artifacts` com width/height decodificados; sem migration estrutural.
- **REQ:** REQ-59-06, REQ-59-07.

### D-07 — Miniatura vertical
- WebP `thumb-v1`, maior aresta 288, qualidade 78, sem crop/upscale; resultado esperado 162 × 288.
- Caminho irmão `<original>.thumb-v1.webp`, `upsert:false`.
- Falha da miniatura é isolada e nunca bloqueia entrega, crédito ou download.
- Adicionar reconhecimento do path vertical ao mecanismo de miniaturas; 1:1/legado/correção preservados.
- **REQ:** REQ-59-07.

### D-08 — Áreas seguras e composição
- Política `safe-area-9-16-v1` para 1080 × 1920: topo 14% (269 px), base 35% (672 px), laterais 6% (65 px), proteção inferior direita 324 × 768 px.
- Distinguir orientação documentada, recomendação conservadora e validação pendente.
- Fundo/ambientação preenchem o canvas; sem guias, faixas vazias, letterbox ou bordas.
- Textos, identidade e essencial do produto ficam na área protegida; peça compreensível sem legenda externa.
- **REQ:** REQ-59-03.

### D-09 — Prompt vertical e Copy Director
- Reutilizar base congelada e políticas de intenção/produto/identidade/fundo/integridade do 1:1.
- Alterar apenas formato, canvas, áreas seguras e preenchimento; registrar versões no `policy_versions`.
- Copy Director existente sem alteração de prompt, schema, regra ou contrato.
- A copy começa após adquirir a tentativa e antes da resposta da imagem; falha não bloqueia a arte.
- **REQ:** REQ-59-03, REQ-59-04.

### D-10 — Crédito
- Reutilizar `product_1_1_campaign_credit_operations` e RPCs atuais; 1 crédito por campanha entregue.
- Reserva após snapshot e antes do provider; `art_uploaded` após upload/metadados; `delivered` após fence + upload; estorno único em falha confirmada; desconhecido sem estorno/retry cego.
- **REQ:** REQ-59-08.

### D-11 — Recuperação e projeção completas
- A cadeia `image-recovery` → `ProductOneToOneArtifactRecovery` → repositório/resolução administrativa → `projectDeliveredCampaign` recebe o formato e o path esperado.
- `projectDeliveredCampaign` ganha `expectedArtifactPath` opcional com default 1:1.
- Teste ponta a ponta: pendência → arte íntegra → entrega → projeção → detalhe/listagem, sem nova geração e sem path 1:1.
- **REQ:** REQ-59-09.

### D-12 — Download, detalhe e lista
- Leitura por formato persistido; vertical usa probe/store verticais; 1:1/ausente mantém o código atual.
- Gate: operação `delivered` + arte integral; attachment com nome seguro; formato/versão inválidos = fail-closed.
- Lista usa `storage_path` e miniatura; sem redesenho de cards.
- **REQ:** REQ-59-10.

### D-13 — Flag global
- `product_9_16_enabled`, OFF por padrão, leitura server-side fail-closed.
- Bloqueia somente novas gerações; consulta, download, recuperação de imagem/copy, detalhe/lista e resolução administrativa continuam para campanhas existentes.
- Gerações em andamento seguem ao terminal; ownership e autorizações atuais permanecem.
- Sem coortes, estágios, autorização por loja ou segunda chave.
- Seed data-only `INSERT ... ON CONFLICT DO NOTHING`; sem mudança de schema.
- **REQ:** REQ-59-11.

### D-14 — Homolog e produção
- Homolog primeiro, com lojas de teste, saldo controlado, sobreposições reais de Stories/Reels e regressão 1:1 automatizada/manual.
- Produção é gate separado: deploy, ativação, smoke e rollback não são executados nesta fase.
- **REQ:** REQ-59-14.

### D-15 — Observabilidade, docs e gates
- Telemetria por tentativa: formato, tamanho solicitado/devolvido/entregue, modelo, qualidade, alvo e resultado; sem prompt/chave/bytes.
- Runbook com flag, paths, dimensões, safe area e rollback.
- Gates: testes focados, typecheck, lint, build, OpenSpec strict e `git diff --check`.
- **REQ:** REQ-59-13.

### Discretion
- Decomposição dos planos, nomes de helpers, organização de testes, ordem interna dentro de cada bloco e escolha de fixtures.
- Não reabrir decisões de produto acima; dúvidas voltam à OpenSpec.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### OpenSpec aprovada
- `openspec/changes/fase-59-campanhas-produto-vertical-9-16/proposal.md` — escopo e impacto.
- `openspec/changes/fase-59-campanhas-produto-vertical-9-16/design.md` — D-01…D-20, integrações, riscos, gates.
- `openspec/changes/fase-59-campanhas-produto-vertical-9-16/tasks.md` — 5 blocos e checkpoints.
- `openspec/changes/fase-59-campanhas-produto-vertical-9-16/specs/**` — delta specs (formato, safe area, geração/entrega, homolog, campaign-input-ui).

### Specs principais existentes
- `openspec/specs/product-1-1-artifact-delivery/spec.md`
- `openspec/specs/product-1-1-generation-orchestration/spec.md`
- `openspec/specs/product-1-1-campaign-credit-billing/spec.md`
- `openspec/specs/product-1-1-copy-recovery/spec.md`
- `openspec/specs/product-1-1-flow-activation/spec.md`
- `openspec/specs/campaign-input-ui/spec.md`
- `openspec/specs/copy-director/spec.md`
- `openspec/specs/ai-image-generation/spec.md`
- `openspec/specs/image-generation-model-pair-config/spec.md`
- `openspec/specs/image-generation-config-snapshot/spec.md`

### Design system e processo
- `AGENTS.md`
- `docs/fluxo-de-desenvolvimento.md`
- `openspec/design-system/CAMPAIGN_VISUAL_SYSTEM.md`
- `openspec/design-system/pages/campaign-input.md`
- `openspec/design-system/pages/campaign-preview.md`
- `openspec/design-system/pages/review-export.md`

### Código de referência
- `src/lib/product-1-1/**`
- `src/app/api/campaign/generate-image/route.ts`
- `src/app/api/campaign/[id]/download/route.ts`
- `src/app/api/campaign/[id]/image-recovery/route.ts`
- `src/app/(app)/campanhas/[id]/page.tsx`
- `src/lib/campaign/display.ts`
- `src/lib/campaign/thumbnail/**`
- `src/lib/feature-flags/feature-flag-service.ts`
- `src/lib/ai/adapters/upstream-images.ts`
- `src/lib/ai-cost/image-pair-pricing.ts`
- `src/lib/product-1-1/pilot/**`

</canonical_refs>

<specifics>

## Specifics

- **Blocos de tasks:** 1) contrato/prova técnica; 2) composição; 3) geração/persistência; 4) integração da criação/entrega; 5) validação.
- **Divisão alvo:** 10 planos em ~7 waves, sem ultrapassar o limite de 8–10 sem revisão.
  - Wave 1: 59-01 contrato; 59-02 prova de provider (checkpoint pago); 59-03 composição.
  - Wave 2: 59-04 pipeline de arte/store/miniatura.
  - Wave 3: 59-05 engine/perfil/crédito/projeção.
  - Wave 4: 59-06 recuperação completa; 59-07 criação/flag/UI.
  - Wave 5: 59-08 restauração/download/detalhe/lista.
  - Wave 6: 59-09 telemetria/docs/gates/regressão.
  - Wave 7: 59-10 homolog/aceite/gate de produção.
- **Prova paga:** matriz derivada do par principal/fallback efetivo do 1:1 (3 amostras 1152 × 2048 + 1 controle por par único), teto US$ 3,00, condicionada ao saldo; retries contam; estimativa conservadora antes da primeira chamada; sem catálogo/preço exclusivo de 9:16; não executar no planejamento.
- **Dimensões:** provider 1152 × 2048 (divisível por 16); entrega 1080 × 1920 (não enviar 1080 ao provider).
- **Path:** `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`.
- **Flag:** `product_9_16_enabled`, OFF por padrão, seed data-only.
- **Sem migration estrutural.** Se constraints/RPCs não suportarem, parar e registrar decisão com evidência.
- **Não executar:** código, migration, chamada paga, push, deploy ou operação em produção durante o planejamento.

</specifics>

<deferred>

## Deferred Ideas

- Prompt único que produza duas artes similares (uma por formato): investigação separada, sem implementação/teste pago nesta iniciativa.
- Vídeo, carrossel, publicação em redes, Serviços/Informativos e conversão/reformatação de campanhas existentes.
- Redesenho dos cards de listagem/dashboard.
- Ativação em produção e testes pagos de UAT: gates posteriores e separados.

</deferred>

<scope_fence>

## Scope Fence

- Somente fluxo NOVO de Produto. O fluxo antigo (`/api/campaign/generate`, ramo legado de `generate-image`, render 1080 × 1080) fica fora.
- Não alterar prompts, validadores, crédito, recuperação ou entrega do 1:1; extensões na engine são aditivas e com defaults.
- Não alterar Copy Director nem criar copy por plataforma.
- Não criar tabela, coluna, migration estrutural ou novo mecanismo de ativação.
- Não executar geração paga, migration, push, deploy ou operação de produção nesta fase.
- Não prometer vídeo nem compatibilidade irrestrita com todos os posicionamentos.

</scope_fence>

---

*Phase: 59-f59-campanhas-de-produto-vertical-9-16*
*Context gathered: 2026-11-04 from approved OpenSpec*
