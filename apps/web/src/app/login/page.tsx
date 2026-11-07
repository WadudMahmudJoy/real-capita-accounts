"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
    <main className="relative isolate min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-brand-blue/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 size-96 rounded-full bg-brand-green/10 blur-3xl"
      />
      <section className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
        <form
          className="flex w-full max-w-[480px] flex-col gap-6 rounded-[20px] border border-border bg-card p-8 text-card-foreground shadow-[0_24px_60px_rgba(13,78,88,0.14)] sm:p-10"
          onSubmit={handleSubmit}
        >
          <Image
            alt="Real Capita Group"
            className="h-auto w-full max-w-[350px] self-center"
            height={1545}
            priority
            src="/brand/real-capita-group-wordmark.png"
            width={7735}
          />

          <div className="flex flex-col items-center gap-1.5 text-center">
            <h1 className="text-xl font-semibold text-heading">
              Accounting &amp; Project Finance System
            </h1>
            <p className="text-sm text-muted-foreground">
              Secure access for authorized users
            </p>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Email
            <input
              autoComplete="email"
              className="h-12 rounded-md border border-input bg-input-surface px-3 text-base outline-none transition duration-200 focus:border-ring focus:ring-2 focus:ring-brand-teal/20"
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
              className="h-12 rounded-md border border-input bg-input-surface px-3 text-base outline-none transition duration-200 focus:border-ring focus:ring-2 focus:ring-brand-teal/20"
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
            className="h-12 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
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
