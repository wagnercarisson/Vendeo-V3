# Phase 61 — Contexto de planejamento (ponte compacta)

**Status:** `61-01` e `61-02` aceitos localmente/offline; `61-03` executado, **NÃO ACEITO**; UX **NÃO aprovada visualmente**. Plano complementar `61-04` criado para o refinamento compacto e ajuda flutuante. Nenhum código desta revisão foi implementado; sem migration, banco, Storage, provider, homolog ou produção.

**Pendência visual:** os aceites técnicos de `61-01`/`61-02` e a execução técnica de `61-03` permanecem como histórico. A apresentação atual foi rejeitada visualmente (chips grandes, textos redundantes, ajuda deslocando arte/cards). O `61-04` trata apenas apresentação/interação local da ajuda, sem alterar builders, classificação, lifecycle, autoridades, financeiro ou consultas.

**Plano complementar:** `61-04-PLAN.md` (wave 4, `autonomous: false`, Review Stop).

**Fonte técnica (canônica):** `openspec/changes/padronizar-chips-formatos-campanhas/` — `proposal.md`, `design.md`, quatro delta specs e `tasks.md`. OpenSpec strict válido. GSD **não redesenha** decisões aprovadas; este arquivo apenas as traduz.

**Baseline:** `.planning/phases/61-padronizar-chips-formatos-campanhas/61-BASELINE.md` (branch `feat/campaign-format-chips`, HEAD `c971d631a190d426be21341f4616f6e4c7cb5135`).

**Fluxo:** OpenSpec → GSD (este passo) → revisão dos planos → execução → verificação. Parada obrigatória ao fim de cada plano (`autonomous: false` + `## Review Stop`).

---

## 1. Objetivo e resultado esperado

Padronizar a apresentação dos formatos **Quadrado 1:1** e **Vertical 9:16** em `/campanhas`, nas campanhas disponíveis do dashboard e em `/campanhas/[id]` — campanhas legadas, individuais atuais, verticais por expansão e conjuntas — entregando:

1. modelo de apresentação tipado, puro e sem I/O;
2. catálogo compartilhado `pt-BR`/`es-419`;
3. componente compartilhado de chips;
4. integração em lista/dashboard (chips informativos);
5. integração no detalhe (chips no nível da página, seleção conjunta e gates preservados);
6. testes de matriz, acessibilidade, localização, responsividade, regressão e **prova de zero chamadas adicionais**.

**Fora de escopo (não planejar, não implementar):** geração, expansão, entrega quadrada adicional, reserva, estorno, pricing, provider, flag, RPC, migration, backfill, alteração de copy/miniaturas/aprovação/recuperação/download/dados persistidos, navegação individual por chip em lista/dashboard, qualquer acesso a banco/Storage/homolog/produção, merge/push/deploy/sync/archive.

---

## 2. Rastreabilidade de requisitos

`ROADMAP.md` não possui entrada operacional da fase 61 (não foi editado nesta etapa). Os IDs abaixo derivam diretamente dos requirements dos delta specs e são usados no frontmatter `requirements` dos planos:

| ID | Origem | Resumo |
|---|---|---|
| FMT-PRES-01 | `campaign-format-presentation` — Apresentação padronizada | dois chips em todas as superfícies, mesma linguagem; ≤ 1 conjunto por campanha |
| FMT-MODEL-02 | `campaign-format-presentation` — Modelo tipado e seguro | dados seguros, estados, flow, estorno, ativo, `partial` |
| FMT-VIS-03 | `campaign-format-presentation` — Semântica visual | texto+forma, ativo distinto, ausente sem `+`, nunca “Não gerado” |
| FMT-A11Y-04 | `campaign-format-presentation` — Explicações acessíveis | hover/foco/toque, foco visível, 44×44, nunca botão desabilitado |
| FMT-INFO-05 | `campaign-format-presentation` + `campaign-list-ui`/`dashboard-*` | chips informativos em lista/dashboard, sem navegar/gerar |
| FMT-EFFECT-06 | `campaign-format-presentation` — Sem efeitos mutáveis | nenhuma escrita/RPC/recuperação/polling novo |
| FMT-DETAIL-07 | `campaign-page-ui` | seleção conjunta, ativo, `?format=` estrito, gates |
| FMT-AUTH-08 | `campaign-format-presentation` — Autoridade dos dados | conjunto antes do individual; sem inferência por path/miniatura |
| FMT-SCOPE-09 | `campaign-format-presentation` — Elegibilidade futura | não prometer/negar formato futuro |
| FMT-PERF-10 | `campaign-format-presentation` — Lote e sem N+1 | zero chamadas adicionais; leitura conjunta em lote |
| FMT-I18N-11 | `campaign-format-presentation` — Localização/responsividade | catálogo único `pt-BR`/`es-419`, layout sem overflow |
| LIST-UI-12 | `campaign-list-ui` | card único, dois chips, ações preservadas |
| DASH-UI-13 | `dashboard-operational-composition` | linha única, dois chips, contagem/miniatura/abertura |
| PAGE-UI-14 | `campaign-page-ui` | detalhe individual/legado, aprovação, regeneração, estados |

---

## 3. Decisões preservadas (não renegociar)

- **D-61-01** `partial` somente quando os **dois** formatos foram solicitados e apenas um foi entregue. Individual pronta **não** é parcial.
- **D-61-02** `status = error`/`stale` **não** comprova ausência; sem evidência explícita o formato é `unknown`, nunca “Não gerado” nem `absent/not_delivered`.
- **D-61-03** A lista/dashboard pode ter **menos evidência** que o detalhe. Padroniza-se vocabulário/semântica, não o conhecimento idêntico. Nenhuma consulta extra para igualar telas.
- **D-61-04** Estorno conhecido é **modificador de `absent`**, sempre visível (chip + explicação).
- **D-61-05** Chips **não** introduzem chamadas/efeitos novos. RPCs, recuperação legada, polling e leituras do detalhe permanecem intactos; só a explicação local abre/fecha.
- **D-61-06** Prova de desempenho: **mesma página, mesmo conjunto, antes/depois** → zero chamadas adicionais. Não exigir contagem absoluta constante entre 1 e N; a assinatura de miniaturas legadas permanece.
- **D-61-07** Fluxo conjunto (`classifyTwoFormatCampaign`) é classificado **antes** do resolvedor individual.
- **D-61-08** Snapshot objeto **sem** as duas chaves de formato segue o contrato histórico `1:1`. Snapshot nulo/malformado/contrato desconhecido/incoerente **nunca** ganha fallback novo para `1:1`.
- **D-61-09** Não inferir formato por `storage_path`, nome de arquivo, miniatura ou proporção.
- **D-61-10** Não alterar `resolveCampaignFormat`, `readTwoFormatDelivery`, `deriveTwoFormatDeliveryView`, `readTwoFormatListSummaries`, RPCs, schema ou dados.
- **D-61-11** Lista/dashboard: chips **sem** `href`. Detalhe: `href` somente para formato `delivered`.
- **D-61-12** Aprovação `pending` com candidata → formato persistido `delivered`, **sem ativo**, gate existente decide preview/download; `regenerating` → `processing`, sem ativo.

---

## 4. Contratos a implementar

### 4.1 `src/lib/campaign/format-presentation.ts` (puro, sem `server-only`, sem I/O)

```ts
export type CampaignFormatKey = "1:1" | "9:16";

export type CampaignFormatPresentationState =
  | "delivered" | "processing" | "absent" | "unknown" | "unavailable";

/** Estruturalmente idêntico a `TwoFormatDeliveryState`; sem import do módulo conjunto. */
export type CampaignFormatDeliveryState = CampaignFormatPresentationState;

export type CampaignFormatPresentationReason =
  | "not_requested" | "not_delivered" | null;

export interface CampaignFormatPresentationEntry {
  readonly state: CampaignFormatPresentationState;
  /** `true` SOMENTE em `absent`; nunca presume estorno. */
  readonly refunded: boolean;
  readonly reason: CampaignFormatPresentationReason;
  /** Destaque de seleção no detalhe; sempre `false` em lista/dashboard. */
  readonly active: boolean;
}

export interface CampaignFormatPresentation {
  readonly formats: Readonly<Record<CampaignFormatKey, CampaignFormatPresentationEntry>>;
  readonly flow: "single_format" | "two_format";
  readonly partial: boolean;
  readonly anyDelivered: boolean;
}

export type IndividualFormatLifecycle =
  | "delivered" | "processing" | "refunded" | "unknown";

export interface JointFormatPresentationInputEntry {
  readonly state: CampaignFormatDeliveryState;
  readonly refunded: boolean;
}

export function buildJointFormatPresentation(
  input: Readonly<Record<CampaignFormatKey, JointFormatPresentationInputEntry>>,
  activeFormat?: CampaignFormatKey | null,
): CampaignFormatPresentation;

export function buildIndividualFormatPresentation(
  input: {
    readonly resolution: CampaignFormatResolution; // import type de "./format-resolution"
    readonly lifecycle: IndividualFormatLifecycle;
  },
  activeFormat?: CampaignFormatKey | null,
): CampaignFormatPresentation;

export function buildUnknownFormatPresentation(): CampaignFormatPresentation;
export function buildUnavailableFormatPresentation(): CampaignFormatPresentation;

/** ready→delivered, generating→processing, error→unknown (nunca ausência). */
export function individualLifecycleFromStatus(
  status: "generating" | "ready" | "error",
): IndividualFormatLifecycle;
```

Regras dos builders:

- `buildJointFormatPresentation`: `flow="two_format"`; `delivered/processing/unknown/unavailable` copiados sem reinterpretar; `absent` recebe `reason="not_delivered"` e `refunded` do input (nunca inventado); `active` só no formato passado e apenas se `delivered`; `partial = flow === "two_format" && anyDelivered && !allDelivered`; `anyDelivered` derivado.
- `buildIndividualFormatPresentation`: se `resolution.kind === "unavailable"` → ambos `unavailable` (`flow="single_format"`, `partial=false`, `active=false`). Caso contrário o formato persistido recebe: `delivered`→`delivered`; `processing`→`processing`; `refunded`→`absent`+`refunded=true`; `unknown`→`unknown`. O outro formato é **sempre** `absent/not_requested`. `active` só no formato persistido e apenas em `delivered`. `partial` sempre `false`.
- `buildUnknownFormatPresentation()` → ambos `unknown`, `reason=null`, `refunded=false`, `flow="single_format"`, `partial=false`.
- `buildUnavailableFormatPresentation()` → ambos `unavailable`, idem.
- Nenhuma função lança; todas retornam objetos congelados ou somente-leitura.

### 4.2 `src/lib/i18n/campaign-formats/` (client-safe)

Arquivos: `messages.ts`, `catalogs/pt-BR.ts`, `catalogs/es-419.ts`, `get-messages.ts`, `index.ts`, `__tests__/catalogs.test.ts`, `__tests__/identity.test.ts`, `__tests__/isolation.test.ts`.

```ts
export interface CampaignFormatPresentationMessages {
  readonly groupLabel: string;
  readonly activeLabel: string;
  /** Nome acessível base; o componente concatena o nome do formato, sem placeholder. */
  readonly infoAria: string;
  readonly formats: Readonly<Record<CampaignFormatKey, { readonly name: string }>>;
  readonly labels: {
    readonly delivered: string;
    readonly processing: string;
    readonly notRequested: string;
    readonly notDelivered: string;
    readonly refunded: string;
    readonly unknown: string;
    readonly unavailable: string;
  };
  readonly explanations: {
    readonly delivered: string;
    readonly deliveredActive: string;
    readonly processing: string;
    readonly notRequested: string;
    readonly notDelivered: string;
    readonly refunded: string;
    readonly unknown: string;
    readonly unavailable: string;
  };
}
```

Textos canônicos (congelados; testes de paridade/identidade):

| Chave | pt-BR | es-419 |
|---|---|---|
| `groupLabel` | Formatos da campanha | Formatos de la campaña |
| `activeLabel` | Selecionado | Seleccionado |
| `infoAria` | Ver explicação do formato | Ver explicación del formato |
| `formats.1:1.name` | Quadrado 1:1 | Cuadrado 1:1 |
| `formats.9:16.name` | Vertical 9:16 | Vertical 9:16 |
| `labels.delivered` | Disponível | Disponible |
| `labels.processing` | Processando | Procesando |
| `labels.notRequested` | Não incluído | No incluido |
| `labels.notDelivered` | Não entregue | No entregado |
| `labels.refunded` | Crédito devolvido | Crédito devuelto |
| `labels.unknown` | Não foi possível confirmar | No fue posible confirmar |
| `labels.unavailable` | Indisponível | No disponible |
| `explanations.delivered` | Este formato está disponível nesta campanha. | Este formato está disponible en esta campaña. |
| `explanations.deliveredActive` | Este é o formato exibido agora. | Este es el formato que se muestra ahora. |
| `explanations.processing` | Este formato está sendo processado. | Este formato se está procesando. |
| `explanations.notRequested` | Este formato não foi incluído na criação da campanha. | Este formato no fue incluido en la creación de la campaña. |
| `explanations.notDelivered` | Este formato foi solicitado, mas não foi entregue. | Este formato se solicitó, pero no se entregó. |
| `explanations.refunded` | Este formato não está disponível e o crédito foi devolvido. | Este formato no está disponible y el crédito fue devuelto. |
| `explanations.unknown` | Não foi possível confirmar o estado deste formato. | No fue posible confirmar el estado de este formato. |
| `explanations.unavailable` | As informações deste formato não estão disponíveis. | La información de este formato no está disponible. |

- Explicações **não** prometem geração futura nem negam elegibilidade (D-61-09/FMT-SCOPE-09).
- Proibido: “Não gerado”, `+`, emojis.
- Os três namespaces recebem o campo `formats: CampaignFormatPresentationMessages` com **a mesma referência** ao catálogo compartilhado do locale, nos caminhos reais: `CampaignListMessages.formats`, `DashboardMessages["campaigns"].formats` e `CampaignDetailMessages.formats`. Teste `toBe` garante identidade entre `ptBRCampaignListMessages.formats`, `ptBRDashboardMessages.campaigns.formats` e `ptBRCampaignDetailMessages.formats` (idem es-419).
- `campaign-detail` recebe também `jointNotes` (bloco único localizado):

| Chave | pt-BR | es-419 |
|---|---|---|
| `invalidRequest` | Formato solicitado inválido. Escolha um dos formatos entregues. | Formato solicitado no válido. Elige uno de los formatos entregados. |
| `partialRefunded` | Entrega parcial: um formato foi estornado. | Entrega parcial: se reembolsó un formato. |
| `partialUnconfirmed` | Entrega parcial: o outro formato ainda não foi confirmado. | Entrega parcial: el otro formato aún no se confirmó. |
| `partialProcessing` | Entrega parcial: o outro formato está em processamento. | Entrega parcial: el otro formato se está procesando. |
| `finalizationPending` | Finalização pendente: um formato foi estornado e o outro ainda está em processamento. | Finalización pendiente: se reembolsó un formato y el otro aún se está procesando. |
| `refunded` | Operação estornada. | Operación reembolsada. |
| `processing` | Processando formatos... | Procesando formatos... |

Os campos legados `format.square`/`format.vertical` **permanecem** nos catálogos existentes (não são removidos nesta fase); a UI deixa de usá-los.

### 4.3 `src/components/campaign/campaign-format-chips.tsx` (`"use client"`)

```ts
export interface CampaignFormatChipsProps {
  presentation: CampaignFormatPresentation;
  messages: CampaignFormatPresentationMessages;
  hrefs?: Partial<Record<CampaignFormatKey, string>>;
  /** Idioma da região flutuante (ex.: "es-419"); o portal vive fora do wrapper. */
  helpLang?: string;
}
```

Contrato visual/estrutural obrigatório:

- Renderiza sempre `1:1` e `9:16`, nessa ordem, em `<ul aria-label={messages.groupLabel}>`; wrapper `flex min-w-0 flex-wrap items-center gap-2`; cada item `min-w-0`.
- Chip compacto: texto visível APENAS o nome do formato. Rótulos “Disponível”/“Não incluído”/“Não entregue”/“Selecionado” NÃO são visíveis; permanecem no `aria-label`/descrição acessível e na ajuda. Sem ícones nos estados normais; `processing`/`unknown`/`refunded` podem usar um indicador pequeno (`Loader2`/`CircleHelp`/`Undo2`) sem frase longa.
- `delivered`: destaque discreto (`text-text-primary`, `bg-accent-green/10`, `border-accent-green/30`), sem ícone/rótulo visível.
- `active`: borda/fundo distintos (`ring-1 ring-accent-green/40`, `bg-accent-green/15`), sem badge; `aria-current="true"` no link e estado “Selecionado” no nome acessível.
- `absent`: `text-text-secondary bg-bg-elevated border-border` (cinza legível), sem ícone/rótulo visível.
- `refunded`: `absent` + indicador pequeno `Undo2`; crédito devolvido na descrição/ajuda.
- `unknown`/`unavailable`: borda tracejada neutra + indicador pequeno de dúvida; estado completo na descrição/ajuda.
- Link `<a href>` (sem `next/link`/prefetch) somente quando `hrefs?.[key]` existe **e** `state === "delivered"`; demais são `span` (sem ação, sem geração).
- Controle “?”: `button type="button"` **irmão** do link/span (nunca aninhado), `aria-expanded`, `aria-controls` somente quando o popover estiver montado/aberto, `aria-describedby` para descrição `hidden` estável, `aria-label` com nome + estado, aparência compacta sem círculo/borda grande, hit area ≥44×44, `focus-visible:ring-2`; nunca `disabled`.
- Ajuda: popover flutuante em `createPortal` para `document.body`, `position: fixed`, fora do fluxo. Abre por hover/foco (desktop) e “?” (toque); primeiro acionamento após hover/foco fixa, segundo/clique-fora/`Escape` fecham; posição clampada na viewport, sem overflow horizontal, sem deslocar card/arte. Sem conteúdo focável quando fechada; foco retorna ao “?” no `Escape`.
- Explicação escolhida: `deliveredActive` se `active`; `refunded` se `refunded`; senão por estado/reason. Estado completo no `aria-label` do grupo e em descrição `hidden` referenciada por `aria-describedby`; a ajuda flutuante mostra o motivo.
- Sem emojis; tema dark; sem light mode; sem `dangerouslySetInnerHTML`; sem dependência nova (portal React existente).

---

## 5. Matriz de mapeamento por superfície (fonte: design §3)

| Origem / evidência | Formato persistido | Outro formato |
|---|---|---|
| Conjunta — `summary.view`/`readTwoFormatDelivery` | estados do read model + `creditRefunded` | estados do mesmo read model |
| Conjunta — `view === null` mas `summary.formats` presente | `summary.formats` (batch, `refunded=false`) | idem |
| Conjunta — leitura falhou (`unknown`) | `unknown` | `unknown` |
| Conjunta — operação ausente (`unavailable`) | `unavailable` | `unavailable` |
| Individual lista/dashboard `status=ready` + resolução válida | `delivered` | `absent/not_requested` |
| Individual lista/dashboard `status=generating` | `processing` | `absent/not_requested` |
| Individual lista/dashboard `status=error` | `unknown` | `absent/not_requested` |
| Detalhe new-flow `delivered` | `delivered` (ativo) | `absent/not_requested` |
| Detalhe new-flow `running` | `processing` | `absent/not_requested` |
| Detalhe new-flow `refunded` | `absent`+`refunded` | `absent/not_requested` |
| Detalhe new-flow `unknown` | `unknown` | `absent/not_requested` |
| Detalhe legado `ready` | `delivered` (ativo) | `absent/not_requested` |
| Detalhe legado `generating` | `processing` | `absent/not_requested` |
| Detalhe legado `stale`/`error` | `unknown` | `absent/not_requested` |
| Aprovação `pending` com candidata | `delivered`, **sem ativo** | `absent/not_requested` |
| Aprovação `regenerating` | `processing`, **sem ativo** | `absent/not_requested` |
| Resolução individual `unavailable` (inclui snapshot `null` legado) | `unavailable` | `unavailable` |
| Snapshot não-objeto/array (fluxo indeterminado) | `unknown` | `unknown` |
| Snapshot objeto com contrato malformado/desconhecido/incoerente | `unavailable` | `unavailable` |
| Snapshot conjunto `inconsistent` | `unavailable` | `unavailable` |
| Fluxo indeterminado / leitura conjunta falha | `unknown` | `unknown` |

Detalhe: `active` somente quando existe preview efetivamente exibido. Conjunta: `active = props.joint.previewFormat` **e** `props.joint.previewUrl !== null`; sem URL assinada, nenhum chip fica selecionado, mas os estados `delivered` permanecem. Individual/legada: `active` no formato persistido somente quando `props.imageUrl` (arte assinada) está presente; se a leitura/assinatura falhar, o formato continua `delivered` quando comprovado, porém sem “Selecionado”. `hrefs` somente para formatos `delivered`. `?format=` inválido/vazio/duplicado/não entregue continua falhando fechado (parser existente, sem fallback novo).

---

## 6. Orçamento e prova de consultas

- Baseline estático em `61-BASELINE.md`: 1 chamada em lote a `readTwoFormatListSummaries`; 1 `createSignedUrls` para miniaturas preferidas conjuntas; 1 `createSignedUrl` por campanha legada pronta com path assinável; **0** chamadas do módulo de apresentação/componente.
- Baseline do DETALHE em `61-BASELINE.md`: para fixtures fixas de campanha conjunta, novo fluxo individual e legado, registrar as contagens antes/depois de `resolveTwoFormatControlOperation`, `readTwoFormatDelivery`, `readTwoFormatDurableOutcomes`, `ProductOneToOneAttemptStartClient`, `generateSignedPreviewUrl`, `readCopyDelivery`, `readCopyCancellation`, `readCopyRecoverySummary`, sondas de arte (quando aplicável) e `createSignedUrl`; registrar também que polling/RPC/recuperação existentes não mudam. A prova exige **zero chamadas adicionais causadas pelos chips**, não uma contagem absoluta entre 1 e N.
- A prova exigida é comparativa (mesmo fixture antes/depois): contagens acima **idênticas** com e sem chips. Não exigir contagem absoluta constante entre 1 e N; não normalizar a assinatura de miniaturas legadas.
- Teste estático adicional: `format-presentation.ts` e `campaign-format-chips.tsx` não importam `@/lib/supabase/*`, `server-only`, `@/lib/product-two-format/read-model`, `fetch` nem storage.

---

## 7. Mapa de arquivos

**Novos**

- `src/lib/campaign/format-presentation.ts`
- `src/lib/i18n/campaign-formats/{messages,get-messages,index}.ts`
- `src/lib/i18n/campaign-formats/catalogs/{pt-BR,es-419}.ts`
- `src/lib/i18n/campaign-formats/__tests__/{catalogs,identity,isolation}.test.ts`
- `src/components/campaign/campaign-format-chips.tsx`
- `src/lib/campaign/__tests__/format-presentation.test.ts`
- `src/components/campaign/__tests__/campaign-format-chips.test.tsx`
- `src/lib/campaign/__tests__/format-presentation-wiring.test.ts` (lista/dashboard)
- `src/app/(app)/campanhas/[id]/__tests__/format-presentation.test.tsx` (detalhe)

**Alterados**

- `src/lib/i18n/campaign-list/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts,__tests__/catalogs.test.ts}`
- `src/lib/i18n/dashboard/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts,__tests__/catalogs.test.ts}`
- `src/lib/i18n/campaign-detail/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts,__tests__/catalogs.test.ts}`
- `src/lib/campaign/list.ts`, `src/lib/dashboard/campaigns.ts`
- `src/app/(app)/campanhas/client.tsx`, `src/components/dashboard/available-campaign-card.tsx`, `src/components/dashboard/dashboard-campaigns.tsx`
- `src/lib/campaign/display.ts`, `src/app/(app)/campanhas/[id]/page.tsx`, `src/app/(app)/campanhas/[id]/client.tsx`
- Testes existentes de listagem, dashboard, i18n e detalhe citados nos planos
- `.planning/phases/61-padronizar-chips-formatos-campanhas/61-BASELINE.md` (append do baseline técnico)

**Intocados:** `supabase/**`, `src/lib/product-two-format/**` (autoridades), `src/lib/campaign/format-resolution.ts`, RPCs, flags, pricing, provider, copy, miniaturas, `/campanhas/nova`.

---

## 8. Protocolo de revisão entre waves

- Cada plano termina com `## Review Stop`: resumo do diff, comandos executados, resultados reais, limites e riscos. Sem aprovação implícita.
- Wave 2 não inicia sem revisão da Wave 1; Wave 3 não inicia sem revisão da Wave 2.
- Nenhum plano executa migration, banco, Storage, provider, homolog, produção, merge, push, deploy, sync ou archive.
- Preservar alterações preexistentes; a baseline autorizada inclui `openspec/changes/padronizar-chips-formatos-campanhas/` e `.planning/phases/61-.../` untracked, além de `.planning/STATE.md`/`.planning/ROADMAP.md` modificados pelo planejamento.
