-- SAFA Deep Max v2.1: mantém o escopo integral e reduz apenas os relatórios
-- gerenciais obrigatórios de seis para os dois mais recentes.
begin;

update public.methodology_weight_sets set is_active = false where is_active;

insert into public.methodology_weight_sets (version, label, is_active, effective_from, description)
values (
  'deep-max-v2.1',
  'Deep Max v2.1 — dois relatórios gerenciais',
  true,
  date '2026-09-01',
  'Dupla leitura integral; dois relatórios gerenciais mais recentes; demais fontes e testes preservados.'
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
  label = excluded.label,
  weight = excluded.weight,
  display_order = excluded.display_order;

update public.methodology_criteria
set title = 'Dois relatórios gerenciais mais recentes, sem amostragem de páginas'
where section_code = 'documentary'
  and title = 'Seis relatórios gerenciais mais recentes, sem amostragem de páginas';

update public.analysis_runs
set methodology_version = 'deep-max-v2.1', updated_at = now()
where methodology_version = 'deep-max-v2';

do $$
declare
  definition text;
begin
  select pg_get_viewdef('public.v_analysis_readiness'::regclass, true) into definition;
  definition := replace(definition, 'management_unique_competencies >= 6', 'management_unique_competencies >= 2');
  execute 'create or replace view public.v_analysis_readiness as ' || definition;
end $$;

commit;
