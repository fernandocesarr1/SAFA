export type QueueItem = {
  instrument_id: number;
  ticker: string;
  asset_type: "fii" | "stock";
  name: string | null;
  sector: string | null;
  segment: string | null;
  segment_key: string | null;
  queue_position: number | null;
  eligible_retail: boolean;
  eligibility_status: string;
  eligibility_confidence: string;
  eligibility_source_url: string | null;
  eligibility_verified_at: string | null;
  universe_status: string;
  analysis_profile: string;
  analysis_profile_status: string;
  analysis_profile_source_url: string | null;
  analysis_profile_verified_at: string | null;
  analysis_run_id: number | null;
  version: number | null;
  methodology_version: string | null;
  status: string | null;
  coverage_pct: number | string | null;
  verdict: string | null;
  verdict_summary: string | null;
  quality_score: number | string | null;
  opportunity_score: number | string | null;
  income_score: number | string | null;
  safety_score: number | string | null;
  balance_cash_score: number | string | null;
  management_governance_score: number | string | null;
  value_margin_score: number | string | null;
  technical_liquidity_score: number | string | null;
  weighted_score: number | string | null;
  risk_score: number | string | null;
  confidence_score: number | string | null;
  action_new_money: string | null;
  action_existing_holder: string | null;
  current_price: number | string | null;
  fair_value_low: number | string | null;
  fair_value_base: number | string | null;
  fair_value_high: number | string | null;
  sustainable_income_per_share: number | string | null;
  as_of_date: string | null;
  is_stale: boolean;
  updated_at: string | null;
};

export type AnalysisSection = {
  id: number;
  analysis_run_id: number;
  section_code: string;
  title: string;
  first_pass_status: string;
  second_pass_status: string;
  score: number | string | null;
  confidence_score: number | string | null;
  narrative: string | null;
  findings: unknown[];
  open_questions: unknown[];
  updated_at: string;
};

export type SourceDocument = {
  id: number;
  document_type: string;
  title: string;
  source_url: string | null;
  competence_date: string | null;
  published_at?: string | null;
  pages_total: number | null;
  pages_reviewed: number;
  reading_status: string;
  first_pass_pages_reviewed?: number;
  second_pass_pages_reviewed?: number;
  first_pass_status?: string;
  second_pass_status?: string;
};

export type AnalysisReadiness = {
  analysis_run_id: number;
  instrument_id: number;
  ticker: string;
  section_total: number;
  first_sections_complete: number;
  second_sections_complete: number;
  criterion_total: number;
  first_criteria_complete: number;
  second_criteria_complete: number;
  critical_unavailable_count: number;
  document_scope_total: number;
  document_scopes_complete: number;
  data_scope_total: number;
  data_scopes_complete: number;
  debt_scope_not_applicable: boolean;
  documents_total: number;
  management_reports: number;
  management_unique_competencies: number;
  financial_statements: number;
  financial_statement_years: number;
  audited_financial_years: number;
  audit_reports: number;
  regulations: number;
  first_documents_complete: number;
  second_documents_complete: number;
  pages_total: number;
  first_pages_reviewed: number;
  second_pages_reviewed: number;
  distribution_count: number;
  classified_distribution_count: number;
  distribution_span_days: number;
  price_count: number;
  price_span_days: number;
  distinct_metric_count: number;
  required_metric_count: number;
  verified_required_metric_count: number;
  property_count: number;
  tenant_count: number;
  lease_count: number;
  debt_count: number;
  valuation_scenario_count: number;
  valuation_assumption_count: number;
  counter_model_count: number;
  risk_count: number;
  thesis_trigger_type_count: number;
  eligibility_ready: boolean;
  data_fresh: boolean;
  research_exhausted: boolean;
  completion_ready: boolean;
};

export type UniverseStats = {
  fii_registered: number;
  fii_retail_verified: number;
  fii_queued: number;
  fii_completed: number;
};

export type RankingEntry = {
  snapshot_id: number;
  analysis_run_id: number;
  cutoff_date: string;
  universe_size: number;
  rank_overall: number;
  rank_segment: number | null;
  ticker: string;
  segment: string | null;
  final_score: number | string;
  quality_score: number | string;
  opportunity_score: number | string;
  income_score: number | string;
  safety_score: number | string;
  balance_cash_score: number | string;
  management_governance_score: number | string;
  value_margin_score: number | string;
  technical_liquidity_score: number | string;
  risk_score: number | string;
  confidence_score: number | string;
  verdict: string;
  rationale: string;
};

export type MetricObservation = {
  metric_code: string;
  reference_date: string;
  value_numeric: number | string | null;
  value_text: string | null;
  source_url: string | null;
};

export type ValuationScenario = {
  scenario_code: "pessimistic" | "base" | "optimistic";
  horizon_months: number;
  model_method: string;
  expected_income_per_share: number | string | null;
  fair_value_per_share: number | string;
  expected_total_return_pct: number | string | null;
  probability_pct: number | string | null;
  counter_model_method: string | null;
  counter_model_value_per_share: number | string | null;
  notes: string;
};

export type RiskItem = {
  risk_code: string;
  category: string;
  description: string;
  probability_score: number;
  impact_score: number;
  quantified_loss_pct: number | string | null;
  mitigants: string;
  warning_signals: string;
  stress_test_result: string;
};

export type ThesisTrigger = {
  trigger_code: string;
  trigger_type: string;
  description: string;
  threshold_numeric: number | string | null;
  threshold_text: string | null;
  status: string;
};

export type CashDistribution = {
  reference_date: string;
  amount_per_share: number | string;
  recurring_amount_per_share: number | string | null;
  classification: string;
};

export type MarketPrice = {
  price_date: string;
  close_price: number | string;
};

export type FundTenant = {
  name: string;
  sector: string | null;
  revenue_share_pct: number | string | null;
};

export type QualitativeReportSection = {
  code: string;
  title: string;
  content: string;
};

export type FinalAnalysisReport = {
  status: string;
  version: string | null;
  generated_at: string | null;
  title: string;
  executive_summary: string;
  final_conclusion: string;
  sections: QualitativeReportSection[];
  strengths: string[];
  weaknesses: string[];
  conditions_to_invest: string[];
  limitations: string[];
};

const initialTickers = [
  "TRXF11", "GGRC11", "RBRY11", "MXRF11", "AAZQ11", "SNEL11", "GARE11",
  "KNSC11", "CPSH11", "HGCR11", "BRCR11", "NSLU11", "RBVA11", "TGAR11",
  "HGLG11", "BTLG11", "HSML11", "XPML11", "LVBI11", "FATN11", "ALZR11", "VILG11",
] as const;

const fallbackQueue: QueueItem[] = initialTickers.map((ticker, index) => ({
  instrument_id: index + 1,
  ticker,
  asset_type: "fii",
  name: null,
  sector: null,
  segment: null,
  segment_key: null,
  queue_position: index + 1,
  eligible_retail: false,
  eligibility_status: "unverified",
  eligibility_confidence: "low",
  eligibility_source_url: null,
  eligibility_verified_at: null,
  universe_status: "queued",
  analysis_profile: "unclassified",
  analysis_profile_status: "pending_verification",
  analysis_profile_source_url: null,
  analysis_profile_verified_at: null,
  analysis_run_id: index + 1,
  version: 1,
  methodology_version: "deep-max-v2.1",
  status: "backlog",
  coverage_pct: 0,
  verdict: null,
  verdict_summary: null,
  quality_score: null,
  opportunity_score: null,
  income_score: null,
  safety_score: null,
  balance_cash_score: null,
  management_governance_score: null,
  value_margin_score: null,
  technical_liquidity_score: null,
  weighted_score: null,
  risk_score: null,
  confidence_score: null,
  action_new_money: null,
  action_existing_holder: null,
  current_price: null,
  fair_value_low: null,
  fair_value_base: null,
  fair_value_high: null,
  sustainable_income_per_share: null,
  as_of_date: null,
  is_stale: true,
  updated_at: null,
}));

const sectionTemplates = [
  ["identity", "Identidade, estratégia e histórico"],
  ["documentary", "Leitura documental integral"],
  ["portfolio", "Imóveis e composição patrimonial"],
  ["tenants_contracts", "Inquilinos e contratos"],
  ["operations", "Operação e indicadores do segmento"],
  ["financials", "Resultado, caixa e balanço"],
  ["income", "Renda recorrente e distribuições"],
  ["debt", "Dívidas e compromissos"],
  ["management", "Gestão e alocação de capital"],
  ["governance", "Governança e conflitos"],
  ["valuation", "Valuation e margem de segurança"],
  ["scenarios", "Cenários pessimista, base e otimista"],
  ["risks", "Riscos e testes de estresse"],
  ["catalysts", "Catalisadores e gatilhos"],
  ["technical", "Preço, gráficos e pontos técnicos"],
  ["critical_review", "Segunda revisão crítica"],
] as const;

function fallbackSections(runId: number): AnalysisSection[] {
  return sectionTemplates.map(([section_code, title], index) => ({
    id: index + 1,
    analysis_run_id: runId,
    section_code,
    title,
    first_pass_status: "pending",
    second_pass_status: "pending",
    score: null,
    confidence_score: null,
    narrative: null,
    findings: [],
    open_questions: [],
    updated_at: new Date(0).toISOString(),
  }));
}

function restConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

async function select<T>(path: string): Promise<T[]> {
  const config = restConfig();
  if (!config) throw new Error("Supabase não configurado");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.key,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Supabase respondeu ${response.status}`);
  }

  return (await response.json()) as T[];
}

export async function getQueue(): Promise<QueueItem[]> {
  try {
    const rows = await select<QueueItem>(
      "v_analysis_queue?select=*&asset_type=eq.fii&order=queue_position.asc.nullslast,ticker.asc",
    );
    return rows.length ? rows : fallbackQueue;
  } catch {
    return fallbackQueue;
  }
}

export async function getInstrument(ticker: string): Promise<QueueItem | null> {
  const normalized = ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const queue = await getQueue();
  return queue.find((item) => item.ticker === normalized) ?? null;
}

export async function getSections(runId: number | null): Promise<AnalysisSection[]> {
  if (!runId) return [];
  try {
    const rows = await select<AnalysisSection>(
      `analysis_sections?select=*&analysis_run_id=eq.${runId}&order=id.asc`,
    );
    return rows.length ? rows : fallbackSections(runId);
  } catch {
    return fallbackSections(runId);
  }
}

export async function getDocuments(runId: number | null): Promise<SourceDocument[]> {
  if (!runId) return [];
  try {
    return await select<SourceDocument>(
      `source_documents?select=id,document_type,title,source_url,competence_date,published_at,pages_total,pages_reviewed,reading_status,first_pass_pages_reviewed,second_pass_pages_reviewed,first_pass_status,second_pass_status&analysis_run_id=eq.${runId}&order=competence_date.desc.nullslast`,
    );
  } catch {
    return [];
  }
}

export async function getReadiness(runId: number | null): Promise<AnalysisReadiness | null> {
  if (!runId) return null;
  try {
    const rows = await select<AnalysisReadiness>(
      `v_analysis_readiness?select=*&analysis_run_id=eq.${runId}&limit=1`,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentRanking(): Promise<RankingEntry[]> {
  try {
    return await select<RankingEntry>(
      "v_current_ranking?select=*&asset_type=eq.fii&order=rank_overall.asc",
    );
  } catch {
    return [];
  }
}

export async function getMetrics(runId: number | null): Promise<MetricObservation[]> {
  if (!runId) return [];
  try {
    return await select<MetricObservation>(
      `metric_observations?select=metric_code,reference_date,value_numeric,value_text,source_url&analysis_run_id=eq.${runId}&order=metric_code.asc`,
    );
  } catch { return []; }
}

export async function getValuationScenarios(runId: number | null): Promise<ValuationScenario[]> {
  if (!runId) return [];
  try {
    return await select<ValuationScenario>(
      `valuation_scenarios?select=scenario_code,horizon_months,model_method,expected_income_per_share,fair_value_per_share,expected_total_return_pct,probability_pct,counter_model_method,counter_model_value_per_share,notes&analysis_run_id=eq.${runId}&order=fair_value_per_share.asc`,
    );
  } catch { return []; }
}

export async function getRisks(runId: number | null): Promise<RiskItem[]> {
  if (!runId) return [];
  try {
    return await select<RiskItem>(
      `risk_register?select=risk_code,category,description,probability_score,impact_score,quantified_loss_pct,mitigants,warning_signals,stress_test_result&analysis_run_id=eq.${runId}&order=impact_score.desc,probability_score.desc`,
    );
  } catch { return []; }
}

export async function getTriggers(runId: number | null): Promise<ThesisTrigger[]> {
  if (!runId) return [];
  try {
    return await select<ThesisTrigger>(
      `thesis_triggers?select=trigger_code,trigger_type,description,threshold_numeric,threshold_text,status&analysis_run_id=eq.${runId}&order=trigger_type.asc`,
    );
  } catch { return []; }
}

export async function getDistributions(runId: number | null): Promise<CashDistribution[]> {
  if (!runId) return [];
  try {
    return await select<CashDistribution>(
      `cash_distributions?select=reference_date,amount_per_share,recurring_amount_per_share,classification&analysis_run_id=eq.${runId}&order=reference_date.asc`,
    );
  } catch { return []; }
}

export async function getPrices(instrumentId: number): Promise<MarketPrice[]> {
  try {
    return await select<MarketPrice>(
      `market_prices?select=price_date,close_price&instrument_id=eq.${instrumentId}&order=price_date.asc`,
    );
  } catch { return []; }
}

export async function getTopTenants(runId: number | null): Promise<FundTenant[]> {
  if (!runId) return [];
  try {
    return await select<FundTenant>(
      `fund_tenants?select=name,sector,revenue_share_pct&analysis_run_id=eq.${runId}&revenue_share_pct=not.is.null&order=revenue_share_pct.desc&limit=10`,
    );
  } catch { return []; }
}

export async function getFinalReport(runId: number | null): Promise<FinalAnalysisReport | null> {
  if (!runId) return null;
  try {
    const rows = await select<{
      final_report_status: string;
      final_report_version: string | null;
      final_report_generated_at: string | null;
      final_report: Omit<FinalAnalysisReport, "status" | "version" | "generated_at"> | null;
    }>(
      `analysis_runs?select=final_report_status,final_report_version,final_report_generated_at,final_report&id=eq.${runId}&limit=1`,
    );
    const row = rows[0];
    if (!row?.final_report) return null;
    return {
      status: row.final_report_status,
      version: row.final_report_version,
      generated_at: row.final_report_generated_at,
      ...row.final_report,
    };
  } catch { return null; }
}

export async function getUniverseStats(): Promise<UniverseStats> {
  try {
    const rows = await select<UniverseStats>("v_universe_stats?select=*&limit=1");
    return rows[0] ?? {
      fii_registered: 0,
      fii_retail_verified: 0,
      fii_queued: 0,
      fii_completed: 0,
    };
  } catch {
    return {
      fii_registered: fallbackQueue.length,
      fii_retail_verified: 0,
      fii_queued: fallbackQueue.length,
      fii_completed: 0,
    };
  }
}

export function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
