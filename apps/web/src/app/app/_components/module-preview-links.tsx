import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { modulePreviews, modulePreviewsEnabled } from "../_lib/module-previews";

export function ModulePreviewLinks({ pathname, sidebar = false }: { pathname: string; sidebar?: boolean }) {
  if (!modulePreviewsEnabled) return null;

  return (
    <details open className={cn("group/preview", !sidebar && "rounded-lg border border-border bg-card p-2")}>
      <summary className={cn(
        "flex cursor-pointer list-none items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current [&::-webkit-details-marker]:hidden",
        sidebar && "lg:text-sidebar-muted",
      )}>
        Module previews
        <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open/preview:rotate-180 motion-reduce:transition-none" />
      </summary>
      <ul className={cn("grid gap-1", !sidebar && "sm:grid-cols-3")}>
        {Object.entries(modulePreviews).map(([slug, { title, icon: Icon }]) => {
          const href = `/app/${slug}`;
          const active = pathname === href;

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  sidebar && (active ? "lg:bg-white/15 lg:text-brand-light lg:shadow-[inset_3px_0_0_var(--brand-green)]" : "lg:text-brand-light/90 lg:hover:bg-white/10 lg:hover:text-white"),
                )}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {title}
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
