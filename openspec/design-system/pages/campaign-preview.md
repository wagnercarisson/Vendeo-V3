# Page Override — Pré-visualização da Campanha (V1)

> **Override rules for the Campaign Preview step.**
> These rules take precedence over `openspec/design-system/MASTER.md` when building this page.
> All non-overridden rules from MASTER.md still apply.

---

## 1. Purpose

Exibir a campanha gerada em tamanho real antes da exportação. O lojista deve conseguir:

- Ver a arte exatamente como será publicada
- Alternar entre variações (se múltiplas forem geradas)
- Ajustar texto em campos guiados (sem editor livre)
- Aprovar ou solicitar regeneração

**Princípio:** A prévia é SAGRADA. Deve mostrar a arte no maior tamanho possível, sem distorções e com fidelidade de cores.

---

## 2. Layout

```
┌──────────────────────────────────────────────────────┐
│  ← Voltar            Pré-visualização                │
│                                                       │
│  ┌──────────────────────┬───────────────────────────┐ │
│  │                      │                           │ │
│  │    Arte Gerada       │   Ajustes Rápidos         │ │
│  │                      │                           │ │
│  │    ┌──────────┐     │   Texto da Chamada         │ │
│  │    │          │     │   [_____________________] │ │
│  │    │ 1080x    │     │                           │ │
│  │    │  1080    │     │   Preço com Desconto       │ │
│  │    │          │     │   [R$ ____________]       │ │
│  │    └──────────┘     │                           │ │
│  │                      │   Badge                   │ │
│  │   [⟳ Regenerar]     │   [V _______________▼]   │ │
│  │                      │                           │ │
│  │                      │   Variações               │ │
│  │                      │   [○] Padrão              │ │
│  │                      │   [○] Sem badge           │ │
│  │                      │   [○] Texto menor         │ │
│  │                      │                           │ │
│  └──────────────────────┴───────────────────────────┘ │
│                                                       │
│              [← Voltar]    [Aprovar e Exportar →]     │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 3. Preview da Arte

### Dimensões
- A arte gerada segue o spec de `CAMPAIGN_VISUAL_SYSTEM.md`
- Desktop: preview em 1080x1080px (escala 1:1 se couber, ou proporcional)
- Mobile: preview em largura total, altura proporcional
- Zoom: hover amplia 1.5x com lupa (opcional V1)

### Fidelidade
- A preview DEVE ser exatamente o que será exportado
- Sem lazy loading, sem compressão adicional na preview
- Cores sRGB, perfil de cor embutido na exportação
- Se a loja tem logo: renderizada exatamente como ficará

### Múltiplas variações
- Thumbnails na lateral ou abaixo (w-24 h-24, rounded-lg, border no selected)
- Cada variação é um layout diferente (posição do texto, badge diferente, etc.)
- Máximo 3 variações por geração (evitar paralisia de decisão)
- Variação atual destacada com border accent-green

---

## 4. Ajustes Rápidos (Campos Guiados)

### O que pode ser ajustado
| Campo | Tipo | Limite |
|-------|------|--------|
| Texto da chamada | Text input | 120 chars |
| Preço com desconto | Currency input | — |
| Preço original | Currency input | — |
| Badge | Dropdown + custom | 20 chars |
| Cor do CTA | Color swatch (3 opções) | verde, azul, cor da marca |

### O que NÃO pode ser ajustado
- ❌ Posição dos elementos (hierarquia definida pelo sistema)
- ❌ Fontes
- ❌ Tamanho da imagem do produto
- ❌ Cor de fundo da arte
- ❌ Layout / grid

**Regra de ouro:** O lojista ajusta o CONTEÚDO, não o DESIGN.

---

## 5. Preview Loading

### Regeneração
- Preview fade-out 200ms → spinner central → fade-in 300ms
- Botão "Regenerar" na lateral direita (secondary outline)
- Durante regeneração: inputs disabled, botão mostra spinner
- Se erro: inline banner "Não foi possível gerar esta variação" + retry

### Primeira carga (vindo do step anterior)
- Skeleton da arte (aspect-ratio 1/1, rounded-xl, shimmer)
- Título "Sua campanha está sendo gerada..."
- Transição suave para a imagem final

---

## 6. Comparação com Input

Toggle "Comparar com dados informados" exibe overlay semitransparente:
- Lado esquerdo: dados do input (produto, preços, chamada)
- Lado direito: arte gerada
- Ajuda o lojista a verificar se os dados estão corretos

---

## 7. Empty / Error States

### Erro de geração
```
┌──────────────────────────────────┐
│  ┌────────────────────────────┐  │
│  │  ⚠️ (lucide: alertTriangle) │  │
│  │                            │  │
│  │  Não foi possível gerar    │  │
│  │  a campanha                │  │
│  │                            │  │
│  │  [Tentar Novamente]        │  │
│  │  [Voltar e Ajustar]        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### Timeout
- Se geração > 30s: exibir mensagem "Está demorando mais que o esperado"
- Manter botão "Continuar esperando" + "Cancelar e tentar de novo"

---

## 8. Aprovação

- Botão "Aprovar e Exportar" só habilitado se:
  - Preview carregada com sucesso
  - Lojista viu a arte (scroll até o final, ou timer de 3s)
  - (Opcional) checkbox "Estou satisfeito com o resultado"
- Ao aprovar: navega para review-export

---

## 9. Mobile Adaptations

- Preview em full width (sem sidebar de ajustes)
- Ajustes collapse abaixo da preview
- Botões fixed bottom
- Swipe horizontal entre variações
- Tap para zoom na preview (fullscreen overlay)
