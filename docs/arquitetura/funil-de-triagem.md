# Funil de triagem

## O problema que este desenho resolve

O objetivo do SAFA é varrer o mercado de FIIs e achar fundos que caíram sem que
os fundamentos justificassem a queda.

A arquitetura original não chega lá, e o motivo é aritmético. O Deep Max exige,
por fundo, 16 seções, 100 critérios, leitura documental integral em duas
passagens, 36 distribuições classificadas e 750 preços. É análise artesanal,
escrita linha a linha por um assistente. Em dois dias de trabalho intenso saíram
**duas** análises. O mercado tem centenas de FIIs.

Nenhum ajuste de produtividade fecha essa conta. O que fecha é parar de tratar
"análise profunda" e "varredura" como a mesma atividade.

## Os quatro estágios

```
[0] Universo          todos os FIIs negociados
       |
[1] Coleta            preço e renda por coletor reproduzível, com lote e hash
       |
[2] Triagem           decomposição da queda + sinais de deterioração
       |              ~centenas de fundos, automático, sem leitura documental
       |
[3] Deep Max          os candidatos que a triagem apontou
                      ~dezenas, artesanal, com veredito
```

A inversão está em [2]. Hoje o Deep Max é o único modo de olhar um fundo; ele
deveria ser o modo caro, reservado a quem passou por um filtro barato.

**A triagem não emite veredito.** Ela ordena fila. `AGENTS.md` §14 mantém a
metodologia como fonte única do veredito, e nada em [2] compete com isso.

## O núcleo: separar queda de queda

Como `preço = renda / yield`, vale exatamente, em logaritmo:

```
ln(P1/P0) = ln(R1/R0) − ln(Y1/Y0)
```

É identidade, não aproximação: não sobra resíduo. Toda queda de preço é, por
construção, queda de renda, alta do yield exigido, ou as duas.

| Queda puxada por | Leitura | Ação |
|---|---|---|
| renda | o fundo piorou e o preço acompanhou | descartar |
| yield | a renda ficou de pé e o mercado passou a exigir mais | **investigar** |

O segundo caso é o alvo declarado do SAFA. Mas ele não é conclusão — é hipótese.
O mercado pode estar precificando risco real que ainda não chegou na renda.

## O contrapeso, e a armadilha que ele evita

Por isso todo candidato passa por `deterioracao.ts`, que procura o risco que
justificaria o yield maior: vacância subindo, inadimplência, alavancagem,
vencimentos concentrados, emissão abaixo do VP, concentração de inquilino.

A regra que governa esse módulo:

> **Ausência de sinal não é ausência de problema.**

Um sinal que não pôde ser avaliado por falta de dado é `desconhecido`, nunca
`ausente`. Se a cobertura dos sinais for baixa, o desfecho é
`dados_insuficientes` — não "oportunidade".

Tratar "não sei" como "está tudo bem" é exatamente o defeito do D4: gates que
conferem preenchimento e concluem verdade. Foi assim que uma série de preços sem
procedência passou por todos eles.

## Onde cada coisa mora

```
lib/coleta/
  lote.ts                 linhagem obrigatória: URL, hash, parser, contagem
  cotahist/
    layout.ts             o registro de 245 posições da B3, em um lugar só
    parser.ts             largura fixa -> cotação tipada, com rejeição explícita

lib/triagem/
  tipos.ts                Resultado<T>: ausência de dado é desfecho, não zero
  decomposicao.ts         a identidade log
  deterioracao.ts         sinais, com estado desconhecido
  classificacao.ts        junta os dois e devolve a fila

lib/metodologia/
  yield-exigido.ts        NTN-B + prêmio + ajustes, cada linha com fonte

supabase/propostas/       SQL preparado, ainda não aplicado
```

Arquivos pequenos e de responsabilidade única, para o crescimento ser por adição
e não por inchaço. Um coletor novo (FNET, CVM) entra como pasta irmã de
`cotahist/` sem tocar no que existe.

## Dívidas que este desenho ataca

| Dívida | Como |
|---|---|
| D1 | coletor COTAHIST reproduzível, com hash do arquivo e versão do parser |
| D3 | lote exige URL que identifique o arquivo; página de índice é recusada |
| D4 | sinal sem dado é `desconhecido`; cobertura entra no resultado |
| D9 | yield exigido decomposto em linhas com fonte, não escolhido caso a caso |
| D10 | ambiguidade resolvida por escrito: cap rate sobre renda real, sem termo de crescimento separado |
| D14 | a triagem não usa Fibonacci, MACD nem RSI — usa preço, renda e liquidez |

## Primeira execução real (05/09/2026)

Rodada sobre 2024–2026, com download de verdade:

```
node --max-old-space-size=6144 scripts/triagem/executar.ts 2024 2025 2026
```

| | |
|---|---|
| cotações COTAHIST | 196.765 |
| FIIs no universo | **551** |
| tickers processados | 551 |
| sem dados suficientes | 383 |
| queda com fundamento | 78 |
| **candidatos a desconto** | **67** |
| sem queda | 23 |

Para efeito de comparação: o SAFA tinha 22 fundos cadastrados e 2 analisados.

### Três defeitos que só a execução revelou

**1. O ano-calendário mede o ano, não o desconto.** A primeira versão comparava
o primeiro com o último pregão da janela. Um fundo que despencou em 2024 e ficou
de lado em 2025 aparecia como estável. A referência passou a ser o **pico**: a
pergunta certa é a distância do topo, não o saldo do período.

**2. Renda de um mês é ruído.** Comparar o rendimento de uma competência com o
de outra transforma mês atípico em "mudança de fundamento". Passou a usar a
mediana de três competências em cada ponta.

**3. Exigir cobertura de sinais documentais travava o funil inteiro.** Dos sete
sinais, só a alavancagem vem de fonte numérica aberta; a cobertura ficava em 14%
e **todos os 68 candidatos caíam em `dados_insuficientes`**. A correção não foi
baixar o limiar — foi separar `quantitativo` de `documental`. A cobertura mede
só o primeiro; o segundo vira pendência obrigatória do Deep Max.

Além disso, um fundo apareceu no topo da fila com **P/VP de 18,55** — preço a
dezoito vezes o patrimônio. Não é desconto, é divergência de cota ou unidade
entre B3 e CVM. P/VP fora de `[0,05 · 3]` agora exclui a MEDIÇÃO, dizendo isso
no impedimento.

### O que a fila NÃO significa

Estar no topo não é recomendação. `HCTR11` e `VSLH11` aparecem com P/VP de 0,14
e "renda de pé" — são casos conhecidos de deterioração severa, e a renda
derivada do informe da CVM provavelmente não capturou o colapso das
distribuições. **São falsos positivos prováveis**, e é exatamente para isso que
existem as seis verificações documentais pendentes em cada candidato.

A triagem diz onde olhar. Ela não diz o que concluir.

## O que ainda não está feito

- Nada disto está integrado ao app nem ao banco: as tabelas continuam proposta,
  e o resultado da triagem só existe na saída do script.
- **A renda é derivada, não publicada.** Vem de `dividend_yield_mes ×
  valor_patrimonial_cota` do informe da CVM, porque a CVM não publica o valor
  distribuído por cota. A base do yield não está documentada no leiaute. Serve
  para ordenar fila; não serve para veredito.
- Não há coletor de proventos (FNET), que é o que traria o provento com fonte
  primária e resolveria o item acima.
- 383 dos 551 fundos ficam de fora, a maioria por pouco histórico ou baixa
  liquidez — o que é filtro proposital — mas 32 caem por ISIN sem
  correspondência na CVM, e isso é defeito de cruzamento a investigar.
- Os sinais quantitativos são um só (alavancagem). Cada novo sinal numérico
  aumenta a força da triagem mais do que qualquer refinamento do score.

**A triagem não deve ser usada para decidir aporte.** Ela ordena investigação
sobre dado derivado, e o D1 segue aberto para as séries que já estavam no banco.
