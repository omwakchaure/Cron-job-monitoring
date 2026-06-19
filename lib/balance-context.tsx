"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { WalletScheduler } from "./types";

type BalanceSnapshot = Pick<
  WalletScheduler,
  "id" | "currentBalance" | "statementBalance" | "lastCheckedAt" | "updatedAt"
>;

type BalanceContextValue = {
  balances: Record<string, BalanceSnapshot>;
  seedBalance: (snapshot: BalanceSnapshot) => void;
};

const BalanceContext = createContext<BalanceContextValue | null>(null);

function isNewerSnapshot(current: BalanceSnapshot | undefined, next: BalanceSnapshot) {
  if (!current) {
    return true;
  }

  return new Date(next.updatedAt).getTime() > new Date(current.updatedAt).getTime();
}

export function BalanceProvider({ children }: { children: React.ReactNode }) {
  const [balances, setBalances] = useState<Record<string, BalanceSnapshot>>({});

  const seedBalance = useCallback((snapshot: BalanceSnapshot) => {
    setBalances((current) => {
      if (!isNewerSnapshot(current[snapshot.id], snapshot)) {
        return current;
      }

      return {
        ...current,
        [snapshot.id]: snapshot,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      balances,
      seedBalance,
    }),
    [balances, seedBalance],
  );

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export function useBalanceContext() {
  const context = useContext(BalanceContext);

  if (!context) {
    throw new Error("useBalanceContext must be used within a BalanceProvider");
  }

  return context;
}

export function useSchedulerBalance(
  scheduler: Pick<
    WalletScheduler,
    "id" | "currentBalance" | "statementBalance" | "lastCheckedAt" | "updatedAt"
  >,
) {
  const { balances, seedBalance } = useBalanceContext();
  const snapshot = balances[scheduler.id] ?? scheduler;

  return {
    snapshot,
    seedBalance,
  };
}
