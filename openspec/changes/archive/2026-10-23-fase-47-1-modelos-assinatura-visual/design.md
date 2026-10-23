# Design — F47.1 Configuração e validação local de modelos da Assinatura Visual

## Context

A F47 concluída permanece preservada. Esta change é uma fase sucessora e
isolada, **F47.1**, restrita à validação local da geração de Assinatura Visual
(VS). Este `design.md` e as specs da change são a base normativa; não há
dependência de documento preliminar externo.

Estado atual relevante:

- A VS usa uma única chamada Responses com a tool `image_generation`
  (`src/lib/visual-signature/ai-image-generator.ts`).
- A tool é enviada sem `model` explícito e com `quality: "auto"`.
- O modelo da VS é resolvido pela seleção genérica `ai_model_selection`
  (`visual_signature_image`, default `gpt-5.5/responses`).
- `gpt-6-luna` existe na allowlist apenas com `chat-completions`; não há linha
  de catálogo `visual_signature_image/openai/gpt-6-luna/responses`.
- O retry recria o gerador e não congela a configuração.
- O custo da tool usa o valor provisório `responses:image_generation = 0.065`.
- `image_model_pair_config` (Produto 1:1) é independente e não será alterado.
- A documentação oficial confirma `gpt-6-luna` + tool `image_generation` via
  Responses e o campo `model` da tool. Permanecem pendentes apenas acesso
  efetivo da conta, comportamento real de imagem + JSON na mesma resposta e
  forma exata do usage da tool. Nenhuma chamada paga será feita nesta etapa.

## Goals / Non-Goals

**Goals:**

1. Permitir, localmente, as 8 combinações de orquestrador × preset de imagem
   da VS, com configuração administrativa dedicada, auditada e congelada.
2. Preservar integralmente o caminho legado quando não houver configuração
   dedicada.
3. Enviar modelo e qualidade explícitos na tool, sem etapa separada de direção
   e sem fallback `image-2-low`.
4. Registrar e atribuir usage/custo sem duplicar reasoning nem tokens de
   imagem, distinguindo estimativa, parcial, desconhecido e reportado.
5. Impedir consumo da configuração experimental fora do ambiente local
   aprovado, com isolamento efetivo em runtime e credencial de provider
   separada.
6. Registrar parsing e aplicação de fallback da intenção criativa
   separadamente, preservando `intended_palette` e `content_used`.
7. Reordenar o admin sem tornar obsoletas as capacidades compartilhadas.
8. Explicitar quantidade e custo estimado do UAT, com 2 gerações iniciais
   obrigatórias e 6 combinações apenas disponíveis.

**Non-Goals:**

- Alterar Produto 1:1, `campaign_image`, `campaign_image_edit`, prompts,
  validação semântica, Storage, draft, aprovação/rejeição, histórico, drift ou
  perfil de marca.
- Criar etapa separada de direção por Luna.
- Adicionar fallback `gpt-image-2-low`.
- Aplicar migration remota, alterar produção, fazer push/deploy ou executar
  chamada paga nesta etapa.
- Declarar aprovação de produção por combinação; isso é etapa futura.

## Decisions

### D1 — F47.1 como fase isolada, com configuração dedicada

A configuração da VS fica em uma tabela singleton própria,
`visual_signature_model_config`, separada de `ai_model_selection` e de
`image_model_pair_config`.

**Por que não reutilizar `image_model_pair_config`:** ele representa o par
principal/fallback do Produto 1:1, tem CHECK de `scope='new_flow'`, RPC e
semântica de fallback próprios. Reutilizá-lo acoplaria dois fluxos e violaria a
independência exigida.

**Por que não reutilizar `ai_model_selection`:** a seleção genérica não tem
dimensão de preset de imagem, não congela reasoning e não versiona a escolha
de forma adequada para uma comparação local. A linha de `visual_signature_image`
continua existindo como **seleção herdada** para o caminho legado e para
diagnóstico.

### D2 — Tabela, RPC e auditoria

Tabela:

```sql
CREATE TABLE public.visual_signature_model_config (
  scope               TEXT PRIMARY KEY DEFAULT 'visual_signature',
  environment_scope   TEXT NOT NULL DEFAULT 'local_validation',
  instance_identity   TEXT NOT NULL,
  orchestrator_model  TEXT NOT NULL,
  image_preset        TEXT NOT NULL,
  image_model         TEXT NOT NULL,
  image_quality       TEXT NOT NULL,
  reasoning_effort    TEXT NOT NULL DEFAULT 'low',
  config_version_id   UUID NOT NULL DEFAULT gen_random_uuid(),
  reason              TEXT,
  updated_by          UUID REFERENCES auth.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_vs_scope CHECK (scope = 'visual_signature'),
  CONSTRAINT chk_vs_environment CHECK (environment_scope = 'local_validation'),
  CONSTRAINT chk_vs_orchestrator CHECK (orchestrator_model IN ('gpt-5.5','gpt-6-luna')),
  CONSTRAINT chk_vs_quality CHECK (image_quality IN ('low','medium')),
  CONSTRAINT chk_vs_reasoning CHECK (reasoning_effort = 'low'),
  CONSTRAINT chk_vs_preset_tuple CHECK (
    (image_preset='flare_low'       AND image_model='gpt-image-2.5-flare'    AND image_quality='low') OR
    (image_preset='flare_medium'    AND image_model='gpt-image-2.5-flare'    AND image_quality='medium') OR
    (image_preset='sunburst_low'    AND image_model='gpt-image-2.5-sunburst' AND image_quality='low') OR
    (image_preset='sunburst_medium' AND image_model='gpt-image-2.5-sunburst' AND image_quality='medium')
  )
);
```

Regras:

- RLS `service_role` only; sem grants a `anon/authenticated`.
- `instance_identity` é derivada no servidor por
  `resolveCanonicalInstanceIdentity()` e gravada pela RPC; nunca vem do corpo
  do lojista.
- `reasoning_effort` é fixo em `low` nesta fase (ver D7). Não é um terceiro
  seletor.
- `config_version_id` é renovado a cada set; é a chave de congelamento.
- `admin_set_visual_signature_model_config` recebe ator, orquestrador, preset,
  reasoning, motivo, `operation_id` e identidade; valida contra o catálogo
  (`visual_signature_image`, `openai`, `responses`, `active`), deriva
  modelo/qualidade do preset, faz UPSERT singleton e audita na mesma
  transação.
- `admin_reset_visual_signature_model_config` remove a linha com auditoria e
  retorna o sistema à seleção herdada.
- Ações de auditoria: `visual_signature_model_config_update` e
  `visual_signature_model_config_reset`; target type
  `visual_signature_model_config`. Preservar todos os valores já aceitos no
  CHECK de `admin_audit_log`.
- Idempotência por `operation_id`; replay equivalente retorna
  `idempotent:true`; conteúdo divergente retorna conflito.
- Nenhuma migration de pricing. Pricing é dado operacional local, verificado
  por preflight e, se ausente, tratado pela política de D8.

**Alternativa rejeitada:** colunas novas em `ai_model_selection` (não há
dimensão de qualidade/reasoning/versão e misturaria a seleção genérica com uma
experiência local). **Alternativa rejeitada:** nova tabela multi-linha por
combinação (o requisito é uma configuração vigente singleton, congelada por
operação).

### D3 — Presets fechados e 8 combinações

Registry puro em código:

```ts
VISUAL_SIGNATURE_ORCHESTRATORS = ["gpt-5.5", "gpt-6-luna"] as const;

VISUAL_SIGNATURE_IMAGE_PRESETS = {
  flare_low:       { model: "gpt-image-2.5-flare",    quality: "low" },
  flare_medium:    { model: "gpt-image-2.5-flare",    quality: "medium" },
  sunburst_low:    { model: "gpt-image-2.5-sunburst", quality: "low" },
  sunburst_medium: { model: "gpt-image-2.5-sunburst", quality: "medium" },
} as const;
```

- O RPC deriva modelo/qualidade do preset; a tuple é validada pela CHECK.
- `image-2-low` não existe no conjunto.
- O admin oferece 2 orquestradores e 4 presets = 8 combinações.
- `MODEL_ALLOWLIST` ganha `responses` para `gpt-6-luna`, de forma aditiva.
- Catálogo ganha apenas
  `('visual_signature_image','image','openai','gpt-6-luna','responses')`.
- `campaign_image` e `visual_signature_validation` não recebem linha de Luna
  com Responses; teste negativo obrigatório.

### D4 — Ciclo de vida da configuração congelada

No início da operação, **antes de débito e de qualquer chamada paga**:

1. Executar o guard de ambiente local (D5).
2. Ler a configuração dedicada.
3. Classificar:
   - **ausência confirmada** → usar o caminho herdado (seleção genérica /
     default do registry), com payload legado;
   - **falha de leitura** → erro explícito `visual_signature_model_config_read_failed`;
   - **linha divergente** (preset/modelo/qualidade/reasoning inválidos) → erro
     explícito;
   - **linha de outro ambiente/identidade** → erro
     `visual_signature_config_outside_approved_environment`.
4. Validar e congelar:
   - orquestrador (`gpt-5.5`/`gpt-6-luna`, `responses`);
   - preset, modelo da tool, qualidade;
   - `reasoning_effort='low'`;
   - `config_version_id`;
   - `instance_identity`.
5. Criar **um** resolver/gateway para a operação. O resolver retorna o alvo
   congelado para `visual_signature_image` e delega todas as outras
   capacidades ao resolver padrão (preservando `visual_signature_validation`).
6. Reutilizar o mesmo gateway em todas as tentativas da operação, inclusive
   quando o retry cria outro `operation_run_id`.
7. Uma nova geração solicitada pelo usuário (ex.: após rejeição) é uma nova
   operação e relê a configuração vigente.

O `config_version_id`, o preset, o modelo da tool, a qualidade e o reasoning
devem ser persistidos nos metadados da assinatura e da telemetria, inclusive no
retry.

**Alternativa rejeitada:** ler a configuração dentro do `AiImageGenerator` a
cada tentativa. Isso permitiria que uma alteração administrativa entre
tentativas mudasse o modelo no meio da operação e invalidaria a comparação.

### D5 — Isolamento local efetivo em runtime

Identidade/allowlist sozinhas não bastam. A configuração experimental só pode
ser gravada e consumida quando **todas** as condições abaixo forem verdadeiras:

1. `VENDEO_VS_VALIDATION_ENABLED === "1"` (opt-in explícito).
2. `NODE_ENV !== "production"` e `VERCEL` ausente.
3. **Endpoint local comprovado, não apenas allowlist:** `NEXT_PUBLIC_SUPABASE_URL`
   e, quando presente, `SUPABASE_URL` devem ser o mesmo origin, com host
   **loopback** (`127.0.0.1`, `localhost` ou `[::1]`) e porta exata pertencente
   ao conjunto local aprovado. URL `*.supabase.co`, `*.vercel.app`, project ref
   remoto ou qualquer host não-loopback é recusado **mesmo que a identidade
   esteja na allowlist**.
4. `resolveCanonicalInstanceIdentity()` retorna exatamente o valor de
   `VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE`.
5. A linha de configuração tem `environment_scope='local_validation'` e
   `instance_identity` igual à identidade canônica atual.
6. A credencial de provider usada é a credencial dedicada de validação
   (`VENDEO_VS_VALIDATION_OPENAI_API_KEY`), não a credencial de produção
   (D6).

Guard server-only:

```ts
assertVisualSignatureValidationEnvironment(): {
  instanceIdentity: string;
  supabaseOrigin: string;
  apiKey: string;
}

assertLocalSupabaseEndpoint(url: string): {
  origin: string;
  host: "127.0.0.1" | "localhost" | "::1";
  port: string;
}
```

- `assertLocalSupabaseEndpoint` é obrigatório antes de `resolveCanonicalInstanceIdentity`; a allowlist é uma segunda condição, nunca a única.
- Chamado pela API admin antes de gravar, pelo serviço de configuração antes de
  consumir e pelo runtime antes do provider.
- Falha com erro tipado; nunca cai silenciosamente na credencial de produção.
- Se o opt-in estiver **desligado/ausente**, a configuração dedicada **não é
  consumida**; o caminho legado permanece. A API admin recusa gravação.
- Se o opt-in estiver **ligado** e qualquer outra condição falhar, a operação
  falha fechada antes de qualquer escrita, débito ou provider.

**Separação banco/Storage × credencial paga:**

- Banco/Storage: `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` + service role;
  destino local comprovado por loopback + preflight. A credencial dedicada da
  OpenAI **não** protege o destino das escritas; ela protege apenas o gasto no
  provider.
- Provider: chave dedicada de validação via D6; a chave de produção não é
  usada no caminho de imagem/validação da VS.
- Nenhuma chave é logada, persistida ou incluída em metadados.

**Prova de instância isolada no preflight (obrigatória):**

- `supabase/config.toml` com `project_id` do ambiente local aprovado;
- containers locais esperados, saudáveis e sem o container/projeto de produção;
- API e DB em portas loopback exatas e iguais às da allowlist;
- `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_URL` consistentes com o mesmo origin;
- leitura do banco provando `current_database()`/ledger esperados;
- ausência de project ref remoto, `VERCEL` e URL de produção;
- evidência sanitizada registrada antes de qualquer migration ou débito.

**Alternativa rejeitada:** confiar apenas em comentário “LOCAL-ONLY”,
`.env.local` ou allowlist. Um processo local apontando para Supabase remoto
satisfaria a allowlist se ela repetisse o endereço; por isso o host loopback e o
preflight de instância são obrigatórios. **Alternativa rejeitada:** bloquear
somente por `NODE_ENV`; builds locais de produção e ambientes hospedados podem
enganar essa checagem.

### D6 — Credencial de provider dedicada à validação

O adapter `responses` passa a aceitar, por construtor, um resolvedor de chave
injetável:

```ts
new ResponsesAdapter(resolveApiKey = getApiKey)
```

- O default continua `getApiKey` (comportamento atual intacto).
- O gateway de validação da VS usa um registry próprio com
  `new ResponsesAdapter(readValidationApiKey)`.
- `readValidationApiKey()` lê **somente**
  `VENDEO_VS_VALIDATION_OPENAI_API_KEY`; se ausente/vazia, falha
  `visual_signature_validation_provider_key_missing`. Não faz fallback para
  `OPENAI_API_KEY`.
- A validação semântica (`visual_signature_validation`) usa o mesmo gateway da
  operação e, portanto, a mesma credencial de validação.
- O registry do gateway de validação expõe apenas o protocolo `responses`;
  qualquer outra capacidade/protocolo falha fechado. No fluxo da VS, apenas
  `visual_signature_image` e `visual_signature_validation` são invocadas, ambas
  `responses`.
- O perfil de marca continua no gateway padrão e na credencial normal; não é
  chamado pelo caminho de geração da VS. A aprovação de uma assinatura pode
  gastar nessa **segunda credencial** (normal), além da credencial dedicada da
  imagem/validação.
- O UAT SHALL registrar, por chamada, `credential_scope='validation'` ou
  `'normal'`, sem expor a chave. Não se afirma que todo o UAT usa
  exclusivamente a credencial dedicada.
- Testes provam que o adapter default continua usando `getApiKey` e que o
  adapter de validação nunca usa a chave de produção.

**Alternativa rejeitada:** usar `OPENAI_API_KEY` e confiar em `.env.local`.
Não separa credencial e permite que um processo local com a chave de produção
gaste na validação.

### D7 — Wire, reasoning e payload legado

Adicionar ao contrato de invocação, de forma aditiva:

```ts
imageGenerationModel?: string;
reasoningEffort?: "low"; // VS usa exclusivamente "low" nesta fase
metadata?: Record<string, unknown>;
```

No adapter `responses`:

```ts
params.tools = [{
  type: "image_generation",
  ...(request.imageGenerationModel ? { model: request.imageGenerationModel } : {}),
  size: request.size,
  quality: request.quality,
}];

if (request.reasoningEffort) {
  params.reasoning = { effort: request.reasoningEffort };
}
```

- **Reasoning:** contrato comum escolhido = `low`, fixo na configuração e
  enviado como `params.reasoning.effort`. Nenhum outro valor é aceito pela VS
  nesta fase. Se a verificação oficial do `gpt-5.5` falhar para `low`, a
  implementação para e a change é revisada; o executor não escolhe outro valor.
- **Sem configuração dedicada:** nenhum `imageGenerationModel`, nenhum
  `reasoning`, `quality: "auto"`, payload legado byte-compatível.
- **Tool:** `tool_choice` forçado permanece; uma única chamada Responses.
- **Metadata:** o request leva `config_version_id`, preset, modelo/qualidade e
  reasoning; o gateway propaga ao envelope.
- **UsageMeta:** `responsesModel` e `imageGenerationModel` separados; o adapter
  SHALL preservar o usage principal e, quando o provider expuser usage próprio
  da tool, também `imageToolUsage` + `imageToolUsageSource`
  (`response_usage`/`tool_output`/`absent`). Se a separação não existir, o campo
  fica ausente — nunca é inventado.
- **Fio completo:** o sink SHALL encaminhar ao estimador o usage principal, o
  `imageToolUsage` (quando presente), `imageGenerationModel`,
  `imageQuality`, preset e `config_version_id`; o estimador usa as tarifas do
  orquestrador e da imagem/tool. Sem esse fio, `costCoverage=complete` não é
  emitido.

### D8 — Usage e custo sem dupla contagem

#### Contrato de usage e notação

Preservar o `usage` bruto sanitizado para auditoria. Normalizar, no mínimo:
`input_tokens` (`I`), `output_tokens` (`O`), `cached_input_tokens` (`C`),
`input_tokens_details` de texto/imagem (`IT`/`II`),
`output_tokens_details` de texto/imagem (`OT`/`OI`), `reasoning_tokens` (`R`),
cache atribuível a texto/imagem (`Ct`/`Ci`, quando o provider detalhar) e usage
da tool, quando presente.

Regras invioláveis:

- `C` é subconjunto de `I`; nunca somar `C` a `I`.
- `R` é subconjunto de `O`; nunca somar `R` a `O`.
- Um breakdown só pode ser usado quando sua soma for compatível com o total
  correspondente. Caso contrário, a cobertura é parcial/desconhecida.
- Nenhum componente é precificado duas vezes. Se um token já está em `I`/`O`,
  ele não entra novamente como componente de imagem/tool.

#### Fórmula por formato confirmado

| Formato confirmado | Componente do orquestrador | Componente de imagem/tool | Cobertura |
|---|---|---|---|
| A. Breakdown completo de texto/imagem e cache atribuível | `(IT - Ct) × input_text_rate + Ct × cached_text_rate + (II - Ci) × input_image_rate + Ci × cached_image_rate + OT × output_text_rate + OI × output_image_rate` | `OI` já está no output; a tool só entra se houver usage separado; nunca somar o unitário histórico | `complete` se todas as tarifas e a atribuição `Ct`/`Ci` existirem; senão `partial` |
| B. Totais + reasoning, sem breakdown de imagem | `(I - C) × input_rate + C × cached_rate + O × output_rate` | Não adicionar unitário histórico nem componente de imagem; se a imagem estiver comprovadamente fora dos totais, adicionar uma única fonte | `complete` só se a documentação/provider provar que a imagem está incluída ou se houver custo reportado; caso contrário `partial`/`unknown` |
| C. Totais com usage da tool explicitamente separado | Mesma fórmula de B, usando totais do orquestrador **excluindo** o usage da tool | Usage da tool precificado uma vez na tarifa do modelo/qualidade | `complete` se a exclusão e as tarifas forem comprovadas; senão `partial` |
| D. Custo reportado pelo provider | Não somar componentes ao reportado | Não somar componentes ao reportado | `provider_reported`; estimativa permanece separada |
| E. Campos ausentes/ambíguos | Apenas componentes confirmados | Nenhuma fonte inventada | `partial`/`unknown` com motivo |

Regras adicionais:

- **Cache:** `C` reduz a parcela não cacheada de `I`; nunca é adicionado. Se o
  provider detalhar `Ct`/`Ci`, cada parcela usa sua tarifa de cache; se apenas
  `C` total existir e a atribuição entre texto/imagem não for comprovável, a
  cobertura é parcial.
- **Reasoning:** é precificado dentro de `O`, uma vez, na tarifa aplicável ao
  output. Só é precificado separadamente se o provider declarar explicitamente
  que `R` está **fora** de `O` e o breakdown provar ausência de sobreposição;
  nesse caso, `R` entra uma única vez na tarifa documentada.
- **Imagem:** se `II`/`OI` existirem, eles são excluídos dos componentes de
  texto e precificados uma vez na tarifa de imagem. Se apenas os totais
  existirem, não se adiciona o unitário histórico por cima.
- **Sem usage suficiente:** a referência histórica quality-aware pode ser
  registrada uma única vez em `costEstimationNote` com
  `visual_signature_image_estimate_no_usage`, mas **não** vira
  `estimatedCostUsd`: o evento fica com `estimatedCostUsd=null`,
  `costSource='not_available'` e `costCoverage='partial'`. Nunca combinar a
  referência com componentes derivados de tokens nem apresentá-la como custo
  real.
- **Ambiguidade insolúvel:** `costSource='not_available'`, com motivo
  explícito; não inventar total.

Valores `0.036` (low) e `0.044` (medium) são **estimativas históricas locais**
do caminho `images`, não tarifa oficial, custo real, teto financeiro ou
estimativa validada para o caminho Responses. Só podem aparecer como fallback
rotulado no caso de ausência de usage.

**Proibido neste caminho:** `fallback_static` genérico e o valor provisório
`responses:image_generation = 0.065` quando há preset explícito.

#### Política runtime × preflight

- **Runtime:** telemetria é best-effort; falha de estimativa não bloqueia a
  geração. O evento registra `costCoverage` (`complete`/`partial`/`unknown`),
  `costSource`, `costEstimationNote` e `providerReportedCostUsd` separado.
- **Preflight:** identidade/ambiente/credencial são **obrigatórios**; pricing é
  **advisory** e mostra cobertura/estimativa. O UAT registra custo desconhecido
  como limitação, não como falha de geração.
- Se a política financeira do projeto exigir confirmação prévia de custo, ela é
  um gate manual do UAT; não se transforma em fail-closed de runtime.

**Alternativa rejeitada:** bloquear a geração por pricing ausente. Isso
misturaria disponibilidade da estimativa com autorização de execução e
impediria a própria coleta de usage que permitiria calibrar o custo.

### D9 — Parsing e fallback da intenção criativa

O parser atual substitui silenciosamente o JSON por fallback quando não há
`visual_direction`/`content_used`. A change separa **parsing** de **aplicação
de fallback**:

Metadados persistidos na assinatura e na telemetria:

```ts
creative_intent_parse_status:
  | "parsed_json"
  | "no_json"
  | "invalid_json"
  | "incomplete_json"
  | "not_attempted";

creative_intent_fallback_applied: boolean;

creative_intent_fallback_reason:
  | "missing_json"
  | "invalid_json"
  | "missing_visual_direction"
  | "missing_content_used"
  | "invalid_content_used"
  | "exception"
  | null;

creative_intent_source: "model" | "fallback";

creative_intent_schema_version: "vs-intent-v1";

intended_palette_status: "present_normalized" | "absent" | "invalid";
content_used_present: boolean;
```

- `intended_palette` é o nome correto (não `intent_palette`).
- Validação runtime: `content_used` deve ser objeto simples (array/valor não
  objeto → `invalid_content_used`); indicadores fornecidos devem ser booleanos
  (`store_name`/`city`/`state`/`slogan` com outro tipo → `invalid_content_used`);
  `visual_direction` é trimada e vazia/whitespace → `missing_visual_direction`.
- Fallback aplicado continua sendo o comportamento atual, mas seus valores
  (`visual_direction: "Personalizada"`, `content_used.store_name: true`, etc.)
  **não** podem ser apresentados como direção efetivamente retornada pelo
  modelo.
- A UI de UAT mostra `creative_intent_source` e o motivo do fallback.
- `content_used` é conferido contra a imagem no UAT; divergência gera a
  observação `content_used_mismatch`, sem alterar automaticamente
  aprovação/drift.
- Aprovação, perfil de marca e drift continuam consumindo o mesmo contrato;
  regressão obrigatória.

#### Enriquecimento antes do flush (um único evento por chamada)

O gateway emite o envelope no momento da chamada, antes de o Diretor de Arte
fazer o parsing. Para não criar um segundo evento, as operações da VS usam um
`DeferredAiTelemetrySink` (extensão do sink de buffering):

1. O gateway emite **um** envelope por tentativa real no buffer.
2. O Diretor de Arte/gerador faz o parsing após a resposta.
3. Antes do flush, o caller chama
   `deferredSink.enrichLast("visual_signature_image", parsingMetadata)`.
4. O sink mescla os campos `creative_intent_*` no envelope bufferizado
   correspondente.
5. O flush persiste **uma única vez**, com os campos de parsing já presentes.

Regras:

- `generateVariations` é sequencial por tom; cada imagem tem seu próprio
  envelope e enriquecimento antes do flush correspondente.
- `generateAutomatic` e `generate-without-logo` usam o mesmo mecanismo.
- Se o parsing não for executado (falha antes da resposta), o envelope é
  flushed com `creative_intent_parse_status='not_attempted'`.
- Não há segundo evento, update de evento persistido ou evento sintético de
  parsing.
- O sink default continua intacto para os demais fluxos.

### D10 — Admin: ordem, seleção herdada e reset

Ordem da página:

1. `Imagem de campanhas — Produto 1:1` (componente existente).
2. `Assinatura Visual — direção e preset de imagem` (novo).
3. `Capacidades compartilhadas — texto/visão em uso`.
4. `Geração de campanhas — legado`.

Card de VS:

- 2 seletores: orquestrador e preset.
- Preview do mapeamento preset → modelo/qualidade.
- Configuração vigente com versão, autor, data, motivo, reasoning fixo.
- Painel **somente leitura** da seleção herdada de `visual_signature_image`
  (provider/modelo/protocolo/origem/status), sempre acessível.
- Botão `Voltar à seleção herdada` (DELETE auditado) para retornar à
  configuração anterior.
- Aviso de pricing/cobertura e de custo desconhecido.
- Motivo obrigatório, `operationId` idempotente e salvamento independente.

O formulário genérico deixa de **editar** `visual_signature_image`, mas a
capacidade permanece em `LEGACY_SELECTION_CAPABILITIES`, na resolução herdada e
no painel de diagnóstico. Texto/visão continuam editáveis e em uso;
`campaign_image`/`campaign_image_edit` ficam na seção de legado. Nenhuma
capacidade é rotulada globalmente como obsoleta.

Produto 1:1 permanece com tabela, RPC, endpoint, view, formulário e card
independentes. Nenhum “salvar tudo”.

### D11 — UAT: quantidade, custo e cobertura

Entry point único para a comparação: `POST
/api/store/[id]/visual-signature/generate-without-logo` em modo `standard`,
uma imagem por tentativa, mesmos dados, prompt, reasoning e tamanho. A
aprovação aciona o fluxo de perfil de marca existente.

**Unidade de autorização por geração:** até **2 tentativas de aplicação**
(tentativa inicial + retry automático). Cada tentativa pode produzir **1 imagem
+ 1 validação semântica**. O retry pode ocorrer após falha não-timeout,
inclusive rejeição semântica; o retry atual usa prompt simplificado.

**Retries internos do SDK:**

- O adapter de validação local SHALL configurar `maxRetries: 0`, para que o
  limite efetivo seja o das tentativas de aplicação.
- O adapter default/produção permanece inalterado; sua configuração de retry
  SHALL ser conferida e registrada, mas não é usada no caminho de validação.
- Limite efetivo declarado: **≤2 chamadas de imagem e ≤2 validações por
  geração**, sem retry oculto do SDK.
- Se `maxRetries: 0` não puder ser garantido, o orçamento SHALL ser multiplicado
  por `1 + retries_default_do_SDK` e o UAT SHALL parar se o limite for excedido.

**Rodada inicial obrigatória (2 gerações):**

| Item | Gerações | Tentativas autorizadas | Imagem autorizada | Validação autorizada |
|---|---:|---:|---:|---:|
| GPT-5.5 + Sunburst Medium | 1 | até 2 | até 2 | até 2 |
| Luna + Sunburst Medium | 1 | até 2 | até 2 | até 2 |
| **Total inicial** | **2** | **até 4** | **até 4** | **até 4** |
| Aprovação/perfil de marca | 1 fluxo | — | — | fluxo existente |

Custo histórico de referência: até 4 × US$ 0,044 = **US$ 0,176** de imagem;
validações e perfil de marca registrados separadamente; envelope ~US$ 0,20.
Não é tarifa oficial, custo real, teto financeiro ou garantia.

**Combinações adicionais disponíveis (não obrigatórias):**

| Combinações | Gerações | Tentativas/imagem autorizadas | Imagem histórica |
|---|---:|---:|---:|
| Sunburst Low ×2 | 2 | até 4 | até US$ 0,144 |
| Flare Medium ×2 | 2 | até 4 | até US$ 0,176 |
| Flare Low ×2 | 2 | até 4 | até US$ 0,144 |
| **Total adicional** | **6** | **até 12** | **até US$ 0,464** |

Se todas as 6 forem executadas, o total histórico de imagem chega a até
**US$ 0,64** (16 tentativas de imagem); com validações/perfil, o envelope fica
~US$ 0,70. Os valores históricos **não constituem teto financeiro**; o provider
reportado é autoritativo. Nenhuma execução adicional é automática ou
obrigatória. Uma amostra por combinação não demonstra superioridade estatística.

**Credenciais no UAT:**

| Etapa | Credencial | Registro |
|---|---|---|
| Imagem + validação da VS | dedicada de validação | `credential_scope='validation'` |
| Aprovação/perfil de marca | normal (`OPENAI_API_KEY`/gateway padrão) | `credential_scope='normal'` |

A aprovação pode gastar na segunda credencial. O UAT SHALL NOT afirmar que todo
o consumo usou exclusivamente a chave dedicada.

**Resultados com retry:**

- Registrar `attempt_number`, `retry_used`, `retry_prompt_variant`
  (`full`/`simplified`) e `retry_reason`.
- Um resultado obtido no retry usa prompt simplificado e **não é equivalente**
  ao resultado do prompt inicial; ele SHALL ser identificado e reportado
  separadamente, não usado como comparação direta entre modelos.
- O teste fake continua provando o congelamento no retry, com zero chamada
  paga.

**Opcional:** uma geração com `rejectionContext` para cobrir rejeição/nova
geração, com até 2 tentativas de aplicação (até 2 imagens + 2 validações),
somente se o usuário quiser.

**Separação de decisões:** aprovação técnica do fluxo, avaliação visual por
combinação e autorização futura de produção são decisões distintas.
Combinações não avaliadas permanecem não avaliadas; encerramento local com
cobertura parcial é permitido e registrado.

### D12 — Migration, preflight e prova real

- Migration autorada como **local-only**; nenhum `db push` remoto.
- Preflight read-only obrigatório:
  - `supabase/config.toml` com `project_id` do ambiente local aprovado;
  - containers locais esperados, saudáveis e sem container/projeto de produção;
  - API e DB em portas loopback exatas, iguais à allowlist;
  - `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_URL` no mesmo origin local;
  - leitura do banco provando `current_database()`/ledger esperados;
  - ausência de `VERCEL`, project ref remoto ou URL de produção;
  - identidade canônica, credencial dedicada, catálogo, pricing, flags e
    migrations pendentes.
- **Negativa obrigatória:** processo local + URL Supabase de produção +
  identidade coincidente na allowlist SHALL ser recusado antes de qualquer
  escrita ou débito. A allowlist não substitui a checagem de loopback.
- Se houver mais de uma migration pendente além da autorizada, **parar** e
  revisar o lote; não presumir ledger +1.
- Nenhum reset de banco existente.
- Aplicar somente no destino local aprovado, após autorização explícita.
- Prova real em Postgres local isolado: tabela/constraints, set/reset,
  idempotência, conflito, auditoria, RLS/grants, tuple inválida, orquestrador
  fora do catálogo, identidade/endpoint fora da allowlist e concorrência.
- Recuperação compatível com a política forward-only: desabilitar a
  configuração dedicada (voltar à herdada), remover a linha com auditoria ou
  aplicar migration corretiva. Bloco REVERT não é critério automático de
  qualidade.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| Consumo acidental da configuração experimental fora do local | opt-in + NODE_ENV/Vercel + **host loopback obrigatório** + identidade/allowlist + identidade da linha + credencial dedicada; preflight de instância isolada; teste negativo com URL de produção na allowlist |
| Processo local apontando para Supabase remoto | `assertLocalSupabaseEndpoint` recusa host não-loopback antes de escrita/débito; allowlist é segunda condição, nunca a única |
| Custo com dupla contagem de reasoning/imagem | `C`/`R` são subconjuntos; fórmulas por formato; nenhum componente somado duas vezes; cobertura parcial/desconhecida; testes de cache, reasoning e tool |
| Retry pago inesperado no UAT | orçamento autoriza até 2 tentativas por geração; `maxRetries: 0` no adapter de validação; resultados com retry identificados e não equiparados ao prompt inicial |
| Usage/tool usage não documentado ou ausente | registrar bruto; estimativa parcial/desconhecida explícita; sem 0.065/fallback_static; UAT registra limitação |
| Configuração mudar no meio da operação | congelar antes do débito/provider; um gateway por operação; teste com alteração administrativa entre tentativas |
| JSON de intenção inválido ou fallback enganoso | separar parse/fallback/source; UAT mostra proveniência; `intended_palette` correto |
| `content_used` inconsistente com a imagem | observação `content_used_mismatch`; não alterar aprovação/drift automaticamente |
| Dois controles para `visual_signature_image` | card dedicado + painel herdado somente leitura + reset auditado; sem edição concorrente |
| Migration com pendências adicionais | parar e revisar o lote; não presumir ledger +1; sem reset |
| Reasoning `low` não aceito por 5.5 | verificação oficial antes de implementar; se falhar, parar e revisar a change, sem escolha pelo executor |
| Credencial de validação ausente | falha fechada antes do provider; nunca fallback para chave de produção |
| Custo/latência do UAT | 2 gerações iniciais, 6 opcionais, orçamento explícito, zero execução automática |
| Perfil de marca gastar na credencial normal | registrar `credential_scope` por chamada; incluir o custo do perfil no UAT; não afirmar uso exclusivo da chave dedicada |

## Migration Plan

1. Revisão e aprovação desta change.
2. Gerar planos GSD da F47.1 e revisar.
3. Implementar em ambiente local, sem chamada paga.
4. Preflight read-only e autorização explícita.
5. Aplicar migration local-only e provar em Postgres real.
6. Rodar gates e testes.
7. UAT inicial com 2 gerações; parar para revisão.
8. UAT adicional somente por escolha do usuário; encerrar com cobertura
   registrada.
9. Não promover para produção nesta change.

## Open Questions

Nenhuma decisão arquitetural permanece aberta ao executor. As únicas
pendências são **verificações factuais/gates**, já com comportamento definido:

1. Confirmar no contrato oficial do `gpt-5.5` que `reasoning.effort="low"` é
   aceito. Se não for, a implementação **para** e a change é revisada; não há
   escolha discricionária.
2. Confirmar o formato exato do usage da Responses/tool no SDK. O design já
   define a regra para usage completo, parcial, ambíguo e ausente.
3. Confirmar acesso da conta aos modelos. Sem acesso, o UAT não começa; nenhuma
   chamada paga é feita nesta etapa.
4. Confirmar a identidade/porta local e a credencial dedicada no ambiente. Sem
   elas, o guard falha fechado.
