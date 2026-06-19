import { listSchedulers, runBalanceCheck } from "@/lib/wallet-monitoring";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const incomingSecret = request.headers.get("x-cron-secret");
    if (incomingSecret !== cronSecret) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const [scheduler] = await listSchedulers();
  if (!scheduler) {
    return Response.json({ message: "No scheduler found" }, { status: 404 });
  }

  const result = await runBalanceCheck(scheduler.id);
  return Response.json({
    schedulerId: scheduler.id,
    ...result,
  });
}

