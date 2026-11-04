---
quick_id: 261104-oac
slug: centralizar-oferta-e-acesso-publicos
status: complete
date: 2026-11-04
branch: perf/comunicacao-de-oferta-nas-paginas
base_commit: 3b5ed5d8
openspec_change: centralizar-comunicacao-oferta-e-acesso
openspec_archive: openspec/changes/archive/2026-11-04-centralizar-comunicacao-oferta-e-acesso
visual_checkpoint: approved
accepted_on: 2026-11-04
commit: none
---

# Summary — 261104-oac

Implementação concluída e **aceite visual aprovado em 2026-11-04**. Sem commit,
merge, push ou deploy.

## Decisões aprovadas

- **D7 (opção 1):** `h2` da home passa a “Teste gratuitamente.” e o complemento
  aprovado aparece integral, sem repetição.
- **D6 (opção 1):** “Solicitar acesso gratuito” vale para home e `/floriculturas`
  via `AcquisitionCta`. `/signup`, `/login` e o formulário permanecem inalterados.
- **Revisão de 2026-11-04:** `/floriculturas` tem **um único card**, no
  encerramento. A abertura exibe só o grupo visual de botões em modo âncora.

## Resultado

- **Fonte única:** `src/components/landing/public-offer-copy.ts` concentra
  resumo, complemento, título, expansível, condições, apoio e rótulos do acesso.
- **Card compartilhado:** `src/components/landing/offer-card.tsx` tem as variantes
  `full` (home) e `compact` (único card de `/floriculturas`), com `id?`,
  `headingId?` e o conjunto de acesso por slot.
- **Home:** inalterada nesta revisão; card completo, CTA empilhado/centralizado,
  apoio centralizado e nota de período somente com a flag desligada.
- **Abertura de `/floriculturas`:** somente o `AccessCtaGroup`, com
  `anchorHref="#floriculturas-oferta"`. Todos os controles de aquisição são links
  locais; nenhum inicia OAuth ou abre `/signup`. No estado aberto, o
  `GoogleButton` funcional não é renderizado: um link local com o glifo do Google
  preserva a aparência. “Conheça o Vendeo” continua em `/`.
- **Encerramento de `/floriculturas`:** um único card compacto, com
  `id="floriculturas-oferta"`, `tabindex="-1"` e `scroll-mt-24`. Ações reais:
  Google/OAuth e `/signup` com a flag ligada; `/#acesso` com a flag desligada.
- **Âncora:** verificado por teclado (Tab + Enter); o card recebe foco e o topo
  fica visível (123–131 px) nos dois estados.
- **GoogleButton:** prop opcional `label`, default “Continuar com Google”;
  login, cadastro, OAuth, escopos, redirect e captcha inalterados.
- **Expansível:** um `<details>` nativo, acionável pelo teclado.
- **Links preservados na home:** `#acesso`, `/signup`, `/`, `/login`.

## Gates

| Gate | Resultado |
|---|---|
| Suíte focada (landing + floriculturas + auth) | **17 arquivos / 143 testes** |
| Typecheck | 0 erros |
| Lint | 0 (limitação: ESLint atual não cobre TypeScript) |
| Build (`npm run build`) | exit 0 |
| OpenSpec validate | válido |
| `git diff --check` | limpo (apenas avisos de LF→CRLF do Git) |

### Evidências de layout (CDP)

| Estado / página / viewport | Overflow | Cards | IDs únicos |
|---|---|---|---|
| fechado / home / 1440 | 0 px | 1 | 13/13 |
| fechado / home / 390 | 0 px | 1 | 13/13 |
| fechado / floriculturas / 1440 | 0 px | 1 | 7/7 |
| fechado / floriculturas / 390 | 0 px | 1 | 7/7 |
| aberto / home / 1440 | 0 px | 1 | 8/8 |
| aberto / home / 390 | 0 px | 1 | 8/8 |
| aberto / floriculturas / 1440 | 0 px | 1 | 7/7 |
| aberto / floriculturas / 390 | 0 px | 1 | 7/7 |

Capturas full-page em `evidence/` (1440×900 e 390×844). O capturador percorre a
página antes da captura para disparar o lazy-loading das imagens; o código de
carregamento não foi alterado. O estado aberto foi capturado em servidor de
desenvolvimento com `VENDEO_PUBLIC_SIGNUP_ENABLED=true` apenas no processo,
porque as páginas são estáticas no build de produção. Nenhuma variável
persistente foi alterada.

## Testes adicionados/atualizados

- `public-offer-copy.test.ts`: valores exatos e guarda contra literais antigos.
- `offer-card.test.tsx`: card único, ID de âncora focável, expansível e nota
  condicional.
- `offer-section.test.tsx`: nova copy, apoio e ausência da nota no estado aberto.
- `floriculturas-page.test.ts`: um card, abertura local, ações reais somente no
  encerramento, destinos, IDs e flags.
- `acquisition-cta.test.tsx`: `localHref` no estado aberto e fechado; nenhum
  `GoogleButton` funcional na prévia.
- `access-cta-group.test.tsx`: modo âncora por estado da flag.
- `access-request-section` e `landing-page`: novo rótulo e composição preservada.

## Limitações

- jsdom não mede layout real; overflow, geometria e foco de âncora foram medidos
  por CDP.
- ESLint atual não cobre TypeScript.
- O lint do Next no build avisa que o plugin ESLint não está detectado
  (limitação preexistente).
- Sem autenticação real: o GoogleButton foi mockado nos testes de landing.

## Próximo passo

Aceite registrado e OpenSpec verificado/sincronizado/arquivado em
`openspec/changes/archive/2026-11-04-centralizar-comunicacao-oferta-e-acesso/`.
Entrega pronta para commit pelo responsável; nenhum commit, merge, push ou deploy
foi executado.
