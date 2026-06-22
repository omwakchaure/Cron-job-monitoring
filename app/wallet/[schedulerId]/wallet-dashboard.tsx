"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CurrentBalanceValue, SchedulerBalanceSeed } from "@/app/current-balance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { ActivityLog, WalletScheduler } from "@/lib/types";

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
  logs: _initialLogs,
  schedulers,
}: DashboardProps) {
  const [scheduler, setScheduler] = useState(initialScheduler);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(initialScheduler.isRunning);
  const [actionMessage, setActionMessage] = useState("Ready to manage threshold and alert settings.");
  const [form, setForm] = useState({
    alertThreshold: String(initialScheduler.alertThreshold),
    alertEmail: initialScheduler.alertEmail,
  });
  void _initialLogs;

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
  }, [form.alertEmail, form.alertThreshold, reloadScheduler, scheduler.id]);

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
    <div className="min-h-screen px-4 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <SchedulerBalanceSeed scheduler={scheduler} />

        <header className="flex items-center justify-between rounded-[22px] border border-border/70 bg-card/80 px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/20 text-sm font-black text-primary">
              C
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-tight text-primary">Cygnus</div>
              <div className="text-sm text-muted-foreground">Wallet monitoring</div>
            </div>
          </div>

          <Badge variant={isRunning ? "success" : "secondary"} className="uppercase tracking-[0.25em]">
            {isRunning ? "Running" : "Stopped"}
          </Badge>
        </header>

        <section className="space-y-2 px-1 sm:px-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {scheduler.name}
          </h1>
          
        </section>


        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label="Current balance"
            value={<CurrentBalanceValue scheduler={scheduler} />}
            helper="Live synced from the current balance context"
            action={
              <Button variant="outline" size="sm" onClick={() => void refreshScheduler()}>
                Refresh
              </Button>
            }
          />
          <MetricCard
            label="Alert threshold"
            value={formatMoney(Number(form.alertThreshold) || scheduler.alertThreshold)}
            helper="Alert when the balance drops below this amount"
          />
          <MetricCard
            label="Last checked"
            value={formatTimestamp(scheduler.lastCheckedAt)}
            helper="Local time"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <Card className="border-border/60 bg-card/90 shadow-2xl shadow-black/20">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="space-y-1">
                <Badge variant="warning" className="w-fit uppercase tracking-[0.25em]">
                  Alert settings
                </Badge>
                <CardTitle className="text-2xl md:text-3xl">Threshold and notification controls</CardTitle>
                <CardDescription>
                  Update the live threshold, notification email, or scheduler state.
                </CardDescription>
              </div>

              <Button variant="outline" onClick={() => void refreshScheduler()}>
                Refresh
              </Button>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="alert-threshold">Alert threshold (INR)</Label>
                  <Input
                    id="alert-threshold"
                    inputMode="decimal"
                    value={form.alertThreshold}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        alertThreshold: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="alert-email">Alert email</Label>
                  <Input
                    id="alert-email"
                    type="email"
                    value={form.alertEmail}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        alertEmail: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void toggleRunning(true)}>Start</Button>
                <Button variant="outline" onClick={() => void toggleRunning(false)}>
                  Stop
                </Button>
                <Button variant="secondary" onClick={() => void saveSettings()} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save settings"}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Balance utilization</span>
                  <span>{utilization.toFixed(1)}%</span>
                </div>
                <Progress value={utilization} />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>₹0</span>
                  <span>{formatMoney(scheduler.maxBalance)}</span>
                </div>
              </div>

              <Separator />

              <p className="text-sm text-muted-foreground">{actionMessage}</p>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/60 bg-card/90 shadow-2xl shadow-black/20">
              <CardHeader>
                <Badge variant="warning" className="w-fit uppercase tracking-[0.25em]">
                  Scheduler list
                </Badge>
                <CardTitle className="text-2xl">Wallet scheduler</CardTitle>
                <CardDescription>Switch between configured schedulers.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {schedulers.map((item) => (
                  <Link key={item.id} href={`/wallet/${item.id}`} className="block">
                    <Card
                      className={
                        item.id === scheduler.id
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/60 bg-background/40 transition hover:border-primary/40 hover:bg-background/60"
                      }
                    >
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-sm text-muted-foreground">{item.agencyId}</div>
                        </div>
                        <Badge variant={item.isRunning ? "success" : "secondary"}>
                          {item.isRunning ? "Running" : "Stopped"}
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </CardContent>
            </Card>
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
  action,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-card/90 shadow-2xl shadow-black/20">
      <CardHeader className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <CardDescription>{label}</CardDescription>
          {action ? <div>{action}</div> : null}
        </div>
        <CardTitle className="text-4xl tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{helper}</CardContent>
    </Card>
  );
}
