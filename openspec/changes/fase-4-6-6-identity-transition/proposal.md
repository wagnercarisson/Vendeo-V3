## Why

O estado de identidade visual da loja (`identity_state`) permite transições incoerentes entre `logo` e `visual_signature` sem passar por `text_only`, e a UI exibe ações incompatíveis com o estado atual (ex.: "Enviar logotipo" visível durante `visual_signature`, "Continuar sem logo" como ação principal em `text_only` com perfil ativo). Isso gera estados parciais, dados inconsistentes e experiência confusa para o lojista.

Esta fase simplifica e corrige o fluxo de transições de identidade, usando `text_only` como hub obrigatório, e alinha as ações da UI ao estado vigente.

## What Changes

- **Transições via `text_only` como hub**: Toda troca entre identidades visuais (`logo`, `visual_signature`) deve passar por `text_only` — remover a identidade atual antes de aplicar outra
- **Estado inicial**: nova loja nasce em `text_only`
- **4 transições permitidas**: `text_only → logo`, `logo → text_only`, `text_only → visual_signature`, `visual_signature → text_only`
- **Transições diretas bloqueadas**: `logo` ↔ `visual_signature` e substituição direta de logo/VS
- **`identity_state` descreve asset visual ativo, não direção visual**: uma loja em `text_only` não possui logo/VS ativo, mas pode manter um brand profile `synced` como direção visual vigente, inclusive herdado de logo/VS removidos
- **UI por estado**: `logo` exibe apenas "Remover logo"; `visual_signature` exibe apenas "Remover assinatura visual"; `text_only` exibe ações para enviar logo ou gerar/gerenciar VS
- **Falha preserva estado anterior**: se uma transição falhar, `identity_state` e assets ativos permanecem inalterados
- **Persistência crítica antes da transição de estado**: `identity_state` só muda depois que a persistência crítica da transição foi concluída — novo asset/VS ativo nas ativações; asset/VS atual arquivado nas remoções
- **"Continuar sem logo" substituído**: o link deixa de ser ação principal concorrente e é substituído por orientação textual no Step 2
- **Logo removido sem histórico/reaplicação**: nesta fase, remover logo não abre gerenciamento de versões — o usuário reenvia o arquivo se quiser
- **Fora de escopo**: cores; `manual_color_override`; realinhamento de direção visual; feedback para nova direção visual; idempotência global; histórico/reaplicação/gerenciamento de versões de logo; drift/revalidação/realinhamento de VS antiga; troca direta `logo` ↔ `visual_signature`; troca direta `visual_signature v1` → `visual_signature v2`

## Capabilities

### New Capabilities

- `identity-state-transitions`: Regras centrais de transição de `identity_state` — 4 transições permitidas, `text_only` como hub, bloqueio de troca direta, invariantes (I1-I6), transição segura em falhas, ordenamento de persistência

### Modified Capabilities

- `store-identity-ui`: Ações e elementos de UI por estado de identidade — restringir ações exibidas em `logo` e `visual_signature`, remover "Continuar sem logo" como ação principal em `text_only`, adicionar aviso pré-remoção de logo, substituir link por card de orientação no Step 2
- `store-identity-state`: Novas invariantes obrigatórias (I1-I6) — `text_only` sem asset ativo, `logo` com logo ativo, `VS` com VS ativa, validação de transição antes de persistência, bloqueio de troca direta

## Impact

- **API routes**:
  - `POST /api/store/[id]/logo` — reforçar validação `identity_state` (bloquear se `visual_signature`)
  - `DELETE /api/store/[id]/logo` — confirmar fluxo `logo → text_only` com arquivamento e aviso pré-remoção
  - `POST /api/store/[id]/visual-signature/approve` — garantir transição `text_only → visual_signature`
  - `DELETE /api/store/[id]/visual-signature` — confirmar fluxo `visual_signature → text_only`
   - `POST /api/store/[id]/visual-signature/restore` — escopo limitado à regra de transição: bloquear se `identity_state = logo`; permitir somente a partir de `text_only`; **não** entrar em drift, revalidação ou realinhamento de VS antiga
- **UI components**:
  - `store-identity-form.tsx` — lógica de ações por estado de identidade, remoção do "Continuar sem logo"
  - `store-visual-signature-section.tsx` — ações exibidas em `visual_signature` state
- **Hooks/actions**:
  - `use-store-form.ts` — validação de transições no formulário
  - `src/lib/actions/store.ts` — centralização da lógica de transição
- **No breaking changes in persisted data**: `identity_state` continua usando os mesmos valores (`text_only`, `logo`, `visual_signature`); `logo_status` mantém dual-population
