# F58 — Capturas reais após reconciliação com as montagens

**Data:** 2026-11-02
**Ambiente:** `npm.cmd run build` + `npm.cmd run start` em `http://localhost:3000` (produção local; sem dev overlay)
**Base:** Supabase homolog local `http://127.0.0.1:57781`
**Loja usada:** Padaria da Esquina (dados de homolog; e-mail da conta ocultado nas capturas)
**Natureza:** evidência visual para revisão; **não é aceite humano** e não comprova produção.

## Capturas pt-BR

| Viewport | Arquivo | Dimensões | Overflow horizontal |
|---|---|---|---|
| Desktop | `evidence/58-05-visual-desktop.png` | 1440 × 1200 | não |
| Mobile | `evidence/58-05-visual-mobile.png` | 390 × 844 (full page) | não |
| Mobile estreito | `evidence/58-05-visual-mobile-320.png` | 320 × 800 (full page) | não |

## Capturas es-419

Autorização específica recebida para alterar temporariamente o idioma do usuário de teste no homolog local via fluxo existente de Configurações, gerar as capturas e restaurar o valor original.

| Viewport | Arquivo | Dimensões |
|---|---|---|
| Desktop | `evidence/58-05-visual-desktop-es.png` | 1440 × 1200 |
| Mobile | `evidence/58-05-visual-mobile-es.png` | 390 × 844 (full page) |

**Restauração confirmada:** `user_preferences` do usuário de teste voltou a `ui_locale = pt-BR`, `ui_locale_source = explicit`. A versão de CAS avançou de 2 para 4 durante as duas gravações (es-419 → pt-BR); nenhum outro dado, schema ou regra foi alterado. O dashboard voltou a renderizar “Campanhas recentes” após a restauração.

## Composição verificada

- Cabeçalho com saudação em destaque e subtítulo; sem botões internos de criação/configuração.
- Painel único “Campanhas recentes” / “Campañas recientes”, contagem secundária de disponíveis, “Ver todas” no cabeçalho.
- Até três linhas com miniatura, nome, data e ação visível “Abrir campanha” / “Abrir campaña”; divisórias entre linhas.
- Orientação dentro do painel, após divisória.
- Créditos destacados com ícone, valor, descrição e ação “Ver créditos e extrato” / “Ver créditos y extracto”.
- Novidades diretamente abaixo dos créditos na lateral, com badge localizado.
- Faixa inferior de largura total “Que tal criar sua próxima campanha?” / “¿Qué tal crear tu próxima campaña?” com “Criar campanha” / “Crear campaña”.
- Mobile: créditos → campanhas → novidades → faixa de criação; sem overflow em 320 px.
- Shell, sidebar, topbar, logo e assinatura preservados.

## Limitações

- As capturas são de homolog local, não de produção.
- Não representam deploy, smoke ou aceite de produção.
- A comparação com as montagens de referência é visual/humana; nenhuma conclusão de aceite é registrada aqui.
- As capturas não comprovam leitor de tela real; acessibilidade por teclado/labels segue como validação manual pendente.

## Ordem real do DOM e teclado

A lateral voltou a usar posicionamento de grade (`lg:grid-rows-[min-content_1fr]`), sem `order` e sem `tabindex` positivo. O DOM permanece créditos → campanhas → novidades → faixa de criação.

Validação no navegador (produção local), com Tab real:

| Idioma | Ordem no DOM | Tab: créditos → campanhas → novidades | Resultado |
|---|---|---|---|
| pt-BR | créditos antes de campanhas; campanhas antes de novidades | índices 10 → 12 → 16 | PASS |
| es-419 | créditos antes de campanhas; campanhas antes de novidades | índices 10 → 12 → 16 | PASS |

A preferência foi alterada pelo fluxo de Configurações e restaurada ao final para `ui_locale = pt-BR`, `ui_locale_source = explicit` (versão CAS 8). Nenhum outro dado foi alterado.