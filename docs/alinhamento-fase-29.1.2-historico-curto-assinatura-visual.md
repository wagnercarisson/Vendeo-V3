# Alinhamento Fase 29.1.2 — Histórico Curto de Assinaturas Visuais

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                     ✓
  ├── F23 a F29 — todas as fases v1.5 concluídas e testadas          ✓
  │
  └── pós-v1.5 — preparação para monetização pública (F30)
        │
        ├── F29.1.1 — Créditos na Assinatura Visual                  ✓
        │   (VS com crédito, sem limite de 3, review de 6)
        │
        └── F29.1.2 — Histórico Curto de VS Aplicáveis              ← esta fase
```

A F29.1.1 removeu o limite fixo de 3 gerações e introduziu consumo de crédito na VS. Como consequência, o usuário pode acumular dezenas de versões. O modal de aprovação (`VisualSignatureApprovalModal`) mostra no máximo 6 versões no `review phase`, mas o histórico completo (via `VisualSignatureHistoryModal`) continua existindo como uma lista simples, sem filtro, sem tratamento de drift visual, e sem integração com o fluxo de aprovação.

**Problema:** O `VisualSignatureHistoryModal` atual (240 linhas) foi feito antes do sistema de drift e antes do review phase. Ele:
- Carrega todas as VS sem paginação
- Mostra até versões com critical drift como "restauráveis" (só bloqueia no server)
- Não distingue visualmente entre versões aplicáveis e bloqueadas
- Está desconectado do ApprovalModal (sem ponte entre "Há mais versões" e o histórico)

**O que esta fase faz:** Substitui o HistoryModal por uma versão enxuta e segura que lista apenas as versões recentes aplicáveis, com regras claras de ação baseadas no estado de identidade da loja.

---

## Propósito

1. **Substituir o `VisualSignatureHistoryModal`** por uma lista curta e segura de VS recentes (máximo 12 itens), exibindo `draft`, `archived` e `active` conforme regras de aplicabilidade
2. **Ocultar visualmente** versões com `critical_drift` ou `missing_metadata` — essas VS não aparecem na lista principal
3. **Ações condicionais ao estado de identidade:**
   - Se `identity_state = visual_signature` (VS ativa existe) → ações bloqueadas com instrução clara "Remova a assinatura ativa antes de aplicar outra"
   - Se `identity_state = text_only` → permitir aplicar VS (aplicar draft ou archived), desde que passe revalidação server-side
   - **Inclui `draft` na listagem com revalidação de drift obrigatória** — investigação confirmou que drafts gerados pelo pipeline atual têm `input_snapshot` no metadata e podem ser validados
4. **Integrar com `ApprovalModal`** — o placeholder "Galeria completa em breve" vira um botão "Ver versões recentes" que chama `onOpenGallery`
5. **Paginação simples** — botão "Ver versões anteriores" se realmente necessário (quando `total > 6`)
6. **Sem consumo de crédito** para visualizar ou reativar VS anterior
7. **Sem mexer em geração** — API de geração, consumo de crédito e pipeline de campanhas não são tocados

---

## Estado Atual

```
                                        ANTES                              DEPOIS (F29.1.2)
═══════════════════════════════════════════════════════════════════════════════════════════════════

VisualSignatureHistoryModal:
  Listagem                        todas as VS sem limite                  até 12 VS recentes
  Filtro                           nenhum                                 oculta critical_drift
                                                                          e missing_metadata
  Drift na UI                     sem badges de drift                     versões com drift não
                                     (só bloqueia no server)               aparecem na lista
  Ação p/ VS ativa                 "Restaurar" → erro 409                bloqueado com instrução
                                                                         "Remova a ativa primeiro"
  Ação p/ text_only                "Restaurar" → ok                       "Aplicar" → ok
  Paginação                        nenhuma                                opcional "Ver versões anteriores"
  Empty state                      "Nenhuma assinatura anterior"          mantido + refinado
  Error state                      básico                                  mantido
  Loading state                    spinner básico                          mantido

VisualSignatureApprovalModal:
  Placeholder "Galeria completa    texto não clicável                     "Ver versões recentes"
  em breve" (linha 547)                                                    → chama onOpenGallery()
  Prop onOpenGallery               inexistente                            [ADICIONAR] opcional

Arquivos:
  visual-signature-history-        lista sem filtro e sem                 [REESCREVER] lista curta
  modal.tsx                        paginação                              segura com regras
  visual-signature-approval-       sem onOpenGallery                      [ADICIONAR] prop + link
  modal.tsx
  store-visual-signature-          passa props básicas                    [ADICIONAR] onOpenGallery
  section.tsx                                                             no ApprovalModal
  store-identity-form.tsx          também abre HistoryModal               [ADICIONAR] callback
  approve/route.ts                 valida drift só p/ archived            [ALTERAR] validar drift
                                                                          p/ draft também
                                                                          (status !== 'active')
```

---

## Decisões de Alinhamento

### D1 — Substituir HistoryModal, não criar fase no ApprovalModal

`DECIDIDO`

A lista de VS é **gestão de histórico**, não parte do ciclo de geração/aprovação. Misturar os dois no `ApprovalModal` sobrecarrega um componente que já gerencia 10 fases (`checking`, `generating`, `display`, `feedback`, `approving`, `review`, `insufficient_credits`, `error`, `bp_failed`, `done`).

```
Certo:                             Errado:
  ApprovalModal → focado em        ApprovalModal com phase "gallery"
  gerar/aprovar                    mistura dois produtos mentais
                                    diferentes
       ↓
  HistoryModal → upgrade
  focado em gerenciar
  versões existentes
```

Fluxo integrado:
1. Usuário está no `ApprovalModal` (review phase ou display phase)
2. Clica "Ver versões recentes"
3. `ApprovalModal` chama `onOpenGallery()`
4. Parent fecha `ApprovalModal` e abre `HistoryModal` melhorado
5. Ao concluir ou fechar o histórico, usuário retorna ao contexto anterior

**Mudanças concretas:**

| Componente | Mudança |
|------------|---------|
| `VisualSignatureApprovalModal` | Adicionar prop opcional `onOpenGallery?: () => void` |
| | Placeholder "Galeria completa em breve" vira link/botão que chama `onOpenGallery()` |
| | Placeholder só aparece se `totalSignatures > 6` (já existe) |
| `VisualSignatureHistoryModal` | Reescrever com novo layout, regras e paginação |
| `StoreVisualSignatureSection` | Passar `onOpenGallery` ao `ApprovalModal` |
| | `HistoryModal` continua sendo aberto diretamente via botão "Assinaturas anteriores" |

### D2 — Filtro de versões incompatíveis: client-side

`DECIDIDO`

A API `GET /api/store/[id]/visual-signature` continua retornando **todas** as VS, sem filtro novo. O componente filtra visualmente:

```typescript
// HistoryModal — filtra antes de renderizar
const applicableSignatures = signatures.filter(s =>
  s.restore_eligibility?.reason === "ok"
);
```

**Regra de exibição:**

| `restore_eligibility.reason` | Aparece na lista? |
|-----------------------------|-------------------|
| `ok` | Sim |
| `critical_drift` | **Não** — oculto |
| `missing_metadata` | **Não** — oculto |

**Ressalvas:**

1. **A ação final nunca confia no filtro client-side.** O `POST /restore` e `POST /approve` sempre revalidam drift no servidor. O filtro é apenas de UX.
2. **O `total` exibido é o total filtrado**, não o total da API. Se a API retorna 12 e 4 são ocultadas, a lista mostra 8. Se necessário, uma linha discreta pode informar "Algumas versões antigas estão indisponíveis por incompatibilidade com os dados atuais."
3. **Paginação client-side** — se houver "Ver mais", o botão carrega o próximo lote da API e filtra de novo. Isso pode fazer o botão desaparecer se as próximas páginas só tiverem VS incompatíveis. Comportamento aceitável para escopo curto.

**Por que não server-side:** A API hoje é uma fonte de diagnóstico. Se ela começar a "sumir" com itens via `?filter=applicable`, criamos dois modos de verdade que aumentam confusão em testes, debug e telas futuras. Para escopo curto, client-side é suficiente e menos invasivo.

### D3 — Ações condicionais ao estado de identidade

`DECIDIDO`

As ações disponíveis dependem do `identity_state` da loja:

```
identity_state = "visual_signature" (VS ativa existe)
  └── VS archived: ❌ Bloqueado
  └── VS draft:     ❌ Bloqueado
  └── VS active:    ✅ "Em uso" (info, sem ação)
  └── Instrução:    "Remova a assinatura ativa antes de aplicar outra versão"

identity_state = "text_only" (nenhuma VS ativa)
  └── VS archived:  ✅ "Aplicar" → POST /approve  (com revalidação)
  └── VS draft:     ✅ "Aplicar" → POST /approve  (com revalidação)
  └── VS active:    ❌ Não deveria existir (consistência)
```

**Implementação:**

```typescript
function canApply(identityState: string | null): boolean {
  return identityState === "text_only";
}
```

**Regra final:** `visual_signature`, `logo` e `null`/`loading` bloqueiam aplicação. Apenas `text_only` permite aplicar.

O botão de ação:
- Se `canApply = true` → exibe "Aplicar" (habilitado, com revalidação server-side)
- Se `canApply = false` → exibe bloqueio com mensagem contextual:

```typescript
function blockMessage(identityState: string | null): string {
  if (identityState === "visual_signature") {
    return "Remova a assinatura ativa antes de aplicar outra versão";
  }
  if (identityState === "logo") {
    return "Remova o logotipo ativo antes de aplicar uma assinatura visual";
  }
  return "Aguarde o carregamento da identidade da loja";
}
```

**Mudança obrigatória no backend — validar drift também para `draft`:**

Investigação no código atual (`approve/route.ts:406`) revelou que a validação de drift só ocorre para `signature.status === 'archived'`:

```typescript
// Código atual — APENAS archived
if (signature.status === 'archived') {
  const metadata = (signature.metadata ?? {}) as Record<string, unknown>;
  const inputSnapshot = metadata.input_snapshot as ...;
  const driftResult = validateDrift({...});
  if (driftResult.has_drift) { /* bloqueia */ }
}
// draft passa direto sem validação
```

Drafts gerados pelo pipeline atual (`generate-without-logo/route.ts`) **têm** `input_snapshot` no metadata (confirmado nas linhas 326-355 e 267-299 do generate). Portanto, a validação de drift é possível e deve ser aplicada.

**Ação:** mudar a condição de `'archived'` para `!== 'active'`:

```typescript
// Depois — archived OU draft
if (signature.status !== 'active') {
  const metadata = (signature.metadata ?? {}) as Record<string, unknown>;
  const inputSnapshot = metadata.input_snapshot as ...;
  const driftResult = validateDrift({...});
  if (driftResult.has_drift) { /* bloqueia */ }
}
```

Isso cobre tanto `archived` quanto `draft`. O caso de aprovação imediatamente após geração (fluxo normal dentro do ApprovalModal) continua funcionando porque o `input_snapshot` acabou de ser salvo com os dados atuais — a validação passa sem bloqueio.

**Sobre o fluxo de substituição:** implementar troca de VS ativa por outra (substitution mode) está **fora do escopo**. O usuário precisa remover a ativa primeiro (via DELETE no `StoreVisualSignatureSection` ou no próprio history modal, se adicionarmos ação de remoção). Isso protege o núcleo de drift e evita complexidade de transação.

**Conflito com spec existente:** `openspec/specs/visual-signature-restore/spec.md` linha 20 afirma que `identity_state = 'visual_signature'` é permitido para restore/swap. Isso conflita com a decisão D3. O spec precisa ser atualizado (ou marcado como obsoleto) para refletir que restore/apply sobre VS ativa não é permitido nesta fase.

### D4 — Paginação: "Ver versões anteriores" simples

`DECIDIDO`

Se o número de VS aplicáveis exceder 6, exibe **um único** botão "Ver versões anteriores". Após carregar o segundo lote (totalizando no máximo 12 itens), o botão **some permanentemente** — mesmo que a API tenha mais registros. Não há paginação infinita.

```
┌─────────────────────────────────────┐
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ VS #1  │ │ VS #2  │ │ VS #3  │  │
│  └────────┘ └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ VS #4  │ │ VS #5  │ │ VS #6  │  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  [   Ver versões anteriores  ]     │  ← só aparece se total > 6
└─────────────────────────────────────┘
```

**Regras:**
- Carga inicial: `limit=6`
- Máximo da fase: **12 itens** (carga inicial + 1 "Ver versões anteriores")
- Botão "Ver versões anteriores" some após carregar o segundo lote
- Componente re-filtra cada lote (client-side) e acumula

### D5 — Sem consumo de crédito

`DECIDIDO`

Visualizar ou reativar uma VS anterior **nunca** consome crédito. O crédito só é cobrado em nova geração (F29.1.1). O fluxo de `approve` para VS archived/draft:
- Se a VS já existe e está archived → `POST /approve` (reativa sem gerar nova)
- Se a VS já existe e está draft → `POST /approve` (aprova sem gerar nova, sem reserva de crédito)
- Nenhum desses caminhos chama `reserveCredit`

**Revalidação de drift é gratuita** — usa `validateDrift()` (cálculo local, sem custo de IA).

---

## Estrutura de Código

```
ARQUIVOS MODIFICADOS:
══════════════════════

src/components/flow/visual-signature-history-modal.tsx  [REESCREVER]
  ← Substituir implementação atual (240 linhas) por novo componente
  ← Props atualizadas:
      { isOpen, onClose, storeId, identityState: string | null,
        onApplied?: () => void }
  ← Adicionar lógica de estado:
      - Carregar via GET /visual-signature?limit=<N>&offset=<M>
      - Filtrar aplicáveis (restore_eligibility.reason === "ok")
      - Exibir em grid 3 colunas (mesmo layout do review phase)
      - Badge de status: "Ativa", "Arquivada", "Rascunho"
      - Ação condicional baseada em canApply(identityState)
      - "Ver versões anteriores" se offset < total E offset < 6 (máx 12 itens)
      - Estados: loading, error, empty (mantidos/refinados)
  ← Novo layout:
    ┌─────────────────────────────────────────┐
    │  Assinaturas Visuais                     │
    │                                         │
    │  ┌────────┐ ┌────────┐ ┌────────┐      │
    │  │ VS #1  │ │ VS #2  │ │ VS #3  │      │
    │  │ badge  │ │ badge  │ │ badge  │      │
    │  │[Aplicar]│ │[Aplicar]│ │[Bloq.] │      │
    │  └────────┘ └────────┘ └────────┘      │
    │                                         │
    │  [   Ver versões anteriores   ]        │
    │                                         │
    │  [Cancelar]                             │
    └─────────────────────────────────────────┘

src/components/flow/visual-signature-approval-modal.tsx  [MODIFICAR]
  ← [ADICIONAR] prop:
      onOpenGallery?: () => void
  ← [MODIFICAR] placeholder "Galeria completa em breve" (linha 545-549):
      De:
        <p className="text-xs text-text-muted font-body text-center">
          Há mais versões no histórico. Galeria completa em breve.
        </p>
      Para:
        {onOpenGallery && (
          <button type="button" onClick={onOpenGallery}
            className="text-xs text-accent-blue hover:text-accent-blue/80 underline
                       font-body transition-colors duration-200"
          >
            Ver versões recentes
          </button>
        )}
  ← O placeholder continua aparecendo apenas quando totalSignatures > 6

src/components/flow/store-visual-signature-section.tsx  [MODIFICAR]
  ← [ADICIONAR] callback handleOpenGallery:
      () => { setShowApprovalModal(false); setShowHistoryModal(true); }
  ← [ADICIONAR] passar onOpenGallery={handleOpenGallery} ao ApprovalModal
  ← Manter botão "Assinaturas anteriores" (já abre HistoryModal diretamente)

src/components/flow/store-identity-form.tsx  [MODIFICAR]
  ← [ADICIONAR] callback similar para abrir HistoryModal a partir do ApprovalModal
  ← Se identity-form usa VisualSignatureApprovalModal com mode='standard',
    passar onOpenGallery que abre o HistoryModal

NENHUM ARQUIVO CRIADO:
════════════════════════
  Sem novos arquivos. Apenas modificações nos 4 componentes acima.

MUDANÇAS NA API (1 arquivo, 1 linha lógica):
═════════════════════════════════════════
  GET /api/store/[id]/visual-signature — sem alterações
  POST /approve — [ALTERAR] condição de drift validation:
                    De: if (signature.status === 'archived')
                    Para: if (signature.status !== 'active')
                    Motivo: validar drift também para draft
  POST /restore — sem alterações (já valida drift)
  DELETE /visual-signature — sem alterações

  Sem nova rota, sem migration, sem schema change.
```

---

## Contratos de Integração

### HistoryModal → API (GET /visual-signature)

```
REQUEST:
  GET /api/store/[storeId]/visual-signature?limit=6&offset=0

RESPONSE (mesmo contrato existente):
  {
    signatures: [
      {
        id: string,
        assetUrl: string,
        type: string,
        status: "draft" | "active" | "archived",
        attempt: number,
        created_at: string,
        approved_at: string | null,
        art_direction: { visual_direction, content_used } | null,
        restore_eligibility: {
          can_restore: boolean,
          drift_fields: string[],
          requires_regeneration: boolean,
          reason: "ok" | "critical_drift" | "missing_metadata"
        },
        critical_drift: { status, fields, reason } | null
            // só presente se status === "active"
      }
    ],
    total: number
  }

CLIENT-SIDE FILTER:
  applicable = signatures.filter(s =>
    s.restore_eligibility?.reason === "ok"
  )
```

### HistoryModal → POST /approve (aplicar VS archived/draft)

```
REQUEST:
  POST /api/store/[storeId]/visual-signature/approve
  { signatureId: "uuid-da-vs" }

  Nota: o approve route atual trata standard e substitution mode.
  Para archived/draft, o fluxo é idêntico ao de aprovação normal:
  valida drift → torna status='active' → atualiza identity_state →
  executa BrandProfiler.

  A validação de drift agora cobre TANTO archived QUANTO draft
  (condição alterada de status === 'archived' para !== 'active').

RESPONSE SUCCESS:
  { success: true, signature: { id, assetUrl }, brandProfile, ... }

RESPONSE DRIFT:
  { error: "...", drift: { critical: true, fields: [...], reason: "critical_drift" } }

CRÉDITO:
  Nenhuma reserva ou consumo de crédito neste fluxo.
  O crédito só é consumido em POST generate-without-logo.
```

### ApprovalModal → HistoryModal (bridge)

```
VisualSignatureApprovalModal:
  interface Props {
    // ... props existentes ...
    onOpenGallery?: () => void;
  }

  // No review phase, quando totalSignatures > 6:
  {onOpenGallery && (
    <button onClick={onOpenGallery}>
      Ver versões recentes
    </button>
  )}

StoreVisualSignatureSection:
  const handleOpenGallery = useCallback(() => {
    setShowApprovalModal(false);
    setShowHistoryModal(true);
  }, []);

  <VisualSignatureApprovalModal
    ...
    onOpenGallery={handleOpenGallery}
  />
```

### HistoryModal — ações por estado de identidade

```typescript
// Prop: identityState: string | null (recebida do parent)

// Regra: apenas text_only permite aplicar
const canApply = identityState === "text_only";

function blockMessage(identityState: string | null): string {
  if (identityState === "visual_signature") {
    return "Remova a assinatura ativa antes de aplicar outra versão";
  }
  if (identityState === "logo") {
    return "Remova o logotipo ativo antes de aplicar uma assinatura visual";
  }
  return "Aguarde o carregamento da identidade da loja";
}

// Render do card:
{canApply ? (
  <button onClick={() => handleApply(sig.id)} className="bg-accent-green ...">
    Aplicar
  </button>
) : (
  <button disabled className="bg-bg-elevated text-text-muted cursor-not-allowed ..."
    title={blockMessage(identityState)}>
    Indisponível
  </button>
)}

// Caso especial: se sig.status === "active", não mostrar ação,
// apenas badge "Ativa"
```

---

## Testes

Testes seguindo padrão do repositório (vitest + testing-library):

### Filtro e exibição (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | API retorna 8 VS (6 ok, 2 critical_drift) → lista exibe 6 | Filtro client-side ok |
| 2 | API retorna 8 VS (todas ok) → lista exibe 8 | Nenhuma ocultada indevidamente |
| 3 | API retorna 0 VS → empty state "Nenhuma assinatura" | Empty state |
| 4 | API retorna erro → error state com mensagem | Error state |
| 5 | Loading → spinner visível | Loading state |

### Ações por identidade (6 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 6 | `identity_state = visual_signature` → botão "Aplicar" desabilitado com tooltip | Bloqueio correto |
| 7 | `identity_state = text_only` → botão "Aplicar" habilitado | Permissão correta |
| 8 | VS status "active" → sem botão de ação, apenas badge "Ativa" | VS ativa é info-only |
| 9 | Clicar "Aplicar" em VS archived → chama POST /approve com signatureId | Ação correta |
| 10 | Clicar "Aplicar" em VS draft → chama POST /approve com signatureId | Draft também aplicável |
| 11 | POST /approve com draft sem drift → ativa com sucesso | Revalidação de draft OK |

### Backend — revalidação de drift em draft (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 12 | POST /approve com draft recém-gerado (snapshot = current store) → 200, VS ativada | Fluxo normal de aprovação não quebrado |
| 13 | POST /approve com draft sem drift (snapshot igual a current) → 200, VS ativada | Draft sem drift passa |
| 14 | POST /approve com draft COM drift (snapshot ≠ current) → 409 bloqueado | Draft com drift barrado |
| 15 | POST /approve com draft sem input_snapshot → 409 missing_metadata | Draft antigo barrado |

### Paginação (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 16 | Total = 6 → sem "Ver mais" | Limite exato |
| 17 | Total = 7 → "Ver versões anteriores" visível | Paginação aparece |
| 18 | Clicar "Ver versões anteriores" → carrega +6, total = 12, botão some | Máximo de 12 respeitado |
| 19 | Total = 20 → botão "Ver versões anteriores" some após 12 itens (não carrega tudo) | Galeria não infinita |

### Integração com ApprovalModal (3 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 20 | `onOpenGallery` não passada → placeholder "Galeria completa em breve" não aparece | Prop opcional |
| 21 | `onOpenGallery` passada + total > 6 → link "Ver versões recentes" visível | Integração ativa |
| 22 | Clicar link → `onOpenGallery` é chamado | Callback funciona |

### Regressão (4+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 23 | `npm run build` | Build OK |
| 24 | `npm run typecheck` | Types OK |
| 25 | `npm run lint` | Lint OK |
| 26 | `npx vitest run` | Testes existentes + novos passando |
| 27 | UAT: fluxo ApprovalModal → "Ver versões recentes" → HistoryModal → aplicar VS → sucesso | Sem quebra |
| 28 | UAT: fluxo HistoryModal com VS ativa → botão bloqueado → instrução visível | UX correta |
| 29 | UAT: aprovar VS recém-gerada (fluxo normal no ApprovalModal) → drift não bloqueia | Regressão do backend fix |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Usuário confuso entre "Ver versões recentes" (no ApprovalModal) e "Assinaturas anteriores" (no StoreVS Section)** — dois caminhos para o mesmo destino | Aceitável. Ambos levam ao HistoryModal. O ApprovalModal só mostra o link quando há mais de 6 versões. O StoreVS Section mostra "Assinaturas anteriores" sempre que há archived. São contextos diferentes (geração/aprovação vs. gestão) |
| **Filtro client-side vs. paginação** — "Ver versões anteriores" pode carregar uma página cheia de VS inaplicáveis, fazendo o botão sumir sem feedback | Aceitável para escopo curto. Em fase futura (galeria real), resolve-se com server-side filtering |
| **POST /approve em VS archived/draft pode falhar por drift não detectado no client** — o filtro client-side só considera `restore_eligibility.reason === "ok"`, então tecnicamente não deveria falhar. Mas se o estado da loja mudar entre o load e o click, o server-side barra | OK. O modal exibe mensagem de erro com explicação do drift (já retornada pelo approve route) |
| **VS draft sem `input_snapshot`** — drafts gerados pelo pipeline atual (pós-F4.6.4) têm snapshot. Drafts muito antigos (pré-snapshot) têm `missing_metadata` e são ocultados pelo filtro | Aceitável. O filtro cobre drafts antigos. Drafts recentes têm snapshot e passam na validação. Pipeline atual sempre salva snapshot |
| **Modal stack confuso** — ApprovalModal fecha, HistoryModal abre, usuário "volta" e não reencontra o ApprovalModal | Ao fechar HistoryModal sem aplicar, o usuário volta ao StoreVS Section, que tem o botão "Criar / Alterar". Se veio do ApprovalModal, o contexto de geração é perdido — mas é o mesmo comportamento de fechar o ApprovalModal e reabrir |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Galeria gigante com paginação completa, filtros combinados, busca | Fase futura. Esta fase é lista curta e segura |
| Substituição de VS ativa (substitution mode no HistoryModal) | Complexidade alta, risco de drift. Usuário remove ativa primeiro |
| Server-side filtering (`?filter=applicable`) | Não necessário para escopo curto. Client-side suficiente |
| Modal stack (HistoryModal dentro do ApprovalModal) | Aumenta complexidade de estado. Parent fecha um e abre outro |
| Nova API route ou migration de schema | Nenhuma rota nova nem migration. Apenas 1 linha alterada no `POST /approve` (condição de drift) |
| Consumo de crédito para visualizar ou reativar VS | Sempre gratuito. Crédito só em nova geração |
| Redesenho do ApprovalModal | Apenas adicionar prop `onOpenGallery` + link |
| Remoção do HistoryModal antigo | Substituído pelo novo, mas mantido no mesmo arquivo (reescrito) |
| Exibição de VS com critical_drift ou missing_metadata | Ocultas da lista. Se o usuário perguntar, fase futura pode ter "Mostrar versões incompatíveis" |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — HistoryModal substituído (não fase gallery no ApprovalModal)
- [ ] D2 — Filtro client-side de critical_drift e missing_metadata
- [ ] D3 — Ações condicionais ao identity_state (bloqueado se VS ativa)
- [ ] D4 — Paginação simples "Ver versões anteriores" (máx. 12 itens)
- [ ] D5 — Sem consumo de crédito para visualizar ou reativar
- [ ] D6 — ApprovalModal ganha prop `onOpenGallery`

### visual-signature-history-modal.tsx (reescrever)
- [ ] Carregar via GET /visual-signature?limit=6&offset=N
- [ ] Filtrar `restore_eligibility.reason === "ok"`
- [ ] Grid 3 colunas com badge de status
- [ ] Botão "Aplicar" condicional (identity_state)
- [ ] Bloqueio com instrução quando VS ativa existe
- [ ] "Ver versões anteriores" quando offset < total E offset < 6 (máx. 12)
- [ ] Loading, error, empty states
- [ ] Ação "Aplicar" → POST /approve (sem reserva de crédito)
- [ ] Tratamento de erro do approve (drift, etc.)

### visual-signature-approval-modal.tsx (modificar)
- [ ] [ADICIONAR] `onOpenGallery?: () => void` nas Props
- [ ] [MODIFICAR] Placeholder vira link clicável que chama `onOpenGallery`
- [ ] Placeholder só aparece se `totalSignatures > 6`

### store-visual-signature-section.tsx (modificar)
- [ ] [ADICIONAR] `handleOpenGallery` que fecha approval e abre history
- [ ] [ADICIONAR] Passar `onOpenGallery` ao ApprovalModal

### store-identity-form.tsx (modificar)
- [ ] [ADICIONAR] callback similar para abrir HistoryModal via onOpenGallery

### approve/route.ts (modificar)
- [ ] [ALTERAR] Condição de drift validation: `signature.status === 'archived'` → `signature.status !== 'active'`

### store-identity-form.tsx (modificar)
- [ ] [ADICIONAR] State `showHistoryModal` + render condicional do HistoryModal
- [ ] [ADICIONAR] Passar `identityState` ao HistoryModal
- [ ] [ADICIONAR] `onApplied` callback que recarrega estado da loja

### Spec pendente
- [ ] Atualizar `openspec/specs/visual-signature-restore/spec.md` linha 20: `'visual_signature'` passa a ser BLOQUEADO (session apenas texto sobre fase futura de substitution)

### Testes
- [ ] Filtro e exibição (5+ testes)
- [ ] Ações por identidade (6+ testes)
- [ ] Backend: revalidação de drift em draft (4+ testes) — inclui teste de regressão do fluxo normal
- [ ] Paginação (4+ testes) — inclui teste de limite de 12
- [ ] Integração com ApprovalModal (3+ testes)
- [ ] Regressão: build, typecheck, lint, vitest
- [ ] UAT: fluxo ApprovalModal → HistoryModal → aplicar VS

---

*Documento criado: 2026-07-21 — atualizado 2026-07-21 (investigação de draft + backend fix)*
*Baseado em discussão exploratória sobre o escopo seguro de histórico de assinatura visual.*
*Próximo passo: revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
