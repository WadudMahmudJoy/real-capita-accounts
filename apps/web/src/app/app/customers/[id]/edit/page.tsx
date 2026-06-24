"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  ApiError,
  getCustomer,
  toErrorMessage,
  updateCustomer,
  type Customer,
  type CustomerInput,
  type CustomerType,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  CheckboxField,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  Select,
  TextArea,
  TextInput,
} from "../../../_components/ui";
import {
  CUSTOMER_TYPE_OPTIONS,
  FieldErrorText,
  nullableOptionalString,
  validateEmail,
} from "../../../customer-booking";

type CustomerFormState = {
  customerCode: string;
  customerType: CustomerType;
  name: string;
  phone: string;
  address: string;
  email: string;
  nidOrPassport: string;
  professionOrBusiness: string;
  nomineeOrReference: string;
  notes: string;
  isActive: boolean;
};

function toForm(customer: Customer): CustomerFormState {
  return {
    address: customer.address,
    customerCode: customer.customerCode,
    customerType: customer.customerType,
    email: customer.email ?? "",
    isActive: customer.isActive,
    name: customer.name,
    nidOrPassport: customer.nidOrPassport ?? "",
    nomineeOrReference: customer.nomineeOrReference ?? "",
    notes: customer.notes ?? "",
    phone: customer.phone,
    professionOrBusiness: customer.professionOrBusiness ?? "",
  };
}

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setForm(toForm(await getCustomer(params.id, controller.signal)));
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
  }, [params.id, router]);

  function validate(current: CustomerFormState): boolean {
    const nextErrors: Record<string, string> = {};
    if (!current.name.trim()) nextErrors.name = "Name is required.";
    if (!current.phone.trim()) nextErrors.phone = "Phone is required.";
    if (!current.address.trim()) nextErrors.address = "Address is required.";
    if (!validateEmail(current.email)) {
      nextErrors.email = "Enter a valid email address or leave it blank.";
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setFormError(null);
    if (!validate(form)) return;

    const payload: Partial<CustomerInput> = {
      address: form.address.trim(),
      customerType: form.customerType,
      email: nullableOptionalString(form.email),
      isActive: form.isActive,
      name: form.name.trim(),
      nidOrPassport: nullableOptionalString(form.nidOrPassport),
      nomineeOrReference: nullableOptionalString(form.nomineeOrReference),
      notes: nullableOptionalString(form.notes),
      phone: form.phone.trim(),
      professionOrBusiness: nullableOptionalString(form.professionOrBusiness),
    };

    setIsSaving(true);
    try {
      const updated = await updateCustomer(params.id, payload);
      router.replace(`/app/customers/${updated.id}`);
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
        <PageIntro
          title="Edit customer"
          description="Update editable customer fields only. Customer code is generated and read-only."
        />
        <Link href={`/app/customers/${params.id}`}>
          <Button variant="ghost">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to customer
          </Button>
        </Link>
      </div>

      {status === "loading" ? <LoadingPanel message="Loading customer..." /> : null}
      {status === "error" ? <Notice tone="error">{loadError}</Notice> : null}

      {status === "ready" && form ? (
        <Card>
          <CardHeader
            title="Customer form"
            description="Phone is required but not unique. NID/passport remains optional and backend uniqueness errors are shown here."
          />
          <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field htmlFor="customer-code" label="Customer code">
                <TextInput id="customer-code" value={form.customerCode} readOnly disabled />
              </Field>
              <Field htmlFor="customer-type" label="Customer type" required>
                <Select id="customer-type" value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value as CustomerType })}>
                  {CUSTOMER_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <Field htmlFor="customer-name" label="Name" required>
                <TextInput id="customer-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                <FieldErrorText message={fieldErrors.name ?? null} />
              </Field>
              <Field htmlFor="customer-phone" label="Phone" required>
                <TextInput id="customer-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
                <FieldErrorText message={fieldErrors.phone ?? null} />
              </Field>
              <Field htmlFor="customer-email" label="Email">
                <TextInput id="customer-email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                <FieldErrorText message={fieldErrors.email ?? null} />
              </Field>
              <Field className="sm:col-span-2" htmlFor="customer-address" label="Address" required>
                <TextArea id="customer-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required />
                <FieldErrorText message={fieldErrors.address ?? null} />
              </Field>
              <Field htmlFor="customer-nid" label="NID / Passport">
                <TextInput id="customer-nid" value={form.nidOrPassport} onChange={(event) => setForm({ ...form, nidOrPassport: event.target.value })} />
              </Field>
              <Field htmlFor="customer-business" label="Profession / Business">
                <TextInput id="customer-business" value={form.professionOrBusiness} onChange={(event) => setForm({ ...form, professionOrBusiness: event.target.value })} />
              </Field>
              <Field htmlFor="customer-reference" label="Nominee / Reference">
                <TextInput id="customer-reference" value={form.nomineeOrReference} onChange={(event) => setForm({ ...form, nomineeOrReference: event.target.value })} />
              </Field>
              <Field className="sm:col-span-2" htmlFor="customer-notes" label="Notes">
                <TextArea id="customer-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </Field>
            </div>
            <CheckboxField id="customer-active" label="Active customer" description="Inactive customers remain visible but cannot be used for new bookings." checked={form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
            {formError ? <Notice tone="error">{formError}</Notice> : null}
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSaving} type="submit">{isSaving ? "Saving..." : "Save customer"}</Button>
              <Link href={`/app/customers/${params.id}`}><Button variant="secondary">Cancel</Button></Link>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
