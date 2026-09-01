export type QueueItem = {
  instrument_id: number;
  ticker: string;
  asset_type: "fii" | "stock";
  name: string | null;
  sector: string | null;
  segment: string | null;
  queue_position: number | null;
  eligible_retail: boolean;
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
  risk_score: number | string | null;
  confidence_score: number | string | null;
  current_price: number | string | null;
  fair_value_low: number | string | null;
  fair_value_base: number | string | null;
  fair_value_high: number | string | null;
  sustainable_income_per_share: number | string | null;
  as_of_date: string | null;
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
  pages_total: number | null;
  pages_reviewed: number;
  reading_status: string;
};

export type RankingEntry = {
  snapshot_id: number;
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
  confidence_score: number | string;
  verdict: string;
  rationale: string;
};

const initialTickers = [
  "HGLG11",
  "BTLG11",
  "HSML11",
  "XPML11",
  "LVBI11",
  "FATN11",
  "ALZR11",
  "RBVA11",
  "VILG11",
  "GGRC11",
];

const fallbackQueue: QueueItem[] = initialTickers.map((ticker, index) => ({
  instrument_id: index + 1,
  ticker,
  asset_type: "fii",
  name: null,
  sector: null,
  segment: null,
  queue_position: index + 1,
  eligible_retail: true,
  analysis_run_id: index + 1,
  version: 1,
  methodology_version: "deep-max-v1",
  status: "backlog",
  coverage_pct: 0,
  verdict: null,
  verdict_summary: null,
  quality_score: null,
  opportunity_score: null,
  income_score: null,
  safety_score: null,
  risk_score: null,
  confidence_score: null,
  current_price: null,
  fair_value_low: null,
  fair_value_base: null,
  fair_value_high: null,
  sustainable_income_per_share: null,
  as_of_date: null,
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
      `source_documents?select=id,document_type,title,source_url,competence_date,pages_total,pages_reviewed,reading_status&analysis_run_id=eq.${runId}&order=competence_date.desc.nullslast`,
    );
  } catch {
    return [];
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

export function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

