"use client";

import { useEffect, useMemo } from "react";
import { useSchedulerBalance } from "@/lib/balance-context";
import type { WalletScheduler } from "@/lib/types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function SchedulerBalanceSeed({
  scheduler,
}: {
  scheduler: Pick<
    WalletScheduler,
    "id" | "currentBalance" | "statementBalance" | "lastCheckedAt" | "updatedAt"
  >;
}) {
  const snapshot = useMemo(
    () => ({
      id: scheduler.id,
      currentBalance: scheduler.currentBalance,
      statementBalance: scheduler.statementBalance,
      lastCheckedAt: scheduler.lastCheckedAt,
      updatedAt: scheduler.updatedAt,
    }),
    [
      scheduler.id,
      scheduler.currentBalance,
      scheduler.statementBalance,
      scheduler.lastCheckedAt,
      scheduler.updatedAt,
    ],
  );

  const { seedBalance } = useSchedulerBalance(snapshot);

  useEffect(() => {
    seedBalance(snapshot);
  }, [seedBalance, snapshot]);

  return null;
}

export function CurrentBalanceValue({
  scheduler,
}: {
  scheduler: Pick<
    WalletScheduler,
    "id" | "currentBalance" | "statementBalance" | "lastCheckedAt" | "updatedAt"
  >;
}) {
  const { snapshot } = useSchedulerBalance(scheduler);

  return <>{formatMoney(snapshot.currentBalance)}</>;
}
