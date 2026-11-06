---
quick_id: 261106-qxn
phase: quick
plan: 01
type: plan
wave: 1
depends_on: []
autonomous: false
status: implemented_pending_review
revision: 2
approval_required: true
implementation_authorized: true
implementation_status: complete_pending_review
approval_date: 2026-11-06
production_authorized: false
base_sha: e272516a5cd6d258b8123b8ee2ef8e7c6a81d0d6
branch: feat/fase-59-campanhas-produto-vertical-9-16
files_modified:
  - src/components/flow/campaign-page-client.tsx
  - src/components/flow/campaign-input-form.tsx
  - src/components/flow/campaign-header.module.css
  - src/components/flow/campaign-format-selector.tsx
  - src/components/flow/background-direction-selector.tsx
  - src/components/flow/campaign-brief-review.tsx
  - src/components/flow/use-campaign-form.ts
  - src/lib/campaign/list.ts
  - src/lib/dashboard/campaigns.ts
  - src/app/(app)/campanhas/client.tsx
  - src/components/dashboard/dashboard-campaigns.tsx
  - src/components/dashboard/available-campaign-card.tsx
  - src/lib/i18n/campaign-list/messages.ts
  - src/lib/i18n/campaign-list/catalogs/pt-BR.ts
  - src/lib/i18n/campaign-list/catalogs/es-419.ts
  - src/lib/i18n/dashboard/messages.ts
  - src/lib/i18n/dashboard/catalogs/pt-BR.ts
  - src/lib/i18n/dashboard/catalogs/es-419.ts
  - src/components/flow/__tests__/campaign-format-selector.test.tsx
  - src/components/flow/__tests__/campaign-input-form.test.tsx
  - src/components/flow/__tests__/campaign-brief-review.test.tsx
  - src/components/flow/__tests__/use-campaign-form-format.test.ts
  - src/components/flow/__tests__/use-campaign-form-restore-format.test.ts
  - src/__tests__/lib/campaign/list.test.ts
  - src/__tests__/app/minhas-campanhas-client.test.tsx
  - src/lib/dashboard/__tests__/campaigns.test.ts
  - src/components/dashboard/__tests__/dashboard-campaigns.test.tsx
  - src/components/dashboard/__tests__/available-campaign-card.test.tsx
  - src/lib/i18n/campaign-list/__tests__/catalogs.test.ts
  - src/lib/i18n/dashboard/__tests__/catalogs.test.ts
must_haves:
  truths:
    - "Quando o espaço útil do conteúdo comporta duas colunas, o título/subtítulo 'Dados da Campanha' fica à esquerda e o seletor de formato, com o rótulo visível 'Formato da campanha', fica na metade direita, alinhado ao topo."
    - "Quando o espaço útil não comporta duas colunas sem comprimir o seletor, o cabeçalho empilha: título, subtítulo, seletor em largura total e somente depois os campos."
    - "Existe um único seletor de formato, editável apenas na edição normal; revisão, geração e resultado desconhecido mantêm título/subtítulo sem seletor interativo."
    - "Existe uma única fonte de estado (`fields.campaignFormat`); ela não pode ser alterada depois do início da preparação da revisão nem durante uma operação."
    - "A listagem e o dashboard exibem '1:1 quadrado' ou '9:16 vertical' em pt-BR e '1:1 cuadrado' ou '9:16 vertical' em es-419, junto aos metadados, sem sobrepor a miniatura e sem redesenhar os cards."
    - "O formato dos cards vem exclusivamente do snapshot persistido, via `resolveCampaignFormat`; nunca da imagem, do path ou de um resolvedor paralelo."
    - "A ausência histórica das duas chaves resolve para 1:1; dados inválidos permanecem fail-closed e não são exibidos como 1:1."
    - "A revisão do fluxo novo elegível mostra 'Direção de fundo' imediatamente após 'Formato', usando os rótulos Estúdio / Ambientado / Original do formulário."
    - "Nenhum prompt, política, fluxo de geração, artifact, crédito, pricing, migration, flag ou contrato de produção é alterado."
  artifacts:
    - path: "src/components/flow/campaign-input-form.tsx"
      provides: "Cabeçalho único da página com título/subtítulo e seletor condicional; sem duplicar estado ou controle"
    - path: "src/components/flow/campaign-format-selector.tsx"
      provides: "Rótulo visível 'Formato da campanha' e legenda acessível preservada"
    - path: "src/components/flow/campaign-header.module.css"
      provides: "Grid intrínseco que decide duas colunas pelo espaço útil, com empilhamento automático"
    - path: "src/components/flow/use-campaign-form.ts"
      provides: "Guard que impede mutação do formato após o início da revisão ou durante operação"
    - path: "src/lib/campaign/list.ts"
      provides: "Formato resolvido no servidor para o DTO da listagem"
    - path: "src/lib/dashboard/campaigns.ts"
      provides: "Formato resolvido no servidor para o DTO do dashboard, sem expor input_snapshot"
    - path: "src/components/flow/campaign-brief-review.tsx"
      provides: "Linha 'Direção de fundo' no fluxo elegível, após Formato"
  key_links:
    - from: "src/lib/campaign/list.ts"
      to: "src/lib/campaign/format-resolution.ts"
      via: "resolveCampaignFormat"
      pattern: "resolveCampaignFormat"
    - from: "src/lib/dashboard/campaigns.ts"
      to: "src/lib/campaign/format-resolution.ts"
      via: "resolveCampaignFormat"
      pattern: "resolveCampaignFormat"
    - from: "src/app/(app)/campanhas/client.tsx"
      to: "src/lib/i18n/campaign-list/catalogs/pt-BR.ts"
      via: "messages.format"
      pattern: "format"
    - from: "src/components/dashboard/dashboard-campaigns.tsx"
      to: "src/lib/i18n/dashboard/catalogs/pt-BR.ts"
      via: "messages.campaigns.format"
      pattern: "format"
    - from: "src/components/flow/campaign-brief-review.tsx"
      to: "src/components/flow/background-direction-selector.tsx"
      via: "rótulos compartilhados de direção de fundo"
      pattern: "BACKGROUND_DIRECTION"
---

# Clareza da interface de campanhas — seletor no cabeçalho, formato nos cards e direção de fundo na revisão

**Objetivo:** tornar visíveis e inequívocos o formato escolhido e a direção de fundo da campanha, sem alterar o fluxo de geração nem antecipar filtros ou infraestrutura.

**Estado desta entrega:** **somente planejamento**. Nenhum código de implementação, teste, migration, flag, prompt, payload ou artefato de produção foi alterado. A implementação depende de revisão do Codex e autorização explícita do responsável.

---

## 1. Contexto verificado

**Fonte e limites**
- A F59 está concluída, verificada, sincronizada e arquivada. Este trabalho **não reabre** a F59: apenas refina a apresentação da interface usando os contratos já existentes.
- Prompt, políticas, resolvedor de formato, fluxo de geração e artefatos permanecem congelados.
- Produção continua **não autorizada**. Nenhum gate desta quick autoriza deploy, push, migration, geração paga ou alteração de flag.
- A F59 UI-SPEC previa o seletor após o bloco de imagens e a listagem sem identificação de formato. Esta quick substitui **apenas a apresentação** desses dois pontos, por escopo aprovado; não altera contratos de formato, payload ou geração.

**Git / worktree**
- Branch atual: `feat/fase-59-campanhas-produto-vertical-9-16`.
- `HEAD = e272516a5cd6d258b8123b8ee2ef8e7c6a81d0d6`.
- Worktree limpo antes desta etapa (`git status --porcelain` vazio). Não há alterações preexistentes a preservar ou sobreposições identificadas.
- Nenhuma branch nova, commit, push ou merge será criado nesta etapa de planejamento.

**Cadeia real inspecionada**
- `/campanhas/nova`: `campaign-page-client.tsx` renderiza `StoreIdentityBlock`, título/subtítulo e `CampaignInputForm`.
- `CampaignInputForm` usa `useCampaignForm` como única fonte de estado (`fields.campaignFormat`, `fields.backgroundDirection`) e trata os estados `isSubmitting`, `reviewMode`, `unknownResult` e formulário normal.
- `FormContent` hoje renderiza o seletor de formato no fim do formulário, depois de `Direção de fundo`, e também renderiza o banner de pausa vertical.
- `CampaignBriefReview` já exibe a linha `Formato` somente quando `eligible === true`.
- `resolveCampaignFormat` é a tabela única, pura e fail-closed para `campaignFormat` + `formatContractVersion`.
- `listCampaigns` já seleciona `input_snapshot` e mapeia cada linha no servidor.
- `queryEligibleCampaigns` (dashboard) hoje seleciona apenas `id, product_name, created_at, storage_path`; precisará incluir `input_snapshot` no servidor para resolver o formato, sem expor o snapshot ao cliente.
- A listagem e o dashboard já têm namespaces de i18n isolados (`campaign-list` e `dashboard`) com catálogos `pt-BR`/`es-419`.

---

## 2. Escopo aprovado

### 2.1 Seletor de formato no cabeçalho

- Mover o título/subtítulo “Dados da Campanha” para o mesmo cabeçalho do seletor, mantendo-o visível em todos os estados da página.
- Quando o espaço útil do conteúdo (já descontada a sidebar) comporta duas colunas sem comprimir o seletor: título/subtítulo à esquerda e seletor na metade direita, alinhados ao topo.
- Quando esse espaço não comporta duas colunas: título/subtítulo, depois seletor em largura total, antes dos campos.
- O cabeçalho é o mesmo nos estados de edição, revisão, geração e resultado desconhecido; o seletor interativo só existe na edição normal.
- Exibir o rótulo visível “Formato da campanha”.
- Manter exatamente as opções e os textos atuais, o helper atual e a legenda acessível.
- Remover o seletor da posição antiga, sem duplicar controle ou estado.
- Preservar elegibilidade, flag ON/OFF, seleção, restauração, revisão, payload e acessibilidade.
- Não permitir alteração de `fields.campaignFormat` depois do início da preparação da revisão nem durante uma operação; para trocar o formato na revisão, o usuário deve usar “Voltar e editar”.

### 2.2 Identificação do formato nos cards

- Listagem e dashboard: identificador discreto “1:1 quadrado” ou “9:16 vertical” em pt-BR; “1:1 cuadrado” ou “9:16 vertical” em es-419, junto aos metadados.
- Não sobrepor a miniatura nem redesenhar os cards.
- Derivar o formato do snapshot persistido pelo `resolveCampaignFormat` existente.
- Preservar a regra histórica de ausência das chaves e o tratamento fail-closed de dados inválidos; não deduzir formato pela imagem ou pelo path.
- Respeitar os mecanismos de tradução existentes; não traduzir dados comerciais, prompts ou conteúdo gerado.

### 2.3 Direção de fundo na revisão

- Acrescentar “Direção de fundo: Estúdio / Ambientado / Original” imediatamente após “Formato”.
- Usar a escolha efetiva do formulário e os rótulos existentes.
- Exibir somente no fluxo elegível; não alterar o legado nem o briefing enviado.

### 2.4 Evolução futura — apenas registrada

- Filtro da listagem: `Todos / Quadrado 1:1 / Vertical 9:16`.
- Quando implementado, deverá atuar na consulta paginada e combinar com busca, status e ordenação.
- **Não implementar** filtro, controle desabilitado, parâmetros novos, índices ou infraestrutura antecipada nesta quick.

---

## 3. Decisões de arquitetura propostas

| # | Decisão | Justificativa |
|---|---|---|
| D1 | O título/subtítulo sai de `CampaignPageClient` e passa a ser renderizado por `CampaignInputForm` em um cabeçalho único, presente em todos os early returns. | O seletor depende de `fields.campaignFormat`, que vive em `useCampaignForm`. Mover o título é menos invasivo do que içar estado para o pai e evita duplicar controle/estado. |
| D2 | O cabeçalho usa um grid intrínseco com `repeat(auto-fit, minmax(min(100%, 29rem), 1fr))` e `align-items: start`, via CSS module local. | A decisão passa a depender do espaço real do conteúdo (main, já sem a sidebar), não de um breakpoint de viewport. 29rem foi calibrado após medir 992 px de cabeçalho em 1440 (2 × 484) e 976 px em 1280 (2 × 476); 30rem deixava 1280 sempre empilhado. Abaixo do limiar, o grid empilha sozinho. |
| D3 | O seletor permanece exatamente um; o banner de pausa vertical acompanha o seletor no cabeçalho. Ele é montado apenas na edição normal (`eligible && !reviewMode && !isSubmitting && !preparing && !unknownResult`). | Remove a posição antiga sem criar um segundo controle e mantém o aviso próximo da escolha que ele bloqueia. Revisão/geração/resultado desconhecido não ganham seletor interativo. |
| D4 | `CampaignFormatSelector` ganha `<h2 id="campaignFormat-heading">Formato da campanha</h2>` visível; a `<legend>` existente continua `sr-only` com “Selecione o formato da campanha”. | Atende ao rótulo visível sem quebrar o nome acessível do grupo nem mudar as opções. |
| D5 | Listagem e dashboard usam `resolveCampaignFormat` no mapeamento server-side e expõem apenas `format: "1:1" \| "9:16" \| null`. | Menor propagação possível, sem resolvedor paralelo e sem enviar `input_snapshot` ao cliente. |
| D6 | `null` significa formato indisponível e **não** é renderizado como 1:1. | Preserva o fail-closed: dado inválido não pode virar uma afirmação comercial falsa. |
| D7 | A ausência das duas chaves resolve para `1:1/absent` e é exibida como “1:1 quadrado” (pt-BR) / “1:1 cuadrado” (es-419). | Preserva a regra histórica do contrato F59 com os novos rótulos aprovados. |
| D8 | Os rótulos dos cards entram nos namespaces `campaign-list` e `dashboard` (`pt-BR`/`es-419`): pt-BR `1:1 quadrado`/`9:16 vertical`; es-419 `1:1 cuadrado`/`9:16 vertical`. | Reutiliza o mecanismo de tradução existente; o nome do produto continua com `lang=""` e não é traduzido. |
| D9 | A revisão usa `fields.backgroundDirection` e um mapa de rótulos curtos compartilhado com o seletor do formulário. | Usa a escolha efetiva e os rótulos existentes, sem duplicar strings. Se a direção estiver ausente em um estado impossível (o gate bloqueia a revisão), a linha é omitida em vez de inventar “Estúdio”. |
| D10 | `useCampaignForm.setField("campaignFormat", ...)` ganha um guard defensivo que ignora a mutação quando a revisão começou, a preparação está em curso, uma submissão está ativa ou há resultado desconhecido. A restauração continua usando `setFields` e não é afetada. | Garante que a fonte única não mude por engano depois do congelamento da revisão, mesmo que algum controle seja montado indevidamente no futuro. |
| D11 | Nenhuma alteração em `buildCampaignGenerationBody`, prompts, políticas, rotas de geração, crédito, pricing, artefatos, thumbnails ou banco. | Fora do escopo e proibido pelos contratos congelados. |

---

## 4. Esboço visual

### 4.1 Duas colunas — quando o espaço útil comporta

```
┌──────────────────────────────────────────────────────────────────────┐
│ [StoreIdentityBlock]                                                 │
│                                                                      │
│ ┌────────────────────────────────┐  ┌──────────────────────────────┐ │
│ │ Dados da Campanha              │  │ Formato da campanha          │ │
│ │ Informe os dados do produto    │  │ ( ) Quadrado 1:1 - feed      │ │
│ │ e da oferta                    │  │ ( ) Vertical 9:16 - Stories  │ │
│ │                                │  │     e Reels (imagem estática)│ │
│ │                                │  │ helper de áreas seguras      │ │
│ │                                │  │ [banner de pausa, se houver] │ │
│ └────────────────────────────────┘  └──────────────────────────────┘ │
│                                                                      │
│ [avisos de restauração/direção, se houver]                           │
│ Produto                                                              │
│ ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

- Título e seletor começam no mesmo topo.
- A metade direita é uma coluna de largura total; as opções continuam empilhadas em uma coluna.
- O label longo quebra naturalmente em quantas linhas forem necessárias; não há `line-clamp`, truncamento ou limite de duas linhas.
- O radio fica alinhado ao topo da primeira linha do label.
- A decisão de duas colunas depende do espaço do container (main sem sidebar), não da largura da janela. Com a sidebar de 224 px, uma janela de 1024 px normalmente empilha; a partir do espaço que comporta duas colunas de 29rem, o grid passa a duas colunas. Medição real: 1440 px → cabeçalho 992 px e duas colunas de 484 px; 1280 px → cabeçalho 976 px e duas colunas de 476 px; 1024 px → cabeçalho 720 px e empilhamento.

### 4.2 Empilhado — quando o espaço útil é insuficiente

```
Dados da Campanha
Informe os dados do produto e da oferta

┌──────────────────────────────────────┐
│ Formato da campanha                  │
│ ( ) Quadrado 1:1 - feed              │
│ ( ) Vertical 9:16 - Stories e Reels  │
│     (imagem estática)                │
│ helper de áreas seguras              │
│ [banner de pausa, se houver]         │
└──────────────────────────────────────┘

[avisos]
Produto
...
```

- Ordem DOM: título → subtítulo → seletor → avisos → campos.
- Largura total, sem rolagem horizontal; o texto longo quebra naturalmente.

### 4.3 Identificadores nos cards

Listagem (`/campanhas`), card atual preservado:

```
[ miniatura ]  Nome do produto
               10/07/2026 · 1:1 quadrado
               Pronta
                                      [Abrir] [Baixar]
```

Dashboard (`/dashboard`), linha atual preservada:

```
[ miniatura ]  Nome do produto
               19 de out. de 2026 · 9:16 vertical
                                      [Abrir campanha →]
```

- O identificador fica no bloco de metadados, nunca dentro/sobre a miniatura.
- `flex-wrap` no agrupamento data + formato para não criar overflow em telas estreitas.
- Nenhuma mudança no tamanho da miniatura, no `alt`, no fallback ou no link.

### 4.4 Revisão

```
Oferta
  Tipo               Oferta
  Formato            Vertical 9:16  1080 × 1920 px
  Direção de fundo   Estúdio
  Selo               50% OFF
  ...
```

- “Direção de fundo” vem imediatamente após “Formato”.
- No fluxo legado, nenhuma das duas linhas aparece.

---

## 5. Estratégia de estado e dados

### 5.1 Formulário

- Nenhum estado novo de formato.
- `fields.campaignFormat` continua sendo a única fonte; o seletor no cabeçalho chama o mesmo `setField("campaignFormat", ...)`.
- `fields.backgroundDirection` continua sendo a escolha efetiva; a revisão lê esse valor.
- `CampaignInputForm` calcula o cabeçalho antes dos early returns, exibindo título/subtítulo em todos os estados. O seletor interativo só é montado quando:
  - `eligible === true`;
  - não está em `isSubmitting`, `reviewMode`, `preparing` ou `unknownResult`.
- Revisão, geração e resultado desconhecido mantêm o título/subtítulo visíveis, mas sem seletor interativo. Na revisão, a única forma de trocar o formato é “Voltar e editar”.
- Guard defensivo em `useCampaignForm.setField`: quando `campaignFormat` é o campo alterado, a mutação é ignorada se a revisão já começou, a preparação está em curso, uma submissão está ativa ou há resultado desconhecido. A restauração não passa por `setField` e permanece intacta.
- O banner de pausa (`campaignFormatPaused`) acompanha o seletor; `FormContent` continua recebendo `campaignFormatPaused` apenas para bloquear o submit e ajustar `aria-disabled`/`title`.
- `verticalEnabled` e `campaignFormatUnavailable` deixam de ser necessários em `FormContent`; permanecem no cabeçalho/selector. A limpeza de props evita código morto.

### 5.2 Cards

- `CampaignListItem` ganha `format: "1:1" | "9:16" | null`.
- `EligibleCampaignCard` ganha o mesmo campo.
- `listCampaigns.mapToListItem` resolve o formato a partir de `row.input_snapshot` com `resolveCampaignFormat`.
- `queryEligibleCampaigns` inclui `input_snapshot` no `select` **server-side** e resolve o formato no mapeamento; o DTO devolvido ao cliente continua sem `input_snapshot`, sem `storage_path` e sem dados comerciais.
- Nenhuma consulta nova, nenhum índice, nenhum parâmetro de filtro e nenhum resolvedor paralelo.

### 5.3 i18n

- Adicionar em `CampaignListMessages` e `DashboardMessages` um namespace `format` com `square` e `vertical`.
- `pt-BR`: `1:1 quadrado` / `9:16 vertical`.
- `es-419`: `1:1 cuadrado` / `9:16 vertical`.
- Atualizar os testes de paridade de chaves e valores.
- O nome do produto continua com `lang=""`; o rótulo de formato herda o idioma da página.
- As opções do seletor permanecem com os textos atuais (`Quadrado 1:1 - feed` / `Vertical 9:16 - Stories e Reels (imagem estática)`); os novos rótulos são exclusivos dos cards.

---

## 6. Tratamento de formato histórico, válido e indisponível

| Snapshot persistido | Resultado de `resolveCampaignFormat` | DTO do card | UI |
|---|---|---|---|
| Objeto sem `campaignFormat` e sem `formatContractVersion` | `{ kind: "1:1", source: "absent" }` | `"1:1"` | “1:1 quadrado” (pt-BR) / “1:1 cuadrado” (es-419) |
| `campaignFormat: "9:16"` + `formatContractVersion: "f59-vertical-9-16-v1"` | `{ kind: "9:16", contractVersion: ... }` | `"9:16"` | “9:16 vertical” (ambos os idiomas) |
| `campaignFormat` malformado/desconhecido | `{ kind: "unavailable", reason }` | `null` | Nenhum identificador; nunca “1:1 quadrado”/“9:16 vertical” |
| `9:16` sem versão, versão desconhecida ou par incoerente | `{ kind: "unavailable", reason }` | `null` | Nenhum identificador; fail-closed |
| `campaignFormat: "1:1"` explícito | `{ kind: "unavailable", reason: "explicit_one_to_one" }` | `null` | Nenhum identificador |
| `input_snapshot` nulo/não-objeto | `{ kind: "unavailable", reason: "malformed_format" }` | `null` | Nenhum identificador |

**Regra de ouro:** o card nunca infere formato pela miniatura, pelo path (`art-1024.jpg`/vertical), pelo status ou pelo fluxo. A única fonte é o resolvedor existente sobre o snapshot persistido.

**Decisão de UI para indisponível:** omitir o identificador. Não exibir “Formato indisponível” no card nesta quick, para não transformar um detalhe técnico em mensagem comercial e para não sugerir um formato que não pôde ser validado. A ausência do identificador é o estado fail-closed visual.

---

## 7. Arquivos afetados e tarefas

### Tarefa 1 — Reposicionar o seletor e o cabeçalho

**Arquivos**
- `src/components/flow/campaign-page-client.tsx`
- `src/components/flow/campaign-input-form.tsx`
- `src/components/flow/campaign-header.module.css`
- `src/components/flow/use-campaign-form.ts`
- `src/components/flow/campaign-format-selector.tsx`
- `src/components/flow/__tests__/campaign-format-selector.test.tsx`
- `src/components/flow/__tests__/campaign-input-form.test.tsx`
- `src/components/flow/__tests__/use-campaign-form-format.test.ts`

**Ações**
1. Remover o `<h1>/<p>` de `CampaignPageClient`; manter `StoreIdentityBlock` e o banner de geração pausada.
2. Em `CampaignInputForm`, criar o cabeçalho com título/subtítulo e o seletor condicional; renderizá-lo antes dos early returns.
3. Criar `campaign-header.module.css` com grid intrínseco `repeat(auto-fit, minmax(min(100%, 29rem), 1fr))`, `align-items: start` e `gap`; usar `min-w-0` nos filhos. Não usar `lg:grid-cols-2` nem breakpoint de viewport como única regra. O limiar foi reduzido de 30rem para 29rem após medir a largura real do cabeçalho (1280 px → 976 px, duas colunas de 476 px).
4. Mover o banner de pausa e o `CampaignFormatSelector` para o cabeçalho; remover o bloco antigo de `FormContent`.
5. Montar o seletor somente quando `eligible && !reviewMode && !isSubmitting && !preparing && !unknownResult`; nos demais estados, manter apenas título/subtítulo + painel existente.
6. Adicionar guard em `useCampaignForm.setField` para ignorar `campaignFormat` quando a revisão começou, a preparação está em curso, a submissão está ativa ou há resultado desconhecido. A restauração via `setFields` não é afetada.
7. Adicionar `<h2>` visível “Formato da campanha” no selector; manter a `<legend>` sr-only e a estrutura de radios.
8. Remover props agora não usadas de `FormContent` (`verticalEnabled`, `campaignFormatUnavailable`), preservando `campaignFormatPaused` para o gate de submit.
9. Não alterar `buildCampaignGenerationBody` ou qualquer rota.

**Critério de conclusão**
- Um único `getByTestId("flow-campaign-format-selector")`, apenas na edição normal.
- Título presente em formulário, revisão, submitting e unknown.
- Ordem DOM empilhada: título → subtítulo → seletor → campos.
- Revisão/geração/unknown não têm seletor interativo; “Voltar e editar” é o caminho para trocar de formato.
- `setField("campaignFormat", ...)` é ignorado durante revisão/preparação/submissão/unknown.
- Radio/flag/pausa/restauração continuam funcionando.

### Tarefa 2 — Propagar e exibir o formato nos dois consumidores

**Arquivos**
- `src/lib/campaign/list.ts`
- `src/lib/dashboard/campaigns.ts`
- `src/app/(app)/campanhas/client.tsx`
- `src/components/dashboard/dashboard-campaigns.tsx`
- `src/components/dashboard/available-campaign-card.tsx`
- `src/lib/i18n/campaign-list/messages.ts`
- `src/lib/i18n/campaign-list/catalogs/pt-BR.ts`
- `src/lib/i18n/campaign-list/catalogs/es-419.ts`
- `src/lib/i18n/dashboard/messages.ts`
- `src/lib/i18n/dashboard/catalogs/pt-BR.ts`
- `src/lib/i18n/dashboard/catalogs/es-419.ts`
- testes correspondentes

**Ações**
1. Adicionar `format` aos DTOs e mapear via `resolveCampaignFormat`.
2. Incluir `input_snapshot` no `select` do dashboard apenas no servidor; manter o DTO enxuto.
3. Adicionar chaves de tradução `format.square`/`format.vertical` nos dois namespaces.
4. Renderizar o rótulo junto à data/status, com `flex-wrap`, sem alterar miniatura, card ou link.
5. Não adicionar filtro, query param, controle desabilitado ou índice.

**Critério de conclusão**
- 1:1 histórico, 9:16 válido e indisponível testados nos dois mapeadores e nas duas UIs.
- Snapshot nunca chega ao cliente.
- pt-BR exibe “1:1 quadrado”/“9:16 vertical”; es-419 exibe “1:1 cuadrado”/“9:16 vertical”.
- Nenhum badge sobre a miniatura.

### Tarefa 3 — Direção de fundo na revisão e regressão

**Arquivos**
- `src/components/flow/background-direction-selector.tsx`
- `src/components/flow/campaign-brief-review.tsx`
- `src/components/flow/__tests__/campaign-brief-review.test.tsx`
- `src/components/flow/__tests__/use-campaign-form-restore-format.test.ts`

**Ações**
1. Exportar do selector um mapa de rótulos curtos (`studio` → “Estúdio”, `ambient` → “Ambientado”, `original` → “Original”) ou um módulo compartilhado equivalente.
2. Na revisão, adicionar a linha “Direção de fundo” imediatamente após “Formato”, somente quando `eligible` e houver direção válida.
3. Não alterar o body, o prompt ou o briefing; apenas exibir o valor já escolhido.
4. Cobrir os três valores e a ausência no legado.

**Critério de conclusão**
- A linha aparece após Formato nos três valores.
- Legado não mostra “Formato” nem “Direção de fundo”.
- Payload 1:1 sem chave `campaignFormat` e payload 9:16 com `campaignFormat: "9:16"` permanecem iguais.

---

## 8. Plano de testes

### 8.1 Seleção, restauração e flag ON/OFF

- [ ] `CampaignFormatSelector`: default 1:1, seleção vertical, `verticalEnabled=false` desabilita apenas 9:16, `disabled` desabilita ambos, helper e aviso de indisponibilidade preservados.
- [ ] `CampaignInputForm`: flag OFF mantém seletor visível com 9:16 desabilitado; pausa vertical mantém 9:16 selecionado, radios desabilitados, banner e submit bloqueado.
- [ ] Restauração vertical mantém `9:16` no estado, na revisão e no body.
- [ ] Restauração 1:1 mantém `1:1` e o body sem a chave `campaignFormat`.
- [ ] Formato vertical indisponível não cai para 1:1.
- [ ] Título e seletor aparecem uma única vez; nenhum controle duplicado.
- [ ] Edição normal elegível: seletor interativo conforme flag; flag OFF mantém o controle visível com 9:16 desabilitado.
- [ ] Revisão: título/subtítulo presentes, seletor ausente; “Voltar e editar” restaura a edição.
- [ ] Geração (`isSubmitting`): título/subtítulo presentes, seletor ausente.
- [ ] Resultado desconhecido: título/subtítulo presentes, seletor ausente.
- [ ] Guard: `setField("campaignFormat", ...)` é ignorado após o início da revisão, durante a preparação, durante a submissão e no resultado desconhecido; restauração via `setFields` continua funcionando.

### 8.2 Identificação nos dois consumidores

- [ ] `listCampaigns` mapeia snapshot sem chaves → `1:1`; 9:16 válido → `9:16`; inválido/nulo → `null`.
- [ ] `queryEligibleCampaigns` mapeia os mesmos três casos e mantém o DTO sem `input_snapshot`/`storage_path`.
- [ ] Listagem mostra “1:1 quadrado” e “9:16 vertical” nos metadados; não mostra identificador para `null`.
- [ ] Dashboard mostra os mesmos rótulos; não sobrepõe a miniatura.
- [ ] `es-419` mostra “1:1 cuadrado”/“9:16 vertical”; nome do produto continua `lang=""`.
- [ ] Nenhuma inferência por path/miniatura: um card com URL vertical e snapshot 1:1 continua “1:1 quadrado” (e vice-versa).

### 8.3 Direção de fundo na revisão

- [ ] `eligible` + `studio` → “Estúdio”.
- [ ] `eligible` + `ambient` → “Ambientado”.
- [ ] `eligible` + `original` → “Original”.
- [ ] Ordem visual: “Formato” → “Direção de fundo” → “Selo”.
- [ ] Legado: nenhuma das duas linhas.
- [ ] Estado defensivo sem direção válida: linha omitida, nunca “Estúdio” inventado.

### 8.4 Preservação de 1:1, legado e payload

- [ ] Body legado/elegível 1:1 permanece sem `campaignFormat`.
- [ ] Body vertical permanece com `campaignFormat: "9:16"`.
- [ ] `backgroundDirection` continua no body elegível e fora do legado.
- [ ] Nenhum teste de prompt/política precisa ser atualizado.
- [ ] Nenhuma chamada de geração, provider ou crédito é executada.

### 8.5 Teclado, foco, responsividade e overflow

- [ ] Radios nativos, `<fieldset>/<legend>`, `aria-describedby` e alvo de 44 px preservados.
- [ ] Foco visível no container de cada opção (`focus-within:ring-2`).
- [ ] Navegação por Tab e setas do grupo de radios verificada manualmente.
- [ ] Larguras 320, 375, 768, 1024, 1280 e 1440 px sem rolagem horizontal, considerando a sidebar de 224 px.
- [ ] Com 1024 px de viewport (espaço útil reduzido pela sidebar), o cabeçalho empilha (720 px de cabeçalho); com 1280 px e 1440 px, passa a duas colunas (976 px e 992 px de cabeçalho, respectivamente).
- [ ] O grid intrínseco decide pelo espaço do container, não apenas pela largura da janela; um viewport largo com conteúdo estreito continua empilhado.
- [ ] Label longo do vertical quebra naturalmente em quantas linhas forem necessárias, sem truncamento, `line-clamp` ou limite de duas linhas.
- [ ] Título/subtítulo e seletor não colidem quando há duas colunas; a metade direita permanece alinhada ao topo.
- [ ] Cards mantêm miniatura, fallback, link e ações; o rótulo de formato não é `position:absolute`.

---

## 9. Gates previstos

1. **Testes focados** (Vitest) nos arquivos alterados:
   - `campaign-format-selector.test.tsx`
   - `campaign-input-form.test.tsx`
   - `campaign-brief-review.test.tsx`
   - `use-campaign-form-format.test.ts`
   - `use-campaign-form-restore-format.test.ts`
   - `list.test.ts`
   - `minhas-campanhas-client.test.tsx`
   - `campaigns.test.ts` (dashboard)
   - `dashboard-campaigns.test.tsx`
   - `available-campaign-card.test.tsx`
   - catálogos `campaign-list` e `dashboard`
2. **Typecheck:** `npm run typecheck`.
3. **Lint:** `npm run lint` (registrar a limitação conhecida: lint atual não cobre TypeScript).
4. **Build:** `npm run build`.
5. **Diff check:** `git diff --check`.
6. **Revisão visual manual** local:
   - desktop 1440 px e 1280 px (duas colunas, se o espaço útil permitir);
   - desktop 1024 px com a sidebar visível (deve empilhar, sem comprimir o seletor);
   - mobile 375 px e 320 px; tablet 768 px;
   - conferir também que um viewport largo com conteúdo restrito mantém o empilhamento;
   - flag ON e OFF cobertas por testes/mocks; **não alterar a flag** em banco ou ambiente;
   - abrir a revisão e conferir Formato + Direção de fundo;
   - confirmar que revisão/geração/resultado desconhecido não exibem seletor interativo;
   - conferir listagem e dashboard com campanhas 1:1 e 9:16 existentes.
7. **Sem geração paga**: não clicar em “Confirmar e gerar campanha”; nenhuma chamada a provider.
8. **Sem produção:** sem push, merge, deploy, migration ou alteração de flag.
9. **Revisão Codex** antes da implementação e revisão da execução depois.
10. **Aprovação explícita:** a execução só começa depois da revisão deste plano e da autorização do responsável; os gates acima fazem parte da execução autorizada, não desta etapa de planejamento.

---

## 10. Riscos, decisões remanescentes e confirmação de contratos

| Risco / decisão | Mitigação |
|---|---|
| Mover o título para `CampaignInputForm` pode fazê-lo desaparecer em estados de submitting/review/unknown. | Renderizar o cabeçalho antes de todos os early returns; testes cobrem os quatro estados. |
| O seletor pode reaparecer indevidamente em revisão/geração/unknown. | Montar somente na edição normal; guard defensivo no `setField`; testes de ausência do seletor e de mutação ignorada. |
| O dashboard passará a selecionar `input_snapshot` no servidor. | O DTO continua expondo apenas `format`; atualizar o teste que hoje afirma “no input_snapshot” para “input_snapshot only server-side, never in DTO”. |
| A listagem/dashboard pode exibir “1:1 quadrado” para campanhas legadas com snapshot-objeto sem chaves. | É a regra histórica aprovada; snapshot nulo/malformado continua `null` e não é exibido. |
| Um `campaignFormat: "1:1"` explícito é `unavailable` pelo resolvedor. | Não reinterpretar; card sem identificador. Não há fallback silencioso. |
| Rótulos em espanhol são novos. | Adicionar apenas “1:1 cuadrado”/“9:16 vertical” aos catálogos e validar paridade; não traduzir nome do produto, prompts ou conteúdo gerado. |
| A linha “Direção de fundo” pode ficar ausente se o estado estiver inconsistente. | O gate de revisão exige escolha; na ausência defensiva, omitir a linha em vez de inventar “Estúdio”. |
| O seletor no cabeçalho pode comprimir o label longo do vertical. | Grid intrínseco com mínimo de 29rem por coluna; se não couber, empilha. `min-w-0` e quebra natural, sem limite de linhas; validar manualmente. O limiar foi medido contra a largura real do cabeçalho em 1280/1440. |
| A largura da janela pode não refletir o espaço útil por causa da sidebar. | A decisão de layout usa o espaço do container do cabeçalho (CSS module), não um breakpoint de viewport. |
| Escopo pode crescer para filtro de formato. | Filtro registrado apenas como evolução futura; nenhum parâmetro, índice, controle ou infraestrutura será criado. |

**Confirmação de congelamento**
- Nenhuma alteração em prompt, política, compositor, `resolveCampaignFormat`, `buildCampaignGenerationBody`, rotas de geração/download/recovery, modelos, pricing, créditos, artefatos, miniaturas ou banco.
- Nenhuma alteração no contrato de `input_snapshot`; o formato continua persistido como hoje.
- Produção continua não autorizada. A conclusão desta quick, se aprovada e executada, será apenas local/homologável, sem ativação.

---

## 11. Fora do escopo (reafirmado)

- Prompts, geração, modelos, pricing, créditos, artefatos e miniaturas.
- Proteção contra perda de dados, persistência após reload e botão “Limpar dados”.
- Correção da lacuna de auditoria do replay terminal.
- Filtro de formato na listagem e qualquer parâmetro/índice/infraestrutura antecipada.
- Migration, geração paga, alteração de flag, push, deploy e produção.

---

**PLANEJAMENTO PRONTO — IMPLEMENTAÇÃO NÃO INICIADA**
