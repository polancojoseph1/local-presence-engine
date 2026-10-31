import { syncReviews } from "@/lib/google";
import { runNotifications } from "@/lib/notifications";
export const maxDuration = 300;
export async function POST(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    return Response.json({
      reviews: await syncReviews(),
      notifications: await runNotifications(),
    });
  } catch {
    return new Response("Scheduled processing failed", { status: 500 });
  }
}
export const GET = POST;
