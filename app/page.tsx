import Link from "next/link";
import { getSchedulerById, listSchedulers } from "@/lib/wallet-monitoring";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const schedulers = await listSchedulers();

  const freshSchedulers = await Promise.all(
    schedulers.map(async (item) => (await getSchedulerById(item.id)) ?? item),
  );
  const displaySchedulers = freshSchedulers;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,214,153,0.22),_transparent_32%),linear-gradient(180deg,#090807_0%,#12100e_55%,#090807_100%)] px-5 py-8 text-stone-100">
      <div className="mx-auto w-full max-w-6xl">
        <section className="rounded-[34px] border border-white/8 bg-[#1b1815]/90 p-8 shadow-2xl shadow-black/20">
          <p className="text-sm font-semibold uppercase tracking-[0.45em] text-amber-200/80">
            Cygnus wallet monitor
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Wallet monitoring platform for live balance checks and alert control.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-stone-300 md:text-lg">
            Open the wallet dashboard to review the latest stored balance and
            update the alert threshold or email. A separate cron job will sync
            live balance data into Supabase.
          </p>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {displaySchedulers.map((scheduler) => (
            <Link
              key={scheduler.id}
              href={`/wallet/${scheduler.id}`}
              className="group rounded-[30px] border border-white/8 bg-[#2a2521]/95 p-6 shadow-2xl shadow-black/20 transition hover:-translate-y-1 hover:border-amber-300/40 hover:bg-[#322d28]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-50">
                    {scheduler.name}
                  </h2>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    scheduler.isRunning
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-white/8 text-stone-300"
                  }`}
                >
                  {scheduler.isRunning ? "Running" : "Stopped"}
                </div>
              </div>

              <div className="mt-6 space-y-3 text-sm text-stone-300">
                <div className="flex items-center justify-between gap-6">
                  <span>Agency</span>
                  <span className="font-medium text-stone-100">{scheduler.agencyId}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span>Current balance</span>
                  <span className="font-medium text-stone-100">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                    }).format(scheduler.currentBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span>Threshold</span>
                  <span className="font-medium text-stone-100">
                    {new Intl.NumberFormat("en-IN", {
                      style: "currency",
                      currency: "INR",
                    }).format(scheduler.alertThreshold)}
                  </span>
                </div>
              </div>

              <div className="mt-6 text-sm font-semibold text-amber-100/90 transition group-hover:translate-x-1">
                Open wallet monitor
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
