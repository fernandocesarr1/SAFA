import { test } from "node:test";
import assert from "node:assert/strict";

import { decomporVariacao } from "../lib/triagem/decomposicao.ts";
import { avaliarSinais, resumirSinais } from "../lib/triagem/deterioracao.ts";
import { classificar } from "../lib/triagem/classificacao.ts";

/** Preço caiu 30%, renda intacta: queda inteiramente de yield. */
const QUEDA_SEM_FUNDAMENTO = {
  precoInicial: 100,
  precoFinal: 70,
  rendaInicial: 10,
  rendaFinal: 10,
};

/** Preço e renda caíram juntos: a queda acompanhou o fundamento. */
const QUEDA_COM_FUNDAMENTO = {
  precoInicial: 100,
  precoFinal: 70,
  rendaInicial: 10,
  rendaFinal: 7,
};

test("a decomposição fecha sem resíduo — é identidade, não aproximação", () => {
  const r = decomporVariacao(QUEDA_SEM_FUNDAMENTO);
  assert.ok(r.ok);
  const d = r.valor;
  assert.ok(
    Math.abs(d.variacaoPreco - (d.contribuicaoRenda + d.contribuicaoYield)) < 1e-12,
  );
});

test("queda com renda de pé é atribuída inteiramente ao yield", () => {
  const r = decomporVariacao(QUEDA_SEM_FUNDAMENTO);
  assert.ok(r.ok);
  assert.equal(r.valor.contribuicaoRenda, 0);
  assert.ok(Math.abs((r.valor.fracaoQuedaPorYield ?? 0) - 1) < 1e-12);
  assert.ok(r.valor.yieldFinal > r.valor.yieldInicial);
});

test("queda proporcional à renda não é atribuída ao yield", () => {
  const r = decomporVariacao(QUEDA_COM_FUNDAMENTO);
  assert.ok(r.ok);
  assert.ok(Math.abs(r.valor.fracaoQuedaPorYield ?? 1) < 1e-12);
});

test("renda ausente devolve insufficient_data, não divisão por zero", () => {
  const r = decomporVariacao({ ...QUEDA_SEM_FUNDAMENTO, rendaFinal: 0 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.motivo, "insufficient_data");
});

test("sinal sem dado é desconhecido, nunca ausente", () => {
  const sinais = avaliarSinais({});
  assert.ok(sinais.length > 0);
  assert.ok(sinais.every((s) => s.estado === "desconhecido"));
  assert.equal(resumirSinais(sinais).cobertura, 0);
});

test("vacância em alta é detectada", () => {
  const sinais = avaliarSinais({
    vacanciaFisicaAtual: 0.18,
    vacanciaFisicaAnterior: 0.04,
  });
  const vac = sinais.find((s) => s.codigo === "vacancia_subindo");
  assert.equal(vac?.estado, "presente");
});

/** Cobertura suficiente e nenhum sinal presente. */
const SINAIS_LIMPOS = {
  vacanciaFisicaAtual: 0.02,
  vacanciaFisicaAnterior: 0.02,
  inadimplenciaPct: 0,
  alavancagemAtual: 0.1,
  alavancagemAnterior: 0.1,
  dividaVencendo12mPct: 0.05,
  emissaoPrecoSobreVp: 1.05,
  concentracaoMaiorInquilinoPct: 0.12,
  contratosVencendo24mPct: 0.1,
};

test("queda por yield sem deterioração vira candidato a desconto", () => {
  const d = decomporVariacao(QUEDA_SEM_FUNDAMENTO);
  assert.ok(d.ok);
  const c = classificar(d.valor, avaliarSinais(SINAIS_LIMPOS));
  assert.equal(c.classe, "candidato_desconto");
  assert.ok(c.prioridade > 0);
});

test("queda por yield COM deterioração não vira candidato", () => {
  const d = decomporVariacao(QUEDA_SEM_FUNDAMENTO);
  assert.ok(d.ok);
  const c = classificar(
    d.valor,
    avaliarSinais({ ...SINAIS_LIMPOS, vacanciaFisicaAtual: 0.3 }),
  );
  assert.equal(c.classe, "queda_com_fundamento");
  assert.equal(c.prioridade, 0);
});

test("sem cobertura de sinais o desfecho é dados_insuficientes, não oportunidade", () => {
  const d = decomporVariacao(QUEDA_SEM_FUNDAMENTO);
  assert.ok(d.ok);
  const c = classificar(d.valor, avaliarSinais({ inadimplenciaPct: 0 }));
  assert.equal(c.classe, "dados_insuficientes");
  assert.match(c.justificativa, /ausência de sinal aqui não é ausência de problema/);
});

test("queda com fundamento não entra na fila mesmo com dados completos", () => {
  const d = decomporVariacao(QUEDA_COM_FUNDAMENTO);
  assert.ok(d.ok);
  const c = classificar(d.valor, avaliarSinais(SINAIS_LIMPOS));
  assert.equal(c.classe, "queda_com_fundamento");
});

test("pendências listam o que o Deep Max precisa verificar", () => {
  const d = decomporVariacao(QUEDA_SEM_FUNDAMENTO);
  assert.ok(d.ok);
  const c = classificar(d.valor, avaliarSinais({ inadimplenciaPct: 0 }));
  assert.ok(c.pendencias.length > 0);
  assert.ok(c.pendencias.some((p) => p.includes("vacância")));
});
