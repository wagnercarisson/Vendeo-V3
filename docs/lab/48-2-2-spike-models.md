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

- **Documentação oficial:** páginas oficiais da API de imagens (referências de
  `POST /images/generations` e `POST /images/edits`, guia de geração de imagens e
  seção de `usage`).
- **Evidência do repositório:** código atual (`file:line`).
- **Sem chamada paga:** a disponibilidade específica da conta de desenvolvimento e os
  valores exatos de pricing ficam pendentes de verificação humana no CHECKPOINT 1
  (`user_setup` do plano 01); não são confirmados por chamada autenticada aqui.

### Fontes de documentação oficial

- Guia de geração de imagens: `https://developers.openai.com/api/docs/guides/image-generation`
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
| Disponibilidade da conta | Modelo documentado; uso dos GPT Image models pode exigir **API Organization Verification**. Disponibilidade específica da conta de desenvolvimento **pendente de verificação humana** (sem chamada autenticada neste spike) | Documentação oficial do guia de geração de imagens; pendência registrada para o CHECKPOINT 1 |
| Estrutura de `usage` | Objeto com `input_tokens`, `input_tokens_details`, `output_tokens`, `total_tokens` (GPT image models) | Documentação oficial (eventos de edição/geração e seção de `usage`) |
| Regra de pricing | **Modo `token_based`**: cobrança por tokens de imagem (entrada/saída), variando com qualidade e tamanho; o custo por imagem é derivado do `usage`. Valores unitários exatos devem ser consultados na página de pricing | Documentação oficial (guia de geração de imagens + `usage`); página de pricing `https://platform.openai.com/docs/pricing` |

**Observação de repositório:** o caminho produtivo `images` (`src/lib/ai/adapters/images.ts:49-58`) **ignora `quality`** — a bancada usa um adapter dedicado que propaga `quality` (D8). O caminho `responses` (`src/lib/ai/adapters/responses.ts:40-61`) já propaga `quality` e serve de referência.

---

## Candidato B — `gpt-image-2.5-flare`

| Campo | Valor | Fonte da evidência |
|---|---|---|
| ID exato | `gpt-image-2.5-flare` | O ID aparece no **guia** de geração de imagens (`developers.openai.com`); **não consta** do código do repositório (só no roadmap). A referência de `POST /images/edits` **não** o lista entre os modelos suportados |
| Provider | `openai` (presumido pelo namespace `gpt-image-*`) | Sem evidência direta de contrato no repositório; presumido pela documentação |
| Protocolo/endpoints | Indeterminado — o guia sugere o caminho `images`, mas a referência do endpoint de edição não o lista | Documentação oficial inconsistente entre o guia e a referência de `POST /images/edits` |
| Edição com referências | **Não confirmado** — o ID não consta da lista de modelos suportados por `images.edit` | Documentação oficial da referência `POST /images/edits` |
| Qualidades suportadas | Não confirmado especificamente para este ID | Documentação oficial (não específica ao ID) |
| Formato/tamanho | Não confirmado especificamente para este ID | Documentação oficial (não específica ao ID) |
| Limites de entrada | Não confirmado especificamente para este ID | Documentação oficial (não específica ao ID) |
| Disponibilidade da conta | Não verificável sem chamada autenticada; ID ausente do código/repositório | Repositório (ausência em `src/lib/ai/model-registry.ts`) |
| Estrutura de `usage` | Não confirmada especificamente para este ID | Documentação oficial (não específica ao ID) |
| Regra de pricing | Não confirmada especificamente para este ID | Documentação oficial (não específica ao ID) |

**Evidência de repositório:** `gpt-image-2.5-flare` **não existe** no código — não aparece em `src/lib/ai/model-registry.ts` (`MODEL_ALLOWLIST`, linhas 29-40). O ID consta apenas como candidato no roadmap/base OpenSpec da F48.2.2.

---

## Decisão

Decisão do spike por candidato (baseada exclusivamente em documentação oficial + evidência do repositório, **sem chamada paga**):

| Candidato | Decisão | Motivo |
|---|---|---|
| `gpt-image-2` | **confirmado** | ID, provider e protocolo `images` confirmados pela documentação oficial **e** pelo repositório (`src/lib/ai/model-registry.ts:34`); o endpoint `POST /images/edits` aceita referências (até 16 imagens), qualidades `low`/`medium`/`high`/`auto`, tamanhos padrão e resolução arbitrária; a estrutura de `usage` é token-based e a regra de pricing é `token_based`. **Pendência não bloqueante:** disponibilidade específica da conta de desenvolvimento e valores exatos de pricing devem ser confirmados pelo humano no CHECKPOINT 1 (ver `user_setup`), sem chamada paga automática. |
| `gpt-image-2.5-flare` | **não confirmado** | A documentação oficial é inconsistente (o guia cita o ID, mas a referência de `POST /images/edits` — o caminho necessário à bancada, com referências — não o lista entre os modelos suportados) e o ID **não consta do código/repositório** (só no roadmap). Protocolo, qualidades, tamanho, limites, `usage` e pricing **não** são confirmáveis para este ID sem verificação humana/uso controlado. Permanece **desabilitado** com motivo (`modelo_nao_confirmado`), salvo autorização humana explícita para uma chamada paga controlada no CHECKPOINT 1. |

### Presets recomendados para o primeiro recorte (caminho direto confirmado)

Apenas o **caminho direto confirmado** (protocolo `images`) é habilitável. Com a decisão acima, os presets a habilitar são:

- `gpt-image-2-low`
- `gpt-image-2-medium`

Os presets abaixo **permanecem desabilitados** com motivo (`modelo_nao_confirmado`):

- `gpt-image-2.5-flare-low`
- `gpt-image-2.5-flare-medium`

> A habilitação efetiva ocorre no plano 04, após a aprovação humana do CHECKPOINT 1.
> Nenhum preset está habilitado por este plano, e nenhuma geração paga foi executada.

### Autorização de chamada paga controlada

Nenhuma chamada paga foi executada. Caso o humano entenda que a confirmação de
`gpt-image-2.5-flare` (ou dos valores exatos de pricing) exija uma **chamada paga
controlada**, ela só ocorrerá mediante **autorização humana explícita** registrada no
CHECKPOINT 1; sem essa autorização, o preset permanece desabilitado com motivo.
