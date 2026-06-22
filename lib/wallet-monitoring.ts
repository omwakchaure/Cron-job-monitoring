import "server-only";

import { DEFAULT_WALLET_SCHEDULER } from "./defaults";
import { getSupabaseAdmin } from "./supabase";
import type { ActivityLog, WalletScheduler } from "./types";

type MonitorRecord = {
  id: string;
  name: string;
  corporate_name: string;
  agency_id: string;
  current_balance: number;
  statement_balance: number;
  max_balance: number;
  alert_threshold: number;
  alert_email: string;
  check_interval_seconds: number;
  checks_run: number;
  alerts_sent: number;
  is_running: boolean;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

type LogRecord = {
  id: string;
  scheduler_id: string;
  title: string;
  detail: string;
  level: ActivityLog["level"];
  created_at: string;
};

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

function toScheduler(record: MonitorRecord): WalletScheduler {
  return {
    id: record.id,
    name: record.name,
    corporateName: record.corporate_name,
    agencyId: record.agency_id,
    currentBalance: Number(record.current_balance),
    statementBalance: Number(record.statement_balance),
    maxBalance: Number(record.max_balance),
    alertThreshold: Number(record.alert_threshold),
    alertEmail: record.alert_email,
    checkIntervalSeconds: Number(record.check_interval_seconds),
    checksRun: Number(record.checks_run),
    alertsSent: Number(record.alerts_sent),
    isRunning: record.is_running,
    lastCheckedAt: record.last_checked_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function toSchedulerRow(scheduler: WalletScheduler) {
  return {
    id: scheduler.id,
    name: scheduler.name,
    corporate_name: scheduler.corporateName,
    agency_id: scheduler.agencyId,
    current_balance: scheduler.currentBalance,
    statement_balance: scheduler.statementBalance,
    max_balance: scheduler.maxBalance,
    alert_threshold: scheduler.alertThreshold,
    alert_email: scheduler.alertEmail,
    check_interval_seconds: scheduler.checkIntervalSeconds,
    checks_run: scheduler.checksRun,
    alerts_sent: scheduler.alertsSent,
    is_running: scheduler.isRunning,
    last_checked_at: scheduler.lastCheckedAt,
    created_at: scheduler.createdAt,
    updated_at: scheduler.updatedAt,
  };
}

function toLog(record: LogRecord): ActivityLog {
  return {
    id: record.id,
    schedulerId: record.scheduler_id,
    title: record.title,
    detail: record.detail,
    level: record.level,
    createdAt: record.created_at,
  };
}

function syncFallbackScheduler(scheduler: WalletScheduler) {
  fallbackStore.schedulers.set(scheduler.id, { ...scheduler });
}

function syncFallbackSchedulers(schedulers: WalletScheduler[]) {
  fallbackStore.schedulers.clear();
  for (const scheduler of schedulers) {
    syncFallbackScheduler(scheduler);
  }
}

function syncFallbackLogs(schedulerId: string, logs: ActivityLog[]) {
  fallbackStore.logs.set(
    schedulerId,
    logs.map((item) => ({ ...item })),
  );
}

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
  if (fallbackStore.schedulers.size > 0 && fallbackStore.logs.size > 0) {
    return;
  }

  if (fallbackStore.schedulers.size === 0) {
    fallbackStore.schedulers.set(DEFAULT_WALLET_SCHEDULER.id, {
      ...DEFAULT_WALLET_SCHEDULER,
    });
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

async function ensureSupabaseSeeded(db: ReturnType<typeof getSupabaseAdmin>) {
  if (!db) {
    return;
  }

  const { count, error } = await db
    .from("wallet_schedulers")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  const { error: insertError } = await db.from("wallet_schedulers").upsert([
    toSchedulerRow(DEFAULT_WALLET_SCHEDULER),
  ]);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

async function fetchSchedulersFromDb() {
  const db = getSupabaseAdmin();
  if (!db) {
    ensureFallbackSeeded();
    return getFallbackSchedulers();
  }

  try {
    await ensureSupabaseSeeded(db);

    const { data, error } = await db
      .from("wallet_schedulers")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const schedulers = (data ?? []).map((item) => toScheduler(item as MonitorRecord));
    if (schedulers.length > 0) {
      syncFallbackSchedulers(schedulers);
    }

    return schedulers;
  } catch {
    ensureFallbackSeeded();
    return getFallbackSchedulers();
  }
}

async function fetchSchedulerLogsFromDb(schedulerId: string) {
  const db = getSupabaseAdmin();
  if (!db) {
    ensureFallbackSeeded();
    return getFallbackLogs(schedulerId);
  }

  try {
    const { data, error } = await db
      .from("wallet_scheduler_logs")
      .select("*")
      .eq("scheduler_id", schedulerId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (error) {
      throw new Error(error.message);
    }

    const logs = (data ?? []).map((item) => toLog(item as LogRecord));
    syncFallbackLogs(schedulerId, logs);
    return logs;
  } catch {
    ensureFallbackSeeded();
    return getFallbackLogs(schedulerId);
  }
}

export async function listSchedulers() {
  return fetchSchedulersFromDb();
}

export async function getSchedulerById(id: string) {
  const schedulers = await fetchSchedulersFromDb();
  return schedulers.find((scheduler) => scheduler.id === id) ?? null;
}

export async function getSchedulerLogs(id: string) {
  return fetchSchedulerLogsFromDb(id);
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
  const db = getSupabaseAdmin();
  const nextUpdatedAt = new Date().toISOString();

  if (db) {
    try {
      await ensureSupabaseSeeded(db);

      const { data: currentRow, error: readError } = await db
        .from("wallet_schedulers")
        .select("*")
        .eq("id", schedulerId)
        .maybeSingle();

      if (readError) {
        throw new Error(readError.message);
      }

      const existing =
        currentRow !== null
          ? toScheduler(currentRow as MonitorRecord)
          : fallbackStore.schedulers.get(schedulerId) ?? null;

      if (!existing) {
        return null;
      }

      const nextScheduler = {
        ...existing,
        ...patch,
        updatedAt: nextUpdatedAt,
      };

      const { error: writeError } = await db.from("wallet_schedulers").upsert([
        toSchedulerRow(nextScheduler),
      ]);

      if (writeError) {
        throw new Error(writeError.message);
      }

      syncFallbackScheduler(nextScheduler);
      return { ...nextScheduler };
    } catch {
      // Fall through to fallback memory below.
    }
  }

  const existing = fallbackStore.schedulers.get(schedulerId) ?? null;
  if (!existing) {
    return null;
  }

  const nextScheduler = {
    ...existing,
    ...patch,
    updatedAt: nextUpdatedAt,
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
  const db = getSupabaseAdmin();

  if (db) {
    try {
      const { data, error } = await db
        .from("wallet_scheduler_logs")
        .insert({
          scheduler_id: schedulerId,
          title: entry.title,
          detail: entry.detail,
          level: entry.level,
          created_at: createdAt,
        })
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      const log = toLog(data as LogRecord);
      const currentLogs = fallbackStore.logs.get(schedulerId) ?? [];
      fallbackStore.logs.set(schedulerId, [log, ...currentLogs]);
      return log;
    } catch {
      // Fall through to fallback memory below.
    }
  }

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
