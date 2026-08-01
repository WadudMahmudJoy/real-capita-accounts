"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Banknote,
  BarChart3,
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
  Smartphone,
  Users,
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

const customerBookingLinks: NavLink[] = [
  {
    href: "/app/customers",
    icon: Users,
    label: "Customers",
    match: (pathname) => pathname.startsWith("/app/customers"),
  },
  {
    href: "/app/bookable-items",
    icon: Layers,
    label: "Bookable Items",
    match: (pathname) => pathname.startsWith("/app/bookable-items"),
  },
  {
    href: "/app/bookings",
    icon: BookText,
    label: "Booking Control",
    match: (pathname) => pathname.startsWith("/app/bookings"),
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
    href: "/app/reports/project-cost",
    icon: FileBarChart,
    label: "Project Cost",
    match: (pathname) => pathname.startsWith("/app/reports/project-cost"),
  },
  {
    href: "/app/reports/cost-center-summary",
    icon: Network,
    label: "Cost Center Summary",
    match: (pathname) =>
      pathname.startsWith("/app/reports/cost-center-summary"),
  },
  {
    href: "/app/reports/project-financial-summary",
    icon: BarChart3,
    label: "Project Financial Summary",
    match: (pathname) =>
      pathname.startsWith("/app/reports/project-financial-summary"),
  },
  {
    href: "/app/reports/project-fund-movement",
    icon: Coins,
    label: "Project Fund Movement",
    match: (pathname) =>
      pathname.startsWith("/app/reports/project-fund-movement"),
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
      <div className="mx-auto flex min-h-screen w-full flex-col px-5 py-5 sm:px-8 lg:h-screen lg:min-h-0 lg:overflow-hidden">
        <header className="flex flex-col gap-4 border-b border-border bg-card pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Image
              alt=""
              className="size-10 object-contain"
              height={1641}
              priority
              src="/brand/real-capita-group-mark.png"
              width={1618}
            />
            <div>
              <p className="text-sm font-bold tracking-wide text-heading">
                REAL CAPITA GROUP
              </p>
              <p className="text-sm leading-tight text-muted-foreground">
                Accounting &amp; Project Finance System
              </p>
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
              className="border-border-strong bg-card hover:border-primary/30 hover:bg-accent"
              disabled={isLoggingOut}
              onClick={handleLogout}
              variant="secondary"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </header>

        <div className="grid flex-1 gap-8 py-6 lg:min-h-0 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-0">
          <nav
            aria-label="Accounting navigation"
            className="app-sidebar flex flex-col gap-6 border-b border-border pb-6 lg:w-[240px] lg:overflow-y-auto lg:overscroll-contain lg:rounded-xl lg:border-0 lg:bg-[linear-gradient(180deg,var(--sidebar-blue)_0%,var(--sidebar-teal)_52%,var(--sidebar-green)_100%)] lg:px-3 lg:py-3"
          >
            <div className="flex flex-col gap-1">
              {primaryLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.match(pathname);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition duration-200 focus-visible:outline-none lg:focus-visible:ring-2 lg:focus-visible:ring-brand-light/70 lg:focus-visible:ring-inset motion-reduce:transform-none motion-reduce:transition-none",
                      isActive
                        ? "bg-secondary text-foreground lg:bg-white/15 lg:text-brand-light lg:shadow-[inset_3px_0_0_var(--brand-green),0_6px_18px_rgba(8,67,75,0.14)]"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground lg:text-brand-light/90 lg:hover:translate-x-0.5 lg:hover:bg-white/10 lg:hover:text-white lg:hover:shadow-[0_5px_14px_rgba(8,67,75,0.12)]",
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
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:text-sidebar-muted">
                Customers &amp; Bookings
              </p>
              {customerBookingLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.match(pathname);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition duration-200 focus-visible:outline-none lg:focus-visible:ring-2 lg:focus-visible:ring-brand-light/70 lg:focus-visible:ring-inset motion-reduce:transform-none motion-reduce:transition-none",
                      isActive
                        ? "bg-secondary text-foreground lg:bg-white/15 lg:text-brand-light lg:shadow-[inset_3px_0_0_var(--brand-green),0_6px_18px_rgba(8,67,75,0.14)]"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground lg:text-brand-light/90 lg:hover:translate-x-0.5 lg:hover:bg-white/10 lg:hover:text-white lg:hover:shadow-[0_5px_14px_rgba(8,67,75,0.12)]",
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
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:text-sidebar-muted">
                Reports
              </p>
              {reportLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.match(pathname);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition duration-200 focus-visible:outline-none lg:focus-visible:ring-2 lg:focus-visible:ring-brand-light/70 lg:focus-visible:ring-inset motion-reduce:transform-none motion-reduce:transition-none",
                      isActive
                        ? "bg-secondary text-foreground lg:bg-white/15 lg:text-brand-light lg:shadow-[inset_3px_0_0_var(--brand-green),0_6px_18px_rgba(8,67,75,0.14)]"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground lg:text-brand-light/90 lg:hover:translate-x-0.5 lg:hover:bg-white/10 lg:hover:text-white lg:hover:shadow-[0_5px_14px_rgba(8,67,75,0.12)]",
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

          <main className="min-w-0 bg-background lg:overflow-y-auto lg:pl-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
