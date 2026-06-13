"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  FolderKanban,
  LogOut,
  Settings,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  API_BASE_URL,
  type AuthResponse,
  type AuthUser,
  readApiError,
} from "@/lib/api";

const navigationItems = [
  { label: "Company Setup later", icon: Building2 },
  { label: "Projects later", icon: FolderKanban },
  { label: "Transactions later", icon: WalletCards },
  { label: "Accounts later", icon: CircleDollarSign },
  { label: "Reports later", icon: FileText },
  { label: "Settings later", icon: Settings },
];

export default function AppPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUser() {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include",
          signal: controller.signal,
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }

        const body = (await response.json()) as AuthResponse;
        setUser(body.user);
      } catch {
        if (!controller.signal.aborted) {
          setError(`Unable to reach the API at ${API_BASE_URL}.`);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => controller.abort();
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    setError(null);

    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        credentials: "include",
        method: "POST",
      });
    } finally {
      setIsLoggingOut(false);
      router.replace("/login");
      router.refresh();
    }
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          Checking secure session...
        </div>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Connection issue</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {error ?? "Authentication is required. Please sign in again."}
          </p>
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
            onClick={() => router.replace("/login")}
            type="button"
          >
            Back to sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Phase 1A secure shell
              </p>
              <h1 className="text-xl font-semibold">
                Real Capita Accounting & Project Finance System
              </h1>
            </div>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={handleLogout}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[260px_1fr]">
          <nav
            aria-label="Placeholder navigation"
            className="flex flex-col gap-2 border-b border-border pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5"
          >
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  className="flex h-11 cursor-default items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-muted-foreground"
                  disabled
                  key={item.label}
                  type="button"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <section className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <ClipboardList aria-hidden="true" className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold">Signed in user</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {user.fullName}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <ShieldCheck aria-hidden="true" className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold">Current role</h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {user.roles.map((role) => role.name).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                Phase 1A secure shell is active
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Authentication and backend session authorization are ready for
                the confirmed Accountant role. The navigation labels are
                placeholders only; no accounting module pages are implemented
                in this phase.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
