/**
 * Layout do registro COTAHIST da B3 — arquivo oficial de séries históricas.
 *
 * Registro de 245 posições, campos de largura fixa, 1-indexado conforme o
 * manual da B3. Preços e volume vêm com duas casas decimais IMPLÍCITAS: o
 * arquivo traz "0000000001234" para R$ 12,34.
 *
 * Esta é a única definição do layout no projeto. Se a B3 mudar o arquivo,
 * muda-se aqui e a versão do parser sobe.
 */

export const COTAHIST_TAMANHO_REGISTRO = 245;

/** Início (1-indexado) e tamanho de cada campo usado pelo SAFA. */
export const CAMPOS = {
  tipoRegistro: [1, 2],
  dataPregao: [3, 8],
  codigoBdi: [11, 2],
  codigoNegociacao: [13, 12],
  tipoMercado: [25, 3],
  nomeResumido: [28, 12],
  precoAbertura: [57, 13],
  precoMaximo: [70, 13],
  precoMinimo: [83, 13],
  precoMedio: [96, 13],
  precoFechamento: [109, 13],
  totalNegocios: [148, 5],
  quantidadeTotal: [153, 18],
  volumeFinanceiro: [171, 18],
  fatorCotacao: [211, 7],
  codigoIsin: [231, 12],
} as const satisfies Record<string, readonly [number, number]>;

export type CampoCotahist = keyof typeof CAMPOS;

/** Registro de cotação (o header 00 e o trailer 99 são descartados). */
export const TIPO_REGISTRO_COTACAO = "01";

/** Fundo imobiliário. */
export const CODIGO_BDI_FII = "12";

/** Mercado à vista. */
export const TIPO_MERCADO_VISTA = "010";

/**
 * Preços e volume têm duas casas implícitas. A precisão de saída é 2 casas,
 * como manda `AGENTS.md` §13 para preço bruto da B3 — nunca mais que isso.
 */
export const DIVISOR_PRECO = 100;
