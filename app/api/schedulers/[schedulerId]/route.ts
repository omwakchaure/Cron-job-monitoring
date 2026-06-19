import { getSchedulerById, getSchedulerLogs, upsertScheduler } from "@/lib/wallet-monitoring";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/schedulers/[schedulerId]">,
) {
  const { schedulerId } = await context.params;
  const scheduler = await getSchedulerById(schedulerId);
  const logs = await getSchedulerLogs(schedulerId);

  if (!scheduler) {
    return Response.json({ message: "Scheduler not found" }, { status: 404 });
  }

  return Response.json({ scheduler, logs });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/schedulers/[schedulerId]">,
) {
  const { schedulerId } = await context.params;
  const body = (await request.json()) as Record<string, unknown>;

  const scheduler = await upsertScheduler(schedulerId, {
    alertEmail: typeof body.alertEmail === "string" ? body.alertEmail : undefined,
    alertThreshold:
      typeof body.alertThreshold === "number" ? body.alertThreshold : undefined,
  });

  return Response.json({ scheduler });
}
