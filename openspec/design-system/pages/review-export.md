# Page Override — Revisão & Exportação (V1)

> **Override rules for the Review & Export step.**
> These rules take precedence over `openspec/design-system/MASTER.md` when building this page.
> All non-overridden rules from MASTER.md still apply.

---

## 1. Purpose

Última etapa antes da campanha estar pronta. O lojista deve:

- Ver o resumo completo da campanha
- Fazer ajustes de último minuto (volta ao step anterior)
- Baixar a arte em formatos adequados para redes sociais
- Copiar sugestão de texto para legenda
- (Futuro) Publicar diretamente

**Princípio:** Celebrar a finalização. A campanha está PRONTA para publicar.

---

## 2. Layout

```
┌──────────────────────────────────────────────────────┐
│                        🎉 Pronto!                     │
│            Sua campanha está publicável              │
│                                                       │
│  ┌──────────────────────┬───────────────────────────┐ │
│  │                      │                           │ │
│  │    Arte Final        │   Resumo da Campanha      │ │
│  │                      │                           │ │
│  │    ┌──────────┐     │   Loja: Minha Loja        │ │
│  │    │          │     │   Produto: Tênis X         │ │
│  │    │ 1080x    │     │   Preço: R$ 49,90          │ │
│  │    │  1080    │     │   Badge: OFERTA LIMITADA   │ │
│  │    │          │     │   Formato: Quadrado (1:1)  │ │
│  │    └──────────┘     │                           │ │
│  │                      │   ➡️ Sugestão de Legenda  │ │
│  │                      │   ┌─────────────────────┐ │ │
│  │                      │   │ "Aproveite o Tênis  │ │ │
│  │                      │   │ X com 20% OFF na    │ │ │
│  │                      │   │ Minha Loja! Corre   │ │ │
│  │                      │   │ que é por tempo     │ │ │
│  │                      │   │ limitado 🏃"        │ │ │
│  │                      │   └─────────────────────┘ │ │
│  │                      │   [📋 Copiar legenda]    │ │
│  │                      │                           │ │
│  └──────────────────────┴───────────────────────────┘ │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │  Formatos de Exportação                          │ │
│  │                                                  │ │
│  │  [📷 Baixar PNG]   [📐 Baixar JPG]              │ │
│  │                                                  │ │
│  │  Tamanho: 1080x1080px  |  Modo: Cor sRGB        │ │
│  │                                                  │ │
│  │  🎯 Instagram • Facebook • WhatsApp              │ │
│  │                                                  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│         [← Voltar e Ajustar]   [Nova Campanha →]     │
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## 3. Resumo da Campanha

### Cards de informação
- Grid 2x2 ou 4 cards em linha
- Cada card: icon (lucide) + label + valor
- Fundo: card padrão (bg-surface, border)

### Sugestão de Legenda
- Texto gerado automaticamente com IA
- Inclui: nome do produto, preço, desconto, badge, nome da loja
- Hashtags relevantes (#Promoção, #Oferta, #[segmento], #[cidade])
- Botão "Copiar legenda" → copia para clipboard + toast "Copiado!"
- Limite: 300 caracteres (limite do Instagram)
- Se o lojista quiser editar: campo editável inline

---

## 4. Download / Exportação

### Formatos disponíveis (V1)
| Formato | Uso | Qualidade |
|---------|-----|-----------|
| PNG | Instagram, Facebook, WhatsApp | Lossless, sRGB |
| JPG | Sites, catálogos | 95% quality |

### Ações de exportação
- **Download direto:** cada formato é um botão separado
- Progresso: instantâneo (a arte já está gerada em memória)
- Toast de confirmação após download: "Arte salva!"
- Nome do arquivo: `{loja}-{produto}-campanha.png`
  - Slug automático, sem acentos ou espaços
  - Exemplo: `minha-loja-tenis-x-campanha.png`

### Metadados embutidos
- Perfil de cor: sRGB IEC61966-2.1
- DPI: 72 (padrão web)
- (Opcional) metadados EXIF com nome da loja

---

## 5. Call to Action Pós-Exportação

### Botões
| Botão | Ação |
|-------|------|
| ⬇️ Baixar PNG | Download em PNG |
| ⬇️ Baixar JPG | Download em JPG |
| 📋 Copiar Legenda | Copia texto para clipboard |
| 🔄 Nova Campanha | Reinicia o fluxo (limpa tudo) |
| ← Voltar | Volta para preview com ajustes |

### Estado "Tudo pronto"
- Botão "Nova Campanha" é CTA secundário
- Mensagem positiva: "Sua campanha foi gerada com sucesso!"
- (Futuro) Botão "Publicar no Instagram" integrado

---

## 6. Empty / Error States

### Falha no download
- Toast: "Não foi possível baixar. Tente novamente."
- Se falha persistir: link direto para baixar em nova aba

### Retorno para ajustes
- "Voltar e Ajustar" → retorna para campaign-preview com dados preservados
- Dados do formulário NÃO são perdidos ao navegar

---

## 7. O que NÃO está na V1

| Funcionalidade | Status |
|----------------|--------|
| Publicação direta no Instagram | Futuro |
| Agendamento de post | Futuro |
| Múltiplos formatos (story, feed, landscape) | Futuro |
| Histórico de campanhas | Futuro |
| Compartilhar link | Futuro |

---

## 8. Mobile Adaptations

- Resumo em single column
- Arte final em destaque (topo)
- Botões de download empilhados
- Legenda editável inline
- Confetti/sucesso animation sutil (se motion permitido)
