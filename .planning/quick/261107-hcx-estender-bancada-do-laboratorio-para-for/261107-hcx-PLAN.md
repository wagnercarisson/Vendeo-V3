---
id: 261107-hcx
title: Estender a bancada do laboratório para 9:16 e comparar o modelo atual com gpt-image-2.6-sunburst
status: planned
created: 2026-11-07
branch: feat/quick-extensao-laboratorio-9-16
checkpoint_a: implementação + testes locais sem provider (aguarda aprovação)
checkpoint_b: ativação local + primeiras chamadas pagas (exige autorização específica)
---

# Plano — bancada 9:16 + gpt-image-2.6-sunburst

> **Somente planejamento.** Nenhum código de implementação, ambiente, catálogo ou
> banco foi alterado. Este plano para no CHECKPOINT A, antes da execução, para
> revisão do Codex e autorização explícita do responsável.

## 0. Estado confirmado antes do planejamento

- Branch atual: `feat/quick-extensao-laboratorio-9-16`.
- `git status` limpo; nenhuma alteração preexistente a preservar no worktree.
- A quick anterior (`261107-pdp`, página pública de praticidade/identidade) está
  concluída no commit `1267cead`.
- `supabase status` **falhou** para o container `supabase_db_Vendeo_V3`. Isso
  **não comprova** indisponibilidade do ambiente já utilizado na F59: o
  CHECKPOINT B deve localizar o ambiente existente e conferir seus alvos
  (Supabase/host, schema, bucket), **sem iniciar outro stack e sem executar
  bootstrap automaticamente**. Nesta etapa, o schema local não foi acessado nem
  verificado.
- `.env.local` contém a chave `OPENAI_BENCH_API_KEY` (apenas o nome foi
  conferido; nenhum valor foi lido/exibido). `VENDEO_LAB_ENABLED` **não** está
  presente no arquivo, portanto a guarda local está desabilitada por default.
- Nenhuma dependência foi alterada.

## 1. Objetivo

Permitir, na bancada existente e sem reconstruí-la, testes manuais de prompt e
modelo em `1:1` e `9:16`, comparando o Sunburst 2.5 atual com
`gpt-image-2.6-sunburst` (qualidade `medium`). A bancada permanece isolada da
produção; não vira espelho do fluxo produtivo.

## 2. Evidência oficial do modelo (consultada em 2026-11-07)

Fonte: `https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst` e
`https://developers.openai.com/api/docs/guides/image-generation`.

| Item | Confirmação |
|---|---|
| ID | `gpt-image-2.6-sunburst` (snapshot/alias do mesmo ID) |
| Provider | `openai` |
| Protocolo | `images` — `v1/images/generations` e `v1/images/edits` suportados; Responses **não** suportado |
| Modalidades | entrada texto + imagem; saída imagem |
| Pricing Standard | texto de entrada US$5/M; imagem de entrada US$8/M; imagem de saída US$30/M. Cache de texto US$1,25/M e de imagem US$2/M **não** é simulado no caminho direto `Images` |
| `usage` | token-based |
| Qualidades | `low`, `medium`, `high`, `xhigh`, `max` (a página de pricing confirma a mesma lista para 2.6) |
| Tamanho (geometria documentada) | tamanhos recomendados `1024x1024`, `1536x1024`, `1024x1536`; **dimensões customizadas** `WIDTHxHEIGHT` exigem múltiplos de 16, proporção entre 1:3 e 3:1, aresta ≤ 3840 e total de pixels entre 655.360 e 8.294.400. `1152×2048` **satisfaz as restrições geométricas** (1152/16 = 72; 2048/16 = 128; 9:16; 2.359.296 px) |
| Aceitação efetiva de `1152×2048` | **Não comprovada por documentação específica do modelo.** Depende de chamada paga autorizada no CHECKPOINT B; não será substituída silenciosamente por outro tamanho |
| Controles novos | `complexity` (default `high`), markup, SVG e GIF existem no 2.6, mas ficam **fora do escopo** desta extensão |

**Conclusão:** o ID e os parâmetros centrais estão confirmados. `1152×2048`
satisfaz as **restrições geométricas** documentadas, mas a **aceitação efetiva
pelo modelo** e o retorno dimensional real só podem ser comprovados em chamada
paga autorizada (CHECKPOINT B), sem substituição silenciosa por outro tamanho.

## 3. Decisões de design

### 3.1 Resolvedor interno de formato (não é resolvedor produtivo)

Criar um módulo puro da bancada, `src/lib/lab/bench/domain/bench-format.ts`, com
uma tabela fechada:

| formato | size no wire | width | height | aspectRatio |
|---|---|---|---|---|
| `1:1` | `1024x1024` | 1024 | 1024 | 1 |
| `9:16` | `1152x2048` | 1152 | 2048 | 9/16 |

Responsabilidades:
- `resolveBenchFormat(formato)` — valida contra a tabela e devolve a spec;
- `expectedAspectRatioForFormat` / `expectedDimensionsForFormat`;
- `sizeForFormat`;
- erro determinístico `bench_format_unsupported` para valor fora da tabela.

O módulo é a única autoridade de dimensão da bancada. **Não** importa
`src/lib/product-vertical-9-16` nem o resolvedor de formato produtivo; a
paridade com a F59 (`1152x2048`) fica documentada e testada por valor, mantendo o
isolamento. O `config-registry` continua sendo a autoridade de quais formatos
estão habilitados.

### 3.2 Prompt final livre

O editor final existente (`BenchPreflightPanel`, textarea "Prompt compilado") já
permite edição integral e o `POST /runs` já envia `promptApproved` byte a byte.
A extensão é de clareza e preservação, não de novo editor:

- renomear o rótulo para **"Prompt final (editável)"** e explicar que o texto
  pode ser integralmente substituído pelo baseline produtivo ou por uma variante
  manual;
- manter `promptBase` separado (instruções complementares), sem colar o prompt
  completo nele;
- preservar `promptCompiled` (saída do compositor da bancada) e `promptApproved`
  (texto final) como campos distintos, com `composerVersion`/`policyVersions`;
  uma substituição manual **não** é atribuída ao compositor produtivo;
- adicionar estado `finalPromptEdited`: quando o operador edita/substitui o texto
  final, uma recomposição atualiza `promptCompiled`/evidências, mas **não**
  sobrescreve o texto manual; um botão explícito "Usar texto compilado" permite
  voltar ao compilado;
- a aprovação continua explícita; o envio continua sendo exatamente o texto
  aprovado, sem instruções adicionais posteriores;
- editar/substituir o texto final invalida **a aprovação e a confirmação
  financeira** (`executionConfigRevision`), pois o conteúdo e os tokens de
  entrada mudaram; `handleEditFinal` passa a incrementar as duas revisões.

### 3.3 Modelo 2.6 na bancada

- Adicionar `gpt-image-2.6-sunburst` **somente** a `BENCH_MODEL_ALLOWLIST`,
  `BENCH_PRESETS` e `BENCH_PRICING_ENTRIES`.
- Adicionar o preset `gpt-image-2.6-sunburst-medium` (qualidade `medium`). O
  `size` do preset continua sendo o default `1024x1024`; o tamanho efetivo é
  derivado do formato pelo resolvedor, **sem** mutar o preset.
- `complexity` **não** será enviado nesta entrega. O default documentado é
  `high`; isso será registrado como omitido. Não se afirma que fixar `medium`
  produziria comparação necessariamente mais justa.
- **Preservar todos os presets existentes** e a qualidade `low`/`medium` deles.
- O formato `9:16` fica disponível nos presets habilitados, preservando o default
  `1:1`; a matriz paga inicial continua restrita aos dois Sunburst `medium`
  (2.5 e 2.6).
- Registrar o preset 2.6 como `enabled: false` no CHECKPOINT A, com motivo
  explícito (`checkpoint_b_pendente`), e habilitá-lo somente no CHECKPOINT B,
  depois da autorização e da conferência local. A allowlist/pricing já ficam
  cadastrados no CHECKPOINT A.
- Não alterar `MODEL_ALLOWLIST`, `ai_model_selection`, pricing produtivo,
  migrações de produção nem a matriz de modelos do fluxo novo.
- Não reutilizar estimativas de tokens de saída do 2.5 para o 2.6. Como não há
  valor comprovado de `medium`, a estimativa de saída fica **ausente**
  (`estimatedCostUsd: null`), nunca inventada.

### 3.4 Pricing e custo

- Nova versão da regra local: `2026-11-bench-4`.
- Tarifas do 2.6: exatamente texto US$5/M, imagem de entrada US$8/M, imagem de
  saída US$30/M.
- Entradas de pricing por `provider + model + protocol + quality + size`:
  - 2.6 `medium` em `1024x1024` e `1152x2048`;
  - 9:16 (`1152x2048`) para os presets existentes, com as mesmas tarifas e
    **sem** `estimatedOutputTokens` (nenhum valor comprovado para esse tamanho);
  - cobertura `partial`; estimativa de saída ausente onde não há prova.
- O cálculo pós-`usage` continua sendo taxas por componente × tokens do `usage`.
- `providerReportedCostUsd`, `usageReported` e `estimatedCostUsd` permanecem em
  campos separados. Não há hard cap financeiro: a estimativa é parcial, a
  confirmação é um gate manual e `maxRetries: 0` apenas evita repetição
  automática da chamada HTTP.

### 3.5 Validação do artefato (sem resize)

- Estender `validateArtifactTechnically` com parâmetros **opcionais**
  `expectedWidth`/`expectedHeight`, preservando o comportamento atual de todos os
  chamadores que não os passam.
- Novo alerta `dimensions_mismatch` quando a dimensão real decodificada diverge
  da esperada.
- No `executeBenchRun`, quando a rota informar a dimensão esperada, divergência
  é **falha terminal** do run (`bench_dimensions_mismatch`): não persiste a saída
  como sucesso, não faz resize/crop/pad e não copia o tamanho solicitado para o
  metadado. O erro é sanitizado.
- **Obrigatório:** se houve resposta do provider, registrar `usage`, custo
  disponível e dimensões reais **mesmo quando o run falhar** por divergência
  dimensional (`technical_validation` com width/height e `cost_detail`/`usage`
  no run). A evidência da chamada paga nunca é descartada; a falha não vira
  sucesso.
- O adapter da bancada continua sem fallback e sem segunda chamada; passa a
  criar o cliente com `maxRetries: 0` **somente** na bancada.

### 3.6 Isolamento

- Manter `requireAdmin`, `assertLabEnvironment`, `assertBenchTestStore`,
  `OPENAI_BENCH_API_KEY` exclusiva e bucket/tabelas existentes.
- Nenhum fallback para `OPENAI_API_KEY`/credenciais produtivas.
- Reutilizar `lab_bench_runs`, `lab_bench_artifacts`, bucket `lab-artifacts` e o
  histórico existente.
- Não criar outro ambiente, não iniciar outro stack, não executar bootstrap
  automático e não tocar produção.

## 4. Escopo

### Dentro

1. Seletor de formato funcional (`1:1` e `9:16`).
2. Resolvedor interno de formato/dimensões.
3. Propagação de formato por composição, aprovação, estimativa, execução,
   histórico e nova tentativa.
4. Editor final livre com preservação do texto manual.
5. Preset/pricing/allowlist do 2.6 (preset desabilitado no CHECKPOINT A).
6. Validação dimensional fail-closed e `maxRetries: 0` no adapter da bancada.
7. Testes sem provider, gates locais e documentação do CHECKPOINT B.

### Fora

- Alterar prompt, fluxo, modelos, catálogo, pricing ou seleção de produção.
- Cadastrar modelos no `ai_model_catalog` (nenhum cadastro nesta entrega).
- Iniciar outro stack Supabase ou executar bootstrap automático.
- Copiar crédito, copy, recuperação ou engine produtiva para o laboratório.
- Reproduzir JPEG, miniaturas ou entrega comercial.
- Automatizar avaliação visual ou promoção de modelos.
- Refatorar todo o laboratório.
- `complexity`, markup, máscaras, SVG, animação ou novos controles.
- Alterar dependências/SDK globalmente.
- Migração de produção, push, deploy ou publicação.
- Prometer hard cap financeiro.

## 5. Arquivos afetados (previstos)

| Arquivo | Mudança |
|---|---|
| `src/lib/lab/bench/domain/bench-format.ts` (novo) | Tabela fechada `1:1`/`9:16`, size, dimensão exata, proporção esperada e erro `bench_format_unsupported` |
| `src/lib/lab/bench/domain/config-registry.ts` | Habilitar `9:16`; manter `DEFAULT_BENCH_CONFIG` em `1:1` |
| `src/lib/lab/bench/domain/policies/formato-9-16.ts` (novo) | Política versionada do formato vertical |
| `src/lib/lab/bench/domain/policies/registry.ts` | Registrar a política `9:16` |
| `src/lib/lab/bench/domain/prompt-base.ts` | Registrar o recorte `9:16` (mesmo conteúdo/versão do prompt-base; a especificidade fica na política de formato) |
| `src/lib/lab/bench/domain/bench-model-allowlist.ts` | Adicionar `gpt-image-2.6-sunburst: ["images"]` |
| `src/lib/lab/bench/domain/preset-registry.ts` | Adicionar `gpt-image-2.6-sunburst-medium` (desabilitado com motivo no CHECKPOINT A) |
| `src/lib/lab/bench/domain/bench-pricing.ts` | Regra `2026-11-bench-4`, tarifas do 2.6 e entradas `9:16`; nenhuma estimativa inventada |
| `src/lib/lab/bench/domain/schemas.ts` | `formato` opcional no `BenchRunInputSchema` (default `1:1` na rota, sem aceitar `size` do cliente) |
| `src/lib/lab/bench/execution/bench-cost-resolver.ts` | Aceitar `size` efetivo do formato e chavear o pricing por ele |
| `src/lib/lab/bench/gateway/runtime.ts` | `buildBenchInvocationRequest` aceitar `size` explícito do formato |
| `src/lib/lab/bench/execution/bench-execution-service.ts` | Receber dimensão/proporção esperadas, falhar em divergência, registrar tamanho real e custo disponível na falha |
| `src/lib/lab/technical-validation.ts` | `expectedWidth`/`expectedHeight` opcionais + alerta `dimensions_mismatch` |
| `src/lib/ai/adapters/bench-images.ts` | `maxRetries: 0` somente na bancada; nenhuma outra mudança |
| `src/app/api/admin/laboratorio/bancada/compose/route.ts` | Aceitar `formato`, resolver config/registry e devolver formato/tamanho |
| `src/app/api/admin/laboratorio/bancada/estimate/route.ts` | Aceitar `formato`, resolver tamanho e estimar pelo preset completo |
| `src/app/api/admin/laboratorio/bancada/runs/route.ts` | Aceitar `formato`, persistir `config`/`size`, executar com dimensão esperada |
| `src/app/api/admin/laboratorio/bancada/runs/[id]/attempts/route.ts` | Devolver `config`/`size` da origem para prefill do novo `draft` |
| `src/app/api/admin/laboratorio/bancada/runs/[id]/route.ts` | Expor `formato` (via `config`) e dimensões retornadas na evidência |
| `src/app/(app)/admin/laboratorio/bancada/_components/bench-workbench.tsx` | Estado de formato; troca de formato e edição do prompt final invalidam aprovação **e** estimativa/confirmação; preservação do prompt manual |
| `.../bench-preset-selector.tsx` | Select de formato controlado; exibir tamanho efetivo; preservar presets |
| `.../bench-execution-panel.tsx` | Enviar `formato` na estimativa e no `POST /runs`; exibir formato/tamanho |
| `.../bench-preflight-panel.tsx` | Rótulo "Prompt final (editável)", aviso de substituição integral e botão explícito de restaurar compilado |
| `.../bench-evidence-panel.tsx` | Exibir formato e dimensões reais do artefato |
| Testes listados na seção 9 | Atualizações e novos contratos |

## 6. Fluxo proposto

1. **Preparar referências** — loja de teste do manifesto, upload das imagens do
   produto (bucket/tabelas existentes).
2. **Selecionar formato/modelo** — `1:1` ou `9:16`; modelo/qualidade entre os
   presets habilitados (2.6 `medium` só após ativação do CHECKPOINT B).
3. **Editar prompt final** — compor pelo compositor da bancada ou substituir
   integralmente pelo baseline produtivo/variante manual no editor final.
4. **Aprovar** — aprovação explícita do texto final; evidência preserva
   `promptCompiled`, `promptApproved`, `policyVersions`, `composerVersion`.
5. **Estimar/confirmar** — estimativa pelo preset completo + formato; confirmação
   financeira manual e individual.
6. **Executar** — single-shot, `OPENAI_BENCH_API_KEY`, `maxRetries: 0`, formato e
   dimensão no wire; falha se a resposta divergir.
7. **Inspecionar** — imagem, dimensões reais, `usage`, custo calculado, custo
   reportado pelo provider, prompt enviado e histórico/linhagem.

## 7. Troca de formato × troca de modelo/qualidade

| Evento | Aprovação do prompt | Estimativa/confirmação | Texto manual | Ação exigida |
|---|---|---|---|---|
| Troca de formato (`1:1` ↔ `9:16`) | **Invalida** (política/snapshot/`format` mudam) | **Invalida** | **Preservado** | Recompor para atualizar `promptCompiled`/evidências e reaprovar |
| Troca de modelo | Mantém byte a byte | **Invalida** | **Preservado** | Nova estimativa/confirmação; sem recompor |
| Troca de qualidade | Mantém byte a byte | **Invalida** | **Preservado** | Nova estimativa/confirmação; sem recompor |
| Edição do prompt final | **Invalida** até reaprovar | **Invalida** (conteúdo e tokens de entrada mudaram) | É o próprio texto | Aprovar novamente, estimar e confirmar de novo |
| Nova tentativa | Invalida (novo `draft`) | Reinicia | **Preservado** | Restaurar formato da origem, recompor se necessário e reaprovar |

Regra de ouro: formato é **entrada de composição**; modelo/qualidade são
**configuração de execução**. O prompt aprovado nunca é perdido por troca de
modelo/qualidade; por troca de formato ele deixa de ser válido, mas o texto
manual permanece no editor.

## 8. Schema, catálogo e dependências

- **Sem migration estrutural, troca de endpoint ou cópia da engine produtiva.**
  O caminho continua sendo o `images` já usado pela bancada.
- **Schema:** nenhuma coluna nova. `lab_bench_runs.config` (JSONB) já registra
  `formato`; `lab_bench_runs.size` registra o tamanho efetivo; o snapshot já tem
  `format`. Nenhuma migração de produção.
- **Catálogo local: nenhum cadastro.** O runtime da bancada **não** consulta
  `ai_model_catalog`; a autoridade é `BENCH_MODEL_ALLOWLIST` + `BENCH_PRESETS`.
  O `validatePresetAgainstCatalog` é apenas contrato de teste. Não será criada
  linha em `campaign_image` (risco de exposição na seleção administrativa de
  produção) nem em qualquer outra capability nesta entrega. Não há dependência
  de catálogo a resolver no CHECKPOINT B.
- **Dependências:** nenhuma nova. O SDK OpenAI já expõe `size` customizado e
  `maxRetries`; o adapter já usa `as never` para o payload, então não há
  necessidade de upgrade. `complexity` não será enviado.
- **Banco local:** `supabase status` falhou para o container padrão, o que não
  comprova indisponibilidade do ambiente usado na F59. O CHECKPOINT B começa
  localizando o ambiente existente e verificando seus alvos em read-only; se o
  schema da bancada faltar, aplica `supabase/lab/bench-schema.sql` (idempotente)
  somente após autorização, sem iniciar outro stack nem bootstrap global.

## 9. Testes sem provider

| # | Contrato | Onde |
|---|---|---|
| 1 | Regressão `1:1`: `DEFAULT_BENCH_CONFIG`, política, composição e wire `1024x1024` byte-idênticos | `config-registry.test.ts`, `prompt-policy.contract.test.ts`, `prompt-composer.contract.test.ts`, `bench-execution.contract.test.ts` |
| 2 | Formato e dimensões no wire: `9:16` → `1152x2048`, proporção 9/16, dimensão esperada | `bench-format.test.ts` (novo), `bench-execution.contract.test.ts` |
| 3 | Texto aprovado idêntico ao enviado, inclusive substituição integral manual | `bench-execution.contract.test.ts` |
| 4 | Ordem das referências: produto primário, adicionais na ordem, identidade por último | `bench-images-adapter.test.ts`, `bench-execution.contract.test.ts` |
| 5 | Invalidação: formato invalida aprovação **e** confirmação; edição do prompt final invalida **ambas**; modelo/qualidade não invalidam a aprovação | `preflight-revalidation.contract.test.ts`, `bench-workbench`/UI contract |
| 6 | Histórico/repetição: `config.formato`, `size` e prompt persistidos; nova tentativa devolve formato da origem | `run-history.contract.test.ts`, `bench-run-service.test.ts`, `bench-api.contract.test.ts` |
| 7 | Dimensão divergente: resposta quadrada para `9:16` falha (`bench_dimensions_mismatch`), sem resize e sem sucesso; `usage`, custo disponível e dimensões reais persistidos na falha | `bench-execution.contract.test.ts`, `technical-validation.test.ts` |
| 8 | Isolamento: somente `OPENAI_BENCH_API_KEY`; sem fallback produtivo; 2.6 fora do `MODEL_ALLOWLIST`; sem imports de produção; nenhum cadastro em `ai_model_catalog` | `bench-api-key.contract.test.ts`, `bench-boundary.contract.test.ts`, `preset-registry.test.ts` |
| 9 | Pricing: tarifas do 2.6, `medium`/`9:16` sem estimativa inventada, cálculo pós-usage, provider reportado separado; referência conservadora nunca apresentada como consumo comprovado | `bench-pricing.test.ts`, `bench-execution.contract.test.ts`, `estimate.test.ts` |
| 10 | UI: select de formato funcional, estimativa `null` exibida como "indisponível" (nunca zero), prompt manual preservado | `bench-ui.contract.test.tsx` |
| 11 | Adapter: `maxRetries: 0` e `size`/`quality` no payload | `bench-images-adapter.test.ts` |

Todos os testes devem rodar com fakes/`vi.mock` e sem rede. Nenhum teste pode
depender de `OPENAI_BENCH_API_KEY` real.

## 10. Gates locais (CHECKPOINT A)

1. `npm run typecheck`
2. `npm run lint`
3. `npx vitest run` nos arquivos da bancada, `src/lib/lab/technical-validation`,
   `src/lib/ai/adapters` e contratos de UI/API citados.
4. `npm run build` (ou ao menos o build Next do escopo) para garantir que as
   rotas/páginas compilam.
5. `git diff --check` e revisão do diff para confirmar que:
   - nenhum arquivo de produção (`MODEL_ALLOWLIST`, pricing produtivo,
     `ai_model_selection`, `product-1-1`, `product-vertical-9-16`, engine,
     compositor produtivo) foi alterado;
   - nenhum `package.json`/lockfile mudou;
   - nenhuma migração de produção foi criada;
   - nenhum segredo/URL apareceu em código/teste.
6. Testes sem provider devem falhar se houver tentativa de rede.

## 11. CHECKPOINT A — implementação e testes locais

Pré-condição: aprovação explícita deste plano pelo responsável e revisão do
Codex.

Entregas:
- código e testes da seção 5/9;
- falha dimensional com resposta do provider persiste `usage`, custo disponível e
  dimensões reais (obrigatório);
- preset 2.6 **desabilitado** com motivo `checkpoint_b_pendente`;
- nenhuma chamada paga, nenhuma escrita local, nenhum bootstrap, nenhum cadastro
  em `ai_model_catalog`;
- diff revisável e gates verdes.

Não inclui: ativar `VENDEO_LAB_ENABLED`, subir/iniciar stack, aplicar schema,
cadastrar catálogo, habilitar o preset ou chamar o provider.

## 12. CHECKPOINT B — ativação local e primeiras chamadas pagas

Pré-condição: autorização específica de ambiente, matriz e orçamento, após o
CHECKPOINT A aprovado.

Sequência mínima:
1. Localizar o ambiente já existente utilizado na F59 e conferir seus alvos em
   **read-only** (Supabase/host, schema `lab_bench_runs`/`lab_bench_artifacts`,
   bucket `lab-artifacts`). **Não iniciar outro stack** nem executar bootstrap
   automaticamente.
2. Se o schema da bancada faltar no ambiente localizado, aplicar **somente**
   `supabase/lab/bench-schema.sql` (idempotente), com registro do que foi
   aplicado. Sem bootstrap global e sem criar ambiente novo.
3. Confirmar `OPENAI_BENCH_API_KEY` exclusiva e `VENDEO_LAB_ENABLED=true`; sem
   fallback para chave produtiva.
4. **Nenhum cadastro em `ai_model_catalog`.** O runtime não consulta o catálogo;
   não há etapa de catálogo no CHECKPOINT B.
5. Habilitar o preset 2.6 (`enabled: true`) após a conferência acima.
6. Matriz paga inicial, uma chamada por vez, restrita aos dois Sunburst `medium`:
   - `gpt-image-2.5-sunburst` `medium` em `1:1` e `9:16`;
   - `gpt-image-2.6-sunburst` `medium` em `1:1` e `9:16`.
   Total inicial: **4 chamadas**. Nenhuma variante manual na matriz inicial.
7. Registrar por chamada: prompt aprovado, formato, size solicitado, dimensão
   retornada, `usage`, custo calculado, custo reportado (se houver), latência,
   artefato e status. Em falha dimensional com resposta do provider, registrar
   também `usage`, custo disponível e dimensões reais.
8. Parar imediatamente em: divergência dimensional, erro de autenticação,
   indisponibilidade do modelo, custo inesperado ou qualquer sinal de uso de
   credencial produtiva.

**Orçamento:** não há hard cap técnico. A matriz é limitada por disciplina
operacional e confirmação manual. O valor exato não pode ser prometido antes das
chamadas; a estimativa de saída para `medium`/`9:16` está ausente de propósito.
Antes do CHECKPOINT B, o responsável deve definir o orçamento e uma **referência
conservadora de gasto**, identificada explicitamente como estimativa — sem
apresentá-la como consumo comprovado nem como zero.

## 13. Riscos

1. **Disponibilidade da conta**: o modelo está documentado, mas a conta pode
   exigir API Organization Verification ou não ter acesso. Só o CHECKPOINT B
   comprova.
2. **Aceitação efetiva da dimensão**: `1152x2048` satisfaz as restrições
   geométricas documentadas, mas a aceitação efetiva pelo 2.6 não está
   comprovada; o provider pode rejeitar ou devolver outra dimensão. A bancada
   falha fechado, não faz resize e não substitui silenciosamente por outro
   tamanho.
3. **Complexity default `high`**: omitir `complexity` no 2.6 pode torná-lo menos
   comparável ao 2.5. Fica registrado como omitido; não se afirma que fixar
   `medium` produziria comparação necessariamente mais justa.
4. **Pricing sem estimativa**: `medium`/`9:16` fica "indisponível" até haver
   captura comprovada do calculador oficial; não é defeito e nunca é exibido como
   zero.
5. **Sem hard cap**: a confirmação manual não garante teto financeiro.
6. **Ambiente local**: o container padrão não respondeu, mas isso não prova
   indisponibilidade do ambiente da F59; a verificação fica para o CHECKPOINT B,
   sem iniciar outro stack.
7. **Catálogo**: decisão fechada — nenhum cadastro; o runtime não consulta
   `ai_model_catalog`.
8. **Regressão 1:1**: a política/composição 1:1 deve permanecer byte-idêntica;
   testes de golden são obrigatórios.
9. **Validação técnica compartilhada**: os novos parâmetros são opcionais para
   não alterar os chamadores de produção.
10. **UI de prompt manual**: recompor não pode sobrescrever o texto manual sem
    ação explícita.

## 14. Decisões fechadas e pendências operacionais

### Fechadas
1. **`complexity`**: não enviar nesta entrega; registrar que foi omitido. Não
   afirmar que fixar `medium` produziria comparação necessariamente mais justa.
2. **9:16 nos presets**: disponível nos presets habilitados, preservando o default
   `1:1`; a matriz paga inicial fica restrita aos dois Sunburst `medium`.
3. **Catálogo**: nenhum cadastro. O validador de catálogo não é chamado pelo
   runtime atual.
4. **2.6 no CHECKPOINT A**: desabilitado, com motivo explícito.
5. **Custo em falha dimensional**: obrigatório registrar `usage`, custo
   disponível e dimensões reais sempre que houve resposta do provider.
6. **Estimativa ausente**: exibir como indisponível, nunca como zero; não
   inventar consumo comprovado.

### Pendências operacionais do CHECKPOINT B
1. Localizar o ambiente existente da F59 e confirmar os alvos, sem novo stack.
2. Definir orçamento e referência conservadora de gasto, identificada como
   estimativa.
3. Confirmar a matriz de 4 chamadas e a autorização específica.

## 15. Critérios de aceite

- [ ] `1:1` continua em `1024x1024` e a composição 1:1 permanece byte-idêntica.
- [ ] `9:16` solicita `1152x2048` e propaga formato por composição, aprovação,
      estimativa, execução, histórico e nova tentativa. A geometria é validada
      localmente; a aceitação efetiva pelo 2.6 fica pendente de prova paga e não é
      substituída silenciosamente.
- [ ] Resposta com dimensão/proporção divergente falha; nenhum resize é aplicado;
      `usage`, custo disponível e dimensões reais são persistidos quando houve
      resposta do provider.
- [ ] O texto final aprovado é enviado integralmente, mesmo quando substituído
      manualmente; `promptCompiled` e `promptApproved` permanecem distinguíveis.
- [ ] Troca de formato e edição do prompt final invalidam aprovação **e**
      confirmação financeira; troca de modelo/qualidade invalida apenas a
      confirmação e preserva o prompt.
- [ ] O prompt manual não é perdido ao recompor/trocar configuração.
- [ ] 2.6 está somente na allowlist/presets/pricing da bancada; produção
      intacta; preset desabilitado até o CHECKPOINT B; nenhum cadastro em
      `ai_model_catalog`.
- [ ] Estimativas não comprovadas ficam ausentes e são exibidas como
      indisponível, nunca como zero; nenhuma tarifa/token inventado.
- [ ] Credenciais: somente `OPENAI_BENCH_API_KEY`, sem fallback.
- [ ] Nenhuma dependência, migração de produção, bootstrap, novo stack ou chamada
      paga no CHECKPOINT A.
- [ ] Gates locais verdes e diff restrito ao escopo.

---

**PLANEJAMENTO PRONTO — IMPLEMENTAÇÃO NÃO INICIADA**
