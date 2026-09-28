# Lab Admin UI — delta (F48.2.2)

## ADDED Requirements

### Requirement: Tela da bancada e navegação interna

A administração SHALL expor a bancada em `/admin/laboratorio/bancada` acessível pela navegação interna do laboratório, sem adicionar um segundo link na navegação principal do admin. A bancada SHALL ser desktop-only e SHALL NOT exigir responsividade mobile.

#### Scenario: Bancada é acessível pela navegação interna

- **WHEN** o admin está dentro do laboratório
- **THEN** a navegação interna permite acessar a bancada
- **AND** não há novo link na navegação principal

#### Scenario: Bancada é desktop-only

- **WHEN** a bancada é renderizada
- **THEN** ela não requer layout mobile

### Requirement: Fluxo mínimo da bancada

A tela SHALL oferecer: seleção de loja de teste local; visualização do branding completo; formulário mínimo compatível com campanha de produto/oferta; upload de imagens; editor de prompt manual; formato, modelo e qualidade; dimensões `intenção`, `tipo de conteúdo`, `estrutura` e `tema` travadas no primeiro recorte; estimativa; confirmação explícita; estado de execução; resultado; download; e evidências (prompt, configuração, latência, usage, custo e erro). A tela SHALL NOT oferecer comparação lado a lado nem votação.

#### Scenario: Formulário mínimo é preenchido

- **WHEN** o admin seleciona a loja, envia imagens, escreve o prompt e escolhe formato/modelo/qualidade
- **THEN** a configuração do primeiro recorte é aplicada às demais dimensões
- **AND** a tela não oferece comparação lado a lado nem votação

#### Scenario: Branding completo é exibido

- **WHEN** a loja é selecionada
- **THEN** o branding completo é exibido, incluindo a direção tipográfica

#### Scenario: Estimativa e confirmação antes de gerar

- **WHEN** o admin aciona "Gerar"
- **THEN** a UI exibe a estimativa e exige confirmação explícita
- **AND** quando a cobertura de pricing é parcial, o custo é apresentado como faixa ("a partir de US$ X")
- **AND** quando a cobertura é ausente, o custo é apresentado como "indisponível"

#### Scenario: Resultado, download e evidências

- **WHEN** a geração conclui
- **THEN** o resultado é exibido com download
- **AND** as evidências (prompt, configuração, latência, usage, custo e erro) são exibidas

### Requirement: Estado de ambiente desabilitado

Quando a guarda de ambiente recusar a superfície, a tela da bancada SHALL exibir um estado claro de indisponibilidade com o motivo, sem acessar as tabelas `lab_*`, as tabelas de loja/branding, o storage do laboratório ou os providers.

#### Scenario: Ambiente bloqueado mostra aviso

- **WHEN** a bancada está desabilitada no ambiente atual
- **THEN** a tela exibe um aviso de indisponibilidade com o motivo
- **AND** nenhuma tabela, storage ou provider é acessado

### Requirement: Conformidade com o design system

A tela da bancada SHALL seguir `openspec/design-system/MASTER.md` (dark OLED, Poppins/Open Sans, `lucide-react`, sem emojis e sem light mode) e SHALL usar os primitivos de UI existentes.

#### Scenario: Estilo consistente

- **WHEN** a tela da bancada é renderizada
- **THEN** ela usa os tokens e componentes do design system
- **AND** não introduz emojis, light mode ou ícones fora do `lucide-react`

#### Scenario: Acessibilidade básica

- **WHEN** os formulários e ações são usados
- **THEN** rótulos, foco e mensagens de erro acessíveis são aplicados
