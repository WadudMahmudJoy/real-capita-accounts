"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  ApiError,
  createCostCenter,
  getCostCenters,
  getProjects,
  toErrorMessage,
  updateCostCenter,
  type CostCenter,
  type CostCenterInput,
  type Project,
} from "@/lib/api";
import {
  Button,
  Card,
  CardHeader,
  CheckboxField,
  EmptyState,
  Field,
  LoadingPanel,
  Notice,
  PageIntro,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
} from "../_components/ui";

type FormState = {
  id: string | null;
  projectId: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  code: "",
  description: "",
  id: null,
  isActive: true,
  name: "",
  projectId: "",
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function projectLabel(costCenter: CostCenter): string {
  const project = costCenter.project;

  if (!project) {
    return "Project not loaded";
  }

  return `${project.code} - ${project.name}`;
}

export default function CostCentersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [costCenterData, projectData] = await Promise.all([
          getCostCenters(controller.signal),
          getProjects(controller.signal),
        ]);

        setCostCenters(costCenterData);
        setProjects(projectData);
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

  async function reloadCostCenters() {
    try {
      setCostCenters(await getCostCenters());
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setFormError(toErrorMessage(caught));
    }
  }

  function startCreate() {
    setForm(emptyForm);
    setFormError(null);
    setFormSuccess(null);
  }

  function startEdit(costCenter: CostCenter) {
    setForm({
      code: costCenter.code,
      description: costCenter.description ?? "",
      id: costCenter.id,
      isActive: costCenter.isActive,
      name: costCenter.name,
      projectId: costCenter.projectId,
    });
    setFormError(null);
    setFormSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!form.projectId || !code || !name) {
      setFormError("Project, code, and name are required.");
      return;
    }

    const payload: CostCenterInput = {
      code,
      description: optional(form.description),
      isActive: form.isActive,
      name,
      projectId: form.projectId,
    };

    setIsSaving(true);

    try {
      if (form.id) {
        await updateCostCenter(form.id, payload);
        setFormSuccess("Cost center updated.");
      } else {
        await createCostCenter(payload);
        setFormSuccess("Cost center created.");
      }

      setForm(emptyForm);
      await reloadCostCenters();
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

  const isEditing = form.id !== null;
  const hasProjects = projects.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Create project cost centers used for future cost tracking. Reports and cost allocation are deferred."
        title="Cost Centers"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading cost centers..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
          {!hasProjects ? (
            <Notice tone="info">
              Create a project before adding cost centers.
            </Notice>
          ) : null}

          <Card>
            <CardHeader
              actions={
                isEditing ? (
                  <Button onClick={startCreate} variant="ghost">
                    Cancel edit
                  </Button>
                ) : null
              }
              description={
                isEditing
                  ? "Update the selected cost center."
                  : "Add a cost center under a project."
              }
              title={isEditing ? "Edit cost center" : "New cost center"}
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  htmlFor="cost-center-project"
                  label="Project"
                  required
                >
                  <Select
                    disabled={!hasProjects}
                    id="cost-center-project"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        projectId: event.target.value,
                      }))
                    }
                    required
                    value={form.projectId}
                  >
                    <option value="">Select project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  hint="Unique within the selected project."
                  htmlFor="cost-center-code"
                  label="Code"
                  required
                >
                  <TextInput
                    disabled={!hasProjects}
                    id="cost-center-code"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="CC-001"
                    required
                    value={form.code}
                  />
                </Field>

                <Field htmlFor="cost-center-name" label="Name" required>
                  <TextInput
                    disabled={!hasProjects}
                    id="cost-center-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Cost center name"
                    required
                    value={form.name}
                  />
                </Field>

                <Field
                  className="sm:col-span-2"
                  htmlFor="cost-center-description"
                  label="Description"
                >
                  <TextArea
                    disabled={!hasProjects}
                    id="cost-center-description"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional description"
                    value={form.description}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <CheckboxField
                    checked={form.isActive}
                    description="Inactive cost centers will not be selectable in future transaction workflows."
                    disabled={!hasProjects}
                    id="cost-center-active"
                    label="Active"
                    onChange={(checked) =>
                      setForm((previous) => ({
                        ...previous,
                        isActive: checked,
                      }))
                    }
                  />
                </div>
              </div>

              {formError ? <Notice tone="error">{formError}</Notice> : null}
              {formSuccess ? (
                <Notice tone="success">{formSuccess}</Notice>
              ) : null}

              <div className="flex items-center gap-3">
                <Button disabled={isSaving || !hasProjects} type="submit">
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create cost center"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="Cost centers grouped by their project relationship."
              title="Cost centers"
            />

            {costCenters.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first cost center using the form above."
                  title="No cost centers yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Code</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Project</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costCenters.map((costCenter) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={costCenter.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {costCenter.code}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {costCenter.name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {projectLabel(costCenter)}
                        </td>
                        <td className="px-3 py-3">
                          {costCenter.isActive ? (
                            <StatusBadge tone="active">Active</StatusBadge>
                          ) : (
                            <StatusBadge tone="inactive">Inactive</StatusBadge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              onClick={() => startEdit(costCenter)}
                              variant="ghost"
                            >
                              <Pencil aria-hidden="true" className="size-4" />
                              Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
