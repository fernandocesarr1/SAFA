-- SAFA — qualitative_final_report_v1: SQL aplicado FORA do livro-razão
--
-- NATUREZA DESTE ARQUIVO
--
-- Não é migration. Nunca passou por apply_migration e não tem entrada em
-- supabase_migrations.schema_migrations — nenhuma das seis migrations do
-- livro-razão sequer menciona "final_report". Nenhuma linha foi inserida lá
-- para representá-lo: forjar essa entrada falsificaria o registro que esta
-- reconciliação existe para consertar.
--
-- Os objetos estão vivos em produção: as quatro colunas em analysis_runs, a
-- função safa_private.validate_qualitative_final_report e o trigger
-- zz_validate_qualitative_final_report. Como não há texto registrado do que foi
-- efetivamente executado, isto é RECONSTRUÇÃO a partir do catálogo do banco
-- vivo, não cópia verificável por hash. O arquivo mais próximo do original está
-- em supabase/snapshots/qualitative_final_report_v1.sql, sem prova de que seja
-- idêntico ao aplicado.
--
-- POR QUE ELE ORDENA DEPOIS DAS SEIS MIGRATIONS
--
-- Porque foi essa a ordem real, e ela é observável: v_analysis_queue, criada
-- pela 20260901120522 com "select candidate.*", NÃO contém as colunas
-- final_report* em produção. Se elas já existissem quando a view foi criada, o
-- "*" as teria capturado. Logo, foram acrescentadas depois. Colocá-las no
-- baseline fazia o replay produzir uma view com quatro colunas a mais — foi
-- assim que a ordem correta ficou demonstrada.
--
-- Idempotente por construção, para ser inofensivo contra a produção.

alter table public.analysis_runs
  add column if not exists final_report_status text default 'pending'::text not null,
  add column if not exists final_report_version text,
  add column if not exists final_report_generated_at timestamp with time zone,
  add column if not exists final_report jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_final_report_status' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_final_report_status CHECK ((final_report_status = ANY (ARRAY['pending'::text, 'complete'::text, 'insufficient_data'::text])));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'analysis_runs_final_report_object' and conrelid = 'public.analysis_runs'::regclass) then
    alter table public.analysis_runs add constraint analysis_runs_final_report_object CHECK (((final_report IS NULL) OR (jsonb_typeof(final_report) = 'object'::text)));
  end if;
end $$;

create schema if not exists safa_private;

CREATE OR REPLACE FUNCTION safa_private.validate_qualitative_final_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.final_report_status = 'complete' then
    if new.final_report is null or pg_catalog.jsonb_typeof(new.final_report) <> 'object' then
      raise exception 'SAFA: relatorio qualitativo completo precisa ser um objeto estruturado';
    end if;
    if nullif(pg_catalog.btrim(new.final_report->>'title'), '') is null
      or nullif(pg_catalog.btrim(new.final_report->>'executive_summary'), '') is null
      or nullif(pg_catalog.btrim(new.final_report->>'final_conclusion'), '') is null
      or nullif(pg_catalog.btrim(new.final_report_version), '') is null
    then
      raise exception 'SAFA: relatorio qualitativo exige titulo, resumo executivo, conclusao e versao';
    end if;
    if pg_catalog.jsonb_typeof(new.final_report->'sections') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'strengths') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'weaknesses') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'conditions_to_invest') <> 'array'
      or pg_catalog.jsonb_typeof(new.final_report->'limitations') <> 'array'
    then
      raise exception 'SAFA: secoes, forcas, fragilidades, condicoes e limitacoes precisam ser listas';
    end if;
    if pg_catalog.jsonb_array_length(new.final_report->'sections') < 6
      or pg_catalog.jsonb_array_length(new.final_report->'strengths') = 0
      or pg_catalog.jsonb_array_length(new.final_report->'weaknesses') = 0
      or pg_catalog.jsonb_array_length(new.final_report->'conditions_to_invest') = 0
    then
      raise exception 'SAFA: relatorio qualitativo nao cobre o escopo minimo';
    end if;
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(new.final_report->'sections') section
      where nullif(pg_catalog.btrim(section->>'code'), '') is null
        or nullif(pg_catalog.btrim(section->>'title'), '') is null
        or nullif(pg_catalog.btrim(section->>'content'), '') is null
    ) then
      raise exception 'SAFA: toda secao qualitativa exige codigo, titulo e conteudo';
    end if;
    new.final_report_generated_at := coalesce(new.final_report_generated_at, pg_catalog.now());
  else
    new.final_report_generated_at := null;
  end if;

  if new.status = 'completed' and new.final_report_status <> 'complete' then
    raise exception 'SAFA: analise concluida exige relatorio qualitativo final completo';
  end if;

  return new;
end;
$function$
;

drop trigger if exists zz_validate_qualitative_final_report on public.analysis_runs;
CREATE TRIGGER zz_validate_qualitative_final_report BEFORE INSERT OR UPDATE ON public.analysis_runs FOR EACH ROW EXECUTE FUNCTION safa_private.validate_qualitative_final_report();
