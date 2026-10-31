import { manager, admin } from "@/lib/supabase";
import { googleLink } from "@/lib/core";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const https = z.union([
  z.literal(""),
  z.url().refine((s) => new URL(s).protocol === "https:"),
]);
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId } = await manager();
    const b = z
      .object({
        name: z.string().trim().min(1).max(100),
        google_url: z
          .string()
          .refine(googleLink, "Use a direct HTTPS Google review link"),
        brand_color: color,
        template: z
          .string()
          .min(10)
          .max(2000)
          .refine(
            (s) => s.includes("{{link}}") || s.includes("{{review_link}}"),
            "Include review link",
          ),
        reminder_days: z.number().int().min(1).max(14),
        notifications: z.boolean(),
        industry_category: z.string().max(100).optional(),
        phone: z
          .string()
          .regex(/^\+[1-9]\d{7,14}$/)
          .nullable()
          .optional(),
        email: z.email().nullable().optional(),
        address: z.string().max(500).optional(),
        timezone: z
          .string()
          .refine((s) => {
            try {
              new Intl.DateTimeFormat("en", { timeZone: s });
              return true;
            } catch {
              return false;
            }
          })
          .optional(),
        google_place_id: z.string().max(200).optional(),
        branding_config: z
          .object({
            logo_url: https.optional(),
            primary_color: color.optional(),
            accent_color: color.optional(),
            welcome_headline: z.string().max(120).optional(),
            counter_cta: z.string().max(160).optional(),
          })
          .optional(),
        plan_tier: z.enum(["standard", "premium"]).optional(),
        setup_fee_cents: z.number().int().min(0).max(10000000).optional(),
        setup_fee_paid_at: z.string().datetime().nullable().optional(),
        notification_preferences: z
          .object({
            review_email: z.boolean(),
            review_sms: z.boolean(),
            feedback_email: z.boolean(),
            feedback_sms: z.boolean(),
            monthly_report: z.boolean(),
          })
          .optional(),
      })
      .parse(await req.json());
    // Keep the original email-alert switch consistent with granular preferences.
    if (b.notification_preferences) {
      b.notifications = b.notification_preferences.review_email;
    } else {
      const { data: current, error: readError } = await admin()
        .from("organizations")
        .select("notification_preferences")
        .eq("id", orgId)
        .single();
      if (readError) throw readError;
      b.notification_preferences = {
        review_sms: false,
        feedback_email: true,
        feedback_sms: false,
        monthly_report: true,
        ...current.notification_preferences,
        review_email: b.notifications,
      };
    }
    const { error } = await admin()
      .from("organizations")
      .update(b)
      .eq("id", orgId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
