create table if not exists public.wallet_schedulers (
  id text primary key,
  name text not null,
  corporate_name text not null,
  agency_id text not null,
  current_balance numeric not null default 0,
  statement_balance numeric not null default 0,
  max_balance numeric not null default 0,
  alert_threshold numeric not null default 0,
  alert_email text not null default '',
  check_interval_seconds integer not null default 30,
  checks_run integer not null default 0,
  alerts_sent integer not null default 0,
  is_running boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_scheduler_logs (
  id uuid primary key default gen_random_uuid(),
  scheduler_id text not null references public.wallet_schedulers (id) on delete cascade,
  title text not null,
  detail text not null,
  level text not null check (level in ('info', 'success', 'warning', 'error')),
  created_at timestamptz not null default now()
);

create index if not exists wallet_scheduler_logs_scheduler_id_created_at_idx
  on public.wallet_scheduler_logs (scheduler_id, created_at desc);
