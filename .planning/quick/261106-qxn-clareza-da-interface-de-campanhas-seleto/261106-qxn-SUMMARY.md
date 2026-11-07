---
quick_id: 261106-qxn
phase: quick
plan: 01
type: summary
status: complete
implementation_status: complete
verification_status: manual_accepted
acceptance_status: manual_accepted
accepted_by: responsável (aceite manual)
accepted_at: 2026-11-06
final_review_status: accepted
production_authorized: false
production_deployed_reported: true
production_deployed_by: responsável
production_deployment_commit: 37bfb5277f7d48789526ef4e855cfd0dedf3e58d
base_sha: e272516a5cd6d258b8123b8ee2ef8e7c6a81d0d6
completed_at: 2026-11-06
closed_at: 2026-11-06
---

# Quick 261106-qxn — resumo de implementação

**Objetivo:** dar clareza ao formato da campanha e à direção de fundo sem alterar geração, prompt, crédito ou produção.

**Estado:** implementação local concluída, gates executados, evidência visual coletada, **aceite manual dos três ajustes confirmado pelo responsável** e **revisão final do acabamento aprovada**. Quick concluída em 2026-11-06; `STATE.md` e `ROADMAP.md` reconciliados. **Produção não autorizada.**

---

## 1. Arquivos alterados

### Formulário e cabeçalho
- `src/components/flow/campaign-page-client.tsx` — removeu o título/subtítulo duplicado; o cabeçalho passou a viver no formulário.
- `src/components/flow/campaign-input-form.tsx` — cabeçalho único com título/subtítulo em todos os estados; seletor apenas na edição normal; banner de pausa junto do seletor.
- `src/components/flow/campaign-header.module.css` — grid intrínseco `auto-fit` com mínimo de 29rem, calibrado contra a largura real.
- `src/components/flow/campaign-format-selector.tsx` — rótulo visível “Formato da campanha”; legenda sr-only e opções preservadas.
- `src/components/flow/use-campaign-form.ts` — guard `isCampaignFormatLocked` e bloqueio de mutação de `campaignFormat` em revisão/preparação/submissão/unknown.

### Cards e i18n
- `src/lib/campaign/list.ts` — formato resolvido no servidor via `resolveCampaignFormat`.
- `src/lib/dashboard/campaigns.ts` — `input_snapshot` lido apenas no servidor; DTO expõe somente `format`.
- `src/app/(app)/campanhas/client.tsx` — rótulo junto à data/status, sem tocar na miniatura.
- `src/components/dashboard/dashboard-campaigns.tsx`
- `src/components/dashboard/available-campaign-card.tsx`
- `src/lib/i18n/campaign-list/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts}`
- `src/lib/i18n/dashboard/{messages.ts,catalogs/pt-BR.ts,catalogs/es-419.ts}`

### Revisão
- `src/components/flow/background-direction-selector.tsx` — mapa de rótulos curtos exportado.
- `src/components/flow/campaign-brief-review.tsx` — linha “Direção de fundo” imediatamente após “Formato”, somente no fluxo elegível.

### Testes
- `src/components/flow/__tests__/campaign-format-selector.test.tsx`
- `src/components/flow/__tests__/campaign-input-form.test.tsx`
- `src/components/flow/__tests__/campaign-brief-review.test.tsx`
- `src/components/flow/__tests__/use-campaign-form-format.test.ts`
- `src/components/flow/__tests__/use-campaign-form-restore-format.test.ts`
- `src/__tests__/lib/campaign/list.test.ts`
- `src/__tests__/app/minhas-campanhas-client.test.tsx`
- `src/lib/dashboard/__tests__/campaigns.test.ts`
- `src/components/dashboard/__tests__/dashboard-campaigns.test.tsx`
- `src/components/dashboard/__tests__/available-campaign-card.test.tsx`
- `src/lib/i18n/campaign-list/__tests__/catalogs.test.ts`
- `src/lib/i18n/dashboard/__tests__/catalogs.test.ts`

---

## 2. Resultados dos gates

| Gate | Resultado |
|---|---|
| Testes focados | **12 arquivos / 136 testes passed** |
| Typecheck | **exit 0** (`tsc -p tsconfig.typecheck.json --noEmit`) |
| Lint | **exit 0** (`eslint .`) — limitação conhecida: cobertura TypeScript não é integral |
| Build | **exit 0** (`next build`, 96/96 páginas) |
| `git diff --check` | **limpo** (apenas avisos de normalização LF/CRLF do Git) |
| Verificação visual | desktop 1440/1280/1024, mobile 390/375/320; sem overflow horizontal |

**Nota de ambiente:** o comando `npm` global é um shim de 0 byte em `C:\WINDOWS\system32\npm`. Os gates reais foram executados com `C:\Program Files\nodejs\npm.cmd`.

### 2.1 Acabamento pós-aceite — card Oferta

- Coluna de rótulos ampliada uniformemente de `w-28` (112 px) para `w-32` (128 px).
- Gap e alinhamento dos valores preservados; valores com `min-w-0 break-words`.
- “Direção de fundo” confirmado em **uma linha a 128 px** no desktop (1440/1280).
- Revisão vertical (`Vertical 9:16` + `1080 × 1920 px`) validada em 390/375/320 px,
  sem overflow horizontal.
- Teste focado da revisão: **1 arquivo / 12 testes passed**.
- Typecheck e `git diff --check` reexecutados: **exit 0 / limpo**.
- Build: a primeira tentativa falhou por cache `.next` obsoleto
  (`PageNotFoundError` em rotas admin); após remover o cache gerado e rebuildar,
  **96/96 páginas, exit 0**. Nenhuma alteração de código foi feita para contornar
  o erro.

---

## 3. Evidência visual

Pasta: `.planning/quick/261106-qxn-clareza-da-interface-de-campanhas-seleto/evidence/`

- `desktop-formulario.png` — 1440 px, duas colunas.
- `desktop-1280-formulario.png` — 1280 px, duas colunas (476 px cada).
- `desktop-1024-formulario.png` — 1024 px, empilhado com sidebar.
- `mobile-formulario.png` — 390 px.
- `mobile-375-formulario.png` e `mobile-320-formulario.png` — sem overflow.
- `desktop-revisao.png`, `desktop-1280-revisao.png`, `mobile-revisao.png`,
  `mobile375-revisao.png` e `mobile320-revisao.png` — revisão vertical,
  título/subtítulo sem seletor; Formato → Direção de fundo; coluna de 128 px.
- `desktop-listagem.png` e `mobile-listagem.png` — rótulos “9:16 vertical”/“1:1 quadrado” nos cards.
- `desktop-dashboard.png` e `mobile-dashboard.png` — rótulo junto aos metadados.
- `visual-review.md` — observações e medições.
- `capture-results.json`, `threshold-results.json`, `mobile-threshold-results.json`,
  `review-polish-results.json` — medições.

**Calibração do grid:** 30rem deixava 1280 px sempre empilhado (976 px de cabeçalho). O limiar foi reduzido para 29rem após medição; 1280/1440 passam a duas colunas, 1024 e abaixo empilham.

---

## 4. Preservação de 1:1, legado e contratos

- 1:1 histórico sem chaves continua resolvendo para `1:1` e exibindo “1:1 quadrado”.
- `campaignFormat: "9:16"` válido exibe “9:16 vertical”.
- Formato indisponível resolve para `null` e não exibe identificador, sem fallback para 1:1.
- Nenhuma inferência por miniatura/path.
- `input_snapshot` não entra nos DTOs dos cards.
- Payload 1:1 continua sem `campaignFormat`; payload 9:16 mantém `campaignFormat: "9:16"`.
- `backgroundDirection` continua no payload elegível; legado intacto.
- Prompt, políticas, `resolveCampaignFormat`, `buildCampaignGenerationBody`, rotas de geração, crédito, pricing, artefatos e miniaturas não foram alterados.
- F59 permanece arquivada. Nenhuma flag, migration, crédito, push, deploy ou produção.

---

## 5. Desvios e limitações

- **Limiar do grid:** 30rem → 29rem, conforme medição real; documentado no plano e no CSS.
- **Conta de revisão visual:** loja local existente “Padaria da Esquina”; autenticação por link de recuperação de uso único do Supabase local, sem registrar token/senha.
- **Capturas:** Chrome headless local, DPR 1; não substitui leitor de tela real nem DPR 2/3.
- **Teclado/foco:** cobertura por testes de estrutura e inspeção manual básica; leitor de tela real não executado.
- **Nenhuma geração paga** foi feita; o botão “Confirmar e gerar campanha” não foi acionado.

---

## 6. Aceite e fechamento

- **Aceite manual do responsável:** confirmado em 2026-11-06 para os três ajustes
  originais (seletor no cabeçalho, formato nos cards e direção de fundo na revisão).
- **Revisão final do acabamento:** confirmada em 2026-11-06 para a coluna de rótulos
  do card Oferta em `w-32` (128 px), com “Direção de fundo” em uma linha no desktop
  e revisão vertical adequada em 320/375 px.
- **Sem novos ajustes de interface** após o aceite.
- **Implementação:** commits `b1023060`, `93b66434`, `b82f913f` e `af04e7ce`.
- **Documentação e evidência:** commit de fechamento desta quick.
- **Produção:** não autorizada; nenhum push, deploy, migration, flag, crédito ou
  geração paga foi executado.

## 7. Próximo gate — preparação para produção da F59 + quick

O próximo passo é um gate **separado e não executado** de preparação para produção,
envolvendo F59 + quick 261106-qxn:

1. preflight read-only de produção (branch, commits, migrations, flag e ambiente);
2. reconciliação de branch/commits e confirmação de que a quick está integrada ao
   conjunto que será promovido;
3. plano explícito de migration data-only da flag `product_9_16_enabled`, com
   autorização própria, rollback e janela;
4. autorização separada para deploy, ativação e smoke de produção;
5. evidência de rollback e critérios de aceite de produção.

Esse gate não foi iniciado. **Produção continua não autorizada.** O filtro por formato
permanece apenas como evolução futura; proteção de saída e “Limpar dados” continuam
itens separados.

## 8. Produção — registro pós-fechamento (2026-11-06/07)

Registro posterior ao fechamento da quick, com **confirmação manual do responsável**
para deploy realizado e fluxo/telas validados. A evidência técnica consultada está
separada na tabela abaixo.

| Campo | Registro | Origem |
|---|---|---|
| Deploy | `dpl_BBKyLDs5VFs5G9FgzusmpYHXN6Ld` — status `READY`, produção, alias `vendeo.tech` | Vercel, consulta read-only |
| Horário | criado `2026-11-07T01:04:15.604Z`; pronto `2026-11-07T01:06:15.195Z` | Vercel |
| Commit publicado | `37bfb5277f7d48789526ef4e855cfd0dedf3e58d` — “merge: integrar F59 vertical 9:16 e quick de interface” | Vercel metadata + Git |
| Deploy/fluxo/telas | realizados e validados manualmente | **Confirmação do responsável** |
| Flag `product_9_16_enabled` | `true` (atualizada em `2026-11-07T01:08:02.454264+00:00`) | Supabase read-only |
| Migration `20261105162052` | presente no ledger remoto | `supabase migration list --linked` |
| Campanha de smoke | `fa2ebf20-43c8-4313-8e60-179ab6940bbc` — “Orquídea Phalaenopsis”, loja Floricultura Donna Flor | Supabase read-only |
| Operação | `e6f91009-9fb2-489e-93e0-fb0303f1623e` | Supabase read-only |
| Formato | `9:16` / `f59-vertical-9-16-v1` | Snapshot persistido |
| Artefato | JPEG `1080×1920`; objeto presente com 455.524 B | DB + Storage info |
| Download | **não confirmado especificamente**; apenas fluxo/telas pelo responsável | Limitação explícita |
| Crédito | 1 crédito; operação `delivered`; saldo 5 → 4 | Credit operations + transactions |
| Custo calculado (usage/pricing) | US$ 0,033221 = imagem 0,033047 + copy 0,000174 | `generation_events` |
| Custo contabilizado no piloto | US$ 0,1107 = imagem 0,11 + copy 0,0007 | `product_1_1_pilot_paid_calls` |
| Custo informado pelo provider | não registrado (`provider_reported_cost_usd` nulo) | Metadata |
| Candidatos | apenas a campanha acima é posterior ao deploy; campanhas anteriores da Donna Flor são pré-deploy e não foram tratadas como smoke | Consulta read-only |

**Ressalvas preservadas:** auditoria do replay terminal continua aceita como exceção
não corrigida; o custo é calculado por usage/pricing, não fatura; download e cobrança
não têm confirmação técnica independente nesta consulta. Deploy realizado não
significa aceite integral de todos os cenários de produção.
