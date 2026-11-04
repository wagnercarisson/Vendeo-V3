# Aceite visual — 261104-oac

**Status: APROVADO pelo responsável em 2026-11-04.**

Conteúdo e composição final aprovados: fonte central, home com card completo,
`/floriculturas` com um único card no encerramento e acesso inicial por âncora.

## Capturas

| Estado | Página | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|---|
| fechado | home | `closed-home-desktop-1440.png` | `closed-home-mobile-390.png` |
| fechado | `/floriculturas` | `closed-floriculturas-desktop-1440.png` | `closed-floriculturas-mobile-390.png` |
| aberto | home | `open-home-desktop-1440.png` | `open-home-mobile-390.png` |
| aberto | `/floriculturas` | `open-floriculturas-desktop-1440.png` | `open-floriculturas-mobile-390.png` |

Medições em `geometry.json`; navegação por âncora em `anchor-navigation.md`.

## O que conferir

- Home: inalterada nesta revisão; imagens lazy carregadas nas capturas.
- `/floriculturas` abertura: somente o grupo de botões, sem card, resumo,
  complemento ou expansível.
- Abertura fechada: “Solicitar acesso gratuito” e “Conheça o Vendeo” lado a lado
  no desktop, empilhados no mobile; o primeiro leva ao card final.
- Abertura aberta: Google e e-mail visualmente equivalentes, ambos links locais
  para o card final; “Conheça o Vendeo” centralizado abaixo e em `/`.
- Encerramento: um único card, com resumo, complemento, apoio/nota conforme a
  flag e expansível “Como funciona o teste gratuito?”.
- Ações reais somente no card final: `/#acesso` com a flag desligada;
  Google/OAuth e `/signup` com a flag ligada.
- `#floriculturas-oferta` visível e focado pelo teclado.
- Sem overflow horizontal e sem IDs duplicados.

## Aceite

- [x] Aprovado sem ressalvas
- [ ] Aprovado com ajustes (descrever)
- [ ] Reprovado (descrever)

Data/responsável: 2026-11-04 — responsável pela entrega.
