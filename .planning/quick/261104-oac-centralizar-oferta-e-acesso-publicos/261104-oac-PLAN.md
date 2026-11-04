---
quick_id: 261104-oac
slug: centralizar-oferta-e-acesso-publicos
status: complete
date: 2026-11-04
branch: perf/comunicacao-de-oferta-nas-paginas
base_commit: 3b5ed5d8
mode: implementation
implementation_authorized: true
visual_checkpoint: approved
accepted_on: 2026-11-04
openspec_change: centralizar-comunicacao-oferta-e-acesso
openspec_archive: openspec/changes/archive/2026-11-04-centralizar-comunicacao-oferta-e-acesso
commit: none (instrução explícita: sem commit automático)
---

# Quick 261104-oac — Fonte única de oferta e acesso nas páginas públicas

## Escopo

Centralizar os textos da oferta e do acesso em uma fonte local compartilhada e
reutilizá-los na home (card completo) e em `/floriculturas` (grupo de botões na
abertura e um único card compacto no encerramento), sem inventar regras nem
duplicar grupos de botões.

**Rodada de implementação aprovada em 2026-11-04**, com dois ajustes de escopo:
um único card em `/floriculturas` e abertura com prévia local em modo âncora.
Sem commit, merge, push, deploy, autenticação real, banco ou geração paga.

## Estado do repositório

| Item | Valor |
|---|---|
| Branch | `perf/comunicacao-de-oferta-nas-paginas` |
| Base | `3b5ed5d8` |
| Árvore | limpa (`git status --short` sem alterações) |
| Alterações preexistentes | nenhuma; nada a preservar além do histórico da branch |
| OpenSpec ativo | nenhum (somente `openspec/changes/archive/`) |

## 1. Diagnóstico — consumidores e textos atuais

### Consumidores do CTA de aquisição

| Arquivo | Uso | Texto fechado atual | Observação |
|---|---|---|---|
| `src/components/landing/acquisition-cta.tsx` | componente compartilhado | “Solicitar acesso free” | usado por hero, transformação, identidade, oferta e `/floriculturas` |
| `src/components/landing/hero-section.tsx` | CTA da home | herda | composição empilhada atual |
| `src/components/landing/transformation-section.tsx` | CTA da home | herda | composição empilhada atual |
| `src/components/landing/identity-control-section.tsx` | CTA da home | herda | composição empilhada atual |
| `src/components/landing/offer-section.tsx` | card completo da home | herda | único bloco com a oferta detalhada |
| `src/components/landing/floriculturas/access-cta-group.tsx` | abertura e encerramento de `/floriculturas` | herda | composição aprovada por estado da flag |
| `src/app/(marketing)/floriculturas/page.tsx` | grupo na abertura e card no encerramento | herda | `/#acesso` no card final; `#floriculturas-oferta` na abertura |
| `src/app/(auth)/signup/page.tsx` | “Beta fechado” | “Solicitar acesso free” | fora do fluxo de oferta; ver D2 |
| `src/app/(auth)/login/page.tsx` | link de quem não tem acesso | “Solicitar acesso free” | fora do fluxo de oferta; ver D2 |
| `src/components/landing/access-request-form.tsx` | botão de envio do formulário | “Solicitar acesso free” | ação de formulário, não CTA de card |
| `src/components/landing/access-request-section.tsx` | título do formulário | “Solicite seu acesso free” | texto diferente do botão |

### Consumidores dos textos da oferta

| Arquivo | Texto atual |
|---|---|
| `src/components/landing/offer-section.tsx` | `h2` “Teste gratuitamente, sem cartão de crédito”; resumo “Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos.”; expansível “Como funcionam os créditos do teste gratuito?”; condições (início, parcelas, acúmulo/vencimento, elegibilidade, beta fechado) |
| `src/components/landing/__tests__/offer-section.test.tsx` | congela as strings atuais e exige a nota de beta fechado **também** com a flag ligada |
| `openspec/specs/landing-conversion-experience/spec.md` | congela “Experimente o Vendeo em sua loja: …” e exige condições só no secundário |
| `openspec/specs/access-request-history/spec.md` | congela “Solicitar acesso free” |
| `openspec/specs/floriculturas-demonstration-page/spec.md` | congela a composição do conjunto de acesso (CTA + “Conheça o Vendeo”) e a copy aprovada |

### Oferta implementada (fonte da verdade funcional)

`src/lib/credit/trial-offer/constants.ts` e os Termos v1.5 confirmam: 5 créditos
nos dias 0/7/14/21, máximo 20, janela de 28 dias, início na conclusão do
onboarding, acúmulo e vencimento comum. O texto do card está **consistente** com
a política; a mudança é de forma/comunicação, não de regra.

## 2. Divergências e decisões pendentes

### D1 — Repetição de “sem cartão de crédito” no card completo

O `h2` atual já diz “sem cartão de crédito”, e o complemento aprovado repete a
frase. Opções:

- **A (aprovada em 2026-11-04):** manter o `h2` apenas como “Teste gratuitamente.”
  e exibir o complemento aprovado integral. A supressão textual do `h2` fica
  coberta por esta change.
- **B:** manter o `h2` intacto e exibir o complemento integral (repetição literal).
- **C:** manter o `h2` e exibir só “Oferta para novas contas elegíveis.” (não
  reproduz o complemento aprovado na íntegra).

**Decisão necessária antes da implementação.** O plano e a spec usam o
complemento integral; a opção escolhida só altera o `h2`.

### D2 — Alcance da troca “Solicitar acesso free” → “Solicitar acesso gratuito”

- **Incluído (aprovado em 2026-11-04):** `AcquisitionCta`, portanto home e
  `/floriculturas`. É o consumidor da fonte de acesso e o botão do card.
- **Fora:** `/signup` (Beta fechado), `/login`, `AccessRequestForm` e o título
  `AccessRequestSection`. Não são o card de oferta e ampliariam a alteração para
  telas de autenticação/formulário.

Se o responsável quiser consistência global em uma rodada futura, os quatro
últimos passam a consumir a mesma fonte; isso aumenta o diff e os testes, mas
não muda comportamento.

### D3 — Nota de cadastro fechado nos detalhes

A nota “solicitar acesso não inicia o período do teste” passa a aparecer
**somente com a flag desligada**. Hoje ela aparece nos dois estados. Ajuste
expressamente aprovado, com impacto no teste atual de flag ligada.

### D4 — Google compartilhado

`src/components/auth/google-button.tsx` centraliza o rótulo e o OAuth. Proposta:
adicionar `label?: string` com default `"Continuar com Google"` e passar o texto
da fonte pública apenas pelo `AcquisitionCta`. `/login` e `/signup` continuam sem
passar a prop, preservando rótulo, OAuth e testes. Nenhuma mudança de handler,
escopo, redirect ou captcha.

### D5 — Um único card e abertura em modo âncora (revisão de 2026-11-04)

Dois cards deixaram `/floriculturas` repetitiva. A abertura passa a exibir somente
o grupo visual de botões, sem resumo, complemento ou expansível. Todos os botões
de aquisição da abertura viram links locais para `#floriculturas-oferta`; o
`GoogleButton` funcional não é renderizado ali. O encerramento mantém o único
card, com as ações reais e `id="floriculturas-oferta"`, `tabindex="-1"` e
`scroll-mt-24`. A home não muda.

## 3. Proposta de fonte compartilhada

### Novo módulo (local, sem serviço/painel/banco)

`src/components/landing/public-offer-copy.ts`

```ts
export const PUBLIC_OFFER_COPY = {
  summary: "28 dias gratuitos e até 20 créditos.",
  complement: "Sem cartão de crédito. Oferta para novas contas elegíveis.",
  detailsLabel: "Como funciona o teste gratuito?",
  conditions: {
    start:
      "O período de 28 dias começa após concluir o cadastro e a configuração inicial da sua loja.",
    installments:
      "Você recebe 5 créditos iniciais. Mais 5 são liberados a partir dos dias 7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período.",
    accumulation:
      "Os créditos acumulam, inclusive as parcelas liberadas durante sua ausência, e os créditos gratuitos restantes vencem ao final do período.",
  },
  closedDetailsNote: "Solicitar acesso não inicia o período do teste.",
} as const;

export const PUBLIC_ACCESS_COPY = {
  google: "Continuar com Google",
  email: "Continuar com email",
  closedCta: "Solicitar acesso gratuito",
  closedSupport: "Solicite seu convite para experimentar o Vendeo.",
  institutional: "Conheça o Vendeo",
} as const;
```

- Sem leitura de env, flag, rede ou data. Texto muda por alteração de código e
  deploy, como aprovado.
- `Oferta para novas contas elegíveis.` deixa de ser repetida nos detalhes porque
  já está no complemento.
- A regra de negócio continua em `trial-offer`; o módulo é só comunicação.

### Componentes

| Arquivo | Papel |
|---|---|
| `src/components/landing/offer-card.tsx` (novo) | apresentação compartilhada; `variant: "full" \| "compact"`, `publicSignupEnabled`, `headingId?`, `id?`, `children` para o conjunto de acesso; renderiza resumo, complemento, slot, apoio fechado e `<details>` |
| `src/components/landing/offer-section.tsx` | passa a compor `OfferCard variant="full"` com `AcquisitionCta align="center"`, mantendo `section`, `h2` e `id="oferta-heading"` |
| `src/components/landing/floriculturas/access-cta-group.tsx` | lê rótulos da fonte; aceita `anchorHref` para a prévia local; composição por estado preservada |
| `src/components/landing/acquisition-cta.tsx` | lê rótulos da fonte; aceita `localHref` (links locais, sem OAuth); composições `stacked`/`inline` preservadas |
| `src/components/landing/google-g-glyph.tsx` (novo) | glifo decorativo do Google para o link local da abertura, sem tocar no componente de autenticação |
| `src/components/auth/google-button.tsx` | nova prop opcional `label` (default atual), sem mudança de handler |
| `src/app/(marketing)/floriculturas/page.tsx` | abertura com `AccessCtaGroup anchorHref="#floriculturas-oferta"`; encerramento com o único `OfferCard variant="compact"` e o grupo real |

`OfferCard` usa `id`/`tabIndex={-1}`/`scroll-mt-24` para o destino de âncora. O
`<details>` nativo não precisa de ID. Existe apenas um card em `/floriculturas`,
então não há colisão de IDs nem expansíveis duplicados.

## 4. Composição para revisão

### Home — card completo, flag desligada (D1 opção A)

```
┌──────────────────────────────────────────────────────┐
│ Teste gratuitamente.                                 │
│ 28 dias gratuitos e até 20 créditos.                 │
│ Sem cartão de crédito. Oferta para novas contas      │
│ elegíveis.                                           │
│                                                      │
│            [ Solicitar acesso gratuito ]             │
│      Solicite seu convite para experimentar o        │
│      Vendeo.                                         │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▸ Como funciona o teste gratuito?                │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Home — card completo, flag ligada

```
┌──────────────────────────────────────────────────────┐
│ Teste gratuitamente.                                 │
│ 28 dias gratuitos e até 20 créditos.                 │
│ Sem cartão de crédito. Oferta para novas contas      │
│ elegíveis.                                           │
│                                                      │
│        [ Continuar com Google ]  (max-w-sm)          │
│        [ Continuar com email  ]  (max-w-sm)          │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ▸ Como funciona o teste gratuito?                │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Detalhes (iguais nos dois estados, exceto a última linha):

```
O período de 28 dias começa após concluir o cadastro e a configuração
inicial da sua loja.

Você recebe 5 créditos iniciais. Mais 5 são liberados a partir dos dias
7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período.

Os créditos acumulam, inclusive as parcelas liberadas durante sua ausência,
e os créditos gratuitos restantes vencem ao final do período.

[Somente flag desligada]
Solicitar acesso não inicia o período do teste.
```

### `/floriculturas` — abertura, desktop, flag desligada

```
[ Solicitar acesso gratuito ]  [ Conheça o Vendeo ]
```

- Sem card, resumo, complemento ou expansível.
- “Solicitar acesso gratuito” é link local para `#floriculturas-oferta`.
- “Conheça o Vendeo” continua em `/`, mesma aba, sem âncora.

### `/floriculturas` — abertura, desktop, flag ligada

```
[ Continuar com Google ]    [ Continuar com email ]
              [ Conheça o Vendeo ]
```

- Google e e-mail são links locais para `#floriculturas-oferta`; nenhum inicia
  OAuth nem abre `/signup`.
- Aparência equivalente ao botão real, com o glifo local do Google.
- “Conheça o Vendeo” continua em `/`.

### `/floriculturas` — card único no encerramento, desktop

Fechado:

```
┌──────────────────────────────────────────────────────────┐
│ 28 dias gratuitos e até 20 créditos.                     │
│ Sem cartão de crédito. Oferta para novas contas elegíveis.│
│                                                          │
│ [ Solicitar acesso gratuito ]  [ Conheça o Vendeo ]      │
│ Solicite seu convite para experimentar o Vendeo.         │
│                                                          │
│ ▸ Como funciona o teste gratuito?                        │
└──────────────────────────────────────────────────────────┘
   ↑ id="floriculturas-oferta", tabindex="-1", scroll-mt-24
```

Aberto:

```
┌──────────────────────────────────────────────────────────┐
│ 28 dias gratuitos e até 20 créditos.                     │
│ Sem cartão de crédito. Oferta para novas contas elegíveis.│
│                                                          │
│ [ Continuar com Google ]    [ Continuar com email ]      │
│              [ Conheça o Vendeo ]                        │
│                                                          │
│ ▸ Como funciona o teste gratuito?                        │
└──────────────────────────────────────────────────────────┘
```

- O card do encerramento usa as ações reais: Google/OAuth, e-mail `/signup` ou
  solicitação `/#acesso`, conforme a flag.
- O conteúdo interno é centralizado (`align="center"`).

### Mobile (390 px)

```
Abertura (sem card)                Encerramento (card único)
┌──────────────────────────┐      ┌──────────────────────────┐
│ [Solicitar acesso grat.] │      │ 28 dias gratuitos e até  │
│ [Conheça o Vendeo]       │      │ 20 créditos.             │
└──────────────────────────┘      │ Sem cartão de crédito.   │
                                  │ Oferta para novas contas │
Estado aberto:                    │ elegíveis.               │
┌──────────────────────────┐      │                          │
│ [Continuar com Google]   │      │ [Solicitar acesso grat.] │
│ [Continuar com email]    │      │ [Conheça o Vendeo]       │
│ [Conheça o Vendeo]       │      │ Solicite seu convite...  │
└──────────────────────────┘      │ ▸ Como funciona...       │
                                  └──────────────────────────┘
```

Todos os controles têm 100% da largura no mobile, sem overflow horizontal.

## 5. Plano de execução (somente após aprovação)

1. Criar `public-offer-copy.ts` e teste de valores exatos.
2. Adicionar `label` opcional ao `GoogleButton` (default preservado).
3. Refatorar `AcquisitionCta`/`AccessCtaGroup` para consumir a fonte e aceitar
   `localHref`/`anchorHref`, mantendo destinos, handlers, classes e composições.
4. Criar `OfferCard` (full/compact) com detalhes nativos, slot de acesso, ID de
   âncora e apoio fechado condicional.
5. Refatorar `OfferSection` para o card completo.
6. Manter a abertura de `/floriculturas` em modo âncora e envolver somente o
   conjunto do encerramento no card único.
7. Atualizar testes existentes e adicionar os novos (seção 6).
8. Rodar gates e capturas desktop/mobile nos dois estados da flag.
9. Parar para aceite visual; sem commit automático.

## 6. Testes e gates

### Consistência de textos

- `public-offer-copy` exporta exatamente os textos aprovados.
- Home e `/floriculturas` renderizam resumo, complemento, expansível, apoio e CTA
  a partir das constantes (sem literais duplicados nos componentes).
- Guarda estática: nenhum dos arquivos públicos alterados contém
  “Solicitar acesso free”, “Como funcionam os créditos do teste gratuito?”,
  “Experimente o Vendeo em sua loja” ou “No beta fechado, solicitar acesso…”.
- Nenhuma promessa de “20 campanhas”, “ilimitado” ou “raiz de CNPJ”.

### Flags ligada/desligada

- Fechada: CTA “Solicitar acesso gratuito”, apoio “Solicite seu convite…”,
  nota de que solicitar não inicia o período, sem Google/e-mail.
- Aberta: Google + e-mail preservados, sem CTA fechado, sem apoio e **sem** nota
  de beta fechado.
- A flag continua vindo de `getLaunchConfig()` uma vez por página.

### Preservação dos consumidores e links

- Hero, transformação, identidade e oferta continuam com a mesma composição
  `stacked` da home; só o rótulo muda.
- `#acesso` na home; `/#acesso` somente no card final de `/floriculturas`;
  `#floriculturas-oferta` somente na abertura; `/signup` somente no card final;
  `/` em “Conheça o Vendeo”; `/login` no header.
- `POST /api/access-requests`, OAuth, onboarding, créditos, billing e flags
  intocados.

### Expansíveis, IDs e âncora

- Existe um único `<details>` em `/floriculturas`; ele abre/fecha pelo teclado.
- O card tem `id="floriculturas-oferta"`, `tabindex="-1"` e `scroll-mt-24`.
- Nenhum ID duplicado no HTML.
- A abertura não renderiza `GoogleButton` funcional no estado aberto.
- `summary` com alvo de 44 px, foco visível e rótulo acessível.
- Nota de cadastro fechado presente apenas com a flag desligada.

### Gates

| Gate | Comando | Limitação declarada |
|---|---|---|
| Testes focados | `npx vitest run` nos arquivos afetados | jsdom não mede layout real |
| Typecheck | `npm run typecheck` | — |
| Lint | `npm run lint` | ESLint atual não cobre TypeScript (limitação já registrada) |
| Build | `npm run build` | requer `check:cnae` |
| Diff | `git diff --check` | — |
| Visual | build local + CDP 1440×900 e 390×844, flags off/on | medir `scrollWidth` e overflow |

### Aceite visual

- Home desktop/mobile, flag off/on: card completo, sem regressão de composição.
- `/floriculturas` desktop/mobile, flag off/on: abertura somente com o grupo de
  botões em modo âncora e um único card compacto no encerramento, sem grupo
  duplicado e sem overflow.
- Capturas e medições em `evidence/`; aprovação explícita antes de fechar.

## 7. Fora de escopo

- Serviço externo, CMS, painel, banco ou atualização dinâmica da oferta.
- Resolvedor concorrente de oferta ou elegibilidade individual do visitante.
- Alterar regras de crédito, onboarding, billing, OAuth, elegibilidade ou flags.
- Alterar metadata, sitemap, imagens, fontes, header/rodapé.
- Refatorar login/cadastro/formulário além do decidido em D2.
- Infraestrutura genérica para futuras campanhas comerciais.
- Banner flutuante.
- Implementar antes da revisão deste plano e da composição.

## 8. Ponto de parada

Implementação concluída e **aceite visual aprovado em 2026-11-04**. Escopo aceito:

1. Home desktop/mobile, flag off/on, com o card completo.
2. `/floriculturas` desktop/mobile, flag off/on, com o grupo de botões na abertura
   (modo âncora) e um único card no encerramento.
3. D1 e D2 aprovadas (opção 1 em ambas).

Sem commit, merge, push ou deploy. Fechamento da quick e sync/archive do OpenSpec
executados após o aceite.
