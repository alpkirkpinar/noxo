alter table public.system_settings
add column if not exists maintenance_approver_name text,
add column if not exists maintenance_approver_title text;
