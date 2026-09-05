/**
 * Renda por cota a partir do Informe Mensal — e, quando ela falta, o motivo.
 *
 * A decomposição precisa de renda nas duas pontas da janela. Quando falta numa
 * delas, o fundo sai da lista principal, e dizer só "renda indisponível" não
 * permite distinguir situações que exigem respostas diferentes:
 *
 * - a CVM **não publicou** o dado naquelas competências;
 * - o fundo **publicou zero** — não distribuiu, o que é informação, não falta.
 *
 * Por isso o resultado é discriminado: ou traz o valor, ou traz a causa. O
 * cálculo em si é o mesmo de antes; o que muda é só passar a dizer por quê.
 */

import type { ComplementoMensal } from "../coleta/cvm/parser.ts";
import { rendaMensalPorCota } from "../coleta/cvm/parser.ts";
import type { ResultadoTrimestral } from "../coleta/cvm/trimestral.ts";
import { rendaTrimestralPorCota } from "../coleta/cvm/trimestral.ts";

export type RendaJanela =
  | {
      ok: true;
      valor: number;
      /** Competências com distribuição positiva, das que a janela cobre. */
      competenciasPagas: number;
      competencias: number;
    }
  | { ok: false; motivo: string; competencias: number };

/** Meses por ano, para anualizar a mediana mensal. */
const MESES_NO_ANO = 12;

/** Trimestres por ano, para anualizar o rendimento declarado. */
const TRIMESTRES_NO_ANO = 4;

/**
 * Renda anualizada de uma janela de competências.
 *
 * Usa a **mediana**, não a média: um mês com distribuição extraordinária
 * arrastaria a média e faria o fundo parecer ter renda que não tem.
 *
 * Mês com distribuição **zero entra na mediana**; só o dado ausente fica de
 * fora. A versão anterior filtrava `v > 0` e com isso tratava "não distribuiu"
 * como "não informou" — duas coisas diferentes. O efeito era medido: num fundo
 * que paga uma vez por trimestre, a janela `[0, 0, X]` tinha a mediana
 * calculada sobre o único mês pago e anualizada por doze, três vezes a renda
 * real. A comparação entre mensal e trimestral sobre o mercado inteiro achou
 * **34 fundos com razão próxima de 3** — exatamente essa assinatura.
 *
 * Com o zero contando, a janela de quem não paga todo mês tem mediana zero e o
 * mensal deixa de servir; quem mede esse fundo é o informe trimestral, que
 * cobre o período inteiro e não depende do ritmo de pagamento.
 *
 * Fica em aberto, e declarado: para o pagador irregular cuja janela ainda tem
 * mediana positiva, a mediana continua superestimando frente à soma do período.
 * Trocar mediana por soma é decisão de metodologia, não correção — a soma
 * acertaria o ritmo e perderia a proteção contra distribuição extraordinária,
 * que `CLAUDE.md` manda não tratar como renda recorrente.
 */
export function rendaAnualizadaDaJanela(
  competencias: readonly ComplementoMensal[],
): RendaJanela {
  const n = competencias.length;
  if (n === 0) return { ok: false, motivo: "janela vazia", competencias: 0 };

  const medidas = competencias.map((c) => ({
    valor: rendaMensalPorCota(c),
    yieldAusente: c.dividendYieldMes === null,
    yieldZero: c.dividendYieldMes === 0,
    vpAusente: c.valorPatrimonialCota === null || c.valorPatrimonialCota <= 0,
  }));

  // Zero conta; ausente não. Esta linha é a correção: antes era `v > 0`.
  const valores = medidas
    .map((m) => m.valor)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const positivos = valores.filter((v) => v > 0);

  if (valores.length === 0) {
    const semYield = medidas.filter((m) => m.yieldAusente).length;
    const zerado = medidas.filter((m) => m.yieldZero).length;
    const semVp = medidas.filter((m) => m.vpAusente).length;

    const partes: string[] = [];
    if (zerado > 0) partes.push(`${zerado} com distribuição zero`);
    if (semYield > 0) partes.push(`${semYield} sem dividend yield publicado`);
    if (semVp > 0) partes.push(`${semVp} sem valor patrimonial`);

    return {
      ok: false,
      motivo: `nenhuma das ${n} competências da janela tem renda utilizável (${
        partes.join(", ") || "valores inválidos"
      })`,
      competencias: n,
    };
  }

  const meio = Math.floor(valores.length / 2);
  const mediana =
    valores.length % 2 === 0
      ? (valores[meio - 1] + valores[meio]) / 2
      : valores[meio];

  if (mediana <= 0) {
    return {
      ok: false,
      motivo:
        `fundo sem distribuição na maioria das ${n} competências da janela ` +
        `(${positivos.length} com pagamento) — pode ser ritmo não mensal, e aí ` +
        "quem mede é o informe trimestral, não o mensal",
      competencias: n,
    };
  }

  return {
    ok: true,
    valor: mediana * MESES_NO_ANO,
    competenciasPagas: positivos.length,
    competencias: n,
  };
}

/**
 * Renda anualizada a partir do informe TRIMESTRAL, para a competência alvo.
 *
 * Existe porque o yield mensal da CVM não é confiável: **49,3% das
 * competências trazem zero**, e 345 fundos que nunca publicaram yield positivo
 * declaram rendimento no trimestral — um deles com R$ 152 milhões distribuídos
 * ao longo de 44 meses de yield zerado. Zero ali é, muitas vezes, campo não
 * preenchido, não distribuição zero.
 *
 * A escolha do trimestre é o ponto delicado. A versão anterior exigia um
 * relatório datado **em ou depois** da última competência mensal e no mesmo
 * ano — mas o trimestral sai com atraso em relação ao mensal, então essa
 * condição quase nunca se satisfazia e o resgate praticamente não disparava.
 * Aqui vale o trimestre mais próximo da data alvo, olhando para os dois lados.
 */
export function rendaTrimestralAnualizada(
  resultados: readonly ResultadoTrimestral[],
  cnpj: string,
  dataAlvo: string,
  cotasEmitidas: number | null,
): number | null {
  const doFundo = resultados.filter((r) => r.cnpj === cnpj);
  if (doFundo.length === 0) return null;

  const distancia = (data: string) =>
    Math.abs(Date.parse(`${data}T00:00:00Z`) - Date.parse(`${dataAlvo}T00:00:00Z`));

  const maisProximo = doFundo.reduce((melhor, r) =>
    distancia(r.dataReferencia) < distancia(melhor.dataReferencia) ? r : melhor,
  );

  const porCota = rendaTrimestralPorCota(maisProximo, cotasEmitidas);
  if (porCota === null || porCota <= 0) return null;
  return porCota * TRIMESTRES_NO_ANO;
}
