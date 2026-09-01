-- SAFA Deep Max v2
-- Patch idempotente sobre o esquema v1. Não contém resultados de análise.

begin;

alter table public.instruments
  add column if not exists segment_key text,
  add column if not exists eligibility_status text not null default 'unverified',
  add column if not exists eligibility_confidence text not null default 'low',
  add column if not exists eligibility_source_url text,
  add column if not exists eligibility_verified_at timestamptz,
  add column if not exists universe_status text not null default 'candidate';

alter table public.analysis_runs
  add column if not exists balance_cash_score numeric(4,2),
  add column if not exists management_governance_score numeric(4,2),
  add column if not exists value_margin_score numeric(4,2),
  add column if not exists technical_liquidity_score numeric(4,2),
  add column if not exists weighted_score numeric(4,2),
  add column if not exists action_new_money text,
  add column if not exists action_existing_holder text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instruments_segment_key' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_segment_key check (
      segment_key is null or segment_key in ('logistics', 'shopping', 'offices', 'urban_income', 'hotels', 'development', 'other')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'instruments_eligibility_status' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_eligibility_status check (
      eligibility_status in ('confirmed_retail', 'probable_retail', 'restricted', 'professional_only', 'unverified', 'excluded')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'instruments_eligibility_confidence' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_eligibility_confidence check (
      eligibility_confidence in ('high', 'medium', 'low')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'instruments_universe_status' and conrelid = 'public.instruments'::regclass) then
    alter table public.instruments add constraint instruments_universe_status check (
      universe_status in ('candidate', 'queued', 'analyzing', 'completed', 'excluded')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_balance_cash_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_balance_cash_range check (balance_cash_score is null or balance_cash_score between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_management_governance_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_management_governance_range check (management_governance_score is null or management_governance_score between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_value_margin_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_value_margin_range check (value_margin_score is null or value_margin_score between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_technical_liquidity_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_technical_liquidity_range check (technical_liquidity_score is null or technical_liquidity_score between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_weighted_range' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_weighted_range check (weighted_score is null or weighted_score between 0 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_new_money_action' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_new_money_action check (
      action_new_money is null or action_new_money in ('buy', 'buy_in_tranches', 'wait', 'avoid', 'insufficient_data')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_existing_holder_action' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_existing_holder_action check (
      action_existing_holder is null or action_existing_holder in ('increase', 'hold', 'reduce', 'sell', 'insufficient_data')
    );
  end if;
end $$;

update public.instruments
set
  segment_key = case ticker
    when 'HGLG11' then 'logistics'
    when 'BTLG11' then 'logistics'
    when 'HSML11' then 'shopping'
    when 'XPML11' then 'shopping'
    when 'LVBI11' then 'logistics'
    when 'FATN11' then 'offices'
    when 'ALZR11' then 'urban_income'
    when 'RBVA11' then 'urban_income'
    when 'VILG11' then 'logistics'
    when 'GGRC11' then 'logistics'
    else segment_key
  end,
  segment = case ticker
    when 'HGLG11' then 'Logística'
    when 'BTLG11' then 'Logística'
    when 'HSML11' then 'Shoppings'
    when 'XPML11' then 'Shoppings'
    when 'LVBI11' then 'Logística'
    when 'FATN11' then 'Lajes corporativas'
    when 'ALZR11' then 'Renda urbana'
    when 'RBVA11' then 'Renda urbana e varejo'
    when 'VILG11' then 'Logística'
    when 'GGRC11' then 'Logística e industrial'
    else segment
  end,
  universe_status = case when queue_position is not null then 'queued' else universe_status end,
  updated_at = now()
where asset_type = 'fii';

update public.analysis_runs
set methodology_version = 'deep-max-v2', updated_at = now()
where status = 'backlog' and methodology_version = 'deep-max-v1';

create table if not exists public.methodology_weight_sets (
  version text primary key,
  label text not null,
  is_active boolean not null default false,
  effective_from date not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.methodology_weights (
  methodology_version text not null references public.methodology_weight_sets(version) on delete cascade,
  dimension_code text not null,
  label text not null,
  weight numeric(6,5) not null,
  display_order smallint not null,
  primary key (methodology_version, dimension_code),
  constraint methodology_weights_dimension check (dimension_code in ('income', 'quality', 'balance', 'management', 'value', 'technical')),
  constraint methodology_weights_value check (weight > 0 and weight <= 1),
  constraint methodology_weights_order check (display_order > 0)
);

create unique index if not exists methodology_weight_sets_one_active_idx
on public.methodology_weight_sets ((true)) where is_active;

insert into public.methodology_weight_sets (version, label, is_active, effective_from, description)
values (
  'deep-max-v2',
  'Deep Max v2 — régua comparativa auditável',
  true,
  date '2026-09-01',
  'Renda 25%; ativos 20%; balanço 20%; gestão e governança 15%; valor 15%; técnico e liquidez 5%.'
)
on conflict (version) do update set
  label = excluded.label,
  is_active = excluded.is_active,
  effective_from = excluded.effective_from,
  description = excluded.description;

insert into public.methodology_weights (methodology_version, dimension_code, label, weight, display_order)
values
  ('deep-max-v2', 'income', 'Renda sustentável', 0.25, 1),
  ('deep-max-v2', 'quality', 'Qualidade dos ativos', 0.20, 2),
  ('deep-max-v2', 'balance', 'Balanço e caixa', 0.20, 3),
  ('deep-max-v2', 'management', 'Gestão e governança', 0.15, 4),
  ('deep-max-v2', 'value', 'Valor e margem de segurança', 0.15, 5),
  ('deep-max-v2', 'technical', 'Técnico e liquidez', 0.05, 6)
on conflict (methodology_version, dimension_code) do update set
  label = excluded.label,
  weight = excluded.weight,
  display_order = excluded.display_order;

create table if not exists public.methodology_criteria (
  code text primary key,
  section_code text not null,
  title text not null,
  display_order integer not null,
  segment_key text,
  criticality text not null default 'material',
  blocks_positive_verdict_when_unavailable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint methodology_criteria_section check (section_code in (
    'identity', 'documentary', 'portfolio', 'tenants_contracts', 'operations',
    'financials', 'income', 'debt', 'management', 'governance', 'valuation',
    'scenarios', 'risks', 'catalysts', 'technical', 'critical_review'
  )),
  constraint methodology_criteria_segment check (segment_key is null or segment_key in ('logistics', 'shopping', 'offices', 'urban_income', 'hotels', 'development', 'other')),
  constraint methodology_criteria_criticality check (criticality in ('essential', 'material', 'supplementary')),
  constraint methodology_criteria_order check (display_order > 0)
);

create table if not exists public.analysis_criterion_reviews (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  criterion_code text not null references public.methodology_criteria(code) on delete restrict,
  first_pass_status text not null default 'pending',
  second_pass_status text not null default 'pending',
  first_pass_narrative text,
  second_pass_narrative text,
  first_pass_findings jsonb not null default '[]'::jsonb,
  second_pass_findings jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  second_pass_omissions jsonb not null default '[]'::jsonb,
  unavailable_reason text,
  source_count integer not null default 0,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_criterion_reviews_unique unique (analysis_run_id, criterion_code),
  constraint analysis_criterion_reviews_first_status check (first_pass_status in ('pending', 'in_progress', 'complete', 'blocked', 'unavailable', 'not_applicable')),
  constraint analysis_criterion_reviews_second_status check (second_pass_status in ('pending', 'in_progress', 'complete', 'blocked', 'unavailable', 'not_applicable')),
  constraint analysis_criterion_reviews_source_count check (source_count >= 0),
  constraint analysis_criterion_reviews_first_findings check (jsonb_typeof(first_pass_findings) = 'array'),
  constraint analysis_criterion_reviews_second_findings check (jsonb_typeof(second_pass_findings) = 'array'),
  constraint analysis_criterion_reviews_questions check (jsonb_typeof(open_questions) = 'array'),
  constraint analysis_criterion_reviews_omissions check (jsonb_typeof(second_pass_omissions) = 'array'),
  constraint analysis_criterion_reviews_first_complete check (
    first_pass_status <> 'complete' or (nullif(btrim(first_pass_narrative), '') is not null and source_count > 0)
  ),
  constraint analysis_criterion_reviews_second_complete check (
    second_pass_status <> 'complete' or (nullif(btrim(second_pass_narrative), '') is not null and source_count > 0)
  ),
  constraint analysis_criterion_reviews_unavailable_reason check (
    (first_pass_status not in ('unavailable', 'not_applicable') and second_pass_status not in ('unavailable', 'not_applicable'))
    or nullif(btrim(unavailable_reason), '') is not null
  )
);

create index if not exists analysis_criterion_reviews_run_status_idx
on public.analysis_criterion_reviews (analysis_run_id, first_pass_status, second_pass_status);

create index if not exists analysis_criterion_reviews_criterion_idx
on public.analysis_criterion_reviews (criterion_code);

create table if not exists public.document_scope_definitions (
  code text primary key,
  label text not null,
  display_order smallint not null,
  active boolean not null default true,
  constraint document_scope_definitions_order check (display_order > 0)
);

create table if not exists public.analysis_document_scopes (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  scope_code text not null references public.document_scope_definitions(code) on delete restrict,
  status text not null default 'pending',
  official_sources_checked jsonb not null default '[]'::jsonb,
  searched_from date,
  searched_through date,
  notes text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_document_scopes_unique unique (analysis_run_id, scope_code),
  constraint analysis_document_scopes_status check (status in ('pending', 'in_progress', 'complete', 'blocked', 'unavailable', 'not_applicable')),
  constraint analysis_document_scopes_sources check (jsonb_typeof(official_sources_checked) = 'array'),
  constraint analysis_document_scopes_dates check (searched_through is null or searched_from is null or searched_through >= searched_from),
  constraint analysis_document_scopes_complete check (
    status not in ('complete', 'unavailable', 'not_applicable')
    or (nullif(btrim(notes), '') is not null and last_verified_at is not null)
  ),
  constraint analysis_document_scopes_complete_sources check (
    status <> 'complete' or jsonb_array_length(official_sources_checked) > 0
  )
);

create index if not exists analysis_document_scopes_run_status_idx
on public.analysis_document_scopes (analysis_run_id, status);

create index if not exists analysis_document_scopes_scope_idx
on public.analysis_document_scopes (scope_code);

create table if not exists public.data_scope_definitions (
  code text primary key,
  label text not null,
  display_order smallint not null,
  allows_not_applicable boolean not null default false,
  active boolean not null default true,
  constraint data_scope_definitions_order check (display_order > 0)
);

create table if not exists public.analysis_data_scopes (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  scope_code text not null references public.data_scope_definitions(code) on delete restrict,
  status text not null default 'pending',
  row_count integer not null default 0,
  notes text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_data_scopes_unique unique (analysis_run_id, scope_code),
  constraint analysis_data_scopes_status check (status in ('pending', 'in_progress', 'complete', 'blocked', 'unavailable', 'not_applicable')),
  constraint analysis_data_scopes_row_count check (row_count >= 0),
  constraint analysis_data_scopes_complete check (
    status not in ('complete', 'unavailable', 'not_applicable')
    or (nullif(btrim(notes), '') is not null and last_verified_at is not null)
  ),
  constraint analysis_data_scopes_complete_rows check (status <> 'complete' or row_count > 0)
);

create index if not exists analysis_data_scopes_run_status_idx
on public.analysis_data_scopes (analysis_run_id, status);

create index if not exists analysis_data_scopes_scope_idx
on public.analysis_data_scopes (scope_code);

insert into public.document_scope_definitions (code, label, display_order)
values
  ('management_reports', 'Relatórios gerenciais', 1),
  ('financial_statements', 'Demonstrações financeiras, notas e auditoria', 2),
  ('regulations', 'Regulamento vigente e versões materiais', 3),
  ('material_facts', 'Fatos relevantes e comunicados', 4),
  ('meetings', 'Assembleias e deliberações', 5),
  ('issuances', 'Emissões e recompras', 6),
  ('transactions', 'Aquisições, vendas e desenvolvimentos', 7),
  ('appraisals', 'Laudos e avaliações', 8),
  ('legal_environmental', 'Contingências, seguros e documentos legais aplicáveis', 9)
on conflict (code) do update set label = excluded.label, display_order = excluded.display_order, active = true;

insert into public.data_scope_definitions (code, label, display_order, allows_not_applicable)
values
  ('properties', 'Imóveis e exposições', 1, false),
  ('tenants', 'Locatários', 2, false),
  ('leases', 'Contratos', 3, false),
  ('debts', 'Dívidas e compromissos', 4, true),
  ('valuation', 'Valuation e premissas', 5, false),
  ('risks', 'Riscos e estresses', 6, false),
  ('triggers', 'Gatilhos e falsificadores', 7, false),
  ('technical', 'Indicadores técnicos e de liquidez', 8, false)
on conflict (code) do update set
  label = excluded.label,
  display_order = excluded.display_order,
  allows_not_applicable = excluded.allows_not_applicable,
  active = true;

alter table public.source_documents
  add column if not exists official_document_id text,
  add column if not exists content_hash text,
  add column if not exists fiscal_year integer,
  add column if not exists includes_notes boolean not null default false,
  add column if not exists includes_audit_opinion boolean not null default false,
  add column if not exists is_current_version boolean not null default true,
  add column if not exists supersedes_document_id bigint references public.source_documents(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'source_documents_fiscal_year' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_fiscal_year check (fiscal_year is null or fiscal_year between 1990 and 2200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_hash_format' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_hash_format check (content_hash is null or content_hash ~ '^[A-Fa-f0-9]{64}$');
  end if;
end $$;

create unique index if not exists source_documents_run_official_id_unique
on public.source_documents (analysis_run_id, official_document_id)
where official_document_id is not null;

create unique index if not exists source_documents_run_hash_unique
on public.source_documents (analysis_run_id, content_hash)
where content_hash is not null;

create index if not exists source_documents_supersedes_idx
on public.source_documents (supersedes_document_id)
where supersedes_document_id is not null;

create table if not exists public.instrument_eligibility_reviews (
  id bigint generated always as identity primary key,
  instrument_id bigint not null references public.instruments(id) on delete cascade,
  verification_date date not null,
  eligibility_status text not null,
  confidence text not null,
  target_audience text,
  exchange_status text,
  market_source_url text not null,
  regulator_source_url text not null,
  notes text not null,
  created_at timestamptz not null default now(),
  constraint instrument_eligibility_reviews_unique unique (instrument_id, verification_date),
  constraint instrument_eligibility_reviews_status check (eligibility_status in ('confirmed_retail', 'probable_retail', 'restricted', 'professional_only', 'unverified', 'excluded')),
  constraint instrument_eligibility_reviews_confidence check (confidence in ('high', 'medium', 'low'))
);

create index if not exists instrument_eligibility_reviews_instrument_date_idx
on public.instrument_eligibility_reviews (instrument_id, verification_date desc);

insert into public.methodology_criteria (
  code, section_code, title, display_order, segment_key, criticality, blocks_positive_verdict_when_unavailable
)
values
  ('identity.1', 'identity', 'Mandato, regulamento, publico-alvo e politica de investimento', 101, null, 'essential', true),
  ('identity.2', 'identity', 'Administrador, gestor, consultores e prestadores relevantes', 102, null, 'material', false),
  ('identity.3', 'identity', 'Linha do tempo de emissoes, incorporacoes e mudancas de estrategia', 103, null, 'material', false),
  ('identity.4', 'identity', 'Historico patrimonial, operacional e de gestao', 104, null, 'material', false),
  ('identity.5', 'identity', 'Taxas, incentivos e alinhamento com o cotista', 105, null, 'essential', true),
  ('documentary.1', 'documentary', 'Seis relatorios gerenciais mais recentes, sem amostragem de paginas', 201, null, 'essential', true),
  ('documentary.2', 'documentary', 'Demonstracoes financeiras, notas e pareceres de tres exercicios', 202, null, 'essential', true),
  ('documentary.3', 'documentary', 'Regulamento vigente, fatos relevantes e comunicados', 203, null, 'essential', true),
  ('documentary.4', 'documentary', 'Documentos de emissoes, aquisicoes, vendas e avaliacoes aplicaveis', 204, null, 'material', false),
  ('documentary.5', 'documentary', 'Conciliacao de contradicoes, lacunas e mudancas entre documentos', 205, null, 'essential', true),
  ('portfolio.1', 'portfolio', 'Todos os imoveis, localizacao, ABL, participacao e padrao construtivo', 301, null, 'essential', true),
  ('portfolio.2', 'portfolio', 'Concentracao por ativo, regiao, tipologia e estagio operacional', 302, null, 'essential', true),
  ('portfolio.3', 'portfolio', 'Idade, conservacao, certificacoes, obsolescencia e capex', 303, null, 'material', false),
  ('portfolio.4', 'portfolio', 'Valor patrimonial, laudos, custo historico e transacoes comparaveis', 304, null, 'essential', true),
  ('portfolio.5', 'portfolio', 'Ativos em desenvolvimento, expansoes e propriedades indiretas', 305, null, 'material', false),
  ('tenants_contracts.1', 'tenants_contracts', 'Todos os principais inquilinos e concentracao de receita', 401, null, 'essential', true),
  ('tenants_contracts.2', 'tenants_contracts', 'Qualidade de credito, inadimplencia e dependencia economica', 402, null, 'essential', true),
  ('tenants_contracts.3', 'tenants_contracts', 'Contratos tipicos e atipicos, revisoes, multas e garantias', 403, null, 'material', false),
  ('tenants_contracts.4', 'tenants_contracts', 'Indexadores, vencimentos, carencias e cronograma de renovacoes', 404, null, 'essential', true),
  ('tenants_contracts.5', 'tenants_contracts', 'WAULT, revisional, risco de devolucao e aluguel versus mercado', 405, null, 'essential', true),
  ('operations.1', 'operations', 'Vacancia fisica e financeira por ativo e consolidada', 501, null, 'essential', true),
  ('operations.2', 'operations', 'Ocupacao, absorcao, leasing spread e velocidade de locacao', 502, null, 'material', false),
  ('operations.3', 'operations', 'Receita e NOI por metro quadrado, custos e eficiencia operacional', 503, null, 'essential', true),
  ('operations.4', 'operations', 'Pipeline de locacoes, renovacoes, expansoes e obras', 504, null, 'material', false),
  ('operations.5', 'operations', 'Benchmark operacional do segmento e dos concorrentes comparaveis', 505, null, 'material', false),
  ('financials.1', 'financials', 'Resultados mensais e anuais, regime de caixa e competencia', 601, null, 'essential', true),
  ('financials.2', 'financials', 'Receitas, despesas, provisoes, contas a receber e caixa', 602, null, 'essential', true),
  ('financials.3', 'financials', 'Reconciliacao de eventos nao recorrentes e efeitos contabeis', 603, null, 'essential', true),
  ('financials.4', 'financials', 'Evolucao patrimonial por cota e movimentacoes de capital', 604, null, 'material', false),
  ('financials.5', 'financials', 'Capex, obrigacoes futuras e qualidade do balanco', 605, null, 'essential', true),
  ('income.1', 'income', 'Dividendos mensais dos ultimos 36 meses', 701, null, 'essential', true),
  ('income.2', 'income', 'Resultado recorrente, extraordinario e cobertura da distribuicao', 702, null, 'essential', true),
  ('income.3', 'income', 'Reservas acumuladas, retencoes, linearizacao e payout', 703, null, 'essential', true),
  ('income.4', 'income', 'Guidance, estabilidade, sazonalidade e previsibilidade da renda', 704, null, 'material', false),
  ('income.5', 'income', 'DY corrente, DY normalizado e sensibilidade ao preco', 705, null, 'essential', true),
  ('debt.1', 'debt', 'Saldo, credor, garantia, indexador e custo de cada obrigacao', 801, null, 'essential', true),
  ('debt.2', 'debt', 'Cronograma de amortizacao, duration e concentracao de vencimentos', 802, null, 'essential', true),
  ('debt.3', 'debt', 'LTV, divida liquida, covenants e margem de seguranca', 803, null, 'essential', true),
  ('debt.4', 'debt', 'Parcelas de aquisicoes, securitizacoes e compromissos nao contabilizados', 804, null, 'material', false),
  ('debt.5', 'debt', 'Testes de estresse de juros, vacancia e refinanciamento', 805, null, 'essential', true),
  ('management.1', 'management', 'Historico de compras, vendas, emissoes e reinvestimentos', 901, null, 'essential', true),
  ('management.2', 'management', 'Preco pago, cap rate, financiamento e criacao de valor por transacao', 902, null, 'essential', true),
  ('management.3', 'management', 'Disciplina em emissoes abaixo ou acima do valor patrimonial', 903, null, 'material', false),
  ('management.4', 'management', 'Execucao de guidance, comunicacao e tratamento de erros', 904, null, 'essential', true),
  ('management.5', 'management', 'Track record comparado a pares e incentivos economicos', 905, null, 'material', false),
  ('governance.1', 'governance', 'Partes relacionadas, conflitos declarados e transacoes vinculadas', 1001, null, 'essential', true),
  ('governance.2', 'governance', 'Concentracao de votos, assembleias e direitos do cotista', 1002, null, 'material', false),
  ('governance.3', 'governance', 'Taxas, remuneracao variavel e potenciais incentivos perversos', 1003, null, 'essential', true),
  ('governance.4', 'governance', 'Auditoria, controles, processos e contingencias', 1004, null, 'essential', true),
  ('governance.5', 'governance', 'Historico de transparencia, atrasos, retificacoes e sancoes', 1005, null, 'material', false),
  ('valuation.1', 'valuation', 'P/VP, cap rate implicito e comparacao com pares e transacoes', 1101, null, 'essential', true),
  ('valuation.2', 'valuation', 'Fluxo de caixa ou renda normalizada com premissas explicitas', 1102, null, 'essential', true),
  ('valuation.3', 'valuation', 'Valor justo pessimista, base e otimista', 1103, null, 'essential', true),
  ('valuation.4', 'valuation', 'Sensibilidade a juros, vacancia, aluguel, cap rate e crescimento', 1104, null, 'essential', true),
  ('valuation.5', 'valuation', 'Preco de entrada, margem de seguranca e retorno esperado', 1105, null, 'essential', true),
  ('scenarios.1', 'scenarios', 'Premissas operacionais e macroeconomicas de cada cenario', 1201, null, 'essential', true),
  ('scenarios.2', 'scenarios', 'Renda por cota e valor justo em cada cenario', 1202, null, 'essential', true),
  ('scenarios.3', 'scenarios', 'Probabilidades justificadas e fatores de transicao', 1203, null, 'material', false),
  ('scenarios.4', 'scenarios', 'Horizontes de 12, 36 e 60 meses quando aplicaveis', 1204, null, 'material', false),
  ('scenarios.5', 'scenarios', 'Ponto de ruptura da tese e perda potencial permanente', 1205, null, 'essential', true),
  ('risks.1', 'risks', 'Riscos de ativo, inquilino, contrato, regiao e segmento', 1301, null, 'essential', true),
  ('risks.2', 'risks', 'Riscos financeiros, liquidez, emissao e refinanciamento', 1302, null, 'essential', true),
  ('risks.3', 'risks', 'Riscos juridicos, regulatorios, ambientais e estruturais', 1303, null, 'essential', true),
  ('risks.4', 'risks', 'Choques combinados de vacancia, aluguel, juros e cap rate', 1304, null, 'essential', true),
  ('risks.5', 'risks', 'Probabilidade, impacto, mitigadores e sinais de alerta', 1305, null, 'essential', true),
  ('catalysts.1', 'catalysts', 'Locacoes, revisoes, renovacoes e entregas contratadas', 1401, null, 'material', false),
  ('catalysts.2', 'catalysts', 'Aquisicoes, vendas, expansoes e reciclagem de portfolio', 1402, null, 'material', false),
  ('catalysts.3', 'catalysts', 'Reducao de divida, queda de custo e liberacao de reservas', 1403, null, 'material', false),
  ('catalysts.4', 'catalysts', 'Mudancas regulatorias ou setoriais relevantes', 1404, null, 'material', false),
  ('catalysts.5', 'catalysts', 'Gatilhos de compra, espera, reducao e invalidacao da tese', 1405, null, 'essential', true),
  ('technical.1', 'technical', 'Historico ajustado de preco, volume e liquidez', 1501, null, 'essential', true),
  ('technical.2', 'technical', 'Tendencias, medias, volatilidade e drawdowns', 1502, null, 'material', false),
  ('technical.3', 'technical', 'Suportes, resistencias, gaps e regioes de congestao', 1503, null, 'material', false),
  ('technical.4', 'technical', 'Fibonacci em movimentos tecnicamente justificaveis', 1504, null, 'supplementary', false),
  ('technical.5', 'technical', 'Confluencia entre preco tecnico, valor justo e renda', 1505, null, 'material', false),
  ('critical_review.1', 'critical_review', 'Releitura integral das fontes e procura de omissoes', 1601, null, 'essential', true),
  ('critical_review.2', 'critical_review', 'Reexecucao dos calculos e conciliacao de numeros', 1602, null, 'essential', true),
  ('critical_review.3', 'critical_review', 'Contradicoes entre gestao, demonstracoes e fatos', 1603, null, 'essential', true),
  ('critical_review.4', 'critical_review', 'Hipoteses alternativas, vies de confirmacao e caso contrario', 1604, null, 'essential', true),
  ('critical_review.5', 'critical_review', 'Checklist final de lacunas, recencia e confianca da analise', 1605, null, 'essential', true),
  ('segment.logistics.1', 'portfolio', 'Custo de reposicao, valor do terreno e aluguel por metro quadrado', 1701, 'logistics', 'material', false),
  ('segment.logistics.2', 'operations', 'Oferta, absorcao, vacancia e aluguel no micromercado', 1702, 'logistics', 'essential', true),
  ('segment.logistics.3', 'portfolio', 'Acessos, raio logistico, last mile e dependencia de infraestrutura', 1703, 'logistics', 'material', false),
  ('segment.logistics.4', 'operations', 'Pe-direito, docas, piso, eficiencia e adequacao ao ocupante', 1704, 'logistics', 'material', false),
  ('segment.logistics.5', 'risks', 'Nova oferta, obsolescencia e liquidez do ativo no mercado secundario', 1705, 'logistics', 'essential', true),
  ('segment.shopping.1', 'operations', 'Vendas por metro quadrado, fluxo e vendas mesmas lojas', 1801, 'shopping', 'essential', true),
  ('segment.shopping.2', 'operations', 'NOI, margem NOI, aluguel mesmas lojas e ocupacao', 1802, 'shopping', 'essential', true),
  ('segment.shopping.3', 'tenants_contracts', 'Custo de ocupacao, inadimplencia e saude dos lojistas', 1803, 'shopping', 'essential', true),
  ('segment.shopping.4', 'portfolio', 'Mix de lojas, ancoras, dominancia e area de influencia', 1804, 'shopping', 'material', false),
  ('segment.shopping.5', 'risks', 'Capex recorrente, expansoes e concorrencia fisica ou digital', 1805, 'shopping', 'material', false),
  ('segment.offices.1', 'operations', 'Aluguel, vacancia e absorcao por submercado e classe', 1901, 'offices', 'essential', true),
  ('segment.offices.2', 'portfolio', 'Qualidade tecnica, certificacoes, lajes e eficiencia predial', 1902, 'offices', 'material', false),
  ('segment.offices.3', 'operations', 'Capex de reposicionamento, retrofit e custo de reletting', 1903, 'offices', 'essential', true),
  ('segment.offices.4', 'tenants_contracts', 'Incentivos, carencias, revisional e aluguel versus mercado', 1904, 'offices', 'essential', true),
  ('segment.offices.5', 'risks', 'Oferta futura, trabalho hibrido e obsolescencia por micromercado', 1905, 'offices', 'essential', true),
  ('segment.urban_income.1', 'tenants_contracts', 'Aluguel contratual versus mercado e potencial revisional', 2001, 'urban_income', 'essential', true),
  ('segment.urban_income.2', 'tenants_contracts', 'Contratos atipicos, multas, garantias e risco de credito', 2002, 'urban_income', 'essential', true),
  ('segment.urban_income.3', 'portfolio', 'Capex contratado, responsabilidade por obras e manutencao', 2003, 'urban_income', 'material', false),
  ('segment.urban_income.4', 'portfolio', 'Liquidez, fungibilidade e valor de uso alternativo dos imoveis', 2004, 'urban_income', 'essential', true),
  ('segment.urban_income.5', 'risks', 'Concentracao por locatario dominante e continuidade operacional', 2005, 'urban_income', 'essential', true)
on conflict (code) do update set
  section_code = excluded.section_code,
  title = excluded.title,
  display_order = excluded.display_order,
  segment_key = excluded.segment_key,
  criticality = excluded.criticality,
  blocks_positive_verdict_when_unavailable = excluded.blocks_positive_verdict_when_unavailable,
  active = true;

alter table public.metric_definitions
  add column if not exists required_for_completion boolean not null default false,
  add column if not exists asset_type text not null default 'fii',
  add column if not exists segment_key text,
  add column if not exists max_age_days integer not null default 400;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_asset_type' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_asset_type check (asset_type in ('fii', 'stock'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_segment_key' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_segment_key check (
      segment_key is null or segment_key in ('logistics', 'shopping', 'offices', 'urban_income', 'hotels', 'development', 'other')
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'metric_definitions_max_age_days' and conrelid = 'public.metric_definitions'::regclass) then
    alter table public.metric_definitions add constraint metric_definitions_max_age_days check (max_age_days between 1 and 3650);
  end if;
end $$;

insert into public.metric_definitions (
  code, name, unit, value_type, comparison_scope, preferred_direction, description,
  required_for_completion, asset_type, segment_key, max_age_days
)
values
  ('p_vp', 'Preco sobre valor patrimonial', 'x', 'numeric', 'all', 'lower', 'Preco dividido pelo valor patrimonial por cota.', true, 'fii', null, 45),
  ('dy_12m', 'Dividend yield em 12 meses', '%', 'numeric', 'all', 'contextual', 'Renda distribuida em 12 meses sobre o preco.', true, 'fii', null, 45),
  ('vacancy_physical', 'Vacancia fisica', '%', 'numeric', 'segment', 'lower', 'Area vaga sobre a area total.', true, 'fii', null, 120),
  ('vacancy_financial', 'Vacancia financeira', '%', 'numeric', 'segment', 'lower', 'Receita potencial vaga sobre a receita potencial.', true, 'fii', null, 120),
  ('leverage_nav', 'Alavancagem sobre patrimonio', '%', 'numeric', 'all', 'lower', 'Obrigacoes financeiras sobre patrimonio.', true, 'fii', null, 120),
  ('income_coverage', 'Cobertura da distribuicao recorrente', 'x', 'numeric', 'all', 'higher', 'Resultado recorrente dividido pela distribuicao.', true, 'fii', null, 120),
  ('wault', 'Prazo medio ponderado dos contratos', 'anos', 'numeric', 'segment', 'higher', 'WAULT ponderado pela receita.', true, 'fii', null, 180),
  ('liquidity_daily', 'Liquidez media diaria', 'BRL', 'numeric', 'all', 'higher', 'Volume financeiro medio diario.', true, 'fii', null, 45),
  ('nav_per_share', 'Valor patrimonial por cota', 'BRL/cota', 'numeric', 'all', 'higher', 'Patrimonio liquido por cota.', true, 'fii', null, 120),
  ('net_asset_value', 'Patrimonio liquido', 'BRL', 'numeric', 'all', 'higher', 'Patrimonio liquido do fundo.', true, 'fii', null, 120),
  ('recurring_income_per_share', 'Resultado recorrente por cota', 'BRL/cota', 'numeric', 'all', 'higher', 'Resultado mensal normalizado por cota.', true, 'fii', null, 120),
  ('distribution_per_share', 'Distribuicao por cota', 'BRL/cota', 'numeric', 'all', 'contextual', 'Ultima distribuicao por cota.', true, 'fii', null, 62),
  ('payout_recurring', 'Payout recorrente', '%', 'numeric', 'all', 'target', 'Distribuicao sobre resultado recorrente.', true, 'fii', null, 120),
  ('cash_position', 'Caixa e equivalentes', 'BRL', 'numeric', 'all', 'higher', 'Caixa e aplicacoes de liquidez.', true, 'fii', null, 120),
  ('ltv', 'Loan to value', '%', 'numeric', 'all', 'lower', 'Divida sobre valor dos ativos.', true, 'fii', null, 120),
  ('net_debt', 'Divida liquida', 'BRL', 'numeric', 'all', 'lower', 'Divida bruta menos caixa.', true, 'fii', null, 120),
  ('implicit_cap_rate', 'Cap rate implicito', '%', 'numeric', 'segment', 'higher', 'NOI normalizado sobre valor de mercado dos ativos.', true, 'fii', null, 120),
  ('noi_per_sqm', 'NOI por metro quadrado', 'BRL/m2', 'numeric', 'segment', 'higher', 'NOI recorrente por area economica.', true, 'fii', null, 120),
  ('rent_per_sqm', 'Aluguel por metro quadrado', 'BRL/m2', 'numeric', 'segment', 'higher', 'Receita de locacao por area ocupada.', true, 'fii', null, 120),
  ('top_tenant_concentration', 'Concentracao no maior locatario', '%', 'numeric', 'segment', 'lower', 'Participacao do maior locatario na receita.', true, 'fii', null, 120),
  ('top_asset_concentration', 'Concentracao no maior ativo', '%', 'numeric', 'segment', 'lower', 'Participacao do maior ativo no valor ou receita.', true, 'fii', null, 120),
  ('management_fee', 'Taxa de administracao e gestao', '% a.a.', 'numeric', 'all', 'lower', 'Custo recorrente total da gestao.', true, 'fii', null, 365),
  ('ma_20', 'Media movel de 20 pregoes', 'BRL', 'numeric', 'all', 'contextual', 'Media movel ajustada de 20 pregoes.', true, 'fii', null, 10),
  ('ma_50', 'Media movel de 50 pregoes', 'BRL', 'numeric', 'all', 'contextual', 'Media movel ajustada de 50 pregoes.', true, 'fii', null, 10),
  ('ma_200', 'Media movel de 200 pregoes', 'BRL', 'numeric', 'all', 'contextual', 'Media movel ajustada de 200 pregoes.', true, 'fii', null, 10),
  ('rsi_14', 'RSI de 14 pregoes', 'pontos', 'numeric', 'all', 'contextual', 'Indice de forca relativa.', true, 'fii', null, 10),
  ('macd', 'MACD', 'pontos', 'numeric', 'all', 'contextual', 'Diferenca das medias exponenciais e sinal.', true, 'fii', null, 10),
  ('volatility_annual', 'Volatilidade anualizada', '%', 'numeric', 'all', 'lower', 'Volatilidade anualizada dos retornos diarios.', true, 'fii', null, 10),
  ('max_drawdown_3y', 'Drawdown maximo em tres anos', '%', 'numeric', 'all', 'lower', 'Maior queda de pico a vale em tres anos.', true, 'fii', null, 10),
  ('support_level', 'Suporte tecnico principal', 'BRL', 'numeric', 'all', 'contextual', 'Zona de suporte tecnicamente justificada.', true, 'fii', null, 10),
  ('resistance_level', 'Resistencia tecnica principal', 'BRL', 'numeric', 'all', 'contextual', 'Zona de resistencia tecnicamente justificada.', true, 'fii', null, 10),
  ('fibonacci_levels', 'Niveis de Fibonacci justificados', null, 'text', 'all', 'contextual', 'Movimento base e niveis usados, com justificativa.', true, 'fii', null, 10),
  ('replacement_cost_sqm', 'Custo de reposicao por metro quadrado', 'BRL/m2', 'numeric', 'segment', 'higher', 'Custo de reposicao dos ativos logisticos.', true, 'fii', 'logistics', 180),
  ('regional_vacancy', 'Vacancia regional', '%', 'numeric', 'segment', 'lower', 'Vacancia no micromercado logistico.', true, 'fii', 'logistics', 180),
  ('regional_absorption', 'Absorcao regional', 'm2', 'numeric', 'segment', 'higher', 'Absorcao liquida no micromercado logistico.', true, 'fii', 'logistics', 180),
  ('lease_spread', 'Leasing spread', '%', 'numeric', 'segment', 'higher', 'Variacao de aluguel em renovacoes e novas locacoes.', true, 'fii', 'logistics', 180),
  ('dock_ratio', 'Relacao de docas', 'docas/1000m2', 'numeric', 'segment', 'higher', 'Numero de docas por area locavel.', true, 'fii', 'logistics', 365),
  ('sales_sqm', 'Vendas por metro quadrado', 'BRL/m2', 'numeric', 'segment', 'higher', 'Vendas dos lojistas por area.', true, 'fii', 'shopping', 120),
  ('same_store_sales', 'Vendas mesmas lojas', '%', 'numeric', 'segment', 'higher', 'Crescimento de vendas mesmas lojas.', true, 'fii', 'shopping', 120),
  ('noi_margin', 'Margem NOI', '%', 'numeric', 'segment', 'higher', 'NOI sobre receita operacional.', true, 'fii', 'shopping', 120),
  ('occupancy_cost', 'Custo de ocupacao', '%', 'numeric', 'segment', 'lower', 'Aluguel e encargos sobre vendas dos lojistas.', true, 'fii', 'shopping', 120),
  ('delinquency', 'Inadimplencia', '%', 'numeric', 'segment', 'lower', 'Recebiveis vencidos sobre faturamento.', true, 'fii', 'shopping', 120),
  ('submarket_rent_sqm', 'Aluguel do submercado', 'BRL/m2', 'numeric', 'segment', 'higher', 'Aluguel pedido ou efetivo no submercado de escritorios.', true, 'fii', 'offices', 180),
  ('submarket_vacancy', 'Vacancia do submercado', '%', 'numeric', 'segment', 'lower', 'Vacancia no submercado e classe do ativo.', true, 'fii', 'offices', 180),
  ('submarket_absorption', 'Absorcao do submercado', 'm2', 'numeric', 'segment', 'higher', 'Absorcao liquida no submercado.', true, 'fii', 'offices', 180),
  ('relet_capex_sqm', 'Capex de reletting por metro quadrado', 'BRL/m2', 'numeric', 'segment', 'lower', 'Custo para reposicionar area devolvida.', true, 'fii', 'offices', 365),
  ('lease_incentive_months', 'Incentivo de locacao', 'meses', 'numeric', 'segment', 'lower', 'Carencia e incentivos equivalentes em meses.', true, 'fii', 'offices', 180),
  ('lease_to_market', 'Aluguel contratual sobre mercado', '%', 'numeric', 'segment', 'contextual', 'Diferenca entre aluguel vigente e mercado.', true, 'fii', 'urban_income', 180),
  ('atypical_contract_share', 'Participacao de contratos atipicos', '%', 'numeric', 'segment', 'higher', 'Receita coberta por contratos atipicos.', true, 'fii', 'urban_income', 180),
  ('committed_capex', 'Capex contratado', 'BRL', 'numeric', 'segment', 'lower', 'Capex futuro comprometido.', true, 'fii', 'urban_income', 180),
  ('alternative_use_value', 'Valor de uso alternativo', 'BRL', 'numeric', 'segment', 'higher', 'Valor estimado em uso alternativo plausivel.', true, 'fii', 'urban_income', 365),
  ('dominant_tenant_credit', 'Credito do locatario dominante', null, 'text', 'segment', 'contextual', 'Avaliacao documentada da qualidade de credito.', true, 'fii', 'urban_income', 180)
on conflict (code) do update set
  name = excluded.name,
  unit = excluded.unit,
  value_type = excluded.value_type,
  comparison_scope = excluded.comparison_scope,
  preferred_direction = excluded.preferred_direction,
  description = excluded.description,
  required_for_completion = excluded.required_for_completion,
  asset_type = excluded.asset_type,
  segment_key = excluded.segment_key,
  max_age_days = excluded.max_age_days;

alter table public.cash_distributions
  add column if not exists analysis_run_id bigint references public.analysis_runs(id) on delete set null,
  add column if not exists classification_notes text,
  add column if not exists last_verified_at timestamptz;

create index if not exists cash_distributions_run_idx
on public.cash_distributions (analysis_run_id) where analysis_run_id is not null;

create table if not exists public.fund_properties (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  property_code text not null,
  name text not null,
  property_type text,
  operational_status text not null default 'operational',
  city text,
  state text,
  country text not null default 'BR',
  ownership_pct numeric(7,4),
  gross_leasable_area_sqm numeric(20,4),
  economic_area_sqm numeric(20,4),
  acquisition_cost numeric(20,2),
  fair_value numeric(20,2),
  appraisal_date date,
  physical_vacancy_pct numeric(7,4),
  financial_vacancy_pct numeric(7,4),
  rent_per_sqm numeric(18,6),
  noi_per_sqm numeric(18,6),
  acquisition_date date,
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fund_properties_unique unique (analysis_run_id, property_code),
  constraint fund_properties_status check (operational_status in ('operational', 'development', 'expansion', 'vacant', 'held_for_sale', 'indirect')),
  constraint fund_properties_ownership check (ownership_pct is null or ownership_pct between 0 and 100),
  constraint fund_properties_areas check (
    (gross_leasable_area_sqm is null or gross_leasable_area_sqm >= 0)
    and (economic_area_sqm is null or economic_area_sqm >= 0)
  ),
  constraint fund_properties_values check (
    (acquisition_cost is null or acquisition_cost >= 0)
    and (fair_value is null or fair_value >= 0)
  ),
  constraint fund_properties_vacancy check (
    (physical_vacancy_pct is null or physical_vacancy_pct between 0 and 100)
    and (financial_vacancy_pct is null or financial_vacancy_pct between 0 and 100)
  )
);

create table if not exists public.fund_tenants (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  tenant_code text not null,
  name text not null,
  sector text,
  credit_quality text,
  revenue_share_pct numeric(7,4),
  leased_area_share_pct numeric(7,4),
  is_related_party boolean not null default false,
  is_delinquent boolean,
  delinquency_amount numeric(20,2),
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fund_tenants_unique unique (analysis_run_id, tenant_code),
  constraint fund_tenants_shares check (
    (revenue_share_pct is null or revenue_share_pct between 0 and 100)
    and (leased_area_share_pct is null or leased_area_share_pct between 0 and 100)
  ),
  constraint fund_tenants_delinquency check (delinquency_amount is null or delinquency_amount >= 0)
);

create table if not exists public.fund_leases (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  lease_code text not null,
  property_id bigint references public.fund_properties(id) on delete set null,
  tenant_id bigint references public.fund_tenants(id) on delete set null,
  contract_type text,
  start_date date,
  end_date date,
  next_revision_date date,
  indexer text,
  monthly_rent numeric(20,2),
  rent_per_sqm numeric(18,6),
  revenue_share_pct numeric(7,4),
  break_option_date date,
  penalty_terms text,
  guarantee_type text,
  grace_period_months numeric(8,2),
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fund_leases_unique unique (analysis_run_id, lease_code),
  constraint fund_leases_dates check (end_date is null or start_date is null or end_date >= start_date),
  constraint fund_leases_amounts check (
    (monthly_rent is null or monthly_rent >= 0)
    and (revenue_share_pct is null or revenue_share_pct between 0 and 100)
    and (grace_period_months is null or grace_period_months >= 0)
  )
);

create table if not exists public.debt_obligations (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  debt_code text not null,
  debt_type text not null,
  creditor text,
  original_principal numeric(20,2),
  outstanding_balance numeric(20,2) not null,
  indexer text,
  spread_pct numeric(9,6),
  all_in_cost_pct numeric(9,6),
  issue_date date,
  maturity_date date,
  amortization_schedule jsonb not null default '[]'::jsonb,
  guarantees text,
  covenants text,
  covenant_headroom_pct numeric(9,6),
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_obligations_unique unique (analysis_run_id, debt_code),
  constraint debt_obligations_balances check (
    outstanding_balance >= 0 and (original_principal is null or original_principal >= 0)
  ),
  constraint debt_obligations_dates check (maturity_date is null or issue_date is null or maturity_date >= issue_date),
  constraint debt_obligations_amortization check (jsonb_typeof(amortization_schedule) = 'array')
);

create table if not exists public.valuation_scenarios (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  scenario_code text not null,
  horizon_months integer not null,
  model_method text not null,
  model_version text not null,
  expected_income_per_share numeric(18,8),
  fair_value_per_share numeric(18,8) not null,
  expected_total_return_pct numeric(12,6),
  probability_pct numeric(7,4),
  counter_model_method text,
  counter_model_value_per_share numeric(18,8),
  as_of_date date not null,
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  notes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valuation_scenarios_unique unique (analysis_run_id, scenario_code),
  constraint valuation_scenarios_code check (scenario_code in ('pessimistic', 'base', 'optimistic')),
  constraint valuation_scenarios_horizon check (horizon_months in (12, 36, 60)),
  constraint valuation_scenarios_values check (
    fair_value_per_share >= 0
    and (expected_income_per_share is null or expected_income_per_share >= 0)
    and (counter_model_value_per_share is null or counter_model_value_per_share >= 0)
    and (probability_pct is null or probability_pct between 0 and 100)
  )
);

create table if not exists public.valuation_assumptions (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  assumption_code text not null,
  label text not null,
  scenario_code text,
  value_numeric numeric(28,10),
  value_text text,
  unit text,
  rationale text not null,
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valuation_assumptions_unique unique (analysis_run_id, assumption_code),
  constraint valuation_assumptions_scenario check (scenario_code is null or scenario_code in ('pessimistic', 'base', 'optimistic', 'all')),
  constraint valuation_assumptions_one_value check (num_nonnulls(value_numeric, value_text) = 1)
);

create table if not exists public.risk_register (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  risk_code text not null,
  category text not null,
  description text not null,
  probability_score smallint not null,
  impact_score smallint not null,
  quantified_loss_pct numeric(9,6),
  mitigants text not null,
  warning_signals text not null,
  stress_test_result text not null,
  status text not null default 'open',
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risk_register_unique unique (analysis_run_id, risk_code),
  constraint risk_register_scores check (probability_score between 1 and 5 and impact_score between 1 and 5),
  constraint risk_register_loss check (quantified_loss_pct is null or quantified_loss_pct >= 0),
  constraint risk_register_status check (status in ('open', 'monitored', 'mitigated', 'materialized', 'closed'))
);

create table if not exists public.thesis_triggers (
  id bigint generated always as identity primary key,
  analysis_run_id bigint not null references public.analysis_runs(id) on delete cascade,
  trigger_code text not null,
  trigger_type text not null,
  description text not null,
  metric_code text references public.metric_definitions(code) on delete set null,
  comparison_operator text,
  threshold_numeric numeric(28,10),
  threshold_text text,
  status text not null default 'inactive',
  source_document_id bigint references public.source_documents(id) on delete set null,
  source_url text not null,
  last_verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint thesis_triggers_unique unique (analysis_run_id, trigger_code),
  constraint thesis_triggers_type check (trigger_type in ('positive', 'negative', 'falsifier', 'buy', 'wait', 'reduce', 'sell')),
  constraint thesis_triggers_operator check (comparison_operator is null or comparison_operator in ('gt', 'gte', 'lt', 'lte', 'eq', 'contains', 'event')),
  constraint thesis_triggers_threshold check (num_nonnulls(threshold_numeric, threshold_text) <= 1),
  constraint thesis_triggers_status check (status in ('inactive', 'watching', 'met', 'invalidated'))
);

create index if not exists fund_properties_run_idx on public.fund_properties (analysis_run_id);
create index if not exists fund_properties_source_idx on public.fund_properties (source_document_id) where source_document_id is not null;
create index if not exists fund_tenants_run_idx on public.fund_tenants (analysis_run_id);
create index if not exists fund_tenants_source_idx on public.fund_tenants (source_document_id) where source_document_id is not null;
create index if not exists fund_leases_run_idx on public.fund_leases (analysis_run_id);
create index if not exists fund_leases_property_idx on public.fund_leases (property_id) where property_id is not null;
create index if not exists fund_leases_tenant_idx on public.fund_leases (tenant_id) where tenant_id is not null;
create index if not exists fund_leases_source_idx on public.fund_leases (source_document_id) where source_document_id is not null;
create index if not exists debt_obligations_run_maturity_idx on public.debt_obligations (analysis_run_id, maturity_date);
create index if not exists debt_obligations_source_idx on public.debt_obligations (source_document_id) where source_document_id is not null;
create index if not exists valuation_scenarios_run_idx on public.valuation_scenarios (analysis_run_id);
create index if not exists valuation_scenarios_source_idx on public.valuation_scenarios (source_document_id) where source_document_id is not null;
create index if not exists valuation_assumptions_run_idx on public.valuation_assumptions (analysis_run_id);
create index if not exists valuation_assumptions_source_idx on public.valuation_assumptions (source_document_id) where source_document_id is not null;
create index if not exists risk_register_run_severity_idx on public.risk_register (analysis_run_id, impact_score desc, probability_score desc);
create index if not exists risk_register_source_idx on public.risk_register (source_document_id) where source_document_id is not null;
create index if not exists thesis_triggers_run_type_idx on public.thesis_triggers (analysis_run_id, trigger_type);
create index if not exists thesis_triggers_metric_idx on public.thesis_triggers (metric_code) where metric_code is not null;
create index if not exists thesis_triggers_source_idx on public.thesis_triggers (source_document_id) where source_document_id is not null;

drop index if exists public.source_documents_run_current_competence_unique;
create unique index source_documents_run_current_competence_unique
on public.source_documents (analysis_run_id, document_type, competence_date)
where is_current_version and competence_date is not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'source_documents_type' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents drop constraint source_documents_type;
  end if;
  alter table public.source_documents add constraint source_documents_type check (
    document_type in (
      'management_report', 'financial_statement', 'audit_report', 'regulation',
      'material_fact', 'meeting', 'issuance', 'transaction', 'appraisal',
      'legal', 'environmental', 'insurance', 'other'
    )
  );

  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_complete_semantics' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_complete_semantics check (
      first_pass_status <> 'complete'
      or (nullif(btrim(first_pass_narrative), '') is not null and last_verified_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_complete_semantics' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_complete_semantics check (
      second_pass_status <> 'complete'
      or (nullif(btrim(second_pass_narrative), '') is not null and last_verified_at is not null)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_first_complete_semantics' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_first_complete_semantics check (
      first_pass_status <> 'complete'
      or (
        nullif(btrim(source_url), '') is not null
        and pages_total is not null
        and first_pass_pages_reviewed = pages_total
        and last_verified_at is not null
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_second_complete_semantics' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_second_complete_semantics check (
      second_pass_status <> 'complete'
      or (
        nullif(btrim(source_url), '') is not null
        and pages_total is not null
        and second_pass_pages_reviewed = pages_total
        and last_verified_at is not null
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_classification_semantics' and conrelid = 'public.cash_distributions'::regclass) then
    alter table public.cash_distributions add constraint cash_distributions_classification_semantics check (
      classification = 'unclassified'
      or (
        recurring_amount_per_share is not null
        and nullif(btrim(classification_notes), '') is not null
        and nullif(btrim(source_url), '') is not null
        and last_verified_at is not null
      )
    );
  end if;
end $$;

create unique index if not exists analysis_runs_one_active_idx
on public.analysis_runs ((true))
where status in ('research', 'first_review', 'second_review');

create schema if not exists safa_private;
revoke all on schema safa_private from public, anon, authenticated;

create or replace function safa_private.sync_analysis_requirements(target_run_id bigint)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_segment text;
begin
  select i.segment_key
    into target_segment
  from public.analysis_runs ar
  join public.instruments i on i.id = ar.instrument_id
  where ar.id = target_run_id;

  if not found then
    raise exception 'SAFA: analise % inexistente', target_run_id;
  end if;

  insert into public.analysis_criterion_reviews (analysis_run_id, criterion_code)
  select target_run_id, criterion.code
  from public.methodology_criteria criterion
  where criterion.active
    and (criterion.segment_key is null or criterion.segment_key = target_segment)
  on conflict (analysis_run_id, criterion_code) do nothing;

  insert into public.analysis_document_scopes (analysis_run_id, scope_code)
  select target_run_id, definition.code
  from public.document_scope_definitions definition
  where definition.active
  on conflict (analysis_run_id, scope_code) do nothing;

  insert into public.analysis_data_scopes (analysis_run_id, scope_code)
  select target_run_id, definition.code
  from public.data_scope_definitions definition
  where definition.active
  on conflict (analysis_run_id, scope_code) do nothing;
end;
$$;

create or replace function safa_private.sync_analysis_requirements_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform safa_private.sync_analysis_requirements(new.id);
  return new;
end;
$$;

drop trigger if exists sync_analysis_requirements_after_insert on public.analysis_runs;
create trigger sync_analysis_requirements_after_insert
after insert on public.analysis_runs
for each row execute function safa_private.sync_analysis_requirements_trigger();

do $$
declare
  run_row record;
begin
  for run_row in select id from public.analysis_runs loop
    perform safa_private.sync_analysis_requirements(run_row.id);
  end loop;
end $$;

drop view if exists public.v_analysis_readiness;
create view public.v_analysis_readiness
with (security_invoker = true)
as
with readiness_counts as (
  select
    ar.id as analysis_run_id,
    ar.instrument_id,
    ar.as_of_date,
    i.ticker,
    i.asset_type,
    i.segment_key,
    coalesce(s.section_total, 0) as section_total,
    coalesce(s.first_sections_complete, 0) as first_sections_complete,
    coalesce(s.second_sections_complete, 0) as second_sections_complete,
    coalesce(c.criterion_total, 0) as criterion_total,
    coalesce(c.first_criteria_complete, 0) as first_criteria_complete,
    coalesce(c.second_criteria_complete, 0) as second_criteria_complete,
    coalesce(c.critical_unavailable_count, 0) as critical_unavailable_count,
    coalesce(ds.document_scope_total, 0) as document_scope_total,
    coalesce(ds.document_scopes_complete, 0) as document_scopes_complete,
    coalesce(xs.data_scope_total, 0) as data_scope_total,
    coalesce(xs.data_scopes_complete, 0) as data_scopes_complete,
    coalesce(xs.debt_scope_not_applicable, false) as debt_scope_not_applicable,
    coalesce(d.documents_total, 0) as documents_total,
    coalesce(d.management_reports, 0) as management_reports,
    coalesce(d.management_unique_competencies, 0) as management_unique_competencies,
    coalesce(d.financial_statements, 0) as financial_statements,
    coalesce(d.financial_statement_years, 0) as financial_statement_years,
    coalesce(d.audited_financial_years, 0) as audited_financial_years,
    coalesce(d.audit_reports, 0) as audit_reports,
    coalesce(d.regulations, 0) as regulations,
    coalesce(d.first_documents_complete, 0) as first_documents_complete,
    coalesce(d.second_documents_complete, 0) as second_documents_complete,
    coalesce(d.pages_total, 0) as pages_total,
    coalesce(d.first_pages_reviewed, 0) as first_pages_reviewed,
    coalesce(d.second_pages_reviewed, 0) as second_pages_reviewed,
    coalesce(d.first_pages_ready, false) as first_pages_ready,
    coalesce(d.second_pages_ready, false) as second_pages_ready,
    coalesce(d.documents_fresh, true) as documents_fresh,
    coalesce(h.distribution_count, 0) as distribution_count,
    coalesce(h.classified_distribution_count, 0) as classified_distribution_count,
    coalesce(h.distribution_span_days, 0) as distribution_span_days,
    h.latest_distribution_date,
    coalesce(p.price_count, 0) as price_count,
    coalesce(p.price_span_days, 0) as price_span_days,
    p.latest_price_date,
    coalesce(m.distinct_metric_count, 0) as distinct_metric_count,
    coalesce(m.required_metric_count, 0) as required_metric_count,
    coalesce(m.verified_required_metric_count, 0) as verified_required_metric_count,
    coalesce(z.property_count, 0) as property_count,
    coalesce(z.tenant_count, 0) as tenant_count,
    coalesce(z.lease_count, 0) as lease_count,
    coalesce(z.debt_count, 0) as debt_count,
    coalesce(z.valuation_scenario_count, 0) as valuation_scenario_count,
    coalesce(z.valuation_assumption_count, 0) as valuation_assumption_count,
    coalesce(z.counter_model_count, 0) as counter_model_count,
    coalesce(z.risk_count, 0) as risk_count,
    coalesce(z.thesis_trigger_type_count, 0) as thesis_trigger_type_count,
    coalesce(z.has_positive_trigger, false) as has_positive_trigger,
    coalesce(z.has_negative_trigger, false) as has_negative_trigger,
    coalesce(z.has_falsifier_trigger, false) as has_falsifier_trigger,
    coalesce(e.eligibility_ready, false) as eligibility_ready,
    (
      ar.as_of_date is not null
      and ar.as_of_date between current_date - 45 and current_date
      and coalesce(c.criteria_fresh, false)
      and coalesce(ds.document_scopes_fresh, false)
      and coalesce(xs.data_scopes_fresh, false)
      and coalesce(d.documents_fresh, true)
    ) as data_fresh
  from public.analysis_runs ar
  join public.instruments i on i.id = ar.instrument_id
  left join lateral (
    select
      count(*)::integer as section_total,
      count(*) filter (where first_pass_status = 'complete')::integer as first_sections_complete,
      count(*) filter (where second_pass_status = 'complete')::integer as second_sections_complete
    from public.analysis_sections section_row
    where section_row.analysis_run_id = ar.id
  ) s on true
  left join lateral (
    select
      count(*)::integer as criterion_total,
      count(*) filter (
        where review.first_pass_status in ('complete', 'unavailable', 'not_applicable')
      )::integer as first_criteria_complete,
      count(*) filter (
        where review.second_pass_status in ('complete', 'unavailable', 'not_applicable')
      )::integer as second_criteria_complete,
      count(*) filter (
        where criterion.blocks_positive_verdict_when_unavailable
          and (review.first_pass_status = 'unavailable' or review.second_pass_status = 'unavailable')
      )::integer as critical_unavailable_count,
      bool_and(
        review.last_verified_at is not null
        and review.last_verified_at::date between coalesce(ar.as_of_date, current_date) - 180 and coalesce(ar.as_of_date, current_date) + 1
      ) filter (
        where review.first_pass_status in ('complete', 'unavailable', 'not_applicable')
          and review.second_pass_status in ('complete', 'unavailable', 'not_applicable')
      ) as criteria_fresh
    from public.methodology_criteria criterion
    left join public.analysis_criterion_reviews review
      on review.analysis_run_id = ar.id and review.criterion_code = criterion.code
    where criterion.active
      and (criterion.segment_key is null or criterion.segment_key = i.segment_key)
  ) c on true
  left join lateral (
    select
      count(*)::integer as document_scope_total,
      count(*) filter (
        where scope.status in ('complete', 'unavailable', 'not_applicable')
      )::integer as document_scopes_complete,
      bool_and(
        scope.status in ('complete', 'unavailable', 'not_applicable')
        and scope.last_verified_at is not null
        and scope.last_verified_at::date between coalesce(ar.as_of_date, current_date) - 45 and coalesce(ar.as_of_date, current_date) + 1
      ) as document_scopes_fresh
    from public.document_scope_definitions definition
    left join public.analysis_document_scopes scope
      on scope.analysis_run_id = ar.id and scope.scope_code = definition.code
    where definition.active
  ) ds on true
  left join lateral (
    select
      count(*)::integer as data_scope_total,
      count(*) filter (
        where scope.status in ('complete', 'unavailable', 'not_applicable')
      )::integer as data_scopes_complete,
      bool_or(scope.scope_code = 'debts' and scope.status = 'not_applicable') as debt_scope_not_applicable,
      bool_and(
        scope.status in ('complete', 'unavailable', 'not_applicable')
        and scope.last_verified_at is not null
        and scope.last_verified_at::date between coalesce(ar.as_of_date, current_date) - 45 and coalesce(ar.as_of_date, current_date) + 1
      ) as data_scopes_fresh
    from public.data_scope_definitions definition
    left join public.analysis_data_scopes scope
      on scope.analysis_run_id = ar.id and scope.scope_code = definition.code
    where definition.active
  ) xs on true
  left join lateral (
    select
      count(*) filter (where document_row.is_current_version)::integer as documents_total,
      count(*) filter (
        where document_row.is_current_version and document_row.document_type = 'management_report'
      )::integer as management_reports,
      count(distinct document_row.competence_date) filter (
        where document_row.is_current_version
          and document_row.document_type = 'management_report'
          and document_row.competence_date between coalesce(ar.as_of_date, current_date) - 245 and coalesce(ar.as_of_date, current_date)
          and document_row.first_pass_status = 'complete'
          and document_row.second_pass_status = 'complete'
      )::integer as management_unique_competencies,
      count(*) filter (
        where document_row.is_current_version and document_row.document_type = 'financial_statement'
      )::integer as financial_statements,
      count(distinct document_row.fiscal_year) filter (
        where document_row.is_current_version
          and document_row.document_type = 'financial_statement'
          and document_row.first_pass_status = 'complete'
          and document_row.second_pass_status = 'complete'
      )::integer as financial_statement_years,
      count(distinct document_row.fiscal_year) filter (
        where document_row.is_current_version
          and document_row.document_type = 'financial_statement'
          and document_row.includes_notes
          and document_row.includes_audit_opinion
          and document_row.first_pass_status = 'complete'
          and document_row.second_pass_status = 'complete'
      )::integer as audited_financial_years,
      count(*) filter (
        where document_row.is_current_version
          and document_row.document_type = 'audit_report'
          and document_row.first_pass_status = 'complete'
          and document_row.second_pass_status = 'complete'
      )::integer as audit_reports,
      count(*) filter (
        where document_row.is_current_version
          and document_row.document_type = 'regulation'
          and document_row.first_pass_status = 'complete'
          and document_row.second_pass_status = 'complete'
      )::integer as regulations,
      count(*) filter (
        where document_row.is_current_version and document_row.first_pass_status in ('complete', 'unavailable')
      )::integer as first_documents_complete,
      count(*) filter (
        where document_row.is_current_version and document_row.second_pass_status in ('complete', 'unavailable')
      )::integer as second_documents_complete,
      coalesce(sum(document_row.pages_total) filter (where document_row.is_current_version), 0)::integer as pages_total,
      coalesce(sum(document_row.first_pass_pages_reviewed) filter (where document_row.is_current_version), 0)::integer as first_pages_reviewed,
      coalesce(sum(document_row.second_pass_pages_reviewed) filter (where document_row.is_current_version), 0)::integer as second_pages_reviewed,
      bool_and(
        document_row.first_pass_status = 'unavailable'
        or (
          document_row.first_pass_status = 'complete'
          and nullif(btrim(document_row.source_url), '') is not null
          and document_row.pages_total is not null
          and document_row.first_pass_pages_reviewed = document_row.pages_total
        )
      ) filter (where document_row.is_current_version) as first_pages_ready,
      bool_and(
        document_row.second_pass_status = 'unavailable'
        or (
          document_row.second_pass_status = 'complete'
          and nullif(btrim(document_row.source_url), '') is not null
          and document_row.pages_total is not null
          and document_row.second_pass_pages_reviewed = document_row.pages_total
        )
      ) filter (where document_row.is_current_version) as second_pages_ready,
      bool_and(
        document_row.last_verified_at is not null
        and document_row.last_verified_at::date between coalesce(ar.as_of_date, current_date) - 180 and coalesce(ar.as_of_date, current_date) + 1
      ) filter (where document_row.is_current_version) as documents_fresh
    from public.source_documents document_row
    where document_row.analysis_run_id = ar.id
  ) d on true
  left join lateral (
    select
      count(*)::integer as distribution_count,
      count(*) filter (
        where distribution_row.classification <> 'unclassified'
          and distribution_row.recurring_amount_per_share is not null
          and nullif(btrim(distribution_row.classification_notes), '') is not null
          and nullif(btrim(distribution_row.source_url), '') is not null
          and distribution_row.last_verified_at is not null
      )::integer as classified_distribution_count,
      coalesce((max(distribution_row.reference_date) - min(distribution_row.reference_date)), 0)::integer as distribution_span_days,
      max(distribution_row.reference_date) as latest_distribution_date
    from public.cash_distributions distribution_row
    where distribution_row.instrument_id = i.id
      and (distribution_row.analysis_run_id is null or distribution_row.analysis_run_id = ar.id)
      and distribution_row.reference_date <= coalesce(ar.as_of_date, current_date)
  ) h on true
  left join lateral (
    select
      count(*)::integer as price_count,
      coalesce((max(price_row.price_date) - min(price_row.price_date)), 0)::integer as price_span_days,
      max(price_row.price_date) as latest_price_date
    from public.market_prices price_row
    where price_row.instrument_id = i.id
      and price_row.price_date <= coalesce(ar.as_of_date, current_date)
  ) p on true
  left join lateral (
    select
      (
        select count(distinct observation.metric_code)::integer
        from public.metric_observations observation
        where observation.instrument_id = i.id
          and (observation.analysis_run_id is null or observation.analysis_run_id = ar.id)
      ) as distinct_metric_count,
      count(*)::integer as required_metric_count,
      count(*) filter (
        where exists (
          select 1
          from public.metric_observations observation
          where observation.instrument_id = i.id
            and observation.metric_code = definition.code
            and (observation.analysis_run_id is null or observation.analysis_run_id = ar.id)
            and nullif(btrim(observation.source_url), '') is not null
            and observation.reference_date between coalesce(ar.as_of_date, current_date) - definition.max_age_days and coalesce(ar.as_of_date, current_date)
        )
      )::integer as verified_required_metric_count
    from public.metric_definitions definition
    where definition.required_for_completion
      and definition.asset_type = i.asset_type
      and (definition.segment_key is null or definition.segment_key = i.segment_key)
  ) m on true
  left join lateral (
    select
      (select count(*)::integer from public.fund_properties row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as property_count,
      (select count(*)::integer from public.fund_tenants row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as tenant_count,
      (select count(*)::integer from public.fund_leases row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as lease_count,
      (select count(*)::integer from public.debt_obligations row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as debt_count,
      (select count(distinct row_value.scenario_code)::integer from public.valuation_scenarios row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as valuation_scenario_count,
      (select count(*)::integer from public.valuation_assumptions row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as valuation_assumption_count,
      (select count(*)::integer from public.valuation_scenarios row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.counter_model_method), '') is not null and row_value.counter_model_value_per_share is not null) as counter_model_count,
      (select count(*)::integer from public.risk_register row_value where row_value.analysis_run_id = ar.id and nullif(btrim(row_value.source_url), '') is not null) as risk_count,
      (select count(distinct row_value.trigger_type)::integer from public.thesis_triggers row_value where row_value.analysis_run_id = ar.id) as thesis_trigger_type_count,
      exists (select 1 from public.thesis_triggers row_value where row_value.analysis_run_id = ar.id and row_value.trigger_type = 'positive') as has_positive_trigger,
      exists (select 1 from public.thesis_triggers row_value where row_value.analysis_run_id = ar.id and row_value.trigger_type = 'negative') as has_negative_trigger,
      exists (select 1 from public.thesis_triggers row_value where row_value.analysis_run_id = ar.id and row_value.trigger_type = 'falsifier') as has_falsifier_trigger
  ) z on true
  left join lateral (
    select exists (
      select 1
      from public.instrument_eligibility_reviews review
      where review.instrument_id = i.id
        and review.eligibility_status in ('confirmed_retail', 'probable_retail')
        and review.confidence in ('high', 'medium')
        and review.verification_date between coalesce(ar.as_of_date, current_date) - 180 and coalesce(ar.as_of_date, current_date)
        and nullif(btrim(review.market_source_url), '') is not null
        and nullif(btrim(review.regulator_source_url), '') is not null
    ) and i.eligible_retail as eligibility_ready
  ) e on true
)
select
  readiness_counts.*,
  (
    readiness_counts.eligibility_ready
    and readiness_counts.data_fresh
    and readiness_counts.section_total = 16
    and readiness_counts.first_sections_complete = readiness_counts.section_total
    and readiness_counts.second_sections_complete = readiness_counts.section_total
    and readiness_counts.criterion_total >= 80
    and readiness_counts.first_criteria_complete = readiness_counts.criterion_total
    and readiness_counts.second_criteria_complete = readiness_counts.criterion_total
    and readiness_counts.document_scope_total = 9
    and readiness_counts.document_scopes_complete = readiness_counts.document_scope_total
    and readiness_counts.data_scope_total = 8
    and readiness_counts.data_scopes_complete = readiness_counts.data_scope_total
    and (
      readiness_counts.documents_total = 0
      or (
        readiness_counts.first_documents_complete = readiness_counts.documents_total
        and readiness_counts.second_documents_complete = readiness_counts.documents_total
        and readiness_counts.first_pages_ready
        and readiness_counts.second_pages_ready
      )
    )
  ) as research_exhausted,
  (
    readiness_counts.eligibility_ready
    and readiness_counts.data_fresh
    and readiness_counts.section_total = 16
    and readiness_counts.first_sections_complete = readiness_counts.section_total
    and readiness_counts.second_sections_complete = readiness_counts.section_total
    and readiness_counts.criterion_total >= 80
    and readiness_counts.first_criteria_complete = readiness_counts.criterion_total
    and readiness_counts.second_criteria_complete = readiness_counts.criterion_total
    and readiness_counts.critical_unavailable_count = 0
    and readiness_counts.document_scope_total = 9
    and readiness_counts.document_scopes_complete = readiness_counts.document_scope_total
    and readiness_counts.data_scope_total = 8
    and readiness_counts.data_scopes_complete = readiness_counts.data_scope_total
    and readiness_counts.documents_total > 0
    and readiness_counts.first_documents_complete = readiness_counts.documents_total
    and readiness_counts.second_documents_complete = readiness_counts.documents_total
    and readiness_counts.first_pages_ready
    and readiness_counts.second_pages_ready
    and readiness_counts.management_unique_competencies >= 6
    and readiness_counts.audited_financial_years >= 3
    and readiness_counts.regulations >= 1
    and readiness_counts.distribution_count >= 36
    and readiness_counts.classified_distribution_count >= 36
    and readiness_counts.distribution_span_days >= 1035
    and readiness_counts.latest_distribution_date >= readiness_counts.as_of_date - 62
    and readiness_counts.price_count >= 750
    and readiness_counts.price_span_days >= 1090
    and readiness_counts.latest_price_date >= readiness_counts.as_of_date - 10
    and readiness_counts.required_metric_count >= 32
    and readiness_counts.verified_required_metric_count = readiness_counts.required_metric_count
    and readiness_counts.property_count > 0
    and readiness_counts.tenant_count > 0
    and readiness_counts.lease_count > 0
    and (readiness_counts.debt_count > 0 or readiness_counts.debt_scope_not_applicable)
    and readiness_counts.valuation_scenario_count = 3
    and readiness_counts.valuation_assumption_count >= 12
    and readiness_counts.counter_model_count >= 1
    and readiness_counts.risk_count >= 5
    and readiness_counts.thesis_trigger_type_count >= 3
    and readiness_counts.has_positive_trigger
    and readiness_counts.has_negative_trigger
    and readiness_counts.has_falsifier_trigger
  ) as completion_ready
from readiness_counts;

create or replace view public.v_universe_stats
with (security_invoker = true)
as
select
  count(*) filter (where asset_type = 'fii' and active)::integer as fii_registered,
  count(*) filter (
    where asset_type = 'fii' and active and eligible_retail
      and eligibility_status in ('confirmed_retail', 'probable_retail')
  )::integer as fii_retail_verified,
  count(*) filter (where asset_type = 'fii' and active and queue_position is not null)::integer as fii_queued,
  count(*) filter (where asset_type = 'fii' and active and universe_status = 'completed')::integer as fii_completed
from public.instruments;

drop view if exists public.v_analysis_queue;
create view public.v_analysis_queue
with (security_invoker = true)
as
select
  i.id as instrument_id,
  i.ticker,
  i.asset_type,
  i.name,
  i.sector,
  i.segment,
  i.segment_key,
  i.queue_position,
  i.eligible_retail,
  i.eligibility_status,
  i.eligibility_confidence,
  i.eligibility_source_url,
  i.eligibility_verified_at,
  i.universe_status,
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
  ar.balance_cash_score,
  ar.management_governance_score,
  ar.value_margin_score,
  ar.technical_liquidity_score,
  ar.weighted_score,
  ar.risk_score,
  ar.confidence_score,
  ar.action_new_money,
  ar.action_existing_holder,
  ar.current_price,
  ar.fair_value_low,
  ar.fair_value_base,
  ar.fair_value_high,
  ar.sustainable_income_per_share,
  ar.as_of_date,
  (ar.as_of_date is null or ar.as_of_date < current_date - 45) as is_stale,
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

alter table public.ranking_entries
  add column if not exists analysis_run_id bigint references public.analysis_runs(id) on delete restrict,
  add column if not exists balance_cash_score numeric(4,2),
  add column if not exists management_governance_score numeric(4,2),
  add column if not exists value_margin_score numeric(4,2),
  add column if not exists technical_liquidity_score numeric(4,2),
  add column if not exists risk_score numeric(4,2);

do $$
begin
  if exists (select 1 from public.ranking_entries where analysis_run_id is null) then
    raise exception 'SAFA: entradas de ranking antigas precisam ser vinculadas a uma analise antes da migracao v2';
  end if;
  alter table public.ranking_entries alter column analysis_run_id set not null;

  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_analysis_unique' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_analysis_unique unique (ranking_snapshot_id, analysis_run_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ranking_entries_v2_score_range' and conrelid = 'public.ranking_entries'::regclass) then
    alter table public.ranking_entries add constraint ranking_entries_v2_score_range check (
      balance_cash_score between 0 and 10
      and management_governance_score between 0 and 10
      and value_margin_score between 0 and 10
      and technical_liquidity_score between 0 and 10
      and risk_score between 0 and 10
    );
  end if;
end $$;

create index if not exists ranking_entries_analysis_run_idx on public.ranking_entries (analysis_run_id);

create or replace function safa_private.validate_ranking_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  run_row public.analysis_runs%rowtype;
  snapshot_row public.ranking_snapshots%rowtype;
  is_ready boolean := false;
begin
  select * into run_row from public.analysis_runs where id = new.analysis_run_id;
  if not found then
    raise exception 'SAFA: analise vinculada ao ranking nao existe';
  end if;

  select * into snapshot_row from public.ranking_snapshots where id = new.ranking_snapshot_id;
  if not found then
    raise exception 'SAFA: snapshot de ranking nao existe';
  end if;

  select readiness.completion_ready into is_ready
  from public.v_analysis_readiness readiness
  where readiness.analysis_run_id = run_row.id;

  if run_row.status <> 'completed' or not coalesce(is_ready, false) then
    raise exception 'SAFA: somente analise Deep Max integralmente concluida entra no ranking';
  end if;
  if snapshot_row.methodology_version <> run_row.methodology_version then
    raise exception 'SAFA: metodologia da analise diverge do snapshot';
  end if;
  if run_row.as_of_date is null or abs(snapshot_row.cutoff_date - run_row.as_of_date) > 7 then
    raise exception 'SAFA: data-base da analise esta fora da janela de sete dias do ranking';
  end if;

  new.instrument_id := run_row.instrument_id;
  new.final_score := run_row.weighted_score * 10;
  new.quality_score := run_row.quality_score;
  new.opportunity_score := run_row.opportunity_score;
  new.income_score := run_row.income_score;
  new.safety_score := run_row.safety_score;
  new.balance_cash_score := run_row.balance_cash_score;
  new.management_governance_score := run_row.management_governance_score;
  new.value_margin_score := run_row.value_margin_score;
  new.technical_liquidity_score := run_row.technical_liquidity_score;
  new.risk_score := run_row.risk_score;
  new.confidence_score := run_row.confidence_score;
  new.verdict := run_row.verdict;
  return new;
end;
$$;

drop trigger if exists validate_ranking_entry on public.ranking_entries;
create trigger validate_ranking_entry
before insert or update on public.ranking_entries
for each row execute function safa_private.validate_ranking_entry();

drop view if exists public.v_current_ranking;
create view public.v_current_ranking
with (security_invoker = true)
as
select
  rs.id as snapshot_id,
  rs.cutoff_date,
  rs.methodology_version,
  rs.universe_size,
  re.analysis_run_id,
  re.rank_overall,
  re.rank_segment,
  i.ticker,
  i.asset_type,
  i.segment,
  i.segment_key,
  re.final_score,
  re.quality_score,
  re.opportunity_score,
  re.income_score,
  re.safety_score,
  re.balance_cash_score,
  re.management_governance_score,
  re.value_margin_score,
  re.technical_liquidity_score,
  re.risk_score,
  re.confidence_score,
  re.verdict,
  re.rationale
from public.ranking_snapshots rs
join public.ranking_entries re on re.ranking_snapshot_id = rs.id
join public.instruments i on i.id = re.instrument_id
where rs.is_current;

create or replace function safa_private.validate_analysis_run_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_complete boolean := false;
  is_exhausted boolean := false;
  critical_missing integer := 0;
  has_any_score boolean;
begin
  if num_nonnulls(
    new.income_score,
    new.quality_score,
    new.balance_cash_score,
    new.management_governance_score,
    new.value_margin_score,
    new.technical_liquidity_score
  ) = 6 then
    new.weighted_score := round((
      new.income_score * 0.25
      + new.quality_score * 0.20
      + new.balance_cash_score * 0.20
      + new.management_governance_score * 0.15
      + new.value_margin_score * 0.15
      + new.technical_liquidity_score * 0.05
    )::numeric, 2);
  else
    new.weighted_score := null;
  end if;

  select readiness.completion_ready, readiness.research_exhausted, readiness.critical_unavailable_count
    into is_complete, is_exhausted, critical_missing
  from public.v_analysis_readiness readiness
  where readiness.analysis_run_id = new.id;

  has_any_score := num_nonnulls(
    new.quality_score,
    new.opportunity_score,
    new.income_score,
    new.safety_score,
    new.balance_cash_score,
    new.management_governance_score,
    new.value_margin_score,
    new.technical_liquidity_score,
    new.weighted_score,
    new.risk_score,
    new.confidence_score
  ) > 0;

  if has_any_score and not coalesce(is_complete, false) then
    raise exception 'SAFA: nenhuma nota pode ser registrada antes da cobertura Deep Max integral';
  end if;

  if (
    new.verdict is not null
    or new.action_new_money is not null
    or new.action_existing_holder is not null
  ) and not coalesce(is_exhausted, false) then
    raise exception 'SAFA: veredito e acoes permanecem bloqueados ate o esgotamento verificavel da pesquisa';
  end if;

  if (
    (new.verdict is not null and new.verdict <> 'insufficient_data')
    or (new.action_new_money is not null and new.action_new_money <> 'insufficient_data')
    or (new.action_existing_holder is not null and new.action_existing_holder <> 'insufficient_data')
  ) and not coalesce(is_complete, false) then
    raise exception 'SAFA: somente dados completos liberam classificacao e acao de investimento';
  end if;

  if coalesce(critical_missing, 0) > 0 and new.verdict is not null and new.verdict <> 'insufficient_data' then
    raise exception 'SAFA: criterio essencial indisponivel exige veredito dados insuficientes';
  end if;

  if new.status = 'completed' then
    if not coalesce(is_exhausted, false) then
      raise exception 'SAFA: a analise nao esgotou todas as etapas Deep Max';
    end if;

    if coalesce(is_complete, false) then
      if (
        new.verdict is null
        or new.verdict = 'insufficient_data'
        or nullif(btrim(new.verdict_summary), '') is null
        or nullif(btrim(new.thesis), '') is null
        or nullif(btrim(new.contrary_case), '') is null
        or new.quality_score is null
        or new.opportunity_score is null
        or new.income_score is null
        or new.safety_score is null
        or new.balance_cash_score is null
        or new.management_governance_score is null
        or new.value_margin_score is null
        or new.technical_liquidity_score is null
        or new.weighted_score is null
        or new.risk_score is null
        or new.confidence_score is null
        or new.current_price is null
        or new.fair_value_low is null
        or new.fair_value_base is null
        or new.fair_value_high is null
        or new.sustainable_income_per_share is null
        or new.as_of_date is null
        or new.action_new_money is null
        or new.action_existing_holder is null
      ) then
        raise exception 'SAFA: conclusao completa exige tese, seis dimensoes, risco, confianca, renda, valuation e duas acoes';
      end if;
    else
      if (
        new.verdict <> 'insufficient_data'
        or new.action_new_money <> 'insufficient_data'
        or new.action_existing_holder <> 'insufficient_data'
        or nullif(btrim(new.verdict_summary), '') is null
        or nullif(btrim(new.thesis), '') is null
        or nullif(btrim(new.contrary_case), '') is null
        or new.as_of_date is null
        or has_any_score
      ) then
        raise exception 'SAFA: pesquisa esgotada com lacunas so pode concluir sem notas e como dados insuficientes';
      end if;
    end if;

    new.coverage_pct := 100;
    new.concluded_at := coalesce(new.concluded_at, now());
  else
    new.concluded_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_analysis_run_completion on public.analysis_runs;
create trigger validate_analysis_run_completion
before insert or update on public.analysis_runs
for each row execute function safa_private.validate_analysis_run_completion();

create or replace function safa_private.sync_instrument_universe_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.instruments
  set universe_status = case
      when new.status = 'completed' then 'completed'
      when new.status in ('research', 'first_review', 'second_review') then 'analyzing'
      when queue_position is not null then 'queued'
      else universe_status
    end,
    updated_at = now()
  where id = new.instrument_id;
  return new;
end;
$$;

drop trigger if exists sync_instrument_universe_status on public.analysis_runs;
create trigger sync_instrument_universe_status
after insert or update of status on public.analysis_runs
for each row execute function safa_private.sync_instrument_universe_status();

alter table public.methodology_weight_sets enable row level security;
alter table public.methodology_weights enable row level security;
alter table public.methodology_criteria enable row level security;
alter table public.analysis_criterion_reviews enable row level security;
alter table public.document_scope_definitions enable row level security;
alter table public.analysis_document_scopes enable row level security;
alter table public.data_scope_definitions enable row level security;
alter table public.analysis_data_scopes enable row level security;
alter table public.instrument_eligibility_reviews enable row level security;
alter table public.fund_properties enable row level security;
alter table public.fund_tenants enable row level security;
alter table public.fund_leases enable row level security;
alter table public.debt_obligations enable row level security;
alter table public.valuation_scenarios enable row level security;
alter table public.valuation_assumptions enable row level security;
alter table public.risk_register enable row level security;
alter table public.thesis_triggers enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'methodology_weight_sets', 'methodology_weights', 'methodology_criteria',
    'analysis_criterion_reviews', 'document_scope_definitions', 'analysis_document_scopes',
    'data_scope_definitions', 'analysis_data_scopes', 'instrument_eligibility_reviews',
    'fund_properties', 'fund_tenants', 'fund_leases', 'debt_obligations',
    'valuation_scenarios', 'valuation_assumptions', 'risk_register', 'thesis_triggers'
  ]
  loop
    execute format('drop policy if exists safa_public_read on public.%I', table_name);
    execute format('create policy safa_public_read on public.%I for select to anon, authenticated using (true)', table_name);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on
  public.instruments, public.analysis_runs, public.analysis_sections, public.source_documents,
  public.metric_definitions, public.metric_observations, public.cash_distributions,
  public.market_prices, public.material_events, public.ranking_snapshots, public.ranking_entries,
  public.methodology_weight_sets, public.methodology_weights, public.methodology_criteria,
  public.analysis_criterion_reviews, public.document_scope_definitions, public.analysis_document_scopes,
  public.data_scope_definitions, public.analysis_data_scopes, public.instrument_eligibility_reviews,
  public.fund_properties, public.fund_tenants, public.fund_leases, public.debt_obligations,
  public.valuation_scenarios, public.valuation_assumptions, public.risk_register, public.thesis_triggers,
  public.v_analysis_queue, public.v_current_ranking, public.v_analysis_readiness, public.v_universe_stats
to anon, authenticated;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

notify pgrst, 'reload schema';
commit;
