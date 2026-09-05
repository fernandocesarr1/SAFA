/**
 * Classificação de triagem: junta a decomposição da queda com os sinais de
 * deterioração e diz o que fazer com o fundo.
 *
 * O que esta camada produz NÃO é veredito de investimento. É fila: quem vai
 * para o Deep Max primeiro. `AGENTS.md` §14 mantém a metodologia como fonte
 * única do veredito, e nada aqui compete com ela.
 */

import type { Decomposicao } from "./decomposicao.ts";
import { resumirSinais, type Sinal } from "./deterioracao.ts";

export type ClasseTriagem =
  /** Caiu, a renda ficou de pé e não há sinal de deterioração conhecido. */
  | "candidato_desconto"
  /** Caiu, mas a renda caiu junto ou há sinal presente: a queda tem lastro. */
  | "queda_com_fundamento"
  /** Não caiu no período. */
  | "sem_queda"
  /** Não há dado suficiente para afirmar qualquer uma das anteriores. */
  | "dados_insuficientes";

export type Classificacao = {
  classe: ClasseTriagem;
  /** Prioridade na fila do Deep Max. Maior = analisar antes. Nunca é nota. */
  prioridade: number;
  justificativa: string;
  /** O que precisa ser verificado no Deep Max antes de qualquer conclusão. */
  pendencias: string[];
};

export const PARAMETROS = {
  /** Abaixo disto a queda é ruído, não desconto. */
  quedaMinima: 0.1,
  /** Fração da queda que precisa vir do yield para o caso interessar. */
  fracaoYieldMinima: 0.7,
  /** Cobertura mínima dos sinais para afirmar "sem deterioração". */
  coberturaMinima: 0.5,
} as const;

export function classificar(
  decomposicao: Decomposicao,
  sinais: Sinal[],
): Classificacao {
  const resumo = resumirSinais(sinais);
  const quedaPct = -Math.expm1(decomposicao.variacaoPreco) * 100;

  const pendencias = resumo.desconhecidos.map(
    (s) => `verificar ${s.rotulo.toLowerCase()} (${s.codigo})`,
  );

  if (decomposicao.variacaoPreco >= 0) {
    return {
      classe: "sem_queda",
      prioridade: 0,
      justificativa: "preço não caiu no período avaliado",
      pendencias,
    };
  }

  if (quedaPct < PARAMETROS.quedaMinima * 100) {
    return {
      classe: "sem_queda",
      prioridade: 0,
      justificativa: `queda de ${quedaPct.toFixed(1)}% abaixo do mínimo de ${(PARAMETROS.quedaMinima * 100).toFixed(0)}%`,
      pendencias,
    };
  }

  const fracaoYield = decomposicao.fracaoQuedaPorYield ?? 0;

  if (fracaoYield < PARAMETROS.fracaoYieldMinima) {
    return {
      classe: "queda_com_fundamento",
      prioridade: 0,
      justificativa:
        `queda de ${quedaPct.toFixed(1)}% acompanhada de recuo da renda; ` +
        `só ${(fracaoYield * 100).toFixed(0)}% veio de yield`,
      pendencias,
    };
  }

  if (resumo.presentes.length > 0) {
    const lista = resumo.presentes.map((s) => s.rotulo.toLowerCase()).join(", ");
    return {
      classe: "queda_com_fundamento",
      prioridade: 0,
      justificativa: `queda puxada por yield, mas há deterioração observada: ${lista}`,
      pendencias,
    };
  }

  if (resumo.cobertura < PARAMETROS.coberturaMinima) {
    return {
      classe: "dados_insuficientes",
      prioridade: 0,
      justificativa:
        `queda de ${quedaPct.toFixed(1)}% puxada por yield, mas só ` +
        `${(resumo.cobertura * 100).toFixed(0)}% dos sinais puderam ser avaliados; ` +
        "ausência de sinal aqui não é ausência de problema",
      pendencias,
    };
  }

  // A prioridade combina tamanho da queda, pureza do efeito yield e cobertura.
  // É ordenação de fila, deliberadamente grosseira — refinar seria fingir
  // precisão que a triagem não tem.
  const prioridade = Number(
    (quedaPct * fracaoYield * resumo.cobertura).toFixed(2),
  );

  return {
    classe: "candidato_desconto",
    prioridade,
    justificativa:
      `queda de ${quedaPct.toFixed(1)}% com renda de pé — ` +
      `${(fracaoYield * 100).toFixed(0)}% da queda veio de yield exigido, ` +
      `sem sinal de deterioração em ${(resumo.cobertura * 100).toFixed(0)}% dos itens avaliados`,
    pendencias,
  };
}
