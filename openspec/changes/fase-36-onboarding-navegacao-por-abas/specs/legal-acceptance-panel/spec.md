## ADDED Requirements

### Requirement: Coluna lateral global de aceite legal

O sistema SHALL prover o componente `legal-acceptance-panel.tsx` (`src/components/flow/legal-acceptance-panel.tsx`) que exibe o aceite legal como **coluna lateral global** na página `/loja`, visível em todas as abas (D3) — condição do estado da loja, não campo do formulário.

O componente SHALL:
- Expor o enum **único** `LegalAcceptanceState = "pending" | "accepted" | "needs_reacceptance"`, usado em todo o fluxo
- Receber props `{ acceptance: LegalAcceptanceState; onOpenModal: () => void; variant: "desktop-sticky-column" | "mobile-compact" }`
- **Desktop**: coluna lateral **sticky dentro do conteúdo** (participa do grid/layout, não sobrepõe; acompanha o scroll, não sai de tela)
- **Mobile**: bloco **compacto** no topo da aba ou antes do CTA — **sem sticky persistente** (não roubar espaço em tela pequena)
- Estados visíveis: `Pendente` / `Aceito` / `Reaceite necessário`
- CTA "Revisar e aceitar" (pendente) / "Revisar e aceitar" (reaceite) → abre o `ContractAcceptanceModal` da F30 via `onOpenModal`
- Estados expostos via `aria-label` e `aria-pressed`/`aria-expanded` no acionador (D11)

A derivação do estado SHALL vir do `legalClearance` da F30: `getAcceptanceStatus`/`legal-status` com `current` → `accepted`, `outdated` → `needs_reacceptance`, ausente → `pending`.

#### Scenario: Estado pendente mostra Pendente + CTA

- **WHEN** `LegalAcceptancePanel` recebe `acceptance="pending"`
- **THEN** o painel exibe "Pendente"
- **AND** um CTA "Revisar e aceitar" é exibido

#### Scenario: Estado aceito mostra Aceito sem CTA de aceite

- **WHEN** `LegalAcceptancePanel` recebe `acceptance="accepted"`
- **THEN** o painel exibe "Aceito"
- **AND** nenhum CTA de aceite é exibido

#### Scenario: Estado reaceite necessário mostra Reaceite + CTA

- **WHEN** `LegalAcceptancePanel` recebe `acceptance="needs_reacceptance"`
- **THEN** o painel exibe "Reaceite necessário"
- **AND** um CTA de re-aceite é exibido

#### Scenario: Desktop usa coluna sticky no conteúdo

- **WHEN** `variant="desktop-sticky-column"`
- **THEN** o painel participa do grid como coluna sticky dentro do conteúdo
- **AND** não é um card fixo sobreposto

#### Scenario: Mobile usa bloco compacto sem sticky

- **WHEN** `variant="mobile-compact"`
- **THEN** o painel é um bloco compacto no topo da aba ou antes do CTA
- **AND** sem sticky persistente

#### Scenario: Estados expostos por aria-label

- **WHEN** o painel é inspecionado
- **THEN** os estados de aceite são expostos via `aria-label`
- **AND** o acionador usa `aria-expanded`/`aria-pressed`

### Requirement: Bloqueio de avanço da aba Posicionamento por aceite pendente

O sistema SHALL, quando o aceite legal está `pending` ou `needs_reacceptance`:

- Bloquear a aba **Posicionamento** com motivo claro: `falta aceite legal`
- **Hard-block (D16):** a aba Posicionamento **não se torna painel ativo**; o motivo fica acessível no **botão da aba bloqueada** (tooltip/`aria-label`) e/ou como orientação na **aba atual** (Dados) com link para abrir o card de aceite
- A aba Direção Visual é desbloqueada pelos seus próprios pré-requisitos (`storeId` existente + tom de voz, D9) — o aceite não é pré-requisito direto dela, mas sem aceite vigente a geração permanece bloqueada (gate F34 inalterado)

#### Scenario: Aceite pendente bloqueia Posicionamento com motivo

- **WHEN** o usuário está na aba Dados
- **AND** `acceptance` é `pending` ou `needs_reacceptance`
- **THEN** a aba Posicionamento exibe estado `blocked`
- **AND** a aba Posicionamento **não é ativável** (clicar nela não navega — D16)
- **AND** o motivo `falta aceite legal` é exibido no **botão da aba** (tooltip/`aria-label`) e/ou como orientação na aba atual
- **AND** um link abre o card de aceite

#### Scenario: Aceite aceito destrava Posicionamento

- **WHEN** `acceptance` é `accepted`
- **AND** nome + segmento + loja criada estão válidos
- **THEN** a aba Posicionamento é desbloqueada
- **AND** o painel muda para "Aceito"
