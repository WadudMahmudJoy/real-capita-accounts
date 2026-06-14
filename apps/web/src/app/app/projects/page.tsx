"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  ApiError,
  createProject,
  getProjects,
  toErrorMessage,
  updateProject,
  type Project,
  type ProjectInput,
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
  StatusBadge,
  TextArea,
  TextInput,
} from "../_components/ui";

type FormState = {
  id: string | null;
  code: string;
  name: string;
  location: string;
  notes: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  code: "",
  id: null,
  isActive: true,
  location: "",
  name: "",
  notes: "",
};

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await getProjects(controller.signal);
        setProjects(data);
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

  async function reloadProjects() {
    try {
      const data = await getProjects();
      setProjects(data);
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

  function startEdit(project: Project) {
    setForm({
      code: project.code,
      id: project.id,
      isActive: project.isActive,
      location: project.location ?? "",
      name: project.name,
      notes: project.notes ?? "",
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
    if (!code || !name) {
      setFormError("Project code and name are required.");
      return;
    }

    const payload: ProjectInput = {
      code,
      isActive: form.isActive,
      location: optional(form.location),
      name,
      notes: optional(form.notes),
    };

    setIsSaving(true);

    try {
      if (form.id) {
        await updateProject(form.id, payload);
        setFormSuccess("Project updated.");
      } else {
        await createProject(payload);
        setFormSuccess("Project created.");
      }

      setForm(emptyForm);
      await reloadProjects();
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

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Register projects used to classify accounting activity. Project codes must be unique."
        title="Projects"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading projects..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <>
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
                  ? "Update the selected project."
                  : "Add a new project."
              }
              title={isEditing ? "Edit project" : "New project"}
            />

            <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  hint="Stored in uppercase and must be unique."
                  htmlFor="project-code"
                  label="Code"
                  required
                >
                  <TextInput
                    autoCapitalize="characters"
                    id="project-code"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        code: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="PRJ-001"
                    required
                    value={form.code}
                  />
                </Field>

                <Field htmlFor="project-name" label="Name" required>
                  <TextInput
                    id="project-name"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Project name"
                    required
                    value={form.name}
                  />
                </Field>

                <Field
                  className="sm:col-span-2"
                  htmlFor="project-location"
                  label="Location"
                >
                  <TextInput
                    id="project-location"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        location: event.target.value,
                      }))
                    }
                    placeholder="Site or city"
                    value={form.location}
                  />
                </Field>

                <Field
                  className="sm:col-span-2"
                  htmlFor="project-notes"
                  label="Notes"
                >
                  <TextArea
                    id="project-notes"
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                    placeholder="Optional notes"
                    value={form.notes}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <CheckboxField
                    checked={form.isActive}
                    description="Inactive projects will not be selectable in future transaction workflows."
                    id="project-active"
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
                <Button disabled={isSaving} type="submit">
                  {isSaving
                    ? "Saving..."
                    : isEditing
                      ? "Save changes"
                      : "Create project"}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              description="All projects, ordered by code."
              title="Projects"
            />

            {projects.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Create the first project using the form above."
                  title="No projects yet"
                />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2.5">Code</th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr
                        className="border-b border-border/70 last:border-0"
                        key={project.id}
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {project.code}
                        </td>
                        <td className="px-3 py-3 text-foreground">
                          {project.name}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {project.location ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          {project.isActive ? (
                            <StatusBadge tone="active">Active</StatusBadge>
                          ) : (
                            <StatusBadge tone="inactive">Inactive</StatusBadge>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end">
                            <Button
                              onClick={() => startEdit(project)}
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
