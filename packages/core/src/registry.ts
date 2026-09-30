import type { Bundle } from "./bundle";
import { CSS_SETUP, THEME_FILE_PATH, UTILS_FILE_PATH } from "./constants";

export interface ThemeFiles {
  themeCss: string;
  utilsTs: string;
}

export interface RegistryItem {
  slug: string;
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  /** Paths are relative to the consumer's src folder. */
  files: { path: string; content: string }[];
  /** Example usage for the consumer (not written by the installer). */
  example: string;
}

/** Theme + utils + component files. The same object feeds copy code, the CLI and the agent prompt. */
export function buildRegistryItem(bundle: Bundle, theme: ThemeFiles): RegistryItem {
  const deps = new Set<string>(["clsx", "tailwind-merge", ...bundle.dependencies]);
  deps.delete("react");
  return {
    slug: bundle.slug,
    name: bundle.name,
    version: bundle.version,
    description: bundle.description,
    dependencies: [...deps],
    files: [
      { path: THEME_FILE_PATH, content: theme.themeCss },
      { path: UTILS_FILE_PATH, content: theme.utilsTs },
      ...bundle.files.map((f) => ({ path: f.path, content: f.content })),
    ],
    example: bundle.examples[0]?.code ?? "",
  };
}

/** Install target: `slug` for the public catalogue, `@team/slug` for a team's private component. */
export const installTarget = (slug: string, team?: string) => (team ? `@${team}/${slug}` : slug);

export function installCommand(apiOrigin: string, slug: string, team?: string): string {
  return `npx --yes ${apiOrigin}/cli/kitbase.tgz add ${installTarget(slug, team)}`;
}

export type PromptAuth = "none" | "premium" | "team";

export function copyCodeText(item: RegistryItem): string {
  return [
    `// ${item.name} v${item.version} - Kitbase`,
    `// 1) Install dependencies:  npm install ${item.dependencies.join(" ")}`,
    `// 2) Make sure "@/..." resolves to your src folder (tsconfig paths + bundler alias).`,
    `// 3) Create each file below inside src/, then start your main CSS (e.g. src/index.css) with:`,
    ...CSS_SETUP.split("\n").map((l) => `//      ${l}`),
    "",
    ...item.files.map((f) => `// ===== src/${f.path} =====\n${f.content.trimEnd()}\n`),
    `// ===== Example usage =====\n${item.example.trimEnd()}\n`,
  ].join("\n");
}

export function agentPromptText(
  item: RegistryItem,
  opts: { apiOrigin: string; auth: PromptAuth; team?: string },
): string {
  const auth =
    opts.auth === "premium"
      ? "This is a premium component. The installer reads the access token from the KITBASE_TOKEN environment variable. If it is not set, stop and ask the user to set it in their shell. Never ask for the token in chat and never write it into files."
      : opts.auth === "team"
        ? `This component is private to team @${opts.team ?? ""}. The installer reads KITBASE_TOKEN (your personal token, or a team token). Never ask for it in chat or write it to files.`
        : "This is a free component; no token is needed.";
  return [
    `Add the "${item.name}" component (v${item.version}) from the Kitbase component library to this React + TypeScript project.`,
    "",
    "Steps:",
    `1. Check the project uses React 18+, TypeScript and Tailwind CSS v4, and that "@/..." resolves to the src folder (tsconfig "paths" and bundler alias). Add the alias if it is missing.`,
    `2. From the project root run: ${installCommand(opts.apiOrigin, item.slug, opts.team)}`,
    `   ${auth}`,
    "   The installer writes only inside src/ and never overwrites changed files. If it reports a conflict, show it to the user and only use --overwrite if they approve.",
    `3. Install the dependencies it prints: npm install ${item.dependencies.join(" ")}`,
    "4. Start the main CSS file (e.g. src/index.css) with exactly these lines, in this order (the font import must be first):",
    CSS_SETUP,
    "5. Render the component using this example (change the data, keep class names and theme tokens):",
    "```tsx",
    item.example.trimEnd(),
    "```",
    "6. Keep the CRM theme: do not replace crm-* classes, radii, shadows or the Geist font with other styles.",
    "7. Verify: run the type check and the build (for example npx tsc --noEmit && npm run build), start the dev server and confirm the component renders with the dark CRM look. Report any errors and how you fixed them.",
  ].join("\n");
}
