import { sessionClient } from "@/lib/supabase";
import { checkOrigin } from "@/lib/http";
export async function POST(req: Request) {
  checkOrigin(req);
  await (await sessionClient()).auth.signOut();
  return Response.json({ ok: true });
}
