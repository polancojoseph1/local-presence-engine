import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
export function normalizePhone(value: string) {
  if (!value.trim()) return "";
  const phone = parsePhoneNumberFromString(value, "US");
  if (!phone?.isValid()) throw new Error("Invalid phone number");
  return phone.number as string;
}
export const customerSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z
      .union([z.string().regex(/^\+[1-9]\d{7,14}$/), z.literal("")])
      .optional(),
    email_consent: z.boolean().default(false),
    sms_consent: z.boolean().default(false),
    consent_at: z.string().datetime({ offset: true }).optional(),
    consent_source: z
      .enum(["csv_import", "manual_entry", "counter_qr"])
      .optional(),
  })
  .refine((x) => x.email || x.phone, "Email or phone is required")
  .refine(
    (x) =>
      !(x.sms_consent || x.email_consent) ||
      (!!x.consent_at && !!x.consent_source),
    "Consent timestamp and source are required",
  )
  .refine(
    (x) => !x.consent_at || Date.parse(x.consent_at) <= Date.now() + 300000,
    "Consent cannot be in the future",
  );
export function renderTemplate(
  template: string,
  name: string,
  business: string,
  link: string,
  optOut = "",
) {
  const vars: Record<string, string> = {
    name,
    business,
    link,
    customer_name: name,
    business_name: business,
    review_link: link,
    opt_out_text: optOut,
  };
  return template.replace(
    /{{(name|business|link|customer_name|business_name|review_link|opt_out_text)}}/g,
    (_, key: string) => vars[key],
  );
}
export const defaultTemplate =
  "Hi {{customer_name}}, thanks for visiting {{business_name}}! Share your honest experience: {{review_link}}";
export function eligible(
  c: {
    opted_out: boolean;
    opted_out_sms?: boolean;
    opted_out_email?: boolean;
    sms_consent: boolean;
    email_consent: boolean;
    phone?: string | null;
    email?: string | null;
  },
  channel: string,
) {
  return (
    !c.opted_out &&
    (channel === "sms"
      ? !c.opted_out_sms && !!c.phone && c.sms_consent
      : !c.opted_out_email && !!c.email && c.email_consent)
  );
}
export function googleLink(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    return (
      (u.hostname === "search.google.com" &&
        u.pathname === "/local/writereview" &&
        !!u.searchParams.get("placeid")) ||
      (u.hostname === "g.page" && /^\/r\/[^/]+\/review\/?$/.test(u.pathname)) ||
      (["www.google.com", "maps.google.com"].includes(u.hostname) &&
        u.pathname.startsWith("/maps") &&
        u.searchParams.get("action") === "write-review")
    );
  } catch {
    return false;
  }
}
export function messageBody(
  template: string,
  name: string,
  business: string,
  link: string,
  optOut: string,
) {
  const rendered = renderTemplate(template, name, business, link, optOut);
  return `${rendered.includes(business) ? "" : business + ": "}${rendered}${rendered.includes(optOut) ? "" : "\n" + optOut}`;
}
