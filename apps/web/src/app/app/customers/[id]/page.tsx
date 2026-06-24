"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  ApiError,
  getBookings,
  getCustomer,
  toErrorMessage,
  type Booking,
  type Customer,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  Notice,
  PageIntro,
  StatusBadge,
} from "../../_components/ui";
import {
  bookingAdministrativeStatusLabel,
  customerTypeLabel,
  formatMoney,
} from "../../customer-booking";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const customerData = await getCustomer(params.id, controller.signal);
        setCustomer(customerData);
        setStatus("ready");

        try {
          setBookings(
            await getBookings({ customerId: params.id }, controller.signal),
          );
        } catch (caught) {
          if (!controller.signal.aborted) {
            setBookingError(toErrorMessage(caught));
          }
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageIntro
          title="Customer receivable/control view"
          description="Read-only customer metadata for internal customer booking and receivable control. This screen is an internal accounting control view, not a customer portal."
        />
        <div className="flex flex-wrap gap-2">
          <Link href="/app/customers">
            <Button variant="ghost">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Button>
          </Link>
          {customer ? (
            <Link href={`/app/customers/${customer.id}/edit`}>
              <Button>
                <Pencil aria-hidden="true" className="size-4" />
                Edit customer
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {status === "loading" ? <LoadingPanel message="Loading customer..." /> : null}
      {status === "error" ? <Notice tone="error">{error}</Notice> : null}

      {status === "ready" && customer ? (
        <>
          <Notice tone="info">
            Posted receipt vouchers are the accounting source of truth. Customer
            balances and collection effects are derived from backend booking
            summaries, not editable customer fields.
          </Notice>

          <Card>
            <CardHeader title="Customer metadata" description="Generated customer code and contact details." />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Customer code" value={customer.customerCode} />
              <Detail label="Name" value={customer.name} />
              <Detail label="Customer type" value={customerTypeLabel(customer.customerType)} />
              <Detail label="Phone" value={customer.phone} />
              <Detail label="Email" value={customer.email ?? "-"} />
              <Detail label="NID / Passport" value={customer.nidOrPassport ?? "-"} />
              <Detail label="Profession / Business" value={customer.professionOrBusiness ?? "-"} />
              <Detail label="Nominee / Reference" value={customer.nomineeOrReference ?? "-"} />
              <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge tone={customer.isActive ? "active" : "inactive"}>
                    {customer.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                </dd>
              </div>
              <Detail className="sm:col-span-2 lg:col-span-3" label="Address" value={customer.address} />
              <Detail className="sm:col-span-2 lg:col-span-3" label="Notes" value={customer.notes ?? "-"} />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Related bookings"
              description="Links are shown when booking list filters are available from the backend."
            />
            <div className="mt-6">
              {bookingError ? <Notice tone="error">{bookingError}</Notice> : null}
              {!bookingError && bookings.length === 0 ? (
                <EmptyState
                  title="No related bookings found"
                  description="Create a booking for this customer when a project and bookable item are ready."
                />
              ) : null}
              {bookings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Booking</th>
                        <th className="py-3 pr-4 font-medium">Project</th>
                        <th className="py-3 pr-4 font-medium">Item</th>
                        <th className="py-3 pr-4 font-medium text-right">Due</th>
                        <th className="py-3 pr-4 font-medium">Status</th>
                        <th className="py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="border-b border-border/80">
                          <td className="py-3 pr-4 font-medium">{booking.bookingNumber}</td>
                          <td className="py-3 pr-4">{booking.project?.name ?? "-"}</td>
                          <td className="py-3 pr-4">{booking.bookableItem?.itemIdentifier ?? "-"}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{formatMoney(booking.summary?.totalDue)}</td>
                          <td className="py-3 pr-4">{bookingAdministrativeStatusLabel(booking.administrativeStatus)}</td>
                          <td className="py-3">
                            <Link className="text-sm font-medium text-foreground underline-offset-4 hover:underline" href={`/app/bookings/${booking.id}`}>
                              View booking
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className ? `flex flex-col gap-1 ${className}` : "flex flex-col gap-1"}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
