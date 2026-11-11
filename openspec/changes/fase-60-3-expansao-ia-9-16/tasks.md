> Os 10 grupos abaixo são checklist de implementação, não 10 planos GSD. No `/gsd-plan-phase 60.3`, agrupar em menos planos (ex.: contratos+modelo, provider+exportação, reutilização+persistência+telemetria, testes, prova real).
>
> **Estado em 2026-11-11:** todos os itens foram implementados e verificados.
> Evidências principais: `60.3-01-SUMMARY.md` a `60.3-04-SUMMARY.md`,
> `60.3-04-PROOF-REPORT.md`, `60.3-UAT.md` e `60.3-OPSX-VERIFY.md`.
> A prova paga foi uma única chamada autorizada, sem retry; o aceite visual
> humano foi confirmado pelo responsável. Produção, merge, push e deploy
> permanecem fora deste escopo.

## 1. Contratos puros, política e prompt

- [x] 1.1 Criar `src/lib/campaign/vertical-expansion/types.ts` com entrada, união de resultados, evidência de chamada e reutilização dos tipos F60/F60.1; rejeitar campos de path/url/bytes/modelo/qualidade/prompt/tamanho no contrato.
- [x] 1.2 Criar `policy.ts` derivando de `ROLE_POLICY` a fonte `square_prepared` 1152×1152, o destino `vertical` 1080×1920, o tamanho de provider 1152×2048, a origem `ai_expansion`, a qualidade `low` e a etapa `expansion`; sem literais duplicados desnecessários.
- [x] 1.3 Criar `prompt.ts` com versão estável `f60.3-expand-9-16-v1` e prompt que preserve textos, preço, logo, avisos obrigatórios e composição central, expandindo somente o canvas; documentar que é orientação, não garantia pixel a pixel.
- [x] 1.4 Adicionar testes de contrato puro para normalização/rejeição de entrada, política de papéis/dimensões e versão/conteúdo do prompt (sem rede, banco, Storage ou IA).

## 2. Resolução de modelo e pricing

- [x] 2.1 Criar `model.ts` puro com a tupla esperada de Sunburst low e validação contra `ELIGIBLE_IMAGE_MODELS`/`ELIGIBLE_IMAGE_QUALITIES`; não importar `BENCH_PRESETS`, seletor administrativo ou par principal/fallback do 1:1.
- [x] 2.2 Implementar a resolução server-only da linha ativa de `ai_model_catalog` na capacidade `campaign_product_image`, provider `openai`, protocolo `images`, retornando provider/modelo/protocolo efetivos da linha; falhar fechado em ausência/inatividade/protocolo incompatível.
- [x] 2.3 Implementar a resolução de pricing específico de `provider + model + quality` reutilizando `AiModelPricingService`; exigir linha de qualidade (não `code_default`), cobertura das tarifas necessárias ao cálculo por usage (entrada/saída textual, entrada/saída de imagem e cache textual/imagem) e `image_unit_usd`; `image_unit_usd` sozinho não comprova cobertura; não inventar valor.
- [x] 2.4 Cobrir offline: linha ativa resolve; ausente/inativa/qualidade inválida/pricing ausente/`code_default`/cobertura incompleta (mesmo com `image_unit`) bloqueiam com zero chamadas.

## 3. Transporte sem retry oculto

- [x] 3.1 Adicionar opções aditivas ao `UpstreamImagesAdapter`/loader padrão: `maxRetries` e preservação de `usage` quando a resposta não traz imagem; preservar o comportamento atual quando as opções não são informadas e não alterar o adapter produtivo de `images` nem o runtime do 1:1.
- [x] 3.2 Criar `transport.ts` reutilizando `UpstreamImagesAdapter` com `maxRetries: 0` e a preservação de usage, mais `VerticalImagesAdapter` para medir `returnedSize` real; expor loader injetável para testes.
- [x] 3.3 Testar que a configuração efetiva do transporte recebe `maxRetries: 0`, que há uma única referência/tamanho/qualidade, que resposta sem imagem preserva usage e que nenhuma segunda chamada é feita pelo adapter.
- [x] 3.4 Implementar o timeout efetivo como `min(timeoutMs do chamador, 180 s)` quando houver prazo menor; testar default de 180 s, prazo menor respeitado e prazo maior não alongando o menor.

## 4. Gate pré-chamada de reutilização

- [x] 4.1 Criar `reuse-compatibility.ts` puro para vertical↔`square_prepared`: papel, formato, origem `ai_expansion`, dimensões 1080×1920, MIME JPEG, `derivedFromArtifactId`, `sourceCampaignId` nulo, proveniência com conjunto exato de chaves e checksum da fonte; falhar fechado e nunca lançar.
- [x] 4.2 Criar `reuse-evidence.ts` read-only usando `buildObjectEvidence` + `CompositionArtifactStorage.readObjectInfo` + `verifyObjectEvidence`, sem reimplementar digest nem escrever no Storage.
- [x] 4.3 Criar `probe.ts` consultando a **linha explicitamente** por `getArtifactByIdentity` (não inferir ausência de linha pelo `retrieve`): linha encontrada → retrieve/validação/evidência; linha encontrada + `retrieve absent` → bloqueio `row_object_missing`; linha ausente → `info` do path → órfão íntegro+evidência → adoção via F60.1 → `reused`; órfão inválido/sem evidência ou leitura indeterminada → bloqueio; **somente** linha ausente + objeto ausente comprovado → `proceed`.
- [x] 4.4 Testar reutilização sem chamada, adoção de órfão sem chamada, bloqueio de linha incompatível, **linha existente + objeto desaparecido → zero chamadas**, linha ausente + objeto ausente → prossegue, bloqueio de objeto inválido/sem evidência, `info`/download indeterminado e original/preparado intactos.

## 5. Validação do retorno e exportação

- [x] 5.1 Criar `output.ts` que decodifica os bytes do provider por completo, exige 1152×2048 e proporção 9:16 por inteiros e mede `returnedSize` real; não copiar o tamanho solicitado.
- [x] 5.2 Reutilizar `resizeVerticalToJpeg1080x1920` e `verifyVerticalJpeg1080x1920` para exportar e verificar JPEG 1080×1920; não implementar crop/pad/extensão/upscale nem segundo resize; não persistir o bruto.
- [x] 5.3 Testar retorno válido, dimensão errada, proporção errada, truncado/não-imagem, verificação da saída e ausência de armazenamento do bruto.

## 6. Telemetria e custo por chamada

- [x] 6.1 Criar `telemetry.ts` com contexto e sink bufferizado: `operationRunId = operationId`, `traceId = callId` (UUID novo), `attemptNumber` do chamador, `internalCost.settlement = "usage_tokens"` com pricing de qualidade e metadata de etapa/operação/chamada/tentativa/tamanhos/prompt/fonte.
- [x] 6.2 Implementar flush único em caminho protegido, cobrindo sucesso e falha de decode/exportação/persistência/readback/exceção inesperada; decorar o envelope com `expansionOutcome` e preservar usage/duração/status reais; usar o caminho existente `provider_reported` quando o provider reportar custo e `pricing_table`/`not_available` caso contrário.
- [x] 6.3 Garantir que custo desconhecido seja `null` + `not_available`, que custo conhecido seja registrado em saída inválida com usage e que não exista segundo evento/duplicidade; falha do flush não altera o resultado nem dispara nova chamada.
- [x] 6.4 Testar com sink fake: um evento por chamada, campos obrigatórios, correlação base+expansão, custo desconhecido, custo conhecido em falha de saída e ausência de duplicação.
- [x] 6.5 Testar flush em cada desfecho posterior à chamada (decode, exportação, persistência, readback, exceção inesperada) e provar que falha do flush não gera segunda chamada paga.

## 7. Orquestração única do expansor

- [x] 7.1 Criar `expand.ts` server-only com a ordem: validar entrada → retrieve/validar fonte → resolver identidade de destino → gate pré-chamada (linha e objeto separados) → resolver modelo/pricing → uma chamada com timeout efetivo → classificar falha → validar/exportar → persistir F60.1 → readback → flush único em caminho protegido → resultado tipado.
- [x] 7.2 Mapear todos os desfechos da F60.1 (`absent`/`invalid`/`metadata_conflict`/`indeterminate`/`created`/`reused`/conflitos/falhas) e do provider para a união de resultado, incluindo `definitive_failure` para auth/quota/faturamento/capacidade da requisição/conteúdo/entrada e sem converter desconhecido em definitivo nem repetir chamada.
- [x] 7.3 Garantir que `campaigns`, crédito, entrega, download, URL assinada, `update`/`delete` e exclusão automática nunca sejam chamados; expor somente a entrada pública do módulo.
- [x] 7.4 Testar o fluxo completo offline: sucesso criado, reutilização antes/depois, corrida de persistência devolvendo `reused` com evidência da chamada, conflito, falha de persistência após chamada paga, readback falho e repetição posterior reutilizando sem nova chamada.

## 8. Suporte de testes compartilhado e suíte offline

- [x] 8.1 Extrair o fake de DB/Storage da quick 261111-idz para `src/lib/campaign/__tests__/support/fake-artifact-backend.ts`, estendendo apenas o necessário para catálogo/pricing (ex.: `is`/`order`/select aguardável) e mantendo re-export no caminho antigo para os testes existentes.
- [x] 8.2 Extrair os helpers JPEG determinísticos para suporte comum e adicionar fixture 1152×2048 com conteúdo central distinguível; manter re-export/constantes específicas do quadrado.
- [x] 8.3 Cobrir a matriz offline do design: entrada/autorização, fonte, modelo/pricing, reutilização/órfão, chamada única, sem retry oculto, falhas transitórias/definitivas/desconhecidas, saída inválida/truncada, exportação, persistência/proveniência/readback, concorrência pertinente e fronteiras proibidas.
- [x] 8.4 Rodar a suíte focada do módulo, a suíte afetada de F60/F60.1/preparação e os gates `typecheck`, `lint` e `git diff --check`; registrar resultados sem alterar testes existentes para mascarar falha.

## 9. Prova real pequena (somente após autorização separada)

- [x] 9.1 Executar preflight não pago: confirmar homolog, credenciais autorizadas, migration/bucket/tabela da F60.1 aplicados, linha ativa do catálogo, pricing de Sunburst low com cobertura completa das tarifas de usage e uma campanha controlada com `square_prepared` 1152×1152 contendo texto/preço/logo/aviso — obtido de um `square_original` 1024×1024 do novo fluxo 1:1 preparado pela quick 261111-idz (sem chamada paga) ou de um preparado já existente; o executor pode escolher a arte; arte legada 1080×1080 não serve como `square_original`; se faltar peça, parar.
- [x] 9.2 Obter autorização explícita de quantidade máxima de chamadas (proposta: 1) e orçamento, com teto derivado do pricing vigente (não fixar US$ 0,05); confirmar que o módulo usa a credencial de produto/homolog autorizada, não a chave exclusiva da bancada sem decisão.
- [x] 9.3 Executar exatamente uma expansão real server-side, sem retry automático; preservar log/manifesto com ambiente, campanha, fonte, `operationId`, `callId`, modelo/qualidade, tamanhos, duração, usage, custo/origem, artefato/checksum, resultado e decisão.
- [x] 9.4 Em caso de falha, parar e diagnosticar sem repetir chamada paga; em caso de sucesso, separar aceite técnico (dimensões/JPEG/checksum/proveniência/custo verificado) do aceite visual humano (textos/preço/logo/avisos/composição/emendas); custo `not_available`/`null` para a prova e exige reconciliação antes de nova chamada.
- [x] 9.5 Reutilizar o manifesto/log no fechamento; não exigir reexecução por documentação; não executar produção, merge, push ou deploy nesta fatia.

## 10. Verificação e fechamento da change

- [x] 10.1 Executar `openspec validate --strict` na change e corrigir inconsistências de spec/tasks/design.
- [x] 10.2 Registrar no resultado final o mapa de reaproveitamento, arquivos novos/compartilhados, ausência de migration, estratégia de idempotência/tentativa/custo, matriz de testes e decisões pendentes.
- [x] 10.3 Parar para revisão; não iniciar GSD, implementação, prova paga ou ativação automaticamente. Próximo comando após aprovação: `/gsd-plan-phase 60.3` (revisão dos planos em seguida), **não** `/opsx-apply` diretamente.
