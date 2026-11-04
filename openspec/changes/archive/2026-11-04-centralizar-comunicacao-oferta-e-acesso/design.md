## Context

A home concentra o card completo em `src/components/landing/offer-section.tsx`,
enquanto `/floriculturas` reutiliza apenas o conjunto de acesso em
`src/components/landing/floriculturas/access-cta-group.tsx`. O rótulo fechado
nasce em `src/components/landing/acquisition-cta.tsx`, e o Google em
`src/components/auth/google-button.tsx`. Não existe hoje uma fonte única: o
resumo, as condições, o rótulo do expansível e o CTA estão literais em arquivos
diferentes.

A política funcional está em `src/lib/credit/trial-offer/` e nos Termos v1.5:
5 créditos nos dias 0/7/14/21, máximo 20, 28 dias, início na conclusão do
onboarding, acúmulo e vencimento comum. O texto atual é consistente com a
política; esta change altera comunicação e composição, não regra.

**Conflito de spec identificado:** `landing-conversion-experience` congela
“Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos.” e
`access-request-history` congela “Solicitar acesso free”. A comunicação aprovada
em 2026-11-04 substitui esses textos; as duas specs são atualizadas nesta change,
sem alterar nenhuma regra de negócio.

## Goals / Non-Goals

**Goals:**

- Uma fonte local única para os textos da oferta e do acesso.
- Home com o card completo preservado, exceto as mudanças textuais aprovadas.
- `/floriculturas` com grupo visual de botões na abertura (modo âncora) e um único
  card compacto no encerramento, com ações reais.
- Reutilização da linguagem visual do card atual.
- Expansíveis acessíveis e independentes, sem IDs duplicados.
- Preservar destinos, handlers, OAuth, formulário, flag e contrato da API.

**Non-Goals:**

- Serviço externo, painel, CMS, banco ou atualização dinâmica.
- Resolvedor concorrente de oferta ou elegibilidade individual do visitante.
- Alterar regras de crédito, onboarding, billing, autenticação ou flags.
- Alterar metadata, sitemap, imagens, fontes, header/rodapé.
- Refatorar login, cadastro, formulário de solicitação ou telas autenticadas.
- Criar infraestrutura genérica para futuras campanhas comerciais.
- Banner flutuante.

## Decisions

### D1 — Fonte local em módulo puro

`src/components/landing/public-offer-copy.ts` exporta `PUBLIC_OFFER_COPY` e
`PUBLIC_ACCESS_COPY` como constantes `as const`. Não lê env, flag, rede, data ou
banco. Atualizar a oferta exige alteração de código e deploy — exatamente o
escopo aprovado. Alternativa descartada: JSON em `public/` (serviria conteúdo
estático sem tipagem e sugeriria atualização sem deploy) e CMS (fora do escopo).

### D2 — Card compartilhado com variantes de apresentação

`offer-card.tsx` recebe `variant: "full" | "compact"`, `publicSignupEnabled`,
`headingId?`, `id?` e `children` (o conjunto de acesso). A variante muda apenas
espaçamento e tipografia; a ordem e os textos são os mesmos. A home injeta
`AcquisitionCta align="center"` na composição empilhada atual; o encerramento de
`/floriculturas` injeta o `AccessCtaGroup` real. Assim não há dois textos nem dois
grupos de botões.

Após revisão de 2026-11-04, `/floriculturas` tem **um único card**, no
encerramento. A abertura usa apenas o grupo visual de botões, sem card.

### D3 — Detalhes nativos, ID de âncora e sem IDs duplicados

O expansível usa `<details>/<summary>` nativo, com um único `headingId` opcional
no card completo (`oferta-heading`). O card compacto recebe `id="floriculturas-oferta"`,
`tabIndex={-1}`, `scroll-mt-24` e foco visível; esse é o destino estável das
âncoras da abertura. Não há segundo card, então não há colisão de IDs. Abrir o
expansível não afeta nenhum outro elemento. Alternativa descartada: `useId` em
componente de servidor e acordeão controlado.

### D3.1 — Prévia local na abertura

`AcquisitionCta` ganha `localHref?: string`. Quando presente, cada ação de
aquisição vira um link local para o card final: sem `GoogleButton`, sem OAuth,
sem `/signup` e sem sair da página. O `GoogleGGlyph` local preserva a aparência
do botão Google sem alterar o componente compartilhado de autenticação. No
encerramento, `localHref` não é passado e as ações reais permanecem.

### D4 — Nota de cadastro fechado condicional

A nota “Solicitar acesso não inicia o período do teste.” aparece apenas quando
`publicSignupEnabled === false`. A variante aberta não exibe a nota nem o apoio
fechado. Isso corrige a contradição atual de mostrar “no beta fechado” com o
cadastro aberto.

### D5 — Google sem ampliar autenticação

`GoogleButton` ganha `label?: string` com default `"Continuar com Google"`.
Somente `AcquisitionCta` passa `PUBLIC_ACCESS_COPY.google`. Login e cadastro não
passam a prop e permanecem idênticos. Nenhuma mudança em OAuth, escopos, redirect,
captcha, loading ou erro. Alternativa descartada: mover o rótulo para fora do
componente de auth (quebraria o encapsulamento) e duplicar o literal no landing.

### D6 — Rótulo do CTA

`AcquisitionCta` passa a renderizar “Solicitar acesso gratuito” vindo da fonte.
Inclui home e `/floriculturas`. `/signup`, `/login`, `AccessRequestForm` e o
título do formulário permanecem como estão nesta rodada. **Aprovado em
2026-11-04:** troca restrita a home/`/floriculturas`.

### D7 — `h2` da home

**Aprovado em 2026-11-04:** o `h2` passa a ser “Teste gratuitamente.” e o
complemento aprovado “Sem cartão de crédito. Oferta para novas contas elegíveis.”
aparece integral logo abaixo, sem repetição.

## Risks / Trade-offs

- [Textos duplicados voltarem] → teste estático proíbe os literais antigos nos
  arquivos consumidores e exige as constantes.
- [Regressão na home] → variante `full` preserva classes, ordem e composição;
  testes de hero/transformação/identidade/oferta continuam cobrindo a flag.
- [IDs duplicados em `/floriculturas`] → um único card com ID estável; teste conta
  IDs, verifica o destino focável e a independência do expansível.
- [Overflow com “Solicitar acesso gratuito”] → largura total no mobile, quebra
  segura e medição em 390 px no aceite visual.
- [Ampliar autenticação] → `GoogleButton` só ganha prop opcional; testes de
  login/cadastro permanecem sem alteração de expectativa.
- [Divergência com a política] → nenhuma; a change atualiza apenas comunicação.

## Migration Plan

1. Criar a fonte e seus testes.
2. Adicionar `label` ao Google e ajustar os CTAs.
3. Criar o card e migrar a home.
4. Manter a abertura de `/floriculturas` em modo âncora e envolver somente o
   conjunto do encerramento no card compacto único.
5. Atualizar testes e gates.
6. Aceite visual desktop/mobile nas duas flags.

Rollback: reverter os arquivos de UI; nenhum dado, migration, flag ou contrato é
alterado.

## Open Questions

Nenhuma. D6 e D7 foram aprovadas em 2026-11-04 (opção 1 em ambas).
