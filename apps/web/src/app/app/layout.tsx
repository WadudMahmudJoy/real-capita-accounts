"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  BookText,
  Building2,
  CalendarClock,
  CalendarRange,
  Coins,
  FileBarChart,
  FolderKanban,
  Landmark,
  Layers,
  ListTree,
  LogOut,
  Network,
  ReceiptText,
  Scale,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  ApiError,
  getCurrentUser,
  logout,
  toErrorMessage,
  type AuthUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, LoadingPanel, Notice } from "./_components/ui";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

const primaryLinks: NavLink[] = [
  {
    href: "/app/company",
    icon: Building2,
    label: "Company Setup",
    match: (pathname) => pathname.startsWith("/app/company"),
  },
  {
    href: "/app/fiscal-years",
    icon: CalendarRange,
    label: "Fiscal Years",
    match: (pathname) => pathname.startsWith("/app/fiscal-years"),
  },
  {
    href: "/app/accounting-periods",
    icon: CalendarClock,
    label: "Accounting Periods",
    match: (pathname) => pathname.startsWith("/app/accounting-periods"),
  },
  {
    href: "/app/projects",
    icon: FolderKanban,
    label: "Projects",
    match: (pathname) => pathname.startsWith("/app/projects"),
  },
  {
    href: "/app/cost-centers",
    icon: Network,
    label: "Cost Centers",
    match: (pathname) => pathname.startsWith("/app/cost-centers"),
  },
  {
    href: "/app/accounts/classes",
    icon: Layers,
    label: "Account Classes",
    match: (pathname) => pathname.startsWith("/app/accounts/classes"),
  },
  {
    href: "/app/accounts/groups",
    icon: ListTree,
    label: "Account Groups",
    match: (pathname) => pathname.startsWith("/app/accounts/groups"),
  },
  {
    href: "/app/accounts/ledger",
    icon: Coins,
    label: "Ledger Accounts",
    match: (pathname) => pathname.startsWith("/app/accounts/ledger"),
  },
  {
    href: "/app/cash-bank",
    icon: Wallet,
    label: "Cash, Bank & MFS",
    match: (pathname) => pathname.startsWith("/app/cash-bank"),
  },
  {
    href: "/app/vouchers",
    icon: ReceiptText,
    label: "Vouchers",
    match: (pathname) => pathname.startsWith("/app/vouchers"),
  },
];

const reportLinks: NavLink[] = [
  {
    href: "/app/reports/ledger",
    icon: BookText,
    label: "Ledger Statement",
    match: (pathname) => pathname.startsWith("/app/reports/ledger"),
  },
  {
    href: "/app/reports/cash-book",
    icon: Banknote,
    label: "Cash Book",
    match: (pathname) => pathname.startsWith("/app/reports/cash-book"),
  },
  {
    href: "/app/reports/bank-book",
    icon: Landmark,
    label: "Bank Book",
    match: (pathname) => pathname.startsWith("/app/reports/bank-book"),
  },
  {
    href: "/app/reports/mfs-book",
    icon: Smartphone,
    label: "MFS Book",
    match: (pathname) => pathname.startsWith("/app/reports/mfs-book"),
  },
  {
    href: "/app/reports/project-ledger",
    icon: FolderKanban,
    label: "Project Ledger",
    match: (pathname) => pathname.startsWith("/app/reports/project-ledger"),
  },
  {
    href: "/app/reports/trial-balance",
    icon: Scale,
    label: "Trial Balance",
    match: (pathname) => pathname.startsWith("/app/reports/trial-balance"),
  },
  {
    href: "/app/reports/income-statement",
    icon: FileBarChart,
    label: "Income Statement",
    match: (pathname) => pathname.startsWith("/app/reports/income-statement"),
  },
  {
    href: "/app/reports/balance-sheet",
    icon: ScrollText,
    label: "Balance Sheet",
    match: (pathname) => pathname.startsWith("/app/reports/balance-sheet"),
  },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      try {
        const currentUser = await getCurrentUser(controller.signal);
        setUser(currentUser);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        setError(toErrorMessage(caught));
        setStatus("error");
      }
    }

    void loadUser();

    return () => controller.abort();
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      // Ignore logout transport errors; the cookie is cleared server-side and
      // the user is leaving the authenticated area regardless.
    } finally {
      setIsLoggingOut(false);
      router.replace("/login");
      router.refresh();
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <LoadingPanel message="Checking secure session..." />
      </main>
    );
  }

  if (status === "error" || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Connection issue</h1>
          <Notice tone="error">
            {error ?? "Authentication is required. Please sign in again."}
          </Notice>
          <Button onClick={() => router.replace("/login")} variant="secondary">
            Back to sign in
          </Button>
        </section>
      </main>
    );
  }

  const roleNames = user.roles.map((role) => role.name).join(", ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full flex-col px-5 py-5 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Accounting foundation
              </p>
              <h1 className="text-lg font-semibold leading-tight">
                Real Capita Accounting &amp; Project Finance System
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {user.fullName}
              </p>
              <p className="text-xs text-muted-foreground">{roleNames}</p>
            </div>
            <Button
              disabled={isLoggingOut}
              onClick={handleLogout}
              variant="secondary"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-6 lg:grid-cols-[240px_1fr]">
          <nav
            aria-label="Accounting navigation"
            className="flex flex-col gap-6 border-b border-border pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6"
          >
            <div className="flex flex-col gap-1">
              {primaryLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.match(pathname);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                    href={link.href}
                    key={link.href}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reports
              </p>
              {reportLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.match(pathname);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                    href={link.href}
                    key={link.href}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
