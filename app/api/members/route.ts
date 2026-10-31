import { manager, admin } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId, isOperator } = await manager();
    const b = z
      .object({
        user_id: z.uuid(),
        role: z.enum(["owner", "staff", "operator_admin"]),
      })
      .parse(await req.json());
    if (b.role === "operator_admin" && !isOperator)
      throw new Error("Only operators may assign operator access");
    const { error } = await admin()
      .from("memberships")
      .upsert({ user_id: b.user_id, org_id: orgId, role: b.role });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
