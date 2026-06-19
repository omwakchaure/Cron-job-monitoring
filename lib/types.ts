export type WalletScheduler = {
  id: string;
  name: string;
  corporateName: string;
  agencyId: string;
  currentBalance: number;
  statementBalance: number;
  maxBalance: number;
  alertThreshold: number;
  alertEmail: string;
  checkIntervalSeconds: number;
  checksRun: number;
  alertsSent: number;
  isRunning: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActivityLog = {
  id: string;
  schedulerId: string;
  title: string;
  detail: string;
  level: "info" | "success" | "warning" | "error";
  createdAt: string;
};

