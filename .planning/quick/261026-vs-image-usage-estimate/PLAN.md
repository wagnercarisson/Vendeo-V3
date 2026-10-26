---
id: 261026-vs-image-usage-estimate
status: complete
date: 2026-10-26
branch: feature/fase-47-1-modelos-assinatura-visual
type: quick
---

# Quick 261026 — Estimativa versionada do consumo da imagem da Assinatura Visual

## Objetivo

Aplicar, somente nas novas gerações da Assinatura Visual com configuração
dedicada válida, a estimativa versionada `vs-image-usage-v1` para os tokens da
imagem, preservando os tokens reais do orquestrador/validação/perfil e sem
recalcular o histórico.

## Pré-checagem do contrato de pricing

- Fonte: `ai_model_pricing` (linha vigente `effective_until IS NULL`, com
  `quality` quando aplicável).
- Entrada textual: `input_token_usd_per_1m`.
- Saída de imagem: `image_token_usd_per_1m`.
- `output_token_usd_per_1m` é tarifa textual e NÃO é usada como saída de imagem.
- `image_unit_usd` NÃO é usada neste cálculo por token.
- Não há leitura/derivação de tarifa de `source_note`.
- Tarifa/dimensão ausente ⇒ custo parcial/desconhecido (sem fallback inventado).

## Implementação

1. `src/lib/ai-cost/visual-signature-image-usage.ts` — tabela fechada
   `modelo+qualidade+tamanho`, versão, data, origem e lookup exato.
2. `src/lib/ai-cost/visual-signature-image-cost.ts` — componente textual real +
   componente estimado da imagem; sem US$ 0,065; sem `provider_reported`;
   auditoria versionada.
3. Telemetria: alvo da estimativa propagado do gerador ao envelope; sink
   aplica somente em `visual_signature_image` com alvo presente.
4. Admin: campos de custo existentes recebem o resultado; badge da listagem e
   do detalhe permanece "Estimado" para o caminho completo e "Custo não
   disponível" quando falta tarifa.
5. Documentação em
   `docs/convencoes/estimativa-consumo-imagem-assinatura-visual.md`.

## Fora do escopo

Cron/tarifas automáticas, migration, banco, provider, prompts, modelos,
qualidade, retries, créditos, Produto 1:1, F50.4, painel novo, merge/push/deploy.
