import { admin } from "./supabase";
import { customerSchema, normalizePhone } from "./core";
export async function saveCustomers(
  orgId: string,
  input: unknown,
  source: "csv_import" | "manual_entry" = "manual_entry",
) {
  if (!Array.isArray(input) || !input.length || input.length > 500)
    throw new Error("Provide 1–500 customers");
  const db = admin();
  const seen = new Set<string>();
  // Validate the complete batch before persisting any rows.
  const rows = input.map((raw) => {
    const c = customerSchema.parse({
      ...raw,
      phone: normalizePhone(String(raw.phone || "")),
      consent_source: source,
    });
    return {
      ...c,
      email: c.email?.toLowerCase() || null,
      phone: c.phone || null,
      consent_at: c.consent_at || null,
      org_id: orgId,
    };
  });
  for (const c of rows) {
    for (const value of [c.email, c.phone]) {
      if (!value) continue;
      if (seen.has(value)) throw new Error("Duplicate contact in upload");
      seen.add(value);
    }
  }
  const { data, error } = await db.rpc("import_customers", {
    oid: orgId,
    rows_json: rows,
  });
  if (error) throw error;
  return data as string[];
}
