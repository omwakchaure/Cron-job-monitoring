import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSchedulerById, listSchedulers } from "@/lib/wallet-monitoring";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const schedulers = await listSchedulers();

  const freshSchedulers = await Promise.all(
    schedulers.map(async (item) => (await getSchedulerById(item.id)) ?? item),
  );

  return (
    <main className="min-h-screen px-4 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
        <header className="flex items-center justify-between rounded-[22px] border border-border/70 bg-card/80 px-5 py-4 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/20 text-sm font-black text-primary">
              C
            </div>
            <div className="text-3xl font-semibold tracking-tight text-primary">
              Cygnus
            </div>
          </div>

        </header>

      

       

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {freshSchedulers.map((scheduler) => (
            <Link key={scheduler.id} href={`/wallet/${scheduler.id}`} className="group block transition hover:-translate-y-1">
              <Card className="h-full border-border/60 bg-card/90 shadow-2xl shadow-black/20 transition group-hover:border-primary/40 group-hover:bg-card/95">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl">{scheduler.name}</CardTitle>
                      <CardDescription>{scheduler.corporateName}</CardDescription>
                    </div>
                    <Badge variant={scheduler.isRunning ? "success" : "secondary"}>
                      {scheduler.isRunning ? "Running" : "Stopped"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-6">
                      <span>Agency</span>
                      <span className="font-medium text-foreground">{scheduler.agencyId}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <span>Current balance</span>
                      <span className="font-medium text-foreground">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                        }).format(scheduler.currentBalance)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-6">
                      <span>Threshold</span>
                      <span className="font-medium text-foreground">
                        {new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                        }).format(scheduler.alertThreshold)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="text-sm font-medium text-primary transition group-hover:translate-x-1">
                    Open wallet monitor
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
