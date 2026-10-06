# Image Generation Support Reference

## Purpose

Resposta pública identificável ao lojista quando uma geração falha, composta por um **código público** e uma **referência de atendimento**, sem revelar o motivo interno; o admin/suporte correlaciona a referência com um diagnóstico interno seguro e preciso.

## ADDED Requirements

### Requirement: Resposta pública identificável com código e referência

Toda falha de geração do novo fluxo SHALL produzir, para o lojista, uma resposta humana e identificável composta por um **código público** estável e uma **referência de atendimento**. O código público SHALL pertencer a um conjunto **fechado e mínimo de categorias voltadas ao usuário**.

O código público SHALL NOT se particionar por quota, faturamento, autenticação/autorização ou rate limit. Essas causas internas SHALL compartilhar a mesma categoria pública de falha técnica, de modo que o código público não permita inferir o motivo verdadeiro. A causa verdadeira SHALL ser recuperável **somente** pela referência opaca no admin/suporte.

#### Scenario: Falha elegível produz código e referência

- **WHEN** uma falha elegível encerra a operação
- **THEN** o lojista recebe um código público e uma referência de atendimento
- **AND** a resposta é compreensível para uma pessoa

#### Scenario: Falha não elegível produz código e referência

- **WHEN** uma falha não elegível encerra a operação
- **THEN** o lojista recebe um código público e uma referência de atendimento
- **AND** a resposta é compreensível para uma pessoa

#### Scenario: Código público não revela quota/faturamento

- **WHEN** a falha interna é quota esgotada ou erro de faturamento
- **THEN** o código público é a categoria técnica genérica
- **AND** é indistinguível, pelo código público, de outras falhas técnicas

#### Scenario: Código público não revela autenticação nem rate limit

- **WHEN** a falha interna é autenticação/autorização ou rate limit
- **THEN** o código público é a categoria técnica genérica
- **AND** o código público não permite inferir a causa interna

### Requirement: A mensagem pública não revela o motivo interno

A mensagem pública SHALL NOT conter saldo, quota, faturamento da conta do provider, chaves, URLs internas, stack traces nem texto cru do provider. O motivo interno SHALL permanecer acessível apenas ao admin/suporte.

#### Scenario: Motivo interno não vaza

- **WHEN** a falha é causada por quota esgotada ou erro de faturamento do provider
- **THEN** a mensagem pública não menciona quota, saldo ou faturamento
- **AND** não contém texto cru, chave ou URL do provider

#### Scenario: Código público é estável

- **WHEN** a mesma categoria de falha ocorre em execuções diferentes
- **THEN** o código público é o mesmo
- **AND** a referência de atendimento é única por ocorrência

### Requirement: Correlação segura no admin/suporte

A referência de atendimento SHALL permitir que o admin/suporte recupere o **diagnóstico interno** correspondente (categoria interna, provider/modelo/qualidade, tentativa, erro normalizado e run/trace), de forma segura e precisa, sem exigir que o lojista informe qualquer detalhe técnico.

#### Scenario: Suporte correlaciona a referência

- **WHEN** o admin/suporte recebe a referência de atendimento
- **THEN** ele obtém o diagnóstico interno associado àquela ocorrência
- **AND** o diagnóstico identifica a categoria interna, o par modelo–qualidade e a tentativa

#### Scenario: Referência de falha elegível e não elegível

- **WHEN** a referência pertence a uma falha elegível ou não elegível
- **THEN** o admin/suporte consegue distinguir o tipo de falha internamente
- **AND** essa distinção não é exposta na mensagem pública

### Requirement: Referência não é credencial nem dado sensível

A referência de atendimento SHALL ser opaca e SHALL NOT conter dados sensíveis, identificadores de conta, credenciais ou detalhes internos decodificáveis pelo lojista. Seu uso SHALL ser restrito à correlação interna.

#### Scenario: Referência opaca

- **WHEN** a referência de atendimento é apresentada ao lojista
- **THEN** ela não expõe identificadores de conta, chaves ou o motivo interno
- **AND** ela só tem utilidade para a correlação interna no admin/suporte
