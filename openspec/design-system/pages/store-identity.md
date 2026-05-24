# Page Override — Identidade da Loja (V1)

> **Override rules for the Store Identity step.**
> These rules take precedence over `openspec/design-system/MASTER.md` when building this page.
> All non-overridden rules from MASTER.md still apply.

---

## 1. Purpose

Coletar informações mínimas da loja para personalizar a campanha:
- Nome da loja (usado no texto da campanha)
- Segmento/ramo (usado para sugerir paleta visual adequada)
- Logo da loja (opcional — fallback tipográfico se não fornecido)
- Cor da marca (opcional — fallback para cor do segmento)

**Princípio:** Quanto menos campos, melhor. Lojista ocupado quer resposta rápida.

---

## 2. Layout

```
┌──────────────────────────────────────────────────┐
│  ← Voltar           Identidade da Loja           │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  Dados da Loja                               │  │
│  │                                              │  │
│  │  Nome da Loja *                              │  │
│  │  [________________________________________] │  │
│  │                                              │  │
│  │  Segmento *                                  │  │
│  │  [V Selecione o segmento _______________▼]  │  │
│  │                                              │  │
│  │  Logo da Loja                      [opcional]│  │
│  │  [Upload image...]  ou  [Pular]              │  │
│  │  (formatos: PNG, JPG, WebP | max 2MB)        │  │
│  │                                              │  │
│  │  Cor Principal da Marca            [opcional]│  │
│  │  [■ #____]  [paleta rápida abaixo]          │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│         [← Voltar]          [Continuar →]         │
│                                                    │
└──────────────────────────────────────────────────┘
```

---

## 3. Segmentos Disponíveis

| Segmento | Paleta Sugerida | Estilo Visual |
|----------|----------------|---------------|
| Vestuário / Moda | Tons neutros + accent coral | Elegante, clean |
| Alimentação / Restaurante | Vermelhos + dourado | Apetitoso, quente |
| Beleza / Estética | Rosa + lavanda | Suave, luxuoso |
| Saúde / Bem-estar | Verde menta + azul | Fresco, confiável |
| Eletrônicos | Azul elétrico + cinza | Moderno, técnico |
| Casa & Decoração | Terrosos + verde oliva | Aconchegante |
| Serviços | Azul confiança + verde | Profissional |
| Outros | Paleta neutra universal | Limpo, versátil |

**Fallback universal:** quando o lojista não define segmento nem cor, usar paleta neutra escura (#0F172A bg + #22C55E accent).

---

## 4. Logo Upload

### Regras de exibição
- Preview circular (w-16 h-16) ao lado do nome da loja no preview da campanha
- Fallback sem logo: primeiras letras do nome da loja em círculo (bg accent-green, text white, Poppins 700)
- Logomarca renderizada no canto inferior direito da arte final (safe area: 20px das bordas, max 120px largura)

### Validação do upload
- Formatos: PNG, JPG, WebP
- Tamanho máximo: 2MB
- Dimensão mínima: 200x200px (para evitar pixelização na renderização)
- Preview imediato após upload
- Erro: toast + inline message

---

## 5. Cor da Marca

### Seletor de cor
- Input hex com preview colorido ao lado
- Paleta rápida com 6 opções baseadas no segmento selecionado
- Se não preenchido: usar accent-green (#22C55E) como fallback

### Impacto da cor da marca
- Afeta a paleta da campanha gerada (badges, CTAs, detalhes)
- NÃO afeta elementos estruturais (background, texto principal)
- A cor da marca é um ACCENT dentro da peça, não o fundo

---

## 6. Form Behavior

- **Nome da Loja:** required, min 2 chars, max 60 chars
- **Segmento:** required, select dropdown
- **Logo:** optional, drag-and-drop ou clique
- **Cor da Marca:** optional, hex input + preset swatches
- Validação on blur — erros inline abaixo do campo
- Botão "Continuar" disabled até required fields preenchidos
- Botão "Voltar": no V1, primeira tela → desabilitado ou oculto

---

## 7. Empty / Loading States

### Logo não fornecido
```diff
+ Preview da campanha mostra fallback tipográfico (iniciais)
+ Arte final não exibe logo — apenas nome da loja como texto
```

### Carregando upload
- Skeleton circular (w-16 h-16) com shimmer
- Botão disabled "Enviando..."
- Cancelar upload via X button

---

## 8. Mobile Adaptations

- Inputs full-width
- Paleta rápida em scroll horizontal (6 swatches)
- Upload em tela cheia (camera + galeria)
- Botões fixed bottom em mobile
