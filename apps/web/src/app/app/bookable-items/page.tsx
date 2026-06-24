"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import {
  ApiError,
  getBookableItems,
  getProjects,
  toErrorMessage,
  type BookableItem,
  type BookableItemCategory,
  type BookableItemListFilters,
  type BookableItemStatus,
  type Project,
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
import {
  BOOKABLE_ITEM_CATEGORY_OPTIONS,
  BOOKABLE_ITEM_STATUS_OPTIONS,
  bookableItemCategoryLabel,
  bookableItemStatusLabel,
  badgeToneForBookableStatus,
  formatMoney,
  projectLabel,
} from "../customer-booking";

type FilterState = {
  search: string;
  projectId: string;
  category: "" | BookableItemCategory;
  status: "" | BookableItemStatus;
};

const emptyFilters: FilterState = {
  category: "",
  projectId: "",
  search: "",
  status: "",
};

function toFilters(state: FilterState): BookableItemListFilters {
  return {
    ...(state.search.trim() ? { search: state.search.trim() } : {}),
    ...(state.projectId ? { projectId: state.projectId } : {}),
    ...(state.category ? { category: state.category } : {}),
    ...(state.status ? { status: state.status } : {}),
  };
}

function compactItemMeta(item: BookableItem): string {
  return [item.block, item.zone, item.phase].filter(Boolean).join(" / ") || "-";
}

function compactSizeMeta(item: BookableItem): string {
  const parts = [];
  if (item.sizeOrArea) parts.push(item.sizeOrArea);
  if (item.shareQuantity) parts.push(`Qty ${item.shareQuantity}`);
  return parts.join(" / ") || "-";
}

export default function BookableItemsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<BookableItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [draftSearch, setDraftSearch] = useState("");
  const [isReloading, setIsReloading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [itemData, projectData] = await Promise.all([
          getBookableItems(undefined, controller.signal),
          getProjects(controller.signal),
        ]);
        setItems(itemData);
        setProjects(projectData);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
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
      setItems(await getBookableItems(toFilters(next)));
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
    () => filters.search.trim() || filters.projectId || filters.category || filters.status,
    [filters],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        title="Bookable Items"
        description="Maintain project-linked bookable item references for customer booking. BOOKED status is reached through booking creation, not as a manual create shortcut."
      />
      {status === "loading" ? <LoadingPanel message="Loading bookable items..." /> : null}
      {status === "error" ? <Notice tone="error">{loadError}</Notice> : null}
      {status === "ready" ? (
        <>
          <Card>
            <CardHeader
              title="Bookable item filters"
              description="Filter by project, category, status, or item identity fields."
              actions={<Link href="/app/bookable-items/new"><Button><Plus aria-hidden="true" className="size-4" />New item</Button></Link>}
            />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <Field htmlFor="item-search" label="Search">
                <div className="flex gap-2">
                  <TextInput id="item-search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Item code or identifier" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyFilters({ ...filters, search: draftSearch }); } }} />
                  <Button variant="secondary" onClick={() => void applyFilters({ ...filters, search: draftSearch })}>Apply</Button>
                </div>
              </Field>
              <Field htmlFor="item-project-filter" label="Project">
                <Select id="item-project-filter" value={filters.projectId} onChange={(event) => void applyFilters({ ...filters, projectId: event.target.value })}>
                  <option value="">All projects</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
                </Select>
              </Field>
              <Field htmlFor="item-category-filter" label="Category">
                <Select id="item-category-filter" value={filters.category} onChange={(event) => void applyFilters({ ...filters, category: event.target.value as "" | BookableItemCategory })}>
                  <option value="">All categories</option>
                  {BOOKABLE_ITEM_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <Field htmlFor="item-status-filter" label="Status">
                <Select id="item-status-filter" value={filters.status} onChange={(event) => void applyFilters({ ...filters, status: event.target.value as "" | BookableItemStatus })}>
                  <option value="">All statuses</option>
                  {BOOKABLE_ITEM_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <Field htmlFor="item-filter-reset" label="Reset">
                <Button id="item-filter-reset" variant="ghost" disabled={!hasFilters} className="w-full" onClick={() => { setDraftSearch(""); void applyFilters(emptyFilters); }}>Clear filters</Button>
              </Field>
            </div>
            {listError ? <Notice tone="error">{listError}</Notice> : null}
            {isReloading ? <div className="mt-4"><LoadingPanel message="Refreshing item list..." /></div> : null}
          </Card>

          <Card>
            <CardHeader title="Bookable item list" description="Project-linked item references with conservative status display." />
            <div className="mt-6 overflow-x-auto">
              {items.length === 0 ? (
                <EmptyState title="No bookable items found" description={hasFilters ? "Try clearing filters or create a project-linked item if this reference is new." : "Create the first bookable item before creating a customer booking."} />
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Item code</th><th className="py-3 pr-4 font-medium">Project</th><th className="py-3 pr-4 font-medium">Category</th><th className="py-3 pr-4 font-medium">Block / Zone / Phase</th><th className="py-3 pr-4 font-medium">Item identifier</th><th className="py-3 pr-4 font-medium">Size / Qty</th><th className="py-3 pr-4 font-medium text-right">Base price</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border/80 align-top">
                        <td className="py-3 pr-4 font-medium">{item.itemCode}</td><td className="py-3 pr-4">{item.project ? projectLabel(item.project) : "-"}</td><td className="py-3 pr-4">{bookableItemCategoryLabel(item.category)}</td><td className="py-3 pr-4">{compactItemMeta(item)}</td><td className="py-3 pr-4">{item.itemIdentifier}</td><td className="py-3 pr-4">{compactSizeMeta(item)}</td><td className="py-3 pr-4 text-right tabular-nums">{formatMoney(item.basePrice)}</td><td className="py-3 pr-4"><StatusBadge tone={badgeToneForBookableStatus(item.status)}>{bookableItemStatusLabel(item.status)}</StatusBadge></td>
                        <td className="py-3"><div className="flex flex-wrap gap-2"><Link href={`/app/bookable-items/${item.id}`}><Button variant="ghost" className="h-9 px-3"><Eye aria-hidden="true" className="size-4" />View</Button></Link><Link href={`/app/bookable-items/${item.id}/edit`}><Button variant="ghost" className="h-9 px-3"><Pencil aria-hidden="true" className="size-4" />Edit</Button></Link></div></td>
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
