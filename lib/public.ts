import { admin, configured } from "./supabase";
import { demoOrg, demoReviews } from "./demo";
import type { Organization, Review } from "./types";
export async function publicBusiness(
  value: string,
  token?: string,
): Promise<{
  org: Organization;
  token?: string;
  demo: boolean;
  reviews?: Review[];
  stats?: { total: number; average: number };
} | null> {
  if (!configured()) {
    if (!["demo-visit", demoOrg.slug].includes(value)) return null;
    return {
      org: demoOrg,
      token: value === "demo-visit" ? "demo-visit" : undefined,
      demo: true,
      reviews: demoReviews,
      stats: { total: 128, average: 4.9 },
    };
  }
  const db = admin();
  let orgId: string | undefined;
  let validToken: string | undefined;
  const candidate = token || value;
  if (/^[0-9a-f-]{36}$/i.test(candidate) || candidate === "demo-visit") {
    const { data, error } = await db
      .from("requests")
      .select("org_id,token")
      .eq(candidate === "demo-visit" ? "short_token" : "token", candidate)
      .maybeSingle();
    if (error) throw error;
    orgId = data?.org_id;
    validToken = data?.token;
  }
  let q = db.from("organizations").select("*");
  q = orgId ? q.eq("id", orgId) : q.eq("slug", value);
  const { data: o, error } = await q.maybeSingle();
  if (error) throw error;
  if (!o) return null;
  return {
    org: o,
    token: o.slug === "brooklyn-corner-demo" ? "demo-visit" : validToken,
    demo: o.slug === "brooklyn-corner-demo",
    ...(o.slug === "brooklyn-corner-demo"
      ? { reviews: demoReviews, stats: { total: 128, average: 4.7 } }
      : {}),
  };
}
