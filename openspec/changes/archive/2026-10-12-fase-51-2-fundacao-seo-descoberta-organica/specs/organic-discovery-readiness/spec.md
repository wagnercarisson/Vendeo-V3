## ADDED Requirements

### Requirement: Diagnóstico de performance registrado sem alterar a landing

A fatia SHALL registrar um diagnóstico de carregamento e estabilidade visual (por exemplo, elemento candidato a LCP, carregamento de fontes, peso e dimensões das imagens públicas, uso de `lazy`/`eager`) e SHALL registrar recomendações. Esta fatia SHALL NOT implementar mudanças de performance que afetem a landing ou componentes compartilhados; tais mudanças exigem aprovação separada.

#### Scenario: Diagnóstico e recomendações registrados

- **WHEN** o diagnóstico de performance é entregue
- **THEN** ele registra observações de carregamento e estabilidade visual
- **AND** registra recomendações sem alterar a landing

#### Scenario: Mudança de performance exige aprovação separada

- **WHEN** uma mudança de performance afetaria a landing ou componentes compartilhados
- **THEN** ela é exposta para aprovação antes de ser implementada

### Requirement: Baseline do Search Console sem configuração externa

A fatia SHALL documentar o procedimento de coleta de baseline (desempenho, consultas, páginas, países, inspeção da home, sitemap e indexação) conforme acesso e evidência disponíveis. A aplicação SHALL NOT alterar configuração externa, SHALL NOT enviar sitemap e SHALL NOT inventar volumes de busca, resultados ou dados ausentes.

#### Scenario: Baseline coletado conforme evidência disponível

- **WHEN** o baseline é registrado
- **THEN** ele distingue dados efetivamente observados de dados ausentes
- **AND** não apresenta números inventados

#### Scenario: Nenhuma configuração externa ou envio de sitemap

- **WHEN** a implementação e a execução são revisadas
- **THEN** nenhuma configuração do Search Console é alterada
- **AND** nenhum sitemap é enviado sem autorização

### Requirement: Limite de expectativa sobre descoberta orgânica

A fatia SHALL comunicar que a base técnica facilita descoberta, crawling e compreensão, mas SHALL NOT prometer indexação, tráfego ou posição no Google.

#### Scenario: Expectativa limitada e honesta

- **WHEN** os artefatos e a comunicação da fatia são revisados
- **THEN** eles afirmam que indexação, tráfego e posição não são garantidos

### Requirement: Validação e separação entre preparação técnica e ativação pública

A fatia SHALL prever testes de metadata, canonical, sitemap e política de indexação por ambiente e por rota, e SHALL reexecutar os testes relevantes, lint, build e a validação OpenSpec. A exceção preexistente `ssl`/`pg` (F56) SHALL ser tratada como externa: `typecheck` SHALL NOT ser declarado aprovado **enquanto a exceção persistir**, e a F56 SHALL NOT ser corrigida implicitamente. A fatia SHALL separar (a) preparação técnica validada na branch de (b) ativação e validação pública após integração/publicação conjunta com a F56. Resultados reais de indexação e aquisição SHALL NOT ser critérios executáveis antes da publicação.

#### Scenario: Testes de metadata, canonical, sitemap e indexação

- **WHEN** a validação é executada
- **THEN** existem testes para metadata, canonical, sitemap e política de indexação por ambiente e por rota
- **AND** os testes relevantes, lint, build e a validação OpenSpec são reexecutados
- **AND** existe um teste de produção confirmada com **origem inválida** cobrindo os três resultados: metadata `noindex`, `robots.txt` sem referência a sitemap divergente e sitemap sem URLs

#### Scenario: Exceção externa não declarada como aprovada

- **WHEN** o resultado de `typecheck` é registrado
- **THEN** a exceção `ssl`/`pg` (F56), **se ainda persistir**, é registrada como externa
- **AND** `typecheck` não é declarado aprovado enquanto a exceção persistir
- **AND** a F56 não é corrigida implicitamente
- **AND** se a correção da F56 eliminar a exceção, o `typecheck` pode passar a ser declarado aprovado sem tornar esta fatia inconsistente

#### Scenario: Preparação separada da ativação pública

- **WHEN** o status da fatia é reportado
- **THEN** preparação técnica na branch e ativação/validação pública aparecem separadas
- **AND** resultados reais de indexação e aquisição não são exigidos antes da publicação
