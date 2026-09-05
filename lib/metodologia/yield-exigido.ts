/**
 * Yield exigido — ancorado, decomposto e reproduzível.
 *
 * O D9 registra o defeito: hoje a taxa é escolhida caso a caso (13,25% no
 * TRXF11, justificada como "taxa intermediária"). Como o valor justo depende
 * inteiramente dela, com 12% o veredito vira compra e com 14,5% vira venda —
 * e com 22 fundos recebendo cada um a sua taxa, o ranking não compara nada.
 *
 * A correção não é escolher melhor: é tirar a escolha do caminho crítico.
 *
 *     yield exigido = NTN-B longa + prêmio do segmento + ajustes documentados
 *
 * Cada parcela é uma linha com fonte. Duas análises só podem divergir na taxa
 * se divergirem em alguma linha nomeada — e aí a divergência é discutível, que
 * é exatamente o que "taxa intermediária" não era.
 */

export type ComponenteYield = {
  codigo: string;
  rotulo: string;
  /** Em pontos decimais: 0.06 = 6 pontos percentuais. */
  valor: number;
  /** De onde saiu. Sem fonte a linha não entra. */
  fonte: string;
};

export type YieldExigido = {
  total: number;
  componentes: ComponenteYield[];
};

export type EntradaYieldExigido = {
  /** Taxa real da NTN-B longa, em decimais (0.06 = 6%). */
  ntnbLonga: number;
  fonteNtnb: string;
  /** Prêmio do segmento sobre a NTN-B. */
  premioSegmento: number;
  fonteSegmento: string;
  /** Ajustes específicos do fundo. Cada um precisa de fonte e justificativa. */
  ajustes?: readonly ComponenteYield[];
};

/** Teto de sanidade: acima disto quase certamente há erro de unidade. */
export const YIELD_MAXIMO_PLAUSIVEL = 0.35;

export class YieldExigidoInvalido extends Error {}

/**
 * Monta o yield exigido a partir de componentes nomeados.
 *
 * Lança quando alguma linha vem sem fonte: uma taxa sem linhagem é o próprio
 * defeito que este módulo existe para impedir.
 */
export function montarYieldExigido(e: EntradaYieldExigido): YieldExigido {
  const componentes: ComponenteYield[] = [
    {
      codigo: "ntnb_longa",
      rotulo: "NTN-B longa (juro real)",
      valor: e.ntnbLonga,
      fonte: e.fonteNtnb,
    },
    {
      codigo: "premio_segmento",
      rotulo: "Prêmio do segmento",
      valor: e.premioSegmento,
      fonte: e.fonteSegmento,
    },
    ...(e.ajustes ?? []),
  ];

  for (const c of componentes) {
    if (!Number.isFinite(c.valor)) {
      throw new YieldExigidoInvalido(`componente ${c.codigo} não é número finito`);
    }
    if (!c.fonte?.trim()) {
      throw new YieldExigidoInvalido(
        `componente ${c.codigo} sem fonte — taxa sem linhagem não entra (D9)`,
      );
    }
  }

  const total = componentes.reduce((soma, c) => soma + c.valor, 0);

  if (total <= 0) {
    throw new YieldExigidoInvalido("yield exigido precisa ser positivo");
  }
  if (total > YIELD_MAXIMO_PLAUSIVEL) {
    throw new YieldExigidoInvalido(
      `yield exigido de ${(total * 100).toFixed(1)}% acima do teto de sanidade — verifique unidade`,
    );
  }

  return { total, componentes };
}

/**
 * Valor justo por renda capitalizada.
 *
 * O D10 aponta que o modelo atual não declara se a taxa é desconto de fluxo ou
 * cap rate, nem se a renda é nominal ou real. Aqui a escolha está feita e
 * escrita: **cap rate sobre renda real estabilizada**. O crescimento NÃO entra
 * como termo separado — um cap rate já o embute por construção (cap = r − g), e
 * somar crescimento a ele produziria dupla contagem.
 *
 * @param rendaAnualReal renda recorrente anualizada por cota, em termos reais
 */
export function valorJustoPorRenda(
  rendaAnualReal: number,
  yieldExigido: YieldExigido,
): number {
  if (!Number.isFinite(rendaAnualReal) || rendaAnualReal <= 0) {
    throw new YieldExigidoInvalido("renda anual precisa ser positiva");
  }
  return rendaAnualReal / yieldExigido.total;
}

/**
 * Sensibilidade do valor justo à taxa — o número que o D9 torna obrigatório.
 *
 * Exibir o valor justo sem isto esconde que ele é uma função quase inteiramente
 * determinada por uma premissa.
 */
export function sensibilidade(
  rendaAnualReal: number,
  yieldExigido: YieldExigido,
  variacoesPp: readonly number[] = [-1.5, -1, -0.5, 0.5, 1, 1.5],
): { variacaoPp: number; yieldResultante: number; valorJusto: number }[] {
  return variacoesPp
    .map((pp) => {
      const yieldResultante = yieldExigido.total + pp / 100;
      return {
        variacaoPp: pp,
        yieldResultante,
        valorJusto:
          yieldResultante > 0 ? rendaAnualReal / yieldResultante : Number.NaN,
      };
    })
    .filter((linha) => Number.isFinite(linha.valorJusto));
}
