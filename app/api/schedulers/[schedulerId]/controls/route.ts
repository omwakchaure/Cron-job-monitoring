import { startScheduler, stopScheduler } from "@/lib/wallet-monitoring";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/schedulers/[schedulerId]/controls">,
) {
  const { schedulerId } = await context.params;
  const body = (await request.json()) as { action?: string };

  if (body.action === "start") {
    const scheduler = await startScheduler(schedulerId);
    return Response.json({ scheduler });
  }

  if (body.action === "stop") {
    const scheduler = await stopScheduler(schedulerId);
    return Response.json({ scheduler });
  }

  return Response.json({ message: "Unsupported action" }, { status: 400 });
}

