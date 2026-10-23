# Tasks — F47.1 Configuração e validação local de modelos da Assinatura Visual

> **Estado:** execução local concluída em 2026-10-22; Tasks 1–6, 7.1–7.3,
> 7.6–7.7 e 8.1–8.4 reconciliadas com evidência. As Tasks 7.4 (6 combinações
> adicionais) e 7.5 (`rejectionContext` opcional) permanecem **não executadas**.
> Cobertura é parcial; custos totais não comprovados. Consolidação aguarda
> revisão final antes de verify/sync/archive. Nenhuma aprovação de produção,
> push ou deploy.

## 1. Contratos, configuração e migration local

- [x] 1.1 Criar o registry puro `visual-signature-model-config` com os 2 orquestradores, os 4 presets, o mapeamento fechado preset → modelo/qualidade e a validação de reasoning `low`; rejeitar `image-2-low`, preset inválido, orquestrador inválido e reasoning diferente de `low`.
- [x] 1.2 Adicionar `"responses"` à allowlist de `gpt-6-luna` em `src/lib/ai/model-registry.ts`, preservando `chat-completions`, e garantir por teste que a combinação não é aceita para `campaign_image` nem `visual_signature_validation`.
- [x] 1.3 Autorar a migration local-only `visual_signature_model_config` com tabela singleton, `environment_scope`, `instance_identity`, orquestrador, preset, modelo, qualidade, `reasoning_effort='low'`, `config_version_id`, motivo, autor e timestamps; incluir CHECKs de tuple, RLS service_role e grants mínimos.
- [x] 1.4 Criar as RPCs `admin_set_visual_signature_model_config` e `admin_reset_visual_signature_model_config` com validação de motivo/ator/operação/identidade, idempotência por `operation_id`, conflito de conteúdo, UPSERT/reset auditado e validação do orquestrador contra o catálogo `visual_signature_image/openai/responses/active`.
- [x] 1.5 Estender os CHECKs de `admin_audit_log` para `visual_signature_model_config_update`, `visual_signature_model_config_reset` e target type `visual_signature_model_config`, preservando todos os valores já aceitos.
- [x] 1.6 Inserir a tupla de catálogo `visual_signature_image/openai/gpt-6-luna/responses` com status ativo, nota de fonte e `validated_at` nulo, de forma idempotente e com falha explícita em divergência; não inserir pricing na migration.
- [x] 1.7 Criar o preflight read-only com estágios `pre-migration` e `post-migration`: comprova `project_id`, containers locais saudáveis e sem container/projeto de produção, API/DB em portas loopback exatas e validadas separadamente, `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL` no mesmo origin local, `current_database()`/ledger, identidade canônica, allowlist, credencial dedicada, catálogo, pricing, flags e migrations pendentes. `pre-migration` permite a ausência esperada de Luna e exige `gpt-5.5`; `post-migration` exige Luna ativo. URL remota ou project ref remoto é recusado mesmo que a identidade coincida com a allowlist; se houver mais de uma pendência além da autorizada, parar e revisar o lote.
- [x] 1.8 Aplicar a migration somente no destino local aprovado, após autorização explícita, sem reset e sem `db push`; provar em Postgres local isolado tabela, constraints, RLS/grants, set/reset, idempotência, conflito, auditoria, tuple inválida, orquestrador fora do catálogo, identidade/endpoint fora da allowlist e concorrência, preservando a configuração preexistente por transações revertidas ou instância/schema descartável.
- [x] 1.9 Confirmar no contrato oficial que `gpt-5.5` aceita `reasoning.effort="low"`; se não aceitar, parar a implementação e retornar à revisão da change, sem escolher outro valor no executor.

## 2. Isolamento local e credencial dedicada

- [x] 2.1 Criar `assertLocalSupabaseEndpoint()` e o guard server-only `assertVisualSignatureValidationEnvironment()` exigindo `VENDEO_VS_VALIDATION_ENABLED=1`, `NODE_ENV` diferente de produção, ausência de `VERCEL`, host loopback + porta local exata para `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`, identidade canônica exata em `VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE` e credencial dedicada disponível; retornar identidade, origin e resolvedor de chave congelados. A allowlist é segunda condição, nunca a única.
- [x] 2.2 Fazer a API admin, o serviço de configuração e o runtime chamarem o guard antes de gravar/consumir/provider; opt-in desligado ignora a configuração dedicada e preserva o legado; opt-in ligado com qualquer falha falha fechado antes de escrita, débito ou provider.
- [x] 2.3 Estender `ResponsesAdapter` para aceitar resolvedor de chave por construtor, mantendo `getApiKey` como default; criar o registry de validação com `VENDEO_VS_VALIDATION_OPENAI_API_KEY` e sem fallback para `OPENAI_API_KEY`.
- [x] 2.4 Comparar a `instance_identity` gravada na configuração com a identidade canônica/allowlist no runtime e recusar linha copiada para outro ambiente; nunca logar ou persistir chaves.
- [x] 2.5 Separar explicitamente destino de banco/Storage (URL Supabase + service role) da credencial de provider (chave dedicada de validação) no preflight e na documentação; registrar que a aprovação/perfil de marca usa a credencial normal e pode gastar nela.
- [x] 2.6 Configurar `maxRetries=0` no adapter de validação local e conferir/documentar o retry default do SDK no adapter normal; se não for possível garantir `0`, multiplicar o orçamento do UAT por `1 + retry_default` e declarar o limite efetivo.

## 3. Wire, congelamento e intenção criativa

- [x] 3.1 Adicionar ao contrato de invocação `imageGenerationModel`, `reasoningEffort: "low"` e `metadata`, de forma aditiva; propagar metadata ao envelope e `usageMeta` com modelo Responses e modelo da tool separados.
- [x] 3.2 No adapter `responses`, enviar `model` e `quality` na tool `image_generation`, forçar `tool_choice`, mapear `reasoningEffort` para `params.reasoning.effort` e preservar o payload legado quando os campos estiverem ausentes.
- [x] 3.3 Criar o resolver/gateway congelado da VS: alvo congelado para `visual_signature_image` e delegação das demais capacidades ao resolver padrão; ler a configuração uma vez, antes de débito/provider, e reutilizar o mesmo gateway em todas as tentativas da operação.
- [x] 3.4 Distinguir ausência confirmada (legado), falha de leitura (erro explícito), linha divergente (erro) e linha de outro ambiente (erro), sem interpretar falha como ausência.
- [x] 3.5 Integrar o gateway congelado em `AiImageGenerator`, `StoreIdentityArtDirectorService`, `generateVariations`, `generateAutomatic` e `generate-without-logo`, incluindo retry; nova geração solicitada pelo usuário relê a configuração vigente.
- [x] 3.6 Persistir nos metadados da assinatura e da telemetria `responses_model`, `image_model`, `image_quality`, `visual_signature_preset`, `reasoning_effort` e `config_version_id`, inclusive no retry com novo `operation_run_id`.
- [x] 3.7 Separar o parsing da intenção criativa da aplicação de fallback: registrar `creative_intent_parse_status`, `creative_intent_fallback_applied`, `creative_intent_fallback_reason`, `creative_intent_source`, `creative_intent_schema_version`, `intended_palette_status` e `content_used_present`; preservar `intended_palette` e `content_used`.
- [x] 3.8 Implementar um `DeferredAiTelemetrySink` por tentativa/lote, com `enrichLast` e flush idempotente por instância: o parsing enriquece o envelope de `visual_signature_image` antes do flush; `generateVariations` usa um sink novo por imagem/tentativa, sem reutilização entre imagens. Sem segundo evento/update; falha do handler não é declarada como ausência de perda.
- [x] 3.9 Garantir que valores de fallback não sejam apresentados como direção do modelo e que `content_used` permaneça compatível com aprovação, perfil de marca e drift; registrar `content_used_mismatch` apenas como observação de UAT.
- [x] 3.10 Registrar `attempt_number`, `retry_used`, `retry_prompt_variant` e `credential_scope` em cada tentativa/evento; resultados de retry com prompt simplificado são identificados e não equiparados ao prompt inicial.

## 4. Custos, usage e telemetria

- [x] 4.1 Normalizar o usage com `input_tokens` (`I`), `output_tokens` (`O`), `cached_input_tokens` (`C`), breakdowns de texto/imagem (`IT`/`II`, `OT`/`OI`) e `reasoning_tokens` (`R`); tratar `C` e `R` como subconjuntos de `I`/`O` e nunca somá-los novamente.
- [x] 4.2 Implementar as fórmulas por formato confirmado de usage e fechar o percurso adapter → gateway → sink → estimador: usage principal, `imageToolUsage`/fonte quando existir, modelo/qualidade/preset, tarifas dos dois modelos; excluir tokens de imagem dos componentes de texto e nunca combinar unitário histórico com tokens de imagem. Usage da tool ausente não é inventado; tarifa ausente gera `partial`/`unknown`.
- [x] 4.3 Proibir no caminho com preset explícito `fallback_static` genérico e `responses:image_generation = 0.065`; usar `not_available`/parcial com motivo quando não houver informação suficiente.
- [x] 4.4 Registrar `costCoverage` (`complete`/`partial`/`unknown`), `costSource`, `costEstimationNote`, `providerReportedCostUsd`, `attempt_number`, `retry_used`, `retry_prompt_variant` e `credential_scope` em campos separados; custo reportado não se sobrescreve com estimativa.
- [x] 4.5 Manter telemetria best-effort (não bloqueia geração) e preflight advisory para pricing, mas obrigatório para ambiente/identidade/credencial; documentar a distinção.
- [x] 4.6 Rotular `0.036`/`0.044` como estimativas históricas locais, não tarifa oficial, teto financeiro nem custo validado do caminho Responses.

## 5. Admin e compatibilidade

- [x] 5.1 Reordenar `/admin/ai-model-selection` para Produto 1:1 → Assinatura Visual → capacidades compartilhadas de texto/visão → geração de campanhas legada, preservando o padrão visual do card Produto 1:1 e o design system.
- [x] 5.2 Criar a seção/card da Assinatura Visual com os dois seletores, preview do mapeamento, configuração vigente, versão, autor, data, motivo, reasoning fixo, cobertura de pricing e aviso de custo desconhecido.
- [x] 5.3 Criar o painel somente leitura da seleção herdada de `visual_signature_image` (provider, modelo, protocolo, origem, status) e a ação auditada “Voltar à seleção herdada”.
- [x] 5.4 Criar a API administrativa `GET/PUT/DELETE` com `requireAdmin`, `requireSameOrigin`, Zod estrito, motivo/`operationId`, `p_reasoning_effort="low"` derivado no servidor (nunca aceito do cliente), chamada exclusiva às RPCs e invalidação de cache; não ecoar erros brutos.
- [x] 5.5 Remover a edição de `visual_signature_image` do formulário genérico, mantendo a capacidade em `LEGACY_SELECTION_CAPABILITIES`, na resolução herdada e no diagnóstico; manter texto/visão editáveis e `campaign_image`/`campaign_image_edit` na seção de legado.
- [x] 5.6 Garantir que Produto 1:1 permaneça com tabela, RPC, endpoint, view, formulário e salvamento independentes; nenhuma ação “salvar tudo”.
- [x] 5.7 Atualizar os testes de composição do admin para ordem, 8 combinações, nenhuma gravação no mount, motivo obrigatório, salvamentos independentes, painel herdado, reset, aviso de pricing e erros seguros.

## 6. Testes de comportamento e gates

- [x] 6.1 Testar o wire: modelo/qualidade exatos na tool, `reasoning.effort='low'`, `tool_choice` forçado, metadata e `usageMeta` separando os dois modelos; sem configuração, provar payload legado byte-compatível.
- [x] 6.2 Testar congelamento: config lida uma vez; alteração administrativa entre tentativas não muda o alvo; retry com novo `operation_run_id` mantém a versão; nova geração relê a vigente; ausência/falha/divergência/ambiente errado têm comportamentos distintos.
- [x] 6.3 Testar isolamento local: opt-in desligado preserva legado; produção/Vercel não consome; identidade/allowlist divergente falha; **processo local + URL Supabase de produção + identidade coincidente na allowlist é recusado antes de escrita/débito**; host não-loopback/porta errada é recusado; credencial dedicada ausente falha sem usar produção; linha copiada não é consumida.
- [x] 6.4 Testar custo/usage: reasoning não duplica output; cache não duplica input; breakdown de imagem é excluído do texto; totais sem imagem não recebem unitário; tool usage separado não duplica; reportado separado; parcial/desconhecido explícito; `0.065` e `fallback_static` ausentes no caminho com preset.
- [x] 6.5 Testar parsing/fallback da intenção: JSON válido, ausente, inválido e incompleto; `intended_palette`, `content_used`, proveniência e fallback; enriquecimento antes do flush com **um único evento**; regressão de aprovação, perfil de marca e drift.
- [x] 6.6 Testar persistência/auditoria em Postgres local isolado: set/reset, idempotência, conflito, constraints, RLS/grants, identidade/endpoint e concorrência; teste estático não substitui essa prova.
- [x] 6.7 Testar `maxRetries=0` no gateway de validação e a configuração default inalterada; provar que não há retry oculto do SDK no caminho local.
- [x] 6.8 Testar regressão dos três entry points da VS, validação semântica, Storage, draft, histórico, aprovação/rejeição, drift, perfil de marca, Produto 1:1 e campanhas legadas.
- [x] 6.9 Executar `npm run typecheck`, `npm run lint`, `npm run build`, as suítes afetadas, `openspec validate fase-47-1-modelos-assinatura-visual --strict` e `git diff --check`; registrar saídas. Nenhuma chamada paga.

## 7. UAT local e encerramento

> **Evidência:** `47.1-UAT.md`. A Task 7.2 foi executada, mas as duas primeiras
> tentativas de perfil falharam (`brand_profile_vision`, loopback); o perfil só
> concluiu após a correção `a37f4b83`/`d16b54f2` e o realinhamento manual da
> assinatura Luna. A Task 7.3 está detalhada por run no §2.1 do UAT; campos
> ausentes, incluindo `provider_reported_cost_usd`, estão registrados como NULL,
> sem inferência. As Tasks 7.4 e 7.5 permanecem não executadas.

- [x] 7.1 Preparar o roteiro de UAT com entry point único `generate-without-logo` em modo standard, mesma loja/dados/prompt/tamanho/reasoning, e registrar hashes/versões. Autorizar **até 2 tentativas de aplicação por geração** (até 2 imagens + 2 validações), com `maxRetries=0` no gateway de validação; se não for garantido, multiplicar o orçamento por `1 + retry_default_do_SDK` e declarar o limite.
- [x] 7.2 Executar a rodada inicial obrigatória: GPT-5.5 + Sunburst Medium e Luna + Sunburst Medium = 2 gerações, **até 4 tentativas de imagem e até 4 validações**; aprovar 1 assinatura para cobrir 1 fluxo de perfil de marca na credencial normal. Custo histórico de referência de imagem até ~US$ 0,176; sem garantia e sem teto financeiro.
- [x] 7.3 Registrar por run: configuração, modelos, qualidade, reasoning, versão, `attempt_number`, `retry_used`, `retry_prompt_variant`, `credential_scope`, `creative_intent_*`, `intended_palette`, `content_used`, qualidade visual, legibilidade, direção/metadados, latência, `costCoverage`, estimativa e custo reportado.
- [ ] 7.4 Disponibilizar as 6 combinações restantes para escolha do usuário (Sunburst Low ×2, Flare Medium ×2, Flare Low ×2), com até **12 tentativas de imagem e 12 validações** e imagem histórica de até ~US$ 0,464; sem execução automática ou obrigatória; cobertura parcial é permitida e registrada. Os valores históricos não são teto.
- [ ] 7.5 Se o usuário quiser cobrir rejeição/nova geração, executar 1 geração opcional com `rejectionContext`, com até 2 tentativas (2 imagens + 2 validações); retry interno continua provado por teste fake, sem chamada paga.
- [x] 7.6 Separar no registro: aprovação técnica do fluxo, avaliação visual por combinação e futura autorização de produção; nenhuma combinação é aprovada para produção nesta change.
- [x] 7.7 Consolidar evidências, limitações, custos e decisões em artefato de UAT da fase; não promover, não fazer push/deploy e não alterar produção.

## 8. Documentação e revisão

- [x] 8.1 Atualizar a documentação operacional local com preflight, aplicação da migration, guard de ambiente, credencial dedicada, reset para herdada e recuperação forward-only.
- [x] 8.2 Registrar no README da change a aprovação técnica, os limites (sem implementação/migration/chamada paga/push/deploy) e os pontos obrigatórios de verificação dos planos GSD; manter design/specs/tasks como base normativa autossuficiente, sem depender de documento preliminar externo.
- [x] 8.3 Preparar resumo de revisão para o Codex com artefatos, decisões, riscos, evidências e pendências factuais; parar antes de qualquer implementação.
- [x] 8.4 Manter a matriz `47.1-COVERAGE-MATRIX.md` reconciliada com requisitos/cenários, planos e testes/evidências durante a execução; nenhuma linha pode ser declarada coberta sem o teste/evidência correspondente.
