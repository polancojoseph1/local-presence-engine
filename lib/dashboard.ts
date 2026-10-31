import { configured, owner, sessionClient, admin } from "./supabase";
import { demoOrg, demoCustomers, demoReviews } from "./demo";
import type { DashboardData } from "./types";
import { redirect } from "next/navigation";
export async function dashboardData(): Promise<DashboardData | null> {
  if (!configured())
    return {
      demo: true,
      org: demoOrg,
      customers: demoCustomers,
      reviews: demoReviews,
      requests: demoCustomers.slice(0, 4).map((c, i) => ({
        id: `r${i}`,
        customer_id: c.id,
        channel: i % 2 ? "email" : "sms",
        clicked_at: i < 2 ? "2026-10-30" : null,
        created_at: "2026-10-30",
      })),
      messages: demoCustomers.slice(0, 4).map((_, i) => ({
        id: `m${i}`,
        request_id: `r${i}`,
        status: i === 3 ? "failed" : "delivered",
      })),
      feedback: [
        {
          id: "demo-feedback",
          body: "Please offer an earlier Saturday appointment.",
          created_at: "2026-10-30",
          resolved: false,
        },
      ],
      stats: { total: 128, average: 4.9, synced_at: "2026-10-30" },
      googleConnected: false,
      metrics: {
        contacted: 4,
        sent: 4,
        delivered: 3,
        clicked: 2,
        requests: 4,
        opt_outs: 1,
        new_reviews: 3,
        feedback: 1,
      },
      organizations: [demoOrg],
      role: "owner",
      reports: [
        {
          id: "demo-report",
          month: "2026-09-01",
          metrics: {
            contacted: 84,
            sent: 112,
            delivered: 108,
            clicked: 38,
            requests: 84,
            opt_outs: 2,
            new_reviews: 14,
            feedback: 3,
          },
        },
      ],
    };
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: members } = await db
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id);
  const { data: operator } = await db
    .from("operators")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!members?.length && !operator) return null;
  const ctx = await owner();
  const oid = ctx.orgId;
  const results = await Promise.all(
    [
      "organizations",
      "customers",
      "reviews",
      "requests",
      "messages",
      "feedback",
      "review_stats",
    ].map((t) =>
      ctx.db
        .from(t)
        .select("*")
        .eq(t === "organizations" ? "id" : "org_id", oid)
        .order(
          t === "reviews"
            ? "published_at"
            : t === "review_stats"
              ? "synced_at"
              : "created_at",
          { ascending: false },
        )
        .limit(t === "customers" ? 50 : 200),
    ),
  );
  const [o, c, r, q, m, f, s] = results;
  if (results.some((x) => x.error))
    throw new Error("Unable to load business data");
  const [
    { data: metrics, error: me },
    { data: orgs, error: oe },
    { data: reports, error: re },
  ] = await Promise.all([
    ctx.db.rpc("dashboard_metrics", { oid }),
    ctx.db.from("organizations").select("*").order("name"),
    ctx.db
      .from("monthly_reports")
      .select("*")
      .eq("organization_id", oid)
      .order("month", { ascending: false }),
  ]);
  if (me || oe || re) throw me || oe || re;
  const { data: connection, error: ge } = await admin()
    .from("google_connections")
    .select("location")
    .eq("org_id", oid)
    .maybeSingle();
  if (ge) throw ge;
  return {
    demo: o.data![0].slug === "brooklyn-corner-demo",
    org: o.data![0],
    customers: c.data || [],
    reviews: r.data || [],
    requests: q.data || [],
    messages: m.data || [],
    feedback: f.data || [],
    stats: s.data?.[0] || null,
    googleConnected: !!connection?.location,
    metrics,
    organizations: orgs || [],
    role: ctx.role,
    isOperator: ctx.isOperator,
    reports: reports || [],
  };
}
