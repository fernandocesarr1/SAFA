/**
 * FNET (Fundos.NET, da B3) — busca de documentos regulatórios.
 *
 * É a fonte PRIMÁRIA do provento por cota: o próprio administrador declara ali
 * o "Aviso aos Cotistas - Estruturado", tipo "Rendimentos e Amortizações", com
 * data-base, valor por cota e data de pagamento.
 *
 * Isso corrige a fragilidade central da triagem, que hoje deriva a renda de
 * `dividend_yield_mes × valor_patrimonial_cota` do informe da CVM, sem que a
 * base do yield esteja documentada.
 *
 * Endpoints observados em 2026-09-05, não documentados publicamente pela B3.
 * Se mudarem, o coletor falha alto — nunca devolve renda inventada.
 */

export const FNET_BASE = "https://fnet.bmfbovespa.com.br/fnet/publico";

/** Categoria "Aviso aos Cotistas - Estruturado", onde moram os proventos. */
export const CATEGORIA_AVISO_ESTRUTURADO = 14;

/** Fundo imobiliário. */
export const TIPO_FUNDO_FII = 1;

export const VERSAO_PARSER_FNET = "fnet-1.0.0";

export type DocumentoFnet = {
  id: number;
  cnpjFundo: string | null;
  nomePregao: string | null;
  descricaoFundo: string | null;
  tipoDocumento: string;
  categoriaDocumento: string;
  /** DD/MM/AAAA */
  dataReferencia: string;
  /** DD/MM/AAAA HH:MM */
  dataEntrega: string;
  versao: number;
};

export type OpcoesBusca = {
  /** Quantos documentos por página. O serviço aceita valores altos. */
  tamanhoPagina?: number;
  /** Deslocamento, para paginar. */
  inicio?: number;
  categoria?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class FalhaFnet extends Error {
  url: string;
  constructor(mensagem: string, url: string) {
    super(mensagem);
    this.name = "FalhaFnet";
    this.url = url;
  }
}

function montarUrlBusca(o: OpcoesBusca): string {
  const parametros = new URLSearchParams({
    d: "0",
    s: String(o.inicio ?? 0),
    l: String(o.tamanhoPagina ?? 100),
    "o[0][dataEntrega]": "desc",
    tipoFundo: String(TIPO_FUNDO_FII),
    idCategoriaDocumento: String(o.categoria ?? CATEGORIA_AVISO_ESTRUTURADO),
  });
  return `${FNET_BASE}/pesquisarGerenciadorDocumentosDados?${parametros}`;
}

/** Uma página de documentos, com o total declarado pelo serviço. */
export async function buscarDocumentos(
  opcoes: OpcoesBusca = {},
): Promise<{ documentos: DocumentoFnet[]; total: number }> {
  const url = montarUrlBusca(opcoes);
  const { timeoutMs = 60_000, fetchImpl = fetch } = opcoes;

  const controlador = new AbortController();
  const alarme = setTimeout(() => controlador.abort(), timeoutMs);

  let resposta: Response;
  try {
    resposta = await fetchImpl(url, {
      signal: controlador.signal,
      headers: { Accept: "application/json", "User-Agent": "SAFA/1.0" },
    });
  } catch (erro) {
    throw new FalhaFnet(
      `falha na busca: ${erro instanceof Error ? erro.message : String(erro)}`,
      url,
    );
  } finally {
    clearTimeout(alarme);
  }

  if (!resposta.ok) throw new FalhaFnet(`resposta ${resposta.status}`, url);

  const corpo = (await resposta.json()) as {
    data?: unknown[];
    recordsTotal?: number;
  };

  if (!Array.isArray(corpo.data)) {
    throw new FalhaFnet("resposta sem o campo 'data'", url);
  }

  const documentos = corpo.data.map((d) => {
    const doc = d as Record<string, unknown>;
    return {
      id: Number(doc.id),
      cnpjFundo: (doc.cnpjFundo as string) ?? null,
      nomePregao: (doc.nomePregao as string) ?? null,
      descricaoFundo: (doc.descricaoFundo as string) ?? null,
      tipoDocumento: String(doc.tipoDocumento ?? "").trim(),
      categoriaDocumento: String(doc.categoriaDocumento ?? "").trim(),
      dataReferencia: String(doc.dataReferencia ?? ""),
      dataEntrega: String(doc.dataEntrega ?? ""),
      versao: Number(doc.versao ?? 1),
    };
  });

  return { documentos, total: Number(corpo.recordsTotal ?? documentos.length) };
}

/** URL do documento. É ela que identifica a fonte, conforme §11. */
export function urlDocumento(id: number): string {
  return `${FNET_BASE}/exibirDocumento?id=${id}&cvm=true`;
}

/** Baixa o HTML de um documento estruturado. */
export async function obterDocumento(
  id: number,
  opcoes: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<{ url: string; html: string }> {
  const url = urlDocumento(id);
  const { timeoutMs = 60_000, fetchImpl = fetch } = opcoes;

  const controlador = new AbortController();
  const alarme = setTimeout(() => controlador.abort(), timeoutMs);

  try {
    const resposta = await fetchImpl(url, {
      signal: controlador.signal,
      headers: { "User-Agent": "SAFA/1.0" },
    });
    if (!resposta.ok) throw new FalhaFnet(`resposta ${resposta.status}`, url);
    return { url, html: await resposta.text() };
  } catch (erro) {
    if (erro instanceof FalhaFnet) throw erro;
    throw new FalhaFnet(
      `falha ao obter documento: ${erro instanceof Error ? erro.message : String(erro)}`,
      url,
    );
  } finally {
    clearTimeout(alarme);
  }
}
