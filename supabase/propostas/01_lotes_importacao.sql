-- SAFA — lotes de importação: a linhagem de todo dado que entra
--
-- PROPOSTA. Não aplicada. Ver supabase/propostas/README.md.
--
-- Ataca D1, D3 e D4. Hoje 1.830 preços apontam para uma página genérica da B3,
-- sem coletor reproduzível e sem identificação do arquivo-fonte, e os gates
-- conferem contagem em vez de procedência. Depois disto, número sem lote não
-- entra em cálculo.
--
-- `AGENTS.md` §12 define o conteúdo obrigatório de um lote; este arquivo é a
-- tradução dele em schema.

begin;

create table if not exists public.import_batches (
  id bigint generated always as identity primary key,
  -- URL exata do arquivo. Página de índice não é fonte (§11).
  source_url text not null,
  file_name text not null,
  -- hash do arquivo BRUTO, antes de qualquer transformação
  sha256 text not null,
  fetched_at timestamptz not null,
  -- data de geração declarada pela fonte, quando existir
  generated_at timestamptz,
  parser_version text not null,
  record_count integer not null,
  rejected_count integer not null default 0,
  status text not null default 'staging',
  problems jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'import_batches_status_valid') then
    alter table public.import_batches add constraint import_batches_status_valid
      check (status in ('staging', 'validated', 'rejected', 'active'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'import_batches_sha256_format') then
    alter table public.import_batches add constraint import_batches_sha256_format
      check (sha256 ~ '^[0-9a-f]{64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'import_batches_counts_valid') then
    alter table public.import_batches add constraint import_batches_counts_valid
      check (record_count >= 0 and rejected_count >= 0);
  end if;
  -- lote sem registro não pode ser dado por bom: o desfecho correto é rejected
  if not exists (select 1 from pg_constraint where conname = 'import_batches_empty_not_valid') then
    alter table public.import_batches add constraint import_batches_empty_not_valid
      check (record_count > 0 or status <> 'validated');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'import_batches_problems_array') then
    alter table public.import_batches add constraint import_batches_problems_array
      check (jsonb_typeof(problems) = 'array');
  end if;
  -- o mesmo arquivo não entra duas vezes
  if not exists (select 1 from pg_constraint where conname = 'import_batches_sha256_unique') then
    alter table public.import_batches add constraint import_batches_sha256_unique
      unique (sha256, parser_version);
  end if;
end $$;

create index if not exists import_batches_status_idx
  on public.import_batches (status, fetched_at desc);

-- Vínculo do dado com o lote que o trouxe. Nulo nas linhas legadas: elas são
-- justamente as que o D1 manda rejeitar, e o nulo as deixa visíveis.
alter table public.market_prices
  add column if not exists batch_id bigint;
alter table public.cash_distributions
  add column if not exists batch_id bigint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'market_prices_batch_fkey') then
    alter table public.market_prices add constraint market_prices_batch_fkey
      foreign key (batch_id) references public.import_batches (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cash_distributions_batch_fkey') then
    alter table public.cash_distributions add constraint cash_distributions_batch_fkey
      foreign key (batch_id) references public.import_batches (id);
  end if;
end $$;

create index if not exists market_prices_batch_idx on public.market_prices (batch_id);
create index if not exists cash_distributions_batch_idx on public.cash_distributions (batch_id);

-- Preço com procedência: só o que veio de lote aproveitável (§12).
create or replace view public.v_market_prices_rastreaveis
with (security_invoker = true)
as
select p.*
from public.market_prices p
join public.import_batches b on b.id = p.batch_id
where b.status in ('validated', 'active');

alter table public.import_batches enable row level security;

drop policy if exists safa_public_read on public.import_batches;
create policy safa_public_read on public.import_batches
  as permissive for select to anon, authenticated
  using (true);

grant select on public.import_batches to anon, authenticated;
grant select on public.v_market_prices_rastreaveis to anon, authenticated;

notify pgrst, 'reload schema';
commit;
