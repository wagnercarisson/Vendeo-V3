## ADDED Requirements

### Requirement: Download por formato na campanha conjunta

A rota `GET /api/campaign/[id]/download` SHALL aceitar `?format=1:1|9:16` para campanha conjunta e SHALL servir os bytes do artefato original daquele formato somente quando o crédito do formato estiver `delivered` e o artefato for compatível. Sem o parâmetro, a rota SHALL usar o formato preferido (quadrado quando entregue; senão vertical). Formato ausente, desconhecido, indeterminado ou não pertencente à campanha SHALL falhar fechado, sem baixar, redirecionar ou revelar outro artefato. Campanhas 1:1, 9:16 individuais e históricas SHALL ignorar o parâmetro e manter o comportamento atual.

#### Scenario: Download individual do quadrado

- **WHEN** o lojista baixa a campanha conjunta com `?format=1:1` e o quadrado está entregue
- **THEN** a rota SHALL devolver os bytes do `square_original`
- **AND** SHALL usar nome de arquivo seguro e `Content-Type` de imagem JPEG

#### Scenario: Download individual do vertical

- **WHEN** o lojista baixa a campanha conjunta com `?format=9:16` e o vertical está entregue
- **THEN** a rota SHALL devolver os bytes do `vertical`
- **AND** SHALL usar nome de arquivo seguro e `Content-Type` de imagem JPEG

#### Scenario: Formato não entregue não é baixado

- **WHEN** o formato solicitado está reservado, desconhecido, ausente ou indisponível
- **THEN** a rota SHALL responder com erro fechado
- **AND** SHALL NOT devolver, redirecionar ou assinar o artefato do outro formato

#### Scenario: Sem parâmetro usa o formato preferido

- **WHEN** a campanha conjunta é baixada sem `?format`
- **THEN** a rota SHALL usar o quadrado quando entregue
- **AND** SHALL usar o vertical apenas quando o quadrado não estiver entregue

#### Scenario: Fluxos individuais permanecem inalterados

- **WHEN** uma campanha 1:1 ou 9:16 individual é baixada com ou sem `?format`
- **THEN** a rota SHALL manter o comportamento atual
- **AND** SHALL NOT aplicar o contrato de duas entregas
