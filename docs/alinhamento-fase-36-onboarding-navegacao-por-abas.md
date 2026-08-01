# Alinhamento Fase 36 — Onboarding: Navegação por Abas (v1.5)

> **Renumeração (esta fase):** F36 = **Onboarding — Navegação por Abas** (nova, v1.5). Stripe / Monetização Pública deslocada para **F37** (v1.7, pós-beta). Atualizado nos trackings: `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                        ✓
  ├── F31.1 — Modelo Comercial — Formulário                       ✓
  ├── F31.2 — Diretores por Intenção                              ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                 ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                              ✓
  ├── F33 — Verificação de CNPJ para Liberação do Freemium        ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)      ✓
  ├── F35 — Changelog / Novidades do Produto (comunicação)        ✓
  └── F36 — Onboarding: Navegação por Abas                        ← esta fase

F37 (Stripe / Monetização Pública) virá depois, na v1.7 (pós-beta).
```

O onboarding de loja do Vendeo é hoje um fluxo de **2 steps** (`StoreIdentityForm`): o Step 1 (dados da loja) precisa **salvar** no banco (POST `/api/store`) para gerar um `storeId` e só então o Step 2 (Direção Visual) é liberado. Isso cria atrito real:

- O lojista que ainda não preencheu o mínimo (nome + segmento + aceite legal) não consegue "espiar" o que vem depois
- Sair da página no meio do Step 1 **perde o que foi digitado** (não há rascunho antes do primeiro `storeId`)
- Não dá para navegar livremente: é um wizard linear com duas telas desconectadas
- O fluxo ignora a camada de **readiness** (F34): CNPJ é exigido no Step 1 mesmo sem bloquear a navegação, e a Direção Visual é apresentada sem contexto de "o que falta para gerar"
- O **aceite legal** é "mais um checkbox perdido no formulário", sem status visível (pendente / aceito / reaceite)
- **Beta testers usam celular**: abandono real (fechar aba, alternar app, o browser descarregar a página) é comum — o rascunho precisa sobreviver a isso, não só a refresh na mesma aba

**Oportunidade:** transformar o onboarding em um painel de **3 abas** — Dados / Posicionamento / Direção Visual — com desbloqueio progressivo, auto-save, estados claros por aba e o **aceite legal elevado a uma coluna lateral global** (condição visível do estado da loja). Navegar no onboarding não deve exigir loja pronta; **gerar campanha** deve (gates da F34 preservados). E o rascunho deve sobreviver ao abandono mobile via `localStorage` com TTL curto.

---

## Propósito

1. **3 abas no lugar de 2 steps** — Dados, Posicionamento, Direção Visual. Mesma rota `/loja`, agora com navegação por abas (URL `?tab=`)
2. **Três conceitos separados** — **avanço** (o que destrava a próxima aba), **qualidade da identidade** (campos recomendados que melhoram o resultado) e **permissão de gerar** (gates que autorizam gerar)
3. **Desbloqueio progressivo** — abas nascem bloqueadas e liberam quando a anterior tiver o mínimo válido; o usuário é guiado, nunca vê tela vazia à toa
4. **Aceite legal como coluna lateral global** — fora da aba Dados, com estados `Pendente / Aceito / Reaceite necessário`, responsivo; sem aceite, a aba Posicionamento fica bloqueada com motivo claro
5. **Auto-save inteligente** — salva confiavelmente ao trocar de aba e ao navegar internamente; abandono mobile (fechar/reload/background) é protegido por **`localStorage` com TTL curto**, escrito de forma síncrona via `pagehide`/`visibilitychange`
6. **Soft-block, não estrito** — CNPJ não bloqueia a navegação; fica como pendência de readiness ("Fiscal pendente") e bloqueia **geração/crédito** (não onboarding). Só **tom de voz** é obrigatório para liberar a aba Direção Visual (loja nova)
7. **Campos recomendados** — posicionamento, descrição e slogan continuam opcionais, com card informativo curto; melhoram o resultado sem bloquear o fluxo
8. **Estados por aba (badges simplificados)** — `Bloqueada` / `Rascunho` / `Salva` / `Pronta` / `Pendente para gerar`, com motivo específico no painel (não dentro do botão da aba, principalmente no mobile)
9. **Gates de geração preservados** — sem CNPJ/fiscal válido, sem direção visual (brand profile syncado) ou sem aceite legal → não gera campanha **e não concede crédito freemium** (regras da F32/F33/F34 intactas)
10. **Redirects e banners migrados** — todos os pontos que apontam para `/loja` com `required=` passam a usar `?tab=` + mensagem contextual

**Entrega verificável:**
- `/loja` com 3 abas navegáveis (ARIA tabs), desbloqueio progressivo e estados por aba
- Coluna lateral global de aceite legal (estados + responsividade + bloqueio de Posicionamento quando pendente)
- Rascunho `localStorage` com TTL 24h escopado por usuário, limpo após primeiro save/logout; sobrevive a fechar aba e alternar app no mobile
- Auto-save confiável em troca de aba e navegação interna; escrita síncrona de draft via `pagehide`/`visibilitychange` no abandono
- URL `?tab=dados|posicionamento|direcao-visual` com deep-link (back/forward funcionam)
- Redirects: `/campanhas/nova`, `/cadastro/cnpj`, `ReadinessBanner` migrados para `?tab=` (sem quebrar mensagens contextuais)
- Gates de geração inalterados (regressão F32/F33/F34)
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F35)

```
                                    ANTES (F35)                      DEPOIS (F36)
═══════════════════════════════════════════════════════════════════════════════════════════════

Navegação:
  Estrutura                        wizard linear 2 steps           painel de 3 abas
  URL                              /loja (step interno)            /loja?tab=dados|posicionamento|direcao-visual
  Troca de aba                     exige salvar Step 1            desbloqueio progressivo + auto-save
  Back/forward                     não funciona (estado interno)   funciona (?tab= no history)

Aceite legal:
  Local                            checkbox dentro do Step 1       coluna lateral global (Pendente/Aceito/Reaceite)
  Efeito no avanço                 válido no submit                sem aceite → Posicionamento bloqueado
  Status visível                   inexistente                    estados visíveis + responsivo

Step 2 (Direção Visual):
  Acesso                           só após storeId salvo          liberado com tom de voz (loja nova)
  Contexto readiness               "Direção Visual (necessário)"  estados por aba + pendências visíveis

CNPJ:
  No onboarding                    obrigatório no Step 1          não bloqueia navegação (pendência readiness)
  Na geração/crédito               obrigatório (F32/F33)          obrigatório — bloqueia geração e crédito (inalterado)

Rascunho (persistência):
  Antes do 1º storeId              nada é salvo (perde ao sair)    localStorage TTL 24h — chave :new, depois :${storeId}
  Refresh na mesma aba             perde                          restaura draft (e reconcilia com o banco)
  Fechar aba / alternar app        perde                          pagehide/visibilitychange → grava síncrono
  Após 1º save                     —                              limpa a chave de draft
  Logout                           —                              limpa a chave de draft

Auto-save:
  Troca de aba                     inexistente                    auto-save confiável antes de navegar
  Navegação interna                inexistente                    auto-save confiável antes de sair
  Unload/PATCH no fechamento       —                              apenas best-effort (não prometido)

Estados por aba:
  Definição                        inexistente                    Bloqueada / Rascunho / Salva /
                                                                  Pronta / Pendente para gerar
                                                                  + motivo no painel (não no botão da aba)

Redirects:
  /campanhas/nova                  required=cadastro-fiscal       ?tab=dados + message=needs-fiscal
                                   required=visual-direction      ?tab=direcao-visual + message (se liberado)
  /cadastro/cnpj                   ?required=cadastro-fiscal      ?tab=dados&fiscal=pending
  ReadinessBanner                  /loja?required=...             /loja?tab=... (manter mensagem)

Drift:
  Interceptação                    apenas step === 2              troca de aba + navegação interna interceptadas
```

---

## Realinhamento de Escopo (vs. discussão inicial)

### O que muda

| Item | Discussão inicial | Realinhado (F36) |
|------|-------------------|------------------|
| **Estrutura** | Wizard 2 steps | 3 abas: Dados / Posicionamento / Direção Visual |
| **Bloqueio de navegação** | Estrito (uma aba tranca a outra) | **Soft-block**: desbloqueio progressivo com mínimo válido; usuário nunca é "preso" — vê a próxima aba bloqueada com o motivo |
| **Bloqueio de geração** | Questionado se relaxar | **Preservado integralmente** (F32/F33/F34): CNPJ/fiscal, brand profile syncado, aceite legal, créditos |
| **Conceitos** | Tratados como um só "bloqueio" | **Separados em 3**: avanço (abas) × qualidade da identidade (campos recomendados) × permissão de gerar (gates) |
| **Aceite legal** | Checkbox dentro do Step 1 | **Coluna lateral global** (D3), requisito para liberar Posicionamento |
| **CNPJ no onboarding** | Obrigatório (F32) | Não bloqueia navegação — vira **pendência de readiness**; bloqueia **geração/crédito** |
| **Regra mínima p/ liberar Direção Visual** | Discutido tom + posicionamento | **Só tom de voz obrigatório** (decisão do Q&A). Posicionamento/descrição/slogan opcionais com card informativo |
| **Auto-save** | Considerado apenas no submit | Troca de aba + navegação interna = auto-save confiável; abandono (reload/fechar/background) = **localStorage TTL** escrito síncrono via `pagehide`/`visibilitychange`; PATCH no unload best-effort |
| **Rascunho pré-storeId** | `sessionStorage` (refresh na mesma aba) | **`localStorage` com TTL curto (24h), escopado por usuário** — sobrevive a abandono mobile real; limpo após 1º save/logout |
| **URL** | `initialStep` via `required=` | `?tab=` real (substitui o hack `initialStep`) |
| **Redirects/banners** | Fora do escopo | **Incluídos na F36** (decisão do Q&A) |
| **Billing** | Considerado aba própria | **Colapsado na aba Dados**, opcional (como hoje no Step 1) |
| **Badges por aba** | Muitos estados, dentro do botão | **Simplificados** (5 rótulos); motivo no painel ativo, não no botão da aba (mobile) |
| **Renumeração** | Manter Stripe como F36 | Stripe → **F37**; esta fase ocupa a **F36** (decisão do Q&A) |

---

## Decisões de Alinhamento

### D1 — Três abas desbloqueáveis em sequência

`DECIDIDO`

```
┌──────────────────────────────────────────────────────────────────────────┐
│  /loja                                                                   │
│                                                                          │
│  ┌──────────────┬──────────────────┬───────────────────────────────┐    │
│  │  ① Dados    │  ② Posicionamento │  ③ Direção Visual              │    │
│  │  ✓ Pronta    │  🔒 Bloqueada      │  🔒 Bloqueada                  │    │
│  └──────────────┴──────────────────┴───────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────┐   ┌───────────────────┐   │
│  │  Aba Dados (ativa)                        │   │  Aceite legal     │   │
│  │  ────────────────────────────────────────  │   │  (coluna lateral) │   │
│  │  • Nome fantasia • CNPJ (fiscal)           │   │  ⚠ Pendente       │   │
│  │  • Segmento • Subsegmento                  │   │  Termos de Uso    │   │
│  │  • Cidade/UF                               │   │  Política Priv.   │   │
│  │                                           │   │  [Revisar e aceitar]│   │
│  │  Billing (colapsado, opcional)             │   └───────────────────┘   │
│  │                                           │                        │
│  │  [Próximo: Posicionamento →]              │                        │
│  └──────────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────────┘
```

**Estrutura das abas:**

| Aba | Conteúdo | Desbloqueia quando (loja nova) |
|-----|----------|--------------------------------|
| **① Dados** | Nome, CNPJ/fiscal (BrasilAPI + manual), segmento, subsegmento, cidade/UF, billing colapsado. **Aceite legal fica na coluna lateral global** (D3), não dentro da aba | Aberta por padrão |
| **② Posicionamento** | Tom de voz, posicionamento, descrição curta, slogan (+ card informativo de campos recomendados) | Nome + segmento + **aceite legal aceito** válidos E loja criada via auto-save (mínimo para criar a loja) |
| **③ Direção Visual** | Logo, assinatura visual, cores, preview (3 caminhos da F34) | **Apenas tom de voz preenchido** (regra mínima escolhida) |

**Para loja existente:** o estado de desbloqueio é calculado dos dados salvos + edições locais (não é puramente sequencial — se a loja já tem direção visual, a aba ③ já nasce aberta).

**Bloqueio de progressão (avanço):** Dados → Posicionamento exige nome + segmento + aceite legal. CNPJ **não** bloqueia (vira pendência de readiness). Posicionamento → Direção Visual exige apenas tom de voz.

---

### D2 — Três conceitos separados: avanço × qualidade × permissão de gerar

`DECIDIDO`

O onboarding deixa de ter um único conceito de "bloqueio". São **três dimensões independentes**, cada uma com regra e UI própria:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  AVANÇO                    QUALIDADE DA IDENTIDADE                       │
│  (o que destrava a próxima  (o que melhora o resultado)                  │
│  aba)                                                                    │
│  ────────────────────────── ────────────────────────────                 │
│  • nome + segmento +        • subsegmento, cidade/UF                    │
│    aceite legal → ②         • posicionamento, descrição,                │
│  • tom de voz → ③             slogan                                    │
│  • bloco seco e pequeno     • opcionais, card informativo               │
│    (regra mínima)             curto (D9)                                 │
│                                                                          │
│  PERMISSÃO DE GERAR                                                     │
│  (o que autoriza gerar campanha — gates F34)                            │
│  ────────────────────────────                                           │
│  • CNPJ/fiscal válido (exceto loja teste)                               │
│  • brand profile syncado (direção visual salva)                          │
│  • aceite legal vigente                                                  │
│  • créditos disponíveis                                                  │
│  • bloqueia a geração, NUNCA a navegação                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

| Dimensão | Regra | Impacto | Onde aparece na UI |
|----------|-------|---------|--------------------|
| **Avanço** | Mínimo da aba anterior válido (D1) | Controla o que dá para **navegar** | Bloqueio das abas + motivo no painel |
| **Qualidade da identidade** | Campos recomendados, sem bloqueio (D9) | Melhora o resultado da arte | Card informativo "recomendado" |
| **Permissão de gerar** | Gates da F34 (readiness RPC + guarda dupla) | Controla se dá para **gerar campanha** | Estados `Pendente para gerar` + banners |

**Princípio:** *navegar no onboarding não deve exigir loja pronta; gerar campanha deve.* E preencher mais campos de identidade deve ser um incentivo, não uma exigência.

---

### D3 — Aceite legal como coluna lateral global

`DECIDIDO`

O aceite sai da aba Dados e vira uma **coluna lateral global** na página `/loja`, acompanhando todas as abas — é uma condição do estado da loja, não um campo do formulário.

**Layout responsivo:**

```
DESKTOP                                          MOBILE
┌─────────────────────────────┐   ┌───────────────────────────────┐
│  Abas                        │   │  Abas                          │
│  ┌────┬──────┬─────┐         │   │  ┌────┬──────┬─────┐          │
│  │ ①  │  ②  │  ③  │         │   │  │ ①  │  ②  │  ③  │          │
│  └────┴──────┴─────┘         │   │  └────┴──────┴─────┘          │
│  ┌─────────────────────┐     │   │  ┌─────────────────────┐      │
│  │  Conteúdo da aba    │     │   │  │  Conteúdo da aba    │      │
│  └─────────────────────┘     │   │  └─────────────────────┘      │
│                               │   │  ┌─────────────────────┐      │
│  ┌─────────────────────┐     │   │  │  Aceite legal (bloco │      │
│  │  Aceite legal        │     │   │  │  compacto no topo ou│      │
│  │  (coluna lateral     │     │   │  │  antes do CTA)      │      │
│  │  sticky no conteúdo) │     │   │  │  ⚠ Pendente         │      │
│  │  ⚠ Pendente          │     │   │  │  [Revisar]          │      │
│  │  [Revisar e aceitar] │     │   │  └─────────────────────┘      │
│  └─────────────────────┘     │   └───────────────────────────────┘
└─────────────────────────────┘   (sem sticky persistente — não
                                   roubar espaço em tela pequena)
```

**Regras:**
- **Desktop:** **coluna lateral sticky dentro do conteúdo** (acompanha o scroll da página, não sai de tela). Não é "card fixo" sobreposto — participa do grid/layout do conteúdo
- **Mobile:** **bloco compacto no topo da aba ou antes do CTA** — sem sticky persistente, porque sticky em tela pequena rouba espaço precioso
- **Estados:** `Pendente` / `Aceito` / `Reaceite necessário` (estes vêm do `legalClearance` da F30)
- **Bloqueio de avanço:** se não aceito (Pendente ou Reaceite necessário), a aba **Posicionamento fica bloqueada** com motivo claro: `falta aceite legal` — com link para abrir o card de aceite
- **Permissão de gerar:** sem aceite vigente, não gera (gate da F34 inalterado)
- O card usa o contrato/modal de aceite existente da F30 (`ContractAcceptanceModal`) — apenas reposicionado e com estado visível

**Por que fora da aba Dados:** o aceite deixa de ser "mais um checkbox perdido" e vira uma condição visível do estado da loja. O lojista sempre vê o status, independente da aba em que está.

---

### D4 — Auto-save e eventos de saída

`DECIDIDO`

O formulário salva sozinho em dois momentos **confiáveis** e trata o abandono de forma **explícita e realista** (especialmente em mobile):

| Momento | Mecanismo | Confiabilidade |
|---------|-----------|----------------|
| **Troca de aba** | `autoSave()` silencioso (PATCH ou criação da loja) antes de navegar | **Alta** — o save é disparado e aguardado |
| **Navegação interna** (dashboard, campanhas, conta — cliques dentro do app) | Intercepta a navegação e roda `autoSave()` antes | **Alta** — navegação interna é interceptável |
| **Reload / fechar aba / background (mobile)** | **Grava o draft de forma síncrona no `localStorage` via `pagehide`/`visibilitychange`** (proteção principal) | **Alta** — escrita síncrona não é abortada pelo browser |
| **PATCH no `unload`** | fire-and-forget se já existe `storeId` | **Best-effort** — `unload` é pouco confiável em mobile; pode ser abortado. **Não é prometido** |

**Regras:**
- Persiste **apenas campos válidos** — campos inválidos não bloqueiam o save (são ignorados)
- Se o save falhar → estado "Não salvo" explícito (badge na aba + toast de erro), sem bloquear a navegação
- Quando já existe `storeId` → PATCH silencioso via `useStoreForm.save()` (mesmo endpoint da F19)
- **Antes do primeiro `storeId` não se cria loja prematuramente** — o draft vai para o `localStorage` (D5)
- **Abandono (reload/fechar/background):** `beforeunload` é pouco confiável em mobile — a **proteção real é o `localStorage`** escrito de forma síncrona em `pagehide`/`visibilitychange`. O PATCH assíncrono no fechamento é `best-effort`: tenta, mas não é prometido
- **Direção Visual mantém botão Salvar explícito** (é a aba que consome créditos/upload — save implícito não é suficiente ali)

**Fluxo do save ao sair da aba Dados (navegação interna):**

```
Usuário clica "Posicionamento"
        │
        ▼
tem nome + segmento + aceite legal?
   ├── NÃO → mantém draft no localStorage, navega para aba (bloqueada)
   └── SIM → POST /api/store (cria loja) ──► storeId
              │                                 │
              │   sucesso                        │  falha
              ▼                                 ▼
      estado "Salva ✓"                    estado "Não salvo" (badge + toast)
      limpa draft localStorage             permanece na aba ①, dados preservados
      desbloqueia aba ②
```

**Abandono mobile (fluxo de proteção):**

```
Usuário alterna app / fecha aba / reload
        │
        ▼
pagehide / visibilitychange → localStorage.setItem SÍNCRONO  ← proteção principal
        │
        ▼
se storeId existe → fire-and-forget PATCH (best-effort, pode ser abortado)
        │
        ▼
ao reabrir /loja → restaura draft do localStorage (se dentro do TTL)
                    e reconcilia com o que o banco tem
```

---

### D5 — Rascunho persistente: `localStorage` com TTL escopado por usuário

`DECIDIDO`

Antes de existir `storeId`, nenhum dado vai ao banco. O draft fica em **`localStorage` com TTL curto** — escolha feita porque os beta testers usam celular e o abandono real (fechar aba, alternar app, browser descarregar a página) é comum; `sessionStorage` só sobrevive a refresh na mesma aba.

- **Chave:** escopada por usuário, com sufixo explícito para loja:
  - antes do primeiro save: `vendeo:store_draft:${userId}:new`
  - depois de existir loja: `vendeo:store_draft:${userId}:${storeId}`
  - Isso evita colisão futura se o produto evoluir para multi-loja (o draft nunca cruza contas nem lojas)
- **TTL:** **24 horas** (a partir da última edição). Valores antigos são ignorados no restore e removidos
- **Escopo:** o sufixo `:new` / `:${storeId}` garante que o draft de uma loja nunca restaura em outra
- **Escrita:** a cada campo editado (debounce ~400ms) **e** de forma síncrona em `pagehide`/`visibilitychange` (abandono)
- **Limpeza:** chave removida **após o primeiro save que cria a loja** e **no logout**
- **Restauração:** ao abrir `/loja`, restaura se dentro do TTL e reconcilia com o que o banco tem (se `storeId` já existe)
- **Migração:** no primeiro auto-save que cria a loja, o draft é lido uma vez, escrito no form e a chave é limpa

**Por que localStorage e não sessionStorage:**

```
              localStorage (TTL 24h)     sessionStorage
              ────────────────────       ─────────────
Refresh       ✓ restaura                 ✓ restaura
Fechar aba    ✓ restaura (TTL)           ✗ perde
Alternar app  ✓ restaura (TTL)           ✗ perde (browser pode descarregar)
Voltar dias depois  ✗ ignora (TTL)       ✗ não existe (era efêmero)
Risco de "draft velho"   mitigado pelo TTL  — (nem chegava a existir)
```

**Compromisso:** o TTL de 24h evita que um rascunho abandonado "ressuscite" semanas depois com dados velhos, mas dá ao lojista mobile a janela de um dia para retomar o onboarding de onde parou. Persistência cross-device é futura (exigiria back-end).

---

### D6 — URL `?tab=` (substitui o hack `initialStep`)

`DECIDIDO`

```
/loja?tab=dados
/loja?tab=posicionamento
/loja?tab=direcao-visual
```

- O `StorePageClient` hoje mapeia `required=visual-direction` → `initialStep=2`. Isso vira parsing de `?tab=` → aba inicial
- `useSearchParams` lê a aba; a aba ativa vive no history (back/forward funcionam)
- **Aba bloqueada via deep-link:** o usuário cai na aba solicitada; se bloqueada, vê a aba com o bloqueio e um link "Voltar para X" — nunca tela em branco
- O parâmetro legado `required=` continua aceito nesta fase (compatibilidade), mas o `ReadinessBanner`/redirects passam a emitir `?tab=`

**Mapeamento de redirects:**

| Origem | Antes (F34) | Depois (F36) |
|--------|-------------|--------------|
| `/campanhas/nova` sem CNPJ | `/loja?required=cadastro-fiscal&returnTo=/campanhas/nova` | `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova` |
| `/campanhas/nova` sem direção visual | `/loja?required=visual-direction&returnTo=/campanhas/nova` | `/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=/campanhas/nova` (cai na ③; se bloqueada → ② com aviso) |
| `/cadastro/cnpj` | `/loja?required=cadastro-fiscal` | `/loja?tab=dados&fiscal=pending` |
| `ReadinessBanner` (dashboard) | `/loja?required=...` | `/loja?tab=<aba da pendência>&message=<pendência>` |

---

### D7 — Estados por aba (badges simplificados)

`DECIDIDO`

Cada aba tem **um único estado dominante** — poucos rótulos, sem poluir. A lógica é derivada de função pura `computeTabState(tab, formData, store, readiness)` — testável sem UI.

| Estado | Significado | Badge |
|--------|-------------|-------|
| **Bloqueada** | Aba ainda não destravada (mínimo da anterior não atendido) | `Bloqueada` |
| **Rascunho** | Há edição local ainda não persistida | `Rascunho` |
| **Salva** | Última versão persistida | `Salva ✓` |
| **Pronta** | Aba válida (mínimo de progressão atendido) — destrava a próxima | `✓ Pronta` |
| **Pendente para gerar** | Readiness incompleta que não bloqueia navegação mas bloqueia geração | `⚠ Pendente para gerar` |

**Motivo específico — no painel ativo, NÃO dentro do botão da aba:**

```
Tablist (compacta):                        Painel ativo (aba ③):
┌──────────────┬──────────────┬─────────┐   ┌─────────────────────────────┐
│ ① Dados ✓   │ ② Perfil  🔒  │ ③ Visual 🔒│  │  Direção Visual            │
└──────────────┴──────────────┴─────────┘   │  ─────────────────────────── │
                                            │  🔒 Aba bloqueada            │
                                            │  Falta tom de voz            │
                                            │  (preencha na aba Perfil)    │
                                            │  [Ir para Posicionamento]    │
                                            └─────────────────────────────┘
```

| Motivo | Exibido no painel de | Derivado de |
|--------|----------------------|-------------|
| `Falta aceite legal` | Aba ② | `legalClearance` (F30) + aba anterior válida |
| `Falta tom de voz` | Aba ③ | campo `tone_of_voice` vazio |
| `Falta direção visual` | Dashboard/`Pendente para gerar` | `brand_profile.status !== "synced"` (F34) |
| `Fiscal pendente` | Aba ① (badge) + painel | readiness `cadastro_fiscal` incompleto (F34) |

**Regra de prioridade:** se dois estados aplicam, mostra o de maior severidade: `Pendente para gerar` > `Bloqueada` > `Rascunho` > `Pronta` > `Salva`. A aba Direção Visual ainda mostra o badge "Necessário" da F34 quando o brand profile não está syncado.

---

### D8 — CNPJ: não bloqueia onboarding; bloqueia geração/crédito

`DECIDIDO`

- No onboarding, CNPJ **não bloqueia** a navegação entre abas. A aba Dados mostra "Fiscal pendente" quando CNPJ/razão/nome fantasia estão ausentes
- O lojista pode avançar até a Direção Visual **sem** CNPJ
- **Na geração e na concessão de crédito** o CNPJ continua obrigatório (guard da F34 + readiness RPC + regras de freemium da F32/F33) — exceto **loja de teste/experimental** (`is_test_store` da F33), que segue isenta conforme regra administrativa
- BrasilAPI/CNPJá continuam preenchendo razão social e nome fantasia automaticamente; se falharem, o preenchimento manual permanece disponível
- Feedback ao usuário: ao tentar gerar sem fiscal, o banner aponta para `/loja?tab=dados&fiscal=pending` (mesma mensagem de hoje, novo target)

---

### D9 — Regra mínima para liberar a Direção Visual: só tom de voz + campos recomendados

`DECIDIDO` (Q&A — "Só tom de voz obrigatório")

Para **loja nova**, a aba ③ Direção Visual desbloqueia com **apenas o tom de voz preenchido** na aba ②. Posicionamento, descrição curta e slogan são **opcionais e recomendados**.

**Por quê:**
- O tom de voz é o campo que o diretor visual de fato consome para gerar a assinatura (`brand-profiler` / `identity-art-director` leem `tone_of_voice`, `subsegment`, `positioning`, `short_description`, `slogan`)
- Exigir posicionamento completo era sobrecarga para destravar o que é essencialmente uma etapa visual
- Os campos opcionais continuam disponíveis na aba ② e **enriquecem** a direção visual quando preenchidos (melhor resultado, não requisito) — dimensão **qualidade da identidade** (D2)

**Card informativo na aba Posicionamento** (texto curto e operacional, no topo ou logo abaixo do tom de voz, com destaque leve — sem "aula"):

> Essas informações ajudam o Vendeo a criar artes com linguagem, estilo e argumentos mais próximos da sua loja.

| Campo | Obrigatório? | Efeito |
|-------|--------------|--------|
| **Tom de voz** | ✅ Sim (destrava ③) | Direção da linguagem da arte |
| Posicionamento | ○ Recomendado | Argumentos comerciais |
| Descrição curta | ○ Recomendado | Contexto da loja |
| Slogan | ○ Recomendado | Ponto de apoio visual |

**Para loja existente:** se já há direção visual salva, a aba ③ nasce aberta (não re-aplica a regra de tom de voz).

---

### D10 — Abas no mobile: compactas, motivo fora do botão

`DECIDIDO`

Três abas com badge + motivo completo dentro do botão apertam em tela de celular. Regras mobile:

```
┌──────────────────────────────────────────────┐
│  ┌────────┬──────────┬────────┐             │
│  │ Dados  │ Perfil 🔒 │ Visual 🔒│  ← tabs   │
│  └────────┴──────────┴────────┘    compactas│
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  Perfil                               │  │
│  │  🔒 Aba bloqueada — falta tom de voz  │  │  ← motivo no
│  └──────────────────────────────────────┘  │     painel ativo
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  [ Continuar ]                        │  │  ← botão inferior sempre
│  └──────────────────────────────────────┘  │     visível (avança/retrocede)
└──────────────────────────────────────────────┘
```

- **Tabs compactas horizontais:** `Dados`, `Perfil`, `Visual` (rótulos curtos; "Perfil" = Posicionamento, "Visual" = Direção Visual)
- **"Perfil"/"Visual" são APENAS label responsivo** — o `id` da aba continua `posicionamento` / `direcao-visual` em testes, analytics, query param e código. Sem segundo vocabulário conceitual; só a string exibida muda por viewport
- **Badge pequeno por estado** (ponto/ícone discreto no canto da aba) — não o texto completo do motivo
- **Motivo exibido abaixo da tablist ou no painel ativo** — nunca dentro do botão da aba
- **Botão inferior "Continuar" sempre visível no fluxo**, além do toque direto nas abas (avança para a próxima liberada ou retrocede) — área de toque confortável e caminho claro
- Touch targets ≥ 44px (herdado da F22)

**No desktop,** as abas podem carregar o rótulo completo (Dados / Posicionamento / Direção Visual) e o motivo continua no painel.

---

### D11 — Acessibilidade (ARIA tabs)

`DECIDIDO`

Implementar o padrão WAI-ARIA **Tabs**:

- `role="tablist"` / `role="tab"` / `role="tabpanel"` + `aria-selected` e `aria-controls`
- Roving tabindex: só o tab ativo é tabulável; setas ← → (e Home/End) movem o foco
- `aria-describedby` no tab bloqueado apontando para a explicação do bloqueio (que vive no painel ativo)
- Estados das abas (bloqueada/pronta/pendente) expostos via `aria-label` (não só cor)
- Touch targets ≥ 44px (mobile-first, herdado da F22)
- Anúncio de mudança de estado via `aria-live` na região da aba
- Aceite legal: estados expostos via `aria-label` e `aria-pressed`/`aria-expanded` no acionador

---

### D12 — Migração dos redirects/banners existentes

`DECIDIDO` (Q&A — "Incluir redirects/banners")

Escopo da F36 inclui a migração de todos os pontos que apontam para `/loja`:

| Ponto | Arquivo (ref.) | Mudança |
|-------|----------------|---------|
| Guard `/campanhas/nova` | `src/app/(app)/campanhas/nova/page.tsx` | `required=` → `?tab=` + `message=` |
| Redirect `/cadastro/cnpj` | `src/app/(app)/cadastro/cnpj/page.tsx` | → `/loja?tab=dados&fiscal=pending` |
| `ReadinessBanner` | `src/components/readiness/readiness-banner.tsx` | links → `?tab=` da pendência, mantendo a mensagem contextual |
| Query param legado | `store-page-client.tsx` | continua aceitando `required=` (compat) mapeando para a aba correspondente |

Nenhuma mensagem contextual é perdida: `fiscal=pending`, `message=needs-visual-direction` são lidos pelo `/loja` e exibidos como banner informativo na aba alvo.

---

### D13 — Drift detection integrada à navegação por abas

`DECIDIDO`

A interceptação de drift hoje (`use-drift-detection`) só dispara em `step === 2`. Com abas:

- Dispara na **troca de aba** com alterações não salvas (rascunho ativo) na aba de origem — antes de navegar, pergunta "Salvar alterações?"
- Dispara na **navegação interna de saída** com rascunho ativo — o auto-save (D4) roda primeiro; se falhar, oferece "sair mesmo assim" (perde) ou "voltar"
- **Abandono (reload/fechar/background):** a escrita síncrona do draft via `pagehide`/`visibilitychange` (D4/D5) cobre o caso; sem modal — o dado não se perde
- O modal de drift existente é reutilizado, apenas ampliado para o caso "troca de aba"

---

### D14 — Renumeração F36/F37

`DECIDIDO` (Q&A — "Renumeração: aplicar já nos trackings")

| Antes | Depois |
|-------|--------|
| F36 = Stripe / Monetização Pública (v1.5) | **F36 = Onboarding — Navegação por Abas** (v1.5) |
| — | **F37 = Stripe / Monetização Pública** (v1.7, pós-beta) |

Aplicado nos trackings: `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` (seção v1.7), `.planning/MILESTONES.md`. Artefatos históricos (alinhamentos F30/F32/F33/F34/F35, quick-plans) não são reescritos — refletem o estado da época.

---

```
ARQUIVOS MODIFICADOS (principais):
═══════════════════════════════════════════════════════════════

src/components/flow/store-identity-form.tsx
  ← Refatoração central: useState<1 | 2> → estado de abas
  ← <Tabs> com ARIA (D11), estados por aba (D7), mobile compacto (D10)
  ← Aceite legal removido do formulário (vira coluna lateral — D3)
  ← Gatilhos de auto-save (D4) + rascunho localStorage (D5)

src/components/flow/store-page-client.tsx
  ← parsing ?tab= → aba inicial (D6)
  ← compat com required= legado
  ← leitura de message=/fiscal= para banner contextual

src/components/flow/use-store-form.ts
  ← método autoSave() (silencioso, só campos válidos) reutilizando save()
  ← método saveDraft() / restoreDraft() (delega ao draft store — D5)

src/components/flow/use-drift-detection.ts
  ← intercepta troca de aba + navegação interna com rascunho ativo (D13)

src/components/flow/legal-acceptance-panel.tsx
  ← NOVO: coluna lateral global de aceite legal (D3) — estados
     Pendente/Aceito/Reaceite + responsivo + bloqueio de avanço

src/components/flow/store-tabs.tsx
  ← NOVO: container ARIA tabs + variante mobile compacta (D10)

src/components/readiness/readiness-banner.tsx
  ← links ?tab= (D12)

src/app/(app)/campanhas/nova/page.tsx
  ← redirect ?tab= + message= (D12)

src/app/(app)/cadastro/cnpj/page.tsx
  ← redirect /loja?tab=dados&fiscal=pending (D12)


ARQUIVOS NOVOS (propostos — refinados no planejamento OpenSpec):
═══════════════════════════════════════════════════════════════

src/lib/store-onboarding/
  tabs.ts               ← definição das 3 abas + regras de desbloqueio (D1)
  tab-state.ts          ← computeTabState puro (D7) + computeTabUnlock
  draft-store.ts        ← rascunho localStorage com TTL (D5): chave por user,
                          escrita síncrona pagehide/visibilitychange, limpeza
                          após 1º save/logout, restore + reconciliação
  __tests__/            ← testes unitários da máquina de abas + draft TTL

src/hooks/
  use-onboarding-tabs.ts   ← estado de aba + gatilhos de auto-save (D4/D6/D13)
```

---

## Contratos de Integração

### Tipos

```typescript
// src/lib/store-onboarding/tabs.ts

export type OnboardingTab = "dados" | "posicionamento" | "direcao-visual";

// D7 — estado único dominante por aba
export type TabState =
  | { status: "blocked" }                // Bloqueada
  | { status: "draft" }                  // Rascunho
  | { status: "saved" }                  // Salva
  | { status: "ready" }                  // Pronta
  | { status: "pending_generation" };    // Pendente para gerar

// Motivos de bloqueio/estado — exibidos no painel ativo, não no botão da aba (D10)
export type TabBlockReason =
  | "needs_legal_acceptance"   // falta aceite legal (D3)
  | "needs_tone_of_voice"      // falta tom de voz (D9)
  | "needs_store_created"      // aguarda auto-save criar a loja
  | "fiscal_pending";          // readiness fiscal incompleta (D8)

export interface OnboardingTabDef {
  id: OnboardingTab;
  label: string;             // "Dados" | "Posicionamento" | "Direção Visual"
  labelMobile: string;       // APENAS label responsivo: "Dados" | "Perfil" | "Visual" (D10).
                             // id da aba (posicionamento/direcao-visual) NÃO muda — query param,
                             // testes e analytics usam o id, nunca o label
  requiredForNext: TabField[];  // campos do mínimo de progressão
}

// D1 — regras de desbloqueio (loja nova)
export const TAB_ORDER: OnboardingTab[] = [
  "dados",
  "posicionamento",
  "direcao-visual",
];

// Dados → Posicionamento: nome + segmento + aceite legal (loja criada)
// Posicionamento → Direção Visual: apenas tom de voz
// Retorna unlocked + o motivo, para a UI exibir no painel (não boolean solto)
export function computeTabUnlock(
  tab: OnboardingTab,
  ctx: { form: StoreFormData; storeId: string | null;
         legalAcceptance: LegalAcceptanceState; hasVisualDirection: boolean }
): { unlocked: boolean; reason?: TabBlockReason };
```

```typescript
// src/lib/store-onboarding/tab-state.ts

// D7 — estado único dominante, função pura
export function computeTabState(
  tab: OnboardingTab,
  ctx: {
    hasLocalEdits: boolean;
    isPersisted: boolean;
    unlocked: boolean;
    readiness: StoreReadiness;   // da F34 (check_store_readiness)
  }
): { state: TabState; reason?: TabBlockReason };
```

```typescript
// src/lib/store-onboarding/draft-store.ts

// D5 — rascunho localStorage com TTL, escopado por usuário
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;   // 24h

interface StoreDraft {
  userId: string;
  storeId: string | null;           // null = ainda não criada (chave :new)
  fields: Partial<StoreFormData>;
  updatedAt: number;                // epoch ms — base do TTL
}

// Chave: "vendeo:store_draft:${userId}:${storeId ?? 'new'}"
//   antes do primeiro save → vendeo:store_draft:${userId}:new
//   depois de existir loja → vendeo:store_draft:${userId}:${storeId}
export function draftKey(userId: string, storeId: string | null): string;
export function saveDraft(draft: StoreDraft): void;
export function restoreDraft(userId: string, storeId: string | null): StoreDraft | null;
export function clearDraft(userId: string, storeId?: string | null): void;
```

### LegalAcceptancePanel

```typescript
// src/components/flow/legal-acceptance-panel.tsx
// Coluna lateral global (D3). Estados derivados do legalClearance da F30.
// Enum ÚNICO, usado em todo o fluxo:
export type LegalAcceptanceState =
  | "pending"               // Pendente
  | "accepted"              // Aceito
  | "needs_reacceptance";   // Reaceite necessário

interface LegalAcceptancePanelProps {
  acceptance: LegalAcceptanceState;
  onOpenModal: () => void;            // abre ContractAcceptanceModal (F30)
  variant: "desktop-sticky-column" | "mobile-compact";
}
```

### StoreIdentityForm (refatoração)

```typescript
// src/components/flow/store-identity-form.tsx
// Substitui useState<1 | 2>(initialStep === 2 ? 2 : 1)

interface StoreIdentityFormProps {
  storeId: string | null;
  mode: "create" | "edit";
  initialTab?: OnboardingTab;      // vindo do ?tab= (D6)
  readonlyMap?: Record<string, boolean>; // compat legado required=
}

// Estado interno
const [activeTab, setActiveTab] = useState<OnboardingTab>(initialTab ?? "dados");
// Desbloqueio derivado (não é estado): computeTabUnlock(activeTab, ctx) → { unlocked, reason }
// Auto-save: useOnboardingTabs(storeId, formData, onNavigate, onLeave)
```

### useStoreForm (extensão)

```typescript
// src/components/flow/use-store-form.ts

// Novo: save silencioso de campos válidos
async function autoSave(fields: Partial<StoreFormData>): Promise<{ ok: boolean }>;

// Mantido: save() original (usado pela Direção Visual com botão explícito)
```

### useOnboardingTabs (novo hook)

```typescript
// src/hooks/use-onboarding-tabs.ts
// Orquestra: troca de aba + auto-save (D4) + drift (D13) + URL ?tab= (D6)
interface UseOnboardingTabsOptions {
  storeId: string | null;
  formData: StoreFormData;
  getValidFields: () => Partial<StoreFormData>;
}

interface UseOnboardingTabsReturn {
  activeTab: OnboardingTab;
  setActiveTab: (next: OnboardingTab) => Promise<void>; // roda auto-save antes
  tabStates: Record<OnboardingTab, TabState>;
  saveStatus: "idle" | "saving" | "saved" | "error";
  handleInternalNavigation: (e: React.MouseEvent) => void; // auto-save antes de sair
  handlePageHide: () => void;        // grava draft síncrono (D4/D5)
  handleVisibilityChange: () => void;// grava draft síncrono quando oculto (D4/D5)
}
```

### URL e redirects

```
/loja?tab=dados                       ← padrão (sem param = dados)
/loja?tab=posicionamento
/loja?tab=direcao-visual
/loja?tab=dados&fiscal=pending        ← de /cadastro/cnpj e guard CNPJ
/loja?tab=direcao-visual&message=needs-visual-direction  ← guard direção visual

Parametros legados (compat, F36): required=cadastro-fiscal | required=visual-direction
```

---

## Testes

Testes seguindo o padrão do repositório (vitest + Testing Library):

### Máquina de abas (8+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `computeTabUnlock("dados")` → `{ unlocked: true }` | Aba 1 aberta por padrão |
| 2 | `computeTabUnlock("posicionamento")` sem nome/segmento/aceite → `{ unlocked: false, reason: "needs_legal_acceptance" }` | Bloqueio da aba 2 + motivo |
| 3 | `computeTabUnlock("posicionamento")` com nome+segmento+aceite e `storeId` → `{ unlocked: true }` | Desbloqueio da aba 2 |
| 4 | `computeTabUnlock("posicionamento")` com dados válidos mas sem `storeId` → `{ unlocked: false, reason: "needs_store_created" }` | Loja precisa existir |
| 5 | `computeTabUnlock("direcao-visual")` sem tom de voz → `{ unlocked: false, reason: "needs_tone_of_voice" }` | Bloqueio da aba 3 + motivo |
| 6 | `computeTabUnlock("direcao-visual")` com tom de voz → `{ unlocked: true }` (posicionamento vazio ainda destrava) | **D9 — só tom de voz** |
| 7 | `computeTabUnlock("direcao-visual")` com direção visual já salva (loja existente) → `{ unlocked: true }` mesmo sem tom de voz | Loja existente |
| 8 | `computeTabUnlock("posicionamento")` sem CNPJ → `{ unlocked: true }` | **D8 — CNPJ não bloqueia navegação** |

### TabState (4 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 9 | Aba bloqueada → `{ state: "blocked", reason }` | Estado de bloqueio |
| 10 | Edição local não salva → `{ state: "draft" }` | Rascunho |
| 11 | Persistido + completo → `{ state: "ready" }` | Pronta destrava próxima |
| 12 | Readiness incompleta (fiscal) → `{ state: "pending_generation", reason: "fiscal_pending" }` | Pendente p/ gerar |

### LegalAcceptancePanel (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 13 | `pending` → painel mostra "Pendente" + CTA "Revisar e aceitar" | Estado pendente |
| 14 | `accepted` → painel mostra "Aceito" sem CTA de aceite | Estado aceito |
| 15 | `needs_reacceptance` → painel mostra "Reaceite necessário" + CTA | Reaceite (F30) |
| 16 | `pending`/`needs_reacceptance` → aba Posicionamento bloqueada com motivo `falta aceite legal` no painel | **D3 — bloqueio de avanço** |
| 17 | Variante mobile → bloco compacto (sem sticky); desktop → coluna sticky no conteúdo | Responsividade |

### Auto-save e draft (8 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 18 | Troca de aba **com** Dados mínimos válidos → POST cria a loja, **limpa o draft** e desbloqueia Posicionamento | **D4 — cria loja** |
| 19 | Troca de aba **sem** Dados mínimos válidos → **grava draft no localStorage**, NÃO cria loja | **D4/D5 — só draft local** |
| 20 | Navegação interna para outra rota → `autoSave` chamado antes | Momento confiável 2 |
| 21 | Save falha → `saveStatus: "error"` e badge "Não salvo" | Feedback explícito |
| 22 | `pagehide`/`visibilitychange` (background/reload mobile) → **grava draft síncrono** no `localStorage`; PATCH best-effort não bloqueia | **D4/D5 — abandono mobile** |
| 23 | Primeiro save cria loja → migra draft, **limpa a chave** do `localStorage` | D5 migration |
| 24 | `restoreDraft` com `updatedAt` fora do TTL 24h → retorna `null` e remove a chave | TTL expirado |
| 25 | `logout` → `clearDraft` remove a chave | Limpeza no logout |

### URL/redirects (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 26 | `?tab=posicionamento` → aba inicial ② | D6 parse |
| 27 | `?tab=direcao-visual` bloqueada → cai em ② com aviso + link | Deep-link em aba bloqueada |
| 28 | `/campanhas/nova` sem fiscal → redirect `?tab=dados&fiscal=pending` | D12 |
| 29 | `required=visual-direction` (legado) → mapeia para ③ | Compat |
| 30 | Back/forward entre `?tab=` → troca de aba correta | History |

### Mobile tabs (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 31 | Viewport mobile → tabs usam rótulos curtos (Dados/Perfil/Visual) + badge pequeno, motivo fora do botão | **D10** |
| 32 | Botão inferior "Continuar" sempre visível no fluxo mobile (avança/retrocede) | **D10** |

### Drift (2 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 33 | Troca de aba com rascunho ativo → modal drift "Salvar alterações?" | D13 |
| 34 | Navegação interna com rascunho ativo → auto-save roda antes; falha → oferece "sair mesmo assim" | D13 + D4 |

### Regressão (obrigatória)

- `src/components/flow/store-identity-form*`, `store-page-client`, `readiness-banner`, `/campanhas/nova`, `/cadastro/cnpj` — testes existentes migrados/ajustados
- Gates da F32/F33/F34 inalterados — suíte completa de readiness/legal continua passando
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Auto-save cria lojas sem CNPJ ("draft stores")** | Aceitável e intencional (D8). Readiness RPC trata como pendente; banner aponta para `?tab=dados&fiscal=pending`. Lojas órfãs sem ação por longo período podem ser tratadas futuramente (limpeza) |
| **BrasilAPI indisponível → CNPJ fica pendente** | Não bloqueia navegação (D8); preenchimento manual permanece; readiness contínua reportando pendência |
| **PATCH no `unload` pode ser abortado pelo browser (mobile)** | **Não prometido** (D4): a escrita síncrona do draft via `pagehide`/`visibilitychange` é a proteção garantida; PATCH é best-effort |
| **Draft `localStorage` expira (TTL 24h) e o usuário volta depois** | Aceitável: onboarding é reiniciável e curto. O TTL evita "draft velho ressuscitado"; janela de 1 dia cobre o abandono mobile típico |
| **Draft `localStorage` entre contas/lojas** | Chave `vendeo:store_draft:${userId}:${storeId ?? "new"}` escopada por usuário + loja e limpa no logout — nunca cruza contas nem lojas |
| **Auto-save × drift race (dois saves concorrentes)** | `useOnboardingTabs` serializa saves (fila simples) e ignora respostas defasadas (ref/seq guard) |
| **Draft `localStorage` diverge dos dados do banco após primeiro save** | Migração explícita e atômica: ao criar loja, draft é lido uma vez, escrito no form e chave limpa; reconciliação ao reabrir |
| **Aceite legal ocupar a tela no mobile** | Bloco compacto no topo da aba ou antes do CTA, sem sticky persistente (D3/D10) |
| **Aceite legal fora da aba pode "sumir" da percepção do usuário** | Coluna lateral sempre visível + bloqueio claro da aba ② quando pendente |
| **Tom de voz obrigatório pode surpreender loja nova** | Regra mínima clara + card informativo curto; comportamento documentado (D9) |
| **`?tab=` deep-link para aba bloqueada** | Nunca tela em branco: aba solicitada aparece com bloqueio + link "Voltar" (D6) |
| **Compat `required=` legado vira código morto** | Mantido apenas na F36 como transição; removido numa fase futura (nota no código) |
| **Regressão em testes existentes que dependem de step 1/2** | Refatoração com os testes migrados junto (mesmo PR); suíte completa roda antes de merge |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **Stripe / Monetização Pública** | Deslocada para **F37** (v1.7, pós-beta). Billing na F36 é apenas coleta opcional colapsada na aba Dados |
| **Billing como aba própria / wizard de cobrança** | Billing não bloqueia nada (F34); colapsado na aba Dados |
| **Persistência cross-device do rascunho** | Draft local com TTL (D5) cobre o mobile. Sincronizar em back-end exigiria infra e é futura |
| **Rascunho sem expiração / "lembrar para sempre"** | TTL 24h é o compromisso entre retomada mobile e ausência de dado velho |
| **Multi-loja / seletor de loja no onboarding** | Fora do modelo atual (1 loja por conta no beta) |
| **Redesign visual do onboarding além das abas** | Foco funcional: navegação + auto-save + estados + aceite. Estilo segue o design system atual |
| **Onboarding adaptativo por plano** | Não há planos distintos ainda (v1.7) |
| **i18n** | Produto PT-BR. i18n é fase futura |
| **Limpeza de lojas draft órfãs** | Tratada futuramente, com métrica de abandono |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — 3 abas desbloqueáveis em sequência (Dados → Posicionamento → Direção Visual). Loja existente calcula desbloqueio dos dados salvos
- [ ] D2 — Três conceitos separados: avanço (abas) × qualidade da identidade (campos recomendados) × permissão de gerar (gates F34). Geração integralmente preservada
- [ ] D3 — Aceite legal como coluna lateral global (Pendente/Aceito/Reaceite necessário), responsivo; sem aceite → Posicionamento bloqueado
- [ ] D4 — Auto-save: troca de aba + navegação interna = save confiável; abandono = draft síncrono via `pagehide`/`visibilitychange`; PATCH no unload apenas best-effort
- [ ] D5 — Rascunho `localStorage` com TTL 24h, chave `vendeo:store_draft:${userId}:new` antes do 1º save e `vendeo:store_draft:${userId}:${storeId}` após existir loja; limpo após 1º save e logout
- [ ] D6 — URL `?tab=` real (back/forward). Deep-link em aba bloqueada → aba + aviso + link "Voltar"
- [ ] D7 — Estados por aba (Bloqueada / Rascunho / Salva / Pronta / Pendente para gerar) via `computeTabState` puro + motivo no painel ativo
- [ ] D8 — CNPJ não bloqueia onboarding; bloqueia **geração/crédito** (exceto `is_test_store`)
- [ ] D9 — Apenas tom de voz obrigatório para liberar a Direção Visual (loja nova); posicionamento/descrição/slogan recomendados com card informativo curto
- [ ] D10 — Abas mobile compactas (Dados/Perfil/Visual), badge pequeno, motivo no painel ativo, botão "Continuar" sempre visível
- [ ] D11 — ARIA tabs (tablist/tab/tabpanel, roving tabindex, setas, `aria-live`)
- [ ] D12 — Redirects/banners migrados (`/campanhas/nova`, `/cadastro/cnpj`, `ReadinessBanner`) para `?tab=` + `message=`
- [ ] D13 — Drift intercepta troca de aba + navegação interna com rascunho ativo
- [ ] D14 — Renumeração F36=Onboarding, F37=Stripe aplicada nos trackings

### Navegação
- [ ] `/loja` abre na aba Dados sem `?tab=`
- [ ] Aba Dados: nome, CNPJ/fiscal, segmento, subsegmento, cidade/UF, billing colapsado (aceite legal fora da aba)
- [ ] Aba Posicionamento: tom de voz, posicionamento, descrição, slogan + card informativo curto
- [ ] Aba Direção Visual: 3 caminhos da F34 (logo, VS, text-only) + preview
- [ ] Aba bloqueada mostra motivo no painel + link para a aba anterior
- [ ] Back/forward altera aba conforme `?tab=`

### Aceite legal (D3)
- [ ] Desktop: coluna lateral sticky dentro do conteúdo (participa do grid, não sobrepõe)
- [ ] Mobile: bloco compacto no topo da aba ou antes do CTA — sem sticky persistente
- [ ] Estados: `Pendente` / `Aceito` / `Reaceite necessário` (derivados do `legalClearance` da F30)
- [ ] Pendente/Reaceite → aba Posicionamento bloqueada com `falta aceite legal`
- [ ] CTA abre o `ContractAcceptanceModal` da F30 (reuso)
- [ ] Aceite aceito → aba Posicionamento destrava e painel muda para "Aceito"

### Rascunho e auto-save (D4/D5)
- [ ] Troca de aba com Dados válidos → cria loja (POST), limpa draft, desbloqueia Posicionamento
- [ ] Troca de aba sem Dados válidos → grava draft no `localStorage`, NÃO cria loja
- [ ] Navegação interna (dashboard/campanhas) salva antes de navegar
- [ ] `pagehide`/`visibilitychange` (background/reload/fechar) → grava draft síncrono
- [ ] PATCH no `unload` é best-effort e não bloqueia (documentado, não prometido)
- [ ] Falha de save → badge "Não salvo" + toast, sem bloquear navegação
- [ ] Restore respeita TTL 24h (draft expirado é ignorado e removido)
- [ ] Chave `vendeo:store_draft:${userId}:${storeId ?? "new"}` escopada por usuário+loja; limpa no logout
- [ ] Direção Visual tem botão Salvar explícito (não depende só do implícito)

### Estados por aba (D7/D10)
- [ ] Badges corretos: Bloqueada / Rascunho / Salva / Pronta / Pendente para gerar
- [ ] Motivos exibidos no painel ativo, não no botão da aba (mobile)
- [ ] CNPJ ausente → aba Dados mostra "Fiscal pendente" mas não bloqueia navegação
- [ ] Tom de voz ausente → aba Direção Visual bloqueada com o motivo
- [ ] Tom de voz presente (mesmo sem posicionamento) → aba Direção Visual liberada (D9)
- [ ] Mobile: tabs compactas (Dados/Perfil/Visual) + botão inferior "Continuar"

### Redirects e guards
- [ ] `/campanhas/nova` sem fiscal → `/loja?tab=dados&fiscal=pending&returnTo=/campanhas/nova`
- [ ] `/campanhas/nova` sem direção visual → `/loja?tab=direcao-visual&message=needs-visual-direction` (ou ② se bloqueada)
- [ ] `/cadastro/cnpj` → `/loja?tab=dados&fiscal=pending`
- [ ] `ReadinessBanner` links → `?tab=` mantendo mensagem contextual
- [ ] `required=` legado continua aceito (compat F36)

### Acessibilidade
- [ ] ARIA tabs válidos (inspeção + teste de teclado)
- [ ] Setas ←/→ e Home/End movem foco entre abas
- [ ] Estados de aba legíveis via `aria-label` (não só cor)
- [ ] Aceite legal: estados via `aria-label`/`aria-expanded`
- [ ] Touch targets ≥ 44px

### Gates de geração e crédito (regressão F32/F33/F34)
- [ ] **Sem CNPJ fiscal válido → não gera campanha E não concede crédito freemium** (entitlement por raiz de CNPJ)
- [ ] **`is_test_store` / loja experimental → pode contornar o fiscal conforme regra administrativa**
- [ ] Sem brand profile syncado → não gera
- [ ] Sem aceite legal vigente → não gera
- [ ] Créditos continuam debitando normalmente

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] Lojista novo: Dados → Posicionamento → Direção Visual com desbloqueio guiado
- [ ] Lojista novo sai da página no meio da aba Dados → volta e não perde (draft localStorage)
- [ ] Lojista **mobile** alterna o app / fecha a aba no meio do onboarding → reabre e recupera o rascunho (dentro de 24h)
- [ ] Lojista volta depois de 24h+ → rascunho expirado é ignorado (onboarding limpo)
- [ ] Lojista sem aceite legal vê o painel "Pendente" e a aba ② bloqueada com motivo
- [ ] Lojista com CNPJ pendente navega até a Direção Visual e volta; tentar gerar → banner leva a `?tab=dados&fiscal=pending`; tentar crédito → não concede
- [ ] Lojista sem tom de voz vê a aba ③ bloqueada com motivo claro no painel
- [ ] Posicionamento opcional: lojista preenche só tom de voz e avança; card informativo visível
- [ ] Mobile: tabs Dados/Perfil/Visual + botão "Continuar" sempre visível
- [ ] Mobile (dispositivo real ou emulação 375px/390px): o botão "Continuar" **não cobre** campos do formulário, mensagens de erro nem o painel compacto de aceite — validação visual em viewport estreita
- [ ] Loja existente com direção visual → aba ③ aberta direto
- [ ] Back/forward entre abas funciona
- [ ] Regressão: `/campanhas/nova`, `/cadastro/cnpj`, dashboard banner, geração completa

---

*Documento criado: 2026-08-01*
*Baseado no alinhamento da milestone v1.5, discussão entre dois agentes com consolidação das recomendações. Refinamento pós-revisão do usuário (2ª): 3 abas desbloqueáveis em sequência; soft-block com tom de voz como único mínimo para a Direção Visual; separação dos conceitos de avanço × qualidade da identidade × permissão de gerar; aceite legal como coluna lateral global (Pendente/Aceito/Reaceite, responsivo, bloqueia Posicionamento); auto-save confiável em troca de aba e navegação interna, com abandono mobile protegido por localStorage com TTL 24h (pagehide/visibilitychange síncronos) e PATCH no unload best-effort; CNPJ bloqueando geração/crédito (não onboarding) com is_test_store como exceção administrativa; badges simplificados com motivo no painel ativo; abas mobile compactas (Dados/Perfil/Visual) com botão "Continuar"; contratos puros retornando `{ unlocked, reason }`; enum de aceite padronizado (`pending | accepted | needs_reacceptance`); URL ?tab=; migração de redirects/banners; ARIA tabs; renumeração F36=Onboarding / F37=Stripe. Precisão final (3ª): chave do draft explícita (`vendeo:store_draft:${userId}:new` antes do 1º save e `:${storeId}` após) e "Perfil"/"Visual" documentados como label responsivo (id da aba permanece `posicionamento`/`direcao-visual` para testes, analytics e query param).*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec.*
