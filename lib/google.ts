import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { admin } from "./supabase";
import { notifyOwner } from "./notifications";
function key() {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "hex");
  if (k.length !== 32)
    throw new Error("Configure TOKEN_ENCRYPTION_KEY as 32 random hex bytes");
  return k;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  return Buffer.concat([
    iv,
    cipher.update(value),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decrypt(value: string) {
  const b = Buffer.from(value, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]).toString();
}
export async function accessToken(refresh: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: decrypt(refresh),
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok)
    throw new Error("Google authorization expired; reconnect your account");
  return (await r.json()).access_token as string;
}
export async function googleGet(url: string, token: string) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Google API returned ${r.status}`);
  return r.json();
}
export async function locations(token: string) {
  const accounts = [];
  let accountPage = "";
  do {
    const a = await googleGet(
      `https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20${accountPage ? `&pageToken=${encodeURIComponent(accountPage)}` : ""}`,
      token,
    );
    accounts.push(...(a.accounts || []));
    accountPage = a.nextPageToken || "";
  } while (accountPage);
  const all = [];
  for (const account of accounts) {
    let next = "";
    do {
      const page = await googleGet(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title&pageSize=100${next ? `&pageToken=${encodeURIComponent(next)}` : ""}`,
        token,
      );
      for (const l of page.locations || [])
        all.push({ name: `${account.name}/${l.name}`, title: l.title });
      next = page.nextPageToken || "";
    } while (next);
  }
  return all;
}
export async function syncReviews() {
  const db = admin();
  const { data: connections, error: connectionError } = await db
    .from("google_connections")
    .select("*")
    .neq("location", "");
  if (connectionError) throw connectionError;
  const results = [];
  for (const c of connections || []) {
    try {
      const token = await accessToken(c.refresh_token);
      let pageToken = "";
      let total = 0,
        average = 0;
      do {
        const page = await googleGet(
          `https://mybusiness.googleapis.com/v4/${c.location}/reviews?pageSize=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
          token,
        );
        total = page.totalReviewCount || 0;
        average = page.averageRating || 0;
        for (const r of page.reviews || []) {
          const id = `${c.org_id}:${r.reviewId}`;
          const { data: existing, error: existingError } = await db
            .from("reviews")
            .select("id")
            .eq("id", id)
            .maybeSingle();
          if (existingError) throw existingError;
          const rating =
            ["ONE", "TWO", "THREE", "FOUR", "FIVE"].indexOf(r.starRating) + 1;
          if (!rating) continue;
          const { error } = await db
            .from("reviews")
            .upsert({
              id,
              org_id: c.org_id,
              author: r.reviewer?.displayName || "Google reviewer",
              rating,
              body: r.comment || "",
              published_at: r.createTime,
              external_review_id: r.reviewId,
              reviewer_avatar_url: r.reviewer?.profilePhotoUrl || null,
            });
          if (error) throw error;
          if (!existing && c.last_sync) {
            const { data: o, error: oe } = await db
              .from("organizations")
              .select("*")
              .eq("id", c.org_id)
              .single();
            if (oe) throw oe;
            await notifyOwner(
              o,
              `review:${id}`,
              "review",
              `New Google review for ${o.name}`,
              `${r.reviewer?.displayName || "A customer"} left a ${rating}-star review. ${process.env.APP_URL}/dashboard/reviews`,
            );
          }
        }
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      const { error: statsError } = await db
        .from("review_stats")
        .upsert({
          org_id: c.org_id,
          total,
          average,
          synced_at: new Date().toISOString(),
        });
      if (statsError) throw statsError;
      const { error: syncError } = await db
        .from("google_connections")
        .update({ last_sync: new Date().toISOString() })
        .eq("org_id", c.org_id);
      if (syncError) throw syncError;
      results.push({ orgId: c.org_id, ok: true });
    } catch {
      results.push({ orgId: c.org_id, ok: false });
    }
  }
  return results;
}
