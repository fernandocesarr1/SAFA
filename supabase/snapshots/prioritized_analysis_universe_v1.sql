-- SAFA — universo inicial de análise v1
-- Contém somente tickers e ordem de pesquisa; não armazena dados de carteira.

begin;

alter table public.instruments
  add column if not exists analysis_profile text not null default 'unclassified',
  add column if not exists analysis_profile_status text not null default 'pending_verification',
  add column if not exists analysis_profile_source_url text,
  add column if not exists analysis_profile_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'instruments_analysis_profile'
      and conrelid = 'public.instruments'::regclass
  ) then
    alter table public.instruments add constraint instruments_analysis_profile check (
      analysis_profile in (
        'unclassified', 'brick_fii', 'receivables_fii', 'hybrid_fii',
        'fof_fii', 'development_fii', 'fiagro', 'infrastructure_fund'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'instruments_analysis_profile_status'
      and conrelid = 'public.instruments'::regclass
  ) then
    alter table public.instruments add constraint instruments_analysis_profile_status check (
      analysis_profile_status in ('pending_verification', 'verified', 'inapplicable')
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'instruments_analysis_profile_verified_semantics'
      and conrelid = 'public.instruments'::regclass
  ) then
    alter table public.instruments add constraint instruments_analysis_profile_verified_semantics check (
      analysis_profile_status <> 'verified'
      or (
        analysis_profile <> 'unclassified'
        and nullif(btrim(analysis_profile_source_url), '') is not null
        and analysis_profile_verified_at is not null
      )
    );
  end if;
end $$;

with desired_queue(ticker, queue_position) as (
  values
    ('TRXF11', 1), ('GGRC11', 2), ('RBRY11', 3), ('MXRF11', 4),
    ('AAZQ11', 5), ('SNEL11', 6), ('GARE11', 7), ('KNSC11', 8),
    ('CPSH11', 9), ('HGCR11', 10), ('BRCR11', 11), ('NSLU11', 12),
    ('RBVA11', 13), ('TGAR11', 14), ('HGLG11', 15), ('BTLG11', 16),
    ('HSML11', 17), ('XPML11', 18), ('LVBI11', 19), ('FATN11', 20),
    ('ALZR11', 21), ('VILG11', 22)
)
insert into public.instruments (
  ticker, asset_type, eligible_retail, queue_position, active,
  eligibility_status, eligibility_confidence, universe_status,
  analysis_profile, analysis_profile_status
)
select
  desired_queue.ticker, 'fii', false, desired_queue.queue_position, true,
  'unverified', 'low', 'queued', 'unclassified', 'pending_verification'
from desired_queue
on conflict (ticker) do update set
  queue_position = excluded.queue_position,
  active = true,
  updated_at = now();

insert into public.analysis_runs (
  instrument_id, version, methodology_version, status
)
select instrument.id, 1, 'deep-max-v2', 'backlog'
from public.instruments instrument
where instrument.ticker in (
  'TRXF11', 'GGRC11', 'RBRY11', 'MXRF11', 'AAZQ11', 'SNEL11', 'GARE11',
  'KNSC11', 'CPSH11', 'HGCR11', 'BRCR11', 'NSLU11', 'RBVA11', 'TGAR11'
)
and not exists (
  select 1 from public.analysis_runs run where run.instrument_id = instrument.id
);

with section_templates(section_code, title) as (
  values
    ('identity', 'Identidade, estratégia e histórico'),
    ('documentary', 'Leitura documental integral'),
    ('portfolio', 'Imóveis e composição patrimonial'),
    ('tenants_contracts', 'Inquilinos e contratos'),
    ('operations', 'Operação e indicadores do segmento'),
    ('financials', 'Resultado, caixa e balanço'),
    ('income', 'Renda recorrente e distribuições'),
    ('debt', 'Dívidas e compromissos'),
    ('management', 'Gestão e alocação de capital'),
    ('governance', 'Governança e conflitos'),
    ('valuation', 'Valuation e margem de segurança'),
    ('scenarios', 'Cenários pessimista, base e otimista'),
    ('risks', 'Riscos e testes de estresse'),
    ('catalysts', 'Catalisadores e gatilhos'),
    ('technical', 'Preço, gráficos e pontos técnicos'),
    ('critical_review', 'Segunda revisão crítica')
)
insert into public.analysis_sections (analysis_run_id, section_code, title)
select run.id, template.section_code, template.title
from public.analysis_runs run
join public.instruments instrument on instrument.id = run.instrument_id
cross join section_templates template
where instrument.ticker in (
  'TRXF11', 'GGRC11', 'RBRY11', 'MXRF11', 'AAZQ11', 'SNEL11', 'GARE11',
  'KNSC11', 'CPSH11', 'HGCR11', 'BRCR11', 'NSLU11', 'RBVA11', 'TGAR11'
)
on conflict (analysis_run_id, section_code) do nothing;

create or replace function safa_private.validate_analysis_profile()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile_ready boolean := false;
begin
  select
    instrument.analysis_profile_status = 'verified'
    and instrument.analysis_profile <> 'unclassified'
  into profile_ready
  from public.instruments instrument
  where instrument.id = new.instrument_id;

  if (
    new.status = 'completed'
    or new.verdict is not null
    or new.action_new_money is not null
    or new.action_existing_holder is not null
    or num_nonnulls(
      new.quality_score, new.opportunity_score, new.income_score, new.safety_score,
      new.balance_cash_score, new.management_governance_score,
      new.value_margin_score, new.technical_liquidity_score,
      new.weighted_score, new.risk_score, new.confidence_score
    ) > 0
  ) and not coalesce(profile_ready, false) then
    raise exception 'SAFA: perfil metodologico precisa ser verificado antes de notas, veredito ou conclusao';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_analysis_profile on public.analysis_runs;
create trigger validate_analysis_profile
before insert or update on public.analysis_runs
for each row execute function safa_private.validate_analysis_profile();

drop view if exists public.v_analysis_queue;
create view public.v_analysis_queue
with (security_invoker = true)
as
select
  instrument.id as instrument_id,
  instrument.ticker,
  instrument.asset_type,
  instrument.name,
  instrument.sector,
  instrument.segment,
  instrument.segment_key,
  instrument.queue_position,
  instrument.eligible_retail,
  instrument.eligibility_status,
  instrument.eligibility_confidence,
  instrument.eligibility_source_url,
  instrument.eligibility_verified_at,
  instrument.universe_status,
  instrument.analysis_profile,
  instrument.analysis_profile_status,
  instrument.analysis_profile_source_url,
  instrument.analysis_profile_verified_at,
  run.id as analysis_run_id,
  run.version,
  run.methodology_version,
  run.status,
  run.coverage_pct,
  run.verdict,
  run.verdict_summary,
  run.quality_score,
  run.opportunity_score,
  run.income_score,
  run.safety_score,
  run.balance_cash_score,
  run.management_governance_score,
  run.value_margin_score,
  run.technical_liquidity_score,
  run.weighted_score,
  run.risk_score,
  run.confidence_score,
  run.action_new_money,
  run.action_existing_holder,
  run.current_price,
  run.fair_value_low,
  run.fair_value_base,
  run.fair_value_high,
  run.sustainable_income_per_share,
  run.as_of_date,
  (run.as_of_date is null or run.as_of_date < current_date - 45) as is_stale,
  run.updated_at
from public.instruments instrument
left join lateral (
  select candidate.*
  from public.analysis_runs candidate
  where candidate.instrument_id = instrument.id
  order by candidate.version desc
  limit 1
) run on true
where instrument.active;

create or replace view public.v_universe_stats
with (security_invoker = true)
as
select
  count(*) filter (where instrument.asset_type = 'fii' and instrument.active)::integer as fii_registered,
  count(*) filter (
    where instrument.asset_type = 'fii' and instrument.active and instrument.eligible_retail
      and instrument.eligibility_status in ('confirmed_retail', 'probable_retail')
  )::integer as fii_retail_verified,
  count(*) filter (
    where instrument.asset_type = 'fii' and instrument.active and instrument.queue_position is not null
  )::integer as fii_queued,
  count(*) filter (
    where instrument.asset_type = 'fii' and instrument.active and instrument.universe_status = 'completed'
  )::integer as fii_completed
from public.instruments instrument;

grant select on public.v_analysis_queue, public.v_universe_stats
to anon, authenticated;

notify pgrst, 'reload schema';
commit;
