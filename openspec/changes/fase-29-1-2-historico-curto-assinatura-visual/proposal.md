## Why

A F29.1.1 removeu o limite fixo de 3 gerações e introduziu consumo de crédito na VS. Como consequência, o usuário pode acumular dezenas de versões. O `VisualSignatureHistoryModal` atual (240 linhas) foi feito antes do sistema de drift e antes do review phase: carrega todas as VS sem paginação, mostra versões com critical_drift como "restauráveis" (só bloqueia no server), não distingue visualmente versões aplicáveis de bloqueadas, e está desconectado do `ApprovalModal` — sem ponte entre "Há mais versões" e o histórico.

## What Changes

- **Substituir o `VisualSignatureHistoryModal`** por uma lista curta e segura de VS recentes (máximo 12 itens), exibindo `draft`, `archived` e `active` conforme regras de aplicabilidade
- **Ocultar visualmente** versões com `critical_drift` ou `missing_metadata` — essas VS não aparecem na lista principal (filtro client-side)
- **Ações condicionais ao estado de identidade:** `text_only` permite aplicar VS (draft ou archived com revalidação server-side); `visual_signature`, `logo` e `null` bloqueiam com instrução clara
- **Incluir `draft` na listagem** com revalidação de drift obrigatória (drafts do pipeline atual têm `input_snapshot` no metadata)
- **Integrar com `ApprovalModal`** — o placeholder "Galeria completa em breve" vira botão "Ver versões recentes" que chama `onOpenGallery()`
- **Paginação simples** — botão "Ver versões anteriores" quando `total > 6`, máximo de 12 itens, botão some após carregar segundo lote
- **Sem consumo de crédito** para visualizar ou reativar VS anterior
- **Alterar backend** — condição de drift validation no `POST /approve`: de `status === 'archived'` para `status !== 'active'` (validar drift também para draft)
- **Sem mexer em geração** — API de geração, consumo de crédito e pipeline de campanhas não são tocados
- **Atualizar spec** `visual-signature-restore` para refletir que `identity_state = 'visual_signature'` agora é BLOQUEADO (não mais permitido)

## Capabilities

### New Capabilities

- *(Nenhuma — todas as mudanças são modificações em capabilities existentes)*

### Modified Capabilities

- `visual-signature-approval`: Adicionar prop opcional `onOpenGallery?: () => void`. Placeholder "Galeria completa em breve" vira link "Ver versões recentes" que chama `onOpenGallery()`. Placeholder só aparece se `totalSignatures > 6`.
- `visual-signature-restore`: Atualizar regra de `identity_state` — `'visual_signature'` passa de PERMITIDO para BLOQUEADO. Restore/apply sobre VS ativa não é permitido nesta fase.
- *(Demais mudanças são implementação interna do HistoryModal e ajustes nos parents — não alteram contratos de spec existentes)*

## Impact

| Área | Impacto |
|------|---------|
| `src/components/flow/visual-signature-history-modal.tsx` | [REESCREVER] Substituir implementação atual (240 linhas) por novo componente com filtro, paginação, ações condicionais, estados loading/error/empty |
| `src/components/flow/visual-signature-approval-modal.tsx` | [ADICIONAR] prop `onOpenGallery`, [MODIFICAR] placeholder vira link clicável |
| `src/components/flow/store-visual-signature-section.tsx` | [ADICIONAR] `handleOpenGallery` que fecha approval e abre history |
| `src/components/flow/store-identity-form.tsx` | [ADICIONAR] callback similar + state `showHistoryModal` + render condicional do HistoryModal com `identityState` |
| `src/app/api/store/[id]/visual-signature/approve/route.ts` | [ALTERAR] Condição de drift validation: `status === 'archived'` → `status !== 'active'` (1 linha) |
| `openspec/specs/visual-signature-restore/spec.md` | [ATUALIZAR] Linha 20: `'visual_signature'` passa de PERMITIDO para BLOQUEADO |
| Testes | 28+ testes novos: filtro (5), ações por identidade (6), backend drift em draft (4), paginação (4), integração ApprovalModal (3), regressão (4+) + UAT |
