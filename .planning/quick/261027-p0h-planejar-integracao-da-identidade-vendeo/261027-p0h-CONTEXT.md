# Quick Task 261027-p0h: Integração da identidade Vendeo no app shell — Context

**Gathered:** 2026-10-27
**Revised:** 2026-10-27 (revisão de aprovação)
**Status:** Approved and executed — automated gates green; desktop, mobile and tablet visually approved; low screens/zoom not verified
**Mode:** quick (no discussion; user-supplied decisions recorded as locked)

<scope_note>
## Separação de escopo: quick 261027-p0h × F58 × F57

- Esta entrega é a **quick 261027-p0h** (`phase: quick`). Ela **não** é a F58.
- A branch atual chama-se `feature/fase-58-composicao-e-legibilidade-do-dashboard` porque
  **composição e legibilidade do dashboard são a F58**, um trabalho distinto. O nome da branch,
  sozinho, não registra a F58 nem transforma esta quick em fase.
- Nesta árvore **não existe** diretório `.planning/phases/58-*` nem change OpenSpec da F58.
  Nenhum artefato desta quick deve criar, alterar ou reivindicar registro de fase.
- A **F57** (fundação multimercado) está em outra aba/worktree e permanece **fora** deste trabalho.
- O escopo desta quick é somente a **identidade do app shell**: sidebar desktop, topbar mobile e
  drawer.
</scope_note>

<domain>
## Task Boundary

Integrar a identidade visual Vendeo ao **app shell** (sidebar desktop, topbar mobile e drawer),
deixando o shell mais apresentável, com identidade discreta e prioridade para a navegação — sem
reorganizar conteúdo do dashboard, sem tocar em banco/APIs/migrations/flags e sem alterar o design
system global.

A entrega desta quick é **somente o planejamento**. Nenhum código, ativo, dependência, commit de
implementação, push ou deploy deve ser produzido antes da aprovação humana.
</domain>

<decisions>
## Locked Decisions (user-approved)

### Desktop (≥ `md`, 768px)
- Logotipo **horizontal sem slogan** no topo da sidebar.
- O logotipo é clicável e leva a `/dashboard`.
- Assinatura “Postou, vendeo!” **centralizada na base** da sidebar desktop.
- Assinatura **30% menor** que na montagem aprovada, mantendo proporções.
- Assinatura **visível, porém discreta**.
- Assinatura **não** aparece na topbar nem no drawer móvel.
- **Opacidade original preservada**: a redução aprovada é de tamanho, não de opacidade.
  `opacity-80` foi removido do plano; qualquer redução de opacidade exigiria aprovação separada.

### Mobile e faixa intermediária
- **Celulares (< 640 px):** **sem símbolo** na topbar.
- **Faixa 640–767 px (sem sidebar):** símbolo **somente nessa faixa**, com
  `hidden sm:inline-flex md:hidden`; clicável para `/dashboard`.
- **Tablet/desktop (≥ 768 px):** sidebar preservada; símbolo oculto.
- **Logotipo horizontal** no topo do drawer aberto; clicável para `/dashboard`.
- Nome da loja, hambúrguer, CTA “Nova Campanha”, notificações e conta preservados.
- Composição de tablet/desktop com sidebar **inalterada**.

### Prioridade e altura
- Navegação tem prioridade: a assinatura **não** sobrepõe links, **não** reduz a área útil da
  navegação e **não** cria rolagem adicional.
- A navegação **não encolhe** no layout flex (`shrink-0`).
- A assinatura é ocultada quando o espaço **efetivamente disponível** for insuficiente — não
  apenas por uma altura nominal de viewport.
- Regra: piso de **560 px** de viewport **e** guarda medida
  `altura da sidebar − header − navegação ≥ bloco da assinatura + 16 px`.
- A guarda medida cobre texto ampliado, zoom, quebra de linha e novos itens de navegação.
- `ResizeObserver` é **obrigatório para exibir** a assinatura. Sem ele, a assinatura permanece
  oculta; o listener de `resize` apenas complementa a medição quando o observer está disponível.
- Validação explícita com texto ampliado, além do zoom do navegador.

### Preservação
- Paleta, tipografia, tokens e comportamento do drawer atuais.
- Navegação existente (Dashboard, Campanhas, Loja, Conta, Novidades) inalterada.
- Nome da loja, CTA, notificações e menu de conta inalterados.
- Nenhum redesenho, recriação ou aproximação da marca.

### Fora do escopo
- Conteúdo do dashboard, saudação, fuso, datas, indicadores, créditos, campanhas recentes,
  próximo passo.
- Mudanças globais de design system, landing page, manifest/ícones PWA.
- Banco, APIs, migrations, flags, geração de campanhas, dependências novas.
</decisions>

<asset_audit>
## Auditoria dos ativos (medida em 2026-10-27)

### 1. Logotipo horizontal — `public/landing/vendeo-logo-dark.webp`
- 384 × 82 px, WebP RGBA, proporção 4,683:1.
- **Não é transparente**: fundo sólido `#0F172A`, igual a `--bg-surface`.
- Conteúdo óptico em 348 × 70 px, com margens internas de 17/19 px nas laterais e 6 px no topo/base.
- **Adequação:** reutilizável no topo da sidebar e no drawer, pois ambos usam `bg-bg-surface`.
  Não pode ser colocado sobre `bg-bg-elevated`/`bg-hover` nem receber fundo de hover, sob pena de
  aparecer o retângulo escuro.
- Sem slogan. Não usar a arte de campanha (que contém slogan).

### 2. Símbolo — `public/icons/icon-512x512.png`
- 512 × 512 px, PNG RGBA; quadrado arredondado `#0F172A` com cantos transparentes.
- Marca “V” em 382 × 302 px; margens internas de 65 px nas laterais e 105 px no topo/base.
- **Adequação:** pode ser reutilizado **fielmente** na topbar sobre `bg-bg-surface`, pois o fundo
  do ícone coincide exatamente com o fundo da topbar; só o “V” fica visível.
- **Limite:** não é um símbolo transparente. Sobre qualquer superfície diferente de `#0F172A`
  aparece um quadrado arredondado mais escuro. Para esse caso seria necessário o original
  transparente — **não é necessário neste escopo**.
- **Decisão:** não redesenhar e não gerar aproximação; usar o ícone como está.

### 3. Assinatura — `C:/Users/wagne/Downloads/OpenAI Playground 2026-10-27 at 14.57.44.png`
- 1344 × 1170 px, PNG RGBA, fundo transparente (cantos com alpha 0).
- Conteúdo óptico em 1256 × 923 px, posicionado em (44, 162); margens: 44 px laterais,
  162 px no topo e 85 px na base. Proporção do conteúdo 1,361:1.
- Texto branco + sublinhado verde; **exige fundo escuro** (sidebar `bg-bg-surface` é adequada).
- **Adequação:** própria para a sidebar. O caminho escolhido é recortar **somente** as margens
  transparentes para obter dimensionamento determinístico, sem redimensionar/redesenhar a arte.
- Tamanho original: 573.042 bytes. A otimização (ex.: WebP) fica como follow-up, não bloqueia.

### Referência de tamanho — montagem horizontal 1536 × 1024
- A referência correta é a montagem **horizontal, 1536 × 1024**, desta conversa. A imagem
  quadrada 1254 × 1254 usada na primeira versão do plano é uma arte de campanha e **não** serve
  para dimensionar a sidebar.
- Não se transporta pixel da montagem diretamente para a sidebar CSS. A regra é proporcional:

  `largura_assinatura_px = (assinatura_na_montagem_px ÷ largura_da_sidebar_na_montagem_px) × 224 × 0,70`

- **Montagem localizada e medida em 2026-10-27:**
  `C:/Users/wagne/.codex/generated_images/01a15fd3-3d2b-7810-a311-6cdbbc6f35bf/exec-91db1814-198c-4b35-989c-9b2315f37d5f.png`
  (1536 × 1024).
  - `sidebar_na_montagem_px` = **304 px**
  - `assinatura_na_montagem_px` ≈ **229 px** (conteúdo visível, desconsiderando os pixels mais
    tênues da textura)
  - `ratio = 229 / 304 = 0,7533`
  - `SIGNATURE_WIDTH_PX = 0,7533 × 224 × 0,70 = 118,1 px` → adotado **118 px**
  - `SIGNATURE_HEIGHT_PX = 118 × 923 / 1256 ≈ 86,7 px`
  - Bloco da assinatura = `16 + 86,7 + 20 = 122,7 px`; com gap mínimo de 16 px, o espaço
    necessário é **138,7 px**.
- A medição acima substitui o valor provisório anterior de 126 px. O caminho da montagem fica
  registrado para conferência do executor.
</asset_audit>

<specifics>
## Specific Ideas

- Centralizar a assinatura, mantendo a **opacidade original** do ativo; sem blend e sem moldura.
- Nenhum fundo/hover atrás do logo ou do símbolo; usar apenas `focus-visible` para foco.
- Manter a assinatura fora do componente `Sidebar`, para que ela não vaze para o drawer.
- Usar `img` estático (mesmo padrão da landing), com `width`/`height` explícitos.
- A guarda de altura é medida em runtime, não apenas uma media query de viewport.
</specifics>
