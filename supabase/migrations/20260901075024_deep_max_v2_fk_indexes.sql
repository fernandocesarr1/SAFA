
    create index if not exists analysis_criterion_reviews_criterion_idx
      on public.analysis_criterion_reviews (criterion_code);
    create index if not exists analysis_document_scopes_scope_idx
      on public.analysis_document_scopes (scope_code);
    create index if not exists analysis_data_scopes_scope_idx
      on public.analysis_data_scopes (scope_code);
  