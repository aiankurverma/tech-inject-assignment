/** npm packages a component may depend on. Preview bundles exactly these. */
export const ALLOWED_DEPENDENCIES = [
  "react",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-select",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-tabs",
] as const;

export type AllowedDependency = (typeof ALLOWED_DEPENDENCIES)[number];

/** Bare imports allowed in component source (deps + react internals). */
export const ALLOWED_IMPORTS: readonly string[] = [...ALLOWED_DEPENDENCIES, "react/jsx-runtime"];

/** Files every component needs; always shipped with copy/install/prompt. */
export const THEME_FILE_PATH = "styles/crm-theme.css";
export const UTILS_FILE_PATH = "lib/utils.ts";

export const LIMITS = {
  maxFiles: 20,
  maxFileBytes: 100_000,
  maxTotalBytes: 500_000,
  maxThumbnailBytes: 300_000,
  maxExamples: 12,
} as const;

/** Main CSS setup for consumers. The font @import must come first: CSS ignores @import after other rules. */
export const CSS_SETUP = [
  '@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap");',
  '@import "tailwindcss";',
  '@import "./styles/crm-theme.css";',
].join("\n");
