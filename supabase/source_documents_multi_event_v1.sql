-- Vários comunicados podem ter a mesma data, tipo e rodada de análise.
begin;

drop index if exists public.source_documents_run_type_competence_unique;
drop index if exists public.source_documents_analysis_run_id_document_type_competence_date_idx;

create index if not exists source_documents_run_type_competence_idx
on public.source_documents (analysis_run_id, document_type, competence_date desc);

commit;
