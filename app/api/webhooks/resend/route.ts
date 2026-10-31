import { Resend } from "resend";
import { admin } from "@/lib/supabase";
export async function POST(req: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET)
    return new Response("Webhook not configured", { status: 503 });
  try {
    const event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: await req.text(),
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp: req.headers.get("svix-timestamp") || "",
        signature: req.headers.get("svix-signature") || "",
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });
    const db = admin();
    if (
      event.type === "email.delivered" ||
      event.type === "email.bounced" ||
      event.type === "email.complained" ||
      event.type === "email.failed"
    ) {
      const status = event.type === "email.delivered" ? "delivered" : "failed";
      const { error } = await db
        .from("messages")
        .update({
          status,
          error: status === "failed" ? event.type : null,
          ...(status === "delivered"
            ? { delivered_at: new Date().toISOString() }
            : {}),
        })
        .eq("provider_id", event.data.email_id);
      if (error) return new Response("Persistence failed", { status: 500 });
    }
    if (event.type === "email.complained" || event.type === "email.bounced") {
      for (const email of event.data.to) {
        const { error } = await db.rpc("suppress_contact", {
          destination_value: email.toLowerCase(),
          channel_value: "email",
          source_value: event.type,
        });
        if (error) return new Response("Persistence failed", { status: 500 });
      }
    }
    return Response.json({ ok: true });
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
}
