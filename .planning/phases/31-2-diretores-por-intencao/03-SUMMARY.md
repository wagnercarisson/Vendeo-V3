# Plan 31-2-03: 6 Prompt Templates — Summary

**Status:** ✅ Complete
**Date:** 2026-07-25

## Changes Made

### Created prompts/campaign-image-director-offer.md
- Cópia fiel do `campaign-image-director.md` original (offer mantém comportamento idêntico)

### Created prompts/campaign-image-director-spotlight.md
- Tom de vitrine/descoberta sem urgência
- Preço como valor de destaque (sem DE/POR)
- Badge opcional
- `{{preserveImageDirective}}` placeholder incluído

### Created prompts/campaign-image-director-exclusive.md
- Sem preço/desconto na tabela de informações
- Tom premium/exclusivo
- NÃO exibir preço, desconto ou condições
- Badges promocionais proibidos
- `{{preserveImageDirective}}` placeholder incluído

### Created prompts/campaign-copy-director-offer.md
- `{{offer}}` substituído por `{{commercialFrame}}` em todas as ocorrências
- Conteúdo funcionalmente idêntico ao original

### Created prompts/campaign-copy-director-spotlight.md
- Tom de descoberta, curiosidade, valor
- Sem urgência ou escassez
- Formato JSON de saída idêntico ao template base

### Created prompts/campaign-copy-director-exclusive.md
- Tom premium, sofisticado, aspiracional
- Sem preço, desconto ou condições comerciais
- Formato JSON de saída idêntico ao template base

## Verification
- 6 arquivos criados em `prompts/`
- Offer é cópia fiel (image) / adaptação mínima (copy)
- Placeholders consistentes com os sistemas consumidores
