import Papa from "papaparse";
import { z } from "zod";
import { owner } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { saveCustomers } from "@/lib/customers";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { orgId, db } = await owner();
    const b = z
      .object({
        csv: z.string().max(1000000),
        mapping: z.record(z.string(), z.string()),
        enroll: z.boolean().default(false),
        channel: z.enum(["sms", "email", "multi_channel"]).default("sms"),
      })
      .parse(await req.json());
    const parsed = Papa.parse<Record<string, string>>(b.csv, {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);
    const flag = (s: string) => ["true", "yes", "1"].includes(s?.toLowerCase());
    const ids = await saveCustomers(
      orgId,
      parsed.data.map((row) => {
        const get = (key: string) => row[b.mapping[key] || key] || "";
        return {
          name: get("name"),
          phone: get("phone"),
          email: get("email"),
          sms_consent: flag(get("sms_consent") || get("consent")),
          email_consent: flag(get("email_consent") || get("consent")),
          consent_at: get("consent_timestamp"),
          consent_source: "csv_import",
        };
      }),
      "csv_import",
    );
    const enrollment = [];
    if (b.enroll)
      for (const id of ids) {
        const { data, error } = await db.rpc("enqueue_review", {
          oid: orgId,
          cid: id,
          ch: b.channel,
        });
        enrollment.push({
          customer_id: id,
          request_id: data,
          error: error?.message,
        });
      }
    return Response.json({ imported: ids.length, enrollment });
  } catch (e) {
    return failure(e);
  }
}
