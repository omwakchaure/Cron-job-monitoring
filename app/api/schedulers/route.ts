import { listSchedulers } from "@/lib/wallet-monitoring";

export const runtime = "nodejs";

export async function GET() {
  const schedulers = await listSchedulers();
  return Response.json({ schedulers });
}

