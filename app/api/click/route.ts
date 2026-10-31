import { admin } from "@/lib/supabase";
import { googleLink } from "@/lib/core";
import { z } from "zod";
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  if (!z.uuid().safeParse(token).success)
    return new Response("Invalid link", { status: 400 });
  const db = admin();
  const { data: r } = await db
    .from("requests")
    .select("id,org_id")
    .eq("token", token)
    .single();
  if (!r) return new Response("Not found", { status: 404 });
  const { data: o } = await db
    .from("organizations")
    .select("google_url")
    .eq("id", r.org_id)
    .single();
  if (!googleLink(o?.google_url || ""))
    return new Response("Business has not configured Google reviews", {
      status: 400,
    });
  const { error } = await db
    .from("requests")
    .update({
      clicked_at: new Date().toISOString(),
      status: "clicked",
      next_followup_at: null,
    })
    .eq("id", r.id);
  if (error) console.error("Unable to record review click");
  await db
    .from("messages")
    .update({ status: "cancelled" })
    .eq("request_id", r.id)
    .gt("step", 0)
    .in("status", ["queued", "processing"]);
  return Response.redirect(o!.google_url);
}
