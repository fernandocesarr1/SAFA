export type DeepMaxSectionDefinition = {
  code: string;
  title: string;
  purpose: string;
  criteria: readonly string[];
};

export const deepMaxMethodologyVersion = "deep-max-v2.1";

export const deepMaxScoreWeights = [
  { code: "income", label: "Renda sustentável", weight: 0.25 },
  { code: "quality", label: "Qualidade dos ativos", weight: 0.2 },
  { code: "balance", label: "Balanço e caixa", weight: 0.2 },
  { code: "management", label: "Gestão e governança", weight: 0.15 },
  { code: "value", label: "Valor e margem de segurança", weight: 0.15 },
  { code: "technical", label: "Técnico e liquidez", weight: 0.05 },
] as const;

export const deepMaxSections: readonly DeepMaxSectionDefinition[] = [
  {
    code: "identity",
    title: "Identidade, estratégia e histórico",
    purpose: "Confirmar o que o fundo é, como evoluiu e quais mudanças alteraram a tese.",
    criteria: [
      "Mandato, regulamento, público-alvo e política de investimento",
      "Administrador, gestor, consultores e prestadores relevantes",
      "Linha do tempo de emissões, incorporações e mudanças de estratégia",
      "Histórico patrimonial, operacional e de gestão",
      "Taxas, incentivos e alinhamento com o cotista",
    ],
  },
  {
    code: "documentary",
    title: "Leitura documental integral",
    purpose: "Ler o escopo documental página por página, em duas passagens independentes.",
    criteria: [
      "Dois relatórios gerenciais mais recentes, sem amostragem de páginas",
      "Demonstrações financeiras e parecer de auditoria",
      "Regulamento vigente, fatos relevantes e comunicados",
      "Documentos de emissões, aquisições, vendas e avaliações aplicáveis",
      "Conciliação de contradições, lacunas e mudanças entre documentos",
    ],
  },
  {
    code: "portfolio",
    title: "Imóveis e composição patrimonial",
    purpose: "Esgotar qualidade, concentração, liquidez e riscos físicos dos ativos.",
    criteria: [
      "Todos os imóveis, localização, ABL, participação e padrão construtivo",
      "Concentração por ativo, região, tipologia e estágio operacional",
      "Idade, conservação, certificações, obsolescência e capex",
      "Valor patrimonial, laudos, custo histórico e transações comparáveis",
      "Ativos em desenvolvimento, expansões e propriedades indiretas",
    ],
  },
  {
    code: "tenants_contracts",
    title: "Inquilinos e contratos",
    purpose: "Medir a qualidade real dos locatários e a durabilidade econômica das receitas.",
    criteria: [
      "Todos os principais inquilinos e concentração de receita",
      "Qualidade de crédito, inadimplência e dependência econômica",
      "Contratos típicos e atípicos, revisões, multas e garantias",
      "Indexadores, vencimentos, carências e cronograma de renovações",
      "WAULT, revisional, risco de devolução e aluguel versus mercado",
    ],
  },
  {
    code: "operations",
    title: "Operação e indicadores do segmento",
    purpose: "Explicar como os imóveis geram receita e onde a operação pode deteriorar.",
    criteria: [
      "Vacância física e financeira por ativo e consolidada",
      "Ocupação, absorção, leasing spread e velocidade de locação",
      "Receita e NOI por metro quadrado, custos e eficiência operacional",
      "Pipeline de locações, renovações, expansões e obras",
      "Benchmark operacional do segmento e dos concorrentes comparáveis",
    ],
  },
  {
    code: "financials",
    title: "Resultado, caixa e balanço",
    purpose: "Reconstruir a geração econômica e financeira sem depender do número divulgado isolado.",
    criteria: [
      "Resultados mensais e anuais, regime de caixa e competência",
      "Receitas, despesas, provisões, contas a receber e caixa",
      "Reconciliação de eventos não recorrentes e efeitos contábeis",
      "Evolução patrimonial por cota e movimentações de capital",
      "Capex, obrigações futuras e qualidade do balanço",
    ],
  },
  {
    code: "income",
    title: "Renda recorrente e distribuições",
    purpose: "Separar renda sustentável de distribuição extraordinária ou financiada por reservas.",
    criteria: [
      "Dividendos mensais dos últimos 36 meses",
      "Resultado recorrente, extraordinário e cobertura da distribuição",
      "Reservas acumuladas, retenções, linearização e payout",
      "Guidance, estabilidade, sazonalidade e previsibilidade da renda",
      "DY corrente, DY normalizado e sensibilidade ao preço",
    ],
  },
  {
    code: "debt",
    title: "Dívidas e compromissos",
    purpose: "Mapear integralmente alavancagem, custo, vencimentos e risco de refinanciamento.",
    criteria: [
      "Saldo, credor, garantia, indexador e custo de cada obrigação",
      "Cronograma de amortização, duration e concentração de vencimentos",
      "LTV, dívida líquida, covenants e margem de segurança",
      "Parcelas de aquisições, securitizações e compromissos não contabilizados",
      "Testes de estresse de juros, vacância e refinanciamento",
    ],
  },
  {
    code: "management",
    title: "Gestão e alocação de capital",
    purpose: "Julgar decisões históricas do gestor, não apenas o discurso atual.",
    criteria: [
      "Histórico de compras, vendas, emissões e reinvestimentos",
      "Preço pago, cap rate, financiamento e criação de valor por transação",
      "Disciplina em emissões abaixo ou acima do valor patrimonial",
      "Execução de guidance, comunicação e tratamento de erros",
      "Track record comparado a pares e incentivos econômicos",
    ],
  },
  {
    code: "governance",
    title: "Governança e conflitos",
    purpose: "Identificar estruturas que possam transferir valor do cotista para partes relacionadas.",
    criteria: [
      "Partes relacionadas, conflitos declarados e transações vinculadas",
      "Concentração de votos, assembleias e direitos do cotista",
      "Taxas, remuneração variável e potenciais incentivos perversos",
      "Auditoria, controles, processos e contingências",
      "Histórico de transparência, atrasos, retificações e sanções",
    ],
  },
  {
    code: "valuation",
    title: "Valuation e margem de segurança",
    purpose: "Estimar valor por métodos independentes e explicitar as premissas que movem o resultado.",
    criteria: [
      "P/VP, cap rate implícito e comparação com pares e transações",
      "Fluxo de caixa ou renda normalizada com premissas explícitas",
      "Valor justo pessimista, base e otimista",
      "Sensibilidade a juros, vacância, aluguel, cap rate e crescimento",
      "Preço de entrada, margem de segurança e retorno esperado",
    ],
  },
  {
    code: "scenarios",
    title: "Cenários pessimista, base e otimista",
    purpose: "Transformar incertezas em cenários comparáveis, sem apresentar precisão falsa.",
    criteria: [
      "Premissas operacionais e macroeconômicas de cada cenário",
      "Renda por cota e valor justo em cada cenário",
      "Probabilidades justificadas e fatores de transição",
      "Horizontes de 12, 36 e 60 meses quando aplicáveis",
      "Ponto de ruptura da tese e perda potencial permanente",
    ],
  },
  {
    code: "risks",
    title: "Riscos e testes de estresse",
    purpose: "Procurar ativamente razões para não investir e quantificar onde for possível.",
    criteria: [
      "Riscos de ativo, inquilino, contrato, região e segmento",
      "Riscos financeiros, liquidez, emissão e refinanciamento",
      "Riscos jurídicos, regulatórios, ambientais e estruturais",
      "Choques combinados de vacância, aluguel, juros e cap rate",
      "Probabilidade, impacto, mitigadores e sinais de alerta",
    ],
  },
  {
    code: "catalysts",
    title: "Catalisadores e gatilhos",
    purpose: "Separar eventos plausíveis e verificáveis de narrativas especulativas.",
    criteria: [
      "Locações, revisões, renovações e entregas contratadas",
      "Aquisições, vendas, expansões e reciclagem de portfólio",
      "Redução de dívida, queda de custo e liberação de reservas",
      "Mudanças regulatórias ou setoriais relevantes",
      "Gatilhos de compra, espera, redução e invalidação da tese",
    ],
  },
  {
    code: "technical",
    title: "Preço, gráficos e pontos técnicos",
    purpose: "Usar o comportamento de preço como apoio ao timing, nunca como substituto dos fundamentos.",
    criteria: [
      "Histórico ajustado de preço, volume e liquidez",
      "Tendências, médias, volatilidade e drawdowns",
      "Suportes, resistências, gaps e regiões de congestão",
      "Fibonacci em movimentos tecnicamente justificáveis",
      "Confluência entre preço técnico, valor justo e renda",
    ],
  },
  {
    code: "critical_review",
    title: "Segunda revisão crítica",
    purpose: "Tentar desmontar a conclusão preliminar e localizar detalhes omitidos na primeira passagem.",
    criteria: [
      "Releitura integral das fontes e procura de omissões",
      "Reexecução dos cálculos e conciliação de números",
      "Contradições entre gestão, demonstrações e fatos",
      "Hipóteses alternativas, viés de confirmação e caso contrário",
      "Checklist final de lacunas, recência e confiança da análise",
    ],
  },
] as const;

export const deepMaxDocumentMinimums = {
  managementReports: 2,
  uniqueManagementCompetencies: 2,
  financialStatements: 3,
  auditedFinancialYears: 3,
  regulations: 1,
  distributions: 36,
  classifiedDistributions: 36,
  pricePoints: 750,
  priceHistoryYears: 3,
  universalMetrics: 32,
  valuationScenarios: 3,
  valuationAssumptions: 12,
  risks: 5,
  thesisTriggers: 3,
} as const;

export const deepMaxDocumentScopes = [
  "Relatórios gerenciais",
  "Demonstrações financeiras, notas e auditoria",
  "Regulamento vigente e versões materiais",
  "Fatos relevantes e comunicados",
  "Assembleias e deliberações",
  "Emissões e recompras",
  "Aquisições, vendas e desenvolvimentos",
  "Laudos e avaliações",
  "Contingências, seguros e documentos legais aplicáveis",
] as const;

export const deepMaxStructuredScopes = [
  "Imóveis e exposições",
  "Locatários",
  "Contratos",
  "Dívidas e compromissos",
  "Valuation e premissas",
  "Riscos e estresses",
  "Gatilhos e falsificadores",
  "Indicadores técnicos e de liquidez",
] as const;

export const deepMaxSegmentOverlays = {
  logistics: {
    label: "Logística e industrial",
    criteria: [
      "Custo de reposição, valor do terreno e aluguel por metro quadrado",
      "Oferta, absorção, vacância e aluguel no micromercado",
      "Acessos, raio logístico, last mile e dependência de infraestrutura",
      "Pé-direito, piso, docas, certificações, idade e fungibilidade",
      "Aderência do imóvel ao locatário e custo de recolocação",
    ],
  },
  shopping: {
    label: "Shopping centers",
    criteria: [
      "Vendas por metro quadrado, SSS, SSR e fluxo de consumidores",
      "NOI por metro quadrado e margem operacional",
      "Custo de ocupação, inadimplência, descontos e carências",
      "Mix de lojas, âncoras, concentração e poder de atração",
      "Área de influência, competição, expansões e capex",
    ],
  },
  offices: {
    label: "Lajes corporativas",
    criteria: [
      "Aluguel pedido, efetivo e de mercado por metro quadrado",
      "Vacância, absorção e oferta futura no submercado",
      "Classe, idade, retrofit, certificações e obsolescência",
      "Incentivos de locação, carências, comissão e capex de recolocação",
      "Acessibilidade, transporte, serviços e demanda corporativa",
    ],
  },
  urban_income: {
    label: "Renda urbana e varejo",
    criteria: [
      "Fungibilidade, uso alternativo e liquidez imobiliária",
      "Crédito e concentração dos locatários dominantes",
      "Força econômica dos contratos atípicos e multas",
      "BTS, earn-outs, obras, parcelas e capex comprometido",
      "Aluguel contratado versus mercado e custo de substituição",
    ],
  },
} as const;

export function getDeepMaxSection(code: string) {
  return deepMaxSections.find((section) => section.code === code);
}
