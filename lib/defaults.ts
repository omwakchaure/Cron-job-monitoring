import type { WalletScheduler } from "./types";

export const DEFAULT_CHECK_INTERVALS = [30, 60, 120, 300] as const;

export const DEFAULT_WALLET_SCHEDULER: Pick<
  WalletScheduler,
  | "id"
  | "name"
  | "corporateName"
  | "agencyId"
  | "currentBalance"
  | "statementBalance"
  | "maxBalance"
  | "alertThreshold"
  | "alertEmail"
  | "checkIntervalSeconds"
  | "checksRun"
  | "alertsSent"
  | "isRunning"
  | "lastCheckedAt"
  | "createdAt"
  | "updatedAt"
> = {
  id: "cygnus-main",
  name: "Cygnus Wallet Monitor",
  corporateName: "Cygnus Voyages Pvt. Ltd.",
  agencyId: "EMTIN39617143",
  currentBalance: 119746,
  statementBalance: 119746.44,
  maxBalance: 410000,
  alertThreshold: 20000,
  alertEmail: "operations@bookcygnus.com",
  checkIntervalSeconds: 30,
  checksRun: 0,
  alertsSent: 0,
  isRunning: false,
  lastCheckedAt: new Date("2026-06-19T14:32:00+05:30").toISOString(),
  createdAt: new Date("2026-06-19T14:00:00+05:30").toISOString(),
  updatedAt: new Date("2026-06-19T14:32:00+05:30").toISOString(),
};
