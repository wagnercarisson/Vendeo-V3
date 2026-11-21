// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPOSITORY_ROOT = process.cwd();
const BASE_SHA = "335bfb70";
const BASE_SHA_RECORD = path.resolve(
  REPOSITORY_ROOT,
  ".planning/phases/56.2-preparacao-nao-operacional-produto-1-1/56-2-ISOLATED-INSTANCE.md",
);

// Exceção ESTREITA (Plano 56.2.1-03, aprovada): a única alteração de fronteira
// produtiva reconhecida originalmente era o guard de submissão na rota
// generate-image. A quick 261011-lc6 reconciliou a guarda para reconhecer
// TAMBÉM as mudanças de fronteira anteriores já autorizadas (laboratório u3h e
// src/lib/ai da rsp), SEM excluir diretórios nem trocar o BASE_SHA:
//  - o conjunto de caminhos alterados deve ser EXATAMENTE o conjunto autorizado;
//  - cada caminho autorizado carrega autorização + commit de origem;
//  - os caminhos adicionais têm o CONTEÚDO comparado ao commit aprovado, de
//    modo que a autorização do caminho NÃO vira autorização permanente para
//    modificá-lo;
//  - a rota generate-image mantém as verificações específicas (aditiva + guard
//    antes do parse/reserva);
//  - a quick 261013-hxm acrescentou os caminhos lab/bench tocados pela correção
//    test-only das fixtures + alinhamento do snapshot do laboratório, com
//    autorização e commit por entrada.
//
// Reconciliação 2026-11-21 (quick 261121-iqh): registra as 37 mudanças de
// fronteira JÁ AUTORIZADAS por fases/quicks posteriores (F60.3-02, F60.4-03,
// F60.6-01/05, quicks 261107-hcx, 261107-qvo, 261116-vpx) — registro de código
// offline, que NÃO é aceite formal de provider/ambiente/publicação — e atualiza o commit
// aprovado de 7 caminhos cujo conteúdo avançou. A exceção da rota generate-image
// passa a ser exatamente "linha de import de `@/lib/campaign/persistence`
// substituída pela MESMA linha acrescida de `uploadCampaignInputFile`"; qualquer
// outra remoção continua falha. Nenhum caminho é liberado em bloco, BASE_SHA e
// LEGACY_FRONTIER_PATHS permanecem, e cada entrada usa commit IMUTÁVEL — nunca
// HEAD, branch ou "conteúdo atual".
const AUTHORIZED_ROUTE_FILE = "src/app/api/campaign/generate-image/route.ts";
// F56.2b1b (Plano 06 — reconciliação G-LF): a rota de download passa a carregar o
// portão do novo fluxo (aditivo). Tem entrada AUTORIZADA própria (autorização +
// commit de origem) e prova de preservação do ramo legado — NÃO entra na
// comparação de conteúdo dos 12 caminhos adicionais (que permanece inalterada).
const AUTHORIZED_DOWNLOAD_ROUTE_FILE =
  "src/app/api/campaign/[id]/download/route.ts";
// Commit aprovado do ramo legado da rota de download (antes da correção de
// entrega): o bloco legado é comparado por CONTEÚDO contra este commit.
const AUTHORIZED_DOWNLOAD_ROUTE_COMMIT = "e3fb664e";

interface AuthorizedFrontierChange {
  readonly path: string;
  readonly authorization: string;
  /** Commit de origem cujo conteúdo é o aprovado para este caminho. */
  readonly commit: string;
}

const AUTHORIZED_FRONTIER_CHANGES: readonly AuthorizedFrontierChange[] = [
  {
    path: AUTHORIZED_ROUTE_FILE,
    authorization: "F56.2.1-03 (exceção estreita aprovada — guard de submissão)",
    commit: "6d341964",
  },
  {
    path: AUTHORIZED_DOWNLOAD_ROUTE_FILE,
    authorization:
      "F56.2b1b Plano 06 (portão de download do novo fluxo — ramo legado preservado)",
    commit: "e3fb664e",
  },
  {
    path: "src/lib/ai/__tests__/quick-gpt6-luna-brand-profile-text.test.ts",
    authorization:
      "quick 261018-k9c (testes Luna em brand_profile_text — caminho específico)",
    commit: "3d6e5763",
  },
  {
    path: "src/lib/ai/__tests__/quick-gpt6-luna-brand-profile-vision.test.ts",
    authorization:
      "quick 261018-k9c (testes Luna em brand_profile_vision — caminho específico)",
    commit: "3d6e5763",
  },
  {
    path: "src/lib/ai/__tests__/luna-gradual-opening.contract.test.ts",
    authorization:
      "F56.2e 56.2.7 (teste de resolucao de Luna nas tres capacidades)",
    commit: "2d81646c",
  },
  {
    path: "src/lib/lab/bench/domain/background-direction.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/prompt-composer.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/destaque.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/exclusivo.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/oferta.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/domain/policies/resolve-bench-prompt-policies.ts",
    authorization: "quick 261009-u3h (prompts experimentais — somente laboratório)",
    commit: "99017f35",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-composer.contract.test.ts",
    authorization: "quick 261009-u3h (testes/versões do laboratório)",
    commit: "b7ab7b1b",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-policy.contract.test.ts",
    authorization:
      "quick 261009-u3h (testes/versões do laboratório) + quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/ai/types.ts",
    authorization:
      "quick 261010-rsp + F56.2b1b Plano 08 P1 Opção A + quick 261026-p11 + F59/59-09 (metadata aditivo de auditoria por tentativa) + quick 261120-qvp (snapshot econômico na telemetria — somente campos opcionais de tipo `number | null`, aditivo)",
    commit: "12288035",
  },
  {
    path: "src/lib/ai/telemetry-sink.ts",
    authorization:
      "F56.2b1b Plano 08 P1 Opção A (custo interno `internalCost` opcional no contexto do sink — aditivo) + quick 261026-p11 (liquidação por tokens reais)",
    commit: "2d42c512",
  },
  {
    path: "src/lib/ai/__tests__/telemetry-sink.test.ts",
    authorization:
      "F56.2b1b Plano 08 P1 Opção A (testes do custo interno do novo fluxo no sink)",
    commit: "201e606f",
  },
  {
    path: "src/lib/ai/adapters/chat-completions.ts",
    authorization:
      "quick 261010-rsp (diagnóstico aditivo de identidade visual) + quick gpt6-luna (adapter gpt-6-luna: reasoning_effort none / max_completion_tokens, sem temperature — GPT-4o/Gemini preservados) + F60.4-03 (ajustes do adapter no fluxo da base quadrada)",
    commit: "9b6c2351",
  },
  {
    path: "src/lib/ai/adapters/__tests__/chat-completions.test.ts",
    authorization: "quick 261010-rsp (testes do adapter)",
    commit: "6c2ebdb7",
  },
  {
    path: "src/lib/ai/__tests__/ai-invocation-result-additive.contract.test.ts",
    authorization: "quick 261010-rsp (contrato aditivo)",
    commit: "6c2ebdb7",
  },
  // Reconciliação do manifesto (2026-10-17, quick 261017-cdi): registra por
  // caminho + commit + autorização as mudanças de fronteira JÁ AUTORIZADAS por
  // quicks anteriores (gpt6-luna e 261017-ms4) que ainda não constavam aqui.
  // Nenhum caminho é liberado em bloco; BASE_SHA e testes negativos permanecem.
  {
    path: "src/lib/ai/gateway.ts",
    authorization:
      "quick gpt6-luna + quick 261026-vs + F59/59-09 (metadata aditivo do result apenas no envelope de sucesso)",
    commit: "98cabd39",
  },
  {
    path: "src/lib/ai/adapters/proof-openai-loader.ts",
    authorization:
      "F59/59-02 + correção 59-09 (loader da prova movido para a fronteira permitida de adapters, sem alterar o loader 1:1)",
    commit: "67bb3f9e",
  },
  {
    path: "src/lib/ai/image-model-pair-config-row.ts",
    authorization:
      "F59/59-02 (extração pura do contrato de linha do par modelo/qualidade)",
    commit: "68b2e035",
  },
  {
    path: "src/lib/ai/image-model-pair-config-service.ts",
    authorization:
      "F59/59-02 (serviço de leitura do par preservando o contrato existente)",
    commit: "68b2e035",
  },
  {
    path: "src/lib/ai/__tests__/gateway-prepared.test.ts",
    authorization: "quick gpt6-luna (teste prepare/invokePrepared + pinning)",
    commit: "7d08a068",
  },
  {
    path: "src/lib/ai/model-registry.ts",
    authorization:
      "quick gpt6-luna (allowlist `openai: gpt-6-luna` para campaign_copy)",
    commit: "0b72ad99",
  },
  {
    path: "src/lib/ai/__tests__/upstream-images-adapter.test.ts",
    authorization:
      "quick 261017-ms4 (pricing das seis combinações — teste do adapter)",
    commit: "8a8c0819",
  },
  {
    path: "src/lib/ai-cost/__tests__/homolog-image-pricing-readiness.test.ts",
    authorization:
      "quick 261017-ms4 (pricing das seis combinações — teste de readiness)",
    commit: "8a8c0819",
  },
  {
    path: "src/lib/lab/bench/domain/__tests__/intent-schema.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/branding-service.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/prompt-base.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório + quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/__tests__/form-parity.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/__tests__/run-history.contract.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "e13732a2",
  },
  {
    path: "src/lib/lab/bench/domain/campaign-snapshot.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "af28dc7e",
  },
  {
    path: "src/lib/lab/bench/__tests__/campaign-snapshot.test.ts",
    authorization:
      "quick 261013-hxm — fixtures e alinhamento do snapshot do laboratório",
    commit: "af28dc7e",
  },
  // Reconciliação 2026-10-21 — F50.2 (oferta de teste gratuito de 28 dias).
  // Mudança ADITIVA/read-only no CreditService (leitura do enrollment), já
  // aprovada no planejamento da F50.2 (50.2-02-PLAN.md). O conteúdo atual
  // inclui a extensão aditiva `throwOnError` da F58-01 (default false),
  // verificada em 58-VERIFICATION (status passed); a comparação de conteúdo
  // contra `59e8bea0` permanece ativa.
  {
    path: "src/lib/credit/credit-service.ts",
    authorization:
      "F50.2 (leitura de enrollment — aditiva/read-only) + F58-01 (throwOnError aditivo opt-in, default false)",
    commit: "59e8bea0",
  },
  // Reconciliação 2026-11-02 (quick 261102-oab) — parecer técnico favorável
  // do Codex nesta retomada, após revisão dos diffs e 280 testes em 21
  // arquivos. Cada entrada usa o commit imutável cujo conteúdo corresponde ao
  // arquivo atual. O parecer cobre código/testes offline; NÃO é validação de
  // banco/provider nem autorização de publicação.
  // 261026-pricing — sync diária de tarifas e painel admin.
  {
    path: "src/lib/ai-cost/__tests__/fixtures/openai-pricing-standard.md",
    authorization: "quick 261026-pricing (inventário/tarifas Standard OpenAI)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/__tests__/openai-pricing-dashboard.test.ts",
    authorization: "quick 261026-pricing (painel de tarifas persistidas)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-dashboard.ts",
    authorization: "quick 261026-pricing (painel de tarifas persistidas)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-fetch.ts",
    authorization: "quick 261026-pricing (fetch público com timeout/hash/ETag)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-inventory.ts",
    authorization: "quick 261026-pricing (inventário fechado de modelos/tarifas)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-sync-store.ts",
    authorization: "quick 261026-pricing (persistência/RPCs atômicas do sync)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-sync.ts",
    authorization: "quick 261026-pricing (orquestração do sync diário)",
    commit: "89994b1d",
  },
  {
    path: "src/lib/ai-cost/__tests__/openai-pricing-parser.test.ts",
    authorization: "quick 261026-pricing gap closure (parser valor/não aplicável/ausente)",
    commit: "99132b1e",
  },
  {
    path: "src/lib/ai-cost/__tests__/openai-pricing-sync-state.test.ts",
    authorization: "quick 261026-pricing gap closure (estado pendente durante retry)",
    commit: "99132b1e",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-parser.ts",
    authorization: "quick 261026-pricing gap closure (parser valor/não aplicável/ausente)",
    commit: "99132b1e",
  },
  {
    path: "src/lib/ai-cost/openai-pricing-sync-state.ts",
    authorization: "quick 261026-pricing gap closure (estado pendente durante retry)",
    commit: "99132b1e",
  },
  {
    path: "src/lib/ai-cost/__tests__/openai-pricing-sync.test.ts",
    authorization:
      "quick 261026-pricing complemento autorizado (middleware/logger; sem mudança de runtime do logger)",
    commit: "ab69495a",
  },
  // 261026-vs — estimativa versionada do consumo de imagem da Assinatura Visual.
  {
    path: "src/lib/ai-cost/__tests__/operation-runs-service.test.ts",
    authorization: "quick 261026-vs (nota de custo estimado no detalhe)",
    commit: "43652290",
  },
  {
    path: "src/lib/ai-cost/__tests__/visual-signature-image-usage.test.ts",
    authorization: "quick 261026-vs (tabela vs-image-usage-v1)",
    commit: "43652290",
  },
  {
    path: "src/lib/ai-cost/operation-runs-service.ts",
    authorization: "quick 261026-vs (nota de custo estimado no detalhe)",
    commit: "43652290",
  },
  {
    path: "src/lib/ai-cost/visual-signature-image-usage.ts",
    authorization: "quick 261026-vs (tabela vs-image-usage-v1)",
    commit: "43652290",
  },
  {
    path: "src/lib/ai/__tests__/gateway-visual-signature-image-usage.test.ts",
    authorization: "quick 261026-vs (alvo de usage no envelope do gateway)",
    commit: "43652290",
  },
  {
    path: "src/lib/ai-cost/visual-signature-image-cost.ts",
    authorization: "quick 261026-vs gap closure (usage agregado completo aceito)",
    commit: "563e1a09",
  },
  {
    path: "src/lib/ai/__tests__/visual-signature-image-cost-sink.test.ts",
    authorization: "quick 261026-vs gap closure (usage agregado completo aceito)",
    commit: "563e1a09",
  },
  {
    path: "src/lib/ai-cost/__tests__/visual-signature-image-cost.test.ts",
    authorization: "quick 261026-vs gap closure (entrada ausente no usage)",
    commit: "c282d0bc",
  },
  // 261026-p11 — custo pós-chamada por tokens reais no Produto 1:1.
  {
    path: "src/lib/ai-cost/__tests__/image-pair-pricing.test.ts",
    authorization: "quick 261026-p11 (pricing congelado + rejeição code_default)",
    commit: "2d42c512",
  },
  {
    path: "src/lib/ai-cost/ai-model-pricing.ts",
    authorization:
      "quick 261026-p11 (novas dimensões no caminho com qualidade) + quick 261116-vpx (preflight de pricing — leitura estrita aditiva)",
    commit: "f82a3ca3",
  },
  {
    path: "src/lib/ai-cost/image-pair-pricing.ts",
    authorization: "quick 261026-p11 (pricing congelado + rejeição code_default)",
    commit: "2d42c512",
  },
  {
    path: "src/lib/ai-cost/image-usage-token-cost.ts",
    authorization: "quick 261026-p11 (cálculo puro por tokens reais)",
    commit: "2d42c512",
  },
  {
    path: "src/lib/ai-cost/types.ts",
    authorization: "quick 261026-p11 (cache por modalidade e auditoria de custo)",
    commit: "2d42c512",
  },
  {
    path: "src/lib/ai/__tests__/adapters.test.ts",
    authorization: "quick 261026-p11 gap closure (cache isolado no upstream)",
    commit: "5816a8ce",
  },
  {
    path: "src/lib/ai/__tests__/legacy-images-cache-isolation.test.ts",
    authorization: "quick 261026-p11 gap closure (regressão do cache legado)",
    commit: "5816a8ce",
  },
  {
    path: "src/lib/ai/adapters/images.ts",
    authorization: "quick 261026-p11 gap closure (cache isolado no upstream)",
    commit: "5816a8ce",
  },
  {
    path: "src/lib/ai/adapters/upstream-images.ts",
    authorization:
      "quick 261026-p11 gap closure (cache isolado no upstream) + F60.3-02 (opções de expansão 9:16 no adapter de imagens upstream)",
    commit: "e03336ea",
  },
  // 261027-llm — correção test-only de tipagem (aceite aprovado).
  {
    path: "src/lib/ai-cost/__tests__/image-usage-token-cost.test.ts",
    authorization: "quick 261027-llm (tipagem de fixtures; aceite approved)",
    commit: "76c1ef02",
  },
  {
    path: "src/lib/ai/__tests__/product-1-1-image-usage-integration.test.ts",
    authorization: "quick 261027-llm (tipagem de mocks; aceite approved)",
    commit: "76c1ef02",
  },
  // 261025-k8e — consumo de modelo/qualidade dedicados da Assinatura Visual.
  {
    path: "src/lib/ai/__tests__/gateway.test.ts",
    authorization: "quick 261025-k8e (modelo efetivo no envelope de falha)",
    commit: "f3dcfa8f",
  },
  {
    path: "src/lib/ai/adapters/responses.ts",
    authorization:
      "quick 261025-k8e (modelo efetivo no ResponsesAdapter) + F60.4-03 (ajustes do adapter no fluxo da base quadrada)",
    commit: "9b6c2351",
  },
  // 261102-o00 — normalização CRLF restrita ao teste de contrato.
  {
    path: "src/lib/ai-cost/__tests__/openai-pricing-migration.contract.test.ts",
    authorization: "quick 261102-o00 (contrato independente de CRLF/LF)",
    commit: "4d5cfc19",
  },
  // Reconciliação 2026-11-21 (quick 261121-iqh) — quick 261116-vpx: preflight de
  // pricing antes da base (leitura estrita ADITIVA do catálogo/pricing; nenhum
  // provider, ambiente ou publicação aprovado por este registro offline).
  {
    path: "src/lib/ai/ai-model-catalog-service.ts",
    authorization: "quick 261116-vpx (leitura estrita aditiva do catálogo de modelos)",
    commit: "f82a3ca3",
  },
  {
    path: "src/lib/ai/__tests__/ai-model-catalog-service.test.ts",
    authorization: "quick 261116-vpx (testes da leitura estrita aditiva do catálogo)",
    commit: "f82a3ca3",
  },
  {
    path: "src/lib/ai-cost/__tests__/ai-model-pricing.test.ts",
    authorization: "quick 261116-vpx (testes da leitura estrita aditiva de pricing)",
    commit: "f82a3ca3",
  },
  // Reconciliação 2026-11-21 (quick 261121-iqh) — F60.6-01: configuração de
  // modelo da expansão 9:16 (preset/tipo e contratos de migração).
  {
    path: "src/lib/ai/nine-sixteen-expansion-model-config.ts",
    authorization: "F60.6-01 (configuração de modelo da expansão 9:16 — aditiva)",
    commit: "bc25feb4",
  },
  {
    path: "src/lib/ai/__tests__/nine-sixteen-expansion-model-config.contract.test.ts",
    authorization: "F60.6-01 (contrato da configuração de modelo da expansão 9:16)",
    commit: "77a59733",
  },
  {
    path: "src/lib/ai/__tests__/nine-sixteen-expansion-model-config-migration.contract.test.ts",
    authorization: "F60.6-01 (contrato de migração da configuração de modelo 9:16)",
    commit: "096cb703",
  },
  // Reconciliação 2026-11-21 (quick 261121-iqh) — F60.6-05: serviço e view da
  // configuração de modelo (somente leitura/exibição, aditivos).
  {
    path: "src/lib/ai/nine-sixteen-expansion-model-config-service.ts",
    authorization: "F60.6-05 (serviço da configuração de modelo da expansão 9:16)",
    commit: "8cfef0f1",
  },
  {
    path: "src/lib/ai/__tests__/nine-sixteen-expansion-model-config-service.test.ts",
    authorization: "F60.6-05 (testes do serviço da configuração de modelo 9:16)",
    commit: "8cfef0f1",
  },
  {
    path: "src/lib/ai/nine-sixteen-expansion-model-config-view.ts",
    authorization: "F60.6-05 (view da configuração de modelo da expansão 9:16)",
    commit: "4bc61965",
  },
  {
    path: "src/lib/ai/__tests__/nine-sixteen-expansion-model-config-view.test.ts",
    authorization: "F60.6-05 (testes da view da configuração de modelo 9:16)",
    commit: "4bc61965",
  },
  // Reconciliação 2026-11-21 (quick 261121-iqh) — F60.3-02: opções de expansão
  // no adapter de imagens upstream (contrato offline; sem chamada paga).
  {
    path: "src/lib/ai/__tests__/upstream-images-expansion-options.test.ts",
    authorization: "F60.3-02 (opções de expansão 9:16 no adapter de imagens upstream)",
    commit: "485736fb",
  },
  // Reconciliação 2026-11-21 (quick 261121-iqh) — quick 261107-hcx: bancada 9:16
  // e preset 2.6 experimental (Checkpoint A; preset `enabled: false`). Código
  // offline de laboratório: NÃO aprova provider, ambiente, publicação nem o
  // Checkpoint B (ativação local + primeiras chamadas pagas).
  {
    path: "src/lib/ai/adapters/bench-images.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/__tests__/bench-execution.contract.test.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/__tests__/bench-images-adapter.test.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/domain/bench-model-allowlist.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/domain/policies/formato-9-16.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/domain/schemas.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 e preset 2.6 experimental — laboratório; código offline)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/execution/bench-cost-resolver.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/execution/bench-execution-service.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/gateway/runtime.ts",
    authorization:
      "quick 261107-hcx (bancada 9:16 — laboratório; código offline, Checkpoint B não executado)",
    commit: "6d9ef070",
  },
  {
    path: "src/lib/lab/bench/domain/preset-registry.ts",
    authorization:
      "quick 261107-hcx (preset 2.6 experimental registrado como `enabled: false` — laboratório; código offline)",
    commit: "0ba82d30",
  },
  {
    path: "src/lib/lab/bench/__tests__/preset-registry.test.ts",
    authorization:
      "quick 261107-hcx (preset 2.6 desabilitado no Checkpoint A — laboratório; código offline)",
    commit: "0ba82d30",
  },
  // Reconciliação 2026-11-21 (quick 261121-iqh) — quick 261107-qvo: expansão de
  // campanha pronta e formato 4:5 na bancada (módulos puros e políticas de
  // formato). Código offline de laboratório: NÃO aprova provider, ambiente ou
  // publicação.
  {
    path: "src/lib/lab/bench/__tests__/bench-format.test.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/__tests__/bench-pricing.test.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/__tests__/config-registry.test.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/__tests__/expand-contract.test.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/__tests__/expand-geometry.test.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/bench-format.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/bench-pricing.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/config-registry.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/expand-geometry.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/expand-prompt.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/expand-schema.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/policies/formato-4-5.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/policies/registry.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/domain/prompt-base.ts",
    authorization:
      "quick 261107-qvo (expansão pronta e formato 4:5 na bancada — laboratório; código offline)",
    commit: "575ce816",
  },
  {
    path: "src/lib/lab/bench/persistence/bench-run-service.ts",
    authorization:
      "quick 261107-qvo (persistência da bancada de expansão 4:5 — laboratório; código offline)",
    commit: "7e297770",
  },
];

const ADDITIONAL_AUTHORIZED_FILES = AUTHORIZED_FRONTIER_CHANGES.filter(
  (entry) =>
    entry.path !== AUTHORIZED_ROUTE_FILE &&
    entry.path !== AUTHORIZED_DOWNLOAD_ROUTE_FILE,
);

const LEGACY_FRONTIER_PATHS = [
  "src/app/api/campaign/generate-image/route.ts",
  ":(literal)src/app/api/campaign/[id]/download/route.ts",
  "src/lib/ai/adapters/images.ts",
  "src/lib/ai/adapters/registry.ts",
  "src/lib/ai/gateway.ts",
  "src/lib/credit/credit-service.ts",
  "src/lib/ai-cost/**",
  "src/lib/lab/bench/**",
  "src/lib/ai/**",
  ":(exclude)src/lib/ai/image-generation-operations-repository.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-operations-repository.test.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-config-snapshot.reuse.test.ts",
  ":(exclude)src/lib/ai/__tests__/image-generation-operations-repository.integration.test.ts",
];

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPOSITORY_ROOT, encoding: "utf8" });
}

/** Normaliza CRLF→LF para comparar conteúdo independentemente do checkout. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

// Bloco legado completo: começa no gate F37 e vai até o fim da rota (storage,
// resposta e fechamento). A comparação por CONTEÚDO contra o commit aprovado
// admite SOMENTE a extração exata do cálculo do nome para o helper.
const LEGACY_BLOCK_MARKER = "  // F37.1";
const LEGACY_FILENAME_CALCULATION = [
  '  const safeName = campaign.product_name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "campanha";',
  '  const dateStr = campaign.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];',
  "  const filename = `${safeName}-${dateStr}.jpg`;",
].join("\n");
const SHARED_FILENAME_CALCULATION = [
  "  const filename = buildSafeDownloadFilename({",
  "    productName: campaign.product_name,",
  "    createdAt: campaign.created_at,",
  '    extension: "jpg",',
  "  });",
].join("\n");

function legacyBlock(source: string): string {
  const idx = source.indexOf(LEGACY_BLOCK_MARKER);
  if (idx < 0) {
    throw new Error("legacy_block_marker_missing");
  }
  return source.slice(idx).trimEnd();
}

/** Diferenças do conjunto alterado contra o conjunto autorizado. */
function diffAgainstAuthorized(
  changed: readonly string[],
  authorized: readonly string[],
): { extra: string[]; missing: string[] } {
  const changedSet = new Set(changed);
  const authorizedSet = new Set(authorized);
  return {
    extra: changed.filter((file) => !authorizedSet.has(file)),
    missing: authorized.filter((file) => !changedSet.has(file)),
  };
}

/** Caminhos autorizados cujo conteúdo atual difere do conteúdo aprovado. */
function contentMismatches(
  entries: readonly AuthorizedFrontierChange[],
  readCurrent: (file: string) => string,
  readApproved: (commit: string, file: string) => string,
): string[] {
  return entries
    .filter(
      (entry) =>
        normalize(readCurrent(entry.path)) !==
        normalize(readApproved(entry.commit, entry.path)),
    )
    .map((entry) => entry.path);
}

// Exceção ESTREITA da rota generate-image (quick 261121-iqh): a ÚNICA remoção
// admitida é a linha de import de `@/lib/campaign/persistence`, substituída pela
// MESMA linha acrescida de `uploadCampaignInputFile`. Mesma instrução, mesmo
// specifier, todos os símbolos anteriores preservados e exatamente um símbolo
// novo. Nenhuma outra remoção de linha é aceita.
const PERSISTENCE_IMPORT_SPECIFIER = "@/lib/campaign/persistence";
const PERSISTENCE_IMPORT_BEFORE =
  'import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, uploadCampaignInputImage, removeCampaignInputs, updateCampaignReady, updateCampaignError, deleteCampaignImage, createArtVersion } from "@/lib/campaign/persistence";';
const PERSISTENCE_IMPORT_AFTER =
  'import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, uploadCampaignInputImage, removeCampaignInputs, updateCampaignReady, updateCampaignError, deleteCampaignImage, createArtVersion, uploadCampaignInputFile } from "@/lib/campaign/persistence";';

/** Specifier de um import nomeado `import { ... } from "specifier";`. */
function importSpecifier(line: string): string | null {
  const match = /^import\s*\{[^}]*\}\s*from\s*["']([^"']+)["'];?$/.exec(line.trim());
  return match ? match[1] : null;
}

/** Símbolos nomeados (nome original, ignorando alias) de um import nomeado. */
function importedSymbols(line: string): string[] {
  const match = /^import\s*\{([^}]*)\}\s*from\s*["'][^"']+["'];?$/.exec(line.trim());
  if (!match) return [];
  return match[1]
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.split(/\s+as\s+/)[0].trim());
}

/** Remoções da rota que NÃO são exatamente o import de persistência original. */
function unexpectedRouteRemovals(removed: readonly string[]): string[] {
  return removed.filter((line) => line !== PERSISTENCE_IMPORT_BEFORE);
}

/**
 * Violações fechadas da exceção aditiva do import de persistência. Devolve
 * códigos estáveis — nunca um booleano — para que o teste nomeie o desvio.
 */
function additivePersistenceImportViolations(
  removed: readonly string[],
  added: readonly string[],
): string[] {
  const violations: string[] = [];

  if (removed.length !== 1 || removed[0] !== PERSISTENCE_IMPORT_BEFORE) {
    violations.push("removed_not_exactly_persistence_import");
  }
  if (!added.includes(PERSISTENCE_IMPORT_AFTER)) {
    violations.push("added_missing_persistence_import");
  }

  // Linha de persistência efetivamente adicionada (pode divergir da constante;
  // nesse caso as violações de símbolo/specifier nomeiam o desvio).
  const candidate =
    added.find(
      (line) =>
        importSpecifier(line) === PERSISTENCE_IMPORT_SPECIFIER,
    ) ?? PERSISTENCE_IMPORT_AFTER;

  if (importSpecifier(candidate) !== PERSISTENCE_IMPORT_SPECIFIER) {
    violations.push("specifier_changed");
  }

  const beforeSymbols = new Set(importedSymbols(PERSISTENCE_IMPORT_BEFORE));
  const afterSymbols = new Set(importedSymbols(candidate));
  for (const symbol of beforeSymbols) {
    if (!afterSymbols.has(symbol)) violations.push(`symbol_lost:${symbol}`);
  }
  for (const symbol of afterSymbols) {
    if (!beforeSymbols.has(symbol) && symbol !== "uploadCampaignInputFile") {
      violations.push(`unexpected_symbol:${symbol}`);
    }
  }

  return violations;
}

describe("legacy-frontier guard — F56.2a", () => {
  it("usa o BASE_SHA literal registrado e confirma commit/ancestry", () => {
    const evidence = readFileSync(BASE_SHA_RECORD, "utf8");
    expect(evidence.split(/\r?\n/)).toContain(`BASE_SHA: \`${BASE_SHA}\``);

    expect(() =>
      execFileSync("git", ["cat-file", "-e", `${BASE_SHA}^{commit}`], {
        cwd: REPOSITORY_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
    expect(() =>
      execFileSync("git", ["merge-base", "--is-ancestor", BASE_SHA, "HEAD"], {
        cwd: REPOSITORY_ROOT,
        stdio: "pipe",
      }),
    ).not.toThrow();
  });

  it("reconhece EXATAMENTE o conjunto autorizado de mudanças de fronteira", () => {
    const changed = git([
      "diff",
      "--name-only",
      `${BASE_SHA}..HEAD`,
      "--",
      ...LEGACY_FRONTIER_PATHS,
    ])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);

    const { extra, missing } = diffAgainstAuthorized(
      changed,
      AUTHORIZED_FRONTIER_CHANGES.map((entry) => entry.path),
    );

    // Conjunto exato: nenhum caminho NÃO autorizado e nenhum autorizado ausente.
    expect(extra, "caminhos de fronteira não autorizados").toEqual([]);
    expect(missing, "caminhos autorizados ausentes do diff").toEqual([]);
    expect(changed).toHaveLength(AUTHORIZED_FRONTIER_CHANGES.length);
  });

  it("não autoriza modificação de conteúdo nos caminhos autorizados adicionais", () => {
    const mismatches = contentMismatches(
      ADDITIONAL_AUTHORIZED_FILES,
      (file) => readFileSync(path.resolve(REPOSITORY_ROOT, file), "utf8"),
      (commit, file) => git(["show", `${commit}:${file}`]),
    );

    // O conteúdo ATUAL deve ser idêntico ao conteúdo do commit aprovado; a
    // autorização do caminho não é autorização permanente para modificá-lo.
    expect(mismatches).toEqual([]);
  }, 20000);

  it("a rota generate-image evolui para o wiring b1b preservando o fluxo legado", () => {
    const diff = git([
      "diff",
      "--unified=0",
      `${BASE_SHA}..HEAD`,
      "--",
      AUTHORIZED_ROUTE_FILE,
    ]);
    const lines = diff.split(/\r?\n/);
    const removedDiffLines = lines.filter((l) => l.startsWith("-") && !l.startsWith("---"));
    const addedDiffLines = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    // Linhas de código sem o marcador do diff: base da exceção ESTREITA.
    const removed = removedDiffLines.map((line) => line.replace(/^-/, ""));
    const added = addedDiffLines.map((line) => line.replace(/^\+/, ""));

    // (i) A ÚNICA remoção admitida é o import de `@/lib/campaign/persistence`,
    // substituído pela MESMA linha acrescida de `uploadCampaignInputFile`. O
    // restante do fluxo legado permanece preservado byte a byte.
    expect(removed).toEqual([PERSISTENCE_IMPORT_BEFORE]);
    expect(unexpectedRouteRemovals(removed)).toEqual([]);
    expect(additivePersistenceImportViolations(removed, added)).toEqual([]);

    const addedText = addedDiffLines.join("\n");
    // Os imports do guard b1a continuam presentes.
    expect(addedText).toMatch(/\+import \{ detectExclusiveNewFlowFields \}/);
    expect(addedText).toMatch(/\+import \{ assertSubmissionEligible \}/);
    expect(addedText).toMatch(/\+import \{ resolveEligibilityContext \}/);
    expect(addedText).toMatch(/\+import \{ resolveProductFlowAuthorization \}/);
    // As adições do wiring b1b (roteamento de aceitação + revalidação server-side).
    // O import do orquestrador é reconhecido por MÓDULO + SÍMBOLOS (não por uma
    // formatação específica): os dois símbolos consumidos pela rota e o specifier
    // do módulo, num ÚNICO import consolidado (sem import duplicado do módulo).
    expect(addedText).toMatch(
      /import\s*\{[^}]*\brunProductOneToOneGeneration\b[^}]*\breadProductOneToOneOperation\b[^}]*\}\s*from\s*"@\/lib\/product-1-1\/orchestration\/generation-orchestrator"/,
    );
    expect(
      (
        addedText.match(
          /from\s*"@\/lib\/product-1-1\/orchestration\/generation-orchestrator"/g,
        ) ?? []
      ).length,
      "import do módulo do orquestrador deve ser ÚNICO (consolidado)",
    ).toBe(1);
    expect(addedText).toMatch(/\+import \{ NewFlowGenerateImageRequestSchema \}/);

    // (ii) As linhas adicionadas ANTES do índice do guard NÃO contêm `safeParse(`/
    // `fieldErrors` — as adições do novo ramo ficam confinadas ao caminho `allowed`.
    const guardAddedIdx = addedDiffLines.findIndex((l) =>
      l.includes("detectExclusiveNewFlowFields(body)"),
    );
    expect(guardAddedIdx).toBeGreaterThan(-1);
    const beforeGuard = addedDiffLines.slice(0, guardAddedIdx).join("\n");
    expect(beforeGuard).not.toMatch(/safeParse\(/);
    expect(beforeGuard).not.toMatch(/fieldErrors/);

    // (iii) O novo tratamento `allowed` é ADITIVO dentro do bloco do guard
    // existente — depois do guard e ANTES do `safeParse` legado e da reserva.
    const source = readFileSync(path.resolve(REPOSITORY_ROOT, AUTHORIZED_ROUTE_FILE), "utf8");
    const guardIdx = source.indexOf("detectExclusiveNewFlowFields(body)");
    const allowedIdx = source.indexOf('guard.kind === "allowed"');
    const legacySafeParseIdx = source.indexOf("GenerateImageRequestSchema.safeParse(body)");
    const reserveIdx = source.indexOf("creditService.reserveCredit(");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(allowedIdx).toBeGreaterThan(guardIdx);
    expect(legacySafeParseIdx).toBeGreaterThan(allowedIdx);
    expect(reserveIdx).toBeGreaterThan(legacySafeParseIdx);
    // O wiring b1b é realmente efetivado (não apenas autorizado no comentário).
    expect(source).toMatch(/return await runProductOneToOneGeneration\(/);
  });

  it("o guard roda ANTES do safeParse e da reserva, preservando o fluxo legado", () => {
    const source = readFileSync(
      path.resolve(REPOSITORY_ROOT, AUTHORIZED_ROUTE_FILE),
      "utf8",
    );

    const guardIdx = source.indexOf("detectExclusiveNewFlowFields(body)");
    const safeParseIdx = source.indexOf("GenerateImageRequestSchema.safeParse(body)");
    const reserveIdx = source.indexOf("creditService.reserveCredit(");

    expect(guardIdx).toBeGreaterThan(-1);
    expect(safeParseIdx).toBeGreaterThan(guardIdx);
    expect(reserveIdx).toBeGreaterThan(safeParseIdx);

    // Sem duplicação dos pontos críticos.
    expect(source.match(/GenerateImageRequestSchema\.safeParse\(body\)/g)?.length).toBe(1);
    expect(source.match(/creditService\.reserveCredit\(/g)?.length).toBe(1);
    // Resposta de validação legada (400 com details/fieldErrors) preservada.
    expect(source).toMatch(/details: parsed\.error\.flatten\(\)\.fieldErrors/);
  });

  it("a rota de download evolui para o portão do novo fluxo preservando o ramo legado", () => {
    const diff = git([
      "diff",
      "--unified=0",
      `${BASE_SHA}..HEAD`,
      "--",
      AUTHORIZED_DOWNLOAD_ROUTE_FILE,
    ]);
    const added = diff
      .split(/\r?\n/)
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"));

    const addedText = added.join("\n");
    // O ramo novo é ADITIVO: importa o portão, a arte e o cliente de operação.
    expect(addedText).toMatch(/download-gate/);
    expect(addedText).toMatch(/artifact\/artifact-store/);
    expect(addedText).toMatch(/orchestration\/attempt-start-client/);
    expect(addedText).toMatch(/decideNewFlowDownload/);

    const source = readFileSync(
      path.resolve(REPOSITORY_ROOT, AUTHORIZED_DOWNLOAD_ROUTE_FILE),
      "utf8",
    );
    const approvedSource = git([
      "show",
      `${AUTHORIZED_DOWNLOAD_ROUTE_COMMIT}:${AUTHORIZED_DOWNLOAD_ROUTE_FILE}`,
    ]);

    // (i) O bloco legado COMPLETO (F37 + storage privado + resposta + fechamento)
    // é comparado por CONTEÚDO contra o commit aprovado. A ÚNICA diferença
    // admitida é a extração EXATA do cálculo do nome para o helper compartilhado.
    const approvedLegacy = legacyBlock(approvedSource);
    expect(approvedLegacy).toContain(LEGACY_FILENAME_CALCULATION);
    const expectedLegacy = approvedLegacy.replace(
      LEGACY_FILENAME_CALCULATION,
      SHARED_FILENAME_CALCULATION,
    );
    expect(normalize(expectedLegacy)).not.toBe(normalize(approvedLegacy));
    expect(normalize(legacyBlock(source))).toBe(normalize(expectedLegacy));

    // (ii) O ramo legado (F37 + storage privado) permanece presente.
    expect(source).toMatch(/await isCampaignApprovalEnabled\(\)/);
    expect(source).toMatch(/isDeliveryReleased\(/);
    expect(source).toMatch(/from\("campaign-images"\)\s*\.download\(/);
    // (iii) Fail-closed: os bytes são entregues APÓS o portão liberar e a recusa
    // retorna ANTES da entrega; o ramo novo precede o gate legado da F37.
    const decisionIdx = source.indexOf("decideNewFlowDownload(");
    const rejectIdx = source.indexOf("decision.allowed");
    const deliverIdx = source.indexOf("downloadArtifact(");
    const f37Idx = source.indexOf("await isCampaignApprovalEnabled()");
    expect(decisionIdx).toBeGreaterThan(-1);
    expect(rejectIdx).toBeGreaterThan(decisionIdx);
    expect(deliverIdx).toBeGreaterThan(rejectIdx);
    expect(source.indexOf("getCampaignOperation(")).toBeLessThan(f37Idx);
    // A entrega do novo fluxo não é um redirect para a URL de exibição.
    expect(source).not.toContain("NextResponse.redirect");
  });
});

describe("legacy-frontier guard — reconciliação (testes negativos)", () => {
  const AUTHORIZED = AUTHORIZED_FRONTIER_CHANGES.map((entry) => entry.path);

  it("rejeita um caminho de fronteira EXTRA não autorizado", () => {
    // `adapters/images.ts` passou a ter entrada autorizada (261026-p11); o
    // controle negativo usa `adapters/registry.ts`, que está no perímetro
    // legado e permanece intencionalmente fora da lista autorizada.
    const changed = [...AUTHORIZED, "src/lib/ai/adapters/registry.ts"];
    const { extra } = diffAgainstAuthorized(changed, AUTHORIZED);
    expect(extra).toEqual(["src/lib/ai/adapters/registry.ts"]);
  });

  it("rejeita a ausência de um caminho autorizado", () => {
    const changed = AUTHORIZED.filter(
      (file) => file !== "src/lib/ai/types.ts",
    );
    const { missing } = diffAgainstAuthorized(changed, AUTHORIZED);
    expect(missing).toEqual(["src/lib/ai/types.ts"]);
  });

  it("rejeita alteração de CONTEÚDO em um caminho autorizado", () => {
    const entries = ADDITIONAL_AUTHORIZED_FILES.slice(0, 1);
    const file = entries[0].path;
    const mismatches = contentMismatches(
      entries,
      () => "conteúdo indevidamente alterado",
      () => "conteúdo aprovado",
    );
    expect(mismatches).toEqual([file]);
  });

  it("aceita caminhos e conteúdos quando idênticos ao autorizado", () => {
    const entries = ADDITIONAL_AUTHORIZED_FILES;
    const mismatches = contentMismatches(
      entries,
      (file) => readFileSync(path.resolve(REPOSITORY_ROOT, file), "utf8"),
      (commit, file) => git(["show", `${commit}:${file}`]),
    );
    expect(mismatches).toEqual([]);
  }, 20000);

  it("a exceção da rota aceita SOMENTE a remoção do import de persistência", () => {
    expect(unexpectedRouteRemovals([PERSISTENCE_IMPORT_BEFORE])).toEqual([]);

    const legacyLine =
      '  const safeName = campaign.product_name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "campanha";';
    const removals = unexpectedRouteRemovals([
      PERSISTENCE_IMPORT_BEFORE,
      legacyLine,
    ]);
    expect(removals).toContain(legacyLine);
    expect(removals).toHaveLength(1);
  });

  it("a transformação aditiva exata do import de persistência não gera violação", () => {
    expect(
      additivePersistenceImportViolations(
        [PERSISTENCE_IMPORT_BEFORE],
        [PERSISTENCE_IMPORT_AFTER],
      ),
    ).toEqual([]);
  });

  it("perder um símbolo do import de persistência é violação NOMEADA", () => {
    const missingSymbol = PERSISTENCE_IMPORT_AFTER.replace(
      "createArtVersion, uploadCampaignInputFile",
      "uploadCampaignInputFile",
    );
    expect(missingSymbol).not.toBe(PERSISTENCE_IMPORT_AFTER);
    expect(
      additivePersistenceImportViolations(
        [PERSISTENCE_IMPORT_BEFORE],
        [missingSymbol],
      ),
    ).toContain("symbol_lost:createArtVersion");
  });

  it("símbolo extra ou import ausente no diff da rota é violação NOMEADA", () => {
    const extraSymbol = PERSISTENCE_IMPORT_AFTER.replace(
      "createArtVersion, uploadCampaignInputFile",
      "createArtVersion, uploadCampaignInputFile, deleteCampaign",
    );
    expect(extraSymbol).not.toBe(PERSISTENCE_IMPORT_AFTER);
    expect(
      additivePersistenceImportViolations(
        [PERSISTENCE_IMPORT_BEFORE],
        [extraSymbol],
      ),
    ).toContain("unexpected_symbol:deleteCampaign");

    expect(
      additivePersistenceImportViolations(
        [PERSISTENCE_IMPORT_BEFORE],
        ['import { outro } from "@/lib/outro";'],
      ),
    ).toContain("added_missing_persistence_import");
  });
});
