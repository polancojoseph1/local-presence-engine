import { owner } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
import { saveCustomers } from "@/lib/customers";
import { runQueue } from "@/lib/messaging";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { db, orgId } = await owner();
    const raw = await req.json();
    const b = z
      .object({
        customer_id: z.uuid().optional(),
        customer: z.unknown().optional(),
        channel: z.enum(["sms", "email", "multi_channel"]),
      })
      .parse(raw);
    const cid = b.customer_id || (await saveCustomers(orgId, [b.customer]))[0];
    const { data, error } = await db.rpc("enqueue_review", {
      oid: orgId,
      cid,
      ch: b.channel,
    });
    if (error)
      throw new Error(
        error.code === "23505"
          ? "A request was already created for this customer today."
          : error.message,
      );
    return Response.json({ id: data, delivery: await runQueue(data) });
  } catch (e) {
    return failure(e);
  }
}
