## Context

O fluxo NOVO de Produto entrega hoje uma única arte 1:1:

- entrada HTTP em `POST /api/campaign/generate-image`, ramo detectado por `backgroundDirection` + `campaignId`/`operationId`;
- orquestração em `src/lib/product-1-1/orchestration/generation-orchestrator.ts` (snapshot → reserva → tentativa atômica → política 2+1 → arte → `art_uploaded` → `delivered`);
- arte em `src/lib/product-1-1/artifact/artifact-store.ts`: `sharp.resize(1024,1024,{fit:"contain",background:"#FFFFFF"}).jpeg({quality:90})`, caminho `{storeId}/{campaignId}/product-1-1/{operationId}/art-1024.jpg`, bucket privado `campaign-images`, `upsert:false`;
- dimensões reais persistidas em `product_1_1_campaign_artifacts` (`width`, `height`, `mime_type`), com trigger de imutabilidade;
- crédito em `product_1_1_campaign_credit_operations` e RPCs `product_1_1_*` (reserva, `art_uploaded`, `delivered`, estorno, fence de publicação, resultado desconhecido);
- provider real `UpstreamImagesAdapter` → `openai.images.edit` com `size` explícito e `quality` obrigatória;
- miniatura WebP `thumb-v1` (maior aresta 288, qualidade 78, `<original>.thumb-v1.webp`), derivada por `deriveThumbnailPath`;
- download, detalhe, listagem e pendências leem o estado persistido da operação e a arte do novo fluxo.

O sistema visual (`openspec/design-system/CAMPAIGN_VISUAL_SYSTEM.md`) já lista Story 1080 × 1920 como formato futuro, mas não há contrato vertical. A documentação local do SDK `openai@6.39` declara que `gpt-image-2` aceita `WIDTHxHEIGHT` arbitrário, com largura e altura divisíveis por 16, proporção entre 1:3 e 3:1 e máximo 3840 × 2160; acima de 2560 × 1440 é experimental. `1152 × 2048` atende; `1080 × 1920` não atende à divisibilidade da largura.

Esta change adiciona o formato vertical sem tocar no fluxo antigo e **preservando o comportamento do Produto 1:1**. A engine compartilhada recebe apenas extensões aditivas com defaults que mantêm o contrato atual; os testes de default provam a equivalência.

## Goals / Non-Goals

**Goals:**

- Oferecer exatamente um formato por campanha nova do fluxo novo: `1:1` ou `9:16`.
- Congelar e persistir o formato na criação; proibir conversão e troca.
- Entregar JPEG sRGB 1080 × 1920 qualidade 90, derivado de uma geração 1152 × 2048 sem distorção, corte ou faixas.
- Definir e versionar a política de áreas seguras 9:16, com proveniência explícita.
- Reutilizar Copy Director, crédito, tentativas, snapshots, storage privado, miniaturas e download preservando o **comportamento** do `1:1`; as extensões na engine compartilhada são aditivas e com defaults atuais.
- Preparar paths, download, recuperação de imagem, resolução administrativa, projeção e miniaturas do vertical, com o formato e o path esperado chegando até a projeção final.
- Controlar custo com estimativa ciente da resolução vertical e teto por chamada, incluindo retries.
- Garantir que a flag OFF limite apenas novas gerações e preserve o atendimento de campanhas existentes.
- Provar provider e aceitação em homolog, com lojas de teste e sobreposições reais, antes de qualquer produção.

**Non-Goals:**

- Fluxo antigo, Serviços, Informativos, carrossel, vídeo, publicação em redes.
- Geração simultânea dos dois formatos.
- Conversão/reformatação de campanhas existentes.
- Novo Copy Director ou copy por plataforma.
- Redesenho dos cards de listagem/dashboard.
- Refatoração ampla do fluxo 1:1.
- Ativação em produção nesta iniciativa.
- Prompt único que produza duas artes similares (hipótese futura registrada, sem implementação nem teste pago).

## Decisions

### D-01 — Módulo vertical próprio, engine estável reutilizada por injeção

Criar `src/lib/product-vertical-9-16/**` para formato, política de área segura, prompt, arte e orquestração de entrada. O runtime `1:1` NÃO importa nada do vertical.

Para não duplicar a lógica crítica de crédito, fence e recuperação, o vertical chama a engine existente de `generation-orchestrator.ts` com um perfil explícito. Serão adicionados apenas dois pontos de extensão opcionais e com default preservado:

- `composePrompt` (default: compositor 1:1 atual);
- `imageSize` (default: `"1024x1024"`).

O `storeArtifact`, o probe, a projeção e o snapshot já são injetáveis. Nenhum call site 1:1 passa os novos parâmetros; os testes de default provam saída idêntica.

**Alternativas consideradas:**

- Duplicar todo o orquestrador: isolamento máximo, mas duplica ~1.700 linhas de lógica financeira e de recuperação — risco alto de divergência.
- Parametrizar profundamente o orquestrador: reduz duplicação, mas amplia o refactor do fluxo atual — rejeitado.
- Módulo vertical separado chamando a engine com perfil: escolhido; caminho próprio na entrada e nas dependências, engine estável com defaults intactos.

### D-02 — Formato persistido no `input_snapshot`, sem migration estrutural

O `campaigns.input_snapshot` (JSONB) já é congelado e usado para classificar o fluxo. O vertical grava:

```json
{
  "campaignFormat": "9:16",
  "formatContractVersion": "f59-vertical-9-16-v1"
}
```

Regras:

- ausência das duas chaves em campanha do fluxo novo ⇒ contrato histórico `1:1` (compatibilidade com campanhas já criadas);
- `1:1` novo NÃO grava essas chaves (payload e hash byte-compatíveis com hoje);
- `9:16` exige `formatContractVersion` presente e reconhecida (`f59-vertical-9-16-v1`); versão ausente, inválida ou não suportada ⇒ indisponibilidade explícita, sem cair no perfil atual por default;
- par formato/versão incoerente (por exemplo, `9:16` com versão de outro contrato) ⇒ fail-closed em leitura, download, recuperação, pendências e restauração;
- o formato e a versão participam do fingerprint de conteúdo congelado do vertical.

A evidência congelada já tem `policy_versions` JSONB; ela recebe a versão da política de área segura e do formato. Nenhuma coluna nova é necessária.

**Alternativas consideradas:**

- Coluna `campaigns.format`: exigiria migration e toca a tabela compartilhada — rejeitado.
- Tabela nova de formato: duplicaria identidade e criaria migration — rejeitado.
- `render_snapshot`: é do fluxo legado e não governa o novo fluxo — rejeitado.

### D-03 — Seleção de formato somente no fluxo novo e sob flag global

O cliente envia `campaignFormat: "9:16"` apenas no vertical; o `1:1` não envia o campo. O schema do fluxo novo ganha `campaignFormat: z.enum(["1:1","9:16"]).optional()` — extensão aditiva; payloads 1:1 existentes continuam válidos.

A UI:

- renderiza o seletor apenas quando `eligible` (server-side) e `product_9_16_enabled` está ligada;
- default `1:1`;
- rótulos `Quadrado 1:1 — feed` e `Vertical 9:16 — Stories e Reels (imagem estática)`;
- helper informa imagem estática, ausência de vídeo e variação por plataforma;
- o seletor entra no fingerprint do rascunho, de modo que trocar o formato gera nova identidade de campanha;
- `CampaignFormRestore` passa a carregar o formato (e a versão) lido do `input_snapshot` server-side; a restauração preserva a escolha no rascunho, na revisão e em nova tentativa após estorno;
- `display.ts` não importa o módulo vertical: a página resolve e valida formato/versão server-side e passa o valor estruturalmente, como já ocorre com `backgroundDirection`;
- se a flag estiver OFF na restauração, a escolha vertical é preservada e exibida, mas a nova submissão fica bloqueada com explicação — nunca há troca silenciosa para `1:1`.

**Alternativas consideradas:**

- Reutilizar o campo legado `format: string`: é declarativo, sem semântica e aceito pelo schema legado — rejeitado.
- Tela separada para vertical: aumenta navegação e duplica elegibilidade — rejeitado para a primeira fatia.
- Seleção obrigatória explícita sem default: atrito desnecessário; `1:1` preserva o comportamento atual — rejeitado.

### D-04 — Despacho server-side para o caminho vertical

Após elegibilidade, ownership, binding de identidade, validação de conteúdo e antes da reserva, a rota verifica `campaignFormat`. Se `"9:16"`, valida o payload vertical e delega ao entrypoint vertical carregado por `import()` dinâmico **apenas nesse ramo**; se `1:1`/ausente, segue o caminho atual sem executar código vertical.

Divergência entre formato persistido e solicitado ⇒ HTTP 409, sem segunda campanha, crédito ou provider. Formato desconhecido ⇒ HTTP 400.

### D-05 — Provider: 1152 × 2048 solicitado, dimensão devolvida verificada

O vertical usa o mesmo `createNewFlowImageGateway` e o mesmo `UpstreamImagesAdapter` (`images.edit`), passando `size: "1152x2048"` e a qualidade do par. O adapter não muda.

Após a resposta:

- decodificar os bytes e registrar a dimensão real devolvida;
- exigir 1152 × 2048; qualquer outra dimensão ⇒ falha fechada, sem upscale/crop/pad e sem retry cego;
- manter a política atual de tentativas: principal até 2, fallback 1, `rate_limit` com uma repetição.

**Fatos comprovados:** o SDK local tipa `size` como `(string & {})` e documenta a regra de 16 px, proporção 1:3–3:1 e máximo 3840 × 2160. O adapter atual envia `size` e `quality` explicitamente.

**Prova pendente:** aceitação real de 1152 × 2048 pelos modelos `gpt-image-2.5-sunburst` e `gpt-image-2`, nas qualidades `low` e `medium`, com dimensão devolvida e custo reais. Nenhuma chamada paga é feita nesta fase.

### D-06 — Pipeline final 1080 × 1920, JPEG sRGB qualidade 90

Pipeline próprio `resizeVerticalToJpeg1080x1920`:

1. decodificar o PNG do provider;
2. verificar que a fonte é exatamente 1152 × 2048;
3. reduzir por fator único 0,9375 para 1080 × 1920;
4. converter explicitamente para sRGB;
5. codificar JPEG qualidade 90;
6. verificar por decode completo: formato real `jpeg`, 1080 × 1920.

Não usar `fit:"contain"` com fundo: isso poderia criar faixas. Como a proporção é idêntica, a redução é proporcional; ainda assim, a implementação deve afirmar a igualdade de proporção antes de redimensionar para evitar distorção silenciosa.

**Alternativa considerada:** pedir 1080 × 1920 diretamente — rejeitado porque a largura não é divisível por 16.

### D-07 — Path vertical dedicado e reutilização da tabela de artefatos

Path:

`{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`

A tabela `product_1_1_campaign_artifacts` é reutilizada: a identidade é `(campaign_id, operation_id)`, `width`/`height` têm CHECK 1–8192 e o registro é imutável. Não há constraint de formato. O vertical grava `width=1080`, `height=1920`, `mime_type=image/jpeg` decodificados dos bytes.

Nenhuma migration estrutural é prevista. Se a implementação encontrar uma constraint/RPC incompatível, o trabalho para no checkpoint de decisão e apresenta evidência.

### D-08 — Miniatura vertical derivada, best-effort

Reutilizar `generateCampaignThumbnailSafely` e o contrato `thumb-v1` (WebP, maior aresta 288, qualidade 78, sem crop/upscale). Adicionar ao reconhecimento de path o padrão vertical; o resultado é 162 × 288.

Falha da miniatura nunca lança, nunca altera crédito e nunca bloqueia entrega/download. O caminho é irmão do original e `upsert:false`.

### D-09 — Política versionada de áreas seguras `safe-area-9-16-v1`

Valores para 1080 × 1920:

| Zona | Percentual | Pixels | Classificação |
|---|---|---|---|
| Topo | 14% da altura | 269 px | Orientação documentada (Meta, Stories/Reels 9:16) — número a confirmar na fonte oficial |
| Base | 35% da altura | 672 px | Orientação documentada (Meta) — número a confirmar |
| Laterais | 6% da largura | 65 px cada | Orientação documentada (Meta) — número a confirmar |
| Canto inferior direito | 30% da largura × 40% da altura | 324 × 768 px | Recomendação conservadora do Vendeo para a pilha de controles; validação pendente |

A área útil resultante para elementos essenciais é, no retângulo principal, x ∈ [65, 1015] e y ∈ [269, 1248], com a proteção adicional do canto inferior direito.

Proveniência:

- **documentado:** a Meta descreve uma zona segura unificada para anúncios em Stories e Reels em `https://www.facebook.com/business/help/980593475366490`; os percentuais 14/35/6 são amplamente reportados para a especificação 9:16 de 2026. A página oficial não foi acessível integralmente nesta sessão; o número deve ser conferido por captura/inspeção da fonte oficial antes do aceite;
- **conservador do Vendeo:** laterais 6% como margem mínima e o retângulo 324 × 768 no canto inferior direito, que cobre a pilha de ações do Reels para além da faixa de 35%;
- **pendente:** validação visual com sobreposições reais de Instagram/Facebook em homolog.

A política é congelada em `policy_versions`; mudanças futuras exigem nova versão e não alteram campanhas existentes.

### D-10 — Prompt vertical derivado do baseline 1:1

Reutilizar a base congelada (`PRODUCT_1_1_PROMPT_BASE.content`), as políticas de intenção, produto, identidade, fundo e integridade do 1:1. O vertical adiciona:

- política de formato `9:16` no bloco de intenção;
- orientação de canvas vertical e preenchimento total;
- orientação de áreas seguras com os valores da política versionada;
- proibição explícita de guias, faixas vazias, letterbox e bordas;
- instrução de que o essencial deve ser compreensível sem legenda externa.

O compositor ganha um resolver opcional (default 1:1). O vertical passa seu resolver; o 1:1 não muda. Versões registradas: base, compositor, formato, área segura, fundo, identidade, integridade.

### D-11 — Copy Director reutilizado sem alteração

O vertical usa o mesmo `CopyDirectorService`, schema, prompts, retry e fallback. A copy preserva o comportamento real do fluxo novo: começa **depois de adquirir a tentativa de execução e antes da resposta da imagem**, em paralelo, e não bloqueia a entrega da arte; falha/pendência segue a recuperação atual. Nenhum prompt de copy é criado ou alterado.

### D-12 — Crédito reaproveitado, 1 campanha entregue = 1 crédito

Reutilizar `product_1_1_campaign_credit_operations` e as RPCs atuais. Pontos de integração explícitos:

1. **Reserva** — depois do snapshot persistido e antes de qualquer chamada ao provider.
2. **`art_uploaded`** — depois do upload imutável e da persistência dos metadados.
3. **Fence de publicação** — `beginPublication` antes do upload; `abortPublication` apenas com falha comprovada antes do envio; `markResultUnknown` quando o resultado é desconhecido.
4. **`delivered`** — somente após o fence e o upload bem-sucedidos.
5. **Estorno** — somente no encerramento de falha confirmada, com ausência provada e uma única vez.
6. **Resultado desconhecido** — permanece pendente; sem estorno automático e sem retry cego.
7. **Reenvio** — consulta pura; sem provider e sem crédito.

O vertical não cria tipo de crédito, tabela ou RPC.

### D-13 — Download e detalhe com despacho por formato

`resolveCampaignFormat(input_snapshot)` é puro e fail-closed. Nos pontos de leitura:

- `GET /api/campaign/[id]/download`: formato `9:16` usa o probe/download vertical; `1:1`/ausente mantém o código atual; formato inválido ⇒ 503.
- Detalhe da campanha: para `9:16`, usa o probe e a URL assinada vertical; `1:1` intocado.
- Lista: `storage_path` e `deriveThumbnailPath` continuam genéricos; o novo padrão é reconhecido.

Os gates (`delivered` + arte integral) e o formato de attachment são os mesmos. Nenhuma URL assinada é exposta antes do gate.

### D-14 — Recuperação e pendências cientes do formato

O probe vertical valida 1080 × 1920; um objeto 1024 × 1024 em path vertical é `invalid`. O repositório de pendências passa a aceitar uma interface mínima de probe (`ArtifactProber`) em vez da classe concreta 1:1; o default continua o store 1:1. A leitura de cada operação pendente resolve o formato pelo `campaigns.input_snapshot` da campanha e injeta o store correspondente; formato malformado falha fechado.

O despacho por formato precisa cobrir **toda a cadeia de recuperação**, não só a sonda:

1. `POST /api/campaign/[id]/image-recovery` lê o formato persistido do `input_snapshot` (nunca do cliente) e instancia a recuperação com o probe vertical e a projeção com o path vertical esperado.
2. `ProductOneToOneArtifactRecovery` recebe, por injeção, o probe vertical e um `projectDeliveredCampaign` já vinculado ao path vertical; a confirmação financeira (`markArtUploaded` → `deliver`) continua a mesma.
3. `resolve-pending-operation` recebe o mesmo `projectDeliveredCampaign` ciente do formato; a resolução administrativa de `deliver_existing_art` projeta a campanha vertical como `ready` com o path vertical.
4. `projectDeliveredCampaign` usa `expectedArtifactPath` explícito; sem ele, o default permanece o path 1:1.
5. O teste de recuperação vertical deve percorrer operação pendente → arte íntegra → entrega → projeção → detalhe/listagem, **sem nova geração**, e provar que a campanha não fica `ready` com path 1:1 nem presa em `generating`.

O RPC de resolução administrativa é reutilizado. A UI administrativa ganha apenas a identificação do formato na evidência; nenhum redesenho.

### D-15 — Projeção da campanha com path esperado explícito

`projectDeliveredCampaign` ganha `expectedArtifactPath?: string`, com default no path 1:1 atual. O vertical passa o path vertical. A projeção continua exigindo operação `delivered` e linha de artefato correspondente; nunca marca `ready` sem arte persistida.

`projectClosedCampaign` é reutilizado sem mudança.

### D-16 — Observabilidade sem dados sensíveis

Registrar por tentativa: formato `9:16`, tamanho solicitado, tamanho devolvido, tamanho entregue, modelo, qualidade, alvo, operação e resultado. Não persistir prompt, chave, bytes de imagem ou conteúdo do usuário além das referências já existentes.

### D-17 — Rollout: uma única flag global

`product_9_16_enabled`, OFF por padrão, lida server-side com fail-closed. Não há coorte, estágio, autorização por loja ou segunda chave.

A flag limita **apenas o início de novas gerações verticais**. Com OFF:

- campanhas verticais já criadas continuam consultáveis, baixáveis e recuperáveis;
- `image-recovery`, consulta de operação, recuperação de copy, download, detalhe e listagem continuam funcionando;
- a resolução administrativa de pendências verticais continua disponível;
- gerações já em andamento seguem até `delivered`, `refunded` ou pendência honesta, sem aborto pela flag;
- a UI não oferece vertical para novas submissões e o servidor rejeita novas submissões antes de reserva/provider.

A flag vertical não substitui as autorizações de fluxo existentes: a recuperação mantém a barreira atual de classificação do fluxo e autorização/ownership, mas **não consulta `product_9_16_enabled`**.

Como a tabela `feature_flags` só é alterada pelo RPC de update (que exige a linha existente), a chave precisa ser semeada. Isso exige **uma migration data-only** no padrão do repositório:

```sql
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('product_9_16_enabled', false, '...')
ON CONFLICT (key) DO NOTHING;
```

Ela não altera schema, constraints, RPCs, grants ou linhas existentes. A criação deve seguir `YYYYMMDDHHmmss_f59_product_9_16_flag.sql` com timestamp UTC real e conferência de unicidade. Se o responsável rejeitar a migration data-only, a alternativa é operar a flag por inserção administrativa controlada; a decisão fica registrada antes da execução.

### D-18 — Prova de provider antes de consolidar o pipeline

Matriz planejada: 3 amostras por combinação `modelo × qualidade` em 1152 × 2048 (12 chamadas) + 1 controle 1024 × 1024 por modelo (2 chamadas) = **14 chamadas pagas**, teto **US$ 3,00**. Modelos: `gpt-image-2.5-sunburst` e `gpt-image-2`; qualidades `low` e `medium`.

A matriz é **condicionada ao saldo do orçamento**: antes de cada chamada, o gate consulta o teto e a estimativa; se o saldo restante não cobrir a próxima chamada, a prova para e registra o que ficou pendente. Retries e repetições de `rate_limit` também consomem orçamento e entram na contagem e no teto.

**Estimativa ciente da resolução:** o pricing atual resolve `image_unit_usd` por `modelo + qualidade`, sem dimensão. Para 1152 × 2048, o vertical NÃO pode reutilizar cegamente a estimativa de 1024 × 1024. A implementação deve:

- definir uma estimativa conservadora **antes da primeira chamada paga**; a calibração posterior apenas confirma ou ajusta essa estimativa, nunca a substitui por um valor inventado depois do gasto;
- calibrar na prova a diferença entre estimativa e custo reportado para 1152 × 2048;
- introduzir um multiplicador/estimativa vertical versionado, conservador e documentado, ou provar que o `image_unit` da tabela é válido para o tamanho;
- bloquear a chamada paga quando não houver estimativa vertical explícita (fail-closed), sem inventar valor;
- registrar estimativa, custo reportado e desvio por tentativa.

**Orçamento separado:** o teto de US$ 3,00 cobre apenas a prova técnica. A UAT funcional em homolog tem orçamento próprio, aprovado separadamente, e não é contabilizada nesse teto.

Critérios: request aceito; bytes decodificáveis; dimensão real registrada; ausência de evidência de crop do provider; custo dentro do teto; fallback observável; estimativa vertical compatível com o custo real. Combinação que não produza 9:16 é excluída com evidência, nunca substituída silenciosamente.

Nenhuma chamada paga, migration ou operação de produção nesta fase de proposta.

### D-19 — Política de migration

Nenhuma migration estrutural. Exceção única e justificada: seed data-only da flag global. Qualquer outra necessidade estrutural deve voltar como decisão explícita com evidência (constraint, RPC, índice), antes de codar.

### D-20 — Hipótese futura registrada

Um prompt que produza duas artes similares, uma por formato, fica como investigação separada. Não há implementação, teste pago nem promessa de entrega nesta iniciativa.

## Integration points

| Ponto | Arquivo atual | Mudança necessária |
|---|---|---|
| Schema do fluxo novo | `src/lib/image-generation/schema.ts` | `campaignFormat` opcional no schema do novo fluxo |
| Rota de geração | `src/app/api/campaign/generate-image/route.ts` | congelar formato, validar mismatch, despachar vertical, passar perfil |
| Formulário | `src/components/flow/use-campaign-form.ts`, `campaign-input-form.tsx` | estado, body, seletor e fingerprint |
| Elegibilidade da página | `src/app/(app)/campanhas/nova/page.tsx` | expor flag vertical ao cliente |
| Engine | `src/lib/product-1-1/orchestration/generation-orchestrator.ts` | `composePrompt` e `imageSize` opcionais, defaults 1:1 |
| Prompt | `src/lib/product-1-1/prompt-composition.ts` | resolver opcional, default 1:1 |
| Arte vertical | novo `src/lib/product-vertical-9-16/artifact/*` | pipeline, path, probe, download |
| Miniatura | `src/lib/campaign/thumbnail/thumbnail-path.ts` | reconhecer padrão vertical |
| Projeção | `src/lib/product-1-1/orchestration/project-delivered-campaign.ts` | `expectedArtifactPath` opcional |
| Download | `src/app/api/campaign/[id]/download/route.ts` | despacho por formato |
| Recuperação de imagem | `src/app/api/campaign/[id]/image-recovery/route.ts` | formato → probe vertical + projeção com path esperado |
| Serviço de recuperação | `src/lib/product-1-1/artifact/artifact-recovery.ts` | injeção do probe e da projeção cientes do formato |
| Resolução administrativa | `src/lib/product-1-1/pending/resolve-pending-operation.ts` | projeção vertical no `deliver_existing_art` |
| Detalhe | `src/app/(app)/campanhas/[id]/page.tsx` | probe/URL vertical |
| Pendências | `src/lib/product-1-1/pending/*` | interface de probe e injeção vertical |
| Restauração | `src/lib/campaign/display.ts` | `CampaignFormRestore` com formato/versão e falha segura com flag OFF |
| Custo/teto | `src/lib/ai-cost/image-pair-pricing.ts`, `src/lib/product-1-1/pilot/*` | estimativa vertical e gate por chamada com retries |
| Flag | `src/lib/feature-flags/feature-flag-service.ts` + admin | nova chave global e exibição |
| Seed da flag | nova migration data-only | inserir a chave OFF |

## Dependencies and acceptance gates

**Dependencies:**

- aprovação desta base OpenSpec antes de qualquer planejamento GSD;
- prova de provider em homolog (14 chamadas, teto US$ 3,00) antes de consolidar o pipeline;
- definição final da fonte de áreas seguras e das sobreposições usadas no aceite visual;
- decisão sobre o seed data-only da flag global;
- lojas de teste com saldo controlado e flag OFF/ON em homolog;
- confirmação read-only de que constraints e RPCs atuais suportam o vertical sem migration estrutural.

**Acceptance gates (todos obrigatórios antes de produção):**

1. Contrato de formato e área segura versionados e testados.
2. Provider comprovado nos pares elegíveis, com dimensão devolvida e custo registrados.
3. Arte final 1080 × 1920 JPEG sRGB q90 verificada por decode completo.
4. Path, metadados, miniatura, download, recuperação de imagem, resolução administrativa e projeção funcionando em homolog, com recuperação vertical completa até detalhe/listagem e sem nova geração.
5. Crédito: 1 por entrega; estorno único em falha confirmada; desconhecido sem estorno.
6. Custo: estimativa vertical explícita antes de cada chamada, teto por chamada, retries contabilizados e orçamento de prova separado da UAT.
7. Flag OFF após inicio de uma geração: operação existente continua consultável, baixável, recuperável e resolvível; geração em andamento chega ao terminal.
8. Restauração do formulário preserva o formato vertical e não troca silenciosamente para 1:1 com a flag OFF.
9. Regressão 1:1 automatizada e manual sem divergência de comportamento.
10. Revisão visual com sobreposições de Stories/Reels aprovada.
11. Relatório de homolog com limitações explícitas; produção permanece um gate separado.

## Risks / Trade-offs

- **[Engine compartilhada com perfil]** → defaults preservados e testes de byte-compatibilidade do 1:1; o vertical não é importado pelo 1:1. Se a extensão crescer, avaliar separação.
- **[Duplicação de lógica se a engine não bastar]** → o design prioriza reuso; qualquer duplicação futura exige justificativa e testes de paridade.
- **[Dimensão devolvida diferente de 1152 × 2048]** → falha fechada, telemetria e nenhum upscale silencioso; a prova de provider decide se o pipeline é viável.
- **[Números de área segura não confirmados na fonte oficial]** → política marcada como pendente; aceite visual com sobreposições reais em homolog; valores conservadores.
- **[Segurança jurídica da marca/identidade]** → identidade continua resolvida server-side; o vertical não altera precedência de paleta nem o bloco de identidade.
- **[Miniatura falha]** → best-effort; entrega e crédito não dependem dela.
- **[Migration data-only da flag]** → mínima, reversível e sem schema; se rejeitada, operação administrativa controlada.
- **[Custo de prova e estimativa de tamanho]** → multiplicador vertical conservador e versionado; sem estimativa explícita a chamada é bloqueada; prova mede desvio entre estimativa e custo reportado.
- **[Orçamento estourado por retries]** → gate por chamada, contagem de retries e parada com pendências registradas; teto de prova separado da UAT.
- **[Projeção vertical após recuperação]** → path esperado propagado por rota, serviço e resolução administrativa; teste ponta a ponta até detalhe/listagem.
- **[Flag OFF bloqueia atendimento existente]** → flag consultada apenas no início de novas gerações; recuperação, download, consulta, copy e resolução continuam disponíveis.
- **[Restauração silenciosa como 1:1]** → formato/versão no `CampaignFormRestore`; com flag OFF a escolha é preservada e a submissão bloqueada com explicação.
- **[Regressão 1:1]** → suíte focada e geração manual 1:1 em homolog como gate; extensões da engine cobertas por testes de default.
- **[Formato persistido malformado]** → fail-closed em todos os leitores; nunca reinterpretar.

## Migration Plan

1. Nenhuma migration estrutural.
2. Criar, se aprovado, a migration data-only `YYYYMMDDHHmmss_f59_product_9_16_flag.sql` com `INSERT ... ON CONFLICT DO NOTHING`, `enabled=false`, timestamp UTC real e verificação de unicidade.
3. Aplicar primeiro em homolog; verificar a linha e o estado OFF.
4. Não aplicar em produção nesta fase.
5. Rollback da flag: `enabled=false` via RPC auditado; rollback da migration data-only: `DELETE` da chave somente se ela nunca tiver sido operada, com registro da decisão.

## Validation strategy

- **Contrato/prova técnica:** testes puros de formato, safe area, dimensões, paths e resolução; prova de provider em homolog (14 chamadas, US$ 3,00).
- **Composição:** fixture vertical vs 1:1 provando que só formato/área segura mudam; revisão visual com sobreposições.
- **Geração e persistência:** arte 1080 × 1920, JPEG real, path, metadados, miniatura, crédito e recuperação.
- **Integração da criação e entrega:** seletor, payload, congelamento, despacho, download, detalhe, lista e projeção.
- **Validação:** suíte focada, regressão 1:1, typecheck/lint/build, OpenSpec strict e aceite em homolog.

## Open Questions

1. A página oficial da Meta será acessível para confirmar 14/35/6 e a proteção do canto inferior direito? Se não, o aceite usa capturas de sobreposição e mantém a classificação “documentado a confirmar”.
2. O provider aceita 1152 × 2048 nos dois modelos e qualidades com dimensão devolvida estável? A prova de homolog responde.
3. A migration data-only da flag é aprovada ou a chave será operada por inserção administrativa controlada?
4. O custo real por chamada em 1152 × 2048 cabe no teto de US$ 3,00 para as 14 chamadas? O pricing registrado e a prova respondem. Se o `image_unit` atual não valer para o tamanho maior, qual multiplicador conservador será adotado?
5. Alguma constraint/RPC atual impede reutilizar `product_1_1_campaign_artifacts` e as RPCs de crédito? A inspeção read-only responde antes da implementação.
6. A barreira de autorização atual em `image-recovery` continua suficiente quando a flag vertical está OFF, ou será necessário distinguir explicitamente “operação existente” de “nova geração” na decisão? A matriz de testes de flag OFF responde.
7. O `CampaignFormRestore` precisa carregar também a versão do contrato para exibição/diagnóstico, ou o formato basta para a UI e a versão fica só na validação server-side?
