"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { API_BASE_URL, readApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("accountant@realcapita.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        body: JSON.stringify({ email, password }),
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError(`Unable to reach the API at ${API_BASE_URL}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_420px] lg:px-10">
        <div className="flex max-w-2xl flex-col gap-6">
          <div className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" className="size-6" />
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-semibold leading-tight text-balance sm:text-5xl">
              Real Capita Accounting & Project Finance System
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Phase 1A secure shell for the confirmed Accountant operator.
              Business modules remain locked until their phase is approved.
            </p>
          </div>
        </div>

        <form
          className="flex w-full flex-col gap-5 rounded-lg border border-border bg-card p-6 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <LockKeyhole aria-hidden="true" className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Sign in</h2>
              <p className="text-sm text-muted-foreground">
                Use the development Accountant account.
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input
              autoComplete="current-password"
              className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/25"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <button
            className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
