## Context

As fases 4.6.1–4.6.5 estabeleceram `identity_state`, `text_only_origin`, dual-population com `logo_status`, profile reconciliation, drift detection, logo lifecycle e VS lifecycle. No entanto, as transições entre `text_only`, `logo` e `visual_signature` permanecem dispersas entre rotas e componentes, sem um ponto central que garanta as invariantes (I1–I6) do alinhamento.

O estado atual permite, por exemplo, que um upload de logo ocorra durante `visual_signature`, ou que a UI exiba "Enviar logotipo" quando uma VS está ativa. Esta fase consolida um orquestrador central de transições e alinha a UI ao estado vigente.

## Goals / Non-Goals

**Goals:**
- Centralizar as 4 transições permitidas em um único orquestrador (`text_only → logo`, `logo → text_only`, `text_only → visual_signature`, `visual_signature → text_only`)
- Bloquear troca direta entre `logo` e `visual_signature`
- Bloquear substituição direta de logo e substituição direta de VS
- Alinhar ações da UI (botões, links, seções) ao `identity_state` atual
- Substituir o link "Continuar sem logo" por card de orientação no Step 2
- Garantir transição segura: estado só muda após persistência crítica; se etapa posterior falhar, a rota deve compensar ou retornar erro sem declarar sucesso
- Garantir que falha preserve estado anterior

**Non-Goals:**
- Cores, `manual_color_override`, paleta manual
- Realinhamento/drift/revalidação de direção visual
- Feedback para gerar nova direção visual sob demanda
- Idempotência global
- Histórico/reaplicação de versões de logo na UI
- Drift, revalidação ou realinhamento de VS antiga
- Troca direta `logo ↔ visual_signature`
- Troca direta `visual_signature v1 → v2`
- Lifecycle avançado de VS (arquivamento inteligente, reuso automático)

## Decisions

### D0 — `identity_state` representa asset visual ativo, não existência de direção

**Decisão:** `text_only` significa ausência de logo e de VS ativos, mas a loja pode manter um brand profile `synced` como direção visual vigente, inclusive herdado de logo/VS removidos.

**Rationale:** Essa distinção evita confusões recorrentes. Nas fases anteriores, "text_only" foi associado a "sem direção visual", o que gerou decisões incorretas. O profile `synced` em `text_only` é válido e desejado — ele alimenta a geração de campanhas com a direção visual mais recente.

### D1 — Orquestrador central de transições

**Decisão:** Criar `src/lib/identity-transitions.ts` com um orquestrador central responsável por validar, executar e confirmar cada transição.

```typescript
type Transition =
  | 'text_only_to_logo'
  | 'logo_to_text_only'
  | 'text_only_to_visual_signature'
  | 'visual_signature_to_text_only'

async function transition(storeId: string, type: Transition, payload?: unknown): Promise<TransitionResult>
```

**Rationale:** As transições têm invariantes comuns (I4, I5, I6) que precisam de um ponto único de validação e execução. Dispersar isso em cada route handler aumenta risco de inconsistência.

Cada transição segue o mesmo lifecycle:
1. Validar `identity_state` atual (rejeitar se incompatível — I4)
2. Executar persistência crítica da transição (arquivar asset anterior nas remoções; ativar novo asset nas ativações)
3. Só então atualizar `identity_state` (I6)
4. Se falhar antes da persistência crítica, manter estado anterior (I5)
5. Se a persistência crítica concluir mas a atualização de `identity_state` falhar, executar compensação quando possível ou retornar erro registrando estado parcial detectável — a UI nunca deve declarar sucesso

**Limite do orquestrador:** Ele não reimplementa BrandDirector, geração de VS, análise de logo, cores ou lifecycle avançado. Ele apenas valida transições permitidas e coordena a persistência mínima de estado/asset já existente no fluxo de cada rota.

Alternativa considerada: validar em cada rota individualmente. Rejeitada por duplicação de lógica e risco de uma rota esquecer a validação.

### D2 — dupla validação (API + UI)

**Decisão:** Toda transição é validada em 2 camadas:
- **API layer**: o orquestrador rejeita transição se `identity_state` não corresponder ao esperado
- **UI layer**: os componentes só exibem ações compatíveis com o `identity_state` atual

**Rationale:** O usuário nunca deve ver um botão que vai levar a um erro 409. A API é a barreira final, mas a UI deve guiar o fluxo correto.

### D3 — UI state-action matrix

**Decisão:** Criar hook `useIdentityActions(identityState, storeData)` que retorna as ações disponíveis:

| `identity_state` | Ações de identidade exibidas |
|---|---|
| `text_only` | "Enviar logotipo", "Gerar assinatura visual" (ou "Gerenciar assinatura visual" se VS existe) |
| `logo` | "Remover logo" (única ação de identidade) |
| `visual_signature` | "Remover assinatura visual" (única ação de identidade) |

Ações existentes não relacionadas à identidade (cores, campos de texto, salvar) permanecem inalteradas e fora do escopo desta fase.

**Rationale:** Centraliza a lógica de visibilidade em um lugar só, em vez de condicionais espalhadas em 2-3 componentes. Facilita testes e futuras mudanças.

### D4 — "Continuar sem logo" substituído por card

**Decisão:** Remover o link "Continuar sem logo" do Step 2. Substituir por um card informativo exibido quando `identity_state = 'text_only'`:

> **Sem logo por enquanto?**
> Você pode escolher as cores da loja, se quiser, e clicar em Salvar.
> O Vendeo vai gerar uma direção visual usando os dados básicos da loja.

O card usa `bg-bg-surface`, borda sutil, sem botão de ação — é informativo. O comportamento de salvar sem logo/VS permanece o mesmo (dispara brand inference), mas sem o link de atalho visual.

**Rationale:** O link "Continuar sem logo" competia visualmente com as ações de logo/VS e gerava confusão (o que acontece se eu clicar aqui?). O card deixa claro que não é uma ação, mas um estado possível.

### D5 — Remoção de logo sem histórico

**Decisão:** `DELETE /api/store/[id]/logo` arquiva o logo ativo, não oferece histórico, gerenciamento ou reaplicação na UI. Antes de remover, exibe aviso:

> "Ao remover o logo, ele não ficará disponível para reaplicação pela interface. Você poderá enviar o arquivo novamente quando quiser."

**Rationale:** Simplifica o fluxo e armazenamento. O usuário reenvia o arquivo se quiser. Fluxos antigos de reaplicação/histórico de logo não são acionados por esta UI.

### D6 — `POST /api/store/[id]/visual-signature/restore` limitado à validação de transição

**Decisão:** A rota de restore só recebe validação de `identity_state`. A função `transition` bloqueia se `identity_state = logo` e permite apenas a partir de `text_only`. Nenhuma lógica de drift, revalidação ou realinhamento de VS antiga é adicionada nesta fase.

**Rationale:** Escopo da fase é transição, não lifecycle de VS. Drift/realinhamento de VS já foram tratados em fases 4.6.2/4.6.4/4.6.5 e não devem ser reabertos.

## Risks / Trade-offs

- **[Centralização vs acoplamento]** O orquestrador central é mais seguro, mas qualquer evolução das transições precisará passar por ele. → Mitigação: a interface `Transition` é extensível por novos tipos, sem quebrar os existentes.
- **[UI duplicada com o orquestrador]** A UI pode mostrar uma ação que a API rejeita em race conditions (ex.: dois usuários na mesma loja). → Mitigação: o backend é a autoridade final; a UI otimista é aceitável.
- **[Remoção do "Continuar sem logo"]** Lojistas acostumados com o link podem estranhar. → Mitigação: o card informativo cumpre o mesmo papel, com linguagem clara.
- **[Sem reaplicação de logo na UI]** Se o usuário remove o logo por engano, precisa reenviar. → Mitigação: o aviso pré-remoção é explícito sobre a irreversibilidade.

## Migration Plan

1. Criar `src/lib/identity-transitions.ts` com o orquestrador
2. Atualizar `DELETE /api/store/[id]/logo` para preservar o contrato `logo → text_only` via orquestrador
3. Atualizar `POST /api/store/[id]/logo` para validar `identity_state` via orquestrador
4. Atualizar `DELETE /api/store/[id]/visual-signature` para usar o orquestrador
5. Atualizar `POST /api/store/[id]/visual-signature/approve` para usar o orquestrador
6. Atualizar `POST /api/store/[id]/visual-signature/restore` com validação de transição (sem drift)
7. Implementar `useIdentityActions` hook
8. Atualizar `store-identity-form.tsx` e `store-visual-signature-section.tsx` com a matrix de ações
9. Atualizar UI para exibir aviso antes de chamar `DELETE /api/store/[id]/logo` (responsabilidade da UI, não da API)
10. Substituir link "Continuar sem logo" por card informativo

Rollback: reverter commits individualmente — cada passo é pequeno e reversível.

## Open Questions

- Nenhuma no momento — o alinhamento cobre todas as decisões necessárias.
