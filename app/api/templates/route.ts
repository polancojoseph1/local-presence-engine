import { manager, owner, admin } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
export async function GET() {
  try {
    const { orgId, db } = await owner();
    const { data, error } = await db
      .from("message_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("sequence_step");
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId } = await manager();
    const b = z
      .object({
        name: z.string().min(1).max(100),
        channel: z.enum(["sms", "email"]),
        sequence_step: z.number().int().min(1).max(2),
        delay_hours: z.number().int().min(0).max(336),
        subject: z.string().max(200).optional(),
        body: z
          .string()
          .min(10)
          .max(2000)
          .refine(
            (s) => s.includes("{{review_link}}") || s.includes("{{link}}"),
            "Include a review link",
          ),
      })
      .parse(await req.json());
    if (b.sequence_step === 1 && b.delay_hours !== 0)
      throw new Error("Initial request delay must be zero");
    if (b.sequence_step === 2 && b.delay_hours < 1)
      throw new Error("Follow-up delay must be at least one hour");
    const { error } = await admin()
      .from("message_templates")
      .upsert(
        { ...b, organization_id: orgId },
        { onConflict: "organization_id,channel,sequence_step" },
      );
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
