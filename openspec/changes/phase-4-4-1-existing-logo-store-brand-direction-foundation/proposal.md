## Why

Lojistas que já possuem logotipo não têm como enviá-lo ao Vendeo, resultando em campanhas sem identidade visual da marca. Sem o logo e as cores reais da loja, as peças geradas parecem genéricas — reduzindo a confiança do lojista em publicar. Esta fase cria a fundação de identidade visual persistida para lojas com logotipo existente, permitindo que o Vendeo aja como um diretor de marketing que conhece a marca do lojista.

## What Changes

- **Upload de logotipo**: Loja com logo existente pode enviar PNG, JPG/JPEG ou WEBP. SVG bloqueado na V3 v1.
- **Validação de formato e tamanho**: Rejeitar SVG e formatos inválidos com mensagem clara: "Formatos aceitos: PNG, JPG ou WEBP." Validar MIME real do arquivo, rejeitar arquivos corrompidos ou com extensão enganosa. Limite máximo de 5MB.
- **Troca de logo com versionamento**: Novo upload substitui o ativo anterior como `archived`, mantendo histórico. Assets antigos nunca são sobrescritos ou apagados fisicamente.
- **Remoção lógica (soft delete)**: Logo pode ser removido via soft delete, assets antigos permanecem arquivados.
- **Geração de versões técnicas**: Criar variantes do logo para uso seguro em campanhas: `original`, `normalized`, `on_light`, `on_dark`, `square_safe`, `horizontal_safe`. Versões que falharem podem ficar com status `failed`.
- **Análise do logo por IA**: Store Brand Director analisa o logo enviado para inferir cores, estilo visual, tom, personalidade de marca.
- **Sugestão de cores**: Cores detectadas do logo são sugeridas como paleta inicial para o lojista.
- **Edição livre de cores**: Lojista pode alterar as cores livremente. Se a cor escolhida divergir da detectada, nenhum modal/alerta é exibido — o sistema entende que a cor do logo não é necessariamente a cor principal da marca.
- **Preservação do logo original**: O diretor de marketing preserva o logo como está. A cor escolhida pelo lojista orienta a campanha como direção/acento visual.
- **O logo nunca é redesenhado, recriado, recolorido ou alterado criativamente**: O Vendeo não modifica o design do logotipo enviado. As versões técnicas são adaptações de canvas/segurança apenas (normalização, fundo claro/escuro, quadrado seguro, horizontal seguro).
- **Nova tabela `store_brand_assets`**: Armazenar/versionar assets de marca (logo original + variantes técnicas) com store_id, asset_type, variant_type, source, parent_asset_id, storage_path, mime_type, dimensões, checksum, version, status, metadata.
- **Nova tabela `store_brand_profiles`**: Armazenar identidade visual inferida com store_id, source, active_logo_asset_id, cores detectadas, cores escolhidas, tokens seguros, estilo visual, tom, direção tipográfica, personalidade, guidelines, brief para campanha, confidence_score.
- **Campos adicionais em `stores`**: Adicionar `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan` para alimentar o diretor de marketing.
- **Prompt exclusivo**: Criar `prompts/store-brand-director-with-logo.md` para leitura/análise do logo e inferência de identidade visual.
- **Integração mínima com campanha**: Campaign pipeline consome brand profile como contexto prioritário (cores finais, logo ativo, brief, guidelines). Quando não houver brand profile ativo, mantém fallback atual por segmento.

## Capabilities

### New Capabilities
- `logo-upload`: Upload, validação (PNG/JPG/WEBP, rejeitar SVG), armazenamento, troca com versionamento e remoção lógica de logotipos da loja
- `logo-technical-variants`: Geração de versões técnicas do logo (normalized, on_light, on_dark, square_safe, horizontal_safe) para uso seguro em diferentes contextos de campanha
- `store-brand-profile`: Criação e gerenciamento de perfis de identidade visual da loja com cores detectadas, cores escolhidas, estilo visual, tom, diretrizes e brief para campanha. Endpoints controlados: gerar perfil (via IA), ler perfil ativo, arquivar/marcar como outdated. Sem CRUD amplo.
- `brand-director-prompt`: Artefato de prompt do Store Brand Director para análise de logo e inferência de identidade visual da loja

### Modified Capabilities
- `store-identity-foundation`: Adicionar colunas `subsegment`, `tone_of_voice`, `positioning`, `short_description`, `slogan` à tabela `stores`; criar tabelas `store_brand_assets` e `store_brand_profiles`; atualizar APIs de store para suportar novos campos
- `store-identity-ui`: Adicionar upload de logo, seletor de cores editável (cores sugeridas vs. escolhidas) e exibição de preview do logo na página de identidade da loja. Não expor variantes técnicas ao lojista — mostrar apenas preview do logo e status simples de processamento.
- `creative-direction-context`: Consumir `store_brand_profiles` ativo para enriquecer o `CreativeBrief` com brand guidelines, brief do diretor de marca e direção visual
- `campaign-visual-renderer`: Utilizar brand profile ativo (cores finais, logo versão adequada, guidelines) como contexto prioritário, mantendo fallback por segmento quando não houver profile. O logo original nunca é redesenhado, recriado, recolorido ou alterado criativamente — apenas versões técnicas seguras são geradas.
- `store-visual-signature`: Ajustar lógica de resolução de identidade da loja para considerar `store_brand_assets` como fonte primária quando logo existe. Nesta fase, não gerar assinatura visual — apenas resolver prioridade (logo > visual signature existente > fallback textual).

## Impact

- **Banco de dados**: 1 migration alterando `stores` (novos campos); 2 novas migrações para `store_brand_assets` e `store_brand_profiles`
- **Storage**: Novo bucket `store-brand-assets` para assets de logo. Organização: `{store_id}/{asset_type}/{variant_type}/{uuid}{ext}`. Assets antigos nunca são sobrescritos — cada upload gera novo registro com versionamento incremental. Variantes técnicas são registros independentes com parent_asset_id apontando para o original.
- **API**: Novos endpoints ou extensão dos existentes para upload/download de logo; endpoints controlados para brand profile (gerar, ler ativo, arquivar/marcar outdated); extensão das APIs de store para novos campos
- **UI**: Página de identidade da loja ganha seção de upload de logo, preview do logo, seletor de cores com sugestões; sem modal de conflito de cor
- **Prompts**: Novo arquivo `prompts/store-brand-director-with-logo.md` para análise de logo e inferência de identidade
- **Integração IA**: Chamada ao Store Brand Director (LLM) para análise do logo e geração de brand profile; processamento de imagem para variantes técnicas
- **Dependências**: Possível necessidade de biblioteca de processamento de imagem (sharp ou similar) para geração de variantes técnicas no backend
