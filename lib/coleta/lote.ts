/**
 * Lote de importação: a linhagem de todo dado que entra no SAFA.
 *
 * `AGENTS.md` §12 exige que série temporal só entre por coleta programática
 * reproduzível, registrada como lote. Este módulo define o que um lote precisa
 * carregar para que o dado seja verificável — e o que o torna inválido.
 *
 * O D1 existe porque 1.830 preços entraram sem nada disso.
 */

export type StatusLote = "staging" | "validated" | "rejected" | "active";

export type Lote = {
  /** URL exata do arquivo. Página de índice ou portal NÃO é fonte (§11). */
  urlFonte: string;
  /** Nome do arquivo como veio da origem. */
  nomeArquivo: string;
  /** SHA-256 do arquivo bruto, antes de qualquer transformação. */
  hashSha256: string;
  /** Quando o arquivo foi baixado (ISO 8601 UTC). */
  obtidoEm: string;
  /** Data de geração declarada pela fonte, quando existir. */
  geradoEm: string | null;
  versaoParser: string;
  quantidadeRegistros: number;
  quantidadeRejeitadas: number;
  status: StatusLote;
  /** Falhas de validação. Lote com falha não vira `validated`. */
  problemas: string[];
};

export type EntradaLote = Omit<Lote, "status" | "problemas">;

/** Uma URL só é fonte se identifica o arquivo, não a página que lista arquivos. */
export function urlIdentificaArquivo(url: string): boolean {
  try {
    const { pathname, search } = new URL(url);
    if (/\.(zip|csv|txt|pdf|xlsx?|json)$/i.test(pathname)) return true;
    // aceita query que nomeie um documento específico (ex.: id do FNET)
    return /(?:^|[?&])(id|documento|arquivo|file)=[^&]+/i.test(search);
  } catch {
    return false;
  }
}

const HASH_SHA256 = /^[0-9a-f]{64}$/;

/**
 * Valida o lote. Devolve o mesmo lote com status e problemas preenchidos.
 *
 * Nunca promove a `active` por conta própria: `validated` é o máximo que a
 * validação automática concede. Ativar é decisão de quem opera.
 */
export function validarLote(entrada: EntradaLote): Lote {
  const problemas: string[] = [];

  if (!urlIdentificaArquivo(entrada.urlFonte)) {
    problemas.push(
      "urlFonte não identifica um arquivo — página de índice não é fonte (§11)",
    );
  }
  if (!HASH_SHA256.test(entrada.hashSha256)) {
    problemas.push("hashSha256 ausente ou fora do formato sha-256");
  }
  if (!entrada.nomeArquivo.trim()) {
    problemas.push("nomeArquivo vazio");
  }
  if (!entrada.versaoParser.trim()) {
    problemas.push("versaoParser ausente — sem ela o parse não é reproduzível");
  }
  if (!Number.isInteger(entrada.quantidadeRegistros) || entrada.quantidadeRegistros < 0) {
    problemas.push("quantidadeRegistros inválida");
  }
  if (entrada.quantidadeRegistros === 0) {
    problemas.push("lote sem registros — o desfecho correto é insufficient_data (§12)");
  }
  if (Number.isNaN(Date.parse(entrada.obtidoEm))) {
    problemas.push("obtidoEm não é data ISO válida");
  }
  if (entrada.geradoEm !== null && Number.isNaN(Date.parse(entrada.geradoEm))) {
    problemas.push("geradoEm não é data ISO válida");
  }

  return {
    ...entrada,
    status: problemas.length === 0 ? "validated" : "rejected",
    problemas,
  };
}

/** Só lote validado ou ativo pode alimentar gate e cálculo (§12). */
export function podeAlimentarCalculo(lote: Lote): boolean {
  return lote.status === "validated" || lote.status === "active";
}
