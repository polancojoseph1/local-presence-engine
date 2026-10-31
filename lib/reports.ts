import { admin } from "./supabase";
import { notifyOwner } from "./notifications";
export async function generateReports() {
  const db = admin();
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const month = start.toISOString().slice(0, 10);
  const { data: orgs, error } = await db
    .from("organizations")
    .select("*")
    .eq("plan_tier", "premium");
  if (error) throw error;
  let generated = 0;
  for (const o of orgs || []) {
    const { data: existing } = await db
      .from("monthly_reports")
      .select("id,metrics")
      .eq("organization_id", o.id)
      .eq("month", month)
      .maybeSingle();
    if (existing) {
      if (o.notification_preferences?.monthly_report)
        await notifyOwner(
          o,
          `report:${month}`,
          "monthly",
          `${o.name}: monthly local-presence report`,
          `Your ${month.slice(0, 7)} report is ready: ${process.env.APP_URL}/dashboard/reports`,
        );
      continue;
    }
    const { data: metrics, error: me } = await db.rpc("dashboard_metrics", {
      oid: o.id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
    });
    if (me) throw me;
    const { error: re } = await db
      .from("monthly_reports")
      .upsert(
        { organization_id: o.id, month, metrics },
        { onConflict: "organization_id,month", ignoreDuplicates: true },
      );
    if (re) throw re;
    if (o.notification_preferences?.monthly_report) {
      await notifyOwner(
        o,
        `report:${month}`,
        "monthly",
        `${o.name}: monthly local-presence report`,
        `${month.slice(0, 7)}: ${metrics.new_reviews} new Google reviews, ${metrics.contacted} customers contacted, ${metrics.clicked} review-link opens. Link opens do not prove a published review. View your report: ${process.env.APP_URL}/dashboard/reports`,
      );
    }
    generated++;
  }
  return { generated };
}
