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

## Composição verificada

- Cabeçalho com saudação em destaque e subtítulo; sem botões internos de criação/configuração.
- Painel único “Campanhas recentes”, contagem secundária de disponíveis, “Ver todas” no cabeçalho.
- Até três linhas com miniatura, nome, data e ação visível “Abrir campanha”; divisórias entre linhas.
- Orientação dentro do painel, após divisória.
- Créditos destacados na lateral (desktop) e bloco compacto horizontal (mobile).
- Novidades diretamente abaixo dos créditos na lateral, com badge “Novidades”.
- Faixa inferior de largura total “Que tal criar sua próxima campanha?” com “Criar campanha”.
- Mobile: créditos → campanhas → novidades → faixa de criação; sem overflow em 320 px.
- Shell, sidebar, topbar, logo e assinatura preservados.

## Limitações

- As capturas são de homolog local, não de produção.
- **Capturas es-419 não foram geradas nesta rodada:** o único usuário com loja e campanhas no homolog está com preferência `pt-BR`; gerar es-419 exigiria alterar `user_preferences` (banco), o que esta rodada proíbe explicitamente. A cobertura es-419 permanece por testes automatizados de catálogo/página, não por captura visual.
- A comparação com as montagens de referência é visual/humana; nenhuma conclusão de aceite é registrada aqui.
- As capturas não comprovam produção, deploy ou smoke.
