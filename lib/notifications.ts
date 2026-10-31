import { admin } from "./supabase";
import { Resend } from "resend";
import twilio from "twilio";
import type { Organization } from "./types";
export async function notifyOwner(
  o: Organization,
  key: string,
  kind: "review" | "feedback" | "monthly",
  subject: string,
  body: string,
) {
  const p = o.notification_preferences || {};
  const channels =
    kind === "monthly"
      ? ["email"]
      : (["email", "sms"] as const).filter(
          (c) => p[`${kind}_${c}` as keyof typeof p] ?? c === "email",
        );
  for (const channel of channels) {
    const { error } = await admin()
      .from("notification_jobs")
      .upsert(
        { organization_id: o.id, event_key: key, kind, subject, body, channel },
        {
          onConflict: "organization_id,event_key,channel",
          ignoreDuplicates: true,
        },
      );
    if (error) throw error;
  }
}
export async function runNotifications() {
  const db = admin();
  const { data: jobs, error } = await db
    .from("notification_jobs")
    .select("*")
    .eq("status", "queued")
    .limit(50);
  if (error) throw error;
  let sent = 0;
  for (const job of jobs || []) {
    const { data: o, error: oe } = await db
      .from("organizations")
      .select("*")
      .eq("id", job.organization_id)
      .single();
    if (oe) throw oe;
    if (job.channel === "sms") {
      const { data: suppressed, error: se } = await db
        .from("channel_suppressions")
        .select("destination")
        .eq("destination", o.phone || "")
        .eq("channel", "sms")
        .maybeSingle();
      if (se) throw se;
      if (suppressed) {
        await db
          .from("notification_jobs")
          .update({ status: "failed", error: "Owner number opted out" })
          .eq("id", job.id);
        continue;
      }
    }
    if (
      (job.channel === "email" && !process.env.RESEND_API_KEY) ||
      (job.channel === "sms" &&
        (!process.env.TWILIO_MESSAGING_SERVICE_SID ||
          process.env.TWILIO_A2P_APPROVED !== "true" ||
          !o.phone))
    )
      continue;
    const { data: claim, error: ce } = await db
      .from("notification_jobs")
      .update({ status: "unknown" })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (ce) throw ce;
    if (!claim) continue;
    try {
      if (job.channel === "email") {
        const { error } = await new Resend(
          process.env.RESEND_API_KEY,
        ).emails.send(
          {
            from: process.env.EMAIL_FROM!,
            to: o.email || o.owner_email,
            subject: job.subject,
            text: job.body,
          },
          { idempotencyKey: job.id },
        );
        if (error) throw new Error(error.message);
      } else {
        await twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
        ).messages.create({
          messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
          to: o.phone,
          body: `${o.name}: ${job.body}\nReply STOP to opt out.`,
        });
      }
      const { error } = await db
        .from("notification_jobs")
        .update({ status: "sent", error: null })
        .eq("id", job.id);
      if (error) throw error;
      sent++;
    } catch (e) {
      await db
        .from("notification_jobs")
        .update({
          error: e instanceof Error ? e.message : "Notification failed",
        })
        .eq("id", job.id);
    }
  }
  return { sent };
}
