-- SAFA — baseline anterior ao livro-razão
--
-- NATUREZA DESTE ARQUIVO — leia antes de usar
--
-- Isto NÃO é uma migration. Nunca foi aplicado por apply_migration e não tem
-- entrada em supabase_migrations.schema_migrations. Nenhuma linha foi inserida
-- no livro-razão para representá-lo: forjar essa entrada falsificaria justamente
-- o registro que esta reconciliação existe para consertar.
--
-- É uma RECONSTRUÇÃO A PARTIR DO ESTADO VIVO do banco, feita por leitura do
-- catálogo do Postgres em 2026-09-03. Não existe texto de referência do SQL
-- original: as 11 tabelas fundacionais foram criadas antes de o projeto adotar
-- apply_migration, e esse SQL não foi preservado em lugar nenhum. Portanto este
-- arquivo é reconstrução declarada, NÃO cópia verificável por hash — ao
-- contrário dos seis arquivos de migration vizinhos, cujo hash confere byte a
-- byte com o livro-razão.
--
-- ESCOPO
--
--   11 tabelas fundacionais sem create table no livro-razão:
--     instruments, analysis_runs, analysis_sections, source_documents,
--     metric_definitions, metric_observations, cash_distributions,
--     market_prices, material_events, ranking_snapshots, ranking_entries
--
--   NÃO inclui os objetos de qualitative_final_report_v1. Eles também estão
--   fora do livro-razão, mas foram aplicados DEPOIS das seis migrations, e a
--   ordem importa: ficam em
--   99999999999999_qualitative_final_report_out_of_ledger.sql.
--
--   Não inclui as 17 tabelas nem as 4 views criadas pelo livro-razão, nem as
--   6 funções e 5 triggers que dele constam. Esses têm arquivo próprio.
--
-- DUAS RESSALVAS QUE MUDAM COMO ESTE ARQUIVO DEVE SER LIDO
--
-- 1. Extraído do estado ATUAL, este baseline já contém colunas que na verdade
--    foram acrescentadas depois pelas migrations do livro-razão — por exemplo
--    as colunas de dupla passagem em analysis_sections e source_documents, da
--    20260901005500. Em replay, os "add column if not exists" dessas migrations
--    viram no-op. O estado final é o mesmo; a atribuição histórica de cada
--    coluna, não.
--
--    Isso NÃO é inofensivo em todos os casos, e o replay provou: as colunas
--    final_report* precisaram sair daqui. A view v_analysis_queue é criada com
--    "select candidate.*", que congela a lista de colunas no instante da
--    criação. Com essas colunas presentes desde o início, a view saía do replay
--    com quatro colunas a mais do que tem em produção. Foram movidas para
--    99999999999999_qualitative_final_report_out_of_ledger.sql, que roda depois
--    das seis migrations — a ordem real.
--
-- 2. "create table if not exists" PULA tabela existente com estrutura
--    diferente, sem erro e sem aviso. Rodar este arquivo contra um banco que já
--    tenha as tabelas não prova fidelidade nenhuma — devolve uma falsa sensação
--    de sucesso. Ele é inofensivo contra a produção por construção, e é isso
--    que essa idempotência garante: nada além disso.
--
-- ESTADO DE ACEITAÇÃO: VERIFICADO POR REPLAY EM 2026-09-04
--
-- Replay executado em PostgreSQL 17.2 limpo (produção roda 17.6.1): baseline,
-- as seis migrations em ordem de versão e o arquivo do órfão. Todos aplicaram
-- sem erro. A assinatura estrutural resultante foi comparada com a do banco
-- vivo — colunas com tipo, NOT NULL, default e identity; constraints;
-- índices; triggers; funções; políticas; RLS; e definição das views.
--
-- Resultado: equivalente. As duas únicas diferenças textuais remanescentes são
-- em ranking_entries_score_range e ranking_entries_v2_score_range, e consistem
-- em um par de parênteses externos na reconstrução do CHECK — idênticas
-- ignorando agrupamento, e AND é associativo. É normalização de deparse entre
-- 17.6 e 17.2, não divergência de schema.
--
-- Método e números no registro da sessão em docs/sessions/.
--
-- Ordena antes das seis migrations porque a 20260901005500 faz alter table em
-- analysis_sections e source_documents, que precisam existir antes.

-- [1] TABELAS

create table if not exists public.analysis_runs (
  id bigint generated always as identity not null,
  instrument_id bigint not null,
  version integer default 1 not null,
  methodology_version text default 'deep-max-v1'::text not null,
  status text default 'backlog'::text not null,
  coverage_pct numeric(5,2) default 0 not null,
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
  started_at timestamp with time zone,
  concluded_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  balance_cash_score numeric(4,2),
  management_governance_score numeric(4,2),
  value_margin_score numeric(4,2),
  technical_liquidity_score numeric(4,2),
  weighted_score numeric(4,2),
  action_new_money text,
  action_existing_holder text
);

create table if not exists public.analysis_sections (
  id bigint generated always as identity not null,
  analysis_run_id bigint not null,
  section_code text not null,
  title text not null,
  first_pass_status text default 'pending'::text not null,
  second_pass_status text default 'pending'::text not null,
  score numeric(4,2),
  confidence_score numeric(4,2),
  narrative text,
  findings jsonb default '[]'::jsonb not null,
  open_questions jsonb default '[]'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  first_pass_narrative text,
  second_pass_narrative text,
  first_pass_findings jsonb default '[]'::jsonb not null,
  second_pass_findings jsonb default '[]'::jsonb not null,
  first_pass_open_questions jsonb default '[]'::jsonb not null,
  second_pass_open_questions jsonb default '[]'::jsonb not null,
  second_pass_omissions jsonb default '[]'::jsonb not null,
  last_verified_at timestamp with time zone
);

create table if not exists public.cash_distributions (
  id bigint generated always as identity not null,
  instrument_id bigint not null,
  reference_date date not null,
  payment_date date,
  amount_per_share numeric(18,8) not null,
  recurring_amount_per_share numeric(18,8),
  classification text default 'unclassified'::text not null,
  source_url text,
  created_at timestamp with time zone default now() not null,
  analysis_run_id bigint,
  classification_notes text,
  last_verified_at timestamp with time zone
);

create table if not exists public.instruments (
  id bigint generated always as identity not null,
  ticker text not null,
  asset_type text default 'fii'::text not null,
  name text,
  sector text,
  segment text,
  eligible_retail boolean default true not null,
  queue_position integer,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  segment_key text,
  eligibility_status text default 'unverified'::text not null,
  eligibility_confidence text default 'low'::text not null,
  eligibility_source_url text,
  eligibility_verified_at timestamp with time zone,
  universe_status text default 'candidate'::text not null,
  analysis_profile text default 'unclassified'::text not null,
  analysis_profile_status text default 'pending_verification'::text not null,
  analysis_profile_source_url text,
  analysis_profile_verified_at timestamp with time zone
);

create table if not exists public.market_prices (
  id bigint generated always as identity not null,
  instrument_id bigint not null,
  price_date date not null,
  open_price numeric(18,6),
  high_price numeric(18,6),
  low_price numeric(18,6),
  close_price numeric(18,6) not null,
  adjusted_close numeric(18,6),
  volume numeric(28,4),
  source_url text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.material_events (
  id bigint generated always as identity not null,
  instrument_id bigint not null,
  event_date date not null,
  event_type text not null,
  title text not null,
  summary text,
  thesis_impact text default 'monitor'::text not null,
  source_url text,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.metric_definitions (
  code text not null,
  name text not null,
  unit text,
  value_type text default 'numeric'::text not null,
  comparison_scope text default 'all'::text not null,
  preferred_direction text default 'contextual'::text not null,
  description text,
  required_for_completion boolean default false not null,
  asset_type text default 'fii'::text not null,
  segment_key text,
  max_age_days integer default 400 not null
);

create table if not exists public.metric_observations (
  id bigint generated always as identity not null,
  instrument_id bigint not null,
  analysis_run_id bigint,
  metric_code text not null,
  reference_date date not null,
  value_numeric numeric(28,10),
  value_text text,
  source_url text,
  is_recurring boolean,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.ranking_entries (
  id bigint generated always as identity not null,
  ranking_snapshot_id bigint not null,
  instrument_id bigint not null,
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
  created_at timestamp with time zone default now() not null,
  analysis_run_id bigint not null,
  balance_cash_score numeric(4,2),
  management_governance_score numeric(4,2),
  value_margin_score numeric(4,2),
  technical_liquidity_score numeric(4,2),
  risk_score numeric(4,2)
);

create table if not exists public.ranking_snapshots (
  id bigint generated always as identity not null,
  name text not null,
  cutoff_date date not null,
  methodology_version text not null,
  universe_size integer not null,
  is_current boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.source_documents (
  id bigint generated always as identity not null,
  analysis_run_id bigint not null,
  document_type text not null,
  title text not null,
  source_url text,
  competence_date date,
  published_at date,
  pages_total integer,
  pages_reviewed integer default 0 not null,
  reading_status text default 'pending'::text not null,
  key_findings jsonb default '[]'::jsonb not null,
  contradictions jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  first_pass_pages_reviewed integer default 0 not null,
  second_pass_pages_reviewed integer default 0 not null,
  first_pass_status text default 'pending'::text not null,
  second_pass_status text default 'pending'::text not null,
  first_pass_findings jsonb default '[]'::jsonb not null,
  second_pass_findings jsonb default '[]'::jsonb not null,
  last_verified_at timestamp with time zone,
  official_document_id text,
  content_hash text,
  fiscal_year integer,
  includes_notes boolean default false not null,
  includes_audit_opinion boolean default false not null,
  is_current_version boolean default true not null,
  supersedes_document_id bigint
);

-- [2] CONSTRAINTS

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_pkey' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_pkey' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_pkey' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_pkey' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_prices_pkey' and conrelid = 'public.market_prices'::regclass) then
    alter table public.market_prices add constraint market_prices_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'material_events_pkey' and conrelid = 'public.material_events'::regclass) then
    alter table public.material_events add constraint material_events_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_pkey' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_pkey PRIMARY KEY (code);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_pkey' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_pkey' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_snapshots_pkey' and conrelid = 'public.ranking_snapshots'::regclass) then
    alter table public.ranking_snapshots add constraint ranking_snapshots_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_pkey' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_pkey PRIMARY KEY (id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_instrument_version_unique' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_instrument_version_unique UNIQUE (instrument_id, version);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_run_code_unique' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_run_code_unique UNIQUE (analysis_run_id, section_code);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_unique' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_unique UNIQUE (instrument_id, reference_date, payment_date);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_ticker_key' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_ticker_key UNIQUE (ticker);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_prices_unique' and conrelid = 'public.market_prices'::regclass) then
    alter table public.market_prices add constraint market_prices_unique UNIQUE (instrument_id, price_date);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_unique' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_unique UNIQUE (instrument_id, metric_code, reference_date, analysis_run_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_analysis_unique' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_analysis_unique UNIQUE (ranking_snapshot_id, analysis_run_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_snapshot_instrument_unique' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_snapshot_instrument_unique UNIQUE (ranking_snapshot_id, instrument_id);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_snapshot_rank_unique' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_snapshot_rank_unique UNIQUE (ranking_snapshot_id, rank_overall);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_balance_cash_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_balance_cash_range CHECK (((balance_cash_score IS NULL) OR ((balance_cash_score >= (0)::numeric) AND (balance_cash_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_confidence_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_confidence_range CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::numeric) AND (confidence_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_coverage_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_coverage_range CHECK (((coverage_pct >= (0)::numeric) AND (coverage_pct <= (100)::numeric)));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_existing_holder_action' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_existing_holder_action CHECK (((action_existing_holder IS NULL) OR (action_existing_holder = ANY (ARRAY['increase'::text, 'hold'::text, 'reduce'::text, 'sell'::text, 'insufficient_data'::text]))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_fair_value_order' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_fair_value_order CHECK (((fair_value_low IS NULL) OR (fair_value_base IS NULL) OR (fair_value_high IS NULL) OR ((fair_value_low <= fair_value_base) AND (fair_value_base <= fair_value_high))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_income_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_income_range CHECK (((income_score IS NULL) OR ((income_score >= (0)::numeric) AND (income_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_management_governance_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_management_governance_range CHECK (((management_governance_score IS NULL) OR ((management_governance_score >= (0)::numeric) AND (management_governance_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_new_money_action' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_new_money_action CHECK (((action_new_money IS NULL) OR (action_new_money = ANY (ARRAY['buy'::text, 'buy_in_tranches'::text, 'wait'::text, 'avoid'::text, 'insufficient_data'::text]))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_opportunity_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_opportunity_range CHECK (((opportunity_score IS NULL) OR ((opportunity_score >= (0)::numeric) AND (opportunity_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_quality_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_quality_range CHECK (((quality_score IS NULL) OR ((quality_score >= (0)::numeric) AND (quality_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_risk_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_risk_range CHECK (((risk_score IS NULL) OR ((risk_score >= (0)::numeric) AND (risk_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_safety_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_safety_range CHECK (((safety_score IS NULL) OR ((safety_score >= (0)::numeric) AND (safety_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_status' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_status CHECK ((status = ANY (ARRAY['backlog'::text, 'research'::text, 'first_review'::text, 'second_review'::text, 'completed'::text, 'blocked'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_technical_liquidity_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_technical_liquidity_range CHECK (((technical_liquidity_score IS NULL) OR ((technical_liquidity_score >= (0)::numeric) AND (technical_liquidity_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_value_margin_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_value_margin_range CHECK (((value_margin_score IS NULL) OR ((value_margin_score >= (0)::numeric) AND (value_margin_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_verdict' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_verdict CHECK (((verdict IS NULL) OR (verdict = ANY (ARRAY['prioritize'::text, 'watch'::text, 'wait_price'::text, 'speculative'::text, 'avoid'::text, 'insufficient_data'::text]))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_version_positive' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_version_positive CHECK ((version > 0));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_weighted_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_weighted_range CHECK (((weighted_score IS NULL) OR ((weighted_score >= (0)::numeric) AND (weighted_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_code' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_code CHECK ((section_code = ANY (ARRAY['identity'::text, 'documentary'::text, 'portfolio'::text, 'tenants_contracts'::text, 'operations'::text, 'financials'::text, 'income'::text, 'debt'::text, 'management'::text, 'governance'::text, 'valuation'::text, 'scenarios'::text, 'risks'::text, 'catalysts'::text, 'technical'::text, 'critical_review'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_confidence_range' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_confidence_range CHECK (((confidence_score IS NULL) OR ((confidence_score >= (0)::numeric) AND (confidence_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_findings_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_findings_array CHECK ((jsonb_typeof(findings) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_complete_semantics' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_complete_semantics CHECK (((first_pass_status <> 'complete'::text) OR ((NULLIF(btrim(first_pass_narrative), ''::text) IS NOT NULL) AND (last_verified_at IS NOT NULL))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_findings_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_findings_array CHECK ((jsonb_typeof(first_pass_findings) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_questions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_questions_array CHECK ((jsonb_typeof(first_pass_open_questions) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_status' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_status CHECK ((first_pass_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'complete'::text, 'blocked'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_omissions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_omissions_array CHECK ((jsonb_typeof(second_pass_omissions) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_questions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_questions_array CHECK ((jsonb_typeof(open_questions) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_score_range' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_score_range CHECK (((score IS NULL) OR ((score >= (0)::numeric) AND (score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_complete_semantics' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_complete_semantics CHECK (((second_pass_status <> 'complete'::text) OR ((NULLIF(btrim(second_pass_narrative), ''::text) IS NOT NULL) AND (last_verified_at IS NOT NULL))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_findings_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_findings_array CHECK ((jsonb_typeof(second_pass_findings) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_questions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_questions_array CHECK ((jsonb_typeof(second_pass_open_questions) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_status' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_status CHECK ((second_pass_status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'complete'::text, 'blocked'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_amount_nonnegative' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_amount_nonnegative CHECK ((amount_per_share >= (0)::numeric));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_classification' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_classification CHECK ((classification = ANY (ARRAY['recurring'::text, 'mixed'::text, 'extraordinary'::text, 'unclassified'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_classification_semantics' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_classification_semantics CHECK (((classification = 'unclassified'::text) OR ((recurring_amount_per_share IS NOT NULL) AND (NULLIF(btrim(classification_notes), ''::text) IS NOT NULL) AND (NULLIF(btrim(source_url), ''::text) IS NOT NULL) AND (last_verified_at IS NOT NULL))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_recurring_valid' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_recurring_valid CHECK (((recurring_amount_per_share IS NULL) OR ((recurring_amount_per_share >= (0)::numeric) AND (recurring_amount_per_share <= amount_per_share))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_analysis_profile' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_analysis_profile CHECK ((analysis_profile = ANY (ARRAY['unclassified'::text, 'brick_fii'::text, 'receivables_fii'::text, 'hybrid_fii'::text, 'fof_fii'::text, 'development_fii'::text, 'fiagro'::text, 'infrastructure_fund'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_analysis_profile_status' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_analysis_profile_status CHECK ((analysis_profile_status = ANY (ARRAY['pending_verification'::text, 'verified'::text, 'inapplicable'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_analysis_profile_verified_semantics' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_analysis_profile_verified_semantics CHECK (((analysis_profile_status <> 'verified'::text) OR ((analysis_profile <> 'unclassified'::text) AND (NULLIF(btrim(analysis_profile_source_url), ''::text) IS NOT NULL) AND (analysis_profile_verified_at IS NOT NULL))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_asset_type' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_asset_type CHECK ((asset_type = ANY (ARRAY['fii'::text, 'stock'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_eligibility_confidence' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_eligibility_confidence CHECK ((eligibility_confidence = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_eligibility_status' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_eligibility_status CHECK ((eligibility_status = ANY (ARRAY['confirmed_retail'::text, 'probable_retail'::text, 'restricted'::text, 'professional_only'::text, 'unverified'::text, 'excluded'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_queue_position_positive' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_queue_position_positive CHECK (((queue_position IS NULL) OR (queue_position > 0)));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_segment_key' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_segment_key CHECK (((segment_key IS NULL) OR (segment_key = ANY (ARRAY['logistics'::text, 'shopping'::text, 'offices'::text, 'urban_income'::text, 'hotels'::text, 'development'::text, 'other'::text]))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_ticker_format' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_ticker_format CHECK ((ticker ~ '^[A-Z0-9]{4,12}$'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_universe_status' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_universe_status CHECK ((universe_status = ANY (ARRAY['candidate'::text, 'queued'::text, 'analyzing'::text, 'completed'::text, 'excluded'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_prices_nonnegative' and conrelid = 'public.market_prices'::regclass) then
    alter table public.market_prices add constraint market_prices_nonnegative CHECK (((close_price >= (0)::numeric) AND ((open_price IS NULL) OR (open_price >= (0)::numeric)) AND ((high_price IS NULL) OR (high_price >= (0)::numeric)) AND ((low_price IS NULL) OR (low_price >= (0)::numeric)) AND ((adjusted_close IS NULL) OR (adjusted_close >= (0)::numeric)) AND ((volume IS NULL) OR (volume >= (0)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_prices_ohlc_valid' and conrelid = 'public.market_prices'::regclass) then
    alter table public.market_prices add constraint market_prices_ohlc_valid CHECK (((high_price IS NULL) OR (low_price IS NULL) OR (high_price >= low_price)));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'material_events_impact' and conrelid = 'public.material_events'::regclass) then
    alter table public.material_events add constraint material_events_impact CHECK ((thesis_impact = ANY (ARRAY['positive'::text, 'negative'::text, 'neutral'::text, 'monitor'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_asset_type' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_asset_type CHECK ((asset_type = ANY (ARRAY['fii'::text, 'stock'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_direction' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_direction CHECK ((preferred_direction = ANY (ARRAY['higher'::text, 'lower'::text, 'target'::text, 'contextual'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_max_age_days' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_max_age_days CHECK (((max_age_days >= 1) AND (max_age_days <= 3650)));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_scope' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_scope CHECK ((comparison_scope = ANY (ARRAY['all'::text, 'segment'::text, 'fund_only'::text, 'stock_only'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_segment_key' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_segment_key CHECK (((segment_key IS NULL) OR (segment_key = ANY (ARRAY['logistics'::text, 'shopping'::text, 'offices'::text, 'urban_income'::text, 'hotels'::text, 'development'::text, 'other'::text]))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_value_type' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_value_type CHECK ((value_type = ANY (ARRAY['numeric'::text, 'text'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_metadata_object' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_metadata_object CHECK ((jsonb_typeof(metadata) = 'object'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_one_value' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_one_value CHECK ((num_nonnulls(value_numeric, value_text) = 1));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_rank_positive' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_rank_positive CHECK (((rank_overall > 0) AND ((rank_segment IS NULL) OR (rank_segment > 0))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_score_range' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_score_range CHECK ((((final_score >= (0)::numeric) AND (final_score <= (100)::numeric)) AND ((quality_score >= (0)::numeric) AND (quality_score <= (10)::numeric)) AND ((opportunity_score >= (0)::numeric) AND (opportunity_score <= (10)::numeric)) AND ((income_score >= (0)::numeric) AND (income_score <= (10)::numeric)) AND ((safety_score >= (0)::numeric) AND (safety_score <= (10)::numeric)) AND ((confidence_score >= (0)::numeric) AND (confidence_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_v2_score_range' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_v2_score_range CHECK ((((balance_cash_score >= (0)::numeric) AND (balance_cash_score <= (10)::numeric)) AND ((management_governance_score >= (0)::numeric) AND (management_governance_score <= (10)::numeric)) AND ((value_margin_score >= (0)::numeric) AND (value_margin_score <= (10)::numeric)) AND ((technical_liquidity_score >= (0)::numeric) AND (technical_liquidity_score <= (10)::numeric)) AND ((risk_score >= (0)::numeric) AND (risk_score <= (10)::numeric))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_verdict' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_verdict CHECK ((verdict = ANY (ARRAY['prioritize'::text, 'watch'::text, 'wait_price'::text, 'speculative'::text, 'avoid'::text, 'insufficient_data'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_snapshots_universe_positive' and conrelid = 'public.ranking_snapshots'::regclass) then
    alter table public.ranking_snapshots add constraint ranking_snapshots_universe_positive CHECK ((universe_size > 0));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_contradictions_array' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_contradictions_array CHECK ((jsonb_typeof(contradictions) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_findings_array' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_findings_array CHECK ((jsonb_typeof(key_findings) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_first_complete_semantics' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_first_complete_semantics CHECK (((first_pass_status <> 'complete'::text) OR ((NULLIF(btrim(source_url), ''::text) IS NOT NULL) AND (pages_total IS NOT NULL) AND (first_pass_pages_reviewed = pages_total) AND (last_verified_at IS NOT NULL))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_first_findings_array' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_first_findings_array CHECK ((jsonb_typeof(first_pass_findings) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_first_status' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_first_status CHECK ((first_pass_status = ANY (ARRAY['pending'::text, 'reading'::text, 'complete'::text, 'blocked'::text, 'unavailable'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_fiscal_year' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_fiscal_year CHECK (((fiscal_year IS NULL) OR ((fiscal_year >= 1990) AND (fiscal_year <= 2200))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_hash_format' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_hash_format CHECK (((content_hash IS NULL) OR (content_hash ~ '^[A-Fa-f0-9]{64}$'::text)));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_pages_valid' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_pages_valid CHECK (((pages_total IS NULL) OR ((pages_total >= 0) AND ((pages_reviewed >= 0) AND (pages_reviewed <= pages_total)))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_pass_pages_valid' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_pass_pages_valid CHECK (((first_pass_pages_reviewed >= 0) AND (second_pass_pages_reviewed >= 0) AND ((pages_total IS NULL) OR ((first_pass_pages_reviewed <= pages_total) AND (second_pass_pages_reviewed <= pages_total)))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_second_complete_semantics' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_second_complete_semantics CHECK (((second_pass_status <> 'complete'::text) OR ((NULLIF(btrim(source_url), ''::text) IS NOT NULL) AND (pages_total IS NOT NULL) AND (second_pass_pages_reviewed = pages_total) AND (last_verified_at IS NOT NULL))));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_second_findings_array' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_second_findings_array CHECK ((jsonb_typeof(second_pass_findings) = 'array'::text));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_second_status' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_second_status CHECK ((second_pass_status = ANY (ARRAY['pending'::text, 'reading'::text, 'complete'::text, 'blocked'::text, 'unavailable'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_status' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_status CHECK ((reading_status = ANY (ARRAY['pending'::text, 'reading'::text, 'complete'::text, 'blocked'::text, 'unavailable'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_type' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_type CHECK ((document_type = ANY (ARRAY['management_report'::text, 'financial_statement'::text, 'audit_report'::text, 'regulation'::text, 'material_fact'::text, 'meeting'::text, 'issuance'::text, 'transaction'::text, 'appraisal'::text, 'legal'::text, 'environmental'::text, 'insurance'::text, 'other'::text])));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_instrument_id_fkey' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_analysis_run_id_fkey' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_analysis_run_id_fkey' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_instrument_id_fkey' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_prices_instrument_id_fkey' and conrelid = 'public.market_prices'::regclass) then
    alter table public.market_prices add constraint market_prices_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'material_events_instrument_id_fkey' and conrelid = 'public.material_events'::regclass) then
    alter table public.material_events add constraint material_events_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_analysis_run_id_fkey' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_instrument_id_fkey' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_observations_metric_code_fkey' and conrelid = 'public.metric_observations'::regclass) then
    alter table public.metric_observations add constraint metric_observations_metric_code_fkey FOREIGN KEY (metric_code) REFERENCES metric_definitions(code) ON DELETE RESTRICT;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_analysis_run_id_fkey' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE RESTRICT;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_instrument_id_fkey' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_instrument_id_fkey FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_ranking_snapshot_id_fkey' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_ranking_snapshot_id_fkey FOREIGN KEY (ranking_snapshot_id) REFERENCES ranking_snapshots(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_analysis_run_id_fkey' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_analysis_run_id_fkey FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_supersedes_document_id_fkey' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_supersedes_document_id_fkey FOREIGN KEY (supersedes_document_id) REFERENCES source_documents(id) ON DELETE SET NULL;
  end if;
end $$;

-- [3] INDICES

create index if not exists analysis_runs_instrument_status_idx ON public.analysis_runs USING btree (instrument_id, status);
create unique index if not exists analysis_runs_one_active_idx ON public.analysis_runs USING btree ((true)) WHERE (status = ANY (ARRAY['research'::text, 'first_review'::text, 'second_review'::text]));
create index if not exists analysis_runs_status_updated_idx ON public.analysis_runs USING btree (status, updated_at DESC);
create index if not exists cash_distributions_run_idx ON public.cash_distributions USING btree (analysis_run_id) WHERE (analysis_run_id IS NOT NULL);
create index if not exists material_events_instrument_date_idx ON public.material_events USING btree (instrument_id, event_date DESC);
create index if not exists metric_observations_instrument_code_date_idx ON public.metric_observations USING btree (instrument_id, metric_code, reference_date DESC);
create index if not exists metric_observations_metric_code_idx ON public.metric_observations USING btree (metric_code);
create index if not exists metric_observations_run_idx ON public.metric_observations USING btree (analysis_run_id) WHERE (analysis_run_id IS NOT NULL);
create index if not exists ranking_entries_analysis_run_idx ON public.ranking_entries USING btree (analysis_run_id);
create index if not exists ranking_entries_instrument_idx ON public.ranking_entries USING btree (instrument_id);
create index if not exists ranking_entries_snapshot_rank_idx ON public.ranking_entries USING btree (ranking_snapshot_id, rank_overall);
create unique index if not exists ranking_snapshots_one_current_idx ON public.ranking_snapshots USING btree (is_current) WHERE is_current;
create index if not exists source_documents_run_competence_idx ON public.source_documents USING btree (analysis_run_id, competence_date DESC);
create index if not exists source_documents_run_current_competence_idx ON public.source_documents USING btree (analysis_run_id, document_type, competence_date) WHERE (is_current_version AND (competence_date IS NOT NULL));
create unique index if not exists source_documents_run_hash_unique ON public.source_documents USING btree (analysis_run_id, content_hash) WHERE (content_hash IS NOT NULL);
create unique index if not exists source_documents_run_official_id_unique ON public.source_documents USING btree (analysis_run_id, official_document_id) WHERE (official_document_id IS NOT NULL);
create index if not exists source_documents_supersedes_idx ON public.source_documents USING btree (supersedes_document_id) WHERE (supersedes_document_id IS NOT NULL);

-- [4] ROW LEVEL SECURITY

alter table public.analysis_runs enable row level security;
alter table public.analysis_sections enable row level security;
alter table public.cash_distributions enable row level security;
alter table public.instruments enable row level security;
alter table public.market_prices enable row level security;
alter table public.material_events enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.metric_observations enable row level security;
alter table public.ranking_entries enable row level security;
alter table public.ranking_snapshots enable row level security;
alter table public.source_documents enable row level security;

-- [5] POLITICAS

drop policy if exists safa_public_read on public.analysis_runs;
create policy safa_public_read on public.analysis_runs as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.analysis_sections;
create policy safa_public_read on public.analysis_sections as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.cash_distributions;
create policy safa_public_read on public.cash_distributions as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.instruments;
create policy safa_public_read on public.instruments as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.market_prices;
create policy safa_public_read on public.market_prices as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.material_events;
create policy safa_public_read on public.material_events as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.metric_definitions;
create policy safa_public_read on public.metric_definitions as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.metric_observations;
create policy safa_public_read on public.metric_observations as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.ranking_entries;
create policy safa_public_read on public.ranking_entries as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.ranking_snapshots;
create policy safa_public_read on public.ranking_snapshots as PERMISSIVE for SELECT to anon, authenticated
  using (true);

drop policy if exists safa_public_read on public.source_documents;
create policy safa_public_read on public.source_documents as PERMISSIVE for SELECT to anon, authenticated
  using (true);

-- [6] GRANTS

grant SELECT on public.analysis_runs to anon;
grant SELECT on public.analysis_runs to authenticated;
grant DELETE on public.analysis_runs to service_role;
grant INSERT on public.analysis_runs to service_role;
grant REFERENCES on public.analysis_runs to service_role;
grant SELECT on public.analysis_runs to service_role;
grant TRIGGER on public.analysis_runs to service_role;
grant TRUNCATE on public.analysis_runs to service_role;
grant UPDATE on public.analysis_runs to service_role;
grant SELECT on public.analysis_sections to anon;
grant SELECT on public.analysis_sections to authenticated;
grant DELETE on public.analysis_sections to service_role;
grant INSERT on public.analysis_sections to service_role;
grant REFERENCES on public.analysis_sections to service_role;
grant SELECT on public.analysis_sections to service_role;
grant TRIGGER on public.analysis_sections to service_role;
grant TRUNCATE on public.analysis_sections to service_role;
grant UPDATE on public.analysis_sections to service_role;
grant SELECT on public.cash_distributions to anon;
grant SELECT on public.cash_distributions to authenticated;
grant DELETE on public.cash_distributions to service_role;
grant INSERT on public.cash_distributions to service_role;
grant REFERENCES on public.cash_distributions to service_role;
grant SELECT on public.cash_distributions to service_role;
grant TRIGGER on public.cash_distributions to service_role;
grant TRUNCATE on public.cash_distributions to service_role;
grant UPDATE on public.cash_distributions to service_role;
grant SELECT on public.instruments to anon;
grant SELECT on public.instruments to authenticated;
grant DELETE on public.instruments to service_role;
grant INSERT on public.instruments to service_role;
grant REFERENCES on public.instruments to service_role;
grant SELECT on public.instruments to service_role;
grant TRIGGER on public.instruments to service_role;
grant TRUNCATE on public.instruments to service_role;
grant UPDATE on public.instruments to service_role;
grant SELECT on public.market_prices to anon;
grant SELECT on public.market_prices to authenticated;
grant DELETE on public.market_prices to service_role;
grant INSERT on public.market_prices to service_role;
grant REFERENCES on public.market_prices to service_role;
grant SELECT on public.market_prices to service_role;
grant TRIGGER on public.market_prices to service_role;
grant TRUNCATE on public.market_prices to service_role;
grant UPDATE on public.market_prices to service_role;
grant SELECT on public.material_events to anon;
grant SELECT on public.material_events to authenticated;
grant DELETE on public.material_events to service_role;
grant INSERT on public.material_events to service_role;
grant REFERENCES on public.material_events to service_role;
grant SELECT on public.material_events to service_role;
grant TRIGGER on public.material_events to service_role;
grant TRUNCATE on public.material_events to service_role;
grant UPDATE on public.material_events to service_role;
grant SELECT on public.metric_definitions to anon;
grant SELECT on public.metric_definitions to authenticated;
grant DELETE on public.metric_definitions to service_role;
grant INSERT on public.metric_definitions to service_role;
grant REFERENCES on public.metric_definitions to service_role;
grant SELECT on public.metric_definitions to service_role;
grant TRIGGER on public.metric_definitions to service_role;
grant TRUNCATE on public.metric_definitions to service_role;
grant UPDATE on public.metric_definitions to service_role;
grant SELECT on public.metric_observations to anon;
grant SELECT on public.metric_observations to authenticated;
grant DELETE on public.metric_observations to service_role;
grant INSERT on public.metric_observations to service_role;
grant REFERENCES on public.metric_observations to service_role;
grant SELECT on public.metric_observations to service_role;
grant TRIGGER on public.metric_observations to service_role;
grant TRUNCATE on public.metric_observations to service_role;
grant UPDATE on public.metric_observations to service_role;
grant SELECT on public.ranking_entries to anon;
grant SELECT on public.ranking_entries to authenticated;
grant DELETE on public.ranking_entries to service_role;
grant INSERT on public.ranking_entries to service_role;
grant REFERENCES on public.ranking_entries to service_role;
grant SELECT on public.ranking_entries to service_role;
grant TRIGGER on public.ranking_entries to service_role;
grant TRUNCATE on public.ranking_entries to service_role;
grant UPDATE on public.ranking_entries to service_role;
grant SELECT on public.ranking_snapshots to anon;
grant SELECT on public.ranking_snapshots to authenticated;
grant DELETE on public.ranking_snapshots to service_role;
grant INSERT on public.ranking_snapshots to service_role;
grant REFERENCES on public.ranking_snapshots to service_role;
grant SELECT on public.ranking_snapshots to service_role;
grant TRIGGER on public.ranking_snapshots to service_role;
grant TRUNCATE on public.ranking_snapshots to service_role;
grant UPDATE on public.ranking_snapshots to service_role;
grant SELECT on public.source_documents to anon;
grant SELECT on public.source_documents to authenticated;
grant DELETE on public.source_documents to service_role;
grant INSERT on public.source_documents to service_role;
grant REFERENCES on public.source_documents to service_role;
grant SELECT on public.source_documents to service_role;
grant TRIGGER on public.source_documents to service_role;
grant TRUNCATE on public.source_documents to service_role;
grant UPDATE on public.source_documents to service_role;
