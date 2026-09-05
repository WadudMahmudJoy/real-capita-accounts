import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

let passed = 0;
let failed = 0;

async function check(name: string, verification: () => unknown | Promise<unknown>) {
  try {
    await verification();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const root = process.cwd();
  const workspacePath = path.join(
    root,
    "apps/web/src/app/app/employees/work-schedules/work-schedule-workspace.tsx",
  );
  const clientPath = path.join(root, "apps/web/src/lib/api.ts");
  const assignmentPanelPath = path.join(
    root,
    "apps/web/src/app/app/employees/work-schedules/work-schedule-assignment-panel.tsx",
  );
  const workspaceSource = await readFile(workspacePath, "utf8");
  const clientSource = await readFile(clientPath, "utf8");
  const assignmentPanelSource = await readFile(assignmentPanelPath, "utf8");
  const webSource = `${workspaceSource}\n${assignmentPanelSource}`;

  const helpers = await import(
    "../apps/web/src/app/app/employees/work-schedules/work-schedule-view"
  ).catch(() => null);

  await check("Web scheduling helpers exist", () => assert.ok(helpers));

  if (helpers) {
  await check("Dhaka business date advances before UTC midnight", () => {
    assert.equal(
      helpers.realCapitaBusinessDate(new Date("2026-09-01T18:30:00.000Z")),
      "2026-09-02",
    );
  });

  await check("approved setup defaults contain seven exact day rules", () => {
    const days = helpers.initialWorkScheduleDays();
    assert.equal(days.length, 7);
    assert.deepEqual(
      days.find((day: { dayOfWeek: string }) => day.dayOfWeek === "FRIDAY"),
      {
        dayOfWeek: "FRIDAY",
        isWorkingDay: false,
        startMinuteOfDay: null,
        endMinuteOfDay: null,
        unpaidBreakMinutes: 0,
        crossesMidnight: false,
      },
    );
    assert.equal(
      days.filter(
        (day: { isWorkingDay: boolean; startMinuteOfDay: number | null; endMinuteOfDay: number | null; unpaidBreakMinutes: number }) =>
          day.isWorkingDay &&
          day.startMinuteOfDay === 600 &&
          day.endMinuteOfDay === 1080 &&
          day.unpaidBreakMinutes === 60,
      ).length,
      6,
    );
  });

  await check("current/default partitions honor half-open ranges", () => {
    const rows = [
      { id: "old", effectiveFrom: "2026-09-01", effectiveTo: "2026-10-01", cancelledAt: null },
      { id: "new", effectiveFrom: "2026-10-01", effectiveTo: null, cancelledAt: null },
      { id: "cancelled", effectiveFrom: "2026-11-01", effectiveTo: null, cancelledAt: "2026-09-02T00:00:00Z" },
    ];
    const partition = helpers.partitionAssignments(rows, "2026-10-01");
    assert.equal(partition.current?.id, "new");
    assert.deepEqual(partition.planned, []);
    assert.deepEqual(partition.history.map((row: { id: string }) => row.id).sort(), ["cancelled", "old"]);
  });

  await check("initial week has an AGM-facing working-day summary", () => {
    assert.equal(
      helpers.summarizeWorkingDays(helpers.initialWorkScheduleDays()),
      "Saturday–Thursday",
    );
  });

  await check("simultaneous overrides for different Employees remain visible", () => {
    const rows = [
      { id: "employee-a", effectiveFrom: "2026-09-01", effectiveTo: null, cancelledAt: null },
      { id: "employee-b", effectiveFrom: "2026-09-01", effectiveTo: null, cancelledAt: null },
    ];
    assert.deepEqual(
      helpers.employeeOverridesForDisplay(rows, "2026-09-05").map(
        (row: { id: string }) => row.id,
      ),
      ["employee-a", "employee-b"],
    );
  });
  }

  await check("workspace does not derive its business date in UTC", () => {
    assert.doesNotMatch(workspaceSource, /toISOString\(\)\.slice\(0,\s*10\)/);
  });

  await check("workspace has no broken current-gap setup action", () => {
    assert.doesNotMatch(workspaceSource, /Set Current Work Schedule/);
  });

  await check("planned cancellation uses the accessible confirmation dialog", () => {
    assert.doesNotMatch(workspaceSource, /window\.prompt/);
    assert.match(workspaceSource, /ConfirmationDialog/);
  });

  await check("schedule lifecycle controls are present", () => {
    assert.match(workspaceSource, /Inactivate/);
    assert.match(workspaceSource, /Reactivate/);
  });

  await check("allowed schedule metadata editing is present", () => {
    assert.match(workspaceSource, /Edit Details/);
    assert.match(workspaceSource, /name:\s*metadataName\.trim\(\)/);
    assert.match(workspaceSource, /description:/);
  });

  await check("employee and date resolution preview is wired", () => {
    assert.match(workspaceSource, /getEffectiveWorkSchedule/);
    assert.match(webSource, /Check Effective Schedule/);
  });

  await check("stale conflicts use controlled reload copy", () => {
    assert.match(workspaceSource, /changed after this page loaded/);
    assert.match(workspaceSource, /setCancelTarget\(null\)/);
  });

  await check("long Work Schedule content is explicitly wrappable", () => {
    assert.match(workspaceSource, /break-words/);
    assert.match(assignmentPanelSource, /break-words/);
  });

  await check("typed client covers definition create and detail", () => {
    assert.match(clientSource, /export function createWorkSchedule\(/);
    assert.match(clientSource, /export function getWorkSchedule\(/);
  });

  await check("typed client preserves exact secured mutation payloads", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ id: "verified" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }) as typeof fetch;
    try {
      const api = await import("../apps/web/src/lib/api");
      const definition = {
        name: "Verification Schedule",
        description: null,
        days: [],
      };
      await api.createWorkSchedule(definition);
      await api.updateWorkSchedule("schedule/id", { isActive: false });
      await api.createWorkScheduleAssignment({
        scope: "COMPANY_DEFAULT",
        effectiveFrom: "2026-09-01",
        newSchedule: { ...definition, code: "STANDARD_OFFICE" },
      });
      assert.deepEqual(
        requests.map((request) => ({
          body: request.init.body ? JSON.parse(String(request.init.body)) : undefined,
          credentials: request.init.credentials,
          method: request.init.method,
          path: new URL(request.url).pathname,
        })),
        [
          { body: definition, credentials: "include", method: "POST", path: "/work-schedules" },
          { body: { isActive: false }, credentials: "include", method: "PATCH", path: "/work-schedules/schedule%2Fid" },
          {
            body: {
              scope: "COMPANY_DEFAULT",
              effectiveFrom: "2026-09-01",
              newSchedule: { ...definition, code: "STANDARD_OFFICE" },
            },
            credentials: "include",
            method: "POST",
            path: "/work-schedules/assignments",
          },
        ],
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  console.log(`Work Schedule Web verification: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

void main();
