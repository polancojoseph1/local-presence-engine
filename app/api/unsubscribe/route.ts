import { admin } from "@/lib/supabase";
import { z } from "zod";
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("t");
  if (!z.uuid().safeParse(token).success)
    return new Response("Invalid link", { status: 400 });
  const { error } = await admin().rpc("unsubscribe_request", {
    request_token: token,
  });
  return error
    ? new Response("Could not unsubscribe; retry", { status: 500 })
    : Response.json({ ok: true });
}
