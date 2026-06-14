"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getAccountClasses,
  toErrorMessage,
  type AccountClass,
} from "@/lib/api";
import {
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  Notice,
  PageIntro,
  StatusBadge,
} from "../../_components/ui";

export default function AccountClassesPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountClasses, setAccountClasses] = useState<AccountClass[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await getAccountClasses(controller.signal);
        setAccountClasses(data);
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

  return (
    <div className="flex flex-col gap-6">
      <PageIntro
        description="The five system account classes. These are fixed reference data and cannot be changed."
        title="Account Classes"
      />

      {status === "loading" ? (
        <LoadingPanel message="Loading account classes..." />
      ) : null}

      {status === "error" ? (
        <Notice tone="error">{loadError}</Notice>
      ) : null}

      {status === "ready" ? (
        <Card>
          <CardHeader
            description="Read-only system reference. Account groups and ledger accounts are organized under these classes in a later step."
            title="System account classes"
          />

          {accountClasses.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                description="The system account classes have not been seeded."
                title="No account classes found"
              />
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Normal balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accountClasses.map((accountClass) => (
                    <tr
                      className="border-b border-border/70 last:border-0"
                      key={accountClass.id}
                    >
                      <td className="px-3 py-3 font-medium text-foreground">
                        {accountClass.code}
                      </td>
                      <td className="px-3 py-3 text-foreground">
                        {accountClass.name}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge tone="neutral">
                          {accountClass.normalBalance}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
