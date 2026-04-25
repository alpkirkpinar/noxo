alter table public.machine_maintenance_records
add column if not exists maintenance_scope_items text[] not null default '{}';
