import { ClipboardList, FileSignature, Package, Settings, Table2, Wrench } from "lucide-react";

export const modulePreviewsEnabled = process.env.NODE_ENV === "development";

export const modulePreviews = {
  settings: {
    title: "Settings",
    description: "Preview the workspace for ERP configuration.",
    icon: Settings,
  },
  "daily-sheets": {
    title: "Daily Sheets",
    description: "Preview the workspace for daily sheets.",
    icon: Table2,
  },
  "daily-acquisition": {
    title: "Daily Acquisition",
    description: "Preview the workspace for daily acquisition records.",
    icon: ClipboardList,
  },
  inventory: {
    title: "Inventory",
    description: "Preview the workspace for inventory records.",
    icon: Package,
  },
  "work-orders": {
    title: "Work Orders",
    description: "Preview the workspace for work orders.",
    icon: Wrench,
  },
  "offer-letters": {
    title: "Offer Letters",
    description: "Preview the workspace for offer letters.",
    icon: FileSignature,
  },
} as const;

export function isModulePreviewPath(pathname: string) {
  return modulePreviewsEnabled && Object.keys(modulePreviews).some((slug) => pathname === `/app/${slug}`);
}
