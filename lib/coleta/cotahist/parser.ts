/**
 * Parser do COTAHIST. Converte registros de largura fixa em cotações tipadas.
 *
 * Regras que este parser NÃO viola:
 * - não estima, não interpola e não preenche lacuna nenhuma (`AGENTS.md` §12);
 * - não arredonda para mais casas do que a fonte tem (§13);
 * - linha malformada vira rejeição explícita, nunca um registro silencioso.
 *
 * O arquivo anual descompactado passa de 500 MB e estoura o limite de string do
 * Node, então o caminho principal é `parseCotahistBuffer`, que fatia o buffer
 * linha a linha e só converte 245 bytes por vez.
 */

import {
  CAMPOS,
  CODIGO_BDI_FII,
  COTAHIST_TAMANHO_REGISTRO,
  DIVISOR_PRECO,
  TIPO_MERCADO_VISTA,
  TIPO_REGISTRO_COTACAO,
  type CampoCotahist,
} from "./layout.ts";

/** Versão do parser. Sobe quando a interpretação do arquivo muda. */
export const VERSAO_PARSER = "cotahist-1.0.0";

export type CotacaoBruta = {
  /** AAAA-MM-DD */
  dataPregao: string;
  ticker: string;
  codigoIsin: string;
  precoAbertura: number;
  precoMaximo: number;
  precoMinimo: number;
  precoMedio: number;
  precoFechamento: number;
  /** Contagem de negócios — inteiro, conforme §13. */
  totalNegocios: number;
  /** Quantidade de cotas negociadas — inteiro. */
  quantidadeTotal: number;
  /** Volume FINANCEIRO em reais, 2 casas. Não é contagem de cotas. */
  volumeFinanceiro: number;
  fatorCotacao: number;
};

export type LinhaRejeitada = {
  numeroLinha: number;
  motivo: string;
};

export type ResultadoParse = {
  cotacoes: CotacaoBruta[];
  rejeitadas: LinhaRejeitada[];
  /** Linhas de cotação que não são FII à vista — ignoradas, não rejeitadas. */
  ignoradas: number;
  versaoParser: string;
};

type Interpretacao =
  | { tipo: "cotacao"; cotacao: CotacaoBruta }
  | { tipo: "ignorada" }
  | { tipo: "rejeitada"; motivo: string };

function fatia(linha: string, campo: CampoCotahist): string {
  const [inicio, tamanho] = CAMPOS[campo];
  return linha.slice(inicio - 1, inicio - 1 + tamanho);
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+$/.test(limpo)) return null;
  return Number.parseInt(limpo, 10);
}

/** Converte campo com duas casas implícitas, preservando exatamente 2 casas. */
function decimal2(texto: string): number | null {
  const bruto = inteiro(texto);
  if (bruto === null) return null;
  return Number((bruto / DIVISOR_PRECO).toFixed(2));
}

function dataIso(texto: string): string | null {
  if (!/^\d{8}$/.test(texto)) return null;
  const ano = texto.slice(0, 4);
  const mes = texto.slice(4, 6);
  const dia = texto.slice(6, 8);
  const data = new Date(`${ano}-${mes}-${dia}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return null;
  // rejeita datas que o Date "conserta" sozinho (31/02 vira 03/03)
  if (data.toISOString().slice(0, 10) !== `${ano}-${mes}-${dia}`) return null;
  return `${ano}-${mes}-${dia}`;
}

/** Interpreta uma única linha de 245 posições. */
function interpretarLinha(
  linha: string,
  filtro: Set<string> | null,
): Interpretacao {
  if (linha.length !== COTAHIST_TAMANHO_REGISTRO) {
    return {
      tipo: "rejeitada",
      motivo: `comprimento ${linha.length}, esperado ${COTAHIST_TAMANHO_REGISTRO}`,
    };
  }

  if (fatia(linha, "tipoRegistro") !== TIPO_REGISTRO_COTACAO) {
    return { tipo: "ignorada" };
  }

  const bdi = fatia(linha, "codigoBdi");
  const mercado = fatia(linha, "tipoMercado");
  const ticker = fatia(linha, "codigoNegociacao").trim().toUpperCase();

  if (bdi !== CODIGO_BDI_FII || mercado !== TIPO_MERCADO_VISTA) {
    return { tipo: "ignorada" };
  }
  if (filtro && !filtro.has(ticker)) {
    return { tipo: "ignorada" };
  }

  const dataPregao = dataIso(fatia(linha, "dataPregao"));
  if (!dataPregao) return { tipo: "rejeitada", motivo: "data de pregão inválida" };

  const precoAbertura = decimal2(fatia(linha, "precoAbertura"));
  const precoMaximo = decimal2(fatia(linha, "precoMaximo"));
  const precoMinimo = decimal2(fatia(linha, "precoMinimo"));
  const precoMedio = decimal2(fatia(linha, "precoMedio"));
  const precoFechamento = decimal2(fatia(linha, "precoFechamento"));
  const volumeFinanceiro = decimal2(fatia(linha, "volumeFinanceiro"));
  const totalNegocios = inteiro(fatia(linha, "totalNegocios"));
  const quantidadeTotal = inteiro(fatia(linha, "quantidadeTotal"));
  const fatorCotacao = inteiro(fatia(linha, "fatorCotacao"));

  const faltando = (
    [
      ["precoAbertura", precoAbertura],
      ["precoMaximo", precoMaximo],
      ["precoMinimo", precoMinimo],
      ["precoMedio", precoMedio],
      ["precoFechamento", precoFechamento],
      ["volumeFinanceiro", volumeFinanceiro],
      ["totalNegocios", totalNegocios],
      ["quantidadeTotal", quantidadeTotal],
      ["fatorCotacao", fatorCotacao],
    ] as const
  ).filter(([, valor]) => valor === null);

  if (faltando.length > 0) {
    return {
      tipo: "rejeitada",
      motivo: `campo numérico inválido: ${faltando.map(([n]) => n).join(", ")}`,
    };
  }

  if (precoFechamento === 0 && quantidadeTotal === 0) {
    // pregão sem negócio para o papel: não é cotação, não inventa preço
    return { tipo: "ignorada" };
  }

  return {
    tipo: "cotacao",
    cotacao: {
      dataPregao,
      ticker,
      codigoIsin: fatia(linha, "codigoIsin").trim(),
      precoAbertura: precoAbertura!,
      precoMaximo: precoMaximo!,
      precoMinimo: precoMinimo!,
      precoMedio: precoMedio!,
      precoFechamento: precoFechamento!,
      totalNegocios: totalNegocios!,
      quantidadeTotal: quantidadeTotal!,
      volumeFinanceiro: volumeFinanceiro!,
      fatorCotacao: fatorCotacao!,
    },
  };
}

function montarFiltro(tickers?: readonly string[]): Set<string> | null {
  return tickers?.length
    ? new Set(tickers.map((t) => t.trim().toUpperCase()))
    : null;
}

function acumular(
  interpretacao: Interpretacao,
  numeroLinha: number,
  acc: { cotacoes: CotacaoBruta[]; rejeitadas: LinhaRejeitada[]; ignoradas: number },
): void {
  if (interpretacao.tipo === "cotacao") acc.cotacoes.push(interpretacao.cotacao);
  else if (interpretacao.tipo === "ignorada") acc.ignoradas += 1;
  else acc.rejeitadas.push({ numeroLinha, motivo: interpretacao.motivo });
}

/**
 * Interpreta o COTAHIST a partir de texto. Use apenas com conteúdo pequeno —
 * o arquivo anual não cabe em uma string.
 */
export function parseCotahist(
  conteudo: string,
  tickers?: readonly string[],
): ResultadoParse {
  const filtro = montarFiltro(tickers);
  const acc = { cotacoes: [] as CotacaoBruta[], rejeitadas: [] as LinhaRejeitada[], ignoradas: 0 };

  const linhas = conteudo.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i += 1) {
    if (linhas[i].trim() === "") continue;
    acumular(interpretarLinha(linhas[i], filtro), i + 1, acc);
  }

  return { ...acc, versaoParser: VERSAO_PARSER };
}

/**
 * Interpreta o COTAHIST direto do buffer, uma linha por vez.
 *
 * É o caminho usado pelo coletor: o arquivo anual descompactado ultrapassa o
 * limite de string do Node, então nunca o convertemos por inteiro.
 */
export function parseCotahistBuffer(
  buffer: Buffer,
  tickers?: readonly string[],
): ResultadoParse {
  const filtro = montarFiltro(tickers);
  const acc = { cotacoes: [] as CotacaoBruta[], rejeitadas: [] as LinhaRejeitada[], ignoradas: 0 };

  const QUEBRA = 0x0a;
  let inicio = 0;
  let numeroLinha = 0;

  while (inicio < buffer.length) {
    let fim = buffer.indexOf(QUEBRA, inicio);
    if (fim === -1) fim = buffer.length;

    let fimReal = fim;
    if (fimReal > inicio && buffer[fimReal - 1] === 0x0d) fimReal -= 1; // CR

    numeroLinha += 1;
    if (fimReal > inicio) {
      const linha = buffer.toString("latin1", inicio, fimReal);
      if (linha.trim() !== "") {
        acumular(interpretarLinha(linha, filtro), numeroLinha, acc);
      }
    }

    inicio = fim + 1;
  }

  return { ...acc, versaoParser: VERSAO_PARSER };
}
