/**
 * Decomposição da variação de preço — o núcleo da tese do SAFA.
 *
 * A pergunta que o sistema existe para responder é: o fundo caiu porque piorou,
 * ou caiu apesar de não ter piorado?
 *
 * Como preço = renda / yield, vale exatamente, em logaritmo:
 *
 *     ln(P1/P0) = ln(R1/R0) − ln(Y1/Y0)
 *
 * A identidade é exata, não uma aproximação: não sobra resíduo. Toda queda de
 * preço é, por construção, ou queda de renda, ou aumento do yield exigido pelo
 * mercado, ou as duas coisas.
 *
 * Isso separa dois mundos que o olho confunde:
 *
 * - queda puxada por RENDA  → o fundo de fato piorou; o preço acompanhou.
 * - queda puxada por YIELD  → a renda ficou de pé e o mercado passou a exigir
 *                             mais para deter o mesmo fluxo. Aqui mora a
 *                             oportunidade — e também as armadilhas, porque o
 *                             mercado pode estar precificando risco real que
 *                             ainda não apareceu na renda.
 *
 * Por isso a decomposição NÃO conclui nada sozinha. Ela localiza o candidato;
 * quem julga se o yield maior tem contrapartida é `deterioracao.ts`, e a
 * palavra final é do Deep Max.
 */

import { insuficiente, invalido, ok, type Resultado } from "./tipos.ts";

export type Decomposicao = {
  /** Variação log do preço no período. Negativo = caiu. */
  variacaoPreco: number;
  /** Parcela explicada pela variação da renda recorrente. */
  contribuicaoRenda: number;
  /** Parcela explicada pela variação do yield exigido. */
  contribuicaoYield: number;
  /**
   * Fração da queda atribuível ao yield, em [0, 1].
   * Perto de 1: o preço caiu e a renda não — candidato a desconto.
   * Perto de 0: a renda caiu junto — queda com fundamento.
   * `null` quando o preço não caiu (a pergunta não se aplica).
   */
  fracaoQuedaPorYield: number | null;
  yieldInicial: number;
  yieldFinal: number;
};

export type EntradaDecomposicao = {
  precoInicial: number;
  precoFinal: number;
  /** Renda recorrente ANUALIZADA por cota no início do período. */
  rendaInicial: number;
  /** Renda recorrente ANUALIZADA por cota no fim do período. */
  rendaFinal: number;
};

/**
 * Decompõe a variação de preço entre renda e yield.
 *
 * Exige as quatro entradas positivas: com renda zero não existe yield, e o
 * desfecho correto é `insufficient_data`, não uma divisão que devolve infinito.
 */
export function decomporVariacao(
  e: EntradaDecomposicao,
): Resultado<Decomposicao> {
  const { precoInicial, precoFinal, rendaInicial, rendaFinal } = e;

  for (const [nome, valor] of Object.entries(e)) {
    if (!Number.isFinite(valor)) {
      return invalido(`${nome} não é um número finito`);
    }
  }
  if (precoInicial <= 0 || precoFinal <= 0) {
    return invalido("preço precisa ser positivo nas duas pontas");
  }
  if (rendaInicial <= 0 || rendaFinal <= 0) {
    return insuficiente(
      "renda recorrente anualizada ausente ou zero em uma das pontas; sem ela não há yield a decompor",
    );
  }

  const yieldInicial = rendaInicial / precoInicial;
  const yieldFinal = rendaFinal / precoFinal;

  const variacaoPreco = Math.log(precoFinal / precoInicial);
  const contribuicaoRenda = Math.log(rendaFinal / rendaInicial);
  const contribuicaoYield = -Math.log(yieldFinal / yieldInicial);

  let fracaoQuedaPorYield: number | null = null;
  if (variacaoPreco < 0) {
    // quanto da queda veio do yield subir, limitado a [0,1]:
    // renda pode ter subido (fração > 1) ou caído mais que o preço (< 0)
    const bruta = contribuicaoYield / variacaoPreco;
    fracaoQuedaPorYield = Math.min(1, Math.max(0, bruta));
  }

  return ok({
    variacaoPreco,
    contribuicaoRenda,
    contribuicaoYield,
    fracaoQuedaPorYield,
    yieldInicial,
    yieldFinal,
  });
}

/** Converte variação log em variação percentual simples, para exibição. */
export function logParaPercentual(variacaoLog: number): number {
  return Math.expm1(variacaoLog) * 100;
}
