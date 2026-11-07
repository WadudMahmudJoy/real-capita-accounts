import { notFound } from "next/navigation";
import { modulePreviews, modulePreviewsEnabled } from "../_lib/module-previews";
import { Card, PageIntro, StatusBadge } from "./ui";

export function ModulePreviewPage({ module }: { module: keyof typeof modulePreviews }) {
  if (!modulePreviewsEnabled) notFound();

  const { title, description, icon: Icon } = modulePreviews[module];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace / Module previews</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageIntro title={title} description={description} />
          <StatusBadge tone="neutral">Frontend Preview</StatusBadge>
        </div>
      </div>

      <Card className="p-3 sm:p-6">
        <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-secondary/40 px-5 py-12 text-center sm:py-16">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm">
            <Icon aria-hidden="true" className="size-7" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Configuration pending</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Records and actions will be available once this module’s requirements and access rules are defined.
          </p>
        </div>
      </Card>
    </div>
  );
}
