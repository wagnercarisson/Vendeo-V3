export const LEGIBILITY_CHECKLIST = [
  {
    id: "contrast",
    label: "Contraste mínimo (WCAG AA)",
    description: "Relação de contraste mínimo de 4.5:1 para texto normal sobre fundo"
  },
  {
    id: "hierarchy",
    label: "Preço como elemento principal",
    description: "Preço ou oferta é visualmente o elemento mais destacado (maior, posição de destaque)"
  },
  {
    id: "safe-zones",
    label: "Texto dentro das margens de segurança",
    description: "Todo o texto está dentro das safe zones definidas no CAMPAIGN_VISUAL_SYSTEM"
  },
  {
    id: "cta-visual",
    label: "CTA visual como elemento da campanha",
    description: "CTA ('Compre agora') é renderizado como elemento visual da imagem, não botão HTML"
  },
  {
    id: "product-visible",
    label: "Produto principal inteiro visível",
    description: "Produto não cortado nas bordas da imagem"
  },
  {
    id: "no-emojis",
    label: "Sem emojis na arte final",
    description: "Zero emojis na imagem 1080x1080 renderizada"
  },
  {
    id: "cta-proportion",
    label: "CTA visual não domina composição",
    description: "CTA não excede largura máxima nem ocupa mais que 25% da altura total"
  },
  {
    id: "long-product",
    label: "Produto longo com redução/ellipsis",
    description: "Nome longo reduzido com ellipsis ou font-size proporcional, sem corte brusco"
  },
  {
    id: "no-image-state",
    label: "Estado sem imagem tratado como erro",
    description: "Ausência de imagem de produto gera erro explícito, não placeholder decorativo"
  },
  {
    id: "preview-export-equivalence",
    label: "Preview e export equivalentes",
    description: "Preview e export são visualmente equivalentes (mesma composição, layout, tratamento)"
  }
];
