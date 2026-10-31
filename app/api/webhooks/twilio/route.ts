import twilio from "twilio";
import { admin } from "@/lib/supabase";
export async function POST(req: Request) {
  const values = Object.fromEntries(await req.formData()) as Record<
    string,
    string
  >;
  const url = `${process.env.APP_URL}${new URL(req.url).pathname}${new URL(req.url).search}`;
  if (
    !process.env.TWILIO_AUTH_TOKEN ||
    !twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      req.headers.get("x-twilio-signature") || "",
      url,
      values,
    )
  )
    return new Response("Invalid signature", { status: 403 });
  try {
    const db = admin();
    if (
      values.OptOutType === "STOP" ||
      /^\s*(stop|unsubscribe|cancel|end|quit)\s*$/i.test(values.Body || "")
    ) {
      const { error } = await db.rpc("suppress_contact", {
        destination_value: values.From,
        channel_value: "sms",
        source_value: "twilio_inbound",
      });
      if (error) throw error;
    }
    if (values.MessageStatus) {
      const status = ["delivered", "failed", "undelivered"].includes(
        values.MessageStatus,
      )
        ? values.MessageStatus === "delivered"
          ? "delivered"
          : "failed"
        : null;
      if (status) {
        const { data: message, error: lookup } = await db
          .from("messages")
          .select("id,request_id,status")
          .eq(
            new URL(req.url).searchParams.has("message") ? "id" : "provider_id",
            new URL(req.url).searchParams.get("message") || values.MessageSid,
          )
          .maybeSingle();
        if (lookup) throw lookup;
        if (message && message.status !== "delivered") {
          const { error } = await db
            .from("messages")
            .update({
              status,
              provider_id: values.MessageSid,
              error: values.ErrorCode || null,
              ...(status === "delivered"
                ? { delivered_at: new Date().toISOString() }
                : {}),
            })
            .eq("id", message.id);
          if (error) throw error;
          const { error: re } = await db
            .from("requests")
            .update({
              status,
              ...(status === "delivered"
                ? { delivered_at: new Date().toISOString() }
                : {}),
            })
            .eq("id", message.request_id)
            .in("status", ["queued", "sent", "failed"]);
          if (re) throw re;
        }
      }
    }
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch {
    return new Response("Persistence failed", { status: 500 });
  }
}
