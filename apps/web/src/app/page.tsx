import { Activity, Database, Server, ShieldCheck } from "lucide-react";

const foundationItems = [
  {
    label: "Frontend",
    status: "Next.js App Router skeleton ready",
    icon: Activity,
  },
  {
    label: "API",
    status: "NestJS health endpoint planned at GET /health",
    icon: Server,
  },
  {
    label: "Database",
    status: "PostgreSQL 17 configured through Docker Compose",
    icon: Database,
  },
  {
    label: "Boundary",
    status: "No business modules added in Phase 0",
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Phase 0 technical foundation
          </p>
          <div className="flex max-w-4xl flex-col gap-4">
            <h1 className="text-4xl font-semibold leading-tight text-balance sm:text-5xl lg:text-6xl">
              Real Capita Accounting & Project Finance System
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              A clean accounting-first foundation for the future voucher,
              journal, ledger, cash book, bank book, trial balance, and
              financial statement workflow.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {foundationItems.map((item) => {
            const Icon = item.icon;

            return (
              <div
                className="flex min-h-32 gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
                key={item.label}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                  <Icon aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">{item.label}</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {item.status}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
