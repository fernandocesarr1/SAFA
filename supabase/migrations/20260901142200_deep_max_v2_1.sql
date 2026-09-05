begin;

update public.methodology_weight_sets set is_active = false where is_active;

insert into public.methodology_weight_sets (version, label, is_active, effective_from, description)
values (
  'deep-max-v2.1',
  'Deep Max v2.1 — dois relatórios, escopo integral',
  true,
  date '2026-09-01',
  'Mantém os 16 blocos, 80 critérios, três exercícios auditados, 36 distribuições, séries históricas e dupla revisão; reduz apenas os relatórios gerenciais obrigatórios de seis para dois.'
)
on conflict (version) do update set
  label = excluded.label,
  is_active = excluded.is_active,
  effective_from = excluded.effective_from,
  description = excluded.description;

insert into public.methodology_weights (methodology_version, dimension_code, label, weight, display_order)
select 'deep-max-v2.1', dimension_code, label, weight, display_order
from public.methodology_weights
where methodology_version = 'deep-max-v2'
on conflict (methodology_version, dimension_code) do update set
  label = excluded.label, weight = excluded.weight, display_order = excluded.display_order;

update public.methodology_criteria
set title = 'Dois relatorios gerenciais mais recentes, sem amostragem de paginas'
where code = 'documentary.1';

update public.analysis_runs
set methodology_version = 'deep-max-v2.1', updated_at = now()
where methodology_version = 'deep-max-v2';

do $$
declare view_sql text;
begin
  select pg_get_viewdef('public.v_analysis_readiness'::regclass, true) into view_sql;
  view_sql := replace(view_sql, 'management_unique_competencies >= 6', 'management_unique_competencies >= 2');
  if position('management_unique_competencies >= 6' in view_sql) > 0
     or position('management_unique_competencies >= 2' in view_sql) = 0 then
    raise exception 'SAFA: não foi possível versionar a trava de relatórios gerenciais';
  end if;
  execute 'create or replace view public.v_analysis_readiness as ' || view_sql;
end $$;

commit;