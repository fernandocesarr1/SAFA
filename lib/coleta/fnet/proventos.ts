/**
 * Parser do "Informações sobre Pagamento de Proventos" do FNET.
 *
 * O documento é HTML gerado por formulário estruturado, e um mesmo documento
 * pode declarar várias classes de cota — cada uma com seu código de negociação
 * e seus valores. Cada bloco vira um provento.
 *
 * A distinção que este parser preserva e que a renda derivada da CVM perde:
 * **rendimento não é amortização**. Amortização é devolução de capital; tratá-la
 * como renda recorrente infla o yield e faz um fundo em liquidação parecer
 * generoso. Aqui elas saem em campos separados, e quem consome decide.
 */

export const VERSAO_PARSER_PROVENTOS = "fnet-proventos-1.0.0";

export type Provento = {
  ticker: string;
  isin: string;
  cnpj: string | null;
  nomeFundo: string | null;
  /** AAAA-MM-DD — último dia de negociação "com" direito. */
  dataBase: string | null;
  dataPagamento: string | null;
  periodoReferencia: string | null;
  /** Renda por cota. Null quando o documento não declara. */
  rendimentoPorCota: number | null;
  /** Devolução de capital por cota. NÃO é renda. */
  amortizacaoPorCota: number | null;
};

export class ProventoInvalido extends Error {}

const ENTIDADES: Record<string, string> = {
  "&ccedil;": "ç", "&otilde;": "õ", "&atilde;": "ã", "&aacute;": "á",
  "&eacute;": "é", "&iacute;": "í", "&oacute;": "ó", "&uacute;": "ú",
  "&ecirc;": "ê", "&acirc;": "â", "&ocirc;": "ô", "&Aacute;": "Á",
  "&Eacute;": "É", "&Iacute;": "Í", "&Oacute;": "Ó", "&Uacute;": "Ú",
  "&Ccedil;": "Ç", "&nbsp;": " ", "&amp;": "&", "&ldquo;": '"', "&rdquo;": '"',
  "&ordm;": "º", "&deg;": "°",
};

function decodificar(texto: string): string {
  let saida = texto;
  for (const [entidade, caractere] of Object.entries(ENTIDADES)) {
    saida = saida.split(entidade).join(caractere);
  }
  return saida.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** HTML -> linhas de texto, preservando a separação por célula. */
function paraLinhas(html: string): string[] {
  return decodificar(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/t[dh]>/gi, "\u0001")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0);
}

/** "1.234,56" ou "2,660496" -> número. Vazio ou traço -> null. */
function valorBr(texto: string | undefined): number | null {
  if (!texto) return null;
  const limpo = texto.trim().replace(/^R\$\s*/i, "");
  if (limpo === "" || limpo === "-") return null;
  const normalizado = limpo.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** "04/09/2026" -> "2026-09-04". */
function dataBr(texto: string | undefined): string | null {
  if (!texto) return null;
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Células de uma linha rotulada, na ordem em que aparecem. */
function celulasApos(linhas: string[], indice: number): string[] {
  return (linhas[indice] ?? "")
    .split("\u0001")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function acharValor(linhas: string[], inicio: number, rotulo: RegExp): string[] {
  for (let i = inicio; i < Math.min(linhas.length, inicio + 40); i += 1) {
    if (rotulo.test(linhas[i])) {
      const naMesma = celulasApos(linhas, i).filter((c) => !rotulo.test(c));
      if (naMesma.length > 0) return naMesma;
      // rótulo e valores em linhas separadas, como o FNET costuma emitir
      return celulasApos(linhas, i + 1);
    }
  }
  return [];
}

/**
 * Extrai todos os proventos declarados no documento.
 *
 * Devolve lista vazia quando o documento não é de proventos. Lança quando é,
 * mas o formato mudou — silêncio aqui viraria renda faltando sem ninguém saber.
 */
export function parseProventos(html: string): Provento[] {
  const linhas = paraLinhas(html);
  const texto = linhas.join("\n");

  if (!/Informa..es sobre Pagamento de Proventos|Pagamento de Proventos/i.test(texto)) {
    return [];
  }

  const cnpj = texto.match(/CNPJ do Fundo:\u0001?\s*([\d./-]{14,20})/)?.[1] ?? null;
  const nomeFundo =
    linhas
      .find((l) => /Nome do Fundo:/i.test(l))
      ?.split("\u0001")
      .map((c) => c.trim())
      .filter(Boolean)[1] ?? null;

  const proventos: Provento[] = [];

  for (let i = 0; i < linhas.length; i += 1) {
    if (!/C.digo de negocia..o:/i.test(linhas[i])) continue;

    const celulas = celulasApos(linhas, i);
    const isin =
      celulas.find((c) => /^BR[A-Z0-9]{9,10}$/i.test(c.replace(/\s/g, ""))) ?? "";
    // o ticker vem logo após o rótulo "Código de negociação:"
    const indiceRotulo = celulas.findIndex((c) => /C.digo de negocia..o:/i.test(c));
    const ticker =
      indiceRotulo >= 0 ? (celulas[indiceRotulo + 1] ?? "").toUpperCase() : "";

    if (!/^[A-Z]{4}\d{1,2}$/.test(ticker)) continue;

    const valores = acharValor(linhas, i, /Valor do provento/i);
    const datasBase = acharValor(linhas, i, /Data-base/i);
    const datasPagamento = acharValor(linhas, i, /Data do pagamento/i);
    const periodos = acharValor(linhas, i, /Per.odo de refer.ncia/i);

    // a ordem das colunas é Rendimento e depois Amortização, como o
    // cabeçalho do bloco declara
    proventos.push({
      ticker,
      isin: isin.replace(/\s/g, "").toUpperCase(),
      cnpj,
      nomeFundo,
      dataBase: dataBr(datasBase[0]),
      dataPagamento: dataBr(datasPagamento[0]),
      periodoReferencia: periodos[0] ?? null,
      rendimentoPorCota: valorBr(valores[0]),
      amortizacaoPorCota: valorBr(valores[1]),
    });
  }

  // Documento de proventos sem código de negociação é caso legítimo: fundo não
  // listado em bolsa declara provento do mesmo jeito. Lista vazia, não erro.
  //
  // Já um documento SEM sequer o rótulo do código é formato inesperado, e aí
  // silenciar esconderia renda faltando.
  if (proventos.length === 0 && !/C.digo de negocia..o:/i.test(texto)) {
    throw new ProventoInvalido(
      "documento de proventos sem o rótulo de código de negociação — formato do FNET pode ter mudado",
    );
  }

  return proventos;
}
