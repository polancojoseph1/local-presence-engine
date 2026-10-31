import { cookies } from "next/headers";
import { sessionClient } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { organization_id } = z
      .object({ organization_id: z.uuid() })
      .parse(await req.json());
    const db = await sessionClient();
    const { data, error } = await db
      .from("organizations")
      .select("id")
      .eq("id", organization_id)
      .single();
    if (error || !data) throw new Error("Unauthorized");
    (await cookies()).set("organization_id", organization_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
