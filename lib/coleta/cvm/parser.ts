/**
 * Parser do Informe Mensal de FII da CVM.
 *
 * Produz os fundamentos numéricos do funil: patrimônio, cotas, valor
 * patrimonial por cota, alavancagem e a série de rendimento. Tudo por coleta
 * programática, com o layout declarado em `layout.ts`.
 *
 * Um fundo pode reenviar o informe do mesmo mês; o campo `Versao` distingue.
 * Mantemos sempre a versão mais alta — a retificação é a boa.
 */

import { numeroCsv, parseCsv } from "../csv.ts";
import {
  COLUNAS_ATIVO_PASSIVO,
  COLUNAS_COMPLEMENTO,
  COLUNAS_GERAL,
  VERSAO_PARSER_CVM,
} from "./layout.ts";

export type CadastroFundo = {
  cnpj: string;
  dataReferencia: string;
  nome: string;
  isin: string;
  segmento: string;
  mandato: string;
  tipoGestao: string;
  publicoAlvo: string;
  negociadoEmBolsa: boolean;
  administrador: string;
};

export type ComplementoMensal = {
  cnpj: string;
  dataReferencia: string;
  patrimonioLiquido: number | null;
  cotasEmitidas: number | null;
  valorPatrimonialCota: number | null;
  totalCotistas: number | null;
  /** Fração mensal, como a CVM publica (0.002871 = 0,2871% no mês). */
  dividendYieldMes: number | null;
  rentabilidadeEfetivaMes: number | null;
  taxaAdministracao: number | null;
};

export type AtivoPassivoMensal = {
  cnpj: string;
  dataReferencia: string;
  totalInvestido: number | null;
  imoveisRenda: number | null;
  totalPassivo: number | null;
  obrigacoesAquisicao: number | null;
  obrigacoesSecuritizacao: number | null;
  rendimentosDistribuir: number | null;
  disponibilidades: number | null;
};

function maiorVersaoPorChave<T extends { cnpj: string; dataReferencia: string }>(
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

export function parseGeral(texto: string): CadastroFundo[] {
  const linhas = parseCsv(texto, {
    colunasObrigatorias: Object.values(COLUNAS_GERAL),
  });

  return maiorVersaoPorChave(
    linhas.map((l) => ({
      versao: numeroCsv(l[COLUNAS_GERAL.versao]) ?? 0,
      registro: {
        cnpj: l[COLUNAS_GERAL.cnpj],
        dataReferencia: l[COLUNAS_GERAL.dataReferencia],
        nome: l[COLUNAS_GERAL.nome],
        isin: l[COLUNAS_GERAL.isin],
        segmento: l[COLUNAS_GERAL.segmento],
        mandato: l[COLUNAS_GERAL.mandato],
        tipoGestao: l[COLUNAS_GERAL.tipoGestao],
        publicoAlvo: l[COLUNAS_GERAL.publicoAlvo],
        negociadoEmBolsa: l[COLUNAS_GERAL.negociadoEmBolsa] === "S",
        administrador: l[COLUNAS_GERAL.administrador],
      },
    })),
  );
}

export function parseComplemento(texto: string): ComplementoMensal[] {
  const linhas = parseCsv(texto, {
    colunasObrigatorias: Object.values(COLUNAS_COMPLEMENTO),
  });

  return maiorVersaoPorChave(
    linhas.map((l) => ({
      versao: numeroCsv(l[COLUNAS_COMPLEMENTO.versao]) ?? 0,
      registro: {
        cnpj: l[COLUNAS_COMPLEMENTO.cnpj],
        dataReferencia: l[COLUNAS_COMPLEMENTO.dataReferencia],
        patrimonioLiquido: numeroCsv(l[COLUNAS_COMPLEMENTO.patrimonioLiquido]),
        cotasEmitidas: numeroCsv(l[COLUNAS_COMPLEMENTO.cotasEmitidas]),
        valorPatrimonialCota: numeroCsv(
          l[COLUNAS_COMPLEMENTO.valorPatrimonialCota],
        ),
        totalCotistas: numeroCsv(l[COLUNAS_COMPLEMENTO.totalCotistas]),
        dividendYieldMes: numeroCsv(l[COLUNAS_COMPLEMENTO.dividendYieldMes]),
        rentabilidadeEfetivaMes: numeroCsv(
          l[COLUNAS_COMPLEMENTO.rentabilidadeEfetivaMes],
        ),
        taxaAdministracao: numeroCsv(
          l[COLUNAS_COMPLEMENTO.percentualTaxaAdministracao],
        ),
      },
    })),
  );
}

export function parseAtivoPassivo(texto: string): AtivoPassivoMensal[] {
  const linhas = parseCsv(texto, {
    colunasObrigatorias: Object.values(COLUNAS_ATIVO_PASSIVO),
  });

  return maiorVersaoPorChave(
    linhas.map((l) => ({
      versao: numeroCsv(l[COLUNAS_ATIVO_PASSIVO.versao]) ?? 0,
      registro: {
        cnpj: l[COLUNAS_ATIVO_PASSIVO.cnpj],
        dataReferencia: l[COLUNAS_ATIVO_PASSIVO.dataReferencia],
        totalInvestido: numeroCsv(l[COLUNAS_ATIVO_PASSIVO.totalInvestido]),
        imoveisRenda:
          (numeroCsv(l[COLUNAS_ATIVO_PASSIVO.imoveisRendaAcabados]) ?? 0) +
            (numeroCsv(l[COLUNAS_ATIVO_PASSIVO.imoveisRendaConstrucao]) ?? 0) ||
          null,
        totalPassivo: numeroCsv(l[COLUNAS_ATIVO_PASSIVO.totalPassivo]),
        obrigacoesAquisicao: numeroCsv(
          l[COLUNAS_ATIVO_PASSIVO.obrigacoesAquisicaoImoveis],
        ),
        obrigacoesSecuritizacao: numeroCsv(
          l[COLUNAS_ATIVO_PASSIVO.obrigacoesSecuritizacao],
        ),
        rendimentosDistribuir: numeroCsv(
          l[COLUNAS_ATIVO_PASSIVO.rendimentosDistribuir],
        ),
        disponibilidades: numeroCsv(l[COLUNAS_ATIVO_PASSIVO.disponibilidades]),
      },
    })),
  );
}

/**
 * Renda mensal por cota, derivada do informe.
 *
 * A CVM publica `Percentual_Dividend_Yield_Mes` mas não o valor distribuído por
 * cota. Como o informe é patrimonial, tomamos o yield sobre o valor patrimonial
 * da cota:
 *
 *     renda_mes ≈ dividend_yield_mes × valor_patrimonial_cota
 *
 * **Isto é derivação, não dado publicado.** A base do yield da CVM não está
 * documentada no leiaute, então o número serve para ORDENAR a fila de triagem —
 * nunca para compor veredito, que exige o provento com fonte primária (FNET),
 * ainda não coletado.
 */
export function rendaMensalPorCota(c: ComplementoMensal): number | null {
  if (c.dividendYieldMes === null || c.valorPatrimonialCota === null) return null;
  if (c.dividendYieldMes < 0 || c.valorPatrimonialCota <= 0) return null;
  return c.dividendYieldMes * c.valorPatrimonialCota;
}

/** Alavancagem: passivo oneroso sobre patrimônio líquido. */
export function alavancagem(
  ap: AtivoPassivoMensal,
  patrimonioLiquido: number | null,
): number | null {
  if (!patrimonioLiquido || patrimonioLiquido <= 0) return null;
  const oneroso =
    (ap.obrigacoesAquisicao ?? 0) + (ap.obrigacoesSecuritizacao ?? 0);
  return oneroso / patrimonioLiquido;
}

export { VERSAO_PARSER_CVM };
