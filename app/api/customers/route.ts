import { owner } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { saveCustomers } from "@/lib/customers";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId } = await owner();
    return Response.json({ ids: await saveCustomers(orgId, await req.json()) });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    const { db, orgId } = await owner();
    const u = new URL(req.url);
    const page = Math.min(
      100000,
      Math.max(0, Math.floor(Number(u.searchParams.get("page")) || 0)),
    );
    let q = db
      .from("customers")
      .select("*", { count: "exact" })
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .range(page * 50, page * 50 + 49);
    const search = u.searchParams.get("search");
    if (search)
      q = q.ilike("name", `%${search.replaceAll("%", "").slice(0, 100)}%`);
    if (u.searchParams.get("opted_out") === "true")
      q = q.or("opted_out_sms.eq.true,opted_out_email.eq.true");
    const { data, count, error } = await q;
    if (error) throw error;
    const ids = (data || []).map((c) => c.id);
    const { data: activity, error: ae } = ids.length
      ? await db
          .from("requests")
          .select("id,customer_id,status,created_at")
          .eq("org_id", orgId)
          .in("customer_id", ids)
          .order("created_at", { ascending: false })
          .limit(1000)
      : { data: [], error: null };
    if (ae) throw ae;
    const { data: feedback, error: fe } = ids.length
      ? await db
          .from("feedback")
          .select("customer_id")
          .eq("org_id", orgId)
          .in("customer_id", ids)
      : { data: [], error: null };
    if (fe) throw fe;
    return Response.json({
      customers: (data || []).map((c) => ({
        ...c,
        latest_status:
          activity?.find((r) => r.customer_id === c.id)?.status ||
          "not_contacted",
        response_count:
          feedback?.filter((f) => f.customer_id === c.id).length || 0,
      })),
      total: count,
      page,
    });
  } catch (e) {
    return failure(e);
  }
}
