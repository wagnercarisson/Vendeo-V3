## Why

A primeira etapa do fluxo V1 — Identidade da Loja — é a fundação de toda campanha. Sem nome, segmento e identidade visual do lojista, não é possível gerar peças personalizadas. Atualmente não existe estrutura de dados, API ou UI para capturar e armazenar essas informações. Esta fase estabelece o alicerce técnico mínimo do produto, permitindo que campanhas futuras tenham dados básicos da loja sem depender de upload, paleta ou UI refinada.

## What Changes

- Criar migration versionada para tabela `stores`
- Criar API routes para criar, ler e atualizar dados da loja (Supabase)
- Definir estrutura mínima de dados: nome, segmento, cidade, estado, cor da marca (opcional), logo_url (opcional)
- Implementar fallbacks técnicos de identidade visual: nome da loja como fallback textual quando não houver logo, cor padrão simples por segmento quando não houver cor personalizada
- Garantir que nenhum campo opcional bloqueie a primeira campanha

## Capabilities

### New Capabilities
- `store-identity-foundation`: Estrutura de dados, API e fallbacks técnicos de identidade da loja — base técnica mínima sem UI, upload, storage ou renderização visual

### Modified Capabilities
_(Nenhuma — primeiro ciclo de especificações)_

## Impact

- **Nova tabela**: `stores` no Supabase (schema público) via migration versionada
- **Novas rotas**: `src/app/api/store/` (criar, ler e atualizar dados da loja)
- **Dependências**: `@supabase/supabase-js` (já no stack)
- **Design System**: Referencia `openspec/design-system/pages/store-identity.md` apenas para definição de campos, sem implementar UI agora
- **Fluxo V1**: Fundação de dados para a primeira tela do fluxo linear de 4 etapas
- **Fora de escopo**: upload de logo, bucket Supabase Storage, paleta inteligente por segmento, UI da página store-identity, validação de imagem — serão specs futuras separadas
- **Observação**: Esta spec não cria página, formulário, step navigation, preview visual, seletor de cor ou fluxo de interface. A entrega é apenas a fundação técnica de dados, API e fallbacks para identidade da loja.
