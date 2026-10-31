import { cookies } from "next/headers";
import { sessionClient } from "@/lib/supabase";
import { checkOrigin, failure } from "@/lib/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const db = await sessionClient();
    const { name } = z
      .object({ name: z.string().trim().min(1).max(100) })
      .parse(await req.json());
    const { data, error } = await db.rpc("onboard", { business: name });
    if (error) throw error;
    (await cookies()).set("organization_id", data, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return Response.json({ id: data });
  } catch (e) {
    return failure(e);
  }
}
