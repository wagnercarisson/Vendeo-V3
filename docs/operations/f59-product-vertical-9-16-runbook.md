# Runbook — F59 Produto vertical 9:16

## 1. Escopo e estado

Este runbook cobre o **fluxo NOVO de Produto** no formato vertical 9:16. O fluxo
antigo está fora do escopo. O 1:1 do novo fluxo permanece preservado.

O vertical é oferecido apenas para **novas gerações** quando a flag global está
ligada. Recuperação, consulta, detalhe, listagem, download e resolução
administrativa continuam funcionando independentemente da flag.

Estado desta fase: implementação local concluída. Homologação funcional, UAT,
ativação e produção são gates separados e não foram executados.

## 2. Flag

- Chave: `product_9_16_enabled`.
- Default: **OFF** (fail-closed). Ausência/erro de leitura ⇒ OFF.
- Leitura: server-side, sem env override e sem coorte/estágio/loja.
- Operação: RPC `admin_update_feature_flag` com motivo obrigatório e auditoria.
- Seed: data-only, `INSERT ... ON CONFLICT (key) DO NOTHING` com `enabled=false`.
  A aplicação do seed exige autorização e ocorre somente em homolog.

## 3. O que a flag NÃO bloqueia

- Consulta do estado da operação.
- Download de campanha já entregue.
- Recuperação de imagem e de copy.
- Detalhe, listagem e miniatura.
- Resolução administrativa de pendências.
- Gerações em andamento, que chegam ao terminal normalmente.

## 4. Dimensões e pipeline

- Provider: `1152x2048` — divisível por 16.
- Entrega: `1080x1920`.
- Fator único de redução: `0,9375`.
- Formato final: JPEG sRGB, qualidade 90.
- O decode é completo; não há upscale, crop, pad, faixas ou letterbox.
- A redução 1152×2048 → 1080×1920 é proporcional e preserva a proporção 9:16.

## 5. Paths

- Arte vertical:
  `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`.
- Miniatura:
  `art-1080x1920.thumb-v1.webp` (162×288, WebP qualidade 78).
- Bucket privado: `campaign-images`.
- Upload com `upsert:false`; conflito de path não sobrescreve arte existente.
- O path vertical é exclusivo: `product-1-1/.../art-1024.jpg` nunca é aceito como
  arte vertical.

## 6. Área segura

Política versionada: `safe-area-9-16-v1`.

Percentuais (base primária do prompt):

- topo: `14%` da altura;
- base: `35%` da altura;
- laterais: `6%` da largura em cada lado;
- canto inferior direito: `30%` da largura × `40%` da altura.

Pixels da ENTREGA `1080 × 1920`:

- topo: `269`;
- base: `672`;
- laterais: `65`;
- canto inferior direito: `324 × 768`.

Pixels do canvas de GERAÇÃO `1152 × 2048`:

- topo: `287`;
- base: `717`;
- laterais: `69`;
- canto inferior direito: `346 × 819`.

Os pixels de entrega NÃO são coordenadas do canvas de geração. Eles existem
apenas como referência de entrega no prompt.

Proveniência: topo/base/laterais permanecem `pending` de fonte oficial citável;
o canto inferior direito é uma recomendação `conservative` do Vendeo. Qualquer
valor pode variar conforme a plataforma; não há garantia de posicionamento.

## 7. Crédito

- Consumo: 1 crédito por campanha entregue.
- Reserva antes da chamada ao provider.
- `art_uploaded` não libera download; a entrega exige `delivered` + arte íntegra.
- Falha confirmada pode gerar estorno único.
- Resultado desconhecido não sofre estorno nem retry automático.

## 8. Diagnóstico e telemetria

Cada tentativa REAL do provider (sucesso, falha ou timeout) grava UM evento em
`generation_events` pelo `DefaultAiTelemetrySink`.

Campos relevantes no `metadata` do evento:

- `format = "9:16"`;
- `requestedSize = "1152x2048"`;
- `returnedSize` — decodificado dos bytes devolvidos; `null`/ausente em
  falha/timeout; nunca copiado de `requestedSize`;
- `outcome` — `success`, `failed` ou `timeout`.

`deliveredSize` NÃO é inventado no evento de IA. Quando necessário, derive-o da
linha `product_1_1_campaign_artifacts` (width/height `1080x1920`) por join com
`campaignId`/`operationId`. Se não existir artefato, `deliveredSize` fica ausente.

Nunca são registrados: prompt, chave de API, bytes de imagem ou conteúdo do
usuário além das referências já existentes.

`format_unavailable` é um slug de API/estado determinístico, NÃO um código
público de ocorrência de suporte. Não há operação, tentativa ou cobrança nesse
caminho. Se um código público for necessário no futuro, registre-o em
`docs/convencoes/codigos-de-erro-suporte.md` no formato `^[A-Z0-9]{1,8}$`.

## 9. Rollback

1. **Flag OFF** via RPC auditado. Isso bloqueia apenas novas gerações verticais;
   campanhas existentes, recuperação e download não são afetados.
2. **Seed**: rollback somente se a chave nunca tiver sido operada, com registro
   explícito da decisão. Não remova histórico de auditoria.
3. **Deploy**: rollback de aplicação é gate separado, com evidência própria.

## 10. Gate de produção (NÃO executado nesta fase)

Deploy, ativação da flag, smoke test e rollback de produção NÃO foram
executados. Homologação não é aprovação de produção. O gate de produção exige
autorização específica, evidência de smoke real e plano de rollback aprovado.

## 11. Limitações conhecidas

- Números de área segura ainda dependem de confirmação em fonte oficial.
- Validação visual com sobreposições reais de Stories/Reels está pendente.
- A prova técnica de provider já registrada não substitui aceite visual.
- Novas gerações pagas exigem acompanhamento do executor e inspeção manual da
  arte, copy, margens e download.
- O seed da flag e a ativação permanecem bloqueados até autorização.
