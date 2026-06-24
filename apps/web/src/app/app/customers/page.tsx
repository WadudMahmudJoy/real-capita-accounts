"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import {
  ApiError,
  getCustomers,
  toErrorMessage,
  type Customer,
  type CustomerListFilters,
  type CustomerType,
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
  TextInput,
} from "../_components/ui";
import { customerTypeLabel, formatDate } from "../customer-booking";

type FilterState = {
  search: string;
  customerType: "" | CustomerType;
  isActive: "" | "true" | "false";
};

const emptyFilters: FilterState = {
  customerType: "",
  isActive: "",
  search: "",
};

function toFilters(state: FilterState): CustomerListFilters {
  return {
    ...(state.search.trim() ? { search: state.search.trim() } : {}),
    ...(state.customerType ? { customerType: state.customerType } : {}),
    ...(state.isActive === "true" ? { isActive: true } : {}),
    ...(state.isActive === "false" ? { isActive: false } : {}),
  };
}

export default function CustomersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftSearch, setDraftSearch] = useState("");
  const [isReloading, setIsReloading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await getCustomers(undefined, controller.signal);
        setCustomers(data);
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

  async function applyFilters(next: FilterState) {
    setFilters(next);
    setListError(null);
    setIsReloading(true);

    try {
      setCustomers(await getCustomers(toFilters(next)));
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

  const hasFilters = useMemo(
    () =>
      filters.search.trim().length > 0 ||
      filters.customerType !== "" ||
      filters.isActive !== "",
    [filters],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Customers"
        description="Maintain customer master records for internal customer booking and receivable control. This is an internal accounting control view, not a customer portal."
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading customers..." />
      ) : null}

      {status === "error" ? <Notice tone="error">{loadError}</Notice> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardHeader
              title="Customer filters"
              description="Search by code, name, phone, or NID/passport. Filter by customer type or active status where needed."
              actions={
                <Link href="/app/customers/new">
                  <Button>
                    <Plus aria-hidden="true" className="size-4" />
                    New customer
                  </Button>
                </Link>
              }
            />

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field htmlFor="customer-search" label="Search">
                <div className="flex gap-2">
                  <TextInput
                    id="customer-search"
                    placeholder="Code, name, phone, NID"
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void applyFilters({ ...filters, search: draftSearch });
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void applyFilters({ ...filters, search: draftSearch })}
                  >
                    Apply
                  </Button>
                </div>
              </Field>

              <Field htmlFor="customer-type-filter" label="Customer type">
                <Select
                  id="customer-type-filter"
                  value={filters.customerType}
                  onChange={(event) =>
                    void applyFilters({
                      ...filters,
                      customerType: event.target.value as "" | CustomerType,
                    })
                  }
                >
                  <option value="">All types</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="COMPANY">Business</option>
                  <option value="OTHER">Other</option>
                </Select>
              </Field>

              <Field htmlFor="customer-active-filter" label="Status">
                <Select
                  id="customer-active-filter"
                  value={filters.isActive}
                  onChange={(event) =>
                    void applyFilters({
                      ...filters,
                      isActive: event.target.value as "" | "true" | "false",
                    })
                  }
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </Field>

              <Field htmlFor="customer-filter-reset" label="Reset">
                <Button
                  id="customer-filter-reset"
                  variant="ghost"
                  onClick={() => {
                    setDraftSearch("");
                    void applyFilters(emptyFilters);
                  }}
                  disabled={!hasFilters}
                  className="w-full"
                >
                  Clear filters
                </Button>
              </Field>
            </div>

            {listError ? <Notice tone="error">{listError}</Notice> : null}
            {isReloading ? (
              <div className="mt-4">
                <LoadingPanel message="Refreshing customer list..." />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader
              title="Customer list"
              description="Customer booking and receivable control records with view and edit actions."
            />

            <div className="mt-6 overflow-x-auto">
              {customers.length === 0 ? (
                <EmptyState
                  title="No customers found"
                  description={
                    hasFilters
                      ? "Try clearing the current filters or create a new customer if this is a new booking party."
                      : "Create the first customer to start internal customer booking and receivable control."
                  }
                />
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Customer code</th>
                      <th className="py-3 pr-4 font-medium">Name</th>
                      <th className="py-3 pr-4 font-medium">Type</th>
                      <th className="py-3 pr-4 font-medium">Phone</th>
                      <th className="py-3 pr-4 font-medium">Email</th>
                      <th className="py-3 pr-4 font-medium">NID / Passport</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Created</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id} className="border-b border-border/80 align-top">
                        <td className="py-3 pr-4 font-medium text-foreground">
                          {customer.customerCode}
                        </td>
                        <td className="py-3 pr-4">{customer.name}</td>
                        <td className="py-3 pr-4">
                          {customerTypeLabel(customer.customerType)}
                        </td>
                        <td className="py-3 pr-4">{customer.phone}</td>
                        <td className="py-3 pr-4">{customer.email ?? "-"}</td>
                        <td className="py-3 pr-4">{customer.nidOrPassport ?? "-"}</td>
                        <td className="py-3 pr-4">
                          <StatusBadge tone={customer.isActive ? "active" : "inactive"}>
                            {customer.isActive ? "Active" : "Inactive"}
                          </StatusBadge>
                        </td>
                        <td className="py-3 pr-4">{formatDate(customer.createdAt)}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/app/customers/${customer.id}`}>
                              <Button variant="ghost" className="h-9 px-3">
                                <Eye aria-hidden="true" className="size-4" />
                                View
                              </Button>
                            </Link>
                            <Link href={`/app/customers/${customer.id}/edit`}>
                              <Button variant="ghost" className="h-9 px-3">
                                <Pencil aria-hidden="true" className="size-4" />
                                Edit
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
