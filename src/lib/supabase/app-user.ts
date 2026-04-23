import { createClient } from "@/lib/supabase/server";

type AppUserShape = {
  id: string;
  company_id: string;
  full_name?: string | null;
  title?: string | null;
};

export async function getCurrentAppUser<T extends AppUserShape = AppUserShape>(
  select = "id, company_id, full_name, title"
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, appUser: null as T | null };
  }

  const byAuthUser = await supabase
    .from("app_users")
    .select(select)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (byAuthUser.data) {
    return { supabase, user, appUser: byAuthUser.data as T };
  }

  const email = String(user.email ?? "").trim().toLowerCase();

  if (!email) {
    return { supabase, user, appUser: null as T | null };
  }

  const byEmail = await supabase
    .from("app_users")
    .select(select)
    .ilike("email", email)
    .maybeSingle();

  return { supabase, user, appUser: (byEmail.data as T | null) ?? null };
}
