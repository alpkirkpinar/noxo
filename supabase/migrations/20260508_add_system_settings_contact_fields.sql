alter table public.system_settings
add column if not exists website_url text,
add column if not exists phone text,
add column if not exists address text;
