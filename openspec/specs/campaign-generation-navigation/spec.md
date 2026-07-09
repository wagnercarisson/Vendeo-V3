> **Purpose**: This spec defines the navigation flow and payload lifecycle from campaign generation to preview, including sessionStorage management and object URL lifecycle.
>
> Updated by `fase-14-integracao-fluxo-geracao` — post-generation navigation now uses `/campanha/[id]` and reads from database instead of sessionStorage.

## Requirements

### Requirement: Remove sessionStorage as post-generation source of truth

> Modified by `fase-14-integracao-fluxo-geracao` — replaces previous behavior of storing preview payload in sessionStorage.

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

### Requirement: Object URL lifecycle management

The object URL created via `URL.createObjectURL` for the product image SHALL NOT be revoked when navigating from campaign input to preview. It SHALL remain valid for the preview route. The object URL SHALL only be revoked when:
- Starting a new campaign
- Clearing the preview payload
- Navigating back through an application-controlled preview exit action

On tab close or full page reload, the browser document cleanup is sufficient — no explicit revocation logic is required for those cases.

After F14, the object URL lifecycle is restricted to form draft management — the object URL SHALL remain valid while the form draft exists in `campaign_draft_image` and SHALL NOT be revoked by the navigation flow.

#### Scenario: Object URL persists during navigation to preview

- **WHEN** the user navigates from campaign input to `/campaign/preview`
- **THEN** the product image object URL SHALL remain valid
- **AND** the preview SHALL display the product image

#### Scenario: Object URL revoked on new campaign

- **WHEN** the user starts a new campaign
- **THEN** the previous object URL SHALL be revoked via `URL.revokeObjectURL`

### Requirement: Navigate to campaign URL after generation

> Modified by `fase-14-integracao-fluxo-geracao` — replaces previous navigation to `/campaign/preview`.

O sistema SHALL substituir a navegação para `/campaign/preview` pela navegação para `/campanha/${campaignId}`.

Após receber `{ type: "result", campaignId, campaignUrl }` no NDJSON, o sistema SHALL navegar para `campaignUrl` usando client-side navigation (`next/navigation` `router.push`).

#### Scenario: Navigate to campaign page after generation

- **WHEN** o NDJSON final emite `{ type: "result", campaignId, campaignUrl }`
- **THEN** o sistema navega para a URL fornecida via `router.push`
- **AND** a navegação anterior para `/campaign/preview` NÃO ocorre

#### Scenario: Object URL lifecycle restricted to form draft

- **WHEN** a geração é concluída
- **THEN** o object URL da imagem do produto NÃO é revogado pelo fluxo de navegação (permanece gerenciado pelo rascunho do formulário via `campaign_draft_image`)
