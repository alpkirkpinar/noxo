alter table public.app_users
add column if not exists calendar_color text;

alter table public.app_users
drop constraint if exists app_users_calendar_color_hex_check;

alter table public.app_users
add constraint app_users_calendar_color_hex_check
check (
  calendar_color is null
  or calendar_color ~ '^#[0-9A-Fa-f]{6}$'
);
