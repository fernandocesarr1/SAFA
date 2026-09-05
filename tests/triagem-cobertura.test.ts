import { test } from "node:test";
import assert from "node:assert/strict";

import { avaliarSinais, resumirSinais } from "../lib/triagem/deterioracao.ts";
import { classificar } from "../lib/triagem/classificacao.ts";
import { decomporVariacao } from "../lib/triagem/decomposicao.ts";
import { parseCsv, numeroCsv } from "../lib/coleta/csv.ts";
import { listarEntradas, extrair, ZipInvalido } from "../lib/coleta/zip.ts";
import { deflateRawSync } from "node:zlib";

/**
 * Estes testes nasceram de defeitos que só a execução sobre o mercado inteiro
 * revelou. Cada um trava um erro que já aconteceu de verdade.
 */

const QUEDA_POR_YIELD = {
  precoInicial: 100,
  precoFinal: 60,
  rendaInicial: 10,
  rendaFinal: 10,
};

test("cobertura mede só sinais quantitativos, senão o funil nunca produz candidato", () => {
  // com a alavancagem conhecida, a cobertura quantitativa é total, ainda que
  // os seis sinais documentais sigam desconhecidos
  const sinais = avaliarSinais({ alavancagemAtual: 0.1, alavancagemAnterior: 0.1 });
  const resumo = resumirSinais(sinais);

  assert.equal(resumo.cobertura, 1);
  assert.equal(resumo.pendentesDocumentais.length, 6);

  const d = decomporVariacao(QUEDA_POR_YIELD);
  assert.ok(d.ok);
  assert.equal(classificar(d.valor, sinais).classe, "candidato_desconto");
});

test("sem nenhum sinal quantitativo, o desfecho continua sendo dados_insuficientes", () => {
  const d = decomporVariacao(QUEDA_POR_YIELD);
  assert.ok(d.ok);
  const c = classificar(d.valor, avaliarSinais({}));
  assert.equal(c.classe, "dados_insuficientes");
});

test("sinal documental desconhecido vira pendência, nunca aval de que está tudo bem", () => {
  const sinais = avaliarSinais({ alavancagemAtual: 0.1 });
  const d = decomporVariacao(QUEDA_POR_YIELD);
  assert.ok(d.ok);
  const c = classificar(d.valor, sinais);

  assert.equal(c.classe, "candidato_desconto");
  // o candidato carrega as verificações que a triagem não pode fazer
  assert.ok(c.pendencias.some((p) => p.includes("vacância")));
  assert.ok(c.pendencias.some((p) => p.includes("inadimplência")));
  assert.ok(c.pendencias.length >= 6);
});

test("alavancagem alta ainda barra o candidato, mesmo com cobertura total", () => {
  const sinais = avaliarSinais({ alavancagemAtual: 0.55 });
  const d = decomporVariacao(QUEDA_POR_YIELD);
  assert.ok(d.ok);
  assert.equal(classificar(d.valor, sinais).classe, "queda_com_fundamento");
});

test("CSV da CVM usa ponto decimal — tratar como milhar corrompia todo número", () => {
  // valores reais do informe mensal: VP/cota e dividend yield
  assert.equal(numeroCsv("173.93928738435"), 173.93928738435);
  assert.equal(numeroCsv("0.002871"), 0.002871);
  assert.equal(numeroCsv("487055921.63"), 487055921.63);
});

test("formato brasileiro continua funcionando quando aparece", () => {
  assert.equal(numeroCsv("1.234,56"), 1234.56);
  assert.equal(numeroCsv("0,5"), 0.5);
});

test("vazio e inválido viram null, nunca zero (§12)", () => {
  assert.equal(numeroCsv(""), null);
  assert.equal(numeroCsv("-"), null);
  assert.equal(numeroCsv("N/A"), null);
  assert.equal(numeroCsv(undefined), null);
});

test("CSV recusa arquivo sem as colunas esperadas, nomeando o que achou", () => {
  assert.throws(
    () => parseCsv("A;B\n1;2", { colunasObrigatorias: ["A", "Z"] }),
    /colunas ausentes: Z/,
  );
});

/** Monta um ZIP mínimo com uma entrada deflacionada. */
function zipDeUmArquivo(nome: string, conteudo: Buffer): Buffer {
  const nomeBuf = Buffer.from(nome, "utf8");
  const comprimido = deflateRawSync(conteudo);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt32LE(comprimido.length, 18);
  local.writeUInt32LE(conteudo.length, 22);
  local.writeUInt16LE(nomeBuf.length, 26);

  const inicioLocal = 0;
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comprimido.length, 20);
  central.writeUInt32LE(conteudo.length, 24);
  central.writeUInt16LE(nomeBuf.length, 28);
  central.writeUInt32LE(inicioLocal, 42);

  const dados = Buffer.concat([local, nomeBuf, comprimido]);
  const dir = Buffer.concat([central, nomeBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(dados.length, 16);

  return Buffer.concat([dados, dir, eocd]);
}

test("lê ZIP deflacionado sem dependência externa", () => {
  const original = Buffer.from("linha um\nlinha dois\n".repeat(50), "utf8");
  const zip = zipDeUmArquivo("dados.txt", original);

  const entradas = listarEntradas(zip);
  assert.equal(entradas.length, 1);
  assert.equal(entradas[0].nome, "dados.txt");
  assert.deepEqual(extrair(zip, entradas[0]), original);
});

test("ZIP truncado falha alto, não devolve lixo", () => {
  assert.throws(() => listarEntradas(Buffer.from("não é zip")), ZipInvalido);
});
