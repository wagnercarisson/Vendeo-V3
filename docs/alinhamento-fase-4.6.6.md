# Alinhamento Fase 4.6.6 — Identity Transition

## Nomenclatura das Fases 4.6

```text
4.6  — Store Form Adjusts                         (fase mãe)
 ├── 4.6.1 — Text Only Coverage                   (concluída)
 ├── 4.6.2 — Visual Direction Drift Detection     (concluída)
 ├── 4.6.3 — Logo State Lifecycle                 (concluída)
 ├── 4.6.4 — Visual Signature Lifecycle           (concluída)
 ├── 4.6.5 — VS Color Drift & Profile Alignment   (concluída)
 └── 4.6.6 — Identity Transition                  ← esta fase
```

Esta fase trata exclusivamente das transições entre os estados de identidade da loja:

- `text_only`
- `logo`
- `visual_signature`

O objetivo é garantir que o estado persistido, os assets ativos/arquivados e as ações exibidas na interface estejam sempre coerentes.

Importante: nesta fase, `identity_state` descreve qual **asset visual** está ativo na loja, não se existe ou não uma direção visual persistida.

```text
identity_state = text_only        → nenhum logo/VS ativo
identity_state = logo             → logo ativo
identity_state = visual_signature → VS ativa
```

Uma loja em `text_only` pode continuar tendo uma direção visual/profile `synced`, inclusive herdada do logo ou da VS removida. Isso é válido: o que muda é que não há mais asset visual ativo.

---

## Propósito

Corrigir e simplificar o fluxo de transição de identidade da loja, usando `text_only` como estado central.

A fase deve garantir que:

1. uma loja em `logo` tenha logo ativo;
2. uma loja em `visual_signature` tenha assinatura visual ativa;
3. uma loja em `text_only` não tenha logo ativo nem assinatura visual ativa;
4. o usuário só veja ações compatíveis com o estado atual;
5. falhas em transições não deixem o sistema em estado parcial ou incoerente.

---

## Fora de escopo

Esta fase **não** trata:

- cores;
- `brand_color`;
- `accent_color`;
- `manual_color_override`;
- persistência ou escolha manual de paleta;
- realinhamento de direção visual;
- campo de feedback para gerar nova direção visual;
- lifecycle avançado de assinatura visual;
- drift/validade/restauração inteligente de VS;
- histórico ou reaplicação de logos removidos;
- auditoria/reparo amplo de dados antigos;
- idempotência global;
- redesenho visual amplo do formulário.

Esses pontos podem virar fases futuras.

---

## Regra principal

`text_only` é o hub obrigatório das transições.

```text
logo              → text_only → visual_signature
visual_signature  → text_only → logo
```

Nesta fase, o sistema não deve permitir troca direta entre `logo` e `visual_signature`.

---

## Transições permitidas

| Origem | Ação | Destino |
|---|---|---|
| nova loja | criar loja | `text_only` |
| `text_only` | enviar logo | `logo` |
| `logo` | remover logo | `text_only` |
| `text_only` | gerar/aplicar assinatura visual | `visual_signature` |
| `visual_signature` | remover assinatura visual | `text_only` |

---

## Transições bloqueadas nesta fase

| Origem | Destino bloqueado | Motivo |
|---|---|---|
| `logo` | `visual_signature` | deve remover logo antes |
| `visual_signature` | `logo` | deve remover VS antes |
| `logo` | `logo` | substituição direta fica fora desta fase |
| `visual_signature` | `visual_signature` | troca direta de versão de VS fica fora desta fase |

Se o usuário quiser trocar de identidade, o fluxo deve ser:

```text
remover identidade atual → voltar para text_only → aplicar nova identidade
```

---

## Estados e ações esperadas na UI

### Estado `text_only`

Quando a loja está em `text_only`, a UI pode exibir ações para aplicar uma identidade visual:

- enviar logo;
- gerar assinatura visual, se ainda não houver VS gerada;
- gerenciar assinatura visual, se já houver VS gerada/arquivada.

Regra de label:

```text
sem VS existente      → "Gerar assinatura visual"
com VS existente      → "Gerenciar assinatura visual"
```

O link atual "continuar sem logo" deve deixar de ser tratado como ação concorrente a logo/VS. A orientação recomendada é substituir esse link por um card simples no Step 2, explicando que o usuário pode escolher cores se quiser e clicar em salvar; se nenhum logo ou VS for aplicado, o sistema seguirá em `text_only` e gerará a direção visual com base nos dados básicos da loja.

Texto sugerido para o card:

```text
Sem logo por enquanto?
Você pode escolher as cores da loja, se quiser, e clicar em Salvar.
O Vendeo vai gerar uma direção visual usando os dados básicos da loja.
```

### Logos removidos

Nesta fase, logo removido não fica disponível para reaplicação pela UI.

Regra recomendada:

```text
logo ativo → remover logo → text_only
```

Após remover, se o usuário quiser usar o mesmo logo novamente, deve enviar o arquivo outra vez.

Justificativa:

- o logo é um arquivo fornecido pelo usuário;
- remover histórico de logo simplifica fluxo e armazenamento;
- evita "gerenciar logo" e validação de versões antigas nesta fase;
- se dados da loja mudaram, reenviar/reprocessar o logo é aceitável e mais claro.

Antes de remover, a UI deve avisar:

```text
Ao remover o logo, ele não ficará disponível para reaplicação pela interface.
Você poderá enviar o arquivo novamente quando quiser.
```

### Estado `logo`

Quando a loja está em `logo`, a UI deve exibir apenas a ação:

```text
Remover logo
```

Não deve exibir ação para:

- trocar logo diretamente;
- gerenciar versões de logo;
- gerar VS diretamente;
- gerenciar VS como transição direta.

Ao remover o logo, a loja volta para `text_only`.

### Estado `visual_signature`

Quando a loja está em `visual_signature`, a UI deve exibir apenas a ação:

```text
Remover assinatura visual
```

Não deve exibir ação para:

- alterar VS diretamente;
- remover e alterar ao mesmo tempo;
- aplicar logo diretamente.

Ao remover a VS ativa, a loja volta para `text_only`.

Observação: regras avançadas de VS arquivada, reuso, drift crítico/sensível e realinhamento pertencem ao lifecycle da VS e ficam fora desta fase.

---

## Invariantes obrigatórias

### I1 — `text_only` não possui asset visual ativo

Quando `stores.identity_state = 'text_only'`:

- não deve existir logo com `status = 'active'`;
- não deve existir visual signature com `status = 'active'`.

Isso não significa ausência de direção visual. `text_only` pode ter um brand profile `synced` usado como direção visual atual.

### I2 — `logo` exige logo ativo

Quando `stores.identity_state = 'logo'`:

- deve existir exatamente um logo ativo da loja;
- a UI deve tratar esse logo como identidade visual atual;
- a ação principal disponível deve ser remover logo.

### I3 — `visual_signature` exige VS ativa

Quando `stores.identity_state = 'visual_signature'`:

- deve existir exatamente uma assinatura visual ativa da loja;
- a UI deve tratar essa VS como identidade visual atual;
- a ação principal disponível deve ser remover assinatura visual.

### I4 — troca entre logo e VS passa por `text_only`

O sistema não deve permitir:

```text
logo → visual_signature
visual_signature → logo
```

O usuário deve remover a identidade ativa antes de aplicar outra.

### I5 — falha mantém o estado anterior

Se uma transição falhar:

- `identity_state` deve permanecer no estado anterior;
- asset/VS anterior deve permanecer ativo, se existia;
- a UI não deve declarar sucesso;
- o erro deve ser visível para diagnóstico.

### I6 — estado só muda depois da persistência crítica

O sistema só deve atualizar `stores.identity_state` depois que a persistência necessária para o novo estado estiver concluída.

Exemplos:

- `text_only → logo`: só muda para `logo` depois que o logo estiver persistido e ativo;
- `text_only → visual_signature`: só muda para `visual_signature` depois que a VS estiver persistida e ativa;
- `logo → text_only`: só muda para `text_only` depois que o logo ativo for arquivado;
- `visual_signature → text_only`: só muda para `text_only` depois que a VS ativa for arquivada.

---

## Contratos por transição

### `text_only → logo`

Fluxo esperado:

1. usuário envia um logo;
2. sistema valida/persiste o asset;
3. sistema ativa o logo;
4. sistema atualiza `stores.identity_state = 'logo'`;
5. UI passa a mostrar apenas "Remover logo".

Se falhar antes da ativação:

- loja continua em `text_only`;
- nenhum logo novo deve aparecer como ativo;
- erro deve ser retornado/mostrado.

### `logo → text_only`

Fluxo esperado:

1. usuário clica em "Remover logo";
2. sistema arquiva o logo ativo;
3. sistema atualiza `stores.identity_state = 'text_only'`;
4. direção visual/profile atualmente válido pode permanecer como `synced`;
5. UI volta a mostrar ações disponíveis para `text_only`;
6. o logo removido não fica disponível para reaplicação pela UI nesta fase.

Se falhar:

- loja continua em `logo`;
- logo anterior continua ativo;
- erro deve ser retornado/mostrado.

### `text_only → visual_signature`

Fluxo esperado:

1. usuário gera/aplica assinatura visual;
2. sistema persiste a VS;
3. sistema ativa a VS;
4. sistema atualiza `stores.identity_state = 'visual_signature'`;
5. UI passa a mostrar apenas "Remover assinatura visual".

Se falhar antes da ativação:

- loja continua em `text_only`;
- nenhuma VS nova deve aparecer como ativa;
- erro deve ser retornado/mostrado.

### `visual_signature → text_only`

Fluxo esperado:

1. usuário clica em "Remover assinatura visual";
2. sistema arquiva a VS ativa;
3. sistema atualiza `stores.identity_state = 'text_only'`;
4. direção visual/profile atualmente válido pode permanecer como `synced`;
5. UI volta a mostrar ações disponíveis para `text_only`, incluindo "Gerar assinatura visual" ou "Gerenciar assinatura visual" conforme o histórico existente.

Se falhar:

- loja continua em `visual_signature`;
- VS anterior continua ativa;
- erro deve ser retornado/mostrado.

---

## Decisões explícitas

### D1 — `text_only` é estado de asset visual, não ausência de direção

Ao remover logo ou VS, a loja volta para `text_only`.

Isso significa:

- não existe logo ativo;
- não existe VS ativa;
- a loja pode manter uma direção visual/profile `synced`.

Exemplos válidos:

```text
logo ativo removido → identity_state = text_only + direção visual herdada do profile do logo
VS ativa removida   → identity_state = text_only + direção visual herdada do profile da VS
loja nova sem asset → identity_state = text_only + direção visual gerada a partir dos dados básicos
```

Nesta fase, não vamos redesenhar o lifecycle de profiles. O contrato mínimo é: `text_only` não pode manter asset visual ativo.

### D2 — Troca direta entre identidades fica bloqueada

O sistema não deve tentar resolver automaticamente:

```text
logo → visual_signature
visual_signature → logo
```

Essas trocas devem passar por remoção explícita da identidade atual.

### D3 — Troca direta de versão de VS fica fora desta fase

Mesmo que `visual_signature v1 → visual_signature v2` seja tecnicamente possível, esta fase não precisa implementar essa troca direta.

Fluxo aceito nesta fase:

```text
visual_signature v1 → remover VS → text_only → aplicar VS v2
```

Regras sobre quando uma VS antiga pode ser reaplicada, realinhada ou considerada inválida pertencem ao lifecycle da VS e não devem expandir a fase 4.6.6.

### D4 — Gerar nova direção visual em `text_only` fica fora desta fase

O fluxo:

```text
text_only → text_only
```

para gerar nova direção visual, realinhar ou coletar feedback do usuário é válido, mas fica fora desta fase para evitar aumento de escopo.

Exceção: a geração inicial/necessária da direção visual ao salvar o Step 2 sem logo/VS permanece comportamento esperado. O que fica fora é um fluxo novo de "gerar outra direção visual" sob demanda, com feedback ou realinhamento avançado.

### D5 — Remoção de logo não cria fluxo de histórico/reaplicação

Nesta fase, remover logo não abre histórico/gerenciamento de logos.

O fluxo aceito é:

```text
logo → remover logo → text_only
text_only → enviar logo novamente → logo
```

Não haverá gerenciamento, histórico ou reaplicação de versões antigas de logo nesta fase.

---

## Critérios de aceite

1. Loja nova nasce em `text_only`.
2. `text_only → logo` funciona sem deixar VS ativa.
3. `logo → text_only` arquiva o logo ativo e atualiza a UI.
4. `text_only → visual_signature` funciona sem deixar logo ativo.
5. `visual_signature → text_only` arquiva a VS ativa e atualiza a UI.
6. UI em `logo` mostra apenas "Remover logo" como ação principal de identidade.
7. UI em `visual_signature` mostra apenas "Remover assinatura visual" como ação principal de identidade.
8. UI em `text_only` mostra ações para enviar logo ou gerar/gerenciar VS.
9. Transições diretas `logo → visual_signature` e `visual_signature → logo` ficam bloqueadas.
10. Se uma transição falhar, o estado anterior permanece coerente.
11. O link "continuar sem logo" deixa de funcionar como ação principal e é substituído por orientação clara no Step 2.
12. Remover logo não oferece histórico, reaplicação ou gerenciamento de versões de logo nesta fase.

---

## Matriz mínima de teste manual

| Cenário | Resultado esperado |
|---|---|
| criar loja nova | `identity_state = text_only` |
| `text_only → logo` | logo ativo, `identity_state = logo` |
| `logo → text_only` | nenhum logo ativo, `identity_state = text_only` |
| `text_only → visual_signature` | VS ativa, `identity_state = visual_signature` |
| `visual_signature → text_only` | VS arquivada, `identity_state = text_only` |
| tentar aplicar VS com logo ativo | ação indisponível ou bloqueada |
| tentar aplicar logo com VS ativa | ação indisponível ou bloqueada |
| remover logo com falha simulada | loja permanece em `logo` |
| remover VS com falha simulada | loja permanece em `visual_signature` |
| loja nova no Step 2 | não exibe link "continuar sem logo"; exibe orientação simples para salvar em `text_only` |
| após remover logo | não exibe restore/gerenciar logo; usuário pode enviar logo novamente |

---

## Hotspots para investigação

```text
src/components/flow/store-identity-form.tsx
src/components/flow/store-visual-signature-section.tsx
src/app/api/store/[id]/logo/route.ts
src/app/api/store/[id]/visual-signature/route.ts
src/app/api/store/[id]/visual-signature/approve/route.ts
src/app/api/store/[id]/visual-signature/restore/route.ts
src/lib/actions/store.ts
```

Esta lista é ponto de partida, não autorização para ampliar escopo.

---

## Orientação para OpenSpec

Nome sugerido da change:

```text
fase-4-6-6-identity-transition
```

O proposal deve tratar esta fase como correção de fluxo e consistência de estado, não como refactor amplo de identidade visual.

O OpenSpec deve preservar estas restrições:

- tratar apenas transições de estado;
- não tratar cores;
- não tratar override manual;
- não implementar fallback incompatível como perfil ativo;
- não implementar realinhamento de direção visual;
- não implementar restore/gerenciamento de versões de logo;
- não implementar drift/realinhamento/revalidação de VS antiga;
- não criar troca direta entre `logo` e `visual_signature`;
- não expandir para idempotência global sem necessidade comprovada.
