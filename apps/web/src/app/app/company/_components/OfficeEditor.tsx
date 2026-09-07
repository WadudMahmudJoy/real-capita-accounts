"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createCompany,
  toErrorMessage,
  updateCompany,
  type Company,
  type CompanyBackgroundMode,
  type CompanyInput,
  type UpdateCompanyInput,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  Field,
  Notice,
  Select,
  TextArea,
  TextInput,
} from "../../_components/ui";
import { CompanyMediaField } from "./CompanyMediaField";

const EDITOR_TABS = [
  { id: "basic", label: "Basic Info" },
  { id: "branding", label: "Branding" },
  { id: "print", label: "Print & Voucher" },
] as const;

type EditorTabId = (typeof EDITOR_TABS)[number]["id"];

type BasicInfoFormState = {
  name: string;
  legalName: string;
  phone: string;
  email: string;
  currency: string;
  address: string;
};

const emptyBasicForm: BasicInfoFormState = {
  address: "",
  currency: "BDT",
  email: "",
  legalName: "",
  name: "",
  phone: "",
};

const ACCENT_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const NEUTRAL_PICKER_COLOR = "#71717a";

function toBasicForm(company: Company): BasicInfoFormState {
  return {
    address: company.address ?? "",
    currency: company.currency ?? "BDT",
    email: company.email ?? "",
    legalName: company.legalName ?? "",
    name: company.name,
    phone: company.phone ?? "",
  };
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type OfficeEditorProps = {
  company: Company | null;
  isActiveOffice: boolean;
  mediaRevision: number;
  onSaved: (company: Company) => void;
  onCreated: (company: Company) => void;
  onMediaChanged: (company: Company) => void;
  onCancel: () => void;
};

/**
 * Office profile editor. In create mode it offers exactly the Basic Info
 * fields; in edit mode it organises the profile into the three approved
 * tabs. Editing an office never changes the session's active office.
 */
export function OfficeEditor({
  company,
  isActiveOffice,
  mediaRevision,
  onSaved,
  onCreated,
  onMediaChanged,
  onCancel,
}: OfficeEditorProps) {
  const router = useRouter();
  const isCreating = company === null;

  const [activeTab, setActiveTab] = useState<EditorTabId>("basic");
  const [form, setForm] = useState<BasicInfoFormState>(() =>
    company ? toBasicForm(company) : emptyBasicForm,
  );
  const [isSavingBasic, setIsSavingBasic] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);
  const [basicSuccess, setBasicSuccess] = useState<string | null>(null);

  const [accentInput, setAccentInput] = useState(
    () => company?.brandAccentColor ?? "",
  );
  const [backgroundMode, setBackgroundMode] =
    useState<CompanyBackgroundMode>(
      () => company?.backgroundMode ?? "DEFAULT_PREMIUM",
    );
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);

  const [printHeaderName, setPrintHeaderName] = useState(
    () => company?.printHeaderName ?? "",
  );
  const [printFooterText, setPrintFooterText] = useState(
    () => company?.printFooterText ?? "",
  );
  const [isSavingPrint, setIsSavingPrint] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState<string | null>(null);

  function handleUnauthorized(caught: unknown): boolean {
    if (caught instanceof ApiError && caught.isUnauthorized) {
      router.replace("/login");
      return true;
    }
    return false;
  }

  function updateField<K extends keyof BasicInfoFormState>(
    key: K,
    value: string,
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleBasicSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setBasicError(null);
    setBasicSuccess(null);

    const name = form.name.trim();
    if (!name) {
      setBasicError("Company name is required.");
      return;
    }

    const payload: CompanyInput = {
      address: optional(form.address),
      currency: optional(form.currency.toUpperCase()),
      email: optional(form.email),
      legalName: optional(form.legalName),
      name,
      phone: optional(form.phone),
    };

    setIsSavingBasic(true);

    try {
      if (company) {
        const saved = await updateCompany(company.id, payload);
        setForm(toBasicForm(saved));
        setBasicSuccess("Basic info saved.");
        onSaved(saved);
      } else {
        const created = await createCompany(payload);
        onCreated(created);
      }
    } catch (caught) {
      if (handleUnauthorized(caught)) {
        return;
      }
      setBasicError(toErrorMessage(caught));
    } finally {
      setIsSavingBasic(false);
    }
  }

  async function handleBrandingSubmit(): Promise<void> {
    if (company === null) {
      return;
    }

    setBrandingError(null);
    setBrandingSuccess(null);

    const trimmedAccent = accentInput.trim();
    if (trimmedAccent.length > 0 && !ACCENT_HEX_PATTERN.test(trimmedAccent)) {
      setBrandingError(
        "Brand accent color must be a six-digit hex code like #1A2B3C.",
      );
      return;
    }

    const payload: UpdateCompanyInput = {
      backgroundMode,
      brandAccentColor:
        trimmedAccent.length > 0 ? trimmedAccent.toUpperCase() : null,
    };

    setIsSavingBranding(true);

    try {
      const saved = await updateCompany(company.id, payload);
      setAccentInput(saved.brandAccentColor ?? "");
      setBrandingSuccess("Branding settings saved.");
      onSaved(saved);
    } catch (caught) {
      if (handleUnauthorized(caught)) {
        return;
      }
      setBrandingError(toErrorMessage(caught));
    } finally {
      setIsSavingBranding(false);
    }
  }

  async function handlePrintSubmit(): Promise<void> {
    if (company === null) {
      return;
    }

    setPrintError(null);
    setPrintSuccess(null);
    setIsSavingPrint(true);

    try {
      const saved = await updateCompany(company.id, {
        printFooterText: optionalOrNull(printFooterText),
        printHeaderName: optionalOrNull(printHeaderName),
      });
      setPrintSuccess("Print settings saved.");
      onSaved(saved);
    } catch (caught) {
      if (handleUnauthorized(caught)) {
        return;
      }
      setPrintError(toErrorMessage(caught));
    } finally {
      setIsSavingPrint(false);
    }
  }

  const trimmedAccent = accentInput.trim();
  const accentPreview =
    trimmedAccent.length > 0 && ACCENT_HEX_PATTERN.test(trimmedAccent)
      ? trimmedAccent
      : null;

  const basicInfoForm = (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => void handleBasicSubmit(event)}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field htmlFor="company-name" label="Company name" required>
          <TextInput
            autoComplete="organization"
            id="company-name"
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Real Capita Group"
            required
            value={form.name}
          />
        </Field>

        <Field htmlFor="company-legal-name" label="Legal name">
          <TextInput
            id="company-legal-name"
            onChange={(event) =>
              updateField("legalName", event.target.value)
            }
            placeholder="Registered legal entity name"
            value={form.legalName}
          />
        </Field>

        <Field htmlFor="company-phone" label="Phone">
          <TextInput
            autoComplete="tel"
            id="company-phone"
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="Contact number"
            value={form.phone}
          />
        </Field>

        <Field htmlFor="company-email" label="Email">
          <TextInput
            autoComplete="email"
            id="company-email"
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="accounts@example.com"
            type="email"
            value={form.email}
          />
        </Field>

        <Field
          hint="Three-letter ISO currency code. Defaults to BDT."
          htmlFor="company-currency"
          label="Default currency"
        >
          <TextInput
            id="company-currency"
            maxLength={3}
            onChange={(event) =>
              updateField("currency", event.target.value.toUpperCase())
            }
            placeholder="BDT"
            value={form.currency}
          />
        </Field>

        <Field
          className="sm:col-span-2"
          htmlFor="company-address"
          label="Address"
        >
          <TextArea
            id="company-address"
            onChange={(event) => updateField("address", event.target.value)}
            placeholder="Office address"
            value={form.address}
          />
        </Field>
      </div>

      {basicError ? <Notice tone="error">{basicError}</Notice> : null}
      {basicSuccess ? <Notice tone="success">{basicSuccess}</Notice> : null}

      <div className="flex items-center gap-3">
        <Button disabled={isSavingBasic} type="submit">
          {isSavingBasic
            ? "Saving..."
            : isCreating
              ? "Create office"
              : "Save basic info"}
        </Button>
      </div>
    </form>
  );

  const brandingSection = (office: Company) => (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Office logo</h3>
        <CompanyMediaField
          companyId={office.id}
          hasMedia={office.officeLogoPath !== null}
          hint="Displayed for this office inside the application. PNG, JPEG, or WebP up to 2 MiB."
          kind="office-logo"
          label="Office logo"
          revision={mediaRevision}
          variant="logo"
          onMediaChanged={onMediaChanged}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">
          Brand accent color
        </h3>
        <Field
          hint="Six-digit hex code for this office's accent color. Leave empty to use the application default."
          htmlFor="company-accent-color"
          label="Accent color"
        >
          <div className="flex items-center gap-2">
            <input
              aria-label="Brand accent color picker"
              className="h-11 w-16 cursor-pointer rounded-md border border-input bg-input-surface p-1"
              onChange={(event) =>
                setAccentInput(event.target.value.toUpperCase())
              }
              type="color"
              value={accentPreview ?? NEUTRAL_PICKER_COLOR}
            />
            <TextInput
              id="company-accent-color"
              maxLength={7}
              onChange={(event) => setAccentInput(event.target.value)}
              placeholder="#1A2B3C"
              value={accentInput}
            />
          </div>
        </Field>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-secondary/40 text-xs text-muted-foreground"
            style={accentPreview ? { backgroundColor: accentPreview } : undefined}
          >
            {accentPreview ? null : "—"}
          </span>
          <p className="text-sm text-muted-foreground">
            {accentPreview ?? "Application default"}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-foreground">
          Background mode
        </h3>
        <Field
          hint="Default Premium uses the application's premium office background. Custom Background uses the uploaded office background and falls back to Default Premium when the custom image is unavailable."
          htmlFor="company-background-mode"
          label="Background mode"
        >
          <Select
            id="company-background-mode"
            onChange={(event) =>
              setBackgroundMode(event.target.value as CompanyBackgroundMode)
            }
            value={backgroundMode}
          >
            <option value="DEFAULT_PREMIUM">Default Premium</option>
            <option value="CUSTOM">Custom Background</option>
          </Select>
        </Field>

        {backgroundMode === "CUSTOM" ? (
          <div className="flex flex-col gap-3">
            <CompanyMediaField
              companyId={office.id}
              hasMedia={office.customBackgroundPath !== null}
              hint="Shown behind the application when this office is active. PNG, JPEG, or WebP up to 5 MiB."
              kind="custom-background"
              label="Custom background"
              revision={mediaRevision}
              variant="background"
              onMediaChanged={onMediaChanged}
            />
            {office.customBackgroundPath === null ? (
              <Notice tone="info">
                No custom background uploaded. Default Premium will be used as
                the fallback.
              </Notice>
            ) : null}
          </div>
        ) : null}
      </section>

      {brandingError ? <Notice tone="error">{brandingError}</Notice> : null}
      {brandingSuccess ? (
        <Notice tone="success">{brandingSuccess}</Notice>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          disabled={isSavingBranding}
          onClick={() => void handleBrandingSubmit()}
          type="button"
        >
          {isSavingBranding ? "Saving..." : "Save branding settings"}
        </Button>
      </div>
    </div>
  );

  const printSection = (office: Company) => (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">Print logo</h3>
        <CompanyMediaField
          companyId={office.id}
          hasMedia={office.printLogoPath !== null}
          hint="Used on printed vouchers and reports for this office. PNG, JPEG, or WebP up to 2 MiB."
          kind="print-logo"
          label="Print logo"
          revision={mediaRevision}
          variant="logo"
          onMediaChanged={onMediaChanged}
        />
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field
          hint="Optional office name shown in print headers. Maximum 120 characters."
          htmlFor="company-print-header-name"
          label="Print header name"
        >
          <TextInput
            id="company-print-header-name"
            maxLength={120}
            onChange={(event) => setPrintHeaderName(event.target.value)}
            placeholder="Office name shown on printed documents"
            value={printHeaderName}
          />
        </Field>

        <Field
          hint="Optional footer line for printed documents. Maximum 250 characters."
          htmlFor="company-print-footer-text"
          label="Print footer text"
        >
          <TextArea
            id="company-print-footer-text"
            maxLength={250}
            onChange={(event) => setPrintFooterText(event.target.value)}
            placeholder="Footer text shown on printed documents"
            value={printFooterText}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Print preview
        </h3>
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Header
            </p>
            {printHeaderName.trim().length > 0 ? (
              <p className="text-base font-semibold text-foreground">
                {printHeaderName.trim()}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No print header name set.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Footer
            </p>
            {printFooterText.trim().length > 0 ? (
              <p className="text-sm leading-6 text-foreground">
                {printFooterText.trim()}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No print footer text set.
              </p>
            )}
          </div>
        </div>
      </section>

      {printError ? <Notice tone="error">{printError}</Notice> : null}
      {printSuccess ? <Notice tone="success">{printSuccess}</Notice> : null}

      <div className="flex items-center gap-3">
        <Button
          disabled={isSavingPrint}
          onClick={() => void handlePrintSubmit()}
          type="button"
        >
          {isSavingPrint ? "Saving..." : "Save print settings"}
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader
        description={
          isCreating
            ? "Create a new office profile for this accounting system."
            : `Update the profile of "${company.name}".`
        }
        title={isCreating ? "Add office" : "Edit office profile"}
        actions={
          <Button onClick={onCancel} type="button" variant="ghost">
            Close
          </Button>
        }
      />

      {!isCreating && !isActiveOffice ? (
        <div className="mt-4">
          <Notice tone="info">
            You are editing this office&apos;s profile. This does not change
            your active office.
          </Notice>
        </div>
      ) : null}

      {!isCreating ? (
        <div
          aria-label="Office profile sections"
          className="mt-6 flex flex-wrap gap-2"
          role="tablist"
        >
          {EDITOR_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={`rounded-md border px-3.5 py-2 text-sm font-medium transition duration-200 ${
                activeTab === tab.id
                  ? "border-ring bg-secondary text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        {isCreating || activeTab === "basic" ? basicInfoForm : null}
        {!isCreating && company !== null && activeTab === "branding"
          ? brandingSection(company)
          : null}
        {!isCreating && company !== null && activeTab === "print"
          ? printSection(company)
          : null}
      </div>
    </Card>
  );
}
