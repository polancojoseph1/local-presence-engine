import { admin } from "@/lib/supabase";
import { z } from "zod";
import { failure, checkOrigin } from "@/lib/http";
import { notifyOwner, runNotifications } from "@/lib/notifications";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const b = z
      .object({
        token: z.uuid().optional(),
        slug: z.string().max(100),
        body: z.string().trim().min(1).max(4000),
        contact_preference: z.enum(["none", "email", "sms"]).default("none"),
        website: z.string().max(0).optional(),
      })
      .parse(await req.json());
    const db = admin();
    const { data: o, error: oe } = await db
      .from("organizations")
      .select("*")
      .eq("slug", b.slug)
      .single();
    if (oe) throw new Error("Business not found");
    let requestId: null | string = null,
      customerId: null | string = null;
    if (b.token) {
      const { data: r, error } = await db
        .from("requests")
        .select("id,customer_id")
        .eq("token", b.token)
        .eq("org_id", o.id)
        .single();
      if (error) throw new Error("Invalid request");
      requestId = r.id;
      customerId = r.customer_id;
    } else if (b.contact_preference !== "none")
      throw new Error("A request link is needed for a contact preference");
    const { data: f, error } = await db
      .from("feedback")
      .insert({
        org_id: o.id,
        request_id: requestId,
        customer_id: customerId,
        body: b.body,
        contact_preference: b.contact_preference,
      })
      .select("id")
      .single();
    if (error)
      throw new Error("Feedback already received or could not be saved");
    await notifyOwner(
      o,
      `feedback:${f.id}`,
      "feedback",
      `Private feedback for ${o.name}`,
      `New private feedback: ${b.body}\nView securely: ${process.env.APP_URL}/dashboard/reviews`,
    );
    await runNotifications();
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
