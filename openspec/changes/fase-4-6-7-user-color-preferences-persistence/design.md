## Context

O contrato atual de `brand_colors_chosen` mistura dois conceitos: "cor que o usuário escolheu no color picker" e "cor que o sistema inferiu/sugeriu". Fluxos automáticos (logo upload, VS approval, text-only inference, realinhamento) preenchem ou zeram `brand_colors_chosen` sem distinguir escolha manual de cor inferida. Além disso, o campo `manual_color_override` (em `store_brand_profiles` e `stores`) é usado como condição para preservação de escolhas, mas nunca foi uma fonte de verdade confiável — perfis podem ter sido criados sem ele, e seu valor booleano não carrega informação sobre quais cores foram escolhidas.

O estado atual inclui:

- `BrandProfileRecord.brand_colors_chosen: string[]` — array sem suporte a `null`
- `PATCH /api/store/[id]/brand-profile` valida apenas `string[]` hex, sempre seta `manual_color_override = { enabled: true }` e `stores.manual_color_override = true`
- Formulário (`store-identity-form.tsx`) persiste via `saveBrandColors` que constrói array descartando valores vazios (perde a posição)
- Logo upload zera `brand_colors_chosen = []` no response do profile
- Remove logo zera `brand_colors_chosen` via `setBrandColorsChosen([])`
- Drift/hydration lê `brand_colors_chosen` como `string[]` sem distinção null

## Goals / Non-Goals

**Goals:**
- `brand_colors_chosen` passa a ser `Array<string | null>` — posições `null` significam "usuário não escolheu esta cor"
- Escolha manual ativa é derivada exclusivamente de `brand_colors_chosen` conter ao menos um HEX válido
- `manual_color_override` deixa de ser escrito por fluxos novos; leitores existentes que dependem dele são substituídos por verificação direta de `brand_colors_chosen`
- PATCH de brand profile aceita `[primaryOuNull, accentOuNull]` com `null` para posição não escolhida
- Color picker persiste o par canônico ao alterar qualquer campo: `[valorHexOuNull, valorHexOuNull]`
- Ação "Voltar para cores sugeridas" limpa `brand_colors_chosen = []`
- Fluxos automáticos (logo, VS, text_only, realinhamento) preservam `brand_colors_chosen` existente, nunca geram valores novos
- Text-only inference persiste `userChosenColors` recebidos na requisição quando o perfil for criado, cobrindo loja nova que escolheu cores antes da primeira inferência
- Nenhum código novo depende de `stores.manual_color_override` ou `store_brand_profiles.manual_color_override`

**Non-Goals:**
- Não alterar prompt de campanha, drift detection, logo processing, VS generation, ou creative direction
- Não remover campos deprecated dos schemas do Supabase (migration futura)
- Não criar fluxo "usar sempre estas cores"
- Não backfill de registros antigos

## Decisions

### D1 — `brand_colors_chosen` passa para `Array<string | null>`

**Decisão:** Mudar o tipo em `BrandProfileRecord`, `BrandProfileSnapshot`, `CreateBrandProfileInput` e estado do formulário de `string[]` para `Array<string | null>`.

**Alternativa considerada:** Manter `string[]` e usar string vazia como sentinela. Rejeitada porque `""` não é um estado semanticamente diferente de ausência, e validadores HEX já tratam `""` como "não informado". Usar `null` é semanticamente explícito e compatível com JSON puro.

### D2 — Preservação derivada de `brand_colors_chosen`, não de `manual_color_override`

**Decisão:** Todo código que decide se deve preservar ou limpar `brand_colors_chosen` passa a consultar o próprio array (`hasUserChosenColors = brand_colors_chosen.some(c => c !== null && /^#[0-9A-Fa-f]{6}$/.test(c))`).

**Alternativa considerada:** Manter `manual_color_override` como cache booleano para evitar percorrer o array. Rejeitada porque introduz estado redundante que pode divergir, e o custo de percorrer um array de 2 posições é irrelevante.

### D3 — PATCH aceita `null` e não escreve `manual_color_override`

**Decisão:** O body do PATCH passa a aceitar `{ colors: Array<string | null> }` com validação individual por posição (hex válido ou `null`). O endpoint:
- Para de escrever `manual_color_override` no brand profile
- Para de atualizar `stores.manual_color_override`
- Mantém a exigência de synced profile existente. Para loja nova sem profile, a escolha de cor permanece no estado local do formulário e é passada como `userChosenColors` para `infer/route.ts` no momento do save/geração text-only

**Alternativa considerada:** Manter compatibilidade com `manual_color_override`. Rejeitada porque manter dois mecanismos de persistência para a mesma informação aumenta o risco de divergência e complexidade desnecessária. O campo deprecated permanece no schema mas não é mais escrito.

### D4 — "Voltar para cores sugeridas" via PATCH com `colors: []`

**Decisão:** Reutilizar o mesmo endpoint PATCH com `{ colors: [] }` para limpar a escolha manual. O front-end adiciona um botão discreto "Voltar para cores sugeridas" visível apenas quando `brandColorsChosen.some(c => c !== null)`. O reset não regenera direção visual, logo, VS ou campanhas.

**Alternativa considerada:** Endpoint dedicado `POST .../brand-profile/reset-colors`. Rejeitada porque adiciona complexidade de roteamento sem ganho semântico — `colors: []` já comunica "sem escolha manual" de forma inequívoca.

### D5 — Logo upload, VS, realinhamento preservam existente; text-only inference aceita `userChosenColors`

**Decisão:** Logo upload, VS approval e realinhamento passam a ler o perfil ativo atual antes de processar. Se houver `brand_colors_chosen` com ao menos um HEX válido, esse valor é preservado no novo perfil. Se não houver, o campo permanece `[]`.

Text-only inference (`infer/route.ts`) preserva `brand_colors_chosen` existente quando há profile anterior. Quando não há (loja nova), persiste `userChosenColors: Array<string | null>` recebido no body da requisição. `manualColorOverride` deixa de ser usado.

**Alternativa considerada:** O front-end faz PATCH antes de chamar infer. Rejeitada porque criaria dependência entre duas chamadas assíncronas e abriria janela de race condition.

### D6 — Remoção de logo não limpa `brand_colors_chosen`

**Decisão:** `handleRemoveLogo` deixa de chamar `setBrandColorsChosen([])`. A escolha manual de cores é independente do estado do logotipo — remover o logo não significa que o usuário quer perder as cores que escolheu.

### D7 — Color picker persiste sempre o par canônico

**Decisão:** Ao alterar qualquer picker, o sistema lê o valor canônico de ambos os campos:
1. `primaryOuNull = campo vazio || placeholder "#RRGGBB" ? null : valorHex`
2. `accentOuNull = campo vazio || placeholder "#RRGGBB" ? null : valorHex`
3. `brand_colors_chosen = primaryOuNull || accentOuNull ? [primaryOuNull, accentOuNull] : []`

Isso resolve o caso de loja nova onde o usuário escolhe apenas uma cor antes da primeira inferência. A persistência do par canônico segue a regra:
- Se houver synced profile → dispara PATCH em tempo real (onChange do color picker ou text input onBlur)
- Se não houver synced profile → mantém em estado local; o par é enviado como `userChosenColors` no text-only inference

## Risks / Trade-offs

- **[Risk] Código legado que lê `brand_colors_chosen` como `string[]` pode quebrar com `null`**: Mudança de tipo no TypeScript pega a maioria dos casos em compilação. Hotspots identificados nos 7+ arquivos que referenciam `brand_colors_chosen`. Mitigação: auditoria de todos os acessos a `brand_colors_chosen` após a mudança de tipo, com fallback explícito `?? []` para legacy reads.
- **[Risk] Dados existentes no Supabase têm `brand_colors_chosen` como `string[]` sem `null`**: O banco aceitará `null` via JSONB naturalmente. Registros antigos continuam funcionando — `null` só aparece progressive em novas escolhas. Não há migration necessária nesta fase.
- **[Risk] `manual_color_override` ainda é lido por código não auditado**: Identificamos leitores em `store-brand-profile/spec.md` (VS approval, preservation logic) e `store-identity-ui/spec.md` (save condition). A implementação deve rastrear e substituir cada leitor. Sugestão: adicionar `@deprecated` JSDoc nos campos e configurar lint rule temporária.
- **[Trade-off] Loja nova sem synced profile**: Escolhas de cor precisam ser mantidas em estado local e passadas como `userChosenColors` para `infer/route.ts`. O PATCH só opera sobre profiles existentes. Trade-off aceito: o fluxo text-only inference já recebe cores do front-end; replicar a lógica de persistência em dois lugares (PATCH + infer) é aceitável e evita criar registros parciais.
- **[Risk] Acoplamento com `stores.manual_color_override` é usado em outros contextos**: Uma busca por `manual_color_override` em todo o repositório deve ser feita antes de remover as escritas. Se houver readers além dos mapeados, podem precisar de adaptação.

## Migration Plan

1. **Tipo `BrandProfileRecord.brand_colors_chosen`** muda para `Array<string | null>` — sem migration de dados, apenas tipo TypeScript
2. **PATCH route**: aceita `null`, remove escritas de `manual_color_override`, mantém exigência de synced profile existente
3. **Formulário**: atualizar `saveBrandColors`, `brandColorsChosen` state, color picker onChange/onBlur, hidratação com null, adicionar "Voltar para cores sugeridas"
4. **Logo upload**: não zera `brand_colors_chosen` no response; preserva se existente
5. **Remove logo**: não limpa `brand_colors_chosen` no front-end
6. **Text-only inference**: aceita `userChosenColors` do body, preserva existente ou persiste recebido na requisição atual
7. **VS approval**: condição de preservação via `brand_colors_chosen` em vez de `manual_color_override.enabled`
8. **Realinhamento**: preserva `brand_colors_chosen` existente
9. **Validadores e normalizadores**: atualizar para `Array<string | null>` e tratar `#RRGGBB` placeholder como `null`

Rollback: reverter commits e restaurar tipos. Dados com `null` são compatíveis com schema antigo (JSONB aceita).

## Open Questions

- **O que acontece quando o usuário digita um hex inválido no input de texto do color picker?** O comportamento atual valida no blur e mostra erro, mas `saveBrandColors` é chamado no onChange do color picker nativo (que sempre emite hex válido) e no blur do input de texto (que pode ter valor inválido). O design deve garantir que valores inválidos não sejam persistidos como escolha manual. Sugestão: persistir apenas no onChange do color picker nativo; no blur do input de texto, se válido, persistir; se inválido, mostrar erro e não persistir.
- **`saveBrandColors` é chamado demais?** Atualmente é chamado em onChange do color picker nativo + onBlur do texto. Isso pode gerar múltiplas chamadas PATCH em rápida sucessão. Vale considerar debounce (300ms) no campo de texto, ou persistir apenas no save principal (handleStep2Submit). **Decidir na implementação**.
