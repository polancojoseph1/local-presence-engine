import { admin } from "./supabase";
import { eligible, messageBody } from "./core";
import twilio from "twilio";
import { Resend } from "resend";
export async function runQueue(requestId?: string) {
  const db = admin();
  const { data: jobs, error } = await db.rpc("claim_messages", {
    request_filter: requestId || null,
  });
  if (error) throw error;
  let sent = 0;
  for (const job of jobs || []) {
    try {
      const { data: r, error: re } = await db
        .from("requests")
        .select("*")
        .eq("id", job.request_id)
        .single();
      if (re) throw re;
      const { data: c, error: ce } = await db
        .from("customers")
        .select("*")
        .eq("id", r.customer_id)
        .single();
      if (ce) throw ce;
      const { data: o, error: oe } = await db
        .from("organizations")
        .select("*")
        .eq("id", job.org_id)
        .single();
      if (oe) throw oe;
      const { data: suppressed, error: se } = await db
        .from("channel_suppressions")
        .select("destination")
        .eq("destination", job.channel === "sms" ? c.phone : c.email)
        .eq("channel", job.channel)
        .maybeSingle();
      if (se) throw se;
      if (
        !c.consent_at ||
        !c.consent_source ||
        suppressed ||
        !eligible(c, job.channel) ||
        (job.step > 0 && r.clicked_at)
      ) {
        const { error } = await db
          .from("messages")
          .update({ status: "cancelled" })
          .eq("id", job.id);
        if (error) throw error;
        continue;
      }
      if (o.slug === "brooklyn-corner-demo") {
        await db
          .from("messages")
          .update({
            status: "cancelled",
            error: "Fictional demo tenant: outbound messaging disabled",
          })
          .eq("id", job.id);
        continue;
      }
      const { data: t, error: te } = await db
        .from("message_templates")
        .select("*")
        .eq("organization_id", o.id)
        .eq("channel", job.channel)
        .eq("sequence_step", job.step + 1)
        .maybeSingle();
      if (te) throw te;
      const link = `${process.env.APP_URL}/r/${r.token}`;
      const stop =
        job.channel === "sms"
          ? "Reply STOP to opt out."
          : `Unsubscribe: ${process.env.APP_URL}/unsubscribe?t=${r.token}`;
      const body = messageBody(
        t?.body || o.template,
        c.name,
        o.name,
        link,
        stop,
      );
      if (
        (job.channel === "sms" &&
          (!process.env.TWILIO_MESSAGING_SERVICE_SID ||
            process.env.TWILIO_A2P_APPROVED !== "true")) ||
        (job.channel === "email" && !process.env.RESEND_API_KEY)
      ) {
        const { error } = await db
          .from("messages")
          .update({
            status: "failed",
            error: "Provider configuration or A2P approval missing",
          })
          .eq("id", job.id);
        if (error) throw error;
        const { error: requestError } = await db
          .from("requests")
          .update({
            status: "failed",
            error_message: "Provider configuration or A2P approval missing",
          })
          .eq("id", r.id)
          .in("status", ["queued", "failed"]);
        if (requestError) throw requestError;
        continue;
      }
      // Require a durable pre-send transition. An ambiguous provider outcome stays unknown.
      const { data: claimed, error: ue } = await db
        .from("messages")
        .update({ status: "unknown" })
        .eq("id", job.id)
        .eq("status", "processing")
        .select("id")
        .maybeSingle();
      if (ue) throw ue;
      if (!claimed) continue;
      // Recheck opt-out after claiming to close the processing/cancellation window.
      const { data: latest, error: le } = await db
        .from("customers")
        .select("*")
        .eq("id", c.id)
        .single();
      if (le) throw le;
      if (!eligible(latest, job.channel)) {
        await db
          .from("messages")
          .update({ status: "cancelled" })
          .eq("id", job.id);
        continue;
      }
      let id: string;
      if (job.channel === "sms") {
        const result = await twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
          { timeout: 15000 },
        ).messages.create({
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
          to: c.phone,
          body,
          statusCallback: `${process.env.APP_URL}/api/webhooks/twilio/status?message=${job.id}`,
        });
        id = result.sid;
      } else {
        const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
          {
            from: process.env.EMAIL_FROM!,
            to: c.email,
            subject: t?.subject || `Share your experience at ${o.name}`,
            text: body,
            headers: {
              "List-Unsubscribe": `<${process.env.APP_URL}/api/unsubscribe?t=${r.token}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          },
          { idempotencyKey: job.id },
        );
        if (result.error) throw new Error(result.error.message);
        id = result.data!.id;
      }
      const now = new Date().toISOString();
      const { error: me } = await db
        .from("messages")
        .update({ provider_id: id, sent_at: now, error: null })
        .eq("id", job.id);
      if (me) throw me;
      const { error: stateError } = await db
        .from("messages")
        .update({ status: "sent" })
        .eq("id", job.id)
        .eq("status", "unknown");
      if (stateError) throw stateError;
      const { error: rq } = await db
        .from("requests")
        .update({ sent_at: now, provider_message_id: id })
        .eq("id", r.id);
      if (rq) throw rq;
      const { error: rse } = await db
        .from("requests")
        .update({ status: "sent" })
        .eq("id", r.id)
        .eq("status", "queued");
      if (rse) throw rse;
      const { error: cu } = await db
        .from("customers")
        .update({ last_contacted_at: now })
        .eq("id", c.id);
      if (cu) throw cu;
      sent++;
    } catch (e) {
      const { error } = await db
        .from("messages")
        .update({ error: e instanceof Error ? e.message : "Provider error" })
        .eq("id", job.id);
      if (error) console.error("Unable to persist queue error", job.id);
    }
  }
  return { sent, claimed: jobs?.length || 0 };
}
