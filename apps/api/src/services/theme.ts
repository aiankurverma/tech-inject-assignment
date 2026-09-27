import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ThemeFiles } from "@ti/core";

const uiSrc = new URL("../../../../packages/ui/src/", import.meta.url);

/** Theme files shipped with every component. Loaded once at startup from the repo. */
export function loadTheme(): ThemeFiles {
  return {
    themeCss: readFileSync(fileURLToPath(new URL("styles/crm-theme.css", uiSrc)), "utf8"),
    utilsTs: readFileSync(fileURLToPath(new URL("lib/utils.ts", uiSrc)), "utf8"),
  };
}
