# F48.2.2 — Spike bloqueante de modelos/presets (Checkpoint 1)

> Artefato de decisão do **CHECKPOINT 1** (D7): confirmação de ID, protocolo/endpoints,
> edição com referências, qualidades, formato/tamanho, limites de entrada,
> disponibilidade, estrutura de `usage` e regra de pricing dos modelos candidatos
> (`gpt-image-2` e `gpt-image-2.5-flare`) **antes** de qualquer preset ser habilitado
> para geração.
>
> **Nenhuma chamada paga foi executada para produzir este artefato.** Toda evidência
> vem de documentação oficial (URL) ou do repositório (`file:line`). Nenhuma chave,
> token ou URL com credencial é registrada aqui.

## Método

- **Documentação oficial:** páginas oficiais da API de imagens (páginas de modelo,
  referências de `POST /images/generations` e `POST /images/edits`, guia de geração de
  imagens, seção de `usage` e página de pricing).
- **Evidência do repositório:** código atual (`file:line`).
- **Sem chamada paga:** o **contrato público** de ambos os candidatos é confirmado pela
  documentação oficial; a **disponibilidade específica da conta de desenvolvimento**
  permanece pendente (`account_availability_pending`) e será comprovada no **UAT
  autorizado** (plano 08). Nenhuma chamada autenticada/paga é executada neste spike.

### Fontes de documentação oficial

- Página do modelo `gpt-image-2.5-flare`: `https://developers.openai.com/api/docs/models/gpt-image-2.5-flare`
- Guia de geração de imagens: `https://developers.openai.com/api/docs/guides/image-generation`
- Página de pricing (suite): `https://developers.openai.com/api/docs/pricing?tab=suite`
- Referência `POST /images/edits`: `https://developers.openai.com/api/reference/resources/images/methods/edit`
- Referência `POST /images/generations`: `https://developers.openai.com/api/reference/resources/images/methods/generate`
- Referência da API de imagens: `https://platform.openai.com/docs/api-reference/images/create`
- Uso de imagens (organização): `https://platform.openai.com/docs/api-reference/usage/images`

---

## Candidato A — `gpt-image-2`

| Campo | Valor | Fonte da evidência |
|---|---|---|
| ID exato | `gpt-image-2` | Documentação oficial (`images.generate`/`images.edit` listam `gpt-image-2`); repositório `src/lib/ai/model-registry.ts:34` |
| Provider | `openai` | Repositório `src/lib/ai/model-registry.ts:30`; documentação oficial |
| Protocolo/endpoints | `images` → `POST /images/edits` (edição com referências) e `POST /images/generations` | Repositório `src/lib/ai/model-registry.ts:34` (`"gpt-image-2": ["images"]`); documentação oficial das referências de imagens |
| Edição com referências | Sim — `images.edit` aceita uma ou mais imagens (até 16), cada uma `png`/`webp`/`jpg` com menos de 50MB | Documentação oficial da referência `POST /images/edits` |
| Qualidades suportadas | `low`, `medium`, `high`, `auto` (GPT image models) | Documentação oficial (`quality` nas referências e nos eventos de edição) |
| Formato/tamanho | `1024x1024`, `1536x1024`, `1024x1536`; `gpt-image-2` também aceita resoluções arbitrárias `WIDTHxHEIGHT` (divisíveis por 16; proporção entre 1:3 e 3:1; máximo 3840x2160) | Documentação oficial da referência `POST /images/generations` |
| Limites de entrada | `prompt` de até 32000 caracteres; até 16 imagens de referência; cada imagem < 50MB | Documentação oficial das referências de `generate`/`edit` |
| Disponibilidade da conta | Modelo documentado; uso dos GPT Image models pode exigir **API Organization Verification**. Disponibilidade específica da conta de desenvolvimento **pendente** (`account_availability_pending`), a comprovar no UAT autorizado (sem chamada autenticada neste spike) | Documentação oficial do guia de geração de imagens; pendência registrada para o UAT |
| Estrutura de `usage` | Objeto com `input_tokens`, `input_tokens_details`, `output_tokens`, `total_tokens` (GPT image models) | Documentação oficial (eventos de edição/geração e seção de `usage`) |
| Regra de pricing | **Modo `token_based`**: cobrança por tokens de imagem (entrada/saída), variando com qualidade e tamanho; o custo por imagem é derivado do `usage`. Pricing público publicado (ver seção "Pricing público") | Documentação oficial (guia de geração de imagens + `usage` + página de pricing) |

**Observação de repositório:** o caminho produtivo `images` (`src/lib/ai/adapters/images.ts:49-58`) **ignora `quality`** — a bancada usa um adapter dedicado que propaga `quality` (D8). O caminho `responses` (`src/lib/ai/adapters/responses.ts:40-61`) já propaga `quality` e serve de referência.

---

## Candidato B — `gpt-image-2.5-flare`

| Campo | Valor | Fonte da evidência |
|---|---|---|
| ID exato | `gpt-image-2.5-flare` — **ID válido confirmado** | Documentação oficial — página do modelo `https://developers.openai.com/api/docs/models/gpt-image-2.5-flare`; ausente do código produtivo (esperado: a `BENCH_MODEL_ALLOWLIST` isola modelos experimentais) |
| Provider | `openai` | Documentação oficial (namespace `gpt-image-*`); allowlist própria da bancada `BENCH_MODEL_ALLOWLIST` |
| Protocolo/endpoints | `images` → `POST /v1/images/edits` (edição com referências) e `POST /v1/images/generations`; utilizável **diretamente pela Image API** | Documentação oficial (página do modelo + guia de geração de imagens) |
| Edição com referências | Sim — aceita **texto e imagens** e suporta `POST /v1/images/edits` | Documentação oficial (página do modelo + guia) |
| Qualidades suportadas | `low`, `medium`, `high`, `xhigh`, `max`, `auto` | Documentação oficial (página do modelo + guia) |
| Formato/tamanho | Documentado na página oficial do modelo (família GPT Image; ver candidato A para os formatos padrão) | Documentação oficial (página do modelo) |
| Limites de entrada | Documentado na página oficial do modelo (entrada de texto + imagens) | Documentação oficial (página do modelo) |
| Disponibilidade da conta | `account_availability_pending` — contrato público confirmado; disponibilidade específica da conta de desenvolvimento a comprovar no **UAT autorizado** (plano 08), sem chamada paga neste spike | Documentação oficial + pendência registrada para o UAT |
| Estrutura de `usage` | Token-based (família GPT Image) | Documentação oficial (guia de geração + seção de `usage`) |
| Regra de pricing | **`token_based`** com **pricing público publicado** (ver seção "Pricing público") | Documentação oficial (página de pricing) |

**Evidência de repositório:** `gpt-image-2.5-flare` **não existe** no código produtivo (`src/lib/ai/model-registry.ts`, `MODEL_ALLOWLIST` linhas 29-40) — o que **não** impede seu uso na bancada: a allowlist própria `BENCH_MODEL_ALLOWLIST` foi criada exatamente para isolar modelos experimentais sem tocar a produção. O ID consta como candidato no roadmap/base OpenSpec da F48.2.2.

---

## Pricing público (documentação oficial)

Consulta em **2026-09-28** à página oficial de pricing
(`https://developers.openai.com/api/docs/pricing?tab=suite`) e ao guia de geração de
imagens (`https://developers.openai.com/api/docs/guides/image-generation`). Nenhuma
chamada paga foi executada.

> **Atualização F48.2.4 (correção cirúrgica, 2026-09-30):** o pricing oficial foi
> revisado. Os valores vigentes (Standard, por 1M tokens) passam a ser **texto US$5 /
> imagem de entrada US$8 / imagem de saída US$30** para os três modelos, sob a regra
> `2026-09-bench-2`. A tabela abaixo reflete os valores vigentes.

| Modelo | Entrada (texto) | Entrada (imagem) | Saída (imagem) |
|---|---|---|---|
| `gpt-image-2` | US$5,00/M tokens | US$8,00/M tokens | US$30,00/M tokens |
| `gpt-image-2.5-flare` | US$5,00/M tokens | US$8,00/M tokens | US$30,00/M tokens |
| `gpt-image-2.5-sunburst` | US$5,00/M tokens | US$8,00/M tokens | US$30,00/M tokens |

**Referência de custo por peça (1:1, somente saída):**

- `gpt-image-2`: a estimativa anterior (~US$0,006 `low` / ~US$0,053 `medium`) foi
  **derivada da tarifa antiga** (US$15/M) e **não** é reaproveitada sob a nova tarifa
  (dobraria o valor). Sem valor comprovado sob a regra vigente, a cobertura é
  `partial` e a estimativa é **parcial/indisponível**.
- `gpt-image-2.5-flare`: `low` com **196 tokens de saída** e ~US$0,00588 (calculador
  oficial; a tarifa de US$30/M é inalterada); `medium` **sem referência por peça
  publicada** — a estimativa fica **ausente**.
- `gpt-image-2.5-sunburst`: **sem** valor comprovado ⇒ estimativa **ausente**
  (cobertura `partial`).

Entradas de texto e de imagem são **adicionais**. O **cache** de input só se aplica à
Responses API e **não** é simulado no caminho direto `Images`.

> O pricing efetivo é **calculado em código** (`bench-pricing.ts`, plano 04), chaveado
> pelo preset completo (`provider+model+protocol+quality+size`); não há tabela de
> pricing no banco.

---

## Decisão

Decisão do spike por candidato (baseada em documentação oficial + evidência do repositório, **sem chamada paga**):

| Candidato | Decisão | Motivo |
|---|---|---|
| `gpt-image-2` | **confirmado** | ID, provider e protocolo `images` confirmados pela documentação oficial **e** pelo repositório (`src/lib/ai/model-registry.ts:34`); `POST /images/edits` aceita referências (até 16 imagens), qualidades `low`/`medium`/`high`/`auto`, tamanhos padrão e resolução arbitrária; `usage` token-based e pricing público documentado. **Pendência não bloqueante:** disponibilidade específica da conta (`account_availability_pending`), a comprovar no UAT autorizado. |
| `gpt-image-2.5-flare` | **confirmado (pela documentação)** | A documentação oficial confirma: ID válido, aceita **texto e imagens**, suporta `POST /v1/images/edits`, utilizável diretamente pela Image API, qualidades `low`/`medium`/`high`/`xhigh`/`max`/`auto` e pricing público publicado. A **ausência no `MODEL_ALLOWLIST` produtivo não é impedimento** — a `BENCH_MODEL_ALLOWLIST` isola modelos experimentais. **Pendência não bloqueante:** disponibilidade específica da conta (`account_availability_pending`), a comprovar no **UAT autorizado** (plano 08). |
| `gpt-image-2.5-sunburst` | **confirmado (pela documentação — F48.2.4)** | Documentação oficial confirma: ID válido, geração/edição com **texto e imagens** (Images API e Responses), qualidades `low`/`medium`/`high`/`xhigh`/`max`/`auto`, saída token-based e pricing público publicado (texto US$5 / imagem entrada US$8 / saída US$30 por 1M tokens). Adicionado **somente** ao caminho isolado da bancada (allowlist própria + catálogo local); **não** promovido. **Pendência não bloqueante:** disponibilidade específica da conta (`account_availability_pending`), a comprovar no **UAT autorizado**. |

### Presets propostos para habilitação no CHECKPOINT 2

Os quatro presets do caminho direto `images` (ambos os modelos confirmados pela documentação oficial) ficam **propostos** para habilitação, mas **permanecem desabilitados** (`reason: "spike_pendente"`) até a aprovação do **CHECKPOINT 2** (plano 04):

- `gpt-image-2-low`
- `gpt-image-2-medium`
- `gpt-image-2.5-flare-low`
- `gpt-image-2.5-flare-medium`

> A habilitação efetiva ocorre no plano 04, após a aprovação humana do CHECKPOINT 2.
> Nenhum preset está habilitado por este plano, e nenhuma geração paga foi executada.

### Autorização de chamada paga controlada

**Nenhuma chamada paga foi executada e nenhuma está autorizada neste momento.** O
contrato público de ambos os candidatos já está confirmado pela documentação oficial,
de modo que **não é necessária** chamada paga no CHECKPOINT 1. A disponibilidade real da
conta será comprovada no **UAT autorizado** (plano 08), sob autorização humana explícita
e geração real controlada.

---

## Epílogo (pós-UAT) — estado final da F48.2.2

> Registro do desfecho dos checkpoints posteriores a este spike. As seções acima
> descrevem o estado **no momento do CHECKPOINT 1** e são preservadas como histórico.

- **CHECKPOINT 2 (aprovação dos presets habilitados):** os **quatro** presets do
  caminho direto `images` foram habilitados após aprovação humana:
  `gpt-image-2-low`, `gpt-image-2-medium`, `gpt-image-2.5-flare-low` e
  `gpt-image-2.5-flare-medium` (`preset-registry.ts`, `enabled: true`). O caminho
  `responses` permanece **desabilitado com motivo** (`protocolo_nao_confirmado`),
  pois nenhum modelo confirmado o exigiu.
- **UAT local (CHECKPOINT 3):** uma geração real controlada com
  `gpt-image-2.5-flare` (`quality: low`, `protocol: images`) concluiu com
  `succeeded`, confirmando na prática a disponibilidade da conta e o contrato do
  modelo. O modo de cobrança observado foi `token_based` com `usage` reportado.
- **Pendência resolvida:** a disponibilidade específica da conta
  (`account_availability_pending`) foi **comprovada** no UAT autorizado.
- Detalhes em `.planning/phases/48.2.2-fundacao-bancada-geracao/48.2.2-UAT.md` e
  `48-2-2-VERIFICATION.md`.
