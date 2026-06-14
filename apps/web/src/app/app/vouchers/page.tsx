"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus } from "lucide-react";
import {
  ApiError,
  getAccountingPeriods,
  getFiscalYears,
  getVouchers,
  toErrorMessage,
  type AccountingPeriod,
  type FiscalYear,
  type Voucher,
  type VoucherListFilters,
  type VoucherStatus,
  type VoucherType,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  Select,
} from "../_components/ui";
import {
  VOUCHER_TYPE_OPTIONS,
  formatDate,
  formatMoney,
  voucherStatusBadge,
  voucherTypeLabel,
} from "./_lib/voucher-ui";

type FilterState = {
  voucherType: "" | VoucherType;
  status: "" | VoucherStatus;
  fiscalYearId: string;
  accountingPeriodId: string;
};

const emptyFilters: FilterState = {
  accountingPeriodId: "",
  fiscalYearId: "",
  status: "",
  voucherType: "",
};

function toFilters(state: FilterState): VoucherListFilters {
  return {
    ...(state.voucherType ? { voucherType: state.voucherType } : {}),
    ...(state.status ? { status: state.status } : {}),
    ...(state.fiscalYearId ? { fiscalYearId: state.fiscalYearId } : {}),
    ...(state.accountingPeriodId
      ? { accountingPeriodId: state.accountingPeriodId }
      : {}),
  };
}

function periodName(periods: AccountingPeriod[], id: string): string {
  const period = periods.find((entry) => entry.id === id);
  return period ? period.name : "-";
}

export default function VouchersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [isReloading, setIsReloading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [voucherData, fiscalYearData, periodData] = await Promise.all([
          getVouchers(undefined, controller.signal),
          getFiscalYears(controller.signal),
          getAccountingPeriods(controller.signal),
        ]);

        setVouchers(voucherData);
        setFiscalYears(fiscalYearData);
        setPeriods(periodData);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        setLoadError(toErrorMessage(caught));
        setStatus("error");
      }
    }

    void load();

    return () => controller.abort();
  }, [router]);

  // Periods scoped to the selected fiscal year filter, so the period filter
  // never offers a period from a different year.
  const filteredPeriods = useMemo(() => {
    if (!filters.fiscalYearId) {
      return periods;
    }

    return periods.filter(
      (period) => period.fiscalYearId === filters.fiscalYearId,
    );
  }, [periods, filters.fiscalYearId]);

  async function applyFilters(next: FilterState) {
    setFilters(next);
    setListError(null);
    setIsReloading(true);

    try {
      setVouchers(await getVouchers(toFilters(next)));
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setListError(toErrorMessage(caught));
    } finally {
      setIsReloading(false);
    }
  }

  function handleFiscalYearChange(value: string) {
    // Reset the period filter when the fiscal year changes so a stale period
    // from another year is never sent.
    void applyFilters({
      ...filters,
      accountingPeriodId: "",
      fiscalYearId: value,
    });
  }

  const hasFilters =
    filters.voucherType !== "" ||
    filters.status !== "" ||
    filters.fiscalYearId !== "" ||
    filters.accountingPeriodId !== "";

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Record accounting vouchers as debit and credit lines. Drafts can be saved and refined; posting is handled separately."
        title="Vouchers"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading vouchers..." />
      ) : null}

      {status === "error" ? <Notice tone="error">{loadError}</Notice> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardHeader
              actions={
                <Link href="/app/vouchers/new">
                  <Button>
                    <Plus aria-hidden="true" className="size-4" />
                    New voucher
                  </Button>
                </Link>
              }
              description="Filter the voucher list by type, status, fiscal year, or accounting period."
              title="Filters"
            />

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field htmlFor="filter-type" label="Voucher type">
                <Select
                  id="filter-type"
                  onChange={(event) =>
                    void applyFilters({
                      ...filters,
                      voucherType: event.target.value as "" | VoucherType,
                    })
                  }
                  value={filters.voucherType}
                >
                  <option value="">All types</option>
                  {VOUCHER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field htmlFor="filter-status" label="Status">
                <Select
                  id="filter-status"
                  onChange={(event) =>
                    void applyFilters({
                      ...filters,
                      status: event.target.value as "" | VoucherStatus,
                    })
                  }
                  value={filters.status}
                >
                  <option value="">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="POSTED">Posted</option>
                </Select>
              </Field>

              <Field htmlFor="filter-fiscal-year" label="Fiscal year">
                <Select
                  id="filter-fiscal-year"
                  onChange={(event) =>
                    handleFiscalYearChange(event.target.value)
                  }
                  value={filters.fiscalYearId}
                >
                  <option value="">All fiscal years</option>
                  {fiscalYears.map((fiscalYear) => (
                    <option key={fiscalYear.id} value={fiscalYear.id}>
                      {fiscalYear.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field htmlFor="filter-period" label="Accounting period">
                <Select
                  id="filter-period"
                  onChange={(event) =>
                    void applyFilters({
                      ...filters,
                      accountingPeriodId: event.target.value,
                    })
                  }
                  value={filters.accountingPeriodId}
                >
                  <option value="">All periods</option>
                  {filteredPeriods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {hasFilters ? (
              <div className="mt-4">
                <Button
                  onClick={() => void applyFilters(emptyFilters)}
                  variant="ghost"
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              description="Vouchers are ordered by voucher date, then creation time."
              title="Voucher list"
            />

            {listError ? (
              <div className="mt-4">
                <Notice tone="error">{listError}</Notice>
              </div>
            ) : null}

            {vouchers.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description={
                    hasFilters
                      ? "No vouchers match the selected filters."
                      : "Create the first voucher using the New voucher button."
                  }
                  title="No vouchers yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Voucher no.</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Period</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Debit</th>
                      <th className="px-3 py-2.5 text-right">Credit</th>
                      <th className="px-3 py-2.5">Created by</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((voucher) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={voucher.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {voucher.systemVoucherNo}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {voucherTypeLabel(voucher.voucherType)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {formatDate(voucher.voucherDate)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {voucher.accountingPeriod?.name ??
                            periodName(periods, voucher.accountingPeriodId)}
                        </td>
                        <td className="px-3 py-3">
                          {voucherStatusBadge(voucher.status)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatMoney(voucher.totalDebit)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {formatMoney(voucher.totalCredit)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {voucher.createdBy?.fullName ?? "-"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end">
                            <Link href={`/app/vouchers/${voucher.id}`}>
                              <Button variant="ghost">
                                {voucher.status === "DRAFT" ? (
                                  <>
                                    <Pencil
                                      aria-hidden="true"
                                      className="size-4"
                                    />
                                    Open
                                  </>
                                ) : (
                                  <>
                                    <Eye
                                      aria-hidden="true"
                                      className="size-4"
                                    />
                                    View
                                  </>
                                )}
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isReloading ? (
              <p className="mt-3 text-xs text-muted-foreground">Updating...</p>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
