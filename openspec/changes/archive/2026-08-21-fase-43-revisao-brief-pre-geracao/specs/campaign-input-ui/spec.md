# Campaign Input UI

## Purpose

Delta F43 (D2/D3/D4): o formulário de campanha deixa de disparar o POST diretamente — o botão "Criar Campanha" vira **"Revisar e gerar"**, o submit passa pela **tela de revisão do brief** (nova capability `campaign-brief-review`, `reviewMode` no hook) e a confirmação monta o body via `buildCampaignGenerationBody` com `inputValidationOverride.productImageCheck: "brief_review_confirmed"`. O body derivado é **idêntico ao exibido na revisão** (validade, aviso ilustrativo, texto obrigatório, intent, badge, preços, imagens normalizadas).

> **Propósito**: Esta spec define a interface visual para input de produto + oferta (Campaign Input UI), consumindo os dados de identidade da loja já cadastrados e preparando os dados para futura geração de campanha.
>
> > **Propósito**: Esta spec define a interface visual para input de produto + oferta (Campaign Input UI), consumindo os dados de identidade da loja já cadastrados e preparando os dados para futura geração de campanha.
> >
> > > Synced from `fase-18-app-shell-ui-base-rotas` (MODIFIED). Route migrated from `/` to `/campanhas/nova`. No-store redirect updated to `/loja`. Links updated to new route paths. Design tokens applied.
> > > Modified by `fase-27-conta-saldo-extrato` (MODIFIED). Added credit balance indicator, generate button disable/tooltip when zero credits, and error state with reload action.
> > > Modified by `fase-31-1-modelo-comercial-formulario` (MODIFIED). Added campaign intent selector, conditional badge by intent, preserveImageContext checkbox, and intent-conditional validation.
> > Modified by `fase-34-store-readiness` (MODIFIED + ADDED). Added readiness guard after store-exists check; redirect based on missing readiness item.
> > Modified by `fase-38-credit-operation-costs` (MODIFIED). Cost display is dynamic (`Custo: {cost}` via `useOperationCosts`); submit disabled when `balance < costCredits`, operation disabled, or cost unavailable (503) — without presumed "1 crédito".
> > Modified by `fase-40-campos-comerciais-avisos-brief` (D2/D3/D4/D8): o formulário ganha o agrupamento Produto / Oferta / Avisos e texto obrigatório, o checkbox "Exibir 'Imagem meramente ilustrativa'" (default marcado) coexistindo com o textarea livre, e a seção "Validade da oferta" (6 modos, visível apenas para `offer`). O body do submit passa a incluir `validity` (antes nunca enviado) e `mandatoryArtworkText` concatenado (checkbox + texto livre). A Descrição existente (`product.description`) permanece inalterada — nenhum campo adormecido ganha UI (D8).
> > Modified by `fase-41-midia-de-campanha-mobile` (D2/D3/D4/D10): o campo de imagem evolui de 1 arquivo para **primary obrigatória + até `MAX_CAMPAIGN_IMAGES - 1` auxiliares opcionais** (role interna `reference`) via **galeria + câmera** (`capture="environment"`, HEIC via canvas, EXIF respeitado, preview grid, remoção por item). O body do submit passa a enviar `productImages[]` (com auxiliares) ou `productImageDataUrl` (legado, sem auxiliares) — **nunca ambos**.
> > Modified by `fase-43-revisao-brief-pre-geracao` (D2/D3/D4): o submit passa pela **tela de revisão do brief** — botão "Criar Campanha" → **"Revisar e gerar"**; `reviewMode` no hook; body via `buildCampaignGenerationBody` (mesmos derivados exibidos); confirmação envia `inputValidationOverride.productImageCheck: "brief_review_confirmed"`.

## MODIFIED Requirements

### Requirement: Submit triggers API generation

O submit do formulário SHALL montar o body incluindo os campos novos (D3/D4) e, **na F43, passar obrigatoriamente pela revisão do brief (D2)**:

- O clique no botão principal dispara **"Revisar e gerar"** (entra em `reviewMode`), que roda `prepareCampaignImages` (D3) e exibe a tela de revisão (`campaign-brief-review`).
- "Confirmar e gerar campanha" monta o body via **`buildCampaignGenerationBody(fields, preparedImages, storeId, { inputValidationOverride: { productImageCheck: "brief_review_confirmed" } })`** (D4) e dispara o fluxo real de geração.
- O body SHALL conter:
  - `validity: <displayText>` — presente apenas quando `campaignIntent === "offer"` e validade habilitada; ausente caso contrário (troca de intent não envia `validity`, mas preserva o rascunho no form state)
  - `mandatoryArtworkText: <texto final concatenado>` — checkbox marcado + texto livre → `"Imagem meramente ilustrativa\n<texto>"`; checkbox marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`; checkbox desmarcado + texto → só o texto; checkbox desmarcado + sem texto → campo ausente
  - **Imagens (F41 D2/D3):**
    - **Com auxiliares** → `body.productImages = preparedImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl }))` — **sem `id` do cliente** (a rota gera/normaliza — D2/D5)
    - **Sem auxiliares** (apenas primary) → `body.productImageDataUrl = <dataUrl da primary>` (caminho legado — compat)
  - `inputValidationOverride.productImageCheck: "brief_review_confirmed"` — **F43 D5**, presente no caminho confirmado
- Demais campos inalterados: `storeId`, `productName`, `originalPriceCents`, `discountedPriceCents`, `description`, `badgeText`, `campaignIntent`, `preserveImageContext` (condicional)
- **O submit deixa de re-comprimir** — as imagens já foram preparadas na entrada da revisão (D3).

> Modified by `fase-40-campos-comerciais-avisos-brief` (D3/D4): o body ganha `validity` e a normalização do `mandatoryArtworkText` (concatenação). Sem mudança de contrato HTTP — `GenerateImageRequestSchema` já aceita `validity`/`mandatoryArtworkText`. Modified by `fase-41-midia-de-campanha-mobile` (D2/D3): o body passa a enviar `productImages[]` (com auxiliares) ou `productImageDataUrl` (legado — sem auxiliares); nunca ambos. Modified by `fase-43-revisao-brief-pre-geracao` (D2/D4/D5): submit via `buildCampaignGenerationBody` (revisão → confirmação); `brief_review_confirmed` no caminho confirmado.

#### Scenario: Body envia validity e mandatoryArtworkText concatenado

- **WHEN** `campaignIntent === "offer"`, checkbox marcado, textarea com "Consulte condições na loja." e validade "até 30/09"
- **THEN** o body contém `validity: "até 30/09"`
- **AND** `mandatoryArtworkText: "Imagem meramente ilustrativa\nConsulte condições na loja."`

#### Scenario: Body com productImages quando há auxiliares (D2/D3)

- **WHEN** o usuário adiciona 1 primary + 2 auxiliares e confirma a geração
- **THEN** o body contém `productImages` com 3 itens `{ role, source, mimeType, dataUrl }`
- **AND** nenhum item contém `id` de cliente
- **AND** o body NÃO contém `productImageDataUrl`

#### Scenario: Body legado sem auxiliares (D2)

- **WHEN** o usuário adiciona apenas a imagem primary e confirma a geração
- **THEN** o body contém `productImageDataUrl` (caminho legado — compat total)
- **AND** o body NÃO contém `productImages`

#### Scenario: Body sem validity quando intent ≠ offer

- **WHEN** o usuário preenche validade em `offer` e troca para `spotlight`
- **THEN** o body **não contém** `validity`
- **AND** o form state preserva a validade preenchida (voltar a `offer` restaura)

#### Scenario: Body sem mandatoryArtworkText quando desmarcado e sem texto

- **WHEN** o checkbox está desmarcado e o textarea está vazio
- **THEN** o body **não contém** `mandatoryArtworkText` (campo ausente → `legalNotice.enabled=false` → nada na arte)

#### Scenario: Form state preserva campos separados no autosave/restore

- **WHEN** um rascunho com "checkbox marcado + texto livre" é salvo e o form é recarregado
- **THEN** o form state preserva os campos separados (`showIllustrativeNotice` e `mandatoryArtworkTextFree`)

#### Scenario: Confirmar envia brief_review_confirmed (F43 D5)

- **WHEN** o usuário clica "Confirmar e gerar campanha" na tela de revisão
- **THEN** o body montado via `buildCampaignGenerationBody` carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"`

#### Scenario: Submit não re-comprime (imagens já preparadas — F43 D3)

- **WHEN** o usuário confirma a geração após a revisão
- **THEN** as imagens já comprimidas da revisão (`preparedImages`) são usadas diretamente no body
- **AND** o submit não roda `compressImage` novamente

## ADDED Requirements

### Requirement: Botão principal vira "Revisar e gerar" (F43 D2)

O botão principal do formulário de campanha SHALL exibir **"Revisar e gerar"** (substituindo "Criar Campanha") e, ao ser clicado com o formulário válido, SHALL entrar em `reviewMode` (exibir a tela de revisão do brief) em vez de disparar o POST. Com o formulário inválido, SHALL manter o comportamento atual (erros de validação exibidos, sem abrir a revisão).

- O custo/saldo no form permanece: "Saldo: X · Custo: Y" e `submitDisabled` por custo indisponível/desativado/saldo insuficiente (F38) — agora bloqueando a **entrada na revisão**.
- Sem imagens utilizáveis → "Revisar e gerar" não abre a revisão (mensagem de imagem obrigatória).

#### Scenario: Botão exibe "Revisar e gerar"

- **WHEN** o formulário é renderizado
- **THEN** o botão principal exibe "Revisar e gerar" (não "Criar Campanha")

#### Scenario: Custo off/indisponível/saldo insuficiente bloqueia a entrada na revisão

- **WHEN** custo desativado/indisponível ou saldo insuficiente
- **THEN** o botão "Revisar e gerar" fica bloqueado (mesma lógica `submitDisabled` do form)
- **AND** a revisão não abre