# 261017-cdi — Validação visual MANUAL (EXECUÇÃO PENDENTE DE AUTORIZAÇÃO)

> **Estado:** plano preparado; **NÃO executado**. Nenhuma flag ligada, nenhuma
> despausa, nenhuma geração. Este documento **não autoriza** gerar.
> **Base de código:** commit `0f510d8b` (composer v7, fundo v2, identidade v1).
> **Ambiente:** `vendeo-homolog` (local). **Produção desligada.**

## Responsabilidades

- **Responsável humano:** escolher os produtos, preencher/conferir o formulário,
  clicar em **gerar** e avaliar as artes no navegador. É o único que dispara
  gerações.
- **Executor (agente):** preparar o ambiente, acompanhar registros/custos/créditos
  e encerrar a janela. **Não** chama provider por script, rota headless ou teste.
- **Codex:** acompanhar a avaliação das imagens compartilhadas pelo responsável.

## Roteiro — quatro gerações manuais (mesma loja)

1. **Produto A — estúdio**
2. **Produto B (cor dominante diferente) — estúdio**
3. **Produto A — ambientado**
4. **Produto B — ambientado**

Regras:
- **Mesmo modelo/qualidade** de imagem para todas; **Luna** para copy (já vigente).
- **Preservar** produto, oferta e **imagem de referência** entre os testes de cada
  produto (A: 1↔3 idênticos; B: 2↔4 idênticos).
- **Não** provocar fallback e **não** repetir gerações para obter um resultado
  favorável. Parar na primeira falha relevante.
- **Não** executar os controles `original` e **ausência de paleta** nesta rodada —
  permanecem nos testes automatizados. Geração paga deles só se surgir dúvida concreta.

Conferir em cada arte: uso da **paleta da loja**, **separação produto/fundo**,
**logo legível**, **embalagem fiel**, **informações comerciais corretas** e
**direção de fundo respeitada**.

## ANTES DE HABILITAR — PARAR PARA AUTORIZAÇÃO

### Produtos propostos (a confirmar pelo responsável)
- **Produto A:** Red Bull Summer 250ml Morango & Pêssego — dominante **azul/prata/vermelho**.
- **Produto B:** Rocambole de Morango (kg) — dominante **rosa/vermelho/creme**.

> Ambos da mesma loja (Adega Mestre das Geladas). O responsável pode trocar B por
> outro produto de cor dominante distinta.

### Par de imagem vigente, fallback e copy
- **Principal:** `openai/gpt-image-2.5-sunburst` / `medium`.
- **Fallback:** `openai/gpt-image-2` / `low`.
- **Copy:** `openai/gpt-6-luna` (sem fallback), mantido.

### Gasto acumulado atual
- **`spent_usd` = US$ 0,2454** (histórico preservado; **não** zerar).
- Cap vigente no banco = US$ 3,00 (janela anterior — **não** reutilizar como
  autorização desta nova janela).

### Estimativas e orçamento (distinguir estimativa de observado)
- **Observado nas gerações anteriores:** **US$ 0,03–0,05 por imagem** — é
  observação histórica, **não** promessa de teto.
- **Estimativa por tentativa (pricing do gate):**
  - imagem principal `sunburst/medium`: **US$ 0,044**
  - imagem fallback `gpt-image-2/low`: **US$ 0,042**
  - copy `gpt-6-luna`: **US$ 0,0007**
- **Sessão base (4 gerações limpas):** 4 × (0,044 + 0,0007) ≈ **US$ 0,179**.
- **Sessão conservadora (retries/fallback/copy):** pior caso por geração
  (2× principal + 1× fallback + copy) ≈ US$ 0,1307 → ×4 ≈ **US$ 0,53**.
- **Orçamento adicional sugerido:** **US$ 0,60**.
- **Teto acumulado resultante:** 0,2454 + 0,60 = **US$ 0,8454** (≈ US$ 0,85),
  **sem zerar o histórico** e **sem** reutilizar os +US$ 2,00 da janela anterior.

### Não ligar nada antes da autorização
- Manter `product_1_1_test_stores_enabled = false`, `all_stores = false`,
  geração **pausada**. Nenhuma autorização ativa.

## APÓS AUTORIZAÇÃO — sequência do executor

1. Revalidar a `vendeo-homolog` (isolamento/identidade/saúde).
2. Preparar **autorização estreita** e **teto** (novo cap = gasto + adicional).
3. Ligar **somente** `product_1_1_test_stores_enabled`; manter `all_stores=false`.
4. Despausar a geração (`VENDEO_GENERATION_PAUSED=false`); reiniciar o Next
   **apenas se necessário** para carregar env.
5. **Aguardar** o responsável gerar **uma campanha por vez**. O executor **não**
   chama provider.

### Registro por operação
- campanha / `operationId`; modelo/qualidade **efetivos**; versões do prompt
  (`composer v7`, `fundo v2`, `identidade v1`, demais políticas); chamadas /
  retries / fallback; crédito; estimativa; estado terminal.
- **Custos observados no painel ficam separados** das estimativas.

### Parada
- Parar em **erro**, **resultado desconhecido**, **divergência** ou **falha visual
  relevante**. Não reconciliar automaticamente resultados inconclusivos.

## ENCERRAMENTO (ao terminar ou interromper)

- Desligar `test_stores`, **revogar autorização** e **restaurar a pausa**.
- Manter `all_stores = false`.
- Preservar campanhas/evidências e apresentar o **resumo**.
- **Não** declarar aprovação visual pelo responsável.

## Limites

- **Sem** produção, novas migrations, reset, deploy/push, nem incremento dos
  contadores das fases encerradas (B2.3/Luna não reaberta).
- A proposta **não** autoriza gerar. Aguarda decisão sobre produtos, par e teto.
