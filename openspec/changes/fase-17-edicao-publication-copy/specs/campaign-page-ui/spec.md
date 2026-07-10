# Campaign Page UI

> Part of `fase-17-edicao-publication-copy` (MODIFIED).
> Delta spec — modifies requirements from main `openspec/specs/campaign-page-ui/spec.md`.

## Purpose

Adicionar modo edição inline do publication copy no Client Component `/campanha/[id]/client.tsx`, com botões Editar/Salvar/Restaurar original/Cancelar, badge "Editado", e estados de loading/erro no salvamento.

## MODIFIED Requirements

### Requirement: Estado ready com edição de publication copy

O sistema SHALL exibir o estado ready com suporte a edição inline do publication copy.

**Nota:** Este requisito MODIFICA o `Requirement: Estado ready` em `openspec/specs/campaign-page-ui/spec.md`. O estado ready agora inclui o publication copy com suporte a edição inline.

O Client Component SHALL receber `campaignId: string` como prop para montar a URL do PATCH. Quando `displayStatus === "ready"`, o Client Component SHALL exibir:
- A imagem final da campanha (src da signed URL gerada server-side)
- O nome do produto
- A data de criação formatada
- Botão "Baixar Original" que linka para `downloadUrl`

**Kit de Publicação (seção separada):**
- Título "Kit de Publicação" com badge "Editado" ao lado se `isPublicationCopyEdited` é `true`
- Caption, hashtags, cta_post em modo visualização (padrão) com botão "✏️ Editar"

**Modo edição (após clicar "Editar"):**
- Caption: textarea preenchido com valor atual
- Hashtags: textarea "uma por linha" (normalizado como array no save)
- CTA: input preenchido com valor atual
- Botão "💾 Salvar" — chama PATCH para `/api/campaign/[campaignId]/publication-copy` usando a prop `campaignId`
- Botão "↩️ Restaurar original" — confirmação → PATCH `{ restore: true }` para mesma URL
- Botão "Cancelar" — descarta alterações locais, volta ao modo visualização

#### Scenario: Client recebe campaignId para montar PATCH URL

- **WHEN** o Client Component é renderizado com `displayStatus === "ready"`
- **THEN** a prop `campaignId` está disponível para montar a URL `/api/campaign/[campaignId]/publication-copy`

#### Scenario: Ready com publication copy e badge Editado

- **WHEN** `displayStatus` é `"ready"` e `isPublicationCopyEdited` é `true`
- **THEN** exibe imagem, caption + hashtags + cta_post, badge "Editado" ao lado do título, e botão "Editar"

#### Scenario: Ready sem badge Editado

- **WHEN** `displayStatus` é `"ready"` e `isPublicationCopyEdited` é `false`
- **THEN** exibe imagem, caption + hashtags + cta_post do snapshot, sem badge "Editado", e botão "Editar"

#### Scenario: Botão Editar entra em modo edição

- **WHEN** usuário clica "Editar"
- **THEN** caption vira textarea, hashtags vira textarea (uma por linha), cta vira input, todos preenchidos com valores atuais

#### Scenario: Botão Salvar chama PATCH e atualiza UI

- **WHEN** usuário clica "Salvar" com dados válidos
- **THEN** PATCH é chamado → se 200, estado local atualiza → volta ao modo visualização com novos dados

#### Scenario: Botão Restaurar original com confirmação

- **WHEN** usuário clica "Restaurar original"
- **THEN** confirmação "Restaurar texto original da IA?" → se sim, PATCH com `{ restore: true }` → resposta retorna snapshot → UI atualiza com snapshot → volta ao modo visualização

#### Scenario: Botão Cancelar descarta alterações

- **WHEN** usuário clica "Cancelar"
- **THEN** descarta alterações locais, volta ao modo visualização sem chamar API

### Requirement: Estados de loading e erro no salvamento

O sistema SHALL adicionar estados de loading e erro durante a operação de salvamento.

#### Scenario: Loading durante requisição

- **WHEN** requisição PATCH está em andamento
- **THEN** botões "Salvar" e "Restaurar" estão desabilitados com texto "Salvando..."

#### Scenario: Erro após falha do PATCH

- **WHEN** requisição PATCH retorna erro
- **THEN** exibe toast/aviso "Não foi possível salvar. Tente novamente."
- **AND** modo edição é mantido com dados não salvos
