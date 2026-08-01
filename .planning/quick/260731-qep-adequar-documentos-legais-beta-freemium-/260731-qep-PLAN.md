---
phase: quick-qep
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - public/docs/legal/terms-of-service-v1.md
  - public/docs/legal/terms-of-service-v1-1.md
  - public/docs/legal/terms-of-service-v1-2.md
  - public/docs/legal/privacy-policy-v1.md
  - public/docs/legal/privacy-policy-v1-1.md
  - public/docs/legal/acceptable-use-v1.md
  - src/app/(marketing)/termos/page.tsx
  - src/app/(marketing)/privacidade/page.tsx
  - src/app/(marketing)/uso-aceitavel/page.tsx
  - public/docs/legal/terms-of-service-v1-3.md
  - public/docs/legal/privacy-policy-v1-2.md
  - public/docs/legal/acceptable-use-v1-1.md
  - src/lib/legal/document-content.ts
  - supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql
  - src/components/flow/campaign-input-form.tsx
  - src/app/(app)/campanhas/[id]/client.tsx
autonomous: true
requirements: [A, B, C, D, E, F, G]
must_haves:
  truths:
    - "Nenhum documento público legal (public/docs/legal/*.md) contém o aviso de draft/advogado"
    - "Nenhuma página pública (src/app/(marketing)/termos|privacidade|uso-aceitavel/page.tsx) renderiza o blockquote hardcoded de aviso de draft/advogado"
    - "Termos de Uso v1.3 trata créditos como unidade interna/promocional no beta, sem cobrança pública"
    - "Compra de créditos, planos e assinaturas aparecem nos Termos v1.3 apenas como funcionalidade futura"
    - "Termos v1.3 substitui 'grupo econômico' por critério técnico de elegibilidade promocional/antifraude"
    - "Termos v1.3 inclui consumo de crédito apenas após conclusão técnica, recreditamento por falha, declaração de autorização para cadastrar loja, responsabilidade do lojista e revisão de campanhas geradas por IA"
    - "Política de Privacidade v1.2 lista suboperadores por categoria citando apenas provedores confirmados (Supabase, Vercel, OpenAI) e categorias genéricas para os demais (provedores de IA configurados pela Plataforma, email transacional, observabilidade), prevê transferência internacional e não sugere acesso a senha em texto claro"
    - "Política de Privacidade v1.2 trata CNPJ tecnicamente (nem sempre dado pessoal; pode associar-se a MEI/sócios/responsáveis)"
    - "Política de Uso Aceitável v1.1 cobre publicidade enganosa, promoções sem estoque, 'de/por' sem preço real, marcas/imagens e categorias sensíveis"
    - "DOCUMENT_CATALOG contém entradas para terms v1.3, privacy v1.2 e acceptable_use v1.1"
    - "Migration publica as 3 novas versões em legal_document_versions com effective_at, idempotente (ON CONFLICT), sem comentários sobre revisão jurídica"
    - "Cavê de revisão jurídica registrado APENAS no artefato .planning (legal-review-notes.md), nunca em código/banco/migrations"
    - "Microcopy discreta presente no formulário (perto de Criar Campanha) e na página da campanha (perto de Baixar Original), sem modais nem checkboxes"
  artifacts:
    - path: "public/docs/legal/terms-of-service-v1-3.md"
      provides: "Termos de Uso v1.3 para beta freemium"
      contains: "Versão: v1.3"
    - path: "public/docs/legal/privacy-policy-v1-2.md"
      provides: "Política de Privacidade v1.2 com suboperadores e IA"
      contains: "Versão: v1.2"
    - path: "public/docs/legal/acceptable-use-v1-1.md"
      provides: "Política de Uso Aceitável v1.1"
      contains: "Versão: v1.1"
    - path: "src/lib/legal/document-content.ts"
      provides: "Catálogo documento+versão → arquivo"
      contains: "v1.3"
    - path: "supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql"
      provides: "Publicação das 3 versões com effective_at"
      exports: ["terms_of_service v1.3", "privacy_policy v1.2", "acceptable_use v1.1"]
  key_links:
    - from: "src/lib/legal/document-content.ts"
      to: "public/docs/legal/terms-of-service-v1-3.md"
      via: "DOCUMENT_CATALOG filePath"
      pattern: "terms-of-service-v1-3"
    - from: "supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql"
      to: "public.legal_document_versions"
      via: "INSERT ... ON CONFLICT DO UPDATE"
      pattern: "legal_document_versions"
    - from: "src/app/(app)/campanhas/[id]/client.tsx"
      to: "public/docs/legal/terms-of-service-v1-3.md"
      via: "microcopy de revisão pré-publicação"
      pattern: "revis"
---

# QEP — Adequar Documentação Legal para Beta Freemium

## Adendo Pós-Revisão Especializada - 2026-07-31

Após a execução inicial, os documentos versionados atuais foram ajustados
diretamente, sem criar novas versões, porque ainda não houve acesso/aceite das
versões v1.3/v1.2/v1.1 por beta testers.

Este adendo prevalece sobre trechos anteriores do plano que falem em
"suboperadores", teto de responsabilidade baseado em valores pagos, prazo geral
de 15 dias úteis, eliminação universal em 90 dias ou validade dos créditos
enquanto a conta estiver ativa.

Decisões finais incorporadas:

- Não publicar dados pessoais do responsável pelo projeto no beta fechado. O
  risco foi registrado apenas em `legal-review-notes.md` e deverá ser corrigido
  quando houver pessoa jurídica constituída, antes de cobrança ou operação
  comercial ampla.
- Termos v1.3 passam a incluir beta fechado, licença operacional dos Materiais
  do Lojista, ressalvas sobre resultados de IA, destino de créditos
  promocionais, revisão humana ampliada e responsabilidade sem teto baseado em
  valores pagos.
- Privacidade v1.2 passa a usar "fornecedores e operadores de dados", bases
  legais gerais, direitos LGPD ampliados, prazos legais, segurança sem promessas
  absolutas e retenção compatível com obrigações legais, antifraude, auditoria
  e backups.
- AUP v1.1 passa a usar "ofertas sem disponibilidade razoável" e "perda de
  créditos promocionais" em vez de "reembolso".
- Microcopy de campanha permanece como implementada, sem novos checkboxes,
  modais ou fricção.

<objective>

**Purpose:** Adequar a documentação legal pública do Vendeo para a fase de beta testers na versão freemium: sem cobrança pública, sem Stripe, sem planos pagos, sem compra self-service de créditos. Créditos são gratuitos/promocionais ou concedidos manualmente pelo time. A redação deve preparar a evolução futura para créditos pagos SEM implementar cobrança.

**Output:** Novas versões de Termos de Uso (v1.3), Política de Privacidade (v1.2) e Política de Uso Aceitável (v1.1, sujeita à decisão D2), atualização do catálogo de documentos, migration de publicação e microcopy discreta nas telas de campanha.

**Escopo explícito (G):** NÃO implementar cobrança, Stripe, planos, assinaturas nem política comercial completa. Apenas redação preparada para evolução futura.

</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@public/docs/legal/terms-of-service-v1-2.md
@public/docs/legal/terms-of-service-v1-1.md
@public/docs/legal/terms-of-service-v1.md
@public/docs/legal/privacy-policy-v1-1.md
@public/docs/legal/privacy-policy-v1.md
@public/docs/legal/acceptable-use-v1.md
@src/lib/legal/document-content.ts
@src/lib/legal/document-versions.ts
@src/lib/legal/acceptance-service.ts
@src/lib/legal/privacy.ts
@src/lib/legal/types.ts
@supabase/migrations/20260723000001_create_legal_document_versions.sql
@supabase/migrations/20260723000006_seed_legal_document_versions_v1.sql
@supabase/migrations/20260724000003_publish_terms_of_service_v1_1.sql
@supabase/migrations/20260727000001_freemium_anti_abuso_cnpj.sql
@src/components/flow/campaign-input-form.tsx
@src/app/(app)/campanhas/[id]/client.tsx
</context>

---

## 1. Lista de Arquivos/Documentos Provavelmente Afetados

### 1.1. Documentos públicos existentes (editar — remover aviso de draft)

| Arquivo | Ação |
|---------|------|
| `public/docs/legal/terms-of-service-v1.md` | Remover aviso de draft (linha 6) |
| `public/docs/legal/terms-of-service-v1-1.md` | Remover aviso de draft (linha 6) |
| `public/docs/legal/terms-of-service-v1-2.md` | Remover aviso de draft (linha 6) |
| `public/docs/legal/privacy-policy-v1.md` | Remover aviso de draft (linha 6) |
| `public/docs/legal/privacy-policy-v1-1.md` | Remover aviso de draft (linha 6) |
| `public/docs/legal/acceptable-use-v1.md` | Remover aviso de draft (linha 6) |

### 1.1b. Páginas públicas com aviso hardcoded (editar — remover blockquote)

O mesmo aviso de draft está **hardcoded em JSX** nas páginas de marketing. Sem mexer nelas, o aviso continuaria aparecendo no site mesmo com os documentos novos (o `<LegalDocumentViewer>` embute apenas o markdown).

| Arquivo | Ação |
|---------|------|
| `src/app/(marketing)/termos/page.tsx` | Remover blockquote `<blockquote>` com "Aviso importante" (linhas 25-30) |
| `src/app/(marketing)/privacidade/page.tsx` | Remover blockquote `<blockquote>` com "Aviso importante" (linhas 25-30) |
| `src/app/(marketing)/uso-aceitavel/page.tsx` | Remover blockquote `<blockquote>` com "Aviso importante" (linhas 25-30) |

> As 3 páginas seguem a mesma estrutura: cabeçalho + `LegalDocumentViewer` que carrega o markdown da versão vigente. A remoção do blockquote não afeta o viewer. Nenhum teste existente referencia o aviso (verificado por grep em `src/**/*.test.*`).

### 1.2. Novos documentos públicos (criar)

| Arquivo | Conteúdo |
|---------|----------|
| `public/docs/legal/terms-of-service-v1-3.md` | Termos de Uso v1.3 — beta freemium |
| `public/docs/legal/privacy-policy-v1-2.md` | Política de Privacidade v1.2 |
| `public/docs/legal/acceptable-use-v1-1.md` | Política de Uso Aceitável v1.1 (D2 aprovado: criar) |

### 1.3. Código e banco

| Arquivo | Ação |
|---------|------|
| `src/lib/legal/document-content.ts` | Adicionar entradas `v1.3` (terms), `v1.2` (privacy), `v1.1` (acceptable_use) ao `DOCUMENT_CATALOG` |
| `supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` | Nova migration publicando as 3 versões em `legal_document_versions` (padrão 20260724000003) |
| `src/components/flow/campaign-input-form.tsx` | Microcopy discreta perto do botão "Criar Campanha" |
| `src/app/(app)/campanhas/[id]/client.tsx` | Microcopy discreta perto do botão "Baixar Original" |

### 1.4. Arquivos verificados e SEM mudança necessária

- `src/lib/legal/document-versions.ts` — lê `legal_document_versions` dinamicamente; nenhuma mudança necessária.
- `src/lib/legal/acceptance-service.ts` — fluxo de re-aceite detecta automaticamente `"outdated"` quando a versão vigente muda; nenhuma mudança necessária (atende B).
- `src/lib/legal/privacy.ts` — ciência da Política de Privacidade via `getCurrentVersion("privacy_policy")`; re-ciência automática na nova versão; nenhuma mudança necessária.
- `src/lib/legal/types.ts` — `DocumentType` já cobre os 3 tipos; nenhuma mudança necessária.
- `src/components/flow/campaign-page-client.tsx` — **não contém a ação de exportar/baixar** (apenas exibe o formulário). A ação real está em `src/app/(app)/campanhas/[id]/client.tsx`. Por isso a microcopy de download entra neste último (ver D3).

---

## 2. Proposta de Novas Versões dos Documentos

### 2.1. Termos de Uso — v1.3 (obrigatório, decisão C)

**Base:** `terms-of-service-v1-2.md` (v1.2, publicada 2026-07-28). **Nova versão:** v1.3, data 2026-07-31.

Mudanças de conteúdo:

| Item | V1.2 (atual) | V1.3 (proposto) |
|------|--------------|-----------------|
| **C1. Natureza dos créditos** | §4.2 "Créditos adicionais podem ser adquiridos" | Créditos são unidade interna/promocional do beta. Compra de créditos, planos e assinaturas são **funcionalidade FUTURA**, sujeita a política comercial própria a ser apresentada e aceita separadamente |
| **C2. Crédito promocional** | Não declarado | Crédito promocional **não é moeda, não é transferível, não gera saque/resgate e não representa saldo financeiro** |
| **C3. Consumo de crédito** | §4.4 saldo não expira | Consumo ocorre **apenas quando a campanha é tecnicamente concluída e disponibilizada** ao Lojista |
| **C4. Falha técnica** | Não declarado | Falha técnica → **recreditamento automático ou manual** |
| **C5. CNPJ/raiz** | §5.2 "grupo econômico" | Substituir "grupo econômico" por **"raiz de CNPJ (8 primeiros dígitos) como critério técnico de elegibilidade promocional e antifraude"** — explicitamente NÃO configurando definição jurídica de grupo econômico |
| **C5a. §5.3** | "mediante compra de créditos" | Reescrever: lojas adicionais da mesma raiz podem receber créditos promocionais conforme política promocional vigente ou convite do time (sem menção a compra no beta) |
| **C6. Autorização de cadastro** | §2.5/2.6 CNPJ verdadeiro | Adicionar: **o Lojista declara possuir autorização para cadastrar e administrar a loja vinculada ao CNPJ informado** |
| **C7. Responsabilidade do lojista** | §3.3 genérico | Reforçar: o Lojista mantém responsabilidade sobre **materiais enviados, marcas, imagens, produtos, preços, estoque, ofertas e campanhas publicadas** |
| **C8. Revisão de IA** | v1.2 removeu o item presente no v1.0/v1.1 (§3.2) | Reintroduzir: **campanhas geradas por IA devem ser revisadas pelo Lojista antes da publicação** |
| **§8 Compra de Créditos** | Seção inteira sobre compra | Substituir por seção **"Funcionalidades Futuras"**: pagamento, planos e assinaturas serão oferecidos futuramente, sujeitos a política comercial própria, com aceite separado; nada no beta obriga compra |
| **§7 Limitação de responsabilidade** | "limitada ao valor pago nos últimos 12 meses" | Ajustar redação para refletir beta sem cobrança (nada pago no beta → limitação aplicável permanece coerente; sujeito a revisão jurídica — ver Seção 6) |
| **C0. Aviso de draft** | §linha 6 | **Removido** (decisão A) — cavê de revisão jurídica apenas interno, no artefato `.planning` (D1) |

### 2.2. Política de Privacidade — v1.2 (obrigatório, decisão D)

**Base:** `privacy-policy-v1-1.md` (v1.1, publicada 2026-07-28). **Nova versão:** v1.2, data 2026-07-31.

Mudanças de conteúdo:

| Item | V1.1 (atual) | V1.2 (proposto) |
|------|--------------|-----------------|
| **D1. Suboperadores por categoria** | §3.1 genérico ("provedores de infraestrutura", "processadores de pagamento quando aplicável") | Tabela por categoria, **citando por nome apenas provedores confirmados no código**: **Autenticação/banco/storage → Supabase** (confirmado); **Hospedagem → Vercel** (plataforma de deploy do projeto, confirmada); **IA → OpenAI** (confirmado no código, `openai` no package.json) + **"provedores de IA configurados pela Plataforma"** (categoria genérica cobrindo Gemini/Google, que existe como provedor de texto implementado, e provedores futuros — **Anthropic NÃO citado por nome**, sem confirmação operacional atual); **Email → "provedores de email transacional"** (genérico — **Resend NÃO citado**, sem presença no código); **Observabilidade/analytics → "ferramentas de observabilidade/analytics"** (genérico até confirmar stack); **Suporte → email suporte@vendeo.tech**; **Pagamento/emissão fiscal → FUTURO, a ser atualizado quando implementado** |
| **D2. Envio a provedores de IA** | Não declarado | Informar que **prompts, imagens, dados da loja, produto/oferta e resultados gerados podem ser enviados a provedores de IA quando necessário para a execução do serviço** |
| **D3. Transferência internacional** | Não declarado | Nova seção: dados podem ser processados fora do Brasil por fornecedores (ex.: OpenAI, Vercel, Supabase e demais provedores configurados pela Plataforma), com fundamento na LGPD (art. 33) e salvaguardas contratuais |
| **D4. Revisão geral** | — | Revisar categorias de dados (§2), finalidades, bases legais, direitos dos titulares (§5), retenção (§6), segurança (§4) e adicionar **comunicação de incidentes de segurança** |
| **D5. Senha/Supabase** | §2.1 "Email e senha (criação de conta)" | Corrigir linguagem: **senhas são armazenadas com hash pelo provedor de autenticação (Supabase); o Vendeo não acessa senhas em texto claro** |
| **D6. CNPJ tecnicamente correto** | §2.3.1/§2.4 "grupo econômico" | **CNPJ de PJ nem sempre é dado pessoal**, mas pode estar associado a MEI, empresário individual, sócios, responsáveis ou contatos — tratar de forma proporcional; substituir "grupo econômico" pelo mesmo critério técnico dos Termos v1.3 |
| **§2.4(d)** | "Processar cobranças e emitir notas fiscais" | Manter como finalidade futura ("quando houver cobrança/emissão fiscal, esta Política será atualizada") |

### 2.3. Política de Uso Aceitável — v1.1 (D2 aprovado: criar agora)

**Base:** `acceptable-use-v1.md` (v1.0, publicada 2026-07-23). **Decisão do usuário (D2):** criar a v1.1 agora, aproveitando o mesmo ciclo de re-aceite dos Termos v1.3 (a AUP é aceita em conjunto com os Termos no onboarding/re-aceite).

Análise do conteúdo atual: a v1.0 **já cobre** nudez, violência, ódio, ilegal (incl. falsificados), plágio, desinformação, conteúdo enganoso (§2.7) e menores (§2.8). **Faltam** itens específicos de compliance comercial:

| Item | Status na v1.0 | Proposta v1.1 |
|------|----------------|---------------|
| Publicidade enganosa | Parcial (§2.7 genérico) | Especificar: alegações falsas ou não comprováveis sobre produtos/serviços |
| Promoções sem estoque | Ausente | Proibir divulgar oferta sem estoque suficiente para atendimento (CDC) |
| "De/por" sem preço anterior real | Ausente | Proibir "de/por" sem preço anterior real praticado (CONAR) |
| Uso indevido de marcas/imagens | Parcial (§2.5/§5.3) | Reforçar autorização de marcas/imagens de terceiros |
| Categorias sensíveis | Ausente | Seção específica: **saúde, suplementos, bebidas, financeiro, produtos falsificados, política/eleitoral, conteúdo envolvendo menores** — uso sob responsabilidade do Lojista e conforme regulamentação aplicável |

**Recomendação aprovada pelo usuário:** criar a v1.1 **agora**. Motivos: (a) a v1.0 não cobre os riscos comerciais mais prováveis no beta (preço "de/por", estoque, categorias reguladas); (b) a onda de re-aceite dos Termos v1.3 é o momento natural para o Lojista aceitar a AUP v1.1 em conjunto (uma única interação de re-aceite); (c) custo marginal baixo (documento curto).

---

## 3. Decisões a Confirmar (antes da implementação)

> **Status:** decisões revisadas e aprovadas pelo usuário em 2026-07-31. Ajustes incorporados em D1, D3, D6 e microcopy. Restam apenas detalhes finos de redação (D6) a confirmar durante a execução se surgirem evidências novas.

| # | Decisão | Status | Decisão final |
|---|---------|--------|---------------|
| **D1** | Onde manter o cavê de revisão jurídica (só interno, nunca público) | **Ajustada** | **Somente artefato `.planning`** — `legal-review-notes.md` no diretório do quick task. **NÃO** colocar comentário na migration nem em qualquer código/banco: migration entra no histórico do repo e pode vazar contexto indevido |
| **D2** | Criar AUP v1.1 agora ou adiar? | **Aprovada** | **Criar agora** — AUP é aceita junto dos Termos; aproveitar o ciclo de re-aceite para cobrir "de/por", estoque, marcas/imagens e segmentos sensíveis |
| **D3** | Onde colocar a microcopy de download | **Aprovada** | Formulário (`campaign-input-form.tsx` perto de "Criar Campanha") + `src/app/(app)/campanhas/[id]/client.tsx` (perto de "Baixar Original"). Não em `campaign-page-client.tsx` (não contém a ação) |
| **D4** | Remover o aviso de draft também dos arquivos de versões antigas | **Aprovada** | Sim, remover dos 6 markdowns + 3 páginas JSX hardcoded (novo item adicionado ao escopo) |
| **D5** | `effective_at` das novas versões | **Aprovada** | `now()` — imediato |
| **D6** | Provedores a citar nominalmente na Política de Privacidade | **Ajustada** | Citar **apenas os confirmados no código**: Supabase, Vercel, OpenAI. Demais genéricos: "provedores de IA configurados pela Plataforma", "provedores de email transacional", "ferramentas de observabilidade". **Anthropic e Resend NÃO citados** (sem confirmação). Gemini/Google coberto pela categoria genérica |
| **D7** | Impacto operacional do re-aceite | **Aprovada** | Aceitar — beta testers existentes ficam `outdated` e re-aceitam; comunicar via changelog |

---

## 4. Tarefas de Implementação

### Wave 1 — Documentos e microcopy (tarefas independentes entre si)

**Task 1: Remover aviso de draft dos 6 documentos públicos existentes e das 3 páginas públicas**
- **Arquivos:** `public/docs/legal/terms-of-service-v1.md`, `public/docs/legal/terms-of-service-v1-1.md`, `public/docs/legal/terms-of-service-v1-2.md`, `public/docs/legal/privacy-policy-v1.md`, `public/docs/legal/privacy-policy-v1-1.md`, `public/docs/legal/acceptable-use-v1.md`; `src/app/(marketing)/termos/page.tsx`, `src/app/(marketing)/privacidade/page.tsx`, `src/app/(marketing)/uso-aceitavel/page.tsx`
- **Ação:**
  - Nos 6 markdowns: remover a linha 6: `> **Aviso importante:** Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar.` Manter a linha `> **Versão:**` e a data de publicação intactas. Não adicionar nenhum texto substitutivo no lugar (decisão A — cavê apenas interno, D1).
  - Nas 3 páginas JSX: remover o `<blockquote>` inteiro (linhas 25-30) contendo `<strong>Aviso importante:</strong> Este documento é um draft preparado pelo time do Vendeo para revisão jurídica. Não constitui aconselhamento legal. Consulte um advogado antes de publicar.` Manter o `<h1>`, o parágrafo de versão e o `<LegalDocumentViewer>` intactos.
- **Verificação:**
  - `rg -c "Aviso importante" public/docs/legal/` → 0 ocorrências; `rg -c "draft preparado" public/docs/legal/` → 0 ocorrências
  - `rg -c "Aviso importante" src/app/\(marketing\)/` → 0 ocorrências (bloquear regressão em todas as 3 páginas)
  - `npm run typecheck` e `npm run lint` passam (páginas JSX alteradas)
- **Feito:** Nenhum arquivo público (markdown ou página JSX) contém o aviso de draft; typecheck/lint verdes.

**Task 2: Escrever Termos de Uso v1.3 (beta freemium)**
- **Arquivo:** `public/docs/legal/terms-of-service-v1-3.md` (novo)
- **Ação:** Partir da estrutura da v1.2 (seções 1-10) aplicando as mudanças da tabela 2.1: créditos como unidade interna/promocional no beta (C1), crédito não é moeda/não transferível/não gera resgate/não é saldo financeiro (C2), consumo apenas quando a campanha for tecnicamente concluída e disponibilizada (C3), recreditamento automático/manual por falha técnica (C4), raiz de CNPJ como critério técnico de elegibilidade promocional e antifraude substituindo "grupo econômico" (C5), §5.3 sem compra (C5a), declaração de autorização para cadastrar a loja vinculada ao CNPJ (C6), responsabilidade do lojista sobre materiais/marcas/imagens/produtos/preços/estoque/ofertas/campanhas (C7), revisão obrigatória de campanhas geradas por IA antes da publicação (C8), §8 substituída por "Funcionalidades Futuras" sem cobrança no beta (G), §7 ajustada para beta sem cobrança. Cabeçalho: `# Termos de Uso — Vendeo`, `**Versão:** v1.3`, `**Data de publicação:** 2026-07-31`. SEM aviso de draft.
- **Verificação:**
  - `rg -n "Versão: v1.3" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -c "grupo econômico" public/docs/legal/terms-of-service-v1-3.md` → 0 (C5)
  - `rg -n "não é moeda|não é transferível|resgate|saldo financeiro" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -n "tecnicamente concluída" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -n "recreditamento|recrédito" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -n "funcionalidade futura|Funcionalidades Futuras" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -n "autorização para cadastrar" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -n "revisad.* antes da publicação|revisão antes da publicação" public/docs/legal/terms-of-service-v1-3.md`
  - `rg -n "Aviso importante" public/docs/legal/terms-of-service-v1-3.md` → 0
- **Feito:** Arquivo criado cobrindo C1-C8 + G; sem "grupo econômico"; sem aviso de draft; cabeçalho v1.3/2026-07-31.

**Task 3: Escrever Política de Privacidade v1.2**
- **Arquivo:** `public/docs/legal/privacy-policy-v1-2.md` (novo)
- **Ação:** Partir da estrutura da v1.1 aplicando as mudanças da tabela 2.2: tabela de suboperadores por categoria (D1) **citando por nome apenas provedores confirmados** — Supabase (autenticação/banco/storage), Vercel (hospedagem), OpenAI (IA) — e categorias genéricas para o restante: "provedores de IA configurados pela Plataforma" (cobre Gemini/Google e provedores futuros; **Anthropic não citado**), "provedores de email transacional" (**Resend não citado**), "ferramentas de observabilidade/analytics", suporte (suporte@vendeo.tech) e pagamento/emissão fiscal como futuro; envio de prompts/imagens/dados da loja/produto-oferta/resultados a provedores de IA (D2); seção de transferência internacional de dados com fundamento LGPD art. 33 (D3) exemplificando apenas provedores confirmados; revisão de categorias/finalidades/bases legais/direitos/retenção/segurança + incidentes de segurança (D4); linguagem de senha corrigida — hash pelo provedor de autenticação (Supabase), Vendeo nunca acessa senha em texto claro (D5); CNPJ tecnicamente correto — nem sempre dado pessoal, pode associar-se a MEI/empresário individual/sócios/responsáveis/contatos, tratamento proporcional, sem "grupo econômico" (D6); §2.4(d) cobrança/nota fiscal como finalidade futura. Cabeçalho: `# Política de Privacidade — Vendeo`, `**Versão:** v1.2`, `**Data de publicação:** 2026-07-31`. SEM aviso de draft.
- **Verificação:**
  - `rg -n "Versão: v1.2" public/docs/legal/privacy-policy-v1-2.md`
  - `rg -n "Supabase" public/docs/legal/privacy-policy-v1-2.md` (autenticação/banco/storage)
  - `rg -n "Vercel" public/docs/legal/privacy-policy-v1-2.md` (hospedagem)
  - `rg -n "OpenAI" public/docs/legal/privacy-policy-v1-2.md` (IA)
  - `rg -n "provedores de IA configurados" public/docs/legal/privacy-policy-v1-2.md` (categoria genérica IA)
  - `rg -n "email transacional" public/docs/legal/privacy-policy-v1-2.md` (categoria genérica email)
  - `rg -n "transferência internacional" public/docs/legal/privacy-policy-v1-2.md`
  - `rg -n "hash" public/docs/legal/privacy-policy-v1-2.md` e `rg -n "texto claro" public/docs/legal/privacy-policy-v1-2.md`
  - `rg -n "MEI" public/docs/legal/privacy-policy-v1-2.md` e `rg -n "dado pessoal" public/docs/legal/privacy-policy-v1-2.md`
  - `rg -n "incidente" public/docs/legal/privacy-policy-v1-2.md`
  - `rg -c "Anthropic" public/docs/legal/privacy-policy-v1-2.md` → 0 (não confirmado)
  - `rg -c "Resend" public/docs/legal/privacy-policy-v1-2.md` → 0 (não confirmado)
  - `rg -c "grupo econômico" public/docs/legal/privacy-policy-v1-2.md` → 0
  - `rg -n "Aviso importante" public/docs/legal/privacy-policy-v1-2.md` → 0
- **Feito:** Arquivo criado cobrindo D1-D6; apenas provedores confirmados citados por nome; sem Anthropic/Resend; sem "grupo econômico"; sem aviso de draft; cabeçalho v1.2/2026-07-31.

**Task 4: Escrever Política de Uso Aceitável v1.1** *(D2 aprovado: criar agora)*
- **Arquivo:** `public/docs/legal/acceptable-use-v1-1.md` (novo)
- **Ação:** Partir da estrutura da v1.0 e adicionar: §2.9 especificando publicidade enganosa (alegações falsas/não comprováveis); §2.10 promoções sem estoque (oferta sem capacidade de atendimento); §2.11 "de/por" sem preço anterior real praticado (CONAR); reforço em §2.5/§5.3 sobre autorização de marcas/imagens; nova seção de categorias sensíveis (saúde, suplementos, bebidas, financeiro, produtos falsificados, política/eleitoral, conteúdo envolvendo menores) com responsabilidade do Lojista pela conformidade regulatória. Manter seções 1-6 da v1.0 (propósito, restrições, conduta, sanções, responsabilidade, gerais). Cabeçalho: `# Política de Uso Aceitável — Vendeo`, `**Versão:** v1.1`, `**Data de publicação:** 2026-07-31`. SEM aviso de draft.
- **Verificação:**
  - `rg -n "Versão: v1.1" public/docs/legal/acceptable-use-v1-1.md`
  - `rg -n "estoque" public/docs/legal/acceptable-use-v1-1.md`
  - `rg -n "de/por" public/docs/legal/acceptable-use-v1-1.md`
  - `rg -n "saúde|suplementos|bebidas|financeiro|eleitoral" public/docs/legal/acceptable-use-v1-1.md`
  - `rg -n "Aviso importante" public/docs/legal/acceptable-use-v1-1.md` → 0
- **Feito:** Arquivo criado cobrindo E; sem aviso de draft; cabeçalho v1.1/2026-07-31.

**Task 5: Microcopy discreta nas telas de campanha**
- **Arquivos:** `src/components/flow/campaign-input-form.tsx`, `src/app/(app)/campanhas/[id]/client.tsx`
- **Ação:**
  - Em `campaign-input-form.tsx`, dentro da div `pt-2 space-y-3` que contém o botão "Criar Campanha" (linha ~535, antes do bloco do botão submit), adicionar um parágrafo discreto de microcopy (texto curto, `text-xs text-text-muted`): _"Use apenas materiais que você tem autorização para divulgar. Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."_
  - Em `src/app/(app)/campanhas/[id]/client.tsx`, perto do botão "Baixar Original" (linha ~359), adicionar microcopy discreta equivalente (ex.: `text-xs text-text-muted`, uma linha): _"Use apenas materiais que você tem autorização para divulgar. Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."_
  - **Texto aprovado pelo usuário** — sem travessão/em dash (padrão ASCII do projeto): "Use apenas materiais que você tem autorização para divulgar. Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."
  - **NÃO** adicionar modais bloqueantes, checkboxes recorrentes por campanha/imagem, nem banners chamativos (decisão F). Apenas texto passivo, não-bloqueante.
- **Verificação:**
  - `rg -n "autorização para divulgar" src/components/flow/campaign-input-form.tsx`
  - `rg -n "autorização para divulgar" "src/app/(app)/campanhas/[id]/client.tsx"`
  - `npm run typecheck` e `npm run lint` passam (sem novos erros nesses arquivos)
- **Feito:** Microcopy presente nos 2 locais, discreta, sem modal/checkbox; typecheck e lint limpos.

### Wave 2 — Catálogo e migration

**Task 6: Atualizar DOCUMENT_CATALOG**
- **Arquivo:** `src/lib/legal/document-content.ts`
- **Ação:** Adicionar ao `DOCUMENT_CATALOG`: em `terms_of_service` a entrada `"v1.3": { filePath: "/docs/legal/terms-of-service-v1-3.md" }`; em `privacy_policy` a entrada `"v1.2": { filePath: "/docs/legal/privacy-policy-v1-2.md" }`; em `acceptable_use` a entrada `"v1.1": { filePath: "/docs/legal/acceptable-use-v1-1.md" }` (D2 aprovado). Manter todas as entradas existentes. Não alterar nenhuma outra função do arquivo.
- **Verificação:**
  - `rg -n "terms-of-service-v1-3" src/lib/legal/document-content.ts`
  - `rg -n "privacy-policy-v1-2" src/lib/legal/document-content.ts`
  - `rg -n "acceptable-use-v1-1" src/lib/legal/document-content.ts`
  - `npm run typecheck` e `npm run lint` passam
  - `npx vitest run src/lib/legal` — testes do módulo legal passam (sem regressão)
- **Feito:** Catálogo resolve as 3 novas versões para os arquivos corretos; testes legais passam.

**Task 7: Migration de publicação das novas versões + artefato interno de revisão jurídica**
- **Arquivo:** `supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` (novo); `.planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/legal-review-notes.md` (novo, interno — D1)
- **Ação:**
  - **Migration:** seguir o padrão de `20260724000003_publish_terms_of_service_v1_1.sql` (INSERT + `ON CONFLICT DO UPDATE` + bloco `-- REVERT` comentado). Inserir em `public.legal_document_versions (document_type, version, summary, effective_at)` com `effective_at = now()` (D5):
    - `('terms_of_service', 'v1.3', 'Beta freemium: créditos promocionais, compra/planos como funcionalidade futura, raiz de CNPJ como critério técnico, responsabilidade e revisão do lojista.', now())`
    - `('privacy_policy', 'v1.2', 'Suboperadores por categoria, provedores de IA, transferência internacional, senha com hash, CNPJ tecnicamente correto.', now())`
    - `('acceptable_use', 'v1.1', 'Publicidade enganosa, promoções sem estoque, de/por sem preço real, categorias sensíveis.', now())`
    - **NÃO incluir** nenhum comentário mencionando revisão jurídica/draft na migration (D1 ajustada — migration entra no histórico do repo e pode vazar contexto indevido).
  - **Artefato interno:** criar `legal-review-notes.md` no diretório do quick task com a lista completa R1-R13 da Seção 6 (pontos pendentes de validação jurídica) e o registro de que os documentos passaram por revisão editorial do time antes de publicação comercial ampla. Este arquivo fica em `.planning/` e NÃO é servido publicamente.
- **Verificação:**
  - `rg -n "'v1.3'|'v1.2'|'v1.1'" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` → 3 linhas
  - `rg -n "ON CONFLICT" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` → presente (idempotente)
  - `rg -n "effective_at" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` → presente
  - `rg -n "REVERT" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` → presente
  - `rg -i -c "jurídic|advogad|draft" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` → 0 (sem cavê na migration)
  - `Test-Path ".planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/legal-review-notes.md"` → True
- **Feito:** Migration idempotente publicando as 3 versões com `effective_at = now()` sem comentários de revisão jurídica; artefato interno `legal-review-notes.md` criado com R1-R13.

### Wave 3 — Validação

**Task 8: Validação automática e manual completa**
- **Arquivos:** nenhum (verificação)
- **Ação:** Executar a suíte completa de validação automática (Seção 5.1), os grep gates (Seção 5.2) e o roteiro manual (Seção 5.3). Corrigir qualquer falha encontrada e re-executar até tudo passar.
- **Verificação:** Todos os comandos da Seção 5 passam; roteiro manual da Seção 5.3 concluído.
- **Feito:** typecheck, lint, build e testes verdes; grep gates limpos; roteiro manual validado.

---

## 5. Critérios de Validação Automática e Manual

### 5.1. Validação automática (obrigatória em toda fase, conforme AGENTS.md)

| Comando | Esperado |
|---------|----------|
| `npm run typecheck` | Sem erros |
| `npm run lint` | Sem erros |
| `npm run build` | Build completo sem falhas |
| `npm test` | Suíte completa passa (base 1345 testes, sem regressão) |
| `npx vitest run src/lib/legal` | Testes do módulo legal passam (document-versions, acceptance-service, privacy, clearance, integration) |

### 5.2. Grep gates

| Checagem | Comando | Esperado |
|----------|---------|----------|
| Sem aviso de draft público | `rg -c "Aviso importante" public/docs/legal/` | 0 |
| Sem "draft preparado" nos markdowns | `rg -c "draft preparado" public/docs/legal/` | 0 |
| Sem aviso hardcoded nas páginas públicas | `rg -c "Aviso importante" src/app/\(marketing\)/` | 0 |
| Sem "draft preparado" nas páginas públicas | `rg -c "draft preparado" src/app/\(marketing\)/` | 0 |
| Sem "grupo econômico" nos novos docs | `rg -c "grupo econômico" public/docs/legal/terms-of-service-v1-3.md public/docs/legal/privacy-policy-v1-2.md` | 0 |
| Provedores não confirmados ausentes na Privacidade | `rg -c "Anthropic" public/docs/legal/privacy-policy-v1-2.md; rg -c "Resend" public/docs/legal/privacy-policy-v1-2.md` | 0 / 0 |
| Catálogo atualizado | `rg -n "v1.3|v1.2|v1.1" src/lib/legal/document-content.ts` | Entradas presentes para os tipos corretos |
| Migration publica tudo | `rg -n "'v1.3'|'v1.2'|'v1.1'" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` | 3 versões |
| Migration sem cavê jurídico | `rg -i -c "jurídic|advogad|draft" supabase/migrations/20260731000004_publish_legal_beta_freemium_versions.sql` | 0 |

### 5.3. Validação manual / visual

| # | Passo | Resultado esperado |
|---|-------|--------------------|
| 1 | Acessar `/termos` | Renderiza Termos de Uso **v1.3** (2026-07-31), **sem aviso de draft** (nem do markdown nem do blockquote hardcoded da página), com linguagem de créditos promocionais e funcionalidades futuras |
| 2 | Acessar `/privacidade` | Renderiza Política de Privacidade **v1.2**, com suboperadores por categoria, IA, transferência internacional e senha com hash; sem aviso de draft |
| 3 | Acessar `/uso-aceitavel` | Renderiza AUP **v1.1** com os novos itens; sem aviso de draft |
| 4 | Verificar fluxo de re-aceite | Conta de lojista existente com aceite v1.2 → status `outdated` para Termos; re-aceite em `/legal/reaccept` registra v1.3 (confirmar no admin: legal badges) |
| 5 | Verificar ciência de privacidade | Usuário logado sem ciência v1.2 → gate de ciência da Política de Privacidade reaparece; ack registra v1.2 |
| 6 | Verificar novo signup | Onboarding registra aceites na versão vigente (v1.3 / v1.2 / v1.1) |
| 7 | Formulário de campanha | Microcopy discreta visível perto de "Criar Campanha" — sem modal, sem checkbox |
| 8 | Página da campanha (`/campanhas/[id]`) | Microcopy discreta visível perto de "Baixar Original" — sem modal, sem checkbox |
| 9 | Legibilidade mobile | Microcopy legível em viewport mobile (não quebra layout do botão) |

---

## 6. Riscos e Pontos para Revisão Jurídica Interna

> ⚠️ **Uso interno apenas.** Este conteúdo NÃO deve aparecer nos documentos públicos, no código ou em migrations (D1: registrado apenas em `.planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/legal-review-notes.md`, criado na Task 7).

| # | Ponto | Nota interna para revisão jurídica |
|---|-------|-------------------------------------|
| R1 | Limitação de responsabilidade §7 no beta | Redação "limitada ao valor pago nos últimos 12 meses" com beta sem cobrança = exposição próxima de zero. Validar coerência (CDC vs B2B) e se convém cláusula específica de beta sem contraprestação financeira |
| R2 | CNPJ e LGPD | CNPJ de PJ nem sempre é dado pessoal; mas pode identificar MEI/empresário individual/sócios/responsáveis/contatos. Confirmar tratamento proporcional e que a redação não cria obrigações além das existentes |
| R3 | "Grupo econômico" → critério técnico | A troca evita definição jurídica de grupo econômico (que tem efeitos trabalhistas/concorrenciais). Confirmar que o critério de raiz de CNPJ não caracteriza discriminação indevida entre lojistas |
| R4 | Transferência internacional (art. 33 LGPD) | Confirmar salvaguardas contratuais com Supabase/OpenAI/Vercel e demais provedores configurados (cláusulas-padrão/adequação) e se a redação genérica é suficiente |
| R5 | Envio de prompts/imagens a provedores de IA | Imagens de produto podem conter pessoas/terceiros. Confirmar base legal (execução de contrato) e se é necessário consentimento adicional para categorias específicas |
| R6 | Crédito "não é moeda / não gera resgate" | Avaliar risco de consumer expectations e classificação como serviço pré-pago (CDC). O modelo de créditos promocionais sem pagamento mitiga, mas a evolução futura para créditos pagos exigirá política comercial própria antes de implementar Stripe (F36) |
| R7 | Consumo de crédito apenas pós-conclusão técnica | Alinhar com implementação real (reserve/refund em `credit_transactions`): recreditamento automático/manual precisa corresponder ao comportamento do sistema; validar com F24/F29.1.1 |
| R8 | AUP "de/por" e promoções sem estoque | Enquadramento CONAR/CDC; enforcement é do Lojista, mas o Vendeo deve ter sanções previstas na AUP para descumprimento (já existem §4) |
| R9 | Categorias sensíveis (saúde, suplementos, bebidas, financeiro, eleitoral) | Setores regulados (ANVISA, CVM/BACEN, TSE). Confirmar se o Vendeo deve bloquear ou apenas sinalizar responsabilidade; política de enforcement |
| R10 | Re-aceite em massa no beta | Todos os beta testers existentes virão `outdated` e serão bloqueados de gerar até re-aceitar. Aceitável no beta, mas comunicar via changelog; validar se deve haver janela de tolerância |
| R11 | Senha/hash (D5) | A redação corrigida evita alegação de acesso indevido a senhas; confirmar com o stack (Supabase Auth armazena hash) |
| R12 | Incidentes de segurança | Nova obrigação de comunicação de incidentes — alinhar com processo operacional real (F28 observabilidade) antes de assumir prazos |
| R13 | Política comercial futura (G) | Redação "funcionalidade futura" não deve criar expectativa contratual; F36 (Stripe) exigirá nova versão dos Termos + política comercial própria |

---

## Resumo da Arquitetura de Mudanças

```
┌──────────────────────────────────────────────────────────────┐
│            Documentos públicos (public/docs/legal/)           │
│  • 6 arquivos existentes: remover aviso de draft (Task 1)     │
│  • 3 páginas JSX (marketing): remover blockquote hardcoded    │
│  • terms-of-service-v1-3.md  (nova — Task 2)                  │
│  • privacy-policy-v1-2.md    (nova — Task 3)                  │
│  • acceptable-use-v1-1.md    (nova — Task 4)                  │
└──────────────────────────┬───────────────────────────────────┘
                           │ filePath
┌──────────────────────────▼───────────────────────────────────┐
│            src/lib/legal/document-content.ts                  │
│  • DOCUMENT_CATALOG + v1.3 terms + v1.2 privacy +             │
│    v1.1 acceptable_use (Task 6)                               │
└──────────────────────────┬───────────────────────────────────┘
                           │ INSERT (idempotente)
┌──────────────────────────▼───────────────────────────────────┐
│  migration 20260731000004_publish_legal_beta_freemium_versions│
│  • legal_document_versions + 3 linhas, effective_at = now()   │
│  • SEM comentário de revisão jurídica (D1 ajustada)           │
│  → getAcceptanceStatus detecta "outdated" → re-aceite         │
│  → privacy.ts detecta ciência v1.2 → re-ciência               │
│    (fluxos automáticos — sem mudança de código)               │
│  ⚠ cavê jurídico: legal-review-notes.md (Task 7, .planning)   │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│            Microcopy (Task 5)                                 │
│  • campaign-input-form.tsx — perto de "Criar Campanha"        │
│  • campanhas/[id]/client.tsx — perto de "Baixar Original"     │
│  • texto ASCII, sem em dash (sem modal, sem checkbox)         │
└──────────────────────────────────────────────────────────────┘
```

---

## PLANNING COMPLETE

**Plan path:** `.planning/quick/260731-qep-adequar-documentos-legais-beta-freemium-/260731-qep-PLAN.md`

**Wave Structure:**

| Wave | Tasks | Description |
|------|-------|-------------|
| 1 | 1–5 | Remover aviso dos 6 documentos + criar Termos v1.3, Privacidade v1.2, AUP v1.1 + microcopy (independentes) |
| 2 | 6–7 | Atualizar DOCUMENT_CATALOG + migration de publicação |
| 3 | 8 | Validação automática (typecheck/lint/build/testes) + manual |

**Decisões:** D2-D7 aprovadas; D1 e D6 ajustadas conforme revisão do usuário (cavê jurídico apenas em `.planning`, provedores somente confirmados). Ver Seção 3.

**Next Step:** Aprovar o plano revisado e executar via `/gsd-execute-phase quick-qep` ou implementar as tarefas em ordem a partir da Wave 1.
