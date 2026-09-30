// Types for lib.js so TypeScript packages (e.g. packages/mcp) can reuse the installer logic.
export interface RegistryFile {
  path: string;
  content: string;
}
export interface RegistryItem {
  slug: string;
  name?: string;
  version?: string;
  files: RegistryFile[];
  dependencies: string[];
}
export type WriteAction = "create" | "overwrite" | "unchanged" | "conflict";
export interface PlannedWrite {
  path: string;
  abs: string;
  content: string;
  action: WriteAction;
}
export function resolveTarget(root: string, srcDir: string, relPath: string): string;
export function planWrites(
  files: RegistryFile[],
  opts: {
    root: string;
    srcDir: string;
    overwrite: boolean;
    readExisting: (abs: string) => string | null;
  },
): PlannedWrite[];
export function parseArgs(argv: string[]): {
  command: string | undefined;
  slug: string | undefined;
  src: string;
  overwrite: boolean;
  dryRun: boolean;
  api: string | undefined;
};
export function checkRegistryItem(item: unknown): RegistryItem;
