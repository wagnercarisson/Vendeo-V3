## Why

A landing pública hoje comunica apenas "beta fechado / solicite acesso" e seções genéricas ("O Vendeo pode criar", "Como funciona") que não mostram a transformação central do produto. Com as capacidades do Produto 1:1 já previstas na F56 (campanha de produto 1:1, apresentação em estúdio/ambientado/fundo original, abordagens oferta/destaque/exclusivo), o visitante não consegue entender o Vendeo vendo o que ele faz. Esta fatia renova a landing tornando visível a passagem de "informações simples" para "campanha pronta", promovendo as capacidades aprovadas sem ativar o fluxo nem alterar suas permissões.

Esta mudança substitui, para esta entrega, partes do antigo escopo F51.1 (linha de base, instrumentação de funil, prova visual, oferta de 10 créditos/7 dias). A reconciliação de tracking é explicitada em "Divergências e reconciliação".

## What Changes

- Reescrever a landing pública como página curta, visual e orientada à conversão, em português, mobile-first, com blocos não redundantes:
  1. **Hero** — promessa + campanha protagonista + CTA.
  2. **Transformação e simplicidade** — informações preenchidas → campanha recebida e conferida → download para publicação.
  3. **Apresentação do produto** — estúdio, ambientado ou fundo original (mesma abordagem comercial; isola a diferença de apresentação visual).
  4. **Identidade e controle** — bloco compacto, sustentado por exemplos; o usuário confere e decide o que publicar.
  5. **Abordagens de divulgação** — oferta, destaque, exclusivo (mesmo cenário e identidade da loja; diferentes formas de comunicar o produto).
  6. **Oferta independente** — comunicação comercial isolada e atualizável.
  7. **FAQ, CTA final e rodapé legal** — Novidades em posição secundária/footer.
- Adotar a headline e subheadline aprovadas e a narrativa "o usuário escolhe como apresentar; o Vendeo prepara a campanha" (hero: "Você define como quer apresentar."), sem exigir a string antiga na íntegra.
- Definir, antes dos exemplos finais, a **função, proporção e requisito** de cada imagem (hero prova qualidade; transformação prova simplicidade; apresentação prova flexibilidade visual; identidade prova coerência; abordagens provam diferentes formas de comunicar), permitindo troca simples de campanhas sem refazer o layout.
- Empregar conteúdo demonstrativo predefinido e placeholders; os exemplos finais exigem seleção e aprovação humana. Sem geração ao vivo, sem conexão à API de geração e sem gerações pagas.
- Reutilizar `publicSignupEnabled`/`getLaunchConfig()` em **todos** os CTAs de aquisição (hero, oferta e final): flag off → "Solicitar acesso free" + formulário atual; flag on → cadastros existentes; "Entrar" é ação secundária para quem já tem conta.
- Comunicar a oferta (28 dias gratuitos e até 20 créditos; 5 iniciais + 5 nos dias 7, 14 e 21; acúmulo; máximo 20; grátis restantes vencem ao fim do período) em componente independente, **sem** implementar concessões, calendário, saldo, expiração, notificações ou contabilidade.
- Preservar estrutura semântica, acessibilidade, estados do formulário e links legais existentes.

**Fora de escopo nesta mudança:** instrumentação de visita/CTA e rastreamento do funil; internacionalização/tradução/detecção de idioma ou país; SEO técnico/operacional completo (permanece na F51.2); implementação da nova oferta de créditos; pagamentos/checkout/planos/venda de créditos; deploy e ativação pública.

## Capabilities

### New Capabilities

- `landing-conversion-experience`: composição, narrativa, direção de imagens, comunicação da oferta e regras de apresentação da landing pública renovada; inclui a preservação de escopo (apenas capacidades F56), a proibição de inventar provas e o requisito de não exigir termos internos.

### Modified Capabilities

- `access-request-history`: o requisito de CTA da landing conforme a flag passa a cobrir **todos** os CTAs de aquisição da página renovada (hero, oferta e final), preservando integralmente o contrato de `publicSignupEnabled`, o formulário e o `POST /api/access-requests`.

## Divergências e reconciliação

O escopo original da F51.1 (documentado em `docs/alinhamento-roadmap-pos-f48-1.md`) diferia desta entrega. Registro explícito:

| Item do F51.1 anterior | Nesta entrega | Reconciliação |
|---|---|---|
| Instrumentar visita → CTA → … → download | **Removido** desta fatia | Permanece pendência de tracking a ser proposta em mudança própria; eventos `product_events` são a fonte downstream. |
| Linha de base da landing antes da mudança | Não é critério de aceite | Registrado como follow-up; não bloqueia a fatia visual. |
| Oferta "10 créditos por 7 dias" | Substituída por **28 dias / até 20 créditos** | Comunicação nova; implementação da oferta é mudança separada. |
| Galeria de campanhas / prova visual | Substituída por imagens com função única por bloco | Evita redundância e "seções empilhadas". |
| Processo em três passos | Absorvido pelo bloco de transformação | Evita duplicar "como funciona". |
| F51.2 (SEO técnico) | Permanece separado | Não é absorvido por esta fatia. |
| Teste local dos dois modos do funil end-to-end | Validar apresentação e destinos nos dois modos, sem ativação | Signup público não é ativado; instrumentação de funil não é critério. |

Não alterar artefatos históricos arquivados nem arquivos de outro worktree (F56). A atualização de `.planning/STATE.md`/`.planning/ROADMAP.md`/`.planning/REQUIREMENTS.md` para esta fatia deve ocorrer no fluxo GSD desta frente, **sem** sobrescrever o estado da F56.

## Impact

- **Código (preferencial):** `src/app/page.tsx`, `src/components/landing/*`, assets próprios da landing e testes correspondentes.
- **Compartilhado (usar, não alterar contrato):** `getLaunchConfig()`/`publicSignupEnabled`, `POST /api/access-requests`, componentes `ui/*`, tokens do design system (`openspec/design-system/MASTER.md`, dark OLED, sem light mode, sem emojis).
- **Justificativa obrigatória** antes de tocar `layout.tsx`, `globals.css`, design system global ou dependências; preferir estilos locais e componentes existentes.
- **Não alterar:** código da F56, ledger, migrations, serviços de crédito, onboarding, telas autenticadas, APIs de geração e autenticação/elegibilidade/semântica de flags.
- **Dependência registrada:** a comunicação da oferta depende de uma implementação separada (concessões/calendário/saldo/expiração) para entrega efetiva aos participantes. Esta fatia **não** implementa essa oferta.
- **Validação:** TypeScript, lint, build e testes relevantes; validação manual visual nos modos flag off/on, sem exigir geração de campanha nem rastreamento end-to-end. Checkpoint humano de aprovação da composição visual, copy e função das imagens antes da implementação.
