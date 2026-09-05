/**
 * Coletor COTAHIST: baixa, descompacta, interpreta e devolve com linhagem.
 *
 * O arquivo anual da B3 traz TODOS os papéis do ano. Filtrado por `CODBDI=12`
 * e mercado à vista, ele entrega de uma vez o universo de FIIs negociados e a
 * série de preços de cada um — que é a razão de ser a primeira fonte do funil.
 */

import { baixarArquivo, type OpcoesDownload } from "../download.ts";
import { validarLote, type Lote } from "../lote.ts";
import { extrairArquivos } from "../zip.ts";
import {
  parseCotahistBuffer,
  VERSAO_PARSER,
  type CotacaoBruta,
} from "./parser.ts";

export const URL_BASE_COTAHIST =
  "https://bvmf.bmfbovespa.com.br/InstDados/SerHist";

export function urlCotahistAnual(ano: number): string {
  return `${URL_BASE_COTAHIST}/COTAHIST_A${ano}.ZIP`;
}

export type ResultadoColeta = {
  lote: Lote;
  cotacoes: CotacaoBruta[];
  /** Tickers distintos encontrados — o universo negociado no período. */
  universo: string[];
};

export type OpcoesColeta = OpcoesDownload & {
  /** Restringe a estes tickers. Sem isso, traz o mercado inteiro. */
  tickers?: readonly string[];
};

/**
 * Coleta um ano inteiro de COTAHIST.
 *
 * O lote sai com o hash do ZIP como baixado. Se a validação reprovar, o lote
 * volta com `status: "rejected"` e os problemas — e nada disso deve alimentar
 * cálculo (§12).
 */
export async function coletarAnoCotahist(
  ano: number,
  opcoes: OpcoesColeta = {},
): Promise<ResultadoColeta> {
  const url = urlCotahistAnual(ano);
  const arquivo = await baixarArquivo(url, opcoes);

  const internos = extrairArquivos(arquivo.conteudo, (nome) =>
    /\.txt$/i.test(nome),
  );
  if (internos.length === 0) {
    throw new Error(`ZIP de ${url} não contém arquivo .TXT`);
  }

  const cotacoes: CotacaoBruta[] = [];
  let rejeitadas = 0;

  for (const interno of internos) {
    // direto do buffer: o arquivo anual não cabe em uma string do Node
    const resultado = parseCotahistBuffer(interno.conteudo, opcoes.tickers);
    cotacoes.push(...resultado.cotacoes);
    rejeitadas += resultado.rejeitadas.length;
  }

  const lote = validarLote({
    urlFonte: arquivo.urlFonte,
    nomeArquivo: arquivo.nomeArquivo,
    hashSha256: arquivo.hashSha256,
    obtidoEm: arquivo.obtidoEm,
    geradoEm: arquivo.geradoEm,
    versaoParser: VERSAO_PARSER,
    quantidadeRegistros: cotacoes.length,
    quantidadeRejeitadas: rejeitadas,
  });

  const universo = [...new Set(cotacoes.map((c) => c.ticker))].sort();

  return { lote, cotacoes, universo };
}

/** Agrupa cotações por ticker, em ordem cronológica. */
export function porTicker(
  cotacoes: readonly CotacaoBruta[],
): Map<string, CotacaoBruta[]> {
  const mapa = new Map<string, CotacaoBruta[]>();
  for (const c of cotacoes) {
    const lista = mapa.get(c.ticker);
    if (lista) lista.push(c);
    else mapa.set(c.ticker, [c]);
  }
  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.dataPregao.localeCompare(b.dataPregao));
  }
  return mapa;
}

/** Índice ISIN -> ticker, que é a ponte com o cadastro da CVM. */
export function indiceIsin(cotacoes: readonly CotacaoBruta[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const c of cotacoes) {
    if (c.codigoIsin) mapa.set(c.codigoIsin, c.ticker);
  }
  return mapa;
}
