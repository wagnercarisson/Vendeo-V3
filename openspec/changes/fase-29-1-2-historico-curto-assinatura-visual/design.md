## Context

O `VisualSignatureHistoryModal` atual (240 linhas) foi construído antes do sistema de drift e antes do review phase. Com a remoção do limite de 3 gerações (F29.1.1), o usuário pode acumular dezenas de VS. O modal atual:
- Carrega todas as VS sem paginação
- Mostra versões com critical_drift como "restauráveis" (só bloqueia server-side)
- Não distingue visualmente versões aplicáveis de bloqueadas
- Está desconectado do ApprovalModal (sem ponte entre "Há mais versões" e o histórico)

O escopo é estritamente frontend + 1 linha lógica no backend (condição de drift no approve route). Sem nova rota, sem migration, sem schema change.

## Goals / Non-Goals

**Goals:**
- Substituir `VisualSignatureHistoryModal` por lista curta (máx. 12 itens) com filtro de aplicabilidade
- Ocultar VS com critical_drift ou missing_metadata da lista principal (filtro client-side)
- Ações condicionais ao `identity_state`: apenas `text_only` permite "Aplicar"
- Incluir `draft` na listagem com revalidação de drift (drafts atuais têm `input_snapshot`)
- Integrar ApprovalModal → HistoryModal via prop `onOpenGallery`
- Paginação: "Ver versões anteriores" quando total > 6, máximo 12, botão some após carregar
- Backend: validar drift também para draft (condição `status !== 'active'`)
- Atualizar spec `visual-signature-restore` para refletir bloqueio de `identity_state = 'visual_signature'`
- Sem consumo de crédito para visualizar ou reativar VS

**Non-Goals:**
- Galeria gigante com paginação completa, filtros combinados, busca — fase futura
- Substituição de VS ativa (substitution mode no HistoryModal) — usuário remove ativa primeiro
- Server-side filtering (`?filter=applicable`) — client-side suficiente
- Modal stack (HistoryModal dentro do ApprovalModal) — parent fecha um e abre outro
- Nova API route ou migration de schema
- Consumo de crédito para visualizar ou reativar VS — sempre gratuito
- Redesenho do ApprovalModal — apenas adicionar prop + link
- Exibição de VS com critical_drift ou missing_metadata — ocultas da lista

## Decisions

### D1 — HistoryModal substituído, não fase gallery no ApprovalModal

`DECIDIDO`

A lista de VS é gestão de histórico, não parte do ciclo de geração/aprovação. Misturar os dois no ApprovalModal sobrecarrega um componente que já gerencia 10 fases. Fluxo: ApprovalModal → clica "Ver versões recentes" → chama `onOpenGallery()` → parent fecha ApprovalModal e abre HistoryModal → ao concluir, retorna ao contexto anterior.

**Alternativa considerada:** Adicionar phase "gallery" no ApprovalModal. Rejeitado porque mistura dois produtos mentais diferentes (gerar/aprovar vs. gerenciar versões existentes).

### D2 — Filtro client-side de critical_drift e missing_metadata

`DECIDIDO`

A API `GET /api/store/[id]/visual-signature` continua retornando todas as VS sem filtro novo. O componente filtra visualmente: `signatures.filter(s => s.restore_eligibility?.reason === "ok")`.

| `restore_eligibility.reason` | Aparece na lista? |
|---|---|
| `ok` | Sim |
| `critical_drift` | **Não** |
| `missing_metadata` | **Não** |

**Ressalvas:** A ação final nunca confia no filtro client-side — POST /restore e POST /approve sempre revalidam drift no servidor. Paginação client-side: se "Ver mais" carregar lote com VS inaplicáveis, botão pode sumir sem feedback — aceitável.

**Alternativa considerada:** Server-side filtering. Rejeitado porque a API é fonte de diagnóstico — filtrar server-side criaria dois modos de verdade.

### D3 — Ações condicionais ao estado de identidade

`DECIDIDO`

```
identity_state = "visual_signature" (VS ativa existe)
  └── VS archived: ❌ Bloqueado — "Remova a assinatura ativa antes de aplicar outra versão"
  └── VS draft:     ❌ Bloqueado
  └── VS active:    ✅ "Em uso" (info, sem ação)

identity_state = "text_only" (nenhuma VS ativa)
  └── VS archived:  ✅ "Aplicar" → POST /approve (com revalidação)
  └── VS draft:     ✅ "Aplicar" → POST /approve (com revalidação)
  └── VS active:    ❌ Não deveria existir (consistência)
```

`canApply = identityState === "text_only"`. `visual_signature`, `logo` e `null`/`loading` bloqueiam.

**Backend — validar drift também para draft:** Mudar condição de `status === 'archived'` para `status !== 'active'` no approve route. Drafts gerados pelo pipeline atual têm `input_snapshot` no metadata (confirmado no código). A validação de drift é possível e deve ser aplicada. O fluxo normal de aprovação (imediatamente após geração) continua funcionando porque o snapshot acabou de ser salvo.

**Conflito com spec existente:** `openspec/specs/visual-signature-restore/spec.md` linha 20 afirma que `identity_state = 'visual_signature'` é permitido. Isso conflita com D3. O spec precisa ser atualizado.

### D4 — Paginação "Ver versões anteriores" simples

`DECIDIDO`

Se VS aplicáveis > 6, exibe um único botão "Ver versões anteriores". Após carregar segundo lote (total máximo 12), botão some permanentemente. Carga inicial: `limit=6`. Máximo da fase: 12 itens. Componente re-filtra cada lote (client-side) e acumula.

### D5 — Sem consumo de crédito

`DECIDIDO`

Visualizar ou reativar VS anterior nunca consome crédito. POST /approve para VS archived/draft não chama `reserveCredit`. Revalidação de drift é gratuita (`validateDrift()` — cálculo local, sem custo de IA).

### D6 — ApprovalModal ganha prop `onOpenGallery`

`DECIDIDO`

`VisualSignatureApprovalModal` recebe prop opcional `onOpenGallery?: () => void`. Placeholder "Galeria completa em breve" vira link "Ver versões recentes" que chama `onOpenGallery()`. Placeholder só aparece se `totalSignatures > 6`.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| Usuário confuso entre "Ver versões recentes" (ApprovalModal) e "Assinaturas anteriores" (StoreVS Section) — dois caminhos para o mesmo destino | Aceitável. Contextos diferentes (geração vs. gestão). ApprovalModal só mostra link quando > 6 versões |
| Filtro client-side vs. paginação — "Ver versões anteriores" pode carregar página cheia de VS inaplicáveis, botão some sem feedback | Aceitável para escopo curto. Fase futura resolve com server-side filtering |
| POST /approve em VS archived/draft pode falhar por drift não detectado no client | Filtro client-side só considera `reason === "ok"`, então não deveria falhar. Se estado mudar entre load e click, server-side barra com mensagem |
| VS draft sem input_snapshot — drafts pré-snapshot | Filtro oculta via `missing_metadata`. Pipeline atual sempre salva snapshot |
| Modal stack confuso — ApprovalModal fecha, HistoryModal abre, usuário "volta" e não reencontra ApprovalModal | Ao fechar HistoryModal sem aplicar, volta ao StoreVS Section. Mesmo comportamento de fechar ApprovalModal e reabrir |
