---
quick_id: 261106-qxn
phase: quick
plan: 01
type: summary
status: awaiting_review
implementation_status: complete_pending_review
verification_status: not_run
production_authorized: false
base_sha: e272516a5cd6d258b8123b8ee2ef8e7c6a81d0d6
completed_at: 2026-11-06
---

# Quick 261106-qxn — resumo de implementação

**Objetivo:** dar clareza ao formato da campanha e à direção de fundo sem alterar geração, prompt, crédito ou produção.

**Estado:** implementação local concluída, gates executados e evidência visual coletada. **Aguardando revisão antes de concluir a quick.** `STATE.md`/`ROADMAP.md` não foram atualizados.

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

---

## 3. Evidência visual

Pasta: `.planning/quick/261106-qxn-clareza-da-interface-de-campanhas-seleto/evidence/`

- `desktop-formulario.png` — 1440 px, duas colunas.
- `desktop-1280-formulario.png` — 1280 px, duas colunas (476 px cada).
- `desktop-1024-formulario.png` — 1024 px, empilhado com sidebar.
- `mobile-formulario.png` — 390 px.
- `mobile-375-formulario.png` e `mobile-320-formulario.png` — sem overflow.
- `desktop-revisao.png` e `mobile-revisao.png` — título/subtítulo, sem seletor; Formato → Direção de fundo.
- `desktop-listagem.png` e `mobile-listagem.png` — rótulos “9:16 vertical”/“1:1 quadrado” nos cards.
- `desktop-dashboard.png` e `mobile-dashboard.png` — rótulo junto aos metadados.
- `visual-review.md` — observações e medições.
- `capture-results.json`, `threshold-results.json`, `mobile-threshold-results.json` — medições.

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

## 6. Próximo passo

Revisão do diff e da evidência pelo Codex/responsável. Após aprovação explícita, concluir a quick (atualização de tracking, se aplicável) e seguir para os gates de publicação separados. **Produção continua não autorizada.**
