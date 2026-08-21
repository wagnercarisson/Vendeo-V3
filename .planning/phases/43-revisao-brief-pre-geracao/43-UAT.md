# Phase 43: Revisão do Brief Pré-Geração — UAT Local

**Contexto:** UAT local pós-implementação da F43 (gate de revisão do brief em tela intermediária `reviewMode`, compressão antes da revisão `prepareCampaignImages`, helpers puros `buildCampaignGenerationBody`, override `brief_review_confirmed` pulando a IA de visão com fase `input_validation` `skipped`, flag administrativa `force_brief_vision_check`, resumo Produto/Oferta/Imagens/Avisos/Custo + loja/marca + slot Tema).
**Pré-requisito:** rodar o app local (`npm run dev`) e abrir `http://localhost:3000/campanhas/nova` com uma loja de teste (dados + direção visual + legal + saldo). A migration `feature_flags` foi aplicada no remoto (usuário).
**Obrigatório:** cenário 15.7 (mobile real/estreito 320px/375px) — a fase não fecha sem ele (D7).

---

## Checklist

### Cenário 15.5 — Form → "Revisar e gerar" → resumo → "Voltar e editar" sem perda → "Confirmar e gerar campanha" (D2/D6)

- [ ] Preencher o form (produto, preços, badge, imagem, validade, avisos) → botão principal exibe **"Revisar e gerar"** (não "Criar Campanha").
- [ ] Clicar "Revisar e gerar" → tela de revisão (não modal) com resumo Produto/Oferta/Imagens/Avisos/Custo + loja/marca no topo.
- [ ] Clicar "Voltar e editar" → form exibido com **todos os campos preservados** (nome, preços, imagem, validade, avisos, badge).
- [ ] Re-entrar na revisão e clicar "Confirmar e gerar campanha" → geração dispara e navega para `/campanhas/[id]`.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.6 — Imagem HEIC (celular) → revisão mostra JPEG comprimido mesma orientação (D3)

- [ ] Adicionar uma foto **HEIC** (câmera) → revisão mostra o thumbnail **JPEG comprimido** (`mimeType: image/jpeg`), mesma orientação (EXIF respeitada).
- [ ] O que a revisão mostra é exatamente o payload enviado (mesmo thumbnail no resumo e na arte).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.7 — Mobile real/estreito 320px/375px (OBRIGATÓRIO — D7)

- [ ] Acessar a revisão em **320px/375px** → **sem scroll horizontal**; seções empilham.
- [ ] Botões "Confirmar e gerar campanha" e "Voltar e editar" **sempre acessíveis** (touch ≥ 44px).
- [ ] **Topbar não cobre** o conteúdo da revisão (pós-ajustes AppShell/Topbar compacta).
- [ ] Preview das imagens **sem recorte** (`object-contain` em célula `aspect-square`).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.8 — "Confirmar" → geração sem etapa vision; GenerationProgress mostra `input_validation` skipped (D5)

- [ ] Confirmar a geração → **nenhuma etapa de validação IA** roda (sem `campaign_input_validation` na telemetria).
- [ ] `GenerationProgress` exibe a fase `input_validation` como **`skipped`** ("Brief confirmado pelo usuário") — nunca "Validação concluída" falsa.
- [ ] Geração completa → `/campanhas/[id]` com arte e kit.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.9 — Flag `force_brief_vision_check` ligada na tela admin → vision volta a rodar (D5)

- [ ] Admin → **"Controles operacionais"** → flag `force_brief_vision_check` exibida com descrição e estado "Desligada — padrão recomendado".
- [ ] Alterar para **ligada** informando **motivo obrigatório** → salvo, auditado, **sem redeploy**, tela reflete o novo estado.
- [ ] Confirmar uma geração → **validação vision volta a rodar** (rota normaliza o `brief_review_confirmed`; pré-stream e Phase 1 validam).
- [ ] Reverter para **desligada** (motivo obrigatório) → vision pula novamente.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.10 — Fallback de leitura da flag não bloqueia geração (D5)

- [ ] Simular banco/flag indisponível (ex.: env `VENDEO_FORCE_BRIEF_VISION_CHECK` ausente + tabela/leitura falhando) → geração **segue normalmente** (vision pulada no caminho `brief_review_confirmed`), **sem bloquear**, log de warning operacional.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.11 — Sem override (ex.: requisição manual) → validação vision roda (D5)

- [ ] Enviar uma requisição **sem** `inputValidationOverride` (ou gerar sem revisão) → validação IA produto×imagem **roda** (rede de segurança).
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.12 — Saldo insuficiente/custo desativado → "Confirmar" bloqueado (D6)

- [ ] Com saldo 0 / custo desativado / saldo < custo → "Confirmar e gerar campanha" **bloqueado** na revisão; "Voltar e editar" continua acessível.
- Resultado: [PASS / FAIL] — Observação:

### Cenário 15.13 — Geração bem-sucedida → `/campanhas/[id]` com arte e kit (fluxo atual)

- [ ] Confirmar com saldo suficiente → campanha gerada → `/campanhas/[id]` exibe arte + kit (download/original), fluxo atual inalterado.
- Resultado: [PASS / FAIL] — Observação:

---

## Instruções de preenchimento

1. Preencha cada cenário com `[x]` nos itens e `PASS`/`FAIL` + observação em "Resultado".
2. Cenários **15.7** (mobile real/estreito) e **15.6** (HEIC) são obrigatórios — a fase não fecha sem eles.
3. Após o preenchimento, atualizar o resumo abaixo.

## Summary

- total: 9
- passed: 0
- issues: 0
- pending: 9
- skipped: 0
- blocked: 0