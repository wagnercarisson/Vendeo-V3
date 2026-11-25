# Product 1:1 Prompt Composition

## Purpose

Specify deterministic, versioned production prompt composition for the Product 1:1 campaign flow.

## Requirements

### Requirement: Incorporação versionada e congelada dos prompts e regras aprovados

O novo fluxo SHALL compor o prompt por um **módulo produtivo próprio** que incorpora os prompts/regras aprovados na bancada F48.2.6 na forma do **baseline aprovado do laboratório** (quick 261009-u3h, aprovado pelo responsável em 2026-10-11), posteriormente reconciliado pelo **baseline de produção** (quick 261017-cdi, aprovado pelo responsável em 2026-10-17) — Produto v4, compositor v7, Oferta v2, Destaque v2, Exclusivo v4 e direção de fundo versionada (`policyVersions.fundo` v2) — com versões fixadas e registráveis. O módulo SHALL NOT ler configuração mutável da bancada em tempo de execução.

#### Scenario: Prompt vem de versão fixada

- **WHEN** uma composição é produzida
- **THEN** ela usa as versões fixadas de compositor, base de prompt e políticas
- **AND** nenhuma configuração mutável da bancada altera o resultado em runtime

#### Scenario: Versões registráveis no snapshot

- **WHEN** a composição é associada a uma campanha
- **THEN** as versões de compositor, base de prompt e políticas ficam disponíveis para registro
- **AND** a versão registrada corresponde à usada

### Requirement: Conteúdo obrigatório do prompt

A composição SHALL preservar os contratos aprovados: nome completo com palavras, números e unidades; fidelidade às referências; primeira imagem/variante protagonista e auxiliares secundárias; identidade fiel; textos obrigatórios uma única vez; matriz comercial por intenção; e a direção de fundo escolhida.

#### Scenario: Nome completo e fidelidade

- **WHEN** o produto possui nome com palavras, números e unidades
- **THEN** a composição instrui o nome completo como informado
- **AND** instrui fidelidade às referências de produto

#### Scenario: Hierarquia das referências

- **WHEN** existem múltiplas imagens de produto
- **THEN** a composição trata a primeira como protagonista
- **AND** trata as demais como auxiliares secundárias

#### Scenario: Textos obrigatórios uma única vez

- **WHEN** há textos obrigatórios informados
- **THEN** cada texto obrigatório aparece uma única vez
- **AND** não é duplicado

#### Scenario: Matriz comercial por intenção

- **WHEN** a intenção é Oferta, Destaque ou Exclusivo
- **THEN** a matriz comercial aplicada corresponde à intenção selecionada
- **AND** preços/original são tratados conforme a intenção

### Requirement: Identidade da loja e fundos recriados

A composição SHALL transportar a **paleta canônica resolvida** da loja **uma única vez**, no bloco `[IDENTIDADE E DIREÇÃO VISUAL]`, com **precedência documentada** das fontes, alinhada ao que a tela apresenta ao lojista — principal: `brand_colors_chosen[0]` → `safe_color_tokens.primary` → `brand_color`; acento: `brand_colors_chosen[1]` → `safe_color_tokens.accent`. A versão das regras de identidade SHALL ser registrada na evidência (`policyVersions.identidade`). A composição SHALL reconciliar a regra de presença/ausência de identidade (logo/assinatura) sem enfraquecer a paleta. Sem fonte válida, a composição SHALL enviar orientação **neutra** explícita **somente** em fundos recriados (nunca em `original`), sem inventar cores.

Nos fundos **recriados** (estúdio/ambientado), o fundo SHALL priorizar a paleta da loja e garantir contraste/separação visual do produto; SHALL ser emitida **uma única vez** uma orientação comum de contraste. A direção `original` SHALL permanecer sem imposição de paleta.

Quando o estado de identidade é `visual_signature` **e** o ativo está efetivamente disponível após validação/conversão para `data URL`, o bloco `[IDENTIDADE E DIREÇÃO VISUAL]` SHALL **substituir** a instrução de identidade pela redação oficial aprovada, com o nome da loja resolvido no servidor interpolado (sem placeholder), emitida **uma única vez**, sem manter a instrução antiga nem "Não adicionar logotipo.", preservando a paleta e as demais instruções. Títulos promocionais que contenham o nome da loja SHALL NOT substituir a assinatura. Para `logo` e assinatura **sem** arquivo disponível, o texto reconciliado atual SHALL ser preservado. A versão das regras de identidade SHALL avançar de forma coerente (`48.2.6-identity-context-v3`) e permanecer registrada em `policyVersions.identidade`.

No 1:1 novo, quando o estado é `text_only`, o nome da loja está resolvido (não vazio) e o opt-in do fluxo 1:1 está ativo (`textOnlyInstitutionalIdentity === true`), o bloco `[IDENTIDADE E DIREÇÃO VISUAL]` SHALL **substituir** a instrução de identidade pela redação oficial de identificação institucional em texto, com o nome interpolado no servidor (sem placeholder) e emitida **uma única vez**. A redação SHALL exigir o nome como identificação institucional legível, SHALL declarar que títulos promocionais — mesmo contendo o nome da loja — não substituem essa identificação e SHALL proibir inventar ou acrescentar logotipo, símbolo ou assinatura gráfica. Quando houver `typography_direction` persistido não vazio no perfil sincronizado selecionado, a orientação SHALL ser transportada **verbatim** (apenas `trim` e pontuação final idempotente; sem tradução, inferência ou fonte genérica) em linha própria; orientação ausente, vazia ou só com espaços SHALL omitir a linha tipográfica sem remover a exigência do nome. A instrução independe da paleta e SHALL NOT ser aplicada ao joint 1:1+9:16, ao 9:16 isolado, ao legado, ao Laboratório, a `logo`/`visual_signature` nem a assinatura sem arquivo disponível.

#### Scenario: Paleta uma única vez, com precedência

- **WHEN** a loja possui paleta resolvida (perfil ou `brand_color`)
- **THEN** a paleta aparece uma única vez no bloco de identidade
- **AND** a precedência das fontes é determinística e documentada

#### Scenario: Sem paleta ⇒ orientação neutra somente em fundos recriados

- **WHEN** a loja não possui paleta de cores resolvida
- **THEN** a composição orienta uma direção neutra explícita apenas em estúdio/ambientado
- **AND** nenhuma cor da loja é inventada e `original` não recebe a orientação neutra

#### Scenario: Fundos recriados priorizam a identidade

- **WHEN** a direção de fundo é estúdio ou ambientado
- **THEN** o fundo deriva da paleta da loja e a orientação comum de contraste é emitida uma única vez
- **AND** a embalagem, a oferta e a direção escolhida permanecem preservadas

#### Scenario: Original sem imposição de paleta

- **WHEN** a direção é original
- **THEN** a instrução de fundo permanece inalterada
- **AND** nenhuma orientação de contraste é acrescentada

#### Scenario: Assinatura visual com arquivo disponível ⇒ instrução explícita

- **WHEN** o estado é `visual_signature` e o arquivo está disponível após validação/conversão
- **THEN** o bloco de identidade emite a redação aprovada com o nome da loja interpolado, uma única vez, sem a instrução antiga
- **AND** a paleta e as demais instruções permanecem preservadas
- **AND** o título promocional não substitui a assinatura

#### Scenario: Instrução de assinatura independe da paleta

- **WHEN** há ou não paleta resolvida para a loja
- **THEN** a instrução de assinatura é a mesma
- **AND** a paleta ou a orientação neutra segue a regra existente

#### Scenario: Sem arquivo ou outros estados ⇒ comportamento preservado

- **WHEN** o estado é `logo` ou `visual_signature` sem arquivo disponível
- **THEN** o texto reconciliado anterior permanece
- **AND** a instrução explícita de assinatura não é emitida

#### Scenario: Identificação institucional em texto com tipografia persistida

- **WHEN** o 1:1 novo está em `text_only` com nome resolvido e `typography_direction` não vazio
- **THEN** a instrução pede o nome da loja como identificação institucional legível, uma única vez
- **AND** a orientação tipográfica persistida é transportada verbatim em linha própria
- **AND** títulos promocionais não substituem a identificação e nenhum logo/símbolo/assinatura é inventado
- **AND** a paleta e as demais instruções permanecem preservadas

#### Scenario: Identificação institucional sem tipografia

- **WHEN** o 1:1 novo está em `text_only` com nome resolvido e `typography_direction` ausente, vazio ou só com espaços
- **THEN** a instrução de identificação institucional é emitida uma única vez
- **AND** nenhuma linha tipográfica é acrescentada ou inventada

#### Scenario: Identificação institucional independe da paleta

- **WHEN** há ou não paleta resolvida para a loja
- **THEN** a instrução de identificação institucional e a orientação tipográfica são as mesmas
- **AND** a paleta ou a orientação neutra segue a regra existente

#### Scenario: Título promocional com o nome da loja

- **WHEN** o título/oferta contém o nome da loja
- **THEN** a identificação institucional permanece exigida
- **AND** o título não é aceito como substituto

#### Scenario: Fundo recriado sem citar logo ou assinatura

- **WHEN** o 1:1 novo está em `text_only` e o fundo é estúdio ou ambientado
- **THEN** a orientação comum de contraste não cita logo nem assinatura
- **AND** a direção de fundo e a paleta permanecem conforme a regra existente

#### Scenario: Formatos, estados e legado preservados

- **WHEN** a geração é joint 1:1+9:16, 9:16 isolado, legado, Laboratório, `logo`, `visual_signature` ou assinatura sem arquivo
- **THEN** a instrução de identificação institucional em texto não é aplicada
- **AND** o comportamento anterior é preservado

### Requirement: Separação entre referências de produto e imagem de identidade

A composição SHALL contar apenas imagens de **produto** para a hierarquia de múltiplas imagens. A imagem de identidade (logo/assinatura) SHALL NOT contar como imagem de produto nem disparar a instrução de múltiplas imagens; referências adicionais legítimas de produto continuam contando.

#### Scenario: Identidade não dispara múltiplas imagens

- **WHEN** há uma imagem de produto e uma imagem de identidade
- **THEN** a composição trata o caso como imagem única de produto
- **AND** a hierarquia de múltiplas imagens não é emitida

#### Scenario: Referências de produto adicionais continuam contando

- **WHEN** há mais de uma imagem de produto
- **THEN** a composição trata a primeira como protagonista e as demais como auxiliares
- **AND** a imagem de identidade permanece fora da contagem

### Requirement: Preço zero/ausente é ausência (nunca gratuidade)

A composição SHALL omitir preço, moeda, etiqueta de preço e comparação "de/por" quando o preço for **ausente ou zero**. Preço **positivo** informado SHALL ser preservado conforme o contrato. **Oferta** SHALL exigir preço promocional positivo, revalidado **server-side antes de qualquer efeito** (reserva de crédito ou geração), sem aceitar ausente/zero. Valores **negativos, não-inteiros, de tipo inválido ou `null`** SHALL ser **recusados** pela validação da API — nunca convertidos silenciosamente em ausência.

#### Scenario: Destaque sem preço ou zero

- **WHEN** a intenção é Destaque e o preço é ausente ou zero
- **THEN** nem o briefing congelado nem os prompts de imagem/copy carregam valor monetário
- **AND** zero NÃO é interpretado como gratuidade

#### Scenario: Destaque com preço positivo

- **WHEN** um preço positivo é informado
- **THEN** o valor é preservado conforme o contrato

#### Scenario: Oferta sem preço promocional positivo é recusada

- **WHEN** a intenção é Oferta e o preço promocional é ausente/zero
- **THEN** a geração é recusada como erro de campo ANTES de reservar crédito ou iniciar geração
- **AND** nenhuma reserva/geração é efetivada

#### Scenario: Valores malformados são recusados

- **WHEN** o preço é negativo, fracionário, de tipo inválido ou `null`
- **THEN** a validação da API recusa a requisição
- **AND** o valor NÃO é convertido silenciosamente em ausência

### Requirement: Sem troca silenciosa da intenção

A composição SHALL NOT alterar silenciosamente a intenção escolhida.

#### Scenario: Intenção não é trocada

- **WHEN** a composição é produzida
- **THEN** a intenção usada é exatamente a selecionada
- **AND** nenhum fallback de intenção ocorre sem ação explícita

### Requirement: Equivalência com o baseline aprovado da bancada

O módulo produtivo SHALL ser validado por **testes de equivalência** contra um **baseline aprovado congelado** da bancada F48.2.6 (fixture imutável das nove combinações: 3 intenções × 3 direções de fundo), sem depender da bancada mutável em tempo de execução. A atualização do baseline SHALL ser um ato explícito e rastreável — preservando o baseline anterior e sua origem — e SHALL NOT copiar mudanças experimentais não aprovadas da bancada.

#### Scenario: Equivalência nos casos representativos

- **WHEN** a composição produtiva é comparada com o baseline aprovado congelado nos casos representativos (as nove combinações)
- **THEN** os resultados são equivalentes em texto, blocos e versões
- **AND** o baseline preserva o registro do baseline anterior e sua origem
- **AND** as políticas da bancada não são dependência de runtime do fluxo produtivo

### Requirement: Bancada não é dependência de runtime

A bancada F48.2.6 SHALL NOT ser dependência de execução do novo fluxo; o módulo produtivo SHALL ser autônomo em runtime.

#### Scenario: Runtime sem dependência da bancada

- **WHEN** o novo fluxo compõe um prompt em runtime
- **THEN** ele não consulta artefatos mutáveis da bancada
- **AND** a composição é determinística a partir das versões fixadas
