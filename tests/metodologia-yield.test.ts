import { test } from "node:test";
import assert from "node:assert/strict";

import {
  montarYieldExigido,
  valorJustoPorRenda,
  sensibilidade,
  YieldExigidoInvalido,
} from "../lib/metodologia/yield-exigido.ts";
import { validarLote, urlIdentificaArquivo } from "../lib/coleta/lote.ts";

const BASE = {
  ntnbLonga: 0.07,
  fonteNtnb: "Tesouro Direto, NTN-B 2045, fechamento de 2026-01-15",
  premioSegmento: 0.045,
  fonteSegmento: "spread mediano do segmento logístico, apuração interna 2026-01",
};

test("o yield é a soma de componentes nomeados, não um número escolhido", () => {
  const y = montarYieldExigido(BASE);
  assert.ok(Math.abs(y.total - 0.115) < 1e-12);
  assert.equal(y.componentes.length, 2);
  assert.ok(y.componentes.every((c) => c.fonte.length > 0));
});

test("componente sem fonte é recusado — é o defeito do D9", () => {
  assert.throws(
    () => montarYieldExigido({ ...BASE, fonteSegmento: "  " }),
    YieldExigidoInvalido,
  );
});

test("ajustes documentados entram como linhas próprias", () => {
  const y = montarYieldExigido({
    ...BASE,
    ajustes: [
      {
        codigo: "concentracao",
        rotulo: "Prêmio por concentração de inquilino",
        valor: 0.01,
        fonte: "relatório gerencial 12/2025, 38% da receita em um locatário",
      },
    ],
  });
  assert.ok(Math.abs(y.total - 0.125) < 1e-12);
  assert.equal(y.componentes.length, 3);
});

test("valor justo é renda sobre yield, sem termo de crescimento (D10)", () => {
  const y = montarYieldExigido(BASE);
  const vj = valorJustoPorRenda(11.5, y);
  assert.ok(Math.abs(vj - 100) < 1e-9);
});

test("yield fora de faixa plausível é recusado", () => {
  assert.throws(
    () => montarYieldExigido({ ...BASE, premioSegmento: 11.5 }),
    YieldExigidoInvalido,
  );
});

test("sensibilidade mostra que o valor justo é quase só a premissa", () => {
  const y = montarYieldExigido(BASE);
  const linhas = sensibilidade(11.5, y);
  const menor = linhas.find((l) => l.variacaoPp === -1.5)!;
  const maior = linhas.find((l) => l.variacaoPp === 1.5)!;
  assert.ok(menor.valorJusto > maior.valorJusto);
  // 3 pontos percentuais de taxa mexem mais de 20% no valor justo
  assert.ok((menor.valorJusto - maior.valorJusto) / maior.valorJusto > 0.2);
});

test("página de índice não é fonte de lote (§11)", () => {
  assert.equal(urlIdentificaArquivo("https://www.b3.com.br/pt_br/market-data/"), false);
  assert.equal(
    urlIdentificaArquivo("https://bvmf.bmfbovespa.com.br/.../COTAHIST_A2025.ZIP"),
    true,
  );
  assert.equal(
    urlIdentificaArquivo("https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=123456"),
    true,
  );
});

const LOTE_BOM = {
  urlFonte: "https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_A2025.ZIP",
  nomeArquivo: "COTAHIST_A2025.ZIP",
  hashSha256: "a".repeat(64),
  obtidoEm: "2026-01-15T12:00:00Z",
  geradoEm: "2026-01-02T00:00:00Z",
  versaoParser: "cotahist-1.0.0",
  quantidadeRegistros: 1830,
  quantidadeRejeitadas: 0,
};

test("lote completo é validado", () => {
  const lote = validarLote(LOTE_BOM);
  assert.equal(lote.status, "validated");
  assert.deepEqual(lote.problemas, []);
});

test("lote sem hash é rejeitado", () => {
  const lote = validarLote({ ...LOTE_BOM, hashSha256: "" });
  assert.equal(lote.status, "rejected");
  assert.ok(lote.problemas.some((p) => p.includes("sha-256")));
});

test("lote vazio é insufficient_data, não sucesso silencioso (§12)", () => {
  const lote = validarLote({ ...LOTE_BOM, quantidadeRegistros: 0 });
  assert.equal(lote.status, "rejected");
  assert.ok(lote.problemas.some((p) => p.includes("insufficient_data")));
});

test("validação nunca promove a active por conta própria", () => {
  assert.notEqual(validarLote(LOTE_BOM).status, "active");
});
