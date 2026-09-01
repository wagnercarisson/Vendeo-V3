# Illustrative Notice Control

## Purpose

Checkbox "Exibir 'Imagem meramente ilustrativa'" como controle real no formulário de campanha (F40 D2/D3): default marcado, injeta a constante única no texto obrigatório final, coexiste com o textarea livre, e normaliza o transporte via `mandatoryArtworkText` concatenado. Sem esse controle, o aviso ilustrativo ficaria sempre ligado (hardcode UAT-3) e o checkbox seria um no-op.

## ADDED Requirements

### Requirement: Checkbox de aviso ilustrativo como controle real

O sistema SHALL prover um checkbox "Exibir 'Imagem meramente ilustrativa'" no formulário de campanha, dentro da seção "Avisos e texto obrigatório", com **default marcado** na primeira versão (preserva o comportamento atual do UAT-3 e a proteção legal, criando o opt-out).

- O checkbox **coexiste** com o textarea livre "Texto obrigatório na arte" (D2) — são campos distintos com intenções distintas (aviso ilustrativo fixo × texto livre obrigatório).
- Checkbox marcado → injeta o texto fixo `ILLUSTRATIVE_NOTICE_TEXT` no texto obrigatório final (D3).
- Checkbox desmarcado + sem texto livre → `mandatoryArtworkText` **ausente** no body → `legalNotice.enabled=false` → **nada entra na arte** (regra F39 D9, agora com controle real).

#### Scenario: Checkbox renderizado por padrão marcado

- **WHEN** o formulário de campanha é renderizado pela primeira vez
- **THEN** há um checkbox "Exibir 'Imagem meramente ilustrativa'" na seção de avisos
- **AND** o checkbox está **marcado** por default (estado inicial do form)

#### Scenario: Checkbox desmarcado sem texto não envia aviso

- **WHEN** o usuário desmarca o checkbox e deixa o textarea vazio
- **THEN** o body do submit **não contém** `mandatoryArtworkText`
- **AND** o mapper produz `legalNotice` ausente → nada entra na arte (opt-out real)

#### Scenario: Checkbox marcado injeta a constante

- **WHEN** o usuário marca o checkbox e deixa o textarea vazio
- **THEN** o body do submit contém `mandatoryArtworkText` igual a `ILLUSTRATIVE_NOTICE_TEXT`
- **AND** o valor vem da constante única (nunca de string solta)

### Requirement: Constante única ILLUSTRATIVE_NOTICE_TEXT

O sistema SHALL centralizar o texto do aviso ilustrativo em uma única constante `ILLUSTRATIVE_NOTICE_TEXT = "Imagem meramente ilustrativa"` (singular, alinhada ao UAT-3 e aos prompts) no módulo `src/lib/campaign/constants.ts`.

- O módulo é **neutro** (sem `server-only`, sem importar o builder/domínio do brief) — o frontend o importa sem arrastar dependências (D2).
- **Form e fixtures** importam/usam a constante — normaliza as referências plurais existentes ("Ex: Imagens meramente ilustrativas" no placeholder do form e várias fixtures de teste). **Prompts** são arquivos `.md` e não importam código: usam o **mesmo literal canônico singular** (alinhado à constante e ao UAT-3), garantido por teste (teste 14 — sem strings soltas/divergentes singular×plural).

#### Scenario: Constante única singular usada no form

- **WHEN** o checkbox injeta o texto fixo no submit
- **THEN** o valor é exatamente `ILLUSTRATIVE_NOTICE_TEXT` (singular, via `src/lib/campaign/constants.ts`)
- **AND** não há string solta/divergente (singular × plural) no form

#### Scenario: Placeholder do textarea usa exemplo amplo sem a constante

- **WHEN** o textarea "Texto obrigatório na arte" é renderizado
- **THEN** o placeholder referencia um **exemplo amplo de regra/restrição** (ex.: "Consulte condições na loja. Promoção não cumulativa.") com helper text indicando o propósito do campo — **NÃO** referencia `ILLUSTRATIVE_NOTICE_TEXT`, para **não induzir o lojista a duplicar** o aviso ilustrativo no campo livre (decisão de UX aprovada na UAT item 1, `2026-08-14`)
- **AND** não há variante plural divergente do aviso no form

### Requirement: Transporte normaliza para texto final (concatenação)

O sistema SHALL normalizar checkbox + texto obrigatório para o **mesmo campo legado** `mandatoryArtworkText`, concatenados com `\n`, apenas na montagem do body (D3):

- checkbox marcado + texto livre → `"Imagem meramente ilustrativa\n<texto>"`
- checkbox marcado sem texto → `ILLUSTRATIVE_NOTICE_TEXT`
- checkbox desmarcado + texto livre → só o texto
- checkbox desmarcado + sem texto → campo **ausente** (`undefined`)

O mapeamento `mandatoryArtworkText` → `legalNotice { enabled, text }` (mapper F39) e o snapshot `campaign_brief_v1` continuam inalterados — sem mudança de contrato/backend, sem migration SQL (D9).

#### Scenario: Checkbox marcado + texto livre concatena

- **WHEN** o checkbox está marcado e o textarea contém "Consulte condições na loja."
- **THEN** o body do submit contém `mandatoryArtworkText` = `"Imagem meramente ilustrativa\nConsulte condições na loja."`
- **AND** o mapper produz `legalNotice = { enabled: true, text: <valor concatenado> }`

#### Scenario: Checkbox desmarcado + texto livre envia só o texto

- **WHEN** o checkbox está desmarcado e o textarea contém "Consulte condições na loja."
- **THEN** o body do submit contém `mandatoryArtworkText` = `"Consulte condições na loja."`

### Requirement: Form state mantém campos separados (autosave/restore)

O sistema SHALL guardar no estado do form os campos `showIllustrativeNotice` (boolean) e `mandatoryArtworkTextFree` (string) **separadamente**, até o submit (D3).

- A concatenação acontece **apenas na montagem do body** — o estado do form nunca guarda o texto final concatenado.
- O autosave/draft salva e restaura os dois campos distintos: ao recarregar o rascunho, "checkbox marcado + texto livre" permanece **distinguível** de texto livre digitado com a frase (a intenção original é preservada — se guardasse só o texto concatenado, "checkbox marcado + texto livre" viraria **indistinguível** de texto livre digitado com a frase, perdendo a intenção).

#### Scenario: Autosave/restore preserva a intenção checkbox × texto

- **WHEN** um usuário preenche "checkbox marcado + texto livre 'Consulte condições na loja.'" e o rascunho é salvo
- **THEN** ao recarregar o rascunho, o checkbox reaparece **marcado** e o textarea reaparece com **apenas** "Consulte condições na loja." (sem o aviso fixo concatenado no textarea)
- **AND** o estado do form não perdeu a distinção entre os dois campos
