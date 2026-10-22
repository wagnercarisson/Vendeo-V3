---
status: fix_applied_pending_codex_review
trigger: "F47.1 — brand_profile_vision falhou duas vezes com provider_error ao analisar assinaturas locais da Calce Bem; hipótese de URL de Storage loopback inacessível ao provedor."
created: 2026-10-22T19:05:00Z
updated: 2026-10-22T19:10:00Z
---

# F47.1 — brand_profile_vision com imagem local

## Constraints (READ-ONLY / sem chamadas pagas)

- Nenhuma nova chamada a provider foi feita.
- Nenhum Docker/Supabase/app foi reiniciado.
- Nenhuma imagem foi gerada, nenhum perfil foi regenerado/aprovado e nenhum dado foi alterado.
- Nenhuma migration, tarifa, push, deploy ou alteração de produção.
- Chaves, tokens e URLs assinadas completas não são reproduzidos neste artefato.
- Correção de apresentação/preservação do perfil antigo ficou fora de escopo (pendência separada).

## Sintomas

- Duas chamadas `brand_profile_vision` para `gpt-6-luna` falharam em
  `2026-10-22 20:53:31Z` e `2026-10-22 20:56:38Z`, ambas com
  `status=failed`, `error_type=provider_error`.
- Nenhum perfil novo foi persistido; o perfil antigo da NovaTek permanece `synced`.
- As assinaturas da Calce Bem foram geradas corretamente.

## Evidência sanitizada

- `generation_events` confirma as duas falhas `brand_profile_vision`.
- Log do app registra:
  - `AiInvocationError: 400 Error while downloading file. Upstream status code: 407.`
  - `kind: 'provider_error'`.
- O `assetUrl` usado no fluxo era URL assinada de Storage em
  `http://127.0.0.1:57781/...` (loopback local; valor completo omitido).
- O Storage/Auth local não é acessível pela OpenAI a partir da infraestrutura do
  provider. O código 407 do upstream é consistente com falha de download/proxy.

## Caminho efetivo (antes)

1. `BrandProfilerWithoutLogoService.analyze()` baixa a imagem local com
   `downloadAssetBuffer(input.assetUrl)` para `probeColors`.
2. `callVision()` e `callVisionFull()` enviavam
   `productImagesDataUrls: [input.assetUrl]` ao gateway.
3. O gateway/adapter encaminhava a URL loopback ao provider.
4. O provider tentava baixar a URL e falhava com 400/provider_error.

## Causa-raiz

**Grau de certeza: alto.** O erro detalhado do provider
(`Error while downloading file`, upstream 407) e o caminho de envio
URL-loopback sustentam a hipótese. O buffer já era baixado localmente para a
análise de cores, mas não era reutilizado no payload de visão.

Não foi possível provar a causa por uma nova chamada ao provider — e isso não
era autorizado. A correção elimina a dependência de download externo da URL
loopback.

## Correção mínima aplicada

`src/lib/visual-signature/brand-profiler.ts`:

- Detecta URL de Storage local/loopback (`127.0.0.1`, `localhost`, `::1`).
- Reutiliza o **mesmo buffer** já baixado e envia
  `data:image/png;base64,...` em `productImagesDataUrls`.
- `callVision` e `callVisionFull` recebem a referência de imagem resolvida.
- URL remota continua sendo enviada como URL, sem mudança de comportamento.
- Falha de download local — incluindo HTTP 200 com corpo vazio
  (`buffer.length === 0`) — gera `BrandProfilerWithoutLogoError` explícito com
  `errorType='local_asset_download_failed'`; não envia vazio nem prossegue com a
  URL loopback.
- Modelo, prompt, parâmetros, telemetria e regras de perfil não foram alterados.

## Arquivos alterados

- `C:\Projetos\Vendeo V3 Assinatura Visual\src\lib\visual-signature\brand-profiler.ts`
- `C:\Projetos\Vendeo V3 Assinatura Visual\src\lib\visual-signature\__tests__\palette-resolution.test.ts`

## Testes e gates

- `palette-resolution.test.ts`: **25/25 PASS**, incluindo:
  - imagem local enviada como data URL em `callVision`;
  - `callVisionFull` também envia data URL;
  - URL remota preservada;
  - falha de download local gera erro explícito e não chama OpenAI;
  - HTTP 200 com corpo vazio também gera erro explícito e não chama OpenAI.
- Suítes relacionadas (`brand-profiler`, rota brand-profile, approve): **66/66 PASS**.
- `npx tsc -p tsconfig.typecheck.json --noEmit`: **exit 0**.
- `npm run lint`: **exit 0**.
- `git diff --check`: **limpo**.

## Pendência separada (não corrigida)

A apresentação/preservação do perfil antigo da NovaTek (perfil `synced`
permanecendo visível após falha de novo perfil) não foi alterada. Registrar como
item separado, fora deste recorte.

## Próximo teste proposto (NÃO executado)

Após revisão do Codex e autorização explícita separada: analisar **somente** a
assinatura existente do Luna, sem gerar nova imagem. Essa chamada e eventual
persistência de perfil dependem de autorização humana própria; nenhuma chamada
foi feita neste debug.
