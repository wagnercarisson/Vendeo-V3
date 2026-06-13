## Context

Atualmente, quando o lojista altera dados cadastrais da loja (segmento, subsegmento, tom de voz, nome ou cores), o sistema apenas persiste os novos valores no banco — sem qualquer verificação se a direção visual existente (brand profile ativo) ainda é coerente com o novo perfil. O brand profile permanece congelado no estado que gerou a última inferência, independente de quantas alterações o lojista fizer depois.

O campo `stores.previous_identity_snapshot` existe no schema mas está reservado para transições de estado de identidade (text_only ↔ logo ↔ visual_signature). Não deve ser usado para detecção de drift.

O campo `store_brand_profiles.metadata` é `jsonb` e já existe — não requer migration. É o local natural para armazenar tanto o `input_snapshot` (dados que geraram o profile) quanto o `drift_dismissed_snapshot` (dados no momento do dismiss).

### Estado atual antes da mudança

```
PATCH /api/store/[id] → stores table atualizada
  ├── Sem side effects
  ├── Sem invalidação de brand profile
  └── Sem notificação ao usuário
```

## Goals / Non-Goals

**Goals:**
- Detectar automaticamente quando campos sensíveis (segment, subsegment, tone_of_voice, name, brand_color, accent_color) da loja divergem do snapshot que gerou o brand profile ativo
- Informar o lojista sobre o desalinhamento via banner ou botão discreto no Step 2 do formulário da loja
- Persistir a decisão de "ignorar" o aviso entre sessões, com a regra de que se os dados mudarem de novo, o banner reaparece
- Oferecer realinhamento sob demanda (re-inferência in-place) sem navegação forçada, restrito a superfícies de identidade da loja

**Non-Goals:**
- Transições entre identity_state (text_only ↔ logo ↔ visual_signature) — escopo de 4.6.x
- Notificações em dashboard — escopo futuro
- `positioning` como campo sensível — fora de escopo, tratado em ocasião futura se necessário
- Superfícies globais/dashboard/configurações — escopo futuro; nesta fase a UI fica restrita ao Step 2
- Botão discreto em telas fora do Step 2 — revisão UI/UX antes de produção
- Correção de escrita de `brand_colors_chosen` nos fluxos logo e visual_signature — escopo de 4.6.3 e 4.6.4
- **Geração de campanha não é alterada nesta fase** — o fluxo de campanha usa a direção visual ativa; drift ignorado é uma escolha persistida do usuário. Nenhum bloqueio ou modal no fluxo de campanha.

## Decisions

### D1 — Local do input_snapshot

| Alternativa | Veredito |
|---|---|
| `stores.previous_identity_snapshot` | ❌ Reservado para transições de estado |
| `store_brand_profiles.metadata.input_snapshot` | ✅ |

**Rationale:** `metadata` já é `jsonb`. Sem migration. O snapshot fica colado ao profile que o gerou — semanticamente correto. Não conflita com state transitions.

### D2 — Campos sensíveis

O prompt `store-brand-inference.md` dita o peso de cada campo. A classificação final:

| Campo | Sensível? | Critério |
|---|---|---|
| `segment` | ✅ Sim | "fator principal para decisão de cores e estilo" |
| `subsegment` | ✅ Sim | Refina direção dentro do segmento |
| `tone_of_voice` | ✅ Sim | Mapeia direto pra visual_tone + visual_style |
| `name` | ✅ Sim | Altera percepção da marca |
| `brand_color` / `accent_color` | 🔵 Tratamento especial | Incluído no input_snapshot para persistência entre sessões |
| `positioning` | ❌ Não | Sozinho não justifica re-inferência |
| `short_description` | ❌ Não | Contexto de campanha |
| `slogan` | ❌ Não | Copy/assinatura |
| `city` / `state` | ❌ Não | Contexto regional mínimo |

### D3 — Estrutura dos snapshots

```json
{
  "input_snapshot": {
    "segment": "moda-feminina",
    "subsegment": "moda-feminina",
    "tone_of_voice": "elegante",
    "name": "Maria Boutique",
    "brand_color": "#FF6B6B",
    "accent_color": "#4ECDC4"
  },
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

Ambos vivem em `store_brand_profiles.metadata`. Mesma estrutura. Semântica diferente:
- `input_snapshot`: valores que **geraram** o profile (populado pós-inferência)
- `drift_dismissed_snapshot`: valores da loja **no momento do dismiss** (populado via PATCH do metadata)

### D4 — Lógica de detecção

```
A cada carregamento do Step 2:

1. store_atual ≠ input_snapshot?
   ├── Não → sem drift (fluxo normal, sem indicação)
   └── Sim → drift existe

2. Drift existe + drift_dismissed_snapshot existe
   + store_atual == drift_dismissed_snapshot?
   → Mesmo drift já dispensado → botão discreto

3. Drift existe + (drift_dismissed_snapshot não existe
   OU store_atual ≠ drift_dismissed_snapshot)?
   → Drift novo ou alterado → banner
```

**Ponto crítico:** A comparação do dismiss é contra `store_atual`, não contra `input_snapshot`. Isso garante que se o usuário ignorou um drift e depois alterou os dados novamente, o banner reaparece. E se ele reverter as alterações (drift some), o banner também some — independente do estado de dismiss.

### D5 — Dirty tracking de cores

Cores têm duas camadas de detecção:

1. **Persistente (input_snapshot):** `brand_color` e `accent_color` estão incluídos no snapshot. Na carga do Step 2, o sistema monta um **current visual state** normalizado com os valores mais recentes disponíveis:
   - `segment`, `subsegment`, `tone_of_voice`, `name`: direto da `stores` table
   - `brand_color`: `stores.brand_color`
   - `accent_color`: `brand_colors_chosen[1]` (se exists) → `safe_color_tokens.accent` → `inferred_accent_color` (nesta ordem de prioridade)
   
   Esse objeto normalizado é comparado contra `input_snapshot` — se diferir em qualquer campo, drift é detectado. Isso resolve o fato de `accent_color` não ter coluna própria em `stores`.

2. **Sessão atual (dirty tracking):** No mount, captura o valor inicial de cada color picker (qualquer origem — `brand_colors_chosen`, `inferred_*`, `safe_color_tokens`, fallback). `onChange` compara valor atual vs inicial. Usado exclusivamente para decisões de UX na sessão corrente (ex: diferenciar "só alterou cores" de "alterou campos sensíveis + cores").

`brand_colors_chosen`, `safe_color_tokens` e `inferred_*` não são comparados diretamente entre si — só entram como fallback para normalizar o valor atual de `accent_color` no current visual state. Isso evita falso positivo quando `brand_colors_chosen` está vazio (text_only) mas a tela exibe cores inferidas.

### D6 — UX: banner → botão discreto, sem modais

```
Gatilho 1 (Step 2 montou):
  banner [Realinhar] [Ignorar]
    → Realinhar: re-inferência in-place + toast
    → Ignorar: PATCH metadata.drift_dismissed_snapshot,
               banner → botão discreto

Gatilho 2 (Salvou Step 2):
  sem interrupção — banner/botão persiste

Gatilho 3 (Saiu do Step 2):
  beforeunload nativo só para dados não salvos
  Drift nunca dispara beforeunload

Gatilho 4 (Retorno futuro):
  mesmo padrão do Gatilho 1
  detecta → banner ou botão (se já dispensado)

Gatilho 5 (Gerar Campanha):
  NÃO BLOQUEIA — a geração de campanha não é alterada nesta fase.
  O drift de direção visual é tratado como estado de manutenção
  da identidade da loja, não do fluxo de campanha.
```

**Regra central:** O drift de direção visual é tratado como estado de manutenção da identidade da loja. A fase 4.6.2 detecta o desalinhamento e oferece realinhamento silencioso em superfícies de identidade (Step 2), sem bloquear o fluxo de geração de campanha. Superfícies globais/dashboard/configurações ficam para fase futura.

### D7 — Realinhamento usa dados mais recentes

Quando o usuário clica "Realinhar", o brief enviado para inferência usa:
- Campos sensíveis: `store_atual` (já persistidos)
- Cores: valor mais recente — do formulário se alterado; caso contrário, do current visual state normalizado

Isso garante que uma alteração de cor feita no Step 2 (mas ainda não salva) seja incluída na re-inferência.

### D8 — Loja nova não tem drift

Modo `"create"` → sem detecção. O que o usuário definir na primeira configuração vira a linha de base (input_snapshot é populado na primeira inferência).

### D9 — Persistência do dismiss via API

O dismiss ("Ignorar") precisa persistir `drift_dismissed_snapshot` no metadata do brand profile ativo. Opções:

| Alternativa | Veredito |
|---|---|
| Reutilizar `PATCH /api/store/[id]` | ❌ Mistura responsabilidades da store com metadata do brand profile |
| Estender `POST /api/store/[id]/brand-profile/infer` | ❌ Rota semântica de inferência, não de metadata |
| Nova rota `PATCH /api/store/[id]/brand-profile/metadata` | ✅ |

**Decisão:** Criar `PATCH /api/store/[id]/brand-profile/metadata` que recebe `{ drift_dismissed_snapshot: {...} }` e faz o merge no JSONB `metadata` do brand profile ativo (status = 'synced') da loja.

```typescript
// Request
PATCH /api/store/[id]/brand-profile/metadata
{
  "drift_dismissed_snapshot": {
    "segment": "moda", "subsegment": "moda-feminina", ...
  }
}

// Server action
supabase
  .from('store_brand_profiles')
  .update({ metadata: { ...currentMetadata, drift_dismissed_snapshot } })
  .eq('store_id', id)
  .eq('status', 'synced')
```

**Rationale:** Rota dedicada, semântica clara, sem acoplamento com store ou inferência. Futuramente pode ser estendida para outros metadados do profile.

## Risks / Trade-offs

| Risco | Mitigação |
|---|---|
| **Falso positivo**: `brand_colors_chosen` vazio em text_only dispara color drift em toda carga | A comparação é sempre contra o `input_snapshot` e o `current visual state` normalizado (store + fallback), nunca contra `brand_colors_chosen`, `safe_color_tokens` ou `inferred_*` diretamente. Dirty tracking no form complementa a detecção na sessão atual |
| **Usuário ignora drift e esquece**: botão discreto pode passar despercebido | Botão discreto é o suficiente para esta fase. Revisão UI/UX antes de produção pode reposicionar ou adicionar superfície global futura |
| **Múltiplos realinhamentos em sequência**: usuário realinha, depois altera de novo, realinha de novo | Comportamento correto — cada realinhamento é uma decisão explícita. Input_snapshot é atualizado a cada ciclo |
| **Concorrência**: dois dispositivos alteram a loja simultaneamente | Cada PATCH (store e metadata) é individualmente atômico, mas não há transação entre eles. Último write vence — aceitável para esta fase. Futuramente pode usar RPC ou transação Supabase se necessário |
| **Re-inferência falha no realinhamento**: IA indisponível no momento do clique | A rota `POST /api/store/[id]/brand-profile/infer` já trata falha com `status = failed`. O banner permanece, o usuário pode tentar de novo |
