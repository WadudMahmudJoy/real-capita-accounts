"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createCompany,
  getCompany,
  toErrorMessage,
  updateCompany,
  type Company,
  type CompanyInput,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  TextArea,
  TextInput,
} from "../_components/ui";

type FormState = {
  name: string;
  legalName: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
};

const emptyForm: FormState = {
  address: "",
  currency: "BDT",
  email: "",
  legalName: "",
  name: "",
  phone: "",
};

function toForm(company: Company): FormState {
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

export default function CompanyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const existing = await getCompany(controller.signal);
        setCompany(existing);
        setForm(toForm(existing));
        setStatus("ready");
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        if (caught instanceof ApiError && caught.isUnauthorized) {
          router.replace("/login");
          return;
        }

        if (caught instanceof ApiError && caught.isNotFound) {
          // No company profile yet: present the create form.
          setCompany(null);
          setForm(emptyForm);
          setStatus("ready");
          return;
        }

        setLoadError(toErrorMessage(caught));
        setStatus("error");
      }
    }

    void load();

    return () => controller.abort();
  }, [router]);

  function updateField<K extends keyof FormState>(key: K, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const name = form.name.trim();
    if (!name) {
      setFormError("Company name is required.");
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

    setIsSaving(true);

    try {
      const saved = company
        ? await updateCompany(company.id, payload)
        : await createCompany(payload);

      setCompany(saved);
      setForm(toForm(saved));
      setSuccessMessage(
        company
          ? "Company profile updated."
          : "Company profile created.",
      );
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

  const isEditing = company !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Maintain the primary company profile. This is the top-level identity used across the accounting system."
        title="Company Setup"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading company profile..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <Card>
          <CardHeader
            description={
              isEditing
                ? "Update the details of the existing company profile."
                : "No company profile exists yet. Create one to continue."
            }
            title={isEditing ? "Edit company profile" : "Create company profile"}
          />

          <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
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
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  placeholder="Office address"
                  value={form.address}
                />
              </Field>
            </div>

            {formError ? <Notice tone="error">{formError}</Notice> : null}
            {successMessage ? (
              <Notice tone="success">{successMessage}</Notice>
            ) : null}

            <div className="flex items-center gap-3">
              <Button disabled={isSaving} type="submit">
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Save changes"
                    : "Create company"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
