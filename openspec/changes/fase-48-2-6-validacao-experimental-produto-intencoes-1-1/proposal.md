## Why

A F48.2.5 estabilizou o pipeline experimental de Produto + Oferta 1:1, mas a bancada ainda habilita apenas Oferta e não aplica a matriz de compatibilidade de preços em seus contratos server-side. A F48.2.6 habilita Destaque e Exclusivo como políticas versionadas e valida as três intenções manualmente, sem promoção produtiva.

## What Changes

- Enforce a matriz preço × intenção no formulário da bancada, schemas/validações e backend por uma única autoridade pura em `src/lib/lab/bench/domain/`; preservar exports compatíveis de `form-rules.ts` por delegação, exigir nova escolha explícita quando edição de preço invalida a intenção e manter hook/formulário produtivos intocados.
- Habilitar políticas versionadas de Oferta, Destaque e Exclusivo somente para Produto 1:1, com combinações não suportadas fail-closed antes do provider; ajustar intrafase Exclusivo para `48.2.6-exclusivo-v3` com a instrução literal definida no contrato, preservando a evidência v1.
- Validar validade exclusivamente em Oferta na UI e backend; incompatibilidade exige regularização explícita sem descartar validade silenciosamente.
- Serializar o nome em uma única instrução compilada: `Nome obrigatório na arte: {nome}. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.`; remover orientação de nome redundante e versionar Produto como `48.2.6-produto-v4`, preservando a entrada sem correção silenciosa.
- Versionar também a serialização do nome no compositor como `48.2.4-prompt-composer-v5`, distinguindo-a de runs v4; evitar ponto duplicado quando o nome termina em ponto, sem alterar a entrada nem a saída para nomes comuns.
- Para exatamente uma imagem de produto, usar somente “Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.” Para duas ou mais, manter a instrução de protagonismo da primeira e apoio secundário das auxiliares, com a instrução de fidelidade uma única vez.
- Oferecer uma única direção de fundo nas três intenções; `Manter cenário original` exige exatamente uma imagem de produto, sem contar a identidade da loja, e escolha explícita novamente se a contagem invalidar a opção.
- Conduzir UAT manual das três intenções com `gpt-image-2.5-sunburst` em `medium`, registrar evidências/custos/limitações e congelar candidato documental sem promoção.
- Preservar Exclusivo v1 e registrar v1 × v3 como comparação antes × depois, não controlada para isolar o efeito Exclusivo: Produto, compositor e a instrução de fundo também mudaram. Reutilizar dados/imagem se confirmados, manter metadados desconhecidos pendentes e aguardar revisão/autorizações humanas antes de gerar.
- Compilar uma frase curta e específica para a opção de fundo escolhida, mantendo os rótulos curtos no seletor; a versão vigente do compositor é `48.2.4-prompt-composer-v5` após o novo texto compilado do nome.

## Capabilities

### New Capabilities
- `lab-bench-intent-validation`: compatibilidade server/client preço × intenção e invalidação do preflight.
- `lab-bench-intent-uat`: protocolo manual e evidência documental para Oferta, Destaque e Exclusivo em Produto 1:1.

### Modified Capabilities
- `lab-bench-prompt-policy`: políticas versionadas das três intenções e preservação de nome/textos.
- `lab-bench-prompt-base`: ajustes pequenos e reutilizáveis, neutros em relação à intenção.
- `lab-bench-image-roles`: protagonista = primeira imagem enviada, auxiliares secundárias e direção de fundo selecionável.
- `lab-bench-form-parity`: validade permitida somente em Oferta, sem alterar formatos/validações existentes.
- `lab-bench-prompt-preflight`: validade, preço, intenção, direção de fundo e contagem de imagens integram entradas revalidadas antes da execução.
- `lab-generation-bench`: políticas habilitadas, segurança experimental e protocolo UAT manual.

## Impact

Código restrito a `src/lib/lab/bench/**`, componentes/API da bancada e testes de contrato. Reutilizar runs, snapshots, linhagem, preflight e evidências existentes; sem alterações em adapters, transporte, pricing, banco ou produção. Contratos de selos permanecem idênticos às listas/permissões atuais; seleção explícita de “Exclusivo” ou “Edição Limitada” não é invenção do diretor. Validade é exclusiva de Oferta. CHECKPOINT A precede testes pagos; CHECKPOINT B é manual, com confirmação financeira por geração. O executor atualiza tracking não destrutivamente conforme o resultado; somente o responsável executa OpenSpec verify/sync/archive.
