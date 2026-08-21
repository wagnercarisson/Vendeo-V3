# Phase 43: Revisão do Brief Pré-Geração — UAT Local

**Contexto:** UAT local pós-implementação da F43 (gate de revisão do brief em tela intermediária `reviewMode`, compressão antes da revisão `prepareCampaignImages`, helpers puros `buildCampaignGenerationBody`, override `brief_review_confirmed` pulando a IA de visão com fase `input_validation` `skipped`, flag administrativa `force_brief_vision_check`, resumo Produto/Oferta/Imagens/Avisos/Custo + loja/marca + slot Tema).
**Pré-requisito:** rodar o app local (`npm run dev`) e abrir `http://localhost:3000/campanhas/nova` com uma loja de teste (dados + direção visual + legal + saldo). A migration `feature_flags` foi aplicada no remoto (usuário).
**Obrigatório:** cenário 15.7 (mobile real/estreito 320px/375px) — a fase não fecha sem ele (D7).

---

## Checklist

### Cenário 15.5 — Form → "Revisar e gerar" → resumo → "Voltar e editar" sem perda → "Confirmar e gerar campanha" (D2/D6)

- [x] Preencher o form (produto, preços, badge, imagem, validade, avisos) → botão principal exibe **"Revisar e gerar"** (não "Criar Campanha").
- [x] Clicar "Revisar e gerar" → tela de revisão (não modal) com resumo Produto/Oferta/Imagens/Avisos/Custo + loja/marca no topo.
- [x] Clicar "Voltar e editar" → form exibido com **todos os campos preservados** (nome, preços, imagem, validade, avisos, badge).
- [x] Re-entrar na revisão e clicar "Confirmar e gerar campanha" → geração dispara e navega para `/campanhas/[id]`.
- Resultado: [PASS] — Observação: fluxo completo validado (inclui correção pós-revisão: scroll ao topo na revisão; preview estável ao "Voltar e editar").

### Cenário 15.6 — Imagem HEIC (celular) → revisão mostra JPEG comprimido mesma orientação (D3)

- [x] Adicionar uma foto **HEIC** (câmera) → revisão mostra o thumbnail **JPEG comprimido** (`mimeType: image/jpeg`), mesma orientação (EXIF respeitada).
- [x] O que a revisão mostra é exatamente o payload enviado (mesmo thumbnail no resumo e na arte).
- Resultado: [PASS] — Observação:

### Cenário 15.7 — Mobile real/estreito 320px/375px (OBRIGATÓRIO — D7)

- [x] Acessar a revisão em **320px/375px** → **sem scroll horizontal**; seções empilham.
- [x] Botões "Confirmar e gerar campanha" e "Voltar e editar" **sempre acessíveis** (touch ≥ 44px).
- [x] **Topbar não cobre** o conteúdo da revisão (pós-ajustes AppShell/Topbar compacta).
- [x] Preview das imagens **sem recorte** (`object-contain` em célula `aspect-square`).
- Resultado: [PASS] — Observação:

### Cenário 15.8 — "Confirmar" → geração sem etapa vision; GenerationProgress mostra `input_validation` skipped (D5)

- [x] Confirmar a geração → **nenhuma etapa de validação IA** roda (sem `campaign_input_validation` na telemetria).
- [x] `GenerationProgress` exibe a fase `input_validation` como **`skipped`** ("Brief confirmado pelo usuário") — nunca "Validação concluída" falsa.
- [x] Geração completa → `/campanhas/[id]` com arte e kit.
- Resultado: [PASS] — Observação:

### Cenário 15.9 — Flag `force_brief_vision_check` ligada na tela admin → vision volta a rodar (D5)

- [x] Admin → **"Controles operacionais"** → flag `force_brief_vision_check` exibida com descrição e estado "Desligada — padrão recomendado".
- [x] Alterar para **ligada** informando **motivo obrigatório** → salvo, auditado, **sem redeploy**, tela reflete o novo estado.
- [x] Confirmar uma geração → **validação vision volta a rodar** (rota normaliza o `brief_review_confirmed`; pré-stream e Phase 1 validam).
- [x] Reverter para **desligada** (motivo obrigatório) → vision pula novamente.
- Resultado: [PASS] — Observação:

### Cenário 15.10 — Fallback de leitura da flag não bloqueia geração (D5)

- [x] Simular banco/flag indisponível (ex.: env `VENDEO_FORCE_BRIEF_VISION_CHECK` ausente + tabela/leitura falhando) → geração **segue normalmente** (vision pulada no caminho `brief_review_confirmed`), **sem bloquear**, log de warning operacional.
- Resultado: **[PASS]** — Não testável manualmente; validado por teste automatizado `feature-flag-service.test.ts` (Teste 26b: falha de leitura → `enabled=false`, não bloqueia, log warning; Teste 26c: env var `VENDEO_FORCE_BRIEF_VISION_CHECK=true` força true).

### Cenário 15.11 — Sem override (ex.: requisição manual) → validação vision roda (D5)

- [x] Enviar uma requisição **sem** `inputValidationOverride` (ou gerar sem revisão) → validação IA produto×imagem **roda** (rede de segurança).
- Resultado: **[PASS]** — Não testável manualmente; validado por teste automatizado `route.test.ts` (Teste 20: rota sem override → validação IA roda).

### Cenário 15.12 — Saldo insuficiente/custo desativado → "Confirmar" bloqueado (D6)

- [x] Com saldo 0 / custo desativado / saldo < custo → "Confirmar e gerar campanha" **bloqueado** na revisão; "Voltar e editar" continua acessível.
- Resultado: [PASS] — Observação: Com saldo zero o botão revisar e gerar fica desabilitado - comportamento legado esperado

### Cenário 15.13 — Geração bem-sucedida → `/campanhas/[id]` com arte e kit (fluxo atual)

- [x] Confirmar com saldo suficiente → campanha gerada → `/campanhas/[id]` exibe arte + kit (download/original), fluxo atual inalterado.
- Resultado: [PASS] — Observação:

---

## Instruções de preenchimento

1. Preencha cada cenário com `[x]` nos itens e `PASS`/`FAIL` + observação em "Resultado".
2. Cenários **15.7** (mobile real/estreito) e **15.6** (HEIC) são obrigatórios — a fase não fecha sem eles.
3. Após o preenchimento, atualizar o resumo abaixo.

## Summary

- total: 9
- passed: 9
- issues: 0
- pending: 0
- skipped: 0
- blocked: 0

> **Nota:** 15.10 (fallback de leitura) e 15.11 (sem override → vision roda) não foram testáveis manualmente; **validados por testes automatizados** (15.10 → `feature-flag-service.test.ts` Testes 26b/26c; 15.11 → `route.test.ts` Teste 20). Cenários obrigatórios 15.6 (HEIC) e 15.7 (mobile 320px/375px) executados.