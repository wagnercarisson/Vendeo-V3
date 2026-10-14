**Esboço De Alinhamento F44**

## Propósito

Temas permitem ao lojista criar uma direção visual reutilizável para uma ocasião ou ação comercial, como Natal, Sexta do Açougue ou aniversário da loja.

O Tema deve:

- alinhar a ocasião à identidade da loja;
- criar reconhecimento visual entre campanhas relacionadas;
- preservar produto, oferta, preço, marca e demais fatos;
- orientar a criatividade do Diretor de Arte, sem definir todo o layout;
- funcionar tanto como presença marcante quanto como ambientação sutil.

Tema não é template, campanha, marca paralela ou coleção de regras rígidas.

## Entrega Ao Lojista

1. O lojista informa nome, ocasião, período, objetivo e poucos dados opcionais.
2. Escolhe a presença temática: marcada, equilibrada, sutil ou decisão da IA.
3. A IA gera uma direção visual coerente com a loja e com a ocasião.
4. O lojista revisa e aprova essa direção em uma interface estruturada.
5. O Tema fica disponível no formulário de campanhas.
6. As campanhas usam um snapshot congelado do Tema.
7. Campanhas do mesmo Tema devem formar uma família visual reconhecível.

## Princípios

- **Marca primeiro:** Tema complementa a loja; nunca substitui logo, assinatura visual ou identidade textual.
- **Identidade própria:** alinhamento com a marca não significa copiar automaticamente suas cores, fontes ou formas.
- **Direção, não layout:** Tema define linguagem, atmosfera, tipografia, cores auxiliares e identidade temática; o Diretor decide composição e distribuição.
- **Poucas invariantes:** somente fatos, ativos oficiais e elementos realmente necessários à identificação.
- **Liberdade controlada:** proteger o que pertence ao lojista sem limitar a criatividade geral.
- **Prompt compacto:** o Diretor recebe uma orientação pronta, natural e resolvida, não JSON administrativo.
- **Prompts visíveis:** regras editoriais devem permanecer legíveis e ajustáveis em arquivos Markdown.
- **Validação visual real:** testes automatizados não substituem campanhas geradas e avaliadas por pessoas.

## Subfases Recomendadas

### F44.1 — Fundação E Criação

Entrega vertical pequena:

- entidade Tema isolada por loja;
- criação assistida em uma chamada;
- campos essenciais e presença temática;
- revisão estruturada;
- estados `draft` e `active`;
- descarte de rascunho;
- cobrança por geração bem-sucedida;
- estorno em falha técnica;
- telemetria real de provider, modelo, tokens e custo;
- detalhe somente leitura do Tema salvo.

**Aceite:** gerar e salvar Temas distintos, como Natal e Sexta do Açougue, sem contaminação estética entre eles ou cópia literal da marca.

### F44.2 — Uso Em Campanhas

- seletor opcional no formulário;
- resolução autoritativa no servidor;
- snapshot imutável na campanha;
- receita `campaign-simple` sem Tema;
- receita `campaign-themed` com briefing compacto;
- texto temático e intensidade controlados;
- identidade `text_only`, logo e assinatura visual preservadas;
- Copy Director e Revisor recebem somente o contexto necessário;
- campanha sem Tema permanece inalterada.

**Aceite:** produzir campanhas publicáveis com e sem Tema, preservando fatos, produto e identidade da loja.

### F44.3 — Continuidade Visual

- a primeira campanha aprovada de um Tema torna-se referência visual;
- campanhas seguintes recebem essa imagem separadamente;
- a referência orienta paleta, tipografia, formas, texturas e identidade temática;
- não deve ser copiada como template;
- produto, preço, oferta e composição continuam livres;
- o Revisor permanece focado em fatos e publicabilidade;
- referência só muda futuramente por uma decisão explícita de produto.

**Dependência recomendada:** integrar com a F37, pois a referência ideal é uma campanha aprovada pelo lojista.

**Aceite:** gerar produtos diferentes sob o mesmo Tema e reconhecer imediatamente que pertencem à mesma ação.

### F44.4 — Evolução E Histórico

- duplicar Tema para novo ciclo;
- exemplo: `Natal 2025` → `Natal 2026`;
- arquivar e restaurar;
- impedir edição destrutiva de Tema ativo;
- alterações por cópia, não por mutação do histórico;
- chips e filtro de campanhas por Tema;
- campanhas antigas preservam seus snapshots.

## Aprendizados Obrigatórios

- Contratos criativos excessivamente detalhados produziram prompts inchados e contraditórios.
- Validadores semânticos rígidos transformaram respostas válidas da IA em sucessivos `invalid_direction`.
- Corrigir cada variação probabilística com regex e normalizadores gerou fragilidade crescente.
- Tema não deve decidir posição, alinhamento ou layout global.
- Assinatura temática puramente textual não garante persistência visual suficiente.
- A referência visual da primeira campanha foi o mecanismo que mais aproximou os resultados da consistência desejada.
- Diretor e Revisor não devem receber o mesmo excesso de contexto.
- Brand profile deve chegar ao gerador como uma fundação compacta, com papéis explícitos.
- Cada subfase precisa de UAT real antes da seguinte; gates verdes sozinhos não encerram o trabalho.
- Falhas de provider, fallback, contabilização e telemetria devem ser testadas no fluxo real desde a primeira entrega.

## Fora Do Escopo Inicial

- calendário e sugestões sazonais;
- geração de ativo gráfico isolado para o Tema;
- edição destrutiva de Temas ativos;
- seleção manual da campanha de referência;
- revisor avaliando fidelidade visual entre campanhas;
- exclusão definitiva automática;
- catálogo fechado de temas.

Esse desenho preserva o que funcionou, reduz a superfície de cada entrega e impede que a nova F44 volte a crescer como uma única implementação difícil de validar.