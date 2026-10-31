import { runQueue } from "@/lib/messaging";
import { syncReviews } from "@/lib/google";
import { generateReports } from "@/lib/reports";
import { runNotifications } from "@/lib/notifications";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response("Unauthorized", { status: 401 });
  const result: Record<string, unknown> = {};
  for (const [name, run] of Object.entries({
    messages: () => runQueue(),
    reviews: syncReviews,
    reports: generateReports,
    notifications: runNotifications,
  })) {
    try {
      result[name] = await run();
    } catch (e) {
      console.error(name, e);
      result[name] = { error: "Processing failed; inspect server logs" };
    }
  }
  return Response.json(result);
}
export const POST = GET;
