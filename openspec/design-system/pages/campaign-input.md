# Page Override — Dados da Campanha (V1)

> **Override rules for the Campaign Input step.**
> These rules take precedence over `openspec/design-system/MASTER.md` when building this page.
> All non-overridden rules from MASTER.md still apply.

---

## 1. Purpose

Coletar as informações essenciais do produto + oferta para gerar a campanha:

- Nome do produto
- Imagem do produto (obrigatório — é o elemento central da arte)
- Preço original / Preço com desconto
- Descrição da oferta (curta)
- Badge / selo promocional (opcional)

**Princípio:** Máximo de informação com mínimo de atrito. O lojista deve preencher em < 2 minutos.

---

## 2. Layout

```
┌──────────────────────────────────────────────────┐
│  ← Voltar              Dados da Campanha          │
│                                                    │
│  ┌───────────────┬──────────────────────────────┐  │
│  │               │  Dados do Produto             │  │
│  │   Preview     │                               │  │
│  │   da Imagem   │  Nome do Produto *            │  │
│  │               │  [________________________]  │  │
│  │   [Upload]    │                               │  │
│  │               │  Preço Original               │  │
│  │               │  [R$ __________]              │  │
│  │               │                               │  │
│  │               │  Preço com Desconto *         │  │
│  │               │  [R$ __________]              │  │
│  │               │                               │  │
│  │               │  Descrição / Chamada          │  │
│  │               │  [________________________]  │  │
│  │               │  (ex: "20% OFF em todo o       │  │
│  │               │   estoque")                    │  │
│  │               │                               │  │
│  │               │  Badge Promocional [opcional] │  │
│  │               │  [V Selecione _________▼]    │  │
│  │               │                               │  │
│  └───────────────┴──────────────────────────────┘  │
│                                                    │
│         [← Voltar]          [Gerar Campanha →]     │
│                                                    │
└──────────────────────────────────────────────────┘
```

---

## 3. Product Image

### Regras de upload
- **IMPORTÂNCIA:** A imagem do produto é o elemento central da campanha. Deve ocupar ~60% da área da arte final.
- Formatos aceitos: PNG, JPG, WebP
- Tamanho máximo: 5MB
- Resolução mínima: 600x600px
- Recomendado: 1080x1080px (formato quadrado ideal para redes sociais)

### Preview da imagem
- Crop quadrado (1:1) com preview em tempo real
- Ferramentas mínimas: zoom (fill/contain), reposicionar (drag)
- Se imagem for retangular: sugerir "melhor corte" central
- Fallback se não enviar: placeholder "adicione uma foto do produto"

### Tratamento na renderização
- A imagem será posicionada na zona superior da arte (~60% da altura)
- Overlay gradiente sutil na borda inferior para transição com texto
- Modo "cover" mantendo o centro do produto visível
- Se a imagem for muito escura: overlay semitransparente para legibilidade do texto

---

## 4. Price Fields

### Comportamento
- **Preço Original:** opcional. Se preenchido, mostra o preço riscado (tachado) na arte.
- **Preço com Desconto:** obrigatório. Destaque principal na arte.
- Formatação automática: `R$ 49,90` — input com máscara de moeda brasileira
- Se preço original < preço com desconto: validation error inline

### Hierarquia visual na arte final
- Preço com desconto: maior, bold, cor de destaque (accent da marca ou verde)
- Preço original: menor, tachado, cinza, acima do preço com desconto
- Percentual de desconto: calculado automaticamente, exibido como badge verde
  - `20% OFF` aparece como badge no canto superior direito da imagem

---

## 5. Description / Call-to-Action

### Regras
- Máximo 120 caracteres
- Sugestão automática: "Aproveite {produto} com {desconto} na {loja}!"
- Exemplos: "Não fique de fora!", "Estoque limitado", "Aproveite essa oportunidade"
- Preview em tempo real de como o texto fica na arte
- Se vazio: usar descrição genérica "Corra e garanta o seu!"

### Posição na arte
- Abaixo do preço, antes do CTA
- Limite de 2 linhas na arte (ajuste automático de fonte se exceder)
- Alinhamento centralizado

---

## 6. Badge / Selo Promocional

### Opções disponíveis
| Badge | Quando usar |
|-------|-------------|
| LANÇAMENTO | Produto novo |
| OFERTA LIMITADA | Estoque ou prazo curto |
| FRETE GRÁTIS | Quando aplicável |
| 2 POR 1 | Promoção de quantidade |
| ÚLTIMAS UNIDADES | Escassez |
| (custom) | Se o lojista quiser digitar |

### Regras visuais
- Máximo 20 caracteres para badge customizado
- Posição: canto superior esquerdo da imagem
- Fundo: accent-green (#22C55E) ou cor da marca do lojista
- Texto: white, Poppins 700, texto diminuto
- Cantos arredondados (rounded-lg)

---

## 7. Product Name

- Máximo 60 caracteres
- Obrigatório
- Será exibido na zona inferior da arte (principal heading visual)
- Poppins 700, cor primary, alinhamento centralizado
- Se nome for muito longo (>40 chars): reduzir font-size na renderização

---

## 8. Form Behavior

- **Nome do Produto:** required, max 60 chars
- **Imagem:** required, validação de formato + tamanho
- **Preço com Desconto:** required, máscara monetária
- **Preço Original:** optional, se menor que desconto → erro
- **Descrição:** optional, max 120 chars, counter
- **Badge:** optional, dropdown + custom input
- "Gerar Campanha" disabled até todos required preenchidos
- Botão "Gerar Campanha" → estado loading + "Gerando sua campanha..."

---

## 9. Loading State

```
┌──────────────────────────────────────────────────┐
│  [← Voltar]      Gerando sua campanha...         │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │                                              │  │
│  │       [spinner animado central]              │  │
│  │                                              │  │
│  │   Estamos criando sua arte                   │  │
│  │   profissional com IA...                     │  │
│  │                                              │  │
│  │   ████████████░░░░░░░░  65%                  │  │
│  │                                              │  │
│  │      (progress bar simulada)                 │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
└──────────────────────────────────────────────────┘
```

- A imagem preview gerada deve aparecer gradualmente (fade-in 500ms)
- Se erro na geração: exibir mensagem clara + botão "Tentar novamente"
- Loading não deve travar a UI — botão Voltar permanece clicável

---

## 10. Mobile Adaptations

- Preview lateral move para cima (imagem primeiro, form abaixo)
- Upload otimizado para câmera do celular
- Input price com teclado numérico
- Botões fixed bottom
- Upload de imagem: bottom sheet com opções câmera/galeria
