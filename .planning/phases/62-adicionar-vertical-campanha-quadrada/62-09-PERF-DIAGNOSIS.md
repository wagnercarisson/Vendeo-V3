# F62 — Diagnóstico de latência na alternância 1:1 ↔ 9:16

**Data:** 2026-11-24
**Escopo:** investigação e diagnóstico, **sem implementar otimizações**.
**Aceite:** visual/funcional e de desempenho registrados em `62-ACCEPTANCE.md`
(2026-11-24). A campanha **Vellora** (`682dafa2-8b98-4ddf-aef8-88a9e37aefbc`) foi
gerada e avaliada visualmente, com ambas as artes consideradas publicáveis; a
Jarra permanece como evidência anterior do executor. P1–P3 permanecem opcionais
e não foram implementados.
**Campanha:** `c06b16f5-f126-429c-b5b0-9567fe4adb95` (Jarra Finesse 1l)
**Adição entregue:** `operation_id=f0fd0e3c-1b1d-457e-b62f-9b579377fbf7`
**Instância:** somente `localhost:3001` (a 3000 foi encerrada). Nenhum build executado
durante o dev e nenhuma alteração de código de produto.

---

## 1. Resultado principal (TL;DR)

O payload RSC/documento da página **não é dominado pela UI**: ele carrega os
**Buffers de pixels do `sharp` serializados pela instrumentação de performance do
React em modo desenvolvimento**.

| Formato | Documento/RSC | Composição |
|---|---:|---|
| 1:1 | **11.538.725 B** | 10.764.569 B raw 1024×1024 + 639.460 B JPEG 1:1 + **~144 KB de UI real** |
| 9:16 | **33.234.372 B** | 10.764.569 B raw 1024×1024 + 20.587.612 B raw 1080×1920 + 639.460 B JPEG 1:1 + 1.100.519 B JPEG vertical + **~146 KB de UI real** |

A entrada que referencia esses valores é sempre uma linha de debug do React:

```text
J{"name":"Sharp.toBuffer","start":113.7,"end":125.4,"env":"Server",
  "stack":"$172","owner":"$3a","value":"$@173"}
```

- O bundle **de desenvolvimento** `react-server-dom-webpack-server.node.development.js`
  contém a emissão de `env:"Server"` / `value` de promises aguardadas
  (`canEmitDebugInfo`, `emitAsyncSequence`, `forwardDebugInfoFromThenable`).
- O bundle **de produção** (`...server.node.production.js`) **não contém nenhuma
  ocorrência** de `env:`/`"Server"` — logo, **nada disso é serializado em produção**.
- O único consumidor dos chunks grandes é a própria trilha de debug (`refs=1` →
  `$@<id>`); nenhum prop de client component, server action ou DTO referencia esses
  Buffers.

**Conclusão:** a lentidão medida no dev é majoritariamente **custo de modo
desenvolvimento**, não do fluxo de campanha. Nenhuma validação de integridade
(decode completo, checksum, dimensões, evidência, ownership, autorização,
idempotência ou contabilidade) deve ser removida para “ganhar velocidade”.

---

## 2. Tempos medidos (mesma campanha, instância única)

### 2.1 Navegações aquecidas (clique → imagem)

| Transição | `performance.navigation.duration` | `domContentLoaded` | Documento |
|---|---:|---:|---:|
| 9:16 → 1:1 | **2.079–2.084 ms** | 1.833–1.914 ms | 11,5 MB |
| 1:1 → 9:16 | **3.684 ms** | 3.480 ms | 33,2 MB |

`fetch(location.href, {cache:"no-store"})` aquecido:

| Formato | Tempo | Bytes |
|---|---:|---:|
| 1:1 | 1.285–1.660 ms | 11.538.725–11.548.538 |
| 9:16 | 2.742–2.751 ms | 33.234.372–33.238.300 |

`handle-request` no `.next/trace` (warm): 1:1 **1.226–1.445 ms**; 9:16
**2.692–2.913 ms**. A diferença de ~1,4 s entre os formatos acompanha os ~21,7 MB
adicionais.

### 2.2 Primeira abertura x aquecida

- Primeira requisição 9:16 após ociosidade: **5.036 ms** (handle server), contra
  **2.692–2.913 ms** aquecida → ~2,1–2,3 s de compilação do modo dev.
- Primeira chamada `GET /api/campaign/:id/format-additions`: **692 ms**; aquecida
  **118–121 ms** (resposta de **67 B**, HTTP 200). O delta de ~570 ms é compilação
  da rota em dev.
- Após a entrega da vertical, o trace registra **duas requisições `_rsc`**
  consecutivas (370 ms e 2.432 ms) para o mesmo URL `?format=9:16`.

> A medição de “primeira abertura após restart total” não foi feita para não
> interromper a instância única usada nas demais medições. O par
> ocioso/aquecido acima já isola o custo de compilação do dev.

### 2.3 Componentes isolados (Node/tsx, sem browser)

| Componente | Tempo |
|---|---:|
| download Node HTTP 1:1 | 8 ms |
| download Node HTTP vertical | 21 ms |
| leitura da adição | 13 ms |
| `retrieveCompositionArtifact` (vertical) | 38 ms |
| `verifyExpansionReuseEvidence` | 8 ms |
| probe vertical | 44–47 ms |
| probe 1:1 | 16–19 ms |
| assinatura de URL (preview/download) | 4–8 ms |

Os probes, downloads, assinaturas e leituras **somam ~60–80 ms**. Eles não
explicam 2,7 s; o custo está na geração/entrega do documento.

### 2.4 Custo puro de serialização (Node)

`JSON.stringify({data:{type:"Buffer",data:[...]},info:{...}})` com bytes aleatórios:

| Buffer | Bytes | JSON | Tempo |
|---|---:|---:|---:|
| 1024×1024×3 | 3.145.728 | 11.232.661 | 107–133 ms |
| 1080×1920×3 | 6.220.800 | 22.208.266 | 237–242 ms |

Ou seja: só o `JSON.stringify` já custa ~130 ms/240 ms; o restante do delta de
~1,4 s é montagem dos chunks Flight, conversão UTF-8, pressão de memória/GC e
transferência de 33 MB.

---

## 3. Anatomia dos chunks grandes (com origem comprovada)

| Chunk | Conteúdo | Origem no código | Como chega ao payload |
|---:|---|---|---|
| 10.764.569 B | raw `1024×1024`, 3 canais (3.145.728 B) | `verifyJpeg1024` — `src/lib/product-1-1/artifact/artifact-store.ts:102-104` | probe 1:1 (`probeArtifact`, linha 470) → promise `Sharp.toBuffer` aguardada durante o render |
| 20.587.612 B | raw `1080×1920`, 3 canais (6.220.800 B) | `verifyCompositionArtifactBytes` — `src/lib/campaign/composition-artifacts/integrity.ts:89-91` | `retrieveCompositionArtifact` → `CompositionVerticalProbe.probe` → `probeVerticalArtifact` → `additionSignedUrls` (`page.tsx:118-152`) |
| 639.460 B | JPEG 1:1 (~187 KB) | `downloadStorageObjectViaNodeHttp` | promise de download aguardada no probe 1:1 |
| 1.100.519 B | JPEG vertical (309.682 B) | `downloadStorageObjectViaNodeHttp` | promise de download aguardada no probe vertical |

Evidência literal do payload 9:16 (os ids de linha variam a cada request; o
encadeamento track → chunk é o mesmo):

```text
17c:J{"name":"Sharp.toBuffer",...,"env":"Server","value":"$@17e"}
17e:{...raw 1080x1920...}                          -> 20.587.612 B

181:J{"name":"Sharp.toBuffer",...,"env":"Server","value":"$@183"}
183:{...raw 1024x1024...}                          -> 10.764.569 B

16b:"$191"   (alias do download 1:1)               ->   639.460 B
177:"$192"   (alias do download vertical)          -> 1.100.519 B
J{"name":"downloadStorageObjectViaNodeHttp",...,"value":"$@16b"}
```

As trilhas `Sharp.metadata`, `SupabaseAuthClient.getClaims`, `cookies`, `readFile`
e `readdir` também aparecem — todas são instrumentação de dev do React, não
dados da página.

### 3.2 Caminho real de cada alternância

**9:16 → 1:1**

1. Clique no `<a href="/campanhas/:id?format=1:1">` (sem prefetch) → navegação de
   documento completo (recarga).
2. Server: `requirePageUser` → `getCurrentStore`/`getUiRenderContext` (paralelo)
   → `getCampaignForDisplay` → `readFormatAdditionByCampaign` →
   `formatResolution` persistido = `1:1` → `ProductOneToOneArtifactStore.probeArtifact`
   (download 8 ms + `sharp.metadata` + raw 1024² + SHA-256) →
   `getSignedArtifactUrl` (5 ms).
3. Render: UI (~145 KB) + trilhas de debug serializando raw 1024² e JPEG 1:1
   (10,76 MB + 0,64 MB **apenas em dev**).
4. Browser: parse do documento, mount e download da URL assinada do JPEG 1:1. A
   URL assinada muda a cada render, então o `<img>` tende a baixar novamente
   (~187 KB do Storage) — custo pequeno, não isolado.

**1:1 → 9:16**

1. Clique no `<a href="/campanhas/:id?format=9:16">`.
2. Server: mesmas leituras de auth/loja/campanha/adição. Como
   `formatResolution` continua `1:1` (formato **persistido**, não o query param),
   o código **primeiro sonda e assina o quadrado** (`page.tsx:470-495`) e só
   depois entra no bloco da adição (`page.tsx:573-596`), que chama
   `additionSignedUrls` → `CompositionVerticalProbe`:
   `verifyCampaignAccess` → linha vertical → `retrieveCompositionArtifact`
   (access + linha + download 21 ms + `sharp.metadata` + raw 1080×1920 + SHA-256)
   → linha `square_prepared` → compatibilidade → `verifyExpansionReuseEvidence`
   (`readObjectInfo`) → 2 assinaturas (preview + download).
3. Render: UI (~146 KB) + raw 1024² + raw 1080×1920 + JPEG 1:1 + JPEG vertical
   (33,2 MB **apenas em dev**).
4. Browser: parse de 33,2 MB, mount, download da URL assinada vertical
   (309.682 B).

### 3.3 Por que a serialização acontece

React Server (build de desenvolvimento) instrumenta operações assíncronas com
`AsyncLocalStorage`/`async_hooks` e emite, no stream RSC, um “performance track”
por promise aguardada. Para valores resolvidos, o track carrega o próprio valor
(`"value":"$@<id>"`). Como `sharp(...).raw().toBuffer({resolveWithObject:true})`
resolved com `{ data: Buffer, info }`, esse objeto inteiro é serializado.

O `canEmitDebugInfo` é ativado somente no bundle de desenvolvimento. Verificação
nos artefatos instalados:

- `react-server-dom-webpack-server.node.development.js`: 12 ocorrências de
  `env:`/`"Server"` (emissão de debug).
- Todos os bundles **production** disponíveis (`webpack` e `turbopack`, node,
  edge, browser e unbundled): **0 ocorrências**.

**Não é um vazamento de prop nem um bug de serialização da aplicação** — é o
preço de rodar a validação de integridade dentro do render em `next dev`.

---

## 4. Candidatos — classificação

Legenda: **necessário** = protege garantia e não pode sair; **necessário apenas
em certos estados** = pode ser condicionado; **redundante comprovado** = não
protege nada no estado medido; **inconclusivo** = falta medição.

| # | Candidato | Arquivo/linha | Finalidade / garantia | Consumidores | Custo medido | Consequência de remover | Classificação |
|---|---|---|---|---|---|---|---|
| 1 | Serialização do raw 1024² | `artifact-store.ts:95-111` | decode COMPLETO de pixels; detecta truncado/não-JPEG/dimensão | probe 1:1 | 10,76 MB no doc; 17 ms CPU | perde a validação por conteúdo | **necessário** (a serialização é dev-only) |
| 2 | Serialização do raw vertical | `integrity.ts:43-117`, esp. 89-91 | idem, para `vertical` | retrieve/probe vertical | 20,59 MB no doc; 38–47 ms CPU | perde a validação por conteúdo | **necessário** (dev-only) |
| 3 | Serialização dos JPEGs baixados | `node-http-download.ts` / `storage.ts` | bytes reais para checksum/dimensão | probes | 0,64 + 1,10 MB no doc; 8–21 ms | perde checksum/validação | **necessário** (dev-only) |
| 4 | Probe + assinatura do **quadrado** quando `?format=9:16` | `page.tsx:470-495` (executa antes) vs `page.tsx:573-596` (sobrescreve) | fallback: se a vertical falhar, mostra o quadrado | página 9:16 | 1 probe + 1 assinatura por navegação; 16–19 ms + 5 ms; **11,4 MB** do doc (raw 1024² + JPEG 1:1) | no caminho feliz, remove trabalho e 11,4 MB; no caminho de falha, perde o fallback se removido sem condicionamento | **necessário apenas no estado de falha do vertical; redundante no caminho feliz comprovado** |
| 5 | `router.replace()` + `router.refresh()` após entrega | `client.tsx:168-172` | refletir no servidor a adição entregue | modal de adição | 2 requisições `_rsc` (370 ms + 2.432 ms) quando o URL já é `?format=9:16` | uma renderização server-side a menos; mantém URL/estado com uma única transição | **redundante comprovado** (quando a URL de destino já é a atual) |
| 6 | Revalidação da fonte no `GET` de adição **delivered** | `route.ts:340-345` → `resolve-source.ts` → `validateDeliveredCampaignSource`; short-circuit em `eligibility.ts:92-94` | provar que a fonte quadrada existe/é íntegra antes de permitir nova adição | abertura da modal | 1 GET + 1 download + 1 decode sharp + ~3 leituras DB/storage; 118–121 ms warm (download 8 ms + sharp 17 ms) | em `delivered` a elegibilidade retorna antes de ler `source`; o DTO usa `addition.sourceOrigin` — nada muda para o cliente | **necessário apenas em eligible/refunded/processing/unknown; redundante em delivered** |
| 7 | Chips como `<a href>` (recarga completa) | `campaign-format-chips.tsx:494-498`; hrefs em `page.tsx:597-603` | URL como autoridade server-side; 1 toque seleciona; sem prefetch | chips 1:1/9:16 | navegação 2,08 s / 3,68 s; doc 11,5/33,2 MB | trocar por `<Link prefetch={false}>` preserva a autoridade server-side e o toque único, mas evita reparse/remontagem do documento inteiro; em produção o ganho tende a ser pequeno | **necessário como contrato; a recarga completa é escolha, otimização opcional de baixo impacto** |
| 8 | Leituras repetidas no probe vertical | `vertical-probe.ts:60-115` | ownership, linha, path, dimensão, MIME, origem, evidência | probe vertical | 2× access + 2× linha + 1 fonte + 1 evidência; ~10–20 ms | consolidar/paralelizar sem remover validações | **necessário; baixo impacto** |
| 9 | Assinaturas sequenciais preview+download | `page.tsx:141-148` | duas URLs assinadas do mesmo path | página 9:16 | 4–8 ms cada, sequenciais | `Promise.all` não altera garantia | **necessário; baixo impacto** |
| 10 | `additionRead` sequencial antes do bloco de formato | `page.tsx:171-195` | estado da adição para chips/DTO | página | 13 ms | poderia acompanhar a leitura da campanha | **necessário; baixo impacto** |
| 11 | Auth/layout repetidos por recarga | `requirePageUser`, `getCurrentStore`, `getUiRenderContext`, layout | sessão/loja/locale | toda navegação | não isolado | não medido | **inconclusivo** |

---

## 5. Separação entre custo de desenvolvimento e custo do fluxo

| Item | Dev (medido) | Produção local (medido) |
|---|---:|---:|
| Documento 1:1 | 11,5 MB | **13,9 KB comprimido / 54,1 KB decodificado** |
| Documento 9:16 | 33,2 MB | **14,0 KB comprimido / 54,7 KB decodificado** |
| `handle` 9:16 warm | 2,7–2,9 s | **294 ms** (nav) / **115 ms** (`fetch`) |
| Primeira abertura 9:16 | 5,0 s | **517 ms** (imagem visível aos ~400 ms) |
| Probes + downloads + assinaturas | ~60–80 ms | ~60–80 ms (componentes Node) |
| `GET format-additions` warm | 118–121 ms | **48–71 ms** (mediana 55 ms) |
| Clique→imagem 9:16 | 3.684 ms | **184–221 ms** (mediana 214 ms) |
| Clique→imagem 1:1 | 2.079–2.084 ms | **106–128 ms** (mediana 116 ms) |

> A estimativa anterior de ~145 KB era o HTML não comprimido. O documento real
> medido é ~54 KB decodificado / ~14 KB comprimido, tanto em 1:1 quanto em 9:16.
> A comparação completa está na seção 10.

---

## 6. Proposta mínima (para revisão — nada implementado)

### P0 — Validar produção antes de otimizar (obrigatório)

1. Parar o dev (porta 3001).
2. `next build` e `next start -p 3100` (sem dev concorrente usando `.next`).
3. Repetir as 4 alternâncias na mesma campanha e registrar: bytes do documento,
   `handle`, clique→imagem, imagem carregada.
4. Critério: se o documento de produção ficar ~145 KB e a alternância ficar abaixo
   de ~1 s, **não há otimização de fluxo a fazer** — o problema é exclusivamente
   dev.

### P1 — Não sondar/assinar o quadrado no caminho feliz do 9:16

- **Onde:** `page.tsx:455-495` e `page.tsx:573-596`.
- **O quê:** quando `?format=9:16` + adição `delivered`, resolver a vertical
  primeiro; se `integral`, pular o probe/assinatura 1:1; se a vertical falhar,
  executar o probe 1:1 como fallback (comportamento atual preservado).
- **Ganho:** remove 11,4 MB do documento em dev e ~25 ms no fluxo real; evita
  assinar uma URL que não é exibida.
- **Garantia preservada:** fallback para o quadrado quando a vertical não for
  comprovada; o probe vertical continua com todas as validações.

### P2 — Uma única transição após a entrega

- **Onde:** `client.tsx:168-172`.
- **O quê:** se a URL atual já é `/campanhas/:id?format=9:16`, chamar somente
  `router.refresh()`; caso contrário, somente `router.replace(...)`. Nunca os dois.
- **Ganho:** elimina uma renderização RSC completa (2,4 s em dev; ~100–200 ms em
  produção).
- **Garantia preservada:** o servidor ainda relê o estado persistido e renova a
  URL assinada.

### P3 — Não revalidar a fonte no `GET` quando a adição já está `delivered`

- **Onde:** `route.ts:340-345` (GET).
- **O quê:** se `read.kind === "found"` e `addition.state === "delivered"`, montar
  o DTO com `addition.sourceOrigin`, sem chamar `resolveAdditionSource`; manter a
  revalidação para `eligible/refunded/processing/unknown`.
- **Ganho:** ~50–80 ms por abertura da modal (download + sharp + DB/storage).
- **Garantia preservada:** `deriveFormatAdditionEligibility` já retorna
  `delivered` antes de ler `source` (`eligibility.ts:92-94`); nenhuma nova adição
  é autorizada nesse estado.

### P4 — Opcionais de baixo impacto (só depois do P0)

- `Promise.all` nas duas assinaturas (`page.tsx:141-148`) — 4–8 ms.
- Unir `additionRead` à leitura da campanha (`page.tsx:171-195`) — ~13 ms.
- Trocar `<a href>` por `<Link prefetch={false}>` nos chips — preserva a
  autoridade server-side, evita remontagem completa; ganho real só se o P0
  mostrar documento grande em produção.

### O que NÃO fazer

- Não remover `verifyJpeg1024`, `verifyCompositionArtifactBytes`,
  `verifyExpansionReuseEvidence`, checksum, dimensão, MIME, ownership,
  autorização, idempotência ou contabilidade.
- Não adicionar cache global, dependências, migrations ou flags.
- Não alterar banco/Storage nem gerar novamente (nenhuma geração paga).

---

## 7. Testes de regressão propostos

1. **Página — 9:16 feliz:** com adição `delivered` e `?format=9:16`, o probe 1:1
   **não** é chamado; `imageUrl` é a URL assinada da vertical; `newFlowFormat` é
   `9:16`; `downloadUrl` presente.
2. **Página — fallback 9:16:** com vertical `indeterminate/absent`, o probe 1:1
   **é** chamado e a página mantém a imagem quadrada (comportamento atual), sem
   prometer vertical.
3. **Página — 1:1 inalterado:** `?format=1:1` continua chamando o probe 1:1 e não
   chama a vertical.
4. **Cliente — entrega:** o handler pós-entrega dispara **exatamente uma**
   transição (`replace` quando a URL difere; `refresh` quando é igual) e a tela
   passa a exibir 9:16.
5. **API — GET delivered:** não chama `resolveReusableSquareSource`/download;
   resposta continua `{state:"delivered", sourceOrigin, costCredits:1}`.
6. **API — estados não-delivered:** `eligible`, `refunded`, `processing` e
   `unknown` continuam revalidando a fonte e mantendo tokens/checksums.
7. **Contrato de integridade:** suíte existente de `artifact-store`,
   `integrity`, `vertical-probe`, `retrieve` e `format-additions` permanece verde
   (nenhuma validação alterada).

---

## 8. Comparação antes/depois (plano)

| Métrica | Antes (dev, medido) | Depois P1–P3 (dev, esperado) | Produção medida (sem P1–P3) |
|---|---:|---:|---:|
| Doc 1:1 | 11.538.725 B | 11.538.725 B (inalterado) | 13.908 B comprimido / 54.056 B decodificado |
| Doc 9:16 | 33.234.372 B | **~21,8 MB** (−11,4 MB) | 14.001 B comprimido / 54.729 B decodificado |
| `handle` 9:16 warm | 2.692–2.913 ms | ~1,5–1,7 s (dev) | 294 ms (nav) / 115 ms (`fetch`) |
| Transições por entrega | 2 `_rsc` | 1 `_rsc` | não exercitado (sem nova entrega) |
| `GET` delivered warm | 118–121 ms | ~50–70 ms | 48–71 ms (mediana 55 ms) |
| Clique→imagem 9:16 | 3.684 ms | ~2,3–2,5 s (dev) | 184–221 ms (mediana 214 ms) |
| Clique→imagem 1:1 | 2.079–2.084 ms | ~1,3–1,5 s (dev) | 106–128 ms (mediana 116 ms) |

O “depois” de produção **foi medido** (seção 10); P1–P3 não foram implementados.

---

## 9. Estado da investigação

- Nenhum arquivo de produto alterado; nenhuma otimização implementada.
- Scripts de diagnóstico em `.f62-check/` (não rastreado) e em
  `%TEMP%\opencode\f62-browser\` (fora do repositório).
- Working tree no commit `783a5ce4`.
- **Parada para revisão:** aprovar (ou não) P0–P3 antes de qualquer edição.

---

## 10. Comparação em produção local (medida em 2026-11-24)

### 10.1 Ambiente

- Dev encerrado: portas **3000 e 3001 fechadas**, nenhum processo `next dev`.
- `npm run build` concluído com sucesso (Next.js 15.5.18; `/campanhas/[id]`
  15,6 kB, First Load JS 124 kB).
- `next start -p 3100`: **Ready in 990 ms**; única instância ativa.
- Mesma campanha e mesma sessão autenticada; nenhuma geração, confirmação paga,
  migration, alteração de banco ou configuração.

### 10.2 Primeira abertura (9:16, após o build)

| Métrica | Valor |
|---|---:|
| `navigation.duration` | 517,1 ms |
| `domContentLoadedEventEnd` | 385,2 ms |
| `responseStart` / `responseEnd` | 271,6 / 382,2 ms |
| `loadEventEnd` | 517,1 ms |
| imagem (responseEnd) | **400,3 ms** |
| documento — transfer / encoded / decoded | 14.305 / 14.005 / **54.729 B** |
| imagem | 1080×1920, `complete=true` |
| chip ativo | `Vertical 9:16: Disponível, Selecionado` |

A primeira abertura inclui o primeiro render da rota no processo de produção;
as navegações seguintes ficaram em ~294 ms de navegação e ~214 ms até a imagem.

### 10.3 Alternâncias aquecidas (5 por direção)

| Direção | n | Clique→imagem mediana / máx | Clique→load mediana / máx | Nav mediana / máx | Imagem (responseEnd) mediana / máx | Documento (transfer / encoded / decoded) |
|---|---:|---:|---:|---:|---:|---:|
| 1:1 → 9:16 | 6* | **214 / 221 ms** | 296 / 305 ms | 294 / 304 ms | 212 / 219 ms | 14.301–14.306 / 14.001–14.006 / **54.729 B** |
| 9:16 → 1:1 | 5 | **116 / 128 ms** | 208 / 214 ms | 207 / 213 ms | 115 / 127 ms | 14.208–14.211 / 13.908–13.911 / **54.056 B** |

\* 5 medições obrigatórias + 1 extra. Uma medição 9:16→1:1 (p4) foi descartada
por falha de foco no clique e repetida como p12; nenhum valor inválido entrou nas
estatísticas.

`fetch(location.href, {cache:"no-store"})` aquecido (documento completo):

| Formato | Tempo | Corpo decodificado |
|---|---:|---:|
| 1:1 | 69 ms | 53.874 B |
| 9:16 | 115 ms | 54.547 B |

Todas as 11 navegações válidas terminaram com a imagem correta
(1080×1920 em 9:16; 1024×1024 em 1:1) e o chip correspondente com
`aria-current="true"`.

### 10.4 Imagem, chips e download

| Item | 1:1 | 9:16 |
|---|---|---|
| Imagem exibida | 1024×1024, `complete=true` | 1080×1920, `complete=true` |
| Chip ativo | `Quadrado 1:1: Disponível, Selecionado` | `Vertical 9:16: Disponível, Selecionado` |
| URL de download | bucket `campaign-images` | bucket `campaign-internal-artifacts` |
| Download real | HTTP 200, `image/jpeg`, **178.723 B** | HTTP 200, `image/jpeg`, **309.682 B** |
| SHA-256 | — | `843cee9927c8b5a89c4e7d7cb419fa6b8b805adb72ed08e7a1c9611894556b07` |

O SHA-256 do arquivo vertical baixado em produção é **idêntico** ao artefato
entregue da F62.

`GET /api/campaign/:id/format-additions` (somente leitura, 3 chamadas):
**71 / 55 / 48 ms**, resposta de 67 B:
`{"state":"delivered","sourceOrigin":"new_flow_1_1","costCredits":1}`.

### 10.5 Leitura dos resultados

- O documento de produção é **~54 KB decodificado / ~14 KB comprimido**, contra
  11,5 MB (1:1) e 33,2 MB (9:16) no dev — confirma que os Buffers de debug do
  React não existem em produção.
- Clique→imagem: **3.684 → 214 ms** no 9:16 e **2.079 → 116 ms** no 1:1
  (12–17× mais rápido). O 9:16 continua ~100 ms mais caro que o 1:1, coerente
  com o probe/download/decode vertical (~44 + ~21 ms) e o documento ligeiramente
  maior.
- O P3 (revalidação da fonte no GET `delivered`) tem teto de ~50 ms em produção;
  o ganho real é pequeno. O P2 (dupla transição) não foi exercitado nesta
  medição, pois nenhuma nova entrega foi feita.
- **P1–P3 não são justificados pelo problema medido**: a lentidão de 2–3,7 s era
  custo exclusivo do modo desenvolvimento. Permanecem como otimizações opcionais
  de baixo impacto, a decidir após revisão.

### 10.6 Estado final

- Apenas **3100** ativa; 3000/3001 fechadas e sem processo de dev.
- Página deixada em **9:16** (vertical 1080×1920) para o teste manual.
- Nenhum código alterado, nenhuma geração paga, nenhuma alteração de banco,
  Storage ou configuração.
