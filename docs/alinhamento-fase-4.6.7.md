# Alinhamento Fase 4.6.7 - User Color Preferences Persistence

## Nomenclatura das Fases 4.6

```text
4.6  - Store Form Adjusts                         (fase mae)
 |-- 4.6.1 - Text Only Coverage                   (concluida)
 |-- 4.6.2 - Visual Direction Drift Detection     (concluida)
 |-- 4.6.3 - Logo State Lifecycle                 (concluida)
 |-- 4.6.4 - Visual Signature Lifecycle           (concluida)
 |-- 4.6.5 - VS Color Drift & Profile Alignment   (concluida)
 |-- 4.6.6 - Identity Transition                  (concluida)
 `-- 4.6.7 - User Color Preferences Persistence   <- esta fase
```

Esta fase trata exclusivamente da persistencia das cores escolhidas manualmente pelo usuario no Step 2.

O objetivo e separar, de forma clara, as cores sugeridas pelo Vendeo das cores escolhidas pelo usuario, sem transformar essas escolhas em regra obrigatoria para campanhas, drift, logo, assinatura visual ou direcao visual.

---

## Proposito

Garantir que `brand_colors_chosen` seja a unica fonte da verdade para escolhas manuais de cor feitas pelo usuario.

A fase deve garantir que:

1. se o usuario alterar qualquer color picker, as posicoes escolhidas sejam persistidas em `brand_colors_chosen`;
2. se o usuario nunca alterar cores, `brand_colors_chosen` permaneca vazio;
3. se o usuario escolher apenas primaria ou apenas destaque, a outra posicao seja persistida como `null`;
4. se o usuario clicar em "Voltar para cores sugeridas", `brand_colors_chosen` seja limpo;
5. nenhum fluxo automatico preencha, sobrescreva ou apague escolhas manuais indevidamente;
6. a UI hidrate os color pickers de forma coerente conforme exista ou nao escolha manual ativa.

---

## Fora de escopo

Esta fase nao trata:

- uso das cores escolhidas no prompt de campanha;
- alteracao do prompt de campanha;
- drift;
- sensibilidade de `brand_color` ou `accent_color`;
- decisao sobre quando o diretor de campanha deve usar cores escolhidas;
- regeneracao de direcao visual por causa de cores;
- alteracao de logo por causa de cores;
- alteracao de assinatura visual por causa de cores;
- criacao de fluxo para "usar sempre estas cores";
- backfill ou reparo amplo de registros antigos;
- migration para remover campos deprecated;
- redesign visual amplo do Step 2.

Esses pontos podem virar fases futuras.

---

## Regra principal

`brand_colors_chosen` deve conter apenas cores escolhidas manualmente pelo usuario.

```text
sem escolha manual             -> brand_colors_chosen = []

somente primaria escolhida     -> brand_colors_chosen = [primary, null]

somente destaque escolhida     -> brand_colors_chosen = [null, accent]

primaria e destaque escolhidas -> brand_colors_chosen = [primary, accent]

voltar cores sugeridas         -> brand_colors_chosen = []
```

A existencia de escolha manual e derivada do proprio array:

```text
hasUserChosenColors = brand_colors_chosen contem ao menos uma cor HEX valida
```

O sistema nao deve gravar cores detectadas de logo, cores inferidas pelo Vendeo, `safe_color_tokens`, `inferred_primary_color`, `inferred_accent_color`, fallback de segmento ou valor default visual do navegador dentro de `brand_colors_chosen`.

---

## Contrato de dados

### `store_brand_profiles.brand_colors_chosen`

Fonte da verdade para as cores escolhidas manualmente pelo usuario.

Estados validos nesta fase:

```text
[]                  -> nenhuma escolha manual ativa
[primary, null]     -> usuario escolheu somente primaria
[null, accent]      -> usuario escolheu somente destaque
[primary, accent]   -> usuario escolheu primaria e destaque
```

`primary` e `accent` devem ser strings HEX validas no formato `#RRGGBB`.

Quando uma posicao nao tiver sido escolhida pelo usuario, persistir `null` nessa posicao. Nao preencher com cor sugerida, cor inferida, fallback de segmento ou valor default visual do navegador.

Arrays com uma unica cor devem ser evitados porque tornam a posicao ambigua.

### `store_brand_profiles.manual_color_override`

Campo redundante e deprecated para o contrato desta fase.

Ele nao deve ser usado como fonte de verdade para escolhas manuais de cor. A escolha manual e derivada exclusivamente de `brand_colors_chosen`.

Se o campo ainda existir no schema, ele pode permanecer por compatibilidade temporaria, mas fluxos novos ou ajustados nao devem depender dele. Uma fase futura pode remover o campo via migration se nao houver mais dependencias.

### `stores.manual_color_override`

Campo redundante e deprecated para o contrato desta fase.

Ele nao deve ser usado como fonte de verdade para escolhas manuais de cor.

Se o campo ainda existir no schema, ele pode permanecer por compatibilidade temporaria, mas fluxos novos ou ajustados nao devem depender dele. Uma fase futura pode remover o campo via migration se nao houver mais dependencias.

### `stores.brand_color`

Campo de cor primaria resolvida/sugerida pelo sistema.

Nesta fase, `stores.brand_color` nao representa escolha manual do usuario. Ele pode continuar sendo usado como fallback legado ou cor primaria resolvida da loja, mas nao deve ser atualizado pelo color picker.

Escolhas manuais feitas nos color pickers devem persistir somente em:

```text
store_brand_profiles.brand_colors_chosen
```

O save generico da loja nao deve ser tratado como mecanismo de persistencia de cores manuais. A persistencia de cores escolhidas pertence ao endpoint/fluxo de brand profile.

---

## Comportamento esperado dos color pickers

### Sem escolha manual ativa

Quando `brand_colors_chosen` estiver vazio:

1. os color pickers podem exibir as cores sugeridas pelo Vendeo, se existirem;
2. a fonte preferencial deve ser `safe_color_tokens.primary` e `safe_color_tokens.accent`;
3. se `safe_color_tokens` estiver incompleto, usar fallback existente do sistema;
4. se nao houver cor sugerida ainda, o campo canonico deve permanecer vazio ou placeholder;
5. nao persistir `brand_colors_chosen` apenas por hidratar a UI.

### Com escolha manual ativa

Quando `brand_colors_chosen` tiver ao menos uma cor HEX valida:

1. posicoes com cor escolhida devem exibir o valor de `brand_colors_chosen`;
2. posicoes `null` devem permanecer vazias na representacao canonica do formulario;
3. as cores sugeridas pelo Vendeo podem continuar visiveis como referencia;
4. o usuario deve conseguir voltar para as cores sugeridas.

Observacao: o input nativo de cor pode renderizar preto visualmente quando nao ha valor valido. A fonte de verdade deve ser o valor textual/canonico validado. Placeholders como `#RRGGBB` nao sao cores validas e devem ser tratados como `null`.

### Alteracao de qualquer picker

Ao alterar cor primaria ou cor de destaque:

```text
primaryPersistido = valor HEX valido do campo primaria ou null
accentPersistido  = valor HEX valido do campo destaque ou null

se primaryPersistido ou accentPersistido existir:
  brand_colors_chosen = [primaryPersistido, accentPersistido]

se ambos forem null:
  brand_colors_chosen = []
```

Isso permite o fluxo de loja nova em que ainda nao existe direcao visual nem cores sugeridas: se o usuario escolher apenas uma cor, somente essa cor vira escolha manual.

Exemplos:

```text
primaria preenchida, destaque vazio -> brand_colors_chosen = ["#FF0000", null]
destaque preenchido, primaria vazia -> brand_colors_chosen = [null, "#00FF00"]
ambas preenchidas                  -> brand_colors_chosen = ["#FF0000", "#00FF00"]
nenhuma preenchida                 -> brand_colors_chosen = []
```

### Valor vazio e placeholder

O sistema deve consultar o valor canonico dos campos, nao inferir intencao pela existencia de direcao visual no banco.

Regras:

```text
campo vazio              -> null
campo com placeholder    -> null
campo com HEX valido     -> valor HEX
campo com valor invalido -> erro de validacao ou null, conforme comportamento atual do formulario
```

`#RRGGBB` nao e HEX valido e nao deve ser persistido.

### Voltar para cores sugeridas

Adicionar acao discreta no bloco de cores, visivel apenas quando houver escolha manual ativa.

Label sugerido:

```text
Voltar para cores sugeridas
```

Comportamento:

```text
brand_colors_chosen = []
UI exibe novamente as cores sugeridas pelo Vendeo, se existirem
```

Essa acao nao deve:

- regenerar direcao visual;
- reprocessar logo;
- alterar assinatura visual;
- alterar campanhas;
- disparar drift;
- atualizar `stores.brand_color`;
- depender de `stores.manual_color_override`;
- depender de `store_brand_profiles.manual_color_override`.

---

## Invariantes obrigatorias

### I1 - `brand_colors_chosen` nao recebe cores automaticas

Nenhum fluxo automatico deve popular `brand_colors_chosen` com:

- cores detectadas de logo;
- cores inferidas por IA;
- `safe_color_tokens`;
- `inferred_primary_color`;
- `inferred_accent_color`;
- paleta de assinatura visual;
- fallback por segmento;
- valor default visual do input nativo.

### I2 - escolha manual e preservada

Se `brand_colors_chosen` contiver ao menos uma cor HEX valida, fluxos de atualizacao de perfil, realinhamento ou transicao de identidade nao devem limpar nem substituir `brand_colors_chosen`.

Excecoes permitidas:

- o usuario altera novamente um color picker;
- o usuario clica em "Voltar para cores sugeridas".

### I3 - reset manual limpa escolhas

"Voltar para cores sugeridas" deve limpar a escolha manual.

Depois do reset, `brand_colors_chosen` deve ficar vazio. Nao preencher com as cores sugeridas.

### I4 - picker nao persiste por hidratar

Carregar a tela e preencher os pickers com cores sugeridas pelo Vendeo nao deve criar escolha manual.

Escolha manual so existe depois de acao explicita do usuario sobre os pickers.

### I5 - posicoes explicitas

Quando houver escolha manual parcial, `brand_colors_chosen` deve manter a posicao da escolha:

```text
[primary, null]
[null, accent]
[primary, accent]
```

Arrays com uma unica cor devem ser evitados nesta fase.

---

## Fluxos que devem ser auditados

### Step 2 - alteracao de cores

Fluxo esperado:

1. usuario altera primaria ou destaque;
2. sistema le o valor canonico de cada campo;
3. sistema converte campo vazio ou placeholder em `null`;
4. sistema salva `[primaryOuNull, accentOuNull]` em `brand_colors_chosen`;
5. se as duas posicoes forem `null`, sistema salva `brand_colors_chosen = []`;
6. UI permanece exibindo as cores escolhidas e deixa vazias as posicoes nao escolhidas.

### Step 2 - voltar para cores sugeridas

Fluxo esperado:

1. usuario clica em "Voltar para cores sugeridas";
2. sistema limpa `brand_colors_chosen`;
3. UI passa a exibir `safe_color_tokens` ou fallback equivalente, se existir;
4. nenhum asset visual e alterado.

### Upload ou analise de logo

Fluxo esperado:

- logo pode gerar `safe_color_tokens`, `logo_colors_detected`, `inferred_primary_color` e `inferred_accent_color`;
- logo nao deve preencher `brand_colors_chosen`;
- se havia escolha manual ativa, ela deve ser preservada;
- se nao havia escolha manual ativa, `brand_colors_chosen` deve continuar vazio.

### Visual signature

Fluxo esperado:

- aprovar, remover, restaurar ou realinhar VS nao deve criar escolha manual;
- se havia escolha manual ativa, ela deve ser preservada;
- se nao havia escolha manual ativa, `brand_colors_chosen` deve continuar vazio.

### Text only / direcao visual

Fluxo esperado:

- gerar ou realinhar direcao visual pode atualizar cores sugeridas pelo Vendeo;
- isso nao deve preencher `brand_colors_chosen`;
- se havia escolha manual ativa, ela deve ser preservada;
- se nao havia escolha manual ativa, `brand_colors_chosen` deve continuar vazio.

---

## Hotspots para investigacao/implementacao

```text
src/components/flow/store-identity-form.tsx
src/app/api/store/[id]/brand-profile/route.ts
src/app/api/store/[id]/brand-profile/infer/route.ts
src/app/api/store/[id]/brand-profile/realign/route.ts
src/app/api/store/[id]/visual-signature/approve/route.ts
src/lib/visual-signature/brand-profiler.ts
src/lib/actions/store.ts
```

Esta lista e ponto de partida. Ela nao autoriza ampliar a fase para campanha ou drift.

---

## Criterios de aceite

1. Loja sem escolha manual mantem `brand_colors_chosen = []`.
2. Alterar somente cor primaria salva `[primary, null]`.
3. Alterar somente cor de destaque salva `[null, accent]`.
4. Alterar ambas as cores salva `[primary, accent]`.
5. Campo vazio ou placeholder salva `null` para aquela posicao.
6. `#RRGGBB` nao e persistido como cor escolhida.
7. A existencia de escolha manual e derivada de `brand_colors_chosen`.
8. Alteracao manual nao atualiza `stores.brand_color`.
9. Alteracao manual nao depende de `stores.manual_color_override`.
10. Alteracao manual nao depende de `store_brand_profiles.manual_color_override`.
11. Recarregar a tela com escolha manual ativa exibe as cores escolhidas e mantem vazias as posicoes `null`.
12. Recarregar a tela sem escolha manual ativa exibe as cores sugeridas pelo Vendeo, se existirem.
13. Hidratar pickers com cores sugeridas nao cria escolha manual.
14. "Voltar para cores sugeridas" limpa `brand_colors_chosen`.
15. "Voltar para cores sugeridas" nao atualiza `stores.brand_color`.
16. Upload/analise de logo nao grava cores detectadas em `brand_colors_chosen`.
17. Fluxos de VS nao gravam paleta da VS em `brand_colors_chosen`.
18. Fluxos text_only/direcao visual nao gravam `safe_color_tokens` em `brand_colors_chosen`.
19. Escolhas manuais sao preservadas em realinhamentos e transicoes, salvo reset explicito do usuario.

---

## Matriz minima de teste manual

| Cenario | Resultado esperado |
|---|---|
| criar loja nova e salvar sem mexer nas cores | `brand_colors_chosen = []` |
| loja nova, alterar apenas primaria | `brand_colors_chosen = [primary, null]` |
| loja nova, alterar apenas destaque | `brand_colors_chosen = [null, accent]` |
| alterar primaria e destaque | `brand_colors_chosen = [primary, accent]` |
| campo com placeholder `#RRGGBB` | posicao correspondente vira `null` |
| recarregar tela com `[primary, null]` | primaria exibida, destaque canonico vazio |
| recarregar tela com `[null, accent]` | primaria canonica vazia, destaque exibido |
| clicar em "Voltar para cores sugeridas" | `brand_colors_chosen = []` |
| recarregar tela apos reset | pickers exibem cores sugeridas pelo Vendeo, se existirem |
| upload de logo sem escolha manual | `brand_colors_chosen` permanece vazio |
| upload de logo com escolha manual previa | escolha manual permanece preservada |
| aprovar VS sem escolha manual | `brand_colors_chosen` permanece vazio |
| aprovar VS com escolha manual previa | escolha manual permanece preservada |
| realinhar text_only sem escolha manual | `brand_colors_chosen` permanece vazio |
| realinhar text_only com escolha manual previa | escolha manual permanece preservada |

---

## Testes automatizados sugeridos

### API de brand profile

- PATCH com `[primary, null]` salva escolha parcial de primaria.
- PATCH com `[null, accent]` salva escolha parcial de destaque.
- PATCH com `[primary, accent]` salva escolha completa.
- PATCH/reset limpa `brand_colors_chosen`.
- PATCH rejeita cores invalidas.
- PATCH trata placeholder como `null` ou rejeita conforme decisao de validacao do endpoint.
- GET retorna dados suficientes para a UI distinguir escolha manual ativa de cores sugeridas.

### UI do Step 2

- alterar primaria chama persistencia com `[primary, accentOuNull]`;
- alterar destaque chama persistencia com `[primaryOuNull, accent]`;
- campo vazio ou placeholder vira `null`;
- botao "Voltar para cores sugeridas" aparece apenas com escolha manual ativa;
- reset atualiza os pickers para cores sugeridas, se existirem;
- hidratar tela sem escolha manual nao dispara persistencia manual.

### Preservacao em fluxos relacionados

- logo analysis nao popula `brand_colors_chosen`;
- logo analysis preserva `brand_colors_chosen` quando ha escolha manual;
- VS approve preserva escolha manual quando existe;
- text_only realign preserva escolha manual quando existe;
- nenhum fluxo automatico substitui escolha manual por `safe_color_tokens`;
- nenhum fluxo novo depende de `manual_color_override`.

---

## Orientacao para OpenSpec

Nome sugerido da change:

```text
fase-4-6-7-user-color-preferences-persistence
```

O proposal deve tratar esta fase como correcao de contrato e persistencia de preferencia manual, nao como mudanca de direcao visual, campanha ou drift.

O OpenSpec deve preservar estas restricoes:

- tratar apenas `store_brand_profiles.brand_colors_chosen`, hidratacao dos pickers e reset para cores sugeridas;
- aceitar `null` para posicao nao escolhida pelo usuario;
- nao usar `store_brand_profiles.manual_color_override` como fonte de verdade;
- nao usar `stores.manual_color_override` como fonte de verdade;
- nao persistir escolha manual no `stores.brand_color`;
- nao alterar prompt de campanha;
- nao alterar drift;
- nao transformar cores escolhidas em obrigacao de uso;
- nao regenerar logo, VS ou direcao visual por causa de cores;
- nao gravar cores automaticas em `brand_colors_chosen`;
- preservar escolhas manuais quando existirem em `brand_colors_chosen`;
- limpar escolhas manuais apenas por acao explicita do usuario.

---

## Historico de decisoes

| Data | Decisao |
|---|---|
| 2026-06-25 | Fase nomeada como 4.6.7 - User Color Preferences Persistence. |
| 2026-06-25 | Cores escolhidas pelo usuario sao preferencias, nao regras obrigatorias para campanha, logo, VS ou direcao visual. |
| 2026-06-25 | Prompt de campanha e drift ficam fora desta fase. |
| 2026-06-25 | `brand_colors_chosen` e a fonte da verdade das cores escolhidas manualmente. |
| 2026-06-25 | `store_brand_profiles.manual_color_override` fica deprecated para este contrato. |
| 2026-06-25 | `stores.manual_color_override` fica deprecated para este contrato. |
| 2026-06-25 | Escolha manual ativa e derivada de `brand_colors_chosen` conter ao menos uma cor HEX valida. |
| 2026-06-25 | Se o usuario escolher apenas uma cor, a outra posicao e persistida como `null`. |
| 2026-06-25 | Se o usuario nunca escolher cores, `brand_colors_chosen = []`. |
| 2026-06-25 | "Voltar para cores sugeridas" limpa `brand_colors_chosen`. |
| 2026-06-25 | Fluxos automaticos nao podem preencher `brand_colors_chosen` com cores detectadas, inferidas ou sugeridas pelo sistema. |
| 2026-06-25 | `stores.brand_color` nao representa escolha manual do usuario; color picker nao deve atualiza-lo. |
