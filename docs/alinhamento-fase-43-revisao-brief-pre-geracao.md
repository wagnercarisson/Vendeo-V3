# Alinhamento Fase 43 — Revisão do Brief Pré-Geração (v1.5)

> **Renumeração (esta fase):** F43 = **Revisão do Brief Pré-Geração** (nova, v1.5). **Stripe / Monetização Pública sai da tabela de fases numeradas** e vira **iniciativa diferida não numerada** ("Monetização pública / Stripe, v1.7+") — reaberta quando houver condição real de executar (empresa, jurídico, contabilidade, operação fiscal, decisão de monetização). **F42 = Signup Controlado e Elegibilidade Freemium está CONCLUÍDA** (UAT 20.6 validado e migration 42-12 aplicada — código em produção; **observação:** marcar as checkboxes de UAT 20.5–20.15 nos trackings, que não foram atualizadas). O estado real atual dos 6 trackings tem **F42 = Signup** (renumeração F42 aplicada) e **F43 = Stripe** — este último é **resíduo a limpar, não estado esperado**: a **D1** desta fase aplica a renumeração do estado real ao estado final (F42 = Signup concluída, **F43 = Revisão do Brief Pré-Geração**, **Stripe fora da numeração**). A atualização dos trackings (`ROADMAP.md` raiz, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md`) está documentada como runbook na seção **D1** deste documento.
>
> **Pré-requisito de limpeza (F41):** **resolvido** — a F41 foi arquivada e está concluída nos trackings (`openspec list` vazio, 13/13 plans, 2033 testes, UAT 6/6; pendência pós-deploy apenas iOS/HEIC).
>
> **Nome (evitar confusão com a F37):** a fase chama-se **Revisão do Brief Pré-Geração** — revisão humana dos **campos de entrada** (o que será enviado à IA) **antes** de qualquer chamada de IA. A **F37 (Revisão e Aprovação da Arte)** é a revisão/aprovação da arte **já gerada** (pós-geração). Nomes e escopos distintos.
>
> **Decisão central (D2/D3/D5):** a F43 insere um **gate client-side obrigatório** entre o preenchimento do formulário e o `POST /api/campaign/generate-image`: valida campos, **prepara/comprime as imagens**, mostra um **resumo do brief** (produto, oferta, imagens, avisos, custo) em **tela intermediária** (não modal) e só dispara a rota após o **"Confirmar e gerar campanha"**. Com a confirmação humana explícita, o body envia `inputValidationOverride.productImageCheck = "brief_review_confirmed"` e o backend **pula a chamada de IA de visão** (InputValidationService) no caminho padrão — sem "apagar" a capacidade, que permanece como rede de segurança no caminho sem override e reativável via **flag administrativa mínima na tabela `feature_flags`** (tela no admin, sem redeploy, com fallback de leitura que não derruba geração) se o beta mostrar erro humano excessivo.

## Contexto

```
v1.5 — Lançamento Externo Controlado (milestone)                EM ANDAMENTO
  ├── F30 — Fundação Legal                                       ✓
  ├── F31.1 — Modelo Comercial — Formulário                      ✓
  ├── F31.2 — Diretores por Intenção                             ✓
  ├── F31.3 — Quality Gate por Intenção Comercial                ✓
  ├── F32 — Freemium Anti-Abuso CNPJ                             ✓
  ├── F33 — Verificação CNPJ Freemium                            ✓
  ├── F34 — Prontidão de Loja para Geração (Store Readiness)     ✓
  ├── F35 — Changelog / Novidades                                ✓
  ├── F36 — Onboarding: Navegação por Abas                       ✓
  ├── F38 — Tabela de Custos por Operação                        ✓
  ├── F38.1 — Apuração de Custos de IA por Entrega               ✓
  ├── F38.2 — Admin de Custos + Config. Econômicas               ✓
  ├── F38.2.1 — Snapshot Econômico                               ✓
  ├── F39 — Brief Estruturado de Campanha                        ✓
  ├── F40 — Campos Comerciais e Avisos do Brief                  ✓ (9/9, UAT 6/6)
  ├── F41 — Mídia de Campanha Mobile                             ✓ (13/13, UAT 6/6)
  ├── F42 — Signup Controlado e Elegibilidade Freemium           ✓ concluída (UAT 20.6 validado,
  │        (v1.5; obs.: marcar checkboxes UAT 20.5–20.15 nos        migration aplicada, código em
  │        trackings)                                               produção)
  ├── F43 — Revisão do Brief Pré-Geração                         ← esta fase
  ├── F44 — Temas de Campanha                                    ○ planejada (consome o slot
  │        (`docs/alinhamento-fase-44-temas-de-campanha.md`)        "Tema" reservado pela F43)
  ├── F37 — Revisão e Aprovação da Arte                          ○ depois (pós-geração)
  │        (experimento controlado beta, human-in-the-loop)
  └── Monetização pública / Stripe                               ○ diferida — v1.7+ (sem fase
       (iniciativa diferida não numerada)                          numerada; reaberta quando
                                                                   houver condição real de executar)

Sequenciamento recomendado:
  F42 (Signup, concluída) → F43 (Revisão do Brief) → F44 (Temas) → F37 (revisão/aprovação da arte) → [catálogo] → Monetização/Stripe (diferida)
  A F43 é média, mas fatiável em ondas independentes (revisão client-side → override/serviço → flag admin); a F44 depende do slot "Tema" reservado pela F43.
```

A F43 torna o fluxo mais honesto para o lojista e mais barato para o produto: hoje o clique em **"Criar Campanha"** (`campaign-input-form.tsx:595-621`) dispara imediatamente o `POST /api/campaign/generate-image`, que já no pré-stream **chama IA de visão** (`InputValidationService`, `route.ts:337-399`), **cria a campanha** no banco (`:401-445`) e **reserva crédito** (`:447-476`) — tudo antes de o usuário ter visto um resumo do que será gerado. Um preço digitado errado, uma imagem errada, uma validade esquecida ou um checkbox marcado indevidamente custam IA e/ou deixam registros `generating`/`error` na fila de campanhas. A F43 inverte isso: revisão humana **antes** de qualquer chamada de IA, reserva de crédito ou persistência.

**Estado real em código (explorado nesta fase):**

- **O form não tem nenhuma etapa de confirmação hoje:** `CampaignInputForm` → `useCampaignForm` → `handleSubmit` (`use-campaign-form.ts:691-832`) valida client-side, comprime imagens (`compressImage`, `:13-94`), monta o body flat (`:798-824`) e chama `consumeStream` (`:826`). O único "gate" humano existente é o **409 de conflito produto×imagem** (`consumeStream`, `:584-618`) — que ocorre **depois** do POST e apenas para o par nome×imagem.
- **Fluxo da rota (o que o POST faz antes do stream):** same-origin → launch config → parse body → campos de identidade legados (400) → exclusividade `productImages` XOR `productImageDataUrl` → limites/teto (413) → Zod (`GenerateImageRequestSchema`) → auth/ownership → legal clearance → readiness → semântica por intent → resolução da identidade da loja → brief → rate limit → custo (`OperationCostService`) → saldo (402) → **validação IA produto×imagem** (`route.ts:337-399`) → `createCampaign` + upload de inputs (`:401-445`) → `reserveCredit` (`:447-476`) → stream (CopyDirector ∥ ImageDirector).
- **A IA de visão (o "revisor de briefing"):** `InputValidationService.validate` (`input-validation-service.ts:40-71`) compara o nome digitado com a imagem principal usando modelo vision; **é pulada quando `inputValidationOverride?.productImageCheck` é truthy** (`:47-49` e `route.ts:338`). Custo registrado como `campaign_input_validation` (F38.1) — ou seja, **é uma chamada de IA com custo próprio**, hoje sempre presente no caminho de geração.
- **Semântica atual do override (`schema.ts:59-63`):** `inputValidationOverride.productImageCheck: z.literal("user_confirmed_continue")` dentro de `.strict()`. Significa "o sistema alertou conflito (409) e o usuário **insistiu mesmo assim**" — **não** significa "usuário revisou o brief e confirmou".
- **O domínio/snapshot já é o contrato do que a revisão mostra:** `CampaignBrief` (`lib/campaign/brief.ts:108-116`) tem `product`, `commercial` (intent, preços, badge, `validity`, `legalNotice`), `media.images[]` e `creativeContext` (com `themeId?: string | null` — **sempre null hoje**, slot reservado). `buildValidityDisplayText` (`use-campaign-form.ts:268-292`) e `buildMandatoryArtworkText` (`:294-304`) já produzem os textos legíveis.
- **Dados de custo/saldo já chegam ao form:** `useOperationCosts` (`hooks/use-operation-costs.ts`) expõe `campaign_generation.{costCredits, enabled}`; `FormContent` calcula `submitDisabled` por custo indisponível/desativado/saldo insuficiente (`campaign-input-form.tsx:275-290`) e exibe "Saldo: X · Custo: Y" (`:557-585`).
- **Persistência de rascunho:** `useInputPreservation` (chave `campaign_draft`, `sessionStorage`); `CampaignPageClient` limpa `campaign_draft`/`campaign_draft_image`/`campaign_preview` no mount (`campaign-page-client.tsx:19-25`). Imagens restauradas de draft já têm `dataUrl`; imagens recém-adicionadas têm `file` cru (sem compressão até o submit — `use-campaign-form.ts:760-775`).
- **Pós-geração (F37, futura):** `/campanhas/[id]` hoje só mostra a arte + kit de publicação com edição de copy e download (`client.tsx`). A **aprovação da arte** é escopo da F37, não desta fase.
- **Testes existentes que o novo estado toca:** `src/components/flow/__tests__/use-campaign-form-*.test.ts` (validity, submit-error, product-images, notice, navigation), `intent-*.test.ts`, `src/app/api/campaign/generate-image/__tests__/route.test.ts`, `campaign-flow-credits.test.tsx`.

---

## Propósito

1. **Gate de revisão humana obrigatório, client-side e em tela intermediária (D2)** — entre o formulário e o `POST /api/campaign/generate-image`. Nenhuma chamada de IA, reserva de crédito ou persistência de campanha acontece antes da confirmação explícita. Estado `reviewMode` no hook/componente; **tela intermediária, não modal** (modal aperta no mobile e piora acessibilidade). Ações: "Voltar e editar" (retorna ao form preservando estado) e "Confirmar e gerar campanha" (dispara o submit real).
2. **Compressão das imagens antes da revisão (D3)** — a revisão mostra **exatamente** o que será enviado: HEIC/EXIF/compressão aplicados antes do resumo, com estado curto "Preparando imagens...". Evita o usuário aprovar uma imagem cru e o payload sair diferente. Em falha, volta ao form com erro claro.
3. **Helpers puros separados (D4)** — `prepareCampaignImages(fields)` e `buildCampaignGenerationBody(fields, preparedImages, storeId, options)`, reutilizados pela revisão e pelo submit (single source of truth dos derivados: validade formatada, aviso ilustrativo, texto obrigatório, intent, badge, preços, imagens normalizadas).
4. **Pular a IA de visão quando houver confirmação humana explícita (D5)** — novo override `brief_review_confirmed` (semântica distinta de `user_confirmed_continue`). O usuário viu "nome do produto + imagem principal + referências autorizadas + preço + validade + avisos" lado a lado e confirmou; a chamada vision vira redundante. **A capacidade `InputValidationService` não é apagada**: permanece como rede de segurança no caminho sem override e como fallback via **flag administrativa mínima na tabela `feature_flags`** (tela no admin, sem redeploy) para reativar rápido se o beta mostrar erro humano excessivo. Ganho de ~1,5s no início da geração e economia por geração relevante em volume.
5. **Resumo completo e honesto (D6)** — seções visuais separadas **Produto / Oferta / Imagens / Avisos / Custo**, com loja/marca ativa no topo, rótulos "Principal"/"Referências autorizadas" nas imagens, "Vai consumir X crédito(s)" junto do saldo, e slot reservado para "Tema" (hoje `themeId` sempre null) — **preparação para a F44 (Temas de Campanha)**.
6. **Consistência de a11y/mobile/microcopy (D7)** — manter o padrão do form (touch ≥ 44px, PT-BR, estados de loading); trava do snapshot revisado após "Confirmar" para evitar alteração acidental durante a geração; **preview das imagens sem recorte (`object-contain`)** e **UAT mobile pós-ajustes de AppShell/Topbar**.

**Entrega verificável:**
- Form → "Revisar e gerar" → tela de resumo do brief → "Voltar e editar" preserva tudo → "Confirmar e gerar campanha" chama a rota
- Revisão mostra: produto (nome/descrição), oferta (intent/badge/preços/validade), imagens (principal + referências autorizadas, já comprimidas, preview sem recorte), avisos (ilustrativo + texto obrigatório), loja/marca, custo estimado em créditos + saldo; slot "Tema" reservado (preparação F44)
- Nenhuma campanha é criada e nenhum crédito é reservado antes da confirmação
- Body com `inputValidationOverride.productImageCheck: "brief_review_confirmed"` → rota **pula** a validação IA produto×imagem; sem override → comportamento atual (IA vision); `user_confirmed_continue` preservado
- Fase `input_validation` emitida como **`skipped` / "Brief confirmado pelo usuário"** quando o override pula a IA — sem "Validação concluída" falsa no `GenerationProgress` (ambos os pontos: rota pré-stream e `ImageGenerationService` Phase 1)
- Flag administrativa mínima `force_brief_vision_check` em `feature_flags` (banco/admin, **sem redeploy**, auditável com action/target_type, motivo obrigatório, **fallback de leitura `enabled=false` que não derruba geração**) revalida **ponta a ponta** (rota normaliza o input removendo o override **antes** da checagem pré-stream → pré-stream e Phase 1 do serviço validam); `user_confirmed_continue` nunca removido
- `InputValidationService` intacto e reativável pela flag administrativa
- 4 gates verdes (`vitest`, `typecheck`, `lint`, `build`) com testes do novo fluxo e regressão co-migrada
- Trackings renumerados (F42 = Signup concluída, F43 = Revisão do Brief; **Stripe fora da numeração — iniciativa diferida**) nos 6 arquivos; sequência atualizada com F44 (Temas) após a F43

---

## Estado Atual / Base Para F43

```
                                    ESTADO ATUAL (pós-F42)               DEPOIS (F43)
═══════════════════════════════════════════════════════════════════════════════════════════════

Fluxo do form:
  Pós-preenchimento                "Criar Campanha" → POST imediato     "Revisar e gerar" → tela de
                                       (valida client-side, comprime,      resumo (reviewMode) →
                                       monta body, consumeStream)          "Voltar e editar" | "Confirmar
                                                                           e gerar campanha" → POST real
  Confirmação humana               nenhuma (só o 409 de conflito          obrigatória — resumo do brief
                                       produto×imagem, DEPOIS do POST)     com produto/oferta/imagens/
                                                                           avisos/custo, ANTES de qualquer IA
  Snapshot do envio                —                                    travado após "Confirmar" (sem
                                                                           alteração acidental durante geração)

Imagens:
  Compressão/HEIC/EXIF             só no submit (use-campaign-form        antes da revisão (prepare-
                                       :760-775)                            CampaignImages); revisão mostra
                                                                           o payload final
  Exibição na revisão              n/a (não há revisão)                  thumbnails: principal ("Principal")
                                                                           + auxiliares ("Referência")

Validação IA produto×imagem:
  Chamada vision                   sempre no caminho padrão               pulada quando body carrega
                                       (route.ts:337-399; custo              brief_review_confirmed
                                       campaign_input_validation)
  Override                         productImageCheck:                       + brief_review_confirmed
                                       "user_confirmed_continue"             (semântica distinta: revisão
                                       ("insistiu após 409")                  humana explícita)
  Capacidade                       —                                    preservada + flag administrativa
                                                                           no banco (sem redeploy); fase
                                                                           input_validation emitida
                                                                           `skipped`/"Brief confirmado"
                                                                           quando o override pula

Body / derivados:
  Montagem                         inline no handleSubmit (":798-824")   helper puro buildCampaign-
                                       (validade/aviso concatenados)         GenerationBody reutilizado por
                                                                           revisão e submit (mesmos
                                                                           derivados)

Resumo:
  Loja/marca                       — (só no topo da página)              loja/marca ativa no topo da revisão
  Custo                            "Saldo: X · Custo: Y" no form         "Vai consumir X crédito(s)" + saldo;
                                                                            confirmar bloqueado se custo off/
                                                                            indisponível/saldo insuficiente
  Imagens                         — (não há revisão)                    principal + referências autorizadas;
                                                                            preview sem recorte (object-contain)
  Tema                             — (themeId sempre null)               slot opcional reservado — preparação
                                                                            para a F44 (Temas de Campanha)
```

---

## Realinhamento de Escopo (vs. discussão inicial)

| Item | Discussão inicial | Realinhado (F43) |
|------|-------------------|------------------|
| **Numeração** | "F43 já era Stripe no alinhamento F42" | **F43 = Revisão do Brief Pré-Geração (v1.5); F42 = Signup CONCLUÍDA; Stripe sai da numeração → iniciativa diferida não numerada (D1)**; trackings com "F43 = Stripe" são **resíduo a limpar**, não estado esperado |
| **Sequenciamento** | "F43 antes da F42 (F43 é menor)" | **F42 (concluída) → F43 → F44 Temas → F37 (D1)** — F42 finalizada; F44 (Temas) entra após a F43 e depende do slot "Tema" desta fase |
| **Controle da reativação da IA** | "env var `VENDEO_FORCE_BRIEF_VISION_CHECK`" | **Flag administrativa mínima na tabela `feature_flags`, não env var (D5)** — tela no admin com descrição e estados ligada/desligada; motivo obrigatório na alteração; auditoria (action/target_type); **fallback de leitura `enabled=false` que não derruba geração**; env var só como fail-safe emergencial opcional |
| **Linguagem das imagens** | "imagem principal + adicionais" | **imagem principal + referências autorizadas (apoio visual/variação/combo/ângulo) (D6)** — alinhada ao avanço recente de prompt/reviewer ("multi-referências autorizadas"); adicionais autorizam elementos de suporte, não substituem a principal |
| **Nome** | "F43 — Revisão Humana Pré-Geração" | **Revisão do Brief Pré-Geração** — distingue da **F37 (Revisão e Aprovação da Arte, pós-geração)** |
| **Formato da revisão** | "tela ou modal" | **Tela intermediária no mesmo fluxo (`reviewMode`), não modal (D2)** — mobile, acessibilidade e sensação de continuidade |
| **Validação IA produto×imagem** | "remover do caminho padrão, manter como fallback" | **Pular via `brief_review_confirmed` (D5)**; capacidade preservada + flag administrativa `force_brief_vision_check` (banco/admin) para reativar rápido; sem override → comportamento atual |
| **Overrides** | "reutilizar `user_confirmed_continue`" | **Novo literal `brief_review_confirmed` (D5)** — semântica distinta ("revisou e confirmou" ≠ "recebeu 409 e insistiu") |
| **Imagens na revisão** | "mostrar preview" | **Compressão antes da revisão (D3)** — revisão mostra o payload final (HEIC/EXIF/compressão já aplicados) |
| **Helpers** | "um helper puro de body" | **Dois helpers separados (D4)** — `prepareCampaignImages(fields)` + `buildCampaignGenerationBody(fields, preparedImages, storeId, options)` |
| **Conteúdo do resumo** | "produto, preço, tipo, validade, aviso, imagens, custo, botões" | **+ loja/marca ativa no topo, rótulos Principal/Referência, "Vai consumir X crédito(s)", seções separadas, slot de Tema (D6)** |

---

## Decisões de Alinhamento

### D1 — Numeração: F42 = Signup, F43 = Revisão do Brief Pré-Geração (v1.5); Stripe sai da numeração (iniciativa diferida) + runbook de trackings

`DECIDIDO` (segue o precedente da F42 D1 / F41 D1 / F40 D1 / F39 D1 / F37 D11)

| Antes | Depois |
|-------|--------|
| F42 = Signup Controlado e Elegibilidade Freemium (v1.5) — **CONCLUÍDA** nos trackings (renumeração F42 aplicada; obs.: marcar checkboxes UAT 20.5–20.15) | **F42 = Signup Controlado e Elegibilidade Freemium** (concluída, mantida) |
| F43 = Stripe / Monetização Pública (v1.7) — **resíduo** nos trackings (renumeração da F43 ainda não aplicada) | **F43 = Revisão do Brief Pré-Geração** (nova, v1.5) — esta fase |
| — | **Stripe / Monetização Pública → iniciativa diferida NÃO numerada** ("Monetização pública / Stripe, v1.7+") — sai da tabela de fases numeradas |

A fase pertinente entra na numeração ativa; **Stripe sai da numeração** e passa a **iniciativa diferida não numerada** (decisão desta revisão). A renumeração da F42 (F42 = Signup) **já está aplicada**; a **renumeração da F43 ainda não** — os trackings que dizem "F43 = Stripe" são **resíduo a limpar** (não estado esperado). Este runbook aplica a mudança de UMA vez, do estado real (F42 = Signup concluída, F43 = Stripe) ao estado final (F42 = Signup concluída, **F43 = Revisão do Brief**, **Stripe fora da numeração**).

**Stripe sai da numeração ativa (decisão desta revisão):** Stripe virou "fase fantasma" que toda fase nova empurra (F39→F40→F41→F42→F43). Como a execução depende de empresa, jurídico, contabilidade, operação fiscal e decisão real de monetização, Stripe deixa de ser fase numerada e passa a **iniciativa diferida não numerada** ("Monetização pública / Stripe, v1.7+") — reaberta quando houver condição real de executar, sem contaminar o roadmap ativo nem gerar F45/F46/F47 a cada refinamento pertinente da v1.5.

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 42 "Signup ... 0/0 ○ Pending" → **concluída** (marcar como executada/complete); linha 43 "Stripe / Monetização Pública" → **"Revisão do Brief Pré-Geração \| v1.5 \| 0/0 \| ○ Pending"**; **remover qualquer linha numerada de Stripe** e registrar em seção "Deferred / Pós-beta / Monetização": "Monetização pública / Stripe (v1.7+, iniciativa diferida não numerada)". Atualizar menções "F43 (Stripe)" → "Monetização/Stripe (diferida)" (resíduo). Adicionar bullet da F43 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F42 = Signup Controlado e Elegibilidade Freemium (v1.5, concluída), F43 = Revisão do Brief Pré-Geração (v1.5); Monetização pública/Stripe sai da numeração (v1.7+, diferida)". Tabela Progress: linha 42 (Signup) já Complete; linha 43 "Stripe" → **"Revisão do Brief Pré-Geração \| v1.5 \| 0/0 \| ○ Pending"**; **remover a linha de Stripe** e registrar a iniciativa diferida fora da numeração. Atualizar notas de renumeração e menções "F43 (Stripe)" em Dependencies → "Monetização/Stripe (diferida)". Atualizar Dependency Graph. Adicionar seção "### Phase 43 — Revisão do Brief Pré-Geração". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 43`. Tabela "Next Phases": F42 → "✓ Completed — Signup Controlado e Elegibilidade Freemium (v1.5)"; F43 → "○ In progress — Revisão do Brief Pré-Geração (v1.5)"; **remover a linha "F43 = Stripe"** e registrar a iniciativa diferida fora da numeração. **Observação:** marcar as checkboxes de UAT 20.5–20.15 da F42 (cenários validados — decisão do time). Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... adiado para F43 (v1.7, pós-beta)" → "Monetização pública / Stripe: iniciativa diferida v1.7+ (sem fase numerada), reaberta quando houver condição real de executar" (resíduo F43 = Stripe a limpar). Adicionar linha da F43/Revisão do Brief. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F43/v1.7" → "Monetização pública / Stripe: iniciativa diferida v1.7+ (sem fase numerada), dependente de decisão comercial/jurídica/contábil" |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F43)" → "Monetização pública / Stripe diferido para v1.7+ (sem fase numerada)" |

**F44 (Temas de Campanha) é adicionada à numeração pelo runbook da própria F44** (`docs/alinhamento-fase-44-temas-de-campanha.md`), após esta renumeração estar aplicada — esta fase não cria a linha F44 nos trackings.

**Regras gerais (padrão F42 D1 / F41 D1 / F40 D1 / F39 D1 / F37 D11):**
- Artefatos históricos (alinhamentos, quick-plans, CONTEXT de fases concluídas) **não são reescritos** — refletem o estado da época.
- O `openspec/changes/fase-43-revisao-brief-pre-geracao/` será a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele.
- Fases futuras entram na numeração ativa apenas quando forem executáveis; iniciativas diferidas podem permanecer fora da numeração (caso de Monetização/Stripe, D1).

---

### D2 — Gate client-side obrigatório em tela intermediária (`reviewMode`)

`DECIDIDO` (tela intermediária no mesmo fluxo; **não modal**)

- **Estado:** novo estado no hook `useCampaignForm` (`step: "form" | "review"` ou `reviewMode: boolean`). `CampaignInputForm` renderiza o resumo quando ativo (mesmo padrão do `isSubmitting` → `GenerationProgress` hoje).
- **Transições:**
  - Form → revisão: botão "Revisar e gerar" (substitui "Criar Campanha"). Entra em revisão **somente** quando a validação client-side passa (gate `isValid`/`validateAll` existentes, `use-campaign-form.ts:698-747`). Ao entrar, roda a preparação das imagens (D3).
  - Revisão → form: "Voltar e editar" — estado `fields`/`touched`/`fieldErrors` preservado (sem perda de nada).
  - Revisão → geração: "Confirmar e gerar campanha" — **trava o snapshot revisado** (congela os valores/`preparedImages` que serão enviados; desabilita interação) e dispara o fluxo real (monta body via D4 e chama `consumeStream`). A partir daqui, o fluxo existente é inalterado (`isSubmitting` → `GenerationProgress`, 409 de conflito, navegação para `/campanhas/[id]`).
- **Garantias:** nenhum POST é feito antes da confirmação → sem IA, sem `createCampaign`, sem upload de inputs e sem `reserveCredit` prematuros. Campanha "generating"/"error" por clique acidental deixa de existir.
- **Persistência:** se o usuário recarregar a página na revisão, o comportamento atual (limpeza de draft no mount, `campaign-page-client.tsx:19-25`) se aplica — definido como comportamento preservado; opção de reter a revisão em `sessionStorage` fica para o planejamento, não é exigência.

---

### D3 — Compressão das imagens antes da revisão (`prepareCampaignImages`)

`DECIDIDO` (a revisão mostra o payload final, não o arquivo cru)

- **Helper:** `prepareCampaignImages(fields: CampaignFormFields): Promise<PreparedCampaignImage[]>` — reutiliza `compressImage` (`use-campaign-form.ts:13-94`, HEIC/EXIF via `createImageBitmap from-image`), normaliza `mimeType` para `image/jpeg`, preserva `role`/`source`, e cobre os itens restaurados de draft que já têm `dataUrl`.
- **Quando roda:** ao entrar em `reviewMode`; UI curta "Preparando imagens..." enquanto comprime. Falha de compressão → volta ao form com erro claro (mensagem PT-BR, mesmo padrão do `submitError`).
- **Por quê:** mostrar object URL cru (`file` sem compressão) permite o usuário aprovar uma imagem que, no payload real, sairia HEIC/EXIF/qualidade diferente. Com a compressão antes, o que o usuário vê **é** o que será enviado. O submit deixa de re-comprimir (o trabalho já foi feito na entrada da revisão).

---

### D4 — Helpers puros separados, reutilizados por revisão e submit

`DECIDIDO` (single source of truth; testes simples)

```ts
prepareCampaignImages(fields: CampaignFormFields): Promise<PreparedCampaignImage[]>
// Compressão + dataUrl + mimeType jpeg + role/source preservados (D3)

buildCampaignGenerationBody(
  fields: CampaignFormFields,
  preparedImages: PreparedCampaignImage[],
  storeId: string,
  options?: { inputValidationOverride?: { productImageCheck: "brief_review_confirmed" } }
): Record<string, unknown>
// Mesmo shape do body atual de handleSubmit (use-campaign-form.ts:798-824), usando
// os MESMOS derivados que a revisão exibe:
//   buildValidityDisplayText(fields)  (":268-292")
//   buildMandatoryArtworkText(...)    (":294-304")
//   inferIntent / badge / prices / productImages[] (ou productImageDataUrl legado)
```

- **Revisão:** consome os derivados (validade formatada, aviso ilustrativo, texto obrigatório, intent, badge, preços, imagens normalizadas) — o que a tela mostra é o que o body envia.
- **Submit:** monta o body via o mesmo helper (sem duplicação).
- `preparedImages` vira parte do **snapshot travado** (D2) — o body é imutável a partir do "Confirmar".

---

### D5 — Novo override `brief_review_confirmed` (pular IA de visão com confirmação humana)

`DECIDIDO` (semântica distinta de `user_confirmed_continue`; capacidade preservada)

```ts
inputValidationOverride: {
  productImageCheck: "brief_review_confirmed"
}
```

- **Backend (dois pontos de chamada — ambos devem respeitar o override):**
  - `src/lib/image-generation/schema.ts:59-63` — literal ganha o novo valor: `productImageCheck: z.union([z.literal("user_confirmed_continue"), z.literal("brief_review_confirmed")]).optional()` (`.strict()` preservado).
  - `src/lib/image-generation/services/input-validation-service.ts:43` — tipo do override aceita o novo literal (`validate` já pula quando o override é truthy, `:47-49`).
  - **Rota (`route.ts:337-399`, pré-stream):** a regra atual (`if (!parsed.data.inputValidationOverride?.productImageCheck)`, `route.ts:338`) já pula a validação para qualquer override truthy. A F43 apenas adiciona o novo literal; **com a flag de reativação ligada**, a rota **normaliza um `effectiveParsedData`/`effectiveCampaignInput`** (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream e **usa o mesmo input normalizado** para a checagem, construir o brief e chamar o serviço — ver "Comportamento ponta a ponta da flag" abaixo.
  - **`ImageGenerationService` (`image-generation-service.ts:162-277`, Phase 1 `input_validation`):** a chamada interna `this.inputValidation.validate(brief.product.name, primaryDataUrl, context.campaignInput.inputValidationOverride, onCall)` (`:173-183`) recebe o override e pula a chamada real (`input-validation-service.ts:47-49`). **Requisito explícito desta fase:** quando o override pular a IA, o serviço **NÃO** deve emitir a fase `input_validation` como `running → complete` (hoje `emitHuman("input_validation")` em `:163` e `emitComplete` em `:276` rodam incondicionalmente) — deve emitir **`skipped`** (precedente `emitSkipped` já existe, `:141`) ou **detail "Brief confirmado pelo usuário"**, para o `GenerationProgress` não exibir uma "Validação concluída" sem ter chamado IA. Aplica-se igualmente a `user_confirmed_continue`.
- **Matriz de semântica (documentada no schema e nos testes):**

| Valor | Origem | Comportamento |
|-------|--------|---------------|
| `brief_review_confirmed` | Usuário revisou o brief completo (produto + imagens + preço + validade + avisos) e confirmou | Pula a IA de visão (caminho padrão da F43); fase `input_validation` emitida como `skipped`/"Brief confirmado pelo usuário" |
| `user_confirmed_continue` | Usuário recebeu 409 de conflito e **insistiu mesmo assim** | Pula a IA de visão (comportamento atual, "continuar mesmo assim"); fase `input_validation` emitida como `skipped` |
| (sem override) | Cliente legado / fallback | Validação IA produto×imagem roda como rede de segurança (comportamento atual); fase `input_validation` normal |

- **Capacidade preservada + flag administrativa de reativação (`feature_flags`, NÃO env var):** `InputValidationService` não é removido nem deprecado. A reativação da validação IA é uma **flag administrativa mínima** persistida na tabela **`feature_flags`** — **não um sistema universal de flags**: sem segmentação por loja, sem porcentagem de rollout, sem agendamento, sem cache complexo, sem UI elaborada. Colunas: `key` (única), `enabled` (boolean), `description` (texto administrativo), `updated_by`, `updated_at`. Primeira (e única, nesta fase) flag: **`force_brief_vision_check`**. Mutação via **RPC/admin route com motivo obrigatório** + auditoria. Operada em **tela no admin** ("Controles operacionais" → "Validação IA do brief antes da geração") com descrição clara: *"Quando ligada, o Vendeo executa novamente a validação por IA das imagens mesmo depois da revisão humana do brief. Use apenas para diagnóstico, auditoria ou se houver suspeita de que campanhas problemáticas estão passando pela revisão humana."* Estados: **Desligada — padrão recomendado** / **Ligada — força validação IA além da revisão humana**.
  - **Auditoria (constraints existentes):** `admin_audit_log` — prever **nova action `feature_flag_update`** e **novo `target_type` `feature_flag`**, com `metadata` contendo `key`, `old_value`, `new_value` e `reason` — sem isso a implementação pode bater em constraint/CHECK do banco.
  - **Fallback de leitura (não derruba geração):** se a leitura da flag falhar durante uma geração, **não bloqueia** — fallback seguro `enabled = false` (fluxo padrão: revisão humana + pular vision), log de warning/erro operacional, e **env var emergencial `VENDEO_FORCE_BRIEF_VISION_CHECK` pode forçar `true` se existir** (trava de emergência infra, opcional).
  - **Reconhecimento de escopo:** a F43 deixa de ser "pequena" e vira **"pequena + um controle operacional"** — inclui migration (`feature_flags`), serviço de leitura, tela admin, RPC/admin route de update, auditoria e testes admin. Aumento justificado: evita o "inferno miúdo" de env var/redeploy durante o beta real (a env var parece enxuta no código, mas empurra complexidade para a operação — nome, painel/Vercel, redeploy, espera, teste, desfazer, risco de esquecer ligada).
  - **Precedente no repo (F28):** o alinhamento F28 já previa a tabela `feature_flags` como migração futura segura — `getLaunchConfig()` encapsula a fonte de flags (`alinhamento-fase-28-observabilidade-operacao-launch-controls.md:152,191`). Esta fase concretiza esse padrão para **controle operacional** (leitura via serviço dedicado da flag, não via env var).
  - **Desligada (padrão):** `brief_review_confirmed` presente → rota pula o pré-stream (`route.ts:338`) e o serviço pula o Phase 1 (override repassado em `campaignInput.inputValidationOverride`); fase `input_validation` emitida como `skipped`/detail; nenhuma chamada vision.
  - **Ligada:** o backend **revalida mesmo com `brief_review_confirmed`** — a rota **normaliza um `effectiveParsedData`/`effectiveCampaignInput`** (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream (`route.ts:338`) e **usa esse input normalizado** para a checagem, construir o brief e chamar `imageService.generateImage(...)` — assim AMBOS os pontos (pré-stream da rota **e** Phase 1 do serviço) executam a IA de visão; nenhum override chega ao serviço. `user_confirmed_continue` **nunca é removido** (o caminho "recebeu 409 e insistiu" sempre pula). Reativação **sem redeploy** (só alteração na tela de admin).
- **Custo/UX:** economiza a chamada vision (~1,5s no início + custo `campaign_input_validation` por geração) quando a confirmação humana já cobre nome×imagem. O `GenerationProgress` mostra a fase `input_validation` como **`skipped` / "Brief confirmado pelo usuário"** — nunca como "Validação concluída" sem ter rodado (requisito explícito acima).

---

### D6 — Conteúdo do resumo do brief (seções + rótulos + custo)

`DECIDIDO` (resumo completo e honesto)

- **Topo:** **loja/marca ativa** (`StoreIdentityBlock` — a identidade é resolvida no backend e influencia a geração; o lojista confirma que é a loja certa).
- **Seções visuais separadas:**
  - **Produto:** nome, descrição (se houver).
  - **Oferta:** tipo de campanha (Oferta/Destaque/Exclusivo — `inferIntent`), selo (badge), preço original (se houver), preço com desconto, validade formatada (`buildValidityDisplayText`).
  - **Imagens:** **imagem principal** (obrigatória, rótulo **"Principal"**) + **referências autorizadas** (rótulo **"Referência"**) — apoio visual / variação / combo / ângulo. Alinhada ao avanço recente de prompt/reviewer ("multi-referências autorizadas"): as imagens adicionais **não substituem a principal**, mas **autorizam elementos visuais de suporte** na arte. Thumbnails do payload final (D3), exibidas **sem recorte** (`object-contain`).
  - **Avisos:** aviso "imagem meramente ilustrativa" (checkbox) + texto obrigatório (`buildMandatoryArtworkText`).
  - **Custo:** **"Vai consumir X crédito(s)"** + saldo atual. "Confirmar" bloqueado quando custo indisponível/desativado/saldo insuficiente (mesma lógica `submitDisabled` de `campaign-input-form.tsx:279-290`).
  - **Tema:** **slot opcional reservado** — não renderiza enquanto `creativeContext.themeId` for null (hoje sempre); **preparação para a F44 (Temas de Campanha**, `docs/alinhamento-fase-44-temas-de-campanha.md`), não apenas placeholder genérico futuro.
- **Ações:** `Voltar e editar` (volta ao form, preserva tudo — D2) e `Confirmar e gerar campanha` (confirma, trava o snapshot, dispara o submit — D2).

---

### D7 — A11y / mobile / microcopy / estados de loading

`DECIDIDO` (padrões do form preservados)

- Touch targets ≥ 44px; foco visível; PT-BR; leitura com `label`/`aria` nos botões.
- Microcopy: botão do form vira **"Revisar e gerar"**; tela de revisão mantém o aviso "Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."; botão de confirmar com loading (padrão do form).
- Estados: "Preparando imagens..." (D3), desabilitação durante a confirmação (snapshot travado), erro de preparação claro.
- **Preview das imagens sem recorte:** a revisão exibe as imagens com **`object-contain`** (comportamento equivalente à correção recente de preview sem recorte no upload, `quick-260820-q1y` — célula `aspect-square` + `object-contain`) — **nunca cortar a imagem visualmente**, especialmente no mobile.
- Revisão em telas estreitas: seções empilham; thumbnails com grid; sem scroll horizontal.
- **UAT mobile obrigatório pós-ajustes de AppShell/Topbar** (pós `quick-260820-qpk` viewport/scroll e `quick-260820-t0o` Topbar compacta): testar a tela de revisão em **mobile real/estreito (320px/375px)** — sem scroll horizontal, botões "Confirmar e gerar"/"Voltar e editar" sempre acessíveis, **Topbar não cobrindo conteúdo**, revisão confortável no novo modelo de scroll/layout.

---

## Contratos de Integração

```typescript
// src/lib/image-generation/schema.ts — override semântico (D5)
export const GenerateImageRequestSchema = z.object({
  // ...campos atuais inalterados...
  inputValidationOverride: z
    .object({
      productImageCheck: z
        .union([
          z.literal("user_confirmed_continue"), // 409 + insistiu (comportamento atual)
          z.literal("brief_review_confirmed"),  // NOVO — revisou o brief e confirmou (D5)
        ])
        .optional(),
    })
    .optional(),
}).strict();
```

```typescript
// src/lib/image-generation/services/input-validation-service.ts (D5)
// override?: { productImageCheck?: "user_confirmed_continue" | "brief_review_confirmed" }
// validate() já pula quando o override é truthy (:47-49) — sem mudança de lógica.
```

```typescript
// src/components/flow/use-campaign-form.ts — D2/D3/D4
// Estado: step: "form" | "review" (ou reviewMode: boolean)
// prepareCampaignImages(fields) → PreparedCampaignImage[]
//   { id, role, source, mimeType: "image/jpeg", dataUrl }  (compression de compressImage)
// buildCampaignGenerationBody(fields, preparedImages, storeId, { inputValidationOverride }) → body
//   body = {
//     storeId, productName, originalPriceCents, discountedPriceCents,
//     description, badgeText, campaignIntent,
//     ...(intent !== "offer" ? { preserveImageContext } : {}),
//     ...(validity ? { validity: buildValidityDisplayText(fields) } : {}),
//     ...(mandatoryArtworkText ? { mandatoryArtworkText: buildMandatoryArtworkText(...) } : {}),
//     ...(preparedImages.length > 1
//       ? { productImages: preparedImages.map(({ role, source, mimeType, dataUrl }) => ({ role, source, mimeType, dataUrl })) }
//       : { productImageDataUrl: preparedImages[0].dataUrl }),
//     ...(options?.inputValidationOverride ? { inputValidationOverride: options.inputValidationOverride } : {}),
//   }
// submit: body = buildCampaignGenerationBody(frozenFields, frozenPrepared, storeId,
//   { inputValidationOverride: { productImageCheck: "brief_review_confirmed" } })
```

```typescript
// Flag administrativa mínima (D5) — tabela feature_flags, NÃO env var
// feature_flags:
//   key          string  unique  (primeira: "force_brief_vision_check")
//   enabled      boolean         (Desligada = padrão recomendado | Ligada = força validação IA)
//   description  text            (texto administrativo exibido na tela)
//   updated_by   uuid/text       (autor da última alteração)
//   updated_at   timestamptz
// Mutação via RPC/admin route com motivo OBRIGATÓRIO; auditoria:
//   admin_audit_log: action "feature_flag_update", target_type "feature_flag",
//   metadata { key, old_value, new_value, reason }  (respeita constraints/CHECK existentes)
// FALLBACK de leitura (não derruba geração): falha na leitura → enabled=false,
//   log warning/erro; env var VENDEO_FORCE_BRIEF_VISION_CHECK só como fail-safe
//   emergencial (pode forçar true), não como decisão principal.
// Comportamento PONTA A PONTA:
//   Desligada → brief_review_confirmed pula a validação vision nos DOIS pontos
//               (rota pré-stream :338 + Phase 1 do ImageGenerationService)
//   Ligada   → rota NORMALIZA um effectiveParsedData/effectiveCampaignInput (remove
//              brief_review_confirmed do inputValidationOverride) ANTES da checagem
//              pré-stream (:338) e usa o mesmo input para o brief + generateImage;
//              pré-stream e Phase 1 do serviço validam. user_confirmed_continue
//              NUNCA é removido (sempre pula).
```

```typescript
// src/lib/image-generation/services/image-generation-service.ts (D5)
// Phase 1 input_validation (:162-277): quando o override pula a IA, emitir a
// fase como `skipped` (emitSkipped existe em :141) OU detail "Brief confirmado
// pelo usuário" — nunca running→complete sem chamada real (:163/:276 hoje
// emitem incondicionalmente).
```

---

## Testes

Padrão do repositório (vitest + Testing Library). Suíte estimada ~26+ testes novos. Referências: D2–D7.

### Hook / form — 10 testes
| # | Teste | Valida |
|---|-------|--------|
| 1 | "Revisar e gerar" com form inválido → não entra em revisão (erros exibidos) | D2 |
| 2 | Form válido → entra em revisão; "Voltar e editar" preserva fields/touched (nada perdido) | D2 |
| 3 | Entrada em revisão dispara `prepareCampaignImages` (compressão antes; estado "Preparando imagens...") | D3 |
| 4 | Revisão mostra o payload final: HEIC/EXIF/compressão aplicados (`mimeType: image/jpeg`, dataUrl) | D3 |
| 5 | Falha de compressão na revisão → volta ao form com erro claro | D3 |
| 6 | "Confirmar e gerar campanha" trava o snapshot (body imutável; sem edição durante geração) | D2 |
| 7 | Body via `buildCampaignGenerationBody`: valores derivados idênticos ao exibido (validade, aviso, intent, badge, preços) | D4 |
| 8 | Body carrega `inputValidationOverride.productImageCheck: "brief_review_confirmed"` no caminho confirmado | D5 |
| 9 | Confirmar com custo desativado/indisponível/saldo insuficiente → bloqueado (mesma lógica do form) | D6 |
| 10 | Sem imagens utilizáveis / restauradas → revisão bloqueada com mensagem de imagem obrigatória | D2 |

### UI do resumo — 6 testes
| # | Teste | Valida |
|---|-------|--------|
| 11 | Seções Produto/Oferta/Imagens/Avisos/Custo renderizam com os valores do brief | D6 |
| 12 | Loja/marca ativa no topo; rótulos "Principal"/"Referência" (referências autorizadas) nas thumbnails | D6 |
| 13 | "Vai consumir X crédito(s)" + saldo exibidos; Tema não renderiza (themeId null) — slot reservado p/ F44 | D6 |
| 14 | Botões "Voltar e editar" e "Confirmar e gerar campanha" com touch ≥ 44px e a11y | D7 |
| 15 | Estados: "Preparando imagens...", loading no confirmar, erro de preparação | D3/D7 |
| 16 | Preview das imagens **sem recorte** (`object-contain`, célula aspect-square) em telas estreitas | D7 |

### Backend / schema / rota / serviço — 7 testes
| # | Teste | Valida |
|---|-------|--------|
| 17 | Zod aceita `brief_review_confirmed`; rejeita valor desconhecido (`.strict()`) | D5 |
| 18 | Rota com `brief_review_confirmed` → **pula** a IA de visão (sem `campaign_input_validation`) | D5 |
| 19 | Rota com `user_confirmed_continue` → pula (comportamento atual preservado) | D5 |
| 20 | Rota sem override → validação IA roda (rede de segurança) | D5 |
| 21 | Flag administrativa `force_brief_vision_check` **desligada** → `brief_review_confirmed` pula nos dois pontos (rota pré-stream + Phase 1) | D5 |
| 22 | Flag administrativa `force_brief_vision_check` **ligada** → rota **normaliza** o input (remove `brief_review_confirmed` **antes** da checagem pré-stream); **pré-stream e Phase 1 do serviço validam**; `user_confirmed_continue` não é removido | D5 |
| 23 | `ImageGenerationService` com override (`brief_review_confirmed` ou `user_confirmed_continue`) → fase `input_validation` emitida como **`skipped`/detail "Brief confirmado pelo usuário"**, sem chamada de IA real e sem "complete" falso | D5 |

### Admin da flag (D5) — 3 testes
| # | Teste | Valida |
|---|-------|--------|
| 24 | Tela de admin ("Controles operacionais") exibe `force_brief_vision_check` (`feature_flags`) com descrição e estados; alteração com **motivo obrigatório** persistida (`enabled`, `updated_by`, `updated_at`) | D5 |
| 25 | Alteração da flag registra auditoria: `admin_audit_log` com `action: "feature_flag_update"`, `target_type: "feature_flag"`, `metadata { key, old_value, new_value, reason }` (respeita constraints/CHECK existentes) | D5 |
| 26 | **Fallback de leitura:** falha ao ler a flag **não bloqueia geração** → `enabled=false` (fluxo padrão pula vision), log de warning/erro; env var emergencial pode forçar `true` | D5 |

### Regressão (obrigatória)
- Fluxo de geração completo (crédito, rate limit, clearance, readiness, stream, telemetria, estorno) **inalterado** para o payload sem override
- Co-migração de testes do hook (`use-campaign-form-submit-error.test.ts`, `use-campaign-form-navigation.test.ts`, `use-campaign-form-product-images.test.ts`) — o submit agora passa pela revisão; fixtures de `route.test.ts` atualizadas para o novo literal
- `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build` — zero erros

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| **Numeração conflita com F43 = Stripe (resíduo no alinhamento F42/trackings)** | **D1** — Stripe sai da numeração (iniciativa diferida não numerada); trackings com "F43 = Stripe" são resíduo a limpar; F42 = Signup concluída; alinhamento F42 é histórico (não reescrito) |
| **Remover a IA de visão do caminho padrão deixa passar erro humano** | **D5** — capacidade preservada; flag administrativa mínima `force_brief_vision_check` (`feature_flags`, sem redeploy, auditável) reativa ponta a ponta; caminho sem override (cliente legado/fallback) continua validando |
| **`brief_review_confirmed` confundido com "continuar mesmo assim"** | **D5** — literal novo com semântica distinta; matriz documentada no schema e nos testes |
| **Fase `input_validation` "concluída" sem chamada de IA (fase falsa no progresso)** | **D5** — `ImageGenerationService` Phase 1 emite `skipped`/detail "Brief confirmado pelo usuário" quando o override pula (teste 23) |
| **Flag de reativação inconsistente entre rota e serviço (um valida e o outro pula)** | **D5** — comportamento ponta a ponta: flag ligada normaliza o input (remove `brief_review_confirmed`) na rota antes da checagem pré-stream (pré-stream e Phase 1 validam); `user_confirmed_continue` nunca removido (teste 22) |
| **Falha na leitura da flag derrubar a geração** | **D5** — **fallback seguro: falha na leitura → `enabled=false`** (fluxo padrão segue, pula vision), log de warning/erro; env var emergencial só para forçar `true` (teste 26) |
| **Flag administrativa alterada sem rastreio / auditoria bate em constraint** | **D5** — `feature_flags` (`key`/`enabled`/`description`/`updated_by`/`updated_at`); `admin_audit_log` com nova action `feature_flag_update` e `target_type` `feature_flag` + metadata (`key`/`old_value`/`new_value`/`reason`); motivo obrigatório (testes 24-25) |
| **Imagem aprovada na revisão ≠ payload enviado** | **D3** — compressão antes da revisão; o que o usuário vê é o que será enviado |
| **Body duplicado entre revisão e submit diverge** | **D4** — `buildCampaignGenerationBody` único, consumido pelos dois; derivados idênticos (teste 7) |
| **Usuário perde o que preencheu ao voltar da revisão / recarregar** | **D2** — "Voltar e editar" preserva estado em memória; refresh mantém comportamento atual (draft `sessionStorage`); retenção da revisão em storage avaliada no planejamento |
| **Custo/saldo divergentes no momento da confirmação** | **D6** — confirmar bloqueado com custo off/indisponível/saldo insuficiente (mesma lógica do form) |
| **Testes de hook existentes quebram com o novo estado (submit agora passa pela revisão)** | Regressão obrigatória — co-migração dos `use-campaign-form-*.test.ts`, fixtures de `route.test.ts` e `image-generation-service.test.ts` |
| **"Revisão" confundida com a F37 (aprovação da arte)** | Nome **Revisão do Brief Pré-Geração** + nota no topo deste doc; F37 é fase própria (pós-geração) |
| **Campanhas "generating"/"error" por clique acidental** | **D2** — nenhuma campanha criada nem crédito reservado antes da confirmação |

---

## Fora do Escopo

| Item | Motivo |
|------|--------|
| **F37 — Revisão e Aprovação da Arte** | Fase própria (pós-geração); esta fase é pré-geração |
| **F42 — Signup Controlado e Elegibilidade Freemium** | Fase própria (v1.5) **concluída**; renumeração incluída na D1 |
| **F44 — Temas de Campanha** | Fase própria (v1.5, planejada) — a F43 reserva o slot "Tema" como preparação; a F44 implementa os temas (consome o slot) |
| **Monetização pública / Stripe** | Iniciativa diferida não numerada (v1.7+) — reaberta quando houver condição real de executar (empresa, jurídico, contabilidade, operação fiscal, decisão de monetização); fora da numeração ativa (D1) |
| **Temas de campanha (implementação)** | A F43 apenas reserva o slot `themeId` (`brief.ts:96-102`) na revisão, sem renderizar; a implementação é da F44 |
| **Migration SQL / mudança de snapshot / domínio / persistência (revisão)** | Revisão é client-side pura; snapshot `campaign_brief_v1` intocado; **exceto a criação/uso da tabela `feature_flags` para a flag `force_brief_vision_check` (D5)** |
| **Sistema universal de feature flags** | D5 — flag admin **mínima**: sem segmentação por loja, sem rollout %, sem agendamento, sem cache complexo, sem UI elaborada; apenas `key`/`enabled`/`description` + auditoria |
| **Novo endpoint server (para a revisão do brief em si)** | A revisão do brief é client-side (dados já estão no form/hook). **Exceção (D5):** a flag administrativa `force_brief_vision_check` exige superfície server/admin — leitura da flag no backend de geração, tela no admin, RPC/admin route para alterar (com motivo obrigatório) e auditoria |
| **Alterar o fluxo 409 / `user_confirmed_continue`** | Comportamento atual preservado (D5) |
| **Edição de copy / aprovação pós-geração** | Escopo da F37 / fluxo existente de `/campanhas/[id]` |
| **Re-tentar/render adicional de campanhas** | Fora — limita a revalidação de inputs à revisão pré-geração |

---

## Checklist de Revisão

### Decisões de alinhamento
- [ ] D1 — Numeração: F42 = Signup **concluída** (obs.: marcar checkboxes UAT 20.5–20.15), F43 = Revisão do Brief Pré-Geração (v1.5); **Stripe fora da numeração (iniciativa diferida não numerada)**; trackings com "F43 = Stripe" como **resíduo a limpar**; runbook aplicado (6 arquivos) do estado real atual
- [ ] D2 — Gate client-side obrigatório em tela intermediária (`reviewMode`); "Voltar e editar" preserva estado; "Confirmar e gerar campanha" trava o snapshot e dispara o submit; nenhum POST antes da confirmação
- [ ] D3 — `prepareCampaignImages` roda ao entrar na revisão (compressão/HEIC/EXIF antes); revisão mostra o payload final; falha → volta ao form com erro
- [ ] D4 — Helpers puros separados (`prepareCampaignImages` + `buildCampaignGenerationBody`) reutilizados por revisão e submit; derivados idênticos
- [ ] D5 — Novo override `brief_review_confirmed` (schema + serviço + rota); fase `input_validation` emitida como `skipped`/detail "Brief confirmado pelo usuário" quando o override pula a IA (ambos os pontos); **flag administrativa mínima `force_brief_vision_check` na tabela `feature_flags`** (tela no admin, motivo obrigatório, sem redeploy, auditada com `action: feature_flag_update`/`target_type: feature_flag` + metadata, **fallback de leitura `enabled=false` que não derruba geração**) ponta a ponta (rota normaliza o input removendo o override **antes** da checagem pré-stream → pré-stream e Phase 1 validam; `user_confirmed_continue` nunca removido); env var só fail-safe emergencial; `InputValidationService` intacto
- [ ] D6 — Resumo com loja/marca, Produto, Oferta, Imagens (Principal + **referências autorizadas**), Avisos, Custo ("Vai consumir X crédito(s)" + saldo), slot de Tema reservado (preparação F44)
- [ ] D7 — A11y/mobile/microcopy/loading preservando o padrão do form; **preview sem recorte (`object-contain`)**; UAT mobile real/estreito (320px/375px, sem scroll horizontal, botões acessíveis, Topbar não cobrindo)

### Fluxo (comportamento preservado + novos controles)
- [ ] Form inválido → "Revisar e gerar" não entra na revisão; erros exibidos (comportamento de validação atual)
- [ ] Form válido → revisão com resumo completo → "Voltar e editar" volta sem perda
- [ ] "Confirmar e gerar campanha" → body com `brief_review_confirmed` → rota pula a IA de visão → `GenerationProgress` mostra `input_validation` como `skipped`/"Brief confirmado pelo usuário" (sem falsa etapa "Validação" quando pulada)
- [ ] Custo desativado/indisponível/saldo insuficiente → confirmar bloqueado
- [ ] `user_confirmed_continue` (409) → comportamento atual intacto (fase `input_validation` `skipped`)
- [ ] Sem override (cliente legado) → IA de visão roda (rede de segurança); fase `input_validation` normal
- [ ] Flag administrativa `force_brief_vision_check` **ligada** → rota normaliza o input (remove o override antes da checagem pré-stream); pré-stream e Phase 1 do serviço validam
- [ ] Nenhuma campanha criada / crédito reservado antes da confirmação

### Snapshot / auditoria
- [ ] Nenhuma migration no domínio da campanha; snapshot `campaign_brief_v1` e domínio intocados
- [ ] Flag `force_brief_vision_check` persistida em `feature_flags` (`key`/`enabled`/`description`/`updated_by`/`updated_at`); alteração auditada via `admin_audit_log` (action `feature_flag_update`, target_type `feature_flag`, metadata `key`/`old_value`/`new_value`/`reason`)
- [ ] **Fallback de leitura da flag:** falha no banco não derruba geração → `enabled=false` + log de warning/erro (env var emergencial apenas para forçar `true`)
- [ ] Body imutável a partir da confirmação (snapshot travado)
- [ ] `campaign_input_validation` deixa de ser emitida no caminho `brief_review_confirmed`; telemetria/custo inalterada nos demais caminhos; fase `input_validation` nunca `complete` sem chamada real

### Renumeração (D1 — trackings)
- [ ] `ROADMAP.md` (raiz) — F42 = Signup **concluída**; F43 = Revisão do Brief; **linha numerada de Stripe removida → iniciativa diferida não numerada** ("Deferred / Pós-beta / Monetização"); resíduo "F43 (Stripe)" limpo
- [ ] `.planning/ROADMAP.md` — phase numbering (Stripe fora da numeração), tabela Progress, notas, deps, graph, seção Fase 43; rodapé sem resíduo "F41 ... em PLANEJAMENTO"
- [ ] `.planning/STATE.md` — frontmatter, Current Position, Next Phases (F42 concluída, F43 em progresso; Stripe fora da numeração), **checkboxes UAT 20.5–20.15 da F42 marcadas**, Last updated
- [ ] `.planning/PROJECT.md` — Stripe F43 → iniciativa diferida (sem fase numerada); rodapé
- [ ] `.planning/REQUIREMENTS.md` — v1.7 Stripe → iniciativa diferida (sem fase numerada)
- [ ] `.planning/MILESTONES.md` — Stripe diferido → v1.7+ sem fase numerada
- [ ] Sequência atualizada: F42 → F43 → **F44 (Temas)** → F37 → [catálogo] → Monetização/Stripe (diferida)

### Validação automática
- [ ] `npx vitest run` — novos + existentes passando (incluindo co-migrados)
- [ ] `npm run typecheck` — zero erros
- [ ] `npm run lint` — zero erros
- [ ] `npm run build` — build bem-sucedido

### UAT Local
- [ ] Form → "Revisar e gerar" → resumo correto (produto/oferta/imagens/avisos/custo/loja) → "Voltar e editar" sem perda
- [ ] Imagem HEIC (celular) → revisão mostra o JPEG final comprimido (mesma orientação)
- [ ] **Mobile real/estreito (320px/375px)**: revisão sem scroll horizontal; botões "Confirmar"/"Voltar" sempre acessíveis; Topbar não cobre conteúdo; preview sem recorte; confortável no novo modelo de scroll/layout
- [ ] "Confirmar e gerar campanha" → geração ocorre sem a etapa de validação vision; `GenerationProgress` mostra `input_validation` como `skipped`/"Brief confirmado pelo usuário"
- [ ] Flag administrativa `force_brief_vision_check` **ligada na tela de admin** → validação vision volta a rodar mesmo com confirmação (rota normaliza o input antes da checagem; rota e serviço validam); alteração com motivo, auditada e sem redeploy
- [ ] **Fallback de leitura:** banco/flag indisponível → geração segue sem bloquear (validação vision pulada), log de warning
- [ ] Sem override (ex.: requisição manual) → validação vision roda normalmente
- [ ] Saldo insuficiente / custo desativado → confirmar bloqueado com mensagem clara
- [ ] Geração bem-sucedida → `/campanhas/[id]` com arte e kit de publicação (fluxo atual)