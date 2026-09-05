/**
 * Layout do Informe Mensal de FII da CVM (dados abertos).
 *
 * Os nomes abaixo NÃO foram inferidos: vieram da leitura do arquivo real
 * `inf_mensal_fii_2025.zip` em 2026-09-05. Se a CVM renomear uma coluna, o
 * parser falha alto nomeando o que encontrou, em vez de devolver nulo.
 *
 * Fonte: https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/
 */

export const URL_BASE_INFORME_MENSAL =
  "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS";

export function urlInformeMensal(ano: number): string {
  return `${URL_BASE_INFORME_MENSAL}/inf_mensal_fii_${ano}.zip`;
}

/** Cadastro: identidade, segmento e o ISIN que liga à B3. */
export const COLUNAS_GERAL = {
  cnpj: "CNPJ_Fundo_Classe",
  dataReferencia: "Data_Referencia",
  versao: "Versao",
  nome: "Nome_Fundo_Classe",
  isin: "Codigo_ISIN",
  cotasEmitidas: "Quantidade_Cotas_Emitidas",
  mandato: "Mandato",
  segmento: "Segmento_Atuacao",
  tipoGestao: "Tipo_Gestao",
  publicoAlvo: "Publico_Alvo",
  negociadoEmBolsa: "Mercado_Negociacao_Bolsa",
  administrador: "Nome_Administrador",
} as const;

/** Complemento: patrimônio, cotas, VP por cota e rentabilidade. */
export const COLUNAS_COMPLEMENTO = {
  cnpj: "CNPJ_Fundo_Classe",
  dataReferencia: "Data_Referencia",
  versao: "Versao",
  totalCotistas: "Total_Numero_Cotistas",
  valorAtivo: "Valor_Ativo",
  patrimonioLiquido: "Patrimonio_Liquido",
  cotasEmitidas: "Cotas_Emitidas",
  valorPatrimonialCota: "Valor_Patrimonial_Cotas",
  percentualTaxaAdministracao: "Percentual_Despesas_Taxa_Administracao",
  rentabilidadeEfetivaMes: "Percentual_Rentabilidade_Efetiva_Mes",
  rentabilidadePatrimonialMes: "Percentual_Rentabilidade_Patrimonial_Mes",
  dividendYieldMes: "Percentual_Dividend_Yield_Mes",
  amortizacaoCotasMes: "Percentual_Amortizacao_Cotas_Mes",
} as const;

/** Ativo e passivo: dá a alavancagem e a composição do portfólio. */
export const COLUNAS_ATIVO_PASSIVO = {
  cnpj: "CNPJ_Fundo_Classe",
  dataReferencia: "Data_Referencia",
  versao: "Versao",
  disponibilidades: "Disponibilidades",
  totalInvestido: "Total_Investido",
  imoveisRendaAcabados: "Imoveis_Renda_Acabados",
  imoveisRendaConstrucao: "Imoveis_Renda_Construcao",
  contasReceberAluguel: "Contas_Receber_Aluguel",
  rendimentosDistribuir: "Rendimentos_Distribuir",
  obrigacoesAquisicaoImoveis: "Obrigacoes_Aquisicao_Imoveis",
  obrigacoesSecuritizacao: "Obrigacoes_Securitizacao_Recebiveis",
  provisoesContingencias: "Provisoes_Contigencias",
  totalPassivo: "Total_Passivo",
} as const;

export const ARQUIVOS = {
  geral: /inf_mensal_fii_geral_\d{4}\.csv$/i,
  complemento: /inf_mensal_fii_complemento_\d{4}\.csv$/i,
  ativoPassivo: /inf_mensal_fii_ativo_passivo_\d{4}\.csv$/i,
} as const;

/** Versão do parser da CVM. Sobe quando a interpretação muda. */
export const VERSAO_PARSER_CVM = "cvm-inf-mensal-1.0.0";
