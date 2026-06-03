## Why

A fase 4.4.1 validou o fluxo completo para lojas **com logotipo real**: upload, variantes técnicas, análise IA, brand profile. Porém, lojistas sem logotipo — realidade da maioria dos pequenos lojistas físicos brasileiros — ficam sem identidade visual, dependendo apenas de fallback tipográfico simples. Sem uma assinatura visual profissional e um brand profile inferido do segmento e dados da loja, as campanhas perdem impacto comercial (efeito "UAU") e o diretor de marketing não tem direção visual consistente para gerar artes de alta qualidade.

Esta fase implementa o fluxo completo para lojas sem logo: geração de assinatura visual profissional via IA, inferência de identidade visual (brand profile) a partir de dados cadastrais da loja, aprovação do lojista com até 3 tentativas, e métricas de rastreamento — tudo integrado ao fluxo existente da tela `/store`.

## What Changes

- Botão **Enviar logotipo** explícito no card de upload (além do card clicável)
- Botão **Não tenho logo** com tooltip explicativo sobre geração de assinatura visual + brand profile
- Opção **Continuar sem logo** discreta (sem destaque visual) — continua sem assinatura visual, usando apenas o nome da loja em tipografia simples nas campanhas
- Fluxo de geração de assinatura visual para lojas sem logo (ativa o diretor de identidade visual da loja, não o diretor de campanhas)
- Prompt dedicado `prompts/store-identity-art-director.md` para o diretor de identidade visual — responsável exclusivo por criar assinatura visual da loja
- Prompt dedicado `prompts/store-brand-profiler.md` para inferência de brand profile a partir de dados cadastrais (sem imagem de logo)
- Separação explícita de responsabilidades: o diretor de campanhas **nunca** cria identidade visual do zero; consome apenas a assinatura aprovada e o brand profile persistido
- Modal de aprovação com **Aprovar** e **Não gostei, gerar outra versão** (até 3 versões)
- Re-geração com feedback explícito ao diretor: versão rejeitada, buscar nova direção criativa
- Persistência de brand profile inferido de dados da loja (segmento, tom, posicionamento) — sem logo
- Cores primária e destaque inferidas e preenchidas após aprovação da assinatura (lojista pode alterar)
- Métricas de geração ampliadas: tipo de geração (assinatura, brand profile), tentativa, aprovação/rejeição, asset gerado
- Campos de status para distinguir "escolheu continuar sem logo" vs "falha na geração"
- Prompts existentes de campanha (`campaign-image-director.md`) e de análise de marca com logo real (`store-brand-director-with-logo.md`) não são modificados — o diretor de campanha continua consumindo assinatura aprovada e brand profile; o fluxo com logo real segue usando seu próprio prompt de brand direction

## Capabilities

### New Capabilities
- `store-identity-art-director`: Novo profissional de IA responsável exclusivamente por criar a assinatura visual da loja quando não há logo. Prompt em `prompts/store-identity-art-director.md`. Não mistura com geração de campanha, CTA, produto ou oferta. Recebe dados cadastrais da loja + até 3 tentativas com contexto de rejeição (informando explicitamente que deve buscar nova direção criativa, não variação pequena). Gera assinatura visual limpa e reutilizável + cartão de referência visual em fundo neutro para ajudar o diretor de campanhas a interpretar a identidade.
- `store-brand-profiler-without-logo`: Infere brand profile completo (personalidade visual, tom visual, tom de voz comercial, público provável, segmento/subsegmento percebido, nível de sofisticação, estilo recomendado para campanhas, cores sugeridas, elementos visuais recorrentes, cuidados do que evitar, instruções de uso da assinatura visual nas campanhas). Executado após aprovação da assinatura visual. Consome dados cadastrais da loja (nome, segmento, subsegmento, tom de voz, posicionamento, slogan, descrição curta) **e** os outputs aprovados do diretor de identidade visual: assinatura aprovada, cartão/referência visual (se existir), metadados/descrição criativa, cores sugeridas/extraídas. Não faz análise visual pesada da imagem, mas não é cego à assinatura aprovada. Prompt próprio em `prompts/store-brand-profiler.md`, separado do diretor de campanhas e do diretor de identidade visual.
- `visual-signature-approval`: Modal de aprovação da assinatura visual gerada. Dois caminhos: aprovar (ativa a assinatura + persiste brand profile + retorna à tela /store com preview atualizado e cores inferidas preenchidas) ou rejeitar (feedback ao diretor de identidade visual, nova tentativa, até 3 versões). Rejeição informa explicitamente o diretor para buscar nova direção criativa. Geração sequencial (não 3 de uma vez). Bloqueio na 3ª versão com botão de gerar outra versão inativo.

### Modified Capabilities
- `store-identity-ui`: Adicionar botão "Enviar logotipo" explícito, botão "Não tenho logo" com tooltip, opção "Continuar sem logo" sem destaque. Estado pós-aprovação exibe assinatura no preview e preenche cores inferidas.
- `store-brand-profile`: Novo source `without_logo` — brand profile gerado de dados da loja sem logo. Persiste brand profile mesmo sem asset de logo. Inclui cor primária e destaque inferidos.
- `store-identity-foundation`: Novos campos opcionais para status de escolha de logo (logo_status: uploaded | generated | explicit_none | failed | null). Permitir distinguir "lojista escolheu não ter logo" de "geração falhou".
- `generation-metrics`: Ampliar métricas para cobrir geração de assinatura visual e brand profile sem logo: generation_type, provider, model, duration, estimated_cost, attempt_number, status, error_type, prompt_version, approved, rejected, asset_generated, input_data_hash, has_logo, has_generated_signature, has_brand_profile.

## Impact

- **Database**: Migrations versionadas para `store_brand_profiles` (novo source), `stores` (novos campos opcionais logo_status), possivelmente nova tabela de eventos/métricas
- **API**: Novos endpoints ou modificação nos existentes para geração de brand profile sem logo, geração de assinatura visual com contexto de rejeição
- **UI**: Modificações na tela `/store` (store-identity-form.tsx, store-visual-signature-section.tsx), novo modal de aprovação
- **Prompts**: 
  - Novo `prompts/store-identity-art-director.md` — diretor de identidade visual (cria assinatura visual, sem misturar campanha/produto/oferta)
  - Novo `prompts/store-brand-profiler.md` — inferência de brand profile a partir de dados cadastrais + outputs aprovados do diretor de identidade visual (assinatura, referência visual, metadados criativos, cores sugeridas)
  - Prompts existentes de campanha (`campaign-image-director.md`) e de análise de marca com logo real (`store-brand-director-with-logo.md`) permanecem **inalterados** — o diretor de campanha continua consumindo assinatura aprovada e brand profile; o fluxo com logo real continua usando seu próprio prompt de brand direction
- **AI Pipeline**: Nova rota de geração que não depende de análise de imagem (apenas dados textuais da loja)
- **Storage**: Bucket `visual-signatures` já existe, bucket `store-brand-assets` já existe — sem novos buckets
- **Types**: Novos tipos para VisualSignatureApprovalFlow, BrandProfileWithoutLogo, GenerationMetrics
