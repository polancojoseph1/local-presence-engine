import { owner, admin } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId } = await owner();
    const b = z
      .object({ id: z.uuid(), resolved: z.boolean() })
      .parse(await req.json());
    const { error } = await admin()
      .from("feedback")
      .update({ resolved: b.resolved })
      .eq("id", b.id)
      .eq("org_id", orgId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
