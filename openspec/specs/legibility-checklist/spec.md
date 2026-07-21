# Legibilidade da Peça Gerada

> Synced from `fase-29-refinamento-visual-uat-launch-readiness` (ADDED).

## Purpose

Checklist de 10 critérios para auditoria visual de peças geradas durante UAT/revisão, garantindo que a peça seja publicável para um lojista não técnico — não apenas "renderizada corretamente".

## Requirements

### Requirement: Checklist de legibilidade com 10 critérios

O sistema SHALL documentar e verificar 10 critérios de legibilidade durante a auditoria visual pré-UAT, através do `LEGIBILITY_CHECKLIST` exportado como constante.

#### Scenario: Lista de critérios documentada

- **WHEN** a auditoria visual é realizada
- **THEN** os seguintes 10 critérios são verificados:
  1. Contraste mínimo (texto sobre fundo — WCAG AA)
  2. Preço como elemento principal (hierarquia visual)
  3. Texto dentro das margens de segurança (safe zones)
  4. CTA visual como elemento da campanha (não botão interativo da UI)
  5. Produto principal inteiro visível (sem corte indevido)
  6. Nenhum emoji na arte final

### Requirement: Contraste mínimo WCAG AA

A peça gerada SHALL ter contraste mínimo entre texto e fundo, conforme WCAG AA.

#### Scenario: Texto escuro sobre fundo escuro revisado

- **WHEN** uma peça gerada é auditada
- **THEN** o contraste entre texto e fundo atende a relação mínima de 4.5:1 para texto normal (WCAG AA)

### Requirement: Hierarquia visual — preço como elemento principal

A peça gerada SHALL ter o preço ou oferta como elemento visual mais destacado.

#### Scenario: Preço é o elemento visualmente principal

- **WHEN** uma peça gerada é auditada
- **THEN** o preço ou valor da oferta é visualmente o elemento mais destacado (maior, em posição de destaque, com contraste adequado)

#### Scenario: Promoção destacada

- **WHEN** a campanha tem promoção (ex: "Leve 2 pague 1")
- **THEN** a promoção é visualmente destacada e de leitura imediata

### Requirement: Safe zones respeitadas

O texto da peça SHALL estar dentro das margens de segurança definidas, fora da borda de corte de impressão/recorte.

#### Scenario: Texto não ultrapassa safe zone

- **WHEN** uma peça gerada é auditada
- **THEN** todo o texto está dentro das margens de segurança (distância mínima da borda definida no CAMPAIGN_VISUAL_SYSTEM)

### Requirement: CTA visual como elemento da campanha

O CTA visual (ex: "Compre agora") SHALL ser elemento da arte da campanha, não um botão interativo da interface de preview.

#### Scenario: "Compre agora" é parte da imagem

- **WHEN** a peça gerada tem um CTA visual
- **THEN** o CTA é renderizado como elemento visual da campanha (parte da imagem 1080x1080), não como botão HTML interativo

### Requirement: Produto principal inteiro visível

O produto principal da campanha SHALL estar completamente visível, sem cortes indevidos.

#### Scenario: Produto não cortado

- **WHEN** a peça gerada é auditada
- **THEN** o produto principal está inteiramente visível dentro da área da imagem, sem cortes nas bordas

### Requirement: Sem emojis na arte final

A peça gerada SHALL conter zero emojis na arte final renderizada.

#### Scenario: Nenhum emoji na imagem final

- **WHEN** a peça gerada é auditada
- **THEN** não há emojis na imagem final 1080x1080 (ícones devem usar elementos gráficos vetoriais se necessário)

### Requirement: CTA visual não domina a composição

O CTA visual ("Compre agora" e similares) SHALL ter tamanho e destaque proporcionais, sem dominar a composição nem ultrapassar a largura máxima aprovada no design system.

#### Scenario: CTA visual dentro dos limites

- **WHEN** a peça gerada tem CTA visual
- **THEN** o CTA não excede a largura máxima definida (CAMPAIGN_VISUAL_SYSTEM) e não ocupa mais que 25% da altura total da composição

### Requirement: Produto longo com regra de redução/ellipsis

Quando o nome do produto excede a largura da safe zone, o sistema SHALL aplicar redução coerente com o design system (ellipsis ou redução proporcional de font-size).

#### Scenario: Nome longo reduzido sem corte brusco

- **WHEN** o nome do produto excede a largura disponível na safe zone
- **THEN** o sistema aplica ellipsis ou redução proporcional de font-size conforme regra do design system
- **AND** o texto não é cortado bruscamente nem sobreposto a outros elementos

### Requirement: Estado sem imagem tratado como erro explícito

Quando a campanha não tem imagem de produto, o sistema SHALL exibir erro explícito (não placeholder decorativo que simule uma imagem).

#### Scenario: Ausência de imagem gera erro, não placeholder

- **WHEN** a campanha não tem imagem de produto para renderizar
- **THEN** o sistema exibe estado de erro informando que a imagem é necessária
- **AND** não renderiza placeholder decorativo (gradiente, cor sólida simulando imagem)

### Requirement: Preview e export visualmente equivalentes

Quando o renderer é usado para export, a prévia (preview) e o export SHALL ser visualmente equivalentes — mesma composição, mesmas regras de layout, mesmo tratamento de texto e imagem.

#### Scenario: Preview e export idênticos

- **WHEN** o mesmo renderer é usado para preview e export
- **THEN** a composição visual (posicionamento, proporções, cores, tipografia) é idêntica em ambos
- **AND** diferenças aceitas são apenas de resolução/qualidade de imagem (não de layout)
