import WalletDashboard from "./wallet-dashboard";
import {
  getSchedulerById,
  getSchedulerLogs,
  listSchedulers,
} from "@/lib/wallet-monitoring";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const schedulers = await listSchedulers();
  return schedulers.map((scheduler) => ({ schedulerId: scheduler.id }));
}

export default async function SchedulerPage({
  params,
}: {
  params: Promise<{ schedulerId: string }>;
}) {
  const { schedulerId } = await params;
  const [scheduler, logs, allSchedulers] = await Promise.all([
    getSchedulerById(schedulerId),
    getSchedulerLogs(schedulerId),
    listSchedulers(),
  ]);

  if (!scheduler) {
    notFound();
  }

  const [freshScheduler, freshLogs] = await Promise.all([
    getSchedulerById(schedulerId),
    getSchedulerLogs(schedulerId),
  ]);

  return (
    <WalletDashboard
      scheduler={freshScheduler ?? scheduler}
      logs={freshLogs.length > 0 ? freshLogs : logs}
      schedulers={allSchedulers}
    />
  );
}
