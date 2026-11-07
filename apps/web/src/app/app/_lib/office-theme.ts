export const OFFICE_BRANDING_UPDATED_EVENT = "real-capita:office-branding-updated";

/**
 * Deterministic, dependency-free office theme derived from the single
 * arbitrary office color (Company.brandAccentColor). The application owns
 * every derived shade; offices never control raw CSS.
 */
export type OfficeTheme = {
  isDefault: boolean;
  accent: string;
  sidebarStart: string;
  sidebarMid: string;
  sidebarEnd: string;
  sidebarHover: string;
  workspaceTint: string;
  workspaceTintStrong: string;
  accentSoft: string;
  borderAccent: string;
};

const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;

// The existing Real Capita application treatment: used whenever no valid
// office accent is configured, so the default office stays visually stable.
const DEFAULT_THEME: OfficeTheme = {
  isDefault: true,
  accent: "#1F78B5",
  sidebarStart: "#126A84",
  sidebarMid: "#0F7A78",
  sidebarEnd: "#13806C",
  sidebarHover: "#2E7C93",
  workspaceTint: "#EDF6F5",
  workspaceTintStrong: "#EAF4F6",
  accentSoft: "#E0F0F7",
  borderAccent: "#B8D5D8",
};

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => {
    const clamped = Math.min(255, Math.max(0, Math.round(value)));
    return clamped.toString(16).padStart(2, "0").toUpperCase();
  };
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Deterministic channel-wise mix; `weight` is the portion of `to`. */
function mixHex(fromHex: string, toHex: string, weight: number): string {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  const mix = (a: number, b: number) => a + (b - a) * weight;
  return rgbToHex({
    r: mix(from.r, to.r),
    g: mix(from.g, to.g),
    b: mix(from.b, to.b),
  });
}

/** WCAG relative luminance for an #RRGGBB color. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928
      ? scaled / 12.92
      : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  );
}

/** WCAG contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const luminanceA = relativeLuminance(a);
  const luminanceB = relativeLuminance(b);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

// Sidebar text/icons are light, so a usable office sidebar must be dark. Mix
// the accent substantially toward black, then keep darkening until white text
// reaches the readable 4.5:1 contract (pure black always satisfies it, so the
// loop terminates). Very light accents such as #FFFFFF or #FFFF00 therefore
// still produce a safe dark related shade.
const SIDEBAR_WHITE_TEXT_CONTRAST = 4.5;

function darkSidebarShade(accentHex: string, blackWeight: number): string {
  let weight = blackWeight;
  let shade = mixHex(accentHex, "#000000", weight);
  while (
    contrastRatio("#FFFFFF", shade) < SIDEBAR_WHITE_TEXT_CONTRAST &&
    weight < 1
  ) {
    weight = Math.min(1, weight + 0.05);
    shade = mixHex(accentHex, "#000000", weight);
  }
  return shade;
}

/**
 * Resolves the office theme from the single arbitrary office color. Only an
 * exact #RRGGBB value is accepted; null or anything else preserves the
 * existing application default treatment.
 */
export function resolveOfficeTheme(
  brandAccentColor: string | null,
): OfficeTheme {
  if (
    typeof brandAccentColor !== "string" ||
    !ACCENT_PATTERN.test(brandAccentColor)
  ) {
    return DEFAULT_THEME;
  }

  const accent = brandAccentColor.toUpperCase();

  const sidebarStart = darkSidebarShade(accent, 0.66);
  const sidebarEnd = darkSidebarShade(accent, 0.8);
  const sidebarMid = mixHex(sidebarStart, sidebarEnd, 0.5);
  const sidebarHover = mixHex(sidebarStart, "#FFFFFF", 0.12);

  // Workspace shades: very light mixes of the same accent so accounting
  // forms and tables stay readable; never a saturated page wash.
  const workspaceTint = mixHex(accent, "#FFFFFF", 0.9);
  const workspaceTintStrong = mixHex(accent, "#FFFFFF", 0.82);
  const accentSoft = mixHex(accent, "#FFFFFF", 0.85);
  const borderAccent = mixHex(accent, "#FFFFFF", 0.55);

  return {
    isDefault: false,
    accent,
    sidebarStart,
    sidebarMid,
    sidebarEnd,
    sidebarHover,
    workspaceTint,
    workspaceTintStrong,
    accentSoft,
    borderAccent,
  };
}

/**
 * Narrow browser event notifying the theme shell that theme-affecting
 * Company branding was persisted (accent, background mode, or custom
 * background). Dispatched only after successful saves.
 */
export function notifyOfficeBrandingUpdated(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(OFFICE_BRANDING_UPDATED_EVENT));
}
