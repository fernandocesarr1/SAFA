-- SAFA — esquema inicial para FIIs, preparado para ações.
-- O frontend possui leitura pública; toda escrita permanece restrita ao administrador.

create table if not exists public.instruments (
  id bigint generated always as identity primary key,
  ticker text not null unique,
  asset_type text not null default 'fii',
  name text,
  sector text,
  segment text,
  eligible_retail boolean not null default true,
  queue_position integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instruments_ticker_format check (ticker ~ '^[A-Z0-9]{4,12}$'),
  constraint instruments_asset_type check (asset_type in ('fii', 'stock')),
  constraint instruments_queue_position_positive check (queue_position is null or queue_position > 0)
);

create table if not exists public.analysis_runs (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  version integer not null default 1,
  methodology_version text not null default 'deep-max-v1',
  status text not null default 'backlog',
  coverage_pct numeric(5,2) not null default 0,
  verdict text,
  verdict_summary text,
  thesis text,
  contrary_case text,
  quality_score numeric(4,2),
  opportunity_score numeric(4,2),
  income_score numeric(4,2),
  safety_score numeric(4,2),
  risk_score numeric(4,2),
  confidence_score numeric(4,2),
  current_price numeric(18,6),
  fair_value_low numeric(18,6),
  fair_value_base numeric(18,6),
  fair_value_high numeric(18,6),
  sustainable_income_per_share numeric(18,8),
  as_of_date date,
  started_at timestamptz,
  concluded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_runs_instrument_version_unique unique (instrument_id, version),
  constraint analysis_runs_version_positive check (version > 0),
  constraint analysis_runs_status check (status in ('backlog', 'research', 'first_review', 'second_review', 'completed', 'blocked')),
  constraint analysis_runs_coverage_range check (coverage_pct between 0 and 100),
  constraint analysis_runs_verdict check (verdict is null or verdict in ('prioritize', 'watch', 'wait_price', 'speculative', 'avoid', 'insufficient_data')),
  constraint analysis_runs_quality_range check (quality_score is null or quality_score between 0 and 10),
  constraint analysis_runs_opportunity_range check (opportunity_score is null or opportunity_score between 0 and 10),
  constraint analysis_runs_income_range check (income_score is null or income_score between 0 and 10),
  constraint analysis_runs_safety_range check (safety_score is null or safety_score between 0 and 10),
  constraint analysis_runs_risk_range check (risk_score is null or risk_score between 0 and 10),
  constraint analysis_runs_confidence_range check (confidence_score is null or confidence_score between 0 and 10),
  constraint analysis_runs_fair_value_order check (
    fair_value_low is null or fair_value_base is null or fair_value_high is null
    or (fair_value_low <= fair_value_base and fair_value_base <= fair_value_high)
  )
);

create table if not exists public.analysis_sections (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  section_code text not null,
  title text not null,
  first_pass_status text not null default 'pending',
  second_pass_status text not null default 'pending',
  score numeric(4,2),
  confidence_score numeric(4,2),
  narrative text,
  findings jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint analysis_sections_run_code_unique unique (analysis_run_id, section_code),
  constraint analysis_sections_code check (section_code in (
    'identity', 'documentary', 'portfolio', 'tenants_contracts', 'operations',
    'financials', 'income', 'debt', 'management', 'governance', 'valuation',
    'scenarios', 'risks', 'catalysts', 'technical', 'critical_review'
  )),
  constraint analysis_sections_first_status check (first_pass_status in ('pending', 'in_progress', 'complete', 'blocked')),
  constraint analysis_sections_second_status check (second_pass_status in ('pending', 'in_progress', 'complete', 'blocked')),
  constraint analysis_sections_score_range check (score is null or score between 0 and 10),
  constraint analysis_sections_confidence_range check (confidence_score is null or confidence_score between 0 and 10),
  constraint analysis_sections_findings_array check (jsonb_typeof(findings) = 'array'),
  constraint analysis_sections_questions_array check (jsonb_typeof(open_questions) = 'array')
);

create table if not exists public.source_documents (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  document_type text not null,
  title text not null,
  source_url text,
  competence_date date,
  published_at date,
  pages_total integer,
  pages_reviewed integer not null default 0,
  reading_status text not null default 'pending',
  key_findings jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_documents_type check (document_type in ('management_report', 'financial_statement', 'audit_report', 'regulation', 'material_fact', 'issuance', 'appraisal', 'other')),
  constraint source_documents_status check (reading_status in ('pending', 'reading', 'complete', 'blocked', 'unavailable')),
  constraint source_documents_pages_valid check (
    pages_total is null or (pages_total >= 0 and pages_reviewed between 0 and pages_total)
  ),
  constraint source_documents_findings_array check (jsonb_typeof(key_findings) = 'array'),
  constraint source_documents_contradictions_array check (jsonb_typeof(contradictions) = 'array')
);

create table if not exists public.metric_definitions (
  code text primary key,
  name text not null,
  unit text,
  value_type text not null default 'numeric',
  comparison_scope text not null default 'all',
  preferred_direction text not null default 'contextual',
  description text,
  constraint metric_definitions_value_type check (value_type in ('numeric', 'text')),
  constraint metric_definitions_scope check (comparison_scope in ('all', 'segment', 'fund_only', 'stock_only')),
  constraint metric_definitions_direction check (preferred_direction in ('higher', 'lower', 'target', 'contextual'))
);

create table if not exists public.metric_observations (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  analysis_run_id bigint references public.analysis_runs(id) on delete set null,
  metric_code text not null references public.metric_definitions(code) on delete restrict,
  reference_date date not null,
  value_numeric numeric(28,10),
  value_text text,
  source_url text,
  is_recurring boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint metric_observations_one_value check (num_nonnulls(value_numeric, value_text) = 1),
  constraint metric_observations_unique unique (instrument_id, metric_code, reference_date, analysis_run_id),
  constraint metric_observations_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.cash_distributions (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  reference_date date not null,
  payment_date date,
  amount_per_share numeric(18,8) not null,
  recurring_amount_per_share numeric(18,8),
  classification text not null default 'unclassified',
  source_url text,
  created_at timestamptz not null default now(),
  constraint cash_distributions_unique unique (instrument_id, reference_date, payment_date),
  constraint cash_distributions_amount_nonnegative check (amount_per_share >= 0),
  constraint cash_distributions_recurring_valid check (recurring_amount_per_share is null or recurring_amount_per_share between 0 and amount_per_share),
  constraint cash_distributions_classification check (classification in ('recurring', 'mixed', 'extraordinary', 'unclassified'))
);

create table if not exists public.market_prices (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  price_date date not null,
  open_price numeric(18,6),
  high_price numeric(18,6),
  low_price numeric(18,6),
  close_price numeric(18,6) not null,
  adjusted_close numeric(18,6),
  volume numeric(28,4),
  source_url text,
  created_at timestamptz not null default now(),
  constraint market_prices_unique unique (instrument_id, price_date),
  constraint market_prices_nonnegative check (
    close_price >= 0
    and (open_price is null or open_price >= 0)
    and (high_price is null or high_price >= 0)
    and (low_price is null or low_price >= 0)
    and (adjusted_close is null or adjusted_close >= 0)
    and (volume is null or volume >= 0)
  ),
  constraint market_prices_ohlc_valid check (
    high_price is null or low_price is null or high_price >= low_price
  )
);

create table if not exists public.material_events (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  event_date date not null,
  event_type text not null,
  title text not null,
  summary text,
  thesis_impact text not null default 'monitor',
  source_url text,
  created_at timestamptz not null default now(),
  constraint material_events_impact check (thesis_impact in ('positive', 'negative', 'neutral', 'monitor'))
);

create table if not exists public.ranking_snapshots (
  id bigint generated always as identity primary key,
  name text not null,
  cutoff_date date not null,
  methodology_version text not null,
  universe_size integer not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ranking_snapshots_universe_positive check (universe_size > 0)
);

create table if not exists public.ranking_entries (
  id bigint generated always as identity primary key,
  ranking_snapshot_id bigint not null references public.ranking_snapshots(id) on delete cascade,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  rank_overall integer not null,
  rank_segment integer,
  final_score numeric(5,2) not null,
  quality_score numeric(4,2) not null,
  opportunity_score numeric(4,2) not null,
  income_score numeric(4,2) not null,
  safety_score numeric(4,2) not null,
  confidence_score numeric(4,2) not null,
  verdict text not null,
  rationale text not null,
  created_at timestamptz not null default now(),
  constraint ranking_entries_snapshot_instrument_unique unique (ranking_snapshot_id, instrument_id),
  constraint ranking_entries_snapshot_rank_unique unique (ranking_snapshot_id, rank_overall),
  constraint ranking_entries_rank_positive check (rank_overall > 0 and (rank_segment is null or rank_segment > 0)),
  constraint ranking_entries_score_range check (
    final_score between 0 and 100
    and quality_score between 0 and 10
    and opportunity_score between 0 and 10
    and income_score between 0 and 10
    and safety_score between 0 and 10
    and confidence_score between 0 and 10
  ),
  constraint ranking_entries_verdict check (verdict in ('prioritize', 'watch', 'wait_price', 'speculative', 'avoid', 'insufficient_data'))
);

create index if not exists analysis_runs_instrument_status_idx on public.analysis_runs (instrument_id, status);
create index if not exists analysis_runs_status_updated_idx on public.analysis_runs (status, updated_at desc);
create index if not exists source_documents_run_competence_idx on public.source_documents (analysis_run_id, competence_date desc);
create index if not exists metric_observations_instrument_code_date_idx on public.metric_observations (instrument_id, metric_code, reference_date desc);
create index if not exists metric_observations_metric_code_idx on public.metric_observations (metric_code);
create index if not exists metric_observations_run_idx on public.metric_observations (analysis_run_id) where analysis_run_id is not null;
create index if not exists material_events_instrument_date_idx on public.material_events (instrument_id, event_date desc);
create index if not exists ranking_entries_snapshot_rank_idx on public.ranking_entries (ranking_snapshot_id, rank_overall);
create index if not exists ranking_entries_instrument_idx on public.ranking_entries (instrument_id);
create unique index if not exists ranking_snapshots_one_current_idx on public.ranking_snapshots (is_current) where is_current;

create or replace view public.v_analysis_queue
with (security_invoker = true)
as
select
  i.id as instrument_id,
  i.ticker,
  i.asset_type,
  i.name,
  i.sector,
  i.segment,
  i.queue_position,
  i.eligible_retail,
  ar.id as analysis_run_id,
  ar.version,
  ar.methodology_version,
  ar.status,
  ar.coverage_pct,
  ar.verdict,
  ar.verdict_summary,
  ar.quality_score,
  ar.opportunity_score,
  ar.income_score,
  ar.safety_score,
  ar.risk_score,
  ar.confidence_score,
  ar.current_price,
  ar.fair_value_low,
  ar.fair_value_base,
  ar.fair_value_high,
  ar.sustainable_income_per_share,
  ar.as_of_date,
  ar.updated_at
from public.instruments i
left join lateral (
  select run.*
  from public.analysis_runs run
  where run.instrument_id = i.id
  order by run.version desc
  limit 1
) ar on true
where i.active;

create or replace view public.v_current_ranking
with (security_invoker = true)
as
select
  rs.id as snapshot_id,
  rs.cutoff_date,
  rs.methodology_version,
  rs.universe_size,
  re.rank_overall,
  re.rank_segment,
  i.ticker,
  i.asset_type,
  i.segment,
  re.final_score,
  re.quality_score,
  re.opportunity_score,
  re.income_score,
  re.safety_score,
  re.confidence_score,
  re.verdict,
  re.rationale
from public.ranking_snapshots rs
join public.ranking_entries re on re.ranking_snapshot_id = rs.id
join public.instruments i on i.id = re.instrument_id
where rs.is_current;

alter table public.instruments enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.analysis_sections enable row level security;
alter table public.source_documents enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.metric_observations enable row level security;
alter table public.cash_distributions enable row level security;
alter table public.market_prices enable row level security;
alter table public.material_events enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.ranking_entries enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'instruments', 'analysis_runs', 'analysis_sections', 'source_documents',
    'metric_definitions', 'metric_observations', 'cash_distributions',
    'market_prices', 'material_events', 'ranking_snapshots', 'ranking_entries'
  ]
  loop
    execute format('drop policy if exists safa_public_read on public.%I', table_name);
    execute format('create policy safa_public_read on public.%I for select to anon, authenticated using (true)', table_name);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.instruments, public.analysis_runs, public.analysis_sections,
  public.source_documents, public.metric_definitions, public.metric_observations,
  public.cash_distributions, public.market_prices, public.material_events,
  public.ranking_snapshots, public.ranking_entries,
  public.v_analysis_queue, public.v_current_ranking
to anon, authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

insert into public.instruments (ticker, asset_type, queue_position)
values
  ('HGLG11', 'fii', 1),
  ('BTLG11', 'fii', 2),
  ('HSML11', 'fii', 3),
  ('XPML11', 'fii', 4),
  ('LVBI11', 'fii', 5),
  ('FATN11', 'fii', 6),
  ('ALZR11', 'fii', 7),
  ('RBVA11', 'fii', 8),
  ('VILG11', 'fii', 9),
  ('GGRC11', 'fii', 10)
on conflict (ticker) do update set
  asset_type = excluded.asset_type,
  queue_position = excluded.queue_position,
  updated_at = now();

insert into public.analysis_runs (instrument_id, version, methodology_version, status)
select id, 1, 'deep-max-v1', 'backlog'
from public.instruments
where ticker in ('HGLG11', 'BTLG11', 'HSML11', 'XPML11', 'LVBI11', 'FATN11', 'ALZR11', 'RBVA11', 'VILG11', 'GGRC11')
on conflict (instrument_id, version) do nothing;

with section_templates(section_code, title, display_order) as (
  values
    ('identity', 'Identidade, estratégia e histórico', 1),
    ('documentary', 'Leitura documental integral', 2),
    ('portfolio', 'Imóveis e composição patrimonial', 3),
    ('tenants_contracts', 'Inquilinos e contratos', 4),
    ('operations', 'Operação e indicadores do segmento', 5),
    ('financials', 'Resultado, caixa e balanço', 6),
    ('income', 'Renda recorrente e distribuições', 7),
    ('debt', 'Dívidas e compromissos', 8),
    ('management', 'Gestão e alocação de capital', 9),
    ('governance', 'Governança e conflitos', 10),
    ('valuation', 'Valuation e margem de segurança', 11),
    ('scenarios', 'Cenários pessimista, base e otimista', 12),
    ('risks', 'Riscos e testes de estresse', 13),
    ('catalysts', 'Catalisadores e gatilhos', 14),
    ('technical', 'Preço, gráficos e pontos técnicos', 15),
    ('critical_review', 'Segunda revisão crítica', 16)
)
insert into public.analysis_sections (analysis_run_id, section_code, title)
select ar.id, st.section_code, st.title
from public.analysis_runs ar
join public.instruments i on i.id = ar.instrument_id
cross join section_templates st
where ar.version = 1
  and i.ticker in ('HGLG11', 'BTLG11', 'HSML11', 'XPML11', 'LVBI11', 'FATN11', 'ALZR11', 'RBVA11', 'VILG11', 'GGRC11')
on conflict (analysis_run_id, section_code) do nothing;

insert into public.metric_definitions (code, name, unit, comparison_scope, preferred_direction, description)
values
  ('p_vp', 'Preço sobre valor patrimonial', 'x', 'all', 'contextual', 'Indicador de apoio; não representa valor intrínseco isoladamente.'),
  ('dy_12m', 'Dividend yield em 12 meses', '%', 'all', 'contextual', 'Deve ser separado entre renda recorrente e extraordinária.'),
  ('vacancy_physical', 'Vacância física', '%', 'segment', 'lower', 'Área vaga sobre a área total aplicável.'),
  ('vacancy_financial', 'Vacância financeira', '%', 'segment', 'lower', 'Receita potencial não capturada por vacância.'),
  ('leverage_nav', 'Alavancagem sobre patrimônio', '%', 'all', 'lower', 'Dívida e compromissos líquidos em relação ao patrimônio.'),
  ('income_coverage', 'Cobertura da distribuição', '%', 'all', 'higher', 'Resultado recorrente dividido pela distribuição.'),
  ('wault', 'Prazo médio dos contratos', 'anos', 'segment', 'contextual', 'Prazo médio ponderado até o vencimento contratual.'),
  ('liquidity_daily', 'Liquidez média diária', 'BRL', 'all', 'higher', 'Volume financeiro médio negociado por dia.')
on conflict (code) do update set
  name = excluded.name,
  unit = excluded.unit,
  comparison_scope = excluded.comparison_scope,
  preferred_direction = excluded.preferred_direction,
  description = excluded.description;

notify pgrst, 'reload schema';
