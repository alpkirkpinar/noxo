create table if not exists public.machine_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  machine_id uuid not null references public.machines(id) on delete cascade,
  performed_by uuid references public.app_users(id) on delete set null,
  performed_at date not null,
  next_maintenance_date date,
  maintenance_notes text,
  created_at timestamptz not null default now()
);

create index if not exists machine_maintenance_records_company_machine_idx
  on public.machine_maintenance_records (company_id, machine_id, performed_at desc);
