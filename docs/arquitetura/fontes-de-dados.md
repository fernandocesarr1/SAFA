# Fontes de dados

Nenhum número do SAFA deve depender de uma fonte só. Fonte única erra em
silêncio: um valor pode estar errado por muito tempo sem que nada denuncie —
foi assim que 1.830 preços sem procedência passaram por todos os gates (D1).

## O que cada fonte entrega

| Fonte | Acesso | Entrega | Natureza |
|---|---|---|---|
| **B3 · COTAHIST** | ZIP anual, URL fixa | preço, volume, universo negociado, ISIN | publicado |
| **CVM · Informe Mensal** | ZIP anual, dados abertos | patrimônio, cotas, VP/cota, DY mensal, alavancagem | publicado (renda é **derivada**) |
| **CVM · Informe Trimestral** | ZIP anual, dados abertos | rendimento declarado, vencimento de contratos, inquilinos, indexadores | publicado |
| **B3 · FNET** | JSON + HTML por documento | provento por cota, separando rendimento de amortização | publicado |
| **BCB · SGS** | JSON, API estável | IPCA, Selic | publicado |
| **Tesouro Transparente** | CKAN, JSON | NTN-B, para o yield exigido (D9) | publicado |

Todas foram exercitadas contra o servidor real em 2026-09-05, e os layouts
foram lidos do arquivo — nenhum nome de coluna foi inferido.

## O mesmo fato, por caminhos diferentes

| Fato | Fonte A | Fonte B | Fonte C |
|---|---|---|---|
| renda por cota | CVM mensal (derivada) | FNET (declarada) | CVM trimestral (declarada) |
| patrimônio e cotas | CVM mensal | CVM trimestral | — |
| preço | B3 COTAHIST | — | — |

`lib/triagem/triangulacao.ts` confronta as medidas. O objetivo **não** é
escolher a fonte melhor: é medir a distância entre elas.

- **concordam** dentro da tolerância → a medida ganha confiança
- **divergem** → pelo menos uma está errada, e o número é suspenso; não se
  escolhe o mais conveniente
- **fonte única** → utilizável, com confiança menor; publicado vale mais que
  derivado

## O que a triangulação já pegou

**`Rendimentos_Declarados` do informe trimestral é acumulado no exercício.**

Ao confrontar com o informe mensal, 290 de 386 fundos divergiam. O padrão era
inconfundível: o mesmo fundo aparecia com 1,20 no primeiro trimestre e 2,40 no
segundo; 43,43 e depois 87,73. Valor dobrando ao longo do ano é acumulação, não
crescimento de renda.

Sem desacumular, o quarto trimestre seria lido como quatro vezes o primeiro, e
qualquer fundo pareceria ter renda crescente. **Uma fonte só nunca revelaria
isso** — o número é internamente coerente e só denuncia contra outra medida.

Depois da correção, as concordâncias subiram de 96 para 163.

## Por que o FNET importa

A renda da triagem vinha de `dividend_yield_mes × valor_patrimonial_cota`, do
informe mensal. A base desse yield não está documentada no leiaute da CVM — é
suposição nossa.

O FNET traz o provento **declarado pelo administrador**, com data-base, data de
pagamento e, o que nenhuma outra fonte separa, **rendimento distinto de
amortização**. Amortização é devolução de capital: tratá-la como renda
recorrente infla o yield e faz um fundo em liquidação parecer generoso.

## Sinais que deixaram de ser documentais

O informe trimestral converte em número o que antes exigia leitura de relatório
gerencial:

| Sinal | Campo |
|---|---|
| contratos vencendo em 24 meses | `Percentual_Vencimento_Receita_FII_Faixa_*` somadas até 24m |
| concentração em um inquilino | `Percentual_Receitas_FII`, por inquilino |
| exposição a indexador | `Percentual_Indexador_Receita_FII_IPCA` / `IGPM` / `INPC` |

Cobertura observada em 2026: 538 fundos com cronograma de vencimento, 1.013 com
concentração medida, 1.464 com rendimento declarado.

## Limites conhecidos

- Os endpoints do FNET **não são documentados publicamente** pela B3. Podem
  mudar sem aviso; o coletor falha alto quando isso acontecer.
- O FNET responde documento a documento, então montar série histórica exige
  muitas requisições — é coleta incremental, não varredura de uma vez.
- O informe trimestral tem defasagem maior que o mensal.
- Nada disso está integrado ao pré-ranking ainda: a triangulação existe e é
  testada, mas o funil continua consumindo só o informe mensal.
