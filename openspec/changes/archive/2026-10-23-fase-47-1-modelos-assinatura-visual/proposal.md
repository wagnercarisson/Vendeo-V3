## Why

A geração de Assinatura Visual (VS) usa hoje um único caminho Responses com a
tool `image_generation`, mas não permite comparar, de forma controlada e
auditável, o modelo de direção/orquestração (`gpt-5.5` × `gpt-6-luna`) nem o
preset de imagem (`gpt-image-2.5-flare` × `gpt-image-2.5-sunburst`, em
`low`/`medium`). Também não há configuração persistida e congelada por operação,
e o custo da tool usa um valor provisório que não representa os novos presets.
A F47 concluída permanece preservada; esta é uma fase sucessora e isolada
(**F47.1**), restrita a validação local.

## What Changes

- Criar uma configuração administrativa **dedicada à Assinatura Visual**, com
  dois seletores independentes:
  - direção/orquestração: `gpt-5.5` ou `gpt-6-luna`;
  - preset único de imagem: `Flare · Low`, `Flare · Medium`, `Sunburst · Low`,
    `Sunburst · Medium`.
- Mapear os presets, de forma fechada, para `gpt-image-2.5-flare` /
  `gpt-image-2.5-sunburst` + `low` / `medium`, permitindo as 8 combinações
  localmente.
- Enviar explicitamente `model` e `quality` na tool `image_generation`, mantendo
  uma única chamada Responses que retorna imagem + texto de intenção criativa.
- Congelar, no início da operação, orquestrador, preset, modelo da tool,
  qualidade, reasoning e versão da configuração; reutilizar o mesmo snapshot em
  todas as tentativas da operação. Nova geração solicitada pelo usuário lê a
  configuração vigente.
- Registrar separadamente modelo Responses, modelo da tool, qualidade, preset,
  reasoning e versão da configuração na telemetria e nos metadados.
- Corrigir a apuração de custo/usage: `reasoning_tokens` é detalhe de
  `output_tokens`, `cached_input_tokens` é detalhe de `input_tokens` e nenhum
  dos dois pode ser somado novamente; tokens de imagem são excluídos do
  componente de texto e precificados uma vez; a fórmula é definida por formato
  confirmado de usage; estimativa parcial e custo desconhecido devem ser
  explícitos; custo reportado fica em campo separado.
- Implementar isolamento local **efetivo** em runtime, além de identidade e
  allowlist: opt-in explícito, proibição em produção/Vercel, **endpoints
  Supabase de banco/Storage em host loopback e porta local exata** (URL remota é
  recusada mesmo se a allowlist coincidir), identidade canônica exata,
  identidade gravada na configuração e credencial de provider dedicada à
  validação local, sem reutilizar a credencial de produção. A aprovação/perfil
  de marca pode usar a credencial normal.
- Registrar separadamente o resultado do parsing do JSON de intenção criativa e
  a aplicação do fallback, sem apresentar valores de fallback como direção
  retornada pelo modelo; preservar `intended_palette` e `content_used` para
  aprovação, perfil de marca e drift.
- Reordenar a página administrativa de modelos: Produto 1:1 → Assinatura Visual
  → capacidades compartilhadas de texto/visão → geração de campanhas legada.
  Manter acesso diagnóstico à seleção herdada de `visual_signature_image` e um
  reset auditado para voltar a ela.
- Manter Produto 1:1 independente, com tabela, RPC, endpoint, formulário e
  salvamentos próprios.
- Explicitar a quantidade e o custo estimado das gerações de UAT: 2 gerações
  iniciais obrigatórias (GPT-5.5 × Luna, Sunburst · Medium), 6 combinações
  adicionais apenas disponíveis, sem execução automática. O orçamento autoriza
  **até 2 tentativas de aplicação por geração**, contabiliza retries e exige
  `maxRetries=0` no gateway de validação para não haver chamada paga oculta;
  resultados de retry são identificados e não equiparados ao prompt inicial.
  Os valores históricos não são teto financeiro.

## Capabilities

### New Capabilities

- `visual-signature-model-config`: configuração dedicada da Assinatura Visual,
  presets fechados, persistência/auditoria, congelamento por operação,
  isolamento local verificável, reset para a seleção herdada e contrato de
  validação local.

### Modified Capabilities

- `store-visual-signature`: a geração usa a configuração congelada da VS;
  metadados distinguem modelo Responses, modelo da tool, qualidade, preset,
  reasoning e versão; parsing e fallback da intenção criativa são registrados
  separadamente; aprovação, draft, histórico, drift e perfil de marca
  permanecem preservados.
- `ai-image-generation`: a tool `image_generation` recebe modelo e qualidade
  explícitos; o caminho legado sem configuração permanece byte-compatível; não
  há etapa separada de direção nem fallback `image-2-low`.
- `ai-invocation-gateway`: o contrato de request/result/telemetria passa a
  carregar `imageGenerationModel`, `reasoningEffort` restrito ao contrato
  escolhido e metadados de configuração, de forma aditiva.
- `ai-model-registry`: `gpt-6-luna` passa a aceitar `responses` para
  `visual_signature_image`, sem vazar para `campaign_image` nem para
  `visual_signature_validation`.
- `ai-model-catalog`: registrar
  `visual_signature_image/openai/gpt-6-luna/responses` como opção ativa,
  preservando as linhas existentes.
- `ai-model-pricing`: pricing quality-aware do preset e regra de não dupla
  contagem entre usage do orquestrador, reasoning e tool.
- `ai-cost-accounting`: apuração explícita de usage/custo do orquestrador e da
  tool, com estimativa parcial/desconhecida e custo reportado separados.
- `admin-ai-model-selection`: nova ordem da página, card de Assinatura Visual,
  painel de seleção herdada, reset auditado e manutenção das capacidades
  compartilhadas e do legado.

## Impact

- **Código/migration:** nova tabela/RPC/CHECKs de auditoria; migration
  local-only; adapter Responses; tipos do gateway; resolver congelado;
  `AiImageGenerator`; `StoreIdentityArtDirectorService`; `server-actions`;
  rota `generate-without-logo`; serviço/view/rota/formulário admin; testes de
  contrato, comportamento, admin e Postgres real.
- **Banco:** `visual_signature_model_config`, `admin_audit_log`,
  `ai_model_catalog`, `ai_model_pricing` (leitura; nenhuma migration de preço).
- **Configuração local:** identidade canônica/allowlist, opt-in de validação,
  credencial de provider dedicada, catálogo e pricing diagnosticados por
  preflight. Nada é aplicado ou alterado nesta etapa.
- **Fora de escopo:** Produto 1:1, `campaign_image`, `campaign_image_edit`,
  etapa separada de direção por Luna, fallback `image-2-low`, prompts,
  validação semântica, Storage, draft, aprovação/rejeição, histórico, drift,
  perfil de marca, produção, deploy, push e chamada paga nesta etapa.
- **Risco principal:** atribuição incorreta de custo/usage e consumo acidental
  da configuração experimental fora do ambiente local; ambos tratados por
  contrato explícito, testes e isolamento em runtime.
