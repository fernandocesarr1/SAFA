import { test } from "node:test";
import assert from "node:assert/strict";

import {
  confrontar,
  confianca,
  valorUtilizavel,
  descrever,
  type Medida,
} from "../lib/triagem/triangulacao.ts";
import { parseProventos, ProventoInvalido } from "../lib/coleta/fnet/proventos.ts";
import {
  desacumularPorExercicio,
  rendaTrimestralPorCota,
} from "../lib/coleta/cvm/trimestral.ts";

const cvm: Medida = {
  fonte: "cvm_mensal",
  valor: 0.4994,
  url: "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_2026.zip",
  natureza: "derivado",
};
const fnet: Medida = {
  fonte: "fnet",
  valor: 0.5,
  url: "https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=1310466&cvm=true",
  natureza: "publicado",
};

test("fontes próximas concordam e a medida ganha confiança", () => {
  const c = confrontar([cvm, fnet]);
  assert.equal(c.estado, "concordam");
  assert.equal(confianca(c), 1);
});

test("concordando, prefere-se o publicado ao derivado", () => {
  const c = confrontar([cvm, fnet]);
  if (c.estado !== "concordam") throw new Error("esperava concordância");
  assert.equal(c.valor, fnet.valor);
});

test("divergência não escolhe vencedor — suspende o número", () => {
  const c = confrontar([cvm, { ...fnet, valor: 1.2 }]);
  assert.equal(c.estado, "divergem");
  assert.equal(valorUtilizavel(c), null);
  assert.equal(confianca(c), 0);
});

test("erro de unidade é pego, não acomodado", () => {
  // o caso real: número multiplicado por potência de dez
  const c = confrontar([cvm, { ...fnet, valor: 499.4 }]);
  assert.equal(c.estado, "divergem");
  assert.match(descrever(c), /DIVERGEM/);
});

test("fonte única é utilizável, mas vale menos que corroborada", () => {
  const so = confrontar([cvm]);
  assert.equal(so.estado, "fonte_unica");
  assert.equal(valorUtilizavel(so), cvm.valor);
  assert.ok(confianca(so) < confianca(confrontar([cvm, fnet])));
});

test("derivado sozinho vale menos que publicado sozinho", () => {
  assert.ok(confianca(confrontar([cvm])) < confianca(confrontar([fnet])));
});

test("medida sem URL não conta como fonte (§11)", () => {
  const c = confrontar([{ ...cvm, url: "  " }, fnet]);
  assert.equal(c.estado, "fonte_unica");
});

test("sem fonte nenhuma o desfecho é ausente, não zero", () => {
  assert.equal(confrontar([]).estado, "ausente");
  assert.equal(valorUtilizavel(confrontar([])), null);
});

/** HTML reduzido, no formato que o FNET emite. */
const HTML_PROVENTO = `
<html><body>
<table>
<tr><td>Nome do Fundo:</td><td>FUNDO TESTE FII</td><td>CNPJ do Fundo:</td><td>37.262.752/0001-30</td></tr>
<tr><td>C&oacute;digo ISIN:</td><td>BRTESTCTF008</td><td>C&oacute;digo de negocia&ccedil;&atilde;o:</td><td>TEST11</td><td>Rendimento</td><td>Amortiza&ccedil;&atilde;o</td></tr>
<tr><td>Data-base (&uacute;ltimo dia)</td></tr>
<tr><td>04/09/2026</td><td>04/09/2026</td></tr>
<tr><td>Valor do provento (R$/unidade)</td></tr>
<tr><td>2,660496</td><td>0,001415</td></tr>
<tr><td>Data do pagamento</td></tr>
<tr><td>15/09/2026</td><td>15/09/2026</td></tr>
<tr><td>Per&iacute;odo de refer&ecirc;ncia</td></tr>
<tr><td>SETEMBRO</td><td>SETEMBRO</td></tr>
</table>
<p>Informa&ccedil;&otilde;es sobre Pagamento de Proventos</p>
</body></html>`;

test("extrai o provento declarado no FNET", () => {
  const [p] = parseProventos(HTML_PROVENTO);
  assert.equal(p.ticker, "TEST11");
  assert.equal(p.isin, "BRTESTCTF008");
  assert.equal(p.dataBase, "2026-09-04");
  assert.equal(p.dataPagamento, "2026-09-15");
});

test("rendimento e amortização não se misturam", () => {
  const [p] = parseProventos(HTML_PROVENTO);
  assert.equal(p.rendimentoPorCota, 2.660496);
  assert.equal(p.amortizacaoPorCota, 0.001415);
  // amortização é devolução de capital: somá-la à renda inflaria o yield
  assert.notEqual(p.rendimentoPorCota, p.amortizacaoPorCota);
});

test("documento que não é de proventos devolve lista vazia", () => {
  assert.deepEqual(parseProventos("<html><body>Fato Relevante</body></html>"), []);
});

test("documento de proventos com formato irreconhecível falha alto", () => {
  assert.throws(
    () => parseProventos("<html><body>Pagamento de Proventos</body></html>"),
    ProventoInvalido,
  );
});

/**
 * `Rendimentos_Declarados` do informe trimestral é acumulado no exercício.
 * Descoberto pela triangulação: o mesmo fundo aparecia com 1,20 no primeiro
 * trimestre e 2,40 no segundo. Sem desacumular, o quarto trimestre seria lido
 * como quatro vezes maior que o primeiro.
 */
const TRIMESTRES = [
  { cnpj: "X", dataReferencia: "2026-03-31", rendimentosDeclarados: 100, receitaAluguel: null, resultadoLiquidoFinanceiro: null, lucroContabil: null },
  { cnpj: "X", dataReferencia: "2026-06-30", rendimentosDeclarados: 210, receitaAluguel: null, resultadoLiquidoFinanceiro: null, lucroContabil: null },
  { cnpj: "X", dataReferencia: "2026-09-30", rendimentosDeclarados: 330, receitaAluguel: null, resultadoLiquidoFinanceiro: null, lucroContabil: null },
];

test("desacumula o rendimento declarado por exercício", () => {
  const saida = desacumularPorExercicio(TRIMESTRES);
  assert.deepEqual(
    saida.map((r) => r.rendimentosDeclarados),
    [100, 110, 120],
  );
});

test("o exercício seguinte recomeça, não continua acumulando", () => {
  const saida = desacumularPorExercicio([
    ...TRIMESTRES,
    { cnpj: "X", dataReferencia: "2027-03-31", rendimentosDeclarados: 90, receitaAluguel: null, resultadoLiquidoFinanceiro: null, lucroContabil: null },
  ]);
  assert.equal(saida.find((r) => r.dataReferencia === "2027-03-31")?.rendimentosDeclarados, 90);
});

test("queda no acumulado é retificação: o trimestre vira ausente, não negativo", () => {
  const saida = desacumularPorExercicio([
    TRIMESTRES[0],
    { ...TRIMESTRES[1], rendimentosDeclarados: 60 },
  ]);
  assert.equal(saida[1].rendimentosDeclarados, null);
});

test("renda por cota exige o valor já desacumulado", () => {
  const [primeiro, segundo] = desacumularPorExercicio(TRIMESTRES.slice(0, 2));
  assert.equal(rendaTrimestralPorCota(primeiro, 100), 1);
  assert.equal(rendaTrimestralPorCota(segundo, 100), 1.1);
  // sem cotas não há divisão possível
  assert.equal(rendaTrimestralPorCota(primeiro, null), null);
  assert.equal(rendaTrimestralPorCota(primeiro, 0), null);
});
