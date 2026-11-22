## Context

Hoje a apresentação dos formatos é fragmentada:

- `src/lib/campaign/list.ts` resolve o formato individual com `resolveCampaignFormat` e, para campanhas conjuntas, delega a `readTwoFormatListSummaries`; o DTO expõe `format`, `joint`, `formats` e `preferredFormat`.
- `src/lib/dashboard/campaigns.ts` repete a mesma composição para os cards do dashboard.
- `src/app/(app)/campanhas/client.tsx` e `src/components/dashboard/dashboard-campaigns.tsx` traduzem esses campos em rótulos soltos ou chips apenas para formatos entregues de campanhas conjuntas.
- `src/app/(app)/campanhas/[id]/page.tsx` classifica o fluxo conjunto antes do individual, resolve `?format=` estritamente e só monta `joint` para campanhas conjuntas.
- `src/app/(app)/campanhas/[id]/client.tsx` duplica o bloco de chips em `ReadyView` e `NewFlowDeliveredView`, usa `1:1`/`9:16` crus e não mostra chips nos estados `running`, `refunded`, `unknown`, `generating`, `stale`, `error` ou aprovação.
- `src/lib/product-two-format/read-model.ts` já distingue `delivered`, `processing`, `absent`, `unknown` e `unavailable`, incluindo `creditRefunded`. Essa autoridade não deve ser recriada.
- `src/lib/campaign/format-resolution.ts` é a autoridade individual: snapshot sem as duas chaves de formato segue o contrato histórico `1:1`; snapshot nulo/malformado/contrato desconhecido resolve para `unavailable`, sem fallback.

O design precisa unificar a **apresentação** sem unificar as autoridades de entrega, mantendo leitura em lote e sem novas consultas por card.

## Goals / Non-Goals

**Goals:**

- Um modelo de apresentação tipado, puro e seguro para os formatos `1:1` e `9:16`, com estados explícitos e informação de estorno.
- Um componente visual compartilhado, usado por listagem, dashboard e detalhe, com os mesmos nomes, vocabulário e semântica de estados. Cada superfície pode ter menos evidência que outra; o que não pode divergir é o significado dos estados.
- Dois chips sempre presentes nas superfícies de campanha, inclusive para formatos ausentes, processando, estornados e indeterminados.
- Detalhe com destaque do formato ativo distinto de “apenas disponível”, preservando a seleção conjunta e os gates atuais.
- Acessibilidade por teclado, toque, hover/foco, sem depender de cor e sem botões desabilitados como única via de explicação.
- Localização `pt-BR`/`es-419` com uma única fonte de textos para os formatos.
- Zero novas consultas de banco/Storage por card; reutilizar os read models existentes.

**Non-Goals:**

- Gerar, expandir, reservar, estornar, cobrar ou confirmar custo de qualquer formato.
- Definir elegibilidade futura para `1:1 → 9:16` ou `9:16 → 1:1`.
- Ler artefatos, bytes, paths, miniaturas ou proporções para inferir formato ou disponibilidade.
- Alterar `resolveCampaignFormat`, `readTwoFormatDelivery`, `deriveTwoFormatDeliveryView`, RPCs, migrations, flags ou dados persistidos.
- Alterar copy, miniatura, aprovação, recuperação de copy ou ações existentes de abrir/baixar.
- Adicionar navegação individual por chip na listagem ou no dashboard.

## Decisions

### 1. Modelo de apresentação puro e separado das autoridades

Criar `src/lib/campaign/format-presentation.ts` (sem `server-only`, sem I/O) com:

```ts
type CampaignFormatKey = "1:1" | "9:16";

type CampaignFormatPresentationState =
  | "delivered"
  | "processing"
  | "absent"
  | "unknown"
  | "unavailable";

interface CampaignFormatPresentationEntry {
  state: CampaignFormatPresentationState;
  /** Só existe em `absent`; nunca esconde estorno conhecido. */
  refunded: boolean;
  /** `not_requested` = fluxo individual não pediu o outro formato. */
  reason: "not_requested" | "not_delivered" | null;
  /** Destaque de seleção no detalhe; sempre `false` em lista/dashboard. */
  active: boolean;
}

interface CampaignFormatPresentation {
  formats: Readonly<Record<CampaignFormatKey, CampaignFormatPresentationEntry>>;
  /** Fluxo que originou a campanha: um formato solicitado ou os dois. */
  flow: "single_format" | "two_format";
  /** Só é `true` quando os dois formatos foram solicitados e um não foi entregue. */
  partial: boolean;
  anyDelivered: boolean;
}
```

Builders puros:

- `buildJointFormatPresentation({ "1:1": { state, refunded }, "9:16": { state, refunded } }, activeFormat?)` — mapeia o read model conjunto sem reinterpretar.
- `buildIndividualFormatPresentation({ resolution, lifecycle }, activeFormat?)` — usa o formato persistido e o ciclo de vida já resolvido pela superfície.
- `buildUnknownFormatPresentation()` — ambos `unknown` (leitura/classificação indeterminada).
- `buildUnavailableFormatPresentation()` — ambos `unavailable` (contrato inválido/desconhecido).

**Por quê:** a decisão de entrega continua nas autoridades existentes; o modelo apenas traduz estados seguros para a UI. **Alternativa rejeitada:** montar labels diretamente em cada superfície, que é a origem da divergência atual.

### 2. Autoridade dos dados: conjunto antes do individual

Ordem obrigatória em todas as superfícies:

1. `classifyTwoFormatCampaign(input_snapshot)`.
2. Se `two_format`: usar o read model conjunto (lista/dashboard: `readTwoFormatListSummaries`; detalhe: `readTwoFormatDelivery` + outcomes duráveis já aplicados).
3. Se `inconsistent` ou fluxo indeterminado: ambos `unknown`/`unavailable`; nunca cair no resolvedor individual.
4. Se `not_two_format`: `resolveCampaignFormat(input_snapshot)`.
5. Se o resolvedor individual retorna `unavailable`: ambos `unavailable`; **nunca** aplicar fallback novo para `1:1`.
6. Snapshot objeto sem as duas chaves de formato: `1:1` histórico, conforme o resolvedor já reconhece.

**Por quê:** o snapshot conjunto declara `campaignFormat: "1:1+9:16"`, valor que o resolvedor individual trata como não suportado. Classificar o conjunto primeiro evita que uma campanha conjunta seja apresentada como indeterminada individual. **Alternativa rejeitada:** tentar o individual primeiro e depois o conjunto.

### 3. Matriz de estados por fluxo

| Origem / superfície | Evidência disponível | Formato persistido | Outro formato |
|---|---|---|---|
| Conjunta | read model por formato | `delivered`, `processing`, `absent` (+`refunded`), `unknown` ou `unavailable` | mapeado pelo mesmo read model |
| Individual — lista/dashboard | `status = ready` + resolvedor válido | `delivered` | `absent/not_requested` |
| Individual — lista/dashboard | `status = generating` | `processing` | `absent/not_requested` |
| Individual — lista/dashboard | `status = error` | `unknown` (não comprova ausência) | `absent/not_requested` |
| Individual — detalhe new-flow | `newFlow.state = delivered` | `delivered` | `absent/not_requested` |
| Individual — detalhe new-flow | `newFlow.state = running` | `processing` | `absent/not_requested` |
| Individual — detalhe new-flow | `newFlow.state = refunded` | `absent` + `refunded` | `absent/not_requested` |
| Individual — detalhe new-flow | `newFlow.state = unknown` | `unknown` | `absent/not_requested` |
| Individual — detalhe legado | `displayStatus = ready` | `delivered` | `absent/not_requested` |
| Individual — detalhe legado | `displayStatus = generating` | `processing` | `absent/not_requested` |
| Individual — detalhe legado | `displayStatus = stale` | `unknown` | `absent/not_requested` |
| Individual — detalhe legado | `displayStatus = error` | `unknown` (não comprova ausência) | `absent/not_requested` |
| Individual — detalhe aprovação | `approval = pending` com candidata | `delivered`, sem ativo; acesso pelo gate existente | `absent/not_requested` |
| Individual — detalhe aprovação | `approval = regenerating` | `processing`, sem ativo | `absent/not_requested` |
| Individual — qualquer | resolver individual `unavailable` | `unavailable` | `unavailable` |

Regras:

- `partial = flow === "two_format" && anyDelivered && !allDelivered`. Campanha individual pronta não é parcial: o outro formato é `absent/not_requested`, não uma falha de entrega.
- `refunded` só é `true` quando a autoridade já expõe `creditRefunded`/operação `refunded`; nunca é presumido por `status = error`.
- `status = error` NÃO comprova ausência. Sem evidência explícita de estorno/entrega, o formato é `unknown`, não `absent/not_delivered`.
- Em lista/dashboard, o ciclo individual é derivado de `campaigns.status` e do marcador de fluxo existente; não há leitura de operação/credit por card. `status = ready` é a evidência de entrega disponível nessa superfície; nenhum `storage_path`, nome de arquivo ou miniatura é consultado para confirmar ou inferir formato. Em detalhe, o ciclo usa `newFlow.state`/`displayStatus`/`approval` já lidos.
- A apresentação pode ter menos informação na lista do que no detalhe (por exemplo, `unknown` na lista e `absent` + `refunded` no detalhe quando a operação é lida). O que SHALL ser padronizado é o vocabulário/semântica dos estados, não o conhecimento idêntico entre telas.
- O outro formato de uma campanha individual é `absent/not_requested`, não `unknown`: o fluxo é positivamente single-format quando o formato persistido é válido. Se o formato persistido não é válido, ambos são `unavailable`.
- Aprovação/regeneração: o chip reflete o estado indicado acima; as ações continuam governadas pelas superfícies/gates atuais. Nenhuma leitura de aprovação é adicionada a lista/dashboard.

### 4. Componente compartilhado e contrato visual

Criar `src/components/campaign/campaign-format-chips.tsx` (`"use client"`), com props somente de apresentação:

```ts
interface CampaignFormatChipsProps {
  presentation: CampaignFormatPresentation;
  messages: CampaignFormatPresentationMessages;
  hrefs?: Partial<Record<CampaignFormatKey, string>>;
  /** Idioma da região flutuante (ex.: "es-419"); o portal vive fora do wrapper. */
  helpLang?: string;
}
```

- Renderiza sempre `1:1` e `9:16`, nesta ordem, em uma lista com nome acessível.
- Texto visível APENAS o nome do formato (“Quadrado 1:1”/“Vertical 9:16”). Rótulos “Disponível”/“Não incluído”/“Não entregue”/“Selecionado” e badge não aparecem no chip; estado completo permanece no nome/descrição acessível e na ajuda.
- Cada chip tem um wrapper acessível (`role="group"`/`aria-label` com nome + estado completo) e uma descrição estável em nó `hidden` referenciada por `aria-describedby` para leitor de tela.
- `delivered`: destaque discreto (`text-text-primary`, `bg-accent-green/10`, borda suave), sem ícone/rótulo visível. Se houver `href`, o chip vira link; sem `href`, permanece informativo.
- `active`: borda/fundo distintos (`ring-1 ring-accent-green/40 bg-accent-green/15`) + `aria-current`/estado acessível; sem badge.
- `processing`: `Loader2` pequeno; `absent`: cinza legível (`text-text-secondary`, `bg-bg-elevated`), sem ícone/rótulo visível; `refunded`: `Undo2` pequeno; `unknown`/`unavailable`: `CircleHelp` pequeno + borda tracejada.
- Nunca usa o texto “Não gerado” para `unknown`/`unavailable`.
- Ajuda: botão “?” irmão do link (nunca aninhado), aparência compacta sem círculo/borda grande, hit area ≥44×44, `aria-expanded`; `aria-controls` somente quando o popover estiver montado. Popover em `createPortal` após mount, `position: fixed`, `lang={helpLang}`, fora do fluxo, clampado na viewport; abre por hover/foco/click; primeiro acionamento após hover/foco fixa, segundo/fora/`Escape` fecham; sem conteúdo focável quando fechado.
- Sem portal no servidor: `mounted` via `useEffect`; SSR/renderToString não acessa `document`.
- Responsivo: `flex flex-wrap`, `min-w-0`, textos que quebram; não empurra nome, ações ou miniaturas para fora do card; espaçamento consistente até a arte no detalhe.
- Ícones somente `lucide-react`, sem emojis; tema dark do `openspec/design-system/MASTER.md`.
- Os chips NÃO introduzem chamadas ou efeitos novos. A renderização existente do detalhe — incluindo leituras por RPC, recuperação legada e polling já condicionados — SHALL ser preservada; os chips apenas reutilizam dados já disponíveis. A única interação adicional é abrir/fechar a explicação local.

**Alternativa rejeitada:** chips interativos também na lista/dashboard. O usuário pediu explicitamente que esta fatia não acrescente navegação individual por chip; as ações “Abrir” e “Baixar” continuam sendo os caminhos existentes.

### 5. Lista e dashboard: dados já disponíveis, sem N+1

- `CampaignListItem` e `EligibleCampaignCard` ganham `formatPresentation: CampaignFormatPresentation`; os campos `joint`, `formats`, `preferredFormat` e `format` existentes permanecem para miniatura/`?format=` das ações atuais.
- `readTwoFormatListSummaries` já retorna `view` com `creditRefunded` por formato; a lista/dashboard passam esse `view` ao builder conjunto. Nenhuma consulta extra.
- Para campanhas não conjuntas, classificar o fluxo e usar `resolveCampaignFormat` + `status` já lidos.
- A UI de lista/dashboard usa apenas `formatPresentation` para os chips. Remove a lógica de `jointLabels`/`formatLabel`.
- A ação “Abrir” continua usando o `preferredFormat` atual para campanhas conjuntas; “Baixar” continua igual. Chips não recebem `href`.

**Orçamento de consultas:** a apresentação é pura. Não adicionar `from(...)`, `storage.createSignedUrl*`, RPC, recuperação ou qualquer leitura por card causada pelos chips. A prova deve comparar a mesma página **antes/depois** dos chips para o mesmo conjunto de campanhas, exigindo zero chamadas adicionais. A assinatura de miniaturas legadas já pode crescer com a quantidade de campanhas e NÃO SHALL ser tratada como baseline constante; a leitura conjunta em lote existente SHALL ser preservada.

### 6. Detalhe: chips no nível da página, seleção preservada

- `CampaignPageProps` ganha `formatPresentation` e, quando aplicável, `formatHrefs`.
- `CampaignPageClient` renderiza `<CampaignFormatChips>` logo abaixo do `PageHeader`, em **todos** os estados (novo fluxo e legado). O bloco duplicado dentro de `ReadyView`/`NewFlowDeliveredView` é removido.
- Campanha conjunta:
  - `active` = `joint.previewFormat` (formato efetivamente exibido). Sem `?format=` válido, o preferido entregue é o ativo; com parâmetro inválido/vazio/duplicado/não entregue, não há ativo.
  - `hrefs` somente para formatos `delivered`, preservando a seleção existente. Formato não entregue não recebe link de preview/download nem ação de geração.
  - `?format=` continua com o parser estrito atual; nenhum fallback novo.
- Campanha individual/legada:
  - `active` = formato persistido quando a arte está sendo exibida (entrega pronta).
  - Sem `hrefs`: o acesso atual é a imagem/download existentes; não se inventa seleção de um segundo formato.
  - Em `running`/`refunded`/`unknown`/`generating`/`stale`/`error`, os chips refletem o estado já derivado; `active` é `false` quando não há arte exibida.
  - Aprovação/regeneração: chips informativos com o estado de entrega persistido; nenhuma ação nova é adicionada e o gate existente continua decidindo preview/download.
- As notas de estado conjunto hoje duplicadas e hardcoded (`Formato solicitado inválido`, `Entrega parcial`, `Operação estornada`, etc.) passam a um único bloco no nível da página, usando o catálogo localizado. Nenhum texto de campanha/copy é alterado.

### 7. Localização compartilhada

Criar `src/lib/i18n/campaign-formats/` (client-safe) com:

- `messages.ts`: `CampaignFormatPresentationMessages` (nomes dos formatos, rótulos de estado, explicações, rótulo do grupo, ação de informação, “Selecionado”).
- `catalogs/pt-BR.ts` e `catalogs/es-419.ts`, congelados.
- `get-messages.ts` / `index.ts`.

Os namespaces `campaign-list`, `dashboard` e `campaign-detail` incluem um campo `formats` com a **mesma referência** ao catálogo compartilhado. Assim os três recebem exatamente os mesmos textos, sem duplicação. Testes de identidade e paridade de chaves garantem a consistência.

Textos de conteúdo persistido (nome do produto, copy) continuam com `lang=""`; a região traduzida declara `lang="es-419"` conforme o padrão existente.

**Alternativa rejeitada:** duplicar os textos em cada catálogo. Facilitaria o isolamento, mas reintroduziria a divergência que esta change elimina.

### 8. Estorno e indeterminação são dimensões distintas

`refunded` é um modificador de `absent`, não um estado substituto. Isso preserva duas informações: “o formato não está disponível” e “houve devolução conhecida”. `unknown`/`unavailable` nunca viram `absent` e nunca exibem “Não gerado”.

### 9. Refinamento visual compacto e ajuda flutuante (revisão 2026-11-21)

A apresentação funcional foi implementada e aceita tecnicamente, mas **não foi aprovada visualmente**: os chips ficaram grandes, com rótulos redundantes, badge “Selecionado” e explicações em fluxo que deslocavam arte/cards. Esta revisão é aditiva e não altera o modelo de estados, builders, classificação, lifecycle, autoridades, financeiro ou consultas.

Decisões:

- **Conteúdo visível mínimo:** chips exibem apenas “Quadrado 1:1” e “Vertical 9:16”. “Disponível”, “Não incluído”, “Não entregue” e o badge “Selecionado” saem do texto visível; permanecem no modelo, `aria-label`/descrição acessível e ajuda.
- **Sem ícones redundantes nos estados normais:** entregue/ausente usam tratamento visual discreto; `processing`/`unknown`/`refunded` podem usar um indicador pequeno, nunca frase longa.
- **Ativo:** borda/fundo distintos no detalhe, sem badge; seleção acessível por `aria-current`/nome.
- **Não depender só de cor:** forma (borda/fundo/indicador) + estado acessível completo.
- **Ajuda fora do fluxo:** popover flutuante em portal para `document.body`, `position: fixed`; sem aumentar altura do card, quebrar linha, deslocar arte ou criar overflow horizontal.
- **Posicionamento:** calcular a partir do âncora, preferir acima/abaixo conforme espaço, clampar na viewport e ignorar containers com `overflow` (portal).
- **Interações:** hover/foco desktop abrem; “?” de toque alterna; primeiro acionamento após hover/foco **fixa** a ajuda, segundo fecha; fora e `Escape` fecham; foco retorna ao botão no `Escape`; conteúdo não focável quando fechado.
- **Alvo:** aparência compacta, mas área acionável ≥44×44 px no “?” e no link de seleção (hit area/padding), sem nested button/link.
- **Sem dependência nova:** `react-dom/createPortal`, `useId`, `useState`/`useEffect` já existentes; `ExpandableHelp` é in-flow e não atende ao contrato flutuante, então não será reutilizado como está.
- **Espaçamento:** separação consistente entre bloco de chips e arte no detalhe; chips não empurram miniatura/ações na lista/dashboard.
- **Validação visual:** jsdom não comprova layout; registrar evidência visual desktop/mobile separadamente antes de aprovar a UX.

**Alternativa rejeitada:** tooltip nativo/`title`. Não cobre toque, foco consistente, viewport, overflow ou conteúdo acessível. **Alternativa rejeitada:** nova biblioteca de popover. Exigiria proposta/aprovação separada e não é necessária para o contrato local.

## Risks / Trade-offs

- **Campanhas antigas com `input_snapshot = null`** passam a mostrar ambos os chips como `unavailable` em vez de nenhum rótulo. → Mitigação: contrato explícito, testes de snapshot nulo/malformado e nenhum fallback para `1:1`.
- **“Não incluído” no outro formato de campanha individual** pode ser lido como incompatibilidade definitiva. → Mitigação: explicação “Este formato não foi incluído na criação da campanha”, sem prometer nem negar geração futura; a elegibilidade permanece fora da fatia.
- **Chips de lista/dashboard versus gate de aprovação no detalhe.** O chip representa entrega persistida; o gate continua nas ações. → Mitigação: documentar a semântica, não adicionar links/download onde o gate bloqueia e manter os testes de aprovação existentes.
- **Snapshot conjunto inconsistente** pode aparecer no dashboard porque a elegibilidade continua `status = ready`. → Mitigação: ambos `unavailable`/`unknown`, sem tratar como `1:1`; não alterar contagem/eligibility nesta fatia e cobrir com teste.
- **Leitura conjunta falha** retorna `unknown`; não cair no individual. → Mitigação: classificação conjunta antes do resolvedor e teste de falha de leitura.
- **Ajuda apenas em hover** exclui toque; ajuda em fluxo desloca layout. → Mitigação: popover flutuante em portal, “?” ≥44 px, hover/foco/toque, Escape/fora, sem deslocamento; validação visual separada.
- **Divergência de textos entre superfícies.** → Mitigação: catálogo compartilhado + teste de identidade/paridade.
- **Regressão de performance.** → Mitigação: builders puros e prova de zero chamadas adicionais causadas pelos chips, comparando a mesma página antes/depois; a assinatura de miniaturas legadas permanece como está.

## Migration Plan

1. Nenhuma migration, backfill ou alteração de dados.
2. Introduzir modelo, catálogo e componente sem alterar superfícies; validar testes unitários.
3. Migrar listagem e dashboard para `formatPresentation`, mantendo ações e miniaturas.
4. Migrar o detalhe para o componente no nível da página e remover o bloco duplicado.
5. Executar matriz de regressão, acessibilidade, localização, responsividade e contagem de consultas.
6. Rollback: reverter os commits de UI/modelo; nenhum dado persistido depende da nova apresentação.

## Open Questions

- Nenhuma bloqueante para a implementação. Os textos finais de `unknown`/`unavailable` em `es-419` devem ser revisados no catálogo durante as tarefas de localização, mantendo a distinção entre “não foi possível confirmar” e “indisponível”.
