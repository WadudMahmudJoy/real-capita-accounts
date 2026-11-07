"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  ApiError,
  getCompanies,
  switchCompany,
  toErrorMessage,
  type Company,
  type CompanyListResponse,
} from "@/lib/api";
import { StatusBadge } from "./ui";

type OfficeLoadState = "loading" | "ready" | "error";

/**
 * Global office switcher for the application header. Selecting another active
 * office switches the caller's session and then performs one full page reload
 * so every office-aware page refetches under the new AuthSession
 * .activeCompanyId. It never mutates the active office optimistically and
 * never reimplements Company Setup — the manage action links to /app/company.
 */
export function OfficeSwitcher() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadState, setLoadState] = useState<OfficeLoadState>("loading");
  const [companyList, setCompanyList] = useState<CompanyListResponse | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [switchingCompanyId, setSwitchingCompanyId] = useState<string | null>(
    null,
  );
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOffices() {
      try {
        const result = await getCompanies(controller.signal);
        setCompanyList(result);
        setLoadState("ready");
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        // A failed office list must never break the header or Sign out.
        setLoadState("error");
      }
    }

    void loadOffices();

    return () => controller.abort();
  }, [router]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const companies = companyList?.companies ?? [];
  const activeCompanyId = companyList?.activeCompanyId ?? null;
  const currentOffice =
    companies.find((company) => company.id === activeCompanyId) ?? null;

  async function handleSwitchCompany(company: Company): Promise<void> {
    if (
      company.id === activeCompanyId ||
      !company.isActive ||
      switchingCompanyId !== null
    ) {
      return;
    }

    setSwitchError(null);
    setSwitchingCompanyId(company.id);

    try {
      await switchCompany(company.id);
      // Accounting safety: mounted client pages may hold state loaded for the
      // previous office, so one full reload of the current URL is intentional.
      window.location.reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setSwitchError(toErrorMessage(caught));
      setSwitchingCompanyId(null);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={
          currentOffice
            ? `Switch office — ${currentOffice.name}`
            : "Switch office"
        }
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground transition duration-200 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <Building2
          aria-hidden="true"
          className="size-4 shrink-0"
          style={{ color: "var(--office-accent)" }}
        />
        {currentOffice ? (
          <span className="hidden max-w-40 truncate md:inline">
            {currentOffice.name}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          aria-label="Office switcher"
          className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2.5rem))] rounded-xl border border-border bg-card p-2 shadow-lg"
          role="menu"
        >
          {loadState === "loading" ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Loading offices...
            </p>
          ) : null}

          {loadState === "error" ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Could not load offices. Check your connection and try again.
            </p>
          ) : null}

          {loadState === "ready" ? (
            currentOffice ? (
              <div className="border-b border-border px-3 pb-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Office
                </p>
                <p className="truncate text-sm font-medium text-foreground">
                  {currentOffice.name}
                </p>
                {currentOffice.legalName ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {currentOffice.legalName}
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone="neutral">Current</StatusBadge>
                  {!currentOffice.isActive ? (
                    <StatusBadge tone="inactive">Inactive</StatusBadge>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="border-b border-border px-3 pb-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  No office selected.
                </p>
              </div>
            )
          ) : null}

          {loadState === "ready" ? (
            <div className="flex flex-col gap-1 py-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Available offices
              </p>
              {companies.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No office configured
                </p>
              ) : (
                companies.map((company) => {
                  const isCurrentOffice = company.id === activeCompanyId;
                  const canSwitch =
                    company.isActive &&
                    !isCurrentOffice &&
                    switchingCompanyId === null;
                  const isSwitching = switchingCompanyId === company.id;

                  return (
                    <button
                      className="flex min-w-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition duration-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent motion-reduce:transition-none"
                      disabled={!canSwitch}
                      key={company.id}
                      onClick={() => void handleSwitchCompany(company)}
                      role="menuitem"
                      title={
                        company.isActive
                          ? undefined
                          : "This office is inactive and cannot be selected."
                      }
                      type="button"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                        {company.name}
                      </span>
                      {isCurrentOffice ? (
                        <StatusBadge tone="neutral">Current</StatusBadge>
                      ) : !company.isActive ? (
                        <StatusBadge tone="inactive">Inactive</StatusBadge>
                      ) : isSwitching ? (
                        <span className="text-xs text-muted-foreground">
                          Switching...
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-primary">
                          Switch
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          {switchError ? (
            <p className="px-3 pb-1 text-sm text-destructive" role="alert">
              {switchError}
            </p>
          ) : null}

          <div className="border-t border-border pt-2">
            <Link
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition duration-200 hover:bg-secondary motion-reduce:transition-none"
              href="/app/company"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              Manage Company Setup
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
