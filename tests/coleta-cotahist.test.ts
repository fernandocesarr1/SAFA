import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCotahist, VERSAO_PARSER } from "../lib/coleta/cotahist/parser.ts";
import { CAMPOS, COTAHIST_TAMANHO_REGISTRO } from "../lib/coleta/cotahist/layout.ts";

type Campos = Partial<Record<keyof typeof CAMPOS, string>>;

/** Monta um registro de 245 posições colocando cada campo no seu offset. */
function registro(campos: Campos): string {
  const buffer = Array.from({ length: COTAHIST_TAMANHO_REGISTRO }, () => " ");
  for (const [nome, valor] of Object.entries(campos)) {
    const [inicio, tamanho] = CAMPOS[nome as keyof typeof CAMPOS];
    const texto = String(valor).slice(0, tamanho);
    // numérico alinha à direita com zeros; alfanumérico à esquerda com espaço
    const preenchido = /^\d*$/.test(texto)
      ? texto.padStart(tamanho, "0")
      : texto.padEnd(tamanho, " ");
    for (let i = 0; i < tamanho; i += 1) {
      buffer[inicio - 1 + i] = preenchido[i];
    }
  }
  return buffer.join("");
}

const FII_VALIDO: Campos = {
  tipoRegistro: "01",
  dataPregao: "20260115",
  codigoBdi: "12",
  codigoNegociacao: "TRXF11",
  tipoMercado: "010",
  precoAbertura: "1023",     // R$ 10,23
  precoMaximo: "1050",       // R$ 10,50
  precoMinimo: "1001",       // R$ 10,01
  precoMedio: "1030",        // R$ 10,30
  precoFechamento: "1045",   // R$ 10,45
  totalNegocios: "352",
  quantidadeTotal: "48000",
  volumeFinanceiro: "49440000", // R$ 494.400,00
  fatorCotacao: "1",
  codigoIsin: "BRTRXFCTF001",
};

test("lê preços com as duas casas decimais implícitas", () => {
  const { cotacoes, rejeitadas } = parseCotahist(registro(FII_VALIDO));
  assert.equal(rejeitadas.length, 0);
  assert.equal(cotacoes.length, 1);

  const c = cotacoes[0];
  assert.equal(c.precoAbertura, 10.23);
  assert.equal(c.precoMaximo, 10.5);
  assert.equal(c.precoMinimo, 10.01);
  assert.equal(c.precoFechamento, 10.45);
  assert.equal(c.dataPregao, "2026-01-15");
  assert.equal(c.ticker, "TRXF11");
});

test("preço nunca sai com mais de duas casas — é a precisão da fonte (§13)", () => {
  const { cotacoes } = parseCotahist(registro(FII_VALIDO));
  for (const valor of [
    cotacoes[0].precoAbertura,
    cotacoes[0].precoMaximo,
    cotacoes[0].precoMinimo,
    cotacoes[0].precoFechamento,
  ]) {
    const casas = (String(valor).split(".")[1] ?? "").length;
    assert.ok(casas <= 2, `${valor} tem ${casas} casas decimais`);
  }
});

test("volume é financeiro em reais, não contagem de cotas", () => {
  const { cotacoes } = parseCotahist(registro(FII_VALIDO));
  const c = cotacoes[0];
  assert.equal(c.volumeFinanceiro, 494_400);
  assert.equal(c.quantidadeTotal, 48_000);
  // o volume tem que ser compatível com quantidade x preço médio, não igual a ela
  assert.ok(c.volumeFinanceiro > c.quantidadeTotal);
});

test("quantidade e negócios são inteiros (§13)", () => {
  const { cotacoes } = parseCotahist(registro(FII_VALIDO));
  assert.ok(Number.isInteger(cotacoes[0].quantidadeTotal));
  assert.ok(Number.isInteger(cotacoes[0].totalNegocios));
});

test("descarta o que não é FII à vista", () => {
  const acao = registro({ ...FII_VALIDO, codigoBdi: "02", codigoNegociacao: "PETR4" });
  const opcao = registro({ ...FII_VALIDO, tipoMercado: "070" });
  const { cotacoes, ignoradas } = parseCotahist(acao + "\n" + opcao);
  assert.equal(cotacoes.length, 0);
  assert.equal(ignoradas, 2);
});

test("filtra por ticker quando pedido", () => {
  const outro = registro({ ...FII_VALIDO, codigoNegociacao: "GGRC11" });
  const { cotacoes } = parseCotahist(
    registro(FII_VALIDO) + "\n" + outro,
    ["GGRC11"],
  );
  assert.equal(cotacoes.length, 1);
  assert.equal(cotacoes[0].ticker, "GGRC11");
});

test("linha de comprimento errado vira rejeição explícita, não registro silencioso", () => {
  const { cotacoes, rejeitadas } = parseCotahist("01202601151 2TRXF11");
  assert.equal(cotacoes.length, 0);
  assert.equal(rejeitadas.length, 1);
  assert.match(rejeitadas[0].motivo, /comprimento/);
});

test("data inválida é rejeitada, não corrigida", () => {
  const { cotacoes, rejeitadas } = parseCotahist(
    registro({ ...FII_VALIDO, dataPregao: "20260231" }),
  );
  assert.equal(cotacoes.length, 0);
  assert.equal(rejeitadas.length, 1);
  assert.match(rejeitadas[0].motivo, /data/);
});

test("pregão sem negócio não vira preço inventado", () => {
  const { cotacoes, ignoradas } = parseCotahist(
    registro({ ...FII_VALIDO, precoFechamento: "0", quantidadeTotal: "0" }),
  );
  assert.equal(cotacoes.length, 0);
  assert.equal(ignoradas, 1);
});

test("versão do parser acompanha o resultado, para reprodutibilidade (§12)", () => {
  const r = parseCotahist(registro(FII_VALIDO));
  assert.equal(r.versaoParser, VERSAO_PARSER);
  assert.match(r.versaoParser, /^cotahist-\d+\.\d+\.\d+$/);
});
