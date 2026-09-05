/**
 * Informe Trimestral de FII da CVM — a segunda fonte de fundamentos.
 *
 * Layout lido do arquivo real `inf_trimestral_fii_2026.zip` em 2026-09-05.
 *
 * Vale por dois motivos independentes:
 *
 * 1. **Corrobora a renda.** `Rendimentos_Declarados` é uma terceira medida do
 *    mesmo fato, ao lado do FNET (declarada) e do informe mensal (derivada).
 * 2. **Converte sinal documental em quantitativo.** O cronograma de vencimento
 *    de contratos e a concentração por inquilino vinham como "desconhecido" na
 *    triagem, obrigando o Deep Max. Agora são número.
 */

import { numeroCsv, parseCsv } from "../csv.ts";

export const URL_BASE_INFORME_TRIMESTRAL =
  "https://dados.cvm.gov.br/dados/FII/DOC/INF_TRIMESTRAL/DADOS";

export function urlInformeTrimestral(ano: number): string {
  return `${URL_BASE_INFORME_TRIMESTRAL}/inf_trimestral_fii_${ano}.zip`;
}

export const VERSAO_PARSER_TRIMESTRAL = "cvm-inf-trimestral-1.0.0";

export const ARQUIVOS_TRIMESTRAL = {
  complemento: /inf_trimestral_fii_complemento_\d{4}\.csv$/i,
  inquilino: /inf_trimestral_fii_imovel_renda_acabado_inquilino_\d{4}\.csv$/i,
  resultado: /inf_trimestral_fii_resultado_contabil_financeiro_\d{4}\.csv$/i,
} as const;

/** Faixas de vencimento publicadas, em meses. */
const FAIXAS_ATE_24M = [
  "Ate_3Meses",
  "3a6Meses",
  "6a9Meses",
  "9a12Meses",
  "12a15Meses",
  "15a18Meses",
  "18a21Meses",
  "21a24Meses",
] as const;

export type ContratosTrimestral = {
  cnpj: string;
  dataReferencia: string;
  /** Fração da receita cujos contratos vencem em até 24 meses. */
  vencendoAte24m: number | null;
  /** Fração da receita indexada a cada índice. */
  indexadorIpca: number | null;
  indexadorIgpm: number | null;
  indexadorInpc: number | null;
};

export type InquilinoTrimestral = {
  cnpj: string;
  dataReferencia: string;
  nomeImovel: string;
  setor: string;
  /** Fração da receita total do fundo vinda deste inquilino. */
  percentualReceitaFii: number | null;
};

export type ResultadoTrimestral = {
  cnpj: string;
  dataReferencia: string;
  /** Rendimento declarado no trimestre, em reais. Terceira medida de renda. */
  rendimentosDeclarados: number | null;
  receitaAluguel: number | null;
  resultadoLiquidoFinanceiro: number | null;
  lucroContabil: number | null;
};

function maiorVersao<T extends { cnpj: string; dataReferencia: string }>(
  linhas: { registro: T; versao: number }[],
): T[] {
  const melhor = new Map<string, { registro: T; versao: number }>();
  for (const item of linhas) {
    const chave = `${item.registro.cnpj}|${item.registro.dataReferencia}`;
    const atual = melhor.get(chave);
    if (!atual || item.versao > atual.versao) melhor.set(chave, item);
  }
  return [...melhor.values()].map((i) => i.registro);
}

/**
 * Cronograma de vencimento e indexadores.
 *
 * Soma as faixas até 24 meses porque é o horizonte em que uma renovação
 * malsucedida já afeta a renda observável — e é a janela que o sinal
 * `muro_vencimentos` usa.
 */
export function parseContratos(texto: string): ContratosTrimestral[] {
  const linhas = parseCsv(texto, {
    colunasObrigatorias: [
      "CNPJ_Fundo_Classe",
      "Data_Referencia",
      "Versao",
      "Percentual_Vencimento_Receita_FII_Faixa_Ate_3Meses",
      "Percentual_Indexador_Receita_FII_IPCA",
    ],
  });

  return maiorVersao(
    linhas.map((l) => {
      const parcelas = FAIXAS_ATE_24M.map((f) =>
        numeroCsv(l[`Percentual_Vencimento_Receita_FII_Faixa_${f}`]),
      );
      // se nenhuma faixa veio, é ausência de dado — não zero
      const conhecidas = parcelas.filter((p): p is number => p !== null);

      return {
        versao: numeroCsv(l["Versao"]) ?? 0,
        registro: {
          cnpj: l["CNPJ_Fundo_Classe"],
          dataReferencia: l["Data_Referencia"],
          vencendoAte24m:
            conhecidas.length === 0
              ? null
              : conhecidas.reduce((s, v) => s + v, 0),
          indexadorIpca: numeroCsv(l["Percentual_Indexador_Receita_FII_IPCA"]),
          indexadorIgpm: numeroCsv(l["Percentual_Indexador_Receita_FII_IGPM"]),
          indexadorInpc: numeroCsv(l["Percentual_Indexador_Receita_FII_INPC"]),
        },
      };
    }),
  );
}

/** Inquilinos com participação na receita. Não deduplica: são vários por fundo. */
export function parseInquilinos(texto: string): InquilinoTrimestral[] {
  const linhas = parseCsv(texto, {
    colunasObrigatorias: [
      "CNPJ_Fundo_Classe",
      "Data_Referencia",
      "Nome_Imovel",
      "Percentual_Receitas_FII",
    ],
  });

  return linhas.map((l) => ({
    cnpj: l["CNPJ_Fundo_Classe"],
    dataReferencia: l["Data_Referencia"],
    nomeImovel: l["Nome_Imovel"],
    setor: l["Setor_Atuacao"] ?? "",
    percentualReceitaFii: numeroCsv(l["Percentual_Receitas_FII"]),
  }));
}

/**
 * Maior concentração de receita num único inquilino, por fundo e competência.
 *
 * Devolve `null` quando o fundo não declara nenhum percentual — ausência de
 * dado, não concentração zero.
 */
export function concentracaoMaiorInquilino(
  inquilinos: readonly InquilinoTrimestral[],
): Map<string, number> {
  const maior = new Map<string, number>();
  for (const i of inquilinos) {
    if (i.percentualReceitaFii === null) continue;
    const chave = `${i.cnpj}|${i.dataReferencia}`;
    const atual = maior.get(chave);
    if (atual === undefined || i.percentualReceitaFii > atual) {
      maior.set(chave, i.percentualReceitaFii);
    }
  }
  return maior;
}

export function parseResultado(texto: string): ResultadoTrimestral[] {
  const linhas = parseCsv(texto, {
    colunasObrigatorias: [
      "CNPJ_Fundo_Classe",
      "Data_Referencia",
      "Versao",
      "Rendimentos_Declarados",
    ],
  });

  return maiorVersao(
    linhas.map((l) => ({
      versao: numeroCsv(l["Versao"]) ?? 0,
      registro: {
        cnpj: l["CNPJ_Fundo_Classe"],
        dataReferencia: l["Data_Referencia"],
        rendimentosDeclarados: numeroCsv(l["Rendimentos_Declarados"]),
        receitaAluguel: numeroCsv(l["Receita_Aluguel_Investimento_Financeiro"]),
        resultadoLiquidoFinanceiro: numeroCsv(
          l["Resultado_Trimestral_Liquido_Financeiro"],
        ),
        lucroContabil: numeroCsv(l["Lucro_Contabil"]),
      },
    })),
  );
}

/**
 * `Rendimentos_Declarados` é ACUMULADO NO EXERCÍCIO, não do trimestre.
 *
 * Descoberto pela triangulação contra o informe mensal: 290 de 386 fundos
 * divergiam, e o padrão era inconfundível — o mesmo fundo aparecia com 1,20 no
 * primeiro trimestre e 2,40 no segundo; 43,43 e depois 87,73. Valor dobrando e
 * triplicando ao longo do ano é acumulação, não crescimento de renda.
 *
 * Sem esta função, o trimestre seria lido como três vezes maior no fim do ano.
 * A confrontação entre fontes existe exatamente para pegar divergência de
 * semântica como esta, que passa despercebida quando há uma fonte só.
 */
export function desacumularPorExercicio(
  resultados: readonly ResultadoTrimestral[],
): ResultadoTrimestral[] {
  const porFundoAno = new Map<string, ResultadoTrimestral[]>();
  for (const r of resultados) {
    const ano = r.dataReferencia.slice(0, 4);
    const chave = `${r.cnpj}|${ano}`;
    const lista = porFundoAno.get(chave) ?? [];
    lista.push(r);
    porFundoAno.set(chave, lista);
  }

  const saida: ResultadoTrimestral[] = [];
  for (const lista of porFundoAno.values()) {
    lista.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));
    let anterior: number | null = null;
    for (const r of lista) {
      const acumulado = r.rendimentosDeclarados;
      let doTrimestre: number | null = acumulado;

      if (acumulado !== null && anterior !== null) {
        const diferenca = acumulado - anterior;
        // diferença negativa significa retificação ou reinício da contagem:
        // não dá para desacumular com segurança, então o trimestre é ausente
        doTrimestre = diferenca >= 0 ? diferenca : null;
      }
      if (acumulado !== null) anterior = acumulado;

      saida.push({ ...r, rendimentosDeclarados: doTrimestre });
    }
  }
  return saida;
}

/**
 * Renda trimestral por cota, a partir do rendimento declarado.
 *
 * Diferente da derivação do informe mensal, aqui o numerador é publicado; só o
 * divisor vem de fora (cotas emitidas). Ainda é derivação, mas com uma
 * suposição a menos.
 *
 * **Exige o resultado já desacumulado** por `desacumularPorExercicio`. Passar o
 * acumulado devolve o ano inteiro no lugar do trimestre.
 */
export function rendaTrimestralPorCota(
  r: ResultadoTrimestral,
  cotasEmitidas: number | null,
): number | null {
  if (r.rendimentosDeclarados === null || !cotasEmitidas || cotasEmitidas <= 0) {
    return null;
  }
  if (r.rendimentosDeclarados < 0) return null;
  return r.rendimentosDeclarados / cotasEmitidas;
}
