/**
 * Pré-ranking: o estágio [2] do funil.
 *
 * Cruza preço (COTAHIST) com fundamento (Informe Mensal da CVM) pelo ISIN —
 * única chave comum, já que a B3 identifica por ticker e a CVM por CNPJ —
 * decompõe a variação de preço e devolve DUAS filas:
 *
 * - **principal**: histórico completo (36 meses de preço e de rendimento), onde
 *   a decomposição é confiável o bastante para ordenar de verdade;
 * - **acompanhamento**: tudo o mais que é comprável e ainda negocia, com o
 *   motivo de não estar na principal. Nada aqui é descarte — é fila de espera,
 *   e o fundo migra sozinho quando o histórico amadurece.
 *
 * Sai das listas apenas quem uma pessoa comum não pode comprar, ou o que parou
 * de ser negociado.
 *
 * O que sai daqui NÃO é veredito e não é nota. É ordem de investigação.
 */

import type { CotacaoBruta } from "../coleta/cotahist/parser.ts";
import type {
  AtivoPassivoMensal,
  CadastroFundo,
  ComplementoMensal,
} from "../coleta/cvm/parser.ts";
import { alavancagem, rendaMensalPorCota } from "../coleta/cvm/parser.ts";
import { classificar, type Classificacao } from "./classificacao.ts";
import { decomporVariacao, type Decomposicao } from "./decomposicao.ts";
import { avaliarSinais, type Sinal } from "./deterioracao.ts";
import {
  avaliarElegibilidade,
  avaliarMaturidade,
  type Maturidade,
  type MotivoExclusao,
} from "./elegibilidade.ts";
import type {
  ContratosTrimestral,
  ResultadoTrimestral,
} from "../coleta/cvm/trimestral.ts";
import {
  rendaTrimestralPorCota,
  urlInformeTrimestral,
} from "../coleta/cvm/trimestral.ts";
import { urlInformeMensal } from "../coleta/cvm/layout.ts";
import {
  confrontar,
  confianca,
  descrever,
  valorUtilizavel,
  type Concordancia,
} from "./triangulacao.ts";

export type EntradaPreRanking = {
  cotacoesPorTicker: Map<string, CotacaoBruta[]>;
  cadastro: readonly CadastroFundo[];
  complementos: readonly ComplementoMensal[];
  ativoPassivo?: readonly AtivoPassivoMensal[];
  /** Informe trimestral: segunda medida de renda e sinais antes documentais. */
  contratosTrimestrais?: readonly ContratosTrimestral[];
  /** Concentração do maior inquilino, chaveada por `cnpj|dataReferencia`. */
  concentracaoPorFundo?: ReadonlyMap<string, number>;
  resultadosTrimestrais?: readonly ResultadoTrimestral[];
};

export type ItemPreRanking = {
  ticker: string;
  cnpj: string | null;
  nome: string | null;
  segmento: string | null;
  precoInicial: number;
  precoFinal: number;
  dataInicial: string;
  dataFinal: string;
  pregoes: number;
  liquidezDiariaMedia: number;
  maturidade: Maturidade;
  valorPatrimonialCota: number | null;
  precoSobreVp: number | null;
  decomposicao: Decomposicao | null;
  sinais: Sinal[];
  classificacao: Classificacao | null;
  /** Confronto entre as fontes de renda. Null quando não houve o que confrontar. */
  rendaConfrontada: Concordancia | null;
  /** 0 a 1: quanto se pode apoiar na renda usada. Não é nota de investimento. */
  confiancaRenda: number;
  /** Por que não está na lista principal. Null quando está. */
  motivoAcompanhamento: string | null;
};

export type Excluido = {
  ticker: string;
  nome: string | null;
  motivo: MotivoExclusao;
  detalhe: string;
};

export type ResultadoTriagem = {
  principal: ItemPreRanking[];
  acompanhamento: ItemPreRanking[];
  excluidos: Excluido[];
};

export const PADROES = {
  /**
   * Faixa de P/VP tratada como plausível.
   *
   * Fora dela o número quase certamente não é oportunidade: é cruzamento
   * errado, cota desdobrada ou grupada entre as fontes, ou unidade divergente.
   * A primeira execução real trouxe um fundo com P/VP de 18,55 no topo da fila.
   * Isto não julga o fundo — desqualifica a MEDIÇÃO, e diz isso no motivo.
   */
  pvpMinimoPlausivel: 0.05,
  pvpMaximoPlausivel: 3,
} as const;

/** Meses usados em cada ponta da janela de renda. */
export const MESES_JANELA_RENDA = 3;

function normalizarIsin(isin: string): string {
  return isin.trim().toUpperCase();
}

function indexarCadastroPorIsin(
  cadastro: readonly CadastroFundo[],
): Map<string, CadastroFundo> {
  const mapa = new Map<string, CadastroFundo>();
  for (const c of cadastro) {
    if (!c.isin) continue;
    const chave = normalizarIsin(c.isin);
    const atual = mapa.get(chave);
    if (!atual || c.dataReferencia > atual.dataReferencia) mapa.set(chave, c);
  }
  return mapa;
}

function indexarComplementos(
  complementos: readonly ComplementoMensal[],
): Map<string, ComplementoMensal[]> {
  const mapa = new Map<string, ComplementoMensal[]>();
  for (const c of complementos) {
    const lista = mapa.get(c.cnpj);
    if (lista) lista.push(c);
    else mapa.set(c.cnpj, [c]);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));
  }
  return mapa;
}

/**
 * Renda anualizada a partir de uma JANELA de competências, não de um mês só.
 *
 * O rendimento mensal de FII oscila — receita extraordinária, linearização,
 * amortização. Decompor usando um único mês em cada ponta transforma ruído
 * mensal em "mudança de fundamento", que é o erro que a decomposição existe
 * para evitar. A mediana resiste a um mês fora da curva sem descartá-lo.
 */
function rendaAnualizadaDaJanela(
  competencias: readonly ComplementoMensal[],
): number | null {
  const mensais = competencias
    .map((c) => rendaMensalPorCota(c))
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);

  if (mensais.length === 0) return null;

  const meio = Math.floor(mensais.length / 2);
  const mediana =
    mensais.length % 2 === 0
      ? (mensais[meio - 1] + mensais[meio]) / 2
      : mensais[meio];

  return mediana * 12;
}

function mesesDistintos(serie: readonly CotacaoBruta[]): number {
  return new Set(serie.map((c) => c.dataPregao.slice(0, 7))).size;
}

export function montarPreRanking(e: EntradaPreRanking): ResultadoTriagem {
  const porIsin = indexarCadastroPorIsin(e.cadastro);
  const porCnpj = indexarComplementos(e.complementos);

  const apPorChave = new Map<string, AtivoPassivoMensal>();
  for (const ap of e.ativoPassivo ?? []) {
    apPorChave.set(`${ap.cnpj}|${ap.dataReferencia}`, ap);
  }

  // régua do "ainda negocia": o último pregão visto em todo o conjunto
  let ultimoPregaoDoMercado = "";
  for (const serie of e.cotacoesPorTicker.values()) {
    const ultimo = serie[serie.length - 1]?.dataPregao;
    if (ultimo && ultimo > ultimoPregaoDoMercado) ultimoPregaoDoMercado = ultimo;
  }

  const principal: ItemPreRanking[] = [];
  const acompanhamento: ItemPreRanking[] = [];
  const excluidos: Excluido[] = [];

  for (const [ticker, serie] of e.cotacoesPorTicker) {
    if (serie.length === 0) continue;

    const primeira = serie[0];
    const ultima = serie[serie.length - 1];
    const cadastro = porIsin.get(normalizarIsin(ultima.codigoIsin)) ?? null;

    const elegibilidade = avaliarElegibilidade({
      cadastro,
      ultimaCotacao: ultima.dataPregao,
      ultimoPregaoDoMercado,
    });

    if (!elegibilidade.elegivel) {
      excluidos.push({
        ticker,
        nome: cadastro?.nome ?? null,
        motivo: elegibilidade.motivo,
        detalhe: elegibilidade.detalhe,
      });
      continue;
    }

    const liquidez =
      serie.reduce((s, c) => s + c.volumeFinanceiro, 0) / serie.length;

    const historico = cadastro ? (porCnpj.get(cadastro.cnpj) ?? []) : [];
    const comDados = historico.filter(
      (c) => c.valorPatrimonialCota !== null && c.dividendYieldMes !== null,
    );

    const maturidade = avaliarMaturidade(mesesDistintos(serie), comDados.length);

    const base: ItemPreRanking = {
      ticker,
      cnpj: cadastro?.cnpj ?? null,
      nome: cadastro?.nome ?? null,
      segmento: cadastro?.segmento || null,
      precoInicial: primeira.precoFechamento,
      precoFinal: ultima.precoFechamento,
      dataInicial: primeira.dataPregao,
      dataFinal: ultima.dataPregao,
      pregoes: serie.length,
      liquidezDiariaMedia: Number(liquidez.toFixed(2)),
      maturidade,
      valorPatrimonialCota: null,
      precoSobreVp: null,
      decomposicao: null,
      sinais: [],
      classificacao: null,
      rendaConfrontada: null,
      confiancaRenda: 0,
      motivoAcompanhamento: null,
    };

    const paraAcompanhamento = (motivo: string, extra: Partial<ItemPreRanking> = {}) => {
      acompanhamento.push({ ...base, ...extra, motivoAcompanhamento: motivo });
    };

    if (!cadastro) {
      paraAcompanhamento(
        `ISIN ${normalizarIsin(ultima.codigoIsin) || "(vazio)"} sem correspondência no cadastro da CVM`,
      );
      continue;
    }

    if (comDados.length < MESES_JANELA_RENDA * 2) {
      paraAcompanhamento(
        `informe da CVM tem ${comDados.length} competências com rendimento; ` +
          `são necessárias ${MESES_JANELA_RENDA * 2} para comparar duas janelas`,
      );
      continue;
    }

    // A referência não é o primeiro dia da série: é o PICO. "Descontado"
    // significa distância do topo, não saldo do período — um fundo que
    // despencou antes da janela e ficou de lado depois está descontado, e
    // comparar as pontas do calendário o daria como estável.
    const indicePico = serie.reduce(
      (melhor, c, i) =>
        c.precoFechamento > serie[melhor].precoFechamento ? i : melhor,
      0,
    );
    const pico = serie[indicePico];

    const competenciaPico = pico.dataPregao.slice(0, 7);
    const anterioresAoPico = comDados.filter(
      (c) => c.dataReferencia.slice(0, 7) <= competenciaPico,
    );
    const janelaInicial =
      anterioresAoPico.length >= MESES_JANELA_RENDA
        ? anterioresAoPico.slice(-MESES_JANELA_RENDA)
        : comDados.slice(0, MESES_JANELA_RENDA);
    const janelaFinal = comDados.slice(-MESES_JANELA_RENDA);

    const comPico = {
      ...base,
      precoInicial: pico.precoFechamento,
      dataInicial: pico.dataPregao,
    };

    if (
      janelaInicial[janelaInicial.length - 1].dataReferencia >=
      janelaFinal[0].dataReferencia
    ) {
      paraAcompanhamento(
        "pico de preço recente demais: janelas de renda se sobrepõem",
        comPico,
      );
      continue;
    }

    const inicio = janelaInicial[0];
    const fim = janelaFinal[janelaFinal.length - 1];
    const vpFinal = fim.valorPatrimonialCota;
    const precoSobreVp =
      vpFinal && vpFinal > 0
        ? Number((ultima.precoFechamento / vpFinal).toFixed(4))
        : null;

    const comVp = { ...comPico, valorPatrimonialCota: vpFinal, precoSobreVp };

    if (
      precoSobreVp !== null &&
      (precoSobreVp < PADROES.pvpMinimoPlausivel ||
        precoSobreVp > PADROES.pvpMaximoPlausivel)
    ) {
      paraAcompanhamento(
        `P/VP de ${precoSobreVp.toFixed(2)} fora da faixa plausível — ` +
          "provável divergência de cota ou unidade entre B3 e CVM, não desconto",
        comVp,
      );
      continue;
    }

    const rendaInicial = rendaAnualizadaDaJanela(janelaInicial);
    const rendaMensalDerivada = rendaAnualizadaDaJanela(janelaFinal);

    // A renda final é confrontada entre as fontes antes de entrar no cálculo.
    // A do informe mensal é DERIVADA (dividend_yield × VP, com base do yield
    // não documentada); a do trimestral é declarada. Divergirem significa que
    // pelo menos uma está errada — e aí o número é suspenso, não escolhido.
    const anoFim = fim.dataReferencia.slice(0, 4);
    const trimestreDoFim = (e.resultadosTrimestrais ?? []).find(
      (r) =>
        r.cnpj === fim.cnpj &&
        r.dataReferencia.slice(0, 4) === anoFim &&
        r.dataReferencia >= fim.dataReferencia,
    );
    const rendaTrimestralAnual = trimestreDoFim
      ? (() => {
          const porCota = rendaTrimestralPorCota(trimestreDoFim, fim.cotasEmitidas);
          return porCota === null ? null : porCota * 4; // trimestre -> ano
        })()
      : null;

    const rendaConfrontada = confrontar([
      ...(rendaMensalDerivada !== null
        ? [
            {
              fonte: "cvm_mensal" as const,
              valor: rendaMensalDerivada,
              url: urlInformeMensal(Number(anoFim)),
              natureza: "derivado" as const,
            },
          ]
        : []),
      ...(rendaTrimestralAnual !== null && rendaTrimestralAnual > 0
        ? [
            {
              fonte: "cvm_trimestral" as const,
              valor: rendaTrimestralAnual,
              url: urlInformeTrimestral(Number(anoFim)),
              natureza: "publicado" as const,
            },
          ]
        : []),
      // O FNET entra na verificação dos candidatos do topo, documento a
      // documento — varrer o mercado inteiro por ele exigiria dezenas de
      // milhares de requisições e não cabe numa passada do funil.
    ]);

    const rendaFinal = valorUtilizavel(rendaConfrontada);
    const comRenda = {
      ...comVp,
      rendaConfrontada,
      confiancaRenda: confianca(rendaConfrontada),
    };

    if (rendaInicial === null || rendaFinal === null) {
      paraAcompanhamento(
        rendaConfrontada.estado === "divergem"
          ? `fontes de renda em conflito — ${descrever(rendaConfrontada)}`
          : "renda anualizada indisponível em uma das pontas",
        comRenda,
      );
      continue;
    }

    const decomposicao = decomporVariacao({
      precoInicial: pico.precoFechamento,
      precoFinal: ultima.precoFechamento,
      rendaInicial,
      rendaFinal,
    });

    if (!decomposicao.ok) {
      paraAcompanhamento(
        `${decomposicao.motivo}: ${decomposicao.detalhe}`,
        comRenda,
      );
      continue;
    }

    const ap = apPorChave.get(`${fim.cnpj}|${fim.dataReferencia}`);
    const apAnterior = apPorChave.get(`${inicio.cnpj}|${inicio.dataReferencia}`);

    // Do informe trimestral: contratos e concentração, que deixaram de ser
    // documentais quando a fonte passou a existir.
    const contratos = (e.contratosTrimestrais ?? [])
      .filter((c) => c.cnpj === fim.cnpj)
      .sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))
      .at(-1);

    const concentracao = (() => {
      if (!e.concentracaoPorFundo) return undefined;
      let maisRecente: number | undefined;
      let dataMaisRecente = "";
      for (const [chave, valor] of e.concentracaoPorFundo) {
        const [cnpj, data] = chave.split("|");
        if (cnpj === fim.cnpj && data > dataMaisRecente) {
          dataMaisRecente = data;
          maisRecente = valor;
        }
      }
      return maisRecente;
    })();

    const sinais = avaliarSinais({
      alavancagemAtual: ap
        ? (alavancagem(ap, fim.patrimonioLiquido) ?? undefined)
        : undefined,
      alavancagemAnterior: apAnterior
        ? (alavancagem(apAnterior, inicio.patrimonioLiquido) ?? undefined)
        : undefined,
      contratosVencendo24mPct: contratos?.vencendoAte24m ?? undefined,
      concentracaoMaiorInquilinoPct: concentracao,
    });

    const item: ItemPreRanking = {
      ...comRenda,
      decomposicao: decomposicao.valor,
      sinais,
      classificacao: classificar(decomposicao.valor, sinais),
      motivoAcompanhamento: maturidade.completa
        ? null
        : `histórico insuficiente para avaliação exata: ${maturidade.faltas.join("; ")}`,
    };

    if (maturidade.completa) principal.push(item);
    else acompanhamento.push(item);
  }

  const porPrioridade = (a: ItemPreRanking, b: ItemPreRanking) =>
    (b.classificacao?.prioridade ?? -1) - (a.classificacao?.prioridade ?? -1);

  return {
    principal: principal.sort(porPrioridade),
    acompanhamento: acompanhamento.sort(porPrioridade),
    excluidos: excluidos.sort((a, b) => a.ticker.localeCompare(b.ticker)),
  };
}

export type ResumoLista = {
  total: number;
  porClasse: Record<string, number>;
  candidatos: ItemPreRanking[];
};

export function resumir(itens: readonly ItemPreRanking[]): ResumoLista {
  const porClasse: Record<string, number> = {};
  for (const i of itens) {
    const classe = i.classificacao?.classe ?? "nao_avaliado";
    porClasse[classe] = (porClasse[classe] ?? 0) + 1;
  }
  return {
    total: itens.length,
    porClasse,
    candidatos: itens.filter(
      (i) => i.classificacao?.classe === "candidato_desconto",
    ),
  };
}
