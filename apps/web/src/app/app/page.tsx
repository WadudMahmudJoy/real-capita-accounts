import Link from "next/link";
import {
  ArrowRight,
  BookText,
  Building2,
  CalendarRange,
  FolderKanban,
  Layers,
  Users,
} from "lucide-react";
import { Card, PageIntro } from "./_components/ui";

const sections = [
  {
    description:
      "Maintain the primary company profile and default currency used across the system.",
    href: "/app/company",
    icon: Building2,
    title: "Company Setup",
  },
  {
    description:
      "Create and manage fiscal years and mark the single active year for accounting.",
    href: "/app/fiscal-years",
    icon: CalendarRange,
    title: "Fiscal Years",
  },
  {
    description:
      "Register projects with a unique code, location, and active status.",
    href: "/app/projects",
    icon: FolderKanban,
    title: "Projects",
  },
  {
    description:
      "Review the five system account classes that anchor the chart of accounts.",
    href: "/app/accounts/classes",
    icon: Layers,
    title: "Account Classes",
  },
  {
    description:
      "Open Customers & Bookings to maintain customer, item, and booking control records for the internal accounting workflow.",
    href: "/app/customers",
    icon: Users,
    title: "Customers & Bookings",
  },
  {
    description:
      "Review booking summaries, installment schedules, pending allocations, and posted receipt collection effects.",
    href: "/app/bookings",
    icon: BookText,
    title: "Booking Control",
  },
];

export default function AppOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="Set up accounting foundations and use Customers & Bookings for internal booking control. Voucher posting remains in the voucher workflow."
        title="Welcome"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;

          return (
            <Link className="group" href={section.href} key={section.href}>
              <Card className="h-full transition group-hover:border-foreground/20 group-hover:shadow-md">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold text-foreground">
                      {section.title}
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    Open
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
