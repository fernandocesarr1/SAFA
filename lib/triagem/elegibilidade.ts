/**
 * Elegibilidade: quem sai das listas, e por quê.
 *
 * A separação importa. Há duas perguntas diferentes que antes estavam
 * misturadas num filtro só:
 *
 * - **Elegibilidade** — este fundo pode ser comprado por uma pessoa comum, e
 *   ainda é negociado? Se não, sai de tudo. Não adianta acompanhar o que não
 *   se pode comprar.
 * - **Maturidade de dados** — há histórico bastante para uma avaliação exata?
 *   Se não, o fundo NÃO é descartado: vai para a lista de acompanhamento, com
 *   o motivo, e volta quando o histórico amadurecer.
 *
 * Pouco histórico ou baixa liquidez nunca excluem: são razão para acompanhar,
 * não para ignorar.
 */

import type { CadastroFundo } from "../coleta/cvm/parser.ts";

/** O único público-alvo que uma pessoa comum acessa, conforme a CVM. */
export const PUBLICO_ALVO_GERAL = "INVESTIDORES EM GERAL";

/**
 * Por que o papel saiu de todas as listas.
 *
 * `nao_e_cota` — o papel é direito de subscrição ou recibo, não cota. A B3
 * publica os três sob o mesmo código BDI 12, e só o ISIN os separa. Sem esta
 * distinção, 44 papéis apareciam como "fundo sem cadastro na CVM": falta de
 * cadastro que era, na verdade, erro de classificação — não existe cadastro de
 * fundo para um direito porque um direito não é um fundo.
 */
export type MotivoExclusao = "publico_restrito" | "sem_negociacao" | "nao_e_cota";

export type Elegibilidade =
  | { elegivel: true }
  | { elegivel: false; motivo: MotivoExclusao; detalhe: string };

/**
 * Fundo restrito a investidor qualificado ou profissional não entra.
 *
 * Os valores possíveis, lidos do informe real: "INVESTIDORES EM GERAL",
 * "INVESTIDOR QUALIFICADO", "INVESTIDOR PROFISSIONAL" e "INVESTIDOR
 * QUALIFICADO E PROFISSIONAL". Só o primeiro é de varejo.
 */
export function publicoEhGeral(cadastro: CadastroFundo): boolean {
  return cadastro.publicoAlvo.trim().toUpperCase() === PUBLICO_ALVO_GERAL;
}

/** Dias sem negociação a partir dos quais o papel é dado como parado. */
export const DIAS_SEM_NEGOCIACAO = 90;

function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}

export type EntradaElegibilidade = {
  cadastro: CadastroFundo | null;
  /** Último pregão do papel. */
  ultimaCotacao: string;
  /** Último pregão do conjunto coletado — a régua do "ainda negocia". */
  ultimoPregaoDoMercado: string;
};

export function avaliarElegibilidade(e: EntradaElegibilidade): Elegibilidade {
  const parado = diasEntre(e.ultimaCotacao, e.ultimoPregaoDoMercado);
  if (parado > DIAS_SEM_NEGOCIACAO) {
    return {
      elegivel: false,
      motivo: "sem_negociacao",
      detalhe: `último pregão em ${e.ultimaCotacao}, ${parado} dias antes do fim do período`,
    };
  }

  // Sem cadastro na CVM não dá para afirmar que é restrito; o fundo segue
  // elegível e o cruzamento faltante aparece como motivo de acompanhamento.
  if (e.cadastro && !publicoEhGeral(e.cadastro)) {
    return {
      elegivel: false,
      motivo: "publico_restrito",
      detalhe: e.cadastro.publicoAlvo,
    };
  }

  return { elegivel: true };
}

/** Meses exigidos para a avaliação exata, em preço e em rendimento. */
export const MESES_HISTORICO_EXATO = 36;

export type Maturidade = {
  /** Meses-calendário distintos com pregão. */
  mesesPreco: number;
  /** Competências do informe com valor patrimonial e yield. */
  mesesRendimento: number;
  completa: boolean;
  faltas: string[];
};

export function avaliarMaturidade(
  mesesPreco: number,
  mesesRendimento: number,
): Maturidade {
  const faltas: string[] = [];
  if (mesesPreco < MESES_HISTORICO_EXATO) {
    faltas.push(`${mesesPreco} de ${MESES_HISTORICO_EXATO} meses de preço`);
  }
  if (mesesRendimento < MESES_HISTORICO_EXATO) {
    faltas.push(
      `${mesesRendimento} de ${MESES_HISTORICO_EXATO} competências com rendimento`,
    );
  }
  return {
    mesesPreco,
    mesesRendimento,
    completa: faltas.length === 0,
    faltas,
  };
}
