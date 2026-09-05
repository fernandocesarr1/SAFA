-- SAFA — triagem quantitativa do universo
--
-- PROPOSTA. Não aplicada. Depende de 01_lotes_importacao.sql.
--
-- Ataca o problema estrutural: o Deep Max é artesanal e não escala para o
-- mercado inteiro. A triagem roda sobre dado coletado, sem leitura documental,
-- e serve só para ORDENAR quem merece Deep Max. Ela não emite veredito — §14
-- mantém a metodologia como fonte única disso.
--
-- O núcleo é a decomposição ln(P1/P0) = ln(R1/R0) − ln(Y1/Y0), que separa queda
-- puxada por renda (o fundo piorou) de queda puxada por yield (o mercado passou
-- a exigir mais pelo mesmo fluxo). Cada rodada guarda as entradas, para que o
-- número seja refazível.

begin;

create table if not exists public.screening_snapshots (
  id bigint generated always as identity primary key,
  run_at timestamptz not null default now(),
  -- janela em dias sobre a qual a variação foi medida
  window_days integer not null,
  -- âncora do yield exigido, com fonte (D9)
  ntnb_yield numeric(8,6),
  ntnb_source_url text,
  -- versões que produziram os números, para comparabilidade (§14)
  parser_version text not null,
  screening_version text not null,
  notes text
);

create table if not exists public.screening_results (
  id bigint generated always as identity primary key,
  snapshot_id bigint not null references public.screening_snapshots (id) on delete cascade,
  instrument_id bigint not null references public.instruments (id),

  -- entradas do cálculo, guardadas para reprodução (§11.2)
  price_start numeric(18,2) not null,
  price_end numeric(18,2) not null,
  income_start numeric(18,8) not null,
  income_end numeric(18,8) not null,

  -- decomposição
  var_price_log numeric(12,8) not null,
  contrib_income_log numeric(12,8) not null,
  contrib_yield_log numeric(12,8) not null,
  yield_fraction numeric(6,4),

  classification text not null,
  priority numeric(10,2) not null default 0,
  signal_coverage numeric(5,4) not null,
  signals jsonb not null default '[]'::jsonb,
  justification text not null,

  -- linhagem: de que lote vieram preço e renda
  price_batch_id bigint references public.import_batches (id),
  income_batch_id bigint references public.import_batches (id),

  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'screening_results_classification_valid') then
    alter table public.screening_results add constraint screening_results_classification_valid
      check (classification in (
        'candidato_desconto', 'queda_com_fundamento', 'sem_queda', 'dados_insuficientes'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'screening_results_prices_positive') then
    alter table public.screening_results add constraint screening_results_prices_positive
      check (price_start > 0 and price_end > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'screening_results_coverage_range') then
    alter table public.screening_results add constraint screening_results_coverage_range
      check (signal_coverage >= 0 and signal_coverage <= 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'screening_results_signals_array') then
    alter table public.screening_results add constraint screening_results_signals_array
      check (jsonb_typeof(signals) = 'array');
  end if;
  -- só candidato tem prioridade; o resto é zero por construção
  if not exists (select 1 from pg_constraint where conname = 'screening_results_priority_semantics') then
    alter table public.screening_results add constraint screening_results_priority_semantics
      check (priority = 0 or classification = 'candidato_desconto');
  end if;
  -- a decomposição é identidade: tem que fechar
  if not exists (select 1 from pg_constraint where conname = 'screening_results_decomposition_closes') then
    alter table public.screening_results add constraint screening_results_decomposition_closes
      check (abs(var_price_log - (contrib_income_log + contrib_yield_log)) < 0.000001);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'screening_results_unique_per_snapshot') then
    alter table public.screening_results add constraint screening_results_unique_per_snapshot
      unique (snapshot_id, instrument_id);
  end if;
end $$;

create index if not exists screening_results_fila_idx
  on public.screening_results (snapshot_id, priority desc)
  where classification = 'candidato_desconto';

create index if not exists screening_results_instrument_idx
  on public.screening_results (instrument_id, created_at desc);

-- A fila de trabalho: candidatos da rodada mais recente, do mais prioritário
-- ao menos. É esta view que diz quem entra no Deep Max primeiro.
create or replace view public.v_fila_deep_max
with (security_invoker = true)
as
select
  r.instrument_id,
  i.ticker,
  i.segment_key,
  r.priority,
  r.classification,
  r.justification,
  r.signal_coverage,
  r.signals,
  r.price_start,
  r.price_end,
  r.yield_fraction,
  s.run_at,
  s.window_days,
  run.id as analysis_run_id,
  run.status as analysis_status
from public.screening_results r
join public.instruments i on i.id = r.instrument_id
join public.screening_snapshots s on s.id = r.snapshot_id
left join lateral (
  select candidate.id, candidate.status
  from public.analysis_runs candidate
  where candidate.instrument_id = r.instrument_id
  order by candidate.version desc
  limit 1
) run on true
where r.classification = 'candidato_desconto'
  and s.id = (select max(id) from public.screening_snapshots)
order by r.priority desc;

alter table public.screening_snapshots enable row level security;
alter table public.screening_results enable row level security;

drop policy if exists safa_public_read on public.screening_snapshots;
create policy safa_public_read on public.screening_snapshots
  as permissive for select to anon, authenticated using (true);

drop policy if exists safa_public_read on public.screening_results;
create policy safa_public_read on public.screening_results
  as permissive for select to anon, authenticated using (true);

grant select on public.screening_snapshots, public.screening_results to anon, authenticated;
grant select on public.v_fila_deep_max to anon, authenticated;

notify pgrst, 'reload schema';
commit;
