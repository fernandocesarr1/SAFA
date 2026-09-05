/**
 * Pré-ranking: o estágio [2] do funil.
 *
 * Cruza preço (COTAHIST) com fundamento (Informe Mensal da CVM) pelo ISIN —
 * que é a única chave comum, já que a B3 identifica por ticker e a CVM por
 * CNPJ — decompõe a variação de preço e devolve a fila do Deep Max.
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

export type EntradaPreRanking = {
  cotacoesPorTicker: Map<string, CotacaoBruta[]>;
  cadastro: readonly CadastroFundo[];
  complementos: readonly ComplementoMensal[];
  ativoPassivo?: readonly AtivoPassivoMensal[];
  /** Liquidez mínima diária média para o fundo entrar na fila, em reais. */
  liquidezMinimaDiaria?: number;
  /** Pregões mínimos no período; abaixo disso a série não sustenta conclusão. */
  pregoesMinimos?: number;
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
  /** Valor patrimonial por cota no fim da janela, da CVM. */
  valorPatrimonialCota: number | null;
  /** Preço sobre valor patrimonial. Null quando falta o VP. */
  precoSobreVp: number | null;
  decomposicao: Decomposicao | null;
  sinais: Sinal[];
  classificacao: Classificacao | null;
  /** Por que o fundo não pôde ser avaliado, quando for o caso. */
  impedimento: string | null;
};

export const PADROES = {
  liquidezMinimaDiaria: 50_000,
  pregoesMinimos: 100,
  /**
   * Faixa de P/VP tratada como plausível.
   *
   * Fora dela, o número quase certamente não é oportunidade: é o cruzamento
   * errado, cota desdobrada ou grupada entre as fontes, ou unidade divergente.
   * A primeira execução real trouxe um fundo com P/VP de 18,55 no topo da fila
   * — preço a dezoito vezes o patrimônio não é desconto, é defeito de dado, e
   * deixá-lo passar contamina a fila inteira.
   *
   * Isto NÃO descarta o fundo por ser caro ou barato: descarta a MEDIÇÃO, que
   * é coisa diferente, e diz isso no impedimento.
   */
  pvpMinimoPlausivel: 0.05,
  pvpMaximoPlausivel: 3,
} as const;

function normalizarIsin(isin: string): string {
  return isin.trim().toUpperCase();
}

/** Índice ISIN -> cadastro mais recente do fundo. */
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

/** Complementos de um CNPJ, em ordem cronológica. */
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
 * O rendimento mensal de FII oscila — mês com receita extraordinária, mês com
 * linearização, mês de amortização. Decompor a variação usando um único mês em
 * cada ponta transforma ruído mensal em "mudança de fundamento", que é
 * exatamente o erro que a decomposição existe para evitar.
 *
 * Usa a mediana da janela: resiste a um mês fora da curva sem descartá-lo.
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

/** Meses usados em cada ponta da janela de renda. */
export const MESES_JANELA_RENDA = 3;

export function montarPreRanking(e: EntradaPreRanking): ItemPreRanking[] {
  const liquidezMinima = e.liquidezMinimaDiaria ?? PADROES.liquidezMinimaDiaria;
  const pregoesMinimos = e.pregoesMinimos ?? PADROES.pregoesMinimos;

  const porIsin = indexarCadastroPorIsin(e.cadastro);
  const porCnpj = indexarComplementos(e.complementos);

  const apPorChave = new Map<string, AtivoPassivoMensal>();
  for (const ap of e.ativoPassivo ?? []) {
    apPorChave.set(`${ap.cnpj}|${ap.dataReferencia}`, ap);
  }

  const itens: ItemPreRanking[] = [];

  for (const [ticker, serie] of e.cotacoesPorTicker) {
    if (serie.length === 0) continue;

    const primeira = serie[0];
    const ultima = serie[serie.length - 1];
    const liquidez =
      serie.reduce((s, c) => s + c.volumeFinanceiro, 0) / serie.length;

    const base: ItemPreRanking = {
      ticker,
      cnpj: null,
      nome: null,
      segmento: null,
      // preenchidos com o pico assim que ele é localizado, abaixo
      precoInicial: primeira.precoFechamento,
      precoFinal: ultima.precoFechamento,
      dataInicial: primeira.dataPregao,
      dataFinal: ultima.dataPregao,
      pregoes: serie.length,
      liquidezDiariaMedia: Number(liquidez.toFixed(2)),
      valorPatrimonialCota: null,
      precoSobreVp: null,
      decomposicao: null,
      sinais: [],
      classificacao: null,
      impedimento: null,
    };

    if (serie.length < pregoesMinimos) {
      itens.push({
        ...base,
        impedimento: `apenas ${serie.length} pregões no período; mínimo ${pregoesMinimos}`,
      });
      continue;
    }
    if (liquidez < liquidezMinima) {
      itens.push({
        ...base,
        impedimento: `liquidez diária média de R$ ${liquidez.toFixed(0)}, abaixo do mínimo`,
      });
      continue;
    }

    const isin = normalizarIsin(ultima.codigoIsin);
    const cadastro = porIsin.get(isin);
    if (!cadastro) {
      itens.push({
        ...base,
        impedimento: `ISIN ${isin || "(vazio)"} sem correspondência no cadastro da CVM`,
      });
      continue;
    }

    const historico = porCnpj.get(cadastro.cnpj) ?? [];
    const comDados = historico.filter(
      (c) => c.valorPatrimonialCota !== null && c.dividendYieldMes !== null,
    );

    const identificado = {
      ...base,
      cnpj: cadastro.cnpj,
      nome: cadastro.nome,
      segmento: cadastro.segmento || null,
    };

    // duas janelas de meses não sobrepostas: uma no pico, outra no fim
    if (comDados.length < MESES_JANELA_RENDA * 2) {
      itens.push({
        ...identificado,
        impedimento:
          `informe da CVM tem ${comDados.length} competências com VP e yield; ` +
          `são necessárias ${MESES_JANELA_RENDA * 2} para comparar duas janelas`,
      });
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

    // as competências da CVM anteriores ao pico formam a janela de renda "de
    // antes"; se o pico for cedo demais, cai para as primeiras disponíveis
    const competenciaPico = pico.dataPregao.slice(0, 7);
    const anterioresAoPico = comDados.filter(
      (c) => c.dataReferencia.slice(0, 7) <= competenciaPico,
    );
    const janelaInicial =
      anterioresAoPico.length >= MESES_JANELA_RENDA
        ? anterioresAoPico.slice(-MESES_JANELA_RENDA)
        : comDados.slice(0, MESES_JANELA_RENDA);

    const janelaFinal = comDados.slice(-MESES_JANELA_RENDA);

    // as janelas não podem se sobrepor, senão a comparação é consigo mesma
    if (
      janelaInicial[janelaInicial.length - 1].dataReferencia >=
      janelaFinal[0].dataReferencia
    ) {
      itens.push({
        ...identificado,
        impedimento:
          "pico de preço recente demais: janelas de renda se sobrepõem",
      });
      continue;
    }

    const inicio = janelaInicial[0];
    const fim = janelaFinal[janelaFinal.length - 1];

    const vpFinal = fim.valorPatrimonialCota;
    const precoSobreVp =
      vpFinal && vpFinal > 0
        ? Number((ultima.precoFechamento / vpFinal).toFixed(4))
        : null;

    // P/VP fora de faixa plausível denuncia cruzamento ou unidade errada entre
    // B3 e CVM. Não é sinal sobre o fundo; é sinal sobre a medição.
    if (
      precoSobreVp !== null &&
      (precoSobreVp < PADROES.pvpMinimoPlausivel ||
        precoSobreVp > PADROES.pvpMaximoPlausivel)
    ) {
      itens.push({
        ...identificado,
        precoInicial: pico.precoFechamento,
        dataInicial: pico.dataPregao,
        valorPatrimonialCota: vpFinal,
        precoSobreVp,
        impedimento:
          `P/VP de ${precoSobreVp.toFixed(2)} fora da faixa plausível ` +
          `[${PADROES.pvpMinimoPlausivel}, ${PADROES.pvpMaximoPlausivel}] — ` +
          "provável divergência de cota ou unidade entre B3 e CVM, não desconto",
      });
      continue;
    }

    const rendaInicial = rendaAnualizadaDaJanela(janelaInicial);
    const rendaFinal = rendaAnualizadaDaJanela(janelaFinal);

    if (rendaInicial === null || rendaFinal === null) {
      itens.push({
        ...identificado,
        valorPatrimonialCota: vpFinal,
        precoSobreVp,
        impedimento: "renda anualizada indisponível em uma das pontas",
      });
      continue;
    }

    const decomposicao = decomporVariacao({
      precoInicial: pico.precoFechamento,
      precoFinal: ultima.precoFechamento,
      rendaInicial,
      rendaFinal,
    });

    if (!decomposicao.ok) {
      itens.push({
        ...identificado,
        valorPatrimonialCota: vpFinal,
        precoSobreVp,
        impedimento: `${decomposicao.motivo}: ${decomposicao.detalhe}`,
      });
      continue;
    }

    const ap = apPorChave.get(`${fim.cnpj}|${fim.dataReferencia}`);
    const apAnterior = apPorChave.get(`${inicio.cnpj}|${inicio.dataReferencia}`);

    const sinais = avaliarSinais({
      alavancagemAtual: ap
        ? (alavancagem(ap, fim.patrimonioLiquido) ?? undefined)
        : undefined,
      alavancagemAnterior: apAnterior
        ? (alavancagem(apAnterior, inicio.patrimonioLiquido) ?? undefined)
        : undefined,
      // emissão diluidora aparece como preço de emissão sobre VP; o informe
      // mensal não traz isso, então o sinal fica desconhecido de propósito
    });

    itens.push({
      ...identificado,
      // a referência reportada é o pico, que é o que a decomposição comparou
      precoInicial: pico.precoFechamento,
      dataInicial: pico.dataPregao,
      valorPatrimonialCota: vpFinal,
      precoSobreVp,
      decomposicao: decomposicao.valor,
      sinais,
      classificacao: classificar(decomposicao.valor, sinais),
    });
  }

  return itens.sort((a, b) => {
    const pa = a.classificacao?.prioridade ?? -1;
    const pb = b.classificacao?.prioridade ?? -1;
    return pb - pa;
  });
}

export type ResumoPreRanking = {
  total: number;
  porClasse: Record<string, number>;
  impedidos: number;
  candidatos: ItemPreRanking[];
};

export function resumir(itens: readonly ItemPreRanking[]): ResumoPreRanking {
  const porClasse: Record<string, number> = {};
  let impedidos = 0;

  for (const i of itens) {
    if (i.impedimento) {
      impedidos += 1;
      continue;
    }
    const classe = i.classificacao?.classe ?? "sem_classificacao";
    porClasse[classe] = (porClasse[classe] ?? 0) + 1;
  }

  return {
    total: itens.length,
    porClasse,
    impedidos,
    candidatos: itens.filter(
      (i) => i.classificacao?.classe === "candidato_desconto",
    ),
  };
}
