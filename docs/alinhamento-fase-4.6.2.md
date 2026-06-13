# Alinhamento Fase 4.6.2 — Visual Direction Adjust on Store Form Alterations

## Nomenclatura das Fases 4.6

```
4.6  — Store Form Adjusts                    (fase mãe)
 ├── 4.6.1 — Text Only Coverage              (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection ← esta fase
 ├── 4.6.3 — Logo fluxo: brand_colors_chosen  (pendente)
 ├── 4.6.4 — Visual Signature fluxo          (pendente)
 └── 4.6.x — Transições entre estados        (pendente)
```

Esta fase (4.6.2) é a segunda subfase da 4.6 e trata da detecção de desalinhamento da direção visual quando o lojista altera campos sensíveis da loja cadastrada.

---

## Propósito

Quando o lojista altera dados cadastrais da loja que impactam a identidade visual — segmento, subsegmento, tom de voz ou nome fantasia — a direção visual existente (brand profile ativo) pode ficar desalinhada com o novo perfil da loja.

O sistema deve:
1. **Detectar** quando campos sensíveis foram alterados desde a última geração do brand profile
2. **Informar** o lojista sobre o desalinhamento via banner ou botão discreto no Step 2
3. **Oferecer realinhamento** sob demanda, com mínima fricção
4. **Interromper com modal** apenas em ações de alto impacto (gerar campanha/exportar) onde o desalinhamento afeta o resultado

---

## Onde o Input Snapshot Vive

**Decisão:** Não usar `stores.previous_identity_snapshot` (reservado para transições de estado entre identity_state). Usar `store_brand_profiles.metadata.input_snapshot`.

```
store_brand_profiles.metadata.input_snapshot = {
  "segment": "moda-feminina",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "brand_color": "#FF6B6B",
  "accent_color": "#4ECDC4"
}
```

Inclui cores para que color drift também seja detectado entre sessões (não apenas por dirty tracking na sessão atual).

**Quando populado:** imediatamente após toda re-inferência bem-sucedida (text_only, logo ou visual_signature).

**Motivo da decisão:** `previous_identity_snapshot` foi projetado para registrar o estado anterior antes de uma transição de identidade (ex: logo → text_only). Usá-lo para drift criaria conflito de semântica. O `metadata.input_snapshot` fica colado ao profile que o gerou — semanticamente correto e sem migration nova.

---

## Campos Sensíveis vs Não Sensíveis

O prompt real de inferência (`prompts/store-brand-inference.md`) dita o peso de cada campo:

### Sensíveis (gatilho individual)

| Campo | Peso | Motivo |
|-------|------|--------|
| `segment` | 🔴 Alto | Prompt: "fator principal para decisão de cores e estilo" |
| `subsegment` | 🔴 Alto | Refina direção dentro do segmento (moda fem × masc) |
| `tone_of_voice` | 🟠 Médio-alto | Mapeia direto pra visual_tone + visual_style |
| `name` | 🟡 Médio | Altera percepção da marca (Doces da Vovó ≠ TechZone) |

**Regra:** qualquer um desses campos, alterado sozinho ou em conjunto, é suficiente para acionar a detecção de drift.

### Tratamento Especial

| Campo | Tratamento |
|-------|------------|
| `brand_color` / `accent_color` | Persistência entre sessões via `input_snapshot` (comparado vs store atual). Dirty tracking no form complementa UX na sessão (deteccao em tempo real durante edição). Prompt específico de cores. Se alterado junto com campos sensíveis, entra no prompt padrão. |

### Não Sensíveis

| Campo | Motivo |
|-------|--------|
| `positioning` | Influencia brand_personality, mas sozinho não justifica re-inferência |
| `short_description` | Contexto de campanha, não de identidade visual |
| `slogan` | Afeta copy/assinatura, não direção visual |
| `city` | Contexto regional mínimo |
| `state` | Contexto regional mínimo |

**Decisão:** `positioning` fica fora dos campos sensíveis. Se necessário, tratar em ocasião futura.

---

## Detecção de Drift

```
  LOJA EXISTENTE (modo edit):
       │
       ▼
  Carrega store + brand_profile ativo
       │
       ▼
  Extrai input_snapshot do profile ativo:
    metadata.input_snapshot = {
      segment, subsegment, tone_of_voice, name,
      brand_color, accent_color
    }
       │
       ▼
  Compara store.current com input_snapshot
  (brand_color comparado vs store.current.brand_color,
   accent_color comparado vs valor carregado no form
   — que pode vir de brand_colors_chosen[1],
     inferred_accent_color, ou safe_color_tokens.accent)
       │
       ├── Iguais?           → sem drift
       ├── Diferentes?       → hasDrift = true (campos ou cores)
       └── Snapshot = null?  → profile antigo sem metadata → sem drift
                                (comportamento seguro, não quebra lojas existentes)
```

**Detecção de cores na sessão atual (dirty tracking):**

```
  No mount: captura valor inicial de brand_color e accent_color
  (qualquer origem — brand_colors_chosen, inferred_*, fallback)
       │
       ▼
  Tracking: onChange compara valor atual vs valor inicial
  Se mudou → marca como colorDirty (usado para decisões de UX
  na sessão corrente — ex: prompt específico de "só cores")
```

**Nota sobre persistência entre sessões:** As cores estão incluídas no `input_snapshot` e são comparadas contra os valores atuais da store. Isso garante que color drift persiste entre sessões mesmo sem dirty tracking. O dirty tracking é um **complemento de UX** para detectar que o usuário acabou de alterar na sessão atual (útil para decidir o texto do prompt). `brand_colors_chosen`, `safe_color_tokens` e `inferred_*` não são usados como fonte de comparação — o único comparador é o `input_snapshot`.

**Loja nova:** modo `"create"` → sem detecção de drift. O que ele definir vira a linha de base.

---

## Persistência de Dismiss (atravessa sessões)

Para que o banner não reapareça a cada sessão quando o usuário já o dispensou, o estado de dismiss precisa ser persistido no servidor.

**Alvo de comparação:** `drift_dismissed_snapshot` armazena os **valores atuais da loja no momento do dismiss** — não o `input_snapshot`. A lógica de detecção é:

```
  A cada carregamento:
       │
       ▼
  store_atual ≠ input_snapshot?
       │
       ├── Não → sem drift (fluxo normal)
       │
       └── Sim → drift existe. Já foi dispensado?
              │
              ├── drift_dismissed_snapshot existe
              │   E store_atual == drift_dismissed_snapshot?
              │   → Sim: mesmo drift de antes → botão discreto
              │
              └── drift_dismissed_snapshot não existe
                  OU store_atual ≠ drift_dismissed_snapshot?
                  → drift novo ou alterado → banner
```

**Por que comparar contra `store_atual`, não `input_snapshot`:**

```
  Exemplo:
  1. Store corrente = { segment: "moda", name: "A" }
     input_snapshot    = { segment: "moda", name: "A" }  ← alinhado
  2. User altera name para "B" → salva
     Store = { segment: "moda", name: "B" }
     input_snapshot ainda = { segment: "moda", name: "A" }
     → drift detectado (store ≠ input_snapshot)
  3. User clica "Ignorar"
     drift_dismissed_snapshot = { segment: "moda", name: "B" } ← store atual
  4. User altera name para "C" → salva
     Store = { segment: "moda", name: "C" }
     input_snapshot ainda = { segment: "moda", name: "A" }
     drift_dismissed_snapshot = { segment: "moda", name: "B" }
     → store_atual (C) ≠ input_snapshot (A) → drift existe
     → store_atual (C) ≠ drift_dismissed_snapshot (B) → drift NOVO → banner
```

Se comparássemos contra `input_snapshot` (como estava antes), o passo 4 ainda veria `drift_dismissed_snapshot == { name: "B" }` vs `input_snapshot == { name: "A" }` — diferente, então banner apareceria também. Mas o problema inverso ocorreria se após o passo 3 o usuário **revertesse** o name para "A": o store_atual voltaria a ser igual ao input_snapshot (sem drift), mas o dismiss ainda compararia contra input_snapshot e poderia mostrar banner indevidamente. Comparar contra store_atual resolve: se não há drift, não há banner, independente do estado de dismiss.

```
store_brand_profiles.metadata.drift_dismissed_snapshot = {
  "segment": "moda-feminina",
  "subsegment": "moda-feminina",
  "tone_of_voice": "elegante",
  "name": "Maria Boutique",
  "brand_color": "#FF6B6B",
  "accent_color": "#4ECDC4"
}
```

**Regra:**
- `drift_dismissed_snapshot` existe **e** `store_atual == drift_dismissed_snapshot` → mesmo drift já dispensado → botão discreto
- `drift_dismissed_snapshot` não existe **ou** `store_atual ≠ drift_dismissed_snapshot` → drift novo ou alterado → banner
- Após realinhamento bem-sucedido → atualizar `input_snapshot` com dados atuais, remover `drift_dismissed_snapshot`

Isso garante que:
- O usuário que ignorou o aviso não vê banner de novo para o **mesmo** drift
- Se ele alterar mais campos (drift muda), o banner reaparece
- Se ele reverter as alterações (drift some), o banner também some
- O estado cruza sessões, navegadores e dispositivos

---

## Princípio de UX

**Mínima fricção possível.** O drift é informado, não imposto. O usuário só é interrompido com modal quando a ação é de alto impacto (gerar campanha/exportar). Para salvar ou sair do Step 2, não há interrupção — o banner/botão discreto é suficiente.

---

## Gatilhos de Exibição

### Gatilho 1 — Step 2 montou (banner ou botão)

```
  Step 2 montou
       │
       ▼
  Detecta drift
       │
       ├── Sem drift → fluxo normal (sem indicação)
       │
        ├── Drift presente + já foi dispensado (drift_dismissed_snapshot
        │   existe e store_atual == drift_dismissed_snapshot):
        │   └── Botão discreto:
       │       [↻ Realinhar direção visual]
       │
       ├── Drift presente + nunca foi dispensado (ou snapshot mudou):
       │   └── Banner sutil:
       │       ┌───────────────────────────────────────────────┐
       │       │  ⚠ Dados alterados desde a última             │
       │       │  direção visual                                │
       │       │                                                │
       │       │  [Realinhar]    [Ignorar]                     │
       │       └───────────────────────────────────────────────┘
       │
       └── Só cores alteradas → mesmo padrão:
           ├── Banner:  [Realinhar]    [Ignorar]
           └── Botão:   [↻ Realinhar direção visual]
               (mesmo botão — drift ou cores, é o mesmo realinhamento)
```

- **Realinhar:** re-inferência in-place (ou reavaliação se só cores). Toast de sucesso.
- **Ignorar:** PATCH `store_brand_profiles.metadata.drift_dismissed_snapshot` com o snapshot atual. Banner vira botão discreto.
- **Botão discreto:** posicionado no Step 2. Se clicar, mesma re-inferência in-place.

### Gatilho 2 — Salvou Step 2 (sem interrupção)

```
  Clicou "Salvar" no Step 2
       │
       ▼
  Salva dados da loja (PATCH) + cores (se alteradas)
       │
       ▼
  Drift → persiste (não bloqueia)
  → Botão discreto permanece visível (se não realinhou)
  → Sucesso normal sem prompt
```

**Não há modal.** O banner/botão já informa o drift. Salvar não é uma ação de alto impacto que exija interrupção.

### Gatilho 3 — Sair do Step 2 com drift

```
  Clicou "Voltar", navegou para outra rota ou fechou a aba
       │
       ▼
  Há dados não salvos no formulário?
       │
       ├── Sim → beforeunload nativo ("Tem certeza?")
       │         (apenas para dados não salvos, NÃO por drift)
       │
       └── Não → saída livre (dados já foram salvos no PATCH)
```

**"Voltar" (setStep 1) ou navegação interna:** dados já persistidos no PATCH do Step 1 → sem perda → sem interrupção.

**"Fechou aba/janela":** beforeunload nativo (única opção do browser). Acionado apenas se houver formulário sujo com dados não persistidos.

**Drift isoladamente nunca dispara beforeunload.** O banner/botão já informa o desalinhamento. Se o usuário quer sair sem realinhar, é uma decisão válida — o drift estará visível no próximo retorno.

### Gatilho 4 — Retorno futuro com drift não resolvido

```
  User abre o sistema (qualquer tela)
       │
       ▼
  Detecta drift
       │
        ├── Drift + já dispensado (drift_dismissed_snapshot existe
        │   e store_atual == drift_dismissed_snapshot):
        │   └── Botão discreto (sem banner)
       │
       ├── Drift + nunca dispensado (ou snapshot mudou):
       │   └── Banner (mesmo do Gatilho 1)
       │
       └── Sem drift → normal
```

**Realinhar:** re-inferência in-place. Toast. Tela permanece a mesma.
**Ignorar:** persiste dismiss no servidor. Banner vira botão discreto.

### Gatilho 5 — Gerar campanha / Exportar (ação de alto impacto)

```
  Clicou "Gerar campanha" ou "Exportar"
       │
       ▼
  Drift existe?
       │
       ├── Sim → modal:
       │   ┌───────────────────────────────────────────────────┐
       │   │  A direção visual da sua loja está                │
       │   │  desalinhada com os dados atuais.                 │
       │   │  A campanha pode não refletir o perfil            │
       │   │  atual da sua loja.                               │
       │   │                                                   │
       │   │  [Realinhar direção visual]  [Gerar mesmo assim]  │
       │   └───────────────────────────────────────────────────┘
       │
       └── Não → fluxo normal
```

- **Realinhar direção visual:** re-inferência in-place. Após sucesso, inicia geração da campanha automaticamente.
- **Gerar mesmo assim:** gera com a direção visual atual (drift ignorado para esta ação). Não atualiza estado de dismiss.

Este é o **único modal** do sistema de drift. Reservado para ações onde a direção visual desalinhada tem impacto real no resultado.

---

## Fluxo de Realinhamento Silencioso (Prompt 4)

Quando o usuário clica "Realinhar agora" no Gatilho 4:

```
  1. Sistema monta brief com dados ATUAIS da loja e do formulário
     (store.name, segment, subsegment, tone_of_voice,
       brand_color mais recente — store ou form se alterado,
       accent_color mais recente — profile ou form se alterado)

  2. Chama POST /api/store/[id]/brand-profile/infer
     (mesma rota da fase 4.6.1, com userChosenColors
      se houverem)

  3. Persiste novo brand_profile + atualiza
     metadata.input_snapshot

  4. Tela PERMANECE a mesma
     (dashboard / store page / campaign page)

  5. Feedback: toast "✅ Direção visual realinhada"
     (3 segundos e some)
```

Sem navegação, sem modal gigante, sem empurrar pra preview.

---

## Modelo de Dados

### stores

| Campo | Tipo | Uso |
|-------|------|-----|
| `previous_identity_snapshot` | `jsonb` | Reservado para transições de estado (escopo futuro) |

Sem alterações no schema nesta fase.

### store_brand_profiles

| Campo | Tipo | Uso |
|-------|------|-----|
| `metadata` | `jsonb` | Já existe. Adicionar `input_snapshot` como subcampo. |

**input_snapshot structure:**

```json
{
  "input_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "brand_color": "#FF6B6B",
    "accent_color": "#4ECDC4"
  }
}
```

**Populado por:** toda re-inferência bem-sucedida (criar/atualizar brand profile).
**Consumido por:** detecção de drift no frontend (comparação com store atual).

**drift_dismissed_snapshot structure:**

```json
{
  "drift_dismissed_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "brand_color": "#FF6B6B",
    "accent_color": "#4ECDC4"
  }
}
```

Mesma estrutura do `input_snapshot`. Armazena os **valores da loja no momento em que o usuário clicou "Ignorar"** (não os valores do input_snapshot).

**Regra de exibição:**
- `store_atual == input_snapshot`? → sem drift (independente de dismiss)
- `store_atual ≠ input_snapshot` **e** `drift_dismissed_snapshot existe` **e** `store_atual == drift_dismissed_snapshot`? → mesmo drift já dispensado → botão discreto
- `store_atual ≠ input_snapshot` **e** (`drift_dismissed_snapshot` não existe **ou** `store_atual ≠ drift_dismissed_snapshot`)? → drift novo ou alterado → banner
- Após realinhamento bem-sucedido → atualizar `input_snapshot` com store_atual, remover `drift_dismissed_snapshot`

---

## Matriz de Decisão de UX

| O que mudou | hasDrift | hasColorDrift | Banner/Botão | Modal (só em gerar/exportar) |
|---|---|---|---|---|
| Só segmento | ✅ | ❌ | ✅ Padrão | ✅ "Realinhar ou Gerar mesmo assim" |
| Só tone_of_voice | ✅ | ❌ | ✅ Padrão | ✅ "Realinhar ou Gerar mesmo assim" |
| Só cores | ❌ | ✅ | ✅ Cores | ✅ "Realinhar ou Gerar mesmo assim" |
| Segmento + cores | ✅ | ✅ | ✅ Padrão | ✅ "Realinhar ou Gerar mesmo assim" |
| Nada | ❌ | ❌ | ❌ | ❌ |

---

## Tratamento de Re-inferência com Cores

Se o usuário alterou cores **e** tem drift de campos sensíveis, uma única re-inferência resolve ambos:

- `userChosenColors` recebe `[brand_color, accent_color]` atuais
- IA considera como preferência (não regra)
- Novo `safe_color_tokens` pode confirmar, ajustar ou substituir

Se foi **só cores**, o banner segue o mesmo padrão:

```
  ┌───────────────────────────────────────────┐
  │  ⚠ Cores alteradas desde a última         │
  │  direção visual                            │
  │                                            │
  │  [Realinhar]    [Ignorar]                 │
  └───────────────────────────────────────────┘
```

E, após ignorar, vira botão discreto `[↻ Realinhar direção visual]` — o mesmo botão, sem distinção entre drift de campos ou drift de cores. É o mesmo realinhamento.

---

## Fora de Escopo (subfases futuras)

| Item | Motivo |
|------|--------|
| `positioning` como campo sensível | Decisão: não incluir agora. Se necessário, tratar futuramente. |
| Campo de mensagens do sistema na UI | Será tratado na fase de UI da dashboard. |
| Transições entre identity_state | `previous_identity_snapshot` para transições logo↔text_only↔VS. Escopo de 4.6.x. |
| Validação do posicionamento do botão discreto | Definido no Step 2 nesta fase. Revisão por UI/UX expert antes de produção. |
| Persistência de dismiss entre sessões | `store_brand_profiles.metadata.drift_dismissed_snapshot`. |

---

## Histórico de Decisões

| Data | Decisão |
|------|---------|
| 2026-06-13 | Fase nomeada como 4.6.2 — Visual Direction Drift Detection, subfase da 4.6 |
| 2026-06-13 | `input_snapshot` vive em `store_brand_profiles.metadata`, não em `stores.previous_identity_snapshot` |
| 2026-06-13 | Campos sensíveis: segment, subsegment, tone_of_voice, name. Positioning fica fora. |
| 2026-06-13 | Cores têm tratamento separado: prompt específico quando alteradas sozinhas |
| 2026-06-13 | Drift é detectado no client (comparação store vs input_snapshot do profile ativo) |
| 2026-06-13 | Gatilhos: Step 2 (banner ou botão), salvar (sem interrupção), sair (beforeunload nativo), retorno futuro (banner ou botão), gerar/exportar (modal — único) |
| 2026-06-13 | "Ignorar" segue mesmo padrão dos demais gatilhos: banner → botão discreto persistente. Não reaparece como banner. |
| 2026-06-13 | Realinhamento silencioso: re-inferência in-place, sem navegação forçada |
| 2026-06-13 | Loja nova (modo create) não tem detecção de drift |
| 2026-06-13 | Botão discreto posicionado no Step 2 do formulário da loja. Revisão por UI/UX expert antes de produção. |
| 2026-06-13 | Dismiss de banner persiste em `store_brand_profiles.metadata.drift_dismissed_snapshot`. Se snapshot mudar, banner reaparece. |
| 2026-06-13 | UX simplificada: banner + botão discreto são suficientes. Sem modal em salvar/sair. Único modal: ao gerar campanha ou exportar com drift ativo. |
| 2026-06-13 | "Fechar aba/janela" usa beforeunload nativo (sem modal customizado). |
| 2026-06-13 | Detecção de cores usa dirty tracking no form como complemento de UX na sessão. Para persistência entre sessões, cores estão incluídas no input_snapshot e comparadas vs store atual. |
| 2026-06-13 | Cores alteradas seguem mesmo padrão de UX: banner → botão discreto. Sem distinção visual entre drift de campos e drift de cores. |
| 2026-06-13 | `drift_dismissed_snapshot` armazena store_atual no momento do dismiss (não input_snapshot). Comparação é contra store_atual, não input_snapshot. |
| 2026-06-13 | beforeunload acionado apenas por dados não salvos, nunca por drift isoladamente. |
| 2026-06-13 | Realinhamento usa cores do formulário/store (mais recentes), não do profile ativo. |
