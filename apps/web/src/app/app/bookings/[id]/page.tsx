"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from "lucide-react";
import {
  ApiError,
  createReceiptAllocation,
  deleteReceiptAllocation,
  getBooking,
  getReceiptAllocations,
  getVouchers,
  toErrorMessage,
  type Booking,
  type BookingReceiptAllocation,
  type Voucher,
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
  StatusBadge,
  TextArea,
  TextInput,
} from "../../_components/ui";
import {
  badgeToneForBookingAdministrativeStatus,
  badgeToneForBookingFinancialStatus,
  badgeToneForVoucherStatus,
  bookingAdministrativeStatusLabel,
  bookingFinancialStatusLabel,
  bookableItemLabel,
  customerLabel,
  FieldErrorText,
  formatDate,
  formatMoney,
  optionalString,
  parseMoneyInput,
  projectLabel,
  toAmount,
} from "../../customer-booking";

type AllocationFormState = {
  voucherId: string;
  amount: string;
  allocationDate: string;
  allocationReference: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);

const emptyAllocationForm: AllocationFormState = {
  allocationDate: today,
  allocationReference: "",
  amount: "",
  notes: "",
  voucherId: "",
};

function allocationEffect(allocation: BookingReceiptAllocation): string {
  return allocation.voucher?.status === "POSTED"
    ? "Posted receipt collection"
    : "Pending allocation";
}

function eligibleReceiptVouchers(vouchers: Voucher[]): Voucher[] {
  return vouchers.filter(
    (voucher) =>
      voucher.voucherType === "RECEIPT" &&
      !voucher.isDeleted &&
      !voucher.reversalOfVoucherId,
  );
}

function voucherLabel(voucher: Voucher): string {
  return `${voucher.systemVoucherNo} / ${formatDate(voucher.voucherDate)} / ${voucher.status} / ${formatMoney(voucher.totalDebit)}`;
}

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [allocations, setAllocations] = useState<BookingReceiptAllocation[]>([]);
  const [receiptVouchers, setReceiptVouchers] = useState<Voucher[]>([]);
  const [voucherLoadError, setVoucherLoadError] = useState<string | null>(null);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);
  const [allocationForm, setAllocationForm] =
    useState<AllocationFormState>(emptyAllocationForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);
  const [deletingAllocationId, setDeletingAllocationId] = useState<string | null>(
    null,
  );

  async function reload() {
    const [bookingData, allocationData] = await Promise.all([
      getBooking(params.id),
      getReceiptAllocations(params.id),
    ]);
    setBooking(bookingData);
    setAllocations(allocationData);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [bookingData, vouchers] = await Promise.all([
          getBooking(params.id, controller.signal),
          getVouchers({ voucherType: "RECEIPT" }, controller.signal),
        ]);
        setBooking(bookingData);
        setReceiptVouchers(eligibleReceiptVouchers(vouchers));

        try {
          setAllocations(await getReceiptAllocations(params.id, controller.signal));
        } catch (caught) {
          setAllocations(bookingData.receiptAllocations ?? []);
          setAllocationError(toErrorMessage(caught));
        }

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

    void load();
    return () => controller.abort();
  }, [params.id, router]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReceiptVouchers() {
      try {
        setVoucherLoadError(null);
        setReceiptVouchers(
          eligibleReceiptVouchers(
            await getVouchers({ voucherType: "RECEIPT" }, controller.signal),
          ),
        );
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }
        setVoucherLoadError(toErrorMessage(caught));
      }
    }

    if (status === "ready") {
      void loadReceiptVouchers();
    }

    return () => controller.abort();
  }, [status]);

  function validateAllocation(): boolean {
    const next: Record<string, string> = {};
    const amount = parseMoneyInput(allocationForm.amount);

    if (!allocationForm.voucherId) {
      next.voucherId = "Select an existing RECEIPT voucher.";
    }
    if (amount === undefined || Number.isNaN(amount) || amount <= 0) {
      next.amount = "Allocation amount must be positive.";
    }
    if (!allocationForm.allocationDate) {
      next.allocationDate = "Allocation date is required.";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleCreateAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAllocationError(null);
    setAllocationSuccess(null);

    if (!validateAllocation()) {
      return;
    }

    setIsSavingAllocation(true);
    try {
      await createReceiptAllocation(params.id, {
        allocationDate: allocationForm.allocationDate,
        amount: parseMoneyInput(allocationForm.amount) ?? 0,
        allocationReference: optionalString(allocationForm.allocationReference),
        notes: optionalString(allocationForm.notes),
        voucherId: allocationForm.voucherId,
      });
      setAllocationForm(emptyAllocationForm);
      setFieldErrors({});
      setAllocationSuccess("Receipt allocation saved and booking summary refreshed.");
      await reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setAllocationError(toErrorMessage(caught));
    } finally {
      setIsSavingAllocation(false);
    }
  }

  async function removeAllocation(allocation: BookingReceiptAllocation) {
    setAllocationError(null);
    setAllocationSuccess(null);
    setDeletingAllocationId(allocation.id);

    try {
      await deleteReceiptAllocation(params.id, allocation.id);
      setAllocationSuccess("Receipt allocation deleted and booking summary refreshed.");
      await reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setAllocationError(toErrorMessage(caught));
    } finally {
      setDeletingAllocationId(null);
    }
  }

  const pendingAllocationAmount = allocations
    .filter((allocation) => allocation.voucher?.status !== "POSTED")
    .reduce((sum, allocation) => sum + toAmount(allocation.amount), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title="Booking Control"
          description="Read-only booking details, installment schedule, derived financial summary, and receipt allocation panel."
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/app/bookings">
            <Button variant="ghost">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Button>
          </Link>
          {booking ? (
            <Link href={`/app/bookings/${booking.id}/edit`}>
              <Button>
                <Pencil aria-hidden="true" className="size-4" />
                Edit booking
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {status === "loading" ? <LoadingPanel message="Loading booking..." /> : null}
      {status === "error" ? <Notice tone="error">{error}</Notice> : null}

      {status === "ready" && booking ? (
        <>
          <Notice tone="info">
            Posted receipt vouchers are the accounting source of truth. Pending
            allocations linked to draft vouchers do not affect collected or due
            totals. This screen is an internal accounting control view, not a
            customer portal.
          </Notice>

          <Card>
            <CardHeader
              title="Core booking details"
              description="Generated booking number and administrative booking status."
            />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Booking number" value={booking.bookingNumber} />
              <Detail label="Customer" value={customerLabel(booking.customer)} />
              <Detail label="Project" value={projectLabel(booking.project)} />
              <Detail
                label="Bookable item"
                value={bookableItemLabel(booking.bookableItem)}
              />
              <Detail label="Booking date" value={formatDate(booking.bookingDate)} />
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Administrative status
                </dt>
                <dd>
                  <StatusBadge
                    tone={badgeToneForBookingAdministrativeStatus(
                      booking.administrativeStatus,
                    )}
                  >
                    {bookingAdministrativeStatusLabel(booking.administrativeStatus)}
                  </StatusBadge>
                </dd>
              </div>
              <Detail
                label="Total agreed price"
                value={formatMoney(booking.totalAgreedPrice)}
              />
              <Detail
                label="Discount amount"
                value={formatMoney(booking.discountAmount)}
              />
              <Detail
                label="Net booking value"
                value={formatMoney(booking.netBookingValue)}
              />
              <Detail
                label="Booking money"
                value={formatMoney(booking.bookingMoney)}
              />
              <Detail
                className="sm:col-span-2 lg:col-span-3"
                label="Remarks"
                value={booking.remarks ?? "-"}
              />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Derived financial summary"
              description="Read-only backend-derived receivable/control values."
            />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Detail
                label="Net booking value"
                value={formatMoney(booking.netBookingValue)}
              />
              <Detail
                label="Booking money recorded"
                value={formatMoney(booking.bookingMoney)}
              />
              <Detail
                label="Posted collected amount"
                value={formatMoney(booking.summary?.totalCollected)}
              />
              <Detail
                label="Pending allocation amount"
                value={formatMoney(pendingAllocationAmount)}
              />
              <Detail
                label="Total due"
                value={formatMoney(booking.summary?.totalDue)}
              />
              <Detail
                label="Overdue amount"
                value={formatMoney(booking.summary?.overdueAmount)}
              />
              <Detail
                label="Overdue installment count"
                value={String(booking.summary?.overdueInstallmentCount ?? 0)}
              />
              <Detail
                label="Next installment date"
                value={formatDate(booking.summary?.nextInstallmentDate)}
              />
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Derived financial status
                </dt>
                <dd>
                  {booking.summary ? (
                    <StatusBadge
                      tone={badgeToneForBookingFinancialStatus(
                        booking.summary.financialStatus,
                      )}
                    >
                      {bookingFinancialStatusLabel(booking.summary.financialStatus)}
                    </StatusBadge>
                  ) : (
                    "-"
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Installment schedule"
              description="Paid, due, and overdue status are backend-derived; no manual paid flags are editable here."
            />
            {booking.installments && booking.installments.length > 0 ? (
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">No</th>
                      <th className="py-3 pr-4 font-medium">Due date</th>
                      <th className="py-3 pr-4 font-medium text-right">
                        Scheduled amount
                      </th>
                      <th className="py-3 pr-4 font-medium">Notes/reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {booking.installments.map((row) => (
                      <tr key={row.id} className="border-b border-border/80">
                        <td className="py-3 pr-4">{row.installmentNo}</td>
                        <td className="py-3 pr-4">{formatDate(row.dueDate)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {formatMoney(row.amount)}
                        </td>
                        <td className="py-3 pr-4">{row.description ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState
                  title="No installments defined"
                  description="This booking has no installment schedule returned by the backend."
                />
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Receipt allocation panel"
              description="Existing RECEIPT voucher allocation display with pending and posted effects."
              actions={
                <Link href="/app/vouchers/new">
                  <Button variant="secondary">
                    <ExternalLink aria-hidden="true" className="size-4" />
                    Open voucher workflow
                  </Button>
                </Link>
              }
            />
            <div className="mt-6 flex flex-col gap-4">
              <Notice tone="info">
                Use the existing voucher workflow to create or post RECEIPT
                vouchers. This panel only links existing RECEIPT vouchers to the
                booking.
              </Notice>
              <Notice tone="info">
                DRAFT allocations show as Pending allocation. POSTED allocations
                show as Posted receipt collection and count as voucher-backed
                collection.
              </Notice>

              {voucherLoadError ? (
                <Notice tone="error">{voucherLoadError}</Notice>
              ) : null}
              {allocationError ? <Notice tone="error">{allocationError}</Notice> : null}
              {allocationSuccess ? (
                <Notice tone="success">{allocationSuccess}</Notice>
              ) : null}

              <form
                className="grid gap-5 rounded-md border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-5"
                onSubmit={handleCreateAllocation}
              >
                <Field htmlFor="allocation-voucher" label="Existing RECEIPT voucher" required>
                  <Select
                    id="allocation-voucher"
                    value={allocationForm.voucherId}
                    onChange={(event) =>
                      setAllocationForm((previous) => ({
                        ...previous,
                        voucherId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select voucher</option>
                    {receiptVouchers.map((voucher) => (
                      <option key={voucher.id} value={voucher.id}>
                        {voucherLabel(voucher)}
                      </option>
                    ))}
                  </Select>
                  <FieldErrorText message={fieldErrors.voucherId ?? null} />
                </Field>
                <Field htmlFor="allocation-amount" label="Allocation amount" required>
                  <TextInput
                    id="allocation-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={allocationForm.amount}
                    onChange={(event) =>
                      setAllocationForm((previous) => ({
                        ...previous,
                        amount: event.target.value,
                      }))
                    }
                  />
                  <FieldErrorText message={fieldErrors.amount ?? null} />
                </Field>
                <Field htmlFor="allocation-date" label="Allocation date" required>
                  <TextInput
                    id="allocation-date"
                    type="date"
                    value={allocationForm.allocationDate}
                    onChange={(event) =>
                      setAllocationForm((previous) => ({
                        ...previous,
                        allocationDate: event.target.value,
                      }))
                    }
                  />
                  <FieldErrorText message={fieldErrors.allocationDate ?? null} />
                </Field>
                <Field htmlFor="allocation-reference" label="Reference">
                  <TextInput
                    id="allocation-reference"
                    value={allocationForm.allocationReference}
                    onChange={(event) =>
                      setAllocationForm((previous) => ({
                        ...previous,
                        allocationReference: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field htmlFor="allocation-submit" label="Save allocation">
                  <Button
                    className="w-full"
                    disabled={isSavingAllocation || receiptVouchers.length === 0}
                    id="allocation-submit"
                    type="submit"
                  >
                    {isSavingAllocation ? "Saving..." : "Allocate voucher"}
                  </Button>
                </Field>
                <Field className="sm:col-span-2 lg:col-span-5" htmlFor="allocation-notes" label="Notes">
                  <TextArea
                    id="allocation-notes"
                    value={allocationForm.notes}
                    onChange={(event) =>
                      setAllocationForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                  />
                </Field>
              </form>

              {receiptVouchers.length === 0 ? (
                <EmptyState
                  title="No eligible RECEIPT vouchers found"
                  description="Create a RECEIPT voucher in the existing voucher workflow, then return here to allocate it. JOURNAL, PAYMENT, CONTRA, deleted, and reversal vouchers are not eligible."
                />
              ) : null}

              {allocations.length === 0 ? (
                <EmptyState
                  title="No receipt allocations"
                  description="No existing RECEIPT voucher allocation rows are linked to this booking yet."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Allocation date</th>
                        <th className="py-3 pr-4 font-medium">Voucher number</th>
                        <th className="py-3 pr-4 font-medium">Voucher date</th>
                        <th className="py-3 pr-4 font-medium">Voucher status</th>
                        <th className="py-3 pr-4 font-medium text-right">
                          Allocation amount
                        </th>
                        <th className="py-3 pr-4 font-medium">Reference / note</th>
                        <th className="py-3 pr-4 font-medium">Posted effect</th>
                        <th className="py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((allocation) => {
                        const voucher = allocation.voucher;
                        const voucherStatus = voucher?.status;
                        const isDeleting = deletingAllocationId === allocation.id;

                        return (
                          <tr
                            key={allocation.id}
                            className="border-b border-border/80 align-top"
                          >
                            <td className="py-3 pr-4">
                              {formatDate(allocation.allocationDate)}
                            </td>
                            <td className="py-3 pr-4">
                              {voucher ? (
                                <Link
                                  className="font-medium underline-offset-4 hover:underline"
                                  href={`/app/vouchers/${voucher.id}`}
                                >
                                  {voucher.systemVoucherNo}
                                </Link>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="py-3 pr-4">
                              {formatDate(voucher?.voucherDate)}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusBadge tone={badgeToneForVoucherStatus(voucherStatus)}>
                                {voucherStatus ?? "-"}
                              </StatusBadge>
                            </td>
                            <td className="py-3 pr-4 text-right tabular-nums">
                              {formatMoney(allocation.amount)}
                            </td>
                            <td className="py-3 pr-4">
                              {allocation.allocationReference ?? allocation.notes ?? "-"}
                            </td>
                            <td className="py-3 pr-4">
                              {allocationEffect(allocation)}
                            </td>
                            <td className="py-3">
                              <Button
                                disabled={isDeleting}
                                onClick={() => void removeAllocation(allocation)}
                                variant={voucherStatus === "POSTED" ? "secondary" : "danger"}
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                                {isDeleting
                                  ? "Deleting..."
                                  : voucherStatus === "POSTED"
                                    ? "Test delete"
                                    : "Delete"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className ? `flex flex-col gap-1 ${className}` : "flex flex-col gap-1"}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
