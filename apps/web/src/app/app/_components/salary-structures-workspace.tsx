"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Eye, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  ApiError,
  approveSalaryStructure,
  createSalaryStructure,
  getSalaryStructures,
  inactivateSalaryStructure,
  updateSalaryStructure,
  type SalaryStructure,
  type SalaryStructureInput,
  type SalaryStructureUpdateInput,
} from "@/lib/api";
import {
  ConfirmationDialog,
  FieldError,
  componentPercentageTotal,
  dateInputValue,
  fieldErrorProps,
  formatEffectivePeriod,
  formatPercentage,
  isPercentage,
  isPositiveDecimal,
  nullableText,
  percentageToFourPlaces,
  salaryErrorMessage,
  salaryStatusBadge,
} from "./salary-ui";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  TextArea,
  TextInput,
} from "./ui";

type ComponentForm = {
  key: string;
  code: string;
  name: string;
  percentage: string;
  displayOrder: string;
};

type StructureForm = {
  code: string;
  name: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  components: ComponentForm[];
};

let nextComponentKey = 1;

function componentRow(values?: Partial<ComponentForm>): ComponentForm {
  return {
    key: `salary-component-${nextComponentKey++}`,
    code: "",
    name: "",
    percentage: "",
    displayOrder: "1",
    ...values,
  };
}

function initialForm(): StructureForm {
  return {
    code: "",
    name: "",
    description: "",
    effectiveFrom: "",
    effectiveTo: "",
    components: [componentRow()],
  };
}

const standardComponents = () => [
  componentRow({ code: "BASIC", name: "Basic", percentage: "60", displayOrder: "1" }),
  componentRow({ code: "HOUSE_RENT", name: "House Rent", percentage: "30", displayOrder: "2" }),
  componentRow({ code: "CONVEYANCE", name: "Conveyance", percentage: "10", displayOrder: "3" }),
];

const editorRegionId = "salary-structure-editor";

function hasMeaningfulComponentInput(components: ComponentForm[]): boolean {
  if (components.length !== 1) return true;
  const component = components[0];
  return Boolean(
    component &&
      (component.code.trim() ||
        component.name.trim() ||
        component.percentage.trim() ||
        component.displayOrder.trim() !== "1"),
  );
}

export function SalaryStructuresWorkspace() {
  const router = useRouter();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryStructure | null>(null);
  const [viewing, setViewing] = useState<SalaryStructure | null>(null);
  const [form, setForm] = useState<StructureForm>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<SalaryStructure | null>(null);
  const [inactiveTarget, setInactiveTarget] = useState<SalaryStructure | null>(null);
  const [templateConfirmationOpen, setTemplateConfirmationOpen] = useState(false);
  const [isLifecyclePending, setIsLifecyclePending] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setStructures(await getSalaryStructures(signal));
        setLoadError(null);
        setStatus("ready");
      } catch (caught) {
        if (signal?.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setLoadError(salaryErrorMessage(caught));
        setStatus("error");
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function initialLoad() {
      try {
        setStructures(await getSalaryStructures(controller.signal));
        setLoadError(null);
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }
        setLoadError(salaryErrorMessage(caught));
        setStatus("error");
      }
    }
    void initialLoad();
    return () => controller.abort();
  }, [router]);

  const percentageTotal = useMemo(
    () => componentPercentageTotal(form.components.map((component) => component.percentage)),
    [form.components],
  );
  const validTotal = percentageTotal === "100";

  function openCreate() {
    setEditing(null);
    setViewing(null);
    setForm(initialForm());
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setTemplateConfirmationOpen(false);
    setFormOpen(true);
  }

  function openEdit(structure: SalaryStructure) {
    setEditing(structure);
    setViewing(null);
    setForm({
      code: structure.code,
      name: structure.name,
      description: structure.description ?? "",
      effectiveFrom: dateInputValue(structure.effectiveFrom),
      effectiveTo: dateInputValue(structure.effectiveTo),
      components: (structure.components ?? []).map((component) =>
        componentRow({
          code: component.code,
          name: component.name,
          percentage: component.percentage,
          displayOrder: String(component.displayOrder),
        }),
      ),
    });
    setFieldErrors({});
    setFormError(null);
    setSuccess(null);
    setTemplateConfirmationOpen(false);
    setFormOpen(true);
  }

  function applyStandardTemplate() {
    setForm((current) => ({ ...current, components: standardComponents() }));
    setFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => key !== "componentTotal" && !key.startsWith("component."),
        ),
      ),
    );
    setTemplateConfirmationOpen(false);
  }

  function requestStandardTemplate() {
    if (hasMeaningfulComponentInput(form.components)) {
      setTemplateConfirmationOpen(true);
      return;
    }
    applyStandardTemplate();
  }

  function updateComponent(index: number, patch: Partial<ComponentForm>) {
    setForm((current) => ({
      ...current,
      components: current.components.map((component, rowIndex) =>
        rowIndex === index ? { ...component, ...patch } : component,
      ),
    }));
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.code.trim()) errors.code = "Code is required.";
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.effectiveFrom) errors.effectiveFrom = "Effective From is required.";
    if (form.effectiveTo && form.effectiveTo <= form.effectiveFrom) {
      errors.effectiveTo = "Effective To (exclusive) must be later than Effective From.";
    }
    const codes = new Set<string>();
    const orders = new Set<string>();
    form.components.forEach((component, index) => {
      const prefix = `component.${index}`;
      const code = component.code.trim().toUpperCase();
      if (!code) errors[`${prefix}.code`] = "Code is required.";
      else if (codes.has(code)) errors[`${prefix}.code`] = "Component codes must be unique.";
      codes.add(code);
      if (!component.name.trim()) errors[`${prefix}.name`] = "Name is required.";
      if (!isPositiveDecimal(component.percentage, 4) || !isPercentage(component.percentage, 4)) {
        errors[`${prefix}.percentage`] = "Use a percentage above 0 and at most 100 with four decimal places.";
      }
      if (!/^\d+$/.test(component.displayOrder) || Number(component.displayOrder) < 1) {
        errors[`${prefix}.displayOrder`] = "Display Order must be an integer of at least 1.";
      } else if (orders.has(component.displayOrder)) {
        errors[`${prefix}.displayOrder`] = "Display Order values must be unique.";
      }
      orders.add(component.displayOrder);
    });
    if (!validTotal) errors.componentTotal = "Salary component percentages must total exactly 100.0000%.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || !validate()) return;
    setIsSaving(true);
    setFormError(null);
    setSuccess(null);
    const components = form.components.map((component) => ({
      code: component.code.trim().toUpperCase(),
      name: component.name.trim(),
      percentage: component.percentage.trim(),
      displayOrder: Number(component.displayOrder),
    }));

    try {
      if (editing) {
        const payload: SalaryStructureUpdateInput = {
          name: form.name.trim(),
          description: nullableText(form.description),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          components,
        };
        await updateSalaryStructure(editing.id, payload);
        setSuccess("Draft Salary Structure updated.");
      } else {
        const payload: SalaryStructureInput = {
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          description: nullableText(form.description),
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          components,
        };
        await createSalaryStructure(payload);
        setSuccess("Draft Salary Structure created with the next server-managed version.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }
      setFormError(salaryErrorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  async function approve() {
    if (!approvalTarget || isLifecyclePending) return;
    setIsLifecyclePending(true);
    setFormError(null);
    try {
      await approveSalaryStructure(approvalTarget.id);
      setApprovalTarget(null);
      setSuccess("Salary Structure approved and refreshed.");
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) router.replace("/login");
      else setFormError(salaryErrorMessage(caught));
      setApprovalTarget(null);
    } finally {
      setIsLifecyclePending(false);
    }
  }

  async function inactivate() {
    if (!inactiveTarget || isLifecyclePending) return;
    setIsLifecyclePending(true);
    setFormError(null);
    try {
      await inactivateSalaryStructure(inactiveTarget.id);
      setInactiveTarget(null);
      setSuccess("Salary Structure inactivated and refreshed.");
      await load();
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) router.replace("/login");
      else setFormError(salaryErrorMessage(caught));
      setInactiveTarget(null);
    } finally {
      setIsLifecyclePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro title="HR & Salary - Salary Structures" description="Create versioned Gross Salary component definitions, verify the percentage total, and deliberately approve immutable versions." />
      {success ? <Notice tone="success">{success}</Notice> : null}
      {formError ? <Notice tone="error">{formError}</Notice> : null}
      {status === "loading" ? <LoadingPanel message="Loading Salary Structures..." /> : null}
      {status === "error" ? <Card><Notice tone="error">{loadError}</Notice><Button className="mt-4" onClick={() => void load()} variant="secondary"><RefreshCw aria-hidden="true" className="size-4" />Retry</Button></Card> : null}

      {status === "ready" ? (
        <>
          <Card>
            <CardHeader title="Structure controls" description="Version is assigned by the backend for each Structure Code. Approved or inactive versions are read-only." actions={<div className="flex flex-wrap gap-2"><Button onClick={() => void load()} variant="ghost"><RefreshCw aria-hidden="true" className="size-4" />Refresh</Button><Button aria-controls={editorRegionId} aria-expanded={formOpen && !editing} onClick={openCreate}><Plus aria-hidden="true" className="size-4" />Create Salary Structure</Button></div>} />
          </Card>

          <div id={editorRegionId}>
          {formOpen ? (
            <Card>
              <CardHeader title={editing ? `Edit Draft ${editing.code} v${editing.version}` : "Create Salary Structure"} description="Component totals shown here are informational; backend validation remains authoritative." actions={<Button disabled={isSaving} onClick={() => setFormOpen(false)} variant="ghost"><X aria-hidden="true" className="size-4" />Close</Button>} />
              <form className="mt-6 flex flex-col gap-6" onSubmit={submit}>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field htmlFor="structure-code" label="Code" required hint={editing ? "Code and version are immutable after creation." : "A repeat Code creates the next server-managed version."}>
                    <TextInput {...fieldErrorProps("structure-code", fieldErrors.code)} disabled={Boolean(editing)} id="structure-code" onChange={(event) => setForm({ ...form, code: event.target.value })} value={form.code} />
                    <FieldError controlId="structure-code" message={fieldErrors.code} />
                  </Field>
                  <Field htmlFor="structure-name" label="Name" required><TextInput {...fieldErrorProps("structure-name", fieldErrors.name)} id="structure-name" onChange={(event) => setForm({ ...form, name: event.target.value })} value={form.name} /><FieldError controlId="structure-name" message={fieldErrors.name} /></Field>
                  <Field className="sm:col-span-2" htmlFor="structure-description" label="Description"><TextArea id="structure-description" onChange={(event) => setForm({ ...form, description: event.target.value })} value={form.description} /></Field>
                  <Field htmlFor="structure-from" label="Effective From" required><TextInput {...fieldErrorProps("structure-from", fieldErrors.effectiveFrom)} id="structure-from" onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} type="date" value={form.effectiveFrom} /><FieldError controlId="structure-from" message={fieldErrors.effectiveFrom} /></Field>
                  <Field htmlFor="structure-to" label="Effective To (exclusive)" hint="The structure stops applying on this date."><TextInput {...fieldErrorProps("structure-to", fieldErrors.effectiveTo)} id="structure-to" onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} type="date" value={form.effectiveTo} /><FieldError controlId="structure-to" message={fieldErrors.effectiveTo} /></Field>
                </div>

                <div className="rounded-lg border border-border bg-background p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><h3 className="font-semibold text-foreground">Components</h3><p className="mt-1 text-sm text-muted-foreground">Add or remove rows while this version remains DRAFT. Percentages are never automatically adjusted.</p></div>
                    <div className="flex flex-wrap gap-2"><Button onClick={requestStandardTemplate} variant="secondary">Use 60 / 30 / 10 Template</Button><Button onClick={() => setForm({ ...form, components: [...form.components, componentRow({ displayOrder: String(form.components.length + 1) })] })} variant="ghost"><Plus aria-hidden="true" className="size-4" />Add Component</Button></div>
                  </div>
                  <div className="mt-5 flex flex-col gap-4">
                    {form.components.map((component, index) => (
                      <div className="grid gap-4 rounded-md border border-border bg-card p-4 md:grid-cols-[1fr_1.4fr_1fr_120px_auto]" key={component.key}>
                        <Field htmlFor={`component-code-${component.key}`} label="Code" required><TextInput {...fieldErrorProps(`component-code-${component.key}`, fieldErrors[`component.${index}.code`])} id={`component-code-${component.key}`} onChange={(event) => updateComponent(index, { code: event.target.value })} value={component.code} /><FieldError controlId={`component-code-${component.key}`} message={fieldErrors[`component.${index}.code`]} /></Field>
                        <Field htmlFor={`component-name-${component.key}`} label="Name" required><TextInput {...fieldErrorProps(`component-name-${component.key}`, fieldErrors[`component.${index}.name`])} id={`component-name-${component.key}`} onChange={(event) => updateComponent(index, { name: event.target.value })} value={component.name} /><FieldError controlId={`component-name-${component.key}`} message={fieldErrors[`component.${index}.name`]} /></Field>
                        <Field htmlFor={`component-percentage-${component.key}`} label="Percentage" required><TextInput {...fieldErrorProps(`component-percentage-${component.key}`, fieldErrors[`component.${index}.percentage`])} id={`component-percentage-${component.key}`} inputMode="decimal" onChange={(event) => updateComponent(index, { percentage: event.target.value })} value={component.percentage} /><FieldError controlId={`component-percentage-${component.key}`} message={fieldErrors[`component.${index}.percentage`]} /></Field>
                        <Field htmlFor={`component-order-${component.key}`} label="Display Order" required><TextInput {...fieldErrorProps(`component-order-${component.key}`, fieldErrors[`component.${index}.displayOrder`])} id={`component-order-${component.key}`} inputMode="numeric" onChange={(event) => updateComponent(index, { displayOrder: event.target.value })} value={component.displayOrder} /><FieldError controlId={`component-order-${component.key}`} message={fieldErrors[`component.${index}.displayOrder`]} /></Field>
                        <div className="flex items-end"><Button aria-label={`Remove component ${index + 1}`} className="w-full md:w-auto" disabled={form.components.length === 1} onClick={() => setForm({ ...form, components: form.components.filter((_, rowIndex) => rowIndex !== index) })} variant="ghost"><Trash2 aria-hidden="true" className="size-4" /><span className="md:sr-only">Remove</span></Button></div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-5 rounded-md border px-4 py-3 text-sm font-medium ${validTotal ? "border-success-border bg-success-surface text-success" : "border-warning-border bg-warning-surface text-warning"}`} role="status">
                    Total Component Percentage: {percentageToFourPlaces(percentageTotal)}%
                    <span className="ml-2">{validTotal ? "Valid for approval" : "Must equal 100.0000%"}</span>
                  </div>
                  <FieldError message={fieldErrors.componentTotal} />
                </div>
                <div className="flex flex-wrap gap-3"><Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : editing ? "Save Draft" : "Create Draft"}</Button><Button disabled={isSaving} onClick={() => setFormOpen(false)} variant="secondary">Cancel</Button></div>
              </form>
            </Card>
          ) : null}
          </div>

          {viewing ? (
            <Card>
              <CardHeader title={`${viewing.code} v${viewing.version} - ${viewing.name}`} description={viewing.description ?? "No description"} actions={<Button onClick={() => setViewing(null)} variant="ghost"><X aria-hidden="true" className="size-4" />Close Details</Button>} />
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-xs uppercase text-muted-foreground">Effective Period</p><p className="mt-1 text-sm">{formatEffectivePeriod(viewing.effectiveFrom, viewing.effectiveTo)}</p></div><div><p className="text-xs uppercase text-muted-foreground">Status</p><div className="mt-1">{salaryStatusBadge(viewing.status)}</div></div></div>
              <div className="mt-5 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="py-3 pr-4">Code</th><th className="py-3 pr-4">Name</th><th className="py-3 pr-4">Percentage</th><th className="py-3">Display Order</th></tr></thead><tbody>{(viewing.components ?? []).map((component) => <tr className="border-b border-border/80" key={component.id ?? `${component.code}-${component.displayOrder}`}><td className="py-3 pr-4 font-medium">{component.code}</td><td className="py-3 pr-4">{component.name}</td><td className="py-3 pr-4 tabular-nums">{formatPercentage(component.percentage)}</td><td className="py-3 tabular-nums">{component.displayOrder}</td></tr>)}</tbody></table></div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Salary Structure Versions" description="Component definitions are shown in display order. Lifecycle actions always refetch the server state." />
            <div className="mt-6 overflow-x-auto">
              {structures.length === 0 ? <EmptyState title="No Salary Structures" description="Create the first draft version and deliberately approve it after reviewing the 100% component total." /> : (
                <table className="min-w-full border-collapse text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-3 pr-4 font-medium">Code</th><th className="py-3 pr-4 font-medium">Version</th><th className="py-3 pr-4 font-medium">Name</th><th className="py-3 pr-4 font-medium">Effective Period</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Component Summary</th><th className="py-3 font-medium">Actions</th></tr></thead><tbody>{structures.map((structure) => (
                  <tr className="border-b border-border/80 align-top" key={structure.id}><td className="py-3 pr-4 font-medium">{structure.code}</td><td className="py-3 pr-4 tabular-nums">v{structure.version}</td><td className="py-3 pr-4">{structure.name}</td><td className="py-3 pr-4 whitespace-nowrap">{formatEffectivePeriod(structure.effectiveFrom, structure.effectiveTo)}</td><td className="py-3 pr-4">{salaryStatusBadge(structure.status)}</td><td className="max-w-80 py-3 pr-4">{(structure.components ?? []).map((component) => `${component.name} ${formatPercentage(component.percentage)}`).join(" · ") || "-"}</td><td className="py-3"><div className="flex flex-wrap gap-2"><Button className="h-9 px-3" onClick={() => setViewing(structure)} variant="ghost"><Eye aria-hidden="true" className="size-4" />View</Button>{structure.status === "DRAFT" ? <><Button aria-controls={editorRegionId} aria-expanded={formOpen && editing?.id === structure.id} className="h-9 px-3" onClick={() => openEdit(structure)} variant="ghost"><Pencil aria-hidden="true" className="size-4" />Edit Draft</Button><Button className="h-9 px-3" onClick={() => setApprovalTarget(structure)} variant="secondary"><Check aria-hidden="true" className="size-4" />Approve</Button></> : null}{structure.status === "APPROVED" ? <Button className="h-9 px-3" onClick={() => setInactiveTarget(structure)} variant="secondary">Inactivate</Button> : null}</div></td></tr>
                ))}</tbody></table>
              )}
            </div>
          </Card>
        </>
      ) : null}

      <ConfirmationDialog confirmLabel="Replace Unsaved Components" description="Applying the 60 / 30 / 10 template will replace all current unsaved component rows." onCancel={() => setTemplateConfirmationOpen(false)} onConfirm={applyStandardTemplate} open={templateConfirmationOpen} pending={false} title="Replace Unsaved Components?" />
      <ConfirmationDialog confirmLabel="Approve Structure" description="After approval, this Salary Structure version cannot be edited. Future changes require a new version." onCancel={() => setApprovalTarget(null)} onConfirm={() => void approve()} open={Boolean(approvalTarget)} pending={isLifecyclePending} title="Approve Salary Structure?">
        {approvalTarget ? <div className="rounded-md bg-secondary/60 p-4 text-sm"><p className="font-semibold">{approvalTarget.code} v{approvalTarget.version} - {approvalTarget.name}</p><p className="mt-1 text-muted-foreground">{formatEffectivePeriod(approvalTarget.effectiveFrom, approvalTarget.effectiveTo)}</p><ul className="mt-3 space-y-1">{(approvalTarget.components ?? []).map((component) => <li key={component.id ?? component.code}>{component.name}: {formatPercentage(component.percentage)}</li>)}</ul><p className="mt-3 font-medium">Total: {percentageToFourPlaces(componentPercentageTotal((approvalTarget.components ?? []).map((component) => component.percentage)))}%</p></div> : null}
      </ConfirmationDialog>
      <ConfirmationDialog confirmLabel="Inactivate Structure" description="This approved version will no longer be available for new active configuration. Existing historical assignments remain unchanged." onCancel={() => setInactiveTarget(null)} onConfirm={() => void inactivate()} open={Boolean(inactiveTarget)} pending={isLifecyclePending} title="Inactivate Salary Structure?" />
    </div>
  );
}
