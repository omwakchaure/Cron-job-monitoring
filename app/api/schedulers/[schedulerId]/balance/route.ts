import { runBalanceCheck } from "@/lib/wallet-monitoring";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/schedulers/[schedulerId]/balance">,
) {
  const { schedulerId } = await context.params;
  const result = await runBalanceCheck(schedulerId);
  return Response.json(result);
}

