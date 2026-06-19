"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ActivityLog, WalletScheduler } from "@/lib/types";
import { CurrentBalanceValue, SchedulerBalanceSeed } from "@/app/current-balance";
import type { ReactNode } from "react";

type DashboardProps = {
  scheduler: WalletScheduler;
  logs: ActivityLog[];
  schedulers: WalletScheduler[];
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function WalletDashboard({
  scheduler: initialScheduler,
  logs: initialLogs,
  schedulers,
}: DashboardProps) {
  const [scheduler, setScheduler] = useState(initialScheduler);
  const [logs, setLogs] = useState(initialLogs);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(initialScheduler.isRunning);
  const [actionMessage, setActionMessage] = useState(
    "Ready to manage threshold and alert settings.",
  );
  const [form, setForm] = useState({
    alertThreshold: String(initialScheduler.alertThreshold),
    alertEmail: initialScheduler.alertEmail,
  });

  const timerRef = useRef<number | null>(null);

  const utilization = useMemo(() => {
    if (!scheduler.maxBalance) {
      return 0;
    }

    return Math.min(100, (scheduler.currentBalance / scheduler.maxBalance) * 100);
  }, [scheduler.currentBalance, scheduler.maxBalance]);

  const reloadScheduler = useCallback(async () => {
    setActionMessage("Reloading saved balance...");
    const response = await fetch(`/api/schedulers/${scheduler.id}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to reload scheduler");
    }

    const data = (await response.json()) as {
      scheduler: WalletScheduler;
      logs: ActivityLog[];
    };

    setScheduler(data.scheduler);
    setLogs(data.logs);
    setIsRunning(data.scheduler.isRunning);
    setForm({
      alertThreshold: String(data.scheduler.alertThreshold),
      alertEmail: data.scheduler.alertEmail,
    });
  }, [scheduler.id]);

  const refreshScheduler = useCallback(async () => {
    setActionMessage("Running a live balance check...");
    const balanceResponse = await fetch(`/api/schedulers/${scheduler.id}/balance`, {
      method: "POST",
    });

    if (!balanceResponse.ok) {
      throw new Error("Failed to refresh live balance");
    }

    await reloadScheduler();
    setActionMessage("Balance synced.");
  }, [reloadScheduler, scheduler.id]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    setActionMessage("Saving settings to Supabase...");
    try {
      const response = await fetch(`/api/schedulers/${scheduler.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alertThreshold: Number(form.alertThreshold),
          alertEmail: form.alertEmail,
        }),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      await reloadScheduler();
      setActionMessage("Settings saved.");
    } finally {
      setIsSaving(false);
    }
  }, [
    form.alertEmail,
    form.alertThreshold,
    reloadScheduler,
    scheduler.id,
  ]);

  const toggleRunning = useCallback(
    async (nextRunning: boolean) => {
      setActionMessage(nextRunning ? "Starting scheduler..." : "Stopping scheduler...");
      const response = await fetch(`/api/schedulers/${scheduler.id}/controls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: nextRunning ? "start" : "stop",
        }),
      });

      if (!response.ok) {
        setActionMessage("Control action failed.");
        return;
      }

      await reloadScheduler();
      setActionMessage(nextRunning ? "Scheduler started." : "Scheduler stopped.");
    },
    [reloadScheduler, scheduler.id],
  );

  useEffect(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!isRunning) {
      return;
    }

    const intervalMs = Number(scheduler.checkIntervalSeconds) * 1000;
    timerRef.current = window.setInterval(() => {
      void reloadScheduler();
    }, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 30000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, reloadScheduler, scheduler.checkIntervalSeconds]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reloadScheduler();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [reloadScheduler]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,208,112,0.16),_transparent_28%),linear-gradient(180deg,#0d0c0b_0%,#14110f_54%,#0b0a09_100%)] text-stone-100">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-5 py-6 lg:px-8">
        <SchedulerBalanceSeed scheduler={scheduler} />
        <header className="flex flex-col gap-4 rounded-[28px] border border-white/8 bg-[#1b1815]/90 p-5 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/80">
              Cygnus wallet monitor
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-50 md:text-4xl">
              {scheduler.name}
            </h1>
            <p className="max-w-3xl text-sm text-stone-300">
              Monitor the stored wallet balance, adjust threshold and alert
              email, and keep Supabase as the source of truth for every sync.
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-300 md:min-w-80">
            <div className="flex items-center justify-between gap-6">
              <span>Scheduler state</span>
              <span className={isRunning ? "text-emerald-300" : "text-stone-400"}>
                {isRunning ? "Running" : "Stopped"}
              </span>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Current balance"
            value={<CurrentBalanceValue scheduler={scheduler} />}
            helper="INR"
          />
          <MetricCard
            label="Alert threshold"
            value={formatMoney(Number(form.alertThreshold) || scheduler.alertThreshold)}
            helper="alert when below"
          />
          <MetricCard label="Last checked" value={formatTimestamp(scheduler.lastCheckedAt)} helper="local time" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-[30px] border border-white/8 bg-[#2a2521]/95 p-6 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/80">
              Alert settings
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
              Threshold and notification controls
            </h2>
              </div>

              <button
                onClick={() => void refreshScheduler()}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-stone-100 transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-300">Alert threshold (INR)</span>
                <input
                  value={form.alertThreshold}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      alertThreshold: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-[#34302b] px-4 py-4 text-base text-stone-100 outline-none transition focus:border-amber-200/60"
                  />
                </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-stone-300">Alert email</span>
                <input
                  value={form.alertEmail}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      alertEmail: event.target.value,
                    }))
                  }
                  className="rounded-2xl border border-white/10 bg-[#34302b] px-4 py-4 text-base text-stone-100 outline-none transition focus:border-amber-200/60"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => void toggleRunning(true)}
                className="rounded-2xl bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-3 font-semibold text-stone-950 transition hover:brightness-110"
              >
                Start
              </button>
              <button
                onClick={() => void toggleRunning(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-stone-100 transition hover:bg-white/10"
              >
                Stop
              </button>
              <button
                onClick={() => void saveSettings()}
                disabled={isSaving}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-stone-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save settings"}
              </button>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between text-sm font-medium text-stone-300">
                <span>Balance utilization</span>
                <span>{utilization.toFixed(1)}%</span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-amber-200 to-amber-500 transition-all duration-500"
                  style={{ width: `${utilization}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-stone-400">
                <span>₹0</span>
                <span>{formatMoney(scheduler.maxBalance)}</span>
              </div>
            </div>

            <p className="mt-5 text-sm text-stone-300">{actionMessage}</p>
          </div>

          <div className="rounded-[30px] border border-white/8 bg-[#2a2521]/95 p-6 shadow-2xl shadow-black/20">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/80">
              Scheduler list
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-50">
              Wallet scheduler
            </h2>
            <div className="mt-6 space-y-3">
              {schedulers.map((item) => (
                <Link
                  key={item.id}
                  href={`/wallet/${item.id}`}
                  className={`block rounded-2xl border px-4 py-4 transition ${
                    item.id === scheduler.id
                      ? "border-amber-300/50 bg-amber-300/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-stone-50">{item.name}</div>
                      <div className="mt-1 text-sm text-stone-400">{item.agencyId}</div>
                    </div>
                    <div className={item.isRunning ? "text-emerald-300" : "text-stone-400"}>
                      {item.isRunning ? "Running" : "Stopped"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-stone-300">
              <div className="font-semibold text-stone-50">Current source</div>
              <div className="mt-1">{scheduler.corporateName}</div>
              <div className="mt-3 flex items-center justify-between">
                <span>Alert email</span>
                <span className="font-semibold text-stone-50">{scheduler.alertEmail}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Dashboard rows</span>
                <span className="font-semibold text-stone-50">{schedulers.length}</span>
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-stone-300">
              <div className="font-semibold text-stone-50">Recent activity</div>
              <div className="mt-3 space-y-3">
                {logs.slice(0, 4).map((log) => (
                  <div key={log.id} className="rounded-2xl border border-white/10 bg-[#1f1b18] p-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-stone-100">{log.title}</span>
                      <span className="text-xs uppercase tracking-[0.25em] text-stone-500">
                        {log.level}
                      </span>
                    </div>
                    <div className="mt-1 text-xs leading-5 text-stone-400">{log.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[#2a2521]/95 p-5 shadow-2xl shadow-black/20">
      <div className="text-sm font-medium text-stone-400">{label}</div>
      <div className="mt-3 text-4xl font-semibold tracking-tight text-stone-50">{value}</div>
      <div className="mt-2 text-sm text-stone-500">{helper}</div>
    </div>
  );
}
