"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  ApiError,
  createBookableItem,
  getProjects,
  toErrorMessage,
  type BookableItemCategory,
  type BookableItemInput,
  type Project,
} from "@/lib/api";
import { Button, Card, CardHeader, Field, LoadingPanel, Notice, PageIntro, Select, TextArea, TextInput } from "../../_components/ui";
import { BOOKABLE_ITEM_CATEGORY_OPTIONS, FieldErrorText, nullableOptionalString, parseMoneyInput, projectLabel } from "../../customer-booking";

type FormState = {
  projectId: string;
  category: BookableItemCategory;
  itemIdentifier: string;
  block: string;
  zone: string;
  phase: string;
  sizeOrArea: string;
  shareQuantity: string;
  basePrice: string;
  notes: string;
};

const emptyForm: FormState = {
  basePrice: "",
  block: "",
  category: "PLOT",
  itemIdentifier: "",
  notes: "",
  phase: "",
  projectId: "",
  shareQuantity: "",
  sizeOrArea: "",
  zone: "",
};

export default function NewBookableItemPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        setProjects((await getProjects(controller.signal)).filter((project) => project.isActive));
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

  function validate(): boolean {
    const next: Record<string, string> = {};
    const basePrice = parseMoneyInput(form.basePrice);
    const shareQuantity = parseMoneyInput(form.shareQuantity);
    if (!form.projectId) next.projectId = "Project is required.";
    if (!form.itemIdentifier.trim()) next.itemIdentifier = "Item identifier is required.";
    if (basePrice === undefined || Number.isNaN(basePrice) || basePrice <= 0) next.basePrice = "Base price must be a positive amount.";
    if (form.shareQuantity.trim() && (shareQuantity === undefined || Number.isNaN(shareQuantity) || shareQuantity < 0)) next.shareQuantity = "Share quantity must be zero or positive.";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;
    const basePrice = parseMoneyInput(form.basePrice) ?? 0;
    const shareQuantity = parseMoneyInput(form.shareQuantity);
    const payload: BookableItemInput = {
      basePrice,
      block: nullableOptionalString(form.block),
      category: form.category,
      itemIdentifier: form.itemIdentifier.trim(),
      notes: nullableOptionalString(form.notes),
      phase: nullableOptionalString(form.phase),
      projectId: form.projectId,
      ...(shareQuantity === undefined ? {} : { shareQuantity }),
      sizeOrArea: nullableOptionalString(form.sizeOrArea),
      status: "AVAILABLE",
      zone: nullableOptionalString(form.zone),
    };
    setIsSaving(true);
    try {
      const created = await createBookableItem(payload);
      router.replace(`/app/bookable-items/${created.id}`);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setFormError(toErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <PageIntro title="Customers & Bookings - New Bookable Item" description="Create a project-linked bookable item. Status defaults to AVAILABLE; BOOKED is only reached after successful booking creation." />
        <Link href="/app/bookable-items"><Button variant="ghost"><ArrowLeft aria-hidden="true" className="size-4" />Back to items</Button></Link>
      </div>
      {status === "loading" ? <LoadingPanel message="Loading project references..." /> : null}
      {status === "error" ? <Notice tone="error">{loadError}</Notice> : null}
      {status === "ready" ? (
        <Card>
          <CardHeader title="Bookable item form" description="Duplicate project/category/item identifier conflicts are enforced by the backend and shown here." />
          <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field htmlFor="item-project" label="Project" required><Select id="item-project" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}</Select><FieldErrorText message={fieldErrors.projectId ?? null} /></Field>
              <Field htmlFor="item-category" label="Category" required><Select id="item-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as BookableItemCategory })}>{BOOKABLE_ITEM_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field>
              <Field htmlFor="item-identifier" label="Item identifier" required><TextInput id="item-identifier" value={form.itemIdentifier} onChange={(event) => setForm({ ...form, itemIdentifier: event.target.value })} required /><FieldErrorText message={fieldErrors.itemIdentifier ?? null} /></Field>
              <Field htmlFor="item-base-price" label="Base price" required><TextInput id="item-base-price" inputMode="decimal" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} placeholder="0.00" required /><FieldErrorText message={fieldErrors.basePrice ?? null} /></Field>
              <Field htmlFor="item-block" label="Block"><TextInput id="item-block" value={form.block} onChange={(event) => setForm({ ...form, block: event.target.value })} /></Field>
              <Field htmlFor="item-zone" label="Zone"><TextInput id="item-zone" value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} /></Field>
              <Field htmlFor="item-phase" label="Phase"><TextInput id="item-phase" value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value })} /></Field>
              <Field htmlFor="item-size" label="Size / Area"><TextInput id="item-size" value={form.sizeOrArea} onChange={(event) => setForm({ ...form, sizeOrArea: event.target.value })} /></Field>
              <Field htmlFor="item-share-quantity" label="Share quantity"><TextInput id="item-share-quantity" inputMode="decimal" value={form.shareQuantity} onChange={(event) => setForm({ ...form, shareQuantity: event.target.value })} /><FieldErrorText message={fieldErrors.shareQuantity ?? null} /></Field>
              <Field className="sm:col-span-2" htmlFor="item-notes" label="Notes"><TextArea id="item-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            </div>
            <Notice tone="info">Manual BOOKED selection is not available on create. A successful booking moves the item into booked control state through the backend.</Notice>
            {formError ? <Notice tone="error">{formError}</Notice> : null}
            <div className="flex flex-wrap gap-3"><Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Create item"}</Button><Link href="/app/bookable-items"><Button variant="secondary">Cancel</Button></Link></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
