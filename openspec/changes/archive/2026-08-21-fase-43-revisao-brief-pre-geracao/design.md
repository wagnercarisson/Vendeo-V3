## Context

A F43 insere um **gate de revisão humana obrigatório, client-side e em tela intermediária** entre o preenchimento do formulário e o `POST /api/campaign/generate-image`. Hoje o clique em **"Criar Campanha"** (`campaign-input-form.tsx:595-621`) dispara imediatamente o POST, que já no pré-stream **chama IA de visão** (`InputValidationService`, `route.ts:337-399`), **cria a campanha** no banco (`:401-445`) e **reserva crédito** (`:447-476`) — tudo antes de o usuário ver um resumo. Preço digitado errado, imagem errada, validade esquecida ou checkbox marcado indevidamente custam IA e/ou deixam registros `generating`/`error` na fila. A F43 inverte isso: **revisão humana antes de qualquer chamada de IA, reserva de crédito ou persistência**.

**Estado real em código (explorado nesta fase):**

- **Form sem etapa de confirmação:** `CampaignInputForm` → `useCampaignForm` → `handleSubmit` (`use-campaign-form.ts:784-925`) valida client-side (`:791-840`), comprime imagens (`compressImage`, `:13-94`, HEIC/EXIF via `createImageBitmap`), monta o body flat (`:891-917`) e chama `consumeStream` (`:919`). O único "gate" humano é o **409 de conflito produto×imagem** (`consumeStream`, `:677-711`) — que ocorre **depois** do POST e só para o par nome×imagem.
- **Estado/validação existentes reutilizáveis:** `isValid` (`:1018-1022`), `validateField` (`:267-289`), `buildValidityDisplayText` (`:361-385`), `buildMandatoryArtworkText` (`:387-397`), `inferIntent` (`:399-409`). `CampaignProductFormImage` (`:100-107`) tem `{ id, role, source, mimeType, file?, dataUrl? }` — `id` é interno da UI, nunca entra no body.
- **Fluxo da rota (pré-stream):** same-origin → launch config → parse body → campos legados (400) → exclusividade `productImages` XOR `productImageDataUrl` (`route.ts:117-136`) → limites/teto (413) → Zod (`GenerateImageRequestSchema`) → auth/ownership → legal clearance → readiness → semântica por intent → identidade da loja → brief → rate limit → custo → saldo (402) → **validação IA produto×imagem** (`route.ts:337-399`) → `createCampaign` + upload de inputs (`:401-445`) → `reserveCredit` (`:447-476`) → stream.
- **IA de visão:** `InputValidationService.validate` (`input-validation-service.ts:40-71`) — **é pulada quando `inputValidationOverride?.productImageCheck` é truthy** (`:47-49` e `route.ts:338`). Custo `campaign_input_validation` (F38.1). Override atual: `productImageCheck: z.literal("user_confirmed_continue")` (`schema.ts:59-63`, `.strict()`), semântica "recebeu 409 e insistiu".
- **Serviço (Phase 1):** `ImageGenerationService.generateImage` (`image-generation-service.ts:162-277`) — `emitHuman("input_validation")` (`:163`) e `emitComplete`/detail (`:272-277`) rodam **incondicionalmente**; `validate` repassa o override e pula (`:173-183`). `emitSkipped` já existe (`:141`). Sem `campaign_input_validation` quando não há chamada (`validationCallMade`, `:188-190`).
- **Domínio/snapshot:** `CampaignBrief` (`lib/campaign/brief.ts:108-116`) tem `product`, `commercial` (intent, preços, badge, `validity`, `legalNotice`), `media.images[]` e `creativeContext` (`themeId?: string | null` — **sempre null hoje**, slot reservado). `buildCampaignBriefFromFlat` e `buildCampaignBriefSnapshot` intocados.
- **Custo/saldo no form:** `useOperationCosts` (`hooks/use-operation-costs.ts`) expõe `campaign_generation.{costCredits, enabled}`; `FormContent` calcula `submitDisabled` por custo indisponível/desativado/saldo insuficiente (`campaign-input-form.tsx:275-290`) e exibe "Saldo: X · Custo: Y" (`:567-595`).
- **Persistência de rascunho:** `useInputPreservation` (chave `campaign_draft`, `sessionStorage`); `CampaignPageClient` limpa `campaign_draft`/`campaign_draft_image`/`campaign_preview` no mount (`campaign-page-client.tsx:19-25`). Itens restaurados têm `dataUrl`; itens recém-adicionados têm `file` cru.
- **Admin padrão para a flag (D5):** `admin_audit_log` com CHECKs `action`/`target_type` (F26/F33 — extensão via `ALTER TABLE ... DROP/ADD CONSTRAINT`, precedente `20260810010000_create_access_requests.sql:146-163`); `OperationCostService`/`EconomicParameterService` como precedente de serviço de leitura com fallback; `operation-costs/page.tsx` + `operation-costs-form.tsx` como precedente de tela admin com motivo obrigatório + auditoria; `requireAdmin` (`src/lib/admin/require-admin`).
- **F28 precedente:** o alinhamento F28 já previa `feature_flags` como migração futura segura (leitura via `getLaunchConfig()` encapsulada). A F43 concretiza esse padrão para **controle operacional** (flag administrativa mínima, leitura via serviço dedicado, NÃO env var).
- **Testes existentes que o novo estado toca:** `use-campaign-form-*.test.ts` (validity, submit-error, product-images, notice, navigation), `campaign-input-form.test.tsx`, `campaign-flow-credits.test.tsx`, `route.test.ts`, `image-generation-service.test.ts`.

## Goals / Non-Goals

**Goals:**
- Gate client-side obrigatório em **tela intermediária** (`reviewMode`) entre o form e o POST; "Voltar e editar" preserva tudo; "Confirmar e gerar campanha" trava o snapshot e dispara o submit real (D2)
- Compressão das imagens **antes da revisão** (`prepareCampaignImages`) — a revisão mostra o payload final (HEIC/EXIF/JPEG); falha volta ao form com erro (D3)
- Dois helpers puros reutilizados por revisão e submit — `prepareCampaignImages` + `buildCampaignGenerationBody` (D4)
- Novo override `brief_review_confirmed` (semântica distinta de `user_confirmed_continue`) pula a IA de visão nos dois pontos (rota pré-stream + Phase 1 do serviço); fase `input_validation` emitida como `skipped`/"Brief confirmado pelo usuário" — nunca "complete" sem chamada real (D5)
- Capacidade `InputValidationService` preservada + **flag administrativa mínima `force_brief_vision_check`** na tabela `feature_flags` (banco/admin, **sem redeploy**, motivo obrigatório, auditoria, **fallback `enabled=false`**) que reativa a validação IA ponta a ponta; env var só fail-safe emergencial (D5)
- Resumo completo e honesto — Produto/Oferta/Imagens/Avisos/Custo + loja/marca ativa + rótulos Principal/Referência + "Vai consumir X crédito(s)" + slot Tema reservado (D6)
- A11y/mobile/microcopy preservando o padrão do form — touch ≥ 44px, PT-BR, loading, preview **sem recorte** (`object-contain`), UAT mobile 320px/375px (D7)
- Renumeração de trackings (D1): F42 = Signup **concluída**, F43 = Revisão do Brief; **Stripe fora da numeração (iniciativa diferida)**; runbook 6 arquivos; checkboxes UAT 20.5–20.15 da F42 marcadas
- Testes (~26 novos) + 4 gates verdes (`vitest`, `typecheck`, `lint`, `build`) + regressão co-migrada

**Non-Goals:**
- **F37 — Revisão e Aprovação da Arte** (pós-geração) — fase própria
- **F44 — Temas de Campanha** — a F43 apenas **reserva o slot** `themeId` na revisão (não renderiza); a F44 consome
- **Monetização pública / Stripe** — iniciativa diferida não numerada (v1.7+), reaberta quando houver condição real (D1)
- **Migration SQL no domínio da campanha** — snapshot `campaign_brief_v1` e domínio intocados (**exceto** criação/uso da `feature_flags`, D5)
- **Sistema universal de feature flags** — flag admin **mínima**: sem segmentação por loja, sem rollout %, sem agendamento, sem cache complexo, sem UI elaborada
- **Novo endpoint server para a revisão em si** — revisão é client-side; a flag exige superfície server/admin (leitura no backend, tela admin, RPC/admin route de update)
- **Alterar o fluxo 409 / `user_confirmed_continue`** — comportamento atual preservado (D5)
- **Edição de copy / aprovação pós-geração** — escopo da F37 / `/campanhas/[id]` atual
- **Re-tentar/render adicional de campanhas** — fora

## Decisions

### D1 — Numeração: F42 = Signup, F43 = Revisão do Brief Pré-Geração (v1.5); Stripe sai da numeração (iniciativa diferida) + runbook de trackings

`DECIDIDO` (segue o precedente da F42 D1 / F41 D1 / F40 D1 / F39 D1 / F37 D11)

| Antes | Depois |
|-------|--------|
| F42 = Signup Controlado e Elegibilidade Freemium (v1.5) — **CONCLUÍDA** nos trackings (renumeração F42 aplicada; obs.: marcar checkboxes UAT 20.5–20.15) | **F42 = Signup Controlado e Elegibilidade Freemium** (concluída, mantida) |
| F43 = Stripe / Monetização Pública (v1.7) — **resíduo** nos trackings (renumeração da F43 ainda não aplicada) | **F43 = Revisão do Brief Pré-Geração** (nova, v1.5) — esta fase |
| — | **Stripe / Monetização Pública → iniciativa diferida NÃO numerada** ("Monetização pública / Stripe, v1.7+") — sai da tabela de fases numeradas |

**Runbook de atualização dos trackings — seguir na ordem abaixo ao planejar/executar a fase:**

| # | Arquivo | Mudança exata |
|---|---------|---------------|
| 1 | `ROADMAP.md` (raiz) | Tabela Progress: linha 42 "Signup ... 0/0 ○ Pending" → **concluída**; linha 43 "Stripe / Monetização Pública" → **"Revisão do Brief Pré-Geração \| v1.5 \| 0/0 \| ○ Pending"**; **remover qualquer linha numerada de Stripe** e registrar em seção "Deferred / Pós-beta / Monetização": "Monetização pública / Stripe (v1.7+, iniciativa diferida não numerada)". Atualizar menções "F43 (Stripe)" → "Monetização/Stripe (diferida)" (resíduo). Adicionar bullet da F43 no `<details open>` do v1.5 |
| 2 | `.planning/ROADMAP.md` | Nota "Phase numbering": "F42 = Signup Controlado e Elegibilidade Freemium (v1.5, concluída), F43 = Revisão do Brief Pré-Geração (v1.5); Monetização pública/Stripe sai da numeração (v1.7+, diferida)". Tabela Progress: linha 42 (Signup) já Complete; linha 43 "Stripe" → **"Revisão do Brief Pré-Geração \| v1.5 \| 0/0 \| ○ Pending"**; **remover a linha de Stripe** e registrar a iniciativa diferida fora da numeração. Atualizar notas de renumeração e menções "F43 (Stripe)" em Dependencies → "Monetização/Stripe (diferida)". Atualizar Dependency Graph. Adicionar seção "### Phase 43 — Revisão do Brief Pré-Geração". Atualizar rodapé "Last updated" |
| 3 | `.planning/STATE.md` | Frontmatter: `current_phase: 43`. Tabela "Next Phases": F42 → "✓ Completed — Signup Controlado e Elegibilidade Freemium (v1.5)"; F43 → "○ In progress — Revisão do Brief Pré-Geração (v1.5)"; **remover a linha "F43 = Stripe"** e registrar a iniciativa diferida fora da numeração. **Observação:** marcar as checkboxes de UAT 20.5–20.15 da F42 (cenários validados — decisão do time). Corpo "Current Position" + "Last updated" |
| 4 | `.planning/PROJECT.md` | Menção "Stripe ... adiado para F43 (v1.7, pós-beta)" → "Monetização pública / Stripe: iniciativa diferida v1.7+ (sem fase numerada), reaberta quando houver condição real de executar" (resíduo F43 = Stripe a limpar). Adicionar linha da F43/Revisão do Brief. Rodapé "Last updated" |
| 5 | `.planning/REQUIREMENTS.md` | Seção v1.7: "Stripe será implementada como F43/v1.7" → "Monetização pública / Stripe: iniciativa diferida v1.7+ (sem fase numerada), dependente de decisão comercial/jurídica/contábil" |
| 6 | `.planning/MILESTONES.md` | Menção "Stripe / Monetização Pública diferido para v1.7 (F43)" → "Monetização pública / Stripe diferido para v1.7+ (sem fase numerada)" |

**Regras gerais (padrão F42 D1 / F41 D1 / F40 D1 / F39 D1 / F37 D11):**
- Artefatos históricos (alinhamentos, quick-plans, CONTEXT de fases concluídas) **não são reescritos** — refletem o estado da época.
- `openspec/changes/fase-43-revisao-brief-pre-geracao/` será a **fonte da verdade** da fase; o alinhamento e os trackings derivam dele.
- Fases futuras entram na numeração ativa apenas quando executáveis; iniciativas diferidas podem permanecer fora da numeração (caso de Monetização/Stripe, D1).
- **F44 (Temas de Campanha) é adicionada à numeração pelo runbook da própria F44** — esta fase não cria a linha F44 nos trackings.

### D2 — Gate client-side obrigatório em tela intermediária (`reviewMode`)

`DECIDIDO` (tela intermediária no mesmo fluxo; **não modal** — modal aperta no mobile e piora acessibilidade)

- **Estado:** novo estado no hook `useCampaignForm` (`step: "form" | "review"` ou `reviewMode: boolean`). `CampaignInputForm` renderiza o resumo quando ativo (mesmo padrão do `isSubmitting` → `GenerationProgress` hoje).
- **Transições:**
  - Form → revisão: botão "Revisar e gerar" (substitui "Criar Campanha"). Entra em revisão **somente** quando a validação client-side passa (gate `isValid`/`validateAll` existentes). Ao entrar, roda a preparação das imagens (D3) com estado curto "Preparando imagens...".
  - Revisão → form: "Voltar e editar" — estado `fields`/`touched`/`fieldErrors` preservado (sem perda de nada).
  - Revisão → geração: "Confirmar e gerar campanha" — **trava o snapshot revisado** (congela os valores/`preparedImages` que serão enviados; desabilita interação) e dispara o fluxo real (monta body via D4 e chama `consumeStream`). A partir daqui o fluxo existente é inalterado (`isSubmitting` → `GenerationProgress`, 409 de conflito, navegação para `/campanhas/[id]`).
- **Garantias:** nenhum POST antes da confirmação → sem IA, sem `createCampaign`, sem upload de inputs e sem `reserveCredit` prematuros. Campanha "generating"/"error" por clique acidental deixa de existir.
- **Persistência:** refresh na revisão mantém o comportamento atual (limpeza de draft no mount, `campaign-page-client.tsx:19-25`) — definido como comportamento preservado; retenção da revisão em `sessionStorage` fica para o planejamento, não é exigência.

### D3 — Compressão das imagens antes da revisão (`prepareCampaignImages`)

`DECIDIDO` (a revisão mostra o payload final, não o arquivo cru)

- **Helper:** `prepareCampaignImages(fields: CampaignFormFields): Promise<PreparedCampaignImage[]>` — reutiliza `compressImage` (`use-campaign-form.ts:13-94`, HEIC/EXIF via `createImageBitmap from-image`), normaliza `mimeType` para `image/jpeg`, preserva `role`/`source`, e cobre itens restaurados de draft que já têm `dataUrl`.
- **Quando roda:** ao entrar em `reviewMode`; UI curta "Preparando imagens..." enquanto comprime. Falha de compressão → volta ao form com erro claro (mensagem PT-BR, mesmo padrão do `submitError`).
- **Por quê:** mostrar object URL cru (`file` sem compressão) permite o usuário aprovar uma imagem que, no payload real, sairia HEIC/EXIF/qualidade diferente. O submit deixa de re-comprimir (o trabalho já foi feito na entrada da revisão).

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
// Mesmo shape do body atual de handleSubmit (use-campaign-form.ts:891-917), usando
// os MESMOS derivados que a revisão exibe:
//   buildValidityDisplayText(fields)  (":361-385")
//   buildMandatoryArtworkText(...)    (":387-397")
//   inferIntent / badge / prices / productImages[] (ou productImageDataUrl legado)
```

- **Revisão:** consome os derivados (validade formatada, aviso ilustrativo, texto obrigatório, intent, badge, preços, imagens normalizadas) — o que a tela mostra é o que o body envia.
- **Submit:** monta o body via o mesmo helper (sem duplicação).
- `preparedImages` vira parte do **snapshot travado** (D2) — o body é imutável a partir do "Confirmar".

### D5 — Novo override `brief_review_confirmed` (pular IA de visão com confirmação humana) + flag administrativa mínima

`DECIDIDO` (semântica distinta de `user_confirmed_continue`; capacidade preservada; flag em banco/admin, NÃO env var)

```ts
inputValidationOverride: {
  productImageCheck: "brief_review_confirmed"
}
```

- **Backend (dois pontos de chamada — ambos devem respeitar o override):**
  - `src/lib/image-generation/schema.ts:59-63` — literal ganha o novo valor: `productImageCheck: z.union([z.literal("user_confirmed_continue"), z.literal("brief_review_confirmed")]).optional()` (`.strict()` preservado).
  - `src/lib/image-generation/services/input-validation-service.ts:43` — tipo do override aceita o novo literal (`validate` já pula quando o override é truthy, `:47-49`).
  - **Rota (`route.ts:337-399`, pré-stream):** a regra atual (`if (!parsed.data.inputValidationOverride?.productImageCheck)`, `route.ts:338`) já pula a validação para qualquer override truthy. A F43 apenas adiciona o novo literal; **com a flag de reativação ligada**, a rota **normaliza um `effectiveParsedData`/`effectiveCampaignInput`** (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream e **usa o mesmo input normalizado** para a checagem, construir o brief e chamar o serviço — ver "Comportamento ponta a ponta da flag" abaixo.
  - **`ImageGenerationService` (`image-generation-service.ts:162-277`, Phase 1 `input_validation`):** a chamada interna `this.inputValidation.validate(brief.product.name, primaryDataUrl, context.campaignInput.inputValidationOverride, onCall)` (`:173-183`) recebe o override e pula a chamada real. **Requisito explícito desta fase:** quando o override pular a IA, o serviço **NÃO** deve emitir a fase `input_validation` como `running → complete` (hoje `emitHuman("input_validation")` em `:163` e `emitComplete` em `:276` rodam incondicionalmente) — deve emitir **obrigatoriamente** `status: "skipped"` (precedente `emitSkipped` já existe, `:141`), com o detail/mensagem **opcional** ("Brief confirmado pelo usuário" ou "Validação dispensada") — **nunca** `complete` com detail (isso reintroduziria a fase falsa). Aplica-se igualmente a `user_confirmed_continue`.
- **Matriz de semântica (documentada no schema e nos testes):**

| Valor | Origem | Comportamento |
|-------|--------|---------------|
| `brief_review_confirmed` | Usuário revisou o brief completo (produto + imagens + preço + validade + avisos) e confirmou | Pula a IA de visão (caminho padrão da F43); fase `input_validation` emitida como `skipped`/"Brief confirmado pelo usuário" |
| `user_confirmed_continue` | Usuário recebeu 409 de conflito e **insistiu mesmo assim** | Pula a IA de visão (comportamento atual, "continuar mesmo assim"); fase `input_validation` emitida como `skipped` |
| (sem override) | Cliente legado / fallback | Validação IA produto×imagem roda como rede de segurança (comportamento atual); fase `input_validation` normal |

- **Capacidade preservada + flag administrativa de reativação (`feature_flags`, NÃO env var):** `InputValidationService` não é removido nem deprecado. A reativação da validação IA é uma **flag administrativa mínima** persistida na tabela **`feature_flags`** — **não um sistema universal de flags**: sem segmentação por loja, sem porcentagem de rollout, sem agendamento, sem cache complexo, sem UI elaborada. Colunas: `id` (UUID PRIMARY KEY `DEFAULT gen_random_uuid()`), `key` (TEXT UNIQUE NOT NULL), `enabled` (boolean, default `false`), `description` (texto administrativo), `updated_by` (UUID), `updated_at` (timestamptz). **`id` UUID é obrigatório** porque `admin_audit_log.target_id` é `UUID NOT NULL` (constraint existente) — a auditoria referencia `target_id = feature_flags.id` e identifica a flag via `metadata.key`. Primeira (e única, nesta fase) flag: **`force_brief_vision_check`**. Mutação via **RPC/admin route com motivo obrigatório** + auditoria. Operada em **tela no admin** ("Controles operacionais" → "Validação IA do brief antes da geração") com descrição clara: *"Quando ligada, o Vendeo executa novamente a validação por IA das imagens mesmo depois da revisão humana do brief. Use apenas para diagnóstico, auditoria ou se houver suspeita de que campanhas problemáticas estão passando pela revisão humana."* Estados: **Desligada — padrão recomendado** / **Ligada — força validação IA além da revisão humana**.
  - **Auditoria (constraints existentes):** `admin_audit_log` — prever **nova action `feature_flag_update`** e **novo `target_type` `feature_flag`**, com `target_id = feature_flags.id` (UUID NOT NULL existente) e `metadata` contendo `key`, `old_value`, `new_value` e `reason` — sem isso a implementação pode bater em constraint/CHECK do banco (precedente: `20260810010000_create_access_requests.sql:146-163` estende CHECKs).
  - **Fallback de leitura (não derruba geração):** se a leitura da flag falhar durante uma geração, **não bloqueia** — fallback seguro `enabled = false` (fluxo padrão: revisão humana + pular vision), log de warning/erro operacional, e **env var emergencial `VENDEO_FORCE_BRIEF_VISION_CHECK` pode forçar `true` se existir** (trava de emergência infra, opcional).
  - **Reconhecimento de escopo:** a F43 deixa de ser "pequena" e vira **"pequena + um controle operacional"** — inclui migration (`feature_flags`), serviço de leitura, tela admin, RPC/admin route de update, auditoria e testes admin. Aumento justificado: evita o "inferno miúdo" de env var/redeploy durante o beta real (a env var parece enxuta no código, mas empurra complexidade para a operação — nome, painel/Vercel, redeploy, espera, teste, desfazer, risco de esquecer ligada).
  - **Precedente no repo (F28):** o alinhamento F28 já previa a tabela `feature_flags` como migração futura segura — `getLaunchConfig()` encapsula a fonte de flags. Esta fase concretiza esse padrão para **controle operacional** (leitura via serviço dedicado da flag, não via env var).
  - **Desligada (padrão):** `brief_review_confirmed` presente → rota pula o pré-stream (`route.ts:338`) e o serviço pula o Phase 1 (override repassado em `campaignInput.inputValidationOverride`); fase `input_validation` emitida como **`skipped`** (detail opcional "Brief confirmado pelo usuário"); nenhuma chamada vision.
  - **Ligada:** o backend **revalida mesmo com `brief_review_confirmed`** — a rota **normaliza um `effectiveParsedData`/`effectiveCampaignInput`** (remove `brief_review_confirmed` do `inputValidationOverride`) **antes** da checagem pré-stream (`route.ts:338`) e **usa esse input normalizado** para a checagem, construir o brief e chamar `imageService.generateImage(...)` — assim AMBOS os pontos (pré-stream da rota **e** Phase 1 do serviço) executam a IA de visão; nenhum override chega ao serviço. `user_confirmed_continue` **nunca é removido** (o caminho "recebeu 409 e insistiu" sempre pula). Reativação **sem redeploy** (só alteração na tela de admin).
- **Custo/UX:** economiza a chamada vision (~1,5s no início + custo `campaign_input_validation` por geração) quando a confirmação humana já cobre nome×imagem. O `GenerationProgress` mostra a fase `input_validation` como **`skipped` / "Brief confirmado pelo usuário"** — nunca como "Validação concluída" sem ter rodado (requisito explícito acima).

### D6 — Conteúdo do resumo do brief (seções + rótulos + custo)

`DECIDIDO` (resumo completo e honesto)

- **Topo:** **loja/marca ativa** (`StoreIdentityBlock` — a identidade é resolvida no backend e influencia a geração; o lojista confirma que é a loja certa).
- **Seções visuais separadas:**
  - **Produto:** nome, descrição (se houver).
  - **Oferta:** tipo de campanha (Oferta/Destaque/Exclusivo — `inferIntent`), selo (badge), preço original (se houver), preço com desconto, validade formatada (`buildValidityDisplayText`).
  - **Imagens:** **imagem principal** (obrigatória, rótulo **"Principal"**) + **referências autorizadas** (rótulo **"Referência"**) — apoio visual / variação / combo / ângulo. As imagens adicionais **não substituem a principal**, mas **autorizam elementos visuais de suporte** na arte. Thumbnails do payload final (D3), exibidas **sem recorte** (`object-contain`).
  - **Avisos:** aviso "imagem meramente ilustrativa" (checkbox) + texto obrigatório (`buildMandatoryArtworkText`).
  - **Custo:** **"Vai consumir X crédito(s)"** + saldo atual. "Confirmar" bloqueado quando custo indisponível/desativado/saldo insuficiente (mesma lógica `submitDisabled` de `campaign-input-form.tsx:275-290`).
  - **Tema:** **slot opcional reservado** — não renderiza enquanto `creativeContext.themeId` for null (hoje sempre); **preparação para a F44 (Temas de Campanha)**.
- **Ações:** `Voltar e editar` (volta ao form, preserva tudo — D2) e `Confirmar e gerar campanha` (confirma, trava o snapshot, dispara o submit — D2).

### D7 — A11y / mobile / microcopy / estados de loading

`DECIDIDO` (padrões do form preservados)

- Touch targets ≥ 44px; foco visível; PT-BR; leitura com `label`/`aria` nos botões.
- Microcopy: botão do form vira **"Revisar e gerar"**; tela de revisão mantém o aviso "Revise textos, preços e imagens antes de publicar: a IA pode cometer erros."; botão de confirmar com loading (padrão do form).
- Estados: "Preparando imagens..." (D3), desabilitação durante a confirmação (snapshot travado), erro de preparação claro.
- **Preview das imagens sem recorte:** a revisão exibe as imagens com **`object-contain`** (célula `aspect-square`) — **nunca cortar a imagem visualmente**, especialmente no mobile.
- Revisão em telas estreitas: seções empilham; thumbnails com grid; sem scroll horizontal.
- **UAT mobile obrigatório pós-ajustes de AppShell/Topbar** (pós `quick-260820-qpk` viewport/scroll e `quick-260820-t0o` Topbar compacta): testar a tela de revisão em **mobile real/estreito (320px/375px)** — sem scroll horizontal, botões "Confirmar e gerar"/"Voltar e editar" sempre acessíveis, **Topbar não cobrindo conteúdo**, revisão confortável no novo modelo de scroll/layout.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Numeração conflita com F43 = Stripe (resíduo no alinhamento F42/trackings)** | **D1** — Stripe sai da numeração (iniciativa diferida não numerada); trackings com "F43 = Stripe" são resíduo a limpar; F42 = Signup concluída; alinhamento F42 é histórico (não reescrito) |
| **Remover a IA de visão do caminho padrão deixa passar erro humano** | **D5** — capacidade preservada; flag administrativa mínima `force_brief_vision_check` (`feature_flags`, sem redeploy, auditável) reativa ponta a ponta; caminho sem override (cliente legado/fallback) continua validando |
| **`brief_review_confirmed` confundido com "continuar mesmo assim"** | **D5** — literal novo com semântica distinta; matriz documentada no schema e nos testes |
| **Fase `input_validation` "concluída" sem chamada de IA (fase falsa no progresso)** | **D5** — `ImageGenerationService` Phase 1 emite **obrigatoriamente** `skipped` (detail opcional "Brief confirmado pelo usuário") quando o override pula (teste 23) |
| **Flag de reativação inconsistente entre rota e serviço (um valida e o outro pula)** | **D5** — comportamento ponta a ponta: flag ligada normaliza o input (remove `brief_review_confirmed`) na rota antes da checagem pré-stream (pré-stream e Phase 1 validam); `user_confirmed_continue` nunca removido (teste 22) |
| **Falha na leitura da flag derrubar a geração** | **D5** — **fallback seguro: falha na leitura → `enabled=false`** (fluxo padrão segue, pula vision), log de warning/erro; env var emergencial só para forçar `true` (teste 26) |
| **Flag administrativa alterada sem rastreio / auditoria bate em constraint** | **D5** — `feature_flags` (`key`/`enabled`/`description`/`updated_by`/`updated_at`); `admin_audit_log` com nova action `feature_flag_update` e `target_type` `feature_flag` + metadata (`key`/`old_value`/`new_value`/`reason`); motivo obrigatório (testes 24-25) |
| **Imagem aprovada na revisão ≠ payload enviado** | **D3** — compressão antes da revisão; o que o usuário vê é o que será enviado |
| **Body duplicado entre revisão e submit diverge** | **D4** — `buildCampaignGenerationBody` único, consumido pelos dois; derivados idênticos (teste 7) |
| **Usuário perde o que preencheu ao voltar da revisão / recarregar** | **D2** — "Voltar e editar" preserva estado em memória; refresh mantém comportamento atual (draft `sessionStorage`); retenção da revisão em storage avaliada no planejamento |
| **Custo/saldo divergentes no momento da confirmação** | **D6** — confirmar bloqueado com custo off/indisponível/saldo insuficiente (mesma lógica do form) |
| **Testes de hook existentes quebram com o novo estado (submit agora passa pela revisão)** | Regressão obrigatória — co-migração dos `use-campaign-form-*.test.ts`, fixtures de `route.test.ts` e `image-generation-service.test.ts` |
| **"Revisão" confundida com a F37 (aprovação da arte)** | Nome **Revisão do Brief Pré-Geração** + nota no topo do alinhamento; F37 é fase própria (pós-geração) |
| **Campanhas "generating"/"error" por clique acidental** | **D2** — nenhuma campanha criada nem crédito reservado antes da confirmação |
| **Modal aperta no mobile / piora acessibilidade** | **D2** — tela intermediária (não modal); D7 a11y/mobile |

## Migration Plan

**Migrations (D5 — flag administrativa):** idempotentes e **não destrutivas**:
1. Criar tabela `feature_flags` (`id` UUID PRIMARY KEY `DEFAULT gen_random_uuid()`, `key` TEXT UNIQUE NOT NULL, `enabled` BOOLEAN NOT NULL DEFAULT false, `description` TEXT, `updated_by` UUID NULL REFERENCES auth.users(id), `updated_at` TIMESTAMPTZ DEFAULT now()).
2. **Seed** da primeira flag `force_brief_vision_check` (`enabled=false` — padrão recomendado) com a descrição administrativa.
3. RPC/admin route de update com **motivo obrigatório** (idempotente, operationId) que atualiza `enabled`/`updated_by`/`updated_at` e registra auditoria na **mesma transação** (precedente `admin_review_access_request`, `20260810010000_create_access_requests.sql:64-136`) — `target_id = feature_flags.id` (UUID NOT NULL existente) + `metadata.key`.
4. **Estender CHECKs de `admin_audit_log`** (padrão F33/F42): nova `action 'feature_flag_update'` e novo `target_type 'feature_flag'` — `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ... / ADD CONSTRAINT ...` (precedente `20260810010000_create_access_requests.sql:146-163`).

**Sem migration no domínio da campanha:** snapshot `campaign_brief_v1`, `campaigns`, storage e RLS **intocados** (revisão é client-side pura).

**Configuração/operação (D5):** env var `VENDEO_FORCE_BRIEF_VISION_CHECK` apenas como **fail-safe emergencial** (pode forçar `true`); flag principal operada na tela do admin ("Controles operacionais") sem redeploy. Nenhuma mudança em `supabase/config.toml`.

**Deploy (ordem fail-closed):** (1) **migrations** (`feature_flags` + seed `force_brief_vision_check=false` + extensão dos CHECKs de `admin_audit_log` + RPC `admin_update_feature_flag`) — a tabela/CHECKs/RPC precisam existir **antes** do código que os consome (admin/RPC/tela da flag); (2) **deploy do código** (revisão + override + `skipped` + serviço de leitura da flag + tela admin) com flag `enabled=false` (default) — o fallback de leitura da flag segura a geração caso a tabela ainda não exista no ambiente; (3) smoke test com revisão ativa; (4) UAT local (mobile + flag ligada/desligada + fallback de leitura); (5) produção. **Observação de ordem:** a tela admin/RPC da flag só é considerada utilizável após a migration aplicada no ambiente; até lá, o fallback de leitura (`enabled=false`) mantém o fluxo padrão (revisão humana + pular vision). Rollback: desligar a flag na tela de admin (reversível sem redeploy); reverter commit não altera schema de banco.

**Trackings (D1 — runbook):** aplicar atualizações em `ROADMAP.md` (raiz), `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/MILESTONES.md` na ordem listada na D1; **marcar checkboxes UAT 20.5–20.15 da F42**; Stripe → iniciativa diferida; F44 adicionada pelo runbook da própria F44.

## Open Questions

- **Nenhuma bloqueante.** Decisões explícitas registradas no alinhamento F43: tela intermediária não modal com `reviewMode` (D2); compressão antes da revisão com `prepareCampaignImages` (D3); dois helpers puros (D4); override `brief_review_confirmed` com semântica distinta e `skipped` no progresso (D5); flag administrativa mínima `force_brief_vision_check` em `feature_flags` com fallback `enabled=false` e auditoria (D5); conteúdo do resumo com loja/marca + seções + rótulos + custo + slot Tema (D6); a11y/mobile/microcopy com preview sem recorte (D7); renumeração F42 concluída / F43 Revisão / Stripe fora da numeração (D1).
- **Planejamento (não bloqueante):** retenção da revisão em `sessionStorage` após refresh (D2) — avaliada no planejamento da fase, não é exigência; nome da seção admin ("Controles operacionais") e microcopy final validados na execução.