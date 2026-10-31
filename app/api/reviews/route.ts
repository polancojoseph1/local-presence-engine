import { manager, admin } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId } = await manager();
    const b = z
      .object({
        id: z.string(),
        owner_reply_draft: z.string().max(4000),
        reply_status: z.enum(["none", "draft", "reviewed", "posted_manually"]),
        displayed_on_widget: z.boolean(),
      })
      .parse(await req.json());
    const { data: o } = await admin()
      .from("organizations")
      .select("plan_tier")
      .eq("id", orgId)
      .single();
    if (
      o?.plan_tier !== "premium" &&
      (b.owner_reply_draft || b.reply_status !== "none")
    )
      throw new Error("Manual response assistance requires Premium");
    const { id, ...fields } = b;
    const { error } = await admin()
      .from("reviews")
      .update(fields)
      .eq("id", id)
      .eq("org_id", orgId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
