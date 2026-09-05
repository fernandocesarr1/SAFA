/**
 * Sinais de deterioração — o contrapeso da decomposição.
 *
 * Quando o preço cai e a renda não, o mercado passou a exigir mais yield. Isso
 * pode ser humor, e pode ser risco real que ainda não chegou na renda. Este
 * módulo procura o risco real.
 *
 * A regra que governa o arquivo inteiro: **ausência de sinal não é ausência de
 * problema**. Um sinal que não pôde ser avaliado por falta de dado é
 * `desconhecido`, nunca `ausente`. Tratar desconhecido como "está tudo bem" é
 * precisamente o defeito do D4 — gates que conferem preenchimento e concluem
 * verdade.
 */

export type EstadoSinal = "ausente" | "presente" | "desconhecido";

/**
 * De onde o sinal pode vir.
 *
 * A distinção não é burocrática: exigir da triagem um sinal que só a leitura
 * documental produz trava o funil inteiro. Vacância por ativo, inadimplência e
 * cronograma de contratos moram em relatório gerencial — nenhuma fonte
 * numérica aberta os publica de forma comparável entre fundos.
 *
 * - `quantitativo`: obtível por coleta automática. Entra na cobertura.
 * - `documental`: só o Deep Max resolve. Quando desconhecido, vira PENDÊNCIA
 *   obrigatória do candidato, nunca aval de que está tudo bem.
 */
export type OrigemSinal = "quantitativo" | "documental";

export type Sinal = {
  codigo: string;
  rotulo: string;
  origem: OrigemSinal;
  estado: EstadoSinal;
  /** Só preenchido quando `presente`: o que foi observado. */
  observado: string | null;
};

/**
 * Entradas da avaliação. Todo campo é opcional por desenho: o que não veio
 * vira `desconhecido`, e isso fica visível no resultado.
 */
export type EntradaDeterioracao = {
  vacanciaFisicaAtual?: number;
  vacanciaFisicaAnterior?: number;
  inadimplenciaPct?: number;
  /** Dívida líquida / valor patrimonial. */
  alavancagemAtual?: number;
  alavancagemAnterior?: number;
  /** Fração da dívida vencendo em 12 meses. */
  dividaVencendo12mPct?: number;
  /** Preço da última emissão sobre o valor patrimonial por cota. */
  emissaoPrecoSobreVp?: number;
  /** Receita do maior inquilino sobre a receita total. */
  concentracaoMaiorInquilinoPct?: number;
  /** Fração da receita vencendo em 24 meses sem renovação contratada. */
  contratosVencendo24mPct?: number;
};

/** Limiares da avaliação. Valores de regra moram aqui, não espalhados no código. */
export const LIMIARES = {
  altaVacanciaPp: 5,
  vacanciaCritica: 0.2,
  inadimplenciaCritica: 0.05,
  altaAlavancagemPp: 0.05,
  alavancagemCritica: 0.4,
  dividaVencendo12mCritica: 0.3,
  emissaoDiluidoraVp: 0.98,
  concentracaoCritica: 0.3,
  contratosVencendo24mCritica: 0.4,
} as const;

function sinal(
  codigo: string,
  rotulo: string,
  origem: OrigemSinal,
  avaliacao: { presente: boolean; observado: string } | null,
): Sinal {
  if (avaliacao === null) {
    return { codigo, rotulo, origem, estado: "desconhecido", observado: null };
  }
  return {
    codigo,
    rotulo,
    origem,
    estado: avaliacao.presente ? "presente" : "ausente",
    observado: avaliacao.presente ? avaliacao.observado : null,
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function avaliarSinais(e: EntradaDeterioracao): Sinal[] {
  const sinais: Sinal[] = [];

  sinais.push(
    sinal(
      "vacancia_subindo",
      "Vacância física em alta",
      "documental",
      e.vacanciaFisicaAtual !== undefined && e.vacanciaFisicaAnterior !== undefined
        ? {
            presente:
              (e.vacanciaFisicaAtual - e.vacanciaFisicaAnterior) * 100 >=
                LIMIARES.altaVacanciaPp ||
              e.vacanciaFisicaAtual >= LIMIARES.vacanciaCritica,
            observado: `${pct(e.vacanciaFisicaAnterior)} → ${pct(e.vacanciaFisicaAtual)}`,
          }
        : null,
    ),
  );

  sinais.push(
    sinal(
      "inadimplencia",
      "Inadimplência relevante",
      "documental",
      e.inadimplenciaPct !== undefined
        ? {
            presente: e.inadimplenciaPct >= LIMIARES.inadimplenciaCritica,
            observado: pct(e.inadimplenciaPct),
          }
        : null,
    ),
  );

  sinais.push(
    sinal(
      "alavancagem_subindo",
      "Alavancagem em alta ou elevada",
      "quantitativo",
      e.alavancagemAtual !== undefined
        ? {
            presente:
              e.alavancagemAtual >= LIMIARES.alavancagemCritica ||
              (e.alavancagemAnterior !== undefined &&
                e.alavancagemAtual - e.alavancagemAnterior >= LIMIARES.altaAlavancagemPp),
            observado:
              e.alavancagemAnterior !== undefined
                ? `${pct(e.alavancagemAnterior)} → ${pct(e.alavancagemAtual)}`
                : pct(e.alavancagemAtual),
          }
        : null,
    ),
  );

  sinais.push(
    sinal(
      "vencimento_divida",
      "Dívida concentrada em 12 meses",
      "documental",
      e.dividaVencendo12mPct !== undefined
        ? {
            presente: e.dividaVencendo12mPct >= LIMIARES.dividaVencendo12mCritica,
            observado: pct(e.dividaVencendo12mPct),
          }
        : null,
    ),
  );

  sinais.push(
    sinal(
      "emissao_diluidora",
      "Emissão abaixo do valor patrimonial",
      "documental",
      e.emissaoPrecoSobreVp !== undefined
        ? {
            presente: e.emissaoPrecoSobreVp < LIMIARES.emissaoDiluidoraVp,
            observado: `emissão a ${e.emissaoPrecoSobreVp.toFixed(2)}× o VP`,
          }
        : null,
    ),
  );

  sinais.push(
    sinal(
      "concentracao_inquilino",
      "Concentração em um inquilino",
      "documental",
      e.concentracaoMaiorInquilinoPct !== undefined
        ? {
            presente: e.concentracaoMaiorInquilinoPct >= LIMIARES.concentracaoCritica,
            observado: pct(e.concentracaoMaiorInquilinoPct),
          }
        : null,
    ),
  );

  sinais.push(
    sinal(
      "muro_vencimentos",
      "Contratos vencendo em 24 meses",
      "documental",
      e.contratosVencendo24mPct !== undefined
        ? {
            presente: e.contratosVencendo24mPct >= LIMIARES.contratosVencendo24mCritica,
            observado: pct(e.contratosVencendo24mPct),
          }
        : null,
    ),
  );

  return sinais;
}

export type ResumoDeterioracao = {
  presentes: Sinal[];
  desconhecidos: Sinal[];
  /**
   * Fração dos sinais QUANTITATIVOS que pôde ser avaliada.
   *
   * Só os quantitativos entram: cobrar da triagem um sinal que exige relatório
   * gerencial condenaria todo fundo a `dados_insuficientes` e tornaria o funil
   * inútil — foi o que aconteceu na primeira execução real, com 68 fundos
   * travados aí.
   */
  cobertura: number;
  /**
   * Sinais documentais não avaliados. Não reduzem a cobertura, mas o candidato
   * carrega cada um como verificação obrigatória do Deep Max. Isto é o que
   * impede a triagem de virar "não vi problema, logo não há".
   */
  pendentesDocumentais: Sinal[];
};

export function resumirSinais(sinais: Sinal[]): ResumoDeterioracao {
  const presentes = sinais.filter((s) => s.estado === "presente");
  const desconhecidos = sinais.filter((s) => s.estado === "desconhecido");

  const quantitativos = sinais.filter((s) => s.origem === "quantitativo");
  const quantitativosAvaliados = quantitativos.filter(
    (s) => s.estado !== "desconhecido",
  );

  return {
    presentes,
    desconhecidos,
    cobertura:
      quantitativos.length === 0
        ? 0
        : quantitativosAvaliados.length / quantitativos.length,
    pendentesDocumentais: desconhecidos.filter((s) => s.origem === "documental"),
  };
}
