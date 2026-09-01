# Alinhamento Fase 37 — Revisão e Aprovação da Arte (v1.5)

> **Renumeração (vigente):** F37 = **Revisão e Aprovação da Arte** (v1.5, experimento beta controlado). F38 = **Tabela de Custos por Operação** (v1.5, **CONCLUÍDA** — com desdobramentos 38.1 Apuração de Custos de IA, 38.2 Admin de Custos Operacionais + Configurações Econômicas e 38.2.1 Snapshot Econômico). F39 = **Brief Estruturado de Campanha** (v1.5, **CONCLUÍDA** — `campaign_brief_v1` versionado em `campaigns.input_snapshot`). **Desde então foram concluídas:** F40 (Campos Comerciais e Avisos do Brief), F41 (Mídia de Campanha Mobile — inputs persistidos com `media.images[].storagePath`), F42 (Signup Controlado) e F43 (Revisão do Brief Pré-Geração — padrão `feature_flags`/`FeatureFlagService`). **Stripe / Monetização Pública** está **fora da numeração** (iniciativa diferida v1.7+, não numerada). A seção **D11** deste documento documenta o que a F37 deve atualizar/confirmar ao planejar (consolidado nos alinhamentos F38/F39 e atualizado nesta revisão de 2026-09-01).

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
  ├── F36 — Onboarding: Navegação por Abas                        ✓
  ├── F38 — Tabela de Custos por Operação                         ✓ (38.1/38.2/38.2.1)
  ├── F39 — Brief Estruturado de Campanha (campaign_brief_v1)     ✓
  ├── F40 — Campos Comerciais e Avisos do Brief                   ✓
  ├── F41 — Mídia de Campanha Mobile (inputs persistidos)         ✓
  ├── F42 — Signup Controlado e Elegibilidade Freemium            ✓
  ├── F43 — Revisão do Brief Pré-Geração                          ✓
  └── F37 — Revisão e Aprovação da Arte                           ← esta fase
        (experimento controlado beta, human-in-the-loop)

Stripe / Monetização Pública: fora da numeração (v1.7+, diferida).
F44 (Temas de Campanha): em andamento separado — F44.3 depende da
aprovação confiável da F37 (ver Decisão 15).
```

O Vendeo hoje gera a campanha e a entrega no exato momento em que ela fica `ready`: o lojista cai direto na página com download + Kit de Publicação. Não existe passo de aprovação da arte. O problema estratégico é a **confiança**: o valor central do produto é entregar uma "campanha publicável", mas a primeira geração pode não agradar — e hoje o único caminho é gerar outra campanha (gastando outro crédito) ou desistir.

**Oportunidade:** transformar a primeira entrega em um **ciclo de revisão guiado** — o lojista aprova a arte ou pede ajuste (com motivo), o diretor de imagem regenera com o feedback, e a campanha só é **entregue** (download + copys) após a aprovação. Isso muda a percepção de "ferramenta que gera uma imagem" para "serviço que entrega uma campanha aprovada".

**Este é um experimento controlado para beta testers (feature flag), não uma feature comercial ampla.** Objetivo do experimento: descobrir se **duas correções guiadas aumentam a aprovação/confiança sem destruir a margem**. O padrão de rejeição/feedback já existe e está comprovado na assinatura visual (F29.1.1) — o trabalho é portar esse padrão para a campanha com versionamento, hard cap de versões e telemetria de custo.

**A F37 herda a F39 concluída:** o briefing já é estruturado e versionado (`campaign_brief_v1` em `campaigns.input_snapshot`, domínio `CampaignBrief` em `src/lib/campaign/brief.ts`). A regeração **consome esse snapshot** — não re-monta contexto a partir do `input_snapshot` bruto — e o guard de imutabilidade da oferta compara o feedback contra os **campos estruturados do brief** (produto, preço, desconto, validade, aviso legal, intent), não por heurística de texto livre apenas.

---

## Propósito

1. **Revisão como etapa obrigatória** — após gerar, o lojista vê a arte em tela de revisão e decide: **Aprovar e liberar campanha** ou **Corrigir**
2. **Download e copys bloqueados até aprovar** — reforça o modelo mental de agência ("revise antes de receber a entrega final"); nada de download parcial de arte não aprovada
3. **Política beta: 1 campanha paga/crédito = 1 arte aprovada, com até 2 correções guiadas incluídas** — v1 gerada; v2 e v3 via correção com feedback; **sem "v4 paga", sem meia cobrança por correção, sem nova reserva de crédito** no beta; se ainda não gostou → orientar criar nova campanha ou acionar suporte
4. **Correção guiada por texto livre + parser leve obrigatório** — modal de revisão em **2 etapas (decisão 14)**: ETAPA 1 **[Aprovar / Corrigir]**, ETAPA 2 "O que você quer ajustar nesta arte?" (campo livre obrigatório) com **[Aplicar correção] / [Cancelar correção]**; um **Correction Brief Parser** leve classifica o pedido (`visual_adjustment` | `creative_remake` | `unclear` | `blocked_new_campaign` — decisão 13) antes de decidir se o diretor é chamado (motivos rápidos apenas como apoio opcional, nunca substituem o texto). **Texto válido vai CRU ao diretor** (sem parafrasear), acompanhado de **instrução fixa anti pixel-perfect** (decisão 8)
5. **Imutabilidade estratégica + correção factual controlada** — feedback pode alterar estética/composição/legibilidade/destaque/enquadramento/estilo; **mudança estratégica/comercial** (outro produto, mecânica de oferta, intent) **bloqueada** com orientação a nova campanha; **correção factual de briefing** (preço, validade, aviso legal, desconto, erro de digitação) **permitida pré-aprovação** dentro do cap, sem custo extra — validada por comparação contra o `campaign_brief_v1`
6. **Uma arte candidata por vez** — a correção **substitui** a arte atual; a versão rejeitada não fica disponível para aprovação posterior (modelo mental: "revisão corrige/substitui a entrega atual, não abre galeria de variações")
7. **Lifecycle de storage limpo** — a arte rejeitada é **descartada** no momento em que a regeração tem sucesso (arquivo removido; linha preservada apenas como histórico textual/telemetria); ao aprovar, apenas a arte aprovada permanece como conteúdo entregue
8. **Copy fora da regeração** — a correção regenera **só a arte**; copy é editável (F17) e independente da arte
9. **Estratégia de correção experimentável** — aposta para v2: **arte candidata atual como referência principal** + **imagens do produto (snapshot F41) como referências auxiliares** (decisão 7); a variação `text_only` × `text_plus_reference` e o mecanismo de ativação (flag DB/valor) ficam **definidos na 37.2** (decisão 1)
10. **Telemetria de experimento no modelo F38.1+** — medir por campanha (mesmo `operation_run_id` reaberto): aprovação em v1/v2/v3, motivo/ tipo de correção, custo real por campanha aprovada (call-level + snapshots econômicos), tempo até aprovação
11. **Parser como porta de entrada (não aceita tudo)** — texto `unclear`/`blocked_new_campaign` **não** chama o Image Director e **não consome correção**; o sistema pede esclarecimento humano com exemplo (D4.1/decisão 13)

**Entrega verificável:**
- `/campanhas/{id}` exibe tela de revisão quando a campanha não está aprovada (sem download, sem copy visível)
- Botão primário "Aprovar e liberar campanha" + secundário "Corrigir" (modal em 2 etapas "O que você quer ajustar nesta arte?" com preview, **campo livre obrigatório** e botões **[Aplicar correção] / [Cancelar correção]**, decisão 14) — **modal e correção só a partir da 37.2; na 37.1 o secundário é ausente/desabilitado e não abre modal**
- Até 2 regerações por campanha; ao exceder, orientação para criar nova campanha / falar com o suporte (sem v4 paga)
- **Correction Brief Parser leve**: classifica o pedido em intenção estruturada antes da regeração (decisão 13); texto `unclear`/`blocked_new_campaign` não chama o diretor e não consome correção
- Correção factual de briefing (37.3: preço/validade/aviso legal + aviso ilustrativo/badge e chamada comercial/digitação — decisão 10) permitida pré-aprovação — atualiza o **snapshot da próxima versão**; v1 preserva o snapshot antigo como histórico
- Regeneração consome o snapshot `campaign_brief_v1` (F39) + **texto cru do usuário com instrução fixa anti pixel-perfect** (decisão 8), reabre o `operation_run_id` da campanha (F38.1), roda **só o Image Director** (sem copy, sem validação de input, **sem nova reserva de crédito**) e persiste nova versão — com **arte candidata como referência principal + imagens do produto (F41) como auxiliares** na correção cirúrgica (decisões 6/7)
- Aprovação é transacional: aprova a **candidata** e atualiza `campaigns` para a arte oficial (rejeitadas já foram descartadas na regeração com sucesso)
- Uma arte candidata por vez; histórico textual de ajustes (sem preview das artes descartadas)
- Flag `campaign_approval_enabled` na tabela **`feature_flags`** (padrão F43/QCW — leitura via `FeatureFlagService`, tela admin "Controles operacionais", fallback fail-closed) — **sem env/launch-config** para o flag principal (decisão 1); estratégia de correção definida na 37.2
- Estado **legacy explícito**: campanhas antigas sem `campaign_art_versions` permanecem entregues mesmo com flag ligada
- Telemetria: eventos call-level (`campaign_image`) com `version_number`/tipo de correção/motivo em metadata + `campaign_art_versions` como fonte do funil; métricas admin de custo por campanha aprovada via painel F38.2
- `npm run typecheck`, `npm run lint`, `npx vitest run` — zero erros

---

## Estado Atual (pós-F39)

```
                                        ANTES (F39)                       DEPOIS (F37)
═══════════════════════════════════════════════════════════════════════════════════════════

Briefing:
  Persistência                     input_snapshot flat (pré-F39)         input_snapshot = campaign_brief_v1 (F39, sem base64)
  Regeneração                      re-montar briefing manualmente        consome o snapshot versionado do brief (F39)
  Guard de oferta                  heurística de texto livre             comparação contra campos estruturados do campaign_brief_v1

Entrega da campanha:
  Gate de aprovação                inexistente                          aprovação obrigatória antes da entrega (flag on, campanha nova)
  Download                         disponível ao ficar ready             bloqueado até aprovar (release pós-aprovação)
  Kit de Publicação                visível/editável                     oculto até aprovar (revisão = foco na arte)
  Campanhas legadas (pré-flag)     entregues como hoje                   entregues como hoje (estado legacy explícito)

Revisão:
  Decisão do lojista               nenhuma                              Aprovar / Corrigir (modal)
  Campo livre de feedback          —                                    OBRIGATÓRIO (orienta a correção; motivos rápidos opcionais como apoio)

Versões da arte:
  Conceito                         inexistente (1 imagem/campanha)      campaign_art_versions (v1..v3, cap 3) — 1 candidata por vez
  Referência ao brief              —                                    brief_snapshot por versão (campaign_brief_v1 — compatível F39)
  Arte candidata                   —                                    1 por vez; correção substitui (rejeitadas não voltam a ser aprováveis)
  Artes rejeitadas                 —                                    asset descartado na regeração com sucesso; linha preservada como histórico
  Status de versão                 —                                    pending | approved | rejected (+ asset_status active | discarded)

Correção:
  Interpretação do pedido          —                                    Correction Brief Parser (texto livre → intenção estruturada; obrigatório)
  Referência da correção           —                                    arte candidata (principal) + imagem do produto (secundária/contexto)
  Correção factual de briefing     —                                    permitida pré-aprovação (consome correção; atualiza snapshot da próxima versão)
  Mudança estratégica/comercial    —                                    bloqueada (orienta nova campanha)
  Feedback no diretor              —                                    texto cru do usuário + instrução fixa anti pixel-perfect (decisão 8)
  Copy na correção                 —                                    NÃO regenera copy (só arte)
  Imagens do produto           não persistido                      persistidas na geração (F41 — inputs/{imageId}.jpg) p/ reuso na regeração

Créditos:
  Unidade de entrega               1 crédito/geração                    1 crédito = 1 campanha APROVADA (correções incluídas)
  Cobrança por versão extra        —                                    inexistente (sem v4, sem meia cobrança no beta)
  Nova reserva na regeração        —                                    NÃO (mesma reserva/operação da geração inicial)

Storage:
  Arte não aprovada                —                                    arquivo descartado; linha/versionamento preservado sem `storage_path`, p/ auditoria/telemetria
  Histórico de rejeição            —                                    preservado em texto/metadados p/ analytics

Telemetria (F38.1+):
  Agrupamento econômico            operation_run_id por request          mesmo operation_run_id reaberto na regeração (v1+v2+v3 = 1 entrega)
  Eventos                          eventos call-level (AiCostTracker)    campaign_image por versão + metadata (version/strategy/reason)
  Custo                            estimated_cost_usd                   call-level + provider_reported + snapshots econômicos (38.2.1)
  Funil de aprovação               inexistente                          campaign_art_versions + motivos; custo por campanha aprovada no painel F38.2
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F37) |
|------|-------------------|------------------|
| **Natureza da feature** | Feature ampla de aprovação | **Experimento controlado beta** (feature flag, beta testers) com objetivo de medir aprovação × margem |
| **Unidade de entrega** | "Até 3 gerações" como benefício | **1 campanha paga/crédito = 1 arte aprovada** (v1 + até 2 correções incluídas). O lojista paga pela campanha **aprovada**, não por tentativa interna. Não vender "3 tentativas grátis" — a mensagem é de **revisão de entrega**, não buffet de geração |
| **Download antes de aprovar** | Recomendado livre | **Bloqueado** até aprovação; botão primário "Aprovar e liberar campanha" |
| **Copy antes de aprovar** | Visível/editável na revisão | **Oculto até aprovar** (decisão do Q&A) |
| **v4+ paga / meia cobrança por correção** | Prevista na exploração | **Fora do beta** — cap 2 correções; sem cobrança de correção (erro de IA não pode ser cobrado do usuário); reabrir hipótese **só com dados** (custo real, aprovação v1/v2/v3, motivos) e provavelmente apenas para "nova variação criativa", não "correção" |
| **Tratamento das rejeições (3 casos)** | — | Tabela abaixo: ajuste visual / correção factual / mudança estratégica |
| **Crédito** | Poderia mudar a unidade econômica | **Unidade = campanha aprovada** (1 crédito), regerações incluídas; telemetria valida antes de virar política comercial |
| **Feedback que altera a oferta** | "Prioridade absoluta" (padrão VS) — sempre bloquear | **Classificado pelo parser (D4.1)**: **correção factual** (preço/validade/aviso legal/desconto/digitação errados) **permitida pré-aprovação** e auditada; **mudança estratégica** (outro produto, mecânica de oferta, intent) **bloqueada** → nova campanha. Comparado contra os campos estruturados do `campaign_brief_v1` |
| **Como capturar o pedido de correção** | Retorno ao formulário completo / motivos rápidos | **Modal de revisão da arte em 2 etapas (decisão 14)** ("O que você quer ajustar nesta arte?") com preview, **campo livre obrigatório** e botões **[Aplicar correção]/[Cancelar correção]** — não volta ao form, não induz expectativa de "refazer briefing" |
| **Estratégia de correção** | Fork A (texto) vs Fork B (texto+referência) | **Correção com referência na 37.2** (decisões 1/5/6/7): aposta v2 = **arte candidata atual como referência principal + imagens do produto (snapshot F41) como auxiliares**, com **texto cru + instrução fixa anti pixel-perfect** (decisão 8); variação `text_only` × `text_plus_reference` e mecanismo de ativação decididos na 37.2 |
| **Versões anteriores aprováveis (galeria)** | Explorada na discussão inicial | **Removida** — uma arte candidata por vez; correção **substitui** a entrega atual; rejeitadas não voltam a ser aprováveis (evita ensinar "rejeitar = ganhar variações") |
| **Storage** | Manter todas as versões | **Só a candidata/aprovada permanece** com arquivo; rejeitadas descartadas no momento da regeração com sucesso (asset removido; linha vira histórico textual); motivo preservado p/ analytics |
| **Briefing na regeração** | Re-montar a partir de `input_snapshot` + `identity_snapshot` | **Consome o snapshot versionado `campaign_brief_v1`** (F39 concluída) — a F37 não remonta briefing manualmente |
| **Telemetria de custo** | `generation_events` com eventos novos (`campaign_rejection`/`campaign_approval`) | **Modelo F38.1+**: reabrir o mesmo `operation_run_id` da campanha; eventos call-level via `AiCostTracker`; custo da correção = parte da mesma entrega (sem operação de crédito nova) |
| **Renumeração** | Stripe como F38 | Stripe → **F40** (v1.7); **F39 = Brief Estruturado** concluída; esta fase ocupa a **F37** (consolidado nos alinhamentos F38/F39) |

**Tabela dos 3 casos (decisão de política beta — D4/D4.1):**

| Tipo | Tratamento recomendado |
|------|------------------------|
| **Ajuste visual** (cor, estilo, composição, enquadramento, legibilidade — "gostei da arte, só muda X") | Correção **incluída, dentro do cap**; usa a **arte candidata como referência principal** (D5) |
| **Erro da IA/geração** (arte ilegível, produto deformado, preço errado na peça) | Correção **incluída, sem novo custo ao usuário** — cobrar isso quebraria a confiança em beta; vale o cap de 2 correções |
| **Correção factual de briefing** (preço/validade/aviso legal/desconto/digitação errados, percebidos na revisão) | **Permitida pré-aprovação**, dentro do cap, sem custo extra; atualiza o snapshot da **próxima versão** (v1 preserva o antigo como histórico) |
| **Mudança estratégica/comercial** (outro produto, mecânica de oferta, mudar a intenção, nova campanha disfarçada) | **Bloqueada** — orienta criar nova campanha com novo briefing |

---

## Fatiamento da Fase (37.1 / 37.2 / 37.3)

`DECIDIDO`

O escopo completo cabe conceitualmente em uma fase, mas é **grande demais para uma única execução segura** — não é só UI: envolve migration, storage, lifecycle transacional, parser com IA, alteração factual de snapshot, reuso de `operation_run_id`, gate de download/copy e prompt de imagem com referência. Seguindo o padrão da F38 (sub-fases numeradas), a F37 executa em **3 fatias obrigatórias e sequenciais** — cada uma com base técnica independente para planejamento/execução após aprovação:

| Fatia | Nome | Entrega | Decisões | Depende de |
|-------|------|---------|----------|------------|
| **37.1** | Approval Gate + Candidata Única | flag `campaign_approval_enabled` em **`feature_flags`** (decisão 1); `campaign_art_versions` (+ `asset_status` + `correction_in_progress`); estado **legacy** explícito; tela de revisão (candidata ativa — decisão 3); aprovar a candidata; download **e** `publication-copy` **gated** (decisão 4). **Correção NÃO disponível** — botão "Corrigir" ausente ou desabilitado, **nunca abre modal**. **Adiados (design futuro, NÃO requisito implementável da fatia):** Correction Brief Parser, `briefPatch`, `validateBriefPatch`, referência de arte e cap de correções | D1, D2, D7, D8 (aprovação transacional), D11 | F39 (brief v1) |
| **37.2** | Correção Visual Com Referência | modal em 2 etapas **[Aprovar]/[Corrigir]** (decisão 14); texto obrigatório; **parser leve** (`visual_adjustment` / `creative_remake` / `unclear` / `blocked_new_campaign` — decisão 13); **texto cru + instrução fixa anti pixel-perfect** (decisão 8); **arte candidata como referência principal + imagens do produto do snapshot F41 como auxiliares** (D5 · decisões 6/7); **prompts de regen em `prompts/regen/`** (decisão 16 — surgical único; remake 3 prompts por intent `{offer,spotlight,exclusive}` espelhando o diretor atual); substituição transacional (uma candidata por vez); cap de 2 correções; **"regenerating" derivado de `campaign_art_versions`** (decisão 5). **Sem correção factual de brief ainda** | D4 (modal + política visual), D4.1 (parser leve), D5 (estratégia), decisões 5–8/13/14/16, D8 (substituição/regeneração), D9 | 37.1 |
| **37.3** | Correção Factual Controlada | `briefPatch` + `validateBriefPatch`; **snapshot corrigido por versão** (histórico preservado); casos preço/validade/aviso legal + aviso ilustrativo/badge e chamada comercial/digitação (decisão 10); parser com `factual_brief_correction` (decisão 13); UAT específico de **abuso e frustração** | D4 (correção factual), D4.1 (`briefPatch`), D7 (snapshot por versão), D8 (`briefPatch`), decisão 10 | 37.2 |

**Regras de execução:**
- Uma fase única por tracking, mas com **waves/fatias obrigatórias** (padrão F38/38.1/38.2): cada fatia encerra com gates verdes antes da próxima começar
- **37.1 entrega valor parcial** — valida o modelo de aprovação **sem mexer no pipeline de imagem** (mitiga risco de regressão no core)
- **37.1 NÃO implementa correção:** todo o aparato de correção — Correction Brief Parser, `briefPatch`, `validateBriefPatch`, referência de arte e cap de correções — fica **adiado para 37.2/37.3**; na 37.1 esses contratos aparecem apenas como **design futuro** (menção no OpenSpec como contexto), nunca como requisito implementável da fatia
- **37.2 entrega o valor principal** — revisar a arte **sem abrir porta de rebriefing**
- **37.3 fica para depois da base estável** — é a parte mais delicada (auditoria de snapshot, abuso de correção factual, frustração de usuário)
- `openspec/changes/fase-37-revisao-aprovacao-arte/` organiza as fatias como 37-1/37-2/37-3 (fonte da verdade)

---

## Decisões de Alinhamento

### D1 — Experimento controlado beta (feature flag + unidade de entrega)

`DECIDIDO`

Esta fase é um **experimento**, não uma feature comercial ampla. Liberação via **flag operacional em tabela `feature_flags`** (padrão F43/QCW — **não** env/launch-config para o flag principal, decisão de revisão 2026-09-01):

```
feature_flags (tabela — padrão F43/QCW):
  key = 'campaign_approval_enabled'   ← habilita o fluxo de revisão/aprovação (default false, fail-closed)
  Leitura: FeatureFlagService.readFlag + isCampaignApprovalEnabled() (fallback seguro)
  Admin: incluir em ALL_FEATURE_FLAG_KEYS → tela "Controles operacionais" (motivo obrigatório + auditoria)
  Estratégia de correção (text_only × text_plus_reference): NÃO entra na 37.1 — decidida na 37.2 (decisão 1)
```

- Contrato F43/QCW: leitura com fallback **fail-closed** — falha de leitura/flag desligada ⇒ comportamento **exatamente o atual** (entrega imediata, download livre, copy visível); a flag **nunca** derruba o fluxo atual
- Com o flag ligado, campanhas **novas** entram no fluxo de revisão
- Env var pode existir apenas como **fail-safe emergencial de infra** (padrão `FeatureFlagService`), **nunca** como decisão principal
- **Campanhas `ready` pré-existentes permanecem intactas** (sem gate retroativo, sem backfill destrutivo) — determinadas pelo **estado legacy explícito** (D2/D7): sem linhas em `campaign_art_versions` → entregue como hoje, mesmo com flag ligada

**Objetivo mensurável do experimento** (métricas por campanha aprovada, agregadas no painel F38.2):

| Métrica | Fonte |
|---------|-------|
| Aprovação em v1 / v2 / v3 | `campaign_art_versions.status` (fonte da verdade do funil) |
| Motivo da reprovação | `campaign_art_versions.rejection_reason` + metadata do evento call-level |
| Custo real por campanha aprovada | eventos call-level do **mesmo `operation_run_id`** (reaberto na regeração) — `admin_ai_operation_costs`/painel F38.2 |
| Tempo até aprovação | `approved_at − created_at` |
| Estratégia usada (text_only × text_plus_reference) | metadata do evento de cada versão |

**Hipótese a validar:** duas correções guiadas aumentam a aprovação/confiança sem destruir a margem. Se a v2 resolver a maioria dos casos, o custo extra de IA é aceitável — e o custo das correções aparece **dentro do run da mesma entrega**, não como cobrança separada.

---

### D2 — Download e copys bloqueados até aprovação + estado legacy explícito

`DECIDIDO`

```
GERAÇÃO                        REVISÃO                        ENTREGA
┌──────────┐   ┌──────────────────────────────┐   ┌──────────────────────────────┐
│ form     │──▶│  /campanhas/{id} (revisão)    │──▶│  arte aprovada + Kit de      │
│ → gerar  │   │  ┌──────────────────────────┐  │   │  Publicação (copys) +        │
└──────────┘   │  │ [arte candidata (atual)]  │  │   │  download/cópia — como hoje  │
               │  └──────────────────────────┘  │   └──────────────────────────────┘
               │  [Aprovar e liberar campanha]│   (só após aprovação — D2/D8)
               │  [Corrigir]                 │
               │  ⚠ sem download · sem copy   │
               └──────────────────────────────┘
```

- **Antes de aprovar:** sem botão de download, sem Kit de Publicação (copy oculto — decisão do Q&A). Revisão é 100% foco na arte
- **Botão primário:** **"Aprovar e liberar campanha"** — reforça o modelo mental de agência ("revise antes de receber a entrega final")
- **Botão secundário:** **"Corrigir"** — abre o **modal de revisão da arte em 2 etapas** (D4/decisão 14) com preview da candidata, campo livre obrigatório e botões **[Aplicar correção]/[Cancelar correção]** — não volta ao formulário. **Escopo por fatia:** na **37.1** a correção **não está disponível** — o botão é **ausente ou desabilitado e nunca abre modal**; o modal (e a correção) entra na **37.2**
- **Após aprovar:** entrega como hoje — arte aprovada + copys (editáveis) + download/cópia
- A rota `GET /api/campaign/[id]/download`, a rota `POST /api/campaign/[id]/publication-copy` e a exibição do copy passam a verificar o estado de aprovação — **gate também na copy (decisão 4):** pendente bloqueia download **e** write de copy; libera ambos apenas após aprovação; **legado mantém o comportamento atual**
- A arte exibida na revisão é a **candidata ativa** — a versão com `asset_status='active'` em `campaign_art_versions` (**fonte oficial da arte exibida, decisão 3**); `campaigns.storage_path` só é usado por legado e passa a apontar para a **arte oficial aprovada** ao aprovar

**Estado legacy explícito (crítico):** a derivação `approval_status = approved ⇒ approved_version_id NOT NULL` **não pode** tornar uma campanha legada em "pending_approval". O estado de entrega passa a ser:

```
ApprovalDisplayState (src/lib/campaign/display.ts):
  { status: "not_enabled" }   // flag off → comportamento atual (entrega livre)
  { status: "legacy" }        // flag on, campanha PRÉ-flag (sem campaign_art_versions) → entregue como hoje, SEM gate
  { status: "pending" }       // flag on, campanha nova, não aprovada → revisão (gate download/copy)
  { status: "approved"; approvedAt }   // aprovada → entrega liberada
  { status: "regenerating" }  // correção em andamento (v2/v3)

isDeliveryReleased(state) = true para not_enabled | legacy | approved
                          = false para pending | regenerating
```

- **`regenerating` é DERIVADO de `campaign_art_versions`** (marcador `correction_in_progress` na candidata ativa, decisão 5) — **não altera o CHECK de `campaigns.status`** (`generating | ready | error` permanece inalterado)

- **Sinal de legacy:** ausência de linhas em `campaign_art_versions` (a v1 só é inserida para gerações novas sob o flag). Campanhas `error`/`generating` seguem seus fluxos atuais
- **Legacy vale também quando o flag liga depois:** uma campanha gerada com o flag desligado não ganha gate retroativo — permanece entregue

---

### D3 — Política beta: 1 campanha aprovada, até 2 correções incluídas

`DECIDIDO`

```
1 crédito = 1 campanha APROVADA = 1 arte candidata por vez (v1 + até 2 correções incluídas)
   v1  ── gerada na geração inicial (candidata)
   v2  ── 1ª correção (feedback) — SUBSTITUI v1     ┐ mesmo crédito,
   v3  ── 2ª correção (feedback) — SUBSTITUI v2     ┘ SEM cobrança extra, SEM nova reserva
   v4+ ── NÃO EXISTE no beta
         └─ se ainda não aprovou → orientação (D6):
             criar nova campanha · falar com o suporte
```

- **Unidade de entrega = campanha aprovada, não tentativa interna.** O usuário paga por uma campanha publicável; as correções são **revisão de entrega incluída**, não tentativas vendáveis
- **Uma arte candidata por vez** — pedir correção = solicitar **substituição** da arte atual; a rejeitada não fica aprovável depois (mesmo sem vender "tentativas", uma galeria ensinaria o usuário a usar a rejeição como gerador de variações — comportamento que evitamos)
- **Três casos (da tabela do Realinhamento):** erro da IA → correção incluída; preferência estética razoável → correção incluída dentro do cap; mudança de briefing → bloqueio + nova campanha (D4)
- Guard no backend: `campaign.rejection_count < 2` permite `/regenerate`; ao atingir 2, retorna `409` com orientação (D4/D6). `rejection_count` **incrementa apenas em regeração com sucesso** — falha técnica mantém a candidata anterior e não consome correção (D8)
- **Nenhuma nova reserva de crédito** na regeração — o fluxo de crédito da F24/F25/F38 **não muda**: a regeração **não** chama `reserve_credit`, **não** cria nova `credit_transactions` e **não** adiciona `operation_key` nova em `credit_operation_costs` (`campaign_regeneration`/`campaign_approval` **não** são criadas nesta fase — a F38 já sinalizava esse caminho; aqui fica explícito que é adiado)
- **Custo da correção = parte da entrega:** o custo de IA das v2/v3 aparece como eventos call-level adicionais **no mesmo `operation_run_id`** da campanha (D8) — visível no painel F38.2 como custo daquela entrega, sem cobrança ao usuário
- **UI sem contador de tentativas vendável:** o lojista vê "Corrigir" naturalmente; nenhuma mensagem do tipo "você tem 2 tentativas grátis". O limite só aparece como orientação de encerramento (D6), não como marketing
- **Por que no beta:** deixa o teste limpo (medir se o fluxo resolve o problema antes de transformar em política comercial). Meia cobrança por correção **fica fora do escopo** — se o erro foi da IA, cobrar seria punir o usuário por falha do produto; reabrir essa hipótese exige dados (custo real, aprovação v1/v2/v3, motivos) e, quando reaberta, provavelmente apenas para "nova variação criativa", nunca "correção"

---

### D4 — Modal de revisão da arte + política de correção (visual / factual / estratégica)

`DECIDIDO`

**Modal de revisão da arte em 2 etapas (decisão 14)** (abre ao "Corrigir"; **NÃO volta ao formulário**):

```
ETAPA 1 — decisão:
  [ preview da arte candidata (candidata ativa) ]
  [ Aprovar e liberar campanha ]   [ Corrigir ]

ETAPA 2 — correção (abre ao clicar "Corrigir"):
  "O que você quer ajustar nesta arte?"
  [ preview da arte candidata ]
  Campo livre OBRIGATÓRIO  ──────────  "ex.: mudar o fundo para rosa / deixar o preço maior"
  [ Aplicar correção ]   [ Cancelar correção ]   ← Cancelar volta à ETAPA 1 (não aprova)
```

- **Campo livre obrigatório** orienta a correção — o texto é a **fonte primária**; motivos rápidos são apenas apoio opcional, nunca substituem o texto
- **[Aplicar correção]** dispara a validação/parser (D4.1/decisão 13): texto `unclear`/`blocked_new_campaign` responde com orientação **sem chamar o diretor e sem consumir correção**; texto `visual_adjustment`/`creative_remake` chama o diretor com o **texto cru + instrução fixa anti pixel-perfect** (decisão 8)
- **[Cancelar correção]** volta à **ETAPA 1** (decisão Aprovar/Corrigir) — **não aprova** a campanha
- **X/ESC/backdrop** fecham o modal apenas (dispensam a tela) **sem aprovar automaticamente** — a ação explícita de aprovar continua sendo o botão primário; o estado de revisão permanece inalterado (candidata ainda pendente)
- **Não exigir escrita perfeita** — aceitar linguagem simples, errada, incompleta, com intenção detectável (muitos usuários digitam mal; a interpretação é do sistema, D4.1)
- O usuário está **orientando uma correção da arte entregue**, não refazendo a campanha — não apresentar o formulário completo de novo (menos fricção e não induz expectativa de "corrigir erros próprios" como rebriefing)

**Política de correção (classificada pelo parser — D4.1):**

| Tipo | Tratamento |
|------|------------|
| **Ajuste visual** ("muda o fundo pra rosa", "deixa o preço maior", "refaz a composição") | Permitido; usa a **arte candidata como referência principal** (D5) |
| **Correção factual de briefing** (preço/validade/aviso legal/desconto/erro de digitação percebidos na revisão) | Permitida **pré-aprovação**, dentro do cap, sem custo extra; **atualiza o snapshot da próxima versão** |
| **Mudança estratégica/comercial** (outro produto, mecânica de oferta, mudar a intenção, nova campanha disfarçada) | **Bloqueada** → orienta criar nova campanha |

**Correções factuais permitidas (37.3, campo errado que impacta diretamente a arte — decisão 10):**
- preço digitado errado; desconto informado errado; validade errada; aviso legal / texto obrigatório com erro (inclui o aviso ilustrativo); badge/chamada comercial errada; nome do produto com erro de digitação

**Mudanças NÃO permitidas (mudança estratégica):**
- trocar para outro produto; mudar a mecânica da oferta ("20% off" → "leve 2 pague 1"); mudar a intenção da campanha (`commercial.intent`); refazer o briefing livremente; pedir uma nova campanha disfarçada de correção

**Escopo por fatia (decisão 9):** a correção **visual/criativa** é a **37.2**; a correção **factual controlada** via `briefPatch` é a **37.3** (o parser da 37.2 não emite `factual_brief_correction`).

**Imutabilidade estratégica do briefing (fonte da verdade — `campaign_brief_v1`, F39):**

> O usuário pode alterar: **estética, composição, legibilidade, destaque, enquadramento, estilo** (ajuste visual).
> O usuário pode **corrigir factualmente**: preço, desconto, validade, aviso legal e nome do produto **quando for erro do valor informado** (não mudança de mecânica).
> O usuário **NÃO pode**: trocar o produto, mudar a mecânica da oferta, mudar a intenção ou pedir nova campanha via correção.

**Aplicação no snapshot (histórico por versão, sem sobrescrever o passado):**
- Cada `campaign_art_versions.brief_snapshot` registra o brief usado **naquela versão**
- Se o usuário corrige o preço antes da v2, a **v2 nasce com o snapshot corrigido**; a **v1 preserva o snapshot antigo** como histórico
- `campaigns.input_snapshot` aponta para o **snapshot corrente/candidato** (pode ser atualizado); o histórico fica por versão em `campaign_art_versions.brief_snapshot`
- **Rede de segurança:** o `ImageReviewService` (F31.3) continua auditando cada versão contra o comportamento esperado da intent (preço certo, produto certo, texto legível, aviso legal presente — F39 8.20)

**Por que:** bloquear sempre seria hostil quando o usuário percebe o erro só na tela de aprovação; abrir edição livre seria porta para rebriefing sem controle. A **correção factual limitada, auditada e dentro do cap** equilibra confiança e custo — sem dar ao usuário a expectativa de "corrigir erros próprios" como rebriefing (o modal orienta correção da arte, não refazer a campanha).

---

### D4.1 — Interpretação obrigatória do pedido de correção (Correction Brief Parser)

`DECIDIDO`

Antes de qualquer regeração, o sistema roda um **parser leve** (decisão 13) que **classifica o pedido em uma intenção estruturada** (objeto, não arte) e decide se o diretor é chamado. **Texto `visual_adjustment`/`creative_remake` vai CRU ao diretor** (sem parafrasear, sem filtrar termos), acompanhado de **instrução fixa anti pixel-perfect** (decisão 8) — o parser NÃO reescreve o pedido.

```
CorrectionIntent (saída do parser — decisão intermediária, não aceita tudo):
{
  valid: true,
  // 37.2: visual_adjustment | creative_remake | unclear | blocked_new_campaign
  // 37.3: + factual_brief_correction
  correctionType: "visual_adjustment" | "creative_remake"
                | "blocked_new_campaign" | "unclear",
  userIntent: "alterar cor de fundo para rosa",   // p/ telemetria/auditoria
  rawUserText: "muda o fundo pra rosa",           // enviado CRU ao diretor (decisão 8)
  briefPatch?: { commercial?: { discountedPriceCents?: 99 } },   // correção factual (37.3)
  needsUserClarification?: false
}
```

**Exemplos de interpretação:**

| Texto do usuário | Interpretação |
|------------------|---------------|
| "muda o fundo pra rosa" | `visual_adjustment` — permitido (chama o diretor; consome tentativa) |
| "preço é 0,99 não 1,99" | `factual_brief_correction` **(37.3)** — permitido pré-aprovação (patch no snapshot da próxima versão) |
| "troca últimas unidades por enquanto durar o estoque" | correção factual/legal/comercial leve **(37.3)** — permitida se compatível |
| "não gostei dessa composição, refaça" | `creative_remake` — dentro do cap (chama o diretor; consome tentativa) |
| "faz outro produto" | `blocked_new_campaign` — bloqueia, orienta nova campanha |
| "sei lá ficou ruim" | `unclear` — pede detalhe; NÃO chama diretor, NÃO consome correção |

**Camadas em cascata (reduzir custo de IA):**
1. **Validação local barata:** trim, tamanho mínimo, lixo óbvio, detecção de vazio tipo ".", "ok", "nada"
2. **Parser heurístico para casos fáceis:** cor, preço, validade, palavras ("fundo", "preço", "texto", "maior", "menor", "trocar badge")
3. **IA textual barata apenas quando necessário:** classifica a intenção, normaliza texto mal escrito e decide se é visual / factual / remake / nova campanha
4. **Só então chama o Image Director**, com a arte candidata como referência quando fizer sentido (D5)

**Regras (por fatia):**
- **37.2 (parser leve — decisão 13):** só `visual_adjustment` e `creative_remake` chamam o Image Director **e consomem tentativa**; `unclear`/`blocked_new_campaign` respondem com orientação, **sem chamar e sem consumir**
- **37.3 (factual — decisão 10):** `factual_brief_correction` passa a existir — gera `briefPatch` validado contra o snapshot (D4); a **próxima versão** nasce com o snapshot corrigido; a anterior preserva o antigo
- **Texto inválido/ambíguo** (`unclear`) → responde com mensagem humana, **sem chamar Image Director e sem consumir correção**: *"Me diga o que precisa mudar na arte. Pode ser algo simples, como 'mudar fundo para rosa', 'deixar preço maior' ou 'refazer composição'."*
- **Mudança de campanha** → `blocked_new_campaign` com orientação a nova campanha
- **Botão sempre disponível com algum texto** — não desabilitar por campo curto (pune quem escreve mal); a validação acontece **no clique** (camadas 1–3)
- O parser é **decisão intermediária**, não aceita tudo automaticamente

---

### D5 — Estratégia de correção A/B (flag `VENDEO_ART_CORRECTION_STRATEGY`)

`DECIDIDO`

```
Correção com referência — APOSTA PARA v2 (D5 · decisões 6/7):
  v2 = texto CRU do usuário (decisão 8)
       + ARTE CANDIDATA ATUAL como IMAGEM DE REFERÊNCIA PRINCIPAL
       + imagens do produto (snapshot F41, media.images[].storagePath) como
         REFERÊNCIAS AUXILIARES
       na tool image_generation (o provider já aceita múltiplas imagens)
  ├─ para "gostei da arte, só muda X", o diretor vê o que deve ser preservado → acerto real
  ├─ as imagens do produto preservam a fidelidade do produto na regeração (decisão 7)
  └─ mais caro (tokens/imagem extra) e precisa validar preservação

Variante text_only (sem referência de arte) e o mecanismo de ativação da estratégia
(flag DB/valor) são DECIDIDOS NA 37.2 (decisão 1) — não são requisito da 37.1.
```

- **Referência principal da correção = arte candidata atual** (a versão com `asset_status='active'`), **não** a imagem original do produto (decisão 6)
- **Referências auxiliares = imagens do produto do snapshot F41** (`media.images[].storagePath`, primary + referências) — o diretor as recebe para **preservar a fidelidade do produto** (decisão 7)
- **Instrução fixa anti pixel-perfect (decisão 8 — crítico):** o **texto cru do usuário é enviado ao diretor sem filtro de termos**; junto, uma instrução FIXA resolve a linguagem de loop:
  > "O pedido do lojista foi: **<texto cru do usuário>**. Aplique esse pedido preservando a arte enviada como referência principal o máximo possível — composição, hierarquia, estilo, produto, textos e essência visual. Expressões como 'exatamente igual', 'idêntico', 'não altere nada' significam **preservar a arte o mais próximo possível, sem exigência de reprodução pixel a pixel**; evite os dois extremos de copiar cegamente ou transformar por completo."
- **Por que instrução fixa (decisão 8):** sem ela, termos como "exatamente igual"/"idêntico"/"não altere nada" criam tensão impossível entre copiar fielmente e transformar (loop/travamento); a formulação fixa **preserva essência e estrutura, sem exigir fidelidade absoluta** — e o texto cru chega íntegro para não perder a intenção do lojista
- **Descarte da arte anterior só após a nova versão ser gerada, revisada e persistida com sucesso** (D8) — a referência é lida no mesmo request, antes do descarte
- **Aposta:** v2 com **referência de arte + produto** — "máximo esforço na primeira correção" (se a v2 resolver a maioria, o custo total fica aceitável)
- v3 reusa a mesma estratégia (decidida na 37.2), com o feedback acumulado
- A comparação `text_only` × `text_plus_reference` é possível em produção durante o beta (mecanismo definido na 37.2 — decisão 1)
- **Validação pré-GA:** spike com eval-set de ~10 cenários de rejeição (cor, composição, preço, produto deformado, estilo, texto ilegível) comparando com/sem referência — o que decide se o cap de 2 correções faz sentido
- **Custo da correção aparece no mesmo run** (D8): referências extras são só mais componentes de custo do run da entrega, visível no painel F38.2 — nunca cobrado do usuário

---

### D6 — Orientação ao exceder o cap + suporte/reembolso

`DECIDIDO`

Quando `rejection_count` atinge 2 (v3 foi o último ajuste):

- O botão "Corrigir" **some** e é substituído por um painel de orientação com copy de encerramento — **sem tom de abandono**:
  > "Não conseguimos chegar a uma versão segura com este briefing. Você pode **criar uma nova campanha com outro briefing** ou **falar com o suporte** caso a entrega tenha falhado."
- Caminhos:
  - **"Criar nova campanha"** → leva ao formulário `/campanhas/nova` (nova geração, novo crédito)
  - **"Fale com o suporte"** → canal de contato (com o contexto da campanha + histórico de feedback pré-preenchido, se viável)
- **A arte candidata atual continua aprovável** — o lojista pode encerrar a revisão aprovando a entrega como está (aprovar = entregar a candidata); não há versões anteriores para aprovar (uma candidata por vez — D7)
- Nenhuma mensagem comercial sobre tentativas ("só restam X") — apenas orientação de caminhos
- **Suporte/reembolso (caso "erro da IA"):** quando o usuário entende que a entrega **não cumpriu o briefing aprovado** (ex.: todas as versões falharam em entregar preço/produto corretos — o guard não deixou mudar, mas a IA também não acertou), o suporte é orientado a avaliar **reembolso/novo crédito** no fluxo admin existente (F24/F26) — a F37 não implementa cobrança nem estorno automático, apenas registra contexto suficiente para o suporte decidir (motivos, versões, custo do run)

---

### D7 — Modelo de dados e lifecycle das versões

`DECIDIDO`

```
campaigns (agregado — brief/snapshots/copy/operation continuam aqui)
  status: generating | ready | error                (inalterado — NÃO muda p/ correção, decisão 5)
  input_snapshot: JSONB                             (F39 — agora CONTÉM o snapshot versionado campaign_brief_v1, sem base64)
  operation_run_id: uuid                            (F38.1 — run da entrega; reaberto na regeração, D8)
  + approval_status: pending_approval | approved    (derivável: approved ⇒ approved_version_id NOT NULL)
  + rejection_count: smallint                       (0..2 — guard do cap D3)
  + approved_version_id: uuid                       (FK opcional p/ campaign_art_versions)
  + approved_at: timestamptz                        (tempo até aprovação)
  storage_path: text                                (fonte oficial da arte APROVADA após D8; usado por legado — decisão 3)

campaign_art_versions (NOVA — fonte da verdade das artes; 1 candidata por vez)
  id            uuid PK
  campaign_id   uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE
  version_number  smallint NOT NULL   (1..3 — CHECK 1..3)
  status        text NOT NULL CHECK IN ('pending','approved','rejected')
  correction_in_progress boolean NOT NULL DEFAULT false   (marcador da candidata durante a correção — fonte do estado "regenerating", decisão 5)
  storage_path  text NULL             ({storeId}/{campaignId}/v{n}.jpg — NULL após descarte do asset)
  asset_status  text NOT NULL DEFAULT 'active'
                CHECK IN ('active','discarded')   ← 'active' só para a candidata/aprovada
  asset_deleted_at timestamptz        (preenchido ao descartar o arquivo)
  brief_snapshot jsonb NOT NULL       (snapshot campaign_brief_v1 usado na geração desta versão — compatível com F39;
                                       sem base64 por construção; permite revalidar/renderizar e comparar feedback)
  render_snapshot      jsonb          (por versão)
  generation_metadata  jsonb          (por versão — inclui operation_run_id + snapshots econômicos da versão)
  rejection_reason     jsonb          (motivo rápido + texto livre; preenchido ao rejeitar)
  created_at    timestamptz default now()
  UNIQUE (campaign_id, version_number)
  ▸ índice único parcial: 1 approved por campaign_id
    (CREATE UNIQUE INDEX ... ON campaign_art_versions(campaign_id)
      WHERE status='approved')
```

- **Referência compatível com F39:** `brief_snapshot` é o mesmo `CampaignBriefSnapshot` persistido em `campaigns.input_snapshot` (schemaVersion `campaign_brief_v1` no ROOT, sem base64). Como o snapshot é imutável por construção (F39), a cópia por versão é segura e dá independência à versão (uma versão continua associada ao brief que a gerou mesmo se a campanha evoluir)
- **Versão 1** é criada no pipeline existente (`generate-image`) quando o flag está ligado — o `POST /api/campaign/generate-image` passa a **também** inserir `campaign_art_versions` (v1, `pending`) além de escrever `campaigns` como hoje (D8)
- **Imagens do produto:** a regeração usa as imagens de input já persistidas pela **F41** (`media.images[].storagePath` no snapshot — primary + referências); a geração inicial já as sobe independentemente do flag (decisão 2). **SEM `persistProductSourceImage`/`getProductSourceImage`** nesta fase — ver D8
- **Regeneração** (D8) cria v2/v3 (`pending`, candidata) e **descarta a anterior**: status `rejected`, asset removido do storage (`storage_path` → NULL, `asset_status='discarded'`, `asset_deleted_at`), linha preservada como histórico textual/telemetria
- **Aprovação** (D8) é **transacional**: aprova a **candidata**, aponta `campaigns.storage_path` para a aprovada, seta `approved_version_id`/`approved_at`; garante (defensivo) que nenhuma outra linha retenha asset ativo
- **Revisão (sem galeria):** a UI mostra **apenas a candidata ativa** (a versão com `asset_status='active'`); **nenhuma versão anterior é selecionável ou recuperável pelo lojista (decisão 12)** — versionamento/auditoria existem internamente (linhas + motivo + telemetria), mas a UX não oferece histórico de ajustes
- **Fonte oficial da arte exibida (decisão 3):** com o gate ligado, a tela renderiza a **candidata ativa em `campaign_art_versions`**; ao aprovar, `campaigns.storage_path` é repontado para a **arte oficial aprovada**; campanhas **legacy** (sem linhas) continuam usando `campaigns.storage_path`
- **`campaigns.status` NÃO muda para representar correção em andamento (decisão 5)** — o estado `regenerating` da UI é **derivado** do marcador `correction_in_progress` na candidata ativa em `campaign_art_versions`
- Migração/backfill: campanhas `ready` pré-flag **não recebem linhas de versão** (seguem o comportamento atual — estado `legacy`, D2)
- Legacy determination: `flag on` + **zero linhas em `campaign_art_versions`** → `legacy` (entregue como hoje)

---

### D8 — Regeneração, aprovação e storage

`DECIDIDO`

**Regeneração** — `POST /api/campaign/[id]/regenerate`:

- Guards: ownership + `campaignApprovalEnabled` + `rejection_count < 2` + anti-concorrência (um ajuste por vez, padrão VS)
- **Constrói o brief a partir do snapshot `campaign_brief_v1` persistido** (`campaigns.input_snapshot` + `identity_snapshot`/identidade da loja) — **NÃO** re-monta briefing manualmente e **NÃO** depende do formulário (F39 como fonte da verdade)
- Reconstrói o brief de runtime a partir do snapshot F41: lê **todas** as `media.images[].storagePath` (persistidas na geração — F41 já as sobe), baixa os arquivos e repõe os `dataUrl` (**primary + referências**) para o provider (decisão 2)
- **NÃO** re-roda: copy director, validação de input/visão, `createCampaign`, reserva de crédito
- **Reabre o mesmo `operation_run_id` da campanha** (`campaigns.operation_run_id`, F38.1): todos os eventos de v2/v3 usam esse id — v1+v2+v3 agregam como **uma entrega** na apuração F38.1/F38.2. Uso: propagar o `operation_run_id` existente aos `AiCostTracker.record(...)` (a mecânica de reabertura cross-request é escopo desta fase, conforme preparado na F38.1)
- Roda **apenas o Image Director** (`ImageGenerationService.generateImage`, estados INITIAL→…→COMPLETE) com o **texto cru do usuário + instrução fixa anti pixel-perfect** (decisão 8) e a estratégia de referência da 37.2 (D5) — a **arte candidata atual** entra como **referência principal** e as **imagens do produto do snapshot F41** como **referências auxiliares** (decisão 7), no mesmo request, **antes do descarte**
- **Correção factual:** se o parser retornar `briefPatch`, a **nova versão nasce com o snapshot corrigido** (`brief_snapshot` da v2/v3 = snapshot corrente + patch); a anterior preserva o snapshot antigo como histórico (D4)
- **Semântica de substituição (uma candidata por vez):**
  ```
  v1 candidata → Corrigir → parser interpreta (D4.1) → gera v2
      ├─ texto inválido/ambíguo → pede detalhe; NÃO consome correção
      ├─ mudança estratégica → bloqueada (orienta nova campanha); NÃO consome correção
      ├─ falhou tecnicamente → mantém v1 candidata; NÃO consome correção (sem linha nova, rejection_count inalterado)
      └─ sucesso → v1 descartada (asset removido; linha vira histórico textual/telemetria); v2 vira candidata; rejection_count++
  v2 candidata → aprovar → entrega v2
  v3 candidata → rejeitar (cap atingido) → painel de encerramento (D6); candidata continua aprovável
  ```
- Transcode + upload para `{storeId}/{campaignId}/v{n}.jpg` → nova linha `campaign_art_versions` (v2/v3, `pending`, `asset_status='active'`) com `brief_snapshot` (corrigido se houve `briefPatch`); anterior → `rejected` + motivo + asset descartado (`storage_path`→NULL, `asset_status='discarded'`)
- Stream NDJSON de progresso (mesmo padrão da rota de geração) + telemetria call-level (`campaign_image`) com `metadata: { version_number, correction_strategy, rejection_reason }` e os snapshots econômicos (38.2.1)
- **Sem nova reserva de crédito, sem nova `operation_key`** (D3)

**Imagens do produto na regeração (pré-requisito, já resolvido pela F41 — decisão 2):** a geração já sobe **todas** as imagens de input em `campaign-images/{storeId}/{campaignId}/inputs/{imageId}.jpg` e registra `media.images[].storagePath` no `campaign_brief_v1` (F41) — **a F37 NÃO cria `persistProductSourceImage`/`getProductSourceImage`**. A regeração baixa os arquivos do snapshot e repõe os `dataUrl` (primary + referências) para o provider. **Imagens de input ≠ arte:** a arte rejeitada pode ser descartada, mas as **imagens de input permanecem enquanto a campanha existir** (insumo auditável/regerável). (Detalhe: campanhas pré-flag não regeneram porque são `legacy`.)

**Aprovação** — `POST /api/campaign/[id]/approve`:

- Transação (RPC ou sequential com rollback):
  1. Valida a versão alvo (a candidata) como aprovável (`pending`/elegível)
  2. Marca a candidata como `approved`
  3. **Defensivo:** garante que nenhuma outra linha retenha asset ativo (remove arquivo e seta `asset_status='discarded'`/`storage_path`→NULL se houver)
  4. Atualiza `campaigns`: `storage_path` → aprovada, `approved_version_id`, `approved_at`, `approval_status='approved'`
  5. Registra telemetria de aprovação (evento call-level ou metadata — sem novo `generation_type` nesta fase)
- **Descarte preserva aprendizado:** o **histórico textual** do motivo de rejeição (e as métricas de custo daquelas versões, já em `generation_events`) fica preservado mesmo depois do arquivo ser apagado — analytics não depende do arquivo
- **Por que descartar:** evita que o usuário aprenda a usar a rejeição como gerador de variações (modelo mental: correção substitui a entrega, não abre galeria); evita acúmulo de dados; a arte aprovada é a única que faz parte do conteúdo entregue (decisão do Q&A)

**Storage resultante por campanha aprovada:** 1 arquivo (a aprovada). Durante a revisão: 1 arquivo de arte candidata + **N imagens de input (F41)** (as artes anteriores são descartadas no momento da regeração com sucesso).

**Telemetria (modelo F38.1+, sem operação nova):**
- Eventos de imagem por versão continuam sendo `campaign_image` (call-level) — **não** adicionamos `campaign_rejection`/`campaign_approval` ao CHECK `chk_generation_events_type` nesta fase; versão/estratégia/motivo vão em `metadata` e em `campaign_art_versions`
- A função de funil (aprovação v1/v2/v3, motivos, tempo) tem fonte própria em `campaign_art_versions`
- O custo por campanha aprovada usa os RPCs/views F38.1/F38.2 (`admin_ai_operation_costs`, painel `/admin/ai-operation-costs`) — a correção aparece como mais eventos no mesmo `operation_run_id`

---

### D9 — Copy fora da regeração

`DECIDIDO`

A correção regenera **somente a arte**. O copy (caption/hashtags/CTA, Kit de Publicação) **não é reprocessado**:

- O copy já é editável (F17) e independente da arte — a imagem usa `hook`/`cta` do formulário (agora em `commercial.hook`/`commercial.cta` do domínio F39), não a saída do copy director
- Reprocessar copy criaria custo e variabilidade sem necessidade
- O Kit de Publicação só fica visível após a aprovação (D2), usando o `publication_copy_snapshot`/`current` já existentes

---

### D10 — Reuso do pipeline: só o Image Director na regeração

`DECIDIDO`

- A rota `/regenerate` **reutiliza o `ImageGenerationService` diretamente** (estado INITIAL→REVIEW→CORRECT→REGENERATE→COMPLETE/ERROR) — **não duplica** o wrapper do `generate-image`
- `buildPromptVariables`/`assemblePrompt` (privados em `image-generation-service.ts`) passam a aceitar um **modo de correção** na 37.2: **texto cru do usuário + instrução fixa anti pixel-perfect** (decisão 8 — não é `directorInstruction` parafraseada do parser) e referências de imagem — **arte candidata como referência principal + imagens do produto do snapshot F41 como auxiliares** (decisões 6/7), incluindo o canal no provider (`ImageProviderInput` ganha slot de referência; o provider openai já aceita múltiplas imagens)
- **Seleção de prompt por `correctionType` (decisão 16):** `visual_adjustment` → `prompts/regen/campaign-image-regenerate-surgical.md`; `creative_remake` → `prompts/regen/campaign-image-regenerate-remake-{intent}.md` com `{intent}` resolvido de `campaign_brief_v1.commercial.intent` (offer/spotlight/exclusive — espelham o diretor atual correspondente); prompts atuais intocados; `PromptLoader` resolve o subdiretório `regen/`
- Preflight de prompts permanece (rota de geração, F28/quick 260804-s16)
- Guard de concorrência: rejeição dupla/navegação não gera duas v2 simultâneas
- O domínio `CampaignBrief` (F39) é a entrada do serviço — a regeração reconstrói esse domínio a partir do snapshot (D8), reaproveitando as costuras de mappers da F39 (copy/review/image)

**Limitação conhecida:** a extração de um "core de geração" compartilhado entre a rota inicial e a regeração é adiada — a regeração chama o serviço diretamente. A rota inicial (`generate-image`) só ganha a inserção da v1 em `campaign_art_versions` (D7) — **sem persistência de produto fonte** (F41 já persiste os inputs, decisão 2). Refactor maior fica para uma fase futura se necessário.

---

### D11 — Renumeração e trackings (F38–F43 concluídas; Stripe fora da numeração)

`DECIDIDO` (consolidado nos alinhamentos F38 D1 e F39 D1)

| Antes | Depois |
|-------|--------|
| F37 = Stripe / Monetização Pública (v1.7) | **F37 = Revisão e Aprovação da Arte** (v1.5, experimento beta) |
| — | **F38 = Tabela de Custos por Operação** (v1.5, **CONCLUÍDA** — 38.1/38.2/38.2.1) |
| — | **F39 = Brief Estruturado de Campanha** (v1.5, **CONCLUÍDA** — `campaign_brief_v1`) |
| — | **F40 = Campos Comerciais e Avisos do Brief** (v1.5, **CONCLUÍDA**) · **F41 = Mídia Mobile** (✓) · **F42 = Signup** (✓) · **F43 = Revisão do Brief Pré-Geração** (✓) |
| — | **Stripe / Monetização Pública** = **fora da numeração** (iniciativa diferida v1.7+, não numerada) |

**Estado dos trackings (atualizado nesta revisão):** `ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md` e `.planning/MILESTONES.md` já refletem F39–F43 (concluídas), F37 = Pending e Stripe fora da numeração. A F37 **não precisa renumerar** — deve **confirmar e preencher** ao planejar/executar:

| # | Arquivo | Ação na F37 |
|---|---------|-------------|
| 1 | `ROADMAP.md` (raiz) | Confirmar linha 37 "Revisão e Aprovação da Arte \| v1.5 \| 0/0 \| ○ Pending" e linhas 38/38.1/38.2/38.2.1/39–43 corretas; ao concluir, marcar 37 como Complete (com nota de execução em fatias **37.1/37.2/37.3**) |
| 2 | `.planning/ROADMAP.md` | Adicionar a seção "### Phase 37 — Revisão e Aprovação da Arte" no formato das fases concluídas, com sub-seções **37.1/37.2/37.3** (goal/success criteria/dependencies por fatia; source of truth `openspec/changes/fase-37-revisao-aprovacao-arte/`); atualizar Dependency Graph (F43/F39 → F37) e rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 37`; adicionar seção da Fase 37 conforme padrão (fatias 37.1 → 37.2 → 37.3, uma por wave); atualizar "Last updated" |
| 4 | `.planning/PROJECT.md` | Seção "Current Milestone: v1.5" → F37 em execução (37.1/37.2/37.3); confirmar F39–F43 concluídas/Stripe fora da numeração |
| 5 | `.planning/REQUIREMENTS.md` | Requisitos da F37 entram quando os specs OpenSpec forem aprovados (fase ainda não tem requisitos neste arquivo) |
| 6 | `.planning/MILESTONES.md` | Confirmar "Known Gaps" da v1.5: Stripe diferida (fora da numeração, v1.7+) |

**Execução em fatias (D12 — padrão F38):** a F37 é uma fase por tracking, mas executa em **waves obrigatórias 37.1 → 37.2 → 37.3** (ver seção "Fatiamento da Fase"), cada uma com gates verdes antes da próxima. A numeração espelha o padrão 38/38.1/38.2/38.2.1.

**Regras gerais:**
- Artefatos históricos (alinhamentos F26–F39, quick-plans) **não são reescritos** — refletem o estado da época
- O `openspec/changes/fase-37-revisao-aprovacao-arte/` é a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele
- Renumeração de fases futuras segue a regra: a fase conflitante é incrementada (não apagada), e o alinhamento registra a decisão

---

### D12 — Fatiamento em 37.1 / 37.2 / 37.3 (waves obrigatórias)

`DECIDIDO`

O escopo da F37 é executado em **3 fatias sequenciais e obrigatórias** (numeração espelha o padrão F38/38.1/38.2/38.2.1), cada uma com base técnica independente para planejamento/execução:

| Fatia | Entrega resumida | Gate de saída |
|-------|------------------|---------------|
| **37.1 — Approval Gate + Candidata Única** | flag `campaign_approval_enabled` em `feature_flags`; `campaign_art_versions`; estado legacy; tela de revisão (candidata ativa); aprovar candidata; download **e** publication-copy gated. **Correção NÃO disponível** (botão ausente/desabilitado, nunca abre modal). Parser/briefPatch/validateBriefPatch/referência/cap **adiados** (design futuro, não requisito da fatia) | Aprovação funcional sem tocar no pipeline de imagem; legado entregue; nenhuma correção implementada |
| **37.2 — Correção Visual Com Referência** | modal em 2 etapas [Aprovar]/[Corrigir]; texto obrigatório; parser leve (decisão 13); **texto cru + instrução fixa anti pixel-perfect** (decisão 8); arte candidata como referência principal + imagens do produto F41 como auxiliares; substituição transacional; cap 2; "regenerating" derivado da versão; sem correção factual | Regeneração visual com referência funcionando; cap e descarte corretos |
| **37.3 — Correção Factual Controlada** | `briefPatch` + `validateBriefPatch`; snapshot corrigido por versão; casos preço/validade/aviso legal + aviso ilustrativo/badge e chamada/digitação (decisão 10); UAT de abuso/frustração | Correção factual sem vazar para rebriefing; snapshot por versão auditável |

- **Por que fatiar:** não é só UI — envolve migration, storage, lifecycle transacional, parser com IA, alteração factual de snapshot, reuso de `operation_run_id`, gate de download/copy e prompt de imagem com referência. Superfície crítica demais para um único bloco.
- **37.1 entrega valor parcial** (valida o modelo de aprovação sem risco no core de geração); **37.2 entrega o valor principal** (revisão da arte sem abrir rebriefing); **37.3 fica para a base estável** (parte mais delicada).
- `openspec/changes/fase-37-revisao-aprovacao-arte/` organiza os artefatos como 37-1/37-2/37-3.

---

### Decisão 15 — Contrato com F44.3 (referência visual de Tema)

`DECIDIDO` (revisão 2026-09-01)

A F37 registra **aprovação confiável por campanha** (`approval_status='approved'` + `approved_version_id` + `approved_at` + `storage_path` → arte oficial aprovada). A **F44.3** é responsável por **fixar a primeira campanha aprovada sob um Tema** como `theme_visual_reference_campaign_id` — a F37 **não** escreve nessa coluna e **não** decide referência de Tema:

- A F37 garante que, ao aprovar, a arte oficial é **estável e identificável** (approved_version_id + storage_path + approved_at) — o sinal que a F44.3 consultará
- Novas campanhas aprovadas no mesmo Tema **não substituem automaticamente** a referência fixada (decisão de produto da F44.3)
- A migration da F44 já adicionou `theme_visual_reference_campaign_id → campaigns(id)` (FK), sem conflito com o modelo de versões da F37

---

### Decisão 16 — Prompts de Regeneração (37.2)

`DECIDIDO` (revisão 2026-09-01)

A regeração **NÃO reutiliza o prompt de geração inicial**. Prompts específicos em pasta separada; os prompts atuais permanecem **intocados** (zero risco de regressão no core de geração):

```
prompts/regen/                            ← NOVOS (prompts atuais NÃO são alterados)
  campaign-image-regenerate-surgical.md   ← correção cirúrgica/visual (visual_adjustment) — prompt ÚNICO
  campaign-image-regenerate-remake-offer.md      ← remake criativo (creative_remake) · intent=offer
  campaign-image-regenerate-remake-spotlight.md  ← remake criativo (creative_remake) · intent=spotlight
  campaign-image-regenerate-remake-exclusive.md  ← remake criativo (creative_remake) · intent=exclusive
```

- **Correção cirúrgica/visual** (`visual_adjustment`): prompt **novo e específico** (único), diferente do prompt de geração inicial — pede ajuste pontual preservando composição/hierarquia/estilo/produto/textos/essência, com a **arte candidata como referência principal** + **imagens do produto F41 como auxiliares** + **texto cru do usuário** + **instrução fixa anti pixel-perfect** (decisão 8)
- **Remake criativo** (`creative_remake`): **3 prompts novos por intenção** — `campaign-image-regenerate-remake-{intent}.md` com `{intent} ∈ {offer, spotlight, exclusive}`, resolvido em tempo de execução a partir de `campaign_brief_v1.commercial.intent` (não é gerado dinamicamente; são arquivos distintos por intent, como os diretores atuais). Cada um **reutiliza/espelha a lógica do diretor atual correspondente** (`campaign-image-director-{intent}`) como base, **sem alterar os prompts atuais**, pois "oferta", "destaque" e "exclusividade" têm **regras comerciais e tom visual diferentes**; adiciona bloco extra: *"gere uma nova alternativa diferente da arte recusada, usando a referência apenas como contexto do que não agradou"*, respeitando os padrões da loja/brief (assinatura visual, fatos, imutabilidade estratégica)
- **Prompts atuais intocados**: `campaign-image-director-{offer,spotlight,exclusive}.md` e `campaign-image-reviewer.md` **não mudam** nesta fase (mitiga regressão no fluxo de geração normal)
- **Seleção por `correctionType`** (alinhado ao D10): `/regenerate` chama `ImageGenerationService` com resolução do prompt — `visual_adjustment` → `prompts/regen/campaign-image-regenerate-surgical.md`; `creative_remake` → `prompts/regen/campaign-image-regenerate-remake-{intent}.md` (lógica do diretor espelhada como base, por intent); `PromptLoader` ganha acesso ao subdiretório `regen/`
- Não há variável nova no prompt cirúrgico além das já mapeadas (texto cru + referências); golden test dos prompts de regen (incluindo os 3 de remake) é pré-requisito da 37.2

---

```
ARQUIVOS MODIFICADOS (principais):
═══════════════════════════════════════════════════════════════

supabase/migrations/2026081X_create_campaign_art_versions.sql
  ← NOVA tabela campaign_art_versions (com brief_snapshot jsonb, sem base64,
    + marcador correction_in_progress — decisão 5)
  ← colunas em campaigns (approval_status, rejection_count, approved_version_id, approved_at)
  ← índice único parcial 1 approved/campaign_id
  ← backfill: NADA (campanhas ready pré-flag seguem como estão — legacy)
  ← SEM alteração do CHECK generation_events nesta fase (telemetria via metadata — D8)

src/lib/campaign/types.ts
  ← CampaignApprovalStatus, CampaignArtVersion, RejectionReason,
    ArtCorrectionStrategy; CampaignRecord estendido

src/lib/campaign/persistence.ts
  ← createArtVersion, listArtVersions, markVersionRejected (motivo),
    approveArtVersion (transação: aprovar + descartar demais), deleteArtVersion,
    setCorrectionInProgress (marcador "regenerating" — decisão 5)
  ← SEM persistProductSourceImage/getProductSourceImage (imagens de input já
    persistidas pela F41 — decisão 2)

src/lib/campaign/brief.ts
  ← (F39) getCampaignLegalNotice() já preparado p/ F37
  ← rebuildBriefFromSnapshot(snapshot) — reconstrói CampaignBrief runtime
    (baixa TODAS as media.images[].storagePath e repõe os dataUrl — primary +
    referências, snapshot F41; decisão 2)

src/lib/campaign/display.ts
  ← approvalState com estado LEGACY explícito, computeApprovalState,
    versões para a UI, gating do copy/download/publication-copy (isDeliveryReleased)
  ← fonte oficial da arte: candidata ativa em campaign_art_versions (decisão 3);
    "regenerating" derivado do marcador da versão (decisão 5)

src/app/api/campaign/generate-image/route.ts
  ← insere v1 em campaign_art_versions quando flag ligado (mínimo — D10)
  ← SEM persistência de produto fonte (F41 já persiste os inputs — decisão 2)

src/app/api/campaign/[id]/regenerate/route.ts       (NOVA)
  ← guards (ownership/flag/cap/concorrência) + Correction Brief Parser (D4.1/decisão 13) +
    rebuildBriefFromSnapshot (multi-imagem, decisão 2) + ImageGenerationService +
    reabre operation_run_id + nova versão + stream + telemetria (sem reserva de crédito)

src/app/api/campaign/[id]/approve/route.ts          (NOVA)
  ← transação de aprovação + descarte + atualização da campanha

src/app/api/campaign/[id]/download/route.ts
  ← gate: 403 se pending/regenerating (flag on); legacy/not_enabled/approved → liberado

src/app/api/campaign/[id]/publication-copy/route.ts
  ← gate: 403 enquanto pending/regenerating (flag on); legacy/not_enabled/approved → liberado (decisão 4)

src/lib/image-generation/services/image-generation-service.ts
  ← buildPromptVariables/assemblePrompt aceitam texto cru de correção (decisão 8) +
    instrução fixa anti pixel-perfect e referências de imagem (arte candidata
    principal + produto auxiliar) na estratégia da 37.2 (D5)

prompts/regen/campaign-image-regenerate-surgical.md   (NOVO — decisão 16)
  ← correção cirúrgica/visual: prompt novo e específico (visual_adjustment), preservando a
    arte candidata como referência principal + produto F41 + texto cru + instrução fixa anti pixel-perfect
prompts/regen/campaign-image-regenerate-remake-offer.md     (NOVO — decisão 16)
prompts/regen/campaign-image-regenerate-remake-spotlight.md (NOVO — decisão 16)
prompts/regen/campaign-image-regenerate-remake-exclusive.md (NOVO — decisão 16)
  ← remake criativo (creative_remake): 3 prompts novos por intenção que reutilizam/espelham
    a lógica do diretor atual correspondente como base (sem alterar os prompts atuais) +
    bloco "gere uma nova alternativa diferente da arte recusada, usando a referência
    apenas como contexto do que não agradou"
prompts/campaign-image-director-{offer,spotlight,exclusive}.md
  ← NÃO alterados nesta fase (prompts atuais intocados — decisão 16, zero regressão no core)

src/lib/feature-flags/feature-flag-service.ts
  ← key 'campaign_approval_enabled' + isCampaignApprovalEnabled() (padrão F43/QCW:
    leitura DB, fallback fail-closed, env var só como fail-safe emergencial — decisão 1)
  ← ALL_FEATURE_FLAG_KEYS + tela admin "Controles operacionais" (motivo + auditoria)
  ← SEM flag de estratégia na 37.1 (text_only × text_plus_reference decidido na 37.2)


ARQUIVOS NOVOS (propostos — refinados no planejamento OpenSpec):
═══════════════════════════════════════════════════════════════

src/components/campaign/campaign-approval-view.tsx   ← tela de revisão (apenas a candidata ativa; sem download/copy)
src/components/campaign/campaign-correction-modal.tsx ← modal em 2 etapas (decisão 14): [Aprovar]/[Corrigir] → campo "O que você quer ajustar nesta arte?" + [Aplicar correção]/[Cancelar correção]; X/ESC/backdrop fecham sem aprovar
src/lib/campaign/correction-parser.ts                ← parser LEVE (D4.1/decisão 13 — camadas local/heurística/IA → visual_adjustment | creative_remake | unclear | blocked_new_campaign; factual_brief_correction na 37.3)
src/lib/campaign/correction-parser-validator.ts      ← validação de briefPatch contra o snapshot (37.3 — factual vs estratégica)
src/lib/campaign/__tests__/                          ← testes da máquina de aprovação/versões/parser/brief
(removido: campaign-adjustment-history.tsx — a UX mostra apenas a candidata ativa;
 o histórico de ajustes é interno/auditoria, decisão 12)
```

---

## Contratos de Integração

```typescript
// src/lib/campaign/brief.ts (F39 — leitura na regeração)

// Snapshot versionado persistido em campaigns.input_snapshot (sem base64).
// Em produção o domínio CampaignBrief é reconstruído a partir dele.
import { buildCampaignBriefSnapshot, CampaignBriefSnapshot } from "@/lib/campaign/brief";

// (F37/decisão 2) Reconstrói o CampaignBrief runtime a partir do snapshot F41,
// baixando TODAS as media.images[].storagePath e repondo os dataUrl
// (primary + referências). SEM persistência nova de produto fonte.
export async function rebuildBriefFromSnapshot(snapshot: CampaignBriefSnapshot): Promise<CampaignBrief>;
```

```typescript
// src/lib/campaign/types.ts (extensões)

export type CampaignApprovalStatus = "pending_approval" | "approved";

export type ArtVersionStatus = "pending" | "approved" | "rejected";

export type ArtCorrectionStrategy = "text_only" | "text_plus_reference";

export type RejectionReason =
  | "product_not_good"
  | "text_unreadable"
  | "different_style"
  | "colors_mismatch"
  | "offer_unclear"
  | "different_option";   // apoio opcional na UI (chips) — NUNCA substitui o texto livre

export interface CampaignArtVersion {
  id: string;
  campaign_id: string;
  version_number: number;        // 1..3
  status: ArtVersionStatus;
  storage_path: string | null;   // {storeId}/{campaignId}/v{n}.jpg — NULL após descarte do asset
  asset_status: "active" | "discarded";   // 'active' só para a candidata/aprovada
  asset_deleted_at: string | null;
  brief_snapshot: Record<string, unknown>;   // campaign_brief_v1 (F39) — sem base64 (corrigido na versão se houve briefPatch)
  render_snapshot: Record<string, unknown> | null;
  generation_metadata: Record<string, unknown> | null;  // operation_run_id + snapshots econômicos
  rejection_reason: {
    reason?: RejectionReason;           // chip opcional
    freeText: string;                   // obrigatório (fonte primária)
    correctionType?: CorrectionType;    // classificação do parser (D4.1)
    userIntent?: string;                // intenção interpretada
    briefPatch?: BriefPatch;            // patch aplicado nesta versão (correção factual)
  } | null;
  created_at: string;
}

export interface CampaignCorrectionInput {
  correctionText: string;        // campo livre OBRIGATÓRIO (D4)
  quickReason?: RejectionReason; // apoio opcional (chips)
}
```

```typescript
// src/lib/campaign/persistence.ts (extensões)

export async function createArtVersion(
  campaignId: string,
  versionNumber: number,
  storagePath: string,
  briefSnapshot: Record<string, unknown>
): Promise<CampaignArtVersion>;

export async function listArtVersions(campaignId: string): Promise<CampaignArtVersion[]>;

export async function markVersionRejected(
  campaignId: string,
  versionNumber: number,
  correction: CampaignCorrectionInput & { intent?: CorrectionIntent }  // texto + parser (D4.1)
): Promise<void>;

// Descarta o asset de uma versão rejeitada (após regeração com sucesso):
// remove arquivo do storage + storage_path→NULL + asset_status='discarded' + asset_deleted_at.
export async function discardArtAsset(
  campaignId: string,
  versionNumber: number,
  storagePath: string
): Promise<void>;

// Transação: aprova a candidata, garante que nenhuma outra linha retém asset ativo,
// atualiza campaigns (storage_path → aprovada, approved_version_id, approved_at).
export async function approveArtVersion(
  campaignId: string,
  versionId: string,
  approvedStoragePath: string
): Promise<void>;

// Decisão 5: marcador "regenerating" na candidata ativa (sem tocar no CHECK de campaigns.status).
export async function setCorrectionInProgress(
  campaignId: string,
  versionNumber: number,
  inProgress: boolean
): Promise<void>;
```

```typescript
// src/lib/campaign/display.ts (extensões)

export type ApprovalDisplayState =
  | { status: "not_enabled" }              // flag desligado — comportamento atual
  | { status: "legacy" }                   // flag ligado, campanha pré-flag (sem versões) — entregue como hoje
  | { status: "pending" }                  // aguardando aprovação (revisão)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" };            // correção em andamento — derivado do marcador correction_in_progress da candidata ativa (decisão 5)

export function computeApprovalState(
  campaign: CampaignRecord,
  versions: CampaignArtVersion[],
  flagEnabled: boolean
): ApprovalDisplayState;

// Gate de entrega: copy e download só liberados quando not_enabled | legacy | approved
export function isDeliveryReleased(
  state: ApprovalDisplayState
): boolean;
```

```typescript
// src/lib/campaign/correction-parser.ts (D4.1/decisão 13 — interpretação obrigatória do pedido)

// 37.2 (parser leve): visual_adjustment | creative_remake | unclear | blocked_new_campaign.
// 37.3: + factual_brief_correction (gera briefPatch).
export type CorrectionType =
  | "visual_adjustment"        // ajuste visual — permitido, chama o diretor (consome tentativa)
  | "creative_remake"          // remake criativo — permitido, chama o diretor (consome tentativa)
  | "blocked_new_campaign"     // mudança estratégica — bloqueada (não chama, não consome)
  | "unclear";                 // inválido/ambíguo — pedir detalhe (não chama, não consome)

export interface CorrectionIntent {
  valid: boolean;
  correctionType: CorrectionType;
  userIntent: string;                    // p/ telemetria/auditoria
  rawUserText: string;                   // texto CRU enviado ao diretor (decisão 8)
  briefPatch?: BriefPatch;               // correção factual (37.3) → patch no snapshot da próxima versão
  needsUserClarification?: boolean;
}

// Decisão 10 (37.3) — correção factual CONTROLADA: apenas campos factuais que impactam a
// arte; comparado contra os campos ESTRUTURADOS do campaign_brief_v1. NUNCA abre
// rebriefing (produto/mecânica/intent/briefing livre → blocked_new_campaign).
export interface BriefPatch {
  product?: Partial<Pick<CampaignBriefProduct, "name">>;   // só erro de digitação
  commercial?: Partial<
    Pick<
      CampaignBriefCommercial,
      "originalPriceCents" | "discountedPriceCents" | "badgeText" | "hook" | "cta"
    >
  > & {
    validity?: { enabled?: boolean; displayText?: string };   // F40 estruturado
    legalNotice?: { enabled?: boolean; text?: string };       // inclui aviso ilustrativo (folding F40)
  };
}

// Camadas 1–3 (validação local → heurística → IA barata). Retorna decisão intermediária.
// 37.2: classifica visual/remake/unclear/blocked; NÃO emite briefPatch.
export async function classifyCorrectionRequest(
  text: string,
  snapshot: CampaignBriefSnapshot
): Promise<CorrectionIntent>;

// Valida o patch contra o snapshot (D4/decisão 10 — 37.3): apenas correção factual compatível
// é aceita; mudança de mecânica/produto/intent → blocked_new_campaign.
export function validateBriefPatch(
  snapshot: CampaignBriefSnapshot,
  patch: BriefPatch
): { allowed: boolean; reason?: string; blockedReason?: "new_campaign" };

// Compõe o bloco de instrução do diretor (D5/decisão 8): texto CRU do usuário + instrução
// FIXA anti pixel-perfect + referências (arte candidata principal + imagens do produto F41).
export function buildDirectorInstruction(
  intent: CorrectionIntent,
  references: { candidateArtDataUrl: string; productImagesDataUrls: string[] }
): { promptBlock: string; referenceImageUrls: string[] };
```

```typescript
// Rotas

// POST /api/campaign/[id]/regenerate
body: { correctionText: string }   // campo livre obrigatório (parser classifica; texto válido vai CRU ao diretor — decisão 8)
→ 200 NDJSON stream (phase/result/error)
→ 400 unclear text (não chama diretor, não consome correção)
→ 403 not owner / flag off
→ 409 rejection cap reached | concurrent regeneration | blocked_new_campaign (validateBriefPatch)
→ 404 campaign not found

// POST /api/campaign/[id]/approve
body: { versionId: string }
→ 200 { campaignUrl, status: "approved" }
→ 403 not owner / flag off
→ 404/409 version invalid or already resolved
```

---

## Testes

Testes seguindo o padrão do repositório (vitest + Testing Library):

### Máquina de aprovação / estados (10+ testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 1 | `computeApprovalState` com flag off → `not_enabled` | Comportamento atual preservado |
| 2 | `computeApprovalState` flag on, sem versões → `legacy` | **D2 — campanha antiga entregue mesmo com flag ligada** |
| 3 | `computeApprovalState` flag on, com versões, sem aprovada → `pending` | Revisão ativa |
| 4 | `computeApprovalState` com `approved_version_id` → `approved` + `approvedAt` | Entrega liberada |
| 5 | `computeApprovalState` durante regeração → `regenerating` | Estado intermediário |
| 6 | `isDeliveryReleased` true para `not_enabled`/`legacy`/`approved`; false para `pending`/`regenerating` | **D2 — gate de entrega + legacy** |
| 7 | Aprovação da candidata: vira `approved`; nenhuma outra linha retém asset ativo | **D8 — transação** |
| 8 | Índice único parcial: não permite 2 aprovadas por campanha | Integridade |
| 9 | Cap: `rejection_count` chega a 2 → `/regenerate` retorna 409 | **D3 — hard cap** |
| 10 | Só a candidata (`asset_status='active'`) é aprovável; rejeitadas descartadas não são oferecidas para aprovação | **D7 — uma candidata por vez** |

### Parser de correção / política (D4/D4.1/decisão 13) — 9 testes

> **Escopo por fatia:** os testes **12/16/18** (visual/remake) e os casos `unclear`/`blocked` (11/15/17) valem a **37.2** (parser leve). Os testes **13/14/19** (factual + snapshot corrigido) valem a **37.3** (`factual_brief_correction`).

| # | Teste | O que valida |
|---|-------|-------------|
| 11 | Texto vazio/lixo (".", "ok", "nada") → `unclear` no clique; não chama diretor, não consome correção | **D4.1 — validação local** |
| 12 | "muda o fundo pra rosa" → `visual_adjustment` permitido | **D4.1** |
| 13 | "preço é 0,99 não 1,99" → `factual_brief_correction` + `briefPatch.discountedPriceCents=99` (**37.3**) | **D4/D4.1 — correção factual** |
| 14 | "muda a validade p/ 31/08" (valor errado) → `factual_brief_correction` permitido pré-aprovação (**37.3**) | **D4/D10** |
| 15 | `validateBriefPatch`: remover aviso legal / mudar mecânica ("20% off"→"leve 2 pague 1") → bloqueado (**37.3**) | **D4 — mudança estratégica** |
| 16 | "a cor não combina" → `visual_adjustment` (escopo visual permitido) | **D4.1** |
| 17 | "faz outro produto" → `blocked_new_campaign` → 409 + orientação nova campanha | **D4.1** |
| 18 | "não gostei dessa composição, refaça" → `creative_remake` dentro do cap | **D4.1** |
| 19 | Correção factual: v2 nasce com `brief_snapshot` **corrigido**; v1 preserva o snapshot antigo (histórico por versão) (**37.3**) | **D4/D10** |

### Pipeline / regeração (10 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 20 | `/regenerate` guard ownership + flag | Segurança |
| 21 | `/regenerate` guard anti-concorrência (uma por vez) | **D10** |
| 22 | Regeneração reconstrói o brief a partir do `campaign_brief_v1` (não revalida input, não usa formulário) | **F39 + D8** |
| 23 | Regeneração **reabre o `operation_run_id`** da campanha — eventos v2/v3 no mesmo run (sem novo run) | **D1/D8 — modelo F38.1+** |
| 24 | Regeneração **não reserva crédito** (nenhuma `credit_transactions` nova, nenhuma `operation_key` nova) | **D3** |
| 25 | Regeneração usa as imagens de input do snapshot F41 (reconstrói `dataUrl` de `media.images[].storagePath` — primary + referências; **sem `persistProductSourceImage`**) | **D8/decisão 2** |
| 26 | Regeneração com sucesso: v2 vira candidata (`asset_status='active'`); v1 → `rejected` + asset descartado; **v2 usou a arte candidata (v1) como referência principal + imagens do produto do snapshot F41 como auxiliares** (decisão 7) | **D5/decisões 6/7/D8 — substituição + referência** |
| 27 | **Falha técnica na regeração → mantém a candidata anterior; NÃO consome correção** (sem linha nova, `rejection_count` inalterado) | **D3/D8** |
| 28 | Parser `unclear`/`blocked_new_campaign` → 400/409; **não chama diretor, não consome correção** (sem linha nova) | **D4.1** |
| 29 | `/generate-image` com flag on insere v1 em `campaign_art_versions`; flag off não insere (comportamento atual). **Sem persistência nova de produto fonte** (F41 já sobe os inputs) | **D7/D1/decisão 2** |

### Download / copy gated (5 testes)

| # | Teste | O que valida |
|---|-------|-------------|
| 30 | Download com `pending_approval` + flag on → 403 | **D2** |
| 31 | Download após aprovação → 200 (servindo a arte aprovada) | **D2/D8** |
| 32 | Download de campanha **legacy** (flag on, sem versões) → 200 | **D2 — legado preservado** |
| 33 | Copy oculto até aprovar (UI não renderiza Kit de Publicação) | **D2** |
| 34 | Copy visível após aprovação (editável, F17 preservado) | **D2** |

### Testes adicionais (revisão 2026-09-01 — decisões 1–8, 12–15)

| # | Teste | O que valida |
|---|-------|-------------|
| 35 | `POST /api/campaign/[id]/publication-copy` com `pending`/`regenerating` + flag on → 403; após aprovação → 200; legado → 200 | **decisão 4 — gate também na copy** |
| 36 | `computeApprovalState` durante correção → `regenerating` **derivado do marcador `correction_in_progress`** em `campaign_art_versions`; `campaigns.status` permanece `ready` | **decisão 5 — sem tocar no enum** |
| 37 | Regeneração envia o **texto cru do usuário** + **instrução fixa anti pixel-perfect** ao diretor (sem filtrar termos) | **decisão 8** |
| 38 | Diretor recebe **arte candidata (referência principal) + imagens do produto do snapshot F41 (auxiliares)** na regeração | **decisões 6/7** |
| 39 | UI mostra **apenas a candidata ativa**; nenhuma versão anterior é selecionável/recuperável | **decisão 12** |
| 40 | Revisão renderiza da **candidata ativa** em `campaign_art_versions`; legado renderiza de `campaigns.storage_path` | **decisão 3** |
| 41 | Modal em 2 etapas: **[Cancelar correção]** volta à ETAPA 1 (não aprova); X/ESC/backdrop fecham sem aprovar | **decisão 14** |
| 42 | Parser 37.2: `visual_adjustment`/`creative_remake` chamam o diretor e consomem tentativa; `unclear`/`blocked_new_campaign` não | **decisão 13** |
| 43 | Regeneração reutiliza as imagens de input da F41 (`media.images[].storagePath`) — **sem `persistProductSourceImage`/`getProductSourceImage`** | **decisão 2** |
| 44 | Regeneração seleciona prompt por `correctionType`: `visual_adjustment` → `prompts/regen/campaign-image-regenerate-surgical.md`; `creative_remake` → `prompts/regen/campaign-image-regenerate-remake-{intent}.md` (intent do snapshot, 3 arquivos por intent); **prompts de geração inicial intocados** | **decisão 16** |

### Regressão (obrigatória)

- `generate-image` — 402/409/estorno inalterados quando flag off; suíte de crédito/telemetria continua passando
- Gates F32/F33/F34/F36/F38/F39 e assinatura visual inalterados; golden tests F39 (comportamento de geração idêntico) continuam verdes
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Custo de IA por crédito pode subir** (v1+v2+v3) | Correções agregadas **no mesmo `operation_run_id`** (uma entrega); medir **custo real por campanha aprovada** no painel F38.2; experimento beta com flag (D1); se a aprovação em v1/v2 for alta, custo aceitável; reduzir cap é decisão de política comercial pós-experimento |
| **Correção não funciona** (feedback mal interpretado pelo modelo) | **Parser leve classifica antes de chamar o diretor** (D4.1/decisão 13) + **texto cru do usuário** enviado sem filtro + **instrução fixa anti pixel-perfect** (decisão 8) + **arte candidata como referência principal + imagens do produto como auxiliares** (decisões 6/7); spike de validação pré-GA; o revisor (F31.3) continua como rede de segurança |
| **Loop de correções** (diretor oscila entre copiar fielmente e transformar) | **Instrução FIXA anti pixel-perfect** (decisão 8) resolve termos de loop ("exatamente igual"/"idêntico"/"não altere nada" = preservar sem reprodução pixel a pixel); **texto cru vai ao diretor sem filtro** (evita perda de intenção); cap de 2 limita o dano |
| **Feedback tenta reescrever o briefing** (produto, mecânica de oferta, intent) | **Parser classifica + `validateBriefPatch`** (D4/D4.1): apenas correção factual compatível é aceita; mudança estratégica → bloqueada e orientada a nova campanha |
| **Correção factual vira porta para rebriefing livre** ("corrigir erros próprios") | Exceção **limitada** a campos factuais que impactam a arte (preço/validade/aviso legal/desconto/digitação), **consome uma das 2 correções**, validada por comparação com o `campaign_brief_v1` e auditada (histórico por versão) |
| **Falso negativo do parser** (mudança comercial sutil não detectada) | Camadas heurística + IA classificam e geram `briefPatch`; `validateBriefPatch` valida o patch contra o snapshot; `ImageReviewService` (F31.3) audita cada versão contra o comportamento esperado da intent |
| **Falso positivo do parser** (texto mal escrito/bloqueado por engano) | Parser aceita linguagem simples/errada/incompleta; `unclear` pede detalhe em vez de bloquear; botão sempre disponível com algum texto; orientação clara nunca deixa o usuário sem caminho |
| **Regeneração sem imagem do produto** (provider exige `dataUrl`; snapshot F39 não guarda base64) | **Já resolvido pela F41 (decisão 2)**: inputs persistidos em `campaign-images/{storeId}/{campaignId}/inputs/...` com `media.images[].storagePath` no snapshot; a regeração baixa e repõe os `dataUrl` (primary + referências); campanhas legadas não regeneram (estado legacy) |
| **Imagens de input descartadas junto com a arte rejeitada** | Arte rejeitada pode ser descartada, mas as **imagens de input do snapshot F41 permanecem enquanto a campanha existir** (decisão 2) — são insumo auditável/regerável, não arte |
| **Abuso do cap** (rejeitar para acumular variações) | **Uma candidata por vez** — rejeitadas são descartadas e não voltam a ser aprováveis (sem galeria); cap explícito e finito (2 correções); unidade = campanha aprovada (D3); sem v4; não é vendido como benefício; custo extra é o preço do experimento e é medido |
| **Regeneração concorrente** (clique duplo gera duas v2) | Guard anti-concorrência por campanha (padrão VS) — D10 |
| **Limitação do cap no meio de uma geração em andamento** | Guard no início do stream (409) + verificação no preflight da rota |
| **Campanhas antigas "quebradas" pelo gate** | **Estado legacy explícito** (D2/D7): sem versões → entregue como hoje, mesmo com flag ligada; flag só afeta gerações novas |
| **Descarte acidental de arte aprovada / candidata** | Substituição e aprovação **transacionais** (D8): o asset só é descartado após a regeração ter sucesso ou a aprovação ser confirmada; `asset_status`/`asset_deleted_at` dão estado explícito; histórico textual preservado p/ analytics |
| **Custo/tokens da estratégia B (imagem de referência extra)** | Contido ao cap de 2; flag permite desligar para `text_only`; medido como componente do mesmo run em `generation_events` |
| **Reabertura do `operation_run_id` misturando entrega/receita** | Mecânica prevista pela F38.1 (coluna preparada); reuso apenas na mesma campanha; snapshots econômicos 38.2.1 já estão por evento — agregação correta no painel F38.2 |
| **Overhead da rota monolítica (v1) ao inserir versão** | Mudança mínima (D10): só insere a v1 em `campaign_art_versions`; sem refactor maior e **sem persistência nova de produto fonte** nesta fase |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **v4+ paga / meia cobrança por correção** | Decisão do Q&A (D3): no beta o cap é 2 correções e **sem cobrança**; erro de IA não pode ser cobrado do usuário; política comercial (incl. cobrança por "nova variação criativa") só com dados do experimento |
| **Nova `operation_key` de crédito (`campaign_regeneration`/`campaign_approval`)** | Adiado (D3/D8) — correção é parte da entrega; sem reserva nova no beta |
| **Galeria de versões aprováveis (variações)** | Modelo é **uma arte candidata por vez** (D7/D8): correção **substitui** a entrega; rejeitadas não voltam a ser aprováveis (evita "rejeitar = ganhar variações") |
| **Rebriefing estratégico livre de campanha existente** | Fora de escopo — trocar produto, mudar a mecânica da oferta ou a intenção = **nova campanha** (fluxo atual); a **correção factual limitada pré-aprovação** (preço/validade/aviso legal/desconto/digitação) fica **dentro** da F37 (D4 — fatia 37.3) |
| **Catálogo de produtos** (`productCatalogId`/`productAssetId` reais) | Reservado pela F39 (D3 do brief) — fora desta fase |
| **Estorno/reembolso automático** | Suporte avalia manualmente com contexto registrado (D6); F24/F26 já dão base |
| **Extrair "core de geração" compartilhado (refactor da rota de geração)** | Adiado (D10) — regeração chama o serviço diretamente; refactor maior se necessário numa fase futura |
| **App de revisão colaborativa / multi-approver** | Modelo é 1 lojista por loja; revisão colaborativa é cenário futuro |
| **Notificações push/email de "versão nova pronta"** | Sem infra de notificação no beta; o lojista aguarda no stream |
| **Rascunho/autosave de feedback** | Modal curto; feedback é pontual por rejeição |
| **Stripe / Monetização Pública** | Renumerada para **F40** (v1.7, pós-beta) |
| **Aprovação em lote / múltiplas campanhas** | Fluxo é por campanha |
| **i18n** | Produto PT-BR. i18n é fase futura |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Experimento beta: flag `campaign_approval_enabled` na tabela `feature_flags` (padrão F43/QCW — `FeatureFlagService`, admin "Controles operacionais", fallback fail-closed; **sem env/launch-config**); campanhas `ready` pré-flag intactas; estratégia de correção decidida na 37.2
- [ ] D2 — Download **e** `POST /publication-copy` bloqueados até aprovar (libera ambos pós-aprovação; legado mantém o atual); botão primário "Aprovar e liberar campanha"; **estado legacy explícito** (sem versões → entregue como hoje)
- [ ] D3 — **1 campanha = 1 arte aprovada, até 2 correções incluídas**; sem v4, sem meia cobrança, **sem nova reserva/operation_key**; UI não vende "tentativas"
- [ ] D4 — **Modal em 2 etapas (decisão 14)**: ETAPA 1 [Aprovar]/[Corrigir] → ETAPA 2 "O que você quer ajustar nesta arte?" (campo livre obrigatório) + [Aplicar correção]/[Cancelar correção]; Cancelar volta à ETAPA 1; X/ESC/backdrop fecham sem aprovar; política de correção em 3 tipos; **correção factual é escopo da 37.3** (decisões 9/10)
- [ ] D4.1/decisão 13 — **Parser leve obrigatório**: texto → `CorrectionIntent` (`visual_adjustment`/`creative_remake`/`unclear`/`blocked_new_campaign` na 37.2; `factual_brief_correction` na 37.3); só visual/remake chamam o diretor **e consomem tentativa**; `unclear`/`blocked` respondem com orientação sem consumir
- [ ] D5 + decisões 6/7/8 — v2 com **arte candidata como referência principal** + **imagens do produto (snapshot F41) como referências auxiliares**; **texto cru do usuário ao diretor** + **instrução fixa anti pixel-perfect** (resolve "exatamente igual"/"idêntico"/"não altere nada"); comparação de estratégia e mecanismo de ativação decididos na 37.2; spike pré-GA de validação
- [ ] D6 — Ao exceder o cap: painel de orientação (nova campanha / suporte) com copy de encerramento sem abandono; **candidata atual continua aprovável**; suporte/reembolso orientado para caso de entrega não conforme
- [ ] D7 — `campaign_art_versions` (v1..3, **1 candidata por vez**, pending/approved/rejected + `asset_status` active/discarded + marcador `correction_in_progress`, `storage_path` nullable, **brief_snapshot campaign_brief_v1**, 1 approved/campaign) + colunas em `campaigns`; **fonte oficial da arte = candidata ativa** (decisão 3); **UX sem histórico recuperável** (decisão 12)
- [ ] D8 — Regeneração consome o snapshot F39 + **imagens de input da F41** (`media.images[].storagePath` — **sem `persistProductSourceImage`**), **reabre o `operation_run_id`**, **substitui a candidata** (falha técnica mantém a anterior sem consumir correção), sem reserva de crédito; aprovação transacional; telemetria no modelo F38.1+ (sem `generation_type` novo)
- [ ] D9 — Copy fora da regeração; Kit de Publicação surge após aprovação
- [ ] decisões 9/10 — **37.2 restrita à correção visual/criativa**; correção factual controlada na **37.3** via `briefPatch` (preço/validade/aviso legal + aviso ilustrativo/badge e chamada comercial/digitação; mudança estratégica ampla bloqueada)
- [ ] D10 — Reuso do `ImageGenerationService` na regeração; sem refactor da rota de geração nesta fase
- [ ] D11 — Renumeração F38–F43 concluídas; **Stripe fora da numeração** (v1.7+, diferida); seção F37 preenchida ao planejar (37.1/37.2/37.3)
- [ ] D12 — Execução em **fatias 37.1 / 37.2 / 37.3** (waves obrigatórias, padrão F38); 37.1 sem correção, 37.2 correção visual com referência, 37.3 correção factual controlada; gates verdes entre fatias
- [ ] decisão 15 — Contrato F44.3: F37 registra **aprovação confiável por campanha**; F44.3 fixa a primeira campanha aprovada do Tema como `theme_visual_reference_campaign_id` (F37 não escreve na coluna; novas aprovações não substituem automaticamente)
- [ ] decisão 16 — **Prompts de regeração** em `prompts/regen/`: `campaign-image-regenerate-surgical.md` (único, `visual_adjustment`); `campaign-image-regenerate-remake-{offer,spotlight,exclusive}.md` (3 prompts por intenção para `creative_remake`, espelhando o diretor atual correspondente + bloco de nova alternativa); **prompts atuais intocados**; seleção por `correctionType` + intent do snapshot no `/regenerate` (D10)

### Fluxo de revisão
- [ ] Flag on: nova campanha cai na tela de revisão (sem download, sem copy)
- [ ] Flag on: botões primário "Aprovar e liberar campanha" e secundário "Corrigir"
- [ ] Modal em 2 etapas: [Aprovar]/[Corrigir] → [Corrigir] abre "O que você quer ajustar nesta arte?" + [Aplicar correção]/[Cancelar correção]; Cancelar volta à decisão; X/ESC/backdrop fecham sem aprovar
- [ ] Pedido → parser leve classifica (decisão 13); `unclear`/`blocked` → resposta humana, sem chamar diretor, sem consumir correção; visual/remake → diretor com **texto cru + instrução fixa anti pixel-perfect** (decisão 8)
- [ ] Correção factual (37.3: preço/validade/aviso legal/badge/chamada/digitação) → v2 nasce com snapshot corrigido; v1 preserva o antigo
- [ ] Pedido de ajuste → gera v2 (stream de progresso); **sucesso → v1 descartada (asset) e v2 vira candidata**
- [ ] **Falha técnica na regeração → mantém a candidata anterior; não consome correção**
- [ ] Revisão mostra **apenas a candidata ativa**; nenhuma versão anterior é selecionável/recuperável (decisão 12)
- [ ] 3ª rejeição → painel de orientação (nova campanha / suporte); **candidata atual ainda aprovável**
- [ ] Aprovar a candidata → entrega liberada (arte + copys + download)
- [ ] Flag off: fluxo atual intacto (entrega imediata, download livre, copy visível)

### Imutabilidade estratégica + correção factual (D4/D4.1)
- [ ] Ajuste visual (estilo/cor/texto/estética) → permite regeração com a **arte candidata como referência principal** + imagens do produto como auxiliares
- [ ] Correção factual (37.3: preço/desconto/validade/aviso legal + aviso ilustrativo/badge e chamada comercial/digitação errados) → permitida pré-aprovação, dentro do cap, atualiza snapshot da próxima versão
- [ ] Mudança estratégica (outro produto, mecânica de oferta, intent, nova campanha disfarçada) → **bloqueada** com orientação a nova campanha (**parser + `validateBriefPatch` contra o `campaign_brief_v1`**)
- [ ] Prompt do diretor declara campos estratégicos imutáveis + **instrução fixa anti pixel-perfect** (preservar essência; "exatamente igual"/"idêntico"/"não altere nada" = preservar sem reprodução exata)
- [ ] Revisor audita cada versão contra o comportamento esperado da intent

### Legado e gating (D2/D7)
- [ ] Campanha legada (sem `campaign_art_versions`) continua entregue com download/copy liberados, mesmo com flag ligada
- [ ] Campanha nova pendente → download/copy bloqueados
- [ ] Rota `GET /api/campaign/[id]/download` respeita o estado (legacy/approved liberado; pending/regenerating 403 com flag on)

### Crédito e custo (D1/D3/D8)
- [ ] Regeneração NÃO reserva novo crédito, NÃO cria `credit_transactions` nova, NÃO adiciona `operation_key`
- [ ] Regeneração reabre o `operation_run_id` da campanha (eventos v2/v3 no mesmo run)
- [ ] `unclear`/`blocked_new_campaign`/falha técnica → NÃO consomem correção (sem linha nova)
- [ ] Telemetria por `version_number` + `correction_type`/`correction_strategy` + `rejection_reason` em metadata; funil em `campaign_art_versions`
- [ ] Custo por campanha aprovada (call-level + snapshots econômicos 38.2.1) exibido no painel F38.2

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local (beta testers)
- [ ] Lojista gera campanha → vê revisão sem download/copy (candidata v1)
- [ ] Lojista abre o modal (ETAPA 1) → clica Corrigir → digita "muda o fundo pra rosa" → Aplicar → v2 substitui v1 preservando essência (referência = candidata + imagens do produto); v1 deixa de estar disponível
- [ ] Lojista cancela a correção → volta à ETAPA 1 sem aprovar; fecha com X/ESC → modal some sem aprovar
- [ ] Lojista corrige preço na revisão (37.3: "preço é 0,99 não 1,99") → correção factual aplicada na v2 (snapshot corrigido); v1 preserva o antigo
- [ ] Lojista digita "faz outro produto" → bloqueio com orientação a nova campanha (não consome correção)
- [ ] Lojista digita "sei lá ficou ruim" → sistema pede detalhe com exemplo (não consome correção)
- [ ] Regeneração falha tecnicamente → v1 permanece candidata e a correção não é consumida
- [ ] Lojista aprova a candidata atual → entrega liberada
- [ ] Lojista esgota 3 versões → orientação nova campanha / suporte; candidata ainda aprovável
- [ ] Campanha antiga (pré-flag) continua entregue sem gate
- [ ] Regressão: geração completa, downloads pós-aprovação, copy editável, créditos, painel F38.2 mostrando correções no mesmo run

---

*Documento criado: 2026-08-06*
*Revisado em: 2026-08-13 — realinhamento pós-F39 (Brief Estruturado concluída) e pós-F38/F38.1/F38.2/F38.2.1 (custo de IA por entrega). Decisões: Stripe → F40 (v1.7); regeração consome `campaign_brief_v1` (F39), reabre o `operation_run_id` e não re-monta briefing manualmente; `campaign_art_versions.brief_snapshot` compatível com F39; guard de imutabilidade por comparação contra o brief estruturado; telemetria no modelo F38.1+ (call-level + snapshots econômicos) sem novos `generation_type`; custo de correção dentro da entrega, sem nova cobrança/operação no beta; estado legacy explícito no gating de download/copy; flags no padrão do launch config atual; suporte/reembolso orientado para entrega não conforme; **uma arte candidata por vez** — correção substitui, rejeitadas não voltam a ser aprováveis (galeria removida), com `asset_status`/`asset_deleted_at` e falha técnica preservando a candidata sem consumir correção; produto fonte persistido (media.images[].storagePath) permanece enquanto a campanha existir; **modal de revisão da arte com campo livre obrigatório + Correction Brief Parser (D4.1)** — texto livre interpretado em intenção estruturada antes da regeração, `unclear`/`blocked` sem consumir correção, X/ESC/backdrop fecha sem aprovar; **correção factual de briefing permitida pré-aprovação** (snapshot da próxima versão corrigido, histórico por versão preservado); **referência da correção = arte candidata atual** (produto como secundária) com prompt anti pixel-perfect; **fatiamento D12 em 37.1 / 37.2 / 37.3** (waves obrigatórias, padrão F38); **37.1 sem correção** — Correction Brief Parser/`briefPatch`/`validateBriefPatch`/referência de arte/cap ficam **adiados** (design futuro, não requisito da fatia) e o botão "Pedir ajuste" é ausente/desabilitado (nunca abre modal na 37.1); "Fora do Escopo" corrigido: rebriefing estratégico livre fora, correção factual limitada dentro.*
*Revisado em: 2026-09-01 — realinhamento pós-F40/F41/F42/F43 + decisões do dono do produto (as decisões 08-13 citadas acima que conflitam com esta revisão ficam superadas). Decisões incorporadas: **(1)** flag `campaign_approval_enabled` na tabela `feature_flags` (padrão F43/QCW, sem env/launch-config; estratégia de correção decidida na 37.2); **(2)** F37 NÃO cria `persistProductSourceImage`/`getProductSourceImage` — regeração reutiliza o snapshot F41 (`media.images[].storagePath`, primary + referências); **(3)** fonte oficial da arte = candidata ativa em `campaign_art_versions`; `campaigns.storage_path` vira a aprovada no approve (legado usa `storage_path`); **(4)** gate também no `POST /publication-copy` (libera ambos pós-aprovação; legado mantém o atual); **(5)** `campaigns.status` NÃO muda para correção — `regenerating` derivado do marcador `correction_in_progress` em `campaign_art_versions`; **(6/7)** correção visual: arte candidata como referência principal + imagens do produto do snapshot F41 como auxiliares; **(8)** texto cru do usuário vai ao diretor + instrução fixa anti pixel-perfect (resolve "exatamente igual"/"idêntico"/"não altere nada"); **(9)** 37.2 restrita à correção visual/criativa; correção factual via `briefPatch` na 37.3; **(10)** factual controlada: preço/validade/aviso legal + aviso ilustrativo/badge e chamada comercial/digitação; estratégica ampla bloqueada; **(11)** cap mantido (v1+v2+v3, sem meia cobrança, sem nova reserva/operation_key); **(12)** UX mostra só a candidata ativa — histórico interno/auditoria, sem versão anterior selecionável; **(13)** parser leve 37.2 (`visual_adjustment`/`creative_remake`/`unclear`/`blocked_new_campaign`), só visual/remake chamam o diretor e consomem tentativa; **(14)** modal em 2 etapas [Aprovar]/[Corrigir] → campo "O que você quer ajustar nesta arte?" + [Aplicar correção]/[Cancelar correção] (Cancelar volta à decisão; X/ESC/backdrop fecham sem aprovar); **(15)** contrato F44.3: F37 só registra aprovação confiável; F44.3 fixa a primeira campanha aprovada do Tema como `theme_visual_reference_campaign_id` (novas aprovações não substituem automaticamente); **(16)** prompts de regeração em `prompts/regen/` (surgical único para `visual_adjustment`; **remake em 3 prompts por intenção** `campaign-image-regenerate-remake-{offer,spotlight,exclusive}.md`, espelhando o diretor atual correspondente como base, sem alterar os prompts atuais, + bloco "nova alternativa diferente da arte recusada"), seleção por `correctionType` + `commercial.intent` do snapshot; rótulo padrão da 37.2 = botão **Corrigir** (ausente/desabilitado na 37.1) e etapa 2 **[Aplicar correção]/[Cancelar correção]**; storage corrigido: arte rejeitada = arquivo descartado, linha preservada sem `storage_path` para auditoria/telemetria.*
*Baseado na exploração do fluxo de geração (F25/F31), do padrão de aprovação/feedback da assinatura visual (F29.1.1), do sistema de créditos (F24/F29.3/F38), da telemetria de custo (F38.1/F38.2/F38.2.1) e do brief estruturado (F39). Decisões do Q&A: nome da fase "Revisão e Aprovação da Arte"; copy oculto até aprovar; storage com descarte das não-aprovadas preservando histórico textual; sem v4 paga e sem meia cobrança no beta; download bloqueado até aprovação; renumeração Stripe → F40. Incorporadas as conclusões da revisão: experimento beta controlado (não feature comercial ampla), unidade de entrega = campanha aprovada, não vender "até 3 gerações", máxima esforço na primeira correção com telemetria forte, aposta em arte candidata como referência na v2, modal de revisão (sem retorno ao formulário), parser de intenção obrigatório e correção factual controlada — e consumo do snapshot `campaign_brief_v1` da F39.*
*Próximo passo: sua revisão e aprovação — após aprovação, iniciar planejamento da fase via OpenSpec (37.1 primeiro).*
