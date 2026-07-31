# Guia de Atualizacao do Changelog

Este guia orienta a revisao de changelog ao final de fases OpenSpec, milestones e implementacoes quick. Ele deve ser lido durante a verificacao final quando houver duvida sobre registrar ou nao uma novidade para o lojista.

O changelog do Vendeo nao e release note tecnica. Ele e comunicacao de produto: deve explicar, em portugues claro, o que mudou para o lojista, por que isso importa e se ha alguma acao esperada.

## Quando Usar

Use este guia ao final de:

- fase OpenSpec concluida;
- milestone concluida;
- quick implementation com impacto visivel no produto;
- correcao que muda uma experiencia perceptivel do usuario;
- alteracao de copy, fluxo, tela, dashboard, campanha, conta, loja, onboarding, creditos, legal ou monetizacao.

Nao use este guia para atualizar changelog a cada commit. Commits sao granulares demais; changelog deve acompanhar entregas que fazem sentido para o usuario.

## Decisao Obrigatoria no Verify

Durante o verify final, responda:

```txt
Esta implementacao mudou algo que o lojista consegue perceber, usar, entender ou precisar fazer?
```

Se a resposta for **sim**, crie ou atualize uma entry em `content/changelog/*.md`.

Se a resposta for **nao**, registre no resultado da verificacao:

```txt
Changelog: nao necessario, pois a fase nao trouxe mudanca perceptivel ao lojista.
```

## Deve Entrar no Changelog

Registre quando houver:

- nova tela, secao, card, banner, modal ou item de navegacao;
- novo fluxo ou mudanca em fluxo existente;
- mudanca de comportamento que pode surpreender o usuario;
- recurso novo de campanha, loja, conta, creditos, legal, admin ou monetizacao;
- melhoria visivel em layout, legibilidade, velocidade percebida, estado vazio, erro ou feedback;
- mudanca de copy que altera entendimento, promessa, instrucao ou acao esperada;
- correcao de bug que o usuario poderia perceber;
- nova exigencia, bloqueio, validacao ou passo obrigatorio;
- mudanca legal, comercial, de creditos, plano, cobranca ou cadastro.

## Nao Deve Entrar no Changelog

Nao registre quando a fase for apenas:

- refatoracao interna;
- ajuste de teste;
- melhoria de tipos;
- organizacao de arquivos;
- mudanca de infra ou build sem efeito visivel;
- correcao de bug que nao afetava experiencia real;
- documentacao interna;
- limpeza de codigo;
- ajuste em admin sem impacto para lojistas, salvo se a fase tambem mudar suporte, operacao ou visibilidade para o usuario final.

## Padrao Editorial

Escreva para o lojista, nao para o time tecnico.

Cada entry deve responder:

1. O que mudou?
2. Por que isso importa para o lojista?
3. O usuario precisa fazer algo?

Prefira:

```txt
Agora sua loja mostra quais dados ainda faltam antes de gerar campanhas.
Assim fica mais facil saber o que completar para publicar uma oferta com seguranca.
```

Evite:

```txt
Adicionado readiness guard no endpoint de campaign generation com retorno 412.
```

Use frases curtas, concretas e comerciais. Evite nomes de componentes, endpoints, migrations, hooks, services, tabelas e detalhes de implementacao.

## Fonte dos Dados

As entries vivem em:

```txt
content/changelog/
```

Formato do arquivo:

```txt
YYYY-MM-DD-slug-da-entrega.md
```

Exemplo:

```txt
2026-08-01-fase-34-store-readiness.md
```

## Template

Use este modelo:

```md
---
id: "fase-34-store-readiness"
title: "Loja mais pronta para gerar campanhas"
date: "2026-08-01"
milestone: "v1.5"
category: "improvement"
importance: "minor"
announcement: "none"
---

## O que mudou

- Agora o Vendeo mostra quais dados da loja precisam estar completos antes de gerar campanhas.
- A direcao visual, o logo e os dados fiscais ajudam a criar pecas mais consistentes.

## O que voce precisa fazer

- Acesse Loja e complete os dados pendentes antes de criar uma nova campanha.
```

## Campos do Frontmatter

| Campo | Tipo | Regra |
|-------|------|-------|
| `id` | string | Slug unico e estavel. Use fase ou nome da entrega. |
| `title` | string | Titulo claro para usuario, nao tecnico. |
| `date` | `YYYY-MM-DD` | Data civil (sem hora) da publicacao no fuso brasileiro. A exibicao `dd/mm/aaaa` deriva da propria string, sem conversao de timezone — evita shift de dia em UTC-3. |
| `milestone` | string opcional | Exemplo: `"v1.5"`. |
| `category` | `"feature"`, `"improvement"` ou `"fix"` | Categoria principal percebida pelo usuario. |
| `importance` | `"major"` ou `"minor"` | Use `major` para mudanca relevante de produto ou comportamento. |
| `announcement` | `"none"`, `"card"` ou `"modal"` | Define se a entry gera aviso na dashboard. |

## Categorias

Use `feature` quando a entrega adiciona uma capacidade nova.

Use `improvement` quando melhora uma experiencia existente, reduz friccao, aumenta clareza ou torna o fluxo mais confiavel.

Use `fix` quando corrige algo que atrapalhava o usuario.

## Importancia

Use `major` quando:

- muda fluxo principal;
- cria uma nova area ou recurso importante;
- exige acao do usuario;
- altera cadastro, creditos, legal, cobranca ou bloqueio;
- melhora significativamente campanha, loja, conta ou dashboard.

Use `minor` quando:

- melhora algo ja existente;
- corrige problema pequeno;
- adiciona clareza sem mudar o fluxo;
- comunica ajuste util, mas nao critico.

## Announcement

Use `announcement: "none"` como padrao. A entry aparece em `/novidades`, e o indicador da sidebar mostra que ha conteudo novo.

Use `announcement: "card"` quando a novidade merece destaque leve na dashboard, mas nao precisa interromper o usuario. Exemplos:

- novo recurso relevante;
- melhoria importante em campanha, loja ou dashboard;
- mudanca que aumenta valor percebido;
- entrega que o usuario provavelmente gostaria de descobrir.

Exemplo: uma entry com `announcement: "card"` no frontmatter vira um card descartavel no topo da dashboard, com destaque leve e botao para ver as novidades em `/novidades`.

Use `announcement: "modal"` apenas para mudancas criticas. Exemplos:

- acao obrigatoria;
- mudanca legal ou comercial importante;
- alteracao de cobranca, creditos ou plano;
- bloqueio novo;
- mudanca que altera o caminho para gerar campanhas;
- novidade de catalogo ou fluxo que precisa chamar muita atencao.

Nunca use modal para simples melhoria visual, refatoracao, ajuste pequeno ou correcao comum.

## Frequencia

Atualize o changelog ao final de cada fase com impacto visivel ao usuario.

Agrupe entregas pequenas quando fizer mais sentido editorial. Uma fase pode virar uma entry unica, e varias fases pequenas podem virar uma entry de milestone.

Nao crie entries tecnicas apenas para provar que houve trabalho. Se o usuario nao perceber ou nao precisar saber, registre "changelog nao necessario" na verificacao.

## Checklist do Verify

Antes de fechar a fase, confirme:

- [ ] Li este guia.
- [ ] Avaliei se houve impacto perceptivel para o lojista.
- [ ] Se houve impacto, criei ou atualizei uma entry em `content/changelog/*.md`.
- [ ] Se nao houve impacto, registrei "changelog nao necessario" no resultado do verify.
- [ ] A entry fala com o lojista, nao com desenvolvedores.
- [ ] A entry evita detalhes tecnicos de implementacao.
- [ ] O frontmatter tem `id`, `title`, `date`, `category`, `importance` e `announcement`.
- [ ] `announcement` foi escolhido com criterio: `none` por padrao, `card` para destaque, `modal` apenas para mudanca critica.
- [ ] A entry responde o que mudou, por que importa e se ha acao esperada.
- [ ] Nao ha mais de um announcement ativo sem motivo editorial claro.

## Mensagem Recomendada no Verify

Quando houver changelog:

```txt
Changelog: atualizado em content/changelog/YYYY-MM-DD-slug.md porque a fase trouxe mudanca perceptivel ao lojista: <resumo>.
Announcement: none/card/modal, pois <justificativa curta>.
```

Quando nao houver changelog:

```txt
Changelog: nao necessario, pois a fase nao trouxe mudanca perceptivel ao lojista.
```

