/**
 * Download com procedência.
 *
 * Todo arquivo que entra no SAFA passa por aqui, e sai com o que o §12 exige:
 * URL exata, nome, SHA-256 do byte bruto, momento da obtenção e o que a fonte
 * declarou sobre quando gerou o conteúdo.
 *
 * O hash é do arquivo COMO BAIXADO, antes de descompactar ou interpretar. É o
 * que permite alguém repetir a coleta e provar que obteve o mesmo material.
 */

import { createHash } from "node:crypto";

export type ArquivoBaixado = {
  urlFonte: string;
  nomeArquivo: string;
  hashSha256: string;
  obtidoEm: string;
  /** `Last-Modified` da resposta, quando a fonte informa. */
  geradoEm: string | null;
  conteudo: Buffer;
  tamanhoBytes: number;
};

export class FalhaDownload extends Error {
  // campos declarados explicitamente: "parameter properties" não sobrevivem ao
  // strip-types do Node, que é como estes módulos rodam
  url: string;
  status: number | undefined;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = "FalhaDownload";
    this.url = url;
    this.status = status;
  }
}

function nomeDaUrl(url: string): string {
  const { pathname } = new URL(url);
  const ultimo = pathname.split("/").filter(Boolean).pop();
  return ultimo || "download";
}

export type OpcoesDownload = {
  /** Milissegundos até desistir. Padrão 120s: os arquivos da B3 são grandes. */
  timeoutMs?: number;
  /** Tamanho máximo aceito, para não estourar memória sem perceber. */
  maxBytes?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Baixa um arquivo e devolve conteúdo com linhagem.
 *
 * Não tenta se recuperar de erro: falha alto. Um coletor que "dá um jeito"
 * quando a fonte responde errado é como dado sem procedência entra.
 */
export async function baixarArquivo(
  url: string,
  opcoes: OpcoesDownload = {},
): Promise<ArquivoBaixado> {
  const {
    timeoutMs = 120_000,
    maxBytes = 512 * 1024 * 1024,
    fetchImpl = fetch,
  } = opcoes;

  const controlador = new AbortController();
  const alarme = setTimeout(() => controlador.abort(), timeoutMs);

  let resposta: Response;
  try {
    resposta = await fetchImpl(url, {
      signal: controlador.signal,
      redirect: "follow",
    });
  } catch (erro) {
    throw new FalhaDownload(
      `falha ao buscar: ${erro instanceof Error ? erro.message : String(erro)}`,
      url,
    );
  } finally {
    clearTimeout(alarme);
  }

  if (!resposta.ok) {
    throw new FalhaDownload(`resposta ${resposta.status}`, url, resposta.status);
  }

  const declarado = Number(resposta.headers.get("content-length") ?? "0");
  if (declarado > maxBytes) {
    throw new FalhaDownload(
      `arquivo declara ${declarado} bytes, acima do limite de ${maxBytes}`,
      url,
    );
  }

  const conteudo = Buffer.from(await resposta.arrayBuffer());

  if (conteudo.length === 0) {
    throw new FalhaDownload("arquivo vazio", url);
  }
  if (conteudo.length > maxBytes) {
    throw new FalhaDownload(
      `arquivo tem ${conteudo.length} bytes, acima do limite de ${maxBytes}`,
      url,
    );
  }

  const lastModified = resposta.headers.get("last-modified");
  const geradoEm = lastModified ? new Date(lastModified) : null;

  return {
    urlFonte: url,
    nomeArquivo: nomeDaUrl(url),
    hashSha256: createHash("sha256").update(conteudo).digest("hex"),
    obtidoEm: new Date().toISOString(),
    geradoEm:
      geradoEm && !Number.isNaN(geradoEm.getTime()) ? geradoEm.toISOString() : null,
    conteudo,
    tamanhoBytes: conteudo.length,
  };
}
