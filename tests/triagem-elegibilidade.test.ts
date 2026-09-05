import { test } from "node:test";
import assert from "node:assert/strict";

import {
  avaliarElegibilidade,
  avaliarMaturidade,
  publicoEhGeral,
  MESES_HISTORICO_EXATO,
  PUBLICO_ALVO_GERAL,
} from "../lib/triagem/elegibilidade.ts";
import type { CadastroFundo } from "../lib/coleta/cvm/parser.ts";

function cadastro(publicoAlvo: string): CadastroFundo {
  return {
    cnpj: "00.000.000/0001-00",
    dataReferencia: "2026-08-01",
    nome: "FUNDO TESTE",
    isin: "BRTESTCTF001",
    segmento: "Logística",
    mandato: "Renda",
    tipoGestao: "Passiva",
    publicoAlvo,
    negociadoEmBolsa: true,
    administrador: "ADM",
  };
}

/** Os quatro valores existentes no informe real da CVM. */
test("só investidores em geral é comprável por pessoa comum", () => {
  assert.equal(publicoEhGeral(cadastro(PUBLICO_ALVO_GERAL)), true);
  assert.equal(publicoEhGeral(cadastro("INVESTIDOR QUALIFICADO")), false);
  assert.equal(publicoEhGeral(cadastro("INVESTIDOR PROFISSIONAL")), false);
  assert.equal(
    publicoEhGeral(cadastro("INVESTIDOR QUALIFICADO E PROFISSIONAL")),
    false,
  );
});

test("fundo restrito sai das listas", () => {
  const r = avaliarElegibilidade({
    cadastro: cadastro("INVESTIDOR QUALIFICADO"),
    ultimaCotacao: "2026-09-04",
    ultimoPregaoDoMercado: "2026-09-04",
  });
  assert.equal(r.elegivel, false);
  if (!r.elegivel) assert.equal(r.motivo, "publico_restrito");
});

test("papel parado de negociar sai das listas", () => {
  const r = avaliarElegibilidade({
    cadastro: cadastro(PUBLICO_ALVO_GERAL),
    ultimaCotacao: "2025-01-10",
    ultimoPregaoDoMercado: "2026-09-04",
  });
  assert.equal(r.elegivel, false);
  if (!r.elegivel) assert.equal(r.motivo, "sem_negociacao");
});

test("negociação recente mantém o fundo, mesmo com pouco histórico", () => {
  const r = avaliarElegibilidade({
    cadastro: cadastro(PUBLICO_ALVO_GERAL),
    ultimaCotacao: "2026-08-20",
    ultimoPregaoDoMercado: "2026-09-04",
  });
  assert.equal(r.elegivel, true);
});

test("sem cadastro na CVM o fundo não é excluído por presunção", () => {
  const r = avaliarElegibilidade({
    cadastro: null,
    ultimaCotacao: "2026-09-01",
    ultimoPregaoDoMercado: "2026-09-04",
  });
  assert.equal(r.elegivel, true);
});

test("36 meses de preço E de rendimento para avaliação exata", () => {
  assert.equal(avaliarMaturidade(36, 36).completa, true);
  assert.equal(avaliarMaturidade(35, 40).completa, false);
  assert.equal(avaliarMaturidade(40, 35).completa, false);
  assert.equal(MESES_HISTORICO_EXATO, 36);
});

test("maturidade incompleta explica o que falta, para o fundo poder migrar", () => {
  const m = avaliarMaturidade(20, 12);
  assert.equal(m.completa, false);
  assert.equal(m.faltas.length, 2);
  assert.ok(m.faltas[0].includes("20 de 36 meses de preço"));
  assert.ok(m.faltas[1].includes("12 de 36 competências"));
});

test("pouco histórico nunca é motivo de exclusão — só de acompanhamento", () => {
  // um fundo novo, negociado e de varejo: entra, ainda que imaturo
  const r = avaliarElegibilidade({
    cadastro: cadastro(PUBLICO_ALVO_GERAL),
    ultimaCotacao: "2026-09-03",
    ultimoPregaoDoMercado: "2026-09-04",
  });
  assert.equal(r.elegivel, true);
  assert.equal(avaliarMaturidade(4, 4).completa, false);
});
