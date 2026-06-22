import "server-only";

import { DEFAULT_WALLET_SCHEDULER } from "./defaults";
import type { ActivityLog, WalletScheduler } from "./types";

const globalForMonitor = globalThis as typeof globalThis & {
  __walletMonitorTimers?: Map<string, ReturnType<typeof setInterval>>;
  __walletMonitorStore?: {
    schedulers: Map<string, WalletScheduler>;
    logs: Map<string, ActivityLog[]>;
  };
};

const localTimers =
  globalForMonitor.__walletMonitorTimers ??
  new Map<string, ReturnType<typeof setInterval>>();

globalForMonitor.__walletMonitorTimers = localTimers;

const fallbackStore =
  globalForMonitor.__walletMonitorStore ??
  (() => {
    const schedulers = new Map<string, WalletScheduler>();
    schedulers.set(DEFAULT_WALLET_SCHEDULER.id, { ...DEFAULT_WALLET_SCHEDULER });

    return {
      schedulers,
      logs: new Map<string, ActivityLog[]>(),
    };
  })();

globalForMonitor.__walletMonitorStore = fallbackStore;

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function getFallbackSchedulers(): WalletScheduler[] {
  return Array.from(fallbackStore.schedulers.values()).map((scheduler) => ({
    ...scheduler,
  }));
}

function getFallbackLogs(schedulerId?: string): ActivityLog[] {
  if (!schedulerId) {
    return Array.from(fallbackStore.logs.values()).flatMap((items) =>
      items.map((item) => ({ ...item })),
    );
  }

  return (fallbackStore.logs.get(schedulerId) ?? []).map((item) => ({ ...item }));
}

function ensureFallbackSeeded() {
  if (fallbackStore.logs.size > 0) {
    return;
  }

  const seedLog: ActivityLog = {
    id: crypto.randomUUID(),
    schedulerId: "cygnus-main",
    title: "Dashboard ready",
    detail: "Monitoring platform loaded with local fallback state.",
    level: "info",
    createdAt: new Date().toISOString(),
  };

  fallbackStore.logs.set(seedLog.schedulerId, [seedLog]);
}

export async function listSchedulers() {
  ensureFallbackSeeded();
  return getFallbackSchedulers();
}

export async function getSchedulerById(id: string) {
  ensureFallbackSeeded();
  const schedulers = getFallbackSchedulers();
  return schedulers.find((scheduler) => scheduler.id === id) ?? null;
}

export async function getSchedulerLogs(id: string) {
  ensureFallbackSeeded();
  return getFallbackLogs(id);
}

export async function upsertScheduler(
  schedulerId: string,
  patch: Partial<
    Pick<
      WalletScheduler,
      | "name"
      | "corporateName"
      | "agencyId"
      | "currentBalance"
      | "statementBalance"
      | "maxBalance"
      | "alertThreshold"
      | "alertEmail"
      | "checkIntervalSeconds"
      
      | "isRunning"
      | "lastCheckedAt"
    >
  >,
) {
  const existing = fallbackStore.schedulers.get(schedulerId) ?? null;
  if (!existing) {
    return null;
  }

  const nextScheduler = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  fallbackStore.schedulers.set(schedulerId, nextScheduler);
  return { ...nextScheduler };
}

export async function addSchedulerLog(
  schedulerId: string,
  entry: Omit<ActivityLog, "id" | "schedulerId" | "createdAt"> & {
    createdAt?: string;
  },
) {
  const createdAt = entry.createdAt ?? new Date().toISOString();

  ensureFallbackSeeded();
  const log = {
    id: crypto.randomUUID(),
    schedulerId,
    title: entry.title,
    detail: entry.detail,
    level: entry.level,
    createdAt,
  } satisfies ActivityLog;

  const currentLogs = fallbackStore.logs.get(schedulerId) ?? [];
  fallbackStore.logs.set(schedulerId, [log, ...currentLogs]);
  return log;
}

export async function fetchLatestBalance() {
  const payload = {
    Password: process.env.CYGNUS_BALANCE_PASSWORD ?? "",
    UserName: process.env.CYGNUS_BALANCE_USERNAME ?? "Cygnus",
  };

  const response = await fetch(
    process.env.CYGNUS_BALANCE_URL ??
      "https://fastapi-proxy-production-efc6.up.railway.app/prod/Flight.svc/json/GetBookingBalance",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Balance API failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    AgencyId: string;
    BookingBalance: number;
    StatementBalance: number;
    error: string | null;
  };

  return {
    agencyId: data.AgencyId,
    bookingBalance: Number(data.BookingBalance ?? 0),
    statementBalance: Number(data.StatementBalance ?? 0),
    error: data.error,
  };
}

export async function runBalanceCheck(schedulerId: string) {
  const scheduler = await getSchedulerById(schedulerId);
  if (!scheduler) {
    throw new Error("Scheduler not found");
  }

  const balancePayload = await fetchLatestBalance();
  const currentBalance = Number(balancePayload.bookingBalance ?? 0);
  const statementBalance = Number(balancePayload.statementBalance ?? 0);
  const now = new Date().toISOString();
  const shouldAlert = currentBalance <= scheduler.alertThreshold;

  await upsertScheduler(schedulerId, {
    currentBalance,
    lastCheckedAt: now,
  });

  const logs: ActivityLog[] = [];
  logs.push(
    await addSchedulerLog(schedulerId, {
      title: "Balance checked",
      detail: `Booking balance ${formatMoney(currentBalance)} and statement balance ${formatMoney(statementBalance)} synced from the API.`,
      level: "success",
    }),
  );

  if (shouldAlert) {
    logs.push(
      await addSchedulerLog(schedulerId, {
        title: "Alert threshold reached",
        detail: `Balance ${formatMoney(currentBalance)} is at or below threshold ${formatMoney(scheduler.alertThreshold)}. Send alert to ${scheduler.alertEmail}.`,
        level: "warning",
      }),
    );
  }

  return {
    currentBalance,
    statementBalance,
    threshold: scheduler.alertThreshold,
    alertEmail: scheduler.alertEmail,
    shouldAlert,
    logs,
  };
}

export function getTimerState() {
  return localTimers;
}

export async function startScheduler(schedulerId: string) {
  const scheduler = await getSchedulerById(schedulerId);
  if (!scheduler) {
    throw new Error("Scheduler not found");
  }

  if (localTimers.has(schedulerId)) {
    return scheduler;
  }

  await upsertScheduler(schedulerId, { isRunning: true });
  const intervalMs = Math.max(5, scheduler.checkIntervalSeconds) * 1000;

  const timer = setInterval(() => {
    void runBalanceCheck(schedulerId).catch(() => undefined);
  }, intervalMs);

  localTimers.set(schedulerId, timer);
  await addSchedulerLog(schedulerId, {
    title: "Scheduler started",
    detail: `Monitoring enabled every ${scheduler.checkIntervalSeconds} seconds.`,
    level: "success",
  });

  return getSchedulerById(schedulerId);
}

export async function stopScheduler(schedulerId: string) {
  const timer = localTimers.get(schedulerId);
  if (timer) {
    clearInterval(timer);
    localTimers.delete(schedulerId);
  }

  await upsertScheduler(schedulerId, { isRunning: false });
  await addSchedulerLog(schedulerId, {
    title: "Scheduler stopped",
    detail: "Monitoring paused from the frontend.",
    level: "info",
  });

  return getSchedulerById(schedulerId);
}
