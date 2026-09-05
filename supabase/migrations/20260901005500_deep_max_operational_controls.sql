-- Duas passagens independentes. Os campos originais permanecem como síntese final
-- para preservar compatibilidade com a primeira versão do SAFA.
alter table public.analysis_sections
  add column if not exists first_pass_narrative text,
  add column if not exists second_pass_narrative text,
  add column if not exists first_pass_findings jsonb not null default '[]'::jsonb,
  add column if not exists second_pass_findings jsonb not null default '[]'::jsonb,
  add column if not exists first_pass_open_questions jsonb not null default '[]'::jsonb,
  add column if not exists second_pass_open_questions jsonb not null default '[]'::jsonb,
  add column if not exists second_pass_omissions jsonb not null default '[]'::jsonb,
  add column if not exists last_verified_at timestamptz;

alter table public.source_documents
  add column if not exists first_pass_pages_reviewed integer not null default 0,
  add column if not exists second_pass_pages_reviewed integer not null default 0,
  add column if not exists first_pass_status text not null default 'pending',
  add column if not exists second_pass_status text not null default 'pending',
  add column if not exists first_pass_findings jsonb not null default '[]'::jsonb,
  add column if not exists second_pass_findings jsonb not null default '[]'::jsonb,
  add column if not exists last_verified_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_findings_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_findings_array check (jsonb_typeof(first_pass_findings) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_findings_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_findings_array check (jsonb_typeof(second_pass_findings) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_first_questions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_first_questions_array check (jsonb_typeof(first_pass_open_questions) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_second_questions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_second_questions_array check (jsonb_typeof(second_pass_open_questions) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_sections_omissions_array' and conrelid = 'public.analysis_sections'::regclass) then
    alter table public.analysis_sections add constraint analysis_sections_omissions_array check (jsonb_typeof(second_pass_omissions) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_first_status' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_first_status check (first_pass_status in ('pending', 'reading', 'complete', 'blocked', 'unavailable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_second_status' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_second_status check (second_pass_status in ('pending', 'reading', 'complete', 'blocked', 'unavailable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_pass_pages_valid' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_pass_pages_valid check (
      first_pass_pages_reviewed >= 0
      and second_pass_pages_reviewed >= 0
      and (
        pages_total is null
        or (
          first_pass_pages_reviewed <= pages_total
          and second_pass_pages_reviewed <= pages_total
        )
      )
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_first_findings_array' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_first_findings_array check (jsonb_typeof(first_pass_findings) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'source_documents_second_findings_array' and conrelid = 'public.source_documents'::regclass) then
    alter table public.source_documents add constraint source_documents_second_findings_array check (jsonb_typeof(second_pass_findings) = 'array');
  end if;
end $$;

create or replace view public.v_analysis_readiness
with (security_invoker = true)
as
select
  ar.id as analysis_run_id,
  i.id as instrument_id,
  i.ticker,
  coalesce(s.section_total, 0) as section_total,
  coalesce(s.first_sections_complete, 0) as first_sections_complete,
  coalesce(s.second_sections_complete, 0) as second_sections_complete,
  coalesce(d.documents_total, 0) as documents_total,
  coalesce(d.management_reports, 0) as management_reports,
  coalesce(d.financial_statements, 0) as financial_statements,
  coalesce(d.audit_reports, 0) as audit_reports,
  coalesce(d.regulations, 0) as regulations,
  coalesce(d.first_documents_complete, 0) as first_documents_complete,
  coalesce(d.second_documents_complete, 0) as second_documents_complete,
  coalesce(d.pages_total, 0) as pages_total,
  coalesce(d.first_pages_reviewed, 0) as first_pages_reviewed,
  coalesce(d.second_pages_reviewed, 0) as second_pages_reviewed,
  coalesce(h.distribution_count, 0) as distribution_count,
  coalesce(p.price_count, 0) as price_count,
  coalesce(m.distinct_metric_count, 0) as distinct_metric_count,
  (
    coalesce(s.section_total, 0) = 16
    and coalesce(s.first_sections_complete, 0) = 16
    and coalesce(s.second_sections_complete, 0) = 16
    and coalesce(d.management_reports, 0) >= 6
    and coalesce(d.financial_statements, 0) >= 1
    and coalesce(d.audit_reports, 0) >= 1
    and coalesce(d.regulations, 0) >= 1
    and coalesce(d.documents_total, 0) > 0
    and coalesce(d.first_documents_complete, 0) = coalesce(d.documents_total, 0)
    and coalesce(d.second_documents_complete, 0) = coalesce(d.documents_total, 0)
    and coalesce(d.first_pages_ready, false)
    and coalesce(d.second_pages_ready, false)
    and (i.asset_type <> 'fii' or coalesce(h.distribution_count, 0) >= 36)
    and (i.asset_type <> 'fii' or coalesce(p.price_count, 0) >= 500)
    and coalesce(m.distinct_metric_count, 0) >= 8
  ) as completion_ready
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
    count(*)::integer as documents_total,
    count(*) filter (where document_type = 'management_report')::integer as management_reports,
    count(*) filter (where document_type = 'financial_statement')::integer as financial_statements,
    count(*) filter (where document_type = 'audit_report')::integer as audit_reports,
    count(*) filter (where document_type = 'regulation')::integer as regulations,
    count(*) filter (where first_pass_status in ('complete', 'unavailable'))::integer as first_documents_complete,
    count(*) filter (where second_pass_status in ('complete', 'unavailable'))::integer as second_documents_complete,
    coalesce(sum(pages_total), 0)::integer as pages_total,
    coalesce(sum(first_pass_pages_reviewed), 0)::integer as first_pages_reviewed,
    coalesce(sum(second_pass_pages_reviewed), 0)::integer as second_pages_reviewed,
    bool_and(
      first_pass_status = 'unavailable'
      or (
        first_pass_status = 'complete'
        and source_url is not null
        and pages_total is not null
        and first_pass_pages_reviewed = pages_total
      )
    ) as first_pages_ready,
    bool_and(
      second_pass_status = 'unavailable'
      or (
        second_pass_status = 'complete'
        and source_url is not null
        and pages_total is not null
        and second_pass_pages_reviewed = pages_total
      )
    ) as second_pages_ready
  from public.source_documents document_row
  where document_row.analysis_run_id = ar.id
) d on true
left join lateral (
  select count(*)::integer as distribution_count
  from public.cash_distributions distribution_row
  where distribution_row.instrument_id = i.id
) h on true
left join lateral (
  select count(*)::integer as price_count
  from public.market_prices price_row
  where price_row.instrument_id = i.id
) p on true
left join lateral (
  select count(distinct metric_code)::integer as distinct_metric_count
  from public.metric_observations metric_row
  where metric_row.instrument_id = i.id
    and (metric_row.analysis_run_id is null or metric_row.analysis_run_id = ar.id)
) m on true;

create schema if not exists safa_private;
revoke all on schema safa_private from public, anon, authenticated;

create or replace function safa_private.validate_analysis_run_completion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  is_ready boolean := false;
begin
  select readiness.completion_ready
  into is_ready
  from public.v_analysis_readiness readiness
  where readiness.analysis_run_id = new.id;

  if (
    new.verdict is not null
    or new.quality_score is not null
    or new.opportunity_score is not null
    or new.income_score is not null
    or new.safety_score is not null
    or new.risk_score is not null
    or new.confidence_score is not null
  ) and not coalesce(is_ready, false) then
    raise exception 'SAFA: notas e veredito permanecem bloqueados até a conclusão integral das duas passagens';
  end if;

  if new.status = 'completed' then
    if not coalesce(is_ready, false) then
      raise exception 'SAFA: a análise não satisfaz os bloqueios Deep Max';
    end if;
    if (
      new.verdict is null
      or nullif(btrim(new.verdict_summary), '') is null
      or nullif(btrim(new.thesis), '') is null
      or nullif(btrim(new.contrary_case), '') is null
      or new.quality_score is null
      or new.opportunity_score is null
      or new.income_score is null
      or new.safety_score is null
      or new.risk_score is null
      or new.confidence_score is null
      or new.current_price is null
      or new.fair_value_low is null
      or new.fair_value_base is null
      or new.fair_value_high is null
      or new.sustainable_income_per_share is null
      or new.as_of_date is null
    ) then
      raise exception 'SAFA: conclusão incompleta; preencha tese, caso contrário, notas, renda e valuation';
    end if;
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



grant select on public.v_analysis_readiness to anon, authenticated;
notify pgrst, 'reload schema';
