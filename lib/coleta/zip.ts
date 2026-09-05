/**
 * Leitor de ZIP mínimo, sobre o zlib do próprio Node.
 *
 * COTAHIST e os dados abertos da CVM vêm em ZIP, e o Node não traz leitor
 * nativo. Uma dependência externa aqui seria mais código não auditado no
 * caminho de dados que precisa ser confiável — então lemos o formato, que é
 * simples para o caso de uso: arquivos pequenos em número, sem criptografia,
 * armazenados ou deflacionados.
 *
 * Lê pelo Diretório Central, não varrendo cabeçalhos locais: é o índice
 * autoritativo do arquivo e evita interpretar lixo como entrada.
 */

import { inflateRawSync } from "node:zlib";

const ASSINATURA_EOCD = 0x06054b50;
const ASSINATURA_EOCD64_LOCALIZADOR = 0x07064b50;
const ASSINATURA_DIRETORIO = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

const METODO_ARMAZENADO = 0;
const METODO_DEFLATE = 8;

export class ZipInvalido extends Error {}

export type EntradaZip = {
  nome: string;
  tamanhoComprimido: number;
  tamanhoOriginal: number;
  metodo: number;
  deslocamentoLocal: number;
};

/** Procura o End of Central Directory, que fica no fim e tem tamanho variável. */
function acharEocd(buffer: Buffer): number {
  // comentário do zip pode ter até 65535 bytes
  const limite = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= limite; i -= 1) {
    if (buffer.readUInt32LE(i) === ASSINATURA_EOCD) return i;
  }
  throw new ZipInvalido("EOCD não encontrado — arquivo não é ZIP ou está truncado");
}

/**
 * Lista as entradas do ZIP.
 *
 * Suporta ZIP64 apenas no que importa aqui: quando os campos de 32 bits vêm
 * saturados (0xffffffff), o arquivo excede os limites clássicos e recusamos
 * explicitamente em vez de devolver deslocamento errado.
 */
export function listarEntradas(buffer: Buffer): EntradaZip[] {
  const eocd = acharEocd(buffer);

  const totalEntradas = buffer.readUInt16LE(eocd + 10);
  const inicioDiretorio = buffer.readUInt32LE(eocd + 16);

  if (inicioDiretorio === 0xffffffff || totalEntradas === 0xffff) {
    // o localizador ZIP64 fica logo antes do EOCD
    const localizador = eocd - 20;
    if (
      localizador >= 0 &&
      buffer.readUInt32LE(localizador) === ASSINATURA_EOCD64_LOCALIZADOR
    ) {
      throw new ZipInvalido(
        "ZIP64 não suportado por este leitor — arquivo grande demais para o caminho previsto",
      );
    }
    throw new ZipInvalido("diretório central com campos saturados e sem registro ZIP64");
  }

  const entradas: EntradaZip[] = [];
  let posicao = inicioDiretorio;

  for (let i = 0; i < totalEntradas; i += 1) {
    if (posicao + 46 > buffer.length) {
      throw new ZipInvalido("diretório central truncado");
    }
    if (buffer.readUInt32LE(posicao) !== ASSINATURA_DIRETORIO) {
      throw new ZipInvalido(`entrada ${i} do diretório com assinatura inválida`);
    }

    const metodo = buffer.readUInt16LE(posicao + 10);
    const tamanhoComprimido = buffer.readUInt32LE(posicao + 20);
    const tamanhoOriginal = buffer.readUInt32LE(posicao + 24);
    const tamanhoNome = buffer.readUInt16LE(posicao + 28);
    const tamanhoExtra = buffer.readUInt16LE(posicao + 30);
    const tamanhoComentario = buffer.readUInt16LE(posicao + 32);
    const deslocamentoLocal = buffer.readUInt32LE(posicao + 42);

    if (
      tamanhoComprimido === 0xffffffff ||
      tamanhoOriginal === 0xffffffff ||
      deslocamentoLocal === 0xffffffff
    ) {
      throw new ZipInvalido(
        `entrada "${buffer.toString("utf8", posicao + 46, posicao + 46 + tamanhoNome)}" exige ZIP64`,
      );
    }

    entradas.push({
      nome: buffer.toString("utf8", posicao + 46, posicao + 46 + tamanhoNome),
      tamanhoComprimido,
      tamanhoOriginal,
      metodo,
      deslocamentoLocal,
    });

    posicao += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }

  return entradas;
}

/** Extrai uma entrada. O nome do campo extra local difere do central: releia. */
export function extrair(buffer: Buffer, entrada: EntradaZip): Buffer {
  const inicio = entrada.deslocamentoLocal;
  if (inicio + 30 > buffer.length) {
    throw new ZipInvalido(`cabeçalho local de "${entrada.nome}" fora do arquivo`);
  }
  if (buffer.readUInt32LE(inicio) !== ASSINATURA_LOCAL) {
    throw new ZipInvalido(`cabeçalho local de "${entrada.nome}" com assinatura inválida`);
  }

  const tamanhoNome = buffer.readUInt16LE(inicio + 26);
  const tamanhoExtra = buffer.readUInt16LE(inicio + 28);
  const dados = inicio + 30 + tamanhoNome + tamanhoExtra;
  const fim = dados + entrada.tamanhoComprimido;

  if (fim > buffer.length) {
    throw new ZipInvalido(`dados de "${entrada.nome}" truncados`);
  }

  const bruto = buffer.subarray(dados, fim);

  if (entrada.metodo === METODO_ARMAZENADO) return Buffer.from(bruto);
  if (entrada.metodo === METODO_DEFLATE) return inflateRawSync(bruto);

  throw new ZipInvalido(
    `método de compressão ${entrada.metodo} não suportado em "${entrada.nome}"`,
  );
}

/** Extrai todas as entradas cujo nome passe no filtro. */
export function extrairArquivos(
  buffer: Buffer,
  filtro?: (nome: string) => boolean,
): { nome: string; conteudo: Buffer }[] {
  return listarEntradas(buffer)
    .filter((e) => !e.nome.endsWith("/") && (filtro ? filtro(e.nome) : true))
    .map((e) => ({ nome: e.nome, conteudo: extrair(buffer, e) }));
}
