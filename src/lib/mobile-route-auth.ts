import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission } from "@/lib/permissions";

type MobileIdentity = {
  authUserId: string;
  appUserId: string;
  companyId: string;
  permissions: string[];
  role: string | null;
  super_user: boolean;
};

type MobileAuthResult =
  | {
      admin: ReturnType<typeof createAdminClient>;
      identity: MobileIdentity;
    }
  | {
      error: string;
      status: number;
    };

export async function getMobileRouteIdentity(request: Request, requiredPermission?: string): Promise<MobileAuthResult | null> {
  const url = new URL(request.url);
  const accessToken = url.searchParams.get("access_token")?.trim();

  if (!accessToken) {
    return null;
  }

  const admin = createAdminClient();
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    return { error: "Oturum bulunamadi.", status: 401 };
  }

  const { data: appUser, error: appUserError } = await admin
    .from("app_users")
    .select("id, company_id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser?.id || !appUser?.company_id) {
    return { error: "Sirket bilgisi bulunamadi.", status: 400 };
  }

  const metadata = user.app_metadata ?? {};
  const identity: MobileIdentity = {
    authUserId: user.id,
    appUserId: String(appUser.id),
    companyId: String(appUser.company_id),
    permissions: Array.isArray(metadata.permissions) ? metadata.permissions.map(String) : [],
    role: typeof metadata.role === "string" ? metadata.role : null,
    super_user: metadata.super_user === true,
  };

  if (requiredPermission && !hasPermission(identity, requiredPermission)) {
    return { error: "Bu islem icin yetkiniz yok.", status: 403 };
  }

  return { admin, identity };
}
