# Campaign Generation Navigation

> Part of `fase-14-integracao-fluxo-geracao` (MODIFIED).

## Purpose

Gerencia o fluxo de navegação e ciclo de vida dos payloads entre geração e preview da campanha. Após a F14, o consumer navega para `/campanha/[id]` em vez de `/campaign/preview`, e a campanha é lida do banco em vez de `sessionStorage`.

## MODIFIED Requirements

### Requirement: Remove sessionStorage as post-generation source of truth (MODIFIED)

O sistema SHALL remover o uso de `sessionStorage` como fonte de verdade pós-geração. Especificamente:
- O `campaign_preview` key SHALL NOT ser escrito no `sessionStorage` após geração bem-sucedida
- O `campaign_draft_image` SHALL permanecer em `sessionStorage` (rascunho do formulário, mantido)
- O `useInputPreservation` SHALL permanecer em `sessionStorage` (rascunho dos campos de texto, mantido)

#### Scenario: No sessionStorage write on success

- **WHEN** a geração é bem-sucedida e o NDJSON final é recebido
- **THEN** o `sessionStorage` NÃO contém a key `campaign_preview`

#### Scenario: Draft data preserved in sessionStorage

- **WHEN** o usuário navega para gerar uma campanha
- **THEN** as keys `campaign_draft_image` e `useInputPreservation` permanecem no `sessionStorage`

### Requirement: Navigate to campaign URL after generation (MODIFIED)

O sistema SHALL substituir a navegação para `/campaign/preview` pela navegação para `/campanha/${campaignId}`.

Após receber `{ type: "result", campaignId, campaignUrl }` no NDJSON, o sistema SHALL navegar para `campaignUrl` usando client-side navigation (`next/navigation` `router.push`).

#### Scenario: Navigate to campaign page after generation

- **WHEN** o NDJSON final emite `{ type: "result", campaignId, campaignUrl }`
- **THEN** o sistema navega para a URL fornecida via `router.push`
- **AND** a navegação anterior para `/campaign/preview` NÃO ocorre

#### Scenario: Object URL lifecycle restricted to form draft

- **WHEN** a geração é concluída
- **THEN** o object URL da imagem do produto NÃO é revogado pelo fluxo de navegação (permanece gerenciado pelo rascunho do formulário via `campaign_draft_image`)