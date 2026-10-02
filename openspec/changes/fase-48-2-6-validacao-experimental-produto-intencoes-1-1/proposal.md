## Why

A F48.2.5 estabilizou o pipeline experimental de Produto + Oferta 1:1, mas a bancada ainda habilita apenas Oferta e não aplica a matriz de compatibilidade de preços em seus contratos server-side. A F48.2.6 habilita Destaque e Exclusivo como políticas versionadas e valida as três intenções manualmente, sem promoção produtiva.

## What Changes

- Enforce a matriz preço × intenção no formulário da bancada, schemas/validações e backend, reaproveitando a regra existente e exigindo nova escolha explícita quando uma edição de preço invalida a intenção atual.
- Habilitar políticas versionadas de Oferta, Destaque e Exclusivo somente para Produto 1:1, com combinações não suportadas fail-closed antes do provider.
- Validar validade exclusivamente em Oferta na UI e backend; incompatibilidade exige regularização explícita sem descartar validade silenciosamente.
- Usar instruções concisas: nome completo sem alterar palavras; descrição opcional adaptável ou omitida preservando significado; informações obrigatórias integrais.
- Usar orientação curta para imagens auxiliares, preservando os contratos técnicos existentes por referência.
- Conduzir UAT manual das três intenções com `gpt-image-2.5-sunburst` em `medium`, registrar evidências/custos/limitações e congelar candidato documental sem promoção.

## Capabilities

### New Capabilities
- `lab-bench-intent-validation`: compatibilidade server/client preço × intenção e invalidação do preflight.
- `lab-bench-intent-uat`: protocolo manual e evidência documental para Oferta, Destaque e Exclusivo em Produto 1:1.

### Modified Capabilities
- `lab-bench-prompt-policy`: políticas versionadas das três intenções e preservação de nome/textos.
- `lab-bench-prompt-base`: ajustes pequenos e reutilizáveis, neutros em relação à intenção.
- `lab-bench-image-roles`: orientação simplificada de auxiliares sem garantia técnica de aparição.
- `lab-bench-form-parity`: validade permitida somente em Oferta, sem alterar formatos/validações existentes.
- `lab-bench-prompt-preflight`: validade, preço e intenção integram entradas comerciais revalidadas antes da execução.
- `lab-generation-bench`: políticas habilitadas, segurança experimental e protocolo UAT manual.

## Impact

Código restrito a `src/lib/lab/bench/**`, componentes/API da bancada e testes de contrato. Reutilizar runs, snapshots, linhagem, preflight e evidências existentes; sem alterações em adapters, transporte, pricing, banco ou produção. Contratos de selos permanecem idênticos às listas/permissões atuais; seleção explícita de “Exclusivo” ou “Edição Limitada” não é invenção do diretor. Validade é exclusiva de Oferta. CHECKPOINT A precede testes pagos; CHECKPOINT B é manual, com confirmação financeira por geração. O executor atualiza tracking não destrutivamente conforme o resultado; somente o responsável executa OpenSpec verify/sync/archive.
