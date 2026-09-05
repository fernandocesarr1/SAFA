/**
 * Parser do COTAHIST. Converte linhas de largura fixa em cotações tipadas.
 *
 * Regras que este parser NÃO viola:
 * - não estima, não interpola e não preenche lacuna nenhuma (`AGENTS.md` §12);
 * - não arredonda para mais casas do que a fonte tem (§13);
 * - linha malformada vira rejeição explícita, nunca um registro silencioso.
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

/**
 * Interpreta o conteúdo de um COTAHIST já descompactado.
 *
 * @param conteudo texto do arquivo (latin1 ou utf8 — só usamos dígitos e A-Z)
 * @param tickers  se informado, mantém apenas estes códigos de negociação
 */
export function parseCotahist(
  conteudo: string,
  tickers?: readonly string[],
): ResultadoParse {
  const filtro = tickers?.length
    ? new Set(tickers.map((t) => t.trim().toUpperCase()))
    : null;

  const cotacoes: CotacaoBruta[] = [];
  const rejeitadas: LinhaRejeitada[] = [];
  let ignoradas = 0;

  const linhas = conteudo.split(/\r?\n/);

  for (let i = 0; i < linhas.length; i += 1) {
    const linha = linhas[i];
    if (linha.trim() === "") continue;

    const numeroLinha = i + 1;

    if (linha.length !== COTAHIST_TAMANHO_REGISTRO) {
      // header (00) e trailer (99) têm 245 tambem; comprimento errado é defeito
      rejeitadas.push({
        numeroLinha,
        motivo: `comprimento ${linha.length}, esperado ${COTAHIST_TAMANHO_REGISTRO}`,
      });
      continue;
    }

    if (fatia(linha, "tipoRegistro") !== TIPO_REGISTRO_COTACAO) {
      ignoradas += 1;
      continue;
    }

    const bdi = fatia(linha, "codigoBdi");
    const mercado = fatia(linha, "tipoMercado");
    const ticker = fatia(linha, "codigoNegociacao").trim().toUpperCase();

    if (bdi !== CODIGO_BDI_FII || mercado !== TIPO_MERCADO_VISTA) {
      ignoradas += 1;
      continue;
    }

    if (filtro && !filtro.has(ticker)) {
      ignoradas += 1;
      continue;
    }

    const dataPregao = dataIso(fatia(linha, "dataPregao"));
    if (!dataPregao) {
      rejeitadas.push({ numeroLinha, motivo: "data de pregão inválida" });
      continue;
    }

    const precoAbertura = decimal2(fatia(linha, "precoAbertura"));
    const precoMaximo = decimal2(fatia(linha, "precoMaximo"));
    const precoMinimo = decimal2(fatia(linha, "precoMinimo"));
    const precoMedio = decimal2(fatia(linha, "precoMedio"));
    const precoFechamento = decimal2(fatia(linha, "precoFechamento"));
    const volumeFinanceiro = decimal2(fatia(linha, "volumeFinanceiro"));
    const totalNegocios = inteiro(fatia(linha, "totalNegocios"));
    const quantidadeTotal = inteiro(fatia(linha, "quantidadeTotal"));
    const fatorCotacao = inteiro(fatia(linha, "fatorCotacao"));

    const faltando = [
      ["precoAbertura", precoAbertura],
      ["precoMaximo", precoMaximo],
      ["precoMinimo", precoMinimo],
      ["precoMedio", precoMedio],
      ["precoFechamento", precoFechamento],
      ["volumeFinanceiro", volumeFinanceiro],
      ["totalNegocios", totalNegocios],
      ["quantidadeTotal", quantidadeTotal],
      ["fatorCotacao", fatorCotacao],
    ].filter(([, valor]) => valor === null);

    if (faltando.length > 0) {
      rejeitadas.push({
        numeroLinha,
        motivo: `campo numérico inválido: ${faltando.map(([n]) => n).join(", ")}`,
      });
      continue;
    }

    if (precoFechamento === 0 && quantidadeTotal === 0) {
      // pregão sem negócio para o papel: não é cotação, não inventa preço
      ignoradas += 1;
      continue;
    }

    cotacoes.push({
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
    });
  }

  return { cotacoes, rejeitadas, ignoradas, versaoParser: VERSAO_PARSER };
}
