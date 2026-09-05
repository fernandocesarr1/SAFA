import { test } from "node:test";
import assert from "node:assert/strict";

import type { CadastroFundo } from "../lib/coleta/cvm/parser.ts";
import {
  classificarPapel,
  montarIndiceCadastro,
  nomeCompativel,
  normalizarIsin,
  vincular,
} from "../lib/triagem/vinculo.ts";

/**
 * Todos os casos abaixo saíram da medição sobre o mercado inteiro, não de
 * invenção: 133 dos 594 papéis não cruzavam, e cada teste trava uma das causas.
 */

function fundo(over: Partial<CadastroFundo> & { cnpj: string }): CadastroFundo {
  return {
    dataReferencia: "2026-06-30",
    nome: "FUNDO TESTE",
    isin: "",
    segmento: "",
    mandato: "",
    tipoGestao: "",
    publicoAlvo: "INVESTIDORES EM GERAL",
    negociadoEmBolsa: true,
    administrador: "",
    ...over,
  };
}

test('a CVM grava "0" quando não tem ISIN; isso é ausência, não código', () => {
  assert.equal(normalizarIsin("0"), "");
  assert.equal(normalizarIsin("  brmxrfctf001 "), "BRMXRFCTF001");
});

test("direito de subscrição não é cota: a B3 publica os dois no mesmo BDI", () => {
  assert.equal(classificarPapel(["BRMXRFD11M17"]), "direito");
  assert.equal(classificarPapel(["BRRZAKD04M11"]), "direito");
  assert.equal(classificarPapel(["BRMXRFCTF001"]), "cota");
});

test("na dúvida entre direito e cota, o papel é cota", () => {
  // um ticker que já negociou como cota e como direito não é descartável
  assert.equal(classificarPapel(["BRRBRXD02M17", "BRRBRXCTF003"]), "cota");
  assert.equal(classificarPapel([]), "cota");
});

test("ISIN exato é o primeiro degrau e não deixa nota", () => {
  const i = montarIndiceCadastro([fundo({ cnpj: "1", isin: "BRMXRFCTF001" })]);
  const v = vincular(i, { isins: ["BRMXRFCTF001"], nomeResumido: "MAXI REN" });
  assert.ok(v.vinculado);
  assert.equal(v.metodo, "isin_exato");
  assert.equal(v.nota, null);
});

test("o sufixo do ISIN numera a emissão; o prefixo identifica o fundo", () => {
  // caso real: XPHT11 negocia BRXPHTCTF003, a CVM registra BRXPHTCTF011
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRXPHTCTF011", nome: "XP HOTEIS FII" }),
  ]);
  const v = vincular(i, { isins: ["BRXPHTCTF003"], nomeResumido: "XP HOTEIS" });
  assert.ok(v.vinculado);
  assert.equal(v.metodo, "isin_prefixo");
  assert.match(v.nota ?? "", /emissão diferente/);
});

test("prefixo ambíguo não escolhe: dois fundos no mesmo prefixo suspendem o vínculo", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRXPHTCTF011", nome: "XP HOTEIS I" }),
    fundo({ cnpj: "2", isin: "BRXPHTCTF029", nome: "XP HOTEIS II" }),
  ]);
  const v = vincular(i, { isins: ["BRXPHTCTF003"], nomeResumido: "XP HOTEIS" });
  assert.equal(v.vinculado, false);
  assert.match(v.motivo, /ambíguo/);
});

test("nome resumido come vogais: subsequência casa onde prefixo falharia", () => {
  // caso real: BTCI11 negocia BRBTCICTF005 e está na CVM como BRFEXCCTF007
  assert.ok(nomeCompativel("BTG CRD IMOB", "BTG CRÉDITO IMOB FII"));
  assert.ok(!"CREDITO".startsWith("CRD")); // o motivo de prefixo não servir
});

test("vínculo por nome é registrado como tal, nunca confundido com ISIN", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRFEXCCTF007", nome: "BTG CRÉDITO IMOB FII" }),
  ]);
  const v = vincular(i, { isins: ["BRBTCICTF005"], nomeResumido: "BTG CRD IMOB" });
  assert.ok(v.vinculado);
  assert.equal(v.metodo, "nome_resumido");
  assert.match(v.nota ?? "", /por nome/);
});

test("uma palavra distintiva só não basta: casaria com a casa inteira", () => {
  // "BTG" sozinho: há dezenas de fundos BTG no cadastro
  assert.ok(!nomeCompativel("BTG FII", "BTG CRÉDITO IMOB FII"));
  assert.ok(!nomeCompativel("FII", "QUALQUER FUNDO FII"));
});

test("nome ambíguo suspende em vez de sortear", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRAAAACTF001", nome: "BTG CRÉDITO IMOBILIÁRIO I" }),
    fundo({ cnpj: "2", isin: "BRBBBBCTF001", nome: "BTG CRÉDITO IMOBILIÁRIO II" }),
  ]);
  const v = vincular(i, { isins: ["BRBTCICTF005"], nomeResumido: "BTG CRD IMOB" });
  assert.equal(v.vinculado, false);
  assert.match(v.motivo, /ambíguo/);
});

test("a ordem das palavras importa: nome trocado não casa", () => {
  assert.ok(!nomeCompativel("IMOB CRD BTG", "BTG CRÉDITO IMOB FII"));
});

test("sem nenhum degrau, o motivo nomeia as duas chaves que falharam", () => {
  const i = montarIndiceCadastro([fundo({ cnpj: "1", isin: "BRZZZZCTF001" })]);
  const v = vincular(i, { isins: ["BRMXRFCTF001"], nomeResumido: "MAXI REN" });
  assert.equal(v.vinculado, false);
  assert.match(v.motivo, /BRMXRFCTF001/);
  assert.match(v.motivo, /MAXI REN/);
});

test("cadastro repetido por mês colapsa no registro mais recente", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRMXRFCTF001", nome: "NOME ANTIGO", dataReferencia: "2024-01-31" }),
    fundo({ cnpj: "1", isin: "BRMXRFCTF001", nome: "NOME NOVO", dataReferencia: "2026-06-30" }),
  ]);
  const v = vincular(i, { isins: ["BRMXRFCTF001"], nomeResumido: "X" });
  assert.ok(v.vinculado);
  assert.equal(v.cadastro.nome, "NOME NOVO");
});

test("ISIN exato dispensa corroboração: é chave, não indício", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRMXRFCTF001", nome: "NADA A VER COM O NOME" }),
  ]);
  const v = vincular(i, { isins: ["BRMXRFCTF001"], nomeResumido: "MAXI REN" });
  assert.ok(v.vinculado);
  assert.equal(v.confianca, "confirmado");
});

test("prefixo corroborado pelo nome vira confirmado", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRLFTTCTF020", nome: "LOFT II D FII RL" }),
  ]);
  const v = vincular(i, { isins: ["BRLFTTCTF004"], nomeResumido: "FII LOFT II" });
  assert.ok(v.vinculado);
  assert.equal(v.confianca, "confirmado");
});

test("prefixo que o nome contradiz continua vinculado, mas a confirmar", () => {
  // caso real: FATN11 negocia como "FII ATHENA I" e o prefixo leva ao BRC
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRFATNCTF019", nome: "BRC RENDA CORPORATIVA FII" }),
  ]);
  const v = vincular(i, { isins: ["BRFATNCTF001"], nomeResumido: "FII ATHENA I" });
  assert.ok(v.vinculado);
  assert.equal(v.confianca, "a_confirmar");
  assert.match(v.nota ?? "", /não corrobora/);
});

test("vínculo só por nome nunca é confirmado", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRFEXCCTF007", nome: "BTG CRÉDITO IMOB FII" }),
  ]);
  const v = vincular(i, { isins: ["BRBTCICTF005"], nomeResumido: "BTG CRD IMOB" });
  assert.ok(v.vinculado);
  assert.equal(v.confianca, "a_confirmar");
});

test("o índice guarda todos os ISINs do fundo, não só o do último informe", () => {
  // a CVM pode trocar o ISIN do fundo entre competências; indexar apenas o
  // registro mais recente perdia o papel que ainda negocia sob o código antigo
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRVELHCTF001", nome: "FUNDO X", dataReferencia: "2024-01-31" }),
    fundo({ cnpj: "1", isin: "BRNOVOCTF001", nome: "FUNDO X", dataReferencia: "2026-06-30" }),
  ]);

  for (const isin of ["BRVELHCTF001", "BRNOVOCTF001"]) {
    const v = vincular(i, { isins: [isin], nomeResumido: "FUNDO X" });
    assert.ok(v.vinculado, `${isin} deveria cruzar`);
    assert.equal(v.metodo, "isin_exato");
    assert.equal(v.cadastro.dataReferencia, "2026-06-30");
  }
});

test("um fundo com vários ISINs não vira ambiguidade de prefixo consigo mesmo", () => {
  const i = montarIndiceCadastro([
    fundo({ cnpj: "1", isin: "BRXPHTCTF003", dataReferencia: "2024-01-31" }),
    fundo({ cnpj: "1", isin: "BRXPHTCTF011", dataReferencia: "2026-06-30" }),
  ]);
  const v = vincular(i, { isins: ["BRXPHTCTF029"], nomeResumido: "FII XPHT" });
  assert.ok(v.vinculado);
  assert.equal(v.metodo, "isin_prefixo");
});

test("a CVM grava ticker na coluna de ISIN; forma inválida é ausência", () => {
  // caso real: CNPJ 18.308.516/0001-63 em 2023-01 traz Codigo_ISIN = "XPTH12"
  assert.equal(normalizarIsin("XPTH12"), "");
  assert.equal(normalizarIsin("BRXPHTCTF011"), "BRXPHTCTF011");
  assert.equal(normalizarIsin("BRXPHTCTF01"), ""); // curto demais
  assert.equal(normalizarIsin("BRXPHTCTF01X"), ""); // sem dígito verificador
});
