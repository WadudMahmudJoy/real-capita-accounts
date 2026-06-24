"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { ApiError, getBookableItem, toErrorMessage, type BookableItem } from "@/lib/api";
import { Button, Card, CardHeader, EmptyState, LoadingPanel, Notice, PageIntro, StatusBadge } from "../../_components/ui";
import { badgeToneForBookableStatus, bookableItemCategoryLabel, bookableItemStatusLabel, formatDate, formatMoney, projectLabel } from "../../customer-booking";

export default function BookableItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<BookableItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setItem(await getBookableItem(params.id, controller.signal));
        setStatus("ready");
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

  return <div className="flex flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><PageIntro title="Customers & Bookings - Bookable Item Detail" description="Read-only project-linked bookable item reference for booking control." /><div className="flex flex-wrap gap-2"><Link href="/app/bookable-items"><Button variant="ghost"><ArrowLeft aria-hidden="true" className="size-4" />Back</Button></Link>{item ? <Link href={`/app/bookable-items/${item.id}/edit`}><Button><Pencil aria-hidden="true" className="size-4" />Edit item</Button></Link> : null}</div></div>{status === "loading" ? <LoadingPanel message="Loading bookable item..." /> : null}{status === "error" ? <Notice tone="error">{error}</Notice> : null}{status === "ready" && item ? <><Notice tone="info">Bookable Item status is an administrative control signal only. It does not imply final accounting or completion outside the booking workflow.</Notice><Card><CardHeader title="Item metadata" description="Generated item code, project reference, BDT price, and current backend status." /><dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Item code" value={item.itemCode} /><Detail label="Project" value={item.project ? projectLabel(item.project) : "-"} /><Detail label="Category" value={bookableItemCategoryLabel(item.category)} /><Detail label="Item identifier" value={item.itemIdentifier} /><Detail label="Block / Zone / Phase" value={[item.block, item.zone, item.phase].filter(Boolean).join(" / ") || "-"} /><Detail label="Size / Area" value={item.sizeOrArea ?? "-"} /><Detail label="Share quantity" value={item.shareQuantity ?? "-"} /><Detail label="Base price" value={formatMoney(item.basePrice)} /><div className="flex flex-col gap-1"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</dt><dd><StatusBadge tone={badgeToneForBookableStatus(item.status)}>{bookableItemStatusLabel(item.status)}</StatusBadge></dd></div><Detail className="sm:col-span-2 lg:col-span-3" label="Notes" value={item.notes ?? "-"} /></dl></Card><Card><CardHeader title="Related booking summary" description="Booking links are shown only when included by the backend detail response." />{item.bookings && item.bookings.length > 0 ? <div className="mt-6 overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-3 pr-4 font-medium">Booking</th><th className="py-3 pr-4 font-medium">Date</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Action</th></tr></thead><tbody>{item.bookings.map((booking) => <tr key={booking.id} className="border-b border-border/80"><td className="py-3 pr-4 font-medium">{booking.bookingNumber}</td><td className="py-3 pr-4">{formatDate(booking.bookingDate)}</td><td className="py-3 pr-4">{booking.administrativeStatus}</td><td className="py-3"><Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/app/bookings/${booking.id}`}>View booking</Link></td></tr>)}</tbody></table></div> : <div className="mt-6"><EmptyState title="No related bookings returned" description="Create a booking for this item when customer and project details are ready, or refresh after backend detail includes booking links." /></div>}</Card></> : null}</div>;
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={className ? `flex flex-col gap-1 ${className}` : "flex flex-col gap-1"}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="text-sm text-foreground">{value}</dd></div>;
}
