import { test } from "node:test";
import assert from "node:assert/strict";

import type { ComplementoMensal } from "../lib/coleta/cvm/parser.ts";
import {
  rendaAnualizadaDaJanela,
  rendaTrimestralAnualizada,
} from "../lib/triagem/renda.ts";

function competencia(
  dividendYieldMes: number | null,
  valorPatrimonialCota: number | null = 100,
): ComplementoMensal {
  return {
    cnpj: "00.000.000/0001-00",
    dataReferencia: "2026-01-31",
    patrimonioLiquido: null,
    cotasEmitidas: null,
    valorPatrimonialCota,
    totalCotistas: null,
    dividendYieldMes,
    rentabilidadeEfetivaMes: null,
    taxaAdministracao: null,
  };
}

test("mediana, não média: um mês extraordinário não vira renda recorrente", () => {
  const r = rendaAnualizadaDaJanela([
    competencia(0.006),
    competencia(0.006),
    competencia(0.06), // distribuição extraordinária, 10x
  ]);
  assert.ok(r.ok);
  // mediana 0.006 × 100 × 12 = 7.2; a média daria 24
  assert.equal(Number(r.valor.toFixed(4)), 7.2);
});

test("janela sem dado nenhum nomeia o que faltou, em vez de só falhar", () => {
  const r = rendaAnualizadaDaJanela([
    competencia(null),
    competencia(null),
    competencia(null),
  ]);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /3 sem dividend yield publicado/);
});

test("janela sem nenhuma distribuição falha nomeando o ritmo, não o dado", () => {
  const r = rendaAnualizadaDaJanela([
    competencia(0),
    competencia(0),
    competencia(null),
  ]);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sem distribuição na maioria/);
  assert.match(r.motivo, /informe trimestral/);
});

test("dado ausente em toda a janela é outra coisa, e diz outra coisa", () => {
  const r = rendaAnualizadaDaJanela([competencia(null), competencia(null)]);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /2 sem dividend yield publicado/);
});

test("valor patrimonial ausente também é nomeado", () => {
  const r = rendaAnualizadaDaJanela([
    competencia(0.006, null),
    competencia(0.006, 0),
    competencia(0.006, -1),
  ]);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sem valor patrimonial/);
});

test("janela vazia falha declarando isso, não devolve zero", () => {
  const r = rendaAnualizadaDaJanela([]);
  assert.equal(r.ok, false);
  assert.equal(r.competencias, 0);
});

/**
 * O defeito que a comparação entre as duas fontes achou em 34 fundos: com o
 * filtro `v > 0`, a janela do pagador trimestral tinha a mediana calculada
 * sobre o único mês pago e anualizada por doze — 21,60 no lugar de 7,20.
 */
test("pagador trimestral não vira renda 3x maior: o mensal desiste, o trimestral mede", () => {
  const r = rendaAnualizadaDaJanela([
    competencia(0),
    competencia(0),
    competencia(0.018),
  ]);
  assert.equal(r.ok, false); // e não 21.6, como devolvia antes
  assert.match(r.motivo, /ritmo não mensal/);
});

test("um mês zerado no meio de pagos não derruba a medida", () => {
  const r = rendaAnualizadaDaJanela([
    competencia(0.006),
    competencia(0),
    competencia(0.006),
  ]);
  assert.ok(r.ok);
  assert.equal(Number(r.valor.toFixed(4)), 7.2);
  assert.equal(r.competenciasPagas, 2);
});

// ------------------------------------------------------ informe trimestral ---

function trimestre(dataReferencia: string, rendimentosDeclarados: number | null) {
  return {
    cnpj: "00.000.000/0001-00",
    dataReferencia,
    rendimentosDeclarados,
    receitaAluguel: null,
    resultadoLiquidoFinanceiro: null,
    lucroContabil: null,
  };
}

test("o trimestral resgata o fundo cujo yield mensal a CVM deixou em branco", () => {
  const r = rendaTrimestralAnualizada(
    [trimestre("2026-06-30", 1_000_000)],
    "00.000.000/0001-00",
    "2026-06-30",
    1_000_000,
  );
  assert.equal(r, 4); // 1,00 por cota no trimestre → 4,00 no ano
});

test("vale o trimestre mais próximo, não o primeiro da lista", () => {
  // o trimestral sai com atraso: exigir data >= a competência mensal fazia o
  // resgate quase nunca disparar, que era o defeito
  const resultados = [
    trimestre("2024-03-31", 400_000),
    trimestre("2026-03-31", 1_000_000),
    trimestre("2025-06-30", 700_000),
  ];
  const r = rendaTrimestralAnualizada(
    resultados,
    "00.000.000/0001-00",
    "2026-04-30", // competência mensal POSTERIOR ao último trimestre publicado
    1_000_000,
  );
  assert.equal(r, 4); // pegou 2026-03-31, o mais próximo
});

test("fundo sem trimestre nenhum devolve ausência, não zero", () => {
  assert.equal(
    rendaTrimestralAnualizada([], "00.000.000/0001-00", "2026-06-30", 1000),
    null,
  );
});

test("sem cotas emitidas não há renda por cota (§12)", () => {
  const t = [trimestre("2026-06-30", 1_000_000)];
  assert.equal(rendaTrimestralAnualizada(t, "00.000.000/0001-00", "2026-06-30", null), null);
  assert.equal(rendaTrimestralAnualizada(t, "00.000.000/0001-00", "2026-06-30", 0), null);
});

test("rendimento declarado nulo ou zero não vira renda", () => {
  for (const v of [null, 0]) {
    assert.equal(
      rendaTrimestralAnualizada(
        [trimestre("2026-06-30", v)],
        "00.000.000/0001-00",
        "2026-06-30",
        1000,
      ),
      null,
    );
  }
});
