## Why

A F60 controla a operação 9:16 em duas etapas, a F60.1 persiste/recupera artefatos com proveniência e a quick 261111-idz prepara deterministicamente `square_original` 1024×1024 → `square_prepared` 1152×1152. Falta exatamente a etapa paga que transforma o quadrado preparado em vertical. Sem um módulo independente, cada orquestrador futuro tenderia a reimplementar prompt, chamada ao provider, validação de retorno, reutilização, exportação e registro de custo — repetindo risco de gasto duplicado e de arte fora do contrato.

Esta é uma nova fatia da iniciativa 60; a F60, a F60.1 e a quick de preparação permanecem encerradas e não são redesenhadas.

## What Changes

- Cria um **módulo server-only de expansão por IA para 9:16**, sem orquestrador, rota, UI, admin ou flag.
- Recebe **identidade/autorização de um `square_prepared` 1152×1152** e recupera a fonte exclusivamente pela F60.1.
- Resolve **Sunburst low** pelo catálogo/adapter existente (`ai_model_catalog` + par modelo/qualidade elegível), sem adivinhar nomes, sem seletor administrativo e sem fallback de modelo.
- Executa **exatamente uma chamada paga por invocação** (`images.edit`, `1152x2048`, qualidade `low`), com transporte sem retry oculto e sem repetição automática.
- Antes de qualquer chamada, **reutiliza ou bloqueia** com base no artefato vertical existente. A linha é consultada **explicitamente pela identidade**, separada da consulta ao objeto: só **linha ausente + objeto comprovadamente ausente** permitem chamada paga; linha existente com objeto desaparecido bloqueia sem chamada.
- Valida o retorno **por conteúdo** (imagem decodificável, exatamente 1152×2048, proporção 9:16) e exporta **JPEG 1080×1920** por redimensionamento proporcional, sem crop, reaproveitando o pipeline vertical existente.
- Protege o **registro da chamada em todos os desfechos** após a chamada (decode, exportação, persistência, readback e exceção inesperada), com um único flush best-effort; falha de telemetria nunca provoca outra geração paga.
- Persiste o resultado como **`vertical`**, `origin: "ai_expansion"`, com proveniência revalidada pela F60.1; original e `square_prepared` permanecem intactos.
- Registra **uma chamada por chamada real** com `operationId`/`callId`, etapa `expansion`, provider, modelo/qualidade efetivos, tamanho solicitado/recebido, duração, resultado, usage e custo calculado/reportado com origem; custo desconhecido é `null`, nunca zero.
- Retorna **artefato persistido ou falha tipada**, sem reservar, cobrar, confirmar ou estornar créditos, sem alterar `campaigns.status`/`storage_path` e sem liberar entrega/download.
- Mantém **intocados** o fluxo 1:1 atual, o 9:16 direto da F59, os controles da F60, a F60.1, o laboratório, a preparação 1024→1152 e a UI.
- **Não** propõe migration nesta fatia: a tabela/bucket da F60.1, `generation_events` e o catálogo/pricing existentes cobrem o contrato.

## Capabilities

### New Capabilities

- `campaign-vertical-ai-expansion`: expansão única de um `square_prepared` em vertical 9:16, com resolução de modelo pelo catálogo, reutilização segura com evidência durável, validação por conteúdo, exportação 1080×1920, persistência `ai_expansion` via F60.1, falhas tipadas e telemetria/custo por chamada correlacionáveis.

### Modified Capabilities

<!-- Nenhuma capability existente muda de requisito. O módulo é aditivo e reutiliza F60/F60.1 sem alterar seus contratos. -->

## Impact

- **Código novo**: biblioteca em `src/lib/campaign/vertical-expansion/**`, separando contratos puros (política, prompt, compatibilidade, classificação de falha) de implementação server-only (modelo, transporte, validação/exportação, orquestração).
- **Compartilhado (somente testes)**: extração do fake de DB/Storage e dos helpers JPEG determinísticos da quick 261111-idz para suporte comum, mantendo um re-export no caminho antigo para não alterar os testes existentes.
- **Reutilização**: F60.1 (`retrieveCompositionArtifact`, `persistCompositionArtifact`, `CompositionArtifactStorage`, evidência/checksum), F60 (`classifyProviderFailure`, tipos de falha), `resizeVerticalToJpeg1080x1920`, `UpstreamImagesAdapter` com loader `maxRetries: 0`, `VerticalImagesAdapter` para `returnedSize`, `AiGateway`/`DefaultAiTelemetrySink` e pricing por `modelo + qualidade`.
- **Intocado**: `campaigns`, crédito/duas etapas, `campaign-images`, `product_1_1_campaign_artifacts`, stores 1:1/vertical, `src/lib/lab/**`, prompt/rota da bancada, UI, flags e ativação.
- **Banco/Storage**: nenhuma migration, tabela, bucket, coluna ou policy nova. A prova real exige que a migration da F60.1 já esteja aplicada no ambiente autorizado; se não estiver, a execução para — não se reaplica migration existente nesta fatia.
- **Fora de escopo**: UI, seletor de formato/modelo, admin, downloads, orquestrador completo, ativação/substituição do 9:16 direto, cobrança/estorno, entrega de dois formatos, geração/copy 1:1, preparação 1024→1152, 4:5, 1080 como fonte, fallback de modelo, TTL/limpeza/backfill, produção/merge/push/deploy e chamadas pagas nesta rodada.
- **Testes**: offline primeiro com provider/DB/Storage simulados, Sharp/decoder reais e o módulo real; prova real pequena somente em etapa separadamente autorizada, reutilizando o homolog existente e com uma única campanha controlada.
- **Design system**: não afetado; esta fatia não cria ou altera UI, tema, tipografia, ícones ou páginas.
