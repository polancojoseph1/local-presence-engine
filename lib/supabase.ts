import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export const configured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export async function sessionClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server-rendered sessions are refreshed by proxy.ts. */
          }
        },
      },
    },
  );
}
export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function owner() {
  if (!configured()) throw new Error("Connect Supabase to use live data.");
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const jar = await cookies();
  let orgId = jar.get("organization_id")?.value;
  const { data: operator, error: operatorError } = await db
    .from("operators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: members, error } = await db
    .from("memberships")
    .select("org_id,role")
    .eq("user_id", user.id);
  if (error) throw error;
  if (operatorError) throw operatorError;
  if (!orgId || (!operator && !members?.some((m) => m.org_id === orgId)))
    orgId = members?.[0]?.org_id;
  if (operator && !orgId) {
    const { data: first, error: firstError } = await db
      .from("organizations")
      .select("id")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (firstError) throw firstError;
    orgId = first?.id;
  }
  const member = members?.find((m) => m.org_id === orgId);
  if (!orgId || (!member && !operator))
    throw new Error("Create your organization first.");
  return {
    db,
    user,
    orgId: orgId as string,
    role: operator ? "operator_admin" : (member!.role as string),
    isOperator: !!operator,
  };
}
export async function manager() {
  const ctx = await owner();
  if (!["owner", "operator_admin"].includes(ctx.role))
    throw new Error("Owner or operator access required");
  return ctx;
}
