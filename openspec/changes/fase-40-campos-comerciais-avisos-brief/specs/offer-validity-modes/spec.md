# Offer Validity Modes

## Purpose

Seção "Validade da oferta" no formulário de campanha com 6 modos estruturados (F40 D4/D5), visível apenas para `campaignIntent === "offer"`. Cada modo gera um `displayText` **nu, sem prefixo** que o form envia como `validity` no body — hoje o form nunca envia `validity` (campo dorme no schema). `endDate` (ISO) permanece reservado.

## ADDED Requirements

### Requirement: Validade em modos estruturados

O sistema SHALL prover uma seção "Validade da oferta" no formulário de campanha com os seguintes modos (select/cards), cada um gerando `displayText` determinístico:

| Modo | UI | displayText gerado |
|------|-----|---------------------|
| Sem validade | nada | (ausente — não envia) |
| Até uma data | date end | `até 30/09` |
| De... até... | date start + date end | `de 25/09 até 30/09` |
| Somente hoje | opção | `somente hoje` |
| Enquanto durarem os estoques | opção | `enquanto durarem os estoques` |
| Texto personalizado | input livre | texto do usuário (com normalização leve, D5) |

O formato de data usado no `displayText` é `dd/mm` (ex.: `30/09`).

#### Scenario: Modo até uma data gera displayText dd/mm

- **WHEN** o usuário escolhe o modo "Até uma data" e informa a data final 30/09
- **THEN** o `displayText` gerado é `"até 30/09"`

#### Scenario: Modo de... até... gera displayText com intervalo

- **WHEN** o usuário escolhe o modo "De... até..." com início 25/09 e fim 30/09
- **THEN** o `displayText` gerado é `"de 25/09 até 30/09"`

#### Scenario: Modo somente hoje gera displayText fixo

- **WHEN** o usuário escolhe o modo "Somente hoje"
- **THEN** o `displayText` gerado é `"somente hoje"`

#### Scenario: Modo enquanto durarem os estoques gera displayText fixo

- **WHEN** o usuário escolhe o modo "Enquanto durarem os estoques"
- **THEN** o `displayText` gerado é `"enquanto durarem os estoques"`

#### Scenario: Modo sem validade não gera displayText

- **WHEN** o usuário escolhe o modo "Sem validade"
- **THEN** nenhum `displayText` é gerado
- **AND** o body do submit **não contém** `validity` (campo ausente — nunca `enabled: false` fabricado)

### Requirement: Visibilidade da seção apenas para oferta

A seção "Validade da oferta" SHALL aparecer **apenas quando** `campaignIntent === "offer"` (coerente com `buildCommercialRepertoire`, que só considera validade para oferta).

**Decisão operacional (D4):** se o usuário preenche validade em `offer` e **troca para spotlight/exclusive**, o form **não envia `validity`** no body, mas **preserva o rascunho internamente** (form state) — se voltar para `offer`, a validade preenchida reaparece. Não há perda de dados na navegação entre intents; só o envio é condicionado a `offer`.

#### Scenario: Seção de validade visível apenas para offer

- **WHEN** `campaignIntent === "offer"`
- **THEN** a seção "Validade da oferta" é renderizada
- **WHEN** `campaignIntent` é `"spotlight"` ou `"exclusive"`
- **THEN** a seção "Validade da oferta" **não** é renderizada

#### Scenario: Troca de intent não envia validade mas preserva rascunho

- **WHEN** o usuário preenche validade em `offer` (ex.: "até 30/09") e troca para `spotlight`
- **THEN** o body do submit **não contém** `validity`
- **AND** ao voltar para `offer`, a validade preenchida ("até 30/09") reaparece no form (rascunho preservado)

### Requirement: displayText frase nua sem prefixo

O `displayText` gerado SHALL representar **apenas o conteúdo da validade**, sem o rótulo "Oferta válida" (D5). Exemplos: `"até 30/09"`, `"de 25/09 até 30/09"`, `"somente hoje"`, `"enquanto durarem os estoques"`.

- As **duas superfícies do prompt** compõem o rótulo uma única vez: `buildCommercialRepertoire` → `- Oferta válida: ${displayText}` e template offer/base → `**Validade da oferta:** {{validity}}`. A F40 **não mexe em nenhuma das duas superfícies**.
- **Texto personalizado — normalização leve:** se o usuário digitar `Oferta válida até 30/09`, o sistema SHALL limpar o prefixo "Oferta válida" antes de enviar. A UI é responsável por não deixar o lojista salvar "Oferta válida..." quando escolhe modos estruturados.
- `endDate` (ISO) permanece **reservado, sem envio** (F39 D8): as datas da UI apenas geram `displayText`; o backend recebe texto final.

#### Scenario: displayText nu não duplica rótulo nas duas superfícies

- **WHEN** `validity.displayText = "até 30/09"` com intent `offer`
- **THEN** `buildCommercialRepertoire` gera `- Oferta válida: até 30/09` (rótulo composto uma vez)
- **AND** o template mantém `**Validade da oferta:** até 30/09` (sem duplicação "Oferta válida: Oferta válida até 30/09")
- **AND** a F40 não altera nenhuma das duas superfícies

#### Scenario: Texto personalizado com prefixo é normalizado

- **WHEN** o usuário digita "Oferta válida até 30/09" no modo Texto personalizado
- **THEN** o `displayText` enviado é `"até 30/09"` (prefixo "Oferta válida" limpo)

#### Scenario: endDate nunca é enviado

- **WHEN** o usuário preenche datas estruturadas na seção de validade
- **THEN** o body do submit contém `validity` como **texto final** (`displayText`)
- **AND** `endDate` (ISO) **não** é enviado no body (reservado, F39 D8)

### Requirement: Envio de validity no body do form

O sistema SHALL incluir `validity: <displayText>` no body do submit do form quando a validade estiver habilitada em `offer` (D4/D5). Sem validade ou intent ≠ offer → `validity` ausente.

O transporte/domínio permanecem inalterados: `GenerateImageRequestSchema` já aceita `validity?: string | undefined`; o mapper F39 já converte `validity` (string) → `commercial.validity { enabled: true, displayText }`.

#### Scenario: Offer com validade envia validity no body

- **WHEN** `campaignIntent === "offer"` e o usuário escolhe modo "Até uma data" com fim 30/09
- **THEN** o body do submit contém `validity: "até 30/09"`
- **AND** o mapper produz `commercial.validity = { enabled: true, displayText: "até 30/09" }`

#### Scenario: Offer sem validade não envia validity

- **WHEN** `campaignIntent === "offer"` e o usuário escolhe modo "Sem validade"
- **THEN** o body do submit **não contém** `validity`
