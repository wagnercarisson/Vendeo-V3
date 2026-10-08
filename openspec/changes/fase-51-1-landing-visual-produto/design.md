## Context

A landing atual (`src/app/page.tsx` + `src/components/landing/*`) é pequena e relativamente isolada: hero com marca/slogan, CTAs condicionados a `publicSignupEnabled`, formulário de solicitação (`AccessRequestForm` → `POST /api/access-requests`), seções estáticas "O Vendeo pode criar" e "Como funciona", "Novidades" e rodapé legal. Não existe spec de landing; o comportamento de CTA é governado por `access-request-history`, `beta-access-request` e `launch-config`.

A F56.2 (em outro worktree) especifica o Produto 1:1: campanha de produto em formato 1:1, direção de fundo (estúdio / cenário ambientado / manter original) e abordagens oferta/destaque/exclusivo. A landing pode promover essas capacidades como valor do produto, sem ativar o fluxo nem alterar suas permissões e sem depender de código F56 nem das flags F56.

Restrições do design system: dark mode OLED (`#020617`), texto `#F8FAFC`, acento verde `#22C55E`, Poppins (headings) + Open Sans (body), Tailwind com CSS custom properties, `lucide-react` como ícones, **sem** light mode e **sem** emojis.

## Goals / Non-Goals

**Goals:**

- Fazer o visitante entender o Vendeo após hero + transformação, vendo "informações simples → campanha pronta".
- Página curta, visual, de conversão, em português e mobile-first, com blocos que não repetem função.
- Direção de imagens com função/proporção/requisito por bloco e troca simples de campanha sem refazer layout.
- Comunicar a oferta (28 dias / até 20 créditos) em componente isolado, sem implementá-la.
- CTAs de aquisição coerentes com `publicSignupEnabled` em toda a página.

**Non-Goals:**

- Instrumentação de funil, linha de base, rastreamento de visita/CTA.
- Implementação da oferta (concessão, calendário, saldo, expiração, notificações, contabilidade).
- SEO técnico/operacional (F51.2), i18n/tradução/detecção de idioma/país.
- Pagamentos/checkout/planos/venda de créditos.
- Alterar código F56, autenticação, elegibilidade, semântica de flags, contrato do `POST /api/access-requests`, ledger, migrations, onboarding, telas autenticadas ou APIs de geração.
- Deploy e ativação pública.

## Decisions

### D1 — Composição por função única (anti-redundância)

Cada bloco responde a uma pergunta distinta e tem uma função visual única:

| Bloco | Pergunta | Função |
|---|---|---|
| Hero | "O que é isso e por que devo me importar?" | Promessa + campanha protagonista + CTA |
| Transformação | "É fácil de usar?" | Prova de simplicidade (informações → campanha → download) |
| Apresentação do produto | "Consigo escolher como apresentar meu produto?" | Prova de flexibilidade visual (estúdio/ambientado/fundo original), mesma abordagem nos exemplos |
| Identidade e controle | "Fica com a cara da minha loja? Eu mando?" | Prova de coerência + controle do usuário |
| Abordagens de divulgação | "Como comunico meu produto?" | Prova de diferentes formas de comunicar (oferta/destaque/exclusivo), mesmo cenário e identidade |
| Oferta | "Quanto custa começar?" | Comunicação comercial isolada |
| FAQ + CTA final | "Ainda tenho dúvidas?" | Objeções + conversão + rodapé legal |

"Como funciona" não é reimplementado como bloco próprio: é absorvido pela transformação. Alternativa considerada: manter "Como funciona" + "O Vendeo pode criar" e adicionar a transformação — rejeitada porque gera repetição e aparência de seções empilhadas.

### D2 — Contrato de imagens: função, proporção e requisito

Antes de escolher os exemplos definitivos, cada imagem é especificada por sua função de prova e proporção, para permitir troca posterior sem refazer layout:

- **Hero** — prova **qualidade**; 1 campanha protagonista; proporção estável (recomendado 1:1), sem empurrar CTA para longe no mobile.
- **Transformação** — prova **simplicidade**; composição "antes/depois" (informações simples → campanha).
- **Apresentação do produto** — prova **flexibilidade visual**; três campanhas do mesmo produto (estúdio, ambientado, fundo original), mantendo a mesma abordagem comercial e informações equivalentes, para isolar a diferença de apresentação.
- **Abordagens de divulgação** — prova **diferentes formas de comunicar**; três campanhas do mesmo produto (oferta, destaque, exclusivo), mantendo o mesmo cenário e a identidade da loja, variando as informações necessárias; peso editorial menor (título curto, apoio e três exemplos).
- **Identidade** — prova **coerência de marca** com exemplos; **não** fabricar prova de identidade.

Exemplos finais obtidos posteriormente no app/laboratório e aprovados por humano. Placeholders podem apoiar a aprovação visual, mas a entrega só é concluída após aprovação dos exemplos finais. Alternativa considerada: usar imagens genéricas de banco — rejeitada porque não prova o produto e viola "não inventar provas".

### D3 — Conteúdo demonstrativo estático, sem geração ao vivo

A transformação usa conteúdo demonstrativo predefinido. A landing **não** chama a API de geração, **não** gera arte ao vivo e **não** executa gerações pagas. Isso mantém a fatia independente da F56 e evita custo.

### D4 — CTAs respeitam `publicSignupEnabled` sem alterar contrato

Todos os CTAs de aquisição (hero, oferta e final) usam o valor server-side de `getLaunchConfig().publicSignupEnabled`:

- **flag off:** "Solicitar acesso free" → formulário atual (`AccessRequestForm`), contrato do `POST /api/access-requests` preservado.
- **flag on:** caminhos de cadastro existentes ("Continuar com Google" principal + "Continuar com email" → `/signup`).
- "Entrar" é **secundário**, para quem já tem conta; nunca é a ação universal de aquisição.

Alternativa considerada: CTA de aquisição apontando para `/login` — rejeitada (não é aquisição; confunde beta fechado com signup).

### D5 — Oferta como componente independente (comunicação, não implementação)

A oferta é um componente isolado, fácil de atualizar, com mensagem principal **curta** e a mecânica (distribuição, acúmulo, início e vencimento) **obrigatoriamente** em informação secundária/FAQ. Ela comunica condições, mas **não** implementa nada: sem concessão, calendário, saldo, expiração, notificação ou contabilidade. A dependência de uma implementação separada para entrega efetiva aos participantes é registrada **nos artefatos internos**, nunca como aviso técnico na página.

Regras de copy da oferta:
- Não prometer 20 campanhas nem uso ilimitado.
- No beta fechado, solicitar acesso **não** inicia o período.
- Período começa após concluir o onboarding; 5 iniciais + 5 nos dias 7, 14 e 21; acúmulo; máximo 20; grátis restantes vencem ao fim do período.

### D6 — Fronteira de arquivos e alterações globais

Preferir `src/app/page.tsx`, `src/components/landing/*`, assets próprios e testes correspondentes. Qualquer necessidade de tocar `layout.tsx`, `globals.css`, design system global ou dependências deve ser **identificada e justificada previamente**, preferindo estilos locais e componentes existentes. A seção "Novidades" vai para o footer/posição secundária.

### D7 — Acessibilidade, semântica e mobile-first preservadas

Manter hierarquia de headings, landmarks, links legais (`/termos`, `/privacidade`, `/uso-aceitavel`, Contato), alvos de toque ≥ 44px, foco visível e estados do formulário. Mobile-first: evitar imagens que empurrem mensagem e CTA para muito abaixo da dobra.

### D8 — Linguagem sem termos internos

Nenhum bloco pode exigir termos internos (`briefing`, `intenção`, `F56`) para compreender o benefício. Não explicar regras internas de inferência nem sugerir que a intenção seja sempre escolha explícita. Preservar "Você define como quer apresentar. O Vendeo prepara a campanha."

### D9 — Checkpoint humano antes da implementação

Aprovação humana da composição visual, da copy e da **função** das imagens antes de implementar. Os exemplos finais exigem nova aprovação antes de considerar a entrega concluída.

### D10 — Reconciliação de tracking sem tocar a F56

Divergências do antigo F51.1 estão tabeladas no `proposal.md`. A atualização de `.planning/STATE.md`/`.planning/ROADMAP.md`/`.planning/REQUIREMENTS.md` deve ocorrer no fluxo GSD desta frente, sem sobrescrever o estado da F56 nem artefatos históricos arquivados.

## Risks / Trade-offs

- **[Ativar ou alterar o fluxo a partir da landing]** → a comunicação promove as capacidades aprovadas sem ativar flags nem alterar permissões; flags F56 permanecem desligadas; sem link para geração; a comunicação não é enquadrada como funcionalidade futura.
- **[Imagens finais sem prova / inventadas]** → contrato de função D2 + aprovação humana D9; proibido inventar depoimentos/resultados/provas de identidade.
- **[Oferta lida como mecânica já implementada]** → mensagem principal curta com a mecânica em secundário/FAQ; sem promessa de "ilimitado"; dependência de implementação registrada apenas nos artefatos internos, sem aviso técnico na página.
- **[CTA de aquisição errado em um dos modos]** → todos os CTAs usam a mesma fonte server-side; testes cobrem flag off/on; "Entrar" sempre secundário.
- **[Conflito com F56 em arquivos compartilhados]** → fronteira D6 restrita à landing; proibido alterar código F56, créditos, migrations, onboarding e telas autenticadas.
- **[Alteração global silenciosa]** → exigir justificativa prévia para `layout.tsx`/`globals.css`/design system.
- **[Mobile com imagem grande empurrando CTA]** → proporções e requisitos definidos em D2 + validação manual mobile.

## Migration Plan

1. Aprovação humana (D9): composição, copy e função das imagens.
2. Implementar a página e os componentes de landing com placeholders/estilos locais; typecheck/lint/build/testes.
3. Substituir placeholders pelas campanhas aprovadas, sem refazer layout.
4. Validação manual visual nos modos flag off/on (sem ativar signup público).
5. Entrega concluída apenas após aprovação dos exemplos finais.

**Rollback:** a fatia é aditiva/local. Reverter a página e os componentes de landing restaura o estado anterior sem afetar flags, autenticação, `access_requests` ou código F56.

## Open Questions

- Nenhuma bloqueante. Não bloqueantes: formatos/proporções exatas dos assets (definidos em D2 e na aprovação) e a redação final do FAQ da oferta.
