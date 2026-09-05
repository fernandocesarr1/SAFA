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

## O que ainda não está feito

- Nada disto está integrado ao app nem ao banco: as tabelas são proposta.
- Não há coletor de proventos (FNET); sem ele a renda da decomposição ainda
  depende dos dados atuais, que o D1 manda rejeitar.
- O download e a descompactação do COTAHIST não estão implementados — só o
  parser, que é a parte que precisa ser fiel ao byte.
- A triagem não roda sozinha: falta o orquestrador que percorre o universo.

**Enquanto a coleta não substituir as séries rejeitadas, a triagem não deve ser
usada para decidir aporte.** Ela herdaria o D1 e daria aparência quantitativa a
um dado sem procedência — que é pior do que não ter triagem.
