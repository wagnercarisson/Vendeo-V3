## MODIFIED Requirements

### Requirement: Metadata da home aprovada sem alterar o conteúdo visível

A home SHALL usar o título `Vendeo | Crie campanhas para redes sociais com IA` e a descrição `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`. A aplicação SHALL NOT alterar o H1 aprovado (`O que seu negócio quer divulgar vira uma campanha pronta para publicar.`) nem o conteúdo visível da landing para atender à metadata.

O rodapé da home SHALL poder ser renderizado pelo componente público compartilhado, agrupando `Floriculturas` (`/floriculturas`), `Padarias` (`/padarias`) e `Campanhas sem complicação` (`/campanhas-para-sua-loja`) sob “Explore o Vendeo”. A composição SHALL preservar os demais links e o aviso legal existentes. A alteração SHALL NOT criar bloco de conteúdo, alterar a ordem dos blocos, substituir imagens, alterar CTAs ou reescrever textos existentes. Nenhum destino do rodapé SHALL controlar sitemap, robots, canonical ou a política fail-closed.

#### Scenario: Título e descrição exatos

- **WHEN** a metadata da home é gerada
- **THEN** o título é `Vendeo | Crie campanhas para redes sociais com IA`
- **AND** a descrição é `Crie campanhas para redes sociais sem precisar saber design ou marketing. Arte e texto com a identidade da sua loja, prontos para revisar, baixar e publicar.`

#### Scenario: Conteúdo visível preservado

- **WHEN** a implementação é revisada
- **THEN** o H1 permanece "O que seu negócio quer divulgar vira uma campanha pronta para publicar."
- **AND** nenhum texto visível, layout, campanha, logo ou CTA da landing é alterado fora do rodapé
- **AND** os links `Floriculturas`, `Padarias` e `Campanhas sem complicação` permanecem no rodapé, agora agrupados sob “Explore o Vendeo”
- **AND** Termos, Privacidade, Uso Aceitável, Novidades, Contato, Entrar e o aviso legal permanecem disponíveis

#### Scenario: Indexação não é afetada pela navegação

- **WHEN** sitemap, robots e canonical são inspecionados
- **THEN** a lista de navegação do rodapé não é usada como fonte
- **AND** somente `/`, `/floriculturas`, `/padarias` e `/campanhas-para-sua-loja` permanecem como exceções indexáveis sob a condição combinada já existente
- **AND** os contratos fail-closed permanecem inalterados
