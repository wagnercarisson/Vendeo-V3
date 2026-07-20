# Alinhamento Fase 29 — Refinamento Visual + UAT + Launch Readiness (v1.5)

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)
  ├── F23 — TextProvider + Copy Director (fundação IA de texto)                    ✓
  ├── F24 — Wallet + Ledger + Idempotência (fundação financeira)                   ✓
  ├── F25 — Integração Transacional do Pipeline (créditos + copy + rate limit)      ✓
  ├── F26 — Admin Operacional + Convites + Créditos Manuais                        ✓
  ├── F27 — Conta + Saldo Visível + Extrato                                        ✓
  ├── F28 — Observabilidade + Operação + Launch Controls                            ✓
  ├── ★ F29 — Refinamento Visual + UAT + Launch Readiness                           ← esta fase
  └── F30/v1.6 — Stripe / Monetização Pública (adiado para pós-beta)
```

A v1.5 está com 7/8 fases concluídas. Todas as capacidades funcionais estão implementadas e testadas (~889 testes). O motor de campanha com créditos, copy IA, admin operacional, saldo visível, observabilidade e launch controls está rodando.

**O que falta para o lançamento externo controlado:**

- A experiência visual em fluxos críticos não tem loading states, error states ou empty states consistentes — rotas cruciais mostram tela em branco durante carregamento ou falha silenciosa
- A peça gerada não passou por checklist de legibilidade e publicabilidade — o contraste, a hierarquia visual e as safe zones não foram verificados contra critérios de aprovação
- O mobile não foi verificado nas superfícies adicionadas após F22 (F23-F28) — conta, créditos, admin, métricas podem ter problemas de responsividade
- O microcopy PT-BR tem inconsistências e jargão técnico ("Copy Director", "geração", "publication copy") que confundem um lojista não técnico
- Não há canal de feedback ativo com lojistas beta — o time não tem como receber relatos durante o UAT
- Não há critérios documentados de expansão, pausa e go/no-go — a decisão de abrir o beta para mais lojistas é subjetiva
- O UAT externo com lojistas reais não foi executado — o ciclo completo nunca foi validado por um usuário fora do time
- A política de retenção de 90 dias está documentada (F28) mas não validada em execução real
- As métricas de saúde do sistema (F28) não foram verificadas como critério de lançamento

**Esta fase não adiciona novas features de produto.** Ela transforma o Vendeo de "funcional internamente" para "confiável, publicável e operável com lojistas reais".

---

## Realinhamento de Escopo (vs. alinhamento milestone original)

O alinhamento original da milestone (v1.5) descrevia o refinamento visual e a launch readiness com escopo amplo. Após a conclusão de F23-F28, o escopo foi ajustado para refletir o que realmente precisa ser entregue — sem redesenhar o produto ou virar um projeto de design.

### O que muda

| Item | Original (milestone) | Realinhado (F29) |
|------|---------------------|------------------|
| **Loading states** | Mencionado genericamente | loading.tsx em 12 rotas críticas com skeletons dedicados (shimmer, aspect ratio preservado, sem layout shift) |
| **Error states** | Mencionado genericamente | error.tsx em (app) e /admin + tratamento específico por tipo (saldo, rate limit, geração, admin) |
| **Empty states** | Mencionado genericamente | 7 estados de empty padronizados com ilustração + mensagem + CTA |
| **Mobile hardening** | "Mobile hardening (v2)" — sugerindo novo ciclo amplo | Regressão mobile contra F22 + verificação das superfícies novas (F23-F28). Sem novo ciclo de design mobile |
| **Feedback channel** | "Canal de feedback" | WhatsApp primário + email fallback. EM DISCUSSÃO |
| **Critérios de lançamento** | "Critérios de saúde do lançamento" | Expansão, pausa e go/no-go documentados com thresholds e aprovação do time |
| **UAT externo** | "Usuário real consegue se cadastrar, receber créditos, gerar campanha..." | 8 cenários mínimos com evidências registradas. Correção de bloqueantes. Decisão explícita |
| **Cleanup 90d** | "Implementado dentro de 30 dias do lançamento" | Função SQL + runbook (F28) validados manualmente. Job automático adiado. Revisão D+30 |
| **Monetização (Stripe)** | Reposicionado para F30/v1.6 | Reafirmado: fora da F29. Não implementar |

### Justificativa

1. **loading/error/empty states como critério de aceite** — o produto funcional sem esses estados parece quebrado para um lojista não técnico. É o maior gap de polish pós-F28.
2. **Mobile não precisa de novo ciclo** — F22 entregou a fundação mobile. As áreas novas (F23-F28) precisam de verificação, mas refazer F22 seria desperdício.
3. **Canal de feedback começa simples** — WhatsApp é suficiente para 3-5 lojistas. Formulário in-app pode vir depois sem refatoração.
4. **UAT com supervisão direta** — 8 cenários com o time acompanhando produz mais aprendizado que UAT cego com formulário.
5. **Cleanup manual desbloqueia o ship** — a função SQL e o runbook existem (F28). Volume esperado é baixo. Job automático é otimização, não necessidade.
6. **Monetização só depois de validar o produto** — crédito operado pelo time é o modelo correto durante o beta. Stripe entra após validação da demanda.

---

## Propósito

1. **Loading states em todas as rotas críticas** — loading.tsx com skeletons dedicados, shimmer adaptado ao dark mode, sem layout shift
2. **Error boundaries no grupo autenticado e admin** — error.tsx com mensagens claras e recuperação, sem vazar detalhes internos
3. **Empty states padronizados** — cada lista/tabela vazia tem ilustração, mensagem e CTA no lugar
4. **Error states específicos** — saldo insuficiente, rate limit, geração pausada, falha de geração com recuperação (estorno automático)
5. **Microcopy PT-BR consistente** — tom comercial, sem jargão técnico, orientado a ação
6. **Mobile verificado nas superfícies pós-F22** — 320-768px, touch targets >= 44px, sem overflow, modais utilizáveis
7. **Legibilidade e publicabilidade da peça gerada** — contraste, hierarquia, safe zones, CTA visual, sem emojis na arte final
8. **Canal de feedback ativo** — canal primário definido (recomendação: WhatsApp) + email fallback, SLA documentado
9. **Critérios de expansão, pausa e go/no-go** — documentados e aprovados pelo time
10. **UAT externo executado com evidências** — 8 cenários, preparar 3-5 lojistas, executar com 1-2 inicialmente, correção de bloqueantes
11. **Launch flags verificadas** — `VENDEO_V15_ENABLED` ativa em UAT/lançamento controlado
12. **Métricas de saúde visíveis e alinhadas** — `/admin/metrics`, thresholds coerentes
13. **Retenção 90d validada** — função SQL testada, runbook funcional, decisão de job automático registrada com revisão D+30

---

## Estado Atual (pós-F28)

```
                                           ANTES (F28)                         DEPOIS (F29)
═══════════════════════════════════════════════════════════════════════════════════════════════════

Loading states:
  loading.tsx em rotas críticas        nenhum arquivo loading.tsx existe     12 rotas com loading.tsx + skeleton
                                       (Next.js padrão: sem spinner,          dedicado (shimmer, aspect ratio,
                                        sem skeleton, tela em branco          dimensões estáveis, dark mode)
                                        até o SSR completar)

Rotas sem loading:
  /dashboard                           tela em branco durante load            skeleton de cards + saldo
  /campanhas                           tela em branco durante load            skeleton de lista de campanhas
  /campanhas/nova                      tela em branco durante load            skeleton de formulário
  /campanhas/[id]                      tela em branco durante load            skeleton de preview + copy
  /conta                               tela em branco durante load            skeleton de perfil + extrato
  /loja                                tela em branco durante load            skeleton de identidade
  /admin (dashboard)                   tela em branco durante load            skeleton de admin
  /admin/users                         tela em branco durante load            skeleton de tabela
  /admin/users/[id]                    tela em branco durante load            skeleton de detalhe
  /admin/campaigns/errors              tela em branco durante load            skeleton de erros
  /admin/audit-log                     tela em branco durante load            skeleton de audit
  /admin/metrics                       tela em branco durante load            skeleton de cards

Error boundaries:
  Grupo (app)                          nenhum error.tsx                       error.tsx com fallback amigável
                                       (erro não tratado → white screen       e botão "Tentar novamente"
                                        ou stack trace em dev)
  Área /admin                          nenhum error.tsx                       error.tsx sem vazar detalhes
                                                                              internos (admin também é usuário)
  Rotas de campanha                    sem error.tsx específico               cobertas pelo error boundary do
                                                                               grupo (app) + error states
                                                                               específicos na UI quando aplicável

Skeletons:
  Componente base                      skeleton.tsx existe                    mesmo componente, estendido
                                       mas sem variantes de uso               com variantes: card, table,
                                                                              form, preview, stats
  Shimmer dark mode                    sem tratamento                         shimmer adaptado ao bg dark
  Aspect ratio em previews             sem garantia                           dimensões estáveis (sem CLS)
  Cards e tabelas                      sem dimensão consistente               altura/largura fixas durante load

Empty states:
  Componente reutilizável              empty-state.tsx existe                  mesmo componente, revisado
                                       usado em dashboard e campanhas,         (ícone, título, descrição, CTA)
                                       mas sem cobertura total
  Sem campanhas                        tratado em campanhas/page.tsx           tratado + ilustração + CTA
                                       e campanhas/client.tsx                  "Criar primeira campanha"
  Busca sem resultados                 tratado em campanhas/client.tsx         tratado + "Nenhuma campanha
                                                                               encontrada" + limpar filtros
  Sem transações                       não tratado (extrato vazio             ilustração + "Nenhuma transação
                                       sem mensagem)                          ainda" (informativo, sem CTA)
  Sem loja (admin view)                não tratado (tabela vazia)              ilustração + "Nenhum lojista
                                                                               cadastrado"
  Sem métricas admin                   não tratado (página sem dados)         "Aguardando dados de geração"
  Sem erros de campanha                não tratado (página sem dados)         "Nenhum erro registrado"
  Saldo zero/baixo                     sem distinção de empty vs erro          "Você precisa de créditos" + CTA
                                                                               "Solicitar créditos" / "Fale com o time"

Error states:
  Falha de geração                     mensagem genérica                       explicar causa + recuperação
                                       (algo deu errado)                      (estorno automático é transparente)
  Saldo insuficiente                   402 sem distinção visual                "Créditos insuficientes" + CTA
                                                                               sem tratá-lo como erro de sistema
  Rate limit                           mensagem técnica                       "Você atingiu o limite" +
                                                                               informa quando volta
  Geração pausada (503)                sem tratamento UI                       banner informativo + CTA
                                                                               "Entre em contato"
  Erro admin sem vazar detalhes        detalhes internos expostos              mensagem segura, sem stack trace
                                                                               ou dados de conexão

Microcopy PT-BR:
  Consistência geral                   parcial (fases F23-F28                  revisão completa nos fluxos
                                       mantiveram nomenclatura técnica)        críticos
  Jargão técnico                       "Copy Director", "geração",             reduzido: "texto da campanha",
                                       "publication copy", "snapshot"          "criar campanha", "legenda"
  Mensagens de erro                    termos em inglês ou                     PT-BR claro, orientado a ação
                                       linguagem de dev                        ("Tente novamente", "Verifique
                                                                               sua conexão")
  Tom                                 inconsistente entre telas               tom comercial, confiável,
                                                                               simples (lojista não técnico)
  "Solicitar créditos" /              não unificado (alguns lugares            padronizado em todo o produto
  "Fale com o time"                    usam "comprar" ou sem link)

Mobile 320-768px:
  /campanhas/nova                      verificado na F22                       verificado pós-alterações
                                       mas não re-verificado pós F23-F28       F23-F28 (crédito, copy)
  /campanhas                           verificado na F22                       regressão + novos estados
                                                                               (loading, empty, error)
  /campanhas/[id]                      verificado na F22                       regressão + novos estados
                                                                               + copy gerada
  /conta                               NÃO verificado (F27)                    saldo, extrato, paginação,
                                                                               CTA de créditos legíveis
  /admin/*                             NÃO verificado (F26 sem mobile)         triagem mínima sem exigir
                                                                               experiência mobile-first
  /admin/metrics                       NÃO verificado (F28 sem mobile)         cards adaptados, health banner
                                                                               legível em viewport estreito

Critérios móveis:
  Overflow horizontal                  não verificado nas novas telas          zero overflow nas telas testadas
  Botões sobrepostos                   não verificado                          sem sobreposição
  Touch targets >= 44px                não verificado nas novas telas          todos os targets >= 44px
  Textos cortados                      não verificado                          sem corte
  Modais utilizáveis                   não verificado em mobile                modal de crédito utilizável

Legibilidade da peça gerada:
  Contraste                            não verificado contra design system     verificado: texto sobre fundo
                                                                               atende contraste mínimo
  Hierarquia visual                    não verificado                          preço como elemento principal,
                                                                               promoção destacada
  Safe zones                           não verificado                          texto dentro das margens
                                                                               definidas (fora da borda de corte)
  CTA visual                           tratado como botão interativo           "Compre agora" e similares são
                                       na tela de preview                      elementos visuais da campanha,
                                                                               não botões de UI
  Emojis na arte final                 sem verificação (podem aparecer)        nenhum emoji na peça final
  Produto não cortado                  não verificado                          produto principal inteiro visível

Feedback channel:
  Canal primário                       inexistente                             WhatsApp (recomendação)
  Canal fallback                       inexistente                             email de suporte
  SLA de resposta                      inexistente                             documentado

Critérios de expansão/pausa:
  Thresholds de expansão               inexistentes                            documentados (7 dias verdes)
  Condições de pausa                   inexistentes                            documentadas (segurança, crédito,
                                                                               erro crítico, métricas)
  Aprovação do time                    inexistente                             requisito explícito para go/no-go

UAT externo:
  Execução com lojistas reais          não realizado                           3-5 lojistas, 8 cenários
  Evidências registradas               não existem                             data, usuário, cenário, resultado,
                                                                               bugs, severidade, decisão
  Correção de bloqueantes              não aplicável                           bugs críticos corrigidos
                                                                               ou formalmente aceitos
  Decisão final                        não aplicável                           go / expandir controlado / pausar

Cleanup 90d:
  Função SQL                           versionada (F28)                        validada (execução manual OK)
  Runbook                              documentado (F28)                       validado (comando testado)
  Job automático                       adiado (F28)                            adiado (revisão D+30)
  Decisão documentada                  não explicitamente                      registrada em docs/launch-readiness

Métricas de saúde:
  /admin/metrics                       implementado (F28)                      verificado: dados coerentes,
                                                                               thresholds alinhados,
                                                                               health states funcionais

Launch flags:
  VENDEO_V15_ENABLED                   implementado (F28)                      ativo em UAT/lançamento
  VENDEO_CREDITS_CHARGING_ENABLED      implementado (F28)                      verificado
  VENDEO_COPY_DIRECTOR_ENABLED         implementado (F28)                      verificado
  VENDEO_RATE_LIMIT_ENABLED            implementado (F28)                      verificado
  VENDEO_GENERATION_PAUSED             implementado (F28)                      verificado (não ativo em UAT)
```

---

## Decisões de Alinhamento

### D1 — Fonte de Verdade Visual da F29

`DECIDIDO`

A F29 valida e corrige a UI/UX contra o design system já registrado em `openspec/design-system/`. A skill `ui-ux-pro-max` pode ser usada como ferramenta consultiva de auditoria, mas não redefine estilo, paleta, layout ou direção visual do Vendeo.

**Arquivos-fonte vinculados (soberanos):**

| Documento | Função |
|-----------|--------|
| `openspec/design-system/MASTER.md` | Tokens, grid, tipografia, cores, ícones, espaçamento |
| `openspec/design-system/CAMPAIGN_VISUAL_SYSTEM.md` | Sistema visual da campanha gerada |
| `openspec/design-system/CAMPAIGN_ART_DIRECTION.md` | Direção de arte da campanha |
| `openspec/design-system/pages/campaign-input.md` | Design do formulário de geração |
| `openspec/design-system/pages/campaign-preview.md` | Design da tela de preview |
| `openspec/design-system/pages/review-export.md` | Design da tela de revisão/exportação |
| `openspec/design-system/pages/store-identity.md` | Design da identidade da loja |
| `openspec/design-system/pages/dashboard.md` | Design do dashboard |

**Como a auditoria é feita:**

1. **Pré-implementação** — gerar checklist de UX/UI com foco em loading, error, empty states, mobile, acessibilidade, legibilidade e microcopy, usando `ui-ux-pro-max` como apoio
2. **Pré-UAT/sign-off** — revisar telas reais/screenshot contra o design system e apontar problemas de polimento antes de liberar lojistas externos

**Regra:** qualquer recomendação genérica da skill que conflite com o design system aprovado do Vendeo é descartada em favor de `MASTER.md`.

**Classificação dos achados:**

| Classe | Ação |
|--------|------|
| **Blocker F29** | Impede UAT externo ou publicabilidade. Deve ser corrigido |
| **Fix F29** | Correção de polish dentro da fase |
| **Accept / Monitor** | Conhecido, não bloqueia beta controlado |
| **Post-v1.5** | Melhoria futura fora do lançamento |

---

### D2 — Loading, Error e Empty States

`DECIDIDO`

Todas as rotas críticas do app autenticado devem ter `loading.tsx` antes do UAT externo. Error boundaries são definidos por grupo ((app) e /admin), não por rota individual. Os estados de empty devem estar presentes em todas as listas, tabelas e painéis.

**Contrato de loading.tsx:**

- Preservar aspect ratio em prévias de campanha
- Shimmer discreto no dark mode (opacidade variável, não animação colorida)
- Cards e tabelas com dimensões estáveis para evitar layout shift
- skeleton.tsx estendido com variantes: `card`, `table`, `form`, `preview`, `stats`

**Contrato de error.tsx:**

- Mensagem clara em PT-BR, sem jargão técnico
- Botão "Tentar novamente" que chama `reset()`
- No admin: mensagem segura sem stack trace, dados de conexão ou detalhes internos
- No grupo (app): fallback genérico que cobre erros não tratados em qualquer rota filha

**Contrato de empty states:**

- Componente `EmptyState` existente mantido como padrão
- Props: `icon?`, `title` (string), `description` (string), `action?` (label + href/onClick)
- Ausência de ação → apenas informativo (ex.: "Nenhum erro registrado")

**Rotas com loading.tsx obrigatório (12):**

```
/dashboard              → skeleton de cards + saldo
/campanhas              → skeleton de lista
/campanhas/nova         → skeleton de formulário
/campanhas/[id]         → skeleton de preview + copy
/conta                  → skeleton de perfil + extrato
/loja                   → skeleton de identidade
/admin                  → skeleton de admin
/admin/users            → skeleton de tabela
/admin/users/[id]       → skeleton de detalhe
/admin/campaigns/errors → skeleton de lista de erros
/admin/audit-log        → skeleton de audit
/admin/metrics          → skeleton de cards
```

**Rotas com error.tsx obrigatório (2 grupos):**

```
(app)/                  → error.tsx (fallback genérico)
(app)/admin/            → error.tsx (fallback admin, sem vazar detalhes)
```

**Estados de empty obrigatórios (7):**

```
sem campanhas           → "Criar primeira campanha"
busca sem resultados    → "Nenhuma campanha encontrada" + limpar filtros
sem transações          → "Nenhuma transação ainda" (informativo, sem CTA)
sem loja (admin)        → "Nenhum lojista cadastrado"
sem métricas (admin)    → "Aguardando dados de geração"
sem erros (admin)       → "Nenhum erro registrado"
saldo zero              → "Você precisa de créditos" + CTA
```

---

### D3 — Escopo Mobile da F29

`DECIDIDO`

A F29 não executa um novo ciclo amplo de mobile hardening como a F22. A F29 faz regressão mobile da experiência existente (F22) e hardening específico das superfícies adicionadas após F22 (F23-F28).

**Áreas sob verificação mobile (320-768px):**

| Área | Origem | Tipo |
|------|--------|------|
| `/conta` — saldo, extrato, paginação, CTA de créditos | F27 | Novo (não verificado) |
| Topbar/app shell — saldo e menu | F27 | Novo (não verificado) |
| `/campanhas/nova` — saldo insuficiente, botão desabilitado, tooltip, CTA | F25 | Regressão + modificaçao |
| `/campanhas` e `[id]` — estados novos de erro/loading e copy gerada | F25 | Regressão |
| `/admin/*` — triagem mínima | F26 | Novo (não verificado) |
| `/admin/metrics` — cards e health banner | F28 | Novo (não verificado) |

**Critérios de aceite mobile:**

- Zero overflow horizontal nas telas testadas
- Botões sem sobreposição
- Touch targets >= 44px
- Textos não cortados
- Modais (crédito, confirmação) utilizáveis no celular
- Estados de erro/loading/empty legíveis em viewport estreito

**Fora do escopo mobile da F29:**

- Redesenhar navegação mobile
- Refatorar layout global da F22
- Otimizar todas as telas antigas sem regressão reportada
- Transformar admin em experiência mobile-first

---

### D4 — Microcopy PT-BR Orientado a Ação

`DECIDIDO`

O microcopy em todos os fluxos críticos deve ser revisado para tom comercial simples, sem jargão técnico, com mensagens orientadas a ação.

**Padrão de tom:**

- **Tom:** comercial, confiável, simples (lojista não técnico)
- **Jargão a remover:** "Copy Director", "geração" (substituir por "texto da campanha", "criar campanha"), "publication copy", "snapshot", "rate limit", "generation"
- **Consistência:** "Solicitar créditos" e "Fale com o time" em todos os lugares
- **Erros:** explicar o problema + o que fazer — nunca apenas "Algo deu errado"

**Fluxos que passam por revisão obrigatória:**

```
/campanhas/nova          → título, placeholder, tooltips, botão desabilitado
/campanhas               → título, busca vazia, filtros
/campanhas/[id]          → status, ações, metadados
/conta                   → saldo, extrato, CTA de créditos
/dashboard               → cards, boas-vindas, dicas
/loja                    → formulário, upload
/admin/*                 → ações admin (sem jargão interno desnecessário)
Erro de saldo            → "Créditos insuficientes" + CTA
Erro de rate limit       → "Você atingiu o limite" + quando volta
Geração pausada          → "Geração temporariamente indisponível" + CTA
Falha de geração         → explicar a causa + "Tente novamente"
```

---

### D5 — Legibilidade e Publicabilidade da Peça Gerada

`DECIDIDO`

Uma amostra representativa de peças geradas durante a auditoria/UAT deve passar pelo checklist de legibilidade e publicabilidade. O renderer deve preservar regras automáticas (safe zones, contraste, sem emojis). Este checklist é critério de aceite da F29.

**Checklist de legibilidade:**

| Critério | O que verificar |
|----------|-----------------|
| Contraste | Texto sobre fundo atende contraste mínimo (WCAG AA) |
| Hierarquia visual | Preço é o elemento principal, promoção destacada, oferta clara |
| Safe zones | Texto dentro das margens definidas (fora da borda de corte de impressão/recorte) |
| CTA visual | "Compre agora" e similares são elementos da campanha, não botões interativos da UI |
| Produto não cortado | Produto principal inteiro visível, sem corte indevido |
| Emojis | Nenhum emoji na arte final |

**Critério de aceite:** a peça deve parecer publicável para um lojista, não apenas "renderizar corretamente". A aprovação visual do time é requisito.

---

### D6 — Canal de Feedback do Beta

`EM DISCUSSÃO`

A milestone v1.5 define que o canal primário deve ser um grupo de WhatsApp ou Discord com os lojistas beta. Para o contexto inicial do Vendeo (lojistas brasileiros, UAT controlado), a recomendação é:

- **Canal primário:** WhatsApp (grupo com lojistas beta + time)
- **Canal fallback:** Email de suporte (configurado em `SUPPORT_EMAIL`)
- **Canal secundário (opcional):** Formulário in-app — implementar somente se couber sem atrasar a F29

**A F29 deve decidir e registrar antes do UAT:**

- Canal primário: WhatsApp ou Discord
- Canal secundário: email de suporte, formulário in-app ou ambos
- Responsável por monitorar o canal
- SLA informal de resposta durante o beta
- Onde o link/instrução aparece no produto (topbar, /conta, dashboard)
- O que entra no app agora vs. o que fica operacional/manual

**Recomendação atual:** WhatsApp primário + email fallback + formulário in-app somente se couber sem atrasar F29.

---

### D7 — Monetização Pública Permanece Pós-Beta

`DECIDIDO`

Stripe Checkout, compra real de créditos, planos, assinaturas e qualquer monetização pública permanecem fora da F29. Esses itens estão explicitamente destinados à F30/v1.6 — Monetização Pública, após validação do beta controlado.

Durante a F29 e o lançamento controlado da v1.5:

- Créditos continuam operados manualmente pelo time via admin (F26)
- CTA de saldo zero/baixo continua sendo "Solicitar créditos" / "Fale com o time"
- Nenhum fluxo de pagamento deve ser introduzido
- Nenhuma modelagem de plano, assinatura ou pacote pago bloqueia o fechamento da v1.5

**O que a F29 valida sobre créditos:** se o fluxo manual de créditos é compreensível, operável e suficiente para o beta controlado — não se ele deve ser substituído por pagamento.

---

### D8 — Cleanup 90d: Runbook Mantido, Job Automático Adiado

`DECIDIDO`

A política de retenção de 90 dias para `generation_events` continua obrigatória e documentada. A função SQL `cleanup_generation_events_90d()` e o runbook manual entregues na F28 são suficientes para o lançamento controlado inicial.

**O que a F29 faz:**
- Valida que a função SQL existe e executa sem erro
- Valida que o runbook em `docs/operations/support-runbook.md` referencia o comando correto
- Registra a decisão de não implementar job automático agora em `docs/launch-readiness/`
- Estabelece condição para reavaliação (D+30 ou antes, conforme critérios abaixo)

**Critérios para antecipar o job automático antes de D+30:**

| Condição | Ação |
|----------|------|
| Volume de eventos crescendo rápido | Reavaliar necessidade de job automático |
| Execução manual ficando recorrente | Implementar job |
| Custo/performance afetados pelo volume de dados | Implementar job |
| Necessidade operacional antes de ampliar o beta | Implementar job |

**Status pós-F29:** job automático permanece como melhoria futura. A F29 não o implementa.

---

### D9 — Critérios de Expansão, Pausa e Go/No-Go

`DECIDIDO`

A F29 documenta e aprova com o time os critérios para expandir o beta, pausar a operação e decidir o go/no-go do lançamento controlado.

**Critérios de expansão (aumentar número de lojistas):**

- Mínimo de 7 dias consecutivos com health state "healthy" e sem gatilhos de atenção/pausa abertos
- Nenhum incidente de segurança no período
- Nenhum erro crítico de geração não resolvido
- Nenhuma perda de crédito não estornada
- Team lead aprova explicitamente a expansão

**Critérios de pausa (suspender novas gerações):**

- Incidente de segurança confirmado (vazamento de dados, acesso não autorizado)
- Perda de crédito de lojista (falha no estorno automático)
- Saldo negativo de lojista (inconsistência no ledger)
- Erro crítico de geração que afeta múltiplos lojistas
- Métricas em zona "pause" por mais de 1 hora consecutiva
- Gatilhos críticos (segurança, perda de crédito, saldo negativo) autorizam pausa imediata via VENDEO_GENERATION_PAUSED — qualquer membro do time pode ativar a flag; team lead revisa e ratifica em até 1h
- Demais gatilhos (erro de geração, métricas em pause por 1h): qualquer membro do time pode solicitar; team lead aprova

**Decisão de go/no-go (lançamento ou expansão):**

- Todas as Waves da F29 concluídas
- UAT externo executado sem bugs bloqueantes (ou com blockers formalmente aceitos)
- Métricas de saúde verificadas e documentadas
- Feature flag VENDEO_V15_ENABLED ativa no ambiente de UAT
- Revisão final do time com decisão explícita registrada

---

### D10 — UAT Externo com Evidências e Correção

`DECIDIDO`

A F29 executa UAT externo com lojistas reais, registra evidências e corrige problemas bloqueantes antes do go/no-go.

**Cenários mínimos (8):**

| # | Cenário | Critério de sucesso |
|---|---------|---------------------|
| 1 | Lojista convidado completa cadastro/onboarding | Loja criada, 5 créditos concedidos |
| 2 | Admin concede créditos e saldo atualiza | Saldo reflete grant; extrato mostra transação |
| 3 | Geração bem-sucedida deduz crédito | Saldo decrementa; extrato mostra deduction |
| 4 | Geração com erro estorna crédito | Saldo restaurado; extrato mostra refund |
| 5 | Saldo aparece na topbar, dashboard e /conta | Três locais consistentes |
| 6 | Extrato mostra transações corretamente | Tipos, valores, datas, saldo before/after |
| 7 | Admin visualiza campanha com erro e identifica causa | Página de erros funcional |
| 8 | Admin visualiza audit log e reconcilia ação | Histórico completo |

**Plano de execução:**

| Etapa | Descrição |
|-------|-----------|
| 1 | Preparar grupo de 3-5 lojistas para rollout controlado |
| 2 | Rodar UAT com 1-2 lojistas inicialmente |
| 3 | Registrar evidências: data, usuário/loja, cenário, resultado, bugs, severidade, decisão |
| 4 | Corrigir problemas bloqueantes encontrados |
| 5 | Reexecutar cenários afetados |
| 6 | Revisão final com time: métricas, feedback qualitativo, bugs pendentes, riscos aceitos |
| 7 | Decisão: expandir / pausar / manter controlado |

---

## Estrutura de Código

```
ARQUIVOS NOVOS (loading.tsx — 12 rotas):
═════════════════════════════════════════════

src/app/(app)/
  dashboard/
    loading.tsx                          ← skeleton de cards + saldo
  campanhas/
    loading.tsx                          ← skeleton de lista de campanhas
    nova/
      loading.tsx                        ← skeleton de formulário
    [id]/
      loading.tsx                        ← skeleton de preview + copy
  conta/
    loading.tsx                          ← skeleton de perfil + extrato
  loja/
    loading.tsx                          ← skeleton de identidade
  admin/
    loading.tsx                          ← skeleton de admin dashboard
    users/
      loading.tsx                        ← skeleton de tabela
      [id]/
        loading.tsx                      ← skeleton de detalhe
    campaigns/
      errors/
        loading.tsx                      ← skeleton de lista de erros
    audit-log/
      loading.tsx                        ← skeleton de audit
    metrics/
      loading.tsx                        ← skeleton de cards


ARQUIVOS NOVOS (error.tsx — 2 grupos):
═════════════════════════════════════════════

src/app/
  (app)/
    error.tsx                            ← fallback genérico, botão "Tentar novamente"
  (app)/
    admin/
      error.tsx                          ← fallback admin, sem vazar detalhes


ARQUIVOS NOVOS (componentes):
══════════════════════════════

src/components/
  ui/
    error-state.tsx                      ← componente reutilizável de error state
                                         (ícone, título, descrição, action)
    loading-skeleton.tsx                 ← variantes de skeleton:
                                           card, table, form, preview, stats


ARQUIVOS MODIFICADOS:
══════════════════════

src/components/
  ui/
    empty-state.tsx                      ← revisar props se necessário
    skeleton.tsx                         ← estender com shimmer dark mode
    card.tsx                             ← garantir dimensões estáveis

src/app/(app)/
  campanhas/
    page.tsx                             ← empty state de busca sem resultados
    nova/
      page.tsx                           ← microcopy, saldo insuficiente, mobile
    [id]/
      page.tsx                           ← error states, microcopy, mobile
  conta/
    page.tsx                             ← empty state transações, mobile, microcopy
  admin/
    metrics/
      metrics-cards.tsx                  ← mobile (cards adaptados)
      health-banner.tsx                  ← mobile
    campaigns/
      errors/
        page.tsx                         ← empty state "Nenhum erro"
    users/
      [id]/
        page.tsx                         ← error states, microcopy


DOCUMENTAÇÃO NOVA:
══════════════════

docs/
  launch-readiness/
    channel-feedback.md                  ← decisão do canal, SLA, responsável
    expansion-pause-criteria.md          ← critérios documentados e aprovados
    cleanup-90d-decision.md              ← decisão D8 registrada
    uat-results/
      2026-07-xx-uat-session-1.md        ← evidências do UAT
      ...


DOCUMENTAÇÃO MODIFICADA:
═════════════════════════

docs/
  operations/
    support-runbook.md                   ← validar comando cleanup
```

---

## Contratos de UI/UX

### Loading.tsx — padrão de implementação

```typescript
// src/app/(app)/campanhas/loading.tsx
// Skeleton para lista de campanhas. Mantém dimensões estáveis
// para evitar layout shift. Shimmer adaptado ao dark mode.
import { Skeleton } from "@/components/ui/skeleton";

export default function CampanhasLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Regras:**
- `Skeleton` usa shimmer via CSS (`animate-pulse` no light, opacidade variável no dark)
- Prévia de campanha preserva aspect ratio 1:1 (`aspect-square`)
- Cards têm altura definida para evitar CLS durante navegação SPA
- Tabelas admin mantêm linhas de altura consistente

### Error.tsx — padrão de implementação

```typescript
// src/app/(app)/error.tsx
// Error boundary do grupo autenticado. Mensagem clara,
// sem jargão técnico, com caminho de recuperação.
"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold">Algo deu errado</h2>
      <p className="max-w-md text-center text-muted-foreground">
        Não foi possível carregar esta página. Tente novamente ou entre em contato
        com o suporte se o problema persistir.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-6 py-2 text-primary-foreground"
      >
        Tentar novamente
      </button>
    </div>
  );
}
```

**Regras para error.tsx admin:**

```typescript
// src/app/(app)/admin/error.tsx
// Admin error boundary — mensagem segura, sem dados técnicos.
// Admin também é usuário; não vazar stack trace, connection string
// ou outros detalhes internos mesmo em ambiente admin.
```

### Empty State — componente e usos

```typescript
// src/components/ui/empty-state.tsx (existente, manter padrão)
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

// Uso:
// Sem campanhas:
<EmptyState
  icon={<MegaphoneIcon />}
  title="Nenhuma campanha ainda"
  description="Crie sua primeira campanha e comece a divulgar seus produtos."
  action={{ label: "Criar campanha", href: "/campanhas/nova" }}
/>

// Busca sem resultados:
<EmptyState
  title="Nenhuma campanha encontrada"
  description="Tente ajustar sua busca ou limpar os filtros."
  action={{ label: "Limpar filtros", onClick: () => setSearch("") }}
/>

// Sem transações:
<EmptyState
  title="Nenhuma transação ainda"
  description="Seu extrato será preenchido conforme você usar seus créditos."
/>

// Saldo zero:
<EmptyState
  title="Créditos insuficientes"
  description="Você precisa de créditos para gerar uma campanha."
  action={{ label: "Solicitar créditos", href: "/conta#creditos" }}
/>
```

### Mobile breakpoints — regras CSS

```css
/* Viewports 320-768px */
/* Sem overflow horizontal */
/* Touch targets >= 44px */
/* Botões não sobrepostos */

/* Admin em mobile: triagem mínima */
@media (max-width: 640px) {
  .admin-table {
    /* Tabela responsiva: cards em vez de colunas */
    @apply block;
  }
  .admin-table thead {
    @apply hidden; /* Esconde header em mobile */
  }
  .admin-table tr {
    @apply mb-2 block rounded-lg border p-3;
  }
  .admin-table td {
    @apply block text-sm;
  }
}
```

### Legibilidade da peça — checklist embutido

```typescript
// Critérios de legibilidade. Usado para verificação visual
// durante a auditoria pré-UAT. Não é componente de produção.
export const LEGIBILITY_CHECKLIST = [
  { id: "contrast", label: "Contraste mínimo (texto sobre fundo)" },
  { id: "hierarchy", label: "Preço como elemento principal" },
  { id: "safezone", label: "Texto dentro das margens de segurança" },
  { id: "cta", label: "CTA visual (não botão interativo)" },
  { id: "product", label: "Produto principal inteiro visível" },
  { id: "no-emoji", label: "Nenhum emoji na arte final" },
] as const;
```

---

## Testes

Diferente das fases anteriores (que adicionaram novos serviços e módulos com testes unitários), a F29 é predominantemente visual e operacional. Os testes são:

### Regressão obrigatória

| # | Teste | O que valida |
|---|-------|--------------|
| 1 | `npm run build` | Build bem-sucedido |
| 2 | `npm run typecheck` | Zero erros de tipo |
| 3 | `npm run lint` | Zero erros de lint |
| 4 | `npx vitest run` | ~889 testes existentes + novos passando |

### Testes de loading states (verificação visual — checklist manual)

| # | Teste | O que valida |
|---|-------|--------------|
| 5 | Navegar para /dashboard | loading.tsx exibe skeleton antes do SSR |
| 6 | Navegar para /campanhas | loading.tsx exibe skeleton de lista |
| 7 | Navegar para /campanhas/nova | loading.tsx exibe skeleton de formulário |
| 8 | Navegar para /campanhas/[id] | loading.tsx exibe skeleton de preview |
| 9 | Navegar para /conta | loading.tsx exibe skeleton de perfil |
| 10 | Navegar para /loja | loading.tsx exibe skeleton de identidade |
| 11 | Navegar para /admin/* | loading.tsx exibe skeleton admin |
| 12 | Shimmer funciona em dark mode | Skeleton visível sem animação colorida |
| 13 | Sem layout shift durante transição loading → conteúdo | Dimensões estáveis |

### Testes de error states (verificação visual — checklist manual)

| # | Teste | O que valida |
|---|-------|--------------|
| 14 | Simular erro em rota (app) → error.tsx aparece | Fallback genérico |
| 15 | Simular erro em /admin → error.tsx admin | Mensagem segura |
| 16 | Botão "Tentar novamente" em error.tsx → reset() funciona | Recuperação |

### Testes de empty states (verificação visual)

| # | Teste | O que valida |
|---|-------|--------------|
| 17 | Sem campanhas → empty state com CTA "Criar primeira campanha" | Correto |
| 18 | Busca sem resultados → empty state com "Nenhuma encontrada" + limpar filtros | Correto |
| 19 | Conta sem transações → empty state informativo | Correto |
| 20 | Admin sem métricas → empty state "Aguardando dados" | Correto |
| 21 | Admin sem erros → empty state "Nenhum erro" | Correto |

### Testes de mobile (dispositivo real ou emulador — 320-768px)

| # | Teste | O que valida |
|---|-------|--------------|
| 22 | /campanhas/nova — formulário, botão gerar, saldo | Sem overflow, touch OK |
| 23 | /campanhas — lista, busca | Cards adaptados |
| 24 | /campanhas/[id] — preview, copy, ações | Preview adaptado |
| 25 | /conta — saldo, extrato, paginação, CTA | Legível, touch OK |
| 26 | /admin/* — tabelas, ações | Triagem mínima |
| 27 | /admin/metrics — cards, health banner | Legível em viewport estreito |
| 28 | Modal de crédito — mobile | Utilizável, botões não sobrepostos |

### Testes de microcopy

| # | Teste | O que valida |
|---|-------|--------------|
| 29 | Revisar /campanhas/nova — título, placeholder, tooltips | Sem jargão técnico |
| 30 | Revisar erro de saldo insuficiente | "Créditos insuficientes" + CTA |
| 31 | Revisar erro de rate limit | "Você atingiu o limite" + quando volta |
| 32 | Revisar geração pausada | "Geração temporariamente indisponível" |
| 33 | Revisar "Solicitar créditos" / "Fale com o time" | Consistente em todo o produto |

### Testes de legibilidade da peça

| # | Teste | O que valida |
|---|-------|--------------|
| 34 | Contraste texto/fundo | WCAG AA |
| 35 | Hierarquia visual — preço como principal | Elemento mais destacado |
| 36 | Safe zones — texto dentro das margens | Sem corte |
| 37 | CTA visual (não botão interativo) | Elemento da campanha |
| 38 | Produto não cortado | Inteiro visível |
| 39 | Sem emojis na arte final | Zero emojis |

### Testes operacionais

| # | Teste | O que valida |
|---|-------|--------------|
| 40 | Cleanup SQL: `SELECT public.cleanup_generation_events_90d()` | Função executa sem erro |
| 41 | Métricas /admin/metrics — dados coerentes | Cards populados |
| 42 | Health state — healthy/attention/pause consistente | Thresholds corretos |
| 43 | Launch flags — verificar cada flag em .env | Funcionais |

### UAT externo (8 cenários)

| # | Cenário | Critério de sucesso |
|---|---------|---------------------|
| 44 | Cadastro/onboarding completo | Loja criada + 5 créditos |
| 45 | Admin concede créditos | Saldo atualiza + extrato |
| 46 | Geração bem-sucedida deduz crédito | Saldo −1 + deduction |
| 47 | Geração com erro estorna crédito | Saldo restaurado + refund |
| 48 | Saldo visível em topbar, dashboard e /conta | Consistente |
| 49 | Extrato com transações corretas | Tipos, valores, datas OK |
| 50 | Admin vê erro e identifica causa | Página de erros funcional |
| 51 | Admin vê audit log e reconcilia | Histórico completo |

### Teste de build e regressão

| # | Teste | O que valida |
|---|-------|--------------|
| 52 | `npm run build` | Build OK |
| 53 | `npm run typecheck` | Types OK |
| 54 | `npm run lint` | Lint OK |
| 55 | `npx vitest run` | Testes OK |

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Escopo creep** — "já que estamos polindo, vamos melhorar X" | Fora de escopo explícito neste documento. Auditoria classifica achados como Blocker/F29/Accept/Post-v1.5. Só Blocker e Fix entram na F29 |
| **UAT inconclusivo** — lojista não completa os cenários ou não dá feedback | 8 cenários estruturados. Canal de feedback direto (canal primário definido). Time acompanha em tempo real. Evidências registradas por sessão |
| **Mobile quebrado em dispositivo real** — testamos 320-768px em emulador mas falha em mobile real | Testar em dispositivos reais antes do UAT. Responsividade é critério de aceite (checklist manual) |
| **Microcopy inconsistente** — revisão parcial deixa termos soltos no produto | Revisão cobre todos os fluxos obrigatórios. Revisão cruzada entre membros do time |
| **Peça gerada não publicável** — arte final ainda parece "prototipagem" | Legibility checklist é critério de aceite. Aprovação visual do time antes do UAT |
| **Canal de feedback não usado** — canal primário fica sem engajamento | Time engaja lojistas durante UAT. Cenários são acompanhados. SLA de resposta documentado |
| **Go/No-Go ambíguo** — time não tem critérios claros para expandir | Critérios documentados e aprovados (D9). Revisão final com decisão explícita registrada |
| **Cleanup manual esquecido** — ninguém executa a função SQL | Runbook já documentado (F28). F29 valida que o comando funciona. D+30 reavalia job automático |
| **Auditoria UI/UX gera muitos achados** — time se sente sobrecarregado | Classificação em 4 níveis. Só Blocker e Fix entram na F29. Accept e Post-v1.5 são registrados e deixados para depois |
| **Falsa sensação de conclusão** — testes passam mas UX ainda não está boa | Critérios de aceite incluem verificação visual e UAT com lojistas reais. Não basta build verde |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| Stripe Checkout / compra real de créditos | F30/v1.6 (pós-beta). Decisão D7 |
| Planos, assinaturas ou pacotes pagos | F30/v1.6 |
| Múltiplas lojas por usuário (1:N) | Relação 1:1 mantida |
| Editor visual livre / Canva-like | Fora do core de geração guiada |
| Teste A/B | Fora do escopo da v1.5 |
| Otimização de conversão | Pós-lançamento |
| Redesenho amplo da UI | F29 valida contra design system existente, não redesenha |
| Integração com Instagram (API) | Milestone futura |
| Analytics de negócio avançado (receita, LTV, cohorts) | Fora do core da v1.5 |
| Novos formatos além de 1080x1080 feed | Apenas feed na v1.5 |
| Job automático de cleanup 90d | Adiado para D+30 ou antes. Decisão D8 |
| Redesenho de navegação mobile | Escopo mobile limitado (D3). F22 não é refatorada |
| Experiência admin mobile-first | Admin em mobile é triagem mínima, não redesign |
| Dashboard com gráficos/séries temporais | Mantido como cards (F28). Gráficos são pós-v1.5 |
| Alertas push (Slack, email, webhook) | Health states + runbook são suficientes (F28) |
| Sync de ROADMAP.md / STATE.md / REQUIREMENTS.md | Fora do artefato de alinhamento. GSD trata no planejamento |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Fonte de verdade visual: openspec/design-system soberano, ui-ux-pro-max como apoio consultivo
- [ ] D2 — Loading, error e empty states em rotas críticas (12 loading.tsx, 2 error.tsx, 7 empty states)
- [ ] D3 — Escopo mobile: regressão F22 + verificação de áreas novas F23-F28
- [ ] D4 — Microcopy PT-BR: tom comercial, sem jargão, orientado a ação
- [ ] D5 — Legibilidade da peça: checklist com 6 critérios de publicabilidade
- [ ] D6 — Canal de feedback: EM DISCUSSÃO (WhatsApp recomendado)
- [ ] D7 — Monetização pública: fora da F29, F30/v1.6
- [ ] D8 — Cleanup 90d: runbook mantido, job automático adiado, revisão D+30
- [ ] D9 — Critérios de expansão, pausa e go/no-go documentados
- [ ] D10 — UAT externo com 8 cenários, evidências e correção de bloqueantes

### Loading states
- [ ] `/dashboard` — loading.tsx com skeleton de cards + saldo
- [ ] `/campanhas` — loading.tsx com skeleton de lista
- [ ] `/campanhas/nova` — loading.tsx com skeleton de formulário
- [ ] `/campanhas/[id]` — loading.tsx com skeleton de preview + copy
- [ ] `/conta` — loading.tsx com skeleton de perfil + extrato
- [ ] `/loja` — loading.tsx com skeleton de identidade
- [ ] `/admin` — loading.tsx com skeleton de admin
- [ ] `/admin/users` — loading.tsx com skeleton de tabela
- [ ] `/admin/users/[id]` — loading.tsx com skeleton de detalhe
- [ ] `/admin/campaigns/errors` — loading.tsx com skeleton de erros
- [ ] `/admin/audit-log` — loading.tsx com skeleton de audit
- [ ] `/admin/metrics` — loading.tsx com skeleton de cards
- [ ] Skeletons preservam aspect ratio em prévias de campanha
- [ ] Shimmer adaptado ao dark mode (opacidade, não cor)
- [ ] Cards e tabelas com dimensões estáveis (sem layout shift)

### Error boundaries
- [ ] `(app)/error.tsx` — fallback genérico com "Tentar novamente"
- [ ] `(app)/admin/error.tsx` — fallback sem vazar detalhes internos
- [ ] Botão reset() funcional em ambos

### Empty states
- [ ] Sem campanhas → ilustração + "Criar primeira campanha"
- [ ] Busca sem resultados → "Nenhuma encontrada" + limpar filtros
- [ ] Sem transações → "Nenhuma transação ainda"
- [ ] Admin sem lojas → "Nenhum lojista cadastrado"
- [ ] Admin sem métricas → "Aguardando dados de geração"
- [ ] Admin sem erros → "Nenhum erro registrado"
- [ ] Saldo zero → "Você precisa de créditos" + CTA

### Error states específicos
- [ ] Falha de geração → explica + recuperação (estorno automático transparente)
- [ ] Saldo insuficiente → "Créditos insuficientes" + CTA (não tratado como erro de sistema)
- [ ] Rate limit → "Você atingiu o limite" + quando volta
- [ ] Geração pausada (503) → banner + CTA
- [ ] Erro admin → mensagem segura, sem stack trace

### Microcopy
- [ ] `/campanhas/nova` — título, placeholder, tooltips, botão sem jargão
- [ ] `/campanhas` — título, busca vazia, filtros
- [ ] `/campanhas/[id]` — status, ações, metadados
- [ ] `/conta` — saldo, extrato, CTA de créditos
- [ ] `/dashboard` — cards, boas-vindas, dicas
- [ ] `/loja` — formulário, upload
- [ ] Admin — ações sem jargão interno desnecessário
- [ ] Erro de saldo → "Créditos insuficientes"
- [ ] Erro de rate limit → "Você atingiu o limite"
- [ ] Geração pausada → "Geração temporariamente indisponível"
- [ ] "Solicitar créditos" e "Fale com o time" consistentes em todo o produto

### Mobile 320-768px
- [ ] `/campanhas/nova` — sem overflow, touch targets, botão não sobreposto
- [ ] `/campanhas` — cards adaptados
- [ ] `/campanhas/[id]` — preview adaptado
- [ ] `/conta` — saldo, extrato, paginação legíveis
- [ ] Admin triagem mínima
- [ ] `/admin/metrics` — cards adaptados
- [ ] Modal de crédito utilizável em mobile
- [ ] Touch targets >= 44px
- [ ] Zero overflow horizontal
- [ ] Textos não cortados

### Legibilidade da peça
- [ ] Contraste mínimo (WCAG AA)
- [ ] Preço como elemento principal
- [ ] Texto dentro das safe zones
- [ ] CTA visual (não botão interativo)
- [ ] Produto principal inteiro visível
- [ ] Sem emojis na arte final
- [ ] Aprovação visual do time

### Canal de feedback (EM DISCUSSÃO)
- [ ] Canal primário definido (WhatsApp ou Discord)
- [ ] Canal fallback definido (email)
- [ ] SLA de resposta documentado
- [ ] Responsável pelo monitoramento definido
- [ ] Onde o link aparece no produto decidido

### Critérios de expansão/pausa
- [ ] 7 dias verdes para expansão documentado
- [ ] Condições de pausa documentadas
- [ ] Aprovação explícita do time para go/no-go

### UAT externo
- [ ] 8 cenários preparados
- [ ] 3-5 lojistas convidados
- [ ] 1-2 lojistas rodaram UAT inicial
- [ ] Evidências registradas (data, usuário, cenário, resultado, bugs)
- [ ] Bugs bloqueantes corrigidos ou formalmente aceitos
- [ ] Cenários afetados reexecutados
- [ ] Revisão final com time realizada
- [ ] Decisão explícita: expandir / pausar / manter controlado

### Métricas de saúde
- [ ] `/admin/metrics` visível e coerente
- [ ] Thresholds (taxa de sucesso, erro rate, custo médio, tempo médio, refund rate) alinhados com milestone
- [ ] Health state funcional

### Launch flags
- [ ] `VENDEO_V15_ENABLED` ativa em UAT/lançamento controlado
- [ ] `VENDEO_CREDITS_CHARGING_ENABLED` verificada
- [ ] `VENDEO_COPY_DIRECTOR_ENABLED` verificada
- [ ] `VENDEO_RATE_LIMIT_ENABLED` verificada
- [ ] `VENDEO_GENERATION_PAUSED` verificada (desativada em UAT)

### Cleanup 90d
- [ ] Função SQL `cleanup_generation_events_90d()` executada sem erro
- [ ] Runbook em `docs/operations/support-runbook.md` referencia comando correto
- [ ] Decisão de job automático adiado registrada em `docs/launch-readiness/`
- [ ] Revisão D+30 agendada ou critérios para antecipação documentados

### Regressão
- [ ] `npm run build` — build bem-sucedido
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npx vitest run` — ~889 testes + novos passando
- [ ] Nenhuma rota existente quebrada por loading/error/empty state novo
- [ ] UAT local: fluxo completo de geração funciona como antes

---

*Documento criado: 2026-07-19*
*Baseado no alinhamento da milestone v1.5, conclusão da F28, auditoria pós-F28 e discussão de escopo entre agente e usuário.*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via GSD.*
